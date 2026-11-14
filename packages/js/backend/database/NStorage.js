/**
 * @file NStorage.js
 * @package @nlib/js-backend
 * @description Gestionnaire universel et résilient de stockage clé-valeur pour NLib.
 * Prend en charge les moteurs de stockage navigateur avec sélection et repli automatique :
 * 1. `localStorage` (persistance locale navigateur)
 * 2. `sessionStorage` (persistance de session d'onglet)
 *
 * Fonctionnalités de contexte et d'isolation multi-espaces :
 * - Prise en charge native d'un contexte applicatif (`context`, ex: 'app', 'admin', 'site', 'pos', etc.).
 * - Même sur un domaine ou une origine unique, les données de chaque espace sont distinctes et préfixées par le contexte.
 * - En l'absence de contexte, le stockage fonctionne en mode généralisé standard.
 * - Méthode fluide `withContext(context)` pour dériver des instances isolées tout en partageant les réglages techniques.
 *
 * Fonctionnalités de sécurité et cryptage intégrées :
 * - Cryptage optionnel configurable par instance ou par opération :
 *   1. Clé et donnée (`encryptKey: true, encryptData: true`)
 *   2. Clé seule (`encryptKey: true, encryptData: false`)
 *   3. Donnée seule (`encryptData: true, encryptKey: false`)
 *   4. Aucun cryptage (`encryptKey: false, encryptData: false` - comportement standard)
 * - Moteur cryptographique synchrone performant et autonome (SHA-256 + Stream Cipher 256 bits + IV aléatoire/déterministe).
 * - Clés chiffrées déterministes et réversibles : navigation directe par `get()` en O(1) et restitution en clair via `keys()`.
 *
 * Principes architecturaux et fiabilisation :
 * - Zero Throw / Zero Reject : aucune exception n'est propagée, toutes les erreurs sont journalisées via `NUtil.log`.
 * - Sérialisation sécurisée : gestion des erreurs de conversion JSON (références circulaires, BigInt, etc.).
 * - Isolation par espace de nommage : gestion robuste des préfixes (`prefix`) et des contextes (`context`) sans collision.
 * - Gestion du cycle de vie des données : prise en charge du TTL (expiration en secondes) avec purge automatique.
 * - Typage strict à la lecture : `get()`, `getString()`, `getNumber()`, `getBoolean()`, `getJson()`, `getArray()`.
 */

import { NUtil } from '../utils/NUtil.js';

/**
 * Options de chiffrement, de contexte et de contrôle pour les opérations NStorage.
 * @typedef {Object} NStorageOptions
 * @property {number} [ttl=0] - Durée de validité en secondes (0 = infini).
 * @property {string} [context=''] - Contexte applicatif ciblé pour l'opération (ex: 'app', 'admin', 'site').
 * @property {boolean} [encryptKey=false] - Indique si la clé doit être chiffrée.
 * @property {boolean} [encryptData=false] - Indique si la valeur/donnée doit être chiffrée.
 * @property {string} [secretKey=''] - Clé secrète personnalisée pour le chiffrement.
 */

/**
 * @class NStorage
 * @description Gestionnaire universel et résilient de stockage clé/valeur pour NLib avec contextes et chiffrement optionnel.
 *
 * @example <caption>Exemple 1 : Utilisation standard avec typage automatique et objets</caption>
 * const storage = new NStorage();
 * storage.set('user', { id: 1, name: 'Alice', role: 'admin' });
 * const user = storage.get('user');
 * console.log(user?.name); // 'Alice'
 *
 * @example <caption>Exemple 2 : Cloisonnement par contexte applicatif (app, admin, site) sur un même domaine</caption>
 * const adminStorage = new NStorage({ context: 'admin' });
 * const siteStorage = new NStorage({ context: 'site' });
 * adminStorage.set('theme', 'dark');  // Stocké sous 'admin:theme'
 * siteStorage.set('theme', 'light');  // Stocké sous 'site:theme'
 * console.log(adminStorage.getString('theme')); // 'dark'
 * console.log(siteStorage.getString('theme'));  // 'light'
 *
 * @example <caption>Exemple 3 : Dérivation fluide avec withContext et chiffrement intégral</caption>
 * const baseStore = new NStorage({ prefix: 'my_pos:', encryptKey: true, encryptData: true });
 * const appStore = baseStore.withContext('app');
 * appStore.set('jwt', 'token_sec_123');
 * console.log(appStore.getString('jwt')); // 'token_sec_123'
 */
export class NStorage {

    // =========================================================================
    // Propriétés d'instance privées
    // =========================================================================

    /**
     * Moteur de stockage effectif résolu ('localStorage', 'sessionStorage' ou null si indisponible).
     * @type {'localStorage'|'sessionStorage'|null}
     * @private
     */
    #driver = null;

    /**
     * Adaptateur sous-jacent (Storage navigateur native : localStorage ou sessionStorage).
     * @type {Storage|null}
     * @private
     */
    #adapter = null;

    /**
     * Préfixe technique optionnel appliqué à toutes les clés pour éviter les collisions globales.
     * @type {string}
     * @private
     */
    #prefix = '';

    /**
     * Contexte applicatif pour distinguer les données d'un même domaine (ex: 'app', 'admin', 'site').
     * @type {string}
     * @private
     */
    #context = '';

    /**
     * Durée de vie par défaut en secondes (0 = pas d'expiration).
     * @type {number}
     * @private
     */
    #defaultTtl = 0;

    /**
     * Indique si les clés doivent être chiffrées par défaut sur cette instance.
     * @type {boolean}
     * @private
     */
    #encryptKey = false;

    /**
     * Indique si les données doivent être chiffrées par défaut sur cette instance.
     * @type {boolean}
     * @private
     */
    #encryptData = false;

    /**
     * Clé secrète de chiffrement configurée pour l'instance.
     * @type {string}
     * @private
     */
    #secretKey = '';

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NStorage`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration du stockage.
     * @param {'auto'|'localStorage'|'sessionStorage'} [options.driver='auto'] - Pilote demandé.
     * @param {string} [options.prefix=''] - Préfixe technique global ajouté devant toutes les clés.
     * @param {string} [options.context=''] - Contexte applicatif (ex: 'app', 'admin', 'site').
     * @param {number} [options.ttl=0] - Durée de validité par défaut en secondes (0 = sans expiration).
     * @param {boolean} [options.encryptKey=false] - Active le chiffrement par défaut des clés.
     * @param {boolean} [options.encryptData=false] - Active le chiffrement par défaut des données.
     * @param {string} [options.secretKey=''] - Clé secrète personnalisée pour le chiffrement.
     *
     * @example <caption>Exemple 1 : Instanciation par défaut en détection automatique</caption>
     * const storage = new NStorage();
     * console.log(storage.driver);
     *
     * @example <caption>Exemple 2 : Stockage préfixé sécurisé avec contexte applicatif</caption>
     * const adminCache = new NStorage({
     *     prefix: 'my_pos:',
     *     context: 'admin',
     *     driver: 'localStorage',
     *     encryptKey: true,
     *     encryptData: true,
     *     secretKey: 'mon_mot_de_passe_secret'
     * });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};

        if (typeof opts.prefix === 'string') {
            this.#prefix = opts.prefix;
        }

        if (typeof opts.context === 'string' && opts.context.trim()) {
            this.#context = opts.context.trim();
        }

        if (typeof opts.ttl === 'number' && Number.isFinite(opts.ttl) && opts.ttl > 0) {
            this.#defaultTtl = Math.floor(opts.ttl);
        }

        if (typeof opts.encryptKey === 'boolean') {
            this.#encryptKey = opts.encryptKey;
        }

        if (typeof opts.encryptData === 'boolean') {
            this.#encryptData = opts.encryptData;
        }

        if (typeof opts.secretKey === 'string' && opts.secretKey.trim()) {
            this.#secretKey = opts.secretKey.trim();
        }

        this.#initDriver(opts.driver || 'auto');
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

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
    get driver() {
        return this.#driver;
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
    get isAvailable() {
        return this.#adapter !== null;
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
    get prefix() {
        return this.#prefix;
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
    get context() {
        return this.#context;
    }

    /**
     * Modifie le contexte applicatif de l'instance en cours d'exécution.
     * @param {string} val - Nouveau contexte (ou chaîne vide pour repasser en mode généralisé).
     *
     * @example <caption>Exemple 1 : Définir un contexte après instanciation</caption>
     * storage.context = 'admin';
     *
     * @example <caption>Exemple 2 : Réinitialiser au mode généralisé</caption>
     * storage.context = '';
     */
    set context(val) {
        this.#context = typeof val === 'string' ? val.trim() : '';
    }

    /**
     * Indique si le chiffrement des clés est activé par défaut sur cette instance.
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier le chiffrement des clés</caption>
     * console.log(storage.isKeyEncrypted); // true ou false
     *
     * @example <caption>Exemple 2 : Affichage d'état de sécurité</caption>
     * if (storage.isKeyEncrypted) { console.log('Clés obfusquées dans le navigateur'); }
     */
    get isKeyEncrypted() {
        return this.#encryptKey;
    }

    /**
     * Indique si le chiffrement des données est activé par défaut sur cette instance.
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier le chiffrement des données</caption>
     * console.log(storage.isDataEncrypted); // true ou false
     *
     * @example <caption>Exemple 2 : Contrôle avant écriture</caption>
     * if (!storage.isDataEncrypted) { console.log('Données stockées en clair'); }
     */
    get isDataEncrypted() {
        return this.#encryptData;
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
    get length() {
        return this.keys().length;
    }

    /**
     * Accès direct à la classe utilitaire transversale `NUtil`.
     * @type {typeof NUtil}
     *
     * @example <caption>Exemple 1 : Journaliser via storage.util.log</caption>
     * storage.util.log.info('Opération de stockage effectuée');
     *
     * @example <caption>Exemple 2 : Utiliser les utilitaires</caption>
     * console.log(storage.util.str.slug('Clé de test'));
     */
    get util() {
        return NUtil;
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
     * const storage = new NStorage({ prefix: 'my_pos:' });
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
    withContext(context) {
        return new NStorage({
            driver: this.#driver,
            prefix: this.#prefix,
            context: typeof context === 'string' ? context.trim() : '',
            ttl: this.#defaultTtl,
            encryptKey: this.#encryptKey,
            encryptData: this.#encryptData,
            secretKey: this.#secretKey
        });
    }

    // =========================================================================
    // Opérations Clé-Valeur Fondamentales
    // =========================================================================

    /**
     * Enregistre une valeur associée à une clé.
     * Prend en charge le contexte applicatif, ainsi que le chiffrement de clé (`encryptKey`) et de donnée (`encryptData`).
     *
     * @method set
     * @param {string} key - Clé de stockage (chaîne non vide).
     * @param {any} value - Valeur à enregistrer.
     * @param {number|NStorageOptions} [optionsOrTtl] - TTL en secondes ou objet d'options complet.
     * @returns {boolean} `true` si l'enregistrement a réussi, `false` sinon.
     *
     * @example <caption>Exemple 1 : Enregistrer une clé standard avec TTL</caption>
     * storage.set('session', { token: 'abc' }, 3600);
     *
     * @example <caption>Exemple 2 : Enregistrer avec contexte ponctuel et chiffrement de la donnée</caption>
     * storage.set('api_key', 'sec_123', { context: 'admin', encryptData: true });
     */
    set(key, value, optionsOrTtl) {
        if (!this.#adapter) {
            NUtil.log.warn('NStorage.set : Aucun adaptateur de stockage disponible (localStorage/sessionStorage inaccessible ou désactivé).', {
                code: 'WARN_STORAGE_NOT_AVAILABLE',
                key
            });
            return false;
        }

        if (key === null || key === undefined) {
            NUtil.log.warn('NStorage.set : Clé de stockage absente ou nulle.', {
                code: 'WARN_STORAGE_INVALID_KEY',
                key
            });
            return false;
        }

        const keyStr = String(key).trim();
        if (keyStr.length === 0) {
            NUtil.log.warn('NStorage.set : Clé de stockage vide.', {
                code: 'WARN_STORAGE_EMPTY_KEY'
            });
            return false;
        }

        const options = typeof optionsOrTtl === 'object' && optionsOrTtl !== null
            ? optionsOrTtl
            : { ttl: typeof optionsOrTtl === 'number' ? optionsOrTtl : 0 };

        const effectiveTtl = typeof options.ttl === 'number' && Number.isFinite(options.ttl) && options.ttl > 0
            ? Math.floor(options.ttl)
            : this.#defaultTtl;

        const shouldEncryptKey = options.encryptKey !== undefined
            ? Boolean(options.encryptKey)
            : this.#encryptKey;

        const shouldEncryptData = options.encryptData !== undefined
            ? Boolean(options.encryptData)
            : this.#encryptData;

        const secret = this.#getEffectiveSecretKey(options.secretKey);

        let storedValue = value;
        let isEncryptedPayload = false;

        if (shouldEncryptData) {
            try {
                storedValue = this.#encryptData(value, secret);
                isEncryptedPayload = true;
            } catch (err) {
                NUtil.log.error('NStorage.set : Échec du chiffrement de la donnée.', {
                    code: 'ERR_STORAGE_ENCRYPT_DATA_FAILED',
                    key: keyStr,
                    error: err,
                    stack: err?.stack
                });
                return false;
            }
        }

        const payload = {
            v: storedValue,
            e: effectiveTtl > 0 ? Date.now() + (effectiveTtl * 1000) : 0,
            ...(isEncryptedPayload ? { enc: true } : {})
        };

        let serialized = '';
        try {
            serialized = JSON.stringify(payload, this.#jsonReplacer);
        } catch (err) {
            NUtil.log.error('NStorage.set : Échec de sérialisation JSON de la valeur.', {
                code: 'ERR_STORAGE_SERIALIZATION_FAILED',
                key: keyStr,
                error: err,
                stack: err?.stack
            });
            return false;
        }

        const ctxPrefix = this.#resolveContextPrefix(options.context);
        const contextualKey = ctxPrefix ? `${ctxPrefix}${keyStr}` : keyStr;
        const storageKeyName = shouldEncryptKey ? this.#encryptKey(contextualKey, secret) : contextualKey;
        const fullKey = this.#prefix ? `${this.#prefix}${storageKeyName}` : storageKeyName;

        try {
            this.#adapter.setItem(fullKey, serialized);
            return true;
        } catch (err) {
            NUtil.log.error('NStorage.set : Échec d\'écriture dans le stockage (quota dépassé ou accès bloqué).', {
                code: 'ERR_STORAGE_WRITE_FAILED',
                driver: this.#driver,
                key: keyStr,
                error: err,
                stack: err?.stack
            });
            return false;
        }
    }

    /**
     * Récupère la valeur désérialisée associée à une clé, avec déchiffrement automatique si nécessaire.
     * Si la clé est expirée, inexistante ou corrompue, retourne `defaultValue`.
     *
     * @method get
     * @param {string} key - Clé recherchée.
     * @param {any} [defaultValue=null] - Valeur par défaut retournée si introuvable ou expirée.
     * @param {NStorageOptions} [options={}] - Options de contexte et de déchiffrement spécifiques.
     * @returns {any} Valeur désérialisée (et déchiffrée) ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Récupérer une valeur standard</caption>
     * const user = storage.get('user', { role: 'guest' });
     * console.log(user?.role);
     *
     * @example <caption>Exemple 2 : Récupérer dans un contexte précis avec clé chiffrée</caption>
     * const token = storage.get('token', null, { context: 'admin', encryptKey: true });
     */
    get(key, defaultValue = null, options = {}) {
        if (!this.#adapter) return defaultValue;
        if (key === null || key === undefined) return defaultValue;

        const keyStr = String(key).trim();
        if (keyStr.length === 0) return defaultValue;

        const opts = typeof options === 'object' && options !== null ? options : {};
        const shouldEncryptKey = opts.encryptKey !== undefined
            ? Boolean(opts.encryptKey)
            : this.#encryptKey;

        const secret = this.#getEffectiveSecretKey(opts.secretKey);
        const ctxPrefix = this.#resolveContextPrefix(opts.context);
        const contextualKey = ctxPrefix ? `${ctxPrefix}${keyStr}` : keyStr;

        // Recherche prioritaire selon le mode de clé configuré, avec repli automatique
        let raw = null;
        const primaryKeyName = shouldEncryptKey ? this.#encryptKey(contextualKey, secret) : contextualKey;
        const primaryFullKey = this.#prefix ? `${this.#prefix}${primaryKeyName}` : primaryKeyName;
        raw = this.#readRawFromAdapter(primaryFullKey);

        // Repli croisé : si introuvable, tester l'autre représentation (chiffrée ou en clair)
        if (raw === null || raw === undefined) {
            const alternateKeyName = shouldEncryptKey ? contextualKey : this.#encryptKey(contextualKey, secret);
            const alternateFullKey = this.#prefix ? `${this.#prefix}${alternateKeyName}` : alternateKeyName;
            raw = this.#readRawFromAdapter(alternateFullKey);
        }

        if (raw === null || raw === undefined) {
            return defaultValue;
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && 'v' in parsed && 'e' in parsed) {
                // Vérification de la date d'expiration (TTL)
                if (typeof parsed.e === 'number' && parsed.e > 0 && Date.now() > parsed.e) {
                    this.remove(keyStr, opts);
                    return defaultValue;
                }

                // Déchiffrement de la donnée si marquée chiffrée ou préfixée par encd:
                if (parsed.enc === true || (typeof parsed.v === 'string' && parsed.v.startsWith('encd:'))) {
                    const decrypted = this.#decryptData(parsed.v, secret);
                    return decrypted !== null && decrypted !== undefined ? decrypted : defaultValue;
                }

                return parsed.v !== undefined ? parsed.v : defaultValue;
            }

            // Donnée stockée brute hors enveloppe
            if (typeof raw === 'string' && raw.startsWith('encd:')) {
                const decrypted = this.#decryptData(raw, secret);
                return decrypted !== null && decrypted !== undefined ? decrypted : defaultValue;
            }

            return parsed !== undefined ? parsed : defaultValue;
        } catch {
            // Repli sur la valeur brute non JSON si stockée sans enveloppe
            if (typeof raw === 'string' && raw.startsWith('encd:')) {
                const decrypted = this.#decryptData(raw, secret);
                return decrypted !== null && decrypted !== undefined ? decrypted : defaultValue;
            }
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
    getString(key, defaultValue = '', options = {}) {
        const val = this.get(key, defaultValue, options);
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
    getNumber(key, defaultValue = 0, options = {}) {
        const val = this.get(key, defaultValue, options);
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
    getBoolean(key, defaultValue = false, options = {}) {
        const val = this.get(key, defaultValue, options);
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
    getJson(key, defaultValue = {}, options = {}) {
        const val = this.get(key, defaultValue, options);
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
    getArray(key, defaultValue = [], options = {}) {
        const val = this.get(key, defaultValue, options);
        return Array.isArray(val) ? val : defaultValue;
    }

    /**
     * Vérifie si une clé existe dans le stockage et n'est pas expirée (gère les contextes et les clés chiffrées).
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
    has(key, options = {}) {
        if (!this.#adapter) return false;
        if (key === null || key === undefined) return false;

        const keyStr = String(key).trim();
        if (keyStr.length === 0) return false;

        const opts = typeof options === 'object' && options !== null ? options : {};
        const shouldEncryptKey = opts.encryptKey !== undefined
            ? Boolean(opts.encryptKey)
            : this.#encryptKey;

        const secret = this.#getEffectiveSecretKey(opts.secretKey);
        const ctxPrefix = this.#resolveContextPrefix(opts.context);
        const contextualKey = ctxPrefix ? `${ctxPrefix}${keyStr}` : keyStr;

        const primaryKeyName = shouldEncryptKey ? this.#encryptKey(contextualKey, secret) : contextualKey;
        const primaryFullKey = this.#prefix ? `${this.#prefix}${primaryKeyName}` : primaryKeyName;

        let raw = this.#readRawFromAdapter(primaryFullKey);
        if (raw === null || raw === undefined) {
            const alternateKeyName = shouldEncryptKey ? contextualKey : this.#encryptKey(contextualKey, secret);
            const alternateFullKey = this.#prefix ? `${this.#prefix}${alternateKeyName}` : alternateKeyName;
            raw = this.#readRawFromAdapter(alternateFullKey);
        }

        if (raw === null || raw === undefined) {
            return false;
        }

        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && 'e' in parsed) {
                if (typeof parsed.e === 'number' && parsed.e > 0 && Date.now() > parsed.e) {
                    this.remove(keyStr, opts);
                    return false;
                }
            }
            return true;
        } catch {
            return true;
        }
    }

    /**
     * Supprime un élément par sa clé (supprime aussi bien la forme chiffrée que la forme en clair).
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
     * storage.remove('session', { context: 'admin' });
     */
    remove(key, options = {}) {
        if (!this.#adapter) return false;
        if (key === null || key === undefined) return false;

        const keyStr = String(key).trim();
        if (keyStr.length === 0) return false;

        const opts = typeof options === 'object' && options !== null ? options : {};
        const secret = this.#getEffectiveSecretKey(opts.secretKey);
        const ctxPrefix = this.#resolveContextPrefix(opts.context);
        const contextualKey = ctxPrefix ? `${ctxPrefix}${keyStr}` : keyStr;

        const plainFullKey = this.#prefix ? `${this.#prefix}${contextualKey}` : contextualKey;
        const encKeyName = this.#encryptKey(contextualKey, secret);
        const encFullKey = this.#prefix ? `${this.#prefix}${encKeyName}` : encKeyName;

        try {
            this.#adapter.removeItem(plainFullKey);
            this.#adapter.removeItem(encFullKey);
            return true;
        } catch (err) {
            NUtil.log.error('NStorage.remove : Erreur lors de la suppression de la clé.', {
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
     * const genStore = new NStorage();
     * genStore.clear();
     */
    clear() {
        if (!this.#adapter) return false;

        try {
            // Si pas de préfixe ET pas de contexte, effacement global direct
            if (!this.#prefix && !this.#context && typeof this.#adapter.clear === 'function') {
                this.#adapter.clear();
                return true;
            }

            // Sinon, suppression ciblée des clés appartenant au préfixe/contexte
            const allKeys = this.keys();
            let allSuccess = true;
            for (const k of allKeys) {
                const removed = this.remove(k);
                if (!removed) {
                    allSuccess = false;
                }
            }
            return allSuccess;
        } catch (err) {
            NUtil.log.error('NStorage.clear : Échec du vidage du stockage.', {
                code: 'ERR_STORAGE_CLEAR_FAILED',
                prefix: this.#prefix,
                context: this.#context,
                driver: this.#driver,
                error: err,
                stack: err?.stack
            });
            return false;
        }
    }

    /**
     * Retourne la liste de toutes les clés enregistrées pour cette instance.
     * Si un contexte est configuré, ne retourne que les clés de ce contexte (sans le préfixe ni le contexte).
     * Les clés chiffrées sont automatiquement déchiffrées et restituées en clair.
     *
     * @method keys
     * @returns {string[]} Liste des noms de clés en clair.
     *
     * @example <caption>Exemple 1 : Lister les clés de l'espace 'admin'</caption>
     * const adminStore = storage.withContext('admin');
     * console.log(adminStore.keys()); // ['theme', 'token']
     *
     * @example <caption>Exemple 2 : Lister toutes les clés en mode généralisé</caption>
     * console.log(storage.keys());
     */
    keys() {
        if (!this.#adapter) return [];

        const result = [];
        const secret = this.#getEffectiveSecretKey();
        const ctxPrefix = this.#resolveContextPrefix();

        try {
            const rawKeysList = [];
            const count = typeof this.#adapter.length === 'number' ? this.#adapter.length : 0;
            for (let i = 0; i < count; i++) {
                const fullKey = this.#adapter.key(i);
                if (fullKey) {
                    rawKeysList.push(fullKey);
                }
            }

            for (const fullKey of rawKeysList) {
                if (!this.#prefix || fullKey.startsWith(this.#prefix)) {
                    const strippedPrefixKey = this.#prefix ? fullKey.slice(this.#prefix.length) : fullKey;
                    const plainContextualKey = this.#isEncryptedKey(strippedPrefixKey)
                        ? this.#decryptKey(strippedPrefixKey, secret)
                        : strippedPrefixKey;

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
            NUtil.log.error('NStorage.keys : Erreur lors de l\'énumération des clés.', {
                code: 'ERR_STORAGE_KEYS_FAILED',
                driver: this.#driver,
                prefix: this.#prefix,
                context: this.#context,
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
    toObject() {
        const obj = {};
        const activeKeys = this.keys();
        for (const k of activeKeys) {
            const val = this.get(k);
            if (val !== undefined && val !== null) {
                obj[k] = val;
            }
        }
        return obj;
    }

    // =========================================================================
    // Moteur Cryptographique Synchrone Privé (SHA-256 + Stream Cipher)
    // =========================================================================

    /**
     * Retourne la clé secrète effective (surcharge passée en paramètre ou clé d'instance ;
     * si vide, `NUtil.crypto` utilise automatiquement l'empreinte du navigateur courant).
     * @private
     * @param {string} [customSecret] - Clé secrète ponctuelle optionnelle.
     * @returns {string} Clé secrète résolue (ou `''` pour utiliser la clé du navigateur).
     */
    #getEffectiveSecretKey(customSecret) {
        if (typeof customSecret === 'string' && customSecret.trim()) {
            return customSecret.trim();
        }
        return this.#secretKey || '';
    }

    /**
     * Vérifie si une chaîne représente une clé chiffrée NStorage (`enck:...`).
     * @private
     * @param {string} key - Clé à tester.
     * @returns {boolean}
     */
    #isEncryptedKey(key) {
        return typeof key === 'string' && key.startsWith('enck:');
    }

    /**
     * Chiffre une clé de manière déterministe et réversible via `NUtil.crypto.encryptLocalSync`.
     * Permet la recherche directe en O(1) sans scanner l'espace de stockage.
     *
     * @private
     * @param {string} plainKey - Clé en clair.
     * @param {string} secretKey - Clé secrète (si vide, utilise l'empreinte du navigateur).
     * @returns {string} Clé chiffrée préfixée (`enck:...`).
     */
    #encryptKey(plainKey, secretKey) {
        if (this.#isEncryptedKey(plainKey)) {
            return plainKey;
        }
        const cipherB64 = NUtil.crypto.encryptLocalSync(String(plainKey), {
            secretKey,
            deterministic: true
        });
        return cipherB64 ? `enck:${cipherB64}` : String(plainKey);
    }

    /**
     * Déchiffre une clé chiffrée via `NUtil.crypto.decryptLocalSync` pour restituer son nom en clair.
     *
     * @private
     * @param {string} encryptedKey - Clé chiffrée (`enck:...`).
     * @param {string} secretKey - Clé secrète (si vide, utilise l'empreinte du navigateur).
     * @returns {string} Nom de clé en clair.
     */
    #decryptKey(encryptedKey, secretKey) {
        if (!this.#isEncryptedKey(encryptedKey)) {
            return encryptedKey;
        }
        const rawBase64 = encryptedKey.slice(5);
        const plain = NUtil.crypto.decryptLocalSync(rawBase64, secretKey);
        return plain || encryptedKey;
    }

    /**
     * Chiffre une valeur quelconque de manière synchrone via `NUtil.crypto.encryptLocalSync`.
     *
     * @private
     * @param {any} value - Valeur à protéger.
     * @param {string} secretKey - Clé secrète (si vide, utilise l'empreinte du navigateur).
     * @returns {string} Chaîne chiffrée Base64 préfixée (`encd:...`).
     */
    #encryptData(value, secretKey) {
        const jsonStr = JSON.stringify(value, this.#jsonReplacer);
        const cipherB64 = NUtil.crypto.encryptLocalSync(jsonStr, secretKey);
        return `encd:${cipherB64}`;
    }

    /**
     * Déchiffre une chaîne chiffrée `encd:...` via `NUtil.crypto.decryptLocalSync` et parse son JSON.
     *
     * @private
     * @param {string} encryptedString - Donnée chiffrée.
     * @param {string} secretKey - Clé secrète (si vide, utilise l'empreinte du navigateur).
     * @returns {any} Donnée originale déchiffrée et typée.
     */
    #decryptData(encryptedString, secretKey) {
        if (typeof encryptedString !== 'string' || !encryptedString.startsWith('encd:')) {
            return encryptedString;
        }
        try {
            const rawBase64 = encryptedString.slice(5);
            const jsonStr = NUtil.crypto.decryptLocalSync(rawBase64, secretKey);
            if (!jsonStr) {
                return null;
            }
            return JSON.parse(jsonStr);
        } catch (err) {
            NUtil.log.warn('NStorage : Échec du déchiffrement de la donnée.', {
                code: 'WARN_STORAGE_DECRYPT_FAILED',
                error: err
            });
            return null;
        }
    }

    /**
     * Lit la valeur brute dans l'adaptateur sans lever d'erreur.
     * @private
     * @param {string} fullKey - Clé complète avec préfixe.
     * @returns {string|null}
     */
    #readRawFromAdapter(fullKey) {
        if (!this.#adapter) return null;
        try {
            return this.#adapter.getItem(fullKey);
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
    #resolveContextPrefix(customContext) {
        let ctx = this.#context;
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
    #initDriver(requestedDriver) {
        const scope = this.#getGlobalScope();
        const req = typeof requestedDriver === 'string' ? requestedDriver.toLowerCase().trim() : 'auto';

        if (req === 'sessionstorage') {
            if (this.#isStorageAvailable('sessionStorage')) {
                this.#driver = 'sessionStorage';
                this.#adapter = scope.sessionStorage;
                return;
            }
            if (this.#isStorageAvailable('localStorage')) {
                this.#driver = 'localStorage';
                this.#adapter = scope.localStorage;
                return;
            }
            this.#driver = null;
            this.#adapter = null;
            return;
        }

        if (req === 'localstorage') {
            if (this.#isStorageAvailable('localStorage')) {
                this.#driver = 'localStorage';
                this.#adapter = scope.localStorage;
                return;
            }
            if (this.#isStorageAvailable('sessionStorage')) {
                this.#driver = 'sessionStorage';
                this.#adapter = scope.sessionStorage;
                return;
            }
            this.#driver = null;
            this.#adapter = null;
            return;
        }

        // Mode 'auto' : priorité à localStorage, repli sur sessionStorage
        if (this.#isStorageAvailable('localStorage')) {
            this.#driver = 'localStorage';
            this.#adapter = scope.localStorage;
        } else if (this.#isStorageAvailable('sessionStorage')) {
            this.#driver = 'sessionStorage';
            this.#adapter = scope.sessionStorage;
        } else {
            this.#driver = null;
            this.#adapter = null;
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
    #isStorageAvailable(type) {
        try {
            const scope = this.#getGlobalScope();
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
    #getGlobalScope() {
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
    #jsonReplacer(_key, value) {
        if (typeof value === 'bigint') {
            return Number(value);
        }
        return value;
    }
}

export default NStorage;
