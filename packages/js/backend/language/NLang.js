/**
 * @file NLang.js
 * @package @nlib/js-backend
 * @description Moteur central d'internationalisation (i18n) de NLib, indépendant de l'environnement d'exécution.
 * Hérite de `NObject` et utilise l'allocation paresseuse pour ses dictionnaires, caches et collections internes.
 * Gère les dictionnaires multi-langues, la notation hiérarchique pointée, la langue de secours (fallback),
 * l'interpolation sécurisée de paramètres, la pluralisation CLDR via `Intl.PluralRules`,
 * le chargement différé via chargeur injectable, la détection des traductions manquantes et l'audit des dictionnaires.
 */

import { NObject } from '../core/NObject.js';
import { NEvent } from '../core/NEvent.js';
import { NLog } from '../log/NLog.js';
import { NIndexedDB } from '../database/NIndexedDB.js';

/**
 * @class NLang
  * @description Moteur d'internationalisation (i18n) de NLib.
 *
 * @example <caption>Exemple 1 : Initialisation avec dictionnaires en mémoire et interpolation</caption>
 *  * await lang.init({
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
export class NLang {

    // =========================================================================
    // Propriétés privées statiques (allocation paresseuse)
    // =========================================================================
    // =========================================================================

    /**
     * Configuration validée et figée du moteur.
     * @type {Object|null}
     * @private
     */
    /** @type {NEvent|null} */
    static #event = null;

    static #config = null;

    /**
     * Langue active normalisée (ex: `'fr'`, `'fr-FR'`).
     * @type {string}
     * @private
     */
    static #currentLanguage = 'fr';

    /**
     * Langue de secours normalisée (ou `null`).
     * @type {string|null}
     * @private
     */
    static #fallbackLanguage = 'en';

    /**
     * Langues connues (alloué paresseusement au premier enregistrement).
     * @type {Set<string>|null}
     * @private
     */
    static #knownLanguages = null;

    /**
     * Dictionnaires structurés bruts indexés par code de langue normalisé (alloué paresseusement).
     * @type {Map<string, Object>|null}
     * @private
     */
    static #dictionaries = null;

    /**
     * Index aplati (`Map<dottedKey, string>`) par langue pour une recherche O(1) (alloué paresseusement).
     * @type {Map<string, Map<string, string>>|null}
     * @private
     */
    static #flatDictionaries = null;

    /**
     * Promesses de chargement en cours par code de langue (alloué paresseusement).
     * @type {Map<string, Promise<boolean>>|null}
     * @private
     */
    static #loadingPromises = null;

    /**
     * Compteur de génération par langue pour invalider les chargements obsolètes (alloué paresseusement).
     * @type {Map<string, number>|null}
     * @private
     */
    static #loadGenerations = null;

    /**
     * Compteur global de génération incrémenté lors de la destruction de l'instance.
     * @type {number}
     * @private
     */
    static #instanceGeneration = 0;

    /**
     * Cache des instances `Intl.PluralRules` par code de langue (alloué paresseusement).
     * @type {Map<string, Intl.PluralRules|null>|null}
     * @private
     */
    static #pluralRulesCache = null;

    /**
     * Collecte dédupliquée des expressions manquantes (allouée paresseusement).
     * @type {Map<string, Object>|null}
     * @private
     */
    static #missingEntries = null;

    /**
     * Fonction de chargement asynchrone injectée (`(langCode) => Promise<Object|string>`).
     * @type {Function|null}
     * @private
     */
    static #loader = null;

    /**
     * Active la persistance des dictionnaires chargés et de la langue active dans `NIndexedDB`.
     * @type {boolean}
     * @private
     */
    static #persist = true;

    /**
     * Nom du magasin `NIndexedDB` utilisé pour stocker les langues.
     * @type {string}
     * @private
     */
    static #idbStoreName = 'ntable';

    /**
     * Retourne l'émetteur d'événements interne de `NLang`.
     * @private
     * @returns {NEvent}
     */
    static #ensureEvent() {
        if (!NLang.#event) {
            NLang.#event = new NEvent();
        }
        return NLang.#event;
    }

    /**
     * Retourne la configuration active en l'initialisant par défaut si nécessaire.
     * @private
     * @returns {Object}
     */
    static #ensureConfig() {
        if (!NLang.#config) {
            NLang.#config = NLang.#validateAndNormalizeConfig({});
        }
        return NLang.#config;
    }

    /**
     * Abonne un écouteur à un événement de `NLang`.
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} handler - Fonction de rappel.
     * @param {Object} [options={}] - Options d'écoute.
     * @returns {Function} Fonction de désabonnement.
     *
     * @example <caption>Exemple 1 : Écouter le changement de langue</caption>
     * const off = NLang.on('languageChanged', ({ current }) => console.log(current));
     *
     * @example <caption>Exemple 2 : Écouter les traductions manquantes</caption>
     * NLang.on('missingTranslation', (entry) => console.warn(entry));
     */
    static on(event, handler, options = {}) {
        return NLang.#ensureEvent().on(event, handler, options);
    }

    /**
     * Abonne un écouteur à un événement de `NLang` pour une seule exécution.
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} handler - Fonction de rappel.
     * @returns {Function} Fonction de désabonnement.
     *
     * @example <caption>Exemple 1 : Attendre le premier changement de langue</caption>
     * NLang.once('languageChanged', ({ current }) => console.log(current));
     *
     * @example <caption>Exemple 2 : Attendre le premier chargement de langue</caption>
     * NLang.once('languageLoaded', ({ language }) => console.log(language));
     */
    static once(event, handler) {
        return NLang.#ensureEvent().once(event, handler);
    }

    /**
     * Désabonne un écouteur d'un événement de `NLang`.
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} handler - Fonction de rappel à retirer.
     * @returns {typeof NLang}
     *
     * @example <caption>Exemple 1 : Retirer un écouteur</caption>
     * NLang.off('languageChanged', handler);
     *
     * @example <caption>Exemple 2 : Nettoyage d'un écouteur d'erreur</caption>
     * NLang.off('error', onError);
     */
    static off(event, handler) {
        NLang.#ensureEvent().off(event, handler);
        return NLang;
    }

    /**
     * Émet un événement sur le bus interne de `NLang`.
     *
     * @param {string} event - Nom de l'événement.
     * @param {*} [data] - Charge utile transmise aux écouteurs.
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Émettre un événement personnalisé</caption>
     * NLang.emit('languageChanged', { previous: 'fr', current: 'en' });
     *
     * @example <caption>Exemple 2 : Émettre un avertissement</caption>
     * NLang.emit('missingTranslation', { key: 'hello', language: 'fr' });
     */
    static emit(event, data) {
        return NLang.#ensureEvent().emit(event, data);
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
     *      * await language.init({
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
    static async init(options = {}) {
        const merged = {
            ...NLang.#ensureConfig(),
            ...(options && typeof options === 'object' ? options : {})
        };
        if (options && typeof options === 'object' && !('languages' in options)) {
            delete merged.languages;
        }
        delete merged.state;

        NLang.#config = NLang.#validateAndNormalizeConfig(merged);
        NLang.#currentLanguage = NLang.#ensureConfig().language;
        NLang.#fallbackLanguage = NLang.#ensureConfig().fallback;
        NLang.#loader = NLang.#ensureConfig().loader;
        NLang.#persist = NLang.#ensureConfig().persist;
        NLang.#idbStoreName = NLang.#ensureConfig().storeName;

        if ((!options || options.language === undefined) && NLang.#persist) {
            const savedLang = await NLang.#loadCurrentLanguageFromIdb();
            if (savedLang) {
                NLang.#currentLanguage = savedLang;
            }
        }

        const known = NLang.#ensureKnownLanguages();
        known.add(NLang.#currentLanguage);
        if (NLang.#fallbackLanguage) {
            known.add(NLang.#fallbackLanguage);
        }

        if (options && typeof options === 'object' && options.languages && typeof options.languages === 'object') {
            for (const [code, dict] of Object.entries(options.languages)) {
                NLang.addLanguage(code, dict);
            }
        }

        if (!NLang.#flatDictionaries?.has(NLang.#currentLanguage)) {
            await NLang.loadLanguage(NLang.#currentLanguage);
        }
        if (
            NLang.#fallbackLanguage &&
            NLang.#fallbackLanguage !== NLang.#currentLanguage &&
            !NLang.#flatDictionaries?.has(NLang.#fallbackLanguage)
        ) {
            const fbOk = await NLang.loadLanguage(NLang.#fallbackLanguage);
            if (!fbOk && NLang.#loader) {
                NLog.warn(`NLang.init: Échec du chargement de la langue de secours "${NLang.#fallbackLanguage}".`);
            }
        }

        return NLang;
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
    static getConfig() {
        return NLang.#ensureConfig();
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
    static getLanguage() {
        return NLang.#currentLanguage;
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
    static getFallbackLanguage() {
        return NLang.#fallbackLanguage;
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
    static getLanguages() {
        return NLang.#knownLanguages ? Array.from(NLang.#knownLanguages) : [];
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
    static hasLanguage(code) {
        const norm = NLang.#normalizeLanguageCode(code);
        if (!norm) return false;
        return Boolean(NLang.#knownLanguages?.has(norm) || NLang.#flatDictionaries?.has(norm));
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
    static addLanguage(code, dictionary = {}, options = {}) {
        const norm = NLang.#normalizeLanguageCode(code);
        if (!norm) {
            const message = `NLang.addLanguage: Code de langue invalide "${code}".`;
            NLog.error(message);
            NLang.emit('error', { code: 'INVALID_LANGUAGE', message });
            return NLang;
        }
        if (!NLang.#isPlainObject(dictionary)) {
            const message = `NLang.addLanguage: Le dictionnaire pour "${norm}" doit être un objet.`;
            NLog.error(message);
            NLang.emit('error', { code: 'INVALID_DICTIONARY', language: norm, message });
            return NLang;
        }

        const dictionaries = NLang.#ensureDictionaries();
        const flatDictionaries = NLang.#ensureFlatDictionaries();
        const merge = Boolean(options?.merge);
        const existingStruct = merge && dictionaries.has(norm)
            ? dictionaries.get(norm)
            : {};
        const mergedStruct = merge
            ? NLang.#deepMerge(existingStruct, dictionary)
            : NLang.#deepMerge({}, dictionary);

        const flatMap = new Map();
        NLang.#flattenDictionary(mergedStruct, '', flatMap);

        NLang.#ensureKnownLanguages().add(norm);
        dictionaries.set(norm, mergedStruct);
        flatDictionaries.set(norm, flatMap);

        NLang.emit('languageAdded', {
            language: norm,
            merged: merge,
            keyCount: flatMap.size
        });

        return NLang;
    }

    /**
     * Supprime une langue et ses traductions si elle n'est pas protégée.
     *
     * @param {string} code - Code de langue à supprimer.
     * @returns {boolean} `true` si supprimée, `false` si absente ou protégée.
     *
     * @example <caption>Exemple 1 : Supprimer une langue temporaire</caption>
     * language.addLanguage('es', { save: 'Guardar' });
     * language.removeLanguage('es'); // true
     *
     * @example <caption>Exemple 2 : Tentative sur une langue inexistante</caption>
     * console.log(language.removeLanguage('de')); // false
     */
    static removeLanguage(code) {
        const norm = NLang.#normalizeLanguageCode(code);
        if (!norm) {
            const message = `NLang.removeLanguage: Code de langue invalide "${code}".`;
            NLog.error(message);
            NLang.emit('error', { code: 'INVALID_LANGUAGE', message });
            return false;
        }
        if (
            norm === NLang.#currentLanguage ||
            norm === NLang.#fallbackLanguage ||
            NLang.#ensureConfig().protectedLanguages.includes(norm)
        ) {
            const message = `NLang.removeLanguage: La langue "${norm}" est protégée et ne peut pas être supprimée.`;
            NLog.warn(message);
            NLang.emit('error', { code: 'PROTECTED_LANGUAGE', language: norm, message });
            return false;
        }

        const existed = Boolean(NLang.#knownLanguages?.has(norm) || NLang.#flatDictionaries?.has(norm));
        if (!existed) {
            return false;
        }

        NLang.#knownLanguages?.delete(norm);
        NLang.#dictionaries?.delete(norm);
        NLang.#flatDictionaries?.delete(norm);
        NLang.#pluralRulesCache?.delete(norm);
        NLang.#removeDictionaryFromIdb(norm);

        NLang.emit('languageRemoved', { language: norm });
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
    static async loadLanguage(code, options = {}) {
        const norm = NLang.#normalizeLanguageCode(code);
        if (!norm) {
            const message = `NLang.loadLanguage: Code de langue invalide "${code}".`;
            NLog.error(message);
            NLang.emit('error', { code: 'INVALID_LANGUAGE', message });
            return false;
        }

        const force = Boolean(options?.force);
        if (!force && NLang.#flatDictionaries?.has(norm)) {
            return true;
        }

        if (NLang.#loadingPromises?.has(norm)) {
            return await NLang.#loadingPromises.get(norm);
        }

        const instanceGen = NLang.#instanceGeneration;
        const langGen = NLang.#loadGenerations?.get(norm) ?? 0;
        const loadingPromises = NLang.#ensureLoadingPromises();

        const task = (async () => {
            if (!force && NLang.#persist) {
                const cached = await NLang.#loadDictionaryFromIdb(norm);
                if (
                    instanceGen !== NLang.#instanceGeneration ||
                    (NLang.#loadGenerations?.get(norm) ?? 0) !== langGen
                ) {
                    return false;
                }
                if (cached && NLang.#isPlainObject(cached)) {
                    NLang.addLanguage(norm, cached, { merge: false });
                    NLang.emit('languageLoaded', {
                        language: norm,
                        keyCount: NLang.#flatDictionaries?.get(norm)?.size ?? 0,
                        fromCache: true
                    });
                    return true;
                }
            }

            if (typeof NLang.#loader !== 'function') {
                return NLang.#flatDictionaries?.has(norm) ?? false;
            }

            let raw;
            try {
                raw = await NLang.#loader(norm);
            } catch (err) {
                const message = `NLang.loadLanguage: Échec du chargement pour "${norm}" (${err?.message || err}).`;
                NLog.error(message, err);
                NLang.emit('error', { code: 'LOAD_ERROR', language: norm, message, error: err });
                return false;
            }

            if (
                instanceGen !== NLang.#instanceGeneration ||
                (NLang.#loadGenerations?.get(norm) ?? 0) !== langGen
            ) {
                return false;
            }

            let parsed = raw;
            if (typeof raw === 'string') {
                try {
                    parsed = JSON.parse(raw);
                } catch (err) {
                    const message = `NLang.loadLanguage: JSON invalide pour "${norm}" (${err?.message || err}).`;
                    NLog.error(message, err);
                    NLang.emit('error', { code: 'INVALID_JSON', language: norm, message, error: err });
                    return false;
                }
            }
            if (!NLang.#isPlainObject(parsed)) {
                const message = `NLang.loadLanguage: Dictionnaire invalide reçu pour "${norm}".`;
                NLog.error(message);
                NLang.emit('error', { code: 'INVALID_DICTIONARY', language: norm, message });
                return false;
            }

            if (
                instanceGen !== NLang.#instanceGeneration ||
                (NLang.#loadGenerations?.get(norm) ?? 0) !== langGen
            ) {
                return false;
            }

            NLang.addLanguage(norm, parsed, { merge: false });
            if (NLang.#persist) {
                await NLang.#saveDictionaryToIdb(norm, parsed);
            }
            NLang.emit('languageLoaded', {
                language: norm,
                keyCount: NLang.#flatDictionaries?.get(norm)?.size ?? 0,
                fromCache: false
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
            if (NLang.#loadingPromises && NLang.#loadingPromises.size === 0) {
                NLang.#loadingPromises = null;
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
    static unloadLanguage(code) {
        const norm = NLang.#normalizeLanguageCode(code);
        if (!norm) {
            return false;
        }
        if (!NLang.#loadGenerations) {
            NLang.#loadGenerations = new Map();
        }
        NLang.#loadGenerations.set(norm, (NLang.#loadGenerations.get(norm) ?? 0) + 1);
        NLang.#loadingPromises?.delete(norm);
        if (NLang.#loadingPromises && NLang.#loadingPromises.size === 0) {
            NLang.#loadingPromises = null;
        }

        if (!NLang.#flatDictionaries?.has(norm)) {
            return false;
        }
        NLang.#dictionaries?.delete(norm);
        NLang.#flatDictionaries.delete(norm);
        NLang.#pluralRulesCache?.delete(norm);
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
    static async setLanguage(code) {
        const norm = NLang.#normalizeLanguageCode(code);
        if (!norm) {
            const message = `NLang.setLanguage: Code de langue invalide "${code}".`;
            NLog.error(message);
            NLang.emit('error', { code: 'INVALID_LANGUAGE', message });
            return NLang;
        }

        if (!NLang.#flatDictionaries?.has(norm)) {
            const loaded = await NLang.loadLanguage(norm);
            if (!loaded && !NLang.#knownLanguages?.has(norm)) {
                const message = `NLang.setLanguage: La langue "${norm}" est inexistante ou n'a pas pu être chargée.`;
                NLog.warn(message);
                NLang.emit('error', { code: 'LANGUAGE_NOT_FOUND', language: norm, message });
                return NLang;
            }
        }

        if (NLang.#currentLanguage === norm) {
            return NLang;
        }

        const previousLanguage = NLang.#currentLanguage;
        NLang.#currentLanguage = norm;
        NLang.#ensureKnownLanguages().add(norm);

        if (NLang.#persist) {
            await NLang.#saveCurrentLanguageToIdb(norm);
        }

        NLang.emit('languageChanged', {
            previousLanguage,
            language: norm
        });

        return NLang;
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
    static get(key, params = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const missingBehavior = opts.missingBehavior || NLang.#ensureConfig().missingBehavior;

        if (typeof key !== 'string' || !key.trim()) {
            NLang.#recordMissing(NLang.#currentLanguage, String(key ?? ''), 'invalid_key', null);
            return missingBehavior === 'empty' ? '' : String(key ?? '');
        }

        const cleanKey = key.trim();
        const targetLang = opts.language
            ? (NLang.#normalizeLanguageCode(opts.language) || NLang.#currentLanguage)
            : NLang.#currentLanguage;
        const fallbackLang = opts.fallback !== undefined
            ? (opts.fallback ? NLang.#normalizeLanguageCode(opts.fallback) : null)
            : NLang.#fallbackLanguage;

        const currentMap = NLang.#flatDictionaries?.get(targetLang);
        if (currentMap && currentMap.has(cleanKey)) {
            return NLang.#interpolate(currentMap.get(cleanKey), params, cleanKey, targetLang);
        }

        if (fallbackLang && fallbackLang !== targetLang) {
            const fallbackMap = NLang.#flatDictionaries?.get(fallbackLang);
            if (fallbackMap && fallbackMap.has(cleanKey)) {
                NLang.#recordMissing(targetLang, cleanKey, 'fallback_used', fallbackLang);
                return NLang.#interpolate(fallbackMap.get(cleanKey), params, cleanKey, fallbackLang);
            }
        }

        NLang.#recordMissing(targetLang, cleanKey, 'missing_all', null);
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
    static plural(key, params = {}, options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        const missingBehavior = opts.missingBehavior || NLang.#ensureConfig().missingBehavior;

        if (typeof key !== 'string' || !key.trim()) {
            NLang.#recordMissing(NLang.#currentLanguage, String(key ?? ''), 'invalid_key', null);
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
            ? (NLang.#normalizeLanguageCode(opts.language) || NLang.#currentLanguage)
            : NLang.#currentLanguage;
        const fallbackLang = opts.fallback !== undefined
            ? (opts.fallback ? NLang.#normalizeLanguageCode(opts.fallback) : null)
            : NLang.#fallbackLanguage;

        const category = hasValidNumber ? NLang.#selectPluralCategory(targetLang, num) : 'other';
        const currentMap = NLang.#flatDictionaries?.get(targetLang);

        if (currentMap) {
            const exactKey = `${cleanKey}.${category}`;
            const otherKey = `${cleanKey}.other`;
            if (currentMap.has(exactKey)) {
                return NLang.#interpolate(currentMap.get(exactKey), params, exactKey, targetLang);
            }
            if (category !== 'other' && currentMap.has(otherKey)) {
                return NLang.#interpolate(currentMap.get(otherKey), params, otherKey, targetLang);
            }
        }

        if (fallbackLang && fallbackLang !== targetLang) {
            const fallbackMap = NLang.#flatDictionaries?.get(fallbackLang);
            if (fallbackMap) {
                const fbCategory = hasValidNumber ? NLang.#selectPluralCategory(fallbackLang, num) : 'other';
                const fbExactKey = `${cleanKey}.${fbCategory}`;
                const fbOtherKey = `${cleanKey}.other`;
                if (fallbackMap.has(fbExactKey)) {
                    NLang.#recordMissing(targetLang, `${cleanKey}.${category}`, 'fallback_used', fallbackLang);
                    return NLang.#interpolate(fallbackMap.get(fbExactKey), params, fbExactKey, fallbackLang);
                }
                if (fallbackMap.has(fbOtherKey)) {
                    NLang.#recordMissing(targetLang, `${cleanKey}.${category}`, 'fallback_used', fallbackLang);
                    return NLang.#interpolate(fallbackMap.get(fbOtherKey), params, fbOtherKey, fallbackLang);
                }
            }
        }

        NLang.#recordMissing(targetLang, `${cleanKey}.${category}`, 'missing_plural', null);
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
    static getMissing() {
        if (!NLang.#missingEntries) return [];
        return Array.from(NLang.#missingEntries.values()).map((entry) => ({ ...entry }));
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
    static clearMissing() {
        if (NLang.#missingEntries) {
            NLang.#missingEntries.clear();
            NLang.#missingEntries = null;
        }
        return NLang;
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
    static checkTranslations(referenceKeys = null) {
        const langs = NLang.#dictionaries ? Array.from(NLang.#dictionaries.keys()) : [];
        const keyKindsByLang = new Map();
        const allKeys = new Set();

        for (const lang of langs) {
            const kinds = new Map();
            NLang.#collectKeyKinds(NLang.#dictionaries.get(lang), '', kinds);
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
            const flat = NLang.#flatDictionaries?.get(lang);
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
            const presentSomewhere = langs.some((lang) => NLang.#flatDictionaries?.get(lang)?.has(k));
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
                const flat = NLang.#flatDictionaries?.get(lang);
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
     * @example <caption>Exemple 1 : Détruire l'instance NLang</caption>
     * lang.destroy();
     * console.log(lang.isDestroyed); // true
     *
     * @example <caption>Exemple 2 : Nettoyage avant fermeture</caption>
     * if (!lang.isDestroyed) lang.destroy();
     */
    static destroy() {
        NLang.#instanceGeneration += 1;
        NLang.#loadGenerations?.clear();
        NLang.#loadGenerations = null;
        NLang.#knownLanguages?.clear();
        NLang.#knownLanguages = null;
        NLang.#dictionaries?.clear();
        NLang.#dictionaries = null;
        NLang.#flatDictionaries?.clear();
        NLang.#flatDictionaries = null;
        NLang.#loadingPromises?.clear();
        NLang.#loadingPromises = null;
        NLang.#pluralRulesCache?.clear();
        NLang.#pluralRulesCache = null;
        NLang.#missingEntries?.clear();
        NLang.#missingEntries = null;
        NLang.#loader = null;
        NLang.#config = null;
        NLang.#currentLanguage = 'fr';
        NLang.#fallbackLanguage = 'en';
        NLang.#persist = true;
        NLang.#idbStoreName = 'ntable';
        NLang.#event?.removeAllListeners?.();
        NLang.#event = null;
    }

    // =========================================================================
    // Méthodes privées internes (Lazy Allocators & Helpers)
    // =========================================================================

    static #ensureKnownLanguages() {
        if (!NLang.#knownLanguages) NLang.#knownLanguages = new Set();
        return NLang.#knownLanguages;
    }

    static #ensureDictionaries() {
        if (!NLang.#dictionaries) NLang.#dictionaries = new Map();
        return NLang.#dictionaries;
    }

    static #ensureFlatDictionaries() {
        if (!NLang.#flatDictionaries) NLang.#flatDictionaries = new Map();
        return NLang.#flatDictionaries;
    }

    static #ensureLoadingPromises() {
        if (!NLang.#loadingPromises) NLang.#loadingPromises = new Map();
        return NLang.#loadingPromises;
    }

    static #ensurePluralRulesCache() {
        if (!NLang.#pluralRulesCache) NLang.#pluralRulesCache = new Map();
        return NLang.#pluralRulesCache;
    }

    static #ensureMissingEntries() {
        if (!NLang.#missingEntries) NLang.#missingEntries = new Map();
        return NLang.#missingEntries;
    }

    /**
     * Valide et normalise les options de configuration en retournant un objet figé.
     * @private
     */
    static #validateAndNormalizeConfig(rawOptions) {
        const opts = (rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions)) ? rawOptions : {};
        const allowedKeys = new Set([
            'language', 'fallback', 'missingBehavior', 'preserveUnknownParams',
            'logMissing', 'logMissingParameters', 'protectedLanguages', 'loader', 'languages',
            'persist', 'storeName'
        ]);
        for (const key of Object.keys(opts)) {
            if (!allowedKeys.has(key)) {
                NLog.warn(`NLang: Option de configuration inconnue "${key}".`);
            }
        }

        let language = opts.language !== undefined
            ? NLang.#normalizeLanguageCode(opts.language)
            : 'fr';
        if (!language) {
            NLog.warn(`NLang: Code de langue initiale invalide "${opts.language}", repli sur "fr".`);
            language = 'fr';
        }

        let fallback = 'en';
        if (opts.fallback === null) {
            fallback = null;
        } else if (opts.fallback !== undefined) {
            fallback = NLang.#normalizeLanguageCode(opts.fallback);
            if (!fallback) {
                NLog.warn(`NLang: Code de langue de secours invalide "${opts.fallback}", repli sur "en".`);
                fallback = 'en';
            }
        }

        let missingBehavior = opts.missingBehavior ?? 'key';
        if (missingBehavior !== 'key' && missingBehavior !== 'empty') {
            NLog.warn(`NLang: missingBehavior invalide "${missingBehavior}", repli sur "key".`);
            missingBehavior = 'key';
        }

        const protectedLanguages = [];
        if (Array.isArray(opts.protectedLanguages)) {
            for (const code of opts.protectedLanguages) {
                const norm = NLang.#normalizeLanguageCode(code);
                if (!norm) {
                    NLog.warn(`NLang: Code de langue protégée invalide "${code}" ignoré.`);
                    continue;
                }
                if (!protectedLanguages.includes(norm)) {
                    protectedLanguages.push(norm);
                }
            }
        }

        let loader = null;
        if (typeof opts.loader === 'function') {
            loader = opts.loader;
        } else if (opts.loader !== undefined && opts.loader !== null) {
            NLog.warn('NLang: loader doit être une fonction.');
        }

        const storeName = (typeof opts.storeName === 'string' && opts.storeName.trim())
            ? opts.storeName.trim()
            : 'ntable';

        return Object.freeze({
            language,
            fallback,
            missingBehavior,
            preserveUnknownParams: opts.preserveUnknownParams !== undefined ? Boolean(opts.preserveUnknownParams) : true,
            logMissing: Boolean(opts.logMissing),
            logMissingParameters: Boolean(opts.logMissingParameters),
            protectedLanguages: Object.freeze(protectedLanguages),
            loader,
            persist: opts.persist !== undefined ? Boolean(opts.persist) : true,
            storeName
        });
    }

    /**
     * Valide et normalise un code de langue selon les conventions BCP 47.
     * @private
     */
    static #normalizeLanguageCode(code) {
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
    static #isPlainObject(value) {
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
    static #deepMerge(target, source) {
        const out = {};
        if (NLang.#isPlainObject(target)) {
            for (const k of Object.keys(target)) {
                if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                    continue;
                }
                const v = target[k];
                out[k] = NLang.#isPlainObject(v) ? NLang.#deepMerge({}, v) : v;
            }
        }
        for (const k of Object.keys(source)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                continue;
            }
            const v = source[k];
            if (NLang.#isPlainObject(v) && NLang.#isPlainObject(out[k])) {
                out[k] = NLang.#deepMerge(out[k], v);
            } else if (NLang.#isPlainObject(v)) {
                out[k] = NLang.#deepMerge({}, v);
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
    static #flattenDictionary(obj, prefix, targetMap) {
        for (const k of Object.keys(obj)) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
                continue;
            }
            const v = obj[k];
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (NLang.#isPlainObject(v)) {
                NLang.#flattenDictionary(v, fullKey, targetMap);
            } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                if (targetMap.has(fullKey)) {
                    NLog.warn(`NLang: Collision de clé détectée pour "${fullKey}".`);
                    NLang.emit('error', { code: 'KEY_COLLISION', key: fullKey, message: `Collision de clé détectée pour "${fullKey}".` });
                }
                targetMap.set(fullKey, String(v));
            } else {
                NLog.warn(`NLang: Valeur de traduction invalide pour "${fullKey}".`);
            }
        }
    }

    /**
     * Collecte les types de chaque clé (feuille ou objet) pour `checkTranslations()`.
     * @private
     */
    static #collectKeyKinds(obj, prefix, kindsMap) {
        if (!NLang.#isPlainObject(obj)) return;
        for (const [k, v] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${k}` : k;
            if (NLang.#isPlainObject(v)) {
                kindsMap.set(fullKey, 'object');
                NLang.#collectKeyKinds(v, fullKey, kindsMap);
            } else {
                kindsMap.set(fullKey, typeof v);
            }
        }
    }

    /**
     * Remplace en une seule passe les paramètres `{param}` dans une chaîne traduite.
     * @private
     */
    static #interpolate(template, params, key, language) {
        if (typeof template !== 'string' || !template.includes('{')) {
            return template;
        }
        const p = (params && typeof params === 'object') ? params : {};
        return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, paramName) => {
            const hasKey = Object.prototype.hasOwnProperty.call(p, paramName);
            const val = hasKey ? p[paramName] : undefined;
            if (val === undefined || val === null) {
                if (NLang.#ensureConfig().logMissingParameters) {
                    NLog.warn(`NLang: Paramètre manquant "{${paramName}}" pour "${key}" (${language}).`);
                }
                NLang.emit('missingParameter', {
                    key,
                    language,
                    parameter: paramName
                });
                return NLang.#ensureConfig().preserveUnknownParams ? match : '';
            }
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                return String(val);
            }
            return NLang.#ensureConfig().preserveUnknownParams ? match : '';
        });
    }

    /**
     * Sélectionne la catégorie plurielle CLDR via `Intl.PluralRules` avec cache paresseux.
     * @private
     */
    static #selectPluralCategory(language, count) {
        if (typeof Intl === 'undefined' || typeof Intl.PluralRules !== 'function') {
            return count === 1 ? 'one' : 'other';
        }
        const cache = NLang.#ensurePluralRulesCache();
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
    static #recordMissing(language, key, type, fallbackUsed) {
        const missing = NLang.#ensureMissingEntries();
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
            if (NLang.#ensureConfig().logMissing) {
                NLog.warn(`NLang: Traduction manquante "${key}" pour "${language}" (${type}).`, entry);
            }
            NLang.emit('missingTranslation', entry);
        }
    }

    /**
     * Sauvegarde un dictionnaire de langue dans `NIndexedDB`.
     * @private
     * @param {string} code - Code de langue normalisé.
     * @param {Object} dictionary - Dictionnaire structuré.
     * @returns {Promise<boolean>}
     */
    static async #saveDictionaryToIdb(code, dictionary) {
        const idb = NIndexedDB.instance;
        if (!NLang.#persist || !idb?.isAvailable) {
            return false;
        }
        try {
            const res = await idb.put(
                NLang.#idbStoreName,
                { id: `__nlang_dict__:${code}`, code, dictionary, updatedAt: Date.now() },
                { encryptData: false, encryptKey: false }
            );
            return Boolean(res?.ok);
        } catch (err) {
            NLog.warn(`NLang: Échec de sauvegarde IndexedDB pour "${code}".`, err);
            return false;
        }
    }

    /**
     * Charge un dictionnaire de langue depuis `NIndexedDB`.
     * @private
     * @param {string} code - Code de langue normalisé.
     * @returns {Promise<Object|null>}
     */
    static async #loadDictionaryFromIdb(code) {
        const idb = NIndexedDB.instance;
        if (!NLang.#persist || !idb?.isAvailable) {
            return null;
        }
        try {
            const res = await idb.get(
                NLang.#idbStoreName,
                `__nlang_dict__:${code}`,
                { encryptData: false, encryptKey: false }
            );
            const dict = res?.ok ? res.data?.dictionary : null;
            return NLang.#isPlainObject(dict) ? dict : null;
        } catch {
            return null;
        }
    }

    /**
     * Supprime un dictionnaire de langue de `NIndexedDB`.
     * @private
     * @param {string} code - Code de langue normalisé.
     * @returns {Promise<boolean>}
     */
    static async #removeDictionaryFromIdb(code) {
        const idb = NIndexedDB.instance;
        if (!NLang.#persist || !idb?.isAvailable) {
            return false;
        }
        try {
            const res = await idb.delete(
                NLang.#idbStoreName,
                `__nlang_dict__:${code}`,
                { encryptData: false, encryptKey: false }
            );
            return Boolean(res?.ok);
        } catch {
            return false;
        }
    }

    /**
     * Sauvegarde le code de la langue active dans `NIndexedDB`.
     * @private
     * @param {string} code - Code de langue normalisé.
     * @returns {Promise<boolean>}
     */
    static async #saveCurrentLanguageToIdb(code) {
        const idb = NIndexedDB.instance;
        if (!NLang.#persist || !idb?.isAvailable) {
            return false;
        }
        try {
            const res = await idb.put(
                NLang.#idbStoreName,
                { id: '__nlang_current__', language: code, updatedAt: Date.now() },
                { encryptData: false, encryptKey: false }
            );
            return Boolean(res?.ok);
        } catch {
            return false;
        }
    }

    /**
     * Restaure le code de la langue active depuis `NIndexedDB`.
     * @private
     * @returns {Promise<string|null>}
     */
    static async #loadCurrentLanguageFromIdb() {
        const idb = NIndexedDB.instance;
        if (!NLang.#persist || !idb?.isAvailable) {
            return null;
        }
        try {
            const res = await idb.get(
                NLang.#idbStoreName,
                '__nlang_current__',
                { encryptData: false, encryptKey: false }
            );
            const raw = res?.ok ? res.data?.language : null;
            return raw ? NLang.#normalizeLanguageCode(raw) : null;
        } catch {
            return null;
        }
    }
}

NObject.registerLang(NLang);

export default NLang;
