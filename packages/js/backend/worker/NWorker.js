/**
 * @file NWorker.js
 * @package @nlib/js-backend
 * @description Classe universelle de gestion et de communication Web Worker dans l'écosystème NLib.
 *
 * Fonctionnement (Thread Principal <-> Web Worker avec communication bidirectionnelle, actions et progression `onUpdate`) :
 * 1. Création côté thread principal :
 *    - Depuis une URL de script : `new NWorker({ name: 'monWorker', url: './worker.js' })`
 *    - Depuis une fonction inline : `new NWorker({ name: 'monWorker', source: () => { ... } })`
 *    - Si l'environnement ne supporte pas les Web Workers (ou en cas d'échec du chargement du worker),
 *      `NWorker` bascule automatiquement en mode repli (*fallback direct*) sans bloquer l'application.
 * 2. Préchauffage et confirmation d'exécution :
 *    - Un message handshake `{ id: 'ping', action: 'ping' }` est envoyé pour valider que le Web Worker
 *      tourne activement (`isRunning`). Si confirmé, l'événement `'running'` est émis.
 * 3. Enregistrement des actions :
 *    - Actions exécutées dans le Worker : `NWorker.addActionInstance(action, initFunction)`
 * 4. Communication Main -> Worker (`async request(action, params, onUpdate)`) :
 *    - Envoie `{ id, action, params, hasUpdateHandler }` vers le Web Worker.
 *    - `params.onUpdate(stepResult)` dans le worker transmet des notifications intermédiaires (`keep: true`).
 * 5. Communication inverse Worker -> Main (`NWorker.requestMain(action, params, onUpdate)`) :
 *    - Le Worker envoie `{ id, action, params, hasUpdateHandler, reverse: true }` vers le Main.
 *    - Le Main traite la requête via sa méthode d'instance `onRequest(action, params, onUpdate)`,
 *      conçue pour être surchargée dans une classe enfant.
 */

import { NObject } from '../core/NObject.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * @class NWorker
 * @extends NObject
 * @description Gestionnaire de communication par messages bidirectionnelle (Main <-> Worker) avec prise en charge
 * du repli local (fallback) si les Web Workers ne sont pas disponibles.
 *
 * @example <caption>Exemple 1 : Instanciation et exécution d'une requête Main -> Worker</caption>
 * const worker = new NWorker({ name: 'calc', url: './calcWorker.js' });
 * const response = await worker.request('addition', { a: 10, b: 20 });
 * console.log(response.result); // 30
 *
 * @example <caption>Exemple 2 : Requête inverse Worker -> Main via NWorker.requestMain()</caption>
 * // Côté Main :
 * class AppWorker extends NWorker {
 *     async onRequest(action, params, onUpdate) {
 *         if (action === 'getConfig') return { theme: 'dark' };
 *         return super.onRequest(action, params, onUpdate);
 *     }
 * }
 * const worker = new AppWorker({ name: 'app', url: './calcWorker.js' });
 *
 * // Côté Worker (dans calcWorker.js) :
 * const config = await NWorker.requestMain('getConfig');
 * console.log(config.result.theme); // 'dark'
 *
 * @example <caption>Exemple 3 : Requête avec notification d'avancement (onUpdate)</caption>
 * const response = await worker.request(
 *     'download',
 *     { url: 'https://example.com/data.zip' },
 *     (progress) => console.log('Progression :', progress.result)
 * );
 * console.log('Terminé :', response.result);
 */
export class NWorker extends NObject {

    // =========================================================================
    // Propriétés statiques privées
    // =========================================================================

    /**
     * Dictionnaire d'enregistrement des instances ou fabriques d'actions du Worker.
     * @type {Object<string, { initFunction?: Function, instance?: any }>|null}
     * @private
     */
    static #actionsInstances = null;

    // =========================================================================
    // Propriétés d'instance privées
    // =========================================================================

    /**
     * Nom logique du worker.
     * @type {string}
     * @private
     */
    #name = 'worker';

    /**
     * Instance native `Worker` (côté thread principal) ou `null` si non supporté ou en repli local.
     * @type {Worker|any}
     * @private
     */
    #worker = null;

    /**
     * URL Blob créée lorsque le worker est instancié avec `options.source` (révoquée à l'arrêt).
     * @type {string|null}
     * @private
     */
    #blobUrl = null;

    /**
     * Table des requêtes en cours (`id -> { id, action, params, resolve, onUpdate }`).
     * Initialisée paresseusement à la première requête.
     * @type {Map<string, { id: string, action: string, params: any, resolve: Function, onUpdate: Function|null }>|null}
     * @private
     */
    #requests = null;

    /**
     * Indique si le worker a été arrêté manuellement.
     * @type {boolean}
     * @private
     */
    #terminated = false;

    /**
     * Indique si le Web Worker sous-jacent a validé son démarrage (après réponse au ping).
     * @type {boolean}
     * @private
     */
    #isRunning = false;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une instance de `NWorker`.
     * - Tente d'initialiser un Web Worker natif si supporté par l'environnement.
     * - Si l'environnement ne supporte pas les Web Workers ou si le script échoue,
     *   l'instance bascule en repli local sans lever d'exception bloquante.
     *
     * @param {Object} [options={}] - Options de configuration du worker.
     * @param {string} [options.name='worker'] - Nom d'identification du worker.
     * @param {string|URL} [options.url] - URL ou chemin vers le script du Worker.
     * @param {Function|string} [options.source] - Code source JavaScript direct ou fonction inline (Blob).
     * @param {'module'|'classic'} [options.type='module'] - Type de module du Worker.
     * @param {Object<string, any>} [options.state] - État initial transmis à `NObject`.
     *
     * @example <caption>Exemple 1 : Créer un worker depuis un script module</caption>
     * const worker = new NWorker({ name: 'imageProcessor', url: './processor.js' });
     *
     * @example <caption>Exemple 2 : Créer un worker inline depuis une fonction</caption>
     * const worker = new NWorker({
     *     name: 'inlineWorker',
     *     source: () => { console.log('Worker en ligne'); }
     * });
     */
    constructor(options = {}) {
        super({ state: options?.state, autoInit: false });

        if (typeof options?.name === 'string' && options.name.trim().length > 0) {
            this.#name = options.name.trim();
        }

        if (NUtil.env.isWorker && typeof self !== 'undefined') {
            this.util.log.error('NWorker: Les Web Workers ne sont pas supportés au sein d\'un Web Worker.', {
                code: 'WORKER_UNSUPPORTED_IN_WORKER',
                name: this.#name
            });
            this.#worker = null;
            this.#isRunning = false;
            this.initialize();
            return;
        }

        if (typeof Worker !== 'undefined' && (options?.url || options?.source)) {
            try {
                let targetUrl = options.url;
                if (!targetUrl) {
                    const code = typeof options.source === 'function'
                        ? `(${options.source.toString()})();`
                        : String(options.source);
                    this.#blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
                    targetUrl = this.#blobUrl;
                }

                this.#worker = new Worker(targetUrl, {
                    type: options.type ?? 'module',
                    name: this.#name
                });

                this.#worker.onmessage = (event) => {
                    const data = event?.data;
                    if (data?.id === 'ping' && data?.action === 'ping') {
                        this.#isRunning = true;
                        this.event.emit('running', { target: this });
                    } else if (data?.reverse === true) {
                        this.#handleReverseRequest(data);
                    } else {
                        this.#onMessage(data);
                    }
                };

                this.#worker.onerror = (err) => {
                    this.util.log.error(`NWorker [${this.#name}]: Erreur interceptée sur le worker natif.`, {
                        code: 'ERR_WORKER_EXECUTION',
                        name: this.#name,
                        cause: err
                    });
                    this.#worker = null;
                    this.#isRunning = false;
                    this.event.emit('error', err);
                };

                this.#worker.postMessage({
                    id: 'ping',
                    action: 'ping'
                });
            } catch (err) {
                // Repli local en cas d'échec de création du Worker natif (ex: CSP, sandbox)
                this.util.log.warn(`NWorker [${this.#name}]: Impossible d'instancier le Worker natif, bascule en mode repli.`, {
                    code: 'WARN_WORKER_FALLBACK',
                    name: this.#name,
                    cause: err
                });
                this.#worker = null;
                this.#isRunning = false;
            }
        }

        this.initialize();
    }

    // =========================================================================
    // Méthodes statiques d'enregistrement d'actions (Contexte Worker)
    // =========================================================================

    /**
     * Récupère ou instancie paresseusement l'objet gestionnaire associé à une action du Worker.
     *
     * @param {string} action - Nom de l'action ciblée.
     * @returns {Object|null} Instance du gestionnaire d'action ou `null` si non trouvé.
     *
     * @example <caption>Exemple 1 : Récupérer une instance d'action</caption>
     * const handler = NWorker.getActionInstance('sql');
     * if (handler) { await handler.request({ query: 'SELECT 1' }); }
     *
     * @example <caption>Exemple 2 : Action non enregistrée</caption>
     * console.log(NWorker.getActionInstance('inconnu')); // null
     */
    static getActionInstance(action) {
        if (!this.#actionsInstances || !action) {
            return null;
        }

        const entry = this.#actionsInstances[action];
        if (!entry) {
            return null;
        }

        if (entry.instance) {
            return entry.instance;
        }

        if (typeof entry.initFunction === 'function') {
            entry.instance = entry.initFunction();
            return entry.instance;
        }

        return null;
    }

    /**
     * Enregistre une fabrique ou une fonction d'initialisation pour une action spécifique dans le Worker.
     *
     * @param {string} action - Identifiant de l'action.
     * @param {Function} initFunction - Fonction retournant l'instance du gestionnaire doté d'une méthode `request(params)`.
     *
     * @example <caption>Exemple 1 : Enregistrer un module de calcul</caption>
     * NWorker.addActionInstance('calc', () => ({
     *     request: async (p) => p.a * p.b
     * }));
     *
     * @example <caption>Exemple 2 : Enregistrer avec un handler d'instance</caption>
     * NWorker.addActionInstance('crypto', () => new CryptoHandler());
     */
    static addActionInstance(action, initFunction) {
        if (typeof action !== 'string' || !action.trim() || typeof initFunction !== 'function') {
            return;
        }

        if (!this.#actionsInstances) {
            this.#actionsInstances = {};
        }

        this.#actionsInstances[action] = {
            initFunction
        };
    }

    // =========================================================================
    // Getters d'instance
    // =========================================================================

    /**
     * Retourne le nom logique du worker.
     *
     * @returns {string} Nom du worker.
     *
     * @example <caption>Exemple 1 : Obtenir le nom</caption>
     * const worker = new NWorker({ name: 'parser', url: './parser.js' });
     * console.log(worker.name); // 'parser'
     *
     * @example <caption>Exemple 2 : Nom par défaut</caption>
     * const worker = new NWorker({ url: './task.js' });
     * console.log(worker.name); // 'worker'
     */
    get name() {
        return this.#name;
    }

    /**
     * Indique si le Web Worker est actif et a confirmé sa disponibilité par handshake.
     *
     * @returns {boolean} `true` si le Web Worker natif tourne activement.
     *
     * @example <caption>Exemple 1 : Vérifier la disponibilité du Web Worker</caption>
     * console.log(worker.isRunning); // true ou false
     *
     * @example <caption>Exemple 2 : Après terminaison</caption>
     * worker.terminate();
     * console.log(worker.isRunning); // false
     */
    get isRunning() {
        return this.#isRunning;
    }

    /**
     * Retourne le nombre de requêtes actuellement en attente de réponse dans le Web Worker.
     *
     * @returns {number} Nombre de requêtes en attente.
     *
     * @example <caption>Exemple 1 : Aucune requête en cours</caption>
     * console.log(worker.pendingCount); // 0
     *
     * @example <caption>Exemple 2 : Vérification avant terminaison</caption>
     * if (worker.pendingCount === 0) { worker.terminate(); }
     */
    get pendingCount() {
        return this.#requests ? this.#requests.size : 0;
    }

    // =========================================================================
    // Méthodes publiques — Envoi de Requêtes (Main -> Worker)
    // =========================================================================

    /**
     * Envoie une requête d'action au Web Worker (ou l'exécute en local si le Worker n'est pas disponible).
     * Protégée par un délai d'attente configurable (timeout, 30s par défaut).
     *
     * @param {string} action - Nom de l'action à exécuter.
     * @param {Object} [params={}] - Paramètres d'entrée transmis à l'action (peut contenir `params.timeout`).
     * @param {Function|null} [onUpdate=null] - Callback optionnel `(step) => void` appelé lors des progressions intermédiaires.
     * @param {number|null} [timeout=null] - Délai d'attente maximum en millisecondes (30000ms par défaut, 0 pour désactiver).
     * @returns {Promise<{ id?: string, action: string, params: any, result: any, error?: any, success?: boolean, code?: string }>} Résultat de la requête.
     *
     * @example <caption>Exemple 1 : Appel direct d'une action avec délai par défaut (30s)</caption>
     * const res = await worker.request('sum', { list: [1, 2, 3, 4] });
     * console.log(res.result); // 10
     *
     * @example <caption>Exemple 2 : Appel avec timeout personnalisé et suivi de progression</caption>
     * const res = await worker.request(
     *     'download',
     *     { url: 'https://example.com/file' },
     *     (step) => console.log('Progression :', step.result),
     *     15000 // 15 secondes max
     * );
     */
    async request(action, params = {}, onUpdate = null, timeout = null) {
        const id = NUtil.uid('req_');
        const hasUpdateHandler = typeof onUpdate === 'function';
        const timeoutMs = (typeof timeout === 'number' && timeout >= 0)
            ? timeout
            : ((params && typeof params.timeout === 'number' && params.timeout >= 0)
                ? params.timeout
                : 30000);

        // 1. Mode repli local : pas de Web Worker natif disponible
        if (!this.#worker) {
            const rawParams = params && typeof params === 'object'
                ? params
                : { value: params };
            const cleanParams = { ...rawParams };

            if (hasUpdateHandler) {
                rawParams.onUpdate = (stepResult) => {
                    onUpdate({
                        id,
                        action,
                        params: cleanParams,
                        result: stepResult
                    });
                };
            }

            const actionInstance = NWorker.getActionInstance(action);
            if (!actionInstance || typeof actionInstance.request !== 'function') {
                this.util.log.warn(`NWorker [${this.#name}]: Action "${action}" non enregistrée ou méthode request() absente.`);
                return {
                    success: false,
                    code: 'WORKER_ACTION_ERROR',
                    id,
                    action,
                    params: cleanParams,
                    result: {
                        error: 'WORKER_ACTION_ERROR',
                        message: `Action "${action}" non enregistrée ou méthode request() absente.`
                    }
                };
            }

            try {
                let timer = null;
                const promise = actionInstance.request(rawParams);
                const result = timeoutMs > 0
                    ? await Promise.race([
                        promise,
                        new Promise((_, rejectTimeout) => {
                            timer = setTimeout(() => {
                                rejectTimeout(new Error('TIMEOUT'));
                            }, timeoutMs);
                        })
                    ])
                    : await promise;
                if (timer) clearTimeout(timer);
                return {
                    success: true,
                    id,
                    action,
                    params: cleanParams,
                    result
                };
            } catch (err) {
                if (err?.message === 'TIMEOUT') {
                    this.util.log.warn(`NWorker [${this.#name}]: Délai d'attente dépassé (${timeoutMs}ms) pour l'action locale "${action}".`, {
                        code: 'ERR_TIMEOUT',
                        action,
                        timeout: timeoutMs
                    });
                    return {
                        success: false,
                        code: 'ERR_TIMEOUT',
                        error: 'WORKER_TIMEOUT',
                        id,
                        action,
                        params: cleanParams,
                        result: {
                            error: 'WORKER_TIMEOUT',
                            message: `Délai d'attente dépassé (${timeoutMs}ms) pour l'action locale "${action}".`
                        }
                    };
                }
                this.util.log.error(`NWorker [${this.#name}]: Erreur lors de l'exécution locale de l'action "${action}".`, {
                    code: 'WORKER_REQUEST_ERROR',
                    cause: err
                });
                return {
                    success: false,
                    code: 'WORKER_REQUEST_ERROR',
                    id,
                    action,
                    params: cleanParams,
                    result: {
                        error: 'WORKER_REQUEST_ERROR',
                        message: err?.message ?? String(err)
                    }
                };
            }
        }

        // 2. Vérification de l'état du Web Worker
        if (this.#terminated) {
            return {
                success: false,
                code: 'WORKER_TERMINATED',
                id,
                action,
                params,
                result: {
                    error: 'WORKER_TERMINATED',
                    message: `Le worker "${this.#name}" a été arrêté.`
                }
            };
        }

        if (!this.isRunning) {
            return {
                success: false,
                code: 'WORKER_NO_RUNNING',
                id,
                action,
                params,
                result: {
                    error: 'WORKER_NO_RUNNING',
                    message: `Le worker "${this.#name}" n'a pas encore confirmé son démarrage.`
                }
            };
        }

        // 3. Envoi via postMessage vers le Web Worker
        if (!this.#requests) {
            this.#requests = new Map();
        }

        return new Promise((resolve) => {
            let timer = null;

            const safeResolve = (val) => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                resolve(val);
            };

            const triggerTimeout = () => {
                this.#removeRequest(id);
                this.util.log.warn(`NWorker [${this.#name}]: Délai d'attente dépassé (${timeoutMs}ms) pour l'action "${action}".`, {
                    code: 'ERR_TIMEOUT',
                    id,
                    action,
                    timeout: timeoutMs
                });
                safeResolve({
                    success: false,
                    code: 'ERR_TIMEOUT',
                    error: 'WORKER_TIMEOUT',
                    id,
                    action,
                    params,
                    result: {
                        error: 'WORKER_TIMEOUT',
                        message: `Délai d'attente dépassé (${timeoutMs}ms) pour l'action "${action}".`
                    }
                });
            };

            if (timeoutMs > 0) {
                timer = setTimeout(triggerTimeout, timeoutMs);
            }

            const requestEntry = {
                id,
                action,
                params,
                timer,
                resolve: safeResolve,
                onUpdate: hasUpdateHandler ? onUpdate : null,
                refreshTimer: () => {
                    if (timer && timeoutMs > 0) {
                        clearTimeout(timer);
                        timer = setTimeout(triggerTimeout, timeoutMs);
                        requestEntry.timer = timer;
                    }
                }
            };

            this.#requests.set(id, requestEntry);

            try {
                this.#worker.postMessage({
                    id,
                    action,
                    params,
                    hasUpdateHandler
                });
            } catch (err) {
                this.#removeRequest(id);
                this.util.log.error(`NWorker [${this.#name}]: Échec de postMessage pour l'action "${action}".`, {
                    code: 'WORKER_POST_ERROR',
                    cause: err
                });
                safeResolve({
                    success: false,
                    code: 'WORKER_POST_ERROR',
                    id,
                    action,
                    params,
                    result: {
                        error: 'WORKER_POST_ERROR',
                        message: err?.message ?? String(err)
                    }
                });
            }
        });
    }

    // =========================================================================
    // Méthodes publiques — Cycle de vie et Nettoyage
    // =========================================================================

    /**
     * Arrête le Web Worker, résout immédiatement les requêtes en attente avec un statut d'erreur et libère les ressources.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Arrêt propre d'un worker</caption>
     * worker.terminate();
     *
     * @example <caption>Exemple 2 : Confirmation de l'état arrêté</caption>
     * worker.terminate();
     * console.log(worker.isRunning); // false
     */
    terminate() {
        if (this.#terminated) {
            return this;
        }
        this.#terminated = true;
        this.#isRunning = false;

        if (this.#requests) {
            for (const [id, entry] of this.#requests.entries()) {
                if (entry.timer) {
                    clearTimeout(entry.timer);
                    entry.timer = null;
                }
                entry.resolve({
                    success: false,
                    code: 'WORKER_TERMINATED',
                    id,
                    action: entry.action,
                    params: entry.params,
                    result: {
                        error: 'WORKER_TERMINATED',
                        message: `Le worker "${this.#name}" a été arrêté.`
                    }
                });
            }
            this.#requests.clear();
            this.#requests = null;
        }

        if (this.#worker) {
            this.#worker.onmessage = null;
            this.#worker.onerror = null;

            if (NUtil.env.isBrowser && typeof this.#worker.terminate === 'function') {
                this.#worker.terminate();
            }
            this.#worker = null;
        }

        if (this.#blobUrl) {
            URL.revokeObjectURL(this.#blobUrl);
            this.#blobUrl = null;
        }

        return this;
    }

    /**
     * Détruit l'instance `NWorker` et nettoie les références mémoire associées.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Destruction en fin de vie</caption>
     * worker.destroy();
     *
     * @example <caption>Exemple 2 : Confirmation de l'état détruit</caption>
     * worker.destroy();
     * console.log(worker.isDestroyed); // true
     */
    destroy() {
        this.terminate();
        super.destroy();
    }

    // =========================================================================
    // Méthodes publiques & privées — Requêtes Inverses (Worker -> Main)
    // =========================================================================

    /**
     * Gestionnaire des requêtes inverses émises par le Worker vers le thread principal.
     * À surcharger dans une classe enfant pour traiter les actions demandées par le Worker.
     * La classe de base retourne une erreur si l'action n'est pas gérée.
     *
     * @method onRequest
     * @param {string} action - Nom de l'action demandée par le Worker
     * @param {Object} params - Paramètres transmis par le Worker
     * @param {Function|null} onUpdate - Callback de progression optionnel,
     *   à appeler avec un résultat intermédiaire pour signaler l'avancement
     * @returns {Promise<any>} Résultat à renvoyer au Worker
     *
     * @example <caption>Exemple 1 : Surcharge simple dans une classe enfant</caption>
     * class AppWorker extends NWorker {
     *     async onRequest(action, params, onUpdate) {
     *         switch (action) {
     *             case 'getConfig':
     *                 return { theme: 'dark', lang: 'fr' };
     *             case 'saveData':
     *                 await Database.save(params.data);
     *                 return { saved: true };
     *             default:
     *                 return super.onRequest(action, params, onUpdate);
     *         }
     *     }
     * }
     *
     * @example <caption>Exemple 2 : Avec progression onUpdate</caption>
     * class AppWorker extends NWorker {
     *     async onRequest(action, params, onUpdate) {
     *         if (action === 'loadItems') {
     *             const items = await DB.getAll();
     *             for (const item of items) {
     *                 onUpdate?.({ loaded: item.id });
     *             }
     *             return { total: items.length };
     *         }
     *         return super.onRequest(action, params, onUpdate);
     *     }
     * }
     *
     * @example <caption>Exemple 3 : Accès aux propriétés privées de l'instance</caption>
     * class GestPOSWorker extends NWorker {
     *     #db = null;
     *     constructor(options) {
     *         super(options);
     *         this.#db = options.db;
     *     }
     *     async onRequest(action, params, onUpdate) {
     *         if (action === 'getProductById') {
     *             return this.#db.products.findById(params.id);
     *         }
     *         return super.onRequest(action, params, onUpdate);
     *     }
     * }
     *
     * @note Doit toujours appeler super.onRequest() dans le cas default
     *   pour garantir un message d'erreur propre sur les actions non gérées
     * @note onUpdate peut être null si le Worker n'a pas passé de handler
     * @see NWorker#request pour le sens inverse (Main → Worker)
     * @see NWorker.requestMain pour l'appel depuis le Worker
     */
    async onRequest(action, params, onUpdate) {
        return {
            success: false,
            code: 'MAIN_ACTION_NOT_HANDLED',
            error: 'MAIN_ACTION_NOT_HANDLED',
            message: `Action "${action}" non gérée. Surcharger onRequest() dans une classe enfant.`
        };
    }

    /**
     * Traite une requête inverse émise par le Worker vers le thread principal.
     * Délègue l'exécution à la méthode onRequest() — à surcharger dans les classes enfant.
     * Renvoie automatiquement le résultat ou l'erreur au Worker via postMessage.
     *
     * @private
     * @param {object} data - Charge utile reçue du Worker via postMessage
     * @param {string} data.id - Identifiant unique de la requête
     * @param {string} data.action - Nom de l'action demandée
     * @param {any} data.params - Paramètres de la requête
     * @param {boolean} data.hasUpdateHandler - Indique si le Worker attend des mises à jour intermédiaires
     */
    async #handleReverseRequest(data) {
        const { id, action, hasUpdateHandler } = data;

        const rawParams = data.params && typeof data.params === 'object'
            ? data.params
            : { value: data.params };
        const cleanParams = { ...rawParams };

        const onUpdate = hasUpdateHandler
            ? (stepResult) => {
                  this.#worker?.postMessage({
                      id,
                      action,
                      params: cleanParams,
                      result: stepResult,
                      reverseResponse: true,
                      keep: true
                  });
              }
            : null;

        try {
            const result = await this.onRequest(action, rawParams, onUpdate);
            this.#worker?.postMessage({
                id,
                action,
                params: cleanParams,
                result,
                reverseResponse: true,
                keep: false
            });
        } catch (err) {
            this.#worker?.postMessage({
                id,
                action,
                params: cleanParams,
                result: {
                    error: 'MAIN_REQUEST_ERROR',
                    message: err?.message ?? String(err)
                },
                reverseResponse: true,
                keep: false
            });
        }
    }

    /**
     * Supprime une requête identifiée de la table interne et réinitialise la Map si elle devient vide.
     *
     * @private
     * @param {string} id - Identifiant de la requête à retirer.
     *
     * @example <caption>Exemple 1 : Retrait après réponse reçue</caption>
     * // this.#removeRequest(id);
     *
     * @example <caption>Exemple 2 : Réinitialisation mémoire automatique</caption>
     * // if (this.#requests.size === 0) this.#requests = null;
     */
    #removeRequest(id) {
        if (!this.#requests) {
            return;
        }
        const entry = this.#requests.get(id);
        if (entry?.timer) {
            clearTimeout(entry.timer);
            entry.timer = null;
        }
        this.#requests.delete(id);
        if (this.#requests.size === 0) {
            this.#requests = null;
        }
    }

    /**
     * Réceptionne et traite les messages envoyés par le Web Worker vers le thread principal.
     *
     * @private
     * @param {any} data - Charge utile reçue via postMessage.
     *
     * @example <caption>Exemple 1 : Notification de progression (keep === true)</caption>
     * // data = { id: 'req_1', params: {}, result: { percent: 50 }, keep: true }
     *
     * @example <caption>Exemple 2 : Réponse finale (keep === false)</caption>
     * // data = { id: 'req_1', params: {}, result: 'OK', keep: false }
     */
    #onMessage(data) {
        if (this.#terminated || !data || typeof data !== 'object') {
            return;
        }

        if (!this.#requests || !this.#requests.has(data.id)) {
            return;
        }

        const entry = this.#requests.get(data.id);
        const hasError = Boolean(data.error || (data.result && typeof data.result === 'object' && data.result.error));
        const response = {
            success: !hasError,
            id: data.id,
            action: data.action ?? entry.action,
            params: data.params,
            result: data.result
        };

        if (hasError) {
            response.code = data.error || data.result?.error || 'WORKER_ERROR';
            if (data.error) {
                response.error = data.error;
            }
        }

        // Si keep === true : message intermédiaire de progression émis par onUpdate() côté Worker
        if (data.keep === true) {
            entry.refreshTimer?.();
            if (typeof entry.onUpdate === 'function') {
                entry.onUpdate(response);
            }
            return;
        }

        // Si keep === false : réponse finale, on décharge la requête et on résout la promesse
        this.#removeRequest(data.id);
        entry.resolve(response);
    }

    // =========================================================================
    // Méthode statique de communication inverse (Worker -> Main)
    // =========================================================================

    /**
     * Envoie une requête du Worker vers le thread principal et attend la réponse.
     * Protégée par un délai d'attente configurable (timeout, 30s par défaut).
     * À appeler UNIQUEMENT depuis le contexte d'un Web Worker.
     *
     * @static
     * @param {string} action - Nom de l'action Main ciblée.
     * @param {Object} [params={}] - Paramètres transmis au Main (peut contenir `params.timeout`).
     * @param {Function|null} [onUpdate=null] - Callback de progression optionnel.
     * @param {number|null} [timeout=null] - Délai d'attente maximum en millisecondes (30000ms par défaut, 0 pour désactiver).
     * @returns {Promise<{ id: string, action: string, params: any, result: any, error?: any, success?: boolean, code?: string }>} Réponse de l'action Main.
     *
     * @example <caption>Exemple 1 : Récupérer des réglages depuis le Main avec délai par défaut (30s)</caption>
     * const config = await NWorker.requestMain('getConfig', { key: 'theme' });
     * console.log(config.result);
     *
     * @example <caption>Exemple 2 : Appel avec progression et délai personnalisé</caption>
     * const res = await NWorker.requestMain('heavyMainTask', { count: 100 }, (step) => {
     *     console.log('Progression Main :', step.result);
     * }, 15000);
     */
    static async requestMain(action, params = {}, onUpdate = null, timeout = null) {
        if (typeof self === 'undefined' || typeof self._NWorkerRequestMain !== 'function') {
            return {
                success: false,
                code: 'NOT_IN_WORKER',
                action,
                params,
                result: {
                    error: 'NOT_IN_WORKER',
                    message: 'requestMain() doit être appelé depuis un Web Worker.'
                }
            };
        }
        return self._NWorkerRequestMain(action, params, onUpdate, timeout);
    }

    // =========================================================================
    // Bloc d'initialisation statique (Contexte Web Worker)
    // =========================================================================

    static {
        if (typeof window === 'undefined' && typeof self !== 'undefined') {

            const reverseRequests = new Map();

            self._NWorkerRequestMain = (action, params = {}, onUpdate = null, timeout = null) => {
                const id = NUtil.uid('rev_');
                const hasUpdateHandler = typeof onUpdate === 'function';
                const timeoutMs = (typeof timeout === 'number' && timeout >= 0)
                    ? timeout
                    : ((params && typeof params.timeout === 'number' && params.timeout >= 0)
                        ? params.timeout
                        : 30000);

                return new Promise((resolve) => {
                    let timer = null;

                    const safeResolve = (val) => {
                        if (timer) {
                            clearTimeout(timer);
                            timer = null;
                        }
                        resolve(val);
                    };

                    const triggerTimeout = () => {
                        reverseRequests.delete(id);
                        NUtil.log.warn(`NWorker [WorkerContext]: Délai d'attente dépassé (${timeoutMs}ms) pour requestMain("${action}").`, {
                            code: 'ERR_TIMEOUT',
                            id,
                            action,
                            timeout: timeoutMs
                        });
                        safeResolve({
                            success: false,
                            code: 'ERR_TIMEOUT',
                            error: 'MAIN_TIMEOUT',
                            id,
                            action,
                            params,
                            result: {
                                error: 'MAIN_TIMEOUT',
                                message: `Délai d'attente dépassé (${timeoutMs}ms) pour la requête inverse vers le Main "${action}".`
                            }
                        });
                    };

                    if (timeoutMs > 0) {
                        timer = setTimeout(triggerTimeout, timeoutMs);
                    }

                    const requestEntry = {
                        resolve: safeResolve,
                        onUpdate,
                        timer,
                        refreshTimer: () => {
                            if (timer && timeoutMs > 0) {
                                clearTimeout(timer);
                                timer = setTimeout(triggerTimeout, timeoutMs);
                                requestEntry.timer = timer;
                            }
                        }
                    };

                    reverseRequests.set(id, requestEntry);

                    try {
                        self.postMessage({
                            id, action, params,
                            hasUpdateHandler,
                            reverse: true
                        });
                    } catch (err) {
                        if (timer) {
                            clearTimeout(timer);
                            timer = null;
                        }
                        reverseRequests.delete(id);
                        NUtil.log.error(`NWorker [WorkerContext]: Échec postMessage pour requestMain("${action}").`, {
                            code: 'WORKER_POST_ERROR',
                            cause: err
                        });
                        safeResolve({
                            success: false,
                            code: 'WORKER_POST_ERROR',
                            action,
                            params,
                            result: {
                                error: 'WORKER_POST_ERROR',
                                message: err?.message ?? String(err)
                            }
                        });
                    }
                });
            };

            self.addEventListener('message', async (event) => {
                const data = event.data;
                if (!data || typeof data !== 'object' || !data.id) return;

                const { id, action, hasUpdateHandler } = data;

                // Handshake
                if (id === 'ping' && action === 'ping') {
                    self.postMessage({ id, action, result: 1, keep: false });
                    return;
                }

                // Réponse du Main vers le Worker (suite à une requête inverse)
                if (data.reverseResponse === true) {
                    const entry = reverseRequests.get(id);
                    if (!entry) return;
                    const response = { id, action, params: data.params, result: data.result };
                    if (data.keep === true) {
                        entry.refreshTimer?.();
                        entry.onUpdate?.(response);
                        return;
                    }
                    if (entry.timer) {
                        clearTimeout(entry.timer);
                        entry.timer = null;
                    }
                    reverseRequests.delete(id);
                    entry.resolve(response);
                    return;
                }

                // Requête normale Main → Worker (code original inchangé)
                const rawParams = data.params && typeof data.params === 'object'
                    ? data.params
                    : { value: data.params };
                const cleanParams = { ...rawParams };

                if (hasUpdateHandler) {
                    rawParams.onUpdate = (stepResult) => {
                        self.postMessage({
                            id, action,
                            params: cleanParams,
                            result: stepResult,
                            keep: true
                        });
                    };
                }

                const actionInstance = NWorker.getActionInstance(action);
                if (!actionInstance || typeof actionInstance.request !== 'function') {
                    NUtil.log.warn(`NWorker [WorkerContext]: Action "${action}" non enregistrée ou méthode request() absente.`);
                    self.postMessage({
                        id, action, params: cleanParams,
                        result: {
                            error: 'WORKER_ACTION_ERROR',
                            message: `Action "${action}" non enregistrée ou méthode request() absente.`
                        },
                        keep: false
                    });
                    return;
                }

                try {
                    const result = await actionInstance.request(rawParams);
                    self.postMessage({ id, action, params: cleanParams, result, keep: false });
                } catch (err) {
                    NUtil.log.error(`NWorker [WorkerContext]: Erreur lors de l'exécution de l'action "${action}".`, {
                        code: 'WORKER_REQUEST_ERROR',
                        cause: err
                    });
                    self.postMessage({
                        id, action, params: cleanParams,
                        result: {
                            error: 'WORKER_REQUEST_ERROR',
                            message: err?.message ?? String(err)
                        },
                        keep: false
                    });
                }
            });
        }
    }
}

export default NWorker;
