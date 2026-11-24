/**
 * @file NStorage.js
 * @package @nlib/js-backend
 * @description Gestionnaire de stockage clé-valeur pour NLib s'appuyant sur `localStorage` et `sessionStorage` :
 * - Sélection automatique ou explicite du pilote (`localStorage` / `sessionStorage`) avec repli automatique.
 * - Isolation multi-espaces par préfixe technique (`prefix`) et contexte applicatif (`context`, `withContext()`).
 * - Gestion de la durée de vie des entrées via TTL en secondes avec purge automatique à la lecture.
 * - Sérialisation JSON avec gestion de `BigInt` et accesseurs typés (`get()`, `getString()`, `getNumber()`, `getBoolean()`, `getJson()`, `getArray()`).
 */

import { NObject } from '../core/NObject.js';
import { NLog } from '../log/NLog.js';

/**
 * Options de contexte et de durée de vie pour les opérations NStorage.
 * @typedef {Object} NStorageOptions
 * @property {number} [ttl=0] - Durée de validité en secondes (0 = infini).
 * @property {string} [context=''] - Contexte applicatif ciblé pour l'opération (ex: 'app', 'admin', 'site').
 */

/**
 * @class NStorage
 * @description Gestionnaire de stockage clé/valeur basé sur `localStorage` / `sessionStorage` avec support des contextes et du TTL.
 *
 * @example <caption>Exemple 1 : Utilisation standard avec typage automatique et objets</caption>
  * NStorage.set('user', { id: 1, name: 'Alice', role: 'admin' });
 * const user = storage.get('user');
 * console.log(user?.name); // 'Alice'
 *
 * @example <caption>Exemple 2 : Cloisonnement par contexte applicatif (app, admin, site) sur un même domaine</caption>
 * const adminStorage = NStorage.withContext('admin');
 * const siteStorage = NStorage.withContext('site');
 * adminStorage.set('theme', 'dark');  // Stocké sous 'admin:theme'
 * siteStorage.set('theme', 'light');  // Stocké sous 'site:theme'
 * console.log(adminStorage.getString('theme')); // 'dark'
 * console.log(siteStorage.getString('theme'));  // 'light'
 *
 * @example <caption>Exemple 3 : Dérivation fluide avec withContext et TTL</caption>
 * NStorage.configure({ prefix: 'my_pos:', ttl: 3600 });
 * const appStore = baseStore.withContext('app');
 * appStore.set('jwt', 'token_sec_123');
 * console.log(appStore.getString('jwt')); // 'token_sec_123'
 */
export class NStorage {

    // =========================================================================
    // Propriétés privées statiques
    // =========================================================================

    /**
     * Moteur de stockage effectif résolu ('localStorage', 'sessionStorage' ou null si indisponible).
     * @type {'localStorage'|'sessionStorage'|null}
     * @private
     */
    static #driver = null;

    /**
     * Adaptateur sous-jacent (Storage navigateur native : localStorage ou sessionStorage).
     * @type {Storage|null}
     * @private
     */
    static #adapter = null;

    /**
     * Préfixe technique optionnel appliqué à toutes les clés pour éviter les collisions globales.
     * @type {string}
     * @private
     */
    static #prefix = '';

    /**
     * Contexte applicatif pour distinguer les données d'un même domaine (ex: 'app', 'admin', 'site').
     * @type {string}
     * @private
     */
    static #context = '';

    /**
     * Durée de vie par défaut en secondes (0 = pas d'expiration).
     * @type {number}
     * @private
     */
    static #defaultTtl = 0;

    /** @type {boolean} */
    static #initialized = false;

    // =========================================================================
    // Configuration & Getters / Setters
    // =========================================================================

    /**
     * Configure les options globales de `NStorage` et initialise le pilote demandé.
     *
     * @param {Object} [options={}] - Options de configuration du stockage.
     * @param {'auto'|'localStorage'|'sessionStorage'} [options.driver='auto'] - Pilote demandé.
     * @param {string} [options.prefix=''] - Préfixe technique global ajouté devant toutes les clés.
     * @param {string} [options.context=''] - Contexte applicatif (ex: 'app', 'admin', 'site').
     * @param {number} [options.ttl=0] - Durée de validité par défaut en secondes (0 = sans expiration).
     * @returns {typeof NStorage}
     *
     * @example <caption>Exemple 1 : Configurer un préfixe et un contexte</caption>
     * NStorage.configure({ prefix: 'my_pos:', context: 'admin', ttl: 3600 });
     *
     * @example <caption>Exemple 2 : Forcer sessionStorage</caption>
     * NStorage.configure({ driver: 'sessionStorage' });
     */
    static configure(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        NStorage.#prefix = typeof opts.prefix === 'string' ? opts.prefix : '';
        NStorage.#context = (typeof opts.context === 'string' && opts.context.trim()) ? opts.context.trim() : '';
        NStorage.#defaultTtl = (typeof opts.ttl === 'number' && Number.isFinite(opts.ttl) && opts.ttl > 0)
            ? Math.floor(opts.ttl)
            : 0;
        NStorage.#initDriver(opts.driver || 'auto');
        NStorage.#initialized = true;
        return NStorage;
    }

    /**
     * Initialise le pilote de stockage par défaut lors du premier accès.
     * @private
     */
    static #ensureDriver() {
        if (!NStorage.#initialized) {
            NStorage.#initDriver('auto');
            NStorage.#initialized = true;
        }
    }
    /**
     * Retourne le nom du pilote de stockage actuellement actif (`'localStorage'`, `'sessionStorage'` ou `null`).
     * @type {'localStorage'|'sessionStorage'|null}
     *
     * @example <caption>Exemple 1 : Consulter le pilote actif</caption>
     * console.log(storage.driver); // 'localStorage'
     *
     * @example <caption>Exemple 2 : Conditionner un traitement selon le pilote actif</caption>
     * if (storage.driver === 'sessionStorage') {
     *     console.log('Stockage de session actif');
     * }
     */
    static get driver() {
        NStorage.#ensureDriver();
        return NStorage.#driver;
    }

    /**
     * Indique si un pilote de stockage valide (localStorage ou sessionStorage) est disponible et accessible.
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier la disponibilité du stockage</caption>
     * console.log(storage.isAvailable); // true ou false
     *
     * @example <caption>Exemple 2 : Condition avant écriture critique</caption>
     * if (storage.isAvailable) { storage.set('session', { token: 'abc' }); }
     */
    static get isAvailable() {
        NStorage.#ensureDriver();
        return NStorage.#adapter !== null;
    }

    /**
     * Retourne le préfixe technique configuré pour cette instance.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le préfixe défini</caption>
     * console.log(storage.prefix); // 'my_pos:'
     *
     * @example <caption>Exemple 2 : Vérifier si un préfixe est actif</caption>
     * if (storage.prefix.length > 0) { console.log('Préfixe technique actif'); }
     */
    static get prefix() {
        return NStorage.#prefix;
    }

    /**
     * Retourne le contexte applicatif actif de cette instance (ex: 'app', 'admin', 'site').
     * Retourne une chaîne vide si l'instance est en mode généralisé (sans contexte).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Consulter le contexte courant</caption>
     * console.log(storage.context); // 'admin' ou ''
     *
     * @example <caption>Exemple 2 : Vérifier si l'instance est cloisonnée dans un contexte</caption>
     * if (storage.context.length > 0) { console.log(`Espace : ${storage.context}`); }
     */
    static get context() {
        return NStorage.#context;
    }

    /**
     * Modifie le contexte applicatif de l'instance en cours d'exécution.
     * @param {string} val - Nouveau contexte (ou chaîne vide pour repasser en mode généralisé).
     *
     * @example <caption>Exemple 1 : Définir un contexte après instanciation</caption>
     * NStorage.context = 'admin';
     *
     * @example <caption>Exemple 2 : Réinitialiser au mode généralisé</caption>
     * NStorage.context = '';
     */
    static set context(val) {
        NStorage.#context = typeof val === 'string' ? val.trim() : '';
    }

    /**
     * Retourne le nombre d'éléments actuellement stockés pour cette instance (tenant compte du préfixe et du contexte).
     * @type {number}
     *
     * @example <caption>Exemple 1 : Consulter le nombre d'éléments dans le contexte courant</caption>
     * console.log(`Éléments stockés : ${storage.length}`);
     *
     * @example <caption>Exemple 2 : Vérifier si le stockage est vide</caption>
     * if (storage.length === 0) { console.log('Stockage vide'); }
     */
    static get length() {
        NStorage.#ensureDriver();
        return NStorage.keys().length;
    }

    // =========================================================================
    // Dérivation et Gestion de Contexte
    // =========================================================================

    /**
     * Crée et retourne une nouvelle instance de `NStorage` partageant la même configuration
     * mais isolée dans le contexte applicatif spécifié.
     *
     * @method withContext
     * @param {string} context - Nom du contexte applicatif (ex: 'admin', 'app', 'site' ou chaîne vide pour généralisé).
     * @returns {NStorage} Nouvelle instance clonée et cloisonnée dans le contexte.
     *
     * @example <caption>Exemple 1 : Dériver un stockage dédié à l'espace administration</caption>
     * NStorage.configure({ prefix: 'my_pos:' });
     * const adminStore = storage.withContext('admin');
     * adminStore.set('session_id', 'adm_123');
     * console.log(adminStore.getString('session_id')); // 'adm_123'
     *
     * @example <caption>Exemple 2 : Dériver plusieurs contextes pour un même domaine</caption>
     * const appStore = storage.withContext('app');
     * const siteStore = storage.withContext('site');
     * appStore.set('lang', 'fr');
     * siteStore.set('lang', 'en');
     * console.log(appStore.getString('lang')); // 'fr'
     * console.log(siteStore.getString('lang')); // 'en'
     */
        static withContext(context) {
        const ctx = typeof context === 'string' ? context.trim() : '';
        return {
            get context() { return ctx; },
            set: (key, value, optionsOrTtl) => {
                const opts = typeof optionsOrTtl === 'number'
                    ? { ttl: optionsOrTtl, context: ctx }
                    : { ...(optionsOrTtl && typeof optionsOrTtl === 'object' ? optionsOrTtl : {}), context: ctx };
                return NStorage.set(key, value, opts);
            },
            get: (key, defaultValue = null, options = {}) => NStorage.get(key, defaultValue, { ...options, context: ctx }),
            getString: (key, defaultValue = '', options = {}) => NStorage.getString(key, defaultValue, { ...options, context: ctx }),
            getNumber: (key, defaultValue = 0, options = {}) => NStorage.getNumber(key, defaultValue, { ...options, context: ctx }),
            getBoolean: (key, defaultValue = false, options = {}) => NStorage.getBoolean(key, defaultValue, { ...options, context: ctx }),
            getJson: (key, defaultValue = {}, options = {}) => NStorage.getJson(key, defaultValue, { ...options, context: ctx }),
            getArray: (key, defaultValue = [], options = {}) => NStorage.getArray(key, defaultValue, { ...options, context: ctx }),
            has: (key, options = {}) => NStorage.has(key, { ...options, context: ctx }),
            remove: (key, options = {}) => NStorage.remove(key, { ...options, context: ctx }),
            clear: () => NStorage.clear({ context: ctx }),
            keys: () => NStorage.keys({ context: ctx }),
            toObject: () => NStorage.toObject({ context: ctx })
        };
    }

    // =========================================================================
    // Opérations Clé-Valeur Fondamentales
    // =========================================================================

    /**
     * Enregistre une valeur associée à une clé.
     * Prend en charge le contexte applicatif et la durée de vie (`ttl`).
     *
     * @method set
     * @param {string} key - Clé de stockage (chaîne non vide).
     * @param {any} value - Valeur à enregistrer.
     * @param {number|NStorageOptions} [optionsOrTtl] - TTL en secondes ou objet d'options complet.
     * @returns {boolean} `true` si l'enregistrement a réussi, `false` sinon.
     *
     * @example <caption>Exemple 1 : Enregistrer une clé standard avec TTL</caption>
     * NStorage.set('session', { token: 'abc' }, 3600);
     *
     * @example <caption>Exemple 2 : Enregistrer avec contexte ponctuel</caption>
     * NStorage.set('api_key', 'sec_123', { context: 'admin', ttl: 600 });
     */
    static set(key, value, optionsOrTtl) {
        NStorage.#ensureDriver();
        if (!NStorage.#adapter) {
            NLog.warn('NStorage.set : Aucun adaptateur de stockage disponible (localStorage/sessionStorage inaccessible ou désactivé).', {
                code: 'WARN_STORAGE_NOT_AVAILABLE',
                key
            });
            return false;
        }

        if (key === null || key === undefined) {
            NLog.warn('NStorage.set : Clé de stockage absente ou nulle.', {
                code: 'WARN_STORAGE_INVALID_KEY',
                key
            });
            return false;
        }

        const keyStr = String(key).trim();
        if (keyStr.length === 0) {
            NLog.warn('NStorage.set : Clé de stockage vide.', {
                code: 'WARN_STORAGE_EMPTY_KEY'
            });
            return false;
        }

        const options = typeof optionsOrTtl === 'object' && optionsOrTtl !== null
            ? optionsOrTtl
            : { ttl: typeof optionsOrTtl === 'number' ? optionsOrTtl : 0 };

        const effectiveTtl = typeof options.ttl === 'number' && Number.isFinite(options.ttl) && options.ttl > 0
            ? Math.floor(options.ttl)
            : NStorage.#defaultTtl;

        const payload = {
            v: value,
            e: effectiveTtl > 0 ? Date.now() + (effectiveTtl * 1000) : 0
        };

        let serialized = '';
        try {
            serialized = JSON.stringify(payload, NStorage.#jsonReplacer);
        } catch (err) {
            NLog.error('NStorage.set : Échec de sérialisation JSON de la valeur.', {
                code: 'ERR_STORAGE_SERIALIZATION_FAILED',
                key: keyStr,
                error: err,
                stack: err?.stack
            });
            return false;
        }

        const ctxPrefix = NStorage.#resolveContextPrefix(options.context);
        const contextualKey = ctxPrefix ? `${ctxPrefix}${keyStr}` : keyStr;
        const fullKey = NStorage.#prefix ? `${NStorage.#prefix}${contextualKey}` : contextualKey;

        try {
            NStorage.#adapter.setItem(fullKey, serialized);
            return true;
        } catch (err) {
            NLog.error('NStorage.set : Échec d\'écriture dans le stockage (quota dépassé ou accès bloqué).', {
                code: 'ERR_STORAGE_WRITE_FAILED',
                driver: NStorage.#driver,
                key: keyStr,
                error: err,
                stack: err?.stack
            });
            return false;
        }
    }

    /**
     * Récupère la valeur désérialisée associée à une clé.
     * Si la clé est expirée, inexistante ou corrompue, retourne `defaultValue`.
     *
     * @method get
     * @param {string} key - Clé recherchée.
     * @param {any} [defaultValue=null] - Valeur par défaut retournée si introuvable ou expirée.
     * @param {NStorageOptions} [options={}] - Options de contexte spécifiques.
     * @returns {any} Valeur désérialisée ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Récupérer une valeur standard</caption>
     * const user = storage.get('user', { role: 'guest' });
     * console.log(user?.role);
     *
     * @example <caption>Exemple 2 : Récupérer dans un contexte précis</caption>
     * const token = storage.get('token', null, { context: 'admin' });
     */
    static get(key, defaultValue = null, options = {}) {
        if (!NStorage.#adapter) return defaultValue;
        if (key === null || key === undefined) return defaultValue;

        const keyStr = String(key).trim();
        if (keyStr.length === 0) return defaultValue;

        const opts = typeof options === 'object' && options !== null ? options : {};
        const ctxPrefix = NStorage.#resolveContextPrefix(opts.context);
        const contextualKey = ctxPrefix ? `${ctxPrefix}${keyStr}` : keyStr;
        const fullKey = NStorage.#prefix ? `${NStorage.#prefix}${contextualKey}` : contextualKey;

        const raw = NStorage.#readRawFromAdapter(fullKey);

        if (raw === null || raw === undefined) {
            return defaultValue;
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && 'v' in parsed && 'e' in parsed) {
                // Vérification de la date d'expiration (TTL)
                if (typeof parsed.e === 'number' && parsed.e > 0 && Date.now() > parsed.e) {
                    NStorage.remove(keyStr, opts);
                    return defaultValue;
                }

                return parsed.v !== undefined ? parsed.v : defaultValue;
            }

            return parsed !== undefined ? parsed : defaultValue;
        } catch {
            return raw;
        }
    }

    /**
     * Récupère une valeur sous forme de chaîne de caractères (`string`).
     *
     * @method getString
     * @param {string} key - Clé recherchée.
     * @param {string} [defaultValue=''] - Valeur par défaut.
     * @param {NStorageOptions} [options={}] - Options complémentaires.
     * @returns {string} Valeur convertie en chaîne ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Obtenir un jeton de session</caption>
     * const token = storage.getString('token', '');
     * console.log(token);
     *
     * @example <caption>Exemple 2 : Avec contexte applicatif ciblé</caption>
     * const adminKey = storage.getString('apiKey', '', { context: 'admin' });
     */
    static getString(key, defaultValue = '', options = {}) {
        const val = NStorage.get(key, defaultValue, options);
        return val !== null && val !== undefined ? String(val) : defaultValue;
    }

    /**
     * Récupère une valeur sous forme de nombre (`number`).
     *
     * @method getNumber
     * @param {string} key - Clé recherchée.
     * @param {number} [defaultValue=0] - Valeur par défaut.
     * @param {NStorageOptions} [options={}] - Options complémentaires.
     * @returns {number} Valeur convertie en nombre ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Obtenir un compteur numérique</caption>
     * const visits = storage.getNumber('visits', 0);
     * console.log('Visites :', visits);
     *
     * @example <caption>Exemple 2 : Compteur avec contexte</caption>
     * const adminVisits = storage.getNumber('visits', 0, { context: 'admin' });
     */
    static getNumber(key, defaultValue = 0, options = {}) {
        const val = NStorage.get(key, defaultValue, options);
        const parsed = Number(val);
        return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : defaultValue;
    }

    /**
     * Récupère une valeur sous forme de booléen (`boolean`).
     *
     * @method getBoolean
     * @param {string} key - Clé recherchée.
     * @param {boolean} [defaultValue=false] - Valeur par défaut.
     * @param {NStorageOptions} [options={}] - Options complémentaires.
     * @returns {boolean} Valeur évaluée en booléen.
     *
     * @example <caption>Exemple 1 : Obtenir un paramètre actif</caption>
     * const isDarkMode = storage.getBoolean('darkMode', false);
     * console.log('Mode sombre :', isDarkMode);
     *
     * @example <caption>Exemple 2 : Évaluation booléenne dans un contexte</caption>
     * const isAdminActive = storage.getBoolean('isActive', true, { context: 'admin' });
     */
    static getBoolean(key, defaultValue = false, options = {}) {
        const val = NStorage.get(key, defaultValue, options);
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
     * @param {Object} [defaultValue={}] - Objet par défaut si absent ou invalide.
     * @param {NStorageOptions} [options={}] - Options complémentaires.
     * @returns {Object} Objet désérialisé ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Obtenir un profil utilisateur</caption>
     * const profile = storage.getJson('profile', {});
     * console.log(profile);
     *
     * @example <caption>Exemple 2 : Paramètres par contexte</caption>
     * const siteConfig = storage.getJson('config', {}, { context: 'site' });
     */
    static getJson(key, defaultValue = {}, options = {}) {
        const val = NStorage.get(key, defaultValue, options);
        return val && typeof val === 'object' && !Array.isArray(val) ? val : defaultValue;
    }

    /**
     * Récupère une valeur sous forme de tableau (`Array`).
     *
     * @method getArray
     * @param {string} key - Clé recherchée.
     * @param {Array} [defaultValue=[]] - Tableau par défaut si absent ou invalide.
     * @param {NStorageOptions} [options={}] - Options complémentaires.
     * @returns {Array} Tableau désérialisé ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Obtenir la liste des identifiants favoris</caption>
     * const favorites = storage.getArray('fav_ids', []);
     * console.log('Favoris :', favorites.length);
     *
     * @example <caption>Exemple 2 : Tableau par contexte</caption>
     * const adminRoles = storage.getArray('roles', [], { context: 'admin' });
     */
    static getArray(key, defaultValue = [], options = {}) {
        const val = NStorage.get(key, defaultValue, options);
        return Array.isArray(val) ? val : defaultValue;
    }

    /**
     * Vérifie si une clé existe dans le stockage et n'est pas expirée (gère les contextes).
     *
     * @method has
     * @param {string} key - Clé à tester.
     * @param {NStorageOptions} [options={}] - Options complémentaires.
     * @returns {boolean} `true` si la clé existe et est valide.
     *
     * @example <caption>Exemple 1 : Tester la présence d'une clé</caption>
     * if (storage.has('session_id')) { console.log('Session active'); }
     *
     * @example <caption>Exemple 2 : Vérification d'une clé dans un contexte</caption>
     * if (storage.has('token', { context: 'admin' })) { console.log('Admin connecté'); }
     */
    static has(key, options = {}) {
        NStorage.#ensureDriver();
        if (!NStorage.#adapter) return false;
        if (key === null || key === undefined) return false;

        const keyStr = String(key).trim();
        if (keyStr.length === 0) return false;

        const opts = typeof options === 'object' && options !== null ? options : {};
        const ctxPrefix = NStorage.#resolveContextPrefix(opts.context);
        const contextualKey = ctxPrefix ? `${ctxPrefix}${keyStr}` : keyStr;
        const fullKey = NStorage.#prefix ? `${NStorage.#prefix}${contextualKey}` : contextualKey;

        const raw = NStorage.#readRawFromAdapter(fullKey);

        if (raw === null || raw === undefined) {
            return false;
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && 'e' in parsed) {
                if (typeof parsed.e === 'number' && parsed.e > 0 && Date.now() > parsed.e) {
                    NStorage.remove(keyStr, opts);
                    return false;
                }
            }
            return true;
        } catch {
            return true;
        }
    }

    /**
     * Supprime un élément par sa clé.
     *
     * @method remove
     * @param {string} key - Clé à supprimer.
     * @param {NStorageOptions} [options={}] - Options complémentaires.
     * @returns {boolean} `true` si la suppression s'est déroulée sans erreur, `false` sinon.
     *
     * @example <caption>Exemple 1 : Supprimer une clé standard</caption>
     * const ok = storage.remove('authToken');
     * console.log('Supprimé :', ok);
     *
     * @example <caption>Exemple 2 : Nettoyage d'une clé dans un contexte</caption>
     * NStorage.remove('session', { context: 'admin' });
     */
    static remove(key, options = {}) {
        NStorage.#ensureDriver();
        if (!NStorage.#adapter) return false;
        if (key === null || key === undefined) return false;

        const keyStr = String(key).trim();
        if (keyStr.length === 0) return false;

        const opts = typeof options === 'object' && options !== null ? options : {};
        const ctxPrefix = NStorage.#resolveContextPrefix(opts.context);
        const contextualKey = ctxPrefix ? `${ctxPrefix}${keyStr}` : keyStr;
        const fullKey = NStorage.#prefix ? `${NStorage.#prefix}${contextualKey}` : contextualKey;

        try {
            NStorage.#adapter.removeItem(fullKey);
            return true;
        } catch (err) {
            NLog.error('NStorage.remove : Erreur lors de la suppression de la clé.', {
                code: 'ERR_STORAGE_REMOVE_FAILED',
                key: keyStr,
                error: err,
                stack: err?.stack
            });
            return false;
        }
    }

    /**
     * Supprime tous les éléments gérés par cette instance.
     * Si l'instance a un contexte défini, ne supprime QUE les éléments de ce contexte (laissant les autres intacts).
     *
     * @method clear
     * @returns {boolean} `true` si tous les éléments ont été supprimés avec succès.
     *
     * @example <caption>Exemple 1 : Vider tout le stockage d'un contexte 'admin'</caption>
     * const adminStore = storage.withContext('admin');
     * adminStore.clear(); // Supprime uniquement les clés débutant par 'admin:'
     *
     * @example <caption>Exemple 2 : Vidage complet généralisé</caption>
          * NStorage.clear();
     */
    static clear(options = {}) {
        NStorage.#ensureDriver();
        if (!NStorage.#adapter) return false;
        const ctx = typeof options?.context === 'string' ? options.context.trim() : NStorage.#context;

        try {
            // Si pas de préfixe ET pas de contexte, effacement global direct
            if (!NStorage.#prefix && !ctx && typeof NStorage.#adapter.clear === 'function') {
                NStorage.#adapter.clear();
                return true;
            }

            // Sinon, suppression ciblée des clés appartenant au préfixe/contexte
            const allKeys = NStorage.keys(options);
            let allSuccess = true;
            for (const k of allKeys) {
                const removed = NStorage.remove(k, options);
                if (!removed) {
                    allSuccess = false;
                }
            }
            return allSuccess;
        } catch (err) {
            NLog.error('NStorage.clear : Échec du vidage du stockage.', {
                code: 'ERR_STORAGE_CLEAR_FAILED',
                prefix: NStorage.#prefix,
                context: NStorage.#context,
                driver: NStorage.#driver,
                error: err,
                stack: err?.stack
            });
            return false;
        }
    }

    /**
     * Retourne la liste de toutes les clés enregistrées pour cette instance.
     * Si un contexte est configuré, ne retourne que les clés de ce contexte (sans le préfixe ni le contexte).
     *
     * @method keys
     * @returns {string[]} Liste des noms de clés.
     *
     * @example <caption>Exemple 1 : Lister les clés de l'espace 'admin'</caption>
     * const adminStore = storage.withContext('admin');
     * console.log(adminStore.keys()); // ['theme', 'token']
     *
     * @example <caption>Exemple 2 : Lister toutes les clés en mode généralisé</caption>
     * console.log(storage.keys());
     */
    static keys(options = {}) {
        NStorage.#ensureDriver();
        if (!NStorage.#adapter) return [];

        const result = [];
        const ctxPrefix = NStorage.#resolveContextPrefix(options?.context);

        try {
            const rawKeysList = [];
            const count = typeof NStorage.#adapter.length === 'number' ? NStorage.#adapter.length : 0;
            for (let i = 0; i < count; i++) {
                const fullKey = NStorage.#adapter.key(i);
                if (fullKey) {
                    rawKeysList.push(fullKey);
                }
            }

            for (const fullKey of rawKeysList) {
                if (!NStorage.#prefix || fullKey.startsWith(NStorage.#prefix)) {
                    const plainContextualKey = NStorage.#prefix ? fullKey.slice(NStorage.#prefix.length) : fullKey;

                    // Si un contexte est configuré sur l'instance, filtrer strictement sur ce contexte
                    if (ctxPrefix) {
                        if (plainContextualKey.startsWith(ctxPrefix)) {
                            const finalKey = plainContextualKey.slice(ctxPrefix.length);
                            if (!result.includes(finalKey)) {
                                result.push(finalKey);
                            }
                        }
                    } else {
                        // Mode généralisé : retourne toutes les clés de l'espace
                        if (!result.includes(plainContextualKey)) {
                            result.push(plainContextualKey);
                        }
                    }
                }
            }
        } catch (err) {
            NLog.error('NStorage.keys : Erreur lors de l\'énumération des clés.', {
                code: 'ERR_STORAGE_KEYS_FAILED',
                driver: NStorage.#driver,
                prefix: NStorage.#prefix,
                context: NStorage.#context,
                error: err,
                stack: err?.stack
            });
            return [];
        }
        return result;
    }

    /**
     * Exporte l'intégralité du stockage de l'instance sous forme d'un objet clé/valeur standard en clair.
     *
     * @method toObject
     * @returns {Object<string, any>} Copie clé/valeur de toutes les entrées actives du contexte.
     *
     * @example <caption>Exemple 1 : Sérialiser le contexte pour export</caption>
     * const backup = adminStore.toObject();
     * console.log(JSON.stringify(backup));
     *
     * @example <caption>Exemple 2 : Inspecter le contenu complet</caption>
     * console.log(storage.toObject());
     */
    static toObject() {
        const obj = {};
        const activeKeys = NStorage.keys();
        for (const k of activeKeys) {
            const val = NStorage.get(k);
            if (val !== undefined && val !== null) {
                obj[k] = val;
            }
        }
        return obj;
    }

    // =========================================================================
    // Méthodes Internes Privées (Lecture Adaptateur, Contextes et Pilotes)
    // =========================================================================

    /**
     * Lit la valeur brute dans l'adaptateur et retourne `null` en cas d'erreur.
     * @private
     * @param {string} fullKey - Clé complète avec préfixe.
     * @returns {string|null}
     */
    static #readRawFromAdapter(fullKey) {
        NStorage.#ensureDriver();
        if (!NStorage.#adapter) return null;
        try {
            return NStorage.#adapter.getItem(fullKey);
        } catch {
            return null;
        }
    }

    // =========================================================================
    // Méthodes Internes Privées (Gestion des Contextes et Résolution des Pilotes)
    // =========================================================================

    /**
     * Résout le préfixe de contexte applicable (avec séparateur deux-points ':').
     * Si aucun contexte n'est configuré ou si un contexte vide est fourni, retourne une chaîne vide (mode généralisé).
     *
     * @private
     * @param {string} [customContext] - Surcharge ponctuelle du contexte.
     * @returns {string} Préfixe de contexte formaté (ex: 'admin:' ou '').
     */
    static #resolveContextPrefix(customContext) {
        let ctx = NStorage.#context;
        if (customContext !== undefined && customContext !== null) {
            ctx = typeof customContext === 'string' ? customContext.trim() : '';
        }
        if (!ctx) return '';
        return ctx.endsWith(':') ? ctx : `${ctx}:`;
    }

    /**
     * Initialise le pilote parmi `localStorage` et `sessionStorage` selon la demande et la disponibilité.
     *
     * @private
     * @param {'auto'|'localStorage'|'sessionStorage'} requestedDriver - Pilote demandé.
     */
    static #initDriver(requestedDriver) {
        const scope = NStorage.#getGlobalScope();
        const req = typeof requestedDriver === 'string' ? requestedDriver.toLowerCase().trim() : 'auto';

        if (req === 'sessionstorage') {
            if (NStorage.#isStorageAvailable('sessionStorage')) {
                NStorage.#driver = 'sessionStorage';
                NStorage.#adapter = scope.sessionStorage;
                return;
            }
            if (NStorage.#isStorageAvailable('localStorage')) {
                NStorage.#driver = 'localStorage';
                NStorage.#adapter = scope.localStorage;
                return;
            }
            NStorage.#driver = null;
            NStorage.#adapter = null;
            return;
        }

        if (req === 'localstorage') {
            if (NStorage.#isStorageAvailable('localStorage')) {
                NStorage.#driver = 'localStorage';
                NStorage.#adapter = scope.localStorage;
                return;
            }
            if (NStorage.#isStorageAvailable('sessionStorage')) {
                NStorage.#driver = 'sessionStorage';
                NStorage.#adapter = scope.sessionStorage;
                return;
            }
            NStorage.#driver = null;
            NStorage.#adapter = null;
            return;
        }

        // Mode 'auto' : priorité à localStorage, repli sur sessionStorage
        if (NStorage.#isStorageAvailable('localStorage')) {
            NStorage.#driver = 'localStorage';
            NStorage.#adapter = scope.localStorage;
        } else if (NStorage.#isStorageAvailable('sessionStorage')) {
            NStorage.#driver = 'sessionStorage';
            NStorage.#adapter = scope.sessionStorage;
        } else {
            NStorage.#driver = null;
            NStorage.#adapter = null;
        }
    }

    /**
     * Teste réellement si un storage navigateur est accessible en lecture ET écriture.
     * Protège contre les exceptions SecurityError (mode navigation privée strict, iframe sans allow-same-origin).
     *
     * @private
     * @param {'localStorage'|'sessionStorage'} type - Type de stockage à tester.
     * @returns {boolean} `true` si le stockage est pleinement fonctionnel.
     */
    static #isStorageAvailable(type) {
        try {
            const scope = NStorage.#getGlobalScope();
            if (!scope || !scope[type]) {
                return false;
            }
            const storage = scope[type];
            const testKey = `__nlib_test_${type}_${Date.now()}__`;
            storage.setItem(testKey, '1');
            const ok = storage.getItem(testKey) === '1';
            storage.removeItem(testKey);
            return ok;
        } catch {
            return false;
        }
    }

    /**
     * Retourne la portée globale sécurisée de l'environnement courant.
     *
     * @private
     * @returns {any} Contexte global (globalThis, window, self ou objet vide).
     */
    static #getGlobalScope() {
        if (typeof globalThis !== 'undefined') return globalThis;
        if (typeof window !== 'undefined') return window;
        if (typeof self !== 'undefined') return self;
        return {};
    }

    /**
     * Replacer JSON sécurisé pour gérer les types non standards (BigInt, etc.).
     *
     * @private
     * @param {string} _key - Nom de la propriété.
     * @param {any} value - Valeur à sérialiser.
     * @returns {any} Valeur adaptée pour JSON.
     */
    static #jsonReplacer(_key, value) {
        if (typeof value === 'bigint') {
            return Number(value);
        }
        return value;
    }

    /**
     * Libère les références internes de pilote et d'état de l'instance.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire l'instance NStorage</caption>
     * NStorage.configure({ prefix: 'tmp:' });
     * NStorage.destroy();
     * console.log(storage.isDestroyed); // true
     *
     * @example <caption>Exemple 2 : Vérifier la disponibilité après destruction</caption>
     * NStorage.destroy();
     * console.log(storage.isAvailable); // false
     */
    static destroy() {
        NStorage.#adapter = null;
        NStorage.#driver = null;
        NStorage.#prefix = '';
        NStorage.#context = '';
        NStorage.#defaultTtl = 0;
        NStorage.#initialized = false;
    }
}

NObject.registerStorage(NStorage);

export default NStorage;
