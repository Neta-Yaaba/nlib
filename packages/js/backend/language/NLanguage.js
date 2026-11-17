/**
 * @file NLanguage.js
 * @package @nlib/js-backend
 * @description Moteur central d'internationalisation (i18n) de NLib, indépendant de l'environnement d'exécution.
 * Hérite de `NObject` et utilise l'allocation paresseuse pour ses dictionnaires, caches et collections internes.
 * Gère les dictionnaires multi-langues, la notation hiérarchique pointée, la langue de secours (fallback),
 * l'interpolation sécurisée de paramètres, la pluralisation CLDR via `Intl.PluralRules`,
 * le chargement différé via chargeur injectable, la détection des traductions manquantes et l'audit des dictionnaires.
 */

import { NObject } from '../core/NObject.js';

/**
 * @class NLanguage
 * @extends NObject
 * @description Moteur d'internationalisation (i18n) de NLib.
 *
 * @example <caption>Exemple 1 : Initialisation avec dictionnaires en mémoire et interpolation</caption>
 * const lang = new NLanguage();
 * await lang.init({
 *     language: 'fr',
 *     fallback: 'en',
 *     languages: {
 *         fr: { welcome: 'Bonjour {name}', save: 'Enregistrer' },
 *         en: { welcome: 'Hello {name}', save: 'Save' }
 *     }
 * });
 * console.log(lang.get('welcome', { name: 'Madi' })); // 'Bonjour Madi'
 *
 * @example <caption>Exemple 2 : Pluralisation avec Intl.PluralRules et notation pointée</caption>
 * lang.addLanguage('fr', {
 *     messages: { one: '{count} message', other: '{count} messages' },
 *     auth: { login: 'Connexion' }
 * }, { merge: true });
 * console.log(lang.plural('messages', { count: 3 })); // '3 messages'
 * console.log(lang.get('auth.login')); // 'Connexion'
 */
export class NLanguage extends NObject {

    // =========================================================================
    // Propriétés privées (allocation paresseuse)
    // =========================================================================

    /**
     * Configuration validée et figée du moteur.
     * @type {Object|null}
     * @private
     */
    #config = null;

    /**
     * Langue active normalisée (ex: `'fr'`, `'fr-FR'`).
     * @type {string}
     * @private
     */
    #currentLanguage = 'fr';

    /**
     * Langue de secours normalisée (ou `null`).
     * @type {string|null}
     * @private
     */
    #fallbackLanguage = 'en';

    /**
     * Langues connues (alloué paresseusement au premier enregistrement).
     * @type {Set<string>|null}
     * @private
     */
    #knownLanguages = null;

    /**
     * Dictionnaires structurés bruts indexés par code de langue normalisé (alloué paresseusement).
     * @type {Map<string, Object>|null}
     * @private
     */
    #dictionaries = null;

    /**
     * Index aplati (`Map<dottedKey, string>`) par langue pour une recherche O(1) (alloué paresseusement).
     * @type {Map<string, Map<string, string>>|null}
     * @private
     */
    #flatDictionaries = null;

    /**
     * Promesses de chargement en cours par code de langue (alloué paresseusement).
     * @type {Map<string, Promise<boolean>>|null}
     * @private
     */
    #loadingPromises = null;

    /**
     * Compteur de génération par langue pour invalider les chargements obsolètes (alloué paresseusement).
     * @type {Map<string, number>|null}
     * @private
     */
    #loadGenerations = null;

    /**
     * Compteur global de génération incrémenté lors de la destruction de l'instance.
     * @type {number}
     * @private
     */
    #instanceGeneration = 0;

    /**
     * Cache des instances `Intl.PluralRules` par code de langue (alloué paresseusement).
     * @type {Map<string, Intl.PluralRules|null>|null}
     * @private
     */
    #pluralRulesCache = null;

    /**
     * Collecte dédupliquée des expressions manquantes (allouée paresseusement).
     * @type {Map<string, Object>|null}
     * @private
     */
    #missingEntries = null;

    /**
     * Fonction de chargement asynchrone injectée (`(langCode) => Promise<Object|string>`).
     * @type {Function|null}
     * @private
     */
    #loader = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NLanguage`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration initiale.
     *
     * @example <caption>Exemple 1 : Instanciation simple suivie de init()</caption>
     * const language = new NLanguage();
     * await language.init({ language: 'fr', fallback: 'en' });
     *
     * @example <caption>Exemple 2 : Instanciation avec chargeur asynchrone</caption>
     * const language = new NLanguage({
     *     loader: async (code) => (await fetch(`/lang/${code}.json`)).json()
     * });
     */
    constructor(options = {}) {
        const opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
        super({ state: opts.state });

        const configInput = { ...opts };
        delete configInput.state;

        this.#config = this.#validateAndNormalizeConfig(configInput);
        this.#currentLanguage = this.#config.language;
        this.#fallbackLanguage = this.#config.fallback;
        this.#loader = this.#config.loader;

        if (opts.languages && typeof opts.languages === 'object') {
            for (const [code, dict] of Object.entries(opts.languages)) {
                this.addLanguage(code, dict);
            }
        }
    }

    // =========================================================================
    // Initialisation & Configuration
    // =========================================================================

    /**
     * Initialise le moteur avec la configuration fournie et charge la langue active
     * (et la langue de secours si un chargeur est configuré).
     *
     * @async
     * @param {Object} [options={}] - Options de configuration.
     * @param {string} [options.language='fr'] - Langue initiale (BCP 47).
     * @param {string|null} [options.fallback='en'] - Langue de secours (BCP 47 ou `null`).
     * @param {'key'|'empty'} [options.missingBehavior='key'] - Comportement si une clé est absente partout.
     * @param {boolean} [options.preserveUnknownParams=true] - Conserve `{param}` si le paramètre est absent.
     * @param {boolean} [options.logMissing=false] - Journalise les traductions manquantes via `this.util.log`.
     * @param {boolean} [options.logMissingParameters=false] - Journalise les paramètres manquants via `this.util.log`.
     * @param {string[]} [options.protectedLanguages=[]] - Codes de langues protégées contre la suppression.
     * @param {Function|null} [options.loader=null] - Chargeur asynchrone `(langCode) => Promise<Object|string>`.
     * @param {Object<string, Object>} [options.languages] - Dictionnaires initiaux `{ [code]: dict }`.
     * @returns {Promise<this>} L'instance courante initialisée.
     *
     * @example <caption>Exemple 1 : Initialisation standard avec dictionnaires</caption>
     * const language = new NLanguage();
     * await language.init({
     *     language: 'fr',
     *     fallback: 'en',
     *     languages: { fr: { save: 'Enregistrer' }, en: { save: 'Save' } }
     * });
     *
     * @example <caption>Exemple 2 : Initialisation avec chargeur différé</caption>
     * await language.init({
     *     language: 'fr',
     *     fallback: 'en',
     *     loader: async (code) => ({ hello: code === 'fr' ? 'Bonjour' : 'Hello' })
     * });
     */
    async init(options = {}) {
        const merged = {
            ...this.#config,
            ...(options && typeof options === 'object' ? options : {})
        };
        if (options && typeof options === 'object' && !('languages' in options)) {
            delete merged.languages;
        }
        delete merged.state;

        this.#config = this.#validateAndNormalizeConfig(merged);
        this.#currentLanguage = this.#config.language;
        this.#fallbackLanguage = this.#config.fallback;
        this.#loader = this.#config.loader;

        const known = this.#ensureKnownLanguages();
        known.add(this.#currentLanguage);
        if (this.#fallbackLanguage) {
            known.add(this.#fallbackLanguage);
        }

        if (options && typeof options === 'object' && options.languages && typeof options.languages === 'object') {
            for (const [code, dict] of Object.entries(options.languages)) {
                this.addLanguage(code, dict);
            }
        }

        if (this.#loader) {
            if (!this.#flatDictionaries?.has(this.#currentLanguage)) {
                await this.loadLanguage(this.#currentLanguage);
            }
            if (
                this.#fallbackLanguage &&
                this.#fallbackLanguage !== this.#currentLanguage &&
                !this.#flatDictionaries?.has(this.#fallbackLanguage)
            ) {
                try {
                    await this.loadLanguage(this.#fallbackLanguage);
                } catch (err) {
                    this.util?.log?.warn?.(`NLanguage.init: Échec du chargement de la langue de secours "${this.#fallbackLanguage}".`, err);
                }
            }
        }

        return this;
    }

    /**
     * Retourne une copie figée de la configuration active du moteur.
     *
     * @returns {Object} Configuration active en lecture seule.
     *
     * @example <caption>Exemple 1 : Consulter la configuration</caption>
     * console.log(language.getConfig().missingBehavior); // 'key'
     *
     * @example <caption>Exemple 2 : Vérifier le mode de journalisation</caption>
     * console.log(language.getConfig().logMissing);
     */
    getConfig() {
        return this.#config;
    }

    // =========================================================================
    // Gestion des langues & dictionnaires
    // =========================================================================

    /**
     * Retourne le code normalisé de la langue actuellement active.
     *
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire la langue active</caption>
     * console.log(language.getLanguage()); // 'fr'
     *
     * @example <caption>Exemple 2 : Vérifier après un changement</caption>
     * await language.setLanguage('en');
     * console.log(language.getLanguage()); // 'en'
     */
    getLanguage() {
        return this.#currentLanguage;
    }

    /**
     * Retourne le code normalisé de la langue de secours (`fallback`), ou `null`.
     *
     * @returns {string|null}
     *
     * @example <caption>Exemple 1 : Lire la langue de secours</caption>
     * console.log(language.getFallbackLanguage()); // 'en'
     *
     * @example <caption>Exemple 2 : Tester si un fallback est défini</caption>
     * if (language.getFallbackLanguage()) { console.log('Fallback actif'); }
     */
    getFallbackLanguage() {
        return this.#fallbackLanguage;
    }

    /**
     * Retourne la liste des codes de langues disponibles.
     *
     * @returns {string[]}
     *
     * @example <caption>Exemple 1 : Lister les langues connues</caption>
     * console.log(language.getLanguages()); // ['fr', 'en']
     *
     * @example <caption>Exemple 2 : Vérifier le nombre de langues</caption>
     * console.log(language.getLanguages().length);
     */
    getLanguages() {
        return this.#knownLanguages ? Array.from(this.#knownLanguages) : [];
    }

    /**
     * Vérifie si une langue est enregistrée ou chargée dans le moteur.
     *
     * @param {string} code - Code de langue BCP 47.
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier si 'fr' existe</caption>
     * console.log(language.hasLanguage('fr')); // true
     *
     * @example <caption>Exemple 2 : Vérifier un code inexistant</caption>
     * console.log(language.hasLanguage('zz')); // false
     */
    hasLanguage(code) {
        const norm = this.#normalizeLanguageCode(code);
        if (!norm) return false;
        return Boolean(this.#knownLanguages?.has(norm) || this.#flatDictionaries?.has(norm));
    }

    /**
     * Ajoute ou met à jour le dictionnaire d'une langue en mémoire.
     *
     * @param {string} code - Code de langue BCP 47 (ex: `'fr'`, `'en-US'`).
     * @param {Object} dictionary - Dictionnaire clé-valeur (peut contenir des objets imbriqués).
     * @param {Object} [options={}] - Options d'ajout.
     * @param {boolean} [options.merge=false] - Si `true`, fusionne avec le dictionnaire existant.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter le dictionnaire français</caption>
     * language.addLanguage('fr', { save: 'Enregistrer', cancel: 'Annuler' });
     *
     * @example <caption>Exemple 2 : Enrichir une langue existante sans écraser</caption>
     * language.addLanguage('fr', { auth: { login: 'Connexion' } }, { merge: true });
     */
    addLanguage(code, dictionary = {}, options = {}) {
        const norm = this.#normalizeLanguageCode(code);
        if (!norm) {
            throw new Error(`NLanguage.addLanguage: Code de langue invalide "${code}".`);
        }
        if (!this.#isPlainObject(dictionary)) {
            throw new Error(`NLanguage.addLanguage: Le dictionnaire pour "${norm}" doit être un objet.`);
        }

        const dictionaries = this.#ensureDictionaries();
        const flatDictionaries = this.#ensureFlatDictionaries();
        const merge = Boolean(options?.merge);
        const existingStruct = merge && dictionaries.has(norm)
            ? dictionaries.get(norm)
            : {};
        const mergedStruct = merge
            ? this.#deepMerge(existingStruct, dictionary)
            : this.#deepMerge({}, dictionary);

        const flatMap = new Map();
        this.#flattenDictionary(mergedStruct, '', flatMap);

        this.#ensureKnownLanguages().add(norm);
        dictionaries.set(norm, mergedStruct);
        flatDictionaries.set(norm, flatMap);

        this.emit('languageAdded', {
            language: norm,
            merged: merge,
            keyCount: flatMap.size
        });

        return this;
    }

    /**
     * Supprime une langue et ses traductions si elle n'est pas protégée.
     *
     * @param {string} code - Code de langue à supprimer.
     * @returns {boolean} `true` si supprimée, `false` si absente.
     *
     * @example <caption>Exemple 1 : Supprimer une langue temporaire</caption>
     * language.addLanguage('es', { save: 'Guardar' });
     * language.removeLanguage('es'); // true
     *
     * @example <caption>Exemple 2 : Tentative sur une langue inexistante</caption>
     * console.log(language.removeLanguage('de')); // false
     */
    removeLanguage(code) {
        const norm = this.#normalizeLanguageCode(code);
        if (!norm) {
            throw new Error(`NLanguage.removeLanguage: Code de langue invalide "${code}".`);
        }
        if (
            norm === this.#currentLanguage ||
            norm === this.#fallbackLanguage ||
            this.#config.protectedLanguages.includes(norm)
        ) {
            throw new Error(`NLanguage.removeLanguage: La langue "${norm}" est protégée et ne peut pas être supprimée.`);
        }

        const existed = Boolean(this.#knownLanguages?.has(norm) || this.#flatDictionaries?.has(norm));
        if (!existed) {
            return false;
        }

        this.#knownLanguages?.delete(norm);
        this.#dictionaries?.delete(norm);
        this.#flatDictionaries?.delete(norm);
        this.#pluralRulesCache?.delete(norm);

        this.emit('languageRemoved', { language: norm });
        return true;
    }

    /**
     * Charge de manière asynchrone le dictionnaire d'une langue via le `loader` configuré.
     * Déduplique les chargements simultanés d'une même langue.
     *
     * @async
     * @param {string} code - Code de langue à charger.
     * @param {Object} [options={}] - Options (`{ force: boolean }`).
     * @returns {Promise<boolean>} `true` si la langue est chargée.
     *
     * @example <caption>Exemple 1 : Charger une langue à la demande</caption>
     * await language.loadLanguage('mo');
     *
     * @example <caption>Exemple 2 : Recharger de force depuis le chargeur</caption>
     * await language.loadLanguage('en', { force: true });
     */
    async loadLanguage(code, options = {}) {
        if (this.isDestroyed) {
            return false;
        }

        const norm = this.#normalizeLanguageCode(code);
        if (!norm) {
            throw new Error(`NLanguage.loadLanguage: Code de langue invalide "${code}".`);
        }

        const force = Boolean(options?.force);
        if (!force && this.#flatDictionaries?.has(norm)) {
            return true;
        }

        if (this.#loadingPromises?.has(norm)) {
            return await this.#loadingPromises.get(norm);
        }

        if (typeof this.#loader !== 'function') {
            if (this.#flatDictionaries?.has(norm)) {
                return true;
            }
            throw new Error(`NLanguage.loadLanguage: Aucun chargeur configuré pour charger "${norm}".`);
        }

        const instanceGen = this.#instanceGeneration;
        const langGen = this.#loadGenerations?.get(norm) ?? 0;
        const loadingPromises = this.#ensureLoadingPromises();
        const task = (async () => {
            const raw = await this.#loader(norm);
            if (
                this.isDestroyed ||
                instanceGen !== this.#instanceGeneration ||
                (this.#loadGenerations?.get(norm) ?? 0) !== langGen
            ) {
                return false;
            }

            let parsed = raw;
            if (typeof raw === 'string') {
                try {
                    parsed = JSON.parse(raw);
                } catch (err) {
                    throw new Error(`NLanguage.loadLanguage: JSON invalide pour "${norm}" (${err?.message || err}).`);
                }
            }
            if (!this.#isPlainObject(parsed)) {
                throw new Error(`NLanguage.loadLanguage: Dictionnaire invalide reçu pour "${norm}".`);
            }

            if (
                this.isDestroyed ||
                instanceGen !== this.#instanceGeneration ||
                (this.#loadGenerations?.get(norm) ?? 0) !== langGen
            ) {
                return false;
            }

            this.addLanguage(norm, parsed, { merge: false });
            this.emit('languageLoaded', {
                language: norm,
                keyCount: this.#flatDictionaries?.get(norm)?.size ?? 0
            });
            return true;
        })();

        loadingPromises.set(norm, task);
        try {
            return await task;
        } finally {
            if (loadingPromises.get(norm) === task) {
                loadingPromises.delete(norm);
            }
            if (this.#loadingPromises && this.#loadingPromises.size === 0) {
                this.#loadingPromises = null;
            }
        }
    }

    /**
     * Décharge le dictionnaire d'une langue de la mémoire sans supprimer la déclaration de la langue.
     *
     * @param {string} code - Code de langue à décharger.
     * @returns {boolean} `true` si un dictionnaire était en mémoire et a été libéré.
     *
     * @example <caption>Exemple 1 : Libérer une langue inutilisée</caption>
     * language.unloadLanguage('mo');
     *
     * @example <caption>Exemple 2 : Décharger une langue non chargée</caption>
     * console.log(language.unloadLanguage('de')); // false
     */
    unloadLanguage(code) {
        const norm = this.#normalizeLanguageCode(code);
        if (!norm) {
            return false;
        }
        if (!this.#loadGenerations) {
            this.#loadGenerations = new Map();
        }
        this.#loadGenerations.set(norm, (this.#loadGenerations.get(norm) ?? 0) + 1);
        this.#loadingPromises?.delete(norm);
        if (this.#loadingPromises && this.#loadingPromises.size === 0) {
            this.#loadingPromises = null;
        }

        if (!this.#flatDictionaries?.has(norm)) {
            return false;
        }
        this.#dictionaries?.delete(norm);
        this.#flatDictionaries.delete(norm);
        this.#pluralRulesCache?.delete(norm);
        return true;
    }

    /**
     * Modifie la langue active après avoir vérifié son existence et chargé son dictionnaire si besoin.
     * N'émet `'languageChanged'` que si la langue active change réellement.
     *
     * @async
     * @param {string} code - Nouveau code de langue BCP 47.
     * @returns {Promise<this>} L'instance courante.
     *
     * @example <caption>Exemple 1 : Passer en anglais</caption>
     * await language.setLanguage('en');
     *
     * @example <caption>Exemple 2 : Passer en français</caption>
     * await language.setLanguage('fr');
     */
    async setLanguage(code) {
        const norm = this.#normalizeLanguageCode(code);
        if (!norm) {
            throw new Error(`NLanguage.setLanguage: Code de langue invalide "${code}".`);
        }

        if (!this.#flatDictionaries?.has(norm)) {
            if (typeof this.#loader === 'function') {
                await this.loadLanguage(norm);
            } else if (!this.#knownLanguages?.has(norm)) {
                throw new Error(`NLanguage.setLanguage: La langue "${norm}" est inexistante.`);
            }
        }

        if (this.#currentLanguage === norm) {
            return this;
        }

        const previousLanguage = this.#currentLanguage;
        this.#currentLanguage = norm;
        this.#ensureKnownLanguages().add(norm);

        this.emit('languageChanged', {
            previousLanguage,
            language: norm
        });

        return this;
    }

    // =========================================================================
    // Récupération & Pluralisation (synchrones)
    // =========================================================================

    /**
     * Récupère une expression traduite de manière synchrone à partir de son identifiant (notation pointée supportée),
     * avec gestion de la langue de secours et interpolation des paramètres dynamiques.
     *
     * @param {string} key - Identifiant de traduction (ex: `'save'`, `'user.create'`).
     * @param {Object<string, any>} [params={}] - Paramètres dynamiques à interpoler.
     * @param {Object} [options={}] - Options ponctuelles (`{ language, fallback, missingBehavior }`).
     * @returns {string} Chaîne traduite.
     *
     * @example <caption>Exemple 1 : Récupération simple et hiérarchique</caption>
     * const label = language.get('user.create');
     *
     * @example <caption>Exemple 2 : Interpolation de paramètres</caption>
     * const msg = language.get('welcome', { name: 'Madi' });
     */
    get(key, params = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const missingBehavior = opts.missingBehavior || this.#config.missingBehavior;

        if (typeof key !== 'string' || !key.trim()) {
            this.#recordMissing(this.#currentLanguage, String(key ?? ''), 'invalid_key', null);
            return missingBehavior === 'empty' ? '' : String(key ?? '');
        }

        const cleanKey = key.trim();
        const targetLang = opts.language
            ? (this.#normalizeLanguageCode(opts.language) || this.#currentLanguage)
            : this.#currentLanguage;
        const fallbackLang = opts.fallback !== undefined
            ? (opts.fallback ? this.#normalizeLanguageCode(opts.fallback) : null)
            : this.#fallbackLanguage;

        const currentMap = this.#flatDictionaries?.get(targetLang);
        if (currentMap && currentMap.has(cleanKey)) {
            return this.#interpolate(currentMap.get(cleanKey), params, cleanKey, targetLang);
        }

        if (fallbackLang && fallbackLang !== targetLang) {
            const fallbackMap = this.#flatDictionaries?.get(fallbackLang);
            if (fallbackMap && fallbackMap.has(cleanKey)) {
                this.#recordMissing(targetLang, cleanKey, 'fallback_used', fallbackLang);
                return this.#interpolate(fallbackMap.get(cleanKey), params, cleanKey, fallbackLang);
            }
        }

        this.#recordMissing(targetLang, cleanKey, 'missing_all', null);
        return missingBehavior === 'empty' ? '' : cleanKey;
    }

    /**
     * Récupère une expression pluralisée selon les règles CLDR de `Intl.PluralRules`
     * pour la langue active (avec repli sur `'other'` puis sur la langue de secours).
     *
     * @param {string} key - Clé racine contenant les variantes (`zero`, `one`, `two`, `few`, `many`, `other`).
     * @param {Object<string, any>} [params={}] - Paramètres contenant la valeur numérique (`count` par défaut).
     * @param {Object} [options={}] - Options ponctuelles (`{ countParam, language, fallback, missingBehavior }`).
     * @returns {string} Chaîne pluralisée et interpolée.
     *
     * @example <caption>Exemple 1 : Pluralisation au singulier et au pluriel</caption>
     * language.plural('messages', { count: 1 }); // '1 message'
     * language.plural('messages', { count: 5 }); // '5 messages'
     *
     * @example <caption>Exemple 2 : Pluralisation avec nom de compteur personnalisé</caption>
     * language.plural('items', { total: 2 }, { countParam: 'total' });
     */
    plural(key, params = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const missingBehavior = opts.missingBehavior || this.#config.missingBehavior;

        if (typeof key !== 'string' || !key.trim()) {
            this.#recordMissing(this.#currentLanguage, String(key ?? ''), 'invalid_key', null);
            return missingBehavior === 'empty' ? '' : String(key ?? '');
        }

        const cleanKey = key.trim();
        const countParam = typeof opts.countParam === 'string' && opts.countParam.trim()
            ? opts.countParam.trim()
            : 'count';
        const rawCount = params && typeof params === 'object' ? params[countParam] : undefined;
        const num = Number(rawCount);
        const hasValidNumber = rawCount !== undefined && rawCount !== null && rawCount !== '' && Number.isFinite(num);

        const targetLang = opts.language
            ? (this.#normalizeLanguageCode(opts.language) || this.#currentLanguage)
            : this.#currentLanguage;
        const fallbackLang = opts.fallback !== undefined
            ? (opts.fallback ? this.#normalizeLanguageCode(opts.fallback) : null)
            : this.#fallbackLanguage;

        const category = hasValidNumber ? this.#selectPluralCategory(targetLang, num) : 'other';
        const currentMap = this.#flatDictionaries?.get(targetLang);

        if (currentMap) {
            const exactKey = `${cleanKey}.${category}`;
            const otherKey = `${cleanKey}.other`;
            if (currentMap.has(exactKey)) {
                return this.#interpolate(currentMap.get(exactKey), params, exactKey, targetLang);
            }
            if (category !== 'other' && currentMap.has(otherKey)) {
                return this.#interpolate(currentMap.get(otherKey), params, otherKey, targetLang);
            }
        }

        if (fallbackLang && fallbackLang !== targetLang) {
            const fallbackMap = this.#flatDictionaries?.get(fallbackLang);
            if (fallbackMap) {
                const fbCategory = hasValidNumber ? this.#selectPluralCategory(fallbackLang, num) : 'other';
                const fbExactKey = `${cleanKey}.${fbCategory}`;
                const fbOtherKey = `${cleanKey}.other`;
                if (fallbackMap.has(fbExactKey)) {
                    this.#recordMissing(targetLang, `${cleanKey}.${category}`, 'fallback_used', fallbackLang);
                    return this.#interpolate(fallbackMap.get(fbExactKey), params, fbExactKey, fallbackLang);
                }
                if (fallbackMap.has(fbOtherKey)) {
                    this.#recordMissing(targetLang, `${cleanKey}.${category}`, 'fallback_used', fallbackLang);
                    return this.#interpolate(fallbackMap.get(fbOtherKey), params, fbOtherKey, fallbackLang);
                }
            }
        }

        this.#recordMissing(targetLang, `${cleanKey}.${category}`, 'missing_plural', null);
        return missingBehavior === 'empty' ? '' : cleanKey;
    }

    // =========================================================================
    // Suivi des traductions manquantes & Audit des dictionnaires
    // =========================================================================

    /**
     * Retourne la liste dédupliquée des expressions manquantes rencontrées pendant l'exécution.
     *
     * @returns {Array<{ key: string, language: string, type: string, fallbackUsed: string|null, timestamp: number }>}
     *
     * @example <caption>Exemple 1 : Inspecter les clés manquantes</caption>
     * const missing = language.getMissing();
     * console.log(missing.length);
     *
     * @example <caption>Exemple 2 : Filtrer les clés absentes de toutes les langues</caption>
     * const critical = language.getMissing().filter((m) => m.type === 'missing_all');
     */
    getMissing() {
        if (!this.#missingEntries) return [];
        return Array.from(this.#missingEntries.values()).map((entry) => ({ ...entry }));
    }

    /**
     * Vide la liste des expressions manquantes collectées et libère la mémoire associée.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Réinitialiser le rapport de clés manquantes</caption>
     * language.clearMissing();
     *
     * @example <caption>Exemple 2 : Vérifier le vidage</caption>
     * language.clearMissing();
     * console.log(language.getMissing().length); // 0
     */
    clearMissing() {
        if (this.#missingEntries) {
            this.#missingEntries.clear();
            this.#missingEntries = null;
        }
        return this;
    }

    /**
     * Compare l'ensemble des dictionnaires chargés pour détecter les incohérences
     * (clés manquantes par langue, absentes partout, conflits de types, et clés inutilisées si `referenceKeys` fourni).
     *
     * @param {string[]|null} [referenceKeys=null] - Liste optionnelle des identifiants attendus par l'application.
     * @returns {Object} Rapport structuré d'audit.
     *
     * @example <caption>Exemple 1 : Comparer les dictionnaires chargés</caption>
     * const report = language.checkTranslations();
     * console.log(report.ok, report.missingByLanguage, report.typeMismatches);
     *
     * @example <caption>Exemple 2 : Vérifier par rapport aux clés attendues</caption>
     * const report = language.checkTranslations(['save', 'cancel', 'auth.login']);
     * console.log(report.missingEverywhere, report.unusedKeys);
     */
    checkTranslations(referenceKeys = null) {
        const langs = this.#dictionaries ? Array.from(this.#dictionaries.keys()) : [];
        const keyKindsByLang = new Map();
        const allKeys = new Set();

        for (const lang of langs) {
            const kinds = new Map();
            this.#collectKeyKinds(this.#dictionaries.get(lang), '', kinds);
            keyKindsByLang.set(lang, kinds);
            for (const [k, kind] of kinds.entries()) {
                if (kind !== 'object') {
                    allKeys.add(k);
                }
            }
        }

        const hasRef = Array.isArray(referenceKeys);
        const refSet = new Set(hasRef ? referenceKeys.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim()) : []);
        for (const rk of refSet) {
            allKeys.add(rk);
        }

        const missingByLanguage = {};
        for (const lang of langs) {
            const flat = this.#flatDictionaries?.get(lang);
            const missing = [];
            for (const k of allKeys) {
                if (!flat || !flat.has(k)) {
                    missing.push(k);
                }
            }
            if (missing.length > 0) {
                missingByLanguage[lang] = missing;
            }
        }

        const missingEverywhere = [];
        for (const k of allKeys) {
            const presentSomewhere = langs.some((lang) => this.#flatDictionaries?.get(lang)?.has(k));
            if (!presentSomewhere) {
                missingEverywhere.push(k);
            }
        }

        const typeMismatches = [];
        const allStructureKeys = new Set();
        for (const kinds of keyKindsByLang.values()) {
            for (const k of kinds.keys()) {
                allStructureKeys.add(k);
            }
        }
        for (const k of allStructureKeys) {
            const observed = {};
            const typesSet = new Set();
            for (const lang of langs) {
                const kind = keyKindsByLang.get(lang)?.get(k);
                if (kind !== undefined) {
                    observed[lang] = kind;
                    typesSet.add(kind);
                }
            }
            if (typesSet.size > 1) {
                typeMismatches.push({ key: k, types: observed });
            }
        }

        const unusedKeys = [];
        if (hasRef) {
            for (const lang of langs) {
                const flat = this.#flatDictionaries?.get(lang);
                if (!flat) continue;
                for (const k of flat.keys()) {
                    if (!refSet.has(k) && !unusedKeys.includes(k)) {
                        unusedKeys.push(k);
                    }
                }
            }
        }

        const ok = Object.keys(missingByLanguage).length === 0 &&
            missingEverywhere.length === 0 &&
            typeMismatches.length === 0;

        return {
            ok,
            languages: langs,
            totalKeys: allKeys.size,
            missingByLanguage,
            missingEverywhere,
            typeMismatches,
            unusedKeys
        };
    }

    // =========================================================================
    // Cycle de vie (NObject)
    // =========================================================================

    /**
     * Libère les dictionnaires, caches, promesses et ressources `NObject` de l'instance.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire l'instance NLanguage</caption>
     * lang.destroy();
     * console.log(lang.isDestroyed); // true
     *
     * @example <caption>Exemple 2 : Nettoyage avant fermeture</caption>
     * if (!lang.isDestroyed) lang.destroy();
     */
    destroy() {
        this.#instanceGeneration += 1;
        this.#loadGenerations?.clear();
        this.#loadGenerations = null;
        this.#knownLanguages?.clear();
        this.#knownLanguages = null;
        this.#dictionaries?.clear();
        this.#dictionaries = null;
        this.#flatDictionaries?.clear();
        this.#flatDictionaries = null;
        this.#loadingPromises?.clear();
        this.#loadingPromises = null;
        this.#pluralRulesCache?.clear();
        this.#pluralRulesCache = null;
        this.#missingEntries?.clear();
        this.#missingEntries = null;
        this.#loader = null;
        super.destroy();
    }

    // =========================================================================
    // Méthodes privées internes (Lazy Allocators & Helpers)
    // =========================================================================

    #ensureKnownLanguages() {
        if (!this.#knownLanguages) this.#knownLanguages = new Set();
        return this.#knownLanguages;
    }

    #ensureDictionaries() {
        if (!this.#dictionaries) this.#dictionaries = new Map();
        return this.#dictionaries;
    }

    #ensureFlatDictionaries() {
        if (!this.#flatDictionaries) this.#flatDictionaries = new Map();
        return this.#flatDictionaries;
    }

    #ensureLoadingPromises() {
        if (!this.#loadingPromises) this.#loadingPromises = new Map();
        return this.#loadingPromises;
    }

    #ensurePluralRulesCache() {
        if (!this.#pluralRulesCache) this.#pluralRulesCache = new Map();
        return this.#pluralRulesCache;
    }

    #ensureMissingEntries() {
        if (!this.#missingEntries) this.#missingEntries = new Map();
        return this.#missingEntries;
    }

    /**
     * Valide et normalise les options de configuration en retournant un objet figé.
     * @private
     */
    #validateAndNormalizeConfig(rawOptions) {
        const opts = (rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions)) ? rawOptions : {};
        const allowedKeys = new Set([
            'language', 'fallback', 'missingBehavior', 'preserveUnknownParams',
            'logMissing', 'logMissingParameters', 'protectedLanguages', 'loader', 'languages'
        ]);
        for (const key of Object.keys(opts)) {
            if (!allowedKeys.has(key)) {
                throw new Error(`NLanguage: Option de configuration inconnue "${key}".`);
            }
        }

        const language = opts.language !== undefined
            ? this.#normalizeLanguageCode(opts.language)
            : 'fr';
        if (!language) {
            throw new Error(`NLanguage: Code de langue initiale invalide "${opts.language}".`);
        }

        let fallback = 'en';
        if (opts.fallback === null) {
            fallback = null;
        } else if (opts.fallback !== undefined) {
            fallback = this.#normalizeLanguageCode(opts.fallback);
            if (!fallback) {
                throw new Error(`NLanguage: Code de langue de secours invalide "${opts.fallback}".`);
            }
        }

        const missingBehavior = opts.missingBehavior ?? 'key';
        if (missingBehavior !== 'key' && missingBehavior !== 'empty') {
            throw new Error(`NLanguage: missingBehavior invalide "${missingBehavior}" ('key' ou 'empty' attendu).`);
        }

        const protectedLanguages = [];
        if (Array.isArray(opts.protectedLanguages)) {
            for (const code of opts.protectedLanguages) {
                const norm = this.#normalizeLanguageCode(code);
                if (!norm) {
                    throw new Error(`NLanguage: Code de langue protégée invalide "${code}".`);
                }
                if (!protectedLanguages.includes(norm)) {
                    protectedLanguages.push(norm);
                }
            }
        }

        if (opts.loader !== undefined && opts.loader !== null && typeof opts.loader !== 'function') {
            throw new Error('NLanguage: loader doit être une fonction.');
        }

        return Object.freeze({
            language,
            fallback,
            missingBehavior,
            preserveUnknownParams: opts.preserveUnknownParams !== undefined ? Boolean(opts.preserveUnknownParams) : true,
            logMissing: Boolean(opts.logMissing),
            logMissingParameters: Boolean(opts.logMissingParameters),
            protectedLanguages: Object.freeze(protectedLanguages),
            loader: opts.loader || null
        });
    }

    /**
     * Valide et normalise un code de langue selon les conventions BCP 47.
     * @private
     */
    #normalizeLanguageCode(code) {
        if (typeof code !== 'string') return null;
        const cleaned = code.trim().replace(/_/g, '-');
        if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(cleaned)) {
            return null;
        }
        if (typeof Intl !== 'undefined' && typeof Intl.getCanonicalLocales === 'function') {
            try {
                const canonical = Intl.getCanonicalLocales(cleaned);
                if (canonical.length > 0) {
                    return canonical[0];
                }
            } catch {
                return null;
            }
        }
        const parts = cleaned.split('-');
        return parts
            .map((part, idx) => {
                if (idx === 0) return part.toLowerCase();
                if (part.length === 4 && /^[a-zA-Z]+$/.test(part)) {
                    return part[0].toUpperCase() + part.slice(1).toLowerCase();
                }
                if (part.length === 2 && /^[a-zA-Z]+$/.test(part)) {
                    return part.toUpperCase();
                }
                return part.toLowerCase();
            })
            .join('-');
    }

    /**
     * Vérifie si une valeur est un objet simple (prototype `Object.prototype` ou `null`).
     * @private
     */
    #isPlainObject(value) {
        if (value === null || typeof value !== 'object') {
            return false;
        }
        const proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }

    /**
     * Fusionne profondément deux dictionnaires sans modifier les objets sources
     * et en ignorant les clés dangereuses (`__proto__`, `constructor`, `prototype`).
     * @private
     */
    #deepMerge(target, source) {
        const out = {};
        if (this.#isPlainObject(target)) {
            for (const k of Object.keys(target)) {
                if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                    continue;
                }
                const v = target[k];
                out[k] = this.#isPlainObject(v) ? this.#deepMerge({}, v) : v;
            }
        }
        for (const k of Object.keys(source)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                continue;
            }
            const v = source[k];
            if (this.#isPlainObject(v) && this.#isPlainObject(out[k])) {
                out[k] = this.#deepMerge(out[k], v);
            } else if (this.#isPlainObject(v)) {
                out[k] = this.#deepMerge({}, v);
            } else {
                out[k] = v;
            }
        }
        return out;
    }

    /**
     * Aplatit récursivement un dictionnaire hiérarchique en clés pointées
     * tout en détectant les collisions de clés.
     * @private
     */
    #flattenDictionary(obj, prefix, targetMap) {
        for (const k of Object.keys(obj)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                continue;
            }
            const v = obj[k];
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (this.#isPlainObject(v)) {
                this.#flattenDictionary(v, fullKey, targetMap);
            } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                if (targetMap.has(fullKey)) {
                    throw new Error(`NLanguage: Collision de clé détectée pour "${fullKey}".`);
                }
                targetMap.set(fullKey, String(v));
            } else {
                throw new Error(`NLanguage: Valeur de traduction invalide pour "${fullKey}" (chaîne ou objet imbriqué attendu).`);
            }
        }
    }

    /**
     * Collecte les types de chaque clé (feuille ou objet) pour `checkTranslations()`.
     * @private
     */
    #collectKeyKinds(obj, prefix, kindsMap) {
        if (!this.#isPlainObject(obj)) return;
        for (const [k, v] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (this.#isPlainObject(v)) {
                kindsMap.set(fullKey, 'object');
                this.#collectKeyKinds(v, fullKey, kindsMap);
            } else {
                kindsMap.set(fullKey, typeof v);
            }
        }
    }

    /**
     * Remplace en une seule passe les paramètres `{param}` dans une chaîne traduite.
     * @private
     */
    #interpolate(template, params, key, language) {
        if (typeof template !== 'string' || !template.includes('{')) {
            return template;
        }
        const p = (params && typeof params === 'object') ? params : {};
        return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, paramName) => {
            const hasKey = Object.prototype.hasOwnProperty.call(p, paramName);
            const val = hasKey ? p[paramName] : undefined;
            if (val === undefined || val === null) {
                if (this.#config.logMissingParameters) {
                    this.util?.log?.warn?.(`NLanguage: Paramètre manquant "{${paramName}}" pour "${key}" (${language}).`);
                }
                this.emit('missingParameter', {
                    key,
                    language,
                    parameter: paramName
                });
                return this.#config.preserveUnknownParams ? match : '';
            }
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                return String(val);
            }
            return this.#config.preserveUnknownParams ? match : '';
        });
    }

    /**
     * Sélectionne la catégorie plurielle CLDR via `Intl.PluralRules` avec cache paresseux.
     * @private
     */
    #selectPluralCategory(language, count) {
        if (typeof Intl === 'undefined' || typeof Intl.PluralRules !== 'function') {
            return count === 1 ? 'one' : 'other';
        }
        const cache = this.#ensurePluralRulesCache();
        let rules = cache.get(language);
        if (rules === undefined) {
            try {
                rules = new Intl.PluralRules(language);
            } catch {
                rules = null;
            }
            cache.set(language, rules);
        }
        return rules ? rules.select(count) : (count === 1 ? 'one' : 'other');
    }

    /**
     * Enregistre une expression manquante sans doublon et émet `'missingTranslation'`.
     * @private
     */
    #recordMissing(language, key, type, fallbackUsed) {
        const missing = this.#ensureMissingEntries();
        const dedupKey = `${language}::${key}::${type}`;
        if (!missing.has(dedupKey)) {
            const entry = {
                key,
                language,
                type,
                fallbackUsed: fallbackUsed || null,
                timestamp: Date.now()
            };
            missing.set(dedupKey, entry);
            if (this.#config.logMissing) {
                this.util?.log?.warn?.(`NLanguage: Traduction manquante "${key}" pour "${language}" (${type}).`, entry);
            }
            this.emit('missingTranslation', entry);
        }
    }
}

export default NLanguage;
