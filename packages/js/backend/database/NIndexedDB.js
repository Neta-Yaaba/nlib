/**
 * @file NIndexedDB.js
 * @package @nlib/js-backend
 * @description Wrapper universel, asynchrone et résilient pour IndexedDB dans l'écosystème NLib.
 * Fournit une interface fluide et unifiée (CRUD, transactions, index, curseurs, batch)
 * avec gestion d'erreurs intégrée : l'utilisateur reçoit toujours un objet standardisé
 * `{ ok: boolean, data: any, error?: string, code?: string }` sans plantage inattendu.
 *
 * Conforme aux standards NLib : instanciable pour gérer de multiples bases dans la même application,
 * sans héritage de NObject, avec initialisation paresseuse de la connexion.
 */

import { NException } from '../core/NException.js';

/**
 * Format standard de retour de toutes les opérations NIndexedDB.
 * Garantit que l'appelant reçoit toujours une structure prévisible.
 *
 * @typedef {Object} NIndexedDBResponse
 * @property {boolean} ok - Indique si l'opération a réussi.
 * @property {any} [data=null] - Les données retournées par l'opération (élément, liste, clé, count, etc.).
 * @property {string|null} [error=null] - Message d'erreur explicite en cas d'échec.
 * @property {string|null} [code=null] - Code d'erreur machine standardisé (ex: 'IDB_NOT_FOUND', 'IDB_UNSUPPORTED').
 */

/**
 * @class NIndexedDB
 * @description Gestionnaire asynchrone IndexedDB résilient.
 *
 * @example <caption>Exemple 1 : Ouvrir une base et insérer des enregistrements</caption>
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
 * @example <caption>Exemple 2 : Récupérer des éléments via get, getAll ou un index</caption>
 * const getRes = await db.get('products', 1);
 * if (getRes.ok && getRes.data) {
 *     console.log('Produit trouvé :', getRes.data.name);
 * }
 * const catRes = await db.getAllByIndex('products', 'by_category', 'boulangerie');
 * console.log('Produits boulangerie :', catRes.data);
 *
 * @example <caption>Exemple 3 : Mise à jour (put), suppression (delete) et comptage (count)</caption>
 * await db.put('products', { id: 1, name: 'Baguette Dorée', price: 200 });
 * const countRes = await db.count('products');
 * console.log('Total produits :', countRes.data);
 * await db.delete('products', 1);
 */
export class NIndexedDB {

    // =========================================================================
    // Propriétés privées (Allocation paresseuse)
    // =========================================================================

    /**
     * Nom de la base de données.
     * @type {string}
     * @private
     */
    #name = 'nlib_db';

    /**
     * Version du schéma IndexedDB.
     * @type {number}
     * @private
     */
    #version = 1;

    /**
     * Définition des Object Stores à initialiser ou faire évoluer.
     * @type {Array<Object>|null}
     * @private
     */
    #stores = null;

    /**
     * Instance native IDBDatabase ouverte.
     * @type {IDBDatabase|null}
     * @private
     */
    #db = null;

    /**
     * Promesse de connexion en cours pour éviter les ouvertures simultanées (deduplication).
     * @type {Promise<IDBDatabase>|null}
     * @private
     */
    #openingPromise = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une instance de NIndexedDB.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration de la base.
     * @param {string} [options.name='nlib_db'] - Nom de la base IndexedDB.
     * @param {number} [options.version=1] - Version du schéma.
     * @param {Array<Object>} [options.stores=[]] - Déclaration des magasins (stores) et leurs index.
     *
     * @example <caption>Exemple 1 : Instanciation simple avec store par défaut</caption>
     * const idb = new NIndexedDB({ name: 'my_app' });
     *
     * @example <caption>Exemple 2 : Configuration complète avec index</caption>
     * const idb = new NIndexedDB({
     *     name: 'pos_local',
     *     version: 2,
     *     stores: [
     *         { name: 'orders', keyPath: 'orderId', indexes: [{ name: 'by_date', keyPath: 'createdAt' }] }
     *     ]
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
     * @example <caption>Exemple 2 : Affichage d'état</caption>
     * console.log(`Base active : ${db.name}`);
     */
    get name() {
        return this.#name;
    }

    /**
     * Retourne la version du schéma de la base.
     * @type {number}
     *
     * @example <caption>Exemple 1 : Consulter la version</caption>
     * console.log(db.version); // 1
     *
     * @example <caption>Exemple 2 : Vérification conditionnelle</caption>
     * if (db.version > 1) { console.log('Schéma mis à niveau'); }
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
     * @type {string[]}
     *
     * @example <caption>Exemple 1 : Lister les stores existants</caption>
     * console.log(db.storeNames); // ['products', 'customers', 'orders']
     *
     * @example <caption>Exemple 2 : Vérifier la présence d'un store</caption>
     * if (db.storeNames.includes('cache')) { console.log('Store de cache présent'); }
     */
    get storeNames() {
        if (!this.#db) return [];
        return Array.from(this.#db.objectStoreNames);
    }

    // =========================================================================
    // Cycle de Vie de la Base (open, close, deleteDatabase)
    // =========================================================================

    /**
     * Ouvre la connexion à la base IndexedDB (exécuté automatiquement de manière transparente par toutes les méthodes CRUD).
     *
     * @async
     * @method open
     * @returns {Promise<NIndexedDBResponse>} Structure standardisée contenant l'instance IDBDatabase dans `data`.
     *
     * @example <caption>Exemple 1 : Ouverture manuelle anticipée</caption>
     * const res = await db.open();
     * if (res.ok) console.log('Base prête !');
     *
     * @example <caption>Exemple 2 : Gestion d'erreur sans crash</caption>
     * const res = await db.open();
     * if (!res.ok) console.error('Impossible d ouvrir IndexedDB :', res.error);
     */
    async open() {
        try {
            const dbInstance = await this.#ensureConnection();
            return this.#success(dbInstance);
        } catch (err) {
            return this.#fail(err, 'IDB_OPEN_ERROR');
        }
    }

    /**
     * Ferme proprement la connexion à la base IndexedDB si elle est ouverte.
     *
     * @method close
     * @returns {NIndexedDBResponse}
     *
     * @example <caption>Exemple 1 : Fermer la connexion</caption>
     * db.close();
     *
     * @example <caption>Exemple 2 : Fermeture avant changement de session</caption>
     * const res = db.close();
     * console.log(res.ok); // true
     */
    close() {
        try {
            if (this.#db) {
                this.#db.close();
                this.#db = null;
            }
            this.#openingPromise = null;
            return this.#success(true);
        } catch (err) {
            return this.#fail(err, 'IDB_CLOSE_ERROR');
        }
    }

    /**
     * Supprime définitivement la base IndexedDB entière.
     *
     * @async
     * @method deleteDatabase
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Réinitialiser la base locale</caption>
     * const res = await db.deleteDatabase();
     * if (res.ok) console.log('Base supprimée avec succès');
     *
     * @example <caption>Exemple 2 : Nettoyage avant réinstallation</caption>
     * await db.deleteDatabase();
     */
    async deleteDatabase() {
        this.close();

        if (typeof indexedDB === 'undefined') {
            return this.#fail('IndexedDB non supporté dans cet environnement.', 'IDB_UNSUPPORTED');
        }

        return new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(this.#name);

            req.onsuccess = () => {
                resolve(this.#success(true));
            };

            req.onerror = () => {
                resolve(this.#fail(req.error, 'IDB_DELETE_DB_ERROR'));
            };

            req.onblocked = () => {
                resolve(this.#fail('Suppression bloquée : fermez les autres onglets ou connexions actives.', 'IDB_BLOCKED'));
            };
        });
    }

    // =========================================================================
    // Opérations CRUD (Create, Read, Update, Delete)
    // =========================================================================

    /**
     * Ajoute un nouvel élément dans un Object Store (échoue si la clé existe déjà, contrairement à `put`).
     *
     * @async
     * @method add
     * @param {string} storeName - Nom du magasin de stockage.
     * @param {any} value - Données de l'objet à insérer.
     * @param {IDBValidKey} [key] - Clé explicite (si le store n'utilise pas de keyPath dans l'objet).
     * @returns {Promise<NIndexedDBResponse>} Retourne la clé générée ou assignée dans `res.data`.
     *
     * @example <caption>Exemple 1 : Ajouter un objet avec identifiant auto-généré</caption>
     * const res = await db.add('customers', { name: 'Jean Dupont', email: 'jean@example.com' });
     * console.log('Clé générée :', res.data);
     *
     * @example <caption>Exemple 2 : Ajouter avec une clé personnalisée</caption>
     * const res = await db.add('settings', { value: 'dark' }, 'theme');
     * if (!res.ok) console.warn('Échec ajout :', res.error);
     */
    async add(storeName, value, key) {
        return this.#executeStoreRequest(storeName, 'readwrite', (store) => {
            return key !== undefined ? store.add(value, key) : store.add(value);
        });
    }

    /**
     * Insère ou met à jour un élément (écrase la donnée si la clé existe déjà).
     *
     * @async
     * @method put
     * @param {string} storeName - Nom du magasin de stockage.
     * @param {any} value - Données de l'objet à enregistrer.
     * @param {IDBValidKey} [key] - Clé explicite (si le store n'utilise pas de keyPath dans l'objet).
     * @returns {Promise<NIndexedDBResponse>} Retourne la clé de l'élément dans `res.data`.
     *
     * @example <caption>Exemple 1 : Mettre à jour un produit existant</caption>
     * const res = await db.put('products', { id: 10, name: 'Café Espresso', price: 500 });
     * console.log('Enregistré avec la clé :', res.data);
     *
     * @example <caption>Exemple 2 : Enregistrer une préférence</caption>
     * const res = await db.put('settings', 'fr-FR', 'app_lang');
     */
    async put(storeName, value, key) {
        return this.#executeStoreRequest(storeName, 'readwrite', (store) => {
            return key !== undefined ? store.put(value, key) : store.put(value);
        });
    }

    /**
     * Récupère un élément par sa clé primaire.
     *
     * @async
     * @method get
     * @param {string} storeName - Nom du magasin.
     * @param {IDBValidKey} key - Clé de l'élément recherché.
     * @returns {Promise<NIndexedDBResponse>} Contient l'objet trouvé dans `res.data` (ou `null` s'il n'existe pas).
     *
     * @example <caption>Exemple 1 : Récupérer un utilisateur par son identifiant numérique</caption>
     * const res = await db.get('users', 42);
     * if (res.ok && res.data) {
     *     console.log('Utilisateur :', res.data.username);
     * }
     *
     * @example <caption>Exemple 2 : Récupérer un paramètre par clé texte</caption>
     * const res = await db.get('settings', 'theme');
     * console.log('Thème actuel :', res.data);
     */
    async get(storeName, key) {
        const res = await this.#executeStoreRequest(storeName, 'readonly', (store) => {
            return store.get(key);
        });
        if (res.ok && res.data === undefined) {
            res.data = null;
        }
        return res;
    }

    /**
     * Récupère tous les éléments d'un magasin (avec support optionnel de limite et de plage de clés).
     *
     * @async
     * @method getAll
     * @param {string} storeName - Nom du magasin.
     * @param {IDBKeyRange|IDBValidKey} [query] - Plage ou clé spécifique de filtrage.
     * @param {number} [count] - Nombre maximal d'éléments à retourner.
     * @returns {Promise<NIndexedDBResponse>} Tableau d'éléments dans `res.data`.
     *
     * @example <caption>Exemple 1 : Obtenir tous les éléments d'un magasin</caption>
     * const res = await db.getAll('products');
     * console.log(`Nombre total de produits : ${res.data.length}`);
     *
     * @example <caption>Exemple 2 : Obtenir au maximum les 10 premiers éléments</caption>
     * const res = await db.getAll('logs', null, 10);
     * console.log(res.data);
     */
    async getAll(storeName, query, count) {
        return this.#executeStoreRequest(storeName, 'readonly', (store) => {
            return query !== undefined || count !== undefined
                ? store.getAll(query, count)
                : store.getAll();
        });
    }

    /**
     * Récupère toutes les clés primaires d'un magasin.
     *
     * @async
     * @method getAllKeys
     * @param {string} storeName - Nom du magasin.
     * @param {IDBKeyRange|IDBValidKey} [query] - Plage de filtrage.
     * @param {number} [count] - Nombre maximal de clés.
     * @returns {Promise<NIndexedDBResponse>} Tableau des clés dans `res.data`.
     *
     * @example <caption>Exemple 1 : Lister tous les IDs disponibles</caption>
     * const res = await db.getAllKeys('products');
     * console.log('IDs des produits :', res.data);
     *
     * @example <caption>Exemple 2 : Limiter aux 50 premières clés</caption>
     * const res = await db.getAllKeys('sessions', null, 50);
     */
    async getAllKeys(storeName, query, count) {
        return this.#executeStoreRequest(storeName, 'readonly', (store) => {
            return query !== undefined || count !== undefined
                ? store.getAllKeys(query, count)
                : store.getAllKeys();
        });
    }

    /**
     * Supprime un élément par sa clé primaire.
     *
     * @async
     * @method delete
     * @param {string} storeName - Nom du magasin.
     * @param {IDBValidKey|IDBKeyRange} key - Clé de l'élément à supprimer.
     * @returns {Promise<NIndexedDBResponse>} `res.ok` à true si la suppression s'est déroulée sans erreur.
     *
     * @example <caption>Exemple 1 : Supprimer un produit</caption>
     * const res = await db.delete('products', 15);
     * if (res.ok) console.log('Produit 15 supprimé');
     *
     * @example <caption>Exemple 2 : Supprimer une clé de configuration</caption>
     * await db.delete('settings', 'temporary_token');
     */
    async delete(storeName, key) {
        return this.#executeStoreRequest(storeName, 'readwrite', (store) => {
            return store.delete(key);
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
     * Compte le nombre d'éléments présents dans un magasin ou répondant à un critère.
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
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Rechercher un client par son adresse email</caption>
     * const res = await db.getByIndex('customers', 'by_email', 'client@test.com');
     * if (res.ok && res.data) console.log('Client trouvé :', res.data.name);
     *
     * @example <caption>Exemple 2 : Rechercher par code-barre</caption>
     * const res = await db.getByIndex('products', 'by_barcode', '1234567890123');
     */
    async getByIndex(storeName, indexName, key) {
        return this.#executeIndexRequest(storeName, indexName, (index) => {
            return index.get(key);
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
     * @param {number} [count] - Nombre maximal d'enregistrements.
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Trouver tous les articles d'une catégorie</caption>
     * const res = await db.getAllByIndex('products', 'by_category', 'boissons');
     * console.log('Boissons trouvées :', res.data);
     *
     * @example <caption>Exemple 2 : Récupérer les 20 dernières commandes par date</caption>
     * const res = await db.getAllByIndex('orders', 'by_date', null, 20);
     */
    async getAllByIndex(storeName, indexName, query, count) {
        return this.#executeIndexRequest(storeName, indexName, (index) => {
            return query !== undefined || count !== undefined
                ? index.getAll(query, count)
                : index.getAll();
        });
    }

    /**
     * Récupère toutes les clés primaires correspondant à un index secondaire.
     *
     * @async
     * @method getAllKeysByIndex
     * @param {string} storeName - Nom du magasin.
     * @param {string} indexName - Nom de l'index.
     * @param {any} [query] - Valeur ou plage.
     * @param {number} [count] - Limite de résultats.
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Obtenir les IDs de commandes validées</caption>
     * const res = await db.getAllKeysByIndex('orders', 'by_status', 'completed');
     * console.log('IDs commandes terminées :', res.data);
     *
     * @example <caption>Exemple 2 : Avec limite de 10 clés</caption>
     * const res = await db.getAllKeysByIndex('users', 'by_role', 'admin', 10);
     */
    async getAllKeysByIndex(storeName, indexName, query, count) {
        return this.#executeIndexRequest(storeName, indexName, (index) => {
            return query !== undefined || count !== undefined
                ? index.getAllKeys(query, count)
                : index.getAllKeys();
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
     * @example <caption>Exemple 2 : Compter les commandes d'une journée</caption>
     * const res = await db.countByIndex('orders', 'by_date', '2026-11-12');
     */
    async countByIndex(storeName, indexName, query) {
        return this.#executeIndexRequest(storeName, indexName, (index) => {
            return query !== undefined ? index.count(query) : index.count();
        });
    }

    // =========================================================================
    // Opérations par Lots (Batch) & Transactions
    // =========================================================================

    /**
     * Insère ou met à jour plusieurs éléments en une seule transaction performante.
     *
     * @async
     * @method putMany
     * @param {string} storeName - Nom du magasin.
     * @param {Array<any>} items - Liste des éléments à insérer/mettre à jour.
     * @returns {Promise<NIndexedDBResponse>} `res.data` contient le nombre d'éléments traités avec succès.
     *
     * @example <caption>Exemple 1 : Insertion par lot de 500 articles</caption>
     * const articles = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
     * const res = await db.putMany('products', articles);
     * console.log(`${res.data} articles enregistrés`);
     *
     * @example <caption>Exemple 2 : Synchronisation en masse de clients</caption>
     * const res = await db.putMany('customers', downloadedList);
     * if (res.ok) console.log('Synchronisation terminée !');
     */
    async putMany(storeName, items) {
        if (!Array.isArray(items)) {
            return this.#fail('Le paramètre items doit être un tableau.', 'IDB_INVALID_ITEMS');
        }

        try {
            const db = await this.#ensureConnection();
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                let count = 0;

                for (const item of items) {
                    store.put(item);
                    count++;
                }

                tx.oncomplete = () => {
                    resolve(this.#success(count));
                };

                tx.onerror = () => {
                    resolve(this.#fail(tx.error, 'IDB_BATCH_ERROR'));
                };

                tx.onabort = () => {
                    resolve(this.#fail('Transaction batch annulée.', 'IDB_BATCH_ABORTED'));
                };
            });
        } catch (err) {
            return this.#fail(err, 'IDB_BATCH_ERROR');
        }
    }

    /**
     * Supprime plusieurs éléments par leurs clés en une seule transaction.
     *
     * @async
     * @method deleteMany
     * @param {string} storeName - Nom du magasin.
     * @param {Array<IDBValidKey>} keys - Liste des clés à supprimer.
     * @returns {Promise<NIndexedDBResponse>}
     *
     * @example <caption>Exemple 1 : Supprimer une sélection de produits</caption>
     * const res = await db.deleteMany('products', [1, 2, 5, 8]);
     * console.log('Nombre de suppressions :', res.data);
     *
     * @example <caption>Exemple 2 : Purge de clés de session</caption>
     * await db.deleteMany('sessions', ['sess_1', 'sess_2']);
     */
    async deleteMany(storeName, keys) {
        if (!Array.isArray(keys)) {
            return this.#fail('Le paramètre keys doit être un tableau.', 'IDB_INVALID_KEYS');
        }

        try {
            const db = await this.#ensureConnection();
            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                let count = 0;

                for (const key of keys) {
                    store.delete(key);
                    count++;
                }

                tx.oncomplete = () => {
                    resolve(this.#success(count));
                };

                tx.onerror = () => {
                    resolve(this.#fail(tx.error, 'IDB_DELETE_BATCH_ERROR'));
                };
            });
        } catch (err) {
            return this.#fail(err, 'IDB_DELETE_BATCH_ERROR');
        }
    }

    /**
     * Parcourt les éléments d'un magasin via un curseur avec une fonction de rappel par ligne.
     *
     * @async
     * @method cursor
     * @param {string} storeName - Nom du magasin.
     * @param {Function} callback - Fonction appelée pour chaque élément `(value, key, cursor) => boolean|void`.
     *   Retourner `false` arrête prématurément le parcours.
     * @param {Object} [options={}] - Options complémentaires (query, direction, mode).
     * @param {IDBKeyRange|IDBValidKey} [options.query] - Plage de filtrage.
     * @param {'next'|'nextunique'|'prev'|'prevunique'} [options.direction='next'] - Sens de parcours.
     * @param {'readonly'|'readwrite'} [options.mode='readonly'] - Mode de transaction.
     * @returns {Promise<NIndexedDBResponse>} Retourne le nombre d'éléments visités dans `res.data`.
     *
     * @example <caption>Exemple 1 : Parcourir et afficher tous les éléments</caption>
     * await db.cursor('products', (product) => {
     *     console.log(product.id, product.name);
     * });
     *
     * @example <caption>Exemple 2 : Arrêter le curseur dès qu'une condition est remplie</caption>
     * await db.cursor('logs', (log, key, cursor) => {
     *     if (log.level === 'critical') {
     *         console.log('Erreur critique trouvée :', log);
     *         return false; // Stoppe le parcours
     *     }
     * }, { direction: 'prev' });
     */
    async cursor(storeName, callback, options = {}) {
        if (typeof callback !== 'function') {
            return this.#fail('NIndexedDB.cursor : le callback doit être une fonction.', 'IDB_INVALID_CALLBACK');
        }

        try {
            const db = await this.#ensureConnection();
            const mode = options.mode === 'readwrite' ? 'readwrite' : 'readonly';
            const direction = options.direction || 'next';
            const query = options.query;

            return new Promise((resolve) => {
                const tx = db.transaction(storeName, mode);
                const store = tx.objectStore(storeName);
                const req = query !== undefined ? store.openCursor(query, direction) : store.openCursor(null, direction);
                let visitedCount = 0;

                req.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        visitedCount++;
                        const shouldContinue = callback(cursor.value, cursor.key, cursor);
                        if (shouldContinue === false) {
                            resolve(this.#success(visitedCount));
                            return;
                        }
                        cursor.continue();
                    } else {
                        resolve(this.#success(visitedCount));
                    }
                };

                req.onerror = () => {
                    resolve(this.#fail(req.error, 'IDB_CURSOR_ERROR'));
                };
            });
        } catch (err) {
            return this.#fail(err, 'IDB_CURSOR_ERROR');
        }
    }

    // =========================================================================
    // Méthodes Internes Privées
    // =========================================================================

    /**
     * Garantit qu'une connexion IndexedDB ouverte et valide est disponible.
     * Gère automatiquement les montées de versions et la création des stores/indexes.
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
            throw new NException('IndexedDB n\'est pas supporté dans cet environnement.', {
                code: 'IDB_NOT_SUPPORTED'
            });
        }

        this.#openingPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.#name, this.#version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.#handleUpgrade(db, event.oldVersion, event.newVersion);
            };

            request.onsuccess = (event) => {
                this.#db = event.target.result;
                this.#openingPromise = null;

                // Si la connexion est fermée par le navigateur de manière inattendue
                this.#db.onclose = () => {
                    this.#db = null;
                };

                // Si une autre page demande une montée de version
                this.#db.onversionchange = () => {
                    if (this.#db) {
                        this.#db.close();
                        this.#db = null;
                    }
                };

                resolve(this.#db);
            };

            request.onerror = () => {
                this.#openingPromise = null;
                reject(request.error || new Error('Erreur inconnue lors de l\'ouverture IndexedDB.'));
            };

            request.onblocked = () => {
                this.#openingPromise = null;
                reject(new Error('Ouverture IndexedDB bloquée : d\'autres connexions empêchent la mise à niveau.'));
            };
        });

        return this.#openingPromise;
    }

    /**
     * Applique la création des stores et index lors de l'événement onupgradeneeded.
     * @private
     */
    #handleUpgrade(db, oldVersion, newVersion) {
        if (!Array.isArray(this.#stores)) {
            // Création automatique d'un store par défaut si aucun store spécifié
            if (!db.objectStoreNames.contains('default')) {
                db.createObjectStore('default', { keyPath: 'id', autoIncrement: true });
            }
            return;
        }

        for (const storeConfig of this.#stores) {
            if (!storeConfig || !storeConfig.name) continue;

            let store = null;
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
                // Store existant, on le récupère via la transaction de mise à niveau
                // pour éventuellement ajouter de nouveaux index
                // Note : store accessible via db.transaction de l'événement
            }

            // Création des index déclarés
            if (store && Array.isArray(storeConfig.indexes)) {
                for (const idx of storeConfig.indexes) {
                    if (idx && idx.name && idx.keyPath && !store.indexNames.contains(idx.name)) {
                        store.createIndex(idx.name, idx.keyPath, {
                            unique: Boolean(idx.unique),
                            multiEntry: Boolean(idx.multiEntry)
                        });
                    }
                }
            }
        }
    }

    /**
     * Exécute une opération sur un Object Store dans une transaction isolée.
     * @private
     */
    async #executeStoreRequest(storeName, mode, callback) {
        try {
            const db = await this.#ensureConnection();

            if (!db.objectStoreNames.contains(storeName)) {
                return this.#fail(`L'Object Store "${storeName}" n'existe pas dans la base "${this.#name}".`, 'IDB_STORE_NOT_FOUND');
            }

            return new Promise((resolve) => {
                const tx = db.transaction(storeName, mode);
                const store = tx.objectStore(storeName);
                const req = callback(store);

                req.onsuccess = () => {
                    resolve(this.#success(req.result));
                };

                req.onerror = () => {
                    resolve(this.#fail(req.error, 'IDB_REQUEST_ERROR'));
                };
            });
        } catch (err) {
            return this.#fail(err, 'IDB_EXECUTION_ERROR');
        }
    }

    /**
     * Exécute une opération sur un index d'un Object Store.
     * @private
     */
    async #executeIndexRequest(storeName, indexName, callback) {
        try {
            const db = await this.#ensureConnection();

            if (!db.objectStoreNames.contains(storeName)) {
                return this.#fail(`L'Object Store "${storeName}" n'existe pas dans la base "${this.#name}".`, 'IDB_STORE_NOT_FOUND');
            }

            return new Promise((resolve) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);

                if (!store.indexNames.contains(indexName)) {
                    return resolve(this.#fail(`L'index "${indexName}" n'existe pas dans le store "${storeName}".`, 'IDB_INDEX_NOT_FOUND'));
                }

                const index = store.index(indexName);
                const req = callback(index);

                req.onsuccess = () => {
                    resolve(this.#success(req.result));
                };

                req.onerror = () => {
                    resolve(this.#fail(req.error, 'IDB_INDEX_REQUEST_ERROR'));
                };
            });
        } catch (err) {
            return this.#fail(err, 'IDB_EXECUTION_ERROR');
        }
    }

    /**
     * Formate une réponse réussie.
     * @private
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


