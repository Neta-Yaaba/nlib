/**
 * @file NService.js
 * @package @nlib/js-backend
 * @description Service de communication temps réel et périodique avec le serveur permettant
 * d'écouter, d'actualiser et d'envoyer un identifiant d'événement entier (`lastId`, `int`).
 *
 * Architecture et fonctionnement technique :
 * - Sélection automatique et exécution d'un moteur d'écoute unique parmi la chaîne de priorité :
 *   1. `'native'`    : Communication bidirectionnelle via le pont système natif (`NUtil.sys.invokeNative` avec `type: ['app', 'service', action]`) et réception d'événements sur `window.NLibNativeBridgeEvent`.
 *   2. `'websocket'` : Connexion TCP/WebSocket persistante bidirectionnelle (`ws://` / `wss://`).
 *   3. `'sse'`       : Flux continu unidirectionnel Server-Sent Events (`EventSource`).
 *   4. `'polling'`   : Interrogation HTTP périodique (`NUtil.network` / `NNetwork`) à intervalle configurable (`pollingInterval`).
 * - Synchronisation d'identifiants entiers (`int`) : normalise les réponses serveur (entier brut, chaîne numérique ou structure JSON `{ id, lastId }`), met à jour `lastId` et émet les événements `'id'` et `'change'`.
 * - Persistance locale : stocke et restaure l'identifiant entier `lastId` dans `NIndexedDB` (`NUtil.db.idb`) sous la clé dédiée au service (`__nservice_last_id__:<serviceId>`).
 */

import { NObject } from '../core/NObject.js';
import { NEvent } from '../core/NEvent.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * @class NService
 * @extends NObject
 * @description Gestionnaire de synchronisation d'identifiants d'événements entiers (`int`) entre un serveur distant et l'application cliente.
 * Permet d'écouter en temps réel ou périodiquement l'évolution de l'identifiant serveur, de persister localement le dernier identifiant connu dans `NIndexedDB`,
 * d'émettre de nouveaux identifiants vers le serveur (`send`) et d'interroger ponctuellement le serveur en HTTP (`refreshId`).
 *
 * @example <caption>Exemple 1 : Démarrage en mode automatique et écoute des changements d'identifiant</caption>
 * const service = new NService({
 *     id: 'commandes_sync',
 *     url: 'https://api.monapp.com/events'
 * });
 * service.on('change', (newId) => {
 *     console.log('Nouvel identifiant serveur détecté :', newId);
 * });
 * const status = await service.start();
 * console.log('Moteur actif :', status.driver, 'Dernier ID :', status.lastId);
 *
 * @example <caption>Exemple 2 : Envoi bidirectionnel d'un nouvel identifiant entier au serveur</caption>
 * const service = new NService({
 *     id: 'caisse_01',
 *     url: 'wss://api.monapp.com/realtime',
 *     driver: 'websocket',
 *     lastId: 100
 * });
 * await service.start();
 * const sent = await service.send(105);
 * console.log('Identifiant transmis :', sent, 'Nouveau lastId :', service.lastId);
 *
 * @example <caption>Exemple 3 : Actualisation ponctuelle par requête HTTP et gestion de la persistance IndexedDB</caption>
 * const service = new NService({
 *     id: 'catalogue_version',
 *     url: 'https://api.monapp.com/version',
 *     pollingInterval: 10000
 * });
 * await service.loadLastId();
 * const updatedId = await service.refreshId();
 * console.log('Identifiant synchronisé en HTTP :', updatedId);
 */
export class NService extends NObject {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Identifiant logique du service utilisé pour le pont natif et la clé de persistance IndexedDB.
     * @type {string}
     * @private
     */
    #serviceId = 'default';

    /**
     * URL du point d'entrée serveur.
     * @type {string}
     * @private
     */
    #url = '';

    /**
     * Moteur de transport demandé (`'auto'`, `'native'`, `'websocket'`, `'sse'`, `'polling'`).
     * @type {'auto'|'native'|'websocket'|'sse'|'polling'}
     * @private
     */
    #preferredDriver = 'auto';

    /**
     * Moteur de transport actuellement en cours d'exécution (`'native'`, `'websocket'`, `'sse'`, `'polling'` ou `null` à l'arrêt).
     * @type {'native'|'websocket'|'sse'|'polling'|null}
     * @private
     */
    #activeDriver = null;

    /**
     * Dernier identifiant entier reçu ou synchronisé (`int`).
     * @type {number}
     * @private
     */
    #lastId = 0;

    /**
     * Indique si l'enregistrement automatique de `#lastId` dans `NIndexedDB` est activé.
     * @type {boolean}
     * @private
     */
    #persistLastId = true;

    /**
     * Nom de l'Object Store IndexedDB utilisé pour stocker `lastId`.
     * @type {string}
     * @private
     */
    #idbStoreName = 'ntable';

    /**
     * Intervalle en millisecondes entre deux requêtes HTTP en mode `'polling'`.
     * @type {number}
     * @private
     */
    #pollingInterval = 5000;

    /**
     * Délai en millisecondes avant une tentative de reconnexion ou de bascule vers le moteur suivant.
     * @type {number}
     * @private
     */
    #reconnectDelay = 3000;

    /**
     * Indique si le service est actuellement actif et en écoute.
     * @type {boolean}
     * @private
     */
    #isRunning = false;

    /**
     * Instance `WebSocket` active lorsque `#activeDriver === 'websocket'`.
     * @type {WebSocket|null}
     * @private
     */
    #ws = null;

    /**
     * Instance `EventSource` active lorsque `#activeDriver === 'sse'`.
     * @type {EventSource|null}
     * @private
     */
    #sse = null;

    /**
     * Identifiant du minuteur périodique lorsque `#activeDriver === 'polling'`.
     * @type {any}
     * @private
     */
    #pollingTimer = null;

    /**
     * Identifiant du minuteur de reconnexion automatique.
     * @type {any}
     * @private
     */
    #reconnectTimer = null;

    /**
     * Fonction d'écoute enregistrée sur `window.NLibNativeBridgeEvent` lorsque `#activeDriver === 'native'`.
     * @type {Function|null}
     * @private
     */
    #nativeListener = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Instancie et configure un nouveau gestionnaire de service `NService`.
     *
     * @param {Object} [options={}] - Paramètres d'initialisation du service.
     * @param {string} [options.id='default'] - Identifiant logique unique du service.
     * @param {string} [options.url=''] - URL du point d'entrée serveur.
     * @param {'auto'|'native'|'websocket'|'sse'|'polling'} [options.driver='auto'] - Moteur de transport à utiliser (`'auto'` résout selon l'ordre `native` -> `websocket` -> `sse` -> `polling`).
     * @param {number} [options.lastId=0] - Valeur entière initiale de l'identifiant d'événement.
     * @param {boolean} [options.persistLastId=true] - Active la lecture et l'écriture de `lastId` dans `NIndexedDB`.
     * @param {number} [options.pollingInterval=5000] - Période en millisecondes entre chaque requête du moteur `'polling'`.
     * @param {number} [options.reconnectDelay=3000] - Délai en millisecondes avant reconnexion en cas de coupure.
     * @param {Object} [options.state] - État initial transmis à la classe parente `NObject`.
     *
     * @example <caption>Exemple 1 : Création d'un service avec sélection automatique du moteur</caption>
     * const service = new NService({
     *     id: 'notifications',
     *     url: 'https://api.monapp.com/events'
     * });
     *
     * @example <caption>Exemple 2 : Création d'un service configuré pour le polling HTTP périodique</caption>
     * const poller = new NService({
     *     id: 'stock_sync',
     *     url: 'https://api.monapp.com/stock-version',
     *     driver: 'polling',
     *     lastId: 12,
     *     pollingInterval: 3000
     * });
     */
    constructor(options = {}) {
        super(options);
        this.configure(options);
    }

    // =========================================================================
    // Getters
    // =========================================================================

    /**
     * Retourne l'identifiant logique du service utilisé pour isoler les événements natifs et l'entrée IndexedDB.
     *
     * @returns {string} Identifiant du service.
     *
     * @example <caption>Exemple 1 : Lire l'identifiant par défaut</caption>
     * const s = new NService();
     * console.log(s.serviceId); // 'default'
     *
     * @example <caption>Exemple 2 : Lire l'identifiant personnalisé</caption>
     * const s = new NService({ id: 'facturation' });
     * console.log(s.serviceId); // 'facturation'
     */
    get serviceId() {
        return this.#serviceId;
    }

    /**
     * Retourne l'URL du point d'entrée serveur configurée pour ce service.
     *
     * @returns {string} URL du serveur.
     *
     * @example <caption>Exemple 1 : Obtenir l'URL configurée</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * console.log(s.url); // 'https://api.monapp.com/events'
     *
     * @example <caption>Exemple 2 : Vérifier l'URL après modification</caption>
     * s.configure({ url: 'https://api2.monapp.com/events' });
     * console.log(s.url); // 'https://api2.monapp.com/events'
     */
    get url() {
        return this.#url;
    }

    /**
     * Retourne le dernier identifiant d'événement entier (`int`) reçu du serveur ou transmis par le client.
     *
     * @returns {number} Dernier identifiant entier connu.
     *
     * @example <caption>Exemple 1 : Consulter l'identifiant initial</caption>
     * const s = new NService({ lastId: 42 });
     * console.log(s.lastId); // 42
     *
     * @example <caption>Exemple 2 : Consulter l'identifiant après réinitialisation</caption>
     * await s.resetLastId(100);
     * console.log(s.lastId); // 100
     */
    get lastId() {
        return this.#lastId;
    }

    /**
     * Indique si le service est actuellement démarré et maintient un canal d'écoute actif.
     *
     * @returns {boolean} `true` si l'écoute est en cours, sinon `false`.
     *
     * @example <caption>Exemple 1 : État avant démarrage</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * console.log(s.isRunning); // false
     *
     * @example <caption>Exemple 2 : État après démarrage et arrêt</caption>
     * await s.start();
     * console.log(s.isRunning); // true
     * await s.stop();
     * console.log(s.isRunning); // false
     */
    get isRunning() {
        return this.#isRunning;
    }

    /**
     * Retourne le nom du moteur de transport actuellement en cours d'exécution,
     * ou `null` lorsque le service est arrêté.
     *
     * @returns {'native'|'websocket'|'sse'|'polling'|null} Moteur actif ou `null`.
     *
     * @example <caption>Exemple 1 : Valeur nulle à l'arrêt</caption>
     * const s = new NService();
     * console.log(s.activeDriver); // null
     *
     * @example <caption>Exemple 2 : Identifier le moteur actif après démarrage</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events', driver: 'polling' });
     * await s.start();
     * console.log(s.activeDriver); // 'polling'
     */
    get activeDriver() {
        return this.#activeDriver;
    }

    /**
     * Retourne le moteur de transport actif ou celui qui sera retenu selon l'ordre de priorité
     * (`'native'` -> `'websocket'` -> `'sse'` -> `'polling'`).
     *
     * @returns {'native'|'websocket'|'sse'|'polling'} Nom du moteur résolu.
     *
     * @example <caption>Exemple 1 : Obtenir le moteur résolu automatiquement</caption>
     * const s = new NService();
     * console.log(['native', 'websocket', 'sse', 'polling'].includes(s.driver)); // true
     *
     * @example <caption>Exemple 2 : Obtenir le moteur forcé par configuration</caption>
     * const s = new NService({ driver: 'polling' });
     * console.log(s.driver); // 'polling'
     */
    get driver() {
        if (this.#activeDriver) {
            return this.#activeDriver;
        }
        return this.#resolveBestDriver(this.#preferredDriver);
    }

    /**
     * Indique si l'environnement d'exécution courant expose le conteneur natif (`NUtil.env.isWebView`).
     *
     * @returns {boolean} `true` si le moteur `'native'` est utilisable.
     *
     * @example <caption>Exemple 1 : Vérifier la disponibilité du pont natif</caption>
     * const s = new NService();
     * console.log(typeof s.isNativeAvailable); // 'boolean'
     *
     * @example <caption>Exemple 2 : Adapter le diagnostic applicatif</caption>
     * if (s.isNativeAvailable) { console.log('Exécution dans le conteneur natif'); }
     */
    get isNativeAvailable() {
        return Boolean(NUtil?.env?.isWebView);
    }

    /**
     * Indique si l'API standard `WebSocket` est disponible dans l'environnement global.
     *
     * @returns {boolean} `true` si le moteur `'websocket'` est utilisable.
     *
     * @example <caption>Exemple 1 : Tester le support WebSocket</caption>
     * const s = new NService();
     * console.log(typeof s.isWebSocketAvailable); // 'boolean'
     *
     * @example <caption>Exemple 2 : Vérifier avant de forcer le mode websocket</caption>
     * if (s.isWebSocketAvailable) { s.configure({ driver: 'websocket' }); }
     */
    get isWebSocketAvailable() {
        return typeof WebSocket === 'function';
    }

    /**
     * Indique si l'API standard `EventSource` (Server-Sent Events) est disponible dans l'environnement global.
     *
     * @returns {boolean} `true` si le moteur `'sse'` est utilisable.
     *
     * @example <caption>Exemple 1 : Tester le support SSE</caption>
     * const s = new NService();
     * console.log(typeof s.isSseAvailable); // 'boolean'
     *
     * @example <caption>Exemple 2 : Vérifier avant de forcer le mode sse</caption>
     * if (s.isSseAvailable) { s.configure({ driver: 'sse' }); }
     */
    get isSseAvailable() {
        return typeof EventSource === 'function';
    }

    /**
     * Indique si le transport HTTP via `NUtil.network` (`NNetwork`) est disponible pour exécuter des requêtes de synchronisation.
     *
     * @returns {boolean} `true` si le moteur `'polling'` est utilisable.
     *
     * @example <caption>Exemple 1 : Tester le support HTTP Polling</caption>
     * const s = new NService();
     * console.log(s.isPollingAvailable); // true
     *
     * @example <caption>Exemple 2 : Vérification de type</caption>
     * console.log(typeof s.isPollingAvailable); // 'boolean'
     */
    get isPollingAvailable() {
        return Boolean(NUtil.network) && (
            typeof fetch === 'function' ||
            typeof XMLHttpRequest === 'function' ||
            NUtil.env.isWebView
        );
    }

    /**
     * Retourne l'intervalle temporel en millisecondes entre deux appels HTTP du moteur `'polling'`.
     *
     * @returns {number} Intervalle en millisecondes.
     *
     * @example <caption>Exemple 1 : Lire l'intervalle par défaut</caption>
     * const s = new NService();
     * console.log(s.pollingInterval); // 5000
     *
     * @example <caption>Exemple 2 : Lire l'intervalle après configuration</caption>
     * s.configure({ pollingInterval: 2000 });
     * console.log(s.pollingInterval); // 2000
     */
    get pollingInterval() {
        return this.#pollingInterval;
    }

    // =========================================================================
    // Configuration & Abonnement aux événements
    // =========================================================================

    /**
     * Met à jour dynamiquement les paramètres du service (`id`, `url`, `driver`, `lastId`, `persistLastId`, `pollingInterval`, `reconnectDelay`).
     *
     * @param {Object} [options={}] - Dictionnaire des options à modifier.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir l'URL et l'identifiant initial</caption>
     * const s = new NService();
     * s.configure({ id: 'sync_tarifs', url: 'https://api.monapp.com/tarifs-id', lastId: 15 });
     * console.log(s.serviceId, s.lastId); // 'sync_tarifs' 15
     *
     * @example <caption>Exemple 2 : Ajuster l'intervalle de polling et le délai de reconnexion</caption>
     * s.configure({ driver: 'polling', pollingInterval: 10000, reconnectDelay: 5000 });
     * console.log(s.pollingInterval); // 10000
     */
    configure(options = {}) {
        if (!options || typeof options !== 'object') {
            return this;
        }

        if (typeof options.id === 'string' && options.id.trim()) {
            this.#serviceId = options.id.trim();
        } else if (typeof options.serviceId === 'string' && options.serviceId.trim()) {
            this.#serviceId = options.serviceId.trim();
        }

        if (typeof options.url === 'string') {
            this.#url = options.url.trim();
        }

        if (typeof options.driver === 'string') {
            const drv = options.driver.trim().toLowerCase();
            if (['auto', 'native', 'websocket', 'sse', 'polling'].includes(drv)) {
                this.#preferredDriver = drv;
            }
        }

        if (options.lastId !== undefined) {
            const parsed = this.#parseIntId(options.lastId);
            if (parsed !== null) {
                this.#lastId = parsed;
            }
        }

        if (typeof options.persistLastId === 'boolean') {
            this.#persistLastId = options.persistLastId;
        }

        if (typeof options.pollingInterval === 'number' && options.pollingInterval >= 500) {
            this.#pollingInterval = Math.trunc(options.pollingInterval);
        }

        if (typeof options.reconnectDelay === 'number' && options.reconnectDelay >= 100) {
            this.#reconnectDelay = Math.trunc(options.reconnectDelay);
        }

        return this;
    }

    /**
     * Enregistre une fonction d'écoute sur un événement du service (`'id'`, `'change'`, `'connected'`, `'disconnected'`, `'error'`).
     *
     * @param {string} eventName - Nom de l'événement à écouter.
     * @param {Function} callback - Fonction déclenchée à chaque émission de l'événement.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Réagir à chaque changement de l'identifiant entier</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * s.on('change', (newId) => console.log('Nouvel ID :', newId));
     *
     * @example <caption>Exemple 2 : Surveiller l'état de connexion du moteur</caption>
     * s.on('connected', ({ driver, lastId }) => console.log(`Connecté via ${driver} (ID=${lastId})`));
     */
    on(eventName, callback) {
        this.event.on(eventName, callback);
        return this;
    }

    /**
     * Enregistre une fonction d'écoute exécutée une seule fois lors de la prochaine apparition de l'événement.
     *
     * @param {string} eventName - Nom de l'événement à écouter.
     * @param {Function} callback - Fonction exécutée une unique fois.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Attendre le premier identifiant reçu</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * s.once('id', (firstId) => console.log('Premier ID reçu :', firstId));
     *
     * @example <caption>Exemple 2 : Détecter la première connexion</caption>
     * s.once('connected', (info) => console.log('Initialisé sur :', info.driver));
     */
    once(eventName, callback) {
        this.event.once(eventName, callback);
        return this;
    }

    /**
     * Supprime un écouteur spécifique ou l'ensemble des écouteurs associés à un événement du service.
     *
     * @param {string} [eventName] - Nom de l'événement ciblé.
     * @param {Function} [callback] - Référence de la fonction à détacher.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Détacher une fonction d'écoute précise</caption>
     * const onNewId = (id) => console.log(id);
     * s.on('change', onNewId);
     * s.off('change', onNewId);
     *
     * @example <caption>Exemple 2 : Retirer tous les écouteurs de l'événement 'error'</caption>
     * s.off('error');
     */
    off(eventName, callback) {
        this.event.off(eventName, callback);
        return this;
    }

    // =========================================================================
    // Persistance de `lastId` dans IndexedDB
    // =========================================================================

    /**
     * Lit l'identifiant entier `lastId` enregistré dans `NIndexedDB` pour ce service
     * et met à jour la propriété interne `this.lastId`.
     *
     * @returns {Promise<number>} La valeur entière restaurée de `lastId`.
     *
     * @example <caption>Exemple 1 : Charger le dernier identifiant sauvegardé au démarrage</caption>
     * const s = new NService({ id: 'commandes' });
     * const id = await s.loadLastId();
     * console.log('Dernier ID chargé :', id);
     *
     * @example <caption>Exemple 2 : Vérifier la restauration après une écriture</caption>
     * await s.saveLastId(84);
     * const reloaded = await s.loadLastId();
     * console.log(reloaded); // 84
     */
    async loadLastId() {
        if (!this.#persistLastId || !NUtil?.db?.idb?.isAvailable) {
            return this.#lastId;
        }

        try {
            const res = await NUtil.db.idb.get(
                this.#idbStoreName,
                this.#getStorageKey(),
                { encryptData: false, encryptKey: false }
            );

            if (res?.ok && res.data !== null && res.data !== undefined) {
                const candidate = typeof res.data === 'object' ? (res.data.lastId ?? res.data.id) : res.data;
                const parsed = this.#parseIntId(candidate);
                if (parsed !== null) {
                    this.#lastId = parsed;
                }
            }
        } catch {
            // Conserver la valeur mémoire courante
        }

        return this.#lastId;
    }

    /**
     * Met à jour l'identifiant entier `lastId` en mémoire et l'enregistre dans `NIndexedDB`.
     *
     * @param {number} [id=this.#lastId] - Nouvel identifiant entier à persister.
     * @returns {Promise<boolean>} `true` si l'écriture dans `NIndexedDB` a abouti.
     *
     * @example <caption>Exemple 1 : Sauvegarder un nouvel identifiant entier</caption>
     * const s = new NService({ id: 'sync_clients' });
     * await s.saveLastId(50);
     * console.log(s.lastId); // 50
     *
     * @example <caption>Exemple 2 : Persister la valeur courante de lastId</caption>
     * const ok = await s.saveLastId();
     * console.log(typeof ok); // 'boolean'
     */
    async saveLastId(id = this.#lastId) {
        const parsed = this.#parseIntId(id);
        if (parsed !== null) {
            this.#lastId = parsed;
        }

        if (!this.#persistLastId || !NUtil?.db?.idb?.isAvailable) {
            return false;
        }

        try {
            const key = this.#getStorageKey();
            const res = await NUtil.db.idb.put(
                this.#idbStoreName,
                { id: key, lastId: this.#lastId, updatedAt: Date.now() },
                { encryptData: false, encryptKey: false }
            );
            return Boolean(res?.ok);
        } catch {
            return false;
        }
    }

    /**
     * Réinitialise `lastId` à la valeur entière spécifiée (`0` par défaut) et met à jour `NIndexedDB`.
     *
     * @param {number} [newId=0] - Valeur entière de réinitialisation.
     * @returns {Promise<number>} La nouvelle valeur entière de `lastId`.
     *
     * @example <caption>Exemple 1 : Remettre le compteur d'identifiant à zéro</caption>
     * const s = new NService({ id: 'sync_clients', lastId: 99 });
     * const val = await s.resetLastId();
     * console.log(val); // 0
     *
     * @example <caption>Exemple 2 : Repositionner le curseur à un identifiant précis</caption>
     * const val2 = await s.resetLastId(250);
     * console.log(s.lastId); // 250
     */
    async resetLastId(newId = 0) {
        const parsed = this.#parseIntId(newId);
        this.#lastId = parsed !== null ? parsed : 0;
        await this.saveLastId(this.#lastId);
        return this.#lastId;
    }

    // =========================================================================
    // Cycle de vie : Démarrage, Arrêt, Envoi & Actualisation HTTP
    // =========================================================================

    /**
     * Charge le dernier identifiant depuis `NIndexedDB` et démarre un unique moteur d'écoute
     * en évaluant successivement `'native'` -> `'websocket'` -> `'sse'` -> `'polling'`.
     *
     * @param {Object} [options={}] - Options de configuration à appliquer avant le démarrage.
     * @returns {Promise<{ ok: boolean, driver: 'native'|'websocket'|'sse'|'polling'|null, lastId: number }>} Résultat de connexion incluant le moteur retenu et le `lastId`.
     *
     * @example <caption>Exemple 1 : Démarrer le service avec les options courantes</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * const res = await s.start();
     * console.log(res.ok, res.driver, res.lastId);
     *
     * @example <caption>Exemple 2 : Démarrer en surchargeant l'URL et le moteur à la volée</caption>
     * const res2 = await s.start({ url: 'https://api.monapp.com/poll', driver: 'polling' });
     * console.log(res2.driver); // 'polling'
     */
    async start(options = {}) {
        this.configure(options);

        await this.stop();
        await this.loadLastId();

        this.#isRunning = true;

        const candidates = this.#getCandidateDrivers(this.#preferredDriver);
        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            const started = await this.#startSingleDriver(candidate);
            if (started) {
                this.#activeDriver = candidate;
                this.event.emit('connected', { driver: candidate, lastId: this.#lastId });
                return {
                    ok: true,
                    driver: candidate,
                    lastId: this.#lastId
                };
            }
        }

        this.#isRunning = false;
        this.#activeDriver = null;
        return {
            ok: false,
            driver: null,
            lastId: this.#lastId
        };
    }

    /**
     * Arrête le moteur d'écoute actif, ferme la connexion ouverte (pont natif, WebSocket, EventSource ou minuteur de polling)
     * et émet l'événement `'disconnected'`.
     *
     * @returns {Promise<boolean>} `true` une fois le moteur arrêté.
     *
     * @example <caption>Exemple 1 : Arrêter l'écoute active</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events', driver: 'polling' });
     * await s.start();
     * await s.stop();
     * console.log(s.isRunning, s.activeDriver); // false null
     *
     * @example <caption>Exemple 2 : Écouter la notification d'arrêt</caption>
     * s.on('disconnected', ({ driver, lastId }) => console.log(`Arrêt de ${driver} à l'ID ${lastId}`));
     * await s.stop();
     */
    async stop() {
        const wasRunning = this.#isRunning;
        const previousDriver = this.#activeDriver;

        this.#isRunning = false;
        this.#clearTimers();
        await this.#cleanupCurrentDriver();

        if (wasRunning && previousDriver) {
            this.event.emit('disconnected', { driver: previousDriver, lastId: this.#lastId });
        }
        return true;
    }

    /**
     * Envoie un identifiant entier (`int`) au serveur via le moteur actif (pont natif, trame WebSocket ou requête HTTP `POST`),
     * met à jour `lastId` et traite tout nouvel identifiant entier retourné par le serveur.
     *
     * @param {number} [id=this.#lastId] - Identifiant entier à transmettre au serveur.
     * @returns {Promise<boolean>} `true` si l'identifiant a été envoyé avec succès.
     *
     * @example <caption>Exemple 1 : Envoyer un nouvel identifiant entier au serveur</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * const ok = await s.send(120);
     * console.log(ok, s.lastId); // true/false, 120
     *
     * @example <caption>Exemple 2 : Envoyer la valeur actuelle de lastId au serveur</caption>
     * await s.resetLastId(300);
     * await s.send();
     */
    async send(id = this.#lastId) {
        const intId = this.#parseIntId(id);
        if (intId === null) {
            return false;
        }

        if (intId !== this.#lastId) {
            await this.#handleIncomingId(intId, false);
        }

        const driver = this.#activeDriver || this.#resolveBestDriver(this.#preferredDriver);

        // 1. Envoi via le pont natif
        if (driver === 'native' && this.isNativeAvailable) {
            const res = await this.#invokeNativeService('send', {
                serviceId: this.#serviceId,
                id: intId
            });
            if (res && res.ok !== false && res.success !== false) {
                const returnedId = this.#extractIntFromPayload(res.id ?? res.lastId ?? res.data);
                if (returnedId !== null) {
                    await this.#handleIncomingId(returnedId);
                }
                return true;
            }
            return false;
        }

        // 2. Envoi direct via WebSocket ouvert
        if (driver === 'websocket' && this.#ws && this.#ws.readyState === 1) {
            try {
                this.#ws.send(String(intId));
                return true;
            } catch {
                return false;
            }
        }

        // 3. Envoi via requête HTTP POST centralisée (NUtil.network)
        if (this.#url && this.isPollingAvailable) {
            try {
                const targetUrl = this.#buildUrlWithId(this.#url, intId);
                const response = await NUtil.network.post(targetUrl, String(intId), {
                    headers: {
                        'Content-Type': 'text/plain;charset=UTF-8',
                        'Cache-Control': 'no-store, no-cache'
                    },
                    responseType: 'text'
                });

                if (!response || !response.ok) {
                    return false;
                }

                const returnedId = this.#extractIntFromPayload(response.data);
                if (returnedId !== null) {
                    await this.#handleIncomingId(returnedId);
                }
                return true;
            } catch {
                return false;
            }
        }

        return false;
    }

    /**
     * Exécute une requête HTTP `GET` vers le serveur en transmettant `?id=<lastId>`,
     * extrait l'identifiant entier renvoyé, met à jour `lastId` dans `NIndexedDB`
     * et déclenche les événements `'id'` et `'change'`.
     *
     * @param {string} [customUrl=''] - URL cible optionnelle (utilise `this.url` si omise).
     * @returns {Promise<number|null>} Le nouvel identifiant entier synchronisé, ou `null` si la requête échoue.
     *
     * @example <caption>Exemple 1 : Actualiser l'identifiant depuis l'URL configurée</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * const newId = await s.refreshId();
     * console.log('ID actualisé :', newId);
     *
     * @example <caption>Exemple 2 : Actualiser l'identifiant depuis un endpoint spécifique</caption>
     * const customId = await s.refreshId('https://api.monapp.com/events/latest');
     * console.log('ID reçu :', customId);
     */
    async refreshId(customUrl = '') {
        const baseUrl = (typeof customUrl === 'string' && customUrl.trim()) ? customUrl.trim() : this.#url;
        if (!baseUrl || !this.isPollingAvailable) {
            return null;
        }

        try {
            const pollUrl = this.#buildUrlWithId(baseUrl, this.#lastId);
            const response = await NUtil.network.get(pollUrl, {
                headers: {
                    'Cache-Control': 'no-store, no-cache',
                    'Pragma': 'no-cache'
                },
                responseType: 'text'
            });

            if (!response || !response.ok) {
                return null;
            }

            const incomingId = this.#extractIntFromPayload(response.data);
            if (incomingId !== null) {
                await this.#handleIncomingId(incomingId);
                return this.#lastId;
            }
            return null;
        } catch {
            this.event.emit('error', { driver: 'polling', lastId: this.#lastId });
            return null;
        }
    }

    /**
     * Alias de `refreshId()` permettant de récupérer et d'actualiser l'identifiant entier par requête HTTP `GET`.
     *
     * @param {string} [customUrl=''] - URL cible optionnelle (utilise `this.url` si omise).
     * @returns {Promise<number|null>} Le nouvel identifiant entier synchronisé, ou `null` si la requête échoue.
     *
     * @example <caption>Exemple 1 : Récupérer l'identifiant via fetchId</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * const id = await s.fetchId();
     *
     * @example <caption>Exemple 2 : Récupérer l'identifiant sur une route dédiée</caption>
     * const id2 = await s.fetchId('https://api.monapp.com/check-id');
     */
    async fetchId(customUrl = '') {
        return await this.refreshId(customUrl);
    }

    /**
     * Arrête le moteur d'écoute actif, annule les minuteurs en cours et libère les écouteurs d'événements de l'instance.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Libérer les ressources du service</caption>
     * const s = new NService({ url: 'https://api.monapp.com/events' });
     * s.destroy();
     * console.log(s.isDestroyed); // true
     *
     * @example <caption>Exemple 2 : Arrêt automatique lors de la destruction</caption>
     * const s2 = new NService({ url: 'https://api.monapp.com/events', driver: 'polling' });
     * await s2.start();
     * s2.destroy();
     * console.log(s2.isRunning); // false
     */
    destroy() {
        this.stop();
        super.destroy();
    }

    // =========================================================================
    // Méthodes privées — Sélection et démarrage d'un moteur unique
    // =========================================================================

    /**
     * Retourne la liste ordonnée des moteurs candidats (`native` -> `websocket` -> `sse` -> `polling`).
     * @private
     * @param {string} preferred - Moteur préféré.
     * @returns {Array<'native'|'websocket'|'sse'|'polling'>}
     */
    #getCandidateDrivers(preferred = 'auto') {
        if (preferred !== 'auto') {
            return [preferred];
        }

        const list = [];
        if (this.isNativeAvailable) list.push('native');
        if (this.isWebSocketAvailable) list.push('websocket');
        if (this.isSseAvailable) list.push('sse');
        if (this.isPollingAvailable) list.push('polling');
        return list;
    }

    /**
     * Résout le premier moteur disponible selon l'ordre de priorité.
     * @private
     * @param {string} preferred - Moteur préféré.
     * @returns {'native'|'websocket'|'sse'|'polling'}
     */
    #resolveBestDriver(preferred = 'auto') {
        const candidates = this.#getCandidateDrivers(preferred);
        return candidates[0] || 'polling';
    }

    /**
     * Démarre le moteur spécifié après fermeture de tout moteur précédent.
     * @private
     * @param {'native'|'websocket'|'sse'|'polling'} driver - Moteur à initialiser.
     * @returns {Promise<boolean>}
     */
    async #startSingleDriver(driver) {
        await this.#cleanupCurrentDriver();

        if (driver === 'native') {
            return await this.#startNativeDriver();
        }
        if (driver === 'websocket') {
            return await this.#startWebSocketDriver();
        }
        if (driver === 'sse') {
            return await this.#startSseDriver();
        }
        if (driver === 'polling') {
            return await this.#startPollingDriver();
        }
        return false;
    }

    /**
     * 1. Moteur `'native'` : démarre l'écoute auprès du conteneur natif (`type: ['app', 'service', 'start']`).
     * @private
     * @returns {Promise<boolean>}
     */
    async #startNativeDriver() {
        if (!this.isNativeAvailable) {
            return false;
        }

        if (typeof window !== 'undefined') {
            if (!window.NLibNativeBridgeEvent) {
                window.NLibNativeBridgeEvent = new NEvent();
            }

            this.#nativeListener = (payload) => {
                if (!this.#isRunning || this.#activeDriver !== 'native') {
                    return;
                }
                if (payload && typeof payload === 'object' && payload.serviceId && payload.serviceId !== this.#serviceId) {
                    return;
                }
                const incomingId = this.#extractIntFromPayload(payload);
                if (incomingId !== null) {
                    this.#handleIncomingId(incomingId);
                }
            };

            window.NLibNativeBridgeEvent.on('service', this.#nativeListener);
        }

        const res = await this.#invokeNativeService('start', {
            serviceId: this.#serviceId,
            url: this.#url,
            id: this.#lastId
        });

        if (!res || res.ok === false || res.success === false) {
            if (typeof window !== 'undefined' && window.NLibNativeBridgeEvent && this.#nativeListener) {
                window.NLibNativeBridgeEvent.off('service', this.#nativeListener);
            }
            this.#nativeListener = null;
            return false;
        }

        const initialId = this.#extractIntFromPayload(res.id ?? res.lastId ?? res.data);
        if (initialId !== null) {
            await this.#handleIncomingId(initialId);
        }

        return true;
    }

    /**
     * 2. Moteur `'websocket'` : établit une connexion WebSocket et transmet `lastId`.
     * @private
     * @returns {Promise<boolean>}
     */
    async #startWebSocketDriver() {
        if (!this.isWebSocketAvailable || !this.#url) {
            return false;
        }

        const wsUrl = this.#toWebSocketUrl(this.#buildUrlWithId(this.#url, this.#lastId));
        if (!wsUrl) {
            return false;
        }

        return new Promise((resolve) => {
            let settled = false;
            let socket = null;

            try {
                socket = new WebSocket(wsUrl);
            } catch {
                resolve(false);
                return;
            }

            const connectTimer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    try { socket.close(); } catch { /* ignore */ }
                    resolve(false);
                }
            }, 5000);

            socket.onopen = () => {
                clearTimeout(connectTimer);
                this.#ws = socket;
                try {
                    socket.send(String(this.#lastId));
                } catch {
                    // ignore
                }
                if (!settled) {
                    settled = true;
                    resolve(true);
                }
            };

            socket.onmessage = (event) => {
                if (!this.#isRunning || this.#activeDriver !== 'websocket') {
                    return;
                }
                const incomingId = this.#extractIntFromPayload(event?.data);
                if (incomingId !== null) {
                    this.#handleIncomingId(incomingId);
                }
            };

            socket.onerror = () => {
                if (!settled) {
                    clearTimeout(connectTimer);
                    settled = true;
                    try { socket.close(); } catch { /* ignore */ }
                    resolve(false);
                } else {
                    this.event.emit('error', { driver: 'websocket', lastId: this.#lastId });
                }
            };

            socket.onclose = () => {
                if (!settled) {
                    clearTimeout(connectTimer);
                    settled = true;
                    resolve(false);
                    return;
                }
                if (this.#isRunning && this.#activeDriver === 'websocket') {
                    this.#scheduleReconnectOrFallback('websocket');
                }
            };
        });
    }

    /**
     * 3. Moteur `'sse'` : ouvre un flux Server-Sent Events (`EventSource`).
     * @private
     * @returns {Promise<boolean>}
     */
    async #startSseDriver() {
        if (!this.isSseAvailable || !this.#url) {
            return false;
        }

        const sseUrl = this.#buildUrlWithId(this.#url, this.#lastId);

        return new Promise((resolve) => {
            let settled = false;
            let source = null;

            try {
                source = new EventSource(sseUrl);
            } catch {
                resolve(false);
                return;
            }

            const connectTimer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    try { source.close(); } catch { /* ignore */ }
                    resolve(false);
                }
            }, 5000);

            source.onopen = () => {
                clearTimeout(connectTimer);
                this.#sse = source;
                if (!settled) {
                    settled = true;
                    resolve(true);
                }
            };

            source.onmessage = (event) => {
                if (!this.#isRunning || this.#activeDriver !== 'sse') {
                    return;
                }
                const rawCandidate = event?.lastEventId || event?.data;
                const incomingId = this.#extractIntFromPayload(rawCandidate);
                if (incomingId !== null) {
                    this.#handleIncomingId(incomingId);
                }
            };

            source.onerror = () => {
                if (!settled) {
                    clearTimeout(connectTimer);
                    settled = true;
                    try { source.close(); } catch { /* ignore */ }
                    resolve(false);
                    return;
                }

                this.event.emit('error', { driver: 'sse', lastId: this.#lastId });
                if (this.#isRunning && this.#activeDriver === 'sse' && source.readyState === 2) {
                    this.#scheduleReconnectOrFallback('sse');
                }
            };
        });
    }

    /**
     * 4. Moteur `'polling'` : exécute une synchronisation HTTP périodique selon `#pollingInterval`.
     * @private
     * @returns {Promise<boolean>}
     */
    async #startPollingDriver() {
        if (!this.isPollingAvailable || !this.#url) {
            return false;
        }

        await this.#pollOnce();

        this.#pollingTimer = setInterval(() => {
            if (this.#isRunning && this.#activeDriver === 'polling') {
                this.#pollOnce();
            }
        }, this.#pollingInterval);

        return true;
    }

    /**
     * Exécute un cycle de synchronisation HTTP via `refreshId()`.
     * @private
     * @returns {Promise<void>}
     */
    async #pollOnce() {
        await this.refreshId();
    }

    // =========================================================================
    // Méthodes privées — Nettoyage, Reconnexion & Traitement de l'entier `id`
    // =========================================================================

    /**
     * Ferme et nettoie le moteur actif.
     * @private
     * @returns {Promise<void>}
     */
    async #cleanupCurrentDriver() {
        const current = this.#activeDriver;
        this.#activeDriver = null;

        if (this.#pollingTimer) {
            clearInterval(this.#pollingTimer);
            this.#pollingTimer = null;
        }

        if (this.#ws) {
            try {
                this.#ws.onopen = null;
                this.#ws.onmessage = null;
                this.#ws.onerror = null;
                this.#ws.onclose = null;
                this.#ws.close();
            } catch {
                // ignore
            }
            this.#ws = null;
        }

        if (this.#sse) {
            try {
                this.#sse.onopen = null;
                this.#sse.onmessage = null;
                this.#sse.onerror = null;
                this.#sse.close();
            } catch {
                // ignore
            }
            this.#sse = null;
        }

        if (this.#nativeListener && typeof window !== 'undefined' && window.NLibNativeBridgeEvent) {
            window.NLibNativeBridgeEvent.off('service', this.#nativeListener);
            this.#nativeListener = null;
        }

        if (current === 'native' && this.isNativeAvailable) {
            await this.#invokeNativeService('stop', {
                serviceId: this.#serviceId,
                id: this.#lastId
            });
        }
    }

    /**
     * Planifie une reconnexion ou bascule sur le moteur suivant lorsque `'auto'` est actif.
     * @private
     * @param {'native'|'websocket'|'sse'|'polling'} failedDriver - Moteur interrompu.
     */
    #scheduleReconnectOrFallback(failedDriver) {
        if (!this.#isRunning) {
            return;
        }

        this.#clearTimers();
        this.#reconnectTimer = setTimeout(async () => {
            if (!this.#isRunning) {
                return;
            }

            if (this.#preferredDriver === 'auto') {
                const candidates = this.#getCandidateDrivers('auto');
                const failedIdx = candidates.indexOf(failedDriver);
                const nextCandidates = failedIdx >= 0
                    ? [...candidates.slice(failedIdx + 1), ...candidates.slice(0, failedIdx + 1)]
                    : candidates;

                for (let i = 0; i < nextCandidates.length; i++) {
                    const candidate = nextCandidates[i];
                    const ok = await this.#startSingleDriver(candidate);
                    if (ok) {
                        this.#activeDriver = candidate;
                        this.event.emit('connected', { driver: candidate, lastId: this.#lastId });
                        return;
                    }
                }
            } else {
                const ok = await this.#startSingleDriver(failedDriver);
                if (ok) {
                    this.#activeDriver = failedDriver;
                    this.event.emit('connected', { driver: failedDriver, lastId: this.#lastId });
                }
            }
        }, this.#reconnectDelay);
    }

    /**
     * Annule les minuteurs de polling et de reconnexion.
     * @private
     */
    #clearTimers() {
        if (this.#pollingTimer) {
            clearInterval(this.#pollingTimer);
            this.#pollingTimer = null;
        }
        if (this.#reconnectTimer) {
            clearTimeout(this.#reconnectTimer);
            this.#reconnectTimer = null;
        }
    }

    /**
     * Valide un identifiant entier reçu, met à jour `#lastId`, le sauvegarde dans `NIndexedDB`
     * et émet les événements `'id'` et `'change'`.
     * @private
     * @param {number} incomingId - Identifiant entier reçu.
     * @param {boolean} [emitEvents=true] - Indique si les événements doivent être émis.
     * @returns {Promise<void>}
     */
    async #handleIncomingId(incomingId, emitEvents = true) {
        const parsed = this.#parseIntId(incomingId);
        if (parsed === null) {
            return;
        }

        const hasChanged = parsed !== this.#lastId;
        if (hasChanged) {
            this.#lastId = parsed;
            await this.saveLastId(this.#lastId);
        }

        if (emitEvents) {
            this.event.emit('id', parsed);
            if (hasChanged) {
                this.event.emit('change', this.#lastId);
            }
        }
    }

    /**
     * Convertit une valeur en entier positif ou nul (`int >= 0`), ou retourne `null`.
     * @private
     * @param {any} value - Valeur à convertir.
     * @returns {number|null}
     */
    #parseIntId(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            const intVal = Math.trunc(value);
            return intVal >= 0 ? intVal : null;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (/^\d+$/.test(trimmed)) {
                const intVal = Number.parseInt(trimmed, 10);
                return Number.isSafeInteger(intVal) && intVal >= 0 ? intVal : null;
            }
        }
        return null;
    }

    /**
     * Extrait un entier (`int`) depuis une réponse brute (nombre, chaîne numérique ou objet JSON `{ id, lastId, data }`).
     * @private
     * @param {any} payload - Données reçues.
     * @returns {number|null}
     */
    #extractIntFromPayload(payload) {
        const direct = this.#parseIntId(payload);
        if (direct !== null) {
            return direct;
        }

        if (typeof payload === 'string') {
            const trimmed = payload.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    const parsedJson = JSON.parse(trimmed);
                    return this.#extractIntFromPayload(parsedJson);
                } catch {
                    return null;
                }
            }
            return null;
        }

        if (payload && typeof payload === 'object') {
            return this.#parseIntId(payload.id ?? payload.lastId ?? payload.data);
        }

        return null;
    }

    /**
     * Génère la clé de stockage IndexedDB associée au `serviceId`.
     * @private
     * @returns {string}
     */
    #getStorageKey() {
        return `__nservice_last_id__:${this.#serviceId}`;
    }

    /**
     * Ajoute le paramètre de requête `?id=<int>` à l'URL cible.
     * @private
     * @param {string} baseUrl - URL de base.
     * @param {number} id - Identifiant entier.
     * @returns {string}
     */
    #buildUrlWithId(baseUrl, id) {
        if (!baseUrl) return '';
        const sep = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${sep}id=${encodeURIComponent(String(id))}`;
    }

    /**
     * Convertit un schéma `http://` ou `https://` en schéma WebSocket `ws://` ou `wss://`.
     * @private
     * @param {string} url - URL d'entrée.
     * @returns {string}
     */
    #toWebSocketUrl(url) {
        if (!url) return '';
        if (url.startsWith('ws://') || url.startsWith('wss://')) {
            return url;
        }
        if (url.startsWith('https://')) {
            return `wss://${url.slice(8)}`;
        }
        if (url.startsWith('http://')) {
            return `ws://${url.slice(7)}`;
        }
        if (typeof location !== 'undefined' && location.origin) {
            const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = location.host;
            const path = url.startsWith('/') ? url : `/${url}`;
            return `${proto}//${host}${path}`;
        }
        return url;
    }

    /**
     * Exécute un appel vers le conteneur natif avec le descripteur `type: ['app', 'service', action]`.
     * @private
     * @param {'start'|'stop'|'send'} action - Action cible du service natif.
     * @param {Object} params - Paramètres contenant `serviceId` et `id`.
     * @returns {Promise<any>}
     */
    async #invokeNativeService(action, params = {}) {
        return await NUtil.sys.invokeNative({
            type: ['app', 'service', action],
            params
        });
    }
}

export default NService;
