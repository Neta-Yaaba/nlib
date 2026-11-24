/**
 * @file NWorkMgr.js
 * @package @nlib/js-backend
 * @description Gestionnaire centralisé des workers de l'écosystème NLib :
 * - Thread principal : création et registre nommé de workers (`create`, `add`, `get`, `has`, `terminate`, `terminateAll`),
 *   pools de workers avec répartition sur le moins occupé (`createPool`) et requêtes directes (`request`).
 * - Contexte Worker : transmission des requêtes du Worker vers le thread principal via `NWorker.requestMain()`.
 * - Traitement par défaut des requêtes inverses : relaie `'requestApp'` / `'invokeNative'` vers `NSys.invokeNative(params)`.
 */

import { NWorker } from './NWorker.js';
import { NLog } from '../log/NLog.js';
import { NEnv } from '../environment/NEnv.js';
import { NSys } from '../system/NSys.js';

/**
 * @class NWorkMgr
 * @description Registre, pools et routage centralisé des workers NLib (thread principal) et pont de communication.
 *
 * @example <caption>Exemple 1 : Créer un worker nommé et exécuter une action</caption>
 * NWorkMgr.create('sql', { url: './workers/sql.js' });
 * const res = await NWorkMgr.request('sql', 'query', { sql: 'SELECT * FROM users' });
 * console.log(res.result);
 *
 * @example <caption>Exemple 2 : Créer un pool de workers réparti sur les cœurs CPU</caption>
 * NWorkMgr.createPool('image', { url: './workers/image.js' }, 4);
 * const results = await Promise.all(files.map((f) => NWorkMgr.request('image', 'resize', f)));
 *
 * @example <caption>Exemple 3 : Côté Worker — solliciter l'application native (requestApp) via requestMain</caption>
 * // Dans le Worker :
 * const info = await NWorker.requestMain('requestApp', { action: 'getDeviceInfo' });
 */
export class NWorkMgr {

    // =========================================================================
    // Propriétés privées (Allocation paresseuse)
    // =========================================================================

    /**
     * Registre des workers individuels (`nom -> NWorker`).
     * @type {Map<string, NWorker>|null}
     * @private
     */
    static #workers = null;

    /**
     * Registre des pools (`nom -> NWorker[]`).
     * @type {Map<string, NWorker[]>|null}
     * @private
     */
    static #pools = null;

    /**
     * Actions du thread principal exposées aux requêtes inverses des workers (`action -> handler`).
     * @type {Map<string, Function>|null}
     * @private
     */
    static #actions = null;

    static {
        NWorkMgr.registerAction('invokeNative', async (params) => {
            return NSys.invokeNative(params);
        });
        NWorkMgr.registerAction('requestApp', async (params) => {
            return NSys.invokeNative(params);
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
     * console.log(NWorkMgr.isWorkerContext);
     *
     * @example <caption>Exemple 2 : Conditionnement</caption>
     * if (NWorkMgr.isWorkerContext) {
     *     const res = await NWorker.requestMain('getConfig');
     * }
     */
    static get isWorkerContext() {
        return NEnv.isWorker;
    }

    /**
     * Indique si les Web Workers sont disponibles dans l'environnement courant.
     *
     * @returns {boolean} `true` si `Worker` existe.
     *
     * @example <caption>Exemple 1 : Vérifier le support</caption>
     * console.log(NWorkMgr.isSupported);
     *
     * @example <caption>Exemple 2 : Repli transparent</caption>
     * // NWorker gère automatiquement le repli local si isSupported est faux
     * const res = await NWorkMgr.request('calc', 'add', { a: 1, b: 2 });
     */
    static get isSupported() {
        return typeof Worker !== 'undefined';
    }

    /**
     * Retourne le nombre total de workers gérés (individuels + membres des pools).
     *
     * @returns {number} Nombre de workers.
     *
     * @example <caption>Exemple 1 : Aucun worker</caption>
     * console.log(NWorkMgr.size); // 0
     *
     * @example <caption>Exemple 2 : Après création d'un pool de 4</caption>
     * NWorkMgr.createPool('img', { url: './img.js' }, 4);
     * console.log(NWorkMgr.size); // 4
     */
    static get size() {
        let total = NWorkMgr.#workers ? NWorkMgr.#workers.size : 0;
        if (NWorkMgr.#pools) {
            for (const list of NWorkMgr.#pools.values()) total += list.length;
        }
        return total;
    }

    /**
     * Retourne les noms des workers individuels et des pools enregistrés.
     *
     * @returns {string[]} Liste des noms.
     *
     * @example <caption>Exemple 1 : Lister les noms</caption>
     * console.log(NWorkMgr.names); // ['sql', 'image']
     *
     * @example <caption>Exemple 2 : Aucun nom</caption>
     * console.log(NWorkMgr.names); // []
     */
    static get names() {
        return [
            ...(NWorkMgr.#workers ? NWorkMgr.#workers.keys() : []),
            ...(NWorkMgr.#pools ? NWorkMgr.#pools.keys() : [])
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
     * NWorkMgr.registerAction('log', (params) => {
     *     console.log('Log depuis le worker :', params.message);
     *     return { logged: true };
     * });
     *
     * @example <caption>Exemple 2 : Action avec progression</caption>
     * NWorkMgr.registerAction('heavyTask', async (params, onUpdate) => {
     *     onUpdate?.({ progress: 50 });
     *     return { done: true };
     * });
     */
    static registerAction(action, handler) {
        if (typeof action !== 'string' || !action.trim() || typeof handler !== 'function') {
            return NWorkMgr;
        }
        if (!NWorkMgr.#actions) {
            NWorkMgr.#actions = new Map();
        }
        NWorkMgr.#actions.set(action.trim(), handler);
        return NWorkMgr;
    }

    /**
     * Désenregistre une action du thread principal.
     *
     * @param {string} action - Nom de l'action à retirer.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Retirer une action</caption>
     * NWorkMgr.unregisterAction('log');
     *
     * @example <caption>Exemple 2 : Vérification</caption>
     * console.log(NWorkMgr.hasAction('log')); // false
     */
    static unregisterAction(action) {
        if (NWorkMgr.#actions) {
            NWorkMgr.#actions.delete(action);
            if (NWorkMgr.#actions.size === 0) {
                NWorkMgr.#actions = null;
            }
        }
        return NWorkMgr;
    }

    /**
     * Vérifie si une action du thread principal est enregistrée.
     *
     * @param {string} action - Nom de l'action.
     * @returns {boolean} `true` si l'action est enregistrée.
     *
     * @example <caption>Exemple 1 : Action par défaut</caption>
     * console.log(NWorkMgr.hasAction('requestApp')); // true
     *
     * @example <caption>Exemple 2 : Action inexistante</caption>
     * console.log(NWorkMgr.hasAction('inconnu')); // false
     */
    static hasAction(action) {
        return Boolean(NWorkMgr.#actions && NWorkMgr.#actions.has(action));
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
     * const res = await NWorkMgr.executeAction('requestApp', { action: 'vibrate' });
     *
     * @example <caption>Exemple 2 : Action inconnue</caption>
     * const res = await NWorkMgr.executeAction('nonEnregistree');
     * console.log(res.error); // 'ACTION_NOT_FOUND'
     */
    static async executeAction(action, params = {}, onUpdate = null) {
        const handler = NWorkMgr.#actions?.get(action);
        if (typeof handler !== 'function') {
            NLog.warn(`NWorkMgr: Action "${action}" non enregistrée.`);
            return {
                success: false,
                code: 'ACTION_NOT_FOUND',
                error: 'ACTION_NOT_FOUND',
                message: `Action "${action}" non enregistrée dans le WorkerManager.`
            };
        }
        try {
            const res = await handler(params, onUpdate);
            return res;
        } catch (err) {
            NLog.error(`NWorkMgr: Erreur lors de l'exécution de l'action "${action}".`, {
                code: 'ACTION_EXECUTION_ERROR',
                cause: err
            });
            return {
                success: false,
                code: 'ACTION_EXECUTION_ERROR',
                error: 'ACTION_EXECUTION_ERROR',
                message: err?.message ?? String(err)
            };
        }
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
     * const sql = NWorkMgr.create('sql', { url: './workers/sql.js' });
     *
     * @example <caption>Exemple 2 : Worker depuis une fonction inline</caption>
     * NWorkMgr.create('tmp', { source: () => { console.log('worker'); } });
     */
    /**
     * Instancie un `NWorker` rattaché à ce gestionnaire en redirigeant `onRequest`
     * vers les actions enregistrées dans ce `NWorkMgr`.
     *
     * @param {Object} options - Options transmises à `NWorker`.
     * @returns {NWorker}
     * @private
     */
    static #createManagedWorker(options) {
        const worker = new NWorker(options);
        const defaultOnRequest = worker.onRequest.bind(worker);
        worker.onRequest = async (action, params, onUpdate) => {
            if (NWorkMgr.hasAction(action)) {
                try {
                    return await NWorkMgr.executeAction(action, params, onUpdate);
                } catch (err) {
                    NLog.error(`NWorkMgr [${worker.name}]: Erreur lors de la délégation de l'action "${action}".`, {
                        code: 'ERR_MANAGED_ACTION_EXEC',
                        cause: err
                    });
                    return {
                        success: false,
                        code: 'ERR_MANAGED_ACTION_EXEC',
                        error: 'ERR_MANAGED_ACTION_EXEC',
                        message: err?.message ?? String(err)
                    };
                }
            }
            return defaultOnRequest(action, params, onUpdate);
        };
        return worker;
    }

    /**
     * Crée, configure et enregistre un nouveau `NWorker` géré sous le nom donné.
     *
     * @param {string} name - Nom unique du worker.
     * @param {Object} [options={}] - Options transmises à `NWorker`.
     * @returns {NWorker|null} Worker enregistré ou `null` si le nom est invalide.
     *
     * @example <caption>Exemple 1 : Créer un worker dédié</caption>
     * const w = NWorkMgr.create('compute', { url: './compute-worker.js' });
     *
     * @example <caption>Exemple 2 : Créer un worker avec repli local</caption>
     * const local = NWorkMgr.create('math');
     */
    static create(name, options = {}) {
        return NWorkMgr.add(name, NWorkMgr.#createManagedWorker({ ...options, name }));
    }

    /**
     * Enregistre un `NWorker` existant sous un nom.
     *
     * @param {string} name - Nom unique.
     * @param {NWorker} worker - Instance à enregistrer.
     * @returns {NWorker|null} Worker enregistré ou `null` en cas d'argument invalide.
     *
     * @example <caption>Exemple 1 : Enregistrer une sous-classe personnalisée de NWorker</caption>
     * class MyWorker extends NWorker {}
     * NWorkMgr.add('custom', new MyWorker({ url: './custom.js' }));
     *
     * @example <caption>Exemple 2 : Remplacement automatique</caption>
     * NWorkMgr.add('sql', newWorker); // Arrête et remplace l'ancien 'sql'
     */
    static add(name, worker) {
        if (!(worker instanceof NWorker)) {
            NLog.error('NWorkMgr.add : instance NWorker attendue.', {
                code: 'WORKER_INVALID',
                name,
                target: worker
            });
            return null;
        }
        if (NWorkMgr.has(name)) {
            NWorkMgr.terminate(name);
        }

        const onBeforeDestroy = () => {
            worker.event.off('beforeDestroy', onBeforeDestroy);
            if (NWorkMgr.#workers?.get(name) === worker) {
                NWorkMgr.#workers.delete(name);
                if (NWorkMgr.#workers.size === 0) NWorkMgr.#workers = null;
            }
        };
        worker.event.on('beforeDestroy', onBeforeDestroy);

        if (!NWorkMgr.#workers) {
            NWorkMgr.#workers = new Map();
        }
        NWorkMgr.#workers.set(name, worker);
        return worker;
    }

    /**
     * Crée un pool de workers identiques ; les requêtes via `request(name, ...)`
     * sont automatiquement envoyées au worker le moins occupé.
     *
     * @param {string} name - Nom du pool.
     * @param {Object} options - Options de création communes à tous les membres.
     * @param {number} [size=NSys.cpuCores] - Nombre de workers dans le pool.
     * @returns {NWorker[]} Membres du pool créés.
     *
     * @example <caption>Exemple 1 : Pool dimensionné sur les cœurs CPU</caption>
     * NWorkMgr.createPool('hash', { url: './workers/hash.js' });
     *
     * @example <caption>Exemple 2 : Pool de 2 workers</caption>
     * const pool = NWorkMgr.createPool('pdf', { url: './pdf.js' }, 2);
     * console.log(pool.length); // 2
     */
    static createPool(name, options = {}, size = NSys.cpuCores) {
        if (NWorkMgr.has(name)) {
            NWorkMgr.terminate(name);
        }
        const count = Math.max(1, Math.trunc(Number(size) || 1));
        const list = [];

        for (let i = 0; i < count; i++) {
            const worker = NWorkMgr.#createManagedWorker({ ...options, name: `${name}#${i}` });
            const onDestroy = () => {
                worker.event.off('destroy', onDestroy);
                const pool = NWorkMgr.#pools?.get(name);
                if (!pool) return;
                const idx = pool.indexOf(worker);
                if (idx !== -1) pool.splice(idx, 1);
                if (pool.length === 0) {
                    NWorkMgr.#pools.delete(name);
                    if (NWorkMgr.#pools.size === 0) NWorkMgr.#pools = null;
                }
            };
            worker.event.on('destroy', onDestroy);
            list.push(worker);
        }

        if (!NWorkMgr.#pools) {
            NWorkMgr.#pools = new Map();
        }
        NWorkMgr.#pools.set(name, list);
        return list;
    }

    /**
     * Vérifie si un worker ou un pool porte ce nom.
     *
     * @param {string} name - Nom recherché.
     * @returns {boolean} `true` s'il existe.
     *
     * @example <caption>Exemple 1 : Worker existant</caption>
     * console.log(NWorkMgr.has('sql')); // true
     *
     * @example <caption>Exemple 2 : Nom inconnu</caption>
     * console.log(NWorkMgr.has('inconnu')); // false
     */
    static has(name) {
        return Boolean(NWorkMgr.#workers?.has(name) || NWorkMgr.#pools?.has(name));
    }

    /**
     * Retourne le worker portant ce nom ; pour un pool, retourne le membre le moins occupé.
     *
     * @param {string} name - Nom du worker ou du pool.
     * @returns {NWorker|null} Worker trouvé ou `null`.
     *
     * @example <caption>Exemple 1 : Récupérer un worker</caption>
     * const sql = NWorkMgr.get('sql');
     *
     * @example <caption>Exemple 2 : Membre le moins occupé d'un pool</caption>
     * const member = NWorkMgr.get('hash');
     * console.log(member.name); // ex: 'hash#1'
     */
    static get(name) {
        const single = NWorkMgr.#workers?.get(name);
        if (single) {
            return single;
        }
        const pool = NWorkMgr.#pools?.get(name);
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
     * @param {number|null} [timeout=null] - Délai d'attente maximum en millisecondes (30000ms par défaut).
     * @returns {Promise<{ id?: string, action: string, params: any, result: any, error?: any, success?: boolean, code?: string }>}
     *
     * @example <caption>Exemple 1 : Requête vers un worker</caption>
     * const res = await NWorkMgr.request('sql', 'query', { sql: 'SELECT * FROM users' });
     * console.log(res.result);
     *
     * @example <caption>Exemple 2 : Requête avec notification de progression et délai</caption>
     * const res = await NWorkMgr.request('download', 'fetch', { url: '...' }, (step) => {
     *     console.log('Avancement :', step.result);
     * }, 15000);
     */
    static async request(name, action, params = {}, onUpdate = null, timeout = null) {
        const worker = NWorkMgr.get(name);
        if (!worker) {
            NLog.warn(`NWorkMgr.request: Aucun worker ou pool nommé "${name}".`);
            return {
                success: false,
                code: 'WORKER_NOT_FOUND',
                action,
                params,
                result: {
                    error: 'WORKER_NOT_FOUND',
                    message: `Aucun worker ou pool nommé "${name}".`
                }
            };
        }
        return worker.request(action, params, onUpdate, timeout);
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
     * NWorkMgr.terminate('sql');
     *
     * @example <caption>Exemple 2 : Arrêter un pool</caption>
     * NWorkMgr.terminate('image'); // true
     */
    static terminate(name) {
        const single = NWorkMgr.#workers?.get(name);
        if (single) {
            single.destroy();
            return true;
        }
        const pool = NWorkMgr.#pools?.get(name);
        if (pool) {
            [...pool].forEach((w) => w.destroy());
            NWorkMgr.#pools?.delete(name);
            if (NWorkMgr.#pools && NWorkMgr.#pools.size === 0) NWorkMgr.#pools = null;
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
     * NWorkMgr.terminateAll();
     * console.log(NWorkMgr.size); // 0
     *
     * @example <caption>Exemple 2 : Chaînage avant nettoyage</caption>
     * if (NWorkMgr.size > 0) { NWorkMgr.terminateAll(); }
     */
    static terminateAll() {
        const all = [];
        NWorkMgr.#each((w) => all.push(w));
        all.forEach((w) => w.destroy());
        NWorkMgr.#workers = null;
        NWorkMgr.#pools = null;
        return all.length;
    }

    /**
     * Sérialise l'état du gestionnaire en objet JSON.
     *
     * @returns {{ size: number, workers: Object[], pools: Object<string, Object[]>, actions: string[] }}
     *
     * @example <caption>Exemple 1 : Diagnostic du gestionnaire</caption>
     * console.log(JSON.stringify(NWorkMgr.toJSON()));
     *
     * @example <caption>Exemple 2 : Vérifier les actions enregistrées</caption>
     * console.log(NWorkMgr.toJSON().actions); // ['requestApp', ...]
     */
    static toJSON() {
        const pools = {};
        if (NWorkMgr.#pools) {
            for (const [name, list] of NWorkMgr.#pools) {
                pools[name] = list.map((w) => ({
                    name: w.name,
                    isRunning: w.isRunning,
                    pendingCount: w.pendingCount
                }));
            }
        }
        return {
            size: NWorkMgr.size,
            workers: NWorkMgr.#workers
                ? Array.from(NWorkMgr.#workers.values()).map((w) => ({
                    name: w.name,
                    isRunning: w.isRunning,
                    pendingCount: w.pendingCount
                }))
                : [],
            pools,
            actions: NWorkMgr.#actions ? Array.from(NWorkMgr.#actions.keys()) : []
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
    static #each(fn) {
        if (NWorkMgr.#workers) {
            for (const w of Array.from(NWorkMgr.#workers.values())) fn(w);
        }
        if (NWorkMgr.#pools) {
            for (const list of Array.from(NWorkMgr.#pools.values())) {
                for (const w of [...list]) fn(w);
            }
        }
    }

}

export default NWorkMgr;
