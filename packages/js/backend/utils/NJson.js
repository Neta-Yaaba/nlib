/**
 * @file NJson.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation, la sérialisation sécurisée (gestion des
 * références circulaires, `BigInt`, `Map`, `Set`), la désérialisation tolérante aux erreurs,
 * le clonage profond, la fusion, la comparaison, l'accès par chemin (`a.b.c`) et la transformation
 * de données JSON dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

import { NUtil } from './NUtil.js';

/**
 * @class NJson
 * @description Utilitaire de gestion, manipulation et sérialisation de structures JSON sans état interne.
 *
 * @example <caption>Exemple 1 : Analyse sécurisée (parse), sérialisation (stringify) et validation</caption>
 * const jsonUtil = new NJson();
 * console.log(jsonUtil.isValid('{"id":1,"name":"NLib"}')); // true
 * console.log(jsonUtil.parse('invalide', { default: true })); // { default: true }
 * console.log(jsonUtil.stringify({ b: 2, a: 1 }, { sortKeys: true })); // '{"a":1,"b":2}'
 *
 * @example <caption>Exemple 2 : Lecture, écriture et suppression par clé littérale (string) ou tableau de chemin imbriqué</caption>
 * const jsonUtil = new NJson();
 * const data = { 'cle.cle.cle': 'valeurSimple', user: { profile: { name: 'Neta' } } };
 * console.log(jsonUtil.get(data, 'cle.cle.cle'));                // 'valeurSimple' (clé littérale unique)
 * console.log(jsonUtil.get(data, ['user', 'profile', 'name'])); // 'Neta' (chemin imbriqué via tableau)
 * jsonUtil.set(data, ['user', 'settings', 'theme'], 'dark');
 * console.log(data.user.settings.theme); // 'dark'
 *
 * @example <caption>Exemple 3 : Clonage profond, fusion profonde (merge) et aplatissement (flatten)</caption>
 * const jsonUtil = new NJson();
 * const merged = jsonUtil.merge({ a: 1, cfg: { x: 10 } }, { cfg: { y: 20 } });
 * console.log(merged); // { a: 1, cfg: { x: 10, y: 20 } }
 * console.log(jsonUtil.flatten(merged)); // { a: 1, 'cfg.x': 10, 'cfg.y': 20 }
 */
export class NJson {

    // =========================================================================
    // Méthodes privées internes (Tri de clés & Helpers sans état)
    // =========================================================================

    /**
     * Trie récursivement les clés d'un objet par ordre alphabétique.
     *
     * @param {any} value - Valeur ou objet dont les clés doivent être triées.
     * @param {WeakSet} [seen=new WeakSet()] - Ensemble de suivi pour éviter les boucles infinies.
     * @returns {any} Valeur avec clés d'objets triées.
     *
     * @example <caption>Exemple 1 : Trier un objet</caption>
     * // Interne : #sortObjectKeys({ b: 1, a: 2 }) -> { a: 2, b: 1 }
     *
     * @example <caption>Exemple 2 : Tableau d'objets</caption>
     * // Interne : #sortObjectKeys([{ z: 1, a: 2 }]) -> [{ a: 2, z: 1 }]
     */
    #sortObjectKeys(value, seen = new WeakSet()) {
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (seen.has(value)) {
            return '[Circular]';
        }
        seen.add(value);

        if (Array.isArray(value)) {
            return value.map((item) => this.#sortObjectKeys(item, seen));
        }
        if (value instanceof Date) {
            return value.toISOString();
        }

        const sorted = {};
        const keys = Object.keys(value).sort();
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            sorted[k] = this.#sortObjectKeys(value[k], seen);
        }
        return sorted;
    }

    /**
     * Normalise un chemin ou une clé en un tableau de segments.
     * Si une chaîne est fournie (ex: `'cle.cle.cle'`), elle est conservée telle quelle comme une seule clé littérale en chaîne.
     * Pour naviguer dans des niveaux imbriqués, un tableau de clés/indices doit être fourni directement (ex: `['user', 'profile', 'name']`).
     *
     * @param {string|number|Array<string|number>} path - Clé unique littérale ou tableau de segments hiérarchiques.
     * @returns {Array<string>} Tableau des segments de clés.
     *
     * @example <caption>Exemple 1 : Clé littérale sous forme de chaîne (y compris contenant des points) ou nombre</caption>
     * // Interne : #normalizePath('cle.cle.cle') -> ['cle.cle.cle']
     * // Interne : #normalizePath(1)             -> ['1']
     *
     * @example <caption>Exemple 2 : Tableau pour la navigation hiérarchique imbriquée</caption>
     * // Interne : #normalizePath(['user', 'profile', 'name']) -> ['user', 'profile', 'name']
     * // Interne : #normalizePath(['users', 1, 'name'])        -> ['users', '1', 'name']
     */
    #normalizePath(path) {
        if (typeof path === 'string') {
            return path.length > 0 ? [path] : [];
        }
        if (typeof path === 'number' && Number.isFinite(path)) {
            return [String(Math.trunc(path))];
        }
        if (Array.isArray(path)) {
            const result = [];
            for (let i = 0; i < path.length; i++) {
                const item = path[i];
                if (typeof item === 'number' && Number.isFinite(item)) {
                    result.push(String(Math.trunc(item)));
                } else if (typeof item === 'string' && item.length > 0) {
                    result.push(item);
                }
            }
            return result;
        }
        return [];
    }

    // =========================================================================
    // Méthodes publiques — Validation & Vérifications de Types JSON
    // =========================================================================

    /**
     * Vérifie si une chaîne de caractères est un JSON syntaxiquement valide.
     *
     * @param {any} str - Chaîne de caractères à tester.
     * @param {Object} [options={}] - Options de validation.
     * @param {boolean} [options.requireObjectOrArray=false] - Si `true`, exige que le JSON décodé soit un objet `{}` ou un tableau `[]` (rejette `'123'` ou `'true'`).
     * @returns {boolean} `true` si la chaîne est un JSON valide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Chaînes JSON valides</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.isValid('{"nom":"NLib","version":1}')); // true
     * console.log(jsonUtil.isValid('[1, 2, 3]'));                  // true
     *
     * @example <caption>Exemple 2 : Exiger un objet ou tableau</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.isValid('42', { requireObjectOrArray: true })); // false
     * console.log(jsonUtil.isValid('{bad json}'));                         // false
     */
    isValid(str, options = {}) {
        if (typeof str !== 'string' || str.trim().length === 0) {
            return false;
        }
        try {
            const parsed = JSON.parse(str);
            if (options?.requireObjectOrArray === true) {
                return parsed !== null && typeof parsed === 'object';
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Vérifie si la valeur fournie est un objet JavaScript pur (`Plain Object` `{}`),
     * ni `null`, ni un tableau, ni une instance de `Date` / `RegExp` / `Map` / `Set`.
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `value` est un objet simple `{}`.
     *
     * @example <caption>Exemple 1 : Objet simple valide</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.isPlainObject({ id: 1 })); // true
     *
     * @example <caption>Exemple 2 : Tableaux, null ou Date retournent false</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.isPlainObject([1, 2]));     // false
     * console.log(jsonUtil.isPlainObject(new Date())); // false
     * console.log(jsonUtil.isPlainObject(null));       // false
     */
    isPlainObject(value) {
        if (value === null || typeof value !== 'object') {
            return false;
        }
        const proto = Object.getPrototypeOf(value);
        return proto === null || proto === Object.prototype;
    }

    /**
     * Vérifie si un objet JSON, un tableau ou une chaîne JSON est vide.
     *
     * @param {any} value - Objet, tableau ou chaîne JSON à tester.
     * @returns {boolean} `true` si la structure est vide ou nulle, sinon `false`.
     *
     * @example <caption>Exemple 1 : Structures vides</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.isEmpty({}));   // true
     * console.log(jsonUtil.isEmpty([]));   // true
     * console.log(jsonUtil.isEmpty('{}')); // true
     *
     * @example <caption>Exemple 2 : Structures non vides</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.isEmpty({ a: 1 })); // false
     * console.log(jsonUtil.isEmpty('[1]'));    // false
     */
    isEmpty(value) {
        if (value === null || value === undefined) {
            return true;
        }
        const target = typeof value === 'string' ? this.parse(value, null) : value;
        if (target === null || target === undefined) {
            return true;
        }
        if (Array.isArray(target)) {
            return target.length === 0;
        }
        if (typeof target === 'object') {
            return Object.keys(target).length === 0;
        }
        return false;
    }

    /**
     * Retourne la taille (nombre de clés d'un objet `{}` ou nombre d'éléments d'un tableau `[]`)
     * de la structure fournie (ou située au sous-chemin `path` si spécifié).
     * Accepte aussi directement une chaîne JSON.
     *
     * @param {Object|Array|string} value - Objet, tableau ou chaîne JSON.
     * @param {string|number|Array<string|number>} [path] - Chemin optionnel vers un sous-objet ou sous-tableau à mesurer.
     * @returns {number} Nombre d'entrées/éléments (`0` si vide ou invalide).
     *
     * @example <caption>Exemple 1 : Taille d'un objet, d'un tableau ou d'une chaîne JSON</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.size({ a: 1, b: 2, c: 3 })); // 3
     * console.log(jsonUtil.size('[10, 20]'));           // 2
     *
     * @example <caption>Exemple 2 : Taille d'une propriété imbriquée via son chemin</caption>
     * const jsonUtil = new NJson();
     * const data = { user: { roles: ['admin', 'editor'] } };
     * console.log(jsonUtil.size(data, ['user', 'roles'])); // 2
     */
    size(value, path = undefined) {
        const root = typeof value === 'string' ? this.parse(value, null) : value;
        const target = path !== undefined ? this.get(root, path, null) : root;

        if (target === null || target === undefined) {
            return 0;
        }
        if (Array.isArray(target)) {
            return target.length;
        }
        if (target instanceof Map || target instanceof Set) {
            return target.size;
        }
        if (typeof target === 'object') {
            return Object.keys(target).length;
        }
        return 0;
    }

    /**
     * Alias de `size()` : retourne le nombre de clés d'un objet ou le nombre d'éléments d'un tableau
     * (à la racine ou au sous-chemin `path`).
     *
     * @param {Object|Array|string} value - Objet, tableau ou chaîne JSON.
     * @param {string|number|Array<string|number>} [path] - Chemin optionnel vers la propriété cible.
     * @returns {number} Nombre de clés ou d'éléments.
     *
     * @example <caption>Exemple 1 : Compter les clés d'un objet</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.count({ id: 1, name: 'NLib' })); // 2
     *
     * @example <caption>Exemple 2 : Compter les éléments d'un sous-tableau</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.count({ items: [1, 2, 3, 4] }, 'items')); // 4
     */
    count(value, path = undefined) {
        return this.size(value, path);
    }

    // =========================================================================
    // Méthodes publiques — Sérialisation (stringify) & Désérialisation (parse)
    // =========================================================================

    /**
     * Analyse (parse) une chaîne JSON en toute sécurité sans jamais lever d'exception.
     * Si l'entrée est déjà un objet ou un tableau, en retourne une copie (ou la valeur).
     *
     * @param {any} value - Chaîne JSON à décoder (ou objet déjà décodé).
     * @param {any} [fallback=null] - Valeur de repli retournée en cas d'erreur de syntaxe.
     * @param {Function} [reviver] - Fonction `reviver` optionnelle transmise à `JSON.parse`.
     * @returns {any} Donnée décodée ou `fallback`.
     *
     * @example <caption>Exemple 1 : Décoder une chaîne JSON valide</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.parse('{"status":"ok","count":5}')); // { status: 'ok', count: 5 }
     *
     * @example <caption>Exemple 2 : Gérer un JSON malformé avec valeur par défaut</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.parse('non-json', [])); // []
     */
    parse(value, fallback = null, reviver = undefined) {
        if (value === null || value === undefined) {
            return fallback;
        }
        if (typeof value === 'object') {
            return value;
        }
        if (typeof value !== 'string') {
            return fallback;
        }
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return fallback;
        }
        try {
            return typeof reviver === 'function'
                ? JSON.parse(trimmed, reviver)
                : JSON.parse(trimmed);
        } catch (err) {
            NUtil.log.warn('NJson.parse: Échec du parsing de la chaîne JSON.', {
                code: 'WARN_JSON_PARSE_ERROR',
                cause: err
            });
            return fallback;
        }
    }

    /**
     * Sérialise une valeur JavaScript en chaîne JSON de manière sécurisée :
     * - Gère automatiquement les références circulaires (remplacées par `'[Circular]'`).
     * - Convertit les `BigInt` en chaînes de caractères, les `Set` en tableaux et les `Map` en objets.
     * - Permet l'indentation (`pretty`) et le tri alphabétique des clés (`sortKeys`).
     *
     * @param {any} value - Donnée à convertir en chaîne JSON.
     * @param {Object} [options={}] - Options de sérialisation.
     * @param {boolean} [options.pretty=false] - Si `true`, formate avec une indentation de `indent` espaces.
     * @param {number} [options.indent=2] - Nombre d'espaces d'indentation si `pretty = true`.
     * @param {boolean} [options.sortKeys=false] - Si `true`, trie les clés des objets par ordre alphabétique.
     * @param {string} [options.fallback=''] - Chaîne retournée si la sérialisation échoue.
     * @returns {string} Chaîne JSON sérialisée.
     *
     * @example <caption>Exemple 1 : Sérialisation compacte ou avec clés triées</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.stringify({ z: 1, a: 2 }, { sortKeys: true })); // '{"a":2,"z":1}'
     *
     * @example <caption>Exemple 2 : Gérer les références circulaires et Set/Map sans crash</caption>
     * const jsonUtil = new NJson();
     * const obj = { name: 'NLib', tags: new Set(['js', 'sql']) };
     * obj.self = obj;
     * console.log(jsonUtil.stringify(obj));
     * // '{"name":"NLib","tags":["js","sql"],"self":"[Circular]"}'
     */
    stringify(value, options = {}) {
        const fallback = options?.fallback ?? '';
        if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
            return fallback;
        }

        const pretty = options?.pretty ?? false;
        const indent = pretty ? (options?.indent ?? 2) : 0;
        const sortKeys = options?.sortKeys ?? false;

        const target = sortKeys ? this.#sortObjectKeys(value) : value;
        const ancestors = [];

        try {
            return JSON.stringify(
                target,
                function (key, val) {
                    if (typeof val === 'bigint') {
                        return val.toString();
                    }
                    if (val instanceof Set) {
                        return Array.from(val);
                    }
                    if (val instanceof Map) {
                        return Object.fromEntries(val);
                    }
                    if (val !== null && typeof val === 'object') {
                        while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
                            ancestors.pop();
                        }
                        if (ancestors.includes(val)) {
                            return '[Circular]';
                        }
                        ancestors.push(val);
                    }
                    return val;
                },
                indent
            ) ?? fallback;
        } catch (err) {
            NUtil.log.error('NJson.stringify: Échec de la sérialisation JSON.', {
                code: 'ERR_JSON_STRINGIFY_ERROR',
                cause: err
            });
            return fallback;
        }
    }

    /**
     * Formate joliment une valeur ou chaîne JSON avec indentation (raccourci de `stringify(..., { pretty: true })`).
     *
     * @param {any} value - Objet ou chaîne JSON à formater.
     * @param {number} [indent=2] - Nombre d'espaces d'indentation.
     * @returns {string} JSON indenté lisible.
     *
     * @example <caption>Exemple 1 : Indenter une chaîne JSON compacte</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.prettify('{"id":1,"name":"NLib"}'));
     * // {
     * //   "id": 1,
     * //   "name": "NLib"
     * // }
     *
     * @example <caption>Exemple 2 : Indenter un objet avec 4 espaces</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.prettify({ a: 1 }, 4));
     */
    prettify(value, indent = 2) {
        const parsed = typeof value === 'string' ? this.parse(value, null) : value;
        if (parsed === null || parsed === undefined) {
            return '';
        }
        return this.stringify(parsed, { pretty: true, indent });
    }

    /**
     * Minifie une chaîne JSON (supprime tous les espaces et retours à la ligne hors chaînes).
     *
     * @param {string|Object} value - Chaîne JSON indentée ou objet.
     * @returns {string} Chaîne JSON compacte sur une seule ligne.
     *
     * @example <caption>Exemple 1 : Minifier un JSON formaté</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.minify('{\n  "a": 1,\n  "b": 2\n}')); // '{"a":1,"b":2}'
     *
     * @example <caption>Exemple 2 : Minifier un objet directement</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.minify({ x: 10, y: 20 })); // '{"x":10,"y":20}'
     */
    minify(value) {
        const parsed = typeof value === 'string' ? this.parse(value, null) : value;
        if (parsed === null || parsed === undefined) {
            return '';
        }
        return this.stringify(parsed, { pretty: false });
    }

    // =========================================================================
    // Méthodes publiques — Clonage, Comparaison & Fusion (Deep Operations)
    // =========================================================================

    /**
     * Crée une copie profonde (Deep Clone) totalement indépendante d'un objet ou tableau JSON.
     *
     * @param {any} value - Donnée à cloner.
     * @returns {any} Copie profonde.
     *
     * @example <caption>Exemple 1 : Cloner un objet imbriqué</caption>
     * const jsonUtil = new NJson();
     * const original = { user: { name: 'Neta' } };
     * const copy = jsonUtil.clone(original);
     * copy.user.name = 'Autre';
     * console.log(original.user.name); // 'Neta'
     *
     * @example <caption>Exemple 2 : Cloner un tableau d'objets</caption>
     * const jsonUtil = new NJson();
     * const arr = [{ id: 1 }, { id: 2 }];
     * console.log(jsonUtil.clone(arr)); // [{ id: 1 }, { id: 2 }]
     */
    clone(value) {
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (typeof globalThis.structuredClone === 'function') {
            try {
                return globalThis.structuredClone(value);
            } catch (err) {
                NUtil.log.warn('NJson.clone: structuredClone a échoué, bascule sur la sérialisation récursive.', {
                    code: 'WARN_STRUCTURED_CLONE_FALLBACK',
                    cause: err
                });
            }
        }
        return this.parse(this.stringify(value));
    }

    /**
     * Compare deux structures JSON (objets, tableaux ou chaînes JSON) en profondeur,
     * indépendamment de l'ordre des clés dans les objets.
     *
     * @param {any} a - Première structure ou chaîne JSON.
     * @param {any} b - Seconde structure ou chaîne JSON.
     * @returns {boolean} `true` si les deux structures ont exactement le même contenu.
     *
     * @example <caption>Exemple 1 : Ordre des clés différent</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.equals({ a: 1, b: { x: 2, y: 3 } }, { b: { y: 3, x: 2 }, a: 1 })); // true
     *
     * @example <caption>Exemple 2 : Comparer une chaîne JSON et un objet</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.equals('{"id":10}', { id: 10 })); // true
     */
    equals(a, b) {
        const objA = typeof a === 'string' ? this.parse(a, a) : a;
        const objB = typeof b === 'string' ? this.parse(b, b) : b;
        const strA = this.stringify(objA, { sortKeys: true });
        const strB = this.stringify(objB, { sortKeys: true });
        return strA !== '' && strA === strB;
    }

    /**
     * Fusionne profondément (Deep Merge) deux ou plusieurs objets dans un nouvel objet sans muter les sources.
     *
     * @param {...Object} objects - Objets à fusionner de gauche à droite.
     * @returns {Object} Nouvel objet fusionné.
     *
     * @example <caption>Exemple 1 : Fusionner des configurations imbriquées</caption>
     * const jsonUtil = new NJson();
     * const defaults = { db: { host: 'localhost', port: 3306 }, debug: false };
     * const custom = { db: { port: 5432 }, debug: true };
     * console.log(jsonUtil.merge(defaults, custom));
     * // { db: { host: 'localhost', port: 5432 }, debug: true }
     *
     * @example <caption>Exemple 2 : Fusionner trois objets</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.merge({ a: 1 }, { b: 2 }, { c: 3 })); // { a: 1, b: 2, c: 3 }
     */
    merge(...objects) {
        const result = {};
        for (let i = 0; i < objects.length; i++) {
            const source = objects[i];
            if (!this.isPlainObject(source)) {
                continue;
            }
            const keys = Object.keys(source);
            for (let j = 0; j < keys.length; j++) {
                const key = keys[j];
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                    continue;
                }
                const srcVal = source[key];
                const dstVal = result[key];
                if (this.isPlainObject(srcVal) && this.isPlainObject(dstVal)) {
                    result[key] = this.merge(dstVal, srcVal);
                } else {
                    result[key] = this.clone(srcVal);
                }
            }
        }
        return result;
    }

    // =========================================================================
    // Méthodes publiques — Accès et Manipulation par Chemin (Dot-Notation & Index)
    // =========================================================================

    /**
     * Lit une valeur dans un objet, un tableau ou une chaîne JSON
     * à l'aide d'une clé simple (`'cle'`, `'cle.cle.cle'`), d'un index (`1`) ou d'un tableau de segments (`['user', 'profile', 'name']`).
     *
     * @param {Object|Array|string} data - Objet, tableau (ou chaîne JSON) source.
     * @param {string|number|Array<string|number>} path - Clé littérale (chaîne/nombre) ou tableau de segments hiérarchiques.
     * @param {any} [fallback=undefined] - Valeur retournée si le chemin n'existe pas.
     * @returns {any} Valeur trouvée ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire dans un tableau ou objet avec nombre, chaîne ou tableau de clés</caption>
     * const jsonUtil = new NJson();
     * const list = ['a', 'b', 'c'];
     * console.log(jsonUtil.get(list, 1)); // 'b'
     * const matrix = [[10, 20], [30, 40]];
     * console.log(jsonUtil.get(matrix, [1, 0])); // 30
     *
     * @example <caption>Exemple 2 : Clé littérale avec points vs chemin hiérarchique</caption>
     * const jsonUtil = new NJson();
     * const data = { 'cle.cle.cle': 'NLib', users: [{ name: 'Ali' }, { name: 'Neta' }] };
     * console.log(jsonUtil.get(data, 'cle.cle.cle'));         // 'NLib' (clé littérale unique)
     * console.log(jsonUtil.get(data, ['users', 1, 'name'])); // 'Neta' (chemin hiérarchique)
     */
    get(data, path, fallback = undefined) {
        const root = typeof data === 'string' ? this.parse(data, null) : data;
        if (root === null || root === undefined || typeof root !== 'object') {
            return fallback;
        }
        const keys = this.#normalizePath(path);
        if (keys.length === 0) {
            return fallback;
        }

        let current = root;
        for (let i = 0; i < keys.length; i++) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return fallback;
            }
            const k = keys[i];
            if (Array.isArray(current)) {
                const idx = Number(k);
                if (!Number.isInteger(idx)) {
                    return fallback;
                }
                const resolvedIdx = idx < 0 ? current.length + idx : idx;
                if (resolvedIdx < 0 || resolvedIdx >= current.length) {
                    return fallback;
                }
                current = current[resolvedIdx];
            } else {
                if (!(k in current)) {
                    return fallback;
                }
                current = current[k];
            }
        }
        return current === undefined ? fallback : current;
    }

    /**
     * Lit une valeur à un chemin donné et la convertit en nombre fini (`number`),
     * ou retourne `fallback` si la valeur n'est pas numérique.
     *
     * @param {Object|Array|string} data - Objet ou tableau source.
     * @param {string|number|Array<string|number>} path - Chemin d'accès ou index.
     * @param {number|null} [fallback=0] - Valeur retournée si non numérique.
     * @returns {number|null} Nombre valide ou `fallback`.
     *
     * @example <caption>Exemple 1 : Récupérer un nombre depuis un objet ou tableau</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getNumber({ price: '150.5' }, 'price')); // 150.5
     * console.log(jsonUtil.getNumber([10, 25, 40], 1));             // 25
     *
     * @example <caption>Exemple 2 : Valeur absente ou non numérique</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getNumber({ price: 'abc' }, 'price', 0)); // 0
     */
    getNumber(data, path, fallback = 0) {
        const val = this.get(data, path, undefined);
        if (typeof val === 'number') {
            return Number.isFinite(val) ? val : fallback;
        }
        if (typeof val === 'string' && val.trim().length > 0) {
            const num = Number(val.trim());
            return Number.isFinite(num) ? num : fallback;
        }
        return fallback;
    }

    /**
     * Lit une valeur à un chemin donné et la convertit en nombre entier (`integer`),
     * ou retourne `fallback`.
     *
     * @param {Object|Array|string} data - Objet ou tableau source.
     * @param {string|number|Array<string|number>} path - Chemin d'accès ou index.
     * @param {number|null} [fallback=0] - Valeur retournée si invalide.
     * @returns {number|null} Nombre entier ou `fallback`.
     *
     * @example <caption>Exemple 1 : Récupérer un entier</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getInt({ user: { age: '28' } }, ['user', 'age'])); // 28
     *
     * @example <caption>Exemple 2 : Tronquer un flottant ou utiliser le fallback</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getInt([12.9, 45.2], 0));        // 12
     * console.log(jsonUtil.getInt({}, 'inexistant', -1));   // -1
     */
    getInt(data, path, fallback = 0) {
        const num = this.getNumber(data, path, null);
        if (num === null) {
            return fallback;
        }
        return Math.trunc(num);
    }

    /**
     * Lit une valeur à un chemin donné et la convertit en nombre décimal (`float`),
     * en supportant aussi bien le point que la virgule décimale (`'12,50'`).
     *
     * @param {Object|Array|string} data - Objet ou tableau source.
     * @param {string|number|Array<string|number>} path - Chemin d'accès ou index.
     * @param {number|null} [fallback=0.0] - Valeur retournée si invalide.
     * @returns {number|null} Nombre flottant ou `fallback`.
     *
     * @example <caption>Exemple 1 : Récupérer un flottant</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getFloat({ item: { weight: '12,75' } }, ['item', 'weight'])); // 12.75
     *
     * @example <caption>Exemple 2 : À partir d'un tableau avec index</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getFloat({ rates: [1.5, 2.75] }, ['rates', 1])); // 2.75
     */
    getFloat(data, path, fallback = 0.0) {
        const val = this.get(data, path, undefined);
        if (typeof val === 'number') {
            return Number.isFinite(val) ? val : fallback;
        }
        if (typeof val === 'string') {
            const normalized = val.trim().replace(',', '.');
            if (normalized.length === 0) {
                return fallback;
            }
            const parsed = Number.parseFloat(normalized);
            return Number.isFinite(parsed) ? parsed : fallback;
        }
        return fallback;
    }

    /**
     * Lit une valeur à un chemin donné et la retourne sous forme de chaîne de caractères (`string`),
     * ou retourne `fallback` si la valeur est absente / est un objet non primitif.
     *
     * @param {Object|Array|string} data - Objet ou tableau source.
     * @param {string|number|Array<string|number>} path - Chemin d'accès ou index.
     * @param {string} [fallback=''] - Chaîne par défaut si introuvable.
     * @returns {string} Chaîne de caractères ou `fallback`.
     *
     * @example <caption>Exemple 1 : Récupérer une chaîne</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getString({ users: ['Ali', 'Neta'] }, ['users', 1])); // 'Neta'
     *
     * @example <caption>Exemple 2 : Convertir un nombre ou utiliser le fallback</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getString({ code: 226 }, 'code'));          // '226'
     * console.log(jsonUtil.getString({}, 'absent', 'ValeurDéfaut'));   // 'ValeurDéfaut'
     */
    getString(data, path, fallback = '') {
        const val = this.get(data, path, undefined);
        if (typeof val === 'string') {
            return val;
        }
        if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') {
            return String(val);
        }
        return fallback;
    }

    /**
     * Lit une valeur à un chemin donné et vérifie qu'il s'agit bien d'un tableau (`Array`).
     * Si la valeur est une chaîne JSON représentant un tableau (`'[1,2]'`), la décode automatiquement.
     *
     * @param {Object|Array|string} data - Objet ou tableau source.
     * @param {string|number|Array<string|number>} path - Chemin d'accès ou index.
     * @param {Array} [fallback=[]] - Tableau retourné par défaut.
     * @returns {Array} Tableau trouvé ou `fallback`.
     *
     * @example <caption>Exemple 1 : Récupérer un tableau imbriqué</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getArray({ group: { roles: ['admin', 'user'] } }, ['group', 'roles']));
     * // ['admin', 'user']
     *
     * @example <caption>Exemple 2 : Valeur non-tableau retourne le fallback []</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getArray({ group: { roles: 'admin' } }, ['group', 'roles'])); // []
     */
    getArray(data, path, fallback = []) {
        const val = this.get(data, path, undefined);
        if (Array.isArray(val)) {
            return val;
        }
        if (typeof val === 'string') {
            const parsed = this.parse(val, null);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
        return fallback;
    }

    /**
     * Lit une valeur à un chemin donné et vérifie qu'il s'agit bien d'un objet simple (`Plain Object` `{}`).
     * Si la valeur est une chaîne JSON représentant un objet (`'{"a":1}'`), la décode automatiquement.
     *
     * @param {Object|Array|string} data - Objet ou tableau source.
     * @param {string|number|Array<string|number>} path - Chemin d'accès ou index.
     * @param {Object|null} [fallback={}] - Objet retourné par défaut.
     * @returns {Object|null} Objet trouvé ou `fallback`.
     *
     * @example <caption>Exemple 1 : Récupérer un objet dans un tableau</caption>
     * const jsonUtil = new NJson();
     * const data = { users: [{ id: 1, name: 'Neta' }] };
     * console.log(jsonUtil.getObject(data, ['users', 0])); // { id: 1, name: 'Neta' }
     *
     * @example <caption>Exemple 2 : Chemin invalide retourne {}</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.getObject(data, ['users', 5])); // {}
     */
    getObject(data, path, fallback = {}) {
        const val = this.get(data, path, undefined);
        if (this.isPlainObject(val)) {
            return val;
        }
        if (typeof val === 'string') {
            const parsed = this.parse(val, null);
            if (this.isPlainObject(parsed)) {
                return parsed;
            }
        }
        return fallback;
    }

    /**
     * Vérifie si une clé littérale (`'cle'`, `'cle.cle.cle'`), un index (`1`) ou un chemin (`['user', 0, 'id']`) existe dans un objet ou tableau.
     *
     * @param {Object|Array|string} data - Objet ou tableau source.
     * @param {string|number|Array<string|number>} path - Clé ou chemin à vérifier.
     * @returns {boolean} `true` si la propriété ou l'index final existe, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier une clé littérale ou un chemin dans un objet</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.has({ 'cle.cle.cle': 42 }, 'cle.cle.cle'));      // true (clé littérale)
     * console.log(jsonUtil.has({ user: [{ id: 1 }] }, ['user', 0, 'id'])); // true (chemin hiérarchique)
     *
     * @example <caption>Exemple 2 : Index hors limites</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.has(['a', 'b'], 5)); // false
     */
    has(data, path) {
        const sentinel = Symbol('not-found');
        return this.get(data, path, sentinel) !== sentinel;
    }

    /**
     * Définit une valeur à une clé littérale (`'cle'`, `'cle.cle.cle'`), un index (`1`) ou un chemin (`['user', 1, 'name']`),
     * aussi bien sur un tableau racine `[]` que sur un objet `{}` contenant des tableaux imbriqués,
     * en créant automatiquement les structures intermédiaires manquantes lorsqu'un tableau de chemin est passé.
     *
     * @param {Object|Array} data - Objet ou tableau cible à modifier.
     * @param {string|number|Array<string|number>} path - Clé littérale ou tableau de chemin hiérarchique.
     * @param {any} value - Valeur à assigner.
     * @returns {Object|Array} La structure `data` mise à jour.
     *
     * @example <caption>Exemple 1 : Modifier un tableau directement par index ou clé</caption>
     * const jsonUtil = new NJson();
     * const arr = ['a', 'b'];
     * jsonUtil.set(arr, 1, 'B');
     * console.log(arr); // ['a', 'B']
     *
     * @example <caption>Exemple 2 : Clé littérale avec points vs chemin hiérarchique</caption>
     * const jsonUtil = new NJson();
     * const obj = {};
     * jsonUtil.set(obj, 'cle.cle.cle', 1);                 // { 'cle.cle.cle': 1 }
     * jsonUtil.set(obj, ['user', 1, 'name'], 'Neta');      // { 'cle.cle.cle': 1, user: [undefined, { name: 'Neta' }] }
     */
    set(data, path, value) {
        if (data === null || data === undefined || typeof data !== 'object') {
            return data;
        }
        const keys = this.#normalizePath(path);
        if (keys.length === 0) {
            return data;
        }

        let current = data;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                return data;
            }
            const nextKey = keys[i + 1];
            const targetKey = Array.isArray(current) && /^\d+$/.test(key) ? Number(key) : key;

            if (
                current[targetKey] === null ||
                current[targetKey] === undefined ||
                typeof current[targetKey] !== 'object'
            ) {
                current[targetKey] = /^\d+$/.test(String(nextKey)) ? [] : {};
            }
            current = current[targetKey];
        }

        const lastKey = keys[keys.length - 1];
        if (lastKey !== '__proto__' && lastKey !== 'constructor' && lastKey !== 'prototype') {
            const targetLastKey = Array.isArray(current) && /^\d+$/.test(lastKey) ? Number(lastKey) : lastKey;
            current[targetLastKey] = value;
        }
        return data;
    }

    /**
     * Supprime un élément ou une propriété située à une clé littérale (`'cle'`, `'cle.cle.cle'`), un index (`1`) ou un chemin (`['user', 1]`),
     * que la cible soit un tableau (utilise `splice` pour retirer l'index) ou un objet (`delete`).
     *
     * @param {Object|Array} data - Objet ou tableau cible.
     * @param {string|number|Array<string|number>} path - Clé littérale ou tableau de chemin hiérarchique.
     * @returns {boolean} `true` si la propriété ou l'élément existait et a été supprimé, sinon `false`.
     *
     * @example <caption>Exemple 1 : Supprimer un index dans un tableau racine ou imbriqué</caption>
     * const jsonUtil = new NJson();
     * const list = ['a', 'b', 'c'];
     * console.log(jsonUtil.remove(list, 1)); // true -> list vaut ['a', 'c']
     *
     * @example <caption>Exemple 2 : Supprimer une clé littérale avec points ou dans un tableau imbriqué</caption>
     * const jsonUtil = new NJson();
     * const data = { 'cle.cle.cle': 'supprimer', user: ['Ali', 'Neta', 'Marc'] };
     * console.log(jsonUtil.remove(data, 'cle.cle.cle')); // true -> supprime la clé littérale 'cle.cle.cle'
     * console.log(jsonUtil.remove(data, ['user', 1]));   // true -> data.user vaut ['Ali', 'Marc']
     */
    remove(data, path) {
        if (data === null || data === undefined || typeof data !== 'object') {
            return false;
        }
        const keys = this.#normalizePath(path);
        if (keys.length === 0) {
            return false;
        }

        let current = data;
        for (let i = 0; i < keys.length - 1; i++) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return false;
            }
            const k = keys[i];
            const targetKey = Array.isArray(current) && /^\d+$/.test(k) ? Number(k) : k;
            current = current[targetKey];
        }

        const lastKey = keys[keys.length - 1];
        if (!current || typeof current !== 'object') {
            return false;
        }

        if (Array.isArray(current) && /^-?\d+$/.test(String(lastKey))) {
            const idx = Number(lastKey);
            const resolvedIdx = idx < 0 ? current.length + idx : idx;
            if (resolvedIdx >= 0 && resolvedIdx < current.length) {
                current.splice(resolvedIdx, 1);
                return true;
            }
            return false;
        }

        if (lastKey in current) {
            delete current[lastKey];
            return true;
        }
        return false;
    }

    // =========================================================================
    // Méthodes publiques — Filtrage de Clés & Transformation (Pick, Omit, Flatten)
    // =========================================================================

    /**
     * Extrait un nouvel objet ne contenant que les clés spécifiées.
     *
     * @param {Object} obj - Objet source.
     * @param {string[]} keys - Tableau des clés à conserver.
     * @returns {Object} Nouvel objet filtré.
     *
     * @example <caption>Exemple 1 : Conserver uniquement id et name</caption>
     * const jsonUtil = new NJson();
     * const user = { id: 1, name: 'Neta', password: '123', role: 'admin' };
     * console.log(jsonUtil.pick(user, ['id', 'name'])); // { id: 1, name: 'Neta' }
     *
     * @example <caption>Exemple 2 : Objet invalide retourne un objet vide</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.pick(null, ['id'])); // {}
     */
    pick(obj, keys = []) {
        if (!this.isPlainObject(obj) || !Array.isArray(keys)) {
            return {};
        }
        const out = {};
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
                out[k] = obj[k];
            }
        }
        return out;
    }

    /**
     * Retourne une copie de l'objet sans les clés spécifiées (idéal pour retirer `password`, `token`, etc.).
     *
     * @param {Object} obj - Objet source.
     * @param {string[]} keysToOmit - Tableau des clés à exclure.
     * @returns {Object} Nouvel objet nettoyé.
     *
     * @example <caption>Exemple 1 : Exclure les champs sensibles</caption>
     * const jsonUtil = new NJson();
     * const user = { id: 1, name: 'Neta', password: 'secret', salt: 'xyz' };
     * console.log(jsonUtil.omit(user, ['password', 'salt'])); // { id: 1, name: 'Neta' }
     *
     * @example <caption>Exemple 2 : Aucune clé exclue</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.omit({ a: 1 }, [])); // { a: 1 }
     */
    omit(obj, keysToOmit = []) {
        if (!this.isPlainObject(obj)) {
            return {};
        }
        const excluded = new Set(Array.isArray(keysToOmit) ? keysToOmit : [keysToOmit]);
        const out = {};
        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (!excluded.has(k)) {
                out[k] = obj[k];
            }
        }
        return out;
    }

    /**
     * Aplatit un objet imbriqué en un objet à un seul niveau avec des clés en notation pointée.
     *
     * @param {Object} obj - Objet imbriqué à aplatir.
     * @param {string} [separator='.'] - Séparateur de clés (par défaut `'.'`).
     * @param {string} [prefix=''] - Préfixe initial interne.
     * @returns {Object<string, any>} Objet aplati.
     *
     * @example <caption>Exemple 1 : Aplatir un objet de configuration</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.flatten({ db: { host: 'localhost', port: 3306 } }));
     * // { 'db.host': 'localhost', 'db.port': 3306 }
     *
     * @example <caption>Exemple 2 : Aplatir avec un séparateur personnalisé '_'</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.flatten({ app: { env: 'prod' } }, '_'));
     * // { app_env: 'prod' }
     */
    flatten(obj, separator = '.', prefix = '') {
        if (!this.isPlainObject(obj)) {
            return {};
        }
        const result = {};
        const keys = Object.keys(obj);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = obj[key];
            const newKey = prefix ? `${prefix}${separator}${key}` : key;

            if (this.isPlainObject(val) && Object.keys(val).length > 0) {
                Object.assign(result, this.flatten(val, separator, newKey));
            } else {
                result[newKey] = val;
            }
        }
        return result;
    }

    /**
     * Reconstruit un objet hiérarchique imbriqué à partir d'un objet aplati (inverse de `flatten()`).
     *
     * @param {Object<string, any>} flatObj - Objet aplati.
     * @param {string} [separator='.'] - Séparateur utilisé dans les clés.
     * @returns {Object} Objet imbriqué reconstruit.
     *
     * @example <caption>Exemple 1 : Reconstruire un objet imbriqué</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.unflatten({ 'db.host': 'localhost', 'db.port': 3306 }));
     * // { db: { host: 'localhost', port: 3306 } }
     *
     * @example <caption>Exemple 2 : Avec un séparateur '_'</caption>
     * const jsonUtil = new NJson();
     * console.log(jsonUtil.unflatten({ app_env: 'prod' }, '_'));
     * // { app: { env: 'prod' } }
     */
    unflatten(flatObj, separator = '.') {
        if (!this.isPlainObject(flatObj)) {
            return {};
        }
        const result = {};
        const keys = Object.keys(flatObj);
        for (let i = 0; i < keys.length; i++) {
            const flatKey = keys[i];
            const pathParts = flatKey.split(separator);
            this.set(result, pathParts, flatObj[flatKey]);
        }
        return result;
    }
}

export default NJson;

