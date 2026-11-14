/**
 * @file NSql.js
 * @package @nlib/js-backend
 * @description Moteur de base de données relationnelle SQLite universel et multiplateforme pour NLib.
 * Gère une base SQLite locale en mémoire ou persistante via `sql.js` (WebAssembly)
 * ou délègue automatiquement les requêtes au pont natif de l'application (`NUtil.env.isWebView` / `invokeNative`)
 * lorsqu'exécuté dans un conteneur natif ou une WebView.
 *
 * Principes architecturaux et fiabilisation :
 * - Zero Throw / Zero Reject : aucune exception non interceptée n'est propagée, toutes les erreurs sont journalisées via `NUtil.log`.
 * - Gestion mémoire étanche : libération systématique des statements préparés (`stmt.free()`) dans des blocs `try ... finally`.
 * - Verrouillage anti-concurrence : chargement du module WebAssembly et initialisation protégés contre les appels simultanés.
 * - Normalisation lexicale des paramètres : analyseur SQL contextuel (ignore chaînes, commentaires et identifiants).
 * - Transactions robustes : support des transactions atomiques et imbriquées via `SAVEPOINT` avec rollback garanti.
 * - Détection réactive des changements : bus d'événements `NEvent` (`this.event`) notifiant en temps réel les insertions, modifications, suppressions et créations de tables.
 * - Multiplateforme : fonctionne de façon transparente en navigateur, Web Worker, WebView native et Node.js.
 */

import { NEvent } from '../core/NEvent.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * Structure de réponse standardisée pour les opérations NSql.
 * @typedef {Object} NSqlResponse
 * @property {boolean} ok - Indique si l'opération a réussi.
 * @property {any} [data=null] - Les données retournées par l'opération.
 * @property {string|null} [error=null] - Message d'erreur explicite en cas d'échec.
 * @property {string|null} [code=null] - Code d'erreur machine.
 */

/**
 * @class NSql
 * @description Gestionnaire universel de base de données SQLite (sql.js WebAssembly / Pont applicatif natif).
 *
 * @example <caption>Exemple 1 : Initialiser une base SQLite avec une structure déclarative</caption>
 * const sql = new NSql();
 * await sql.init({
 *     dbStructure: {
 *         users: "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT);"
 *     }
 * });
 * const insertRes = await sql.insert('users', { name: 'Alice', email: 'alice@test.com' });
 * console.log('Nouvel ID inséré :', insertRes);
 *
 * @example <caption>Exemple 2 : Requêtes paramétrées sécurisées (nommées ou positionnelles)</caption>
 * const user = await sql.selectOne('SELECT * FROM users WHERE id = :id', { id: 1 });
 * console.log('Utilisateur trouvé :', user?.name);
 *
 * @example <caption>Exemple 3 : Transaction atomique sécurisée</caption>
 * const txRes = await sql.transaction(async (tx) => {
 *     await tx.insert('users', { name: 'Bob', email: 'bob@test.com' });
 *     await tx.insert('users', { name: 'Charlie', email: 'charlie@test.com' });
 *     return true;
 * });
 * console.log('Transaction réussie :', txRes.ok);
 */
export class NSql {

    // =========================================================================
    // Propriétés statiques privées (Cache et verrous globaux du module WASM)
    // =========================================================================

    /**
     * Instance mise en cache du module WASM sql.js.
     * @type {any}
     * @private
     */
    static #sqlJsModule = null;

    /**
     * Promesse de chargement de sql.js en cours pour éviter les chargements simultanés redondants.
     * @type {Promise<any>|null}
     * @private
     */
    static #moduleLoadingPromise = null;

    // =========================================================================
    // Propriétés d'instance privées
    // =========================================================================

    /**
     * Instance de la base SQLite ouverte (SQL.Database de sql.js).
     * @type {any}
     * @private
     */
    #db = null;

    /**
     * Nom logique de la base ou identifiant de session.
     * @type {string}
     * @private
     */
    #name = 'main';

    /**
     * Indique si l'instance a été initialisée et est prête pour les requêtes.
     * @type {boolean}
     * @private
     */
    #isInitialized = false;

    /**
     * Chemin ou fonction pour localiser le binaire sql-wasm.wasm.
     * @type {string|Function|null}
     * @private
     */
    #wasmPath = null;

    /**
     * Verrou de promesse d'initialisation pour empêcher les initialisations concurrentes d'une même instance.
     * @type {Promise<boolean>|null}
     * @private
     */
    #initPromise = null;

    /**
     * Profondeur d'imbrication des transactions courantes pour la gestion des SAVEPOINTs.
     * @type {number}
     * @private
     */
    #transactionDepth = 0;

    /**
     * Instance interne de `NEvent` pour la détection et notification des changements dans la base.
     * Allocation paresseuse : reste à null tant que `this.event` n'est pas accédé.
     * @type {NEvent|null}
     * @private
     */
    #event = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de NSql.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration de la base.
     * @param {string} [options.name='main'] - Nom logique de la base.
     * @param {string|Function} [options.wasmPath] - URL ou locateFile vers `sql-wasm.wasm`.
     *
     * @example <caption>Exemple 1 : Instanciation standard</caption>
     * const sql = new NSql();
     *
     * @example <caption>Exemple 2 : Instanciation avec chemin WASM personnalisé</caption>
     * const sql = new NSql({ name: 'pos', wasmPath: '/assets/wasm/sql-wasm.wasm' });
     */
    constructor(options = {}) {
        if (options && typeof options === 'object') {
            if (typeof options.name === 'string' && options.name.trim()) {
                this.#name = options.name.trim();
            }
            if (options.wasmPath) {
                this.#wasmPath = options.wasmPath;
            }
        }
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    /**
     * Retourne le nom de la base de données.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le nom de la base</caption>
     * console.log(sql.name); // 'main'
     *
     * @example <caption>Exemple 2 : Utilisation dans un message de journalisation</caption>
     * console.log(`Base active : ${sql.name}`);
     */
    get name() {
        return this.#name;
    }

    /**
     * Indique si la base est initialisée et prête à recevoir des requêtes.
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier l'initialisation</caption>
     * if (!sql.isInitialized) { await sql.init(); }
     *
     * @example <caption>Exemple 2 : Condition avant fermeture</caption>
     * console.log('Prêt :', sql.isInitialized);
     */
    get isInitialized() {
        return this.#isInitialized;
    }

    /**
     * Indique si la base est actuellement ouverte et opérationnelle (alias de commodité).
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier si la base est ouverte</caption>
     * if (sql.isOpen) { console.log('Base active'); }
     *
     * @example <caption>Exemple 2 : Condition de sauvegarde</caption>
     * if (sql.isOpen) { await sql.export(); }
     */
    get isOpen() {
        return this.#isInitialized && Boolean(this.#db || this.#isNativeApp());
    }

    /**
     * Indique si le moteur SQL s'exécute via le pont applicatif natif (WebView / conteneur).
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Détecter le mode natif</caption>
     * console.log('SQLite natif :', sql.isNative);
     *
     * @example <caption>Exemple 2 : Différencier WebAssembly et natif</caption>
     * if (!sql.isNative) { console.log('Moteur WebAssembly sql.js'); }
     */
    get isNative() {
        return this.#isNativeApp();
    }

    /**
     * Retourne l'instance native sous-jacente `SQL.Database` (si exécuté en WebAssembly sql.js).
     * @type {any}
     *
     * @example <caption>Exemple 1 : Accéder à l'objet SQL.Database brut</caption>
     * const rawDb = sql.rawDatabase;
     *
     * @example <caption>Exemple 2 : Vérification de présence</caption>
     * if (sql.rawDatabase) { console.log('Moteur sql.js actif en mémoire'); }
     */
    get rawDatabase() {
        return this.#db;
    }

    /**
     * Accès direct à la classe utilitaire transversale `NUtil`.
     * @type {typeof NUtil}
     *
     * @example <caption>Exemple 1 : Accès au logger via sql.util.log</caption>
     * sql.util.log.info('Opération SQL terminée');
     *
     * @example <caption>Exemple 2 : Utilitaires de conversion</caption>
     * console.log(sql.util.str.camelCase('table_name'));
     */
    get util() {
        return NUtil;
    }

    /**
     * Gestionnaire d'événements réactif de l'instance `NSql`.
     * Permet d'écouter les opérations et changements intervenant sur la base de données :
     * - Événement général : `'change'` (reçoit `{ type, table, database, timestamp, ... }`)
     * - Événements par action : `'insert'`, `'update'`, `'delete'`, `'createTable'`, `'dropTable'`, `'clear'`, etc.
     * - Événements ciblés par table : `'insert:tableName'`, `'update:tableName'`, `'delete:tableName'`, `'createTable:tableName'`
     * - Canal de table unifié : `'tableName:change'`
     *
     * @type {NEvent}
     *
     * @example <caption>Exemple 1 : Écouter les insertions sur la table users</caption>
     * sql.event.on('insert:users', (evt) => {
     *     console.log('Utilisateur inséré :', evt.data, 'ID généré :', evt.id);
     * });
     *
     * @example <caption>Exemple 2 : Écouter tous les changements d'une table spécifique</caption>
     * sql.event.on('products:change', (evt) => {
     *     console.log(`Action [${evt.type}] sur les produits :`, evt);
     * });
     *
     * @example <caption>Exemple 3 : Écouter l'ensemble des modifications de la base</caption>
     * sql.event.on('change', ({ type, table, data }) => {
     *     console.log(`Changement SQL [${type}] sur la table "${table}" :`, data);
     * });
     */
    get event() {
        if (!this.#event) {
            this.#event = new NEvent(this);
        }
        return this.#event;
    }

    // =========================================================================
    // Initialisation & Cycle de Vie
    // =========================================================================

    /**
     * Initialise la base de données SQL.
     * Protégée contre les appels simultanés (concurrence sécurisée par promesse partagée).
     * Libère proprement toute base déjà existante avant d'en instancier une nouvelle afin d'éviter les fuites mémoire.
     *
     * Options acceptées :
     * - `dbStructure` : Schéma sous forme d'objet `{ table: 'CREATE TABLE ...' }`
     * - `dbBaseData` : Script SQL initial à exécuter à la création
     * - `dbUint8ArrayData` : Données binaires d'un fichier SQLite existant
     * - `dbBase64Data` : Données d'un fichier SQLite encodées en Base64
     * - `wasmPath` : Chemin vers le fichier `sql-wasm.wasm`
     *
     * @async
     * @method init
     * @param {Object} [options={}] - Options d'initialisation.
     * @returns {Promise<boolean>} `true` si l'initialisation a réussi, `false` sinon.
     *
     * @example <caption>Exemple 1 : Initialisation vierge</caption>
     * const ok = await sql.init();
     * console.log('Base prête :', ok);
     *
     * @example <caption>Exemple 2 : Initialisation avec structure et données Base64</caption>
     * await sql.init({
     *     dbBase64Data: 'SGVsbG8...',
     *     dbStructure: {
     *         products: 'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT);'
     *     }
     * });
     */
    async init(options = {}) {
        if (this.#initPromise) {
            return this.#initPromise;
        }

        this.#initPromise = (async () => {
            const opts = options && typeof options === 'object' ? options : {};

            // 1. Détection environnement Application / WebView native
            if (this.#isNativeApp()) {
                try {
                    const res = await this.#requestNative('init', opts);
                    this.#isInitialized = res?.ok ?? Boolean(res);
                    return this.#isInitialized;
                } catch (err) {
                    NUtil.log.error('NSql.init : Échec de l\'initialisation SQLite native.', {
                        code: 'ERR_SQL_NATIVE_INIT',
                        error: err,
                        stack: err?.stack,
                        database: this.#name
                    });
                    this.#isInitialized = false;
                    return false;
                }
            }

            // 2. Initialisation WebAssembly sql.js
            try {
                const SQL = await this.#ensureSqlJsModule(opts.wasmPath || this.#wasmPath);
                if (!SQL) {
                    NUtil.log.error('NSql.init : Module sql.js non disponible pour l\'initialisation.', {
                        code: 'ERR_SQL_JS_UNAVAILABLE',
                        database: this.#name
                    });
                    this.#isInitialized = false;
                    return false;
                }

                // Fermeture préalable de toute base existante pour éviter les fuites de mémoire WASM
                if (this.#db) {
                    this.close();
                }

                let initialBinaryData = null;
                if (opts.dbUint8ArrayData instanceof Uint8Array) {
                    initialBinaryData = opts.dbUint8ArrayData;
                } else if (typeof opts.dbBase64Data === 'string' && opts.dbBase64Data.trim()) {
                    initialBinaryData = this.#base64ToUint8(opts.dbBase64Data);
                }

                if (initialBinaryData && initialBinaryData.length > 0) {
                    this.#db = new SQL.Database(initialBinaryData);
                } else {
                    this.#db = new SQL.Database();
                }

                // Exécution du script de données initial ou de la structure
                if (typeof opts.dbBaseData === 'string' && opts.dbBaseData.trim()) {
                    this.#db.run(opts.dbBaseData);
                } else if (!initialBinaryData && opts.dbStructure && typeof opts.dbStructure === 'object') {
                    await this.createTables(opts.dbStructure);
                }

                this.#isInitialized = true;
                return true;
            } catch (err) {
                NUtil.log.error('NSql.init : Échec de l\'initialisation du moteur sql.js.', {
                    code: 'ERR_SQL_INIT_FAILED',
                    error: err,
                    stack: err?.stack,
                    database: this.#name
                });
                if (this.#db) {
                    try {
                        this.#db.close();
                    } catch {
                        // ignore
                    }
                    this.#db = null;
                }
                this.#isInitialized = false;
                return false;
            }
        })();

        try {
            return await this.#initPromise;
        } finally {
            this.#initPromise = null;
        }
    }

    /**
     * Ferme la connexion à la base de données et libère toutes les ressources WebAssembly allouées.
     *
     * @method close
     * @returns {boolean} `true` si la base est fermée.
     *
     * @example <caption>Exemple 1 : Fermer la base SQLite</caption>
     * sql.close();
     *
     * @example <caption>Exemple 2 : Vérifier la fermeture</caption>
     * const closed = sql.close();
     * console.log('Fermé :', closed);
     */
    close() {
        if (this.#db) {
            try {
                this.#db.close();
            } catch (err) {
                NUtil.log.warn('NSql.close : Avertissement lors de la fermeture de la base.', {
                    code: 'WARN_SQL_CLOSE',
                    error: err,
                    database: this.#name
                });
            }
            this.#db = null;
        }
        this.#isInitialized = false;
        this.#transactionDepth = 0;
        return true;
    }

    // =========================================================================
    // Création & Gestion des Tables
    // =========================================================================

    /**
     * Crée une table dans la base à partir de son nom et de son instruction SQL de création.
     *
     * @async
     * @method createTable
     * @param {string} tableName - Nom de la table.
     * @param {string} sqlCreateTable - Requête SQL `CREATE TABLE`.
     * @returns {Promise<boolean>}
     *
     * @example <caption>Exemple 1 : Créer une table utilisateurs</caption>
     * const ok = await sql.createTable('users', 'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT);');
     * console.log('Table créée :', ok);
     *
     * @example <caption>Exemple 2 : Créer une table de configuration</caption>
     * await sql.createTable('settings', 'CREATE TABLE settings (key TEXT PRIMARY KEY, val TEXT);');
     */
    async createTable(tableName, sqlCreateTable) {
        if (!tableName || !sqlCreateTable) return false;

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('createTable', { tableName, sqlCreateTable });
            const ok = Boolean(res?.ok ?? res);
            if (ok) {
                this.#emitChange('createTable', tableName, { sql: sqlCreateTable });
            }
            return ok;
        }

        if (!this.#ensureDbReady()) return false;

        try {
            this.#db.run(sqlCreateTable);
            this.#emitChange('createTable', tableName, { sql: sqlCreateTable });
            return true;
        } catch (err) {
            NUtil.log.error(`NSql.createTable : Échec de la création de la table "${tableName}".`, {
                code: 'ERR_SQL_CREATE_TABLE',
                tableName,
                sql: sqlCreateTable,
                error: err,
                stack: err?.stack
            });
            return false;
        }
    }

    /**
     * Crée plusieurs tables à partir d'un dictionnaire `{ tableName: sqlCreateTable }`.
     *
     * @async
     * @method createTables
     * @param {Object<string, string>} dbStructure - Structure des tables.
     * @returns {Promise<boolean>}
     *
     * @example <caption>Exemple 1 : Créer un jeu complet de tables</caption>
     * await sql.createTables({
     *     clients: 'CREATE TABLE clients (id INTEGER PRIMARY KEY, nom TEXT);',
     *     factures: 'CREATE TABLE factures (id INTEGER PRIMARY KEY, montant REAL, client_id INTEGER);'
     * });
     *
     * @example <caption>Exemple 2 : Vérification du succès groupé</caption>
     * const success = await sql.createTables(schema);
     */
    async createTables(dbStructure) {
        if (!dbStructure || typeof dbStructure !== 'object') return false;

        for (const [tableName, sqlCreate] of Object.entries(dbStructure)) {
            const ok = await this.createTable(tableName, sqlCreate);
            if (!ok) return false;
        }
        return true;
    }

    // =========================================================================
    // Exécution de Requêtes (Query & Selections)
    // =========================================================================

    /**
     * Exécute une requête SQL d'action (INSERT, UPDATE, DELETE, DDL) sans attendre de résultats.
     * Libération garantie du statement préparé dans un bloc `finally`.
     *
     * @async
     * @method query
     * @param {string} sql - Requête SQL à exécuter.
     * @param {Array|Object} [params=[]] - Paramètres nommés (`{ key: val }`) ou positionnels (`[val1, val2]`).
     * @returns {Promise<boolean>} `true` si la requête s'est exécutée avec succès, `false` sinon.
     *
     * @example <caption>Exemple 1 : Créer un index via query()</caption>
     * await sql.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
     *
     * @example <caption>Exemple 2 : Suppression avec paramètres nommés</caption>
     * await sql.query('DELETE FROM users WHERE age < :minAge', { minAge: 18 });
     */
    async query(sql, params = []) {
        if (this.#isNativeApp()) {
            const res = await this.#requestNative('query', { query: sql, params });
            const ok = Boolean(res?.ok ?? res);
            if (ok) {
                const action = this.#inspectSqlAction(sql);
                if (action) {
                    this.#emitChange(action.type, action.table, { sql, params });
                }
            }
            return ok;
        }

        if (!this.#ensureDbReady()) return false;

        let stmt = null;
        try {
            const { cleanSql, cleanParams } = this.#normalizeParams(sql, params);
            stmt = this.#db.prepare(cleanSql);
            stmt.bind(cleanParams);
            stmt.step();

            const action = this.#inspectSqlAction(sql);
            if (action) {
                this.#emitChange(action.type, action.table, { sql, params });
            }

            return true;
        } catch (err) {
            NUtil.log.error('NSql.query : Échec d\'exécution de la requête.', {
                code: 'ERR_SQL_QUERY',
                sql,
                params,
                error: err,
                stack: err?.stack
            });
            return false;
        } finally {
            if (stmt) {
                try {
                    stmt.free();
                } catch {
                    // Ignore les erreurs de libération
                }
            }
        }
    }

    /**
     * Exécute une requête SQL générale et retourne une réponse normalisée `{ ok, data, error, code }`.
     * Fournit un accès universel avec gestion des lignes modifiées et des résultats.
     *
     * @async
     * @method execute
     * @param {string} sql - Requête SQL à exécuter.
     * @param {Array|Object} [params=[]] - Paramètres de la requête.
     * @returns {Promise<NSqlResponse>} Réponse standardisée contenant les résultats et métadonnées.
     *
     * @example <caption>Exemple 1 : Exécuter un SELECT via execute()</caption>
     * const res = await sql.execute('SELECT * FROM users WHERE active = :act', { act: 1 });
     * if (res.ok) { console.log('Lignes :', res.data.rows); }
     *
     * @example <caption>Exemple 2 : Exécuter un UPDATE avec vérification des lignes modifiées</caption>
     * const res = await sql.execute('UPDATE users SET role = ? WHERE id = ?', ['admin', 1]);
     * console.log('Modifiées :', res.data?.rowsModified);
     */
    async execute(sql, params = []) {
        if (!sql || typeof sql !== 'string') {
            return {
                ok: false,
                data: null,
                error: 'Requête SQL invalide ou manquante.',
                code: 'ERR_SQL_INVALID_INPUT'
            };
        }

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('execute', { query: sql, params });
            const isOk = res && typeof res === 'object' && 'ok' in res ? Boolean(res.ok) : Boolean(res);
            if (isOk) {
                const action = this.#inspectSqlAction(sql);
                if (action) {
                    this.#emitChange(action.type, action.table, {
                        sql,
                        params,
                        rowsModified: res?.data?.rowsModified ?? 0,
                        id: res?.data?.lastInsertRowId ?? null
                    });
                }
            }
            if (res && typeof res === 'object' && 'ok' in res) {
                return res;
            }
            return { ok: Boolean(res), data: res ?? null, error: null, code: null };
        }

        if (!this.#ensureDbReady()) {
            return {
                ok: false,
                data: null,
                error: 'Base de données non initialisée.',
                code: 'ERR_SQL_NOT_INITIALIZED'
            };
        }

        let stmt = null;
        try {
            const { cleanSql, cleanParams } = this.#normalizeParams(sql, params);
            stmt = this.#db.prepare(cleanSql);
            stmt.bind(cleanParams);

            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }

            const rowsModified = typeof this.#db.getRowsModified === 'function'
                ? this.#db.getRowsModified()
                : 0;

            let lastInsertRowId = null;
            try {
                const lastIdRes = this.#db.exec('SELECT last_insert_rowid() AS lastId');
                if (lastIdRes && lastIdRes.length > 0 && lastIdRes[0].values?.length > 0) {
                    lastInsertRowId = lastIdRes[0].values[0][0];
                }
            } catch {
                // Ignore
            }

            const action = this.#inspectSqlAction(sql);
            if (action) {
                this.#emitChange(action.type, action.table, {
                    sql,
                    params,
                    rowsModified,
                    id: lastInsertRowId
                });
            }

            return {
                ok: true,
                data: {
                    rows,
                    rowsModified,
                    lastInsertRowId
                },
                error: null,
                code: null
            };
        } catch (err) {
            NUtil.log.error('NSql.execute : Échec lors de l\'exécution de la requête SQL.', {
                code: 'ERR_SQL_EXECUTE',
                sql,
                params,
                error: err,
                stack: err?.stack
            });
            return {
                ok: false,
                data: null,
                error: err?.message || String(err),
                code: 'ERR_SQL_EXECUTE'
            };
        } finally {
            if (stmt) {
                try {
                    stmt.free();
                } catch {
                    // Ignore
                }
            }
        }
    }

    /**
     * Exécute une requête `SELECT` et retourne l'ensemble des lignes correspondantes
     * sous la forme d'un tableau d'objets `[ { col: val }, ... ]`.
     * Libération systématique du statement garanti dans un bloc `finally`.
     *
     * @async
     * @method select
     * @param {string} sql - Requête SQL de sélection.
     * @param {Array|Object} [params=[]] - Paramètres de la requête.
     * @returns {Promise<Array<Object>>} Tableau d'objets (vide si aucun résultat ou échec).
     *
     * @example <caption>Exemple 1 : Sélection avec paramètres positionnels (?)</caption>
     * const rows = await sql.select('SELECT * FROM users WHERE age >= ?', [21]);
     * console.log('Majeurs :', rows);
     *
     * @example <caption>Exemple 2 : Sélection avec paramètres nommés (:role)</caption>
     * const admins = await sql.select('SELECT id, name FROM users WHERE role = :role', { role: 'admin' });
     * admins.forEach(a => console.log(a.name));
     */
    async select(sql, params = []) {
        if (this.#isNativeApp()) {
            const res = await this.#requestNative('select', { query: sql, params });
            return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        }

        if (!this.#ensureDbReady()) return [];

        let stmt = null;
        try {
            const { cleanSql, cleanParams } = this.#normalizeParams(sql, params);
            stmt = this.#db.prepare(cleanSql);
            stmt.bind(cleanParams);

            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            return results;
        } catch (err) {
            NUtil.log.error('NSql.select : Échec lors de la sélection SQL.', {
                code: 'ERR_SQL_SELECT',
                sql,
                params,
                error: err,
                stack: err?.stack
            });
            return [];
        } finally {
            if (stmt) {
                try {
                    stmt.free();
                } catch {
                    // Ignore
                }
            }
        }
    }

    /**
     * Sélectionne la première ligne correspondant à la requête et la retourne sous forme d'objet `{ ... }`.
     * Retourne `null` si aucune ligne n'a été trouvée.
     *
     * @async
     * @method selectOne
     * @param {string} sql - Requête SQL de sélection.
     * @param {Array|Object} [params=[]] - Paramètres de la requête.
     * @returns {Promise<Object|null>} Ligne sélectionnée ou `null`.
     *
     * @example <caption>Exemple 1 : Trouver un utilisateur par ID</caption>
     * const user = await sql.selectOne('SELECT * FROM users WHERE id = ?', [1]);
     * console.log('Nom :', user?.name);
     *
     * @example <caption>Exemple 2 : Recherche avec paramètres nommés</caption>
     * const product = await sql.selectOne('SELECT * FROM products WHERE code = :code', { code: 'P01' });
     */
    async selectOne(sql, params = []) {
        if (this.#isNativeApp()) {
            const res = await this.#requestNative('selectOne', { query: sql, params });
            const data = res?.data ?? res;
            return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
        }

        const rows = await this.select(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Sélectionne toutes les lignes d'une table donnée.
     *
     * @async
     * @method selectAll
     * @param {string} tableName - Nom de la table.
     * @returns {Promise<Array<Object>>} Ensemble des lignes de la table.
     *
     * @example <caption>Exemple 1 : Récupérer tout le catalogue produit</caption>
     * const products = await sql.selectAll('products');
     * console.log(`Nombre de produits : ${products.length}`);
     *
     * @example <caption>Exemple 2 : Lister toutes les configurations</caption>
     * const configs = await sql.selectAll('settings');
     */
    async selectAll(tableName) {
        if (!tableName) return [];
        return this.select(`SELECT * FROM \`${this.#escapeIdentifier(tableName)}\``);
    }

    /**
     * Exécute une requête `SELECT` et formate le résultat sous forme de liste :
     * - Si une seule colonne est sélectionnée : retourne un tableau simple `[val1, val2, ...]`.
     * - Si plusieurs colonnes sont sélectionnées : retourne un objet contenant un tableau pour chaque colonne `{ col1: [...], col2: [...] }`.
     * - Si aucun résultat : retourne `null`.
     *
     * @async
     * @method selectAsList
     * @param {string} sql - Requête SQL à exécuter.
     * @param {Array|Object} [params=[]] - Paramètres de la requête.
     * @returns {Promise<Array<any>|Object<string, Array<any>>|null>}
     *
     * @example <caption>Exemple 1 : Colonne unique (retourne un tableau direct)</caption>
     * const ids = await sql.selectAsList('SELECT id FROM users');
     * console.log(ids); // [1, 2, 3]
     *
     * @example <caption>Exemple 2 : Plusieurs colonnes (colonnes transposées en vecteurs)</caption>
     * const vectors = await sql.selectAsList('SELECT id, name FROM users');
     * console.log(vectors); // { id: [1, 2, 3], name: ['Alice', 'Bob', 'Charlie'] }
     */
    async selectAsList(sql, params = []) {
        if (this.#isNativeApp()) {
            const res = await this.#requestNative('selectAsList', { query: sql, params });
            return res?.data ?? res ?? null;
        }

        const rows = await this.select(sql, params);
        if (rows.length === 0) return null;

        const keys = Object.keys(rows[0]);

        // Cas A : une seule colonne -> tableau plat
        if (keys.length === 1) {
            const singleKey = keys[0];
            return rows.map((r) => r[singleKey]);
        }

        // Cas B : plusieurs colonnes -> dictionnaire de tableaux
        const resultObject = Object.fromEntries(keys.map((k) => [k, []]));
        for (const row of rows) {
            for (const key of keys) {
                resultObject[key].push(row[key]);
            }
        }
        return resultObject;
    }

    /**
     * Compte le nombre de lignes dans une table.
     *
     * @async
     * @method countRows
     * @param {string} tableName - Nom de la table.
     * @returns {Promise<number>} Nombre de lignes de la table.
     *
     * @example <caption>Exemple 1 : Compter le nombre de clients</caption>
     * const total = await sql.countRows('customers');
     * console.log(`Clients enregistrés : ${total}`);
     *
     * @example <caption>Exemple 2 : Vérifier si une table est vide</caption>
     * if (await sql.countRows('logs') === 0) { console.log('Aucun log'); }
     */
    async countRows(tableName) {
        if (!tableName) return 0;

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('countRows', { tableName });
            return typeof res?.data === 'number' ? res.data : (typeof res === 'number' ? res : 0);
        }

        const safeTable = this.#escapeIdentifier(tableName);
        const row = await this.selectOne(`SELECT COUNT(*) AS total FROM \`${safeTable}\``);
        return row ? Number(row.total) : 0;
    }

    // =========================================================================
    // Helpers CRUD (Insert, Update, Delete)
    // =========================================================================

    /**
     * Insère un enregistrement dans une table à partir d'un objet clé/valeur.
     * Retourne l'identifiant de la ligne insérée (`last_insert_rowid`) ou `false` en cas d'échec.
     * Libération systématique du statement garanti dans un bloc `finally`.
     *
     * @async
     * @method insert
     * @param {string} tableName - Nom de la table cible.
     * @param {Object<string, any>} data - Données à insérer.
     * @returns {Promise<number|string|false>} ID de la nouvelle ligne ou `false`.
     *
     * @example <caption>Exemple 1 : Insérer un utilisateur</caption>
     * const id = await sql.insert('users', { name: 'David', age: 30, email: 'david@test.com' });
     * console.log('Nouvel ID :', id);
     *
     * @example <caption>Exemple 2 : Insérer un paramètre</caption>
     * const ok = await sql.insert('settings', { key: 'theme', val: 'dark' });
     */
    async insert(tableName, data) {
        if (!tableName || !data || typeof data !== 'object') return false;

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('insert', { tableName, data });
            const resultId = res?.data ?? res ?? false;
            if (resultId !== false) {
                this.#emitChange('insert', tableName, { data, id: resultId });
            }
            return resultId;
        }

        if (!this.#ensureDbReady()) return false;

        let stmt = null;
        try {
            const fields = Object.keys(data);
            const values = Object.values(data).map((v) => this.#formatParamValue(v));
            const placeholders = fields.map(() => '?').join(', ');
            const escapedFields = fields.map((f) => `\`${this.#escapeIdentifier(f)}\``).join(', ');
            const safeTable = this.#escapeIdentifier(tableName);

            const sql = `INSERT INTO \`${safeTable}\` (${escapedFields}) VALUES (${placeholders})`;
            stmt = this.#db.prepare(sql);
            stmt.bind(values);
            stmt.step();

            // Récupération de l'identifiant généré
            let generatedId = true;
            const lastIdRes = this.#db.exec('SELECT last_insert_rowid() AS lastId');
            if (lastIdRes && lastIdRes.length > 0 && lastIdRes[0].values?.length > 0) {
                generatedId = lastIdRes[0].values[0][0];
            }

            this.#emitChange('insert', tableName, { data, id: generatedId });
            return generatedId;
        } catch (err) {
            NUtil.log.error(`NSql.insert : Échec d'insertion dans "${tableName}".`, {
                code: 'ERR_SQL_INSERT',
                tableName,
                data,
                error: err,
                stack: err?.stack
            });
            return false;
        } finally {
            if (stmt) {
                try {
                    stmt.free();
                } catch {
                    // Ignore
                }
            }
        }
    }

    /**
     * Met à jour des enregistrements dans une table selon une condition.
     * Retourne le nombre de lignes modifiées.
     * Libération systématique du statement garanti dans un bloc `finally`.
     *
     * @async
     * @method update
     * @param {string} tableName - Nom de la table.
     * @param {Object<string, any>} data - Données à mettre à jour.
     * @param {string} condition - Clause SQL conditionnelle (ex: 'id = ?' ou 'status = :status').
     * @param {Array|Object} [params=[]] - Paramètres de la condition.
     * @returns {Promise<number>} Nombre de lignes mises à jour (0 si aucune ou échec).
     *
     * @example <caption>Exemple 1 : Mettre à jour un produit par son ID</caption>
     * const updated = await sql.update('products', { price: 250 }, 'id = ?', [10]);
     * console.log(`${updated} ligne(s) modifiée(s)`);
     *
     * @example <caption>Exemple 2 : Mettre à jour avec paramètres nommés dans la condition</caption>
     * await sql.update('users', { active: 1 }, 'role = :r', { r: 'member' });
     */
    async update(tableName, data, condition, params = []) {
        if (!tableName || !data || !condition) return 0;

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('update', { tableName, data, condition, params });
            const rowsCount = typeof res?.data === 'number' ? res.data : (typeof res === 'number' ? res : 0);
            this.#emitChange('update', tableName, { data, condition, params, rowsModified: rowsCount });
            return rowsCount;
        }

        if (!this.#ensureDbReady()) return 0;

        let stmt = null;
        try {
            const fields = Object.keys(data);
            const values = Object.values(data).map((v) => this.#formatParamValue(v));
            const setClause = fields.map((f) => `\`${this.#escapeIdentifier(f)}\` = ?`).join(', ');
            const safeTable = this.#escapeIdentifier(tableName);

            const { cleanSql: cleanCond, cleanParams: condParams } = this.#normalizeParams(condition, params);
            const fullSql = `UPDATE \`${safeTable}\` SET ${setClause} WHERE ${cleanCond}`;

            stmt = this.#db.prepare(fullSql);
            stmt.bind([...values, ...condParams]);
            stmt.step();

            const rowsModified = typeof this.#db.getRowsModified === 'function' ? this.#db.getRowsModified() : 0;
            this.#emitChange('update', tableName, { data, condition, params, rowsModified });
            return rowsModified;
        } catch (err) {
            NUtil.log.error(`NSql.update : Échec de mise à jour de "${tableName}".`, {
                code: 'ERR_SQL_UPDATE',
                tableName,
                data,
                condition,
                params,
                error: err,
                stack: err?.stack
            });
            return 0;
        } finally {
            if (stmt) {
                try {
                    stmt.free();
                } catch {
                    // Ignore
                }
            }
        }
    }

    /**
     * Supprime des enregistrements dans une table selon une condition.
     * Retourne le nombre de lignes supprimées.
     * Libération systématique du statement garanti dans un bloc `finally`.
     *
     * @async
     * @method delete
     * @param {string} tableName - Nom de la table.
     * @param {string} condition - Condition SQL (ex: 'id = ?' ou 'created_at < :date').
     * @param {Array|Object} [params=[]] - Paramètres de la condition.
     * @returns {Promise<number>} Nombre de lignes supprimées.
     *
     * @example <caption>Exemple 1 : Supprimer un élément par ID</caption>
     * const deleted = await sql.delete('users', 'id = ?', [5]);
     * console.log('Lignes supprimées :', deleted);
     *
     * @example <caption>Exemple 2 : Supprimer les sessions expirées</caption>
     * await sql.delete('sessions', 'expires_at < :now', { now: Date.now() });
     */
    async delete(tableName, condition, params = []) {
        if (!tableName || !condition) return 0;

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('delete', { tableName, condition, params });
            const rowsCount = typeof res?.data === 'number' ? res.data : (typeof res === 'number' ? res : 0);
            this.#emitChange('delete', tableName, { condition, params, rowsModified: rowsCount });
            return rowsCount;
        }

        if (!this.#ensureDbReady()) return 0;

        let stmt = null;
        try {
            const safeTable = this.#escapeIdentifier(tableName);
            const { cleanSql: cleanCond, cleanParams: condParams } = this.#normalizeParams(condition, params);
            const fullSql = `DELETE FROM \`${safeTable}\` WHERE ${cleanCond}`;

            stmt = this.#db.prepare(fullSql);
            stmt.bind(condParams);
            stmt.step();

            const rowsModified = typeof this.#db.getRowsModified === 'function' ? this.#db.getRowsModified() : 0;
            this.#emitChange('delete', tableName, { condition, params, rowsModified });
            return rowsModified;
        } catch (err) {
            NUtil.log.error(`NSql.delete : Échec de suppression dans "${tableName}".`, {
                code: 'ERR_SQL_DELETE',
                tableName,
                condition,
                params,
                error: err,
                stack: err?.stack
            });
            return 0;
        } finally {
            if (stmt) {
                try {
                    stmt.free();
                } catch {
                    // Ignore
                }
            }
        }
    }

    // =========================================================================
    // Transactions & Intégrité des Données
    // =========================================================================

    /**
     * Exécute une série d'opérations dans une transaction atomique sécurisée.
     * En cas d'erreur dans le callback, un ROLLBACK automatique est appliqué.
     * Gère les transactions imbriquées via le mécanisme standard des `SAVEPOINT` SQLite.
     *
     * @async
     * @method transaction
     * @param {Function} callback - Fonction asynchrone recevant l'instance NSql `(sql) => Promise<any>`.
     * @returns {Promise<NSqlResponse>} Résultat standardisé de la transaction.
     *
     * @example <caption>Exemple 1 : Transaction simple avec validation</caption>
     * const res = await sql.transaction(async (tx) => {
     *     await tx.insert('accounts', { id: 1, balance: 100 });
     *     await tx.insert('accounts', { id: 2, balance: 50 });
     *     return { completed: true };
     * });
     * console.log('Statut :', res.ok, 'Données :', res.data);
     *
     * @example <caption>Exemple 2 : Annulation automatique (rollback) lors d'un échec</caption>
     * const res = await sql.transaction(async (tx) => {
     *     await tx.update('accounts', { balance: 0 }, 'id = ?', [1]);
     *     throw new Error('Erreur réseau simulée');
     * });
     * console.log(res.ok); // false (les modifications sont annulées)
     */
    async transaction(callback) {
        if (typeof callback !== 'function') {
            return {
                ok: false,
                data: null,
                error: 'Callback de transaction manquant ou invalide.',
                code: 'ERR_TX_CALLBACK_INVALID'
            };
        }

        if (this.#isNativeApp()) {
            try {
                const res = await callback(this);
                return { ok: true, data: res, error: null, code: null };
            } catch (err) {
                NUtil.log.error('NSql.transaction : Erreur durant la transaction native.', {
                    code: 'ERR_TX_NATIVE_FAILED',
                    error: err,
                    stack: err?.stack
                });
                return { ok: false, data: null, error: err?.message || String(err), code: 'ERR_TX_NATIVE_FAILED' };
            }
        }

        if (!this.#ensureDbReady()) {
            return {
                ok: false,
                data: null,
                error: 'Base de données non initialisée.',
                code: 'ERR_SQL_NOT_INITIALIZED'
            };
        }

        const isNested = this.#transactionDepth > 0;
        const savepointName = `sp_${this.#transactionDepth}`;
        this.#transactionDepth++;

        try {
            if (isNested) {
                this.#db.run(`SAVEPOINT ${savepointName}`);
            } else {
                this.#db.run('BEGIN TRANSACTION');
            }

            const result = await callback(this);

            if (isNested) {
                this.#db.run(`RELEASE SAVEPOINT ${savepointName}`);
            } else {
                this.#db.run('COMMIT');
            }

            return {
                ok: true,
                data: result,
                error: null,
                code: null
            };
        } catch (err) {
            NUtil.log.error('NSql.transaction : Erreur durant la transaction, exécution du ROLLBACK.', {
                code: 'ERR_SQL_TRANSACTION_FAILED',
                error: err,
                stack: err?.stack,
                nested: isNested,
                savepoint: savepointName
            });

            try {
                if (isNested) {
                    this.#db.run(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                    this.#db.run(`RELEASE SAVEPOINT ${savepointName}`);
                } else {
                    this.#db.run('ROLLBACK');
                }
            } catch (rollbackErr) {
                NUtil.log.error('NSql.transaction : Échec critique du ROLLBACK.', {
                    code: 'ERR_SQL_ROLLBACK_FAILED',
                    error: rollbackErr,
                    stack: rollbackErr?.stack
                });
            }

            return {
                ok: false,
                data: null,
                error: err?.message || String(err),
                code: 'ERR_SQL_TRANSACTION_FAILED'
            };
        } finally {
            this.#transactionDepth = Math.max(0, this.#transactionDepth - 1);
        }
    }

    // =========================================================================
    // Schéma & Métadonnées (Fields, Primary Key, Auto Increment)
    // =========================================================================

    /**
     * Récupère la liste des noms de champs (colonnes) d'une table.
     *
     * @async
     * @method getTableFields
     * @param {string} tableName - Nom de la table.
     * @returns {Promise<string[]>} Liste des noms des colonnes.
     *
     * @example <caption>Exemple 1 : Obtenir les colonnes de la table users</caption>
     * const fields = await sql.getTableFields('users');
     * console.log('Colonnes :', fields); // ['id', 'name', 'email']
     *
     * @example <caption>Exemple 2 : Vérifier la présence d'une colonne</caption>
     * if ((await sql.getTableFields('products')).includes('barcode')) { ... }
     */
    async getTableFields(tableName) {
        if (!tableName) return [];

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('getTableFields', { tableName });
            return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        }

        const safeTable = this.#escapeIdentifier(tableName);
        const rows = await this.select(`PRAGMA table_info(\`${safeTable}\`)`);
        return rows.map((r) => r.name);
    }

    /**
     * Récupère le nom de la clé primaire d'une table (ou un tableau de clés si composite).
     *
     * @async
     * @method getPrimaryKey
     * @param {string} tableName - Nom de la table.
     * @returns {Promise<string|string[]|null>} Nom de la clé primaire ou `null`.
     *
     * @example <caption>Exemple 1 : Lire la clé primaire d'une table</caption>
     * const pk = await sql.getPrimaryKey('users');
     * console.log('Clé primaire :', pk); // 'id'
     *
     * @example <caption>Exemple 2 : Gestion de clé composite éventuelle</caption>
     * const pk = await sql.getPrimaryKey('order_items');
     */
    async getPrimaryKey(tableName) {
        if (!tableName) return null;

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('getPrimaryKey', { tableName });
            return res?.data ?? res ?? null;
        }

        const safeTable = this.#escapeIdentifier(tableName);
        const rows = await this.select(`PRAGMA table_info(\`${safeTable}\`)`);
        const pkFields = rows.filter((r) => r.pk > 0).map((r) => r.name);

        if (pkFields.length === 1) return pkFields[0];
        if (pkFields.length > 1) return pkFields;
        return null;
    }

    /**
     * Calcule la valeur d'identifiant suivante pour une table (utilise `sqlite_sequence` ou `MAX(pk) + 1`).
     *
     * @async
     * @method getNextId
     * @param {string} tableName - Nom de la table.
     * @returns {Promise<number>} Valeur d'identifiant suivante calculée.
     *
     * @example <caption>Exemple 1 : Obtenir le prochain ID d'utilisateur</caption>
     * const nextId = await sql.getNextId('users');
     * console.log('Prochain ID disponible :', nextId);
     *
     * @example <caption>Exemple 2 : Pré-remplir un formulaire avec le prochain ID</caption>
     * form.orderId = await sql.getNextId('orders');
     */
    async getNextId(tableName) {
        if (!tableName) return 1;

        if (this.#isNativeApp()) {
            const res = await this.#requestNative('getNextId', { tableName });
            return typeof res?.data === 'number' ? res.data : (typeof res === 'number' ? res : 1);
        }

        const seqRow = await this.selectOne('SELECT seq FROM sqlite_sequence WHERE name = ?', [tableName]);
        if (seqRow && typeof seqRow.seq === 'number') {
            return seqRow.seq + 1;
        }

        return this.generatePrimaryKeyValue(tableName);
    }

    /**
     * Génère une valeur d'identifiant primaire en calculant `MAX(primaryKey) + 1`.
     *
     * @async
     * @method generatePrimaryKeyValue
     * @param {string} tableName - Nom de la table.
     * @returns {Promise<number>} Identifiant calculé (1 si table vide).
     *
     * @example <caption>Exemple 1 : Générer un identifiant</caption>
     * const newKey = await sql.generatePrimaryKeyValue('products');
     *
     * @example <caption>Exemple 2 : Valeur de départ</caption>
     * console.log(await sql.generatePrimaryKeyValue('empty_table')); // 1
     */
    async generatePrimaryKeyValue(tableName) {
        const pk = await this.getPrimaryKey(tableName);
        const pkName = Array.isArray(pk) ? pk[0] : pk;

        if (pkName) {
            const safeTable = this.#escapeIdentifier(tableName);
            const safePk = this.#escapeIdentifier(pkName);
            const row = await this.selectOne(`SELECT MAX(\`${safePk}\`) AS max_val FROM \`${safeTable}\``);
            if (row && typeof row.max_val === 'number') {
                return row.max_val + 1;
            }
        }
        return 1;
    }

    /**
     * Récupère la structure complète de la base de données (liste des tables et leurs colonnes).
     *
     * @async
     * @method getDbStruct
     * @returns {Promise<Array<{ name: string, columns: Array<Object> }>>}
     *
     * @example <caption>Exemple 1 : Inspecter le schéma complet de la base</caption>
     * const struct = await sql.getDbStruct();
     * console.log(struct);
     *
     * @example <caption>Exemple 2 : Lister toutes les tables existantes</caption>
     * const tableNames = (await sql.getDbStruct()).map(t => t.name);
     */
    async getDbStruct() {
        if (!this.#ensureDbReady()) return [];

        const tables = await this.select(`
            SELECT name FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `);

        const result = [];
        for (const t of tables) {
            const tableName = t.name;
            const columns = await this.select(`PRAGMA table_info(\`${this.#escapeIdentifier(tableName)}\`)`);
            result.push({
                name: tableName,
                columns: columns.map((c) => ({
                    name: c.name,
                    type: c.type,
                    notnull: Boolean(c.notnull),
                    default: c.dflt_value,
                    pk: c.pk
                }))
            });
        }
        return result;
    }

    // =========================================================================
    // Export, Purge & Suppression
    // =========================================================================

    /**
     * Exporte la base de données SQLite sous forme binaire (`Uint8Array`).
     *
     * @async
     * @method export
     * @returns {Promise<Uint8Array|null>} Données binaires exportées ou `null`.
     *
     * @example <caption>Exemple 1 : Exporter la base SQLite en Uint8Array</caption>
     * const bytes = await sql.export();
     * console.log('Taille exportée :', bytes?.length, 'octets');
     *
     * @example <caption>Exemple 2 : Sauvegarder dans IndexedDB ou fichier</caption>
     * const uint8 = await sql.export();
     * if (uint8) { await NUtil.idb.put('backups', { date: Date.now(), data: uint8 }, 'latest'); }
     */
    async export() {
        if (this.#isNativeApp()) {
            const base64 = await this.exportBase64();
            return base64 ? this.#base64ToUint8(base64) : null;
        }

        if (!this.#ensureDbReady()) return null;

        try {
            return this.#db.export();
        } catch (err) {
            NUtil.log.error('NSql.export : Échec de l\'export binaire de la base.', {
                code: 'ERR_SQL_EXPORT_BINARY',
                error: err,
                stack: err?.stack,
                database: this.#name
            });
            return null;
        }
    }

    /**
     * Exporte la base de données sous forme de chaîne de caractères Base64.
     *
     * @async
     * @method exportBase64
     * @returns {Promise<string>} Données exportées en chaîne Base64 (vide en cas d'erreur).
     *
     * @example <caption>Exemple 1 : Obtenir la base encodée en Base64</caption>
     * const b64 = await sql.exportBase64();
     * console.log('Longueur Base64 :', b64.length);
     *
     * @example <caption>Exemple 2 : Envoi vers un serveur par API</caption>
     * await NUtil.net.post('/api/sync-db', { dbData: await sql.exportBase64() });
     */
    async exportBase64() {
        if (this.#isNativeApp()) {
            const res = await this.#requestNative('export');
            return typeof res?.data === 'string' ? res.data : (typeof res === 'string' ? res : '');
        }

        const uint8 = await this.export();
        return uint8 ? this.#uint8ToBase64(uint8) : '';
    }

    /**
     * Vide intégralement toutes les données de toutes les tables utilisateur (sans supprimer les tables).
     * Encapsulé dans une transaction pour garantir la consistance.
     *
     * @async
     * @method clear
     * @returns {Promise<boolean>} `true` si la base a été vidée, `false` sinon.
     *
     * @example <caption>Exemple 1 : Vider les données de la base</caption>
     * const ok = await sql.clear();
     * console.log('Base vidée :', ok);
     *
     * @example <caption>Exemple 2 : Réinitialisation avant ré-import</caption>
     * await sql.clear();
     */
    async clear() {
        if (this.#isNativeApp()) {
            const res = await this.#requestNative('clear');
            const ok = Boolean(res?.ok ?? res);
            if (ok) {
                this.#emitChange('clear', '*', { action: 'clear' });
            }
            return ok;
        }

        if (!this.#ensureDbReady()) return false;

        const txRes = await this.transaction(async (tx) => {
            const tables = await tx.select(`
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            `);

            for (const t of tables) {
                await tx.query(`DELETE FROM \`${this.#escapeIdentifier(t.name)}\``);
            }

            try {
                await tx.query('DELETE FROM sqlite_sequence');
            } catch {
                // Ignore si sqlite_sequence n'existe pas encore
            }
            return true;
        });

        if (txRes.ok) {
            this.#emitChange('clear', '*', { action: 'clear' });
        }

        return txRes.ok;
    }

    /**
     * Supprime toutes les tables utilisateur de la base (`DROP TABLE IF EXISTS`).
     * Encapsulé dans une transaction pour éviter un schéma partiellement corrompu.
     *
     * @async
     * @method deleteDb
     * @returns {Promise<boolean>} `true` si toutes les tables ont été supprimées.
     *
     * @example <caption>Exemple 1 : Supprimer toutes les tables de la base</caption>
     * const ok = await sql.deleteDb();
     * console.log('Base supprimée :', ok);
     *
     * @example <caption>Exemple 2 : Remise à zéro complète</caption>
     * await sql.deleteDb();
     */
    async deleteDb() {
        if (this.#isNativeApp()) {
            const res = await this.#requestNative('deleteDb');
            const ok = Boolean(res?.ok ?? res);
            if (ok) {
                this.#emitChange('deleteDb', '*', { action: 'deleteDb' });
            }
            return ok;
        }

        if (!this.#ensureDbReady()) return false;

        const txRes = await this.transaction(async (tx) => {
            const tables = await tx.select(`
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            `);

            for (const t of tables) {
                await tx.query(`DROP TABLE IF EXISTS \`${this.#escapeIdentifier(t.name)}\``);
            }
            return true;
        });

        if (txRes.ok) {
            this.#emitChange('deleteDb', '*', { action: 'deleteDb' });
        }

        return txRes.ok;
    }

    // =========================================================================
    // Méthodes Privées Internes
    // =========================================================================

    /**
     * Émet les événements de changement sur le gestionnaire d'événements s'il est initialisé et actif.
     * Déclenche à la fois :
     * 1. L'événement général `'change'`
     * 2. L'événement d'action spécifique `type` ('insert', 'update', 'delete', 'createTable', etc.)
     * 3. L'événement ciblé par table `${type}:${table}` (ex: 'insert:users')
     * 4. Le canal complet de la table `${table}:change` (ex: 'users:change')
     *
     * @private
     * @param {string} type - Type d'action ('insert', 'update', 'delete', 'createTable', 'dropTable', 'clear', etc.).
     * @param {string} [table=''] - Nom de la table impactée.
     * @param {Object} [details={}] - Métadonnées associées au changement.
     */
    #emitChange(type, table = '', details = {}) {
        if (!this.#event || this.#event.isEmpty) {
            return;
        }

        const eventPayload = {
            type,
            table,
            database: this.#name,
            timestamp: Date.now(),
            ...details
        };

        this.#event.emit('change', eventPayload);
        this.#event.emit(type, eventPayload);

        if (table && table !== '*') {
            this.#event.emit(`${type}:${table}`, eventPayload);
            this.#event.emit(`${table}:change`, eventPayload);
        }
    }

    /**
     * Inspecte une requête SQL textuelle pour détecter son type d'action d'écriture et la table ciblée.
     *
     * @private
     * @param {string} sql - Requête SQL brute.
     * @returns {{ type: string, table: string }|null} Description de l'action ou `null` si requête en lecture seule.
     */
    #inspectSqlAction(sql) {
        if (!sql || typeof sql !== 'string') return null;
        const trimmed = sql.trim();

        // INSERT [OR REPLACE|IGNORE...] INTO `table`
        const insertMatch = trimmed.match(/^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i);
        if (insertMatch) {
            return { type: 'insert', table: insertMatch[1] };
        }

        // UPDATE [OR ...] `table`
        const updateMatch = trimmed.match(/^UPDATE\s+(?:OR\s+\w+\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i);
        if (updateMatch) {
            return { type: 'update', table: updateMatch[1] };
        }

        // DELETE FROM `table`
        const deleteMatch = trimmed.match(/^DELETE\s+FROM\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i);
        if (deleteMatch) {
            return { type: 'delete', table: deleteMatch[1] };
        }

        // CREATE TABLE [IF NOT EXISTS] `table`
        const createMatch = trimmed.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i);
        if (createMatch) {
            return { type: 'createTable', table: createMatch[1] };
        }

        // DROP TABLE [IF EXISTS] `table`
        const dropMatch = trimmed.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"']?([a-zA-Z0-9_]+)[`"']?/i);
        if (dropMatch) {
            return { type: 'dropTable', table: dropMatch[1] };
        }

        // ALTER TABLE `table`
        const alterMatch = trimmed.match(/^ALTER\s+TABLE\s+[`"']?([a-zA-Z0-9_]+)[`"']?/i);
        if (alterMatch) {
            return { type: 'alterTable', table: alterMatch[1] };
        }

        return null;
    }

    /**
     * Vérifie si le contexte actif est une application native (WebView / conteneur).
     * @private
     * @returns {boolean}
     */
    #isNativeApp() {
        return Boolean(NUtil?.env?.isWebView);
    }

    /**
     * Relaye une action SQLite vers le conteneur applicatif natif via `NUtil.sys.invokeNative`.
     * @private
     * @param {string} actionType - Type d'action demandée.
     * @param {Object} [extraParams={}] - Paramètres transmis.
     * @returns {Promise<any>}
     */
    async #requestNative(actionType, extraParams = {}) {
        return await NUtil.sys.invokeNative({
            type: ['app', 'sql', actionType],
            params: extraParams
        });
    }

    /**
     * Charge le module `sql.js` (WebAssembly) une seule fois et le met en cache statique.
     * En cas d'échec, réinitialise la promesse de chargement afin de permettre une nouvelle tentative propre.
     *
     * @private
     * @param {string|Function} [wasmPath] - Chemin ou fonction locateFile.
     * @returns {Promise<any|null>} Instance du module sql.js ou `null`.
     */
    async #ensureSqlJsModule(wasmPath) {
        if (NSql.#sqlJsModule) {
            return NSql.#sqlJsModule;
        }

        if (NSql.#moduleLoadingPromise) {
            return NSql.#moduleLoadingPromise;
        }

        NSql.#moduleLoadingPromise = (async () => {
            try {
                const initSqlJsFn = this.#resolveInitSqlJs();
                if (typeof initSqlJsFn !== 'function') {
                    NUtil.log.error('NSql : Le module sql.js (initSqlJs) est introuvable.', {
                        code: 'ERR_SQL_JS_NOT_FOUND',
                        database: this.#name
                    });
                    return null;
                }

                const locateFile = typeof wasmPath === 'function'
                    ? wasmPath
                    : (filename) => {
                        if (typeof wasmPath === 'string' && wasmPath.trim()) {
                            return wasmPath.endsWith('.wasm')
                                ? wasmPath
                                : `${wasmPath.replace(/\/+$/, '')}/${filename}`;
                        }
                        if (typeof location !== 'undefined' && location.origin) {
                            return `${location.origin}/file/sqljs/${filename}`;
                        }
                        return filename;
                    };

                const loaded = await initSqlJsFn({ locateFile });
                NSql.#sqlJsModule = loaded;
                return loaded;
            } catch (err) {
                NUtil.log.error('NSql : Échec du chargement du binaire WebAssembly sql.js.', {
                    code: 'ERR_SQL_JS_LOAD_FAILED',
                    error: err,
                    stack: err?.stack,
                    database: this.#name
                });
                return null;
            } finally {
                NSql.#moduleLoadingPromise = null;
            }
        })();

        return NSql.#moduleLoadingPromise;
    }

    /**
     * Trouve la fonction `initSqlJs` globale ou disponible dans l'environnement.
     * @private
     * @returns {Function|null}
     */
    #resolveInitSqlJs() {
        if (typeof globalThis !== 'undefined' && typeof globalThis.initSqlJs === 'function') {
            return globalThis.initSqlJs;
        }
        if (typeof window !== 'undefined' && typeof window.initSqlJs === 'function') {
            return window.initSqlJs;
        }
        if (typeof self !== 'undefined' && typeof self.initSqlJs === 'function') {
            return self.initSqlJs;
        }
        return null;
    }

    /**
     * S'assure que la base de données est ouverte et prête.
     * @private
     * @returns {boolean}
     */
    #ensureDbReady() {
        if (!this.#db) {
            NUtil.log.warn('NSql : La base de données n\'est pas initialisée. Appelez d\'abord await sql.init().', {
                code: 'WARN_SQL_NOT_INITIALIZED',
                database: this.#name
            });
            return false;
        }
        return true;
    }

    /**
     * Normalise les paramètres SQL de manière contextuelle et sécurisée.
     * Remplace les paramètres nommés `:paramName` par `?` en ignorant les occurrences situées
     * à l'intérieur de chaînes littérales, de commentaires ou d'identifiants délimités.
     *
     * @private
     * @param {string} sql - Requête SQL source.
     * @param {Array|Object} params - Paramètres positionnels ou nommés.
     * @returns {{ cleanSql: string, cleanParams: Array<any> }}
     */
    #normalizeParams(sql, params) {
        if (!sql || typeof sql !== 'string') {
            return { cleanSql: '', cleanParams: [] };
        }

        if (!params || (Array.isArray(params) && params.length === 0)) {
            return { cleanSql: sql, cleanParams: [] };
        }

        if (Array.isArray(params)) {
            return {
                cleanSql: sql,
                cleanParams: params.map((p) => this.#formatParamValue(p))
            };
        }

        if (typeof params === 'object') {
            const cleanParams = [];
            const len = sql.length;
            let resultSql = '';
            let i = 0;

            while (i < len) {
                const char = sql[i];

                // 1. Chaîne entre apostrophes simples '...' (avec support des échappements '')
                if (char === "'") {
                    resultSql += char;
                    i++;
                    while (i < len) {
                        const c = sql[i];
                        resultSql += c;
                        if (c === "'") {
                            if (i + 1 < len && sql[i + 1] === "'") {
                                i++;
                                resultSql += sql[i];
                            } else {
                                i++;
                                break;
                            }
                        }
                        i++;
                    }
                    continue;
                }

                // 2. Chaîne entre guillemets doubles "..."
                if (char === '"') {
                    resultSql += char;
                    i++;
                    while (i < len) {
                        const c = sql[i];
                        resultSql += c;
                        if (c === '"') {
                            if (i + 1 < len && sql[i + 1] === '"') {
                                i++;
                                resultSql += sql[i];
                            } else {
                                i++;
                                break;
                            }
                        }
                        i++;
                    }
                    continue;
                }

                // 3. Identifiant entre backticks `...`
                if (char === '`') {
                    resultSql += char;
                    i++;
                    while (i < len) {
                        const c = sql[i];
                        resultSql += c;
                        if (c === '`') {
                            i++;
                            break;
                        }
                        i++;
                    }
                    continue;
                }

                // 4. Commentaire mono-ligne -- ...
                if (char === '-' && i + 1 < len && sql[i + 1] === '-') {
                    while (i < len && sql[i] !== '\n') {
                        resultSql += sql[i];
                        i++;
                    }
                    continue;
                }

                // 5. Commentaire multi-lignes /* ... */
                if (char === '/' && i + 1 < len && sql[i + 1] === '*') {
                    resultSql += '/*';
                    i += 2;
                    while (i < len) {
                        if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
                            resultSql += '*/';
                            i += 2;
                            break;
                        }
                        resultSql += sql[i];
                        i++;
                    }
                    continue;
                }

                // 6. Paramètre nommé :paramName (doit commencer par ':' suivi d'une lettre ou _)
                if (char === ':' && i + 1 < len && /[a-zA-Z_]/.test(sql[i + 1])) {
                    let key = '';
                    i++; // saute le ':'
                    while (i < len && /[a-zA-Z0-9_]/.test(sql[i])) {
                        key += sql[i];
                        i++;
                    }

                    if (key in params) {
                        cleanParams.push(this.#formatParamValue(params[key]));
                    } else {
                        NUtil.log.warn(`NSql : Paramètre nommé manquant "${key}". Liaison avec null.`, {
                            code: 'WARN_SQL_MISSING_PARAM',
                            key,
                            sql
                        });
                        cleanParams.push(null);
                    }
                    resultSql += '?';
                    continue;
                }

                // Caractère standard
                resultSql += char;
                i++;
            }

            return { cleanSql: resultSql, cleanParams };
        }

        return {
            cleanSql: sql,
            cleanParams: [this.#formatParamValue(params)]
        };
    }

    /**
     * Formate une valeur JavaScript pour un paramètre SQLite compatible (gère dates, booléens, objets).
     * @private
     * @param {any} val - Valeur brute.
     * @returns {any} Valeur normalisée (null, number, string, Uint8Array).
     */
    #formatParamValue(val) {
        if (val === undefined || val === null) {
            return null;
        }
        if (typeof val === 'boolean') {
            return val ? 1 : 0;
        }
        if (val instanceof Date) {
            return val.toISOString();
        }
        if (typeof val === 'bigint') {
            return Number(val);
        }
        if (val instanceof Uint8Array) {
            return val;
        }
        if (typeof val === 'object') {
            try {
                return JSON.stringify(val);
            } catch {
                return String(val);
            }
        }
        return val;
    }

    /**
     * Échappe un identifiant SQL (nom de table ou colonne) pour éviter les injections.
     * @private
     * @param {string} name - Nom d'identifiant à échapper.
     * @returns {string} Identifiant protégé.
     */
    #escapeIdentifier(name) {
        return String(name).replace(/`/g, '``');
    }

    /**
     * Convertit un `Uint8Array` en chaîne Base64 de façon performante et multiplateforme.
     * @private
     * @param {Uint8Array} uint8 - Buffer binaire.
     * @returns {string} Chaîne Base64.
     */
    #uint8ToBase64(uint8) {
        if (!(uint8 instanceof Uint8Array)) return '';

        // Environnement Node.js ou Buffer disponible
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            return Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength).toString('base64');
        }

        // Navigateur / Web Worker avec btoa par paquets de 8Ko pour éviter RangeError
        if (typeof btoa === 'function') {
            let binary = '';
            const len = uint8.length;
            const chunkSize = 8192;
            for (let i = 0; i < len; i += chunkSize) {
                const sub = uint8.subarray(i, Math.min(i + chunkSize, len));
                binary += String.fromCharCode.apply(null, sub);
            }
            return btoa(binary);
        }

        return '';
    }

    /**
     * Convertit une chaîne Base64 en `Uint8Array` de façon résiliente.
     * @private
     * @param {string} base64 - Données Base64.
     * @returns {Uint8Array} Buffer binaire.
     */
    #base64ToUint8(base64) {
        if (!base64 || typeof base64 !== 'string') return new Uint8Array(0);

        // Environnement Node.js ou Buffer disponible
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            const buf = Buffer.from(base64.trim(), 'base64');
            return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        }

        // Navigateur / Web Worker avec atob
        if (typeof atob === 'function') {
            const binary = atob(base64.trim());
            const len = binary.length;
            const uint8 = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                uint8[i] = binary.charCodeAt(i);
            }
            return uint8;
        }

        return new Uint8Array(0);
    }
}

export default NSql;
