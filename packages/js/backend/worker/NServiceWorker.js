/**
 * @file NServiceWorker.js
 * @package @nlib/js-backend
 * @description Gestionnaire universel de Service Worker, de mode hors-ligne (Offline-First), d'interception réseau
 * et de point d'entrée unique de pages (App Shell / SPA) avec repli automatique par **Monkey Patching**
 * (`fetch` & `XMLHttpRequest`) pour l'écosystème NLib.
 *
 * Règles architecturales NLib :
 * - Fonctionne comme une classe autonome sans aucune méthode statique (`static`), utilisable par instanciation
 *   directe (`new NServiceWorker(options)`).
 * - N'hérite pas de `NObject`.
 * - **Garantie de fonctionnement universel (Service Worker natif + Monkey Patching)** :
 *   1. Si l'API native `navigator.serviceWorker` est disponible et qu'un script `swUrl` est fourni (ou si exécuté
 *      directement dans un `ServiceWorkerGlobalScope`), pilote le Service Worker natif (`install`, `activate`, `fetch`, `message`).
 *   2. Si `ServiceWorker` n'est pas disponible (HTTP non sécurisé, `file://`, WebView mobile/desktop sans SW,
 *      navigateur restreint ou absence de script `sw.js` dédié), active automatiquement un **système de Monkey Patching**
 *      transparent sur `globalThis.fetch` et `globalThis.XMLHttpRequest` adossé à `NUtil.cache` et `NUtil.file`.
 *      Ainsi, l'interception des requêtes, la mise en cache des fichiers, le mode hors-ligne et le point d'entrée unique
 *      des pages fonctionnent **toujours**, dans 100 % des environnements.
 * - **Point d'entrée unique pour les pages (`entryPoint`)** :
 *   Permet de définir une page maîtresse unique (ex: `'/index.html'`) qui sera servie automatiquement pour toute
 *   navigation de page (`mode === 'navigate'` ou `Accept: text/html`), garantissant le chargement hors-ligne
 *   de toutes les routes applicatives.
 * - Contrat strict **Zero Throw / Zero Reject** : aucune exception non capturée, journalisation via `NUtil.log`.
 */

import { NEvent } from '../core/NEvent.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * Règle de routage et de mise en cache pour l'interception des requêtes.
 * @typedef {Object} NServiceWorkerRoute
 * @property {string|RegExp|Function} match - Motif d'URL (chaîne, préfixe, extension `'.png'`, RegExp ou fonction `(url, req) => boolean`).
 * @property {'cache-first'|'network-first'|'stale-while-revalidate'|'cache-only'|'network-only'} [strategy='network-first'] - Stratégie de cache.
 * @property {number} [ttl=0] - Durée de validité en cache en secondes (`0` = infini).
 * @property {Array<string>} [methods=['GET']] - Méthodes HTTP interceptées par cette règle.
 * @property {Array<string>} [tags=[]] - Tags associés aux entrées mises en cache.
 */

/**
 * @class NServiceWorker
 * @description Système complet de gestion du mode hors-ligne (Offline), d'interception et mise en cache automatique
 * des requêtes/fichiers (`NUtil.cache` / `NUtil.file`), de point d'entrée unique pour les pages (`entryPoint`),
 * et de Monkey Patching (`fetch` / `XMLHttpRequest`) lorsque `ServiceWorker` n'est pas disponible.
 *
 * @example <caption>Exemple 1 : Activer le mode Offline avec un point d'entrée unique pour toutes les pages</caption>
 * const sw = new NServiceWorker();
 * await sw.enable({
 *     entryPoint: '/index.html',
 *     precache: ['/index.html', '/app.js', '/styles.css'],
 *     defaultStrategy: 'network-first'
 * });
 *
 * @example <caption>Exemple 2 : Définir des règles d'interception par type de fichier ou route d'API</caption>
 * const sw = new NServiceWorker();
 * sw.addRoute({ match: /\.(png|jpg|svg|woff2)$/i, strategy: 'cache-first', ttl: 86400 });
 * sw.addRoute({ match: '/api/catalog', strategy: 'stale-while-revalidate', ttl: 300 });
 *
 * @example <caption>Exemple 3 : Résoudre un fichier local ou mis en cache en URL exploitable hors-ligne</caption>
 * const sw = new NServiceWorker();
 * const logoUrl = await sw.resolveFileUrl('/assets/logo.png');
 * console.log(logoUrl);
 */
export class NServiceWorker {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Indique si le système `NServiceWorker` est actuellement activé.
     * @type {boolean}
     * @private
     */
    #enabled = false;

    /**
     * Mode d'exécution actif (`'native-sw'`, `'worker-scope'`, `'monkey-patch'` ou `'inactive'`).
     * @type {'native-sw'|'worker-scope'|'monkey-patch'|'inactive'}
     * @private
     */
    #mode = 'inactive';

    /**
     * URL du script Service Worker natif (ex: `'/sw.js'`), optionnelle.
     * @type {string|null}
     * @private
     */
    #swUrl = null;

    /**
     * Périmètre (scope) du Service Worker natif (`'/'` par défaut).
     * @type {string}
     * @private
     */
    #scope = '/';

    /**
     * Point d'entrée unique pour les pages (App Shell / SPA fallback, ex: `'/index.html'`).
     * @type {string|null}
     * @private
     */
    #entryPoint = null;

    /**
     * Stratégie de cache appliquée par défaut aux requêtes GET interceptées.
     * @type {'cache-first'|'network-first'|'stale-while-revalidate'|'cache-only'|'network-only'}
     * @private
     */
    #defaultStrategy = 'network-first';

    /**
     * Durée de vie par défaut en cache en secondes (`0` = sans expiration).
     * @type {number}
     * @private
     */
    #defaultTtl = 0;

    /**
     * Indique si toutes les requêtes GET doivent être interceptées par défaut (ou seulement celles correspondant aux routes/fichiers).
     * @type {boolean}
     * @private
     */
    #interceptAllGet = true;

    /**
     * Liste des URLs/fichiers à pré-charger dans le cache dès l'activation.
     * @type {Array<string>}
     * @private
     */
    #precacheUrls = [];

    /**
     * Liste des règles de routage et d'interception personnalisées.
     * @type {Array<NServiceWorkerRoute>}
     * @private
     */
    #routes = [];

    /**
     * Fonction de filtrage optionnelle `(url, options) => boolean` pour décider si une requête doit être interceptée.
     * @type {Function|null}
     * @private
     */
    #shouldInterceptFn = null;

    /**
     * Enregistrement natif `ServiceWorkerRegistration` si disponible.
     * @type {ServiceWorkerRegistration|null}
     * @private
     */
    #registration = null;

    /**
     * Référence vers la fonction `globalThis.fetch` originale avant Monkey Patching.
     * @type {Function|null}
     * @private
     */
    #originalFetch = null;

    /**
     * Références vers les méthodes originales de `XMLHttpRequest.prototype` avant Monkey Patching.
     * @type {{ open: Function, send: Function, setRequestHeader: Function }|null}
     * @private
     */
    #originalXhr = null;

    /**
     * Indique si le Monkey Patching (`fetch` + `XMLHttpRequest`) est actuellement installé.
     * @type {boolean}
     * @private
     */
    #isMonkeyPatched = false;

    /**
     * Indique si les écouteurs du `ServiceWorkerGlobalScope` (`install`, `activate`, `fetch`, `message`) sont attachés.
     * @type {boolean}
     * @private
     */
    #isWorkerScopeAttached = false;

    /**
     * Bus d'événements interne (`NEvent`) alloué paresseusement.
     * @type {NEvent|null}
     * @private
     */
    #event = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NServiceWorker`.
     *
     * @constructor
     * @param {Object} [options={}] - Options initiales de configuration.
     * @param {string} [options.swUrl] - Chemin vers le fichier Service Worker natif (ex: `'/sw.js'`).
     * @param {string} [options.scope='/'] - Scope du Service Worker.
     * @param {string} [options.entryPoint] - Point d'entrée unique pour toutes les pages (ex: `'/index.html'`).
     * @param {'cache-first'|'network-first'|'stale-while-revalidate'|'cache-only'|'network-only'} [options.defaultStrategy='network-first'] - Stratégie par défaut.
     * @param {number} [options.defaultTtl=0] - TTL par défaut en secondes.
     * @param {Array<string>} [options.precache=[]] - Liste d'URLs/fichiers à pré-cacher.
     * @param {Array<NServiceWorkerRoute>} [options.routes=[]] - Règles d'interception initiales.
     *
     * @example <caption>Exemple 1 : Instanciation standard</caption>
     * const sw = new NServiceWorker();
     *
     * @example <caption>Exemple 2 : Instanciation préconfigurée avec point d'entrée unique</caption>
     * const sw = new NServiceWorker({
     *     entryPoint: '/index.html',
     *     defaultStrategy: 'network-first'
     * });
     */
    constructor(options = {}) {
        this.configure(options);
    }

    // =========================================================================
    // Accesseurs d'instance
    // =========================================================================

    /**
     * Retourne le bus d'événements `NEvent` de `NServiceWorker` (alloué au premier accès).
     * Événements émis : `'enabled'`, `'disabled'`, `'precache'`, `'intercept'`, `'offlineFallback'`, `'updated'`.
     *
     * @returns {NEvent} Instance de `NEvent`.
     *
     * @example <caption>Exemple 1 : Écouter les interceptions servies hors-ligne</caption>
     * sw.event.on('offlineFallback', ({ url }) => {
     *     console.log('Servi hors-ligne :', url);
     * });
     *
     * @example <caption>Exemple 2 : Écouter l'activation du mode offline</caption>
     * sw.event.on('enabled', ({ mode }) => console.log('Mode actif :', mode));
     */
    get event() {
        if (!this.#event) {
            this.#event = new NEvent();
        }
        return this.#event;
    }

    /**
     * Indique si l'API native `navigator.serviceWorker` est disponible et utilisable dans le contexte actuel.
     * (Note : les navigateurs exigent HTTPS ou `localhost` et interdisent le protocole `file://`).
     *
     * @returns {boolean} `true` si `navigator.serviceWorker` est supporté.
     *
     * @example <caption>Exemple 1 : Vérifier le support natif Service Worker</caption>
     * console.log(sw.isNativeSupported);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof sw.isNativeSupported); // 'boolean'
     */
    get isNativeSupported() {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker) {
            return false;
        }
        if (typeof location !== 'undefined' && location.protocol === 'file:') {
            return false;
        }
        return Boolean(NUtil.env.isSecureContext);
    }

    /**
     * Indique si le code s'exécute actuellement à l'intérieur même d'un `ServiceWorkerGlobalScope`.
     *
     * @returns {boolean} `true` si exécuté dans le thread du Service Worker.
     *
     * @example <caption>Exemple 1 : Détecter le contexte Service Worker</caption>
     * console.log(sw.isServiceWorkerScope);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof sw.isServiceWorkerScope); // 'boolean'
     */
    get isServiceWorkerScope() {
        return (
            typeof ServiceWorkerGlobalScope !== 'undefined' &&
            typeof self !== 'undefined' &&
            self instanceof ServiceWorkerGlobalScope
        );
    }

    /**
     * Indique si `NServiceWorker` est actuellement actif (soit via Service Worker natif, soit via Monkey Patching).
     *
     * @returns {boolean} `true` si actif.
     *
     * @example <caption>Exemple 1 : Vérifier si le système hors-ligne est activé</caption>
     * console.log(sw.isEnabled);
     *
     * @example <caption>Exemple 2 : Activer si non actif</caption>
     * if (!sw.isEnabled) { await sw.enable(); }
     */
    get isEnabled() {
        return this.#enabled;
    }

    /**
     * Indique si le mode Monkey Patching (`fetch` + `XMLHttpRequest`) est actif.
     *
     * @returns {boolean} `true` si le Monkey Patching est en place.
     *
     * @example <caption>Exemple 1 : Vérifier l'état du Monkey Patching</caption>
     * console.log(sw.isMonkeyPatched);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof sw.isMonkeyPatched); // 'boolean'
     */
    get isMonkeyPatched() {
        return this.#isMonkeyPatched;
    }

    /**
     * Retourne le mode de fonctionnement actuel :
     * `'native-sw'` | `'worker-scope'` | `'monkey-patch'` | `'inactive'`.
     *
     * @returns {'native-sw'|'worker-scope'|'monkey-patch'|'inactive'} Mode actif.
     *
     * @example <caption>Exemple 1 : Lire le mode actif</caption>
     * console.log(sw.mode);
     *
     * @example <caption>Exemple 2 : Toujours une chaîne valide</caption>
     * console.log(['native-sw', 'worker-scope', 'monkey-patch', 'inactive'].includes(sw.mode)); // true
     */
    get mode() {
        return this.#mode;
    }

    /**
     * Retourne le point d'entrée unique configuré pour les pages (ex: `'/index.html'`).
     *
     * @returns {string|null} Point d'entrée unique ou `null`.
     *
     * @example <caption>Exemple 1 : Consulter le point d'entrée des pages</caption>
     * sw.setEntryPoint('/index.html');
     * console.log(sw.entryPoint); // '/index.html'
     *
     * @example <caption>Exemple 2 : Valeur initiale</caption>
     * console.log(new NServiceWorker().entryPoint); // null
     */
    get entryPoint() {
        return this.#entryPoint;
    }

    // =========================================================================
    // Méthodes publiques — Configuration, Point d'Entrée & Routes
    // =========================================================================

    /**
     * Configure les options du gestionnaire `NServiceWorker` (point d'entrée unique, stratégie par défaut,
     * fichiers à pré-cacher, règles de routes, URL du script SW).
     *
     * @param {Object} [options={}] - Options de configuration.
     * @param {string} [options.swUrl] - URL du script Service Worker natif (ex: `'/sw.js'`).
     * @param {string} [options.scope] - Scope du Service Worker (ex: `'/'`).
     * @param {string} [options.entryPoint] - Point d'entrée unique pour toutes les pages (ex: `'/index.html'`).
     * @param {'cache-first'|'network-first'|'stale-while-revalidate'|'cache-only'|'network-only'} [options.defaultStrategy] - Stratégie par défaut.
     * @param {number} [options.defaultTtl] - TTL par défaut en secondes.
     * @param {boolean} [options.interceptAllGet] - Intercepter toutes les requêtes GET par défaut.
     * @param {Array<string>} [options.precache] - Liste d'URLs/fichiers à pré-mettre en cache.
     * @param {Array<NServiceWorkerRoute>} [options.routes] - Règles de routage à ajouter.
     * @param {Function} [options.shouldIntercept] - Prédicat personnalisé `(url, req) => boolean`.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Configurer le point d'entrée unique et la stratégie par défaut</caption>
     * sw.configure({
     *     entryPoint: '/index.html',
     *     defaultStrategy: 'network-first',
     *     defaultTtl: 3600
     * });
     *
     * @example <caption>Exemple 2 : Configurer une liste de fichiers critiques à pré-cacher</caption>
     * sw.configure({
     *     precache: ['/index.html', '/assets/app.js', '/assets/logo.png']
     * });
     */
    configure(options = {}) {
        if (!options || typeof options !== 'object') {
            return this;
        }
        if (typeof options.swUrl === 'string' && options.swUrl.trim()) {
            this.#swUrl = options.swUrl.trim();
        }
        if (typeof options.scope === 'string' && options.scope.trim()) {
            this.#scope = options.scope.trim();
        }
        if (options.entryPoint !== undefined) {
            this.setEntryPoint(options.entryPoint);
        }
        if (typeof options.defaultStrategy === 'string' && options.defaultStrategy.trim()) {
            this.#defaultStrategy = options.defaultStrategy.trim();
        }
        if (typeof options.defaultTtl === 'number' && options.defaultTtl >= 0) {
            this.#defaultTtl = options.defaultTtl;
        }
        if (typeof options.interceptAllGet === 'boolean') {
            this.#interceptAllGet = options.interceptAllGet;
        }
        if (Array.isArray(options.precache)) {
            for (let i = 0; i < options.precache.length; i++) {
                const u = options.precache[i];
                if (typeof u === 'string' && u.trim() && !this.#precacheUrls.includes(u.trim())) {
                    this.#precacheUrls.push(u.trim());
                }
            }
        }
        if (Array.isArray(options.routes)) {
            for (let i = 0; i < options.routes.length; i++) {
                this.addRoute(options.routes[i]);
            }
        }
        if (typeof options.shouldIntercept === 'function') {
            this.#shouldInterceptFn = options.shouldIntercept;
        }
        return this;
    }

    /**
     * Définit le point d'entrée unique pour toutes les navigations de pages (App Shell / SPA fallback).
     * Lorsqu'une page est demandée (ou en mode hors-ligne), `NServiceWorker` sert le contenu mis en cache
     * de ce point d'entrée unique.
     *
     * @param {string|null} entryPointUrl - URL ou chemin du point d'entrée (ex: `'/index.html'`), ou `null` pour désactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir '/index.html' comme point d'entrée unique des pages</caption>
     * sw.setEntryPoint('/index.html');
     * console.log(sw.entryPoint); // '/index.html'
     *
     * @example <caption>Exemple 2 : Désactiver le point d'entrée unique</caption>
     * sw.setEntryPoint(null);
     * console.log(sw.entryPoint); // null
     */
    setEntryPoint(entryPointUrl) {
        if (typeof entryPointUrl === 'string' && entryPointUrl.trim()) {
            this.#entryPoint = entryPointUrl.trim();
            if (!this.#precacheUrls.includes(this.#entryPoint)) {
                this.#precacheUrls.unshift(this.#entryPoint);
            }
        } else {
            this.#entryPoint = null;
        }
        return this;
    }

    /**
     * Ajoute une règle d'interception et de stratégie de cache pour un motif d'URL, une extension de fichier,
     * une expression régulière ou un prédicat personnalisé.
     *
     * @param {NServiceWorkerRoute} route - Définition de la règle.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Mettre en cache-first tous les fichiers statiques (images, polices, scripts)</caption>
     * sw.addRoute({
     *     match: /\.(js|css|png|jpg|jpeg|webp|svg|woff2)$/i,
     *     strategy: 'cache-first',
     *     ttl: 86400
     * });
     *
     * @example <caption>Exemple 2 : Utiliser network-first sur les appels d'API pour avoir un repli hors-ligne</caption>
     * sw.addRoute({
     *     match: '/api/',
     *     strategy: 'network-first',
     *     ttl: 600
     * });
     */
    addRoute(route) {
        if (!route || typeof route !== 'object' || !route.match) {
            return this;
        }
        this.#routes.push({
            match: route.match,
            strategy: route.strategy || this.#defaultStrategy,
            ttl: typeof route.ttl === 'number' ? route.ttl : this.#defaultTtl,
            methods: Array.isArray(route.methods)
                ? route.methods.map((m) => String(m).toUpperCase())
                : ['GET'],
            tags: Array.isArray(route.tags) ? route.tags : []
        });
        return this;
    }

    /**
     * Supprime toutes les règles de routage personnalisées.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Réinitialiser les routes</caption>
     * sw.clearRoutes();
     *
     * @example <caption>Exemple 2 : Chaîner avec une nouvelle route</caption>
     * sw.clearRoutes().addRoute({ match: '/api/', strategy: 'network-first' });
     */
    clearRoutes() {
        this.#routes = [];
        return this;
    }

    // =========================================================================
    // Méthodes publiques — Activation, Pré-cache & Monkey Patching
    // =========================================================================

    /**
     * Active le système `NServiceWorker` :
     * 1. Si exécuté à l'intérieur d'un `ServiceWorkerGlobalScope`, attache les écouteurs `install`, `activate`, `fetch` et `message`.
     * 2. Si exécuté sur le thread principal :
     *    - Tente d'enregistrer le Service Worker natif si `isNativeSupported` est vrai et que `swUrl` est défini.
     *    - Active systématiquement le **Monkey Patching** (`fetch` + `XMLHttpRequest`) si le Service Worker natif
     *      n'est pas disponible, si aucun `swUrl` n'est fourni, ou si `options.monkeyPatch !== false`,
     *      afin que l'interception par `NUtil.cache` et `NUtil.file` fonctionne **immédiatement et partout**
     *      (y compris dès le premier chargement de page et dans les WebViews/environnements sans SW).
     *    - Pré-met en cache (`precache`) le `entryPoint` et toutes les ressources déclarées dans `precache`.
     *
     * @param {Object} [options={}] - Options de configuration et d'activation.
     * @returns {Promise<{ ok: boolean, mode: string, precachedCount: number, error: string|null }>} Résultat d'activation.
     *
     * @example <caption>Exemple 1 : Activer le mode hors-ligne complet (avec repli Monkey Patch automatique)</caption>
     * const res = await sw.enable({
     *     entryPoint: '/index.html',
     *     precache: ['/index.html', '/main.js', '/style.css']
     * });
     * console.log(res.ok, res.mode); // true, 'monkey-patch' ou 'native-sw'
     *
     * @example <caption>Exemple 2 : Activer avec un fichier sw.js dédié</caption>
     * const res2 = await sw.enable({
     *     swUrl: '/sw.js',
     *     entryPoint: '/index.html'
     * });
     */
    async enable(options = {}) {
        this.configure(options);

        try {
            // Cas 1 : Exécution à l'intérieur même du Service Worker
            if (this.isServiceWorkerScope) {
                this.installServiceWorkerListeners();
                this.#enabled = true;
                this.#mode = 'worker-scope';
                const precachedCount = await this.precache(this.#precacheUrls);
                this.#emit('enabled', { mode: this.#mode, precachedCount });
                return { ok: true, mode: this.#mode, precachedCount, error: null };
            }

            // Cas 2 : Thread principal — Enregistrement du Service Worker natif si swUrl est fourni et supporté
            let nativeRegistered = false;
            if (this.#swUrl && this.isNativeSupported) {
                try {
                    this.#registration = await navigator.serviceWorker.register(this.#swUrl, {
                        scope: this.#scope
                    });
                    nativeRegistered = true;
                    this.#syncConfigToNativeSw();
                } catch (swErr) {
                    NUtil.log.warn(`NServiceWorker.enable : Échec d'enregistrement du Service Worker "${this.#swUrl}". Bascule sur Monkey Patching.`, {
                        code: 'WARN_SW_REGISTER_FALLBACK',
                        swUrl: this.#swUrl,
                        error: swErr?.message
                    });
                    nativeRegistered = false;
                }
            }

            // Activation du Monkey Patching (toujours activé si pas de SW natif, ou en complément pour couvrir le 1er chargement)
            if (!nativeRegistered || options?.monkeyPatch !== false) {
                this.enableMonkeyPatch();
            }

            this.#enabled = true;
            this.#mode = nativeRegistered ? 'native-sw' : 'monkey-patch';

            // Pré-chargement en cache du point d'entrée et des ressources déclarées
            const precachedCount = await this.precache(this.#precacheUrls);

            this.#emit('enabled', { mode: this.#mode, precachedCount });
            return {
                ok: true,
                mode: this.#mode,
                precachedCount,
                error: null
            };
        } catch (err) {
            NUtil.log.error('NServiceWorker.enable : Erreur lors de l\'activation.', {
                code: 'ERR_SW_ENABLE',
                error: err?.message
            });
            return {
                ok: false,
                mode: this.#mode,
                precachedCount: 0,
                error: err?.message || 'Erreur lors de l\'activation de NServiceWorker.'
            };
        }
    }

    /**
     * Désactive `NServiceWorker`, restaure les fonctions natives `fetch` et `XMLHttpRequest`
     * si le Monkey Patching était actif, et désenregistre optionnellement le Service Worker natif.
     *
     * @param {Object} [options={}] - Options (`{ unregisterNative: false }`).
     * @returns {Promise<boolean>} `true` une fois désactivé.
     *
     * @example <caption>Exemple 1 : Désactiver l'interception</caption>
     * await sw.disable();
     * console.log(sw.isEnabled); // false
     *
     * @example <caption>Exemple 2 : Désactiver et désenregistrer le Service Worker natif</caption>
     * await sw.disable({ unregisterNative: true });
     */
    async disable(options = {}) {
        this.disableMonkeyPatch();

        if (options?.unregisterNative && this.#registration && typeof this.#registration.unregister === 'function') {
            try {
                await this.#registration.unregister();
                this.#registration = null;
            } catch {
                // Ignore
            }
        }

        this.#enabled = false;
        this.#mode = 'inactive';
        this.#emit('disabled', {});
        return true;
    }

    /**
     * Installe le **Monkey Patching** sur `globalThis.fetch` et `globalThis.XMLHttpRequest`
     * afin d'intercepter toutes les requêtes réseau et de fichiers même lorsque `ServiceWorker`
     * n'est pas disponible dans l'environnement.
     *
     * @returns {boolean} `true` si le Monkey Patching est actif.
     *
     * @example <caption>Exemple 1 : Activer explicitement le Monkey Patching</caption>
     * sw.enableMonkeyPatch();
     * console.log(sw.isMonkeyPatched); // true
     *
     * @example <caption>Exemple 2 : Appel idempotent sans double patch</caption>
     * sw.enableMonkeyPatch();
     * sw.enableMonkeyPatch();
     * console.log(sw.isMonkeyPatched); // true
     */
    enableMonkeyPatch() {
        if (this.#isMonkeyPatched) {
            return true;
        }

        const selfInstance = this;

        // 1. Monkey Patching de globalThis.fetch
        if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
            this.#originalFetch = globalThis.fetch.bind(globalThis);

            globalThis.fetch = async function patchedNLibFetch(input, init = {}) {
                if (!selfInstance.#enabled) {
                    return await selfInstance.#originalFetch(input, init);
                }
                return await selfInstance.#handlePatchedFetch(input, init);
            };
        }

        // 2. Monkey Patching de globalThis.XMLHttpRequest (pour XHR et chargement de fichiers)
        if (typeof globalThis !== 'undefined' && typeof globalThis.XMLHttpRequest === 'function') {
            const Proto = globalThis.XMLHttpRequest.prototype;
            this.#originalXhr = {
                open: Proto.open,
                send: Proto.send,
                setRequestHeader: Proto.setRequestHeader
            };

            Proto.open = function patchedXhrOpen(method, url, async = true, user, password) {
                this.__nlibXhrMeta = {
                    method: String(method || 'GET').toUpperCase(),
                    url: String(url || ''),
                    async: async !== false,
                    headers: {}
                };
                return selfInstance.#originalXhr.open.call(this, method, url, async, user, password);
            };

            Proto.setRequestHeader = function patchedXhrSetHeader(name, value) {
                if (this.__nlibXhrMeta && name) {
                    this.__nlibXhrMeta.headers[String(name).toLowerCase()] = String(value);
                }
                return selfInstance.#originalXhr.setRequestHeader.call(this, name, value);
            };

            Proto.send = function patchedXhrSend(body) {
                const meta = this.__nlibXhrMeta;
                if (
                    !selfInstance.#enabled ||
                    !meta ||
                    !meta.async ||
                    meta.method !== 'GET' ||
                    !selfInstance.#shouldIntercept(meta.url, { method: meta.method, headers: meta.headers })
                ) {
                    return selfInstance.#originalXhr.send.call(this, body);
                }

                // Interception asynchrone via handleRequest
                selfInstance
                    .handleRequest(meta.url, {
                        method: meta.method,
                        headers: meta.headers
                    })
                    .then(async (response) => {
                        if (!response) {
                            return selfInstance.#originalXhr.send.call(this, body);
                        }
                        await selfInstance.#fulfillXhrWithResponse(this, response);
                    })
                    .catch(() => {
                        selfInstance.#originalXhr.send.call(this, body);
                    });
            };
        }

        this.#isMonkeyPatched = true;
        return true;
    }

    /**
     * Désactive le Monkey Patching et restaure `globalThis.fetch` et `XMLHttpRequest.prototype` d'origine.
     *
     * @returns {boolean} `true` une fois restauré.
     *
     * @example <caption>Exemple 1 : Désactiver le Monkey Patching</caption>
     * sw.disableMonkeyPatch();
     * console.log(sw.isMonkeyPatched); // false
     *
     * @example <caption>Exemple 2 : Sûr même si non patché</caption>
     * console.log(sw.disableMonkeyPatch()); // true
     */
    disableMonkeyPatch() {
        if (!this.#isMonkeyPatched) {
            return true;
        }

        if (this.#originalFetch && typeof globalThis !== 'undefined') {
            globalThis.fetch = this.#originalFetch;
            this.#originalFetch = null;
        }

        if (this.#originalXhr && typeof globalThis !== 'undefined' && typeof globalThis.XMLHttpRequest === 'function') {
            const Proto = globalThis.XMLHttpRequest.prototype;
            Proto.open = this.#originalXhr.open;
            Proto.send = this.#originalXhr.send;
            Proto.setRequestHeader = this.#originalXhr.setRequestHeader;
            this.#originalXhr = null;
        }

        this.#isMonkeyPatched = false;
        return true;
    }

    /**
     * Télécharge et met en cache de manière proactive une liste d'URLs ou de chemins de fichiers
     * afin qu'ils soient immédiatement disponibles hors-ligne.
     *
     * @param {Array<string>} [urls=this.#precacheUrls] - Liste d'URLs à pré-cacher.
     * @param {Object} [options={}] - Options (`{ ttl: 0, forceRefresh: false }`).
     * @returns {Promise<number>} Nombre de ressources mises en cache avec succès.
     *
     * @example <caption>Exemple 1 : Pré-mettre en cache les fichiers essentiels de l'application</caption>
     * const count = await sw.precache(['/index.html', '/app.js', '/logo.png']);
     * console.log(`${count} fichiers prêts pour le mode hors-ligne`);
     *
     * @example <caption>Exemple 2 : Forcer le rafraîchissement du pré-cache</caption>
     * await sw.precache(['/index.html'], { forceRefresh: true });
     */
    async precache(urls = this.#precacheUrls, options = {}) {
        if (!Array.isArray(urls) || urls.length === 0) {
            return 0;
        }

        let successCount = 0;
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            if (typeof url !== 'string' || !url.trim()) {
                continue;
            }
            const cleanUrl = url.trim();
            if (!this.#precacheUrls.includes(cleanUrl)) {
                this.#precacheUrls.push(cleanUrl);
            }

            const data = await NUtil.cache.cacheUrl(cleanUrl, {
                ttl: options?.ttl ?? this.#defaultTtl,
                forceRefresh: Boolean(options?.forceRefresh),
                tags: ['__precache__']
            });

            if (data !== null) {
                successCount++;
            }
        }

        this.#emit('precache', { total: urls.length, cached: successCount });
        return successCount;
    }

    // =========================================================================
    // Méthodes publiques — Interception, Résolution de Fichiers & Scope SW
    // =========================================================================

    /**
     * Traite une requête (URL ou objet `Request`) selon les règles d'interception, le point d'entrée unique (`entryPoint`),
     * les stratégies de cache (`NUtil.cache`) et les fichiers locaux (`NUtil.file`), et retourne une `Response`.
     *
     * @param {string|Request} requestOrUrl - URL ou instance `Request`.
     * @param {Object} [init={}] - Options de la requête (`{ method, headers, mode, strategy, ttl }`).
     * @returns {Promise<Response|null>} Instance `Response` (ou objet compatible si `Response` n'existe pas).
     *
     * @example <caption>Exemple 1 : Résoudre une requête avec repli automatique sur le cache hors-ligne</caption>
     * const response = await sw.handleRequest('/api/items', { strategy: 'network-first' });
     * console.log(response?.status);
     *
     * @example <caption>Exemple 2 : Résoudre une navigation de page via le point d'entrée unique</caption>
     * sw.setEntryPoint('/index.html');
     * const navRes = await sw.handleRequest('/dashboard/settings', { mode: 'navigate' });
     */
    async handleRequest(requestOrUrl, init = {}) {
        const parsed = this.#parseRequestInput(requestOrUrl, init);
        if (!parsed.url) {
            return null;
        }

        const route = this.#matchRoute(parsed.url, parsed);
        const strategy = init?.strategy || route?.strategy || this.#defaultStrategy;
        const ttl = init?.ttl ?? route?.ttl ?? this.#defaultTtl;
        const tags = route?.tags || [];

        this.#emit('intercept', {
            url: parsed.url,
            method: parsed.method,
            strategy,
            isNavigation: parsed.isNavigation
        });

        // 1. Si c'est une navigation de page et qu'un point d'entrée unique (entryPoint) est configuré
        if (parsed.isNavigation && this.#entryPoint) {
            return await this.#handleNavigationWithEntryPoint(parsed, strategy, ttl);
        }

        // 2. Application de la stratégie de cache choisie
        switch (strategy) {
            case 'cache-only':
                return await this.#strategyCacheOnly(parsed.url);

            case 'network-only':
                return await this.#strategyNetworkOnly(parsed);

            case 'cache-first':
                return await this.#strategyCacheFirst(parsed, ttl, tags);

            case 'stale-while-revalidate':
                return await this.#strategyStaleWhileRevalidate(parsed, ttl, tags);

            case 'network-first':
            default:
                return await this.#strategyNetworkFirst(parsed, ttl, tags);
        }
    }

    /**
     * Résout une URL ou un chemin de fichier en une URL directement utilisable dans le DOM (`src`, `href`)
     * même hors-ligne ou sans Service Worker :
     * - Cherche d'abord dans `NUtil.cache` (`matchUrl`), puis dans `NUtil.file` (`readDataUrl`),
     *   sinon télécharge et met en cache via `NUtil.cache.cacheUrl` et retourne une Data URL (ou l'URL d'origine).
     *
     * @param {string} urlOrPath - URL ou chemin de fichier local.
     * @param {Object} [options={}] - Options (`{ ttl: 0, forceRefresh: false }`).
     * @returns {Promise<string>} Data URL / Blob URL exploitable hors-ligne, ou l'URL d'origine en repli.
     *
     * @example <caption>Exemple 1 : Obtenir une URL autonome hors-ligne pour une image</caption>
     * const src = await sw.resolveFileUrl('/assets/logo.png');
     * console.log(typeof src); // 'string'
     *
     * @example <caption>Exemple 2 : Résoudre un fichier enregistré dans NUtil.file</caption>
     * await NUtil.file.writeText('local/hello.txt', 'Contenu local');
     * const fileUrl = await sw.resolveFileUrl('local/hello.txt');
     * console.log(fileUrl.startsWith('data:')); // true
     */
    async resolveFileUrl(urlOrPath, options = {}) {
        if (typeof urlOrPath !== 'string' || !urlOrPath.trim()) {
            return '';
        }
        const target = urlOrPath.trim();

        try {
            // 1. Vérifier dans NUtil.cache
            if (!options?.forceRefresh) {
                const cachedDataUrl = await NUtil.cache.matchUrl(target, { format: 'dataUrl' });
                if (cachedDataUrl) {
                    return cachedDataUrl;
                }
            }

            // 2. Vérifier dans NUtil.file (fichiers locaux)
            if (await NUtil.file.exists(target)) {
                const fileDataUrl = await NUtil.file.readDataUrl(target);
                if (fileDataUrl) {
                    return fileDataUrl;
                }
            }

            // 3. Télécharger et mettre en cache via NUtil.cache.cacheUrl
            const fetchedDataUrl = await NUtil.cache.cacheUrl(target, {
                ttl: options?.ttl ?? this.#defaultTtl,
                forceRefresh: Boolean(options?.forceRefresh),
                format: 'dataUrl'
            });

            return fetchedDataUrl || target;
        } catch {
            return target;
        }
    }

    /**
     * Attache automatiquement les écouteurs standards (`install`, `activate`, `fetch`, `message`)
     * lorsque ce script est exécuté directement à l'intérieur d'un fichier Service Worker (`sw.js`).
     *
     * @returns {boolean} `true` si les écouteurs ont été attachés au `ServiceWorkerGlobalScope`.
     *
     * @example <caption>Exemple 1 : Dans un fichier sw.js dédié</caption>
     * // sw.js :
     * sw.configure({
     *     entryPoint: '/index.html',
     *     precache: ['/index.html', '/app.js']
     * });
     * sw.installServiceWorkerListeners();
     *
     * @example <caption>Exemple 2 : Vérifier si attaché</caption>
     * console.log(typeof sw.installServiceWorkerListeners()); // 'boolean'
     */
    installServiceWorkerListeners() {
        if (this.#isWorkerScopeAttached || typeof self === 'undefined' || typeof self.addEventListener !== 'function') {
            return false;
        }

        self.addEventListener('install', (event) => {
            if (typeof self.skipWaiting === 'function') {
                self.skipWaiting();
            }
            if (typeof event.waitUntil === 'function') {
                event.waitUntil(this.precache(this.#precacheUrls));
            }
        });

        self.addEventListener('activate', (event) => {
            if (self.clients && typeof self.clients.claim === 'function' && typeof event.waitUntil === 'function') {
                event.waitUntil(self.clients.claim());
            }
        });

        self.addEventListener('fetch', (event) => {
            const req = event.request;
            if (!req || req.method !== 'GET') {
                return;
            }
            const parsed = this.#parseRequestInput(req, {});
            if (!this.#shouldIntercept(parsed.url, parsed)) {
                return;
            }
            if (typeof event.respondWith === 'function') {
                event.respondWith(
                    this.handleRequest(req).then((res) => {
                        if (res) return res;
                        return fetch(req);
                    })
                );
            }
        });

        self.addEventListener('message', (event) => {
            const data = event?.data;
            if (!data || typeof data !== 'object') {
                return;
            }
            if (data.type === 'NLIB_SW_CONFIG' && data.config) {
                this.configure(data.config);
                if (Array.isArray(data.config.precache) && data.config.precache.length > 0) {
                    this.precache(data.config.precache);
                }
            }
        });

        this.#isWorkerScopeAttached = true;
        return true;
    }

    // =========================================================================
    // Méthodes privées — Stratégies de Cache, Point d'Entrée & Monkey Patching
    // =========================================================================

    /**
     * Gère les navigations de pages avec repli sur le point d'entrée unique (`#entryPoint`).
     * @private
     * @param {Object} parsed - Requête analysée.
     * @param {string} strategy - Stratégie active.
     * @param {number} ttl - TTL en secondes.
     * @returns {Promise<Response|null>}
     */
    async #handleNavigationWithEntryPoint(parsed, strategy, ttl) {
        const entryUrl = this.#entryPoint;

        // Si hors-ligne ou stratégie cache-first/cache-only, servir immédiatement le point d'entrée depuis le cache
        if (NUtil.env.isOffline || strategy === 'cache-first' || strategy === 'cache-only') {
            const cachedEntry = await this.#readCachedOrFileResponse(entryUrl);
            if (cachedEntry) {
                this.#emit('offlineFallback', { url: parsed.url, entryPoint: entryUrl });
                return cachedEntry;
            }
        }

        // Essayer le réseau (pour l'URL demandée ou pour rafraîchir le point d'entrée)
        try {
            const netRes = await this.#performNetworkFetch(parsed.url, parsed);
            if (netRes && netRes.ok) {
                await NUtil.cache.putResponse(parsed.url, netRes.clone ? netRes.clone() : netRes.data, { ttl });
                return netRes;
            }
        } catch {
            // Ignorer l'erreur réseau et basculer sur le point d'entrée unique en cache
        }

        // Repli sur la page cachée de l'URL ou sur le point d'entrée unique (#entryPoint)
        const cachedExact = await this.#readCachedOrFileResponse(parsed.url);
        if (cachedExact) {
            return cachedExact;
        }

        const cachedEntryPoint = await this.#readCachedOrFileResponse(entryUrl);
        if (cachedEntryPoint) {
            this.#emit('offlineFallback', { url: parsed.url, entryPoint: entryUrl });
            return cachedEntryPoint;
        }

        return this.#createOfflineErrorResponse(parsed.url);
    }

    /**
     * Stratégie `cache-first` : cherche dans `NUtil.cache` / `NUtil.file`, sinon interroge le réseau et met en cache.
     * @private
     * @param {Object} parsed - Requête analysée.
     * @param {number} ttl - TTL en secondes.
     * @param {Array<string>} tags - Tags de cache.
     * @returns {Promise<Response>}
     */
    async #strategyCacheFirst(parsed, ttl, tags) {
        const cached = await this.#readCachedOrFileResponse(parsed.url);
        if (cached) {
            return cached;
        }
        return await this.#fetchAndCache(parsed, ttl, tags);
    }

    /**
     * Stratégie `network-first` : interroge le réseau et met à jour le cache ; en cas d'échec ou hors-ligne, sert le cache.
     * @private
     * @param {Object} parsed - Requête analysée.
     * @param {number} ttl - TTL en secondes.
     * @param {Array<string>} tags - Tags de cache.
     * @returns {Promise<Response>}
     */
    async #strategyNetworkFirst(parsed, ttl, tags) {
        if (!NUtil.env.isOffline) {
            try {
                const netRes = await this.#performNetworkFetch(parsed.url, parsed);
                if (netRes && netRes.ok) {
                    await NUtil.cache.putResponse(
                        parsed.url,
                        typeof netRes.clone === 'function' ? netRes.clone() : netRes,
                        { ttl, tags }
                    );
                    return netRes;
                }
            } catch {
                // Repli sur le cache ci-dessous
            }
        }

        const cached = await this.#readCachedOrFileResponse(parsed.url);
        if (cached) {
            this.#emit('offlineFallback', { url: parsed.url });
            return cached;
        }

        return this.#createOfflineErrorResponse(parsed.url);
    }

    /**
     * Stratégie `stale-while-revalidate` : sert immédiatement le cache s'il existe tout en rafraîchissant en arrière-plan.
     * @private
     * @param {Object} parsed - Requête analysée.
     * @param {number} ttl - TTL en secondes.
     * @param {Array<string>} tags - Tags de cache.
     * @returns {Promise<Response>}
     */
    async #strategyStaleWhileRevalidate(parsed, ttl, tags) {
        const cached = await this.#readCachedOrFileResponse(parsed.url);
        const networkPromise = this.#fetchAndCache(parsed, ttl, tags);

        if (cached) {
            return cached;
        }
        return await networkPromise;
    }

    /**
     * Stratégie `cache-only` : lit uniquement depuis `NUtil.cache` ou `NUtil.file`.
     * @private
     * @param {string} url - URL recherchée.
     * @returns {Promise<Response>}
     */
    async #strategyCacheOnly(url) {
        const cached = await this.#readCachedOrFileResponse(url);
        return cached || this.#createOfflineErrorResponse(url);
    }

    /**
     * Stratégie `network-only` : interroge uniquement le réseau sans lire ni écrire dans le cache.
     * @private
     * @param {Object} parsed - Requête analysée.
     * @returns {Promise<Response>}
     */
    async #strategyNetworkOnly(parsed) {
        try {
            const netRes = await this.#performNetworkFetch(parsed.url, parsed);
            return netRes || this.#createOfflineErrorResponse(parsed.url);
        } catch {
            return this.#createOfflineErrorResponse(parsed.url);
        }
    }

    /**
     * Exécute la requête réseau et enregistre la réponse dans `NUtil.cache`.
     * @private
     * @param {Object} parsed - Requête analysée.
     * @param {number} ttl - TTL en secondes.
     * @param {Array<string>} tags - Tags de cache.
     * @returns {Promise<Response>}
     */
    async #fetchAndCache(parsed, ttl, tags) {
        try {
            const netRes = await this.#performNetworkFetch(parsed.url, parsed);
            if (netRes && netRes.ok) {
                await NUtil.cache.putResponse(
                    parsed.url,
                    typeof netRes.clone === 'function' ? netRes.clone() : netRes,
                    { ttl, tags }
                );
                return netRes;
            }
        } catch {
            // Repli sur cache éventuel
        }

        const cached = await this.#readCachedOrFileResponse(parsed.url);
        return cached || this.#createOfflineErrorResponse(parsed.url);
    }

    /**
     * Cherche une réponse dans `NUtil.cache` (`matchUrl`) ou dans `NUtil.file` (si le chemin correspond à un fichier local).
     * @private
     * @param {string} url - URL ou chemin.
     * @returns {Promise<Response|null>}
     */
    async #readCachedOrFileResponse(url) {
        if (!url) {
            return null;
        }

        // 1. Recherche dans NUtil.cache
        const cachedRes = await NUtil.cache.matchUrl(url, { format: 'response' });
        if (cachedRes) {
            return cachedRes;
        }

        // 2. Recherche sans paramètres de query ou chemin relatif dans NUtil.file
        const cleanPath = url.split('?')[0].split('#')[0];
        if (await NUtil.file.exists(cleanPath)) {
            const fileRead = await NUtil.file.read(cleanPath, { format: 'bytes' });
            if (fileRead.ok && fileRead.data) {
                return this.#buildResponse(fileRead.data, 200, {
                    'content-type': fileRead.mimeType || NUtil.file.getMimeType(cleanPath)
                });
            }
        }

        return null;
    }

    /**
     * Exécute un appel réseau réel sans repasser par le Monkey Patch de `fetch`.
     * @private
     * @param {string} url - URL cible.
     * @param {Object} parsed - Détails de la requête.
     * @returns {Promise<Response|null>}
     */
    async #performNetworkFetch(url, parsed) {
        const fetchFn = this.#originalFetch || (typeof globalThis !== 'undefined' ? globalThis.fetch : null);
        if (typeof fetchFn === 'function') {
            return await fetchFn(parsed.rawInput || url, parsed.rawInit);
        }

        const netRes = await NUtil.net.get(url, {
            headers: parsed.headers,
            responseType: 'arraybuffer'
        });

        if (!netRes || !netRes.ok) {
            return null;
        }

        return this.#buildResponse(netRes.data, netRes.status || 200, netRes.headers || {});
    }

    /**
     * Intercepte un appel à `globalThis.fetch` lorsque le Monkey Patching est actif.
     * @private
     * @param {string|Request} input - Entrée passée à `fetch`.
     * @param {Object} init - Options passées à `fetch`.
     * @returns {Promise<Response>}
     */
    async #handlePatchedFetch(input, init = {}) {
        const parsed = this.#parseRequestInput(input, init);
        if (!this.#shouldIntercept(parsed.url, parsed)) {
            return await this.#originalFetch(input, init);
        }

        const handled = await this.handleRequest(input, init);
        if (handled) {
            return handled;
        }

        return await this.#originalFetch(input, init);
    }

    /**
     * Alimente une instance `XMLHttpRequest` interceptée avec le contenu d'une `Response` issue du cache ou de `NFile`.
     * @private
     * @param {XMLHttpRequest} xhr - Instance XHR.
     * @param {Response|Object} response - Réponse résolue.
     */
    async #fulfillXhrWithResponse(xhr, response) {
        let bytes;
        const status = response.status || 200;
        const headers = {};

        if (typeof Response !== 'undefined' && response instanceof Response) {
            response.headers?.forEach((v, k) => {
                headers[k.toLowerCase()] = v;
            });
            const buf = await response.clone().arrayBuffer();
            bytes = new Uint8Array(buf);
        } else {
            Object.assign(headers, response.headers || {});
            bytes = await NUtil.file.toUint8Array(response.data);
        }

        const mimeType = headers['content-type'] || 'application/octet-stream';
        const respType = xhr.responseType || '';
        let responseValue;

        if (respType === 'arraybuffer') {
            responseValue = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        } else if (respType === 'blob') {
            responseValue = await NUtil.file.toBlob(bytes, mimeType);
        } else if (respType === 'json') {
            const text = await NUtil.file.toText(bytes);
            try {
                responseValue = JSON.parse(text);
            } catch {
                responseValue = null;
            }
        } else {
            responseValue = await NUtil.file.toText(bytes);
        }

        const rawHeadersStr = Object.entries(headers)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n');

        try {
            Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
            Object.defineProperty(xhr, 'status', { value: status, configurable: true });
            Object.defineProperty(xhr, 'statusText', { value: status >= 200 && status < 300 ? 'OK' : 'Offline', configurable: true });
            Object.defineProperty(xhr, 'response', { value: responseValue, configurable: true });
            if (!respType || respType === 'text') {
                Object.defineProperty(xhr, 'responseText', { value: String(responseValue ?? ''), configurable: true });
            }
            xhr.getAllResponseHeaders = () => rawHeadersStr;
            xhr.getResponseHeader = (name) => headers[String(name || '').toLowerCase()] || null;
        } catch {
            // Ignore si certaines propriétés sont verrouillées
        }

        if (typeof xhr.onreadystatechange === 'function') {
            xhr.onreadystatechange(new Event('readystatechange'));
        }
        if (typeof xhr.onload === 'function') {
            xhr.onload(new ProgressEvent('load', { loaded: bytes.byteLength, total: bytes.byteLength, lengthComputable: true }));
        }
        if (typeof xhr.dispatchEvent === 'function') {
            xhr.dispatchEvent(new Event('readystatechange'));
            xhr.dispatchEvent(new Event('load'));
            xhr.dispatchEvent(new Event('loadend'));
        }
    }

    /**
     * Analyse une entrée `fetch` (`string`, `URL` ou `Request`) et ses options `init`.
     * @private
     * @param {any} input - Entrée.
     * @param {Object} init - Options.
     * @returns {{ url: string, method: string, headers: Object, mode: string, isNavigation: boolean, rawInput: any, rawInit: Object }}
     */
    #parseRequestInput(input, init = {}) {
        let url = '';
        let method = 'GET';
        let mode = init?.mode || '';
        const headers = {};

        if (typeof input === 'string') {
            url = input.trim();
        } else if (typeof URL !== 'undefined' && input instanceof URL) {
            url = input.href;
        } else if (input && typeof input === 'object') {
            url = String(input.url || '');
            if (input.method) method = String(input.method).toUpperCase();
            if (input.mode && !mode) mode = input.mode;
            if (input.headers && typeof input.headers.forEach === 'function') {
                input.headers.forEach((v, k) => {
                    headers[k.toLowerCase()] = v;
                });
            }
        }

        if (init?.method) {
            method = String(init.method).toUpperCase();
        }
        if (init?.headers) {
            if (typeof init.headers.forEach === 'function') {
                init.headers.forEach((v, k) => {
                    headers[k.toLowerCase()] = v;
                });
            } else if (typeof init.headers === 'object') {
                for (const [k, v] of Object.entries(init.headers)) {
                    headers[k.toLowerCase()] = String(v);
                }
            }
        }

        const accept = headers['accept'] || '';
        const cleanPath = url.split('?')[0].split('#')[0];
        const ext = NUtil.file.getExtension(cleanPath);
        const isNavigation =
            mode === 'navigate' ||
            accept.includes('text/html') ||
            (method === 'GET' && !ext && !cleanPath.includes('/api/'));

        return {
            url,
            method,
            headers,
            mode,
            isNavigation,
            rawInput: input,
            rawInit: init
        };
    }

    /**
     * Détermine si une requête doit être interceptée par `NServiceWorker`.
     * @private
     * @param {string} url - URL de la requête.
     * @param {Object} parsed - Métadonnées de la requête.
     * @returns {boolean}
     */
    #shouldIntercept(url, parsed) {
        if (!url || url.startsWith('data:') || url.startsWith('blob:')) {
            return false;
        }
        if (typeof this.#shouldInterceptFn === 'function') {
            try {
                return Boolean(this.#shouldInterceptFn(url, parsed));
            } catch {
                return false;
            }
        }
        if (this.#matchRoute(url, parsed)) {
            return true;
        }
        if (parsed.method !== 'GET') {
            return false;
        }
        return this.#interceptAllGet;
    }

    /**
     * Trouve la première règle de route correspondant à l'URL et à la méthode.
     * @private
     * @param {string} url - URL à tester.
     * @param {Object} parsed - Métadonnées de la requête.
     * @returns {NServiceWorkerRoute|null}
     */
    #matchRoute(url, parsed) {
        for (let i = 0; i < this.#routes.length; i++) {
            const route = this.#routes[i];
            if (Array.isArray(route.methods) && !route.methods.includes(parsed.method)) {
                continue;
            }
            const matcher = route.match;
            if (matcher instanceof RegExp && matcher.test(url)) {
                return route;
            }
            if (typeof matcher === 'function') {
                try {
                    if (matcher(url, parsed)) return route;
                } catch {
                    // Ignore
                }
            }
            if (typeof matcher === 'string') {
                if (matcher.startsWith('.') && url.split('?')[0].toLowerCase().endsWith(matcher.toLowerCase())) {
                    return route;
                }
                if (url.includes(matcher)) {
                    return route;
                }
            }
        }
        return null;
    }

    /**
     * Synchronise la configuration actuelle vers le Service Worker natif via `postMessage`.
     * @private
     */
    #syncConfigToNativeSw() {
        const sw = this.#registration?.active || this.#registration?.waiting || this.#registration?.installing;
        if (sw && typeof sw.postMessage === 'function') {
            try {
                sw.postMessage({
                    type: 'NLIB_SW_CONFIG',
                    config: {
                        entryPoint: this.#entryPoint,
                        defaultStrategy: this.#defaultStrategy,
                        defaultTtl: this.#defaultTtl,
                        interceptAllGet: this.#interceptAllGet,
                        precache: this.#precacheUrls
                    }
                });
            } catch {
                // Ignore
            }
        }
    }

    /**
     * Construit un objet `Response` (ou objet compatible) à partir d'octets, d'un statut et d'en-têtes.
     * @private
     * @param {Uint8Array} bytes - Octets.
     * @param {number} status - Code HTTP.
     * @param {Object} headers - En-têtes.
     * @returns {Response|Object}
     */
    #buildResponse(bytes, status = 200, headers = {}) {
        if (typeof Response !== 'undefined') {
            return new Response(bytes, { status, headers });
        }
        return {
            ok: status >= 200 && status < 300,
            status,
            headers,
            data: bytes
        };
    }

    /**
     * Construit une réponse d'erreur hors-ligne standardisée (503 Service Unavailable).
     * @private
     * @param {string} url - URL en échec.
     * @returns {Response|Object}
     */
    #createOfflineErrorResponse(url) {
        const payload = JSON.stringify({
            ok: false,
            offline: true,
            url,
            error: 'Ressource indisponible hors-ligne et absente du cache.'
        });
        const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(payload) : new Uint8Array(0);
        return this.#buildResponse(bytes, 503, {
            'content-type': 'application/json; charset=utf-8'
        });
    }

    /**
     * Émet un événement sur le bus interne uniquement si des écouteurs sont enregistrés.
     * @private
     * @param {string} eventName - Nom de l'événement.
     * @param {Object} payload - Données de l'événement.
     */
    #emit(eventName, payload) {
        if (this.#event && !this.#event.isEmpty) {
            this.#event.emit(eventName, payload);
        }
    }
}

export default NServiceWorker;
