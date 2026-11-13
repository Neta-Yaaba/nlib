/**
 * @file NString.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la manipulation, la validation, le nettoyage
 * et le formatage des chaînes de caractères dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

import { NUtil } from './NUtil.js';

/**
 * @class NString
 * @description Utilitaire de traitement de texte sans état interne.
 *
 * @example <caption>Exemple 1 : Nettoyage d'accents et génération d'un slug d'URL</caption>
 * const str = new NString();
 * const sansAccents = str.removeAccents('Écosystème Universel Événement');
 * const slug = str.slugify('Écosystème Universel Événement !');
 * console.log(sansAccents); // 'Ecosysteme Universel Evenement'
 * console.log(slug);        // 'ecosysteme-universel-evenement'
 *
 * @example <caption>Exemple 2 : Conversion de casse pour le code (camelCase, PascalCase, snake_case, kebab-case)</caption>
 * const str = new NString();
 * console.log(str.toCamelCase('date_creation_utilisateur'));  // 'dateCreationUtilisateur'
 * console.log(str.toPascalCase('date_creation_utilisateur')); // 'DateCreationUtilisateur'
 * console.log(str.toKebabCase('DateCreationUtilisateur'));    // 'date-creation-utilisateur'
 *
 * @example <caption>Exemple 3 : Interpolation de gabarit (template) et troncature</caption>
 * const str = new NString();
 * const message = str.template('Bonjour {nom}, vous avez {nb} messages.', { nom: 'Neta', nb: 5 });
 * console.log(str.truncate(message, 20)); // 'Bonjour Neta, vou...'
 */
export class NString {

    // =========================================================================
    // Méthodes publiques — Vérifications (Validation)
    // =========================================================================

    /**
     * Vérifie si la valeur fournie est strictement une chaîne de caractères (`string`).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `value` est une chaîne de caractères, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester une chaîne valide</caption>
     * const str = new NString();
     * console.log(str.isString('NLib')); // true
     * console.log(str.isString(''));     // true
     *
     * @example <caption>Exemple 2 : Tester des valeurs qui ne sont pas des chaînes</caption>
     * const str = new NString();
     * console.log(str.isString(123));  // false
     * console.log(str.isString(null)); // false
     */
    isString(value) {
        return typeof value === 'string' || value instanceof String;
    }

    /**
     * Vérifie si une chaîne est vide, `null`, `undefined` ou composée uniquement d'espaces blancs.
     *
     * @param {any} text - Texte à vérifier.
     * @returns {boolean} `true` si le texte est vide ou ne contient que des espaces, sinon `false`.
     *
     * @example <caption>Exemple 1 : Chaînes vides, espaces ou null</caption>
     * const str = new NString();
     * console.log(str.isEmpty(''));      // true
     * console.log(str.isEmpty('   '));   // true
     * console.log(str.isEmpty(null));    // true
     *
     * @example <caption>Exemple 2 : Chaîne contenant du texte</caption>
     * const str = new NString();
     * console.log(str.isEmpty('NLib'));  // false
     */
    isEmpty(text) {
        if (text === null || text === undefined) {
            return true;
        }
        return String(text).trim().length === 0;
    }

    /**
     * Vérifie si deux chaînes de caractères sont égales selon les options de comparaison fournies.
     *
     * @param {string} textA - Première chaîne à comparer.
     * @param {string} textB - Deuxième chaîne à comparer.
     * @param {Object} [options={}] - Options de comparaison.
     * @param {boolean} [options.caseSensitive=true] - Si `false`, ignore la différence majuscules/minuscules.
     * @param {boolean} [options.ignoreSpecialChars=false] - Si `true`, ignore les caractères spéciaux, ponctuations et espaces.
     * @param {boolean} [options.ignoreAccents=false] - Si `true`, ignore les accents et signes diacritiques.
     * @param {boolean} [options.ignoreSpaces=false] - Si `true`, ignore tous les espaces blancs.
     * @param {boolean} [options.trim=false] - Si `true`, ignore les espaces au début et à la fin.
     * @returns {boolean} `true` si les deux chaînes sont égales selon les options, sinon `false`.
     *
     * @example <caption>Exemple 1 : Comparaison stricte par défaut</caption>
     * const str = new NString();
     * console.log(str.equals('NLib', 'NLib')); // true
     * console.log(str.equals('NLib', 'nlib')); // false
     *
     * @example <caption>Exemple 2 : Comparaison insensible à la casse</caption>
     * const str = new NString();
     * console.log(str.equals('NLib', 'nlib', { caseSensitive: false })); // true
     *
     * @example <caption>Exemple 3 : Ignorer les caractères spéciaux, les accents et la casse</caption>
     * const str = new NString();
     * console.log(str.equals('Éléphant #1 !', 'elephant 1', {
     *     caseSensitive: false,
     *     ignoreSpecialChars: true,
     *     ignoreAccents: true
     * })); // true
     */
    equals(textA, textB, options = {}) {
        if (textA === null || textA === undefined || textB === null || textB === undefined) {
            return false;
        }
        const a = this.#prepareComparison(textA, options);
        const b = this.#prepareComparison(textB, options);
        return a === b;
    }

    /**
     * Vérifie si une chaîne contient une sous-chaîne donnée selon les options de comparaison fournies.
     *
     * @param {string} text - Texte source dans lequel chercher.
     * @param {string} search - Sous-chaîne recherchée.
     * @param {Object} [options={}] - Options de comparaison.
     * @param {boolean} [options.caseSensitive=true] - Si `false`, ignore la différence majuscules/minuscules.
     * @param {boolean} [options.ignoreSpecialChars=false] - Si `true`, ignore les caractères spéciaux, ponctuations et espaces.
     * @param {boolean} [options.ignoreAccents=false] - Si `true`, ignore les accents et signes diacritiques.
     * @param {boolean} [options.ignoreSpaces=false] - Si `true`, ignore tous les espaces blancs.
     * @returns {boolean} `true` si `search` est trouvé dans `text` selon les options, sinon `false`.
     *
     * @example <caption>Exemple 1 : Recherche sensible à la casse (par défaut)</caption>
     * const str = new NString();
     * console.log(str.contains('Architecture NLib', 'NLib')); // true
     * console.log(str.contains('Architecture NLib', 'nlib')); // false
     *
     * @example <caption>Exemple 2 : Recherche insensible à la casse et aux accents</caption>
     * const str = new NString();
     * console.log(str.contains('Écosystème NLib', 'ecosysteme', {
     *     caseSensitive: false,
     *     ignoreAccents: true
     * })); // true
     *
     * @example <caption>Exemple 3 : Recherche en ignorant les caractères spéciaux (tirets, espaces, symboles)</caption>
     * const str = new NString();
     * console.log(str.contains('Tel : +226 70-12-34-56', '701234', {
     *     ignoreSpecialChars: true
     * })); // true
     */
    contains(text, search, options = {}) {
        if (text === null || text === undefined || search === null || search === undefined) {
            return false;
        }
        const source = this.#prepareComparison(text, options);
        const target = this.#prepareComparison(search, options);
        if (target.length === 0) {
            return false;
        }
        return source.includes(target);
    }

    /**
     * Vérifie si une chaîne commence par un préfixe donné selon les options de comparaison fournies.
     *
     * @param {string} text - Texte source.
     * @param {string} prefix - Préfixe recherché.
     * @param {Object} [options={}] - Options de comparaison (`{ caseSensitive, ignoreSpecialChars, ignoreAccents, ignoreSpaces, trim }`).
     * @returns {boolean} `true` si `text` commence par `prefix` selon les options, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérification standard sensible à la casse</caption>
     * const str = new NString();
     * console.log(str.startsWith('NObject.js', 'NObject')); // true
     *
     * @example <caption>Exemple 2 : Vérification en ignorant la casse et les accents</caption>
     * const str = new NString();
     * console.log(str.startsWith('Événement système', 'evenement', {
     *     caseSensitive: false,
     *     ignoreAccents: true
     * })); // true
     */
    startsWith(text, prefix, options = {}) {
        if (text === null || text === undefined || prefix === null || prefix === undefined) {
            return false;
        }
        const source = this.#prepareComparison(text, options);
        const target = this.#prepareComparison(prefix, options);
        if (target.length === 0) {
            return false;
        }
        return source.startsWith(target);
    }

    /**
     * Vérifie si une chaîne se termine par un suffixe donné selon les options de comparaison fournies.
     *
     * @param {string} text - Texte source.
     * @param {string} suffix - Suffixe recherché.
     * @param {Object} [options={}] - Options de comparaison (`{ caseSensitive, ignoreSpecialChars, ignoreAccents, ignoreSpaces, trim }`).
     * @returns {boolean} `true` si `text` se termine par `suffix` selon les options, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier l'extension d'un fichier</caption>
     * const str = new NString();
     * console.log(str.endsWith('NString.js', '.js')); // true
     *
     * @example <caption>Exemple 2 : Vérification insensible à la casse</caption>
     * const str = new NString();
     * console.log(str.endsWith('IMAGE.PNG', '.png', { caseSensitive: false })); // true
     */
    endsWith(text, suffix, options = {}) {
        if (text === null || text === undefined || suffix === null || suffix === undefined) {
            return false;
        }
        const source = this.#prepareComparison(text, options);
        const target = this.#prepareComparison(suffix, options);
        if (target.length === 0) {
            return false;
        }
        return source.endsWith(target);
    }

    /**
     * Vérifie si une chaîne correspond au format d'une adresse e-mail valide.
     *
     * @param {string} text - Chaîne à tester.
     * @returns {boolean} `true` si le format e-mail est valide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Adresse e-mail valide</caption>
     * const str = new NString();
     * console.log(str.isEmail('contact@nlib.dev')); // true
     *
     * @example <caption>Exemple 2 : Adresse e-mail invalide</caption>
     * const str = new NString();
     * console.log(str.isEmail('contact@nlib')); // false
     */
    isEmail(text) {
        const source = String(text ?? '').trim();
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(source);
    }

    /**
     * Vérifie si une chaîne contient uniquement des caractères alphanumériques (lettres non accentuées et chiffres).
     *
     * @param {string} text - Chaîne à tester.
     * @returns {boolean} `true` si la chaîne est strictement alphanumérique et non vide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Chaîne alphanumérique valide</caption>
     * const str = new NString();
     * console.log(str.isAlphanumeric('NLib2026')); // true
     *
     * @example <caption>Exemple 2 : Chaîne contenant des symboles ou espaces</caption>
     * const str = new NString();
     * console.log(str.isAlphanumeric('NLib 2026!')); // false
     */
    isAlphanumeric(text) {
        const source = String(text ?? '');
        return /^[a-zA-Z0-9]+$/.test(source);
    }

    /**
     * Retourne la position (index) de la première (ou dernière) occurrence d'une sous-chaîne dans un texte,
     * ou `-1` si elle n'est pas trouvée.
     *
     * @param {string} text - Texte dans lequel chercher.
     * @param {string} search - Sous-chaîne recherchée.
     * @param {Object} [options={}] - Options de recherche.
     * @param {boolean} [options.caseSensitive=true] - Si `false`, ignore la différence majuscules/minuscules.
     * @param {boolean} [options.ignoreAccents=false] - Si `true`, ignore les accents.
     * @param {number} [options.fromIndex] - Position à partir de laquelle démarrer la recherche.
     * @param {boolean} [options.last=false] - Si `true`, recherche la dernière occurrence (`lastIndexOf`).
     * @returns {number} Index de l'occurrence trouvée, ou `-1` si absente.
     *
     * @example <caption>Exemple 1 : Recherche standard de la position d'un mot</caption>
     * const str = new NString();
     * console.log(str.indexOf('Architecture NLib', 'NLib')); // 13
     * console.log(str.indexOf('Architecture NLib', 'xyz'));  // -1
     *
     * @example <caption>Exemple 2 : Recherche insensible à la casse et aux accents</caption>
     * const str = new NString();
     * console.log(str.indexOf('Un Éléphant', 'elephant', {
     *     caseSensitive: false,
     *     ignoreAccents: true
     * })); // 3
     *
     * @example <caption>Exemple 3 : Recherche de la dernière occurrence (last: true)</caption>
     * const str = new NString();
     * console.log(str.indexOf('a/b/c', '/', { last: true })); // 3
     */
    indexOf(text, search, options = {}) {
        if (text === null || text === undefined || search === null || search === undefined) {
            return -1;
        }
        const opts = options ?? {};
        let source = String(text);
        let target = String(search);

        if (opts.ignoreAccents === true) {
            source = this.removeAccents(source);
            target = this.removeAccents(target);
        }
        if (opts.caseSensitive === false || opts.ignoreCase === true) {
            source = source.toLowerCase();
            target = target.toLowerCase();
        }

        if (opts.last === true) {
            return opts.fromIndex !== undefined
                ? source.lastIndexOf(target, Number(opts.fromIndex))
                : source.lastIndexOf(target);
        }
        return opts.fromIndex !== undefined
            ? source.indexOf(target, Number(opts.fromIndex))
            : source.indexOf(target);
    }

    // =========================================================================
    // Méthodes publiques — Transformations de Casse (Case Conversion)
    // =========================================================================

    /**
     * Convertit tous les caractères d'une chaîne en majuscules.
     *
     * @param {string} text - Texte à convertir.
     * @returns {string} Texte en majuscules.
     *
     * @example <caption>Exemple 1 : Conversion simple</caption>
     * const str = new NString();
     * console.log(str.toUpper('nlib')); // 'NLIB'
     *
     * @example <caption>Exemple 2 : Gestion sécurisée d'une valeur vide ou null</caption>
     * const str = new NString();
     * console.log(str.toUpper(null)); // ''
     */
    toUpper(text) {
        return String(text ?? '').toUpperCase();
    }

    /**
     * Convertit tous les caractères d'une chaîne en minuscules.
     *
     * @param {string} text - Texte à convertir.
     * @returns {string} Texte en minuscules.
     *
     * @example <caption>Exemple 1 : Conversion simple</caption>
     * const str = new NString();
     * console.log(str.toLower('NLIB')); // 'nlib'
     *
     * @example <caption>Exemple 2 : Normalisation d'une entrée utilisateur</caption>
     * const str = new NString();
     * console.log(str.toLower('Admin@Domaine.COM')); // 'admin@domaine.com'
     */
    toLower(text) {
        return String(text ?? '').toLowerCase();
    }

    /**
     * Met la première lettre de la chaîne en majuscule et le reste en minuscules.
     *
     * @param {string} text - Texte à formater.
     * @returns {string} Texte avec initiale majuscule.
     *
     * @example <caption>Exemple 1 : Mot tout en minuscules</caption>
     * const str = new NString();
     * console.log(str.capitalize('bonjour')); // 'Bonjour'
     *
     * @example <caption>Exemple 2 : Mot tout en majuscules</caption>
     * const str = new NString();
     * console.log(str.capitalize('BONJOUR MONDE')); // 'Bonjour monde'
     */
    capitalize(text) {
        const source = String(text ?? '');
        if (source.length === 0) {
            return '';
        }
        return source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
    }

    /**
     * Met la première lettre de chaque mot en majuscule.
     *
     * @param {string} text - Phrase ou groupe de mots à formater.
     * @returns {string} Texte en Title Case.
     *
     * @example <caption>Exemple 1 : Formater un titre</caption>
     * const str = new NString();
     * console.log(str.toTitleCase('bienvenue dans nlib')); // 'Bienvenue Dans Nlib'
     *
     * @example <caption>Exemple 2 : Formater un nom complet</caption>
     * const str = new NString();
     * console.log(str.toTitleCase('JEAN PIERRE')); // 'Jean Pierre'
     */
    toTitleCase(text) {
        const source = String(text ?? '').toLowerCase();
        return source.replace(/(?:^|\s|-|_)\S/g, (match) => match.toUpperCase());
    }

    /**
     * Convertit une chaîne (avec espaces, tirets ou underscores) en `camelCase`.
     *
     * @param {string} text - Texte à convertir.
     * @returns {string} Texte au format `camelCase`.
     *
     * @example <caption>Exemple 1 : Depuis du snake_case</caption>
     * const str = new NString();
     * console.log(str.toCamelCase('user_first_name')); // 'userFirstName'
     *
     * @example <caption>Exemple 2 : Depuis une phrase avec espaces ou tirets</caption>
     * const str = new NString();
     * console.log(str.toCamelCase('background-color-primary')); // 'backgroundColorPrimary'
     */
    toCamelCase(text) {
        const words = this.#splitWords(text);
        return words
            .map((word, index) => (index === 0 ? word.toLowerCase() : this.capitalize(word)))
            .join('');
    }

    /**
     * Convertit une chaîne en `PascalCase` (`UpperCamelCase`).
     *
     * @param {string} text - Texte à convertir.
     * @returns {string} Texte au format `PascalCase`.
     *
     * @example <caption>Exemple 1 : Depuis du kebab-case</caption>
     * const str = new NString();
     * console.log(str.toPascalCase('n-data-table')); // 'NDataTable'
     *
     * @example <caption>Exemple 2 : Depuis une chaîne avec espaces</caption>
     * const str = new NString();
     * console.log(str.toPascalCase('service utilisateur')); // 'ServiceUtilisateur'
     */
    toPascalCase(text) {
        const words = this.#splitWords(text);
        return words.map((word) => this.capitalize(word)).join('');
    }

    /**
     * Convertit une chaîne en `snake_case` (mots en minuscules séparés par `_`).
     *
     * @param {string} text - Texte à convertir.
     * @returns {string} Texte au format `snake_case`.
     *
     * @example <caption>Exemple 1 : Depuis du camelCase</caption>
     * const str = new NString();
     * console.log(str.toSnakeCase('dateCreationCompte')); // 'date_creation_compte'
     *
     * @example <caption>Exemple 2 : Depuis une phrase avec espaces</caption>
     * const str = new NString();
     * console.log(str.toSnakeCase('Code Postal Client')); // 'code_postal_client'
     */
    toSnakeCase(text) {
        return this.#splitWords(text).map((w) => w.toLowerCase()).join('_');
    }

    /**
     * Convertit une chaîne en `kebab-case` (mots en minuscules séparés par `-`).
     *
     * @param {string} text - Texte à convertir.
     * @returns {string} Texte au format `kebab-case`.
     *
     * @example <caption>Exemple 1 : Convertir une propriété CSS camelCase en kebab-case</caption>
     * const str = new NString();
     * console.log(str.toKebabCase('backgroundColor')); // 'background-color'
     *
     * @example <caption>Exemple 2 : Depuis du PascalCase</caption>
     * const str = new NString();
     * console.log(str.toKebabCase('NWindowManager')); // 'n-window-manager'
     */
    toKebabCase(text) {
        return this.#splitWords(text).map((w) => w.toLowerCase()).join('-');
    }

    // =========================================================================
    // Méthodes publiques — Nettoyage & Normalisation
    // =========================================================================

    /**
     * Supprime les espaces (ou une liste de caractères spécifiques) au début et à la fin d'une chaîne.
     *
     * @param {string} text - Texte à nettoyer.
     * @param {string|null} [chars=null] - Caractères spécifiques à retirer aux extrémités (si `null`, retire les espaces).
     * @returns {string} Texte nettoyé.
     *
     * @example <caption>Exemple 1 : Suppression des espaces en début et fin</caption>
     * const str = new NString();
     * console.log(str.trim('   NLib   ')); // 'NLib'
     *
     * @example <caption>Exemple 2 : Suppression de barres obliques '/' aux extrémités</caption>
     * const str = new NString();
     * console.log(str.trim('///api/v1/users///', '/')); // 'api/v1/users'
     */
    trim(text, chars = null) {
        const source = String(text ?? '');
        if (!chars) {
            return source.trim();
        }
        const escaped = String(chars).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`^[${escaped}]+|[${escaped}]+$`, 'g');
        return source.replace(regex, '');
    }

    /**
     * Supprime les espaces inutiles aux extrémités et remplace toutes les suites d'espaces multiples par un seul espace.
     *
     * @param {string} text - Texte à nettoyer.
     * @returns {string} Texte avec espacement normalisé.
     *
     * @example <caption>Exemple 1 : Nettoyer des espaces multiples</caption>
     * const str = new NString();
     * console.log(str.cleanSpaces('  Bonjour    tout   le   monde  ')); // 'Bonjour tout le monde'
     *
     * @example <caption>Exemple 2 : Nettoyer des tabulations et retours à la ligne</caption>
     * const str = new NString();
     * console.log(str.cleanSpaces('Ligne 1\n\t  Ligne 2')); // 'Ligne 1 Ligne 2'
     */
    cleanSpaces(text) {
        return String(text ?? '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Supprime tous les accents et signes diacritiques d'une chaîne (ex: `'é'` -> `'e'`, `'ç'` -> `'c'`).
     *
     * @param {string} text - Texte accentué.
     * @returns {string} Texte sans accents.
     *
     * @example <caption>Exemple 1 : Retirer les accents français</caption>
     * const str = new NString();
     * console.log(str.removeAccents('À bientôt à l\'école d\'été')); // 'A bientot a l\'ecole d\'ete'
     *
     * @example <caption>Exemple 2 : Normaliser pour une recherche</caption>
     * const str = new NString();
     * console.log(str.removeAccents('Cœur & Ça')); // 'Coeur & Ca'
     */
    removeAccents(text) {
        return String(text ?? '')
            .replace(/œ/g, 'oe')
            .replace(/Œ/g, 'OE')
            .replace(/æ/g, 'ae')
            .replace(/Æ/g, 'AE')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Transforme n'importe quel texte en identifiant d'URL propre (`slug`), sans accents ni caractères spéciaux.
     *
     * @param {string} text - Texte à convertir en slug.
     * @param {string} [separator='-'] - Caractère séparateur (par défaut `'-'`).
     * @returns {string} Slug normalisé en minuscules.
     *
     * @example <caption>Exemple 1 : Générer un slug d'article avec tirets</caption>
     * const str = new NString();
     * console.log(str.slugify('L\'architecture NLib : 100% Hors-Ligne !'));
     * // 'l-architecture-nlib-100-hors-ligne'
     *
     * @example <caption>Exemple 2 : Générer un slug avec underscore '_'</caption>
     * const str = new NString();
     * console.log(str.slugify('Catégorie : Électronique & Audio', '_'));
     * // 'categorie_electronique_audio'
     */
    slugify(text, separator = '-') {
        const sep = String(separator || '-');
        const escapedSep = sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return this.removeAccents(text)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, sep)
            .replace(new RegExp(`^${escapedSep}+|${escapedSep}+$`, 'g'), '');
    }

    /**
     * Échappe les caractères spéciaux HTML (`&`, `<`, `>`, `"`, `'`) pour prévenir les injections XSS.
     *
     * @param {string} text - Texte brut potentiellement dangereux.
     * @returns {string} Texte sécurisé avec entités HTML.
     *
     * @example <caption>Exemple 1 : Neutraliser une balise script</caption>
     * const str = new NString();
     * console.log(str.escapeHtml('<script>alert("XSS")</script>'));
     * // '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
     *
     * @example <caption>Exemple 2 : Échapper une chaîne contenant des esperluettes et apostrophes</caption>
     * const str = new NString();
     * console.log(str.escapeHtml("L'eau & le feu")); // 'L&#39;eau &amp; le feu'
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return String(text ?? '').replace(/[&<>"']/g, (ch) => map[ch]);
    }

    /**
     * Décode les entités HTML de base (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) vers leurs caractères d'origine.
     *
     * @param {string} text - Texte contenant des entités HTML.
     * @returns {string} Texte décodé.
     *
     * @example <caption>Exemple 1 : Décoder des balises échappées</caption>
     * const str = new NString();
     * console.log(str.unescapeHtml('&lt;div&gt;Test&lt;/div&gt;')); // '<div>Test</div>'
     *
     * @example <caption>Exemple 2 : Décoder les guillemets et esperluettes</caption>
     * const str = new NString();
     * console.log(str.unescapeHtml('A &amp; B &quot;OK&quot;')); // 'A & B "OK"'
     */
    unescapeHtml(text) {
        const map = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'"
        };
        return String(text ?? '').replace(/&(amp|lt|gt|quot|#39);/g, (entity) => map[entity]);
    }

    // =========================================================================
    // Méthodes publiques — Découpage, Formatage & Extraction
    // =========================================================================

    /**
     * Découpe une chaîne de caractères en un tableau de sous-chaînes selon un séparateur donné.
     *
     * @param {string} text - Texte à découper.
     * @param {string|RegExp} [separator=' '] - Délimiteur de découpage.
     * @param {number} [limit] - Nombre maximal d'éléments à retourner dans le tableau.
     * @returns {string[]} Tableau contenant les segments découpés.
     *
     * @example <caption>Exemple 1 : Découper une liste séparée par des virgules</caption>
     * const str = new NString();
     * console.log(str.split('pomme,banane,orange', ',')); // ['pomme', 'banane', 'orange']
     *
     * @example <caption>Exemple 2 : Découper avec une limite maximale de segments</caption>
     * const str = new NString();
     * console.log(str.split('a-b-c-d', '-', 2)); // ['a', 'b']
     */
    split(text, separator = ' ', limit = undefined) {
        const source = String(text ?? '');
        if (source === '') {
            return [];
        }
        return limit !== undefined
            ? source.split(separator, limit)
            : source.split(separator);
    }

    /**
     * Découpe une chaîne selon un séparateur et retourne directement l'élément situé à l'index demandé.
     * Supporte les index positifs (`0` = premier élément) ainsi que les index négatifs (`-1` = dernier élément).
     *
     * @param {string} text - Texte à découper.
     * @param {string|RegExp} separator - Délimiteur de découpage.
     * @param {number} index - Position de l'élément souhaité (positif depuis le début, négatif depuis la fin).
     * @param {any} [defaultValue=null] - Valeur retournée si l'index n'existe pas.
     * @returns {string|any} L'élément trouvé à l'index donné ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Récupérer un élément par son index positif</caption>
     * const str = new NString();
     * console.log(str.splitAt('2026-11-10', '-', 0)); // '2026'
     * console.log(str.splitAt('2026-11-10', '-', 1)); // '11'
     *
     * @example <caption>Exemple 2 : Récupérer le dernier élément avec un index négatif (-1)</caption>
     * const str = new NString();
     * console.log(str.splitAt('packages/js/backend/NString.js', '/', -1)); // 'NString.js'
     *
     * @example <caption>Exemple 3 : Valeur par défaut lorsque l'index est hors limites</caption>
     * const str = new NString();
     * console.log(str.splitAt('a:b', ':', 5, 'aucun')); // 'aucun'
     */
    splitAt(text, separator, index, defaultValue = null) {
        const parts = this.split(text, separator);
        if (parts.length === 0) {
            return defaultValue;
        }
        const idx = Number(index);
        if (Number.isNaN(idx)) {
            return defaultValue;
        }
        const resolvedIndex = idx < 0 ? parts.length + idx : idx;
        return resolvedIndex >= 0 && resolvedIndex < parts.length
            ? parts[resolvedIndex]
            : defaultValue;
    }

    /**
     * Insère un caractère ou un texte de manière répétée tous les `step` caractères dans une chaîne
     * (ex: `'12003'` avec un pas de `2` et `' '` donne `'12 00 3'`).
     *
     * @param {string|number} text - Chaîne ou nombre à formater.
     * @param {number} [step=2] - Nombre de caractères par groupe avant chaque insertion (entier >= 1).
     * @param {string} [separator=' '] - Caractère ou texte à insérer entre chaque groupe.
     * @param {boolean} [fromEnd=false] - Si `true`, regroupe en partant de la fin de la chaîne (droite vers gauche).
     * @returns {string} Chaîne formatée avec le séparateur répété.
     *
     * @example <caption>Exemple 1 : Grouper par pas de 2 depuis la gauche ('12003' -> '12 00 3')</caption>
     * const str = new NString();
     * console.log(str.insertEvery('12003', 2, ' ')); // '12 00 3'
     *
     * @example <caption>Exemple 2 : Formater un numéro ou code avec un tiret tous les 4 caractères</caption>
     * const str = new NString();
     * console.log(str.insertEvery('ABCD1234EFGH', 4, '-')); // 'ABCD-1234-EFGH'
     *
     * @example <caption>Exemple 3 : Grouper en partant de la droite (fromEnd = true, ex: milliers)</caption>
     * const str = new NString();
     * console.log(str.insertEvery('12003', 3, ' ', true)); // '12 003'
     */
    insertEvery(text, step = 2, separator = ' ', fromEnd = false) {
        const chars = Array.from(String(text ?? ''));
        const size = Math.floor(Number(step) || 0);
        if (chars.length === 0 || size <= 0 || chars.length <= size) {
            return chars.join('');
        }
        const sep = String(separator ?? ' ');
        const groups = [];

        if (fromEnd) {
            for (let i = chars.length; i > 0; i -= size) {
                const start = Math.max(0, i - size);
                groups.unshift(chars.slice(start, i).join(''));
            }
        } else {
            for (let i = 0; i < chars.length; i += size) {
                groups.push(chars.slice(i, i + size).join(''));
            }
        }
        return groups.join(sep);
    }

    /**
     * Tronque une chaîne à une longueur maximale donnée et ajoute un suffixe si elle dépasse cette longueur.
     *
     * @param {string} text - Texte à tronquer.
     * @param {number} maxLength - Longueur maximale totale (incluant la taille du suffixe).
     * @param {string} [suffix='...'] - Suffixe ajouté en cas de troncature.
     * @returns {string} Texte tronqué ou texte original s'il est déjà assez court.
     *
     * @example <caption>Exemple 1 : Troncature avec le suffixe par défaut '...'</caption>
     * const str = new NString();
     * console.log(str.truncate('Documentation complète de NLib', 16)); // 'Documentation...'
     *
     * @example <caption>Exemple 2 : Troncature avec un suffixe personnalisé</caption>
     * const str = new NString();
     * console.log(str.truncate('Texte très long à couper', 12, ' [suite]')); // 'Text [suite]'
     */
    truncate(text, maxLength, suffix = '...') {
        const source = String(text ?? '');
        const end = String(suffix ?? '...');
        if (source.length <= maxLength) {
            return source;
        }
        const sliceLength = Math.max(0, maxLength - end.length);
        return source.slice(0, sliceLength) + end;
    }

    /**
     * Complète une chaîne par la gauche jusqu'à atteindre la longueur souhaitée.
     *
     * @param {string|number} text - Texte ou nombre à formater.
     * @param {number} length - Longueur finale souhaitée.
     * @param {string} [padChar=' '] - Caractère de remplissage.
     * @returns {string} Chaîne complétée à gauche.
     *
     * @example <caption>Exemple 1 : Formater un numéro avec des zéros en tête</caption>
     * const str = new NString();
     * console.log(str.padStart(42, 5, '0')); // '00042'
     *
     * @example <caption>Exemple 2 : Aligner un texte à droite avec des espaces</caption>
     * const str = new NString();
     * console.log(str.padStart('NLib', 8, ' ')); // '    NLib'
     */
    padStart(text, length, padChar = ' ') {
        const len = Math.max(0, Math.floor(Number(length) || 0));
        try {
            return String(text ?? '').padStart(len, String(padChar || ' '));
        } catch (err) {
            NUtil.log.warn('NString.padStart: Paramètre de remplissage invalide.', {
                code: 'WARN_STRING_PAD_ERROR',
                length,
                cause: err
            });
            return String(text ?? '');
        }
    }

    /**
     * Complète une chaîne par la droite jusqu'à atteindre la longueur souhaitée.
     *
     * @param {string|number} text - Texte ou nombre à formater.
     * @param {number} length - Longueur finale souhaitée.
     * @param {string} [padChar=' '] - Caractère de remplissage.
     * @returns {string} Chaîne complétée à droite.
     *
     * @example <caption>Exemple 1 : Compléter avec des points</caption>
     * const str = new NString();
     * console.log(str.padEnd('Chargement', 13, '.')); // 'Chargement...'
     *
     * @example <caption>Exemple 2 : Aligner une colonne de texte</caption>
     * const str = new NString();
     * console.log(str.padEnd('ID', 6, ' ') + '| Nom'); // 'ID    | Nom'
     */
    padEnd(text, length, padChar = ' ') {
        const len = Math.max(0, Math.floor(Number(length) || 0));
        try {
            return String(text ?? '').padEnd(len, String(padChar || ' '));
        } catch (err) {
            NUtil.log.warn('NString.padEnd: Paramètre de remplissage invalide.', {
                code: 'WARN_STRING_PAD_ERROR',
                length,
                cause: err
            });
            return String(text ?? '');
        }
    }

    /**
     * Répète une chaîne un nombre donné de fois.
     *
     * @param {string} text - Chaîne à répéter.
     * @param {number} count - Nombre de répétitions (entier >= 0).
     * @returns {string} Chaîne répétée.
     *
     * @example <caption>Exemple 1 : Créer une ligne de séparation</caption>
     * const str = new NString();
     * console.log(str.repeat('-', 10)); // '----------'
     *
     * @example <caption>Exemple 2 : Répéter un motif</caption>
     * const str = new NString();
     * console.log(str.repeat('ab', 3)); // 'ababab'
     */
    repeat(text, count) {
        const n = Math.max(0, Math.floor(Number(count) || 0));
        try {
            return String(text ?? '').repeat(n);
        } catch (err) {
            NUtil.log.warn('NString.repeat: Valeur de répétition invalide ou excessive.', {
                code: 'WARN_STRING_REPEAT_ERROR',
                count,
                cause: err
            });
            return '';
        }
    }

    /**
     * Inverse l'ordre des caractères d'une chaîne (en respectant les caractères Unicode).
     *
     * @param {string} text - Texte à inverser.
     * @returns {string} Texte inversé.
     *
     * @example <caption>Exemple 1 : Inverser un mot</caption>
     * const str = new NString();
     * console.log(str.reverse('NLib')); // 'biLN'
     *
     * @example <caption>Exemple 2 : Vérifier un palindrome</caption>
     * const str = new NString();
     * console.log(str.reverse('radar') === 'radar'); // true
     */
    reverse(text) {
        return Array.from(String(text ?? '')).reverse().join('');
    }

    /**
     * Remplace toutes les occurrences d'une sous-chaîne par une autre.
     *
     * @param {string} text - Texte source.
     * @param {string} search - Sous-chaîne à remplacer.
     * @param {string} replacement - Chaîne de remplacement.
     * @returns {string} Texte modifié.
     *
     * @example <caption>Exemple 1 : Remplacer un mot partout dans une phrase</caption>
     * const str = new NString();
     * console.log(str.replaceAll('a-b-c', '-', '_')); // 'a_b_c'
     *
     * @example <caption>Exemple 2 : Supprimer toutes les occurrences d'une sous-chaîne</caption>
     * const str = new NString();
     * console.log(str.replaceAll('12 34 56', ' ', '')); // '123456'
     */
    replaceAll(text, search, replacement) {
        const source = String(text ?? '');
        const target = String(search ?? '');
        if (target === '') {
            return source;
        }
        return source.split(target).join(String(replacement ?? ''));
    }

    /**
     * Remplace les espaces réservés `{cle}` ou `{{cle}}` dans un texte par les valeurs correspondantes d'un objet.
     *
     * @param {string} text - Gabarit de texte contenant des balises `{cle}` ou `{{cle}}`.
     * @param {Object<string, any>} [data={}] - Dictionnaire des valeurs à injecter.
     * @returns {string} Texte interpolé.
     *
     * @example <caption>Exemple 1 : Interpolation avec accolades simples {cle}</caption>
     * const str = new NString();
     * const res = str.template('Serveur {host} lancé sur le port {port}', { host: 'localhost', port: 8080 });
     * console.log(res); // 'Serveur localhost lancé sur le port 8080'
     *
     * @example <caption>Exemple 2 : Interpolation avec doubles accolades {{cle}}</caption>
     * const str = new NString();
     * console.log(str.template('Bonjour {{utilisateur}} !', { utilisateur: 'Neta' })); // 'Bonjour Neta !'
     */
    template(text, data = {}) {
        const source = String(text ?? '');
        if (!data || typeof data !== 'object') {
            return source;
        }
        return source.replace(/\{\{?\s*([a-zA-Z0-9_]+)\s*\}?\}/g, (match, key) => {
            return Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined && data[key] !== null
                ? String(data[key])
                : match;
        });
    }

    /**
     * Masque une partie d'une chaîne de caractères (numéro de téléphone, carte bancaire, identifiant, secret)
     * avec un caractère de remplacement tout en laissant visibles le début et/ou la fin.
     *
     * @param {string|number} text - Chaîne ou nombre à masquer.
     * @param {Object} [options={}] - Options de masquage.
     * @param {number} [options.visibleStart=0] - Nombre de caractères laissés visibles au début.
     * @param {number} [options.visibleEnd=4] - Nombre de caractères laissés visibles à la fin.
     * @param {string} [options.maskChar='*'] - Caractère utilisé pour le masquage.
     * @returns {string} Chaîne masquée.
     *
     * @example <caption>Exemple 1 : Masquer un numéro en gardant uniquement les 4 derniers chiffres (par défaut)</caption>
     * const str = new NString();
     * console.log(str.mask('4532015112830366')); // '************0366'
     *
     * @example <caption>Exemple 2 : Garder les 2 premiers et les 2 derniers caractères visibles</caption>
     * const str = new NString();
     * console.log(str.mask('70123456', { visibleStart: 2, visibleEnd: 2 })); // '70****56'
     *
     * @example <caption>Exemple 3 : Masquer avec un caractère personnalisé '#'</caption>
     * const str = new NString();
     * console.log(str.mask('SECRET2026', { visibleStart: 0, visibleEnd: 4, maskChar: '#' })); // '######2026'
     */
    mask(text, options = {}) {
        const chars = Array.from(String(text ?? ''));
        if (chars.length === 0) {
            return '';
        }
        const opts = options ?? {};
        const startCount = Math.max(0, Math.floor(Number(opts.visibleStart ?? 0)));
        const endCount = Math.max(0, Math.floor(Number(opts.visibleEnd ?? 4)));
        const maskSymbol = String(opts.maskChar || '*').charAt(0) || '*';

        if (startCount + endCount >= chars.length) {
            return chars.join('');
        }

        const startPart = chars.slice(0, startCount).join('');
        const endPart = endCount > 0 ? chars.slice(chars.length - endCount).join('') : '';
        const maskedLength = chars.length - startCount - endCount;

        return startPart + maskSymbol.repeat(maskedLength) + endPart;
    }

    /**
     * Compte le nombre d'occurrences d'une sous-chaîne à l'intérieur d'un texte selon les options fournies.
     *
     * @param {string} text - Texte dans lequel compter.
     * @param {string} subString - Sous-chaîne à dénombrer.
     * @param {Object} [options={}] - Options de comparaison (`{ caseSensitive, ignoreSpecialChars, ignoreAccents, ignoreSpaces }`).
     * @returns {number} Nombre d'occurrences trouvées.
     *
     * @example <caption>Exemple 1 : Compter une syllabe (sensible à la casse par défaut)</caption>
     * const str = new NString();
     * console.log(str.countOccurrences('banane', 'an')); // 2
     *
     * @example <caption>Exemple 2 : Compter en ignorant la casse et les accents</caption>
     * const str = new NString();
     * console.log(str.countOccurrences('Été, été, ETE', 'ete', {
     *     caseSensitive: false,
     *     ignoreAccents: true
     * })); // 3
     */
    countOccurrences(text, subString, options = {}) {
        if (text === null || text === undefined || subString === null || subString === undefined) {
            return 0;
        }
        const source = this.#prepareComparison(text, options);
        const target = this.#prepareComparison(subString, options);
        if (target.length === 0 || source.length === 0) {
            return 0;
        }
        return source.split(target).length - 1;
    }

    /**
     * Compte le nombre de mots présents dans une chaîne de caractères.
     *
     * @param {string} text - Texte à analyser.
     * @returns {number} Nombre de mots.
     *
     * @example <caption>Exemple 1 : Phrase standard</caption>
     * const str = new NString();
     * console.log(str.wordCount('NLib est un écosystème universel')); // 5
     *
     * @example <caption>Exemple 2 : Chaîne vide ou composée d'espaces</caption>
     * const str = new NString();
     * console.log(str.wordCount('    ')); // 0
     */
    wordCount(text) {
        const cleaned = this.cleanSpaces(text);
        if (cleaned.length === 0) {
            return 0;
        }
        return cleaned.split(' ').length;
    }

    /**
     * Génère une chaîne aléatoire de la longueur demandée à partir d'un alphabet donné.
     *
     * @param {number} [length=16] - Longueur de la chaîne à générer.
     * @param {string} [charset='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'] - Alphabet utilisé.
     * @returns {string} Chaîne aléatoire générée.
     *
     * @example <caption>Exemple 1 : Générer un identifiant alphanumérique de 12 caractères</caption>
     * const str = new NString();
     * const code = str.random(12);
     * console.log(code.length); // 12
     *
     * @example <caption>Exemple 2 : Générer un code PIN numérique à 6 chiffres</caption>
     * const str = new NString();
     * const pin = str.random(6, '0123456789');
     * console.log(pin.length); // 6
     */
    random(length = 16, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        const size = Math.max(0, Math.floor(Number(length) || 0));
        const chars = String(charset || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
        if (size === 0 || chars.length === 0) {
            return '';
        }
        let result = '';
        for (let i = 0; i < size; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            result += chars.charAt(randomIndex);
        }
        return result;
    }

    // =========================================================================
    // Méthodes privées (Découpage et normalisation interne sans état)
    // =========================================================================

    /**
     * Normalise une chaîne selon les options de comparaison (`caseSensitive`, `ignoreSpecialChars`,
     * `ignoreAccents`, `ignoreSpaces`, `trim`).
     *
     * @private
     * @param {string} text - Texte à préparer.
     * @param {Object|boolean} [options={}] - Objet d'options (ou booléen `caseSensitive`).
     * @returns {string} Chaîne prête à être comparée.
     *
     * @example <caption>Exemple 1 : Normalisation avec options</caption>
     * // this.#prepareComparison('Éléphant !', { caseSensitive: false, ignoreSpecialChars: true }) -> 'elephant'
     *
     * @example <caption>Exemple 2 : Normalisation standard par défaut</caption>
     * // this.#prepareComparison('NLib') -> 'NLib'
     */
    #prepareComparison(text, options = {}) {
        const opts = typeof options === 'boolean'
            ? { caseSensitive: options }
            : (options ?? {});

        let result = String(text ?? '');

        if (opts.trim === true) {
            result = result.trim();
        }
        if (opts.ignoreAccents === true || opts.ignoreSpecialChars === true) {
            result = this.removeAccents(result);
        }
        if (opts.ignoreSpecialChars === true) {
            result = result.replace(/[^a-zA-Z0-9]/g, '');
        } else if (opts.ignoreSpaces === true) {
            result = result.replace(/\s+/g, '');
        }
        if (opts.caseSensitive === false || opts.ignoreCase === true) {
            result = result.toLowerCase();
        }

        return result;
    }

    /**
     * Découpe n'importe quelle chaîne (`camelCase`, `PascalCase`, `snake_case`, `kebab-case`, phrase)
     * en un tableau de mots propres.
     *
     * @private
     * @param {string} text - Texte à découper.
     * @returns {string[]} Tableau de mots.
     *
     * @example <caption>Exemple 1 : Découpage interne d'un identifiant camelCase</caption>
     * // this.#splitWords('monTexteTest') -> ['mon', 'Texte', 'Test']
     *
     * @example <caption>Exemple 2 : Découpage interne d'une chaîne snake_case</caption>
     * // this.#splitWords('mon_texte_test') -> ['mon', 'texte', 'test']
     */
    #splitWords(text) {
        const clean = this.removeAccents(String(text ?? ''))
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .replace(/[^a-zA-Z0-9]+/g, ' ')
            .trim();
        return clean ? clean.split(/\s+/) : [];
    }
}

export default NString;

