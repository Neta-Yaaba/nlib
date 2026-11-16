/**
 * @file NDataSynchronizer.js
 * @package @nlib/js-backend
 * @description Moteur générique de synchronisation bidirectionnelle offline-first entre le client
 * et un serveur distant via `NNetwork` dans l'écosystème NLib :
 * - Enregistrement multi-collections avec configuration indépendante (`register`, `unregister`).
 * - File d'attente persistante des modifications locales (`trackChange` : `create`, `update`, `delete`).
 * - Synchronisation Push par lots avec identifiants d'opération uniques, confirmations individuelles et reprise après interruption.
 * - Synchronisation Pull paginée par curseur persistant avec émission d'événements `'apply'` et `'pull'` (déléguant l'écriture applicative à l'appelant).
 * - Détection et résolution des conflits par versionnement (`serverWins`, `clientWins`, `manual`, `merge`).
 * - Déclenchement manuel ou automatique (démarrage, retour en ligne, modification locale, intervalle).
 */

import { NObject } from '../core/NObject.js';
import { NIndexedDB } from '../database/NIndexedDB.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * @class NDataSynchronizer
 * @extends NObject
 * @description Moteur événementiel de synchronisation bidirectionnelle (Push/Pull) offline-first pour NLib.
 *
 * @example <caption>Exemple 1 : Configuration multi-collections et application des changements via événements</caption>
 * const syncEngine = new NDataSynchronizer({ network: myNetwork });
 * syncEngine.register('clients', { endpoint: 'https://api.app.com/sync/clients' });
 * syncEngine.on('apply', async ({ collection, action, recordId, record }) => {
 *     if (action === 'delete') await myDb.delete(collection, recordId);
 *     else await myDb.put(collection, record);
 * });
 * await syncEngine.sync();
 *
 * @example <caption>Exemple 2 : Suivi explicite d'une modification locale et écoute des confirmations</caption>
 * syncEngine.on('confirmed', ({ collection, confirmed }) => console.log('Confirmés :', collection, confirmed));
 * await syncEngine.trackChange('clients', 'create', { id: 'c1', nom: 'Dupont', version: 0 });
 * await syncEngine.push('clients');
 *
 * @example <caption>Exemple 3 : Synchronisation automatique au retour en ligne</caption>
 * const autoSync = new NDataSynchronizer({
 *     network: myNetwork,
 *     autoSync: { enabled: true, onOnline: true, onLocalChange: true, interval: 60000 }
 * });
 * autoSync.register('commandes', { endpoint: 'https://api.app.com/sync/orders' });
 */
export class NDataSynchronizer extends NObject {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Instance `NNetwork` utilisée pour les échanges HTTP/HTTPS avec le serveur.
     * @type {any}
     * @private
     */
    #network = null;

    /**
     * Instance `NIndexedDB` dédiée uniquement aux métadonnées internes du moteur
     * (`outbox`, `cursors`, `conflicts`).
     * @type {NIndexedDB|null}
     * @private
     */
    #metaDb = null;

    /**
     * Repli en mémoire utilisé lorsque IndexedDB est indisponible dans l'environnement.
     * @type {{ outbox: Map<string, Object>, cursors: Map<string, any>, conflicts: Map<string, Object> }}
     * @private
     */
    #memoryFallback = {
        outbox: new Map(),
        cursors: new Map(),
        conflicts: new Map()
    };

    /**
     * Registre des collections configurées (`collectionId -> config`).
     * @type {Map<string, Object>}
     * @private
     */
    #collections = new Map();

    /**
     * États et compteurs individuels par collection (`collectionId -> state`).
     * @type {Map<string, Object>}
     * @private
     */
    #collectionStates = new Map();

    /**
     * Promesses de synchronisation en cours par collection pour éviter la concurrence incompatible.
     * @type {Map<string, Promise<any>>}
     * @private
     */
    #activeSyncs = new Map();

    /**
     * Verrous d'arrêt / pause par collection (`collectionId -> 'paused'|'stopped'`).
     * @type {Map<string, string>}
     * @private
     */
    #controlFlags = new Map();

    /**
     * État global du moteur (`'idle'|'syncing'|'pushing'|'pulling'|'paused'|'completed'|'error'`).
     * @type {string}
     * @private
     */
    #globalStatus = 'idle';

    /**
     * Configuration des tentatives progressives (backoff exponentiel).
     * @type {{ maxAttempts: number, baseDelayMs: number, maxDelayMs: number }}
     * @private
     */
    #retryConfig = {
        maxAttempts: 3,
        baseDelayMs: 500,
        maxDelayMs: 10000
    };

    /**
     * Adaptateur de protocole personnalisable pour les échanges Push / Pull.
     * @type {Object}
     * @private
     */
    #protocol = null;

    /**
     * Configuration du déclenchement automatique.
     * @type {{ enabled: boolean, onStart: boolean, onOnline: boolean, onLocalChange: boolean, onLocalChangeDelay: number, interval: number }}
     * @private
     */
    #autoSync = {
        enabled: false,
        onStart: false,
        onOnline: true,
        onLocalChange: false,
        onLocalChangeDelay: 1000,
        interval: 0
    };

    /**
     * Références des écouteurs et minuteurs internes pour nettoyage dans `destroy()`.
     * @type {{ onlineHandler: Function|null, intervalId: any, debounceTimers: Map<string, any> }}
     * @private
     */
    #listeners = {
        onlineHandler: null,
        intervalId: null,
        debounceTimers: new Map()
    };

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NDataSynchronizer`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration du moteur de synchronisation.
     * @param {any} [options.network] - Instance `NNetwork` (par défaut `NUtil.network`).
     * @param {NIndexedDB} [options.metaDb] - Base `NIndexedDB` dédiée aux métadonnées de synchronisation.
     * @param {string} [options.metaDbName='nlib_sync_meta'] - Nom de la base de métadonnées créée automatiquement si `metaDb` est omis.
     * @param {Object} [options.retry] - Politique de tentatives (`{ maxAttempts, baseDelayMs, maxDelayMs }`).
     * @param {Object} [options.protocol] - Adaptateurs de sérialisation/désérialisation (`formatPushRequest`, `parsePushResponse`, `formatPullRequest`, `parsePullResponse`).
     * @param {Object|boolean} [options.autoSync] - Configuration de la synchronisation automatique (`enabled`, `onStart`, `onOnline`, `onLocalChange`, `onLocalChangeDelay`, `interval`).
     * @param {boolean} [options.autoInit=true] - Appelle automatiquement `initialize()` à la construction.
     *
     * @example <caption>Exemple 1 : Instanciation avec réseau explicite</caption>
     * const sync = new NDataSynchronizer({ network: net });
     *
     * @example <caption>Exemple 2 : Instanciation avec backoff personnalisé et auto-sync</caption>
     * const sync = new NDataSynchronizer({
     *     network: net,
     *     retry: { maxAttempts: 5, baseDelayMs: 300, maxDelayMs: 8000 },
     *     autoSync: { enabled: true, onOnline: true, interval: 30000 }
     * });
     */
    constructor(options = {}) {
        super({ ...options, autoInit: false });
        const opts = (options && typeof options === 'object') ? options : {};

        this.#network = opts.network || NUtil.network || null;

        if (opts.metaDb) {
            this.#metaDb = opts.metaDb;
        } else {
            const metaName = (typeof opts.metaDbName === 'string' && opts.metaDbName.trim())
                ? opts.metaDbName.trim()
                : 'nlib_sync_meta';
            this.#metaDb = new NIndexedDB({
                name: metaName,
                version: 1,
                stores: [
                    { name: 'outbox', keyPath: 'operationId', autoIncrement: false, indexes: [{ name: 'by_collection', keyPath: 'collection' }] },
                    { name: 'cursors', keyPath: 'collection', autoIncrement: false },
                    { name: 'conflicts', keyPath: 'conflictId', autoIncrement: false, indexes: [{ name: 'by_collection', keyPath: 'collection' }] }
                ]
            });
        }

        if (opts.retry && typeof opts.retry === 'object') {
            this.#retryConfig = {
                maxAttempts: Math.max(1, Math.trunc(opts.retry.maxAttempts ?? 3)),
                baseDelayMs: Math.max(50, Math.trunc(opts.retry.baseDelayMs ?? 500)),
                maxDelayMs: Math.max(500, Math.trunc(opts.retry.maxDelayMs ?? 10000))
            };
        }

        this.#protocol = this.#buildProtocol(opts.protocol);
        this.configureAutoSync(opts.autoSync);

        if (opts.autoInit !== false) {
            this.initialize();
        }
    }

    // =========================================================================
    // Cycle de vie (NObject)
    // =========================================================================

    /**
     * Valide la présence de la dépendance réseau (`network`).
     *
     * @returns {boolean} `true` si la configuration est valide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier la validité du synchroniseur</caption>
     * const sync = new NDataSynchronizer({ network: net });
     * console.log(sync.validate()); // true
     *
     * @example <caption>Exemple 2 : Détecter une configuration sans réseau</caption>
     * const badSync = new NDataSynchronizer({ network: null, autoInit: false });
     * console.log(badSync.validate()); // false
     */
    validate() {
        return Boolean(this.#network);
    }

    /**
     * Initialise le synchroniseur et active les déclencheurs automatiques configurés.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Initialisation différée</caption>
     * const sync = new NDataSynchronizer({ network: net, autoInit: false });
     * sync.initialize();
     *
     * @example <caption>Exemple 2 : Chaînage fluide après initialize()</caption>
     * sync.initialize().register('clients', { endpoint: '/sync/clients' });
     */
    initialize() {
        super.initialize();
        if (!this.isInitialized || this.isDestroyed) {
            return this;
        }
        this.#applyAutoSyncTriggers();
        return this;
    }

    /**
     * Arrête les synchronisations en cours, détache tous les minuteurs et écouteurs,
     * ferme la base de métadonnées interne et libère les ressources de l'instance.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire le synchroniseur à la fermeture de l'application</caption>
     * sync.destroy();
     * console.log(sync.isDestroyed); // true
     *
     * @example <caption>Exemple 2 : Vérifier l'arrêt après destruction</caption>
     * if (!sync.isDestroyed) {
     *     sync.destroy();
     * }
     */
    destroy() {
        this.stop();
        this.#clearAutoSyncTriggers();
        if (this.#metaDb && typeof this.#metaDb.close === 'function') {
            this.#metaDb.close();
        }
        this.#collections.clear();
        this.#collectionStates.clear();
        this.#activeSyncs.clear();
        this.#controlFlags.clear();
        super.destroy();
    }

    // =========================================================================
    // Événements (délégation directe à NEvent via this.event)
    // =========================================================================

    /**
     * Enregistre un écouteur sur un événement du synchroniseur
     * (`'start'`, `'progress'`, `'push'`, `'confirmed'`, `'pull'`, `'apply'`, `'conflict'`, `'error'`, `'complete'`, `'pause'`, `'resume'`).
     *
     * @param {string} eventName - Nom de l'événement.
     * @param {Function} callback - Fonction de rappel.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Écouter les changements distants à appliquer</caption>
     * sync.on('apply', async ({ collection, action, recordId, record }) => {
     *     console.log('À enregistrer :', collection, action, recordId, record);
     * });
     *
     * @example <caption>Exemple 2 : Écouter les conflits et erreurs</caption>
     * sync.on('conflict', (ev) => console.warn('Conflit :', ev))
     *     .on('error', (ev) => console.error('Erreur :', ev));
     */
    on(eventName, callback) {
        this.event.on(eventName, callback);
        return this;
    }

    /**
     * Supprime un ou plusieurs écouteurs d'un événement du synchroniseur.
     *
     * @param {string} [eventName] - Nom de l'événement (tous si omis).
     * @param {Function} [callback] - Fonction à retirer (toutes pour cet événement si omise).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Retirer un écouteur spécifique</caption>
     * sync.off('apply', myHandler);
     *
     * @example <caption>Exemple 2 : Retirer tous les écouteurs d'un événement</caption>
     * sync.off('error');
     */
    off(eventName, callback) {
        this.event.off(eventName, callback);
        return this;
    }

    // =========================================================================
    // Enregistrement et configuration des collections
    // =========================================================================

    /**
     * Enregistre et valide une collection à synchroniser avec sa configuration dédiée.
     *
     * @param {string} collectionId - Identifiant unique de la collection.
     * @param {Object} config - Configuration de synchronisation de la collection.
     * @param {string} config.endpoint - URL ou chemin d'endpoint distant pour la synchronisation.
     * @param {string} [config.primaryKey='id'] - Nom du champ clé primaire.
     * @param {string} [config.versionField='version'] - Nom du champ portant la version de l'enregistrement.
     * @param {boolean} [config.enabled=true] - Active ou désactive la synchronisation pour cette collection.
     * @param {'serverWins'|'clientWins'|'manual'|'merge'} [config.conflictStrategy='serverWins'] - Stratégie de résolution des conflits.
     * @param {Function} [config.mergeResolver] - Fonction de fusion personnalisée `(conflict) => mergedRecord` pour `'merge'`.
     * @param {number} [config.batchSize=50] - Nombre maximal d'opérations envoyées par lot lors du Push.
     * @param {number} [config.pullLimit=100] - Nombre maximal d'enregistrements demandés par page lors du Pull.
     * @param {number} [config.maxPages=50] - Nombre maximal de pages récupérées par cycle Pull.
     * @returns {boolean} `true` si la collection est validée et enregistrée, sinon `false`.
     *
     * @example <caption>Exemple 1 : Enregistrer une collection simple</caption>
     * const ok = sync.register('clients', { endpoint: 'https://api.app.com/sync/clients' });
     *
     * @example <caption>Exemple 2 : Enregistrer avec fusion personnalisée et pagination</caption>
     * sync.register('articles', {
     *     endpoint: 'https://api.app.com/sync/articles',
     *     primaryKey: 'code',
     *     versionField: 'rev',
     *     conflictStrategy: 'merge',
     *     mergeResolver: ({ clientRecord, serverRecord }) => ({ ...serverRecord, ...clientRecord }),
     *     batchSize: 25,
     *     pullLimit: 50
     * });
     */
    register(collectionId, config = {}) {
        if (typeof collectionId !== 'string' || !collectionId.trim()) {
            NUtil.log?.warn?.('NDataSynchronizer.register: Identifiant de collection invalide.', { collectionId });
            return false;
        }

        const id = collectionId.trim();
        const cfg = (config && typeof config === 'object') ? config : {};

        if (typeof cfg.endpoint !== 'string' || !cfg.endpoint.trim()) {
            NUtil.log?.warn?.(`NDataSynchronizer.register: Endpoint requis pour la collection "${id}".`);
            return false;
        }

        const endpoint = cfg.endpoint.trim();
        if (endpoint.startsWith('http://') && !endpoint.startsWith('http://localhost') && !endpoint.startsWith('http://127.0.0.1')) {
            NUtil.log?.warn?.(`NDataSynchronizer.register: Il est recommandé d'utiliser HTTPS pour "${id}".`, { endpoint });
        }

        const allowedStrategies = ['serverWins', 'clientWins', 'manual', 'merge'];
        const conflictStrategy = cfg.conflictStrategy || 'serverWins';
        if (!allowedStrategies.includes(conflictStrategy)) {
            NUtil.log?.warn?.(`NDataSynchronizer.register: Stratégie de conflit invalide "${conflictStrategy}" pour "${id}".`);
            return false;
        }

        const normalized = {
            id,
            endpoint,
            primaryKey: (typeof cfg.primaryKey === 'string' && cfg.primaryKey.trim()) ? cfg.primaryKey.trim() : 'id',
            versionField: (typeof cfg.versionField === 'string' && cfg.versionField.trim()) ? cfg.versionField.trim() : 'version',
            enabled: cfg.enabled !== undefined ? Boolean(cfg.enabled) : true,
            conflictStrategy,
            mergeResolver: typeof cfg.mergeResolver === 'function' ? cfg.mergeResolver : null,
            batchSize: Math.max(1, Math.trunc(cfg.batchSize ?? 50)),
            pullLimit: Math.max(1, Math.trunc(cfg.pullLimit ?? 100)),
            maxPages: Math.max(1, Math.trunc(cfg.maxPages ?? 50))
        };

        this.#collections.set(id, normalized);

        if (!this.#collectionStates.has(id)) {
            this.#collectionStates.set(id, this.#createInitialCollectionState(id));
        }

        return true;
    }

    /**
     * Désenregistre une collection et annule son minuteur automatique éventuel.
     *
     * @param {string} collectionId - Identifiant de la collection à retirer.
     * @returns {boolean} `true` si la collection existait et a été retirée, sinon `false`.
     *
     * @example <caption>Exemple 1 : Retirer une collection</caption>
     * const removed = sync.unregister('clients');
     *
     * @example <caption>Exemple 2 : Retirer une collection inexistante</caption>
     * console.log(sync.unregister('inconnue')); // false
     */
    unregister(collectionId) {
        if (typeof collectionId !== 'string' || !collectionId.trim()) {
            return false;
        }
        const id = collectionId.trim();
        const timer = this.#listeners.debounceTimers.get(id);
        if (timer) {
            NUtil.clearTimeout(timer);
            this.#listeners.debounceTimers.delete(id);
        }
        this.#controlFlags.delete(id);
        this.#collectionStates.delete(id);
        return this.#collections.delete(id);
    }

    /**
     * Met à jour la configuration du déclenchement automatique de la synchronisation.
     *
     * @param {Object|boolean} [autoSyncOptions={}] - Paramètres de déclenchement automatique.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Activer la synchronisation automatique périodique</caption>
     * sync.configureAutoSync({ enabled: true, interval: 60000, onOnline: true });
     *
     * @example <caption>Exemple 2 : Désactiver la synchronisation automatique</caption>
     * sync.configureAutoSync(false);
     */
    configureAutoSync(autoSyncOptions = {}) {
        if (typeof autoSyncOptions === 'boolean') {
            this.#autoSync.enabled = autoSyncOptions;
        } else if (autoSyncOptions && typeof autoSyncOptions === 'object') {
            this.#autoSync = {
                enabled: Boolean(autoSyncOptions.enabled ?? this.#autoSync.enabled),
                onStart: Boolean(autoSyncOptions.onStart ?? this.#autoSync.onStart),
                onOnline: autoSyncOptions.onOnline !== undefined ? Boolean(autoSyncOptions.onOnline) : this.#autoSync.onOnline,
                onLocalChange: Boolean(autoSyncOptions.onLocalChange ?? this.#autoSync.onLocalChange),
                onLocalChangeDelay: Math.max(100, Math.trunc(autoSyncOptions.onLocalChangeDelay ?? this.#autoSync.onLocalChangeDelay)),
                interval: Math.max(0, Math.trunc(autoSyncOptions.interval ?? this.#autoSync.interval))
            };
        }

        if (this.isInitialized && !this.isDestroyed) {
            this.#clearAutoSyncTriggers();
            this.#applyAutoSyncTriggers();
        }
        return this;
    }

    // =========================================================================
    // Suivi des modifications locales
    // =========================================================================

    /**
     * Enregistre une modification locale dans la file d'attente persistante (`outbox`).
     *
     * @param {string} collectionId - Identifiant de la collection concernée.
     * @param {'create'|'update'|'delete'} action - Type de modification locale.
     * @param {Object|string|number} recordOrKey - Enregistrement complet ou identifiant (pour `'delete'`).
     * @param {Object} [options={}] - Options complémentaires (`baseVersion`, `operationId`, `force`).
     * @returns {Promise<Object|null>} L'opération créée et persistée, ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Enregistrer une création locale</caption>
     * await sync.trackChange('clients', 'create', { id: 'c1', nom: 'Dupont', version: 0 });
     *
     * @example <caption>Exemple 2 : Enregistrer une suppression locale</caption>
     * await sync.trackChange('clients', 'delete', 'c1', { baseVersion: 2 });
     */
    async trackChange(collectionId, action, recordOrKey, options = {}) {
        const col = this.#collections.get(collectionId);
        if (!col || !col.enabled) {
            return null;
        }

        const normalizedAction = this.#normalizeAction(action);
        if (!normalizedAction) {
            return null;
        }

        const recordId = (recordOrKey && typeof recordOrKey === 'object')
            ? recordOrKey[col.primaryKey]
            : recordOrKey;

        if (recordId === undefined || recordId === null || recordId === '') {
            return null;
        }

        const baseVersion = options.baseVersion ?? (
            (recordOrKey && typeof recordOrKey === 'object') ? (recordOrKey[col.versionField] ?? null) : null
        );

        const operation = {
            operationId: options.operationId || NUtil.uuid(),
            collection: col.id,
            action: normalizedAction,
            recordId,
            data: (normalizedAction !== 'delete' && recordOrKey && typeof recordOrKey === 'object') ? { ...recordOrKey } : null,
            baseVersion,
            force: Boolean(options.force),
            createdAt: Date.now(),
            attempts: 0,
            lastError: null
        };

        const saved = await this.#metaPut('outbox', operation);
        if (!saved) {
            return null;
        }

        await this.#refreshPendingCount(col.id);

        if (this.#autoSync.enabled && this.#autoSync.onLocalChange) {
            this.#scheduleLocalChangeSync(col.id);
        }

        return operation;
    }

    // =========================================================================
    // Synchronisation bidirectionnelle (Sync, Push, Pull)
    // =========================================================================

    /**
     * Exécute une synchronisation bidirectionnelle complète (Push puis Pull)
     * sur une collection spécifique ou sur toutes les collections activées.
     * Empêche les exécutions concurrentes incompatibles sur la même collection.
     *
     * @param {string|null} [collectionId=null] - Identifiant de la collection ciblée, ou `null` pour toutes.
     * @param {Object} [options={}] - Options d'exécution (`direction: 'both'|'push'|'pull'`).
     * @returns {Promise<Object>} Résumé d'exécution global ou de la collection ciblée.
     *
     * @example <caption>Exemple 1 : Synchroniser toutes les collections enregistrées</caption>
     * const report = await sync.sync();
     * console.log(report.ok, report.results);
     *
     * @example <caption>Exemple 2 : Synchroniser uniquement la collection 'clients'</caption>
     * const clientReport = await sync.sync('clients');
     * console.log(clientReport.pushed, clientReport.pulled);
     */
    async sync(collectionId = null, options = {}) {
        if (this.isDestroyed) {
            return { ok: false, status: 'destroyed', results: {} };
        }

        if (collectionId) {
            return await this.#syncSingleCollection(collectionId, options);
        }

        const ids = Array.from(this.#collections.keys()).filter((id) => this.#collections.get(id)?.enabled);
        this.#globalStatus = 'syncing';
        this.event.emit('start', { scope: 'all', collections: ids });

        const results = {};
        let allOk = true;

        for (const id of ids) {
            if (this.#controlFlags.get('*') === 'stopped' || this.#controlFlags.get('*') === 'paused') {
                break;
            }
            const res = await this.#syncSingleCollection(id, options);
            results[id] = res;
            if (!res.ok && res.status !== 'paused') {
                allOk = false;
            }
        }

        this.#globalStatus = this.#resolveGlobalStatusFromCollections();
        const summary = { ok: allOk, status: this.#globalStatus, results };
        this.event.emit('complete', summary);
        return summary;
    }

    /**
     * Exécute uniquement la phase Push (envoi des opérations locales en attente vers le serveur).
     *
     * @param {string|null} [collectionId=null] - Collection ciblée ou `null` pour toutes.
     * @param {Object} [options={}] - Options complémentaires.
     * @returns {Promise<Object>} Résultat de la phase Push.
     *
     * @example <caption>Exemple 1 : Envoyer les modifications locales de toutes les collections</caption>
     * const pushRes = await sync.push();
     *
     * @example <caption>Exemple 2 : Envoyer uniquement les modifications de 'clients'</caption>
     * const pushClients = await sync.push('clients');
     */
    async push(collectionId = null, options = {}) {
        return await this.sync(collectionId, { ...options, direction: 'push' });
    }

    /**
     * Exécute uniquement la phase Pull (récupération des changements distants depuis le dernier curseur).
     *
     * @param {string|null} [collectionId=null] - Collection ciblée ou `null` pour toutes.
     * @param {Object} [options={}] - Options complémentaires.
     * @returns {Promise<Object>} Résultat de la phase Pull.
     *
     * @example <caption>Exemple 1 : Récupérer les changements distants de toutes les collections</caption>
     * const pullRes = await sync.pull();
     *
     * @example <caption>Exemple 2 : Récupérer uniquement les changements de 'produits'</caption>
     * const pullProducts = await sync.pull('produits');
     */
    async pull(collectionId = null, options = {}) {
        return await this.sync(collectionId, { ...options, direction: 'pull' });
    }

    // =========================================================================
    // Contrôle d'exécution (Pause, Resume, Stop) et Statuts
    // =========================================================================

    /**
     * Met en pause la synchronisation d'une collection ou de l'ensemble du moteur.
     *
     * @param {string|null} [collectionId=null] - Collection ciblée ou `null` pour toutes.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Mettre en pause toutes les synchronisations</caption>
     * sync.pause();
     *
     * @example <caption>Exemple 2 : Mettre en pause une collection spécifique</caption>
     * sync.pause('produits');
     */
    pause(collectionId = null) {
        const key = collectionId || '*';
        this.#controlFlags.set(key, 'paused');

        if (collectionId) {
            const st = this.#collectionStates.get(collectionId);
            if (st) st.status = 'paused';
        } else {
            this.#globalStatus = 'paused';
            for (const st of this.#collectionStates.values()) {
                st.status = 'paused';
            }
        }

        this.event.emit('pause', { collection: collectionId || null });
        return this;
    }

    /**
     * Reprend la synchronisation après une mise en pause et relance `sync()`.
     *
     * @param {string|null} [collectionId=null] - Collection ciblée ou `null` pour toutes.
     * @returns {Promise<Object>} Résultat de la reprise de synchronisation.
     *
     * @example <caption>Exemple 1 : Reprendre toutes les synchronisations</caption>
     * await sync.resume();
     *
     * @example <caption>Exemple 2 : Reprendre une collection spécifique</caption>
     * await sync.resume('produits');
     */
    async resume(collectionId = null) {
        if (collectionId) {
            this.#controlFlags.delete(collectionId);
            const st = this.#collectionStates.get(collectionId);
            if (st && st.status === 'paused') st.status = 'idle';
        } else {
            this.#controlFlags.clear();
            this.#globalStatus = 'idle';
            for (const st of this.#collectionStates.values()) {
                if (st.status === 'paused') st.status = 'idle';
            }
        }

        this.event.emit('resume', { collection: collectionId || null });
        return await this.sync(collectionId);
    }

    /**
     * Interrompt la synchronisation en cours sans supprimer les opérations en attente.
     *
     * @param {string|null} [collectionId=null] - Collection ciblée ou `null` pour toutes.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Arrêter toute synchronisation en cours</caption>
     * sync.stop();
     *
     * @example <caption>Exemple 2 : Arrêter la synchronisation d'une collection</caption>
     * sync.stop('clients');
     */
    stop(collectionId = null) {
        const key = collectionId || '*';
        this.#controlFlags.set(key, 'stopped');

        if (collectionId) {
            const st = this.#collectionStates.get(collectionId);
            if (st) st.status = 'idle';
        } else {
            this.#globalStatus = 'idle';
            for (const st of this.#collectionStates.values()) {
                st.status = 'idle';
            }
        }
        return this;
    }

    /**
     * Retourne l'état global et les statistiques agrégées de toutes les collections.
     *
     * @returns {Object} Statut global et détail par collection.
     *
     * @example <caption>Exemple 1 : Consulter le statut global</caption>
     * const status = sync.getStatus();
     * console.log(status.status, status.pendingCount);
     *
     * @example <caption>Exemple 2 : Inspecter le nombre de conflits non résolus</caption>
     * console.log(sync.getStatus().conflictCount);
     */
    getStatus() {
        const collections = {};
        let pendingCount = 0;
        let sentCount = 0;
        let receivedCount = 0;
        let confirmedCount = 0;
        let conflictCount = 0;
        let errorCount = 0;

        for (const [id, st] of this.#collectionStates.entries()) {
            collections[id] = { ...st };
            pendingCount += st.pendingCount;
            sentCount += st.sentCount;
            receivedCount += st.receivedCount;
            confirmedCount += st.confirmedCount;
            conflictCount += st.conflictCount;
            errorCount += st.errorCount;
        }

        return {
            status: this.#globalStatus,
            isSyncing: this.#activeSyncs.size > 0,
            autoSync: { ...this.#autoSync },
            pendingCount,
            sentCount,
            receivedCount,
            confirmedCount,
            conflictCount,
            errorCount,
            collections
        };
    }

    /**
     * Retourne l'état détaillé et les compteurs d'une collection enregistrée.
     *
     * @param {string} collectionId - Identifiant de la collection.
     * @returns {Object|null} État de la collection, ou `null` si non enregistrée.
     *
     * @example <caption>Exemple 1 : Consulter l'état de 'clients'</caption>
     * const st = sync.getCollectionStatus('clients');
     * console.log(st?.status, st?.pendingCount);
     *
     * @example <caption>Exemple 2 : Vérifier le dernier curseur connu</caption>
     * console.log(sync.getCollectionStatus('clients')?.cursor);
     */
    getCollectionStatus(collectionId) {
        const st = this.#collectionStates.get(collectionId);
        return st ? { ...st } : null;
    }

    /**
     * Résout manuellement un conflit précédemment mis en attente (stratégie `'manual'`).
     * Émet `'apply'` pour que l'application applique la version retenue dans son propre stockage.
     *
     * @param {string} conflictId - Identifiant unique du conflit à résoudre.
     * @param {'serverWins'|'clientWins'|Object} resolution - Décision de résolution ou objet fusionné final.
     * @returns {Promise<boolean>} `true` si le conflit a été résolu, sinon `false`.
     *
     * @example <caption>Exemple 1 : Résoudre en choisissant la version serveur</caption>
     * await sync.resolveConflict(conflictId, 'serverWins');
     *
     * @example <caption>Exemple 2 : Résoudre en fournissant un objet fusionné personnalisé</caption>
     * await sync.resolveConflict(conflictId, { id: 'c1', nom: 'Dupont', tel: '0600000000' });
     */
    async resolveConflict(conflictId, resolution) {
        if (!conflictId) return false;

        const conflict = await this.#metaGet('conflicts', conflictId);
        if (!conflict) {
            return false;
        }

        const col = this.#collections.get(conflict.collection);
        if (!col) {
            return false;
        }

        if (resolution === 'serverWins') {
            const action = conflict.serverRecord === null ? 'delete' : 'update';
            const emittedOk = await this.#emitApply(col, {
                action,
                recordId: conflict.recordId,
                record: conflict.serverRecord,
                version: conflict.serverVersion,
                source: 'conflict-resolution'
            });
            if (!emittedOk) return false;

            if (conflict.operationId) {
                await this.#metaDelete('outbox', conflict.operationId);
            }
        } else if (resolution === 'clientWins') {
            await this.#enqueueClientWin(col, conflict);
        } else if (resolution && typeof resolution === 'object') {
            const merged = {
                ...resolution,
                [col.primaryKey]: conflict.recordId,
                [col.versionField]: conflict.serverVersion ?? conflict.clientVersion
            };
            const emittedOk = await this.#emitApply(col, {
                action: 'update',
                recordId: conflict.recordId,
                record: merged,
                version: merged[col.versionField],
                source: 'conflict-resolution'
            });
            if (!emittedOk) return false;

            if (conflict.operationId) {
                await this.#metaDelete('outbox', conflict.operationId);
            }
            await this.trackChange(col.id, 'update', merged, {
                baseVersion: merged[col.versionField],
                force: true
            });
        } else {
            return false;
        }

        await this.#metaDelete('conflicts', conflictId);
        await this.#refreshPendingCount(col.id);
        await this.#refreshConflictCount(col.id);
        return true;
    }

    // =========================================================================
    // Méthodes privées — Orchestration Push / Pull par collection
    // =========================================================================

    /**
     * Synchronise une collection unique en garantissant l'exclusion mutuelle
     * contre les exécutions concurrentes sur la même collection.
     * @private
     */
    async #syncSingleCollection(collectionId, options = {}) {
        const col = this.#collections.get(collectionId);
        if (!col || !col.enabled) {
            return { ok: false, collection: collectionId, status: 'unregistered', pushed: 0, pulled: 0 };
        }

        if (this.#activeSyncs.has(collectionId)) {
            return await this.#activeSyncs.get(collectionId);
        }

        const direction = options.direction || 'both';
        const st = this.#collectionStates.get(collectionId);

        const task = (async () => {
            this.#controlFlags.delete(collectionId);
            st.status = 'syncing';
            st.lastError = null;
            let pushed = 0;
            let pulled = 0;
            let ok = true;

            try {
                if (this.#isPausedOrStopped(collectionId)) {
                    st.status = this.#getControlFlag(collectionId) === 'paused' ? 'paused' : 'idle';
                    return { ok: false, collection: collectionId, status: st.status, pushed, pulled };
                }

                if (direction === 'both' || direction === 'push') {
                    st.status = 'pushing';
                    const pushResult = await this.#pushCollection(col, st);
                    pushed = pushResult.confirmed;
                    if (!pushResult.ok) ok = false;
                }

                if (ok && !this.#isPausedOrStopped(collectionId) && (direction === 'both' || direction === 'pull')) {
                    st.status = 'pulling';
                    const pullResult = await this.#pullCollection(col, st);
                    pulled = pullResult.applied;
                    if (!pullResult.ok) ok = false;
                }

                if (this.#isPausedOrStopped(collectionId)) {
                    st.status = this.#getControlFlag(collectionId) === 'paused' ? 'paused' : 'idle';
                    return { ok: false, collection: collectionId, status: st.status, pushed, pulled };
                }

                st.status = ok ? 'completed' : 'error';
                if (ok) {
                    st.lastSyncAt = Date.now();
                }

                this.event.emit('progress', { ...st, collection: col.id });
                return { ok, collection: col.id, status: st.status, pushed, pulled };
            } catch (err) {
                st.status = 'error';
                st.errorCount += 1;
                st.lastError = err?.message || String(err);
                this.event.emit('error', { collection: col.id, error: st.lastError });
                return { ok: false, collection: col.id, status: 'error', pushed, pulled, error: st.lastError };
            } finally {
                this.#activeSyncs.delete(collectionId);
                await this.#refreshPendingCount(col.id);
                await this.#refreshConflictCount(col.id);
            }
        })();

        this.#activeSyncs.set(collectionId, task);
        return await task;
    }

    /**
     * Exécute la phase Push par lots sur une collection.
     * @private
     */
    async #pushCollection(col, st) {
        if (!this.#isOnline()) {
            return { ok: false, confirmed: 0, offline: true };
        }

        const pendingOps = await this.#getPendingOpsForCollection(col.id);
        st.pendingCount = pendingOps.length;
        if (!pendingOps.length) {
            return { ok: true, confirmed: 0 };
        }

        let totalConfirmed = 0;

        for (let i = 0; i < pendingOps.length; i += col.batchSize) {
            if (this.#isPausedOrStopped(col.id)) {
                return { ok: false, confirmed: totalConfirmed, interrupted: true };
            }

            const batch = pendingOps.slice(i, i + col.batchSize);
            const requestBody = this.#protocol.formatPushRequest(col, batch);
            st.sentCount += batch.length;

            const netRes = await this.#sendWithRetry(() => this.#network.post(col.endpoint, requestBody, { responseType: 'json' }), col.id);
            if (!netRes || !netRes.ok) {
                for (const op of batch) {
                    op.attempts += 1;
                    op.lastError = netRes?.statusText || 'NETWORK_ERROR';
                    await this.#metaPut('outbox', op);
                }
                st.errorCount += 1;
                st.lastError = netRes?.statusText || 'Échec réseau lors du Push';
                this.event.emit('error', { collection: col.id, phase: 'push', error: st.lastError });
                return { ok: false, confirmed: totalConfirmed };
            }

            const parsed = this.#protocol.parsePushResponse(netRes.data, batch);
            const confirmedItems = [];

            // 1. Confirmations individuelles uniquement : jamais sur la seule base du statut HTTP
            for (const conf of parsed.confirmed) {
                const opId = typeof conf === 'string' ? conf : conf?.operationId;
                if (!opId) continue;

                const matchingOp = batch.find((o) => o.operationId === opId);
                await this.#metaDelete('outbox', opId);
                totalConfirmed += 1;
                st.confirmedCount += 1;

                confirmedItems.push({
                    operationId: opId,
                    recordId: matchingOp?.recordId ?? conf?.recordId ?? null,
                    action: matchingOp?.action ?? null,
                    version: conf?.version ?? null,
                    record: conf?.record ?? null
                });
            }

            if (confirmedItems.length > 0) {
                this.event.emit('confirmed', { collection: col.id, confirmed: confirmedItems });
            }

            // 2. Conflits signalés par le serveur
            for (const conflictData of parsed.conflicts) {
                const matchingOp = batch.find((o) => o.operationId === conflictData.operationId);
                await this.#handleConflict(col, st, {
                    operationId: conflictData.operationId,
                    recordId: conflictData.recordId ?? matchingOp?.recordId,
                    clientVersion: conflictData.clientVersion ?? matchingOp?.baseVersion ?? null,
                    serverVersion: conflictData.serverVersion ?? null,
                    clientRecord: matchingOp?.data || null,
                    serverRecord: conflictData.serverRecord ?? null
                });
            }

            // 3. Opérations explicitement rejetées / échouées : conservées dans outbox
            for (const fail of parsed.failed) {
                const op = batch.find((o) => o.operationId === fail.operationId);
                if (op) {
                    op.attempts += 1;
                    op.lastError = fail.error || 'SERVER_REJECTED';
                    await this.#metaPut('outbox', op);
                }
                st.errorCount += 1;
            }

            await this.#refreshPendingCount(col.id);
            this.event.emit('push', { collection: col.id, batchSize: batch.length, confirmed: confirmedItems.length });
            this.event.emit('progress', { ...st, collection: col.id });
        }

        return { ok: true, confirmed: totalConfirmed };
    }

    /**
     * Exécute la phase Pull paginée par curseur persistant sur une collection.
     * Émet `'apply'` pour chaque changement et n'avance le curseur que si l'application réussit.
     * @private
     */
    async #pullCollection(col, st) {
        if (!this.#isOnline()) {
            return { ok: false, applied: 0, offline: true };
        }

        const cursorDoc = await this.#metaGet('cursors', col.id);
        let currentCursor = cursorDoc?.cursor ?? null;
        st.cursor = currentCursor;

        let totalApplied = 0;
        let pages = 0;

        while (pages < col.maxPages) {
            if (this.#isPausedOrStopped(col.id)) {
                return { ok: false, applied: totalApplied, interrupted: true };
            }

            const pullParams = this.#protocol.formatPullRequest(col, currentCursor, col.pullLimit);
            const netRes = await this.#sendWithRetry(
                () => this.#network.get(col.endpoint, { params: pullParams, responseType: 'json' }),
                col.id
            );

            if (!netRes || !netRes.ok) {
                st.errorCount += 1;
                st.lastError = netRes?.statusText || 'Échec réseau lors du Pull';
                this.event.emit('error', { collection: col.id, phase: 'pull', error: st.lastError });
                return { ok: false, applied: totalApplied };
            }

            const page = this.#protocol.parsePullResponse(netRes.data);
            const changes = Array.isArray(page.changes) ? page.changes : [];
            st.receivedCount += changes.length;

            for (const change of changes) {
                if (this.#isPausedOrStopped(col.id)) {
                    return { ok: false, applied: totalApplied, interrupted: true };
                }

                const appliedOk = await this.#processRemoteChange(col, st, change);
                if (!appliedOk) {
                    st.errorCount += 1;
                    st.lastError = `Échec d'application locale pour la collection "${col.id}".`;
                    this.event.emit('error', { collection: col.id, phase: 'pull', error: st.lastError });
                    return { ok: false, applied: totalApplied };
                }
                totalApplied += 1;
            }

            if (page.nextCursor !== undefined && page.nextCursor !== null) {
                currentCursor = page.nextCursor;
                st.cursor = currentCursor;
                await this.#metaPut('cursors', {
                    collection: col.id,
                    cursor: currentCursor,
                    updatedAt: Date.now()
                });
            }

            this.event.emit('pull', { collection: col.id, changes, count: changes.length, cursor: currentCursor, hasMore: Boolean(page.hasMore) });
            this.event.emit('progress', { ...st, collection: col.id });

            pages += 1;
            if (!page.hasMore || changes.length === 0) {
                break;
            }
        }

        return { ok: true, applied: totalApplied };
    }

    /**
     * Vérifie un changement distant par rapport à la file `outbox`, gère un éventuel conflit,
     * et émet `'apply'` pour déléguer la persistance métier à l'application.
     * @private
     */
    async #processRemoteChange(col, st, change) {
        const action = this.#normalizeAction(change?.action || 'update') || 'update';
        const remoteRecord = change?.data || change?.record || null;
        const recordId = change?.recordId ?? change?.id ?? remoteRecord?.[col.primaryKey];

        if (recordId === undefined || recordId === null) {
            return true;
        }

        const pendingOps = await this.#getPendingOpsForCollection(col.id);
        const pendingForRecord = pendingOps.find((op) => String(op.recordId) === String(recordId));

        if (pendingForRecord) {
            const serverVersion = change?.version ?? remoteRecord?.[col.versionField] ?? null;
            return await this.#handleConflict(col, st, {
                operationId: pendingForRecord.operationId,
                recordId,
                clientVersion: pendingForRecord.baseVersion,
                serverVersion,
                clientRecord: pendingForRecord.data,
                serverRecord: action === 'delete' ? null : remoteRecord
            });
        }

        const record = (action !== 'delete' && remoteRecord && typeof remoteRecord === 'object')
            ? ((change?.version !== undefined && remoteRecord[col.versionField] === undefined)
                ? { ...remoteRecord, [col.versionField]: change.version }
                : remoteRecord)
            : null;

        return await this.#emitApply(col, {
            action,
            recordId,
            record,
            version: change?.version ?? record?.[col.versionField] ?? null,
            source: 'pull'
        });
    }

    /**
     * Émet `'apply'` via `NEvent.emit` et attend les promesses enregistrées via `waitUntil(...)`.
     * Retourne `false` si `reject()` est appelé ou si une promesse échoue / retourne `false` / `{ ok: false }`.
     * @private
     */
    async #emitApply(col, payload) {
        if (!this.event || this.event.listenerCount('apply') === 0) {
            return true;
        }
        const tasks = [];
        let rejected = false;

        this.event.emit('apply', {
            collection: col.id,
            ...payload,
            waitUntil: (promise) => {
                if (promise && typeof promise.then === 'function') {
                    tasks.push(promise);
                }
            },
            reject: () => {
                rejected = true;
            }
        });

        if (rejected) {
            return false;
        }

        if (tasks.length > 0) {
            try {
                const results = await Promise.all(tasks);
                for (const res of results) {
                    if (res === false || (res && typeof res === 'object' && res.ok === false)) {
                        return false;
                    }
                }
            } catch {
                return false;
            }
        }
        return true;
    }

    // =========================================================================
    // Méthodes privées — Gestion des conflits
    // =========================================================================

    /**
     * Détecte et résout un conflit selon la stratégie configurée sur la collection.
     * @private
     */
    async #handleConflict(col, st, rawConflict) {
        st.conflictCount += 1;
        const conflict = {
            conflictId: NUtil.uuid(),
            collection: col.id,
            operationId: rawConflict.operationId || null,
            recordId: rawConflict.recordId,
            clientVersion: rawConflict.clientVersion ?? null,
            serverVersion: rawConflict.serverVersion ?? null,
            clientRecord: rawConflict.clientRecord || null,
            serverRecord: rawConflict.serverRecord ?? null,
            strategy: col.conflictStrategy,
            createdAt: Date.now()
        };

        if (col.conflictStrategy === 'serverWins') {
            const action = conflict.serverRecord === null ? 'delete' : 'update';
            const appliedOk = await this.#emitApply(col, {
                action,
                recordId: conflict.recordId,
                record: conflict.serverRecord,
                version: conflict.serverVersion,
                source: 'conflict-resolution'
            });
            if (!appliedOk) return false;

            if (conflict.operationId) {
                await this.#metaDelete('outbox', conflict.operationId);
            }
            this.event.emit('conflict', { ...conflict, resolved: true, resolution: 'serverWins' });
            return true;
        }

        if (col.conflictStrategy === 'clientWins') {
            await this.#enqueueClientWin(col, conflict);
            this.event.emit('conflict', { ...conflict, resolved: true, resolution: 'clientWins' });
            return true;
        }

        if (col.conflictStrategy === 'merge' && typeof col.mergeResolver === 'function') {
            try {
                const merged = await col.mergeResolver(conflict);
                if (merged && typeof merged === 'object') {
                    const finalRecord = {
                        ...merged,
                        [col.primaryKey]: conflict.recordId,
                        [col.versionField]: conflict.serverVersion ?? conflict.clientVersion
                    };
                    const appliedOk = await this.#emitApply(col, {
                        action: 'update',
                        recordId: conflict.recordId,
                        record: finalRecord,
                        version: finalRecord[col.versionField],
                        source: 'conflict-resolution'
                    });
                    if (!appliedOk) return false;

                    if (conflict.operationId) {
                        await this.#metaDelete('outbox', conflict.operationId);
                    }
                    await this.trackChange(col.id, 'update', finalRecord, {
                        baseVersion: finalRecord[col.versionField],
                        force: true
                    });
                    this.event.emit('conflict', { ...conflict, resolved: true, resolution: 'merge', mergedRecord: finalRecord });
                    return true;
                }
            } catch (err) {
                NUtil.log?.warn?.(`NDataSynchronizer: Échec du mergeResolver sur "${col.id}", bascule en mode manuel.`, err);
            }
        }

        // Mode 'manual' (ou repli si mergeResolver absent/invalide)
        await this.#metaPut('conflicts', conflict);
        this.event.emit('conflict', { ...conflict, resolved: false, resolution: 'manual' });
        return true;
    }

    /**
     * Prépare la ré-émission d'une opération locale en mode `'clientWins'`.
     * @private
     */
    async #enqueueClientWin(col, conflict) {
        if (conflict.operationId) {
            const op = await this.#metaGet('outbox', conflict.operationId);
            if (op) {
                op.baseVersion = conflict.serverVersion ?? op.baseVersion;
                op.force = true;
                await this.#metaPut('outbox', op);
                return;
            }
        }
        if (conflict.clientRecord) {
            await this.trackChange(col.id, 'update', conflict.clientRecord, {
                baseVersion: conflict.serverVersion ?? conflict.clientVersion,
                force: true
            });
        }
    }

    // =========================================================================
    // Méthodes privées — Déclencheurs AutoSync
    // =========================================================================

    #applyAutoSyncTriggers() {
        if (!this.#autoSync.enabled) {
            return;
        }

        if (this.#autoSync.onStart) {
            NUtil.setTimeout(() => {
                if (!this.isDestroyed) this.sync();
            }, 0);
        }

        if (this.#autoSync.onOnline && typeof globalThis !== 'undefined' && typeof globalThis.addEventListener === 'function') {
            this.#listeners.onlineHandler = () => {
                if (!this.isDestroyed) this.sync();
            };
            globalThis.addEventListener('online', this.#listeners.onlineHandler);
        }

        if (this.#autoSync.interval > 0) {
            this.#listeners.intervalId = setInterval(() => {
                if (!this.isDestroyed && this.#isOnline()) {
                    this.sync();
                }
            }, this.#autoSync.interval);
        }
    }

    #clearAutoSyncTriggers() {
        if (this.#listeners.onlineHandler && typeof globalThis !== 'undefined' && typeof globalThis.removeEventListener === 'function') {
            globalThis.removeEventListener('online', this.#listeners.onlineHandler);
        }
        this.#listeners.onlineHandler = null;

        if (this.#listeners.intervalId) {
            clearInterval(this.#listeners.intervalId);
            this.#listeners.intervalId = null;
        }

        for (const timer of this.#listeners.debounceTimers.values()) {
            NUtil.clearTimeout(timer);
        }
        this.#listeners.debounceTimers.clear();
    }

    #scheduleLocalChangeSync(collectionId) {
        const existing = this.#listeners.debounceTimers.get(collectionId);
        if (existing) {
            NUtil.clearTimeout(existing);
        }
        const timer = NUtil.setTimeout(() => {
            this.#listeners.debounceTimers.delete(collectionId);
            if (!this.isDestroyed && this.#isOnline()) {
                this.sync(collectionId);
            }
        }, this.#autoSync.onLocalChangeDelay);
        this.#listeners.debounceTimers.set(collectionId, timer);
    }

    // =========================================================================
    // Méthodes privées — Persistance des métadonnées (IDB + repli mémoire)
    // =========================================================================

    async #metaPut(storeName, value) {
        if (this.#metaDb && this.#metaDb.isAvailable !== false) {
            const res = await this.#metaDb.put(storeName, value);
            if (res?.ok) return true;
        }
        const keyField = storeName === 'outbox' ? 'operationId' : (storeName === 'conflicts' ? 'conflictId' : 'collection');
        this.#memoryFallback[storeName].set(value[keyField], value);
        return true;
    }

    async #metaGet(storeName, key) {
        if (this.#metaDb && this.#metaDb.isAvailable !== false) {
            const res = await this.#metaDb.get(storeName, key);
            if (res?.ok) return res.data;
        }
        return this.#memoryFallback[storeName].get(key) || null;
    }

    async #metaDelete(storeName, key) {
        if (this.#metaDb && this.#metaDb.isAvailable !== false) {
            const res = await this.#metaDb.delete(storeName, key);
            if (res?.ok) return true;
        }
        return this.#memoryFallback[storeName].delete(key);
    }

    async #metaGetAll(storeName) {
        if (this.#metaDb && this.#metaDb.isAvailable !== false) {
            const res = await this.#metaDb.getAll(storeName);
            if (res?.ok && Array.isArray(res.data)) return res.data;
        }
        return Array.from(this.#memoryFallback[storeName].values());
    }

    async #getPendingOpsForCollection(collectionId) {
        const all = await this.#metaGetAll('outbox');
        return all
            .filter((op) => op && op.collection === collectionId)
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }

    async #refreshPendingCount(collectionId) {
        const st = this.#collectionStates.get(collectionId);
        if (st) {
            const ops = await this.#getPendingOpsForCollection(collectionId);
            st.pendingCount = ops.length;
        }
    }

    async #refreshConflictCount(collectionId) {
        const st = this.#collectionStates.get(collectionId);
        if (st) {
            const all = await this.#metaGetAll('conflicts');
            st.conflictCount = all.filter((c) => c && c.collection === collectionId).length;
        }
    }

    // =========================================================================
    // Méthodes privées — Protocole, Retry, Réseau & Utilitaires
    // =========================================================================

    #buildProtocol(custom = {}) {
        const p = (custom && typeof custom === 'object') ? custom : {};
        return {
            formatPushRequest: typeof p.formatPushRequest === 'function'
                ? p.formatPushRequest
                : (col, operations) => ({ collection: col.id, operations }),
            parsePushResponse: typeof p.parsePushResponse === 'function'
                ? p.parsePushResponse
                : (data) => ({
                    confirmed: Array.isArray(data?.confirmed) ? data.confirmed : [],
                    conflicts: Array.isArray(data?.conflicts) ? data.conflicts : [],
                    failed: Array.isArray(data?.failed) ? data.failed : []
                }),
            formatPullRequest: typeof p.formatPullRequest === 'function'
                ? p.formatPullRequest
                : (col, cursor, limit) => ({
                    collection: col.id,
                    ...(cursor !== null && cursor !== undefined ? { cursor } : {}),
                    limit
                }),
            parsePullResponse: typeof p.parsePullResponse === 'function'
                ? p.parsePullResponse
                : (data) => ({
                    changes: Array.isArray(data?.changes) ? data.changes : [],
                    nextCursor: data?.nextCursor ?? null,
                    hasMore: Boolean(data?.hasMore)
                })
        };
    }

    async #sendWithRetry(fn, collectionId) {
        let attempt = 0;
        let lastRes = null;

        while (attempt < this.#retryConfig.maxAttempts) {
            if (this.#isPausedOrStopped(collectionId)) {
                return lastRes;
            }
            attempt += 1;
            try {
                const res = await fn();
                lastRes = res;
                if (res && res.ok) {
                    return res;
                }
                if (res && res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
                    return res;
                }
            } catch (err) {
                lastRes = { ok: false, status: 0, statusText: err?.message || 'NETWORK_ERROR', data: null };
            }

            if (attempt < this.#retryConfig.maxAttempts) {
                const delay = Math.min(
                    this.#retryConfig.maxDelayMs,
                    this.#retryConfig.baseDelayMs * (2 ** (attempt - 1))
                );
                await NUtil.sleep(delay);
            }
        }

        return lastRes;
    }

    #createInitialCollectionState(id) {
        return {
            collection: id,
            status: 'idle',
            cursor: null,
            pendingCount: 0,
            sentCount: 0,
            receivedCount: 0,
            confirmedCount: 0,
            conflictCount: 0,
            errorCount: 0,
            lastSyncAt: null,
            lastError: null
        };
    }

    #normalizeAction(action) {
        const a = String(action || '').toLowerCase().trim();
        if (a === 'add' || a === 'create' || a === 'insert') return 'create';
        if (a === 'put' || a === 'update' || a === 'upsert') return 'update';
        if (a === 'delete' || a === 'remove') return 'delete';
        return null;
    }

    #isOnline() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return false;
        }
        return true;
    }

    #getControlFlag(collectionId) {
        return this.#controlFlags.get(collectionId) || this.#controlFlags.get('*') || null;
    }

    #isPausedOrStopped(collectionId) {
        const flag = this.#getControlFlag(collectionId);
        return flag === 'paused' || flag === 'stopped';
    }

    #resolveGlobalStatusFromCollections() {
        const states = Array.from(this.#collectionStates.values());
        if (states.some((s) => s.status === 'error')) return 'error';
        if (states.some((s) => s.status === 'paused')) return 'paused';
        if (states.some((s) => s.status === 'completed')) return 'completed';
        return 'idle';
    }
}

export default NDataSynchronizer;
