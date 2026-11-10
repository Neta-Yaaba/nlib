/**
 * @file NNumber.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation, la conversion, le calcul mathématique
 * et le formatage des nombres dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

/**
 * @class NNumber
 * @description Utilitaire de gestion et traitement des nombres sans état interne.
 *
 * @example <caption>Exemple 1 : Validation, arrondi et bornage (clamp)</caption>
 * const num = new NNumber();
 * console.log(num.isNumeric('42.5'));       // true
 * console.log(num.round(3.14159, 2));       // 3.14
 * console.log(num.clamp(150, 0, 100));      // 100
 *
 * @example <caption>Exemple 2 : Formatage de nombres, devises et tailles de fichiers</caption>
 * const num = new NNumber();
 * console.log(num.format(1250000.5, { decimals: 2 })); // '1 250 000,50'
 * console.log(num.formatCurrency(25000, { symbol: '$', decimals: 0 })); // '25 000 $'
 * console.log(num.formatBytes(1048576)); // '1 Mo'
 *
 * @example <caption>Exemple 3 : Calculs de pourcentages et statistiques sur tableau</caption>
 * const num = new NNumber();
 * console.log(num.percentage(25, 200));        // 12.5
 * console.log(num.sum([10, 20, 30]));          // 60
 * console.log(num.average([10, 20, 30]));      // 20
 */
export class NNumber {

    // =========================================================================
    // Méthodes publiques — Vérifications & Comparaisons (Validation)
    // =========================================================================

    /**
     * Vérifie si la valeur fournie est strictement un nombre fini valide (ni `NaN`, ni `Infinity`).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `value` est un nombre fini valide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester des nombres valides</caption>
     * const num = new NNumber();
     * console.log(num.isNumber(42));    // true
     * console.log(num.isNumber(-3.14)); // true
     *
     * @example <caption>Exemple 2 : Rejeter les chaînes, NaN et Infinity</caption>
     * const num = new NNumber();
     * console.log(num.isNumber('42'));     // false
     * console.log(num.isNumber(NaN));      // false
     * console.log(num.isNumber(Infinity)); // false
     */
    isNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    /**
     * Vérifie si une valeur (nombre ou chaîne numérique comme `'42.5'` ou `'-10'`) représente un nombre fini valide.
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si la valeur est numérique, sinon `false`.
     *
     * @example <caption>Exemple 1 : Chaînes numériques et nombres</caption>
     * const num = new NNumber();
     * console.log(num.isNumeric(100));     // true
     * console.log(num.isNumeric('42.75')); // true
     *
     * @example <caption>Exemple 2 : Valeurs non numériques</caption>
     * const num = new NNumber();
     * console.log(num.isNumeric('abc')); // false
     * console.log(num.isNumeric(''));    // false
     * console.log(num.isNumeric(null));  // false
     */
    isNumeric(value) {
        if (this.isNumber(value)) {
            return true;
        }
        if (typeof value !== 'string') {
            return false;
        }
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return false;
        }
        return Number.isFinite(Number(trimmed));
    }

    /**
     * Vérifie si la valeur fournie est un nombre entier.
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `value` est un entier, sinon `false`.
     *
     * @example <caption>Exemple 1 : Nombre entier</caption>
     * const num = new NNumber();
     * console.log(num.isInteger(25));  // true
     * console.log(num.isInteger(-10)); // true
     *
     * @example <caption>Exemple 2 : Nombre décimal ou chaîne</caption>
     * const num = new NNumber();
     * console.log(num.isInteger(25.5)); // false
     * console.log(num.isInteger('25')); // false
     */
    isInteger(value) {
        return Number.isInteger(value);
    }

    /**
     * Vérifie si la valeur fournie est un nombre décimal (flottant possédant une partie fractionnaire non nulle).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `value` est un nombre à virgule, sinon `false`.
     *
     * @example <caption>Exemple 1 : Nombre décimal</caption>
     * const num = new NNumber();
     * console.log(num.isFloat(3.14)); // true
     *
     * @example <caption>Exemple 2 : Nombre entier</caption>
     * const num = new NNumber();
     * console.log(num.isFloat(10));   // false
     * console.log(num.isFloat(10.0)); // false
     */
    isFloat(value) {
        return this.isNumber(value) && !Number.isInteger(value);
    }

    /**
     * Vérifie si un nombre est pair.
     *
     * @param {number} value - Nombre à tester.
     * @returns {boolean} `true` si le nombre est un entier pair, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester un nombre pair</caption>
     * const num = new NNumber();
     * console.log(num.isEven(4)); // true
     * console.log(num.isEven(0)); // true
     *
     * @example <caption>Exemple 2 : Tester un nombre impair</caption>
     * const num = new NNumber();
     * console.log(num.isEven(7)); // false
     */
    isEven(value) {
        return this.isInteger(value) && value % 2 === 0;
    }

    /**
     * Vérifie si un nombre est impair.
     *
     * @param {number} value - Nombre à tester.
     * @returns {boolean} `true` si le nombre est un entier impair, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester un nombre impair</caption>
     * const num = new NNumber();
     * console.log(num.isOdd(3));  // true
     * console.log(num.isOdd(-5)); // true
     *
     * @example <caption>Exemple 2 : Tester un nombre pair</caption>
     * const num = new NNumber();
     * console.log(num.isOdd(8));  // false
     */
    isOdd(value) {
        return this.isInteger(value) && Math.abs(value % 2) === 1;
    }

    /**
     * Vérifie si un nombre est positif.
     *
     * @param {number} value - Nombre à tester.
     * @param {boolean} [includeZero=false] - Si `true`, considère `0` comme positif (`>= 0`).
     * @returns {boolean} `true` si le nombre est positif, sinon `false`.
     *
     * @example <caption>Exemple 1 : Strictement positif (par défaut)</caption>
     * const num = new NNumber();
     * console.log(num.isPositive(10)); // true
     * console.log(num.isPositive(0));  // false
     *
     * @example <caption>Exemple 2 : Positif ou nul (includeZero = true)</caption>
     * const num = new NNumber();
     * console.log(num.isPositive(0, true)); // true
     */
    isPositive(value, includeZero = false) {
        if (!this.isNumber(value)) {
            return false;
        }
        return includeZero ? value >= 0 : value > 0;
    }

    /**
     * Vérifie si un nombre est négatif.
     *
     * @param {number} value - Nombre à tester.
     * @param {boolean} [includeZero=false] - Si `true`, considère `0` comme négatif (`<= 0`).
     * @returns {boolean} `true` si le nombre est négatif, sinon `false`.
     *
     * @example <caption>Exemple 1 : Strictement négatif (par défaut)</caption>
     * const num = new NNumber();
     * console.log(num.isNegative(-5)); // true
     * console.log(num.isNegative(0));  // false
     *
     * @example <caption>Exemple 2 : Négatif ou nul (includeZero = true)</caption>
     * const num = new NNumber();
     * console.log(num.isNegative(0, true)); // true
     */
    isNegative(value, includeZero = false) {
        if (!this.isNumber(value)) {
            return false;
        }
        return includeZero ? value <= 0 : value < 0;
    }

    /**
     * Vérifie si un nombre est compris entre `min` et `max`.
     *
     * @param {number} value - Nombre à tester.
     * @param {number} min - Borne inférieure.
     * @param {number} max - Borne supérieure.
     * @param {boolean} [inclusive=true] - Si `true` (par défaut), inclut les bornes `min` et `max`.
     * @returns {boolean} `true` si `value` est dans l'intervalle, sinon `false`.
     *
     * @example <caption>Exemple 1 : Intervalle inclusif [min, max] (par défaut)</caption>
     * const num = new NNumber();
     * console.log(num.isBetween(10, 10, 20)); // true
     *
     * @example <caption>Exemple 2 : Intervalle strictement exclusif ]min, max[</caption>
     * const num = new NNumber();
     * console.log(num.isBetween(10, 10, 20, false)); // false
     * console.log(num.isBetween(15, 10, 20, false)); // true
     */
    isBetween(value, min, max, inclusive = true) {
        if (!this.isNumber(value) || !this.isNumber(min) || !this.isNumber(max)) {
            return false;
        }
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        return inclusive
            ? value >= lower && value <= upper
            : value > lower && value < upper;
    }

    /**
     * Vérifie si deux nombres sont égaux, avec une tolérance optionnelle (`epsilon`)
     * pour éviter les imprécisions classiques des nombres flottants (ex: `0.1 + 0.2`).
     *
     * @param {number} numA - Premier nombre.
     * @param {number} numB - Deuxième nombre.
     * @param {number} [tolerance=0] - Marge d'écart maximale autorisée (`>= 0`).
     * @returns {boolean} `true` si les deux nombres sont égaux à `tolerance` près, sinon `false`.
     *
     * @example <caption>Exemple 1 : Comparaison exacte d'entiers</caption>
     * const num = new NNumber();
     * console.log(num.equals(42, 42)); // true
     * console.log(num.equals(42, 43)); // false
     *
     * @example <caption>Exemple 2 : Comparaison de flottants avec tolérance</caption>
     * const num = new NNumber();
     * console.log(num.equals(0.1 + 0.2, 0.3, 1e-9)); // true
     */
    equals(numA, numB, tolerance = 0) {
        if (!this.isNumber(numA) || !this.isNumber(numB)) {
            return false;
        }
        const eps = Math.max(0, Number(tolerance) || 0);
        return Math.abs(numA - numB) <= eps;
    }

    // =========================================================================
    // Méthodes publiques — Conversions, Arrondis & Bornage
    // =========================================================================

    /**
     * Convertit une valeur en nombre entier, ou retourne `defaultValue` si la conversion échoue.
     *
     * @param {any} value - Valeur à convertir.
     * @param {number} [defaultValue=0] - Valeur de repli en cas d'échec.
     * @param {number} [radix=10] - Base numérique (10 par défaut, 16 pour l'hexadécimal, 2 pour le binaire).
     * @returns {number} Entier converti ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Convertir une chaîne en entier</caption>
     * const num = new NNumber();
     * console.log(num.toInt('128'));       // 128
     * console.log(num.toInt('invalide'));  // 0
     *
     * @example <caption>Exemple 2 : Convertir un nombre hexadécimal en base 16</caption>
     * const num = new NNumber();
     * console.log(num.toInt('FF', 0, 16)); // 255
     */
    toInt(value, defaultValue = 0, radix = 10) {
        if (this.isInteger(value)) {
            return value;
        }
        const parsed = Number.parseInt(String(value ?? '').trim(), radix);
        return Number.isNaN(parsed) ? defaultValue : parsed;
    }

    /**
     * Convertit une valeur en nombre décimal (supporte le point `.` ainsi que la virgule `,`),
     * ou retourne `defaultValue` si la conversion échoue.
     *
     * @param {any} value - Valeur à convertir (ex: `'19.99'` ou `'19,99'`).
     * @param {number} [defaultValue=0] - Valeur de repli en cas d'échec.
     * @returns {number} Nombre décimal converti ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Convertir une chaîne avec point ou virgule</caption>
     * const num = new NNumber();
     * console.log(num.toFloat('12.75')); // 12.75
     * console.log(num.toFloat('12,75')); // 12.75
     *
     * @example <caption>Exemple 2 : Valeur par défaut personnalisée si invalide</caption>
     * const num = new NNumber();
     * console.log(num.toFloat('erreur', -1)); // -1
     */
    toFloat(value, defaultValue = 0) {
        if (this.isNumber(value)) {
            return value;
        }
        const normalized = String(value ?? '').trim().replace(',', '.');
        const parsed = Number.parseFloat(normalized);
        return Number.isNaN(parsed) ? defaultValue : parsed;
    }

    /**
     * Contraint un nombre à rester dans les limites `[min, max]`.
     *
     * @param {number} value - Nombre à borner.
     * @param {number} min - Valeur minimale autorisée.
     * @param {number} max - Valeur maximale autorisée.
     * @returns {number} Nombre contraint entre `min` et `max`.
     *
     * @example <caption>Exemple 1 : Plafonner un pourcentage entre 0 et 100</caption>
     * const num = new NNumber();
     * console.log(num.clamp(120, 0, 100)); // 100
     * console.log(num.clamp(-15, 0, 100)); // 0
     *
     * @example <caption>Exemple 2 : Valeur déjà dans l'intervalle</caption>
     * const num = new NNumber();
     * console.log(num.clamp(45, 0, 100));  // 45
     */
    clamp(value, min, max) {
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        return Math.min(Math.max(Number(value) || 0, lower), upper);
    }

    /**
     * Arrondit un nombre au plus proche selon le nombre de décimales souhaité.
     *
     * @param {number} value - Nombre à arrondir.
     * @param {number} [decimals=0] - Nombre de chiffres après la virgule.
     * @returns {number} Nombre arrondi.
     *
     * @example <caption>Exemple 1 : Arrondir à l'entier le plus proche (par défaut)</caption>
     * const num = new NNumber();
     * console.log(num.round(4.6)); // 5
     *
     * @example <caption>Exemple 2 : Arrondir à 2 décimales</caption>
     * const num = new NNumber();
     * console.log(num.round(19.995, 2)); // 20
     * console.log(num.round(3.14159, 2)); // 3.14
     */
    round(value, decimals = 0) {
        const dec = Math.max(0, Math.floor(Number(decimals) || 0));
        const factor = 10 ** dec;
        return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
    }

    /**
     * Arrondit un nombre à l'inférieur selon le nombre de décimales souhaité.
     *
     * @param {number} value - Nombre à tronquer vers le bas.
     * @param {number} [decimals=0] - Nombre de chiffres après la virgule.
     * @returns {number} Nombre arrondi à l'inférieur.
     *
     * @example <caption>Exemple 1 : Arrondir à l'entier inférieur</caption>
     * const num = new NNumber();
     * console.log(num.floor(4.9)); // 4
     *
     * @example <caption>Exemple 2 : Arrondir à 2 décimales à l'inférieur</caption>
     * const num = new NNumber();
     * console.log(num.floor(3.149, 2)); // 3.14
     */
    floor(value, decimals = 0) {
        const dec = Math.max(0, Math.floor(Number(decimals) || 0));
        const factor = 10 ** dec;
        return Math.floor(Number(value) * factor) / factor;
    }

    /**
     * Arrondit un nombre au supérieur selon le nombre de décimales souhaité.
     *
     * @param {number} value - Nombre à arrondir vers le haut.
     * @param {number} [decimals=0] - Nombre de chiffres après la virgule.
     * @returns {number} Nombre arrondi au supérieur.
     *
     * @example <caption>Exemple 1 : Arrondir à l'entier supérieur</caption>
     * const num = new NNumber();
     * console.log(num.ceil(4.1)); // 5
     *
     * @example <caption>Exemple 2 : Arrondir à 2 décimales au supérieur</caption>
     * const num = new NNumber();
     * console.log(num.ceil(3.141, 2)); // 3.15
     */
    ceil(value, decimals = 0) {
        const dec = Math.max(0, Math.floor(Number(decimals) || 0));
        const factor = 10 ** dec;
        return Math.ceil(Number(value) * factor) / factor;
    }

    // =========================================================================
    // Méthodes publiques — Calculs, Pourcentages, Aléatoire & Statistiques
    // =========================================================================

    /**
     * Calcule le pourcentage que représente `part` par rapport à `total` (`(part / total) * 100`).
     * Retourne `0` si `total` vaut `0`.
     *
     * @param {number} part - Valeur partielle.
     * @param {number} total - Valeur totale de référence.
     * @param {number} [decimals=2] - Nombre de décimales pour l'arrondi du résultat.
     * @returns {number} Pourcentage calculé.
     *
     * @example <caption>Exemple 1 : Calculer un taux de réussite</caption>
     * const num = new NNumber();
     * console.log(num.percentage(45, 60)); // 75
     *
     * @example <caption>Exemple 2 : Protection contre la division par zéro</caption>
     * const num = new NNumber();
     * console.log(num.percentage(10, 0)); // 0
     */
    percentage(part, total, decimals = 2) {
        const t = Number(total);
        if (!t) {
            return 0;
        }
        return this.round((Number(part) / t) * 100, decimals);
    }

    /**
     * Calcule la valeur correspondant à `percent` % d'un montant `total` (`(percent / 100) * total`).
     *
     * @param {number} percent - Pourcentage à appliquer (ex: `20` pour 20%).
     * @param {number} total - Montant ou total de base.
     * @param {number} [decimals=2] - Nombre de décimales pour l'arrondi.
     * @returns {number} Valeur correspondante.
     *
     * @example <caption>Exemple 1 : Calculer une remise de 15% sur 200</caption>
     * const num = new NNumber();
     * console.log(num.percentageOf(15, 200)); // 30
     *
     * @example <caption>Exemple 2 : Calculer une taxe de 18% sur 15 000</caption>
     * const num = new NNumber();
     * console.log(num.percentageOf(18, 15000)); // 2700
     */
    percentageOf(percent, total, decimals = 2) {
        return this.round((Number(percent) / 100) * Number(total), decimals);
    }

    /**
     * Calcule la somme de tous les nombres d'un tableau.
     *
     * @param {number[]} [numbers=[]] - Tableau de nombres.
     * @returns {number} Somme totale (`0` si le tableau est vide).
     *
     * @example <caption>Exemple 1 : Somme d'une liste de montants</caption>
     * const num = new NNumber();
     * console.log(num.sum([100, 250, 50])); // 400
     *
     * @example <caption>Exemple 2 : Tableau vide</caption>
     * const num = new NNumber();
     * console.log(num.sum([])); // 0
     */
    sum(numbers = []) {
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return 0;
        }
        return numbers.reduce((acc, val) => acc + (Number(val) || 0), 0);
    }

    /**
     * Calcule la moyenne arithmétique d'un tableau de nombres.
     *
     * @param {number[]} [numbers=[]] - Tableau de nombres.
     * @param {number} [decimals=2] - Nombre de décimales pour l'arrondi.
     * @returns {number} Moyenne calculée (`0` si le tableau est vide).
     *
     * @example <caption>Exemple 1 : Moyenne de notes</caption>
     * const num = new NNumber();
     * console.log(num.average([12, 15, 18])); // 15
     *
     * @example <caption>Exemple 2 : Moyenne arrondie à 2 décimales</caption>
     * const num = new NNumber();
     * console.log(num.average([10, 11, 13], 2)); // 11.33
     */
    average(numbers = [], decimals = 2) {
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return 0;
        }
        return this.round(this.sum(numbers) / numbers.length, decimals);
    }

    /**
     * Retourne la plus petite valeur d'un tableau de nombres.
     *
     * @param {number[]} [numbers=[]] - Tableau de nombres.
     * @returns {number|null} Valeur minimale, ou `null` si le tableau est vide.
     *
     * @example <caption>Exemple 1 : Trouver le minimum d'un tableau</caption>
     * const num = new NNumber();
     * console.log(num.min([45, 12, 89, 3])); // 3
     *
     * @example <caption>Exemple 2 : Tableau vide</caption>
     * const num = new NNumber();
     * console.log(num.min([])); // null
     */
    min(numbers = []) {
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return null;
        }
        return Math.min(...numbers.map(Number));
    }

    /**
     * Retourne la plus grande valeur d'un tableau de nombres.
     *
     * @param {number[]} [numbers=[]] - Tableau de nombres.
     * @returns {number|null} Valeur maximale, ou `null` si le tableau est vide.
     *
     * @example <caption>Exemple 1 : Trouver le maximum d'un tableau</caption>
     * const num = new NNumber();
     * console.log(num.max([45, 12, 89, 3])); // 89
     *
     * @example <caption>Exemple 2 : Tableau vide</caption>
     * const num = new NNumber();
     * console.log(num.max([])); // null
     */
    max(numbers = []) {
        if (!Array.isArray(numbers) || numbers.length === 0) {
            return null;
        }
        return Math.max(...numbers.map(Number));
    }

    /**
     * Génère un nombre entier aléatoire compris entre `min` et `max` inclus.
     *
     * @param {number} [min=0] - Borne minimale incluse.
     * @param {number} [max=100] - Borne maximale incluse.
     * @returns {number} Entier aléatoire.
     *
     * @example <caption>Exemple 1 : Lancer un dé à 6 faces (entre 1 et 6)</caption>
     * const num = new NNumber();
     * const de = num.randomInt(1, 6);
     * console.log(num.isBetween(de, 1, 6)); // true
     *
     * @example <caption>Exemple 2 : Générer un nombre entre 0 et 100 par défaut</caption>
     * const num = new NNumber();
     * console.log(num.isInteger(num.randomInt())); // true
     */
    randomInt(min = 0, max = 100) {
        const lower = Math.ceil(Math.min(min, max));
        const upper = Math.floor(Math.max(min, max));
        return Math.floor(Math.random() * (upper - lower + 1)) + lower;
    }

    /**
     * Génère un nombre décimal aléatoire compris entre `min` et `max`.
     *
     * @param {number} [min=0] - Borne minimale.
     * @param {number} [max=1] - Borne maximale.
     * @param {number} [decimals=2] - Nombre de décimales souhaitées.
     * @returns {number} Nombre décimal aléatoire.
     *
     * @example <caption>Exemple 1 : Nombre aléatoire entre 0 et 1 à 2 décimales</caption>
     * const num = new NNumber();
     * const val = num.randomFloat();
     * console.log(num.isBetween(val, 0, 1)); // true
     *
     * @example <caption>Exemple 2 : Prix aléatoire entre 10 et 50 à 2 décimales</caption>
     * const num = new NNumber();
     * const prix = num.randomFloat(10, 50, 2);
     * console.log(num.isBetween(prix, 10, 50)); // true
     */
    randomFloat(min = 0, max = 1, decimals = 2) {
        const lower = Math.min(min, max);
        const upper = Math.max(min, max);
        const raw = Math.random() * (upper - lower) + lower;
        return this.round(raw, decimals);
    }

    // =========================================================================
    // Méthodes publiques — Formatage (Formatting)
    // =========================================================================

    /**
     * Formate un nombre avec séparateur de milliers, séparateur décimal et nombre fixe de décimales.
     * Fonctionne 100% hors-ligne de manière déterministe sur tous les OS.
     *
     * @param {number|string} value - Nombre à formater.
     * @param {Object} [options={}] - Options de formatage.
     * @param {number} [options.decimals=0] - Nombre de chiffres après la virgule.
     * @param {string} [options.thousandsSeparator=' '] - Séparateur des milliers (par défaut espace `' '`).
     * @param {string} [options.decimalSeparator=','] - Séparateur décimal (par défaut virgule `','`).
     * @returns {string} Nombre formaté sous forme de chaîne.
     *
     * @example <caption>Exemple 1 : Formater un grand entier avec espaces entre milliers</caption>
     * const num = new NNumber();
     * console.log(num.format(1250000)); // '1 250 000'
     *
     * @example <caption>Exemple 2 : Formater avec 2 décimales et séparateurs personnalisés</caption>
     * const num = new NNumber();
     * console.log(num.format(1250000.5, { decimals: 2 })); // '1 250 000,50'
     * console.log(num.format(1250000.5, {
     *     decimals: 2,
     *     thousandsSeparator: ',',
     *     decimalSeparator: '.'
     * })); // '1,250,000.50'
     */
    format(value, options = {}) {
        const opts = options ?? {};
        const dec = Math.max(0, Math.floor(Number(opts.decimals ?? 0)));
        const thousandsSep = opts.thousandsSeparator !== undefined ? String(opts.thousandsSeparator) : ' ';
        const decimalSep = opts.decimalSeparator !== undefined ? String(opts.decimalSeparator) : ',';

        const num = this.toFloat(value, 0);
        const isNeg = num < 0;
        const fixed = Math.abs(num).toFixed(dec);
        const [intPart, decPart] = fixed.split('.');

        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
        const result = dec > 0 ? `${formattedInt}${decimalSep}${decPart}` : formattedInt;

        return isNeg ? `-${result}` : result;
    }

    /**
     * Formate un montant monétaire avec symbole de devise, séparateur de milliers et décimales.
     *
     * @param {number|string} value - Montant à formater.
     * @param {Object} [options={}] - Options de devise.
     * @param {string} [options.symbol='$'] - Symbole ou code de la devise (`'$'`, `'€'`, `'$'`).
     * @param {string} [options.position='after'] - Position du symbole : `'after'` (après) ou `'before'` (avant).
     * @param {number} [options.decimals=0] - Nombre de décimales.
     * @param {string} [options.thousandsSeparator=' '] - Séparateur de milliers.
     * @param {string} [options.decimalSeparator=','] - Séparateur décimal.
     * @returns {string} Montant monétaire formaté.
     *
     * @example <caption>Exemple 1 : Formatage en $ (par défaut)</caption>
     * const num = new NNumber();
     * console.log(num.formatCurrency(150000)); // '150 000 $'
     *
     * @example <caption>Exemple 2 : Formatage en Euros ou Dollars avec symbole avant/après</caption>
     * const num = new NNumber();
     * console.log(num.formatCurrency(1250.5, { symbol: '€', decimals: 2 })); // '1 250,50 €'
     * console.log(num.formatCurrency(99.99, {
     *     symbol: '$',
     *     position: 'before',
     *     decimals: 2,
     *     thousandsSeparator: ',',
     *     decimalSeparator: '.'
     * })); // '$99.99'
     */
    formatCurrency(value, options = {}) {
        const opts = options ?? {};
        const symbol = opts.symbol !== undefined ? String(opts.symbol) : '$';
        const position = opts.position === 'before' ? 'before' : 'after';
        const formattedNumber = this.format(value, opts);

        if (!symbol) {
            return formattedNumber;
        }
        return position === 'before'
            ? `${symbol}${formattedNumber}`
            : `${formattedNumber} ${symbol}`;
    }

    /**
     * Formate une taille exprimée en octets vers une chaîne lisible (`o`, `Ko`, `Mo`, `Go`, `To`).
     *
     * @param {number} bytes - Taille en octets.
     * @param {number} [decimals=2] - Nombre maximal de décimales.
     * @returns {string} Taille formatée avec son unité.
     *
     * @example <caption>Exemple 1 : Convertir des octets en Ko et Mo</caption>
     * const num = new NNumber();
     * console.log(num.formatBytes(1024));    // '1 Ko'
     * console.log(num.formatBytes(1572864)); // '1.5 Mo'
     *
     * @example <caption>Exemple 2 : Taille nulle</caption>
     * const num = new NNumber();
     * console.log(num.formatBytes(0));       // '0 o'
     */
    formatBytes(bytes, decimals = 2) {
        const b = Number(bytes) || 0;
        if (b <= 0) {
            return '0 o';
        }
        const units = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po'];
        const k = 1024;
        const i = Math.min(Math.floor(Math.log(b) / Math.log(k)), units.length - 1);
        const value = this.round(b / (k ** i), decimals);
        return `${value} ${units[i]}`;
    }

    /**
     * Complète un nombre entier avec des zéros en tête pour atteindre une longueur minimale.
     *
     * @param {number|string} value - Nombre à compléter.
     * @param {number} [length=2] - Longueur minimale souhaitée.
     * @returns {string} Nombre formaté avec zéros en tête.
     *
     * @example <caption>Exemple 1 : Formater les heures ou mois sur 2 chiffres</caption>
     * const num = new NNumber();
     * console.log(num.pad(7));     // '07'
     *
     * @example <caption>Exemple 2 : Formater un numéro de facture sur 5 chiffres</caption>
     * const num = new NNumber();
     * console.log(num.pad(42, 5)); // '00042'
     */
    pad(value, length = 2) {
        const num = this.toInt(value, 0);
        const sign = num < 0 ? '-' : '';
        const digits = String(Math.abs(num)).padStart(Math.max(1, Math.floor(Number(length) || 2)), '0');
        return `${sign}${digits}`;
    }
}

export default NNumber;

