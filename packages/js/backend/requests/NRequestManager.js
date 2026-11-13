/**
 * @file NRequestManager.js
 * @package @nlib/js-backend
 * @description Gestionnaire centralisé des requêtes de tables de l'écosystème NLib.
 * Gère le registre, l'instanciation, la configuration et l'accès aux instances de `NTableRequest`.
 *
 * Conforme aux standards NLib :
 * - Hérite de `NObject`
 * - Propriétés privées modernes ES2022+
 * - Zéro variable hors classe
 * - Zéro import inutile
 * - Documentation JSDoc exhaustive en français (>= 3 @example classe, >= 2 @example méthodes/getters)
 */

import { NObject } from '../core/NObject.js';
import { NTableRequest } from './NTableRequest.js';

/**
 * @class NRequestManager
 * @extends NObject
 * @description Manager de gestion des `NTableRequest`. Permet d'enregistrer, récupérer,
 * vérifier et router l'exécution de requêtes vers les gestionnaires de tables respectifs.
 *
 * @example <caption>Exemple 1 : Instanciation et ajout d'un gestionnaire de table</caption>
 * const manager = new NRequestManager();
 * manager.addTableRequest('users', new NTableRequest({ table: 'users', primaryKey: 'id' }));
 * const usersTr = manager.getTableRequest('users');
 * console.log(usersTr.table); // 'users'
 *
 * @example <caption>Exemple 2 : Exécution routée directement via execute() avec table dans req ou dans type</caption>
 * const manager = new NRequestManager();
 * // Avec table directe dans req :
 * const res1 = await manager.execute({
 *     table: 'products',
 *     type: 'GET',
 *     sql: 'SELECT * FROM products WHERE code = :code',
 *     params: { code: 'P01' }
 * });
 * // Ou avec type objet { table, type } :
 * const res2 = await manager.execute({
 *     type: { table: 'products', type: 'GET' },
 *     sql: 'SELECT * FROM products WHERE code = :code',
 *     params: { code: 'P01' }
 * });
 * console.log('Produit :', res1);
 *
 * @example <caption>Exemple 3 : Vérification et suppression d'un gestionnaire de table</caption>
 * const manager = new NRequestManager();
 * if (!manager.hasTableRequest('logs')) {
 *     manager.addTableRequest('logs', new NTableRequest({ table: 'logs' }));
 * }
 * manager.removeTableRequest('logs');
 */
export class NRequestManager extends NObject {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Dictionnaire des instances de NTableRequest enregistrées (indexées par nom de table en minuscules).
     * @type {Object<string, NTableRequest>}
     * @private
     */
    #tableRequests = {};

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de NRequestManager.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration du gestionnaire.
     * @param {Object<string, NTableRequest>} [options.tables={}] - Dictionnaire initial de tables `{ [nom]: NTableRequest }`.
     *
     * @example <caption>Exemple 1 : Instanciation standard</caption>
     * const manager = new NRequestManager();
     *
     * @example <caption>Exemple 2 : Instanciation avec tables préconfigurées</caption>
     * const manager = new NRequestManager({
     *     tables: {
     *         users: new NTableRequest({ table: 'users' }),
     *         orders: new NTableRequest({ table: 'orders' })
     *     }
     * });
     */
    constructor(options = {}) {
        super();
        if (options && typeof options === 'object' && options.tables && typeof options.tables === 'object') {
            for (const [table, tr] of Object.entries(options.tables)) {
                if (tr instanceof NTableRequest) {
                    this.addTableRequest(table, tr);
                }
            }
        }
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    /**
     * Retourne la liste des noms de tables enregistrées.
     * @type {string[]}
     *
     * @example <caption>Exemple 1 : Lister les tables enregistrées</caption>
     * console.log(manager.tableNames); // ['users', 'products', 'orders']
     *
     * @example <caption>Exemple 2 : Compter le nombre de tables managées</caption>
     * console.log(`Tables managées : ${manager.tableNames.length}`);
     */
    get tableNames() {
        return Object.keys(this.#tableRequests);
    }

    /**
     * Retourne le nombre total de tables managées.
     * @type {number}
     *
     * @example <caption>Exemple 1 : Vérifier si le manager contient des tables</caption>
     * if (manager.count > 0) { console.log('Des tables sont enregistrées'); }
     *
     * @example <caption>Exemple 2 : Affichage direct</caption>
     * console.log(`Total tables : ${manager.count}`);
     */
    get count() {
        return Object.keys(this.#tableRequests).length;
    }

    // =========================================================================
    // Gestion des NTableRequest
    // =========================================================================

    /**
     * Enregistre ou remplace un gestionnaire `NTableRequest` pour une table.
     *
     * @method addTableRequest
     * @param {string} tableName - Nom de la table.
     * @param {NTableRequest} tableRequest - Instance de `NTableRequest`.
     * @returns {NTableRequest} L'instance enregistrée.
     *
     * @example <caption>Exemple 1 : Enregistrer la table clients</caption>
     * manager.addTableRequest('clients', new NTableRequest({ table: 'clients' }));
     *
     * @example <caption>Exemple 2 : Enregistrement fluide</caption>
     * const tr = manager.addTableRequest('factures', new NTableRequest({ table: 'factures', primaryKey: 'ref' }));
     */
    addTableRequest(tableName, tableRequest) {
        if (typeof tableName !== 'string' || !tableName.trim()) {
            this.util.log.error('NRequestManager.addTableRequest : le nom de la table doit être une chaîne valide.', {
                code: 'INVALID_TABLE_NAME',
                tableName
            });
            return null;
        }
        if (!(tableRequest instanceof NTableRequest)) {
            this.util.log.error('NRequestManager.addTableRequest : tableRequest doit être une instance de NTableRequest.', {
                code: 'INVALID_TABLE_REQUEST_INSTANCE',
                tableName,
                tableRequest
            });
            return null;
        }

        const key = tableName.trim().toLowerCase();
        this.#tableRequests[key] = tableRequest;
        return tableRequest;
    }

    /**
     * Vérifie si un gestionnaire `NTableRequest` est enregistré pour une table.
     *
     * @method hasTableRequest
     * @param {string} tableName - Nom de la table.
     * @returns {boolean} True si la table est managée.
     *
     * @example <caption>Exemple 1 : Vérifier la présence d'une table</caption>
     * if (manager.hasTableRequest('users')) {
     *     console.log('La table users est managée.');
     * }
     *
     * @example <caption>Exemple 2 : Condition avant ajout</caption>
     * if (!manager.hasTableRequest('settings')) {
     *     manager.addTableRequest('settings', new NTableRequest({ table: 'settings' }));
     * }
     */
    hasTableRequest(tableName) {
        if (typeof tableName !== 'string' || !tableName.trim()) return false;
        return Boolean(this.#tableRequests[tableName.trim().toLowerCase()]);
    }

    /**
     * Récupère le gestionnaire `NTableRequest` associé à une table.
     * S'il n'existe pas encore, il est instancié automatiquement avec le nom de table fourni.
     *
     * @method getTableRequest
     * @param {string} tableName - Nom de la table.
     * @returns {NTableRequest} Instance de `NTableRequest`.
     *
     * @example <caption>Exemple 1 : Récupérer un gestionnaire existant ou créé à la volée</caption>
     * const tr = manager.getTableRequest('products');
     * console.log(tr.table); // 'products'
     *
     * @example <caption>Exemple 2 : Exécuter une requête directe sur la table récupérée</caption>
     * const user = await manager.getTableRequest('users').getDataByPrimaryKey(1);
     */
    getTableRequest(tableName) {
        if (typeof tableName !== 'string' || !tableName.trim()) {
            this.util.log.error('NRequestManager.getTableRequest : le nom de la table doit être une chaîne valide.', {
                code: 'INVALID_TABLE_NAME',
                tableName
            });
            return null;
        }

        const key = tableName.trim().toLowerCase();
        if (!this.#tableRequests[key]) {
            this.#tableRequests[key] = new NTableRequest({
                table: tableName.trim()
            });
        }
        return this.#tableRequests[key];
    }

    /**
     * Supprime un gestionnaire `NTableRequest` enregistré.
     *
     * @method removeTableRequest
     * @param {string} tableName - Nom de la table à retirer.
     * @returns {boolean} True si le gestionnaire a été retiré, false s'il n'existait pas.
     *
     * @example <caption>Exemple 1 : Retirer une table</caption>
     * manager.removeTableRequest('temp_logs');
     *
     * @example <caption>Exemple 2 : Vérification du retrait</caption>
     * const removed = manager.removeTableRequest('users');
     * console.log('Retiré :', removed);
     */
    removeTableRequest(tableName) {
        if (typeof tableName !== 'string' || !tableName.trim()) return false;
        const key = tableName.trim().toLowerCase();
        if (this.#tableRequests[key]) {
            delete this.#tableRequests[key];
            return true;
        }
        return false;
    }

    /**
     * Supprime tous les gestionnaires de tables enregistrés.
     *
     * @method clear
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Vider le registre de tables</caption>
     * manager.clear();
     * console.log(manager.count); // 0
     *
     * @example <caption>Exemple 2 : Réinitialisation complète</caption>
     * manager.clear();
     */
    clear() {
        this.#tableRequests = {};
    }

    // =========================================================================
    // Routage d'Exécution vers NTableRequest
    // =========================================================================

    /**
     * Résout le nom de la table cible à partir de la requête :
     * 1. Directement dans `req.table`
     * 2. Ou dans `req.type.table` si `type` est un objet
     *
     * @private
     * @param {Object} req - Requête transmise.
     * @returns {string|null} Nom de la table ou null.
     */
    #resolveTableName(req) {
        if (!req || typeof req !== 'object') return null;

        // 1. Directement dans req.table
        if (typeof req.table === 'string' && req.table.trim()) {
            return req.table.trim();
        }

        // 2. Dans req.type.table si type est un objet { table, type }
        if (req.type && typeof req.type === 'object' && typeof req.type.table === 'string' && req.type.table.trim()) {
            return req.type.table.trim();
        }

        return null;
    }

    /**
     * Exécute une requête en la routant vers le gestionnaire `NTableRequest` correspondant.
     * Le nom de la table peut être précisé directement dans `req.table` ou encapsulé dans `req.type = { table, type }`.
     *
     * @async
     * @method execute
     * @param {Object} req - Paramètres de la requête.
     * @param {string} [req.table] - Nom de la table cible directe dans req.
     * @param {string|{ table?: string, type?: string }} [req.type='GET'] - Type d'action (chaîne comme 'GET' ou objet comme { table: 'users', type: 'GET' }).
     * @returns {Promise<any>} Résultat renvoyé par le `NTableRequest`.
     *
     * @example <caption>Exemple 1 : Avec table directe et type chaîne</caption>
     * const res = await manager.execute({
     *     table: 'users',
     *     type: 'GET',
     *     sql: 'SELECT * FROM users WHERE id = :id',
     *     params: { id: 10 }
     * });
     *
     * @example <caption>Exemple 2 : Avec type sous forme d'objet { table, type }</caption>
     * const res = await manager.execute({
     *     type: { table: 'products', type: 'INSERT' },
     *     data: { title: 'Café', price: 500 }
     * });
     */
    async execute(req = {}) {
        const tableName = this.#resolveTableName(req);
        if (!tableName) {
            this.util.log.error('NRequestManager.execute : le nom de la table doit être fourni via req.table ou req.type.table.', {
                code: 'MISSING_TABLE_PARAMETER',
                req
            });
            return null;
        }

        const tableRequest = this.getTableRequest(tableName);
        if (!tableRequest) {
            return null;
        }
        return tableRequest.execute(req);
    }
}

export default NRequestManager;
