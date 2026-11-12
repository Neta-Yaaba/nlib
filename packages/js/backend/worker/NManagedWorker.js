/**
 * @file NManagedWorker.js
 * @package @nlib/js-backend
 * @description Sous-classe de `NWorker` gérée par `NWorkerManager`.
 * Intercepte les requêtes inverses (`onRequest`) émises par le Worker vers le thread principal
 * et les délègue aux actions enregistrées dans son gestionnaire parent `NWorkerManager`
 * (notamment le relai vers `requestApp`).
 */

import { NWorker } from './NWorker.js';

/**
 * @class NManagedWorker
 * @extends NWorker
 * @description Worker managé par une instance de `NWorkerManager`. Relaye automatiquement
 * les requêtes inverses reçues du worker vers les gestionnaires d'actions du manager.
 *
 * @example <caption>Exemple 1 : Instanciation liée à un gestionnaire NWorkerManager</caption>
 * const managedWorker = new NManagedWorker({ url: './workers/data.js' }, workerManager);
 * const res = await managedWorker.request('process', { data: [1, 2, 3] });
 *
 * @example <caption>Exemple 2 : Gestion automatique d'une requête inverse</caption>
 * // Lorsque le worker exécute NWorker.requestMain('saveToDb', params),
 * // managedWorker.onRequest transmet l'appel à workerManager.executeAction('saveToDb', params).
 *
 * @example <caption>Exemple 3 : Écoute du cycle de vie</caption>
 * managedWorker.event.on('running', () => {
 *     console.log('Worker géré opérationnel');
 * });
 */
export class NManagedWorker extends NWorker {
    /**
     * Référence vers le gestionnaire parent NWorkerManager.
     * @type {any}
     * @private
     */
    #manager = null;

    /**
     * Crée une instance de worker géré.
     *
     * @constructor
     * @param {Object} options - Options transmises à NWorker (`url`, `source`, `name`, `type`, etc.).
     * @param {any} manager - Instance du gestionnaire `NWorkerManager`.
     *
     * @example <caption>Exemple 1 : Créer un NManagedWorker depuis une URL</caption>
     * const worker = new NManagedWorker({ url: './workers/calc.js', name: 'calc' }, myManager);
     *
     * @example <caption>Exemple 2 : Créer un NManagedWorker depuis une fonction inline</caption>
     * const worker = new NManagedWorker({
     *     name: 'inline',
     *     source: () => { console.log('Worker prêt'); }
     * }, myManager);
     */
    constructor(options, manager) {
        super(options);
        this.#manager = manager;
    }

    /**
     * Retourne l'instance du gestionnaire parent associé.
     *
     * @type {any}
     *
     * @example <caption>Exemple 1 : Consulter le manager associé</caption>
     * console.log(worker.manager);
     *
     * @example <caption>Exemple 2 : Vérifier l'association</caption>
     * if (worker.manager) {
     *     console.log('Worker supervisé par un manager');
     * }
     */
    get manager() {
        return this.#manager;
    }

    /**
     * Traite les requêtes inverses envoyées par le Worker vers le thread principal.
     * Si l'action est enregistrée dans le manager parent, la requête lui est déléguée.
     * Dans le cas contraire, le comportement par défaut de `super.onRequest()` est invoqué.
     *
     * @async
     * @method onRequest
     * @param {string} action - Nom de l'action demandée par le Worker.
     * @param {Object} params - Paramètres transmis.
     * @param {Function|null} onUpdate - Callback de progression.
     * @returns {Promise<any>}
     *
     * @example <caption>Exemple 1 : Appel standard depuis le Worker via NWorker.requestMain</caption>
     * const res = await worker.onRequest('requestApp', { cmd: 'ping' });
     *
     * @example <caption>Exemple 2 : Traitement avec callback de progression</caption>
     * await worker.onRequest('longTask', { id: 1 }, (step) => console.log('Progression :', step));
     */
    async onRequest(action, params, onUpdate) {
        if (this.#manager && typeof this.#manager.hasAction === 'function' && this.#manager.hasAction(action)) {
            return this.#manager.executeAction(action, params, onUpdate);
        }
        return super.onRequest(action, params, onUpdate);
    }
}

export default NManagedWorker;

