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
import { NException } from '../core/NException.js';
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
     * @throws {NException} Si appelé à l'intérieur même d'un Web Worker (`WORKER_UNSUPPORTED_IN_WORKER`).
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
            throw new NException(
                'Les Web Workers ne sont pas supportés dans un Web Worker.',
                { code: 'WORKER_UNSUPPORTED_IN_WORKER' }
            );
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
     *
     * @param {string} action - Nom de l'action à exécuter.
     * @param {Object} [params={}] - Paramètres d'entrée transmis à l'action.
     * @param {Function|null} [onUpdate=null] - Callback optionnel `(step) => void` appelé lors des progressions intermédiaires.
     * @returns {Promise<{ id?: string, action: string, params: any, result: any, error?: any }>} Résultat de la requête.
     *
     * @example <caption>Exemple 1 : Appel direct d'une action</caption>
     * const res = await worker.request('sum', { list: [1, 2, 3, 4] });
     * console.log(res.result); // 10
     *
     * @example <caption>Exemple 2 : Appel avec suivi de progression (onUpdate)</caption>
     * const res = await worker.request(
     *     'download',
     *     { url: 'https://example.com/file' },
     *     (step) => console.log('Progression :', step.result)
     * );
     */
    async request(action, params = {}, onUpdate = null) {
        const id = NUtil.uid('req_');
        const hasUpdateHandler = typeof onUpdate === 'function';

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
                return {
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
                const result = await actionInstance.request(rawParams);
                return {
                    id,
                    action,
                    params: cleanParams,
                    result
                };
            } catch (err) {
                return {
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
            this.#requests.set(id, {
                id,
                action,
                params,
                resolve,
                onUpdate: hasUpdateHandler ? onUpdate : null
            });

            try {
                this.#worker.postMessage({
                    id,
                    action,
                    params,
                    hasUpdateHandler
                });
            } catch (err) {
                this.#removeRequest(id);
                resolve({
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
                entry.resolve({
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
        const response = {
            id: data.id,
            action: data.action ?? entry.action,
            params: data.params,
            result: data.result
        };

        if (data.error) {
            response.error = data.error;
        }

        // Si keep === true : message intermédiaire de progression émis par onUpdate() côté Worker
        if (data.keep === true) {
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
     * À appeler UNIQUEMENT depuis le contexte d'un Web Worker.
     *
     * @static
     * @param {string} action - Nom de l'action Main ciblée.
     * @param {Object} [params={}] - Paramètres transmis au Main.
     * @param {Function|null} [onUpdate=null] - Callback de progression optionnel.
     * @returns {Promise<{ id: string, action: string, params: any, result: any, error?: any }>} Réponse de l'action Main.
     *
     * @example <caption>Exemple 1 : Récupérer des réglages depuis le Main</caption>
     * const config = await NWorker.requestMain('getConfig', { key: 'theme' });
     * console.log(config.result);
     *
     * @example <caption>Exemple 2 : Appel avec progression depuis le Worker vers le Main</caption>
     * const res = await NWorker.requestMain('heavyMainTask', { count: 100 }, (step) => {
     *     console.log('Progression Main :', step.result);
     * });
     */
    static async requestMain(action, params = {}, onUpdate = null) {
        if (typeof self === 'undefined' || typeof self._NWorkerRequestMain !== 'function') {
            return {
                action, params,
                result: {
                    error: 'NOT_IN_WORKER',
                    message: 'requestMain() doit être appelé depuis un Web Worker.'
                }
            };
        }
        return self._NWorkerRequestMain(action, params, onUpdate);
    }

    // =========================================================================
    // Bloc d'initialisation statique (Contexte Web Worker)
    // =========================================================================

    static {
        if (typeof window === 'undefined' && typeof self !== 'undefined') {

            const reverseRequests = new Map();

            self._NWorkerRequestMain = (action, params = {}, onUpdate = null) => {
                const id = NUtil.uid('rev_');
                const hasUpdateHandler = typeof onUpdate === 'function';
                return new Promise((resolve) => {
                    reverseRequests.set(id, { resolve, onUpdate });
                    self.postMessage({
                        id, action, params,
                        hasUpdateHandler,
                        reverse: true
                    });
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
                        entry.onUpdate?.(response);
                        return;
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
