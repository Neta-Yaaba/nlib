/**
 * @file NStorage.js
 * @package @nlib/js-backend
 * @description Gestionnaire universel de stockage clé-valeur avec bascule automatique en cascade :
 * 1. `localStorage` (prioritaire si disponible et accessible en écriture)
 * 2. `sessionStorage` (si localStorage est indisponible, désactivé ou quota dépassé)
 * 3. Mémoire en variable globale (`globalThis._nlib_memory_storage_` ou Map interne en fallback ultime)
 *
 * Prend en charge la sérialisation JSON automatique, le typage à la lecture (get, getString, getNumber,
 * getBoolean, getJson, getArray), la gestion des préfixes (namespaces), l'expiration (TTL),
 * et garantit un retour prévisible sans lever d'exception bloquante.
 *
 * Conforme aux standards NLib : instanciable et disponible via `NUtil.storage`.
 */

/**
 * @class NStorage
 * @description Gestionnaire universel et résilient de stockage clé/valeur pour NLib.
 *
 * @example <caption>Exemple 1 : Utilisation simple avec typage automatique et objets</caption>
 * const storage = new NStorage();
 * storage.set('user', { id: 1, name: 'Alice', role: 'admin' });
 * const user = storage.get('user');
 * console.log(user.name); // 'Alice'
 *
 * @example <caption>Exemple 2 : Définition d'un préfixe (namespace) et d'un TTL (expiration)</caption>
 * const sessionStore = new NStorage({ prefix: 'app_session_', ttl: 3600 }); // Expire après 1h
 * sessionStore.set('authToken', 'xyz_123');
 * console.log(sessionStore.getString('authToken')); // 'xyz_123'
 *
 * @example <caption>Exemple 3 : Forcer le type de stockage ou consulter le driver actif</caption>
 * const memStore = new NStorage({ driver: 'memory' });
 * console.log(memStore.driver); // 'memory'
 * console.log(storage.driver);  // 'localStorage', 'sessionStorage' ou 'memory'
 */
export class NStorage {

    // =========================================================================
    // Propriétés statiques privées
    // =========================================================================

    /**
     * Conteneur mémoire global partagé (fallback ultime lorsque ni localStorage ni sessionStorage ne sont disponibles).
     * Initialisé paresseusement au premier besoin.
     * @type {Map<string, string>|null}
     * @private
     */
    static #memoryStore = null;

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Moteur de stockage effectif résolu ('localStorage', 'sessionStorage' ou 'memory').
     * @type {'localStorage'|'sessionStorage'|'memory'}
     * @private
     */
    #driver = 'memory';

    /**
     * Objet natif sous-jacent (Storage du navigateur ou Map mémoire).
     * @type {Storage|Map<string, string>|null}
     * @private
     */
    #adapter = null;

    /**
     * Préfixe optionnel appliqué à toutes les clés pour éviter les collisions.
     * @type {string}
     * @private
     */
    #prefix = '';

    /**
     * Durée de vie par défaut en secondes (0 = pas d'expiration).
     * @type {number}
     * @private
     */
    #defaultTtl = 0;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de NStorage.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration du stockage.
     * @param {'auto'|'localStorage'|'sessionStorage'|'memory'} [options.driver='auto'] - Pilote demandé.
     * @param {string} [options.prefix=''] - Préfixe ajouté automatiquement devant toutes les clés.
     * @param {number} [options.ttl=0] - Durée de validité par défaut en secondes (0 = infini).
     *
     * @example <caption>Exemple 1 : Instanciation standard en mode auto</caption>
     * const storage = new NStorage();
     *
     * @example <caption>Exemple 2 : Stockage avec préfixe dédié</caption>
     * const posStorage = new NStorage({ prefix: 'gestpos:', driver: 'localStorage' });
     */
    constructor(options = {}) {
        if (options && typeof options === 'object') {
            if (typeof options.prefix === 'string') {
                this.#prefix = options.prefix;
            }
            if (typeof options.ttl === 'number' && options.ttl > 0) {
                this.#defaultTtl = options.ttl;
            }
            this.#initDriver(options.driver || 'auto');
        } else {
            this.#initDriver('auto');
        }
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    /**
     * Retourne le nom du pilote de stockage actuellement utilisé (`'localStorage'`, `'sessionStorage'` ou `'memory'`).
     * @type {'localStorage'|'sessionStorage'|'memory'}
     *
     * @example <caption>Exemple 1 : Consulter le moteur effectif</caption>
     * console.log(storage.driver); // 'localStorage'
     *
     * @example <caption>Exemple 2 : Vérification conditionnelle</caption>
     * if (storage.driver === 'memory') {
     *     console.warn('Attention : stockage volatile en mémoire.');
     * }
     */
    get driver() {
        return this.#driver;
    }

    /**
     * Retourne le préfixe configuré pour cette instance.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le préfixe</caption>
     * console.log(storage.prefix); // 'app_'
     *
     * @example <caption>Exemple 2 : Vérifier si un préfixe est actif</caption>
     * if (storage.prefix) { console.log('Espace de nommage actif'); }
     */
    get prefix() {
        return this.#prefix;
    }

    /**
     * Retourne le nombre d'éléments stockés dans cette instance (en tenant compte du préfixe).
     * @type {number}
     *
     * @example <caption>Exemple 1 : Consulter la taille</caption>
     * console.log(`Éléments stockés : ${storage.length}`);
     *
     * @example <caption>Exemple 2 : Vérifier si le stockage est vide</caption>
     * if (storage.length === 0) { console.log('Aucun élément stocké'); }
     */
    get length() {
        return this.keys().length;
    }

    // =========================================================================
    // Opérations Clé-Valeur Fondamentales
    // =========================================================================

    /**
     * Enregistre une valeur associée à une clé. Les objets, tableaux, nombres et booléens
     * sont automatiquement sérialisés en JSON.
     *
     * @method set
     * @param {string} key - Clé de stockage.
     * @param {any} value - Valeur à enregistrer.
     * @param {number} [ttl] - Durée de validité en secondes (écrase le TTL par défaut si spécifié).
     * @returns {boolean} `true` si l'opération a réussi, `false` sinon.
     *
     * @example <caption>Exemple 1 : Enregistrer une chaîne ou un objet</caption>
     * storage.set('username', 'Alice');
     * storage.set('config', { theme: 'dark', sound: true });
     *
     * @example <caption>Exemple 2 : Enregistrer une clé temporaire avec TTL de 30 secondes</caption>
     * storage.set('temp_code', '984210', 30);
     */
    set(key, value, ttl) {
        if (typeof key !== 'string' || !key.trim()) return false;

        const effectiveTtl = typeof ttl === 'number' && ttl > 0 ? ttl : this.#defaultTtl;
        const payload = {
            v: value,
            e: effectiveTtl > 0 ? Date.now() + (effectiveTtl * 1000) : 0
        };

        const serialized = JSON.stringify(payload);
        const fullKey = this.#buildKey(key);

        try {
            if (this.#driver === 'memory') {
                this.#adapter.set(fullKey, serialized);
                return true;
            }

            this.#adapter.setItem(fullKey, serialized);
            return true;
        } catch (err) {
            // Si quota dépassé ou exception, basculer immédiatement en mémoire de secours
            this.#fallbackToMemory();
            this.#adapter.set(fullKey, serialized);
            return true;
        }
    }

    /**
     * Récupère la valeur désérialisée associée à une clé.
     * Si la clé est expirée ou inexistante, retourne `defaultValue`.
     *
     * @method get
     * @param {string} key - Clé recherchée.
     * @param {any} [defaultValue=null] - Valeur par défaut retournée si introuvable ou expirée.
     * @returns {any} Valeur désérialisée ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Récupérer un objet</caption>
     * const user = storage.get('user', { role: 'guest' });
     *
     * @example <caption>Exemple 2 : Récupérer une valeur avec valeur par défaut</caption>
     * const theme = storage.get('theme', 'light');
     */
    get(key, defaultValue = null) {
        if (typeof key !== 'string' || !key.trim()) return defaultValue;

        const fullKey = this.#buildKey(key);
        let raw = null;

        try {
            raw = this.#driver === 'memory' ? this.#adapter.get(fullKey) : this.#adapter.getItem(fullKey);
        } catch {
            return defaultValue;
        }

        if (raw === null || raw === undefined) return defaultValue;

        try {
            const parsed = JSON.parse(raw);
            // Vérification de structure enveloppe { v, e }
            if (parsed && typeof parsed === 'object' && 'v' in parsed && 'e' in parsed) {
                if (parsed.e > 0 && Date.now() > parsed.e) {
                    this.remove(key); // Suppression automatique si expiré
                    return defaultValue;
                }
                return parsed.v !== undefined ? parsed.v : defaultValue;
            }
            return parsed;
        } catch {
            // Si la valeur avait été écrite brute hors NStorage
            return raw;
        }
    }

    /**
     * Récupère une valeur sous forme de chaîne de caractères (`string`).
     *
     * @method getString
     * @param {string} key - Clé recherchée.
     * @param {string} [defaultValue=''] - Valeur par défaut.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Obtenir un token d'authentification</caption>
     * const token = storage.getString('token', '');
     *
     * @example <caption>Exemple 2 : Avec valeur de repli explicite</caption>
     * const lang = storage.getString('lang', 'fr');
     */
    getString(key, defaultValue = '') {
        const val = this.get(key, defaultValue);
        return val !== null && val !== undefined ? String(val) : defaultValue;
    }

    /**
     * Récupère une valeur sous forme de nombre (`number`).
     *
     * @method getNumber
     * @param {string} key - Clé recherchée.
     * @param {number} [defaultValue=0] - Valeur par défaut.
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Obtenir un compteur numérique</caption>
     * const visits = storage.getNumber('visits', 0);
     *
     * @example <caption>Exemple 2 : Conversion automatique</caption>
     * const price = storage.getNumber('last_price', 100);
     */
    getNumber(key, defaultValue = 0) {
        const val = this.get(key, defaultValue);
        const parsed = Number(val);
        return !Number.isNaN(parsed) ? parsed : defaultValue;
    }

    /**
     * Récupère une valeur sous forme de booléen (`boolean`).
     *
     * @method getBoolean
     * @param {string} key - Clé recherchée.
     * @param {boolean} [defaultValue=false] - Valeur par défaut.
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Obtenir une préférence activée</caption>
     * const isDarkMode = storage.getBoolean('darkMode', false);
     *
     * @example <caption>Exemple 2 : Évaluation des chaînes 'true' / '1'</caption>
     * const sound = storage.getBoolean('sound_enabled', true);
     */
    getBoolean(key, defaultValue = false) {
        const val = this.get(key, defaultValue);
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
            const lower = val.toLowerCase().trim();
            if (lower === 'true' || lower === '1') return true;
            if (lower === 'false' || lower === '0') return false;
        }
        if (typeof val === 'number') return val !== 0;
        return Boolean(val);
    }

    /**
     * Récupère une valeur sous forme d'objet JSON (`Object`).
     *
     * @method getJson
     * @param {string} key - Clé recherchée.
     * @param {Object} [defaultValue={}] - Objet par défaut.
     * @returns {Object}
     *
     * @example <caption>Exemple 1 : Obtenir le profil utilisateur</caption>
     * const profile = storage.getJson('profile', {});
     *
     * @example <caption>Exemple 2 : Récupérer des paramètres par défaut</caption>
     * const settings = storage.getJson('settings', { theme: 'light' });
     */
    getJson(key, defaultValue = {}) {
        const val = this.get(key, defaultValue);
        return val && typeof val === 'object' && !Array.isArray(val) ? val : defaultValue;
    }

    /**
     * Récupère une valeur sous forme de tableau (`Array`).
     *
     * @method getArray
     * @param {string} key - Clé recherchée.
     * @param {Array} [defaultValue=[]] - Tableau par défaut.
     * @returns {Array}
     *
     * @example <caption>Exemple 1 : Obtenir la liste des articles favoris</caption>
     * const favorites = storage.getArray('fav_ids', []);
     *
     * @example <caption>Exemple 2 : Récupérer l'historique des recherches</caption>
     * const history = storage.getArray('recent_searches', []);
     */
    getArray(key, defaultValue = []) {
        const val = this.get(key, defaultValue);
        return Array.isArray(val) ? val : defaultValue;
    }

    /**
     * Vérifie si une clé existe dans le stockage et n'est pas expirée.
     *
     * @method has
     * @param {string} key - Clé à tester.
     * @returns {boolean} `true` si la clé existe et est valide.
     *
     * @example <caption>Exemple 1 : Tester la présence d'une clé</caption>
     * if (storage.has('session_id')) { console.log('Session active'); }
     *
     * @example <caption>Exemple 2 : Condition avant insertion</caption>
     * if (!storage.has('installed_date')) { storage.set('installed_date', Date.now()); }
     */
    has(key) {
        if (typeof key !== 'string' || !key.trim()) return false;
        return this.get(key, undefined) !== undefined;
    }

    /**
     * Supprime un élément par sa clé.
     *
     * @method remove
     * @param {string} key - Clé à supprimer.
     * @returns {boolean} `true` si la suppression s'est déroulée sans erreur.
     *
     * @example <caption>Exemple 1 : Supprimer une clé</caption>
     * storage.remove('authToken');
     *
     * @example <caption>Exemple 2 : Nettoyage après déconnexion</caption>
     * storage.remove('user_session');
     */
    remove(key) {
        if (typeof key !== 'string' || !key.trim()) return false;
        const fullKey = this.#buildKey(key);

        try {
            if (this.#driver === 'memory') {
                return this.#adapter.delete(fullKey);
            }
            this.#adapter.removeItem(fullKey);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Supprime tous les éléments gérés par cette instance (respecte le préfixe s'il est défini).
     *
     * @method clear
     * @returns {boolean} `true` si l'opération a réussi.
     *
     * @example <caption>Exemple 1 : Vider tout le stockage préfixé</caption>
     * storage.clear();
     *
     * @example <caption>Exemple 2 : Remise à zéro totale d'une instance</caption>
     * const cacheStore = new NStorage({ prefix: 'cache_' });
     * cacheStore.clear(); // Supprime uniquement les clés commençant par 'cache_'
     */
    clear() {
        try {
            const allKeys = this.keys();
            for (const k of allKeys) {
                this.remove(k);
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retourne la liste de toutes les clés enregistrées pour cette instance (sans le préfixe interne).
     *
     * @method keys
     * @returns {string[]} Liste des noms de clés.
     *
     * @example <caption>Exemple 1 : Lister toutes les clés</caption>
     * const keys = storage.keys();
     * console.log('Clés actives :', keys);
     *
     * @example <caption>Exemple 2 : Parcourir l'ensemble des clés</caption>
     * storage.keys().forEach((k) => console.log(k, storage.get(k)));
     */
    keys() {
        const result = [];
        try {
            if (this.#driver === 'memory') {
                for (const fullKey of this.#adapter.keys()) {
                    if (!this.#prefix || fullKey.startsWith(this.#prefix)) {
                        result.push(this.#prefix ? fullKey.slice(this.#prefix.length) : fullKey);
                    }
                }
            } else {
                const count = this.#adapter.length;
                for (let i = 0; i < count; i++) {
                    const fullKey = this.#adapter.key(i);
                    if (fullKey && (!this.#prefix || fullKey.startsWith(this.#prefix))) {
                        result.push(this.#prefix ? fullKey.slice(this.#prefix.length) : fullKey);
                    }
                }
            }
        } catch {
            return [];
        }
        return result;
    }

    /**
     * Exporte l'intégralité du stockage sous forme d'un objet clé/valeur standard.
     *
     * @method toObject
     * @returns {Object<string, any>}
     *
     * @example <caption>Exemple 1 : Sérialiser tout le stockage pour un export ou backup</caption>
     * const backup = storage.toObject();
     * console.log(JSON.stringify(backup));
     *
     * @example <caption>Exemple 2 : Inspecter le contenu complet</caption>
     * console.log(storage.toObject());
     */
    toObject() {
        const obj = {};
        const keys = this.keys();
        for (const k of keys) {
            const val = this.get(k);
            if (val !== undefined && val !== null) {
                obj[k] = val;
            }
        }
        return obj;
    }

    // =========================================================================
    // Méthodes Internes Privées (Détection et Résolution en Cascade)
    // =========================================================================

    /**
     * Retourne l'instance unique du Map mémoire partagée (Lazy allocation).
     * @private
     * @static
     */
    static #getSharedMemoryStore() {
        if (!NStorage.#memoryStore) {
            if (typeof globalThis !== 'undefined') {
                if (!globalThis._nlib_memory_storage_) {
                    globalThis._nlib_memory_storage_ = new Map();
                }
                NStorage.#memoryStore = globalThis._nlib_memory_storage_;
            } else {
                NStorage.#memoryStore = new Map();
            }
        }
        return NStorage.#memoryStore;
    }

    /**
     * Initialise le pilote avec la cascade stricte :
     * 1. localStorage -> 2. sessionStorage -> 3. variable globale en mémoire
     * @private
     */
    #initDriver(requestedDriver) {
        if (requestedDriver === 'memory') {
            this.#driver = 'memory';
            this.#adapter = NStorage.#getSharedMemoryStore();
            return;
        }

        if (requestedDriver === 'sessionStorage') {
            if (this.#isStorageAvailable('sessionStorage')) {
                this.#driver = 'sessionStorage';
                this.#adapter = globalThis.sessionStorage;
                return;
            }
            this.#fallbackToMemory();
            return;
        }

        if (requestedDriver === 'localStorage') {
            if (this.#isStorageAvailable('localStorage')) {
                this.#driver = 'localStorage';
                this.#adapter = globalThis.localStorage;
                return;
            }
            // Repli sur sessionStorage si demandé mais localStorage indisponible
            if (this.#isStorageAvailable('sessionStorage')) {
                this.#driver = 'sessionStorage';
                this.#adapter = globalThis.sessionStorage;
                return;
            }
            this.#fallbackToMemory();
            return;
        }

        // Mode 'auto' : 1. localStorage -> 2. sessionStorage -> 3. memory
        if (this.#isStorageAvailable('localStorage')) {
            this.#driver = 'localStorage';
            this.#adapter = globalThis.localStorage;
        } else if (this.#isStorageAvailable('sessionStorage')) {
            this.#driver = 'sessionStorage';
            this.#adapter = globalThis.sessionStorage;
        } else {
            this.#fallbackToMemory();
        }
    }

    /**
     * Teste réellement si un storage navigateur est accessible en lecture ET écriture.
     * (Vérifie contre les restrictions de cookies tiers, mode privé strict, etc.).
     * @private
     */
    #isStorageAvailable(type) {
        try {
            if (typeof globalThis === 'undefined' || !globalThis[type]) {
                return false;
            }
            const storage = globalThis[type];
            const testKey = `__nlib_test_${type}__`;
            storage.setItem(testKey, '1');
            const ok = storage.getItem(testKey) === '1';
            storage.removeItem(testKey);
            return ok;
        } catch {
            return false;
        }
    }

    /**
     * Bascule le moteur actuel vers le conteneur en mémoire globale partagée.
     * @private
     */
    #fallbackToMemory() {
        this.#driver = 'memory';
        this.#adapter = NStorage.#getSharedMemoryStore();
    }

    /**
     * Construit la clé finale incluant le préfixe.
     * @private
     */
    #buildKey(key) {
        return this.#prefix ? `${this.#prefix}${key}` : key;
    }
}

export default NStorage;

