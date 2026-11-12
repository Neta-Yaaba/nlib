/**
 * @file NDatabase.js
 * @package @nlib/js-backend
 * @description Gestionnaire central unifié des systèmes de persistance et stockage de l'écosystème NLib.
 * Coordonne et expose sous une interface harmonieuse les trois piliers de stockage :
 * - `indexed` / `idb` : Base de données NoSQL IndexedDB (`NIndexedDB`)
 * - `sql` : Moteur relationnel SQLite (`NSql`)
 * - `storage` / `store` : Magasin clé-valeur résilient (`NStorage` - LocalStorage, SessionStorage ou Mémoire)
 *
 * Permet une initialisation coordonnée à partir d'une configuration unique (`name`, `version`, `sql`, `indexed`, `storage`).
 *
 * Conforme aux standards NLib : classe autonome sans variable globale hors classe,
 * instanciable et accessible via `NUtil.db` / `NUtil.database`, avec documentation JSDoc exhaustive.
 */

import { NIndexedDB } from './NIndexedDB.js';
import { NSql } from './NSql.js';
import { NStorage } from './NStorage.js';

/**
 * @class NDatabase
 * @description Manager de persistance unifié coordonnant IndexedDB (`NIndexedDB`), SQLite (`NSql`)
 * et le stockage clé-valeur (`NStorage`).
 *
 * @example <caption>Exemple 1 : Instanciation simple avec initialisation paresseuse</caption>
 * const db = new NDatabase({ name: 'mon_app', version: 1 });
 * db.storage.set('theme', 'dark');
 * await db.indexed.add('logs', { event: 'app_start', time: Date.now() });
 *
 * @example <caption>Exemple 2 : Initialisation coordonnée complète (SQL + IndexedDB + Storage)</caption>
 * const db = new NDatabase({
 *     name: 'gestpos',
 *     version: 2,
 *     sql: {
 *         dbStructure: {
 *             products: 'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, title TEXT, price REAL);'
 *         }
 *     },
 *     indexed: {
 *         stores: [
 *             { name: 'cart', keyPath: 'id', autoIncrement: true },
 *             { name: 'customers', keyPath: 'code' }
 *         ]
 *     },
 *     storage: {
 *         prefix: 'gestpos:'
 *     }
 * });
 * await db.init();
 *
 * @example <caption>Exemple 3 : Utilisation transversale via les accesseurs raccourcis</caption>
 * const db = new NDatabase({ name: 'pos' });
 * await db.sql.insert('products', { title: 'Café', price: 150 });
 * await db.idb.put('cart', { item: 'Café', qty: 2 });
 * db.store.set('active_user', 'admin');
 */
export class NDatabase {

    // =========================================================================
    // Propriétés d'instance privées
    // =========================================================================

    /**
     * Nom logique principal de la base de données de l'application.
     * @type {string}
     * @private
     */
    #name = 'nlib_db';

    /**
     * Version du schéma global.
     * @type {number}
     * @private
     */
    #version = 1;

    /**
     * Options de configuration spécifiques à NSql.
     * @type {Object|null}
     * @private
     */
    #sqlOptions = null;

    /**
     * Options de configuration spécifiques à NIndexedDB.
     * @type {Object|null}
     * @private
     */
    #indexedOptions = null;

    /**
     * Options de configuration spécifiques à NStorage.
     * @type {Object|null}
     * @private
     */
    #storageOptions = null;

    /**
     * Instance de NIndexedDB (allouée paresseusement au premier appel).
     * @type {NIndexedDB|null}
     * @private
     */
    #indexedInstance = null;

    /**
     * Instance de NSql (allouée paresseusement au premier appel).
     * @type {NSql|null}
     * @private
     */
    #sqlInstance = null;

    /**
     * Instance de NStorage (allouée paresseusement au premier appel).
     * @type {NStorage|null}
     * @private
     */
    #storageInstance = null;

    /**
     * Indique si l'initialisation coordonnée a été effectuée.
     * @type {boolean}
     * @private
     */
    #isInitialized = false;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de NDatabase.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration globale.
     * @param {string} [options.name='nlib_db'] - Nom partagé pour les bases (IndexedDB, NSql, préfixe Storage).
     * @param {number} [options.version=1] - Numéro de version du schéma (notamment pour IndexedDB).
     * @param {Object} [options.sql] - Options d'initialisation de NSql (`dbStructure`, `wasmPath`, `dbBase64Data`, etc.).
     * @param {Object} [options.indexed] - Options d'initialisation de NIndexedDB (`stores`, etc.).
     * @param {Object} [options.storage] - Options d'initialisation de NStorage (`prefix`, `ttl`, `driver`).
     *
     * @example <caption>Exemple 1 : Instanciation par défaut</caption>
     * const db = new NDatabase();
     *
     * @example <caption>Exemple 2 : Configuration complète avec options spécifiques</caption>
     * const db = new NDatabase({
     *     name: 'pos_offline',
     *     version: 3,
     *     sql: { wasmPath: '/wasm/sql-wasm.wasm' },
     *     storage: { prefix: 'pos:' }
     * });
     */
    constructor(options = {}) {
        if (options && typeof options === 'object') {
            if (typeof options.name === 'string' && options.name.trim()) {
                this.#name = options.name.trim();
            }
            if (typeof options.version === 'number' && options.version >= 1) {
                this.#version = Math.floor(options.version);
            }
            if (options.sql && typeof options.sql === 'object') {
                this.#sqlOptions = { ...options.sql };
            }
            if (options.indexed && typeof options.indexed === 'object') {
                this.#indexedOptions = { ...options.indexed };
            }
            if (options.storage && typeof options.storage === 'object') {
                this.#storageOptions = { ...options.storage };
            }
        }
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    /**
     * Retourne le nom logique principal de la base de données.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Consulter le nom de la base</caption>
     * console.log(db.name); // 'gestpos'
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
     * Indique si l'initialisation coordonnée globale de la base a été exécutée.
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

    // =========================================================================
    // Accesseurs vers les Modules de Stockage (Lazy Singletons internes)
    // =========================================================================

    /**
     * Retourne l'instance de `NIndexedDB` associée à cette base (allouée paresseusement).
     * @type {NIndexedDB}
     *
     * @example <caption>Exemple 1 : Ajouter un élément dans IndexedDB</caption>
     * await db.indexed.add('logs', { message: 'Connexion réussie' });
     *
     * @example <caption>Exemple 2 : Lire tous les éléments d'un magasin</caption>
     * const res = await db.indexed.getAll('orders');
     * console.log(res.data);
     */
    get indexed() {
        if (!this.#indexedInstance) {
            const opts = {
                name: this.#name,
                version: this.#version,
                ...(this.#indexedOptions || {})
            };
            this.#indexedInstance = new NIndexedDB(opts);
        }
        return this.#indexedInstance;
    }

    /**
     * Alias court vers `db.indexed` (`NIndexedDB`).
     * @type {NIndexedDB}
     *
     * @example <caption>Exemple 1 : Utilisation de l'alias idb</caption>
     * const countRes = await db.idb.count('products');
     * console.log('Produits :', countRes.data);
     *
     * @example <caption>Exemple 2 : Recherche par index</caption>
     * const res = await db.idb.getByIndex('users', 'by_email', 'alice@test.com');
     */
    get idb() {
        return this.indexed;
    }

    /**
     * Retourne l'instance de `NSql` associée à cette base (allouée paresseusement).
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
                ...(this.#sqlOptions || {})
            };
            this.#sqlInstance = new NSql(opts);
        }
        return this.#sqlInstance;
    }

    /**
     * Retourne l'instance de `NStorage` associée à cette base (allouée paresseusement).
     * @type {NStorage}
     *
     * @example <caption>Exemple 1 : Écrire et lire une valeur</caption>
     * db.storage.set('auth_token', 'token_123');
     * console.log(db.storage.getString('auth_token'));
     *
     * @example <caption>Exemple 2 : Enregistrer un objet avec TTL</caption>
     * db.storage.set('session', { user: 'Alice' }, 3600);
     */
    get storage() {
        if (!this.#storageInstance) {
            const opts = {
                prefix: `${this.#name}:`,
                ...(this.#storageOptions || {})
            };
            this.#storageInstance = new NStorage(opts);
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
     * Initialise de manière coordonnée tous les moteurs de persistance configurés :
     * 1. Ouvre la base `IndexedDB`
     * 2. Initialise le moteur relationnel `NSql` avec la structure déclarée
     * 3. Prépare le gestionnaire clé-valeur `NStorage`
     *
     * @async
     * @method init
     * @param {Object} [overrideOptions] - Options complémentaires écrasant la configuration du constructeur.
     * @returns {Promise<{ ok: boolean, sql: boolean, indexed: boolean, storage: boolean, error?: string }>}
     *
     * @example <caption>Exemple 1 : Initialisation standard</caption>
     * const status = await db.init();
     * console.log('IndexedDB OK :', status.indexed, 'SQL OK :', status.sql);
     *
     * @example <caption>Exemple 2 : Initialisation avec structure SQL déclarative à la volée</caption>
     * await db.init({
     *     sql: {
     *         dbStructure: {
     *             orders: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, total REAL);'
     *         }
     *     }
     * });
     */
    async init(overrideOptions = {}) {
        const overrides = overrideOptions && typeof overrideOptions === 'object' ? overrideOptions : {};

        let indexedSuccess = true;
        let sqlSuccess = true;
        let storageSuccess = true;

        // 1. Initialisation IndexedDB
        try {
            const idbRes = await this.indexed.open();
            indexedSuccess = idbRes.ok;
        } catch {
            indexedSuccess = false;
        }

        // 2. Initialisation NSql
        try {
            const effectiveSqlOpts = {
                ...(this.#sqlOptions || {}),
                ...(overrides.sql || {})
            };
            sqlSuccess = await this.sql.init(effectiveSqlOpts);
        } catch {
            sqlSuccess = false;
        }

        // 3. NStorage (déjà opérationnel à l'accès)
        storageSuccess = Boolean(this.storage.driver);

        this.#isInitialized = indexedSuccess && sqlSuccess;

        return {
            ok: this.#isInitialized,
            sql: sqlSuccess,
            indexed: indexedSuccess,
            storage: storageSuccess
        };
    }

    /**
     * Vide intégralement les données de tous les stockages gérés par cette instance :
     * - Supprime les clés préfixées de `NStorage`
     * - Vide toutes les tables utilisateur de `NSql` (`sql.clear()`)
     * - Vide les Object Stores déclarés dans `NIndexedDB`
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

        // 1. Vider NStorage
        try {
            storageOk = this.storage.clear();
        } catch {
            storageOk = false;
        }

        // 2. Vider NSql
        try {
            sqlOk = await this.sql.clear();
        } catch {
            sqlOk = false;
        }

        // 3. Vider les stores NIndexedDB existants
        try {
            const stores = this.indexed.storeNames;
            for (const store of stores) {
                await this.indexed.clear(store);
            }
            indexedOk = true;
        } catch {
            indexedOk = false;
        }

        return {
            ok: storageOk && sqlOk && indexedOk,
            storage: storageOk,
            sql: sqlOk,
            indexed: indexedOk
        };
    }

    /**
     * Ferme proprement toutes les connexions actives (IndexedDB et SQLite).
     *
     * @method close
     * @returns {boolean}
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
            this.#indexedInstance.close();
        }
        if (this.#sqlInstance) {
            this.#sqlInstance.close();
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
     * @example <caption>Exemple 2 : Réinitialisation usine</caption>
     * await db.drop();
     */
    async drop() {
        let storageOk = false;
        let sqlOk = false;
        let indexedOk = false;

        try {
            storageOk = this.storage.clear();
        } catch {
            storageOk = false;
        }

        try {
            sqlOk = await this.sql.deleteDb();
        } catch {
            sqlOk = false;
        }

        try {
            const idbRes = await this.indexed.deleteDatabase();
            indexedOk = idbRes.ok;
        } catch {
            indexedOk = false;
        }

        this.close();

        return {
            ok: storageOk && sqlOk && indexedOk,
            storage: storageOk,
            sql: sqlOk,
            indexed: indexedOk
        };
    }
}

export default NDatabase;

