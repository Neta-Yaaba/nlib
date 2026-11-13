/**
 * @file NIndexedDB.js
 * @package @nlib/js-backend
 * @description Wrapper universel, asynchrone, transactionnellement sécurisé, résilient et chiffrable pour IndexedDB dans l'écosystème NLib.
 *
 * Caractéristiques techniques majeures :
 * - Gestion unifiée des connexions : déduplication stricte des ouvertures concurrentes (`#openingPromise`),
 *   gestion des blocages (`onblocked`), fermetures propres (`close()`) et invalidation automatique (`onversionchange`, `onclose`).
 * - Sécurisation transactionnelle intégrale : validation définitive des écritures sur `tx.oncomplete` (et non
 *   seulement sur `req.onsuccess`), gestion rigoureuse des événements `onerror` et `onabort` pour éviter toute promesse orpheline.
 * - Migrations dynamiques et sûres (`#handleUpgrade`) : création automatique des Object Stores, détection des index
 *   manquants sur stores existants, mise à jour des index dont la définition (clé, unique, multiEntry) a évolué.
 * - Cryptage et protection des données optionnels et modulaires :
 *   1. Clé et donnée (`encryptKey: true, encryptData: true`)
 *   2. Clé seule (`encryptKey: true, encryptData: false`)
 *   3. Donnée seule (`encryptData: true, encryptKey: false`)
 *   4. Aucun cryptage (`encryptKey: false, encryptData: false` - comportement par défaut)
 *   Prise en charge à la fois au niveau de l'instance et au niveau de chaque opération CRUD (add, put, get, getAll, cursor, etc.).
 * - Moteur cryptographique synchrone autonome pur JS (SHA-256 + Stream Cipher 256 bits + IV aléatoire/déterministe).
 * - Méthode `cursor()` résiliente : capture d'erreurs en bloc try/catch, support des callbacks synchrones et asynchrones
 *   avec arrêt anticipé propre (`return false`) sans rompre le cycle de vie de la transaction, avec déchiffrement transparent.
 * - Format de retour standardisé et prévisible : `{ ok: true, data: any }` ou `{ ok: false, error: string, code: string }`.
 *
 * Conforme aux standards stricts NLib : classe autonome sans variable globale hors classe,
 * sans méthode statique superflue, et compatible avec le Main Thread (DOM) et les Web Workers (`WorkerGlobalScope`).
 */

import { NUtil } from '../utils/NUtil.js';

/**
 * Format standard de retour de toutes les opérations NIndexedDB.
 * Garantit que l'appelant reçoit toujours une structure prévisible et sûre sans exception rejetée.
 *
 * @typedef {Object} NIndexedDBResponse
 * @property {boolean} ok - Indique si l'opération a réussi.
 * @property {any} [data=null] - Les données retournées par l'opération (élément, liste, clé, count, etc.).
 * @property {string|null} [error=null] - Message d'erreur explicite en cas d'échec.
 * @property {string|null} [code=null] - Code d'erreur machine standardisé (ex: 'IDB_STORE_NOT_FOUND', 'IDB_TRANSACTION_ERROR').
 */

/**
 * Options de chiffrement et d'exécution pour les opérations NIndexedDB.
 * @typedef {Object} NIndexedDBOptions
 * @property {boolean} [encryptKey=false] - Indique si la clé doit être chiffrée.
 * @property {boolean} [encryptData=false] - Indique si les données doivent être chiffrées.
 * @property {string} [secretKey=''] - Clé secrète personnalisée pour le chiffrement.
 */

/**
 * @class NIndexedDB
 * @description Gestionnaire asynchrone IndexedDB résilient, sécurisé transactionnellement et multi-instances avec cryptage optionnel.
 *
 * @example <caption>Exemple 1 : Utilisation standard avec store déclaré et CRUD basique</caption>
 * const db = new NIndexedDB({
 *     name: 'gestpos_db',
 *     version: 1,
 *     stores: [
 *         { name: 'products', keyPath: 'id', autoIncrement: true, indexes: [{ name: 'by_category', keyPath: 'category' }] },
 *         { name: 'settings', keyPath: 'key' }
 *     ]
 * });
 * const res = await db.add('products', { name: 'Pain', category: 'boulangerie', price: 150 });
 * console.log(res.ok ? `Produit créé avec l'ID ${res.data}` : res.error);
 *
 * @example <caption>Exemple 2 : Chiffrement intégral automatique (clé et données) au niveau de l'instance</caption>
 * const secureDb = new NIndexedDB({
 *     name: 'secure_app_db',
 *     version: 1,
 *     encryptKey: true,
 *     encryptData: true,
 *     secretKey: 'mon_mot_de_passe_chiffrement',
 *     stores: [{ name: 'tokens', keyPath: 'id' }]
 * });
 * await secureDb.put('tokens', { id: 'usr_42', jwt: 'xyz987', role: 'admin' });
 * const item = await secureDb.get('tokens', 'usr_42');
 * console.log(item.data.jwt); // 'xyz987' (déchiffré de manière transparente)
 *
 * @example <caption>Exemple 3 : Chiffrement sélectif ponctuel par opération (donnée seule ou clé seule)</caption>
 * const db = new NIndexedDB({ name: 'hybrid_db' });
 * // Chiffrer la donnée confidentielle mais garder la clé en clair pour l'indexation
 * await db.put('ntable', { id: 1, sensitiveDoc: 'secret' }, { encryptData: true, encryptKey: false });
 * // Chiffrer la clé uniquement
 * await db.put('ntable', { id: 2, note: 'publique' }, { encryptKey: true, encryptData: false });
 */
export class NIndexedDB {

    // =========================================================================
    // Propriétés privées (Encapsulation stricte)
    // =========================================================================

    /**
     * Nom logique de la base de données IndexedDB.
     * @type {string}
     * @private
     */
    #name = 'nlib_db';

    /**
     * Version du schéma IndexedDB (entier positif >= 1).
     * @type {number}
     * @private
     */
    #version = 1;

    /**
     * Déclaration des Object Stores et de leurs index.
     * @type {Array<Object>|null}
     * @private
     */
    #stores = null;

    /**
     * Instance native IDBDatabase actuellement ouverte.
     * @type {IDBDatabase|null}
     * @private
     */
    #db = null;

    /**
     * Promesse de connexion en cours pour garantir l'unicité de l'ouverture (déduplication).
     * @type {Promise<IDBDatabase>|null}
     * @private
     */
    #openingPromise = null;

    /**
     * Indique si les clés doivent être chiffrées par défaut sur cette instance.
     * @type {boolean}
     * @private
     */
    #encryptKey = false;

    /**
     * Indique si les données doivent être chiffrées par défaut sur cette instance.
     * @type {boolean}
     * @private
     */
    #encryptData = false;

    /**
     * Clé secrète de chiffrement configurée pour l'instance.
     * @type {string}
     * @private
     */
    #secretKey = '';

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de NIndexedDB.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration de la base.
     * @param {string} [options.name='nlib_db'] - Nom de la base IndexedDB.
     * @param {number} [options.version=1] - Version du schéma (entier >= 1).
     * @param {Array<Object>} [options.stores=[]] - Déclaration des magasins (stores) et leurs index.
     * @param {boolean} [options.encryptKey=false] - Active le cryptage par défaut des clés.
     * @param {boolean} [options.encryptData=false] - Active le cryptage par défaut des données.
     * @param {string} [options.secretKey=''] - Clé secrète de chiffrement de l'instance.
     *
     * @example <caption>Exemple 1 : Instanciation simple avec store par défaut (ntable / id)</caption>
     * const idb = new NIndexedDB({ name: 'my_app' });
     *
     * @example <caption>Exemple 2 : Configuration sécurisée avec chiffrement intégral</caption>
     * const secureDb = new NIndexedDB({
     *     name: 'pos_secure',
     *     version: 2,
     *     encryptKey: true,
     *     encryptData: true,
     *     secretKey: 'mon_secret_pos'
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
            if (Array.isArray(options.stores)) {
                this.#stores = options.stores;
            }
            if (typeof options.encryptKey === 'boolean') {
                this.#encryptKey = options.encryptKey;
            }
            if (typeof options.encryptData === 'boolean') {
                this.#encryptData = options.encryptData;
            }
            if (typeof options.secretKey === 'string' && options.secretKey.trim()) {
                this.#secretKey = options.secretKey.trim();
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
     * @example <caption>Exemple 1 : Consulter le nom de la base</caption>
     * console.log(db.name); // 'gestpos_db'
     *
     * @example <caption>Exemple 2 : Affichage dans les logs</caption>
     * console.log(`Base active : ${db.name}`);
     */
    get name() {
        return this.#name;
    }

    /**
     * Retourne la version du schéma de la base.
     * @type {number}
     *
     * @example <caption>Exemple 1 : Consulter la version active</caption>
     * console.log(db.version); // 1
     *
     * @example <caption>Exemple 2 : Contrôle d'évolution</caption>
     * if (db.version > 1) { console.log('Base mise à niveau'); }
     */
    get version() {
        return this.#version;
    }

    /**
     * Indique si une connexion native IDBDatabase est actuellement active et ouverte.
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier si la base est connectée</caption>
     * console.log(db.isOpen); // true ou false
     *
     * @example <caption>Exemple 2 : Condition avant fermeture</caption>
     * if (db.isOpen) { db.close(); }
     */
    get isOpen() {
        return this.#db !== null;
    }

    /**
     * Retourne la liste des noms des Object Stores disponibles dans la base ouverte.
     * Retourne un tableau vide si la base n'est pas encore connectée.
     * @type {string[]}
     *
     * @example <caption>Exemple 1 : Lister les stores existants</caption>
     * console.log(db.storeNames); // ['ntable', 'products', 'orders']
     *
     * @example <caption>Exemple 2 : Vérifier la présence d'un store</caption>
     * if (db.storeNames.includes('cache')) { console.log('Magasin de cache disponible'); }
     */
    get storeNames() {
        if (!this.#db) return [];
        return Array.from(this.#db.objectStoreNames);
    }

    /**
     * Indique si le chiffrement des clés est activé par défaut sur cette instance.
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier la configuration de chiffrement des clés</caption>
     * console.log(db.isKeyEncrypted); // true ou false
     *
     * @example <caption>Exemple 2 : Conditionnement applicatif</caption>
     * if (db.isKeyEncrypted) { console.log('Protection des clés activée'); }
     */
    get isKeyEncrypted() {
        return this.#encryptKey;
    }

    /**
     * Indique si le chiffrement des données est activé par défaut sur cette instance.
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier la configuration de chiffrement des données</caption>
     * console.log(db.isDataEncrypted); // true ou false
     *
     * @example <caption>Exemple 2 : Notification de sécurité</caption>
     * if (db.isDataEncrypted) { console.log('Payloads chiffrés au repos'); }
     */
    get isDataEncrypted() {
        return this.#encryptData;
    }

    /**
     * Accès direct aux utilitaires partagés NUtil.
     * @type {typeof NUtil}
     *
     * @example <caption>Exemple 1 : Accéder aux utilitaires</caption>
     * const util = db.util;
     *
     * @example <caption>Exemple 2 : Journalisation standard via util</caption>
     * db.util.log.info('Opération IndexedDB');
     */
    get util() {
        return NUtil;
    }

    // =========================================================================
    // Cycle de Vie de la Base (open, close, deleteDatabase)
    // =========================================================================

    /**
     * Ouvre la connexion à la base IndexedDB.
     * Cette méthode est réentrante, déduplique les appels concurrents et est déclenchée
     * automatiquement de manière transparente par toutes les opérations CRUD.
     *
     * @async
     * @method open
     * @returns {Promise<NIndexedDBResponse>} Structure standardisée contenant l'instance IDBDatabase dans `data`.
     *
     * @example <caption>Exemple 1 : Ouverture manuelle anticipée</caption>
     * const res = await db.open();
     * if (res.ok) console.log('Base prête !');
     *
     * @example <caption>Exemple 2 : Gestion d'erreur sans crash de l'application</caption>
     * const res = await db.open();
     * if (!res.ok) console.warn('Impossible d ouvrir IndexedDB :', res.error);
     */
    async open() {
        try {
            const dbInstance = await this.#ensureConnection();
            if (!dbInstance) {
                return this.#fail('IndexedDB n\'est pas supporté ou accessible dans cet environnement.', 'IDB_OPEN_ERROR');
            }
            return this.#success(dbInstance);
        } catch (err) {
            return this.#fail(err, 'IDB_OPEN_ERROR');
        }
    }

    /**
     * Ferme proprement la connexion à la base IndexedDB si elle est ouverte.
     * Permet aux futures opérations de rouvrir une nouvelle connexion si nécessaire.
     *
     * @method close
     * @returns {NIndexedDBResponse}
     *
     * @example <caption>Exemple 1 : Fermer la connexion active</caption>
     * db.close();
     *
     * @example <caption>Exemple 2 : Fermeture avant changement de session</caption>
     * const res = db.close();
     * console.log(res.ok); // true
     */
    close() {
        if (this.#db) {
            try {
                this.#db.close();
            } catch (err) {
                return this.#fail(err, 'IDB_CLOSE_ERROR');
            } finally {
                this.#db = null;
                this.#openingPromise = null;
            }
        }
        return this.#success(true);
    }

    /**
     * Supprime définitivement la base de données IndexedDB du navigateur.
     * Ferme préalablement toute connexion active pour éviter les blocages.
     *
     * @async
     * @method deleteDatabase
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Suppression complète de la base locale</caption>
     * const res = await db.deleteDatabase();
     * if (res.ok) console.log('Base IndexedDB effacée définitivement.');
     *
     * @example <caption>Exemple 2 : Réinitialisation propre lors d'un test</caption>
     * db.close();
     * await db.deleteDatabase();
     */
    async deleteDatabase() {
        this.close();

        if (typeof indexedDB === 'undefined') {
            return this.#fail('IndexedDB n\'est pas supporté dans cet environnement.', 'IDB_UNSUPPORTED');
        }

        return new Promise((resolve) => {
            let req;
            try {
                req = indexedDB.deleteDatabase(this.#name);
            } catch (err) {
                return resolve(this.#fail(err, 'IDB_DELETE_DB_ERROR'));
            }

            req.onsuccess = () => {
                resolve(this.#success(true));
            };

            req.onerror = () => {
                resolve(this.#fail(req.error || 'Erreur lors de la suppression de la base.', 'IDB_DELETE_DB_ERROR'));
            };

            req.onblocked = () => {
                resolve(this.#fail('Suppression bloquée : d\'autres connexions ou onglets sont encore actifs.', 'IDB_BLOCKED'));
            };
        });
    }

    // =========================================================================
    // Opérations CRUD (Create, Read, Update, Delete)
    // =========================================================================

    /**
     * Ajoute un nouvel élément dans un Object Store.
     * Échoue si la clé existe déjà (contrairement à `put` qui écrase).
     * Prend en charge les 4 modes de chiffrement (clé et/ou donnée).
     *
     * @async
     * @method add
     * @param {string} storeName - Nom du magasin de stockage.
     * @param {any} value - Données de l'objet à insérer.
     * @param {IDBValidKey|NIndexedDBOptions} [keyOrOptions] - Clé explicite OU objet d'options si store à clé interne.
     * @param {NIndexedDBOptions} [options={}] - Options de chiffrement ponctuelles.
     * @returns {Promise<NIndexedDBResponse>} Retourne la clé générée ou assignée dans `res.data`.
     *
     * @example <caption>Exemple 1 : Ajouter un objet avec clé générée automatiquement</caption>
     * const res = await db.add('customers', { name: 'Jean Dupont', email: 'jean@example.com' });
     * console.log('Clé assignée :', res.data);
     *
     * @example <caption>Exemple 2 : Ajouter avec chiffrement de la donnée seule</caption>
     * const res = await db.add('ntable', { id: 10, secretToken: 'xyz' }, { encryptData: true });
     * if (res.ok) console.log('Enregistrement sécurisé avec succès');
     */
    async add(storeName, value, keyOrOptions, options = {}) {
        let explicitKey = keyOrOptions;
        let opts = options;
        if (this.#isOptionsObject(keyOrOptions)) {
            opts = keyOrOptions;
            explicitKey = undefined;
        }

        return this.#executeStoreRequest(storeName, 'readwrite', (store) => {
            const prepared = this.#prepareRecordForWrite(store, value, explicitKey, opts);
            return prepared.key !== undefined
                ? store.add(prepared.value, prepared.key)
                : store.add(prepared.value);
        }, (result) => {
            const secretKey = this.#getEffectiveSecretKey(opts?.secretKey);
            return this.#isEncryptedKey(result) ? this.#decryptKey(result, secretKey) : result;
        });
    }

    /**
     * Insère ou met à jour un élément (écrase la donnée si la clé existe déjà).
     * La résolution de la promesse garantit que la transaction a été commitée sur le disque.
     * Prend en charge les 4 modes de chiffrement (clé et/ou donnée).
     *
     * @async
     * @method put
     * @param {string} storeName - Nom du magasin de stockage.
     * @param {any} value - Données de l'objet à enregistrer.
     * @param {IDBValidKey|NIndexedDBOptions} [keyOrOptions] - Clé explicite OU objet d'options.
     * @param {NIndexedDBOptions} [options={}] - Options de chiffrement ponctuelles.
     * @returns {Promise<NIndexedDBResponse>} Retourne la clé de l'élément dans `res.data`.
     *
     * @example <caption>Exemple 1 : Mettre à jour un produit existant</caption>
     * const res = await db.put('products', { id: 10, name: 'Café Espresso', price: 500 });
     * console.log('Enregistré avec la clé :', res.data);
     *
     * @example <caption>Exemple 2 : Enregistrer avec clé chiffrée et donnée chiffrée</caption>
     * await db.put('ntable', { id: 'admin_pass', pass: 'secret123' }, { encryptKey: true, encryptData: true });
     */
    async put(storeName, value, keyOrOptions, options = {}) {
        let explicitKey = keyOrOptions;
        let opts = options;
        if (this.#isOptionsObject(keyOrOptions)) {
            opts = keyOrOptions;
            explicitKey = undefined;
        }

        return this.#executeStoreRequest(storeName, 'readwrite', (store) => {
            const prepared = this.#prepareRecordForWrite(store, value, explicitKey, opts);
            return prepared.key !== undefined
                ? store.put(prepared.value, prepared.key)
                : store.put(prepared.value);
        }, (result) => {
            const secretKey = this.#getEffectiveSecretKey(opts?.secretKey);
            return this.#isEncryptedKey(result) ? this.#decryptKey(result, secretKey) : result;
        });
    }

    /**
     * Récupère un élément par sa clé primaire avec déchiffrement transparent.
     * Retourne `res.data = null` si l'élément n'existe pas.
     *
     * @async
     * @method get
     * @param {string} storeName - Nom du magasin.
     * @param {IDBValidKey} key - Clé de l'élément recherché.
     * @param {NIndexedDBOptions} [options={}] - Options ponctuelles (secretKey, encryptKey).
     * @returns {Promise<NIndexedDBResponse>} Contient l'objet trouvé dans `res.data` (ou `null` s'il est absent).
     *
     * @example <caption>Exemple 1 : Récupérer un utilisateur par identifiant</caption>
     * const res = await db.get('users', 42);
     * if (res.ok && res.data) console.log('Utilisateur :', res.data.username);
     *
     * @example <caption>Exemple 2 : Récupérer une entrée avec clé chiffrée</caption>
     * const res = await db.get('ntable', 'admin_pass', { encryptKey: true });
     * console.log(res.data?.pass); // Déchiffré automatiquement
     */
    async get(storeName, key, options = {}) {
        if (key === undefined || key === null) {
            return this.#fail('La clé de recherche ne peut être nulle ou indéfinie.', 'IDB_INVALID_KEY');
        }

        const opts = options && typeof options === 'object' ? options : {};
        const shouldEncryptKey = opts.encryptKey ?? this.#encryptKey;
        const secretKey = this.#getEffectiveSecretKey(opts.secretKey);

        return this.#executeStoreRequest(storeName, 'readonly', (store) => {
            const lookupKey = (shouldEncryptKey && !this.#isEncryptedKey(key))
                ? this.#encryptKey(String(key), secretKey)
                : key;
            return store.get(lookupKey);
        }, (result, store) => {
            return this.#restoreRecordAfterRead(store, result, opts);
        });
    }

    /**
     * Récupère tous les éléments d'un magasin avec déchiffrement transparent.
     *
     * @async
     * @method getAll
     * @param {string} storeName - Nom du magasin.
     * @param {IDBKeyRange|IDBValidKey|NIndexedDBOptions} [query] - Plage ou clé de filtrage OU options.
     * @param {number|NIndexedDBOptions} [count] - Nombre maximal d'éléments OU options.
     * @param {NIndexedDBOptions} [options={}] - Options de déchiffrement.
     * @returns {Promise<NIndexedDBResponse>} Tableau d'éléments déchiffrés dans `res.data`.
     *
     * @example <caption>Exemple 1 : Obtenir tous les éléments d'un magasin</caption>
     * const res = await db.getAll('products');
     * console.log(`Nombre total de produits : ${res.data.length}`);
     *
     * @example <caption>Exemple 2 : Obtenir avec déchiffrement explicite</caption>
     * const res = await db.getAll('ntable', null, 50, { secretKey: 'custom_secret' });
     * console.log(res.data);
     */
    async getAll(storeName, query, count, options = {}) {
        let q = query;
        let cnt = count;
        let opts = options;

        if (this.#isOptionsObject(count)) {
            opts = count;
            cnt = undefined;
        } else if (this.#isOptionsObject(query)) {
            opts = query;
            q = undefined;
            cnt = undefined;
        }

        return this.#executeStoreRequest(storeName, 'readonly', (store) => {
            return q !== undefined || cnt !== undefined
                ? store.getAll(q, cnt)
                : store.getAll();
        }, (result, store) => {
            if (!Array.isArray(result)) return result;
            return result.map((item) => this.#restoreRecordAfterRead(store, item, opts));
        });
    }

    /**
     * Récupère toutes les clés primaires d'un magasin avec restitution en clair des clés chiffrées.
     *
     * @async
     * @method getAllKeys
     * @param {string} storeName - Nom du magasin.
     * @param {IDBKeyRange|IDBValidKey|NIndexedDBOptions} [query] - Plage de filtrage OU options.
     * @param {number|NIndexedDBOptions} [count] - Nombre maximal de clés OU options.
     * @param {NIndexedDBOptions} [options={}] - Options.
     * @returns {Promise<NIndexedDBResponse>} Tableau des clés déchiffrées dans `res.data`.
     *
     * @example <caption>Exemple 1 : Lister tous les IDs disponibles</caption>
     * const res = await db.getAllKeys('products');
     * console.log('IDs des produits :', res.data);
     *
     * @example <caption>Exemple 2 : Lister les clés d'un store sécurisé</caption>
     * const res = await db.getAllKeys('ntable');
     * console.log('Clés en clair :', res.data);
     */
    async getAllKeys(storeName, query, count, options = {}) {
        let q = query;
        let cnt = count;
        let opts = options;

        if (this.#isOptionsObject(count)) {
            opts = count;
            cnt = undefined;
        } else if (this.#isOptionsObject(query)) {
            opts = query;
            q = undefined;
            cnt = undefined;
        }

        const secretKey = this.#getEffectiveSecretKey(opts?.secretKey);

        return this.#executeStoreRequest(storeName, 'readonly', (store) => {
            return q !== undefined || cnt !== undefined
                ? store.getAllKeys(q, cnt)
                : store.getAllKeys();
        }, (result) => {
            if (!Array.isArray(result)) return result;
            return result.map((k) => (this.#isEncryptedKey(k) ? this.#decryptKey(k, secretKey) : k));
        });
    }

    /**
     * Supprime un élément par sa clé primaire (gère les clés chiffrées).
     *
     * @async
     * @method delete
     * @param {string} storeName - Nom du magasin.
     * @param {IDBValidKey|IDBKeyRange} key - Clé de l'élément à supprimer.
     * @param {NIndexedDBOptions} [options={}] - Options de chiffrement de la clé.
     * @returns {Promise<NIndexedDBResponse>} `res.ok` à true si la suppression s'est déroulée sans erreur.
     *
     * @example <caption>Exemple 1 : Supprimer un produit standard</caption>
     * const res = await db.delete('products', 15);
     * if (res.ok) console.log('Produit 15 supprimé');
     *
     * @example <caption>Exemple 2 : Supprimer une clé protégée</caption>
     * await db.delete('ntable', 'admin_pass', { encryptKey: true });
     */
    async delete(storeName, key, options = {}) {
        if (key === undefined || key === null) {
            return this.#fail('La clé à supprimer ne peut être nulle ou indéfinie.', 'IDB_INVALID_KEY');
        }

        const opts = options && typeof options === 'object' ? options : {};
        const shouldEncryptKey = opts.encryptKey ?? this.#encryptKey;
        const secretKey = this.#getEffectiveSecretKey(opts.secretKey);
        const targetKey = (shouldEncryptKey && !this.#isEncryptedKey(key))
            ? this.#encryptKey(String(key), secretKey)
            : key;

        return this.#executeStoreRequest(storeName, 'readwrite', (store) => {
            return store.delete(targetKey);
        });
    }

    /**
     * Vide intégralement un Object Store de tous ses enregistrements.
     *
     * @async
     * @method clear
     * @param {string} storeName - Nom du magasin à vider.
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Vider le store des logs</caption>
     * const res = await db.clear('logs');
     * console.log(res.ok ? 'Logs effacés' : res.error);
     *
     * @example <caption>Exemple 2 : Réinitialiser le cache local</caption>
     * await db.clear('http_cache');
     */
    async clear(storeName) {
        return this.#executeStoreRequest(storeName, 'readwrite', (store) => {
            return store.clear();
        });
    }

    /**
     * Compte le nombre d'éléments présents dans un magasin ou répondant à un critère de clé.
     *
     * @async
     * @method count
     * @param {string} storeName - Nom du magasin.
     * @param {IDBKeyRange|IDBValidKey} [query] - Plage ou clé de filtrage optionnelle.
     * @returns {Promise<NIndexedDBResponse>} Nombre total dans `res.data`.
     *
     * @example <caption>Exemple 1 : Compter tous les éléments d'une table</caption>
     * const res = await db.count('orders');
     * console.log(`Commandes totales : ${res.data}`);
     *
     * @example <caption>Exemple 2 : Compter avec filtre de clé</caption>
     * const res = await db.count('scores', IDBKeyRange.lowerBound(100));
     * console.log('Joueurs avec score >= 100 :', res.data);
     */
    async count(storeName, query) {
        return this.#executeStoreRequest(storeName, 'readonly', (store) => {
            return query !== undefined ? store.count(query) : store.count();
        });
    }

    // =========================================================================
    // Recherche par Index
    // =========================================================================

    /**
     * Récupère le premier élément correspondant à une valeur via un index secondaire.
     *
     * @async
     * @method getByIndex
     * @param {string} storeName - Nom du magasin.
     * @param {string} indexName - Nom de l'index configuré.
     * @param {any} key - Valeur recherchée sur l'index.
     * @param {NIndexedDBOptions} [options={}] - Options de déchiffrement.
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Rechercher un client par son adresse email</caption>
     * const res = await db.getByIndex('customers', 'by_email', 'client@test.com');
     * if (res.ok && res.data) console.log('Client trouvé :', res.data.name);
     *
     * @example <caption>Exemple 2 : Rechercher par code-barre</caption>
     * const res = await db.getByIndex('products', 'by_barcode', '1234567890123');
     */
    async getByIndex(storeName, indexName, key, options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        return this.#executeIndexRequest(storeName, indexName, (index) => {
            return index.get(key);
        }, (result, store) => {
            return this.#restoreRecordAfterRead(store, result, opts);
        });
    }

    /**
     * Récupère tous les éléments correspondant à une valeur ou plage via un index secondaire.
     *
     * @async
     * @method getAllByIndex
     * @param {string} storeName - Nom du magasin.
     * @param {string} indexName - Nom de l'index configuré.
     * @param {any} [query] - Valeur ou IDBKeyRange recherché.
     * @param {number|NIndexedDBOptions} [count] - Nombre maximal d'enregistrements OU options.
     * @param {NIndexedDBOptions} [options={}] - Options de déchiffrement.
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Trouver tous les articles d'une catégorie</caption>
     * const res = await db.getAllByIndex('products', 'by_category', 'boissons');
     * console.log('Boissons trouvées :', res.data);
     *
     * @example <caption>Exemple 2 : Récupérer les 20 dernières commandes par date</caption>
     * const res = await db.getAllByIndex('orders', 'by_date', null, 20);
     */
    async getAllByIndex(storeName, indexName, query, count, options = {}) {
        let q = query;
        let cnt = count;
        let opts = options;

        if (this.#isOptionsObject(count)) {
            opts = count;
            cnt = undefined;
        } else if (this.#isOptionsObject(query)) {
            opts = query;
            q = undefined;
            cnt = undefined;
        }

        return this.#executeIndexRequest(storeName, indexName, (index) => {
            return q !== undefined || cnt !== undefined
                ? index.getAll(q, cnt)
                : index.getAll();
        }, (result, store) => {
            if (!Array.isArray(result)) return result;
            return result.map((item) => this.#restoreRecordAfterRead(store, item, opts));
        });
    }

    /**
     * Récupère toutes les clés primaires correspondant à un critère sur un index secondaire.
     *
     * @async
     * @method getAllKeysByIndex
     * @param {string} storeName - Nom du magasin.
     * @param {string} indexName - Nom de l'index.
     * @param {any} [query] - Valeur ou plage.
     * @param {number|NIndexedDBOptions} [count] - Limite de résultats OU options.
     * @param {NIndexedDBOptions} [options={}] - Options.
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Obtenir les IDs de commandes validées</caption>
     * const res = await db.getAllKeysByIndex('orders', 'by_status', 'completed');
     * console.log('IDs commandes terminées :', res.data);
     *
     * @example <caption>Exemple 2 : Avec limite de 10 clés</caption>
     * const res = await db.getAllKeysByIndex('users', 'by_role', 'admin', 10);
     */
    async getAllKeysByIndex(storeName, indexName, query, count, options = {}) {
        let q = query;
        let cnt = count;
        let opts = options;

        if (this.#isOptionsObject(count)) {
            opts = count;
            cnt = undefined;
        } else if (this.#isOptionsObject(query)) {
            opts = query;
            q = undefined;
            cnt = undefined;
        }

        const secretKey = this.#getEffectiveSecretKey(opts?.secretKey);

        return this.#executeIndexRequest(storeName, indexName, (index) => {
            return q !== undefined || cnt !== undefined
                ? index.getAllKeys(q, cnt)
                : index.getAllKeys();
        }, (result) => {
            if (!Array.isArray(result)) return result;
            return result.map((k) => (this.#isEncryptedKey(k) ? this.#decryptKey(k, secretKey) : k));
        });
    }

    /**
     * Compte les enregistrements correspondant à un critère d'index.
     *
     * @async
     * @method countByIndex
     * @param {string} storeName - Nom du magasin.
     * @param {string} indexName - Nom de l'index.
     * @param {any} [query] - Valeur ou plage ciblée.
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Compter le nombre de produits en rupture de stock</caption>
     * const res = await db.countByIndex('products', 'by_status', 'out_of_stock');
     * console.log('Ruptures de stock :', res.data);
     *
     * @example <caption>Exemple 2 : Compter les commandes d'une date spécifique</caption>
     * const res = await db.countByIndex('orders', 'by_date', '2026-11-12');
     */
    async countByIndex(storeName, indexName, query) {
        return this.#executeIndexRequest(storeName, indexName, (index) => {
            return query !== undefined ? index.count(query) : index.count();
        });
    }

    // =========================================================================
    // Opérations par Lots (Batch)
    // =========================================================================

    /**
     * Insère ou met à jour plusieurs éléments dans une seule transaction `readwrite` performante.
     * Garantit l'atomicité du lot et prend en charge le chiffrement paramétré.
     *
     * @async
     * @method putMany
     * @param {string} storeName - Nom du magasin.
     * @param {Array<any>} items - Liste des éléments à insérer/mettre à jour.
     * @param {NIndexedDBOptions} [options={}] - Options de chiffrement pour le lot.
     * @returns {Promise<NIndexedDBResponse>} `res.data` contient le nombre d'éléments enregistrés avec succès.
     *
     * @example <caption>Exemple 1 : Insertion par lot de 500 articles</caption>
     * const articles = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
     * const res = await db.putMany('products', articles);
     * console.log(`${res.data} articles enregistrés`);
     *
     * @example <caption>Exemple 2 : Enregistrement par lot sécurisé avec cryptage des données</caption>
     * const items = [{ id: 1, sec: 'data1' }, { id: 2, sec: 'data2' }];
     * await db.putMany('ntable', items, { encryptData: true });
     */
    async putMany(storeName, items, options = {}) {
        if (!Array.isArray(items)) {
            return this.#fail('Le paramètre items doit être un tableau.', 'IDB_INVALID_ITEMS');
        }
        if (items.length === 0) {
            return this.#success(0);
        }
        if (typeof storeName !== 'string' || !storeName.trim()) {
            return this.#fail('Le nom de l\'Object Store doit être une chaîne non vide.', 'IDB_INVALID_STORE_NAME');
        }

        try {
            const db = await this.#ensureConnection();
            if (!db) {
                return this.#fail('IndexedDB n\'est pas supporté ou accessible dans cet environnement.', 'IDB_NOT_SUPPORTED');
            }

            if (!db.objectStoreNames.contains(storeName)) {
                return this.#fail(`L'Object Store "${storeName}" n'existe pas dans la base "${this.#name}".`, 'IDB_STORE_NOT_FOUND');
            }

            return new Promise((resolve) => {
                let tx;
                try {
                    tx = db.transaction(storeName, 'readwrite');
                } catch (txErr) {
                    return resolve(this.#fail(txErr, 'IDB_TRANSACTION_CREATE_ERROR'));
                }

                let count = 0;
                let hasAborted = false;

                tx.oncomplete = () => {
                    resolve(this.#success(count));
                };

                tx.onerror = () => {
                    resolve(this.#fail(tx.error || 'Erreur lors de l\'enregistrement par lot.', 'IDB_BATCH_ERROR'));
                };

                tx.onabort = () => {
                    resolve(this.#fail(tx.error || 'Transaction batch annulée.', 'IDB_BATCH_ABORTED'));
                };

                try {
                    const store = tx.objectStore(storeName);
                    for (const item of items) {
                        if (hasAborted) break;
                        const prepared = this.#prepareRecordForWrite(store, item, undefined, options);
                        const req = prepared.key !== undefined
                            ? store.put(prepared.value, prepared.key)
                            : store.put(prepared.value);

                        req.onsuccess = () => {
                            count++;
                        };
                        req.onerror = () => {
                            hasAborted = true;
                        };
                    }
                } catch (putErr) {
                    try {
                        tx.abort();
                    } catch {
                        // Ignore
                    }
                    resolve(this.#fail(putErr, 'IDB_BATCH_ERROR'));
                }
            });
        } catch (err) {
            return this.#fail(err, 'IDB_BATCH_ERROR');
        }
    }

    /**
     * Supprime plusieurs éléments par leurs clés dans une seule transaction `readwrite`.
     *
     * @async
     * @method deleteMany
     * @param {string} storeName - Nom du magasin.
     * @param {Array<IDBValidKey>} keys - Liste des clés à supprimer.
     * @param {NIndexedDBOptions} [options={}] - Options de chiffrement de clé.
     * @returns {Promise<NIndexedDBResponse>} `res.data` contient le nombre d'éléments supprimés.
     *
     * @example <caption>Exemple 1 : Supprimer une sélection de produits</caption>
     * const res = await db.deleteMany('products', [1, 2, 5, 8]);
     * console.log('Nombre de suppressions :', res.data);
     *
     * @example <caption>Exemple 2 : Purge de clés de session</caption>
     * await db.deleteMany('sessions', ['sess_1', 'sess_2']);
     */
    async deleteMany(storeName, keys, options = {}) {
        if (!Array.isArray(keys)) {
            return this.#fail('Le paramètre keys doit être un tableau.', 'IDB_INVALID_KEYS');
        }
        if (keys.length === 0) {
            return this.#success(0);
        }
        if (typeof storeName !== 'string' || !storeName.trim()) {
            return this.#fail('Le nom de l\'Object Store doit être une chaîne non vide.', 'IDB_INVALID_STORE_NAME');
        }

        const opts = options && typeof options === 'object' ? options : {};
        const shouldEncryptKey = opts.encryptKey ?? this.#encryptKey;
        const secretKey = this.#getEffectiveSecretKey(opts.secretKey);

        try {
            const db = await this.#ensureConnection();
            if (!db) {
                return this.#fail('IndexedDB n\'est pas supporté ou accessible dans cet environnement.', 'IDB_NOT_SUPPORTED');
            }

            if (!db.objectStoreNames.contains(storeName)) {
                return this.#fail(`L'Object Store "${storeName}" n'existe pas dans la base "${this.#name}".`, 'IDB_STORE_NOT_FOUND');
            }

            return new Promise((resolve) => {
                let tx;
                try {
                    tx = db.transaction(storeName, 'readwrite');
                } catch (txErr) {
                    return resolve(this.#fail(txErr, 'IDB_TRANSACTION_CREATE_ERROR'));
                }

                let count = 0;

                tx.oncomplete = () => {
                    resolve(this.#success(count));
                };

                tx.onerror = () => {
                    resolve(this.#fail(tx.error || 'Erreur lors de la suppression par lot.', 'IDB_DELETE_BATCH_ERROR'));
                };

                tx.onabort = () => {
                    resolve(this.#fail(tx.error || 'Transaction deleteMany annulée.', 'IDB_DELETE_BATCH_ABORTED'));
                };

                try {
                    const store = tx.objectStore(storeName);
                    for (const key of keys) {
                        const targetKey = (shouldEncryptKey && !this.#isEncryptedKey(key))
                            ? this.#encryptKey(String(key), secretKey)
                            : key;
                        const req = store.delete(targetKey);
                        req.onsuccess = () => {
                            count++;
                        };
                    }
                } catch (delErr) {
                    try {
                        tx.abort();
                    } catch {
                        // Ignore
                    }
                    resolve(this.#fail(delErr, 'IDB_DELETE_BATCH_ERROR'));
                }
            });
        } catch (err) {
            return this.#fail(err, 'IDB_DELETE_BATCH_ERROR');
        }
    }

    // =========================================================================
    // Parcours Avancé par Curseur (Cursor)
    // =========================================================================

    /**
     * Parcourt les éléments d'un magasin via un curseur avec restitution transparente des données déchiffrées.
     *
     * Points de robustesse :
     * - Gestion d'erreur protégée : toute exception dans le callback interrompt proprement la transaction (`tx.abort()`)
     *   et résout la promesse avec une structure d'erreur standard sans bloquer le thread.
     * - Arrêt anticipé : si le callback retourne explicitement `false`, le parcours s'arrête immédiatement.
     * - Prise en charge des callbacks asynchrones (Promesses) : attend la fin de la promesse avant de poursuivre (`cursor.continue()`),
     *   respectant le cycle d'activité d'IndexedDB.
     * - Déchiffrement transparent : les clés et données transmises au callback sont automatiquement déchiffrées.
     *
     * @async
     * @method cursor
     * @param {string} storeName - Nom du magasin.
     * @param {Function} callback - Fonction appelée pour chaque élément `(value, key, cursor) => boolean|Promise<boolean|void>|void`.
     *   Retourner `false` (ou résoudre `false`) arrête prématurément le parcours.
     * @param {Object} [options={}] - Options complémentaires (query, direction, mode, secretKey, encryptKey).
     * @param {IDBKeyRange|IDBValidKey} [options.query] - Plage de filtrage.
     * @param {'next'|'nextunique'|'prev'|'prevunique'} [options.direction='next'] - Sens de parcours.
     * @param {'readonly'|'readwrite'} [options.mode='readonly'] - Mode de transaction.
     * @param {string} [options.secretKey=''] - Clé secrète de déchiffrement.
     * @returns {Promise<NIndexedDBResponse>} Retourne le nombre d'éléments visités dans `res.data`.
     *
     * @example <caption>Exemple 1 : Parcourir et afficher tous les éléments déchiffrés</caption>
     * await db.cursor('products', (product) => {
     *     console.log(product.id, product.name);
     * });
     *
     * @example <caption>Exemple 2 : Arrêter le curseur dès qu'une condition est remplie</caption>
     * await db.cursor('logs', (log, key) => {
     *     if (log.level === 'critical') {
     *         console.log('Erreur critique trouvée :', log);
     *         return false; // Stoppe immédiatement le parcours
     *     }
     * }, { direction: 'prev' });
     */
    async cursor(storeName, callback, options = {}) {
        if (typeof callback !== 'function') {
            return this.#fail('NIndexedDB.cursor : le callback doit être une fonction.', 'IDB_INVALID_CALLBACK');
        }
        if (typeof storeName !== 'string' || !storeName.trim()) {
            return this.#fail('Le nom de l\'Object Store doit être une chaîne non vide.', 'IDB_INVALID_STORE_NAME');
        }

        try {
            const db = await this.#ensureConnection();
            if (!db) {
                return this.#fail('IndexedDB n\'est pas supporté ou accessible dans cet environnement.', 'IDB_NOT_SUPPORTED');
            }

            if (!db.objectStoreNames.contains(storeName)) {
                return this.#fail(`L'Object Store "${storeName}" n'existe pas dans la base "${this.#name}".`, 'IDB_STORE_NOT_FOUND');
            }

            const mode = options.mode === 'readwrite' ? 'readwrite' : 'readonly';
            const direction = options.direction || 'next';
            const query = options.query;
            const secretKey = this.#getEffectiveSecretKey(options.secretKey);

            return new Promise((resolve) => {
                let tx;
                try {
                    tx = db.transaction(storeName, mode);
                } catch (txErr) {
                    return resolve(this.#fail(txErr, 'IDB_TRANSACTION_CREATE_ERROR'));
                }

                let visitedCount = 0;
                let isStopped = false;
                let hasFinished = false;

                const finish = (result) => {
                    if (!hasFinished) {
                        hasFinished = true;
                        resolve(result);
                    }
                };

                tx.oncomplete = () => {
                    finish(this.#success(visitedCount));
                };

                tx.onerror = () => {
                    finish(this.#fail(tx.error || 'Erreur lors du parcours par curseur.', 'IDB_CURSOR_ERROR'));
                };

                tx.onabort = () => {
                    finish(this.#fail(tx.error || 'Parcours par curseur interrompu.', 'IDB_CURSOR_ABORTED'));
                };

                try {
                    const store = tx.objectStore(storeName);
                    const req = query !== undefined ? store.openCursor(query, direction) : store.openCursor(null, direction);

                    req.onsuccess = (event) => {
                        if (isStopped) {
                            return finish(this.#success(visitedCount));
                        }

                        const cursorInstance = event.target.result;
                        if (!cursorInstance) {
                            return finish(this.#success(visitedCount));
                        }

                        visitedCount++;

                        const rawKey = cursorInstance.key;
                        const rawVal = cursorInstance.value;
                        const clearKey = this.#isEncryptedKey(rawKey) ? this.#decryptKey(rawKey, secretKey) : rawKey;
                        const clearVal = this.#restoreRecordAfterRead(store, rawVal, options);

                        let stepResult;
                        try {
                            stepResult = callback(clearVal, clearKey, cursorInstance);
                        } catch (callbackErr) {
                            try {
                                tx.abort();
                            } catch {
                                // Ignore
                            }
                            return finish(this.#fail(callbackErr, 'IDB_CURSOR_CALLBACK_ERROR'));
                        }

                        // Support des callbacks asynchrones (Promesses)
                        if (stepResult && typeof stepResult.then === 'function') {
                            stepResult
                                .then((asyncRes) => {
                                    if (asyncRes === false) {
                                        isStopped = true;
                                        return finish(this.#success(visitedCount));
                                    }
                                    try {
                                        cursorInstance.continue();
                                    } catch (continueErr) {
                                        finish(this.#fail(continueErr, 'IDB_CURSOR_CONTINUE_ERROR'));
                                    }
                                })
                                .catch((asyncErr) => {
                                    try {
                                        tx.abort();
                                    } catch {
                                        // Ignore
                                    }
                                    finish(this.#fail(asyncErr, 'IDB_CURSOR_CALLBACK_ERROR'));
                                });
                        } else {
                            // Callback synchrone
                            if (stepResult === false) {
                                isStopped = true;
                                return finish(this.#success(visitedCount));
                            }

                            try {
                                cursorInstance.continue();
                            } catch (continueErr) {
                                finish(this.#fail(continueErr, 'IDB_CURSOR_CONTINUE_ERROR'));
                            }
                        }
                    };

                    req.onerror = () => {
                        finish(this.#fail(req.error || 'Erreur de requête lors de l\'ouverture du curseur.', 'IDB_CURSOR_REQUEST_ERROR'));
                    };
                } catch (reqErr) {
                    try {
                        tx.abort();
                    } catch {
                        // Ignore
                    }
                    finish(this.#fail(reqErr, 'IDB_CURSOR_ERROR'));
                }
            });
        } catch (connErr) {
            return this.#fail(connErr, 'IDB_CONNECTION_ERROR');
        }
    }

    // =========================================================================
    // Méthodes Internes Privées de Chiffrement et Transformation
    // =========================================================================

    /**
     * Vérifie si un argument correspond à un objet d'options de chiffrement NIndexedDB.
     * @private
     * @param {any} val - Objet à analyser.
     * @returns {boolean}
     */
    #isOptionsObject(val) {
        if (!val || typeof val !== 'object' || Array.isArray(val) || val instanceof Date) {
            return false;
        }
        return val.encryptKey !== undefined || val.encryptData !== undefined || val.secretKey !== undefined;
    }

    /**
     * Retourne la clé secrète effective (surcharge passée en paramètre, clé d'instance ou clé par défaut).
     * @private
     * @param {string} [customSecret] - Clé secrète ponctuelle optionnelle.
     * @returns {string} Clé secrète résolue.
     */
    #getEffectiveSecretKey(customSecret) {
        if (typeof customSecret === 'string' && customSecret.trim()) {
            return customSecret.trim();
        }
        if (this.#secretKey) {
            return this.#secretKey;
        }
        return '__nlib_default_indexeddb_secret__';
    }

    /**
     * Vérifie si une chaîne représente une clé chiffrée NIndexedDB (`enck:...`).
     * @private
     * @param {any} key - Clé à tester.
     * @returns {boolean}
     */
    #isEncryptedKey(key) {
        return typeof key === 'string' && key.startsWith('enck:');
    }

    /**
     * Chiffre une clé de manière déterministe et réversible.
     * Permet la recherche directe en O(1) sans scanner l'espace de stockage.
     *
     * @private
     * @param {string} plainKey - Clé en clair.
     * @param {string} secretKey - Clé secrète.
     * @returns {string} Clé chiffrée préfixée (`enck:...`).
     */
    #encryptKey(plainKey, secretKey) {
        if (this.#isEncryptedKey(plainKey)) {
            return plainKey;
        }
        const keyBytes = this.#utf8Encode(String(plainKey));
        const keyMaterial = this.#sha256Bytes(this.#utf8Encode(secretKey));
        const ivMaterial = this.#sha256Bytes(this.#utf8Encode(`${plainKey}:${secretKey}`)).slice(0, 16);
        const cipherBytes = this.#streamCipher(keyBytes, keyMaterial, ivMaterial);

        const combined = new Uint8Array(16 + cipherBytes.length);
        combined.set(ivMaterial, 0);
        combined.set(cipherBytes, 16);

        return `enck:${this.#bytesToBase64(combined)}`;
    }

    /**
     * Déchiffre une clé chiffrée pour restituer son nom en clair.
     *
     * @private
     * @param {string} encryptedKey - Clé chiffrée (`enck:...`).
     * @param {string} secretKey - Clé secrète.
     * @returns {string} Nom de clé en clair.
     */
    #decryptKey(encryptedKey, secretKey) {
        if (!this.#isEncryptedKey(encryptedKey)) {
            return encryptedKey;
        }
        try {
            const rawBase64 = encryptedKey.slice(5);
            const combined = this.#base64ToBytes(rawBase64);
            if (combined.length <= 16) {
                return encryptedKey;
            }

            const iv = combined.slice(0, 16);
            const cipherBytes = combined.slice(16);
            const keyMaterial = this.#sha256Bytes(this.#utf8Encode(secretKey));
            const plainBytes = this.#streamCipher(cipherBytes, keyMaterial, iv);

            return this.#utf8Decode(plainBytes);
        } catch {
            return encryptedKey;
        }
    }

    /**
     * Chiffre une valeur quelconque avec un IV aléatoire de 16 octets.
     *
     * @private
     * @param {any} value - Valeur à protéger.
     * @param {string} secretKey - Clé secrète.
     * @returns {string} Chaîne chiffrée Base64 préfixée (`encd:...`).
     */
    #encryptData(value, secretKey) {
        const jsonStr = JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
        const dataBytes = this.#utf8Encode(jsonStr);
        const keyMaterial = this.#sha256Bytes(this.#utf8Encode(secretKey));
        const iv = this.#randomBytes(16);

        const cipherBytes = this.#streamCipher(dataBytes, keyMaterial, iv);
        const combined = new Uint8Array(16 + cipherBytes.length);
        combined.set(iv, 0);
        combined.set(cipherBytes, 16);

        return `encd:${this.#bytesToBase64(combined)}`;
    }

    /**
     * Déchiffre une chaîne chiffrée `encd:...` et parse son JSON.
     *
     * @private
     * @param {string} encryptedString - Donnée chiffrée.
     * @param {string} secretKey - Clé secrète.
     * @returns {any} Donnée originale déchiffrée et typée.
     */
    #decryptData(encryptedString, secretKey) {
        if (typeof encryptedString !== 'string' || !encryptedString.startsWith('encd:')) {
            return encryptedString;
        }
        try {
            const rawBase64 = encryptedString.slice(5);
            const combined = this.#base64ToBytes(rawBase64);
            if (combined.length <= 16) {
                return null;
            }

            const iv = combined.slice(0, 16);
            const cipherBytes = combined.slice(16);
            const keyMaterial = this.#sha256Bytes(this.#utf8Encode(secretKey));
            const plainBytes = this.#streamCipher(cipherBytes, keyMaterial, iv);
            const jsonStr = this.#utf8Decode(plainBytes);

            return JSON.parse(jsonStr);
        } catch (err) {
            NUtil.log.warn('NIndexedDB : Échec du déchiffrement de la donnée.', {
                code: 'WARN_IDB_DECRYPT_FAILED',
                error: err
            });
            return null;
        }
    }

    /**
     * Prépare un enregistrement et sa clé pour l'insertion en appliquant les règles de chiffrement.
     * Gère avec précision les stores avec clé interne (`keyPath`) ou avec clé externe (`explicitKey`).
     *
     * @private
     * @param {IDBObjectStore} store - Store cible.
     * @param {any} value - Valeur à écrire.
     * @param {IDBValidKey} [explicitKey] - Clé explicite pour store sans keyPath.
     * @param {NIndexedDBOptions} [options={}] - Options de chiffrement.
     * @returns {{ value: any, key: any }} Objet prêt pour store.put ou store.add.
     */
    #prepareRecordForWrite(store, value, explicitKey, options = {}) {
        const shouldEncryptKey = options.encryptKey ?? this.#encryptKey;
        const shouldEncryptData = options.encryptData ?? this.#encryptData;
        const secretKey = this.#getEffectiveSecretKey(options.secretKey);

        const hasKeyPath = Boolean(store && store.keyPath);

        // Cas 1 : Store sans keyPath (clé externe)
        if (!hasKeyPath) {
            let finalKey = explicitKey;
            if (shouldEncryptKey && explicitKey !== undefined && explicitKey !== null) {
                finalKey = this.#encryptKey(String(explicitKey), secretKey);
            }

            let finalValue = value;
            if (shouldEncryptData) {
                finalValue = {
                    __nlib_encrypted__: true,
                    __payload__: this.#encryptData(value, secretKey)
                };
            }

            return { value: finalValue, key: finalKey };
        }

        // Cas 2 : Store avec keyPath (clé interne in-line, ex: 'id')
        const keyPath = store.keyPath;
        if (typeof keyPath === 'string') {
            const rawPk = (value && typeof value === 'object') ? value[keyPath] : explicitKey;
            let finalPk = rawPk;

            if (shouldEncryptKey && rawPk !== undefined && rawPk !== null) {
                finalPk = this.#encryptKey(String(rawPk), secretKey);
            }

            if (shouldEncryptData) {
                const encryptedPayload = this.#encryptData(value, secretKey);
                const record = {
                    __nlib_encrypted__: true,
                    __payload__: encryptedPayload
                };
                if (finalPk !== undefined) {
                    record[keyPath] = finalPk;
                }
                return { value: record, key: undefined };
            }

            if (shouldEncryptKey && value && typeof value === 'object') {
                const record = { ...value, [keyPath]: finalPk };
                return { value: record, key: undefined };
            }
        }

        return { value, key: explicitKey };
    }

    /**
     * Restaure un enregistrement lu depuis IndexedDB en le déchiffrant si nécessaire.
     * Rétrocompatible : retourne la donnée telle quelle si elle n'est pas chiffrée.
     *
     * @private
     * @param {IDBObjectStore} store - Store source.
     * @param {any} record - Enregistrement brut extrait d'IndexedDB.
     * @param {NIndexedDBOptions} [options={}] - Options de déchiffrement.
     * @returns {any} Donnée en clair restaurée.
     */
    #restoreRecordAfterRead(store, record, options = {}) {
        if (record === null || record === undefined) {
            return record;
        }

        const secretKey = this.#getEffectiveSecretKey(options?.secretKey);

        // A. Donnée enveloppée dans un payload chiffré
        if (record && typeof record === 'object' && record.__nlib_encrypted__ === true && typeof record.__payload__ === 'string') {
            const decrypted = this.#decryptData(record.__payload__, secretKey);
            if (decrypted && typeof decrypted === 'object' && store && typeof store.keyPath === 'string') {
                const kp = store.keyPath;
                // Si la clé dans l'enveloppe était chiffrée, veiller à ce que la clé de l'objet soit en clair
                if (this.#isEncryptedKey(record[kp])) {
                    decrypted[kp] = this.#decryptKey(record[kp], secretKey);
                }
            }
            return decrypted;
        }

        // B. Enregistrement avec clé seule chiffrée (sans payload crypté)
        if (record && typeof record === 'object' && store && typeof store.keyPath === 'string') {
            const kp = store.keyPath;
            if (this.#isEncryptedKey(record[kp])) {
                const clearPk = this.#decryptKey(record[kp], secretKey);
                return { ...record, [kp]: clearPk };
            }
        }

        return record;
    }

    /**
     * Chiffrement par flot synchrone symétrique (KSA/PRGA 256 bits avec IV) en pur JS.
     * @private
     */
    #streamCipher(dataBytes, keyBytes, ivBytes) {
        const combined = new Uint8Array(keyBytes.length + ivBytes.length);
        combined.set(keyBytes, 0);
        combined.set(ivBytes, keyBytes.length);
        const derivedKey = this.#sha256Bytes(combined);

        const S = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            S[i] = i;
        }
        let j = 0;
        for (let i = 0; i < 256; i++) {
            j = (j + S[i] + derivedKey[i % derivedKey.length]) & 0xff;
            const tmp = S[i];
            S[i] = S[j];
            S[j] = tmp;
        }

        const result = new Uint8Array(dataBytes.length);
        let x = 0;
        let y = 0;
        for (let k = 0; k < dataBytes.length; k++) {
            x = (x + 1) & 0xff;
            y = (y + S[x]) & 0xff;
            const tmp = S[x];
            S[x] = S[y];
            S[y] = tmp;
            const rnd = S[(S[x] + S[y]) & 0xff];
            result[k] = dataBytes[k] ^ rnd;
        }
        return result;
    }

    /**
     * Hachage SHA-256 synchrone pur JS retournant un Uint8Array de 32 octets.
     * @private
     */
    #sha256Bytes(messageBytes) {
        const K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];

        let h0 = 0x6a09e667;
        let h1 = 0xbb67ae85;
        let h2 = 0x3c6ef372;
        let h3 = 0xa54ff53a;
        let h4 = 0x510e527f;
        let h5 = 0x9b05688c;
        let h6 = 0x1f83d9ab;
        let h7 = 0x5be0cd19;

        const bitLength = messageBytes.length * 8;
        const paddedLength = Math.ceil((messageBytes.length + 9) / 64) * 64;
        const padded = new Uint8Array(paddedLength);
        padded.set(messageBytes);
        padded[messageBytes.length] = 0x80;

        const view = new DataView(padded.buffer);
        view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
        view.setUint32(paddedLength - 4, bitLength >>> 0, false);

        const W = new Uint32Array(64);
        const rotr = (n, x) => (x >>> n) | (x << (32 - n));

        for (let offset = 0; offset < paddedLength; offset += 64) {
            for (let i = 0; i < 16; i++) {
                W[i] = view.getUint32(offset + i * 4, false);
            }
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
                const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
                W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
            }

            let a = h0;
            let b = h1;
            let c = h2;
            let d = h3;
            let e = h4;
            let f = h5;
            let g = h6;
            let h = h7;

            for (let i = 0; i < 64; i++) {
                const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
                const ch = (e & f) ^ (~e & g);
                const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
                const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (S0 + maj) >>> 0;

                h = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }

            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
            h5 = (h5 + f) >>> 0;
            h6 = (h6 + g) >>> 0;
            h7 = (h7 + h) >>> 0;
        }

        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        outView.setUint32(0, h0, false);
        outView.setUint32(4, h1, false);
        outView.setUint32(8, h2, false);
        outView.setUint32(12, h3, false);
        outView.setUint32(16, h4, false);
        outView.setUint32(20, h5, false);
        outView.setUint32(24, h6, false);
        outView.setUint32(28, h7, false);

        return out;
    }

    /**
     * Génère des octets aléatoires cryptographiques sécurisés.
     * @private
     */
    #randomBytes(length) {
        const bytes = new Uint8Array(length);
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < length; i++) {
                bytes[i] = Math.floor(Math.random() * 256);
            }
        }
        return bytes;
    }

    /**
     * Encode une chaîne UTF-8 en Uint8Array.
     * @private
     */
    #utf8Encode(str) {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(str);
        }
        const utf8 = unescape(encodeURIComponent(str));
        const arr = new Uint8Array(utf8.length);
        for (let i = 0; i < utf8.length; i++) {
            arr[i] = utf8.charCodeAt(i);
        }
        return arr;
    }

    /**
     * Décode un Uint8Array en chaîne UTF-8.
     * @private
     */
    #utf8Decode(bytes) {
        if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder().decode(bytes);
        }
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return decodeURIComponent(escape(binary));
    }

    /**
     * Encode un Uint8Array en chaîne Base64 sûre.
     * @private
     */
    #bytesToBase64(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64');
        }
        let binary = '';
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Décode une chaîne Base64 en Uint8Array.
     * @private
     */
    #base64ToBytes(base64) {
        if (typeof Buffer !== 'undefined') {
            return new Uint8Array(Buffer.from(base64, 'base64'));
        }
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // =========================================================================
    // Méthodes Internes Privées IndexedDB
    // =========================================================================

    /**
     * Garantit qu'une connexion IndexedDB ouverte et valide est disponible.
     * Déduplique strictement les appels simultanés et gère les montées de versions.
     * @private
     * @returns {Promise<IDBDatabase>}
     */
    async #ensureConnection() {
        if (this.#db) {
            return this.#db;
        }

        if (this.#openingPromise) {
            return this.#openingPromise;
        }

        if (typeof indexedDB === 'undefined') {
            NUtil.log.warn('NIndexedDB : IndexedDB n\'est pas supporté dans cet environnement.', {
                code: 'IDB_NOT_SUPPORTED',
                database: this.#name
            });
            return null;
        }

        this.#openingPromise = new Promise((resolve) => {
            let request;
            try {
                request = indexedDB.open(this.#name, this.#version);
            } catch (err) {
                this.#openingPromise = null;
                NUtil.log.error(`NIndexedDB : Échec de l'appel à indexedDB.open() pour "${this.#name}"`, err);
                return resolve(null);
            }

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const transaction = event.target.transaction;
                this.#handleUpgrade(db, transaction, event.oldVersion, event.newVersion);
            };

            request.onsuccess = (event) => {
                this.#db = event.target.result;
                this.#openingPromise = null;

                // Si la connexion est fermée inopinément par le navigateur ou le système
                this.#db.onclose = () => {
                    this.#db = null;
                };

                // Si un autre contexte (onglet ou worker) réclame une montée de version
                this.#db.onversionchange = () => {
                    if (this.#db) {
                        try {
                            this.#db.close();
                        } catch {
                            // Ignore
                        }
                        this.#db = null;
                    }
                };

                resolve(this.#db);
            };

            request.onerror = () => {
                this.#openingPromise = null;
                const error = request.error || new Error('Erreur inconnue lors de l\'ouverture IndexedDB.');
                NUtil.log.error(`NIndexedDB : Erreur d'ouverture de la base "${this.#name}"`, error);
                resolve(null);
            };

            request.onblocked = () => {
                this.#openingPromise = null;
                NUtil.log.warn(`NIndexedDB : Ouverture de la base "${this.#name}" bloquée : fermez les autres onglets ou connexions actives pour permettre la mise à niveau.`);
                resolve(null);
            };
        });

        return this.#openingPromise;
    }

    /**
     * Applique la création et l'évolution des Object Stores et de leurs index lors de la transaction 'versionchange'.
     *
     * @private
     * @param {IDBDatabase} db - Instance de la base en cours de montée de version.
     * @param {IDBTransaction} transaction - Transaction de versionchange active.
     * @param {number} _oldVersion - Ancienne version de la base.
     * @param {number} _newVersion - Nouvelle version de la base.
     */
    #handleUpgrade(db, transaction, _oldVersion, _newVersion) {
        // 1. Structure standard par défaut si aucun magasin n'a été spécifié
        if (!Array.isArray(this.#stores) || this.#stores.length === 0) {
            if (!db.objectStoreNames.contains('ntable')) {
                const defaultStore = db.createObjectStore('ntable', { keyPath: 'id', autoIncrement: false });
                defaultStore.createIndex('data', 'data', { unique: false });
            }
            if (!db.objectStoreNames.contains('default')) {
                db.createObjectStore('default', { keyPath: 'id', autoIncrement: true });
            }
            return;
        }

        // 2. Traitement de la liste déclarative des Object Stores
        for (const storeConfig of this.#stores) {
            if (!storeConfig || typeof storeConfig !== 'object' || !storeConfig.name) continue;

            let store = null;

            // A. Le store n'existe pas encore : création
            if (!db.objectStoreNames.contains(storeConfig.name)) {
                const storeOptions = {};
                if (storeConfig.keyPath !== undefined) {
                    storeOptions.keyPath = storeConfig.keyPath;
                }
                if (storeConfig.autoIncrement !== undefined) {
                    storeOptions.autoIncrement = Boolean(storeConfig.autoIncrement);
                }
                store = db.createObjectStore(storeConfig.name, storeOptions);
            } else {
                // B. Le store existe déjà : récupération via la transaction versionchange
                try {
                    store = transaction.objectStore(storeConfig.name);
                } catch {
                    store = null;
                }
            }

            // C. Gestion des index pour ce magasin
            if (store && Array.isArray(storeConfig.indexes)) {
                for (const idx of storeConfig.indexes) {
                    if (!idx || typeof idx !== 'object' || !idx.name || !idx.keyPath) continue;

                    const indexOptions = {
                        unique: Boolean(idx.unique),
                        multiEntry: Boolean(idx.multiEntry)
                    };

                    if (store.indexNames.contains(idx.name)) {
                        // Vérifier si la définition a changé
                        const existingIndex = store.index(idx.name);
                        const keyPathChanged = String(existingIndex.keyPath) !== String(idx.keyPath);
                        const uniqueChanged = Boolean(existingIndex.unique) !== indexOptions.unique;
                        const multiEntryChanged = Boolean(existingIndex.multiEntry) !== indexOptions.multiEntry;

                        if (keyPathChanged || uniqueChanged || multiEntryChanged) {
                            store.deleteIndex(idx.name);
                            store.createIndex(idx.name, idx.keyPath, indexOptions);
                        }
                    } else {
                        // Nouvel index à créer
                        store.createIndex(idx.name, idx.keyPath, indexOptions);
                    }
                }
            }
        }
    }

    /**
     * Exécute une opération sur un Object Store dans une transaction isolée et sécurisée.
     * En mode `readwrite`, la résolution définitive de la promesse est conditionnée à `tx.oncomplete`.
     *
     * @private
     * @param {string} storeName - Nom du magasin cible.
     * @param {'readonly'|'readwrite'} mode - Mode de transaction.
     * @param {Function} callback - Callback recevant l'objet `IDBObjectStore`.
     * @param {Function} [transformResult=null] - Transformateur de résultat optionnel (ex: déchiffrement).
     * @returns {Promise<NIndexedDBResponse>}
     */
    async #executeStoreRequest(storeName, mode, callback, transformResult = null) {
        if (typeof storeName !== 'string' || !storeName.trim()) {
            return this.#fail('Le nom de l\'Object Store doit être une chaîne non vide.', 'IDB_INVALID_STORE_NAME');
        }

        try {
            const db = await this.#ensureConnection();
            if (!db) {
                return this.#fail('IndexedDB n\'est pas supporté ou accessible dans cet environnement.', 'IDB_NOT_SUPPORTED');
            }

            if (!db.objectStoreNames.contains(storeName)) {
                return this.#fail(`L'Object Store "${storeName}" n'existe pas dans la base "${this.#name}".`, 'IDB_STORE_NOT_FOUND');
            }

            return new Promise((resolve) => {
                let tx;
                try {
                    tx = db.transaction(storeName, mode);
                } catch (txErr) {
                    return resolve(this.#fail(txErr, 'IDB_TRANSACTION_CREATE_ERROR'));
                }

                let reqResult = undefined;
                let hasFinished = false;

                const finish = (result) => {
                    if (!hasFinished) {
                        hasFinished = true;
                        resolve(result);
                    }
                };

                tx.oncomplete = () => {
                    const finalData = typeof transformResult === 'function' ? transformResult(reqResult, tx.objectStore(storeName)) : reqResult;
                    finish(this.#success(finalData));
                };

                tx.onerror = () => {
                    finish(this.#fail(tx.error || 'Erreur lors de l\'exécution de la transaction.', 'IDB_TRANSACTION_ERROR'));
                };

                tx.onabort = () => {
                    finish(this.#fail(tx.error || 'Transaction interrompue (aborted).', 'IDB_TRANSACTION_ABORTED'));
                };

                try {
                    const store = tx.objectStore(storeName);
                    const req = callback(store, tx);

                    if (req && typeof req === 'object' && 'onsuccess' in req) {
                        req.onsuccess = () => {
                            reqResult = req.result;
                            if (mode === 'readonly') {
                                const finalData = typeof transformResult === 'function' ? transformResult(reqResult, store) : reqResult;
                                finish(this.#success(finalData));
                            }
                        };

                        req.onerror = () => {
                            // Remonte automatiquement sur tx.onerror
                        };
                    } else {
                        reqResult = req;
                        if (mode === 'readonly') {
                            const finalData = typeof transformResult === 'function' ? transformResult(reqResult, store) : reqResult;
                            finish(this.#success(finalData));
                        }
                    }
                } catch (callbackErr) {
                    try {
                        tx.abort();
                    } catch {
                        // Ignore
                    }
                    finish(this.#fail(callbackErr, 'IDB_OPERATION_ERROR'));
                }
            });
        } catch (connErr) {
            return this.#fail(connErr, 'IDB_CONNECTION_ERROR');
        }
    }

    /**
     * Exécute une opération sur un index d'un Object Store en mode lecture seule.
     *
     * @private
     * @param {string} storeName - Nom du magasin cible.
     * @param {string} indexName - Nom de l'index cible.
     * @param {Function} callback - Callback recevant l'objet `IDBIndex`.
     * @param {Function} [transformResult=null] - Transformateur de résultat optionnel.
     * @returns {Promise<NIndexedDBResponse>}
     */
    async #executeIndexRequest(storeName, indexName, callback, transformResult = null) {
        if (typeof storeName !== 'string' || !storeName.trim()) {
            return this.#fail('Le nom de l\'Object Store doit être une chaîne non vide.', 'IDB_INVALID_STORE_NAME');
        }
        if (typeof indexName !== 'string' || !indexName.trim()) {
            return this.#fail('Le nom de l\'index doit être une chaîne non vide.', 'IDB_INVALID_INDEX_NAME');
        }

        try {
            const db = await this.#ensureConnection();
            if (!db) {
                return this.#fail('IndexedDB n\'est pas supporté ou accessible dans cet environnement.', 'IDB_NOT_SUPPORTED');
            }

            if (!db.objectStoreNames.contains(storeName)) {
                return this.#fail(`L'Object Store "${storeName}" n'existe pas dans la base "${this.#name}".`, 'IDB_STORE_NOT_FOUND');
            }

            return new Promise((resolve) => {
                let tx;
                try {
                    tx = db.transaction(storeName, 'readonly');
                } catch (txErr) {
                    return resolve(this.#fail(txErr, 'IDB_TRANSACTION_CREATE_ERROR'));
                }

                let hasFinished = false;

                const finish = (result) => {
                    if (!hasFinished) {
                        hasFinished = true;
                        resolve(result);
                    }
                };

                tx.onerror = () => {
                    finish(this.#fail(tx.error || 'Erreur lors de l\'interrogation de l\'index.', 'IDB_INDEX_ERROR'));
                };

                tx.onabort = () => {
                    finish(this.#fail(tx.error || 'Transaction sur index interrompue.', 'IDB_INDEX_ABORTED'));
                };

                try {
                    const store = tx.objectStore(storeName);

                    if (!store.indexNames.contains(indexName)) {
                        return finish(this.#fail(`L'index "${indexName}" n'existe pas dans le store "${storeName}".`, 'IDB_INDEX_NOT_FOUND'));
                    }

                    const index = store.index(indexName);
                    const req = callback(index);

                    req.onsuccess = () => {
                        let res = req.result !== undefined ? req.result : null;
                        if (typeof transformResult === 'function') {
                            res = transformResult(res, store);
                        }
                        finish(this.#success(res));
                    };

                    req.onerror = () => {
                        finish(this.#fail(req.error || 'Erreur de requête sur index.', 'IDB_INDEX_REQUEST_ERROR'));
                    };
                } catch (err) {
                    finish(this.#fail(err, 'IDB_INDEX_OPERATION_ERROR'));
                }
            });
        } catch (connErr) {
            return this.#fail(connErr, 'IDB_CONNECTION_ERROR');
        }
    }

    /**
     * Formate une réponse réussie standardisée.
     * @private
     * @param {any} data - Données du résultat.
     * @returns {NIndexedDBResponse}
     */
    #success(data) {
        return {
            ok: true,
            data: data !== undefined ? data : null,
            error: null,
            code: null
        };
    }

    /**
     * Formate une réponse d'erreur standardisée sans lever d'exception.
     * @private
     * @param {any} error - Message ou objet d'erreur.
     * @param {string} [code='IDB_ERROR'] - Code machine standardisé.
     * @returns {NIndexedDBResponse}
     */
    #fail(error, code = 'IDB_ERROR') {
        let msg = 'Une erreur IndexedDB est survenue.';
        if (typeof error === 'string') {
            msg = error;
        } else if (error && error.message) {
            msg = error.message;
        } else if (error && error.name) {
            msg = error.name;
        }

        return {
            ok: false,
            data: null,
            error: msg,
            code
        };
    }
}

export default NIndexedDB;
