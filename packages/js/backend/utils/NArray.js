/**
 * @file NArray.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation, l'accès sécurisé (avec index positifs
 * ou négatifs et conversion de types), le filtrage, le dédoublonnage, le tri multi-critères,
 * le regroupement (`groupBy`), la pagination, les opérations ensemblistes (`intersection`,
 * `difference`, `union`) et la manipulation de tableaux dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

/**
 * @class NArray
 * @description Utilitaire de gestion, transformation et requêtage de tableaux sans état interne.
 *
 * @example <caption>Exemple 1 : Accès sécurisé, dédoublonnage et nettoyage</caption>
 * const arrUtil = new NArray();
 * console.log(arrUtil.get(['a', 'b', 'c'], -1));          // 'c' (dernier élément)
 * console.log(arrUtil.unique([1, 2, 2, 3, 1]));           // [1, 2, 3]
 * console.log(arrUtil.compact([0, 1, null, '', 'NLib'])); // [0, 1, 'NLib']
 *
 * @example <caption>Exemple 2 : Regroupement (groupBy), extraction (pluck) et tri d'objets</caption>
 * const arrUtil = new NArray();
 * const users = [
 *     { id: 1, name: 'Neta', role: 'admin' },
 *     { id: 2, name: 'Ali', role: 'user' },
 *     { id: 3, name: 'Sara', role: 'admin' }
 * ];
 * console.log(arrUtil.pluck(users, 'name'));      // ['Neta', 'Ali', 'Sara']
 * console.log(arrUtil.sortBy(users, 'name'));     // [{ name: 'Ali'... }, { name: 'Neta'... }, { name: 'Sara'... }]
 *
 * @example <caption>Exemple 3 : Découpage par lots (chunk) et pagination</caption>
 * const arrUtil = new NArray();
 * console.log(arrUtil.chunk([1, 2, 3, 4, 5], 2)); // [[1, 2], [3, 4], [5]]
 * console.log(arrUtil.paginate([10, 20, 30, 40, 50], 2, 2));
 * // { data: [30, 40], page: 2, perPage: 2, total: 5, totalPages: 3, hasNext: true, hasPrev: true }
 */
export class NArray {

    // =========================================================================
    // Méthodes publiques — Validation & Vérifications
    // =========================================================================

    /**
     * Vérifie si la valeur fournie est un tableau (`Array`).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `value` est un tableau, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tableau valide</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.isArray([1, 2, 3])); // true
     *
     * @example <caption>Exemple 2 : Objet ou chaîne</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.isArray({ a: 1 }));  // false
     * console.log(arrUtil.isArray('texte'));   // false
     */
    isArray(value) {
        return Array.isArray(value);
    }

    /**
     * Vérifie si un tableau est vide (ou si la valeur fournie n'est pas un tableau).
     *
     * @param {any} list - Tableau à vérifier.
     * @returns {boolean} `true` si le tableau est vide ou invalide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tableau vide ou null</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.isEmpty([]));   // true
     * console.log(arrUtil.isEmpty(null)); // true
     *
     * @example <caption>Exemple 2 : Tableau contenant des éléments</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.isEmpty([1]));  // false
     */
    isEmpty(list) {
        return !Array.isArray(list) || list.length === 0;
    }

    /**
     * Retourne le nombre d'éléments contenus dans un tableau (ou `0` si la valeur n'est pas un tableau).
     * Si un prédicat `predicate` (fonction ou objet/valeur de filtre) est fourni, compte uniquement
     * les éléments correspondants.
     *
     * @param {any} list - Tableau à mesurer.
     * @param {Function} [predicate] - Fonction de filtrage optionnelle `(item, index) => boolean`.
     * @returns {number} Nombre d'éléments (`0` si invalide ou vide).
     *
     * @example <caption>Exemple 1 : Obtenir la taille d'un tableau</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.size(['a', 'b', 'c'])); // 3
     * console.log(arrUtil.size(null));            // 0
     *
     * @example <caption>Exemple 2 : Compter avec une condition</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.size([10, 25, 30, 5], (n) => n >= 20)); // 2
     */
    size(list, predicate = undefined) {
        if (!Array.isArray(list)) {
            return 0;
        }
        if (typeof predicate === 'function') {
            let total = 0;
            for (let i = 0; i < list.length; i++) {
                if (predicate(list[i], i)) {
                    total++;
                }
            }
            return total;
        }
        return list.length;
    }

    /**
     * Alias de `size()` : retourne le nombre d'éléments d'un tableau (ou le nombre d'éléments
     * vérifiant le prédicat `predicate`).
     *
     * @param {any} list - Tableau à compter.
     * @param {Function} [predicate] - Fonction de filtrage optionnelle `(item, index) => boolean`.
     * @returns {number} Nombre d'éléments.
     *
     * @example <caption>Exemple 1 : Compter tous les éléments</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.count([1, 2, 3, 4])); // 4
     *
     * @example <caption>Exemple 2 : Compter les utilisateurs actifs</caption>
     * const arrUtil = new NArray();
     * const users = [{ active: true }, { active: false }, { active: true }];
     * console.log(arrUtil.count(users, (u) => u.active)); // 2
     */
    count(list, predicate = undefined) {
        return this.size(list, predicate);
    }

    /**
     * Convertit n'importe quelle valeur en tableau :
     * - Si c'est déjà un tableau, en retourne une copie superficielle.
     * - Si c'est `null` ou `undefined`, retourne `[]`.
     * - Si c'est un `Set` ou un itérable, le convertit via `Array.from`.
     * - Sinon, enveloppe la valeur dans `[value]`.
     *
     * @param {any} value - Valeur à convertir en tableau.
     * @returns {Array} Tableau résultant.
     *
     * @example <caption>Exemple 1 : Envelopper une valeur simple ou copier un tableau</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.toArray('NLib'));     // ['NLib']
     * console.log(arrUtil.toArray([1, 2]));     // [1, 2]
     *
     * @example <caption>Exemple 2 : Convertir null ou un Set</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.toArray(null));                 // []
     * console.log(arrUtil.toArray(new Set(['a', 'b'])));  // ['a', 'b']
     */
    toArray(value) {
        if (value === null || value === undefined) {
            return [];
        }
        if (Array.isArray(value)) {
            return [...value];
        }
        if (value instanceof Set || value instanceof Map) {
            return Array.from(value);
        }
        return [value];
    }

    /**
     * Compare deux tableaux élément par élément (supporte les tableaux imbriqués et objets simples).
     *
     * @param {Array} listA - Premier tableau.
     * @param {Array} listB - Second tableau.
     * @param {boolean} [ignoreOrder=false] - Si `true`, vérifie qu'ils contiennent les mêmes éléments quel que soit l'ordre.
     * @returns {boolean} `true` si les deux tableaux sont égaux, sinon `false`.
     *
     * @example <caption>Exemple 1 : Comparaison dans l'ordre</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.equals([1, 2, 3], [1, 2, 3])); // true
     * console.log(arrUtil.equals([1, 2, 3], [3, 2, 1])); // false
     *
     * @example <caption>Exemple 2 : Comparaison sans tenir compte de l'ordre</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.equals([1, 2, 3], [3, 2, 1], true)); // true
     */
    equals(listA, listB, ignoreOrder = false) {
        if (!Array.isArray(listA) || !Array.isArray(listB) || listA.length !== listB.length) {
            return false;
        }
        const serialize = (item) => (item !== null && typeof item === 'object' ? JSON.stringify(item) : String(item));
        if (ignoreOrder) {
            const sortedA = listA.map(serialize).sort();
            const sortedB = listB.map(serialize).sort();
            return sortedA.every((val, i) => val === sortedB[i]);
        }
        for (let i = 0; i < listA.length; i++) {
            if (listA[i] !== listB[i] && serialize(listA[i]) !== serialize(listB[i])) {
                return false;
            }
        }
        return true;
    }

    /**
     * Vérifie si un tableau contient une valeur (ou un objet ayant `{ [key]: value }`).
     *
     * @param {Array} list - Tableau dans lequel chercher.
     * @param {any} target - Valeur recherchée.
     * @param {string} [key] - Clé d'objet optionnelle si `list` est un tableau d'objets.
     * @returns {boolean} `true` si l'élément est présent, sinon `false`.
     *
     * @example <caption>Exemple 1 : Rechercher une valeur primitive</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.contains(['js', 'php', 'node'], 'php')); // true
     *
     * @example <caption>Exemple 2 : Rechercher par clé dans un tableau d'objets</caption>
     * const arrUtil = new NArray();
     * const users = [{ id: 1, name: 'Neta' }, { id: 2, name: 'Ali' }];
     * console.log(arrUtil.contains(users, 'Neta', 'name')); // true
     */
    contains(list, target, key = undefined) {
        if (!Array.isArray(list)) {
            return false;
        }
        if (typeof key === 'string' && key.length > 0) {
            return list.some((item) => item !== null && typeof item === 'object' && item[key] === target);
        }
        return list.includes(target);
    }

    // =========================================================================
    // Méthodes publiques — Accès par Index (Positif / Négatif) & Extrémités
    // =========================================================================

    /**
     * Récupère un élément d'un tableau à l'index spécifié (accepte les index négatifs comme `-1`
     * pour le dernier élément), ou retourne `fallback` si hors limites.
     *
     * @param {Array} list - Tableau source.
     * @param {number} index - Index (`0`, `1`, ... ou `-1`, `-2` depuis la fin).
     * @param {any} [fallback=undefined] - Valeur par défaut si l'index n'existe pas.
     * @returns {any} Élément trouvé ou `fallback`.
     *
     * @example <caption>Exemple 1 : Index positif et négatif</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.get(['a', 'b', 'c'], 0));  // 'a'
     * console.log(arrUtil.get(['a', 'b', 'c'], -1)); // 'c'
     *
     * @example <caption>Exemple 2 : Index hors limites avec fallback</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.get(['a', 'b'], 10, 'aucun')); // 'aucun'
     */
    get(list, index, fallback = undefined) {
        if (!Array.isArray(list) || list.length === 0) {
            return fallback;
        }
        const idx = Number(index);
        if (!Number.isInteger(idx)) {
            return fallback;
        }
        const resolved = idx < 0 ? list.length + idx : idx;
        if (resolved < 0 || resolved >= list.length) {
            return fallback;
        }
        return list[resolved] === undefined ? fallback : list[resolved];
    }

    /**
     * Retourne le premier élément (ou les `count` premiers éléments) d'un tableau.
     *
     * @param {Array} list - Tableau source.
     * @param {number} [count=1] - Nombre d'éléments à récupérer depuis le début.
     * @returns {any|Array} Le premier élément si `count === 1`, sinon un tableau des `count` premiers éléments.
     *
     * @example <caption>Exemple 1 : Obtenir le premier élément</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.first([10, 20, 30])); // 10
     *
     * @example <caption>Exemple 2 : Obtenir les 2 premiers éléments</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.first([10, 20, 30], 2)); // [10, 20]
     */
    first(list, count = 1) {
        if (!Array.isArray(list) || list.length === 0) {
            return count === 1 ? undefined : [];
        }
        if (count === 1) {
            return list[0];
        }
        return list.slice(0, Math.max(0, Math.trunc(count)));
    }

    /**
     * Retourne le dernier élément (ou les `count` derniers éléments) d'un tableau.
     *
     * @param {Array} list - Tableau source.
     * @param {number} [count=1] - Nombre d'éléments à récupérer depuis la fin.
     * @returns {any|Array} Le dernier élément si `count === 1`, sinon un tableau des `count` derniers éléments.
     *
     * @example <caption>Exemple 1 : Obtenir le dernier élément</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.last([10, 20, 30])); // 30
     *
     * @example <caption>Exemple 2 : Obtenir les 2 derniers éléments</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.last([10, 20, 30], 2)); // [20, 30]
     */
    last(list, count = 1) {
        if (!Array.isArray(list) || list.length === 0) {
            return count === 1 ? undefined : [];
        }
        if (count === 1) {
            return list[list.length - 1];
        }
        const n = Math.max(0, Math.trunc(count));
        return n === 0 ? [] : list.slice(-n);
    }

    // =========================================================================
    // Méthodes publiques — Ajout, Insertion & Suppression
    // =========================================================================

    /**
     * Insère un ou plusieurs éléments à un index précis dans une copie du tableau.
     *
     * @param {Array} list - Tableau original.
     * @param {number} index - Position d'insertion.
     * @param {...any} items - Éléments à insérer.
     * @returns {Array} Nouveau tableau avec les éléments insérés.
     *
     * @example <caption>Exemple 1 : Insérer au milieu d'un tableau</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.insertAt(['a', 'c'], 1, 'b')); // ['a', 'b', 'c']
     *
     * @example <caption>Exemple 2 : Insérer plusieurs éléments</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.insertAt([1, 4], 1, 2, 3)); // [1, 2, 3, 4]
     */
    insertAt(list, index, ...items) {
        if (!Array.isArray(list)) {
            return [...items];
        }
        const copy = [...list];
        const idx = Math.max(0, Math.min(copy.length, Math.trunc(Number(index) || 0)));
        copy.splice(idx, 0, ...items);
        return copy;
    }

    /**
     * Supprime l'élément situé à l'index donné (supporte les index négatifs) et retourne un nouveau tableau.
     *
     * @param {Array} list - Tableau original.
     * @param {number} index - Index de l'élément à retirer.
     * @returns {Array} Nouveau tableau sans l'élément.
     *
     * @example <caption>Exemple 1 : Supprimer à l'index 1</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.removeAt(['a', 'b', 'c'], 1)); // ['a', 'c']
     *
     * @example <caption>Exemple 2 : Supprimer le dernier élément avec -1</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.removeAt(['a', 'b', 'c'], -1)); // ['a', 'b']
     */
    removeAt(list, index) {
        if (!Array.isArray(list) || list.length === 0) {
            return [];
        }
        const copy = [...list];
        const idx = Number(index);
        if (!Number.isInteger(idx)) {
            return copy;
        }
        const resolved = idx < 0 ? copy.length + idx : idx;
        if (resolved >= 0 && resolved < copy.length) {
            copy.splice(resolved, 1);
        }
        return copy;
    }

    /**
     * Supprime toutes les occurrences d'une valeur (ou d'un objet ayant `{ [key]: value }`) et retourne un nouveau tableau.
     *
     * @param {Array} list - Tableau original.
     * @param {any} valueToRemove - Valeur à éliminer.
     * @param {string} [key] - Clé d'objet optionnelle.
     * @returns {Array} Nouveau tableau filtré.
     *
     * @example <caption>Exemple 1 : Supprimer une valeur primitive</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.removeValue([1, 2, 3, 2], 2)); // [1, 3]
     *
     * @example <caption>Exemple 2 : Supprimer un objet par clé</caption>
     * const arrUtil = new NArray();
     * const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
     * console.log(arrUtil.removeValue(items, 2, 'id')); // [{ id: 1 }, { id: 3 }]
     */
    removeValue(list, valueToRemove, key = undefined) {
        if (!Array.isArray(list)) {
            return [];
        }
        if (typeof key === 'string' && key.length > 0) {
            return list.filter((item) => !(item !== null && typeof item === 'object' && item[key] === valueToRemove));
        }
        return list.filter((item) => item !== valueToRemove);
    }

    // =========================================================================
    // Méthodes publiques — Nettoyage, Dédoublonnage & Aplatissement
    // =========================================================================

    /**
     * Supprime les valeurs vides d'un tableau (`null`, `undefined`, `NaN`, `''`).
     * Si `removeFalsy = true`, supprime également `false` et `0`.
     *
     * @param {Array} list - Tableau à nettoyer.
     * @param {boolean} [removeFalsy=false] - Si `true`, retire aussi `0` et `false`.
     * @returns {Array} Tableau nettoyé.
     *
     * @example <caption>Exemple 1 : Retirer null, undefined et chaînes vides (en gardant 0 et false)</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.compact([0, false, null, undefined, '', 'NLib']));
     * // [0, false, 'NLib']
     *
     * @example <caption>Exemple 2 : Retirer toutes les valeurs falsy</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.compact([0, false, null, 'NLib'], true));
     * // ['NLib']
     */
    compact(list, removeFalsy = false) {
        if (!Array.isArray(list)) {
            return [];
        }
        if (removeFalsy) {
            return list.filter(Boolean);
        }
        return list.filter((item) => item !== null && item !== undefined && item !== '' && !Number.isNaN(item));
    }

    /**
     * Élimine les doublons d'un tableau. Si `key` est fourni, dédoublonne un tableau d'objets
     * selon la propriété `key` (ex: `'id'` ou `'email'`).
     *
     * @param {Array} list - Tableau à dédoublonner.
     * @param {string|Function} [key] - Nom de propriété ou fonction de sélection de clé unique.
     * @returns {Array} Nouveau tableau sans doublons.
     *
     * @example <caption>Exemple 1 : Dédoublonner des valeurs primitives</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.unique([1, 2, 2, 3, 1, 4])); // [1, 2, 3, 4]
     *
     * @example <caption>Exemple 2 : Dédoublonner un tableau d'objets par clé 'id'</caption>
     * const arrUtil = new NArray();
     * const users = [{ id: 1, name: 'A' }, { id: 1, name: 'A bis' }, { id: 2, name: 'B' }];
     * console.log(arrUtil.unique(users, 'id')); // [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
     */
    unique(list, key = undefined) {
        if (!Array.isArray(list)) {
            return [];
        }
        if (!key) {
            return Array.from(new Set(list));
        }
        const seen = new Set();
        const result = [];
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const identifier = typeof key === 'function'
                ? key(item)
                : (item !== null && typeof item === 'object' ? item[key] : item);
            if (!seen.has(identifier)) {
                seen.add(identifier);
                result.push(item);
            }
        }
        return result;
    }

    /**
     * Aplatit un tableau de tableaux jusqu'à la profondeur souhaitée (par défaut aplatissement complet `Infinity`).
     *
     * @param {Array} list - Tableau imbriqué à aplatir.
     * @param {number} [depth=Infinity] - Profondeur d'aplatissement.
     * @returns {Array} Tableau aplati.
     *
     * @example <caption>Exemple 1 : Aplatissement complet</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.flatten([1, [2, [3, [4]]]])); // [1, 2, 3, 4]
     *
     * @example <caption>Exemple 2 : Aplatissement sur 1 seul niveau</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.flatten([1, [2, [3]]], 1)); // [1, 2, [3]]
     */
    flatten(list, depth = Infinity) {
        if (!Array.isArray(list)) {
            return [];
        }
        return list.flat(depth);
    }

    // =========================================================================
    // Méthodes publiques — Extraction, Regroupement, Indexation & Tri d'Objets
    // =========================================================================

    /**
     * Extrait la liste des valeurs d'une propriété donnée sur chaque objet d'un tableau.
     *
     * @param {Array<Object>} list - Tableau d'objets.
     * @param {string} key - Nom de la propriété à extraire.
     * @returns {Array} Tableau des valeurs extraites.
     *
     * @example <caption>Exemple 1 : Extraire tous les IDs</caption>
     * const arrUtil = new NArray();
     * const rows = [{ id: 10, code: 'A' }, { id: 20, code: 'B' }];
     * console.log(arrUtil.pluck(rows, 'id')); // [10, 20]
     *
     * @example <caption>Exemple 2 : Tableau vide</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.pluck([], 'id')); // []
     */
    pluck(list, key) {
        if (!Array.isArray(list) || typeof key !== 'string' || key.length === 0) {
            return [];
        }
        const out = [];
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (item !== null && typeof item === 'object' && key in item) {
                out.push(item[key]);
            }
        }
        return out;
    }

    /**
     * Regroupe les éléments d'un tableau dans un objet selon la valeur d'une clé ou d'une fonction.
     *
     * @param {Array} list - Tableau à regrouper.
     * @param {string|Function} keyOrFn - Nom de la propriété ou fonction de regroupement.
     * @returns {Object<string, Array>} Dictionnaire des groupes.
     *
     * @example <caption>Exemple 1 : Regrouper par rôle</caption>
     * const arrUtil = new NArray();
     * const users = [{ name: 'Neta', role: 'admin' }, { name: 'Ali', role: 'user' }, { name: 'Sara', role: 'admin' }];
     * console.log(arrUtil.groupBy(users, 'role'));
     * // { admin: [{ name: 'Neta', role: 'admin' }, { name: 'Sara', role: 'admin' }], user: [{ name: 'Ali', role: 'user' }] }
     *
     * @example <caption>Exemple 2 : Regrouper avec une fonction</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.groupBy([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd')));
     * // { odd: [1, 3], even: [2, 4] }
     */
    groupBy(list, keyOrFn) {
        if (!Array.isArray(list)) {
            return {};
        }
        const groups = {};
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const groupKey = typeof keyOrFn === 'function'
                ? String(keyOrFn(item, i))
                : String(item !== null && typeof item === 'object' ? (item[keyOrFn] ?? 'undefined') : item);
            if (!Object.prototype.hasOwnProperty.call(groups, groupKey)) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
        }
        return groups;
    }

    /**
     * Indexe un tableau d'objets dans un dictionnaire `{ [keyValue]: object }` pour un accès instantané en `O(1)`.
     *
     * @param {Array<Object>} list - Tableau d'objets.
     * @param {string} key - Propriété servant de clé unique (ex: `'id'`, `'code'`).
     * @returns {Object<string, Object>} Dictionnaire indexé par `key`.
     *
     * @example <caption>Exemple 1 : Indexer une liste d'utilisateurs par ID</caption>
     * const arrUtil = new NArray();
     * const users = [{ id: 10, name: 'Neta' }, { id: 20, name: 'Ali' }];
     * console.log(arrUtil.keyBy(users, 'id'));
     * // { '10': { id: 10, name: 'Neta' }, '20': { id: 20, name: 'Ali' } }
     *
     * @example <caption>Exemple 2 : Tableau vide retourne {}</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.keyBy([], 'id')); // {}
     */
    keyBy(list, key) {
        if (!Array.isArray(list) || typeof key !== 'string' || key.length === 0) {
            return {};
        }
        const map = {};
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (item !== null && typeof item === 'object' && key in item) {
                map[String(item[key])] = item;
            }
        }
        return map;
    }

    /**
     * Trie un tableau (de primitives ou d'objets) sans muter l'original.
     *
     * @param {Array} list - Tableau à trier.
     * @param {string|Function|null} [keyOrFn=null] - Clé de tri pour les objets (ou `null` pour trier directement les éléments).
     * @param {'asc'|'desc'} [order='asc'] - Ordre de tri (`'asc'` croissant ou `'desc'` décroissant).
     * @returns {Array} Nouveau tableau trié.
     *
     * @example <caption>Exemple 1 : Trier des nombres ou des chaînes</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.sortBy([30, 10, 20]));             // [10, 20, 30]
     * console.log(arrUtil.sortBy([30, 10, 20], null, 'desc')); // [30, 20, 10]
     *
     * @example <caption>Exemple 2 : Trier un tableau d'objets par propriété</caption>
     * const arrUtil = new NArray();
     * const items = [{ price: 50 }, { price: 10 }, { price: 30 }];
     * console.log(arrUtil.sortBy(items, 'price', 'asc'));
     * // [{ price: 10 }, { price: 30 }, { price: 50 }]
     */
    sortBy(list, keyOrFn = null, order = 'asc') {
        if (!Array.isArray(list)) {
            return [];
        }
        const direction = String(order).toLowerCase() === 'desc' ? -1 : 1;
        const copy = [...list];

        return copy.sort((a, b) => {
            const valA = typeof keyOrFn === 'function'
                ? keyOrFn(a)
                : (typeof keyOrFn === 'string' && a !== null && typeof a === 'object' ? a[keyOrFn] : a);
            const valB = typeof keyOrFn === 'function'
                ? keyOrFn(b)
                : (typeof keyOrFn === 'string' && b !== null && typeof b === 'object' ? b[keyOrFn] : b);

            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) * direction;
            }
            return (valA < valB ? -1 : 1) * direction;
        });
    }

    // =========================================================================
    // Méthodes publiques — Découpage (Chunk), Pagination & Aléatoire
    // =========================================================================

    /**
     * Découpe un tableau en sous-tableaux (lots) de taille `size`.
     *
     * @param {Array} list - Tableau à découper.
     * @param {number} [size=2] - Taille maximale de chaque lot.
     * @returns {Array<Array>} Tableau de lots.
     *
     * @example <caption>Exemple 1 : Découper par lots de 2</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.chunk([1, 2, 3, 4, 5], 2)); // [[1, 2], [3, 4], [5]]
     *
     * @example <caption>Exemple 2 : Découper par lots de 3</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.chunk(['a', 'b', 'c', 'd'], 3)); // [['a', 'b', 'c'], ['d']]
     */
    chunk(list, size = 2) {
        if (!Array.isArray(list) || list.length === 0) {
            return [];
        }
        const chunkSize = Math.max(1, Math.trunc(Number(size) || 1));
        const chunks = [];
        for (let i = 0; i < list.length; i += chunkSize) {
            chunks.push(list.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Extrait une page de résultats à partir d'un tableau avec toutes les métadonnées de pagination.
     *
     * @param {Array} list - Tableau complet des données.
     * @param {number} [page=1] - Numéro de la page souhaitée (commence à `1`).
     * @param {number} [perPage=10] - Nombre d'éléments par page.
     * @returns {{
     *   data: Array,
     *   page: number,
     *   perPage: number,
     *   total: number,
     *   totalPages: number,
     *   hasNext: boolean,
     *   hasPrev: boolean
     * }} Objet de pagination complet.
     *
     * @example <caption>Exemple 1 : Paginer une liste d'éléments</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.paginate([1, 2, 3, 4, 5], 2, 2));
     * // { data: [3, 4], page: 2, perPage: 2, total: 5, totalPages: 3, hasNext: true, hasPrev: true }
     *
     * @example <caption>Exemple 2 : Tableau vide</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.paginate([], 1, 10).totalPages); // 0
     */
    paginate(list, page = 1, perPage = 10) {
        const items = Array.isArray(list) ? list : [];
        const limit = Math.max(1, Math.trunc(Number(perPage) || 10));
        const total = items.length;
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
        const currentPage = Math.max(1, Math.trunc(Number(page) || 1));
        const offset = (currentPage - 1) * limit;
        const data = items.slice(offset, offset + limit);

        return {
            data,
            page: currentPage,
            perPage: limit,
            total,
            totalPages,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1 && total > 0
        };
    }

    /**
     * Mélange aléatoirement les éléments d'un tableau (algorithme de Fisher-Yates) dans une nouvelle copie.
     *
     * @param {Array} list - Tableau à mélanger.
     * @returns {Array} Nouveau tableau mélangé.
     *
     * @example <caption>Exemple 1 : Mélanger une liste</caption>
     * const arrUtil = new NArray();
     * const shuffled = arrUtil.shuffle([1, 2, 3, 4, 5]);
     * console.log(shuffled.length); // 5
     *
     * @example <caption>Exemple 2 : L'original n'est pas modifié</caption>
     * const arrUtil = new NArray();
     * const orig = [1, 2, 3];
     * arrUtil.shuffle(orig);
     * console.log(orig); // [1, 2, 3]
     */
    shuffle(list) {
        if (!Array.isArray(list)) {
            return [];
        }
        const copy = [...list];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    /**
     * Tire aléatoirement un élément (ou `count` éléments uniques) dans un tableau.
     *
     * @param {Array} list - Tableau source.
     * @param {number} [count=1] - Nombre d'éléments à tirer.
     * @returns {any|Array} Un élément si `count === 1`, sinon un tableau de `count` éléments aléatoires.
     *
     * @example <caption>Exemple 1 : Tirer 1 élément au hasard</caption>
     * const arrUtil = new NArray();
     * console.log(['pile', 'face'].includes(arrUtil.sample(['pile', 'face']))); // true
     *
     * @example <caption>Exemple 2 : Tirer 2 éléments au hasard</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.sample([10, 20, 30, 40], 2).length); // 2
     */
    sample(list, count = 1) {
        if (!Array.isArray(list) || list.length === 0) {
            return count === 1 ? undefined : [];
        }
        if (count === 1) {
            return list[Math.floor(Math.random() * list.length)];
        }
        return this.shuffle(list).slice(0, Math.max(0, Math.trunc(count)));
    }

    // =========================================================================
    // Méthodes publiques — Opérations Ensemblistes & Génération de Séquences
    // =========================================================================

    /**
     * Retourne les éléments présents à la fois dans `listA` et dans `listB` (intersection).
     *
     * @param {Array} listA - Premier tableau.
     * @param {Array} listB - Second tableau.
     * @returns {Array} Éléments communs uniques.
     *
     * @example <caption>Exemple 1 : Intersection de deux tableaux</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.intersection([1, 2, 3, 4], [3, 4, 5, 6])); // [3, 4]
     *
     * @example <caption>Exemple 2 : Aucun élément commun</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.intersection([1, 2], [3, 4])); // []
     */
    intersection(listA, listB) {
        if (!Array.isArray(listA) || !Array.isArray(listB)) {
            return [];
        }
        const setB = new Set(listB);
        return this.unique(listA.filter((item) => setB.has(item)));
    }

    /**
     * Retourne les éléments présents dans `listA` mais absents de `listB` (différence `A \ B`).
     *
     * @param {Array} listA - Tableau de base.
     * @param {Array} listB - Tableau des éléments à exclure.
     * @returns {Array} Éléments de `listA` non présents dans `listB`.
     *
     * @example <caption>Exemple 1 : Différence entre deux listes</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.difference([1, 2, 3, 4], [2, 4])); // [1, 3]
     *
     * @example <caption>Exemple 2 : Avec des chaînes</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.difference(['read', 'write', 'delete'], ['delete'])); // ['read', 'write']
     */
    difference(listA, listB) {
        if (!Array.isArray(listA)) {
            return [];
        }
        if (!Array.isArray(listB) || listB.length === 0) {
            return [...listA];
        }
        const setB = new Set(listB);
        return listA.filter((item) => !setB.has(item));
    }

    /**
     * Fusionne plusieurs tableaux en éliminant tous les doublons (union ensembliste).
     *
     * @param {...Array} lists - Tableaux à unir.
     * @returns {Array} Tableau contenant l'union sans doublons.
     *
     * @example <caption>Exemple 1 : Union de deux tableaux</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.union([1, 2], [2, 3], [3, 4])); // [1, 2, 3, 4]
     *
     * @example <caption>Exemple 2 : Union de rôles</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.union(['user'], ['editor', 'user'])); // ['user', 'editor']
     */
    union(...lists) {
        const merged = [];
        for (let i = 0; i < lists.length; i++) {
            if (Array.isArray(lists[i])) {
                merged.push(...lists[i]);
            }
        }
        return this.unique(merged);
    }

    /**
     * Génère un tableau de nombres séquentiels de `start` à `end` (inclus) avec un pas `step`.
     *
     * @param {number} start - Valeur de départ.
     * @param {number} end - Valeur de fin (incluse).
     * @param {number} [step=1] - Pas d'incrémentation.
     * @returns {number[]} Tableau de la séquence générée.
     *
     * @example <caption>Exemple 1 : Séquence croissante de 1 à 5</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.range(1, 5)); // [1, 2, 3, 4, 5]
     *
     * @example <caption>Exemple 2 : Séquence avec un pas de 2 ou décroissante</caption>
     * const arrUtil = new NArray();
     * console.log(arrUtil.range(0, 10, 2)); // [0, 2, 4, 6, 8, 10]
     * console.log(arrUtil.range(5, 1, -1)); // [5, 4, 3, 2, 1]
     */
    range(start, end, step = 1) {
        const s = Number(start);
        const e = Number(end);
        let st = Number(step);
        if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(st) || st === 0) {
            return [];
        }
        if (s > e && st > 0) {
            st = -st;
        }
        const out = [];
        if (st > 0) {
            for (let i = s; i <= e; i += st) {
                out.push(i);
            }
        } else {
            for (let i = s; i >= e; i += st) {
                out.push(i);
            }
        }
        return out;
    }
}

export default NArray;

