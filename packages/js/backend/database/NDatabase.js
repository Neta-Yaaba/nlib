/**
 * @file NDatabase.js
 * @package @nlib/js-backend
 * @description Gestionnaire central de persistance et coordinateur de base de données de l'écosystème NLib.
 *
 * Rôle architectural et principes fondamentaux :
 * - `NDatabase` est principalement axé sur l'utilisation du SQL (`NSql`) pour les opérations transactionnelles relationnelles.
 * - `indexed` (`NIndexedDB`) et `store` (`NStorage`) fournissent l'infrastructure par défaut et l'isolation par contexte.
 * - `indexed` permet notamment de persister la base SQLite (export/import binaire) dans les environnements non natifs
 *   (Web / WebAssembly via sql.js) afin de garantir la persistance des données entre sessions de navigation.
 * - `store` est automatiquement initialisé et cloisonné pour le contexte applicatif actif (ex: 'app', 'admin', 'site').
 * - L'initialisation est centrée sur `sqlOptions`. Si aucune option n'est fournie, `NDatabase` résout automatiquement
 *   le contexte via `NUtil.config`, permettant d'exploiter immédiatement `indexed` et `store` même pour les applications
 *   qui n'ont pas besoin de base SQL.
 *
 * Principes de fiabilité et robustesse :
 * - Zero Throw / Zero Reject : aucune exception bloquante non capturée, retours prévisibles et journalisation via `NUtil.log`.
 * - Initialisation concurrente sécurisée : verrou anti-courses critiques via promesse partagée `#initPromise`.
 * - Isolation multiplateforme : fonctionne indifféremment sur Navigateur Web (WASM), Web Worker, applications hybrides/natives et Node.js.
 */

import { NIndexedDB } from './NIndexedDB.js';
import { NSql } from './NSql.js';
import { NStorage } from './NStorage.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * Résultat de l'initialisation coordonnée de NDatabase.
 * @typedef {Object} NDatabaseInitResult
 * @property {boolean} ok - Indique si les moteurs configurés ont été initialisés avec succès.
 * @property {boolean} sql - Statut de réussite ou d'activation du moteur SQL.
 * @property {boolean} indexed - Statut de disponibilité du moteur IndexedDB.
 * @property {boolean} storage - Statut de disponibilité du magasin clé-valeur.
 * @property {string} [context] - Contexte applicatif résolu.
 * @property {Object<string, string>} [errors] - Dictionnaire des erreurs éventuelles par moteur.
 */

/**
 * @class NDatabase
 * @description Point d'entrée central de gestion des bases de données NLib, articulé autour de SQL (`NSql`),
 * avec persistance WebAssembly via IndexedDB (`NIndexedDB`) et magasin contextuel (`NStorage`).
 *
 * @example <caption>Exemple 1 : Utilisation SQL principale avec persistance automatique</caption>
 * const db = new NDatabase({
 *     name: 'pos_db',
 *     dbStructure: {
 *         products: 'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, title TEXT, price REAL);'
 *     }
 * });
 * await db.init();
 * await db.sql.insert('products', { title: 'Baguette', price: 150 });
 * const items = await db.sql.select('SELECT * FROM products');
 * console.log('Produits :', items);
 *
 * @example <caption>Exemple 2 : Application sans SQL utilisant le contexte par défaut via NUtil.config</caption>
 * NUtil.config.set('app.context', 'admin');
 * const db = new NDatabase(); // Contexte 'admin' résolu automatiquement
 * db.store.set('theme', 'dark'); // Isolé dans le contexte 'admin'
 * await db.idb.put('ntable', { id: 'cfg_1', active: true });
 *
 * @example <caption>Exemple 3 : Sauvegarde manuelle et restauration de la base SQL dans IndexedDB</caption>
 * const db = new NDatabase({ name: 'webapp_data' });
 * await db.init();
 * await db.sql.execute('CREATE TABLE IF NOT EXISTS logs (msg TEXT);');
 * await db.sql.insert('logs', { msg: 'Session démarrée' });
 * await db.saveSql(); // Persiste l'état binaire SQLite dans IndexedDB
 */
export class NDatabase {

    // =========================================================================
    // Propriétés d'instance privées
    // =========================================================================

    /**
     * Nom logique principal de la base de données.
     * @type {string}
     * @private
     */
    #name = 'nlib_db';

    /**
     * Contexte applicatif résolu (ex: 'app', 'admin', 'site', 'default').
     * @type {string}
     * @private
     */
    #context = 'default';

    /**
     * Version globale du schéma IndexedDB.
     * @type {number}
     * @private
     */
    #version = 1;

    /**
     * Options de configuration spécifiques à NSql (ou `false` si SQL est désactivé).
     * @type {Object|boolean|null}
     * @private
     */
    #sqlOptions = null;

    /**
     * Instance de NIndexedDB (allouée paresseusement au premier accès).
     * @type {NIndexedDB|null}
     * @private
     */
    #indexedInstance = null;

    /**
     * Instance de NSql (allouée paresseusement au premier accès).
     * @type {NSql|null}
     * @private
     */
    #sqlInstance = null;

    /**
     * Instance de NStorage (allouée paresseusement au premier accès).
     * @type {NStorage|null}
     * @private
     */
    #storageInstance = null;

    /**
     * Indique si l'initialisation a été exécutée avec succès.
     * @type {boolean}
     * @private
     */
    #isInitialized = false;

    /**
     * Verrou de promesse d'initialisation en cours pour neutraliser les appels concurrents à `init()`.
     * @type {Promise<NDatabaseInitResult>|null}
     * @private
     */
    #initPromise = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NDatabase`.
     *
     * @constructor
     * @param {Object|boolean} [sqlOptions={}] - Options de configuration de NSql ou `false` pour désactiver le SQL.
     * @param {string} [sqlOptions.context] - Contexte applicatif (si omis, résolu automatiquement via `NUtil.config`).
     * @param {string} [sqlOptions.name] - Nom de la base de données (si omis, prend la valeur du contexte).
     * @param {number} [sqlOptions.version=1] - Version du schéma IndexedDB.
     * @param {Object<string, string>} [sqlOptions.dbStructure] - Définition DDL des tables SQL.
     * @param {string} [sqlOptions.wasmPath] - Chemin d'accès au binaire SQL.js WebAssembly.
     * @param {Uint8Array|ArrayBuffer|string} [sqlOptions.dbData] - Données binaires initiales SQLite.
     *
     * @example <caption>Exemple 1 : Instanciation standard avec options SQL</caption>
     * const db = new NDatabase({
     *     name: 'gestpos',
     *     dbStructure: { orders: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, total REAL);' }
     * });
     *
     * @example <caption>Exemple 2 : Instanciation sans options avec résolution automatique du contexte</caption>
     * const db = new NDatabase();
     * console.log(db.context); // Résolu depuis NUtil.config
     */
    constructor(sqlOptions = {}) {
        const opts = sqlOptions && typeof sqlOptions === 'object' ? sqlOptions : {};

        this.#context = this.#resolveContext(opts.context);

        if (typeof opts.name === 'string' && opts.name.trim()) {
            this.#name = opts.name.trim();
        } else {
            this.#name = this.#context;
        }

        if (typeof opts.version === 'number' && Number.isFinite(opts.version) && opts.version >= 1) {
            this.#version = Math.floor(opts.version);
        }

        if (sqlOptions === false) {
            this.#sqlOptions = false;
        } else {
            this.#sqlOptions = { ...opts };
        }
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    /**
     * Retourne le contexte applicatif actif de la base (ex: 'app', 'admin', 'site', 'default').
     * @type {string}
     *
     * @example <caption>Exemple 1 : Consulter le contexte courant</caption>
     * console.log(db.context); // 'app'
     *
     * @example <caption>Exemple 2 : Conditionnement applicatif</caption>
     * if (db.context === 'admin') { console.log('Base d administration'); }
     */
    get context() {
        return this.#context;
    }

    /**
     * Retourne le nom logique principal de la base de données.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Consulter le nom de la base</caption>
     * console.log(db.name); // 'pos_db'
     *
     * @example <caption>Exemple 2 : Affichage d'état</caption>
     * console.log(`Espace de données : ${db.name}`);
     */
    get name() {
        return this.#name;
    }

    /**
     * Retourne la version globale du schéma.
     * @type {number}
     *
     * @example <caption>Exemple 1 : Consulter la version</caption>
     * console.log(db.version); // 1
     *
     * @example <caption>Exemple 2 : Vérification conditionnelle</caption>
     * if (db.version > 1) { console.log('Version mise à niveau'); }
     */
    get version() {
        return this.#version;
    }

    /**
     * Indique si l'initialisation de la base a été exécutée avec succès.
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier l'état de l'initialisation</caption>
     * if (!db.isInitialized) { await db.init(); }
     *
     * @example <caption>Exemple 2 : Contrôle d'état</caption>
     * console.log('Base prête :', db.isInitialized);
     */
    get isInitialized() {
        return this.#isInitialized;
    }

    /**
     * Accès direct à la classe utilitaire transversale `NUtil`.
     * @type {typeof NUtil}
     *
     * @example <caption>Exemple 1 : Journaliser via db.util.log</caption>
     * db.util.log.info('Opération de base de données effectuée');
     *
     * @example <caption>Exemple 2 : Accéder aux utilitaires</caption>
     * console.log(db.util.str.camelCase('table_name'));
     */
    get util() {
        return NUtil;
    }

    // =========================================================================
    // Accesseurs vers les Sous-Moteurs de Persistance
    // =========================================================================

    /**
     * Retourne l'instance de `NSql` associée à cette base (allouée paresseusement au premier accès).
     * @type {NSql}
     *
     * @example <caption>Exemple 1 : Insérer une ligne SQL</caption>
     * await db.sql.insert('users', { name: 'Alice', age: 25 });
     *
     * @example <caption>Exemple 2 : Exécuter un SELECT paramétré</caption>
     * const user = await db.sql.selectOne('SELECT * FROM users WHERE id = :id', { id: 1 });
     * console.log(user?.name);
     */
    get sql() {
        if (!this.#sqlInstance) {
            const opts = {
                name: this.#name,
                ...(this.#sqlOptions && typeof this.#sqlOptions === 'object' ? this.#sqlOptions : {})
            };
            this.#sqlInstance = new NSql(opts);
        }
        return this.#sqlInstance;
    }

    /**
     * Retourne l'instance de `NIndexedDB` associée à cette base (allouée paresseusement au premier accès).
     * Configure automatiquement le magasin par défaut `'ntable'` (`keyPath: 'id'`, index `'data'`)
     * qui sert également de conteneur de persistance pour les données SQL en environnement Web.
     *
     * @type {NIndexedDB}
     *
     * @example <caption>Exemple 1 : Insérer un élément dans le store par défaut</caption>
     * const res = await db.indexed.put('ntable', { id: 'client_1', data: { name: 'Alice' } });
     * console.log(res.ok);
     *
     * @example <caption>Exemple 2 : Récupérer un élément par son identifiant</caption>
     * const item = await db.indexed.get('ntable', 'client_1');
     * console.log(item?.data);
     */
    get indexed() {
        if (!this.#indexedInstance) {
            const indexedOpts = {
                name: this.#name,
                version: this.#version,
                stores: [
                    {
                        name: 'ntable',
                        keyPath: 'id',
                        autoIncrement: false,
                        indexes: [
                            { name: 'data', keyPath: 'data', unique: false }
                        ]
                    }
                ]
            };
            this.#indexedInstance = new NIndexedDB(indexedOpts);
        }
        return this.#indexedInstance;
    }

    /**
     * Alias court vers `db.indexed` (`NIndexedDB`).
     * @type {NIndexedDB}
     *
     * @example <caption>Exemple 1 : Utilisation de l'alias idb</caption>
     * const countRes = await db.idb.count('ntable');
     * console.log('Enregistrements :', countRes.data);
     *
     * @example <caption>Exemple 2 : Sauvegarde dans ntable via idb</caption>
     * await db.idb.put('ntable', { id: 'pref', val: 1 });
     */
    get idb() {
        return this.indexed;
    }

    /**
     * Retourne l'instance de `NStorage` configurée et cloisonnée pour le contexte applicatif actif.
     * @type {NStorage}
     *
     * @example <caption>Exemple 1 : Écrire et lire une valeur dans le contexte</caption>
     * db.storage.set('auth_token', 'token_123');
     * console.log(db.storage.getString('auth_token'));
     *
     * @example <caption>Exemple 2 : Enregistrer un objet avec TTL</caption>
     * db.storage.set('session', { user: 'Alice' }, 3600);
     */
    get storage() {
        if (!this.#storageInstance) {
            this.#storageInstance = new NStorage({
                prefix: `${this.#name}:`,
                context: this.#context
            });
        }
        return this.#storageInstance;
    }

    /**
     * Alias court vers `db.storage` (`NStorage`).
     * @type {NStorage}
     *
     * @example <caption>Exemple 1 : Utilisation de l'alias store</caption>
     * db.store.set('active_lang', 'fr');
     *
     * @example <caption>Exemple 2 : Suppression d'une clé</caption>
     * db.store.remove('temp_key');
     */
    get store() {
        return this.storage;
    }

    // =========================================================================
    // Initialisation Coordonnée & Gestion Globale
    // =========================================================================

    /**
     * Initialise de manière coordonnée la base de données :
     * 1. Ouvre et prépare `NIndexedDB` avec la structure `'ntable'` associée au contexte.
     * 2. Prépare `NStorage` cloisonné pour le contexte.
     * 3. Si SQL est requis, restaure automatiquement la base SQLite depuis IndexedDB
     *    (pour les applications Web non natives) et initialise `NSql`.
     *
     * Pour les applications qui n'ont pas besoin de SQL, `indexed` et `store` sont configurés
     * avec succès sans exiger de moteur SQLite.
     *
     * @async
     * @method init
     * @param {Object|boolean} [sqlOptions={}] - Options de configuration SQL supplémentaires ou de surcharge.
     * @returns {Promise<NDatabaseInitResult>} Statut d'initialisation global et par moteur.
     *
     * @example <caption>Exemple 1 : Initialisation standard avec structure SQL</caption>
     * const res = await db.init({
     *     dbStructure: {
     *         articles: 'CREATE TABLE articles (id INTEGER PRIMARY KEY, title TEXT);'
     *     }
     * });
     * console.log('Base prête :', res.ok);
     *
     * @example <caption>Exemple 2 : Initialisation pour une application sans SQL</caption>
     * const res = await db.init(false);
     * console.log('Store prêt :', res.storage, 'IndexedDB prêt :', res.indexed);
     */
    async init(sqlOptions = {}) {
        if (this.#initPromise) {
            return this.#initPromise;
        }

        this.#initPromise = (async () => {
            const errors = {};
            let indexedSuccess = true;
            let storageSuccess = true;
            let sqlSuccess = true;

            // 1. Mise à jour des options SQL si fournies
            if (sqlOptions === false) {
                this.#sqlOptions = false;
            } else if (sqlOptions && typeof sqlOptions === 'object' && Object.keys(sqlOptions).length > 0) {
                if (sqlOptions.context) {
                    this.#context = this.#resolveContext(sqlOptions.context);
                }
                if (sqlOptions.name) {
                    this.#name = sqlOptions.name.trim();
                }
                if (typeof sqlOptions.version === 'number' && sqlOptions.version >= 1) {
                    this.#version = Math.floor(sqlOptions.version);
                }
                this.#sqlOptions = {
                    ...(typeof this.#sqlOptions === 'object' ? this.#sqlOptions : {}),
                    ...sqlOptions
                };
            }

            // 2. Initialisation d'IndexedDB (magasin ntable par défaut du contexte)
            try {
                const idbRes = await this.indexed.open();
                indexedSuccess = Boolean(idbRes?.ok);
                if (!indexedSuccess) {
                    errors.indexed = idbRes?.error || 'Échec de l\'ouverture d\'IndexedDB.';
                    NUtil.log.warn('NDatabase.init : IndexedDB non disponible, poursuite avec replis.', {
                        code: 'WARN_DB_INIT_INDEXED',
                        error: idbRes?.error,
                        database: this.#name
                    });
                }
            } catch (err) {
                indexedSuccess = false;
                errors.indexed = err?.message || String(err);
                NUtil.log.warn('NDatabase.init : Exception lors de l\'accès à IndexedDB.', {
                    code: 'WARN_DB_INIT_INDEXED_EXCEPTION',
                    error: err
                });
            }

            // 3. Préparation de NStorage pour le contexte
            try {
                storageSuccess = Boolean(this.storage.isAvailable || this.storage.driver);
            } catch (err) {
                storageSuccess = false;
                errors.storage = err?.message || String(err);
                NUtil.log.warn('NDatabase.init : NStorage non initialisé.', {
                    code: 'WARN_DB_INIT_STORAGE',
                    error: err
                });
            }

            // 4. Initialisation de NSql si requis
            const isSqlRequired = this.#sqlOptions !== false;
            if (isSqlRequired) {
                try {
                    const effectiveSqlOpts = {
                        name: this.#name,
                        ...(typeof this.#sqlOptions === 'object' ? this.#sqlOptions : {})
                    };

                    // Dans le cas Web/WASM (non natif), restaurer la base depuis IndexedDB si elle n'a pas été fournie
                    if (!effectiveSqlOpts.dbData && !this.sql.isNative && indexedSuccess) {
                        const savedBinary = await this.loadSql();
                        if (savedBinary) {
                            effectiveSqlOpts.dbData = savedBinary;
                        }
                    }

                    sqlSuccess = await this.sql.init(effectiveSqlOpts);
                    if (!sqlSuccess) {
                        errors.sql = 'Échec de l\'initialisation de NSql.';
                        NUtil.log.error('NDatabase.init : Erreur lors de l\'initialisation du moteur SQL.', {
                            code: 'ERR_DB_INIT_SQL',
                            database: this.#name
                        });
                    }
                } catch (err) {
                    sqlSuccess = false;
                    errors.sql = err?.message || String(err);
                    NUtil.log.error('NDatabase.init : Exception inattendue sur NSql.', {
                        code: 'ERR_DB_INIT_SQL_EXCEPTION',
                        error: err,
                        database: this.#name
                    });
                }
            } else {
                sqlSuccess = true;
            }

            this.#isInitialized = (!isSqlRequired || sqlSuccess) && (indexedSuccess || storageSuccess);

            return {
                ok: this.#isInitialized,
                sql: sqlSuccess,
                indexed: indexedSuccess,
                storage: storageSuccess,
                context: this.#context,
                ...(Object.keys(errors).length > 0 ? { errors } : {})
            };
        })();

        try {
            return await this.#initPromise;
        } finally {
            this.#initPromise = null;
        }
    }

    // =========================================================================
    // Persistance SQL via IndexedDB
    // =========================================================================

    /**
     * Sauvegarde l'état binaire courant de la base SQLite (`NSql.export()`)
     * dans le magasin `'ntable'` de `NIndexedDB` pour persistance WebAssembly.
     *
     * @async
     * @method saveSql
     * @returns {Promise<{ ok: boolean, error?: string }>} Statut de la sauvegarde.
     *
     * @example <caption>Exemple 1 : Sauvegarder la base SQL après des modifications importantes</caption>
     * await db.sql.insert('orders', { client: 'Bob', total: 4200 });
     * const saveRes = await db.saveSql();
     * if (saveRes.ok) console.log('Base SQL sauvegardée dans IndexedDB');
     *
     * @example <caption>Exemple 2 : Gestion d'erreur sans crash</caption>
     * const res = await db.saveSql();
     * if (!res.ok) console.warn('Sauvegarde non effectuée :', res.error);
     */
    async saveSql() {
        try {
            if (!this.#sqlInstance || !this.#sqlInstance.isOpen) {
                return { ok: false, error: 'Base SQL fermée ou non initialisée.' };
            }

            const binary = await this.#sqlInstance.export();
            if (!binary) {
                return { ok: false, error: 'Échec de l\'export binaire SQLite.' };
            }

            const key = `__sql_db_${this.#name}__`;
            const putRes = await this.indexed.put('ntable', {
                id: key,
                data: binary,
                context: this.#context,
                updatedAt: Date.now()
            });

            return {
                ok: Boolean(putRes?.ok),
                ...(putRes?.error ? { error: putRes.error } : {})
            };
        } catch (err) {
            NUtil.log.error('NDatabase.saveSql : Exception lors de la sauvegarde SQL dans IndexedDB.', {
                code: 'ERR_DB_SAVE_SQL',
                error: err,
                database: this.#name
            });
            return { ok: false, error: err?.message || String(err) };
        }
    }

    /**
     * Charge les données binaires SQLite précédemment persistées dans `NIndexedDB`.
     *
     * @async
     * @method loadSql
     * @returns {Promise<Uint8Array|null>} Données binaires SQLite exportées ou `null`.
     *
     * @example <caption>Exemple 1 : Charger manuellement les données binaires SQL sauvegardées</caption>
     * const bytes = await db.loadSql();
     * if (bytes) console.log('Taille sauvegardée :', bytes.length);
     *
     * @example <caption>Exemple 2 : Contrôle d'existence</caption>
     * const hasBackup = (await db.loadSql()) !== null;
     */
    async loadSql() {
        try {
            const key = `__sql_db_${this.#name}__`;
            const getRes = await this.indexed.get('ntable', key);
            if (getRes?.ok && getRes.data && getRes.data.data) {
                return getRes.data.data;
            }
            return null;
        } catch (err) {
            NUtil.log.warn('NDatabase.loadSql : Aucune sauvegarde SQL trouvée dans IndexedDB.', {
                code: 'WARN_DB_LOAD_SQL',
                error: err,
                database: this.#name
            });
            return null;
        }
    }

    // =========================================================================
    // Vidage, Fermeture & Suppression
    // =========================================================================

    /**
     * Vide intégralement les données de tous les stockages gérés par cette instance :
     * - Supprime les clés de `NStorage` associées au contexte
     * - Vide toutes les tables utilisateur de `NSql` (`sql.clear()`)
     * - Vide le magasin `'ntable'` de `NIndexedDB`
     *
     * @async
     * @method clearAll
     * @returns {Promise<{ ok: boolean, storage: boolean, sql: boolean, indexed: boolean }>}
     *
     * @example <caption>Exemple 1 : Vider entièrement les données de l'application</caption>
     * const res = await db.clearAll();
     * console.log('Remise à zéro effectuée :', res.ok);
     *
     * @example <caption>Exemple 2 : Réinitialisation après déconnexion utilisateur</caption>
     * await db.clearAll();
     */
    async clearAll() {
        let storageOk = false;
        let sqlOk = false;
        let indexedOk = false;

        // 1. Vider NStorage (cloisonné dans le contexte)
        try {
            storageOk = this.storage.clear();
        } catch (err) {
            storageOk = false;
            NUtil.log.error('NDatabase.clearAll : Échec de vidage du stockage clé-valeur.', {
                code: 'ERR_DB_CLEAR_STORAGE',
                error: err,
                database: this.#name
            });
        }

        // 2. Vider NSql
        try {
            if (this.#sqlInstance && this.#sqlInstance.isOpen) {
                sqlOk = await this.#sqlInstance.clear();
            } else {
                sqlOk = true;
            }
        } catch (err) {
            sqlOk = false;
            NUtil.log.error('NDatabase.clearAll : Échec de vidage de la base SQL.', {
                code: 'ERR_DB_CLEAR_SQL',
                error: err,
                database: this.#name
            });
        }

        // 3. Vider le store ntable d'IndexedDB
        try {
            const clearRes = await this.indexed.clear('ntable');
            indexedOk = Boolean(clearRes?.ok);
        } catch (err) {
            indexedOk = false;
            NUtil.log.error('NDatabase.clearAll : Échec de vidage du magasin ntable.', {
                code: 'ERR_DB_CLEAR_INDEXED',
                error: err,
                database: this.#name
            });
        }

        return {
            ok: storageOk && sqlOk && indexedOk,
            storage: storageOk,
            sql: sqlOk,
            indexed: indexedOk
        };
    }

    /**
     * Ferme proprement toutes les connexions actives (IndexedDB et SQLite) et réinitialise l'état.
     *
     * @method close
     * @returns {boolean} `true` si la fermeture globale s'est terminée.
     *
     * @example <caption>Exemple 1 : Fermer toutes les bases ouvertes</caption>
     * db.close();
     *
     * @example <caption>Exemple 2 : Contrôle de fermeture</caption>
     * const closed = db.close();
     * console.log('Bases fermées :', closed);
     */
    close() {
        if (this.#indexedInstance) {
            try {
                this.#indexedInstance.close();
            } catch (err) {
                NUtil.log.warn('NDatabase.close : Avertissement lors de la fermeture d\'IndexedDB.', {
                    code: 'WARN_DB_CLOSE_INDEXED',
                    error: err
                });
            }
        }

        if (this.#sqlInstance) {
            try {
                this.#sqlInstance.close();
            } catch (err) {
                NUtil.log.warn('NDatabase.close : Avertissement lors de la fermeture de NSql.', {
                    code: 'WARN_DB_CLOSE_SQL',
                    error: err
                });
            }
        }

        this.#isInitialized = false;
        return true;
    }

    /**
     * Supprime définitivement la base IndexedDB et les tables SQLite.
     *
     * @async
     * @method drop
     * @returns {Promise<{ ok: boolean, indexed: boolean, sql: boolean, storage: boolean }>}
     *
     * @example <caption>Exemple 1 : Suppression totale avant désinstallation</caption>
     * const res = await db.drop();
     * console.log('Bases supprimées :', res.ok);
     *
     * @example <caption>Exemple 2 : Réinitialisation usine complète</caption>
     * await db.drop();
     */
    async drop() {
        let storageOk = false;
        let sqlOk = false;
        let indexedOk = false;

        // 1. Purge NStorage
        try {
            storageOk = this.storage.clear();
        } catch (err) {
            storageOk = false;
            NUtil.log.error('NDatabase.drop : Échec de suppression de NStorage.', {
                code: 'ERR_DB_DROP_STORAGE',
                error: err
            });
        }

        // 2. Suppression des tables NSql
        try {
            if (this.#sqlInstance) {
                sqlOk = await this.#sqlInstance.deleteDb();
            } else {
                sqlOk = true;
            }
        } catch (err) {
            sqlOk = false;
            NUtil.log.error('NDatabase.drop : Échec de suppression de la base NSql.', {
                code: 'ERR_DB_DROP_SQL',
                error: err
            });
        }

        // 3. Suppression définitive de la base IndexedDB
        try {
            const idbRes = await this.indexed.deleteDatabase();
            indexedOk = Boolean(idbRes?.ok);
        } catch (err) {
            indexedOk = false;
            NUtil.log.error('NDatabase.drop : Échec de suppression de la base IndexedDB.', {
                code: 'ERR_DB_DROP_INDEXED',
                error: err
            });
        }

        this.close();

        return {
            ok: storageOk && sqlOk && indexedOk,
            storage: storageOk,
            sql: sqlOk,
            indexed: indexedOk
        };
    }

    // =========================================================================
    // Méthodes Internes Privées
    // =========================================================================

    /**
     * Résout le contexte applicatif avec repli automatique sur `NUtil.config`.
     *
     * @private
     * @param {string} [customContext] - Contexte explicite éventuel.
     * @returns {string} Contexte résolu (défaut : 'default').
     */
    #resolveContext(customContext) {
        if (typeof customContext === 'string' && customContext.trim()) {
            return customContext.trim();
        }

        try {
            const fromConfig = NUtil.config.getString('context')
                || NUtil.config.getString('app.context')
                || NUtil.config.getString('app.name')
                || NUtil.config.getString('name');

            if (fromConfig && typeof fromConfig === 'string' && fromConfig.trim()) {
                return fromConfig.trim();
            }
        } catch {
            // NUtil.config non encore instancié ou inaccessible
        }

        return 'default';
    }
}

export default NDatabase;
