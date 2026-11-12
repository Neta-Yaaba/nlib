/**
 * @file NSql.js
 * @package @nlib/js-backend
 * @description Moteur de base de données SQL universel pour NLib.
 * Gère une base SQLite locale en mémoire ou persistante via `sql.js` (WebAssembly)
 * ou délègue automatiquement les requêtes au pont natif de l'application (`NUtil.env.isWebView` / `requestApp`)
 * lorsqu'exécuté dans un conteneur natif ou WebView.
 *
 * Prend en charge :
 * - Paramètres nommés (`:key`) et positionnels (`?`)
 * - Requêtes préparées sécurisées
 * - Méthodes de sélection riches : `select()`, `selectOne()`, `selectAll()`, `selectAsList()`, `countRows()`
 * - Helpers CRUD dynamiques : `insert()`, `update()`, `delete()`
 * - Schéma et métadonnées : `getTableFields()`, `getPrimaryKey()`, `getNextId()`, `generatePrimaryKeyValue()`, `getDbStruct()`
 * - Initialisation déclarative par structure (`dbStructure`), données binaires (`Uint8Array`) ou Base64 (`dbBase64Data`)
 * - Export complet de la base en Uint8Array ou Base64, vidage (`clear()`) et suppression (`deleteDb()`).
 *
 * Conforme aux standards NLib : classe autonome sans variable globale hors classe,
 * avec retours standardisés `{ ok, data, error, code }` ou valeurs typées, et documentation JSDoc exhaustive.
 */

import { NException } from '../core/NException.js';
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
 * @description Gestionnaire universel de base de données SQLite (sql.js / natif).
 *
 * @example <caption>Exemple 1 : Initialiser une base SQLite avec une structure déclarative</caption>
 * const sql = new NSql();
 * await sql.init({
 *     dbStructure: {
 *         users: "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT);"
 *     }
 * });
 * const insertRes = await sql.insert('users', { name: 'Alice', email: 'alice@test.com' });
 * console.log('Nouvel ID inséré :', insertRes.data);
 *
 * @example <caption>Exemple 2 : Requêtes paramétrées sécurisées (nommées ou positionnelles)</caption>
 * const user = await sql.selectOne('SELECT * FROM users WHERE id = :id', { id: 1 });
 * console.log('Utilisateur trouvé :', user?.name);
 *
 * @example <caption>Exemple 3 : Export de la base binaire et vidage</caption>
 * const base64Data = await sql.exportBase64();
 * console.log('Base exportée (base64) :', base64Data.length);
 * await sql.clear(); // Vide toutes les tables
 */
export class NSql {

    // =========================================================================
    // Propriétés statiques privées
    // =========================================================================

    /**
     * Instance mise en cache du module WASM sql.js.
     * @type {any}
     * @private
     */
    static #sqlJsModule = null;

    /**
     * Promesse de chargement de sql.js en cours pour éviter les appels concurrents.
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
     * Indique si l'instance a été initialisée.
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
     * @example <caption>Exemple 2 : Utilisation dans un message de log</caption>
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

    // =========================================================================
    // Initialisation & Cycle de Vie
    // =========================================================================

    /**
     * Initialise la base de données SQL.
     * Détecte si l'exécution se fait dans une application hôte native (WebView / App)
     * ou initialise le moteur SQLite WebAssembly `sql.js`.
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
        const opts = options && typeof options === 'object' ? options : {};

        // 1. Détection environnement Application / WebView native
        if (this.#isNativeApp()) {
            try {
                const res = await this.#requestNative('init', opts);
                this.#isInitialized = res?.ok ?? Boolean(res);
                return this.#isInitialized;
            } catch (err) {
                console.warn('NSql : échec initialisation SQLite native.', err);
                return false;
            }
        }

        // 2. Initialisation WebAssembly sql.js
        try {
            const SQL = await this.#ensureSqlJsModule(opts.wasmPath || this.#wasmPath);

            let initialBinaryData = null;
            if (opts.dbUint8ArrayData instanceof Uint8Array) {
                initialBinaryData = opts.dbUint8ArrayData;
            } else if (typeof opts.dbBase64Data === 'string' && opts.dbBase64Data.trim()) {
                initialBinaryData = this.#base64ToUint8(opts.dbBase64Data);
            }

            if (initialBinaryData) {
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
            console.warn('NSql : échec initialisation sql.js.', err);
            this.#isInitialized = false;
            return false;
        }
    }

    /**
     * Ferme la connexion à la base de données et libère les ressources WebAssembly.
     *
     * @method close
     * @returns {boolean}
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
            } catch {
                // Ignore
            }
            this.#db = null;
        }
        this.#isInitialized = false;
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
            return Boolean(res?.ok ?? res);
        }

        if (!this.#ensureDbReady()) return false;

        try {
            this.#db.run(sqlCreateTable);
            return true;
        } catch (err) {
            console.warn(`NSql.createTable : échec création de la table "${tableName}".`, err);
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
     *
     * @async
     * @method query
     * @param {string} sql - Requête SQL à exécuter.
     * @param {Array|Object} [params=[]] - Paramètres nommés (`{ key: val }`) ou positionnels (`[val1, val2]`).
     * @returns {Promise<boolean>}
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
            return Boolean(res?.ok ?? res);
        }

        if (!this.#ensureDbReady()) return false;

        try {
            const { cleanSql, cleanParams } = this.#normalizeParams(sql, params);
            const stmt = this.#db.prepare(cleanSql);
            stmt.bind(cleanParams);
            stmt.step();
            stmt.free();
            return true;
        } catch (err) {
            console.warn('NSql.query : échec exécution requête.', err);
            return false;
        }
    }

    /**
     * Exécute une requête `SELECT` et retourne l'ensemble des lignes correspondantes
     * sous la forme d'un tableau d'objets `[ { col: val }, ... ]`.
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

        try {
            const { cleanSql, cleanParams } = this.#normalizeParams(sql, params);
            const stmt = this.#db.prepare(cleanSql);
            stmt.bind(cleanParams);

            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        } catch (err) {
            console.warn('NSql.select : échec de sélection.', err);
            return [];
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
     * @returns {Promise<Object|null>}
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
     * @returns {Promise<Array<Object>>}
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
     * @returns {Promise<number>}
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
            return res?.data ?? res ?? false;
        }

        if (!this.#ensureDbReady()) return false;

        try {
            const fields = Object.keys(data);
            const values = Object.values(data);
            const placeholders = fields.map(() => '?').join(', ');
            const escapedFields = fields.map((f) => `\`${this.#escapeIdentifier(f)}\``).join(', ');
            const safeTable = this.#escapeIdentifier(tableName);

            const sql = `INSERT INTO \`${safeTable}\` (${escapedFields}) VALUES (${placeholders})`;
            const stmt = this.#db.prepare(sql);
            stmt.bind(values);
            stmt.step();
            stmt.free();

            // Récupération de l'identifiant généré
            const lastIdRes = this.#db.exec('SELECT last_insert_rowid() AS lastId');
            if (lastIdRes && lastIdRes.length > 0 && lastIdRes[0].values?.length > 0) {
                return lastIdRes[0].values[0][0];
            }
            return true;
        } catch (err) {
            console.warn(`NSql.insert : échec d'insertion dans "${tableName}".`, err);
            return false;
        }
    }

    /**
     * Met à jour des enregistrements dans une table selon une condition.
     * Retourne le nombre de lignes modifiées.
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
            return typeof res?.data === 'number' ? res.data : (typeof res === 'number' ? res : 0);
        }

        if (!this.#ensureDbReady()) return 0;

        try {
            const fields = Object.keys(data);
            const values = Object.values(data);
            const setClause = fields.map((f) => `\`${this.#escapeIdentifier(f)}\` = ?`).join(', ');
            const safeTable = this.#escapeIdentifier(tableName);

            const { cleanSql: cleanCond, cleanParams: condParams } = this.#normalizeParams(condition, params);
            const fullSql = `UPDATE \`${safeTable}\` SET ${setClause} WHERE ${cleanCond}`;

            const stmt = this.#db.prepare(fullSql);
            stmt.bind([...values, ...condParams]);
            stmt.step();
            stmt.free();

            return this.#db.getRowsModified();
        } catch (err) {
            console.warn(`NSql.update : échec de mise à jour de "${tableName}".`, err);
            return 0;
        }
    }

    /**
     * Supprime des enregistrements dans une table selon une condition.
     * Retourne le nombre de lignes supprimées.
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
            return typeof res?.data === 'number' ? res.data : (typeof res === 'number' ? res : 0);
        }

        if (!this.#ensureDbReady()) return 0;

        try {
            const safeTable = this.#escapeIdentifier(tableName);
            const { cleanSql: cleanCond, cleanParams: condParams } = this.#normalizeParams(condition, params);
            const fullSql = `DELETE FROM \`${safeTable}\` WHERE ${cleanCond}`;

            const stmt = this.#db.prepare(fullSql);
            stmt.bind(condParams);
            stmt.step();
            stmt.free();

            return this.#db.getRowsModified();
        } catch (err) {
            console.warn(`NSql.delete : échec de suppression dans "${tableName}".`, err);
            return 0;
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
     * @returns {Promise<string[]>}
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
     * @returns {Promise<number>}
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
     * @returns {Promise<number>}
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
     * @returns {Promise<Uint8Array|null>}
     *
     * @example <caption>Exemple 1 : Exporter la base SQLite en Uint8Array</caption>
     * const bytes = await sql.export();
     * console.log('Taille exportée :', bytes.length, 'octets');
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
            console.warn('NSql.export : échec d\'export binaire.', err);
            return null;
        }
    }

    /**
     * Exporte la base de données sous forme de chaîne de caractères Base64.
     *
     * @async
     * @method exportBase64
     * @returns {Promise<string>}
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
     *
     * @async
     * @method clear
     * @returns {Promise<boolean>}
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
            return Boolean(res?.ok ?? res);
        }

        if (!this.#ensureDbReady()) return false;

        try {
            const tables = await this.select(`
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            `);

            for (const t of tables) {
                this.#db.run(`DELETE FROM \`${this.#escapeIdentifier(t.name)}\``);
            }

            try {
                this.#db.run('DELETE FROM sqlite_sequence');
            } catch {
                // Ignore si la table sqlite_sequence n'existe pas encore
            }

            return true;
        } catch (err) {
            console.warn('NSql.clear : échec du vidage de la base.', err);
            return false;
        }
    }

    /**
     * Supprime toutes les tables utilisateur de la base (`DROP TABLE IF EXISTS`).
     *
     * @async
     * @method deleteDb
     * @returns {Promise<boolean>}
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
            return Boolean(res?.ok ?? res);
        }

        if (!this.#ensureDbReady()) return false;

        try {
            const tables = await this.select(`
                SELECT name FROM sqlite_master
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            `);

            for (const t of tables) {
                this.#db.run(`DROP TABLE IF EXISTS \`${this.#escapeIdentifier(t.name)}\``);
            }

            return true;
        } catch (err) {
            console.warn('NSql.deleteDb : échec de suppression des tables.', err);
            return false;
        }
    }

    // =========================================================================
    // Méthodes Privées Internes
    // =========================================================================

    /**
     * Vérifie si le contexte actif est une application native (WebView / conteneur).
     * @private
     */
    #isNativeApp() {
        return Boolean(NUtil?.env?.isWebView);
    }

    /**
     * Relaye une action SQLite vers le conteneur applicatif natif via `requestApp`.
     * @private
     */
    async #requestNative(actionType, extraParams = {}) {
        return await NUtil.env.requestApp({
            typeg: ['app', 'sql'],
            type: actionType,
            params: extraParams
        });
    }

    /**
     * Charge le module `sql.js` (WebAssembly) une seule fois et le met en cache statique.
     * @private
     */
    async #ensureSqlJsModule(wasmPath) {
        if (NSql.#sqlJsModule) {
            return NSql.#sqlJsModule;
        }

        if (NSql.#moduleLoadingPromise) {
            return NSql.#moduleLoadingPromise;
        }

        NSql.#moduleLoadingPromise = (async () => {
            const initSqlJsFn = this.#resolveInitSqlJs();
            if (typeof initSqlJsFn !== 'function') {
                throw new NException('NSql : le module sql.js (initSqlJs) est introuvable.', {
                    code: 'SQL_JS_NOT_FOUND'
                });
            }

            const locateFile = typeof wasmPath === 'function'
                ? wasmPath
                : (filename) => {
                    if (typeof wasmPath === 'string' && wasmPath.trim()) {
                        return wasmPath.endsWith('.wasm') ? wasmPath : `${wasmPath.replace(/\/+$/, '')}/${filename}`;
                    }
                    if (typeof location !== 'undefined' && location.origin) {
                        return `${location.origin}/file/sqljs/${filename}`;
                    }
                    return filename;
                };

            const loaded = await initSqlJsFn({ locateFile });
            NSql.#sqlJsModule = loaded;
            NSql.#moduleLoadingPromise = null;
            return loaded;
        })();

        return NSql.#moduleLoadingPromise;
    }

    /**
     * Trouve la fonction `initSqlJs` globale ou importée.
     * @private
     */
    #resolveInitSqlJs() {
        if (typeof globalThis !== 'undefined' && typeof globalThis.initSqlJs === 'function') {
            return globalThis.initSqlJs;
        }
        if (typeof window !== 'undefined' && typeof window.initSqlJs === 'function') {
            return window.initSqlJs;
        }
        return null;
    }

    /**
     * S'assure que la base de données est ouverte et prête.
     * @private
     */
    #ensureDbReady() {
        if (!this.#db) {
            console.warn('NSql : la base de données n\'est pas initialisée. Appelez d\'abord await sql.init().');
            return false;
        }
        return true;
    }

    /**
     * Normalise les paramètres (transforme `:key` en `?` si un objet est fourni).
     * @private
     */
    #normalizeParams(sql, params) {
        if (!params || (Array.isArray(params) && params.length === 0)) {
            return { cleanSql: sql, cleanParams: [] };
        }

        if (Array.isArray(params)) {
            return { cleanSql: sql, cleanParams: params };
        }

        if (typeof params === 'object') {
            const cleanParams = [];
            const cleanSql = sql.replace(/:(\w+)/g, (match, key) => {
                if (!(key in params)) {
                    throw new NException(`NSql : paramètre nommé manquant "${key}".`, {
                        code: 'MISSING_SQL_PARAM',
                        context: { key, sql, params }
                    });
                }
                cleanParams.push(params[key]);
                return '?';
            });

            return { cleanSql, cleanParams };
        }

        return { cleanSql: sql, cleanParams: [params] };
    }

    /**
     * Échappe un identifiant SQL (nom de table ou colonne) pour éviter les injections.
     * @private
     */
    #escapeIdentifier(name) {
        return String(name).replace(/`/g, '``');
    }

    /**
     * Convertit un `Uint8Array` en chaîne Base64.
     * @private
     */
    #uint8ToBase64(uint8) {
        if (!(uint8 instanceof Uint8Array)) return '';
        let binary = '';
        const len = uint8.length;
        const chunkSize = 8192; // Découpage par morceaux pour éviter RangeError sur String.fromCharCode
        for (let i = 0; i < len; i += chunkSize) {
            const sub = uint8.subarray(i, Math.min(i + chunkSize, len));
            binary += String.fromCharCode.apply(null, sub);
        }
        return btoa(binary);
    }

    /**
     * Convertit une chaîne Base64 en `Uint8Array`.
     * @private
     */
    #base64ToUint8(base64) {
        if (!base64 || typeof base64 !== 'string') return new Uint8Array(0);
        const binary = atob(base64.trim());
        const len = binary.length;
        const uint8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            uint8[i] = binary.charCodeAt(i);
        }
        return uint8;
    }
}

export default NSql;

