/**
 * @file NCache.js
 * @package @nlib/js-backend
 * @description Gestionnaire universel de cache à sélection automatique de moteur unique pour l'écosystème NLib.
 *
 * Règles architecturales NLib :
 * - Fonctionne comme une classe utilitaire sans aucune méthode statique (`static`), accessible via `NUtil.cache`
 *   ou par instanciation directe (`new NCache(options)`).
 * - N'hérite pas de `NObject`.
 * - **Un seul driver actif à la fois (aucune duplication d'écriture sur plusieurs moteurs)** :
 *   `NCache` détecte et sélectionne automatiquement **un unique moteur** parmi ceux disponibles dans l'environnement,
 *   du plus performant au repli universel afin que le cache fonctionne toujours :
 *   1. **`'native'`** : Pont natif OS (`NUtil.sys.invokeNative`) si exécuté dans un conteneur WebView natif (`NUtil.env.isWebView`).
 *   2. **`'caches'`** : API standard `CacheStorage` (`globalThis.caches`) si disponible (stocke données, JSON, binaires et réponses HTTP sous forme d'objets `Response` avec métadonnées d'expiration dans les en-têtes).
 *   3. **`'idb'`** : `NIndexedDB` (`NUtil.db.idb`, magasin `ntable`) si `IndexedDB` est disponible.
 *   4. **`'store'`** : `NStorage` (`NUtil.db.store`, `localStorage` / `sessionStorage`) si disponible.
 *   5. **`'memory'`** : `Map` en mémoire vive (RAM avec LRU) en dernier recours universel si aucun moteur persistant n'existe.
 * - Contrat strict **Zero Throw / Zero Reject** : aucune exception non capturée, journalisation via `NUtil.log`.
 */

import { NUtil } from '../utils/NUtil.js';

/**
 * Structure interne d'une entrée de cache NCache.
 * @typedef {Object} NCacheRecord
 * @property {string} key - Clé normalisée de l'entrée.
 * @property {string} scopedKey - Clé préfixée par l'espace de nommage (`namespace:key`).
 * @property {string} namespace - Espace de nommage logique.
 * @property {any} value - Valeur mise en cache.
 * @property {'json'|'string'|'number'|'boolean'|'bytes'|'response'} dataType - Type de la donnée stockée.
 * @property {string} mimeType - Type MIME associé.
 * @property {number} status - Code de statut HTTP (200 par défaut).
 * @property {Object<string, string>} headers - En-têtes HTTP éventuels.
 * @property {number} createdAt - Horodatage de création (ms).
 * @property {number} updatedAt - Horodatage de mise à jour (ms).
 * @property {number} expiresAt - Horodatage d'expiration (ms, `0` = sans expiration).
 * @property {Array<string>} tags - Étiquettes d'invalidation associées.
 */

/**
 * @class NCache
 * @description Service utilitaire de cache universel sélectionnant automatiquement un seul moteur optimal
 * (`'native'` -> `'caches'` -> `'idb'` -> `'store'` -> `'memory'`) sans jamais dupliquer les écritures
 * sur plusieurs drivers simultanément.
 *
 * @example <caption>Exemple 1 : Mettre en cache et lire une donnée (utilise uniquement le driver actif)</caption>
 * console.log(NUtil.cache.driver); // ex: 'caches' ou 'idb'
 * await NUtil.cache.set('user:42', { id: 42, name: 'Alice' }, { ttl: 300, tags: ['users'] });
 * const user = await NUtil.cache.get('user:42');
 * console.log(user.name); // 'Alice'
 *
 * @example <caption>Exemple 2 : Pattern Read-Through avec remember()</caption>
 * const stats = await NUtil.cache.remember('dashboard:stats', 60, async () => {
 *     return { ventes: 150, total: 450000 };
 * });
 * console.log(stats.total); // 450000
 *
 * @example <caption>Exemple 3 : Mise en cache d'URLs et de réponses HTTP (cacheUrl, matchUrl, putResponse)</caption>
 * await NUtil.cache.putResponse('https://api.example.com/config', { version: '1.0.0' }, { ttl: 600 });
 * const cached = await NUtil.cache.matchUrl('https://api.example.com/config', { format: 'json' });
 * console.log(cached.version); // '1.0.0'
 */
export class NCache {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Map de repli utilisée uniquement lorsque le driver actif est `'memory'`.
     * @type {Map<string, NCacheRecord>}
     * @private
     */
    #memory = new Map();

    /**
     * Nombre maximal d'entrées autorisées lorsque le driver actif est `'memory'` (éviction LRU).
     * @type {number}
     * @private
     */
    #maxMemoryEntries = 500;

    /**
     * Durée de vie par défaut en secondes (`0` = pas d'expiration).
     * @type {number}
     * @private
     */
    #defaultTtl = 0;

    /**
     * Espace de nommage par défaut pour isoler les clés.
     * @type {string}
     * @private
     */
    #defaultNamespace = 'default';

    /**
     * Nom du coffre Cache Storage API navigateur (`globalThis.caches.open(...)`).
     * @type {string}
     * @private
     */
    #cacheStorageName = 'nlib-cache-v1';

    /**
     * Préfixe d'URL synthétique utilisé pour stocker les clés génériques dans l'API `CacheStorage`.
     * @type {string}
     * @private
     */
    #cacheApiBaseUrl = 'https://nlib.cache.local/entry/';

    /**
     * Préfixe de clé utilisé dans `NIndexedDB` (`ntable`) ou `NStorage`.
     * @type {string}
     * @private
     */
    #storagePrefix = '__ncache__:';

    /**
     * Compteur de succès de lecture en cache (cache hits).
     * @type {number}
     * @private
     */
    #hits = 0;

    /**
     * Compteur d'échecs de lecture en cache (cache misses).
     * @type {number}
     * @private
     */
    #misses = 0;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NCache`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration.
     * @param {number} [options.maxMemoryEntries=500] - Capacité maximale du driver `'memory'` (LRU).
     * @param {number} [options.defaultTtl=0] - Durée de validité par défaut en secondes (`0` = infini).
     * @param {string} [options.namespace='default'] - Espace de nommage par défaut.
     * @param {string} [options.cacheStorageName='nlib-cache-v1'] - Nom du Cache Storage navigateur.
     *
     * @example <caption>Exemple 1 : Instanciation standard</caption>
     * const cache = new NCache();
     *
     * @example <caption>Exemple 2 : Instanciation avec namespace et TTL par défaut</caption>
     * const apiCache = new NCache({ namespace: 'api', defaultTtl: 120 });
     */
    constructor(options = {}) {
        if (options && typeof options === 'object') {
            if (typeof options.maxMemoryEntries === 'number' && options.maxMemoryEntries > 0) {
                this.#maxMemoryEntries = Math.trunc(options.maxMemoryEntries);
            }
            if (typeof options.defaultTtl === 'number' && options.defaultTtl >= 0) {
                this.#defaultTtl = options.defaultTtl;
            }
            if (typeof options.namespace === 'string' && options.namespace.trim()) {
                this.#defaultNamespace = options.namespace.trim();
            }
            if (typeof options.cacheStorageName === 'string' && options.cacheStorageName.trim()) {
                this.#cacheStorageName = options.cacheStorageName.trim();
            }
        }
    }

    // =========================================================================
    // Accesseurs d'instance — Détection du moteur unique & Statistiques
    // =========================================================================

    /**
     * Retourne l'unique moteur de cache actif sélectionné automatiquement selon l'environnement
     * (du plus rapide au repli universel) :
     * 1. `'native'` : Application native / WebView (`NUtil.env.isWebView`).
     * 2. `'caches'` : Cache Storage API (`globalThis.caches`).
     * 3. `'idb'` : IndexedDB (`NUtil.db.idb`).
     * 4. `'store'` : Web Storage (`NUtil.db.store`).
     * 5. `'memory'` : Mémoire vive (RAM) si aucun stockage persistant n'est disponible.
     *
     * @returns {'native'|'caches'|'idb'|'store'|'memory'} Identifiant de l'unique moteur actif.
     *
     * @example <caption>Exemple 1 : Lire le driver de cache actif</caption>
     * console.log(NUtil.cache.driver); // 'native' | 'caches' | 'idb' | 'store' | 'memory'
     *
     * @example <caption>Exemple 2 : Vérifier via une instance</caption>
     * const c = new NCache();
     * console.log(['native', 'caches', 'idb', 'store', 'memory'].includes(c.driver)); // true
     */
    get driver() {
        if (this.isNativeAvailable) {
            return 'native';
        }
        if (this.isCacheStorageAvailable) {
            return 'caches';
        }
        if (this.isIdbAvailable) {
            return 'idb';
        }
        if (this.isStoreAvailable) {
            return 'store';
        }
        return 'memory';
    }

    /**
     * Indique si le pont de cache natif (WebView / conteneur OS) est disponible.
     *
     * @returns {boolean} `true` si exécuté dans une application native NLib.
     *
     * @example <caption>Exemple 1 : Tester la disponibilité du mode natif</caption>
     * console.log(NUtil.cache.isNativeAvailable);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NUtil.cache.isNativeAvailable); // 'boolean'
     */
    get isNativeAvailable() {
        return Boolean(NUtil?.env?.isWebView);
    }

    /**
     * Indique si l'API standard `CacheStorage` (`globalThis.caches`) est disponible dans l'environnement.
     *
     * @returns {boolean} `true` si `globalThis.caches` et `Response` sont utilisables.
     *
     * @example <caption>Exemple 1 : Vérifier le support de CacheStorage</caption>
     * console.log(NUtil.cache.isCacheStorageAvailable);
     *
     * @example <caption>Exemple 2 : Retourne toujours un booléen</caption>
     * console.log(typeof NUtil.cache.isCacheStorageAvailable); // 'boolean'
     */
    get isCacheStorageAvailable() {
        return (
            typeof globalThis !== 'undefined' &&
            globalThis.caches !== null &&
            typeof globalThis.caches === 'object' &&
            typeof globalThis.caches.open === 'function' &&
            typeof Response !== 'undefined'
        );
    }

    /**
     * Indique si `IndexedDB` (`NUtil.db.idb`) est disponible dans l'environnement.
     *
     * @returns {boolean} `true` si `IndexedDB` est disponible.
     *
     * @example <caption>Exemple 1 : Vérifier la disponibilité d'IndexedDB pour le cache</caption>
     * console.log(NUtil.cache.isIdbAvailable);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NUtil.cache.isIdbAvailable); // 'boolean'
     */
    get isIdbAvailable() {
        return Boolean(NUtil?.db?.idb?.isAvailable);
    }

    /**
     * Indique si `NStorage` (`localStorage` / `sessionStorage`) est disponible dans l'environnement.
     *
     * @returns {boolean} `true` si `NUtil.db.store` est disponible.
     *
     * @example <caption>Exemple 1 : Vérifier la disponibilité de NStorage</caption>
     * console.log(NUtil.cache.isStoreAvailable);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NUtil.cache.isStoreAvailable); // 'boolean'
     */
    get isStoreAvailable() {
        return Boolean(NUtil?.db?.store?.isAvailable);
    }

    /**
     * Retourne les statistiques d'utilisation du cache (`driver`, `hits`, `misses`, `hitRate`).
     *
     * @returns {{
     *   driver: string,
     *   hits: number,
     *   misses: number,
     *   totalRequests: number,
     *   hitRate: number
     * }} Statistiques du cache.
     *
     * @example <caption>Exemple 1 : Consulter le driver actif et le taux de succès</caption>
     * console.log(NUtil.cache.stats.driver, NUtil.cache.stats.hitRate);
     *
     * @example <caption>Exemple 2 : Inspecter le nombre total de lectures</caption>
     * console.log(NUtil.cache.stats.totalRequests >= 0); // true
     */
    get stats() {
        const total = this.#hits + this.#misses;
        return {
            driver: this.driver,
            hits: this.#hits,
            misses: this.#misses,
            totalRequests: total,
            hitRate: total > 0 ? NUtil.num.percentage(this.#hits, total, 2) : 0
        };
    }

    // =========================================================================
    // Méthodes publiques — Opérations Clé-Valeur (sur 1 seul driver)
    // =========================================================================

    /**
     * Enregistre une valeur dans **un seul moteur de cache** (le driver actif ou celui spécifié via `options.driver`).
     * N'écrit jamais dans plusieurs moteurs en même temps.
     *
     * @param {string} key - Clé unique de l'élément.
     * @param {any} value - Valeur à mettre en cache (primitive, objet, tableau, `Uint8Array`, `Blob`).
     * @param {Object|number} [options={}] - Options ou durée de vie directe en secondes (`ttl`).
     * @param {number} [options.ttl] - Durée de validité en secondes (`0` = sans expiration).
     * @param {string} [options.namespace] - Espace de nommage logique.
     * @param {Array<string>} [options.tags=[]] - Tags d'invalidation groupée.
     * @param {string} [options.mimeType] - Type MIME optionnel.
     * @param {'auto'|'native'|'caches'|'idb'|'store'|'memory'} [options.driver='auto'] - Moteur unique à utiliser.
     * @returns {Promise<boolean>} `true` si la mise en cache a réussi.
     *
     * @example <caption>Exemple 1 : Mettre en cache un objet pendant 5 minutes (300 s)</caption>
     * const ok = await NUtil.cache.set('profil:1', { nom: 'Neta' }, { ttl: 300, tags: ['profils'] });
     * console.log(ok); // true
     *
     * @example <caption>Exemple 2 : Passer directement le TTL en second paramètre</caption>
     * await NUtil.cache.set('jeton_temp', 'abc123', 60);
     * console.log(await NUtil.cache.get('jeton_temp')); // 'abc123'
     */
    async set(key, value, options = {}) {
        const cleanKey = this.#normalizeKey(key);
        if (!cleanKey || value === undefined) {
            return false;
        }

        const opts = typeof options === 'number' ? { ttl: options } : (options || {});
        const namespace = this.#resolveNamespace(opts.namespace);
        const scopedKey = this.#buildScopedKey(namespace, cleanKey);
        const ttlSeconds = typeof opts.ttl === 'number' ? opts.ttl : this.#defaultTtl;
        const now = Date.now();
        const expiresAt = ttlSeconds > 0 ? now + Math.round(ttlSeconds * 1000) : 0;
        const tags = Array.isArray(opts.tags) ? opts.tags.map((t) => String(t).trim()).filter(Boolean) : [];
        const activeDriver = this.#resolveDriver(opts.driver);

        try {
            const dataType = this.#detectValueType(value);
            const normalizedValue = dataType === 'bytes'
                ? await NUtil.file.toUint8Array(value)
                : value;

            const record = {
                key: cleanKey,
                scopedKey,
                namespace,
                value: normalizedValue,
                dataType,
                mimeType: opts.mimeType || (dataType === 'json' ? 'application/json' : 'application/octet-stream'),
                status: Number(opts.status) || 200,
                headers: opts.headers || {},
                createdAt: now,
                updatedAt: now,
                expiresAt,
                tags
            };

            return await this.#writeToDriver(activeDriver, record);
        } catch (err) {
            NUtil.log.error(`NCache.set : Erreur lors de l'écriture de "${cleanKey}".`, {
                code: 'ERR_CACHE_SET',
                key: cleanKey,
                driver: activeDriver,
                error: err?.message
            });
            return false;
        }
    }

    /**
     * Récupère une valeur depuis l'unique moteur de cache actif (ou celui spécifié dans `options.driver`).
     * Si l'entrée est expirée, elle est automatiquement supprimée et `fallback` est retourné.
     *
     * @param {string} key - Clé de l'élément recherché.
     * @param {Object} [options={}] - Options de lecture.
     * @param {any} [options.fallback=null] - Valeur par défaut retournée si absente ou expirée.
     * @param {string} [options.namespace] - Espace de nommage logique.
     * @param {'auto'|'native'|'caches'|'idb'|'store'|'memory'} [options.driver='auto'] - Moteur à interroger.
     * @returns {Promise<any>} Valeur mise en cache ou `fallback` (`null` par défaut).
     *
     * @example <caption>Exemple 1 : Lire une valeur mise en cache</caption>
     * await NUtil.cache.set('devise', 'XOF');
     * console.log(await NUtil.cache.get('devise')); // 'XOF'
     *
     * @example <caption>Exemple 2 : Valeur par défaut si la clé est absente ou expirée</caption>
     * console.log(await NUtil.cache.get('cle_inconnue', { fallback: 'defaut' })); // 'defaut'
     */
    async get(key, options = {}) {
        const cleanKey = this.#normalizeKey(key);
        const fallback = options?.fallback !== undefined ? options.fallback : null;
        if (!cleanKey) {
            this.#misses++;
            return fallback;
        }

        const namespace = this.#resolveNamespace(options?.namespace);
        const scopedKey = this.#buildScopedKey(namespace, cleanKey);
        const activeDriver = this.#resolveDriver(options?.driver);

        try {
            const record = await this.#readFromDriver(activeDriver, scopedKey);
            if (!record) {
                this.#misses++;
                return fallback;
            }

            this.#hits++;
            return record.value;
        } catch (err) {
            NUtil.log.error(`NCache.get : Erreur lors de la lecture de "${cleanKey}".`, {
                code: 'ERR_CACHE_GET',
                key: cleanKey,
                driver: activeDriver,
                error: err?.message
            });
            this.#misses++;
            return fallback;
        }
    }

    /**
     * Vérifie si une clé existe dans le moteur de cache actif et n'est pas expirée.
     *
     * @param {string} key - Clé à vérifier.
     * @param {Object} [options={}] - Options (`{ namespace, driver }`).
     * @returns {Promise<boolean>} `true` si l'entrée existe et est valide.
     *
     * @example <caption>Exemple 1 : Vérifier la présence d'une clé</caption>
     * await NUtil.cache.set('session:active', true, 120);
     * console.log(await NUtil.cache.has('session:active')); // true
     *
     * @example <caption>Exemple 2 : Clé absente</caption>
     * console.log(await NUtil.cache.has('session:inconnue')); // false
     */
    async has(key, options = {}) {
        const sentinel = Symbol('ncache_miss');
        const val = await this.get(key, { ...options, fallback: sentinel });
        return val !== sentinel;
    }

    /**
     * Récupère une valeur du cache si elle existe, ou exécute `factoryFn()` pour la calculer,
     * l'enregistre dans le moteur de cache actif et la retourne (*Read-Through*).
     *
     * @param {string} key - Clé de cache.
     * @param {number|Object|Function} ttlOrOptions - TTL en secondes, objet d'options ou `factoryFn`.
     * @param {Function} [factoryFn] - Fonction synchrone ou asynchrone produisant la valeur.
     * @returns {Promise<any>} Valeur issue du cache ou calculée par `factoryFn`.
     *
     * @example <caption>Exemple 1 : Calculer et mettre en cache pour 60 secondes</caption>
     * const tarifs = await NUtil.cache.remember('tarifs:2026', 60, async () => {
     *     return [{ zone: 'A', prix: 1000 }];
     * });
     * console.log(tarifs[0].prix); // 1000
     *
     * @example <caption>Exemple 2 : Avec options complètes (tags et namespace)</caption>
     * const data = await NUtil.cache.remember('menu', { ttl: 300, tags: ['ui'] }, () => ['Accueil', 'Profil']);
     * console.log(data.length); // 2
     */
    async remember(key, ttlOrOptions, factoryFn) {
        const fn = typeof ttlOrOptions === 'function' ? ttlOrOptions : factoryFn;
        const opts = typeof ttlOrOptions === 'function'
            ? {}
            : (typeof ttlOrOptions === 'number' ? { ttl: ttlOrOptions } : (ttlOrOptions || {}));

        const sentinel = Symbol('ncache_remember_miss');
        const existing = await this.get(key, { ...opts, fallback: sentinel });
        if (existing !== sentinel) {
            return existing;
        }

        if (typeof fn !== 'function') {
            return null;
        }

        try {
            const computed = await fn();
            if (computed !== undefined) {
                await this.set(key, computed, opts);
            }
            return computed;
        } catch (err) {
            NUtil.log.error(`NCache.remember : Erreur dans la fonction factory pour "${key}".`, {
                code: 'ERR_CACHE_REMEMBER_FACTORY',
                key,
                error: err?.message
            });
            return null;
        }
    }

    /**
     * Alias de `remember(key, ttlOrOptions, factoryFn)`.
     *
     * @param {string} key - Clé de cache.
     * @param {number|Object|Function} ttlOrOptions - TTL en secondes ou options.
     * @param {Function} [factoryFn] - Fonction produisant la valeur.
     * @returns {Promise<any>} Valeur mise en cache.
     *
     * @example <caption>Exemple 1 : Obtenir ou calculer une entrée</caption>
     * const res = await NUtil.cache.getOrSet('config:lang', 300, () => 'fr');
     * console.log(res); // 'fr'
     *
     * @example <caption>Exemple 2 : Deuxième appel servi depuis le cache</caption>
     * const res2 = await NUtil.cache.getOrSet('config:lang', 300, () => 'en');
     * console.log(res2); // 'fr'
     */
    async getOrSet(key, ttlOrOptions, factoryFn) {
        return await this.remember(key, ttlOrOptions, factoryFn);
    }

    /**
     * Supprime une entrée du moteur de cache actif.
     *
     * @param {string} key - Clé à supprimer.
     * @param {Object} [options={}] - Options (`{ namespace, driver }`).
     * @returns {Promise<boolean>} `true` si la suppression a réussi.
     *
     * @example <caption>Exemple 1 : Supprimer une clé du cache</caption>
     * await NUtil.cache.set('temp_key', 123);
     * await NUtil.cache.delete('temp_key');
     * console.log(await NUtil.cache.has('temp_key')); // false
     *
     * @example <caption>Exemple 2 : Supprimer une clé dans un namespace spécifique</caption>
     * await NUtil.cache.delete('token', { namespace: 'auth' });
     */
    async delete(key, options = {}) {
        const cleanKey = this.#normalizeKey(key);
        if (!cleanKey) {
            return false;
        }

        const namespace = this.#resolveNamespace(options?.namespace);
        const scopedKey = this.#buildScopedKey(namespace, cleanKey);
        const activeDriver = this.#resolveDriver(options?.driver);

        return await this.#deleteFromDriver(activeDriver, scopedKey);
    }

    /**
     * Alias de `delete(key, options)`.
     *
     * @param {string} key - Clé à supprimer.
     * @param {Object} [options={}] - Options (`{ namespace, driver }`).
     * @returns {Promise<boolean>} `true` si supprimée.
     *
     * @example <caption>Exemple 1 : Retirer une entrée avec remove()</caption>
     * await NUtil.cache.set('k1', 'v1');
     * await NUtil.cache.remove('k1');
     *
     * @example <caption>Exemple 2 : Vérifier l'absence après remove()</caption>
     * console.log(await NUtil.cache.has('k1')); // false
     */
    async remove(key, options = {}) {
        return await this.delete(key, options);
    }

    /**
     * Invalide et supprime toutes les entrées associées à un tag donné dans le moteur actif.
     *
     * @param {string} tag - Nom du tag à invalider (ex: `'users'`, `'catalog'`).
     * @param {Object} [options={}] - Options (`{ driver }`).
     * @returns {Promise<number>} Nombre d'entrées supprimées.
     *
     * @example <caption>Exemple 1 : Invalider toutes les entrées liées au tag 'produits'</caption>
     * await NUtil.cache.set('prod:1', { nom: 'Pain' }, { tags: ['produits'] });
     * await NUtil.cache.set('prod:2', { nom: 'Lait' }, { tags: ['produits'] });
     * const count = await NUtil.cache.clearByTag('produits');
     * console.log(count); // 2
     *
     * @example <caption>Exemple 2 : Tag inconnu retourne 0</caption>
     * console.log(await NUtil.cache.clearByTag('aucun')); // 0
     */
    async clearByTag(tag, options = {}) {
        if (typeof tag !== 'string' || !tag.trim()) {
            return 0;
        }
        const targetTag = tag.trim();
        const activeDriver = this.#resolveDriver(options?.driver);

        if (activeDriver === 'native') {
            const res = await this.#invokeNativeCache('clearByTag', { tag: targetTag });
            return Number(res?.count ?? res?.data?.count) || 0;
        }

        const records = await this.#getAllDriverRecords(activeDriver);
        let removedCount = 0;

        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            if (rec && Array.isArray(rec.tags) && rec.tags.includes(targetTag) && rec.scopedKey) {
                await this.#deleteFromDriver(activeDriver, rec.scopedKey);
                removedCount++;
            }
        }

        return removedCount;
    }

    /**
     * Purge toutes les entrées expirées du moteur de cache actif.
     *
     * @param {Object} [options={}] - Options (`{ driver }`).
     * @returns {Promise<number>} Nombre d'entrées expirées purgées.
     *
     * @example <caption>Exemple 1 : Nettoyer les entrées expirées</caption>
     * const purgedCount = await NUtil.cache.prune();
     * console.log(purgedCount >= 0); // true
     *
     * @example <caption>Exemple 2 : Appeler périodiquement pour libérer l'espace</caption>
     * await NUtil.cache.prune();
     */
    async prune(options = {}) {
        const activeDriver = this.#resolveDriver(options?.driver);

        if (activeDriver === 'native') {
            const res = await this.#invokeNativeCache('prune', {});
            return Number(res?.count ?? res?.data?.count) || 0;
        }

        const records = await this.#getAllDriverRecords(activeDriver);
        let purged = 0;

        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            if (rec && this.#isExpired(rec) && rec.scopedKey) {
                await this.#deleteFromDriver(activeDriver, rec.scopedKey);
                purged++;
            }
        }

        return purged;
    }

    /**
     * Retourne la liste des clés actives (non expirées) présentes dans le moteur de cache actif.
     *
     * @param {Object} [options={}] - Options (`{ namespace, driver }`).
     * @returns {Promise<Array<string>>} Liste des clés actives.
     *
     * @example <caption>Exemple 1 : Lister les clés actives</caption>
     * await NUtil.cache.set('k_a', 1);
     * const keys = await NUtil.cache.keys();
     * console.log(keys.includes('k_a')); // true
     *
     * @example <caption>Exemple 2 : Lister les clés d'un namespace spécifique</caption>
     * await NUtil.cache.set('item1', true, { namespace: 'panier' });
     * console.log(await NUtil.cache.keys({ namespace: 'panier' })); // ['item1']
     */
    async keys(options = {}) {
        const activeDriver = this.#resolveDriver(options?.driver);
        const namespace = options?.namespace ? this.#resolveNamespace(options.namespace) : null;

        if (activeDriver === 'native') {
            const res = await this.#invokeNativeCache('keys', { namespace });
            return Array.isArray(res?.data) ? res.data : (Array.isArray(res?.keys) ? res.keys : []);
        }

        const records = await this.#getAllDriverRecords(activeDriver);
        const out = [];

        for (let i = 0; i < records.length; i++) {
            const rec = records[i];
            if (!rec) continue;
            if (this.#isExpired(rec)) {
                await this.#deleteFromDriver(activeDriver, rec.scopedKey);
                continue;
            }
            if (!namespace || rec.namespace === namespace) {
                out.push(rec.key);
            }
        }

        return out;
    }

    /**
     * Vide le moteur de cache actif (intégralement ou uniquement pour un `namespace` donné).
     *
     * @param {Object} [options={}] - Options (`{ namespace, driver }`).
     * @returns {Promise<boolean>} `true` une fois le nettoyage terminé.
     *
     * @example <caption>Exemple 1 : Vider uniquement un espace de nommage</caption>
     * await NUtil.cache.clear({ namespace: 'panier' });
     *
     * @example <caption>Exemple 2 : Vider tout le moteur de cache actif</caption>
     * await NUtil.cache.clear();
     */
    async clear(options = {}) {
        const activeDriver = this.#resolveDriver(options?.driver);
        const targetNamespace = options?.namespace ? this.#resolveNamespace(options.namespace) : null;

        try {
            if (activeDriver === 'native') {
                const res = await this.#invokeNativeCache('clear', { namespace: targetNamespace });
                return Boolean(res && res.ok !== false && res.success !== false);
            }

            if (!targetNamespace && activeDriver === 'caches') {
                await globalThis.caches.delete(this.#cacheStorageName);
                return true;
            }

            if (!targetNamespace && activeDriver === 'memory') {
                this.#memory.clear();
                return true;
            }

            const records = await this.#getAllDriverRecords(activeDriver);
            for (let i = 0; i < records.length; i++) {
                const rec = records[i];
                if (rec && (!targetNamespace || rec.namespace === targetNamespace) && rec.scopedKey) {
                    await this.#deleteFromDriver(activeDriver, rec.scopedKey);
                }
            }
            return true;
        } catch (err) {
            NUtil.log.error('NCache.clear : Erreur lors du vidage du cache.', {
                code: 'ERR_CACHE_CLEAR',
                driver: activeDriver,
                error: err?.message
            });
            return false;
        }
    }

    // =========================================================================
    // Méthodes publiques — Cache de Requêtes, URLs, Réponses HTTP & Fichiers
    // =========================================================================

    /**
     * Enregistre une réponse HTTP (`Response`) ou une donnée associée à une URL dans l'unique driver actif.
     *
     * @param {string} url - URL de la ressource ou requête.
     * @param {Response|Uint8Array|ArrayBuffer|Blob|string|Object} responseOrData - Objet `Response` ou contenu à mettre en cache.
     * @param {Object} [options={}] - Options (`{ ttl: 0, mimeType, status: 200, headers: {}, tags: [], driver: 'auto' }`).
     * @returns {Promise<boolean>} `true` si la réponse a été mise en cache.
     *
     * @example <caption>Exemple 1 : Mettre en cache une réponse JSON pour une URL d'API</caption>
     * await NUtil.cache.putResponse('https://api.nlib.dev/v1/items', [{ id: 1 }], { ttl: 300 });
     *
     * @example <caption>Exemple 2 : Mettre en cache un contenu SVG pour une URL</caption>
     * await NUtil.cache.putResponse('/assets/logo.svg', '<svg></svg>', { mimeType: 'image/svg+xml' });
     */
    async putResponse(url, responseOrData, options = {}) {
        if (typeof url !== 'string' || !url.trim() || responseOrData === null || responseOrData === undefined) {
            return false;
        }

        const normUrl = url.trim();
        let bytes;
        let status = Number(options?.status) || 200;
        let mimeType = options?.mimeType || NUtil.file.getMimeType(normUrl, 'application/octet-stream');
        const headersObj = { ...(options?.headers || {}) };

        if (typeof Response !== 'undefined' && responseOrData instanceof Response) {
            const clone = responseOrData.clone();
            status = clone.status || 200;
            if (clone.headers && typeof clone.headers.forEach === 'function') {
                clone.headers.forEach((v, k) => {
                    headersObj[k.toLowerCase()] = v;
                });
            }
            if (headersObj['content-type']) {
                mimeType = headersObj['content-type'];
            }
            const buf = await clone.arrayBuffer();
            bytes = new Uint8Array(buf);
        } else if (
            typeof responseOrData === 'object' &&
            !(responseOrData instanceof Uint8Array) &&
            !(responseOrData instanceof ArrayBuffer) &&
            !(typeof Blob !== 'undefined' && responseOrData instanceof Blob)
        ) {
            mimeType = options?.mimeType || 'application/json; charset=utf-8';
            headersObj['content-type'] = mimeType;
            bytes = await NUtil.file.toUint8Array(JSON.stringify(responseOrData));
        } else {
            if (typeof responseOrData === 'string' && !options?.mimeType && !normUrl.includes('.')) {
                mimeType = 'text/plain; charset=utf-8';
            }
            headersObj['content-type'] = headersObj['content-type'] || mimeType;
            bytes = await NUtil.file.toUint8Array(responseOrData);
        }

        return await this.set(normUrl, bytes, {
            ...options,
            namespace: '__url__',
            mimeType,
            status,
            headers: headersObj
        });
    }

    /**
     * Recherche et restitue une réponse ou ressource associée à une URL depuis l'unique driver actif.
     *
     * @param {string} url - URL recherchée.
     * @param {Object} [options={}] - Options de lecture.
     * @param {'auto'|'json'|'text'|'bytes'|'blob'|'dataUrl'|'response'} [options.format='auto'] - Format de sortie souhaité.
     * @param {'auto'|'native'|'caches'|'idb'|'store'|'memory'} [options.driver='auto'] - Moteur à interroger.
     * @returns {Promise<any|null>} Données dans le format demandé (ou `null` si absente ou expirée).
     *
     * @example <caption>Exemple 1 : Lire une réponse JSON mise en cache</caption>
     * await NUtil.cache.putResponse('https://api.nlib.dev/status', { online: true });
     * const status = await NUtil.cache.matchUrl('https://api.nlib.dev/status', { format: 'json' });
     * console.log(status.online); // true
     *
     * @example <caption>Exemple 2 : Obtenir une instance Response HTTP standard</caption>
     * const res = await NUtil.cache.matchUrl('https://api.nlib.dev/status', { format: 'response' });
     * console.log(res?.status); // 200
     */
    async matchUrl(url, options = {}) {
        if (typeof url !== 'string' || !url.trim()) {
            this.#misses++;
            return null;
        }

        const normUrl = url.trim();
        const scopedKey = this.#buildScopedKey('__url__', normUrl);
        const activeDriver = this.#resolveDriver(options?.driver);
        const format = options?.format || 'auto';

        try {
            const record = await this.#readFromDriver(activeDriver, scopedKey);
            if (!record) {
                this.#misses++;
                return null;
            }

            this.#hits++;
            return await this.#formatUrlRecordOutput(record, format);
        } catch (err) {
            NUtil.log.error(`NCache.matchUrl : Erreur lors de la lecture de l'URL "${normUrl}".`, {
                code: 'ERR_CACHE_MATCH_URL',
                url: normUrl,
                driver: activeDriver,
                error: err?.message
            });
            this.#misses++;
            return null;
        }
    }

    /**
     * Récupère une ressource distante par son URL (ou depuis le cache si déjà présente et valide),
     * l'enregistre dans l'unique driver actif et retourne son contenu.
     *
     * @param {string} url - URL à télécharger et mettre en cache.
     * @param {Object} [options={}] - Options (`{ ttl: 0, forceRefresh: false, format: 'auto', headers: {}, tags: [], driver: 'auto' }`).
     * @returns {Promise<any|null>} Contenu de l'URL ou `null` en cas d'échec réseau et d'absence en cache.
     *
     * @example <caption>Exemple 1 : Mettre en cache une ressource distante avec TTL de 10 minutes</caption>
     * const data = await NUtil.cache.cacheUrl('https://api.example.com/v1/catalog', {
     *     ttl: 600,
     *     format: 'json'
     * });
     *
     * @example <caption>Exemple 2 : Forcer le rafraîchissement depuis le réseau</caption>
     * const fresh = await NUtil.cache.cacheUrl('https://api.example.com/v1/catalog', {
     *     forceRefresh: true,
     *     format: 'json'
     * });
     */
    async cacheUrl(url, options = {}) {
        if (typeof url !== 'string' || !url.trim()) {
            return null;
        }

        const normUrl = url.trim();
        const format = options?.format || 'auto';

        if (!options?.forceRefresh) {
            const cached = await this.matchUrl(normUrl, { format, driver: options?.driver });
            if (cached !== null) {
                return cached;
            }
        }

        try {
            const netRes = await NUtil.net.get(normUrl, {
                headers: options?.headers,
                responseType: 'arraybuffer',
                timeout: options?.timeout
            });

            if (!netRes || !netRes.ok) {
                return await this.matchUrl(normUrl, { format, driver: options?.driver });
            }

            const mimeType = netRes.headers?.['content-type'] || NUtil.file.getMimeType(normUrl);
            await this.putResponse(normUrl, netRes.data, {
                ttl: options?.ttl,
                mimeType,
                status: netRes.status || 200,
                headers: netRes.headers || {},
                tags: options?.tags,
                driver: options?.driver
            });

            return await this.matchUrl(normUrl, { format, driver: options?.driver });
        } catch (err) {
            NUtil.log.error(`NCache.cacheUrl : Échec du téléchargement et mise en cache de "${normUrl}".`, {
                code: 'ERR_CACHE_URL_FETCH',
                url: normUrl,
                error: err?.message
            });
            return await this.matchUrl(normUrl, { format, driver: options?.driver });
        }
    }

    /**
     * Supprime une URL mise en cache dans le moteur actif.
     *
     * @param {string} url - URL à supprimer du cache.
     * @param {Object} [options={}] - Options (`{ driver }`).
     * @returns {Promise<boolean>} `true` si la suppression a réussi.
     *
     * @example <caption>Exemple 1 : Invalider une URL mise en cache</caption>
     * await NUtil.cache.putResponse('https://api.nlib.dev/ping', 'pong');
     * await NUtil.cache.deleteUrl('https://api.nlib.dev/ping');
     * console.log(await NUtil.cache.matchUrl('https://api.nlib.dev/ping')); // null
     *
     * @example <caption>Exemple 2 : Supprimer une URL inexistante reste sûr</caption>
     * console.log(await NUtil.cache.deleteUrl('https://api.nlib.dev/inconnu')); // true
     */
    async deleteUrl(url, options = {}) {
        if (typeof url !== 'string' || !url.trim()) {
            return false;
        }
        return await this.delete(url.trim(), { ...options, namespace: '__url__' });
    }

    /**
     * Met en cache un fichier ou contenu binaire dans l'unique driver actif.
     *
     * @param {string} keyOrPath - Identifiant ou chemin logique du fichier à mettre en cache.
     * @param {Uint8Array|ArrayBuffer|Blob|string} data - Contenu du fichier.
     * @param {Object} [options={}] - Options (`{ ttl: 0, mimeType, tags: [], driver: 'auto' }`).
     * @returns {Promise<boolean>} `true` si le fichier a été mis en cache.
     *
     * @example <caption>Exemple 1 : Mettre en cache un fichier PDF ou binaire</caption>
     * const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
     * await NUtil.cache.cacheFile('rapports/2026.pdf', bytes, { ttl: 3600 });
     *
     * @example <caption>Exemple 2 : Mettre en cache un modèle HTML</caption>
     * await NUtil.cache.cacheFile('templates/header.html', '<header>NLib</header>');
     */
    async cacheFile(keyOrPath, data, options = {}) {
        const bytes = await NUtil.file.toUint8Array(data);
        const mimeType = options?.mimeType || NUtil.file.getMimeType(keyOrPath);
        return await this.set(keyOrPath, bytes, {
            ...options,
            namespace: options?.namespace || '__file__',
            mimeType
        });
    }

    /**
     * Récupère un fichier mis en cache via `cacheFile()` dans le format souhaité (`'bytes'`, `'text'`, `'base64'`, `'dataUrl'`, `'blob'`).
     *
     * @param {string} keyOrPath - Identifiant ou chemin logique du fichier.
     * @param {Object} [options={}] - Options (`{ format: 'bytes', namespace: '__file__', driver: 'auto' }`).
     * @returns {Promise<any|null>} Contenu du fichier ou `null` si absent/expiré.
     *
     * @example <caption>Exemple 1 : Relire un fichier mis en cache sous forme d'octets</caption>
     * await NUtil.cache.cacheFile('bin/test.bin', new Uint8Array([1, 2, 3]));
     * const bytes = await NUtil.cache.getFile('bin/test.bin');
     * console.log(bytes.byteLength); // 3
     *
     * @example <caption>Exemple 2 : Relire un fichier mis en cache en texte</caption>
     * await NUtil.cache.cacheFile('tpl/hello.txt', 'Bonjour NLib');
     * console.log(await NUtil.cache.getFile('tpl/hello.txt', { format: 'text' })); // 'Bonjour NLib'
     */
    async getFile(keyOrPath, options = {}) {
        const format = options?.format || 'bytes';
        const raw = await this.get(keyOrPath, {
            ...options,
            namespace: options?.namespace || '__file__',
            fallback: null
        });

        if (raw === null || raw === undefined) {
            return null;
        }

        const bytes = await NUtil.file.toUint8Array(raw);
        const mimeType = options?.mimeType || NUtil.file.getMimeType(keyOrPath);

        switch (format) {
            case 'text':
                return await NUtil.file.toText(bytes);
            case 'base64':
                return await NUtil.file.toBase64(bytes);
            case 'dataUrl':
                return await NUtil.file.toDataUrl(bytes, mimeType);
            case 'blob':
                return await NUtil.file.toBlob(bytes, mimeType);
            case 'bytes':
            default:
                return bytes;
        }
    }

    // =========================================================================
    // Méthodes privées — Sélection & Exécution sur UN SEUL Driver
    // =========================================================================

    /**
     * Résout l'unique moteur de cache à utiliser pour l'opération.
     * @private
     * @param {'auto'|'native'|'caches'|'idb'|'store'|'memory'} [requestedDriver='auto'] - Moteur demandé.
     * @returns {'native'|'caches'|'idb'|'store'|'memory'} Moteur unique retenu.
     */
    #resolveDriver(requestedDriver = 'auto') {
        if (requestedDriver === 'native' && this.isNativeAvailable) return 'native';
        if (requestedDriver === 'caches' && this.isCacheStorageAvailable) return 'caches';
        if (requestedDriver === 'idb' && this.isIdbAvailable) return 'idb';
        if (requestedDriver === 'store' && this.isStoreAvailable) return 'store';
        if (requestedDriver === 'memory') return 'memory';
        return this.driver;
    }

    /**
     * Écrit un enregistrement dans UN SEUL driver (`driver`).
     * @private
     * @param {'native'|'caches'|'idb'|'store'|'memory'} driver - Moteur unique cible.
     * @param {NCacheRecord} record - Enregistrement à stocker.
     * @returns {Promise<boolean>}
     */
    async #writeToDriver(driver, record) {
        if (driver === 'native') {
            const serializedRecord = await this.#serializeRecordForStorage(record);
            const res = await this.#invokeNativeCache('set', {
                scopedKey: record.scopedKey,
                record: serializedRecord
            });
            return Boolean(res && res.ok !== false && res.success !== false);
        }

        if (driver === 'caches') {
            return await this.#writeToCacheStorage(record);
        }

        if (driver === 'idb') {
            const putRes = await NUtil.db.idb.put('ntable', {
                ...record,
                id: `${this.#storagePrefix}${record.scopedKey}`
            });
            return Boolean(putRes?.ok);
        }

        if (driver === 'store') {
            const serializedRecord = await this.#serializeRecordForStorage(record);
            return Boolean(
                NUtil.db.store.set(`${this.#storagePrefix}${record.scopedKey}`, serializedRecord)
            );
        }

        // Driver 'memory'
        this.#setMemoryRecord(record.scopedKey, record);
        return true;
    }

    /**
     * Lit un enregistrement depuis UN SEUL driver (`driver`).
     * @private
     * @param {'native'|'caches'|'idb'|'store'|'memory'} driver - Moteur unique interrogé.
     * @param {string} scopedKey - Clé qualifiée (`namespace:key`).
     * @returns {Promise<NCacheRecord|null>}
     */
    async #readFromDriver(driver, scopedKey) {
        if (driver === 'native') {
            const res = await this.#invokeNativeCache('get', { scopedKey });
            if (!res || res.ok === false || res.success === false || !res.data) {
                return null;
            }
            const record = this.#deserializeRecordFromStorage(res.data);
            if (this.#isExpired(record)) {
                await this.#deleteFromDriver('native', scopedKey);
                return null;
            }
            return record;
        }

        if (driver === 'caches') {
            return await this.#readFromCacheStorage(scopedKey);
        }

        if (driver === 'idb') {
            const idbRes = await NUtil.db.idb.get('ntable', `${this.#storagePrefix}${scopedKey}`);
            if (!idbRes?.ok || !idbRes?.data) {
                return null;
            }
            const record = idbRes.data;
            if (this.#isExpired(record)) {
                await this.#deleteFromDriver('idb', scopedKey);
                return null;
            }
            return record;
        }

        if (driver === 'store') {
            const raw = NUtil.db.store.get(`${this.#storagePrefix}${scopedKey}`);
            if (!raw || typeof raw !== 'object') {
                return null;
            }
            const record = this.#deserializeRecordFromStorage(raw);
            if (this.#isExpired(record)) {
                await this.#deleteFromDriver('store', scopedKey);
                return null;
            }
            return record;
        }

        // Driver 'memory'
        return this.#getMemoryRecord(scopedKey);
    }

    /**
     * Supprime un enregistrement depuis UN SEUL driver (`driver`).
     * @private
     * @param {'native'|'caches'|'idb'|'store'|'memory'} driver - Moteur unique cible.
     * @param {string} scopedKey - Clé qualifiée (`namespace:key`).
     * @returns {Promise<boolean>}
     */
    async #deleteFromDriver(driver, scopedKey) {
        if (driver === 'native') {
            const res = await this.#invokeNativeCache('delete', { scopedKey });
            return Boolean(res && res.ok !== false && res.success !== false);
        }

        if (driver === 'caches') {
            try {
                const cache = await globalThis.caches.open(this.#cacheStorageName);
                await cache.delete(this.#toCacheApiUrl(scopedKey));
                return true;
            } catch {
                return false;
            }
        }

        if (driver === 'idb') {
            const delRes = await NUtil.db.idb.delete('ntable', `${this.#storagePrefix}${scopedKey}`);
            return Boolean(delRes?.ok);
        }

        if (driver === 'store') {
            NUtil.db.store.remove(`${this.#storagePrefix}${scopedKey}`);
            return true;
        }

        this.#memory.delete(scopedKey);
        return true;
    }

    /**
     * Récupère tous les enregistrements stockés dans l'unique driver spécifié.
     * @private
     * @param {'native'|'caches'|'idb'|'store'|'memory'} driver - Moteur cible.
     * @returns {Promise<Array<NCacheRecord>>}
     */
    async #getAllDriverRecords(driver) {
        if (driver === 'caches') {
            try {
                const cache = await globalThis.caches.open(this.#cacheStorageName);
                const requests = await cache.keys();
                const records = [];
                for (let i = 0; i < requests.length; i++) {
                    const req = requests[i];
                    const res = await cache.match(req);
                    if (res) {
                        const parsed = await this.#parseCacheStorageResponse(res);
                        if (parsed) {
                            records.push(parsed);
                        }
                    }
                }
                return records;
            } catch {
                return [];
            }
        }

        if (driver === 'idb') {
            const allRes = await NUtil.db.idb.getAll('ntable');
            if (!allRes?.ok || !Array.isArray(allRes.data)) {
                return [];
            }
            return allRes.data.filter(
                (item) => item && typeof item.id === 'string' && item.id.startsWith(this.#storagePrefix)
            );
        }

        if (driver === 'store') {
            const keys = NUtil.db.store.keys();
            const records = [];
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (typeof k === 'string' && k.startsWith(this.#storagePrefix)) {
                    const raw = NUtil.db.store.get(k);
                    if (raw && typeof raw === 'object') {
                        records.push(this.#deserializeRecordFromStorage(raw));
                    }
                }
            }
            return records;
        }

        if (driver === 'memory') {
            return Array.from(this.#memory.values());
        }

        return [];
    }

    // =========================================================================
    // Méthodes privées — Adaptateur CacheStorage API (`globalThis.caches`)
    // =========================================================================

    /**
     * Construit une URL synthétique valide pour stocker n'importe quelle clé dans `CacheStorage`.
     * @private
     * @param {string} scopedKey - Clé qualifiée.
     * @returns {string}
     */
    #toCacheApiUrl(scopedKey) {
        return `${this.#cacheApiBaseUrl}${encodeURIComponent(scopedKey)}`;
    }

    /**
     * Écrit un `NCacheRecord` directement dans `globalThis.caches` sous forme d'instance `Response`.
     * @private
     * @param {NCacheRecord} record - Enregistrement.
     * @returns {Promise<boolean>}
     */
    async #writeToCacheStorage(record) {
        const cache = await globalThis.caches.open(this.#cacheStorageName);
        let bodyBytes;

        if (record.dataType === 'bytes' || record.dataType === 'response') {
            bodyBytes = await NUtil.file.toUint8Array(record.value);
        } else {
            bodyBytes = await NUtil.file.toUint8Array(JSON.stringify(record.value));
        }

        const meta = {
            key: record.key,
            scopedKey: record.scopedKey,
            namespace: record.namespace,
            dataType: record.dataType,
            mimeType: record.mimeType,
            status: record.status,
            headers: record.headers,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            expiresAt: record.expiresAt,
            tags: record.tags
        };

        const headers = {
            'content-type': record.mimeType || 'application/octet-stream',
            'x-nlib-cache-meta': encodeURIComponent(JSON.stringify(meta))
        };

        const response = new Response(bodyBytes, {
            status: record.status || 200,
            headers
        });

        await cache.put(this.#toCacheApiUrl(record.scopedKey), response);
        return true;
    }

    /**
     * Lit et reconstruit un `NCacheRecord` depuis `globalThis.caches`.
     * @private
     * @param {string} scopedKey - Clé qualifiée.
     * @returns {Promise<NCacheRecord|null>}
     */
    async #readFromCacheStorage(scopedKey) {
        const cache = await globalThis.caches.open(this.#cacheStorageName);
        const cacheUrl = this.#toCacheApiUrl(scopedKey);
        const matched = await cache.match(cacheUrl);
        if (!matched) {
            return null;
        }

        const record = await this.#parseCacheStorageResponse(matched);
        if (!record || this.#isExpired(record)) {
            await cache.delete(cacheUrl);
            return null;
        }

        return record;
    }

    /**
     * Parse une `Response` issue de `CacheStorage` en `NCacheRecord`.
     * @private
     * @param {Response} response - Réponse stockée.
     * @returns {Promise<NCacheRecord|null>}
     */
    async #parseCacheStorageResponse(response) {
        try {
            const rawMeta = response.headers?.get('x-nlib-cache-meta');
            if (!rawMeta) {
                return null;
            }
            const meta = JSON.parse(decodeURIComponent(rawMeta));
            const buf = await response.clone().arrayBuffer();
            const bytes = new Uint8Array(buf);

            let value = bytes;
            if (meta.dataType !== 'bytes' && meta.dataType !== 'response') {
                const text = await NUtil.file.toText(bytes);
                value = JSON.parse(text);
            }

            return {
                ...meta,
                value
            };
        } catch {
            return null;
        }
    }

    // =========================================================================
    // Méthodes privées — Utilitaires internes (Sérialisation, Mémoire LRU, Formatage)
    // =========================================================================

    /**
     * Invoque le pont natif OS pour une opération de cache.
     * @private
     * @param {string} action - Action (`get`, `set`, `delete`, `clear`, `keys`, `prune`, `clearByTag`).
     * @param {Object} params - Paramètres.
     * @returns {Promise<any>}
     */
    async #invokeNativeCache(action, params = {}) {
        return await NUtil.sys.invokeNative({
            type: ['app', 'cache', action],
            params
        });
    }

    /**
     * Sérialise un `NCacheRecord` pour les moteurs purement JSON (`NStorage` / `native`) en convertissant
     * les `Uint8Array` en Base64.
     * @private
     * @param {NCacheRecord} record - Enregistrement.
     * @returns {Promise<Object>}
     */
    async #serializeRecordForStorage(record) {
        if (record.dataType === 'bytes' || record.dataType === 'response') {
            return {
                ...record,
                value: await NUtil.file.toBase64(record.value),
                __isBase64Bytes: true
            };
        }
        return record;
    }

    /**
     * Désérialise un `NCacheRecord` issu de `NStorage` ou `native`.
     * @private
     * @param {Object} raw - Enregistrement brut.
     * @returns {NCacheRecord}
     */
    #deserializeRecordFromStorage(raw) {
        if (raw && raw.__isBase64Bytes && typeof raw.value === 'string') {
            return {
                ...raw,
                value: NUtil.file.fromBase64(raw.value)
            };
        }
        return raw;
    }

    /**
     * Normalise une clé de cache.
     * @private
     * @param {string} key - Clé brute.
     * @returns {string}
     */
    #normalizeKey(key) {
        if (typeof key !== 'string' && typeof key !== 'number') {
            return '';
        }
        return String(key).trim();
    }

    /**
     * Résout l'espace de nommage effectif.
     * @private
     * @param {string} [namespace] - Espace de nommage fourni.
     * @returns {string}
     */
    #resolveNamespace(namespace) {
        if (typeof namespace === 'string' && namespace.trim()) {
            return namespace.trim();
        }
        return this.#defaultNamespace;
    }

    /**
     * Construit une clé qualifiée avec son namespace (`namespace:key`).
     * @private
     * @param {string} namespace - Espace de nommage.
     * @param {string} cleanKey - Clé propre.
     * @returns {string}
     */
    #buildScopedKey(namespace, cleanKey) {
        return `${namespace}:${cleanKey}`;
    }

    /**
     * Vérifie si un enregistrement de cache est expiré.
     * @private
     * @param {NCacheRecord} record - Enregistrement à tester.
     * @returns {boolean}
     */
    #isExpired(record) {
        if (!record || typeof record !== 'object') {
            return true;
        }
        if (typeof record.expiresAt === 'number' && record.expiresAt > 0) {
            return Date.now() > record.expiresAt;
        }
        return false;
    }

    /**
     * Lit un enregistrement depuis la Map mémoire (utilisé uniquement lorsque `driver === 'memory'`).
     * @private
     * @param {string} scopedKey - Clé qualifiée.
     * @returns {NCacheRecord|null}
     */
    #getMemoryRecord(scopedKey) {
        if (!this.#memory.has(scopedKey)) {
            return null;
        }
        const record = this.#memory.get(scopedKey);
        if (this.#isExpired(record)) {
            this.#memory.delete(scopedKey);
            return null;
        }
        this.#memory.delete(scopedKey);
        this.#memory.set(scopedKey, record);
        return record;
    }

    /**
     * Écrit un enregistrement dans la Map mémoire avec éviction LRU (utilisé uniquement lorsque `driver === 'memory'`).
     * @private
     * @param {string} scopedKey - Clé qualifiée.
     * @param {NCacheRecord} record - Enregistrement à stocker.
     */
    #setMemoryRecord(scopedKey, record) {
        if (this.#memory.has(scopedKey)) {
            this.#memory.delete(scopedKey);
        } else if (this.#memory.size >= this.#maxMemoryEntries) {
            const oldestKey = this.#memory.keys().next().value;
            if (oldestKey !== undefined) {
                this.#memory.delete(oldestKey);
            }
        }
        this.#memory.set(scopedKey, record);
    }

    /**
     * Détecte le type de valeur.
     * @private
     * @param {any} value - Valeur brute.
     * @returns {'bytes'|'string'|'number'|'boolean'|'json'}
     */
    #detectValueType(value) {
        if (
            value instanceof Uint8Array ||
            value instanceof ArrayBuffer ||
            ArrayBuffer.isView(value) ||
            (typeof Blob !== 'undefined' && value instanceof Blob)
        ) {
            return 'bytes';
        }
        if (typeof value === 'string') return 'string';
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        return 'json';
    }

    /**
     * Formate un enregistrement d'URL/réponse selon le format demandé par `matchUrl`/`cacheUrl`.
     * @private
     * @param {NCacheRecord} record - Enregistrement de réponse.
     * @param {'auto'|'json'|'text'|'bytes'|'blob'|'dataUrl'|'response'} format - Format souhaité.
     * @returns {Promise<any>}
     */
    async #formatUrlRecordOutput(record, format) {
        const bytes = await NUtil.file.toUint8Array(record.value);
        const mimeType = (record.mimeType || 'application/octet-stream').toLowerCase();

        if (format === 'response') {
            if (typeof Response !== 'undefined') {
                return new Response(bytes, {
                    status: record.status || 200,
                    headers: record.headers || { 'content-type': record.mimeType || 'application/octet-stream' }
                });
            }
            return {
                ok: (record.status || 200) >= 200 && (record.status || 200) < 300,
                status: record.status || 200,
                headers: record.headers || {},
                data: bytes
            };
        }

        if (format === 'bytes') return bytes;
        if (format === 'blob') return await NUtil.file.toBlob(bytes, record.mimeType);
        if (format === 'dataUrl') return await NUtil.file.toDataUrl(bytes, record.mimeType);
        if (format === 'text') return await NUtil.file.toText(bytes);
        if (format === 'json') {
            const text = await NUtil.file.toText(bytes);
            try {
                return JSON.parse(text);
            } catch {
                return null;
            }
        }

        if (mimeType.includes('json')) {
            const text = await NUtil.file.toText(bytes);
            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        }
        if (
            mimeType.startsWith('text/') ||
            mimeType.includes('javascript') ||
            mimeType.includes('xml') ||
            mimeType.includes('svg')
        ) {
            return await NUtil.file.toText(bytes);
        }

        return bytes;
    }
}

export default NCache;
