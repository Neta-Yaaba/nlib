/**
 * @file NTableRequest.js
 * @package @nlib/js-backend
 * @description Gestionnaire intelligent et synchronisé de requêtes de données sur une table.
 * Coordonne la persistance locale (SQLite via `NSql` / `NDatabase`) et les appels réseau distants (`NNetwork` / `NRequest`),
 * avec gestion automatique du mode hors-ligne/en-ligne, synchronisation bidirectionnelle,
 * suivi des événements de synchronisation (`nevent`), recherche textuelle et pagination.
 *
 * Conforme aux standards NLib :
 * - Hérite de `NObject`
 * - Zéro variable hors classe
 * - Zéro import inutile
 * - Documentation JSDoc exhaustive en français (>= 3 @example classe, >= 2 @example méthodes/getters)
 */

import { NObject } from '../core/NObject.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * @class NTableRequest
 * @extends NObject
 * @description Fournit des méthodes complètes pour exécuter des requêtes de base de données locales
 * et synchronisées avec le serveur distant pour une table donnée.
 *
 * @example <caption>Exemple 1 : Instanciation et exécution d'une sélection unique</caption>
 * const tr = new NTableRequest({ table: 'users', primaryKey: 'id' });
 * const user = await tr.execute({
 *     type: 'GET',
 *     sql: 'SELECT * FROM users WHERE id = :id',
 *     params: { id: 1 }
 * });
 * console.log('Utilisateur :', user);
 *
 * @example <caption>Exemple 2 : Insertion de données locales avec drapeau de synchronisation</caption>
 * const tr = new NTableRequest({ table: 'products', primaryKey: 'id' });
 * const result = await tr.insertData({
 *     data: { name: 'Pain Artisanal', price: 200 }
 * });
 * console.log('Produit enregistré :', result);
 *
 * @example <caption>Exemple 3 : Génération de requêtes de recherche textuelle avec pondération</caption>
 * const tr = new NTableRequest({ table: 'articles' });
 * const searchClause = tr.generateSqlSearch('nlib cross-platform', ['title', 'description']);
 * console.log(searchClause.where, searchClause.order);
 */
export class NTableRequest extends NObject {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Instance de NRequest parente optionnelle assurant le pont d'état et de synchronisation.
     * @type {any}
     * @private
     */
    #request = null;

    /**
     * Nom de la table ciblée par cette instance.
     * @type {string}
     * @private
     */
    #table = '';

    /**
     * Clé primaire de la table ('id' par défaut).
     * @type {string}
     * @private
     */
    #primaryKey = 'id';

    /**
     * Instance de base de données associée (NSql ou NDatabase).
     * @type {any}
     * @private
     */
    #db = null;

    /**
     * Indicateur de synchronisation en cours pour éviter les déclenchements multiples.
     * @type {boolean}
     * @private
     */
    #isSyncing = false;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de NTableRequest.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration de la requête de table.
     * @param {any} [options.request] - Gestionnaire de requête parent `NRequest`.
     * @param {string} [options.table=''] - Nom de la table associée.
     * @param {string} [options.primaryKey='id'] - Nom de la colonne clé primaire.
     * @param {any} [options.db] - Instance explicite de base de données (utilise `NUtil.db.sql` par défaut).
     *
     * @example <caption>Exemple 1 : Instanciation avec nom de table et clé primaire</caption>
     * const tr = new NTableRequest({ table: 'clients', primaryKey: 'code_client' });
     *
     * @example <caption>Exemple 2 : Instanciation liée à un gestionnaire NRequest parent</caption>
     * const tr = new NTableRequest({ request: appRequest, table: 'orders' });
     */
    constructor(options = {}) {
        super();
        if (options && typeof options === 'object') {
            this.#request = options.request || null;
            this.#table = typeof options.table === 'string' ? options.table.trim() : '';
            this.#primaryKey = typeof options.primaryKey === 'string' && options.primaryKey.trim() ? options.primaryKey.trim() : 'id';
            this.#db = options.db || null;
        }
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    /**
     * Retourne le nom de la table gérée par cette instance.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Consulter le nom de la table</caption>
     * console.log(tr.table); // 'users'
     *
     * @example <caption>Exemple 2 : Utilisation dans un message de log</caption>
     * console.log(`Gestionnaire actif pour la table ${tr.table}`);
     */
    get table() {
        return this.#table;
    }

    /**
     * Définit le nom de la table.
     * @param {string} value - Nom de la table.
     *
     * @example <caption>Exemple 1 : Assigner une table</caption>
     * tr.table = 'products';
     *
     * @example <caption>Exemple 2 : Changement dynamique</caption>
     * if (!tr.table) tr.table = 'default_table';
     */
    set table(value) {
        if (typeof value === 'string') {
            this.#table = value.trim();
        }
    }

    /**
     * Retourne la clé primaire de la table.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire la clé primaire</caption>
     * console.log(tr.primaryKey); // 'id'
     *
     * @example <caption>Exemple 2 : Vérification conditionnelle</caption>
     * if (tr.primaryKey === 'uuid') { console.log('Clé de type UUID'); }
     */
    get primaryKey() {
        return this.#primaryKey;
    }

    /**
     * Définit la clé primaire.
     * @param {string} value - Nom de la clé primaire.
     *
     * @example <caption>Exemple 1 : Définir la clé primaire</caption>
     * tr.primaryKey = 'id_user';
     *
     * @example <caption>Exemple 2 : Clé personnalisée</caption>
     * tr.primaryKey = 'code';
     */
    set primaryKey(value) {
        if (typeof value === 'string' && value.trim()) {
            this.#primaryKey = value.trim();
        }
    }

    /**
     * Retourne le gestionnaire NRequest parent associé.
     * @type {any}
     *
     * @example <caption>Exemple 1 : Consulter la requête parente</caption>
     * console.log(tr.request);
     *
     * @example <caption>Exemple 2 : Tester si un parent est attaché</caption>
     * if (tr.request) { console.log('Requête liée à un gestionnaire global'); }
     */
    get request() {
        return this.#request;
    }

    /**
     * Retourne la base de données utilisée par cette instance (`NDatabase`).
     *
     * @type {any}
     *
     * @example <caption>Exemple 1 : Accéder à l'instance NDatabase sous-jacente</caption>
     * const database = tr.db;
     *
     * @example <caption>Exemple 2 : Exécuter une requête SQL via tr.db.sql</caption>
     * const count = await tr.db.sql.countRows(tr.table);
     */
    get db() {
        if (this.#db) return this.#db;
        if (this.#request && typeof this.#request.db === 'function') {
            return this.#request.db();
        }
        if (this.#request && this.#request.db) {
            return this.#request.db;
        }
        return NUtil.db;
    }

    // =========================================================================
    // Exécution Générale & Routage
    // =========================================================================

    /**
     * Extrait le type d'opération textuel depuis le paramètre `type`
     * (qui peut être une chaîne comme `'GET'` ou un objet comme `{ table: 'users', type: 'GET' }`).
     *
     * @private
     * @param {any} rawType - Valeur brute du type.
     * @returns {string} Nom normalisé de l'action en majuscules ('GET', 'GETS', 'INSERT', 'UPDATE', 'DELETE').
     */
    #resolveActionType(rawType) {
        if (!rawType) return 'GET';
        if (typeof rawType === 'object') {
            return String(rawType.type || 'GET').toUpperCase().trim();
        }
        return String(rawType).toUpperCase().trim();
    }

    /**
     * Exécute une action de base de données de manière polymorphe selon le paramètre `type`
     * ('GET', 'GETS', 'INSERT', 'UPDATE', 'DELETE', ou objet `{ table, type }`).
     *
     * @async
     * @method execute
     * @param {Object} req - Paramètres de la requête.
     * @param {string|{ table?: string, type?: string }} [req.type='GET'] - Type d'action (chaîne ou objet `{ table, type }`).
     * @returns {Promise<any>} Résultat de l'opération.
     *
     * @example <caption>Exemple 1 : Exécution avec type sous forme de chaîne</caption>
     * const user = await tr.execute({ type: 'GET', sql: 'SELECT * FROM users WHERE id = :id', params: { id: 1 } });
     *
     * @example <caption>Exemple 2 : Exécution avec type sous forme d'objet { table, type }</caption>
     * const res = await tr.execute({
     *     type: { table: 'products', type: 'INSERT' },
     *     data: { name: 'Pain de campagne', price: 250 }
     * });
     */
    async execute(req = {}) {
        const actionType = this.#resolveActionType(req.type);

        switch (actionType) {
            case 'GET':
                return this.getData(req);
            case 'GETS':
                return this.getDatas(req);
            case 'INSERT':
                return this.insertData(req);
            case 'UPDATE':
                return this.updateData(req);
            case 'DELETE':
                return this.deleteData(req);
            default:
                this.util.log.error(`NTableRequest.execute : type d'opération inconnu "${actionType}".`, {
                    code: 'UNKNOWN_OPERATION_TYPE',
                    req
                });
                return null;
        }
    }

    // =========================================================================
    // Sélections Unitaires & Multiples (GET & GETS)
    // =========================================================================

    /**
     * Exécute une requête de sélection pour un élément unique.
     * Tente une lecture locale SQL, ou interroge le réseau si non trouvé / expiré.
     *
     * @async
     * @method get
     * @param {Object} req - Paramètres de la requête.
     * @param {string} [req.sql] - Requête SQL directe.
     * @param {Array|Object} [req.params] - Paramètres de la requête SQL.
     * @param {boolean|number} [req.isLocalOnly] - Forcer l'exécution strictement locale sans appel réseau.
     * @returns {Promise<Object|null>} Objet de la ligne sélectionnée ou null.
     *
     * @example <caption>Exemple 1 : Sélection par ID</caption>
     * const row = await tr.get({ sql: 'SELECT * FROM users WHERE id = :id', params: { id: 1 } });
     *
     * @example <caption>Exemple 2 : Sélection strictement locale</caption>
     * const cached = await tr.get({ sql: 'SELECT * FROM settings WHERE key = :k', params: { k: 'theme' }, isLocalOnly: 1 });
     */
    async get(req = {}) {
        let result = null;
        const isLocalOnly = Boolean(req.isLocalOnly || req.N_REQUEST_LOCAL);
        const sql = req.sql || req.SQL;
        const params = req.params || req.PARAMS || {};
        const requestCode = req.requestCode || req.REQUESTCODE;

        // 1. Recherche locale SQL
        if (sql) {
            result = await this.db.sql.selectOne(sql, params);
            if (isLocalOnly || (result && result.n_local !== 1)) {
                return result;
            }
        }

        // 2. Si non trouvé ou à rafraîchir et que le mode en ligne est disponible
        if ((!result || !result[this.#primaryKey]) && this.#isOnline()) {
            try {
                const networkRes = await this.#fetchRemote(req, requestCode);
                if (networkRes && networkRes[this.#primaryKey]) {
                    networkRes.n_local = 1;
                    const existing = await this.db.sql.selectOne(
                        `SELECT * FROM \`${this.#table}\` WHERE \`${this.#primaryKey}\` = :id LIMIT 1`,
                        { id: networkRes[this.#primaryKey] }
                    );

                    if (existing && existing[this.#primaryKey]) {
                        await this.db.sql.update(
                            this.#table,
                            networkRes,
                            `\`${this.#primaryKey}\` = :id`,
                            { id: networkRes[this.#primaryKey] }
                        );
                    } else {
                        await this.db.sql.insert(this.#table, networkRes);
                    }
                    result = networkRes;
                }
            } catch (err) {
                this.util.log.warn(`NTableRequest.get : échec synchronisation réseau pour "${this.#table}".`, {
                    error: err?.message || String(err)
                });
            }
        }

        return result;
    }

    /**
     * Alias de la méthode `get`.
     *
     * @async
     * @method getData
     * @param {Object} req - Paramètres de la requête.
     * @returns {Promise<Object|null>}
     *
     * @example <caption>Exemple 1 : Récupérer des données</caption>
     * const item = await tr.getData({ sql: 'SELECT * FROM products WHERE id = 10' });
     *
     * @example <caption>Exemple 2 : Appel avec paramètres nommés</caption>
     * const item = await tr.getData({ sql: 'SELECT * FROM products WHERE code = :c', params: { c: 'REF-1' } });
     */
    async getData(req = {}) {
        return this.get(req);
    }

    /**
     * Récupère un enregistrement directement par sa valeur de clé primaire.
     *
     * @async
     * @method getDataByPrimaryKey
     * @param {any} primaryKeyValue - Valeur de la clé primaire.
     * @returns {Promise<Object|null>}
     *
     * @example <caption>Exemple 1 : Trouver un utilisateur par ID</caption>
     * const user = await tr.getDataByPrimaryKey(42);
     *
     * @example <caption>Exemple 2 : Trouver par code texte</caption>
     * const product = await tr.getDataByPrimaryKey('PRD-998');
     */
    async getDataByPrimaryKey(primaryKeyValue) {
        return this.get({
            sql: `SELECT * FROM \`${this.#table}\` WHERE \`${this.#primaryKey}\` = :id`,
            params: { id: primaryKeyValue },
            requestCode: `${this.#table}_${this.#primaryKey}_${primaryKeyValue}`
        });
    }

    /**
     * Exécute une sélection multiple de lignes avec gestion locale et synchronisation distante.
     *
     * @async
     * @method gets
     * @param {Object} req - Paramètres de la sélection.
     * @param {string} [req.sql] - Requête SQL de sélection.
     * @param {Array|Object} [req.params] - Paramètres de la requête SQL.
     * @param {string} [req.sqlCount] - Requête optionnelle pour compter les résultats totaux.
     * @param {boolean} [req.asList=false] - Si true, retourne les données sous forme vectorisée (selectAsList).
     * @returns {Promise<{ dataList: Array<Object>, countAll: number, totalRows: number, updated?: number }>}
     *
     * @example <caption>Exemple 1 : Lister des utilisateurs avec pagination</caption>
     * const res = await tr.gets({
     *     sql: 'SELECT * FROM users ORDER BY id DESC LIMIT 10 OFFSET 0'
     * });
     * console.log('Lignes reçues :', res.dataList.length, 'Total en base :', res.totalRows);
     *
     * @example <caption>Exemple 2 : Sélection sous forme de listes vectorisées</caption>
     * const res = await tr.gets({ sql: 'SELECT id, name FROM users', asList: true });
     */
    async gets(req = {}) {
        const result = { dataList: [], countAll: 0, totalRows: 0 };
        const isLocalOnly = Boolean(req.isLocalOnly || req.N_REQUEST_LOCAL);
        const sql = req.sql || req.SQL;
        const params = req.params || req.PARAMS || [];
        const asList = Boolean(req.asList || req.AsList);

        // 1. Tenter un rafraîchissement réseau si autorisé et connecté
        if (!isLocalOnly && this.#isOnline()) {
            try {
                const remote = await this.#fetchRemote(req);
                if (remote && Array.isArray(remote.dataList || remote.DATALIST || remote)) {
                    const list = remote.dataList || remote.DATALIST || remote;
                    result.dataList = list;
                    result.updated = 1;
                }
            } catch (err) {
                this.util.log.warn(`NTableRequest.gets : repli local après échec distant pour "${this.#table}".`, {
                    error: err?.message || String(err)
                });
            }
        }

        // 2. Si aucune donnée distante ou en mode local, lire la base SQL locale
        if (result.dataList.length === 0 && sql) {
            const rows = asList
                ? await this.db.sql.selectAsList(sql, params)
                : await this.db.sql.select(sql, params);

            result.dataList = rows || [];

            // Calcul du compte
            const sqlCount = req.sqlCount || req.SQLCOUNT || `SELECT COUNT(\`${this.#primaryKey}\`) AS countAll FROM \`${this.#table}\``;
            const countRow = await this.db.sql.selectOne(sqlCount, req.paramsCount || params);
            result.countAll = countRow ? Number(countRow.countAll || countRow.COUNTALL || 0) : result.dataList.length;

            result.totalRows = await this.db.sql.countRows(this.#table);
        }

        return result;
    }

    /**
     * Alias de la méthode `gets`.
     *
     * @async
     * @method getDatas
     * @param {Object} req - Paramètres de la sélection.
     * @returns {Promise<Object>}
     *
     * @example <caption>Exemple 1 : Obtenir une collection d'enregistrements</caption>
     * const rows = await tr.getDatas({ sql: 'SELECT * FROM products WHERE price > 100' });
     *
     * @example <caption>Exemple 2 : Avec paramètre nommé</caption>
     * const rows = await tr.getDatas({ sql: 'SELECT * FROM logs WHERE level = :lvl', params: { lvl: 'warn' } });
     */
    async getDatas(req = {}) {
        return this.gets(req);
    }

    // =========================================================================
    // Mutations (Insert, Update, Delete)
    // =========================================================================

    /**
     * Insère un nouvel enregistrement dans la table.
     * Gère l'écriture locale avec statut de synchronisation (`n_local = 2`) et déclenche
     * la synchronisation distante en tâche de fond si le réseau est disponible.
     *
     * @async
     * @method insert
     * @param {Object} req - Paramètres d'insertion.
     * @param {Object} req.data - Données à insérer.
     * @param {boolean} [req.isLocalOnly=false] - Forcer l'insertion uniquement locale.
     * @returns {Promise<Object|null>} Objet inséré contenant son nouvel ID.
     *
     * @example <caption>Exemple 1 : Insertion standard</caption>
     * const created = await tr.insert({ data: { name: 'Pain de campagne', price: 250 } });
     * console.log('Créé avec ID :', created.id);
     *
     * @example <caption>Exemple 2 : Insertion strictement locale</caption>
     * const localOnly = await tr.insert({ data: { name: 'Brouillon' }, isLocalOnly: true });
     */
    async insert(req = {}) {
        const data = req.data || req.DATA;
        if (!data || typeof data !== 'object') {
            this.util.log.error('NTableRequest.insert : le champ data est obligatoire.', {
                code: 'INVALID_DATA',
                req
            });
            return null;
        }

        const isLocalOnly = Boolean(req.isLocalOnly || req.N_REQUEST_LOCAL);
        const record = { ...data };

        // 1. Insertion locale
        record.n_local = 2; // Marqueur local en attente de synchro distante
        const insertedId = await this.db.sql.insert(this.#table, record);

        let finalRecord = null;
        if (insertedId) {
            finalRecord = await this.db.sql.selectOne(
                `SELECT * FROM \`${this.#table}\` WHERE \`${this.#primaryKey}\` = :id LIMIT 1`,
                { id: insertedId }
            );
        }

        // 2. Synchronisation distante immédiate si en ligne et non restreint
        if (!isLocalOnly && this.#isOnline()) {
            this.syncDatas().catch((err) => {
                this.util.log.warn(`NTableRequest.insert : échec de synchronisation automatique.`, {
                    error: err?.message || String(err)
                });
            });
        }

        return finalRecord || record;
    }

    /**
     * Alias de la méthode `insert`.
     *
     * @async
     * @method insertData
     * @param {Object} req - Paramètres d'insertion.
     * @returns {Promise<Object|null>}
     *
     * @example <caption>Exemple 1 : Insérer un utilisateur</caption>
     * const user = await tr.insertData({ data: { username: 'alice', email: 'alice@test.com' } });
     *
     * @example <caption>Exemple 2 : Insertion d'un article</caption>
     * const art = await tr.insertData({ data: { title: 'Nouvel article', content: 'Texte...' } });
     */
    async insertData(req = {}) {
        return this.insert(req);
    }

    /**
     * Met à jour des enregistrements dans la table selon une condition.
     * Marque les lignes locales modifiées avec `n_local = 3` pour le suivi de synchronisation.
     *
     * @async
     * @method update
     * @param {Object} req - Paramètres de mise à jour.
     * @param {Object} req.data - Données à modifier.
     * @param {string} req.where - Clause conditionnelle SQL (ex: 'id = :id').
     * @param {Array|Object} [req.params] - Paramètres de la condition.
     * @param {boolean} [req.isLocalOnly=false] - Forcer uniquement local.
     * @returns {Promise<number>} Nombre de lignes modifiées.
     *
     * @example <caption>Exemple 1 : Mettre à jour un produit par son ID</caption>
     * const updated = await tr.update({ data: { price: 300 }, where: 'id = :id', params: { id: 5 } });
     * console.log(`${updated} ligne(s) modifiée(s)`);
     *
     * @example <caption>Exemple 2 : Mise à jour avec paramètres nommés</caption>
     * await tr.update({ data: { active: 1 }, where: 'code = :code', params: { code: 'ABC' } });
     */
    async update(req = {}) {
        const data = req.data || req.DATA;
        const where = req.where || req.WHERE;
        const params = req.params || req.PARAMS || {};
        const isLocalOnly = Boolean(req.isLocalOnly || req.N_REQUEST_LOCAL);

        if (!data || !where) {
            this.util.log.error('NTableRequest.update : data et where sont obligatoires.', {
                code: 'INVALID_UPDATE_REQUEST',
                req
            });
            return 0;
        }

        const updatePayload = { ...data, n_local: 3 };
        const affectedRows = await this.db.sql.update(this.#table, updatePayload, where, params);

        if (!isLocalOnly && affectedRows > 0 && this.#isOnline()) {
            this.syncDatas().catch(() => {});
        }

        return affectedRows;
    }

    /**
     * Alias de la méthode `update`.
     *
     * @async
     * @method updateData
     * @param {Object} req - Paramètres de mise à jour.
     * @returns {Promise<number>}
     *
     * @example <caption>Exemple 1 : Mettre à jour des données</caption>
     * await tr.updateData({ data: { status: 'validated' }, where: 'id = :id', params: { id: 1 } });
     *
     * @example <caption>Exemple 2 : Mise à jour groupée</caption>
     * await tr.updateData({ data: { read: 1 }, where: 'read = :r', params: { r: 0 } });
     */
    async updateData(req = {}) {
        return this.update(req);
    }

    /**
     * Supprime des enregistrements de la table selon une condition.
     * Enregistre les identifiants supprimés pour synchronisation distante des suppressions.
     *
     * @async
     * @method delete
     * @param {Object} req - Paramètres de suppression.
     * @param {string} req.where - Clause conditionnelle SQL de suppression (avec paramètres nommés).
     * @param {Object} [req.params={}] - Paramètres nommés de la clause.
     * @param {boolean} [req.isLocalOnly=false] - Forcer uniquement local.
     * @returns {Promise<number>} Nombre de lignes supprimées.
     *
     * @example <caption>Exemple 1 : Supprimer par ID</caption>
     * const deleted = await tr.delete({ where: 'id = :id', params: { id: 10 } });
     * console.log('Lignes supprimées :', deleted);
     *
     * @example <caption>Exemple 2 : Supprimer selon une condition nommée</caption>
     * await tr.delete({ where: 'expired_at < :now', params: { now: Date.now() } });
     */
    async delete(req = {}) {
        const where = req.where || req.WHERE;
        const params = req.params || req.PARAMS || {};
        const isLocalOnly = Boolean(req.isLocalOnly || req.N_REQUEST_LOCAL);

        if (!where) {
            this.util.log.error('NTableRequest.delete : la clause where est obligatoire.', {
                code: 'INVALID_DELETE_REQUEST',
                req
            });
            return 0;
        }

        // Enregistrer les IDs à supprimer pour la synchronisation distante
        const toDeleteRows = await this.db.sql.select(
            `SELECT \`${this.#primaryKey}\` FROM \`${this.#table}\` WHERE ${where}`,
            params
        );

        const affectedRows = await this.db.sql.delete(this.#table, where, params);

        if (affectedRows > 0 && toDeleteRows.length > 0) {
            const deletedIds = toDeleteRows.map((r) => r[this.#primaryKey]);
            await this.#recordDeletedIds(deletedIds);

            if (!isLocalOnly && this.#isOnline()) {
                this.syncDatas().catch(() => {});
            }
        }

        return affectedRows;
    }

    /**
     * Alias de la méthode `delete`.
     *
     * @async
     * @method deleteData
     * @param {Object} req - Paramètres de suppression.
     * @returns {Promise<number>}
     *
     * @example <caption>Exemple 1 : Supprimer une donnée</caption>
     * await tr.deleteData({ where: 'id = :id', params: { id: 4 } });
     *
     * @example <caption>Exemple 2 : Supprimer selon une condition</caption>
     * await tr.deleteData({ where: 'active = :a', params: { a: 0 } });
     */
    async deleteData(req = {}) {
        return this.delete(req);
    }

    // =========================================================================
    // Synchronisation Bidirectionnelle
    // =========================================================================

    /**
     * Lance la synchronisation bidirectionnelle des données de la table avec le serveur distant.
     *
     * @async
     * @method syncDatas
     * @param {Object} [options={}] - Options de synchronisation.
     * @returns {Promise<boolean>} True si la synchronisation a réussi.
     *
     * @example <caption>Exemple 1 : Déclencher la synchronisation complète</caption>
     * const ok = await tr.syncDatas();
     * console.log('Synchronisé :', ok);
     *
     * @example <caption>Exemple 2 : Synchronisation avec filtres</caption>
     * await tr.syncDatas({ limit: 50 });
     */
    async syncDatas(options = {}) {
        if (!this.#isOnline() || this.#isSyncing) {
            return false;
        }

        this.#isSyncing = true;
        try {
            // 1. Envoyer les suppressions locales en attente
            await this.#syncPendingDeletions();

            // 2. Envoyer les créations locales (n_local = 2) et mises à jour locales (n_local = 3)
            const pendingInserts = await this.db.sql.select(
                `SELECT * FROM \`${this.#table}\` WHERE n_local = 2`
            );
            for (const item of pendingInserts) {
                await this.#uploadLocalRecord(item, 'insert');
            }

            const pendingUpdates = await this.db.sql.select(
                `SELECT * FROM \`${this.#table}\` WHERE n_local = 3`
            );
            for (const item of pendingUpdates) {
                await this.#uploadLocalRecord(item, 'update');
            }

            return true;
        } catch (err) {
            this.util.log.warn(`NTableRequest.syncDatas : échec de synchronisation sur "${this.#table}".`, {
                error: err?.message || String(err)
            });
            return false;
        } finally {
            this.#isSyncing = false;
        }
    }

    // =========================================================================
    // Générateurs de Clauses SQL (Recherche textuelle, Pagination)
    // =========================================================================

    /**
     * Génère une clause de recherche SQL textuelle multi-champs avec pondération de pertinence dans le `ORDER BY`.
     *
     * @method generateSqlSearch
     * @param {string} textSearch - Termes recherchés (séparés par des espaces).
     * @param {string[]} arrayField - Liste des colonnes sur lesquelles effectuer la recherche.
     * @returns {{ where: string, order: string }|null} Clauses SQL générées ou null si texte vide.
     *
     * @example <caption>Exemple 1 : Recherche simple sur titre et description</caption>
     * const search = tr.generateSqlSearch('pain chocolat', ['title', 'description']);
     * if (search) {
     *     const query = `SELECT * FROM products WHERE ${search.where} ORDER BY ${search.order}`;
     * }
     *
     * @example <caption>Exemple 2 : Recherche sur un seul champ</caption>
     * const search = tr.generateSqlSearch('dupont', ['name']);
     */
    generateSqlSearch(textSearch, arrayField) {
        if (!textSearch || typeof textSearch !== 'string' || !Array.isArray(arrayField) || arrayField.length === 0) {
            return null;
        }

        const words = textSearch.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return null;

        const conditions = [];
        const caseConditions = [];

        for (const word of words) {
            const escapedWord = word.replace(/'/g, "''");
            let weight = arrayField.length;

            for (const field of arrayField) {
                const safeField = `\`${String(field).replace(/`/g, '``')}\``;

                // WHERE : recherche par correspondance partielle insensible à la casse
                conditions.push(`LOWER(${safeField}) LIKE LOWER('%${escapedWord}%')`);

                // ORDER BY : score de pertinence plus élevé pour correspondance exacte
                const scoreExact = 10 + weight;
                const scorePartial = 5 + weight;
                caseConditions.push(
                    `(CASE WHEN LOWER(${safeField}) = LOWER('${escapedWord}') THEN ${scoreExact} ` +
                    `WHEN LOWER(${safeField}) LIKE LOWER('%${escapedWord}%') THEN ${scorePartial} ELSE 0 END)`
                );
                weight--;
            }
        }

        return {
            where: conditions.length > 0 ? `(${conditions.join(' OR ')})` : '',
            order: caseConditions.length > 0 ? `(${caseConditions.join(' + ')}) DESC` : ''
        };
    }

    /**
     * Génère une clause de recherche SQL avec paramètres nommés pour éviter les injections.
     *
     * @method generateSqlSearchParams
     * @param {string} textSearch - Termes recherchés.
     * @param {string[]} arrayField - Colonnes ciblées.
     * @returns {{ where: string, order: string, params: Object<string, string> }|null}
     *
     * @example <caption>Exemple 1 : Recherche paramétrée sécurisée</caption>
     * const search = tr.generateSqlSearchParams('jean', ['name', 'email']);
     * if (search) {
     *     const results = await tr.db.sql.select(`SELECT * FROM users WHERE ${search.where}`, search.params);
     * }
     *
     * @example <caption>Exemple 2 : Utilisation avec tri</caption>
     * const search = tr.generateSqlSearchParams('pos', ['title']);
     */
    generateSqlSearchParams(textSearch, arrayField) {
        if (!textSearch || typeof textSearch !== 'string' || !Array.isArray(arrayField) || arrayField.length === 0) {
            return null;
        }

        const words = textSearch.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) return null;

        const conditions = [];
        const caseConditions = [];
        const params = {};
        let paramIdx = 0;

        for (const word of words) {
            let weight = arrayField.length;

            for (const field of arrayField) {
                const safeField = `\`${String(field).replace(/`/g, '``')}\``;
                const paramName = `n_word_${paramIdx++}`;
                params[paramName] = `%${word}%`;

                conditions.push(`LOWER(${safeField}) LIKE LOWER(:${paramName})`);

                const scoreExact = 10 + weight;
                const scorePartial = 5 + weight;
                caseConditions.push(
                    `(CASE WHEN LOWER(${safeField}) = LOWER(:${paramName}) THEN ${scoreExact} ` +
                    `WHEN LOWER(${safeField}) LIKE LOWER(:${paramName}) THEN ${scorePartial} ELSE 0 END)`
                );
                weight--;
            }
        }

        return {
            where: conditions.length > 0 ? `(${conditions.join(' OR ')})` : '',
            order: caseConditions.length > 0 ? `(${caseConditions.join(' + ')}) DESC` : '',
            params
        };
    }

    /**
     * Génère la clause SQL `LIMIT` et `OFFSET` pour la pagination.
     *
     * @method generateSqlLimited
     * @param {number} limit - Nombre maximal de lignes à retourner.
     * @param {number} [offset=0] - Décalage de départ (offset).
     * @returns {string} Clause SQL `LIMIT x, y` ou chaîne vide.
     *
     * @example <caption>Exemple 1 : Limite simple</caption>
     * const limitSql = tr.generateSqlLimited(20); // ' LIMIT 20'
     *
     * @example <caption>Exemple 2 : Limite avec décalage</caption>
     * const pageSql = tr.generateSqlLimited(10, 20); // ' LIMIT 20, 10'
     */
    generateSqlLimited(limit, offset = 0) {
        const lim = typeof limit === 'number' && limit > 0 ? Math.floor(limit) : 0;
        const off = typeof offset === 'number' && offset > 0 ? Math.floor(offset) : 0;

        if (lim > 0 && off > 0) {
            return ` LIMIT ${off}, ${lim}`;
        }
        if (lim > 0) {
            return ` LIMIT ${lim}`;
        }
        if (off > 0) {
            return ` LIMIT 0, ${off}`;
        }
        return '';
    }

    // =========================================================================
    // Méthodes Internes Privées
    // =========================================================================

    /**
     * Vérifie si le mode en ligne est actif (navigateur connecté et NRequest en ligne).
     * @private
     */
    #isOnline() {
        const isBrowserOnline = Boolean(NUtil?.env?.isOnline ?? true);
        if (this.#request && typeof this.#request.isOnlineMode === 'function') {
            return isBrowserOnline && this.#request.isOnlineMode();
        }
        return isBrowserOnline;
    }

    /**
     * Envoie une requête réseau distante.
     * @private
     */
    async #fetchRemote(payload, requestCode) {
        if (this.#request && typeof this.#request.fetchRemote === 'function') {
            return this.#request.fetchRemote(payload, requestCode);
        }
        // Fallback direct sur NNetwork
        const endpoint = `/api/${this.#table}`;
        const res = await NUtil.network.post(endpoint, payload);
        return res?.data ?? res;
    }

    /**
     * Enregistre les identifiants supprimés localement dans le stockage pour synchronisation.
     * @private
     */
    async #recordDeletedIds(ids) {
        try {
            const key = `sync_deleted_${this.#table}`;
            const existing = NUtil.db.store.getJson(key, []);
            const updated = Array.from(new Set([...existing, ...ids]));
            NUtil.db.store.set(key, updated);
        } catch (err) {
            this.util.log.warn(`NTableRequest.#recordDeletedIds : échec d'enregistrement pour "${this.#table}".`, {
                error: err?.message || String(err)
            });
        }
    }

    /**
     * Envoie les suppressions locales enregistrées au serveur distant.
     * @private
     */
    async #syncPendingDeletions() {
        const key = `sync_deleted_${this.#table}`;
        const ids = NUtil.db.store.getJson(key, []);
        if (Array.isArray(ids) && ids.length > 0) {
            try {
                await this.#fetchRemote({
                    type: 'SYNC_DELETE',
                    table: this.#table,
                    ids
                });
                NUtil.db.store.remove(key);
            } catch (err) {
                this.util.log.warn(`NTableRequest.#syncPendingDeletions : échec d'envoi pour "${this.#table}".`, {
                    error: err?.message || String(err)
                });
            }
        }
    }

    /**
     * Téléverse un enregistrement local vers le serveur distant.
     * @private
     */
    async #uploadLocalRecord(record, action) {
        const payload = { ...record };
        delete payload.n_local;
        delete payload.nevent_id;

        const res = await this.#fetchRemote({
            type: action === 'insert' ? 'SYNC_INSERT' : 'SYNC_UPDATE',
            table: this.#table,
            data: payload
        });

        if (res && res[this.#primaryKey]) {
            // Mise à jour du marqueur local en "synchronisé" (n_local = 1)
            await this.db.sql.update(
                this.#table,
                { n_local: 1 },
                `\`${this.#primaryKey}\` = :id`,
                { id: res[this.#primaryKey] }
            );
        }
    }
}

export default NTableRequest;

