/**
 * @file NWorkerManager.js
 * @package @nlib/js-backend
 * @description Gestionnaire centralisé des workers de l'écosystème NLib, exposé via `NUtil.worker` :
 * - Thread principal : création et registre nommé de workers (`create`, `add`, `get`, `has`, `terminate`, `terminateAll`),
 *   pools de workers avec répartition sur le moins occupé (`createPool`) et requêtes directes (`request`).
 * - Contexte Worker : transmission des requêtes du Worker vers le thread principal via `NWorker.requestMain()`.
 * - Traitement par défaut des requêtes inverses : relaie automatiquement `'requestApp'` vers `NUtil.env.requestApp(params)`.
 *
 * Règles : n'hérite pas de `NObject`, aucune méthode statique, allocations mémoire à la demande.
 */

import { NWorker } from './NWorker.js';
import { NException } from '../core/NException.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * @class NManagedWorker
 * @extends NWorker
 * @description Sous-classe interne de `NWorker` utilisée par `NWorkerManager` pour relayer les requêtes inverses
 * du Worker (`onRequest`) vers les gestionnaires d'actions du manager (notamment `'requestApp'`).
 *
 * @private
 */
class NManagedWorker extends NWorker {
    /**
     * Référence vers le gestionnaire parent.
     * @type {NWorkerManager}
     */
    #manager = null;

    /**
     * Crée une instance de worker géré.
     * @param {Object} options - Options transmises à NWorker.
     * @param {NWorkerManager} manager - Instance de NWorkerManager.
     */
    constructor(options, manager) {
        super(options);
        this.#manager = manager;
    }

    /**
     * Traite les requêtes inverses envoyées par le Worker vers le thread principal.
     * @param {string} action - Nom de l'action demandée par le Worker.
     * @param {Object} params - Paramètres transmis.
     * @param {Function|null} onUpdate - Callback de progression.
     * @returns {Promise<any>}
     */
    async onRequest(action, params, onUpdate) {
        if (this.#manager && this.#manager.hasAction(action)) {
            return this.#manager.executeAction(action, params, onUpdate);
        }
        return super.onRequest(action, params, onUpdate);
    }
}

/**
 * @class NWorkerManager
 * @description Registre, pools et routage centralisé des workers NLib (thread principal) et pont de communication.
 *
 * @example <caption>Exemple 1 : Créer un worker nommé et exécuter une action</caption>
 * NUtil.worker.create('sql', { url: './workers/sql.js' });
 * const res = await NUtil.worker.request('sql', 'query', { sql: 'SELECT * FROM users' });
 * console.log(res.result);
 *
 * @example <caption>Exemple 2 : Créer un pool de workers réparti sur les cœurs CPU</caption>
 * NUtil.worker.createPool('image', { url: './workers/image.js' }, 4);
 * const results = await Promise.all(files.map((f) => NUtil.worker.request('image', 'resize', f)));
 *
 * @example <caption>Exemple 3 : Côté Worker — solliciter l'application native (requestApp) via requestMain</caption>
 * // Dans le Worker :
 * const info = await NWorker.requestMain('requestApp', { action: 'getDeviceInfo' });
 */
export class NWorkerManager {

    // =========================================================================
    // Propriétés privées (Allocation paresseuse)
    // =========================================================================

    /**
     * Registre des workers individuels (`nom -> NWorker`).
     * @type {Map<string, NWorker>|null}
     * @private
     */
    #workers = null;

    /**
     * Registre des pools (`nom -> NWorker[]`).
     * @type {Map<string, NWorker[]>|null}
     * @private
     */
    #pools = null;

    /**
     * Actions du thread principal exposées aux requêtes inverses des workers (`action -> handler`).
     * @type {Map<string, Function>|null}
     * @private
     */
    #actions = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée le gestionnaire et enregistre l'action par défaut `'requestApp'`
     * (redirigée vers `NUtil.env.requestApp(params)` sur le thread principal).
     *
     * @example <caption>Exemple 1 : Instance partagée (recommandé)</caption>
     * const manager = NUtil.worker;
     *
     * @example <caption>Exemple 2 : Instance indépendante</caption>
     * const manager = new NWorkerManager();
     * console.log(manager.hasAction('requestApp')); // true
     */
    constructor() {
        this.registerAction('requestApp', async (params) => {
            return NUtil.env.requestApp(params);
        });
    }

    // =========================================================================
    // Getters
    // =========================================================================

    /**
     * Indique si le code courant s'exécute dans un Web Worker.
     *
     * @returns {boolean} `true` dans un Web Worker.
     *
     * @example <caption>Exemple 1 : Tester le contexte</caption>
     * console.log(NUtil.worker.isWorkerContext);
     *
     * @example <caption>Exemple 2 : Conditionnement</caption>
     * if (NUtil.worker.isWorkerContext) {
     *     const res = await NWorker.requestMain('getConfig');
     * }
     */
    get isWorkerContext() {
        return NUtil.env.isWorker;
    }

    /**
     * Indique si les Web Workers sont disponibles dans l'environnement courant.
     *
     * @returns {boolean} `true` si `Worker` existe.
     *
     * @example <caption>Exemple 1 : Vérifier le support</caption>
     * console.log(NUtil.worker.isSupported);
     *
     * @example <caption>Exemple 2 : Repli transparent</caption>
     * // NWorker gère automatiquement le repli local si isSupported est faux
     * const res = await NUtil.worker.request('calc', 'add', { a: 1, b: 2 });
     */
    get isSupported() {
        return typeof Worker !== 'undefined';
    }

    /**
     * Retourne le nombre total de workers gérés (individuels + membres des pools).
     *
     * @returns {number} Nombre de workers.
     *
     * @example <caption>Exemple 1 : Aucun worker</caption>
     * console.log(new NWorkerManager().size); // 0
     *
     * @example <caption>Exemple 2 : Après création d'un pool de 4</caption>
     * NUtil.worker.createPool('img', { url: './img.js' }, 4);
     * console.log(NUtil.worker.size); // 4
     */
    get size() {
        let total = this.#workers ? this.#workers.size : 0;
        if (this.#pools) {
            for (const list of this.#pools.values()) total += list.length;
        }
        return total;
    }

    /**
     * Retourne les noms des workers individuels et des pools enregistrés.
     *
     * @returns {string[]} Liste des noms.
     *
     * @example <caption>Exemple 1 : Lister les noms</caption>
     * console.log(NUtil.worker.names); // ['sql', 'image']
     *
     * @example <caption>Exemple 2 : Aucun nom</caption>
     * console.log(new NWorkerManager().names); // []
     */
    get names() {
        return [
            ...(this.#workers ? this.#workers.keys() : []),
            ...(this.#pools ? this.#pools.keys() : [])
        ];
    }

    // =========================================================================
    // Méthodes publiques — Actions Main (Requêtes Inverses Worker -> Main)
    // =========================================================================

    /**
     * Enregistre une action du thread principal exécutable lorsque le Worker appelle `NWorker.requestMain(action, params)`.
     *
     * @param {string} action - Nom de l'action.
     * @param {Function} handler - Fonction `(params, onUpdate) => Promise<any>|any`.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Enregistrer une action de journalisation</caption>
     * NUtil.worker.registerAction('log', (params) => {
     *     console.log('Log depuis le worker :', params.message);
     *     return { logged: true };
     * });
     *
     * @example <caption>Exemple 2 : Action avec progression</caption>
     * NUtil.worker.registerAction('heavyTask', async (params, onUpdate) => {
     *     onUpdate?.({ progress: 50 });
     *     return { done: true };
     * });
     */
    registerAction(action, handler) {
        if (typeof action !== 'string' || !action.trim() || typeof handler !== 'function') {
            return this;
        }
        if (!this.#actions) {
            this.#actions = new Map();
        }
        this.#actions.set(action.trim(), handler);
        return this;
    }

    /**
     * Désenregistre une action du thread principal.
     *
     * @param {string} action - Nom de l'action à retirer.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Retirer une action</caption>
     * NUtil.worker.unregisterAction('log');
     *
     * @example <caption>Exemple 2 : Vérification</caption>
     * console.log(NUtil.worker.hasAction('log')); // false
     */
    unregisterAction(action) {
        if (this.#actions) {
            this.#actions.delete(action);
            if (this.#actions.size === 0) {
                this.#actions = null;
            }
        }
        return this;
    }

    /**
     * Vérifie si une action du thread principal est enregistrée.
     *
     * @param {string} action - Nom de l'action.
     * @returns {boolean} `true` si l'action est enregistrée.
     *
     * @example <caption>Exemple 1 : Action par défaut</caption>
     * console.log(NUtil.worker.hasAction('requestApp')); // true
     *
     * @example <caption>Exemple 2 : Action inexistante</caption>
     * console.log(NUtil.worker.hasAction('inconnu')); // false
     */
    hasAction(action) {
        return Boolean(this.#actions && this.#actions.has(action));
    }

    /**
     * Exécute une action enregistrée du thread principal.
     *
     * @param {string} action - Nom de l'action.
     * @param {Object} [params={}] - Paramètres transmis.
     * @param {Function|null} [onUpdate=null] - Callback de progression.
     * @returns {Promise<any>} Résultat de l'action.
     *
     * @example <caption>Exemple 1 : Exécution directe</caption>
     * const res = await NUtil.worker.executeAction('requestApp', { action: 'vibrate' });
     *
     * @example <caption>Exemple 2 : Action inconnue</caption>
     * const res = await NUtil.worker.executeAction('nonEnregistree');
     * console.log(res.error); // 'ACTION_NOT_FOUND'
     */
    async executeAction(action, params = {}, onUpdate = null) {
        const handler = this.#actions?.get(action);
        if (typeof handler !== 'function') {
            return {
                error: 'ACTION_NOT_FOUND',
                message: `Action "${action}" non enregistrée dans le WorkerManager.`
            };
        }
        return handler(params, onUpdate);
    }

    // =========================================================================
    // Méthodes publiques — Registre de workers
    // =========================================================================

    /**
     * Crée, enregistre et retourne un worker nommé.
     * Si un worker du même nom existe déjà, il est arrêté et remplacé.
     *
     * @param {string} name - Nom unique du worker.
     * @param {Object} options - Options de création (`url`, `source`, `type`, etc.).
     * @returns {NWorker} Instance du worker créé.
     *
     * @example <caption>Exemple 1 : Worker depuis un fichier script</caption>
     * const sql = NUtil.worker.create('sql', { url: './workers/sql.js' });
     *
     * @example <caption>Exemple 2 : Worker depuis une fonction inline</caption>
     * NUtil.worker.create('tmp', { source: () => { console.log('worker'); } });
     */
    create(name, options = {}) {
        return this.add(name, new NManagedWorker({ ...options, name }, this));
    }

    /**
     * Enregistre un `NWorker` existant sous un nom.
     *
     * @param {string} name - Nom unique.
     * @param {NWorker} worker - Instance à enregistrer.
     * @returns {NWorker} Worker enregistré.
     * @throws {NException} Si `worker` n'est pas une instance de `NWorker` (`WORKER_INVALID`).
     *
     * @example <caption>Exemple 1 : Enregistrer une sous-classe personnalisée de NWorker</caption>
     * class MyWorker extends NWorker {}
     * NUtil.worker.add('custom', new MyWorker({ url: './custom.js' }));
     *
     * @example <caption>Exemple 2 : Remplacement automatique</caption>
     * NUtil.worker.add('sql', newWorker); // Arrête et remplace l'ancien 'sql'
     */
    add(name, worker) {
        if (!(worker instanceof NWorker)) {
            throw new NException('NWorkerManager.add : instance NWorker attendue.', { code: 'WORKER_INVALID' });
        }
        if (this.has(name)) {
            this.terminate(name);
        }

        worker.event.once('destroy', () => {
            if (this.#workers?.get(name) === worker) {
                this.#workers.delete(name);
                if (this.#workers.size === 0) this.#workers = null;
            }
        });

        if (!this.#workers) {
            this.#workers = new Map();
        }
        this.#workers.set(name, worker);
        return worker;
    }

    /**
     * Crée un pool de workers identiques ; les requêtes via `request(name, ...)`
     * sont automatiquement envoyées au worker le moins occupé.
     *
     * @param {string} name - Nom du pool.
     * @param {Object} options - Options de création communes à tous les membres.
     * @param {number} [size=NUtil.sys.cpuCores] - Nombre de workers dans le pool.
     * @returns {NWorker[]} Membres du pool créés.
     *
     * @example <caption>Exemple 1 : Pool dimensionné sur les cœurs CPU</caption>
     * NUtil.worker.createPool('hash', { url: './workers/hash.js' });
     *
     * @example <caption>Exemple 2 : Pool de 2 workers</caption>
     * const pool = NUtil.worker.createPool('pdf', { url: './pdf.js' }, 2);
     * console.log(pool.length); // 2
     */
    createPool(name, options = {}, size = NUtil.sys.cpuCores) {
        if (this.has(name)) {
            this.terminate(name);
        }
        const count = Math.max(1, Math.trunc(Number(size) || 1));
        const list = [];

        for (let i = 0; i < count; i++) {
            const worker = new NManagedWorker({ ...options, name: `${name}#${i}` }, this);
            worker.event.once('destroy', () => {
                const pool = this.#pools?.get(name);
                if (!pool) return;
                const idx = pool.indexOf(worker);
                if (idx !== -1) pool.splice(idx, 1);
                if (pool.length === 0) {
                    this.#pools.delete(name);
                    if (this.#pools.size === 0) this.#pools = null;
                }
            });
            list.push(worker);
        }

        if (!this.#pools) {
            this.#pools = new Map();
        }
        this.#pools.set(name, list);
        return list;
    }

    /**
     * Vérifie si un worker ou un pool porte ce nom.
     *
     * @param {string} name - Nom recherché.
     * @returns {boolean} `true` s'il existe.
     *
     * @example <caption>Exemple 1 : Worker existant</caption>
     * console.log(NUtil.worker.has('sql')); // true
     *
     * @example <caption>Exemple 2 : Nom inconnu</caption>
     * console.log(NUtil.worker.has('inconnu')); // false
     */
    has(name) {
        return Boolean(this.#workers?.has(name) || this.#pools?.has(name));
    }

    /**
     * Retourne le worker portant ce nom ; pour un pool, retourne le membre le moins occupé.
     *
     * @param {string} name - Nom du worker ou du pool.
     * @returns {NWorker|null} Worker trouvé ou `null`.
     *
     * @example <caption>Exemple 1 : Récupérer un worker</caption>
     * const sql = NUtil.worker.get('sql');
     *
     * @example <caption>Exemple 2 : Membre le moins occupé d'un pool</caption>
     * const member = NUtil.worker.get('hash');
     * console.log(member.name); // ex: 'hash#1'
     */
    get(name) {
        const single = this.#workers?.get(name);
        if (single) {
            return single;
        }
        const pool = this.#pools?.get(name);
        if (!pool || pool.length === 0) {
            return null;
        }
        let best = pool[0];
        for (let i = 1; i < pool.length; i++) {
            if (pool[i].pendingCount < best.pendingCount) best = pool[i];
        }
        return best;
    }

    // =========================================================================
    // Méthodes publiques — Envoi de Requêtes
    // =========================================================================

    /**
     * Envoie une requête à un worker ou au membre le moins occupé d'un pool.
     *
     * @param {string} name - Nom du worker ou du pool.
     * @param {string} action - Nom de l'action à exécuter dans le worker.
     * @param {Object} [params={}] - Paramètres d'entrée.
     * @param {Function|null} [onUpdate=null] - Callback de progression.
     * @returns {Promise<{ id?: string, action: string, params: any, result: any, error?: any }>}
     *
     * @example <caption>Exemple 1 : Requête vers un worker</caption>
     * const res = await NUtil.worker.request('sql', 'query', { sql: 'SELECT * FROM users' });
     * console.log(res.result);
     *
     * @example <caption>Exemple 2 : Requête avec notification de progression</caption>
     * const res = await NUtil.worker.request('download', 'fetch', { url: '...' }, (step) => {
     *     console.log('Avancement :', step.result);
     * });
     */
    async request(name, action, params = {}, onUpdate = null) {
        const worker = this.get(name);
        if (!worker) {
            return {
                action,
                params,
                result: {
                    error: 'WORKER_NOT_FOUND',
                    message: `Aucun worker ou pool nommé "${name}".`
                }
            };
        }
        return worker.request(action, params, onUpdate);
    }

    // =========================================================================
    // Méthodes publiques — Arrêt & Nettoyage
    // =========================================================================

    /**
     * Arrête et retire un worker ou tous les membres d'un pool.
     *
     * @param {string} name - Nom du worker ou du pool.
     * @returns {boolean} `true` si le worker/pool a été trouvé et arrêté.
     *
     * @example <caption>Exemple 1 : Arrêter un worker</caption>
     * NUtil.worker.terminate('sql');
     *
     * @example <caption>Exemple 2 : Arrêter un pool</caption>
     * NUtil.worker.terminate('image'); // true
     */
    terminate(name) {
        const single = this.#workers?.get(name);
        if (single) {
            single.destroy();
            return true;
        }
        const pool = this.#pools?.get(name);
        if (pool) {
            [...pool].forEach((w) => w.destroy());
            this.#pools?.delete(name);
            if (this.#pools && this.#pools.size === 0) this.#pools = null;
            return true;
        }
        return false;
    }

    /**
     * Arrête et détruit tous les workers et pools gérés.
     *
     * @returns {number} Nombre de workers arrêtés.
     *
     * @example <caption>Exemple 1 : Arrêt général à la fermeture de l'application</caption>
     * NUtil.worker.terminateAll();
     * console.log(NUtil.worker.size); // 0
     *
     * @example <caption>Exemple 2 : Chaînage avant nettoyage</caption>
     * if (NUtil.worker.size > 0) { NUtil.worker.terminateAll(); }
     */
    terminateAll() {
        const all = [];
        this.#each((w) => all.push(w));
        all.forEach((w) => w.destroy());
        this.#workers = null;
        this.#pools = null;
        return all.length;
    }

    /**
     * Sérialise l'état du gestionnaire en objet JSON.
     *
     * @returns {{ size: number, workers: Object[], pools: Object<string, Object[]>, actions: string[] }}
     *
     * @example <caption>Exemple 1 : Diagnostic du gestionnaire</caption>
     * console.log(JSON.stringify(NUtil.worker));
     *
     * @example <caption>Exemple 2 : Vérifier les actions enregistrées</caption>
     * console.log(NUtil.worker.toJSON().actions); // ['requestApp', ...]
     */
    toJSON() {
        const pools = {};
        if (this.#pools) {
            for (const [name, list] of this.#pools) {
                pools[name] = list.map((w) => ({
                    name: w.name,
                    isRunning: w.isRunning,
                    pendingCount: w.pendingCount
                }));
            }
        }
        return {
            size: this.size,
            workers: this.#workers
                ? Array.from(this.#workers.values()).map((w) => ({
                    name: w.name,
                    isRunning: w.isRunning,
                    pendingCount: w.pendingCount
                }))
                : [],
            pools,
            actions: this.#actions ? Array.from(this.#actions.keys()) : []
        };
    }

    // =========================================================================
    // Méthodes privées
    // =========================================================================

    /**
     * Parcourt l'ensemble des workers gérés (individuels et membres des pools).
     *
     * @private
     * @param {Function} fn - Fonction exécutée pour chaque worker `(worker) => void`.
     */
    #each(fn) {
        if (this.#workers) {
            for (const w of Array.from(this.#workers.values())) fn(w);
        }
        if (this.#pools) {
            for (const list of Array.from(this.#pools.values())) {
                for (const w of [...list]) fn(w);
            }
        }
    }
}

export default NWorkerManager;
