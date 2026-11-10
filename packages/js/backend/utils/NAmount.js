/**
 * @file NAmount.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation, la conversion, le calcul financier exact
 * (en centimes / sous-unités pour éviter les erreurs de virgule flottante), la gestion des taxes (TVA),
 * des remises, des devises et le formatage des montants dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

/**
 * @class NAmount
 * @description Utilitaire de gestion et traitement des montants financiers sans état interne.
 *
 * @example <caption>Exemple 1 : Calculs financiers exacts et formatage</caption>
 * const amt = new NAmount();
 * const total = amt.add(19.99, 5.01); // 25 (sans erreur flottante 25.000000000000004)
 * console.log(amt.format(total, 'EUR')); // '25,00 €'
 * console.log(amt.format(125000, 'XOF', { decimals: 0 })); // '125 000 FCFA'
 *
 * @example <caption>Exemple 2 : Calcul de TVA (HT <-> TTC) et remises</caption>
 * const amt = new NAmount();
 * console.log(amt.addTax(100, 18));          // 118 (TTC avec TVA 18%)
 * console.log(amt.extractTax(118, 18));      // { ht: 100, tax: 18, ttc: 118 }
 * console.log(amt.applyDiscount(200, 15));   // 170 (remise de 15%)
 *
 * @example <caption>Exemple 3 : Répartition équitable sans perte de centime</caption>
 * const amt = new NAmount();
 * console.log(amt.allocate(100, 3)); // [33.34, 33.33, 33.33] (somme exacte = 100)
 */
export class NAmount {

    // =========================================================================
    // Méthodes privées internes (Arrondi financier exact sans état)
    // =========================================================================

    /**
     * Arrondit un montant financier selon le nombre de décimales souhaité en compensant
     * les imprécisions de représentation IEEE 754 (`Number.EPSILON`).
     *
     * @param {number} value - Montant brut à arrondir.
     * @param {number} [decimals=2] - Nombre de décimales (`0` pour XOF/XAF/JPY, `2` pour EUR/USD).
     * @returns {number} Montant arrondi.
     *
     * @example <caption>Exemple 1 : Arrondi à 2 décimales</caption>
     * // Interne : #round(10.555, 2) -> 10.56
     *
     * @example <caption>Exemple 2 : Arrondi à 0 décimale</caption>
     * // Interne : #round(1500.6, 0) -> 1501
     */
    #round(value, decimals = 2) {
        const d = Math.max(0, Math.trunc(decimals));
        const factor = 10 ** d;
        return Math.round((value + Number.EPSILON) * factor) / factor;
    }

    /**
     * Retourne le symbole d'affichage associé à un code ou symbole de devise.
     *
     * @param {string} [currency=''] - Code ISO (`EUR`, `USD`, `XOF`, `XAF`, `GBP`, `CAD`, `CHF`, `MAD`, `NGN`) ou symbole.
     * @returns {string} Symbole de la devise.
     *
     * @example <caption>Exemple 1 : Code ISO vers symbole</caption>
     * // Interne : #resolveCurrencySymbol('EUR') -> '€'
     *
     * @example <caption>Exemple 2 : Franc CFA</caption>
     * // Interne : #resolveCurrencySymbol('XOF') -> 'FCFA'
     */
    #resolveCurrencySymbol(currency = '') {
        if (typeof currency !== 'string') {
            return '';
        }
        const trimmed = currency.trim();
        const map = {
            EUR: '€',
            USD: '$',
            GBP: '£',
            XOF: 'FCFA',
            XAF: 'FCFA',
            CAD: '$ CA',
            CHF: 'CHF',
            JPY: '¥',
            CNY: '¥',
            MAD: 'DH',
            NGN: '₦'
        };
        return map[trimmed.toUpperCase()] ?? trimmed;
    }

    // =========================================================================
    // Méthodes publiques — Validation & Parsing de Montants
    // =========================================================================

    /**
     * Vérifie si la valeur fournie est un montant valide (nombre fini ou chaîne monétaire convertible).
     *
     * @param {any} value - Valeur à tester.
     * @param {Object} [options={}] - Options de validation.
     * @param {boolean} [options.allowNegative=false] - Si `true`, autorise les montants négatifs (avoirs, dettes).
     * @param {boolean} [options.allowZero=true] - Si `false`, rejette le montant `0`.
     * @returns {boolean} `true` si le montant est valide selon les critères, sinon `false`.
     *
     * @example <caption>Exemple 1 : Montants positifs valides</caption>
     * const amt = new NAmount();
     * console.log(amt.isValid(1500.50));       // true
     * console.log(amt.isValid('1 250,00 €')); // true
     *
     * @example <caption>Exemple 2 : Rejeter les montants négatifs par défaut</caption>
     * const amt = new NAmount();
     * console.log(amt.isValid(-50));                              // false
     * console.log(amt.isValid(-50, { allowNegative: true }));     // true
     */
    isValid(value, options = {}) {
        const parsed = this.parse(value, null);
        if (parsed === null) {
            return false;
        }
        const allowNegative = options?.allowNegative ?? false;
        const allowZero = options?.allowZero ?? true;
        if (!allowNegative && parsed < 0) {
            return false;
        }
        if (!allowZero && parsed === 0) {
            return false;
        }
        return true;
    }

    /**
     * Extrait et convertit une chaîne formatée (ex: `'12 500,75 FCFA'`, `'$1,250.50'`) ou un nombre
     * en montant numérique propre.
     *
     * @param {any} value - Valeur ou chaîne monétaire à analyser.
     * @param {number|null} [fallback=0] - Valeur retournée si l'analyse échoue.
     * @returns {number|null} Montant numérique ou `fallback`.
     *
     * @example <caption>Exemple 1 : Analyser une chaîne avec espaces, virgule et devise</caption>
     * const amt = new NAmount();
     * console.log(amt.parse('12 500,75 €'));    // 12500.75
     * console.log(amt.parse('250 000 FCFA'));   // 250000
     *
     * @example <caption>Exemple 2 : Format anglo-saxon ou valeur invalide</caption>
     * const amt = new NAmount();
     * console.log(amt.parse('$1,250.50'));      // 1250.5
     * console.log(amt.parse('aucun', null));    // null
     */
    parse(value, fallback = 0) {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : fallback;
        }
        if (typeof value !== 'string') {
            return fallback;
        }
        // Retirer tout sauf les chiffres, signes (-/+), points et virgules
        const cleaned = value.replace(/[^\d.,+-]/g, '').trim();
        if (!cleaned || !/\d/.test(cleaned)) {
            return fallback;
        }

        const lastComma = cleaned.lastIndexOf(',');
        const lastDot = cleaned.lastIndexOf('.');
        let normalized = cleaned;

        if (lastComma !== -1 && lastDot !== -1) {
            // Les deux sont présents : le dernier est le séparateur décimal
            if (lastComma > lastDot) {
                normalized = cleaned.replace(/\./g, '').replace(',', '.');
            } else {
                normalized = cleaned.replace(/,/g, '');
            }
        } else if (lastComma !== -1) {
            // Seulement des virgules : si une seule virgule suivie de 1 ou 2 chiffres (ou plus), c'est la décimale
            const parts = cleaned.split(',');
            if (parts.length === 2 && parts[1].length !== 3) {
                normalized = `${parts[0]}.${parts[1]}`;
            } else if (parts.length === 2 && parts[1].length === 3) {
                normalized = `${parts[0]}.${parts[1]}`;
            } else {
                normalized = cleaned.replace(/,/g, '');
            }
        }

        const num = Number(normalized);
        return Number.isFinite(num) ? num : fallback;
    }

    /**
     * Compare deux montants financiers à une précision décimale donnée (par défaut `2` décimales).
     *
     * @param {number|string} amountA - Premier montant.
     * @param {number|string} amountB - Second montant.
     * @param {number} [decimals=2] - Précision décimale de comparaison.
     * @returns {boolean} `true` si les deux montants sont égaux après arrondi financier.
     *
     * @example <caption>Exemple 1 : Égalité malgré l'imprécision flottante JS</caption>
     * const amt = new NAmount();
     * console.log(amt.equals(0.1 + 0.2, 0.3)); // true
     *
     * @example <caption>Exemple 2 : Comparer un nombre et une chaîne formatée</caption>
     * const amt = new NAmount();
     * console.log(amt.equals(1500, '1 500,00 €')); // true
     */
    equals(amountA, amountB, decimals = 2) {
        const a = this.parse(amountA, null);
        const b = this.parse(amountB, null);
        if (a === null || b === null) {
            return false;
        }
        return this.toMinorUnits(a, decimals) === this.toMinorUnits(b, decimals);
    }

    // =========================================================================
    // Méthodes publiques — Conversion Unités Majeures / Sous-unités (Centimes)
    // =========================================================================

    /**
     * Convertit un montant en sous-unités entières (ex: euros -> centimes : `19.99` -> `1999`).
     * Idéal pour le stockage SQLite en `INTEGER` ou les passerelles de paiement (Stripe, etc.).
     *
     * @param {number|string} amount - Montant en unité majeure.
     * @param {number} [decimals=2] - Nombre de décimales de la devise (`2` pour centimes).
     * @returns {number} Montant entier en sous-unités.
     *
     * @example <caption>Exemple 1 : Convertir des euros en centimes</caption>
     * const amt = new NAmount();
     * console.log(amt.toMinorUnits(19.99)); // 1999
     *
     * @example <caption>Exemple 2 : Convertir une chaîne formatée en centimes</caption>
     * const amt = new NAmount();
     * console.log(amt.toMinorUnits('1 250,50 €')); // 125050
     */
    toMinorUnits(amount, decimals = 2) {
        const parsed = this.parse(amount, 0);
        const factor = 10 ** Math.max(0, Math.trunc(decimals));
        return Math.round((parsed + Number.EPSILON) * factor);
    }

    /**
     * Convertit un montant exprimé en sous-unités entières (centimes) vers l'unité majeure
     * (ex: `1999` -> `19.99`).
     *
     * @param {number|string} minorUnits - Montant en sous-unités (centimes).
     * @param {number} [decimals=2] - Nombre de décimales de la devise.
     * @returns {number} Montant en unité majeure.
     *
     * @example <caption>Exemple 1 : Convertir des centimes en euros</caption>
     * const amt = new NAmount();
     * console.log(amt.fromMinorUnits(1999)); // 19.99
     *
     * @example <caption>Exemple 2 : Avec 3 décimales (ex: Dinar tunisien)</caption>
     * const amt = new NAmount();
     * console.log(amt.fromMinorUnits(15500, 3)); // 15.5
     */
    fromMinorUnits(minorUnits, decimals = 2) {
        const parsed = this.parse(minorUnits, 0);
        const factor = 10 ** Math.max(0, Math.trunc(decimals));
        return this.#round(parsed / factor, decimals);
    }

    // =========================================================================
    // Méthodes publiques — Opérations Arithmétiques Financières Exactes
    // =========================================================================

    /**
     * Additionne deux montants (ou un tableau de montants) sans erreur de virgule flottante.
     *
     * @param {number|string|Array<number|string>} amountA - Premier montant ou tableau de montants.
     * @param {number|string} [amountB=0] - Second montant (ignoré si `amountA` est un tableau).
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {number} Somme exacte arrondie.
     *
     * @example <caption>Exemple 1 : Additionner deux montants</caption>
     * const amt = new NAmount();
     * console.log(amt.add(19.99, 5.01)); // 25
     *
     * @example <caption>Exemple 2 : Additionner une liste de prix</caption>
     * const amt = new NAmount();
     * console.log(amt.add([10.10, 20.20, 30.30])); // 60.6
     */
    add(amountA, amountB = 0, decimals = 2) {
        if (Array.isArray(amountA)) {
            const d = typeof amountB === 'number' ? amountB : decimals;
            let totalMinor = 0;
            for (let i = 0; i < amountA.length; i++) {
                totalMinor += this.toMinorUnits(amountA[i], d);
            }
            return this.fromMinorUnits(totalMinor, d);
        }
        const totalMinor = this.toMinorUnits(amountA, decimals) + this.toMinorUnits(amountB, decimals);
        return this.fromMinorUnits(totalMinor, decimals);
    }

    /**
     * Soustrait `amountB` de `amountA` (`amountA - amountB`) sans erreur de virgule flottante.
     *
     * @param {number|string} amountA - Montant initial.
     * @param {number|string} amountB - Montant à déduire.
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {number} Différence exacte arrondie.
     *
     * @example <caption>Exemple 1 : Soustraction exacte</caption>
     * const amt = new NAmount();
     * console.log(amt.subtract(100, 19.99)); // 80.01
     *
     * @example <caption>Exemple 2 : Soustraction avec chaînes formatées</caption>
     * const amt = new NAmount();
     * console.log(amt.subtract('5 000 FCFA', '1 250 FCFA', 0)); // 3750
     */
    subtract(amountA, amountB, decimals = 2) {
        const diffMinor = this.toMinorUnits(amountA, decimals) - this.toMinorUnits(amountB, decimals);
        return this.fromMinorUnits(diffMinor, decimals);
    }

    /**
     * Multiplie un montant par un facteur (ex: quantité d'articles) avec arrondi financier.
     *
     * @param {number|string} amount - Prix unitaire ou montant.
     * @param {number} factor - Multiplicateur (quantité, coefficient).
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {number} Produit arrondi.
     *
     * @example <caption>Exemple 1 : Prix unitaire x Quantité</caption>
     * const amt = new NAmount();
     * console.log(amt.multiply(19.99, 3)); // 59.97
     *
     * @example <caption>Exemple 2 : Avec coefficient décimal</caption>
     * const amt = new NAmount();
     * console.log(amt.multiply(150, 1.5)); // 225
     */
    multiply(amount, factor, decimals = 2) {
        const a = this.parse(amount, 0);
        const f = this.parse(factor, 0);
        return this.#round(a * f, decimals);
    }

    /**
     * Divise un montant par un diviseur non nul avec arrondi financier.
     *
     * @param {number|string} amount - Montant à diviser.
     * @param {number} divisor - Diviseur (doit être différent de `0`).
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {number} Quotient arrondi (ou `0` si `divisor === 0`).
     *
     * @example <caption>Exemple 1 : Diviser un montant</caption>
     * const amt = new NAmount();
     * console.log(amt.divide(100, 4)); // 25
     *
     * @example <caption>Exemple 2 : Arrondi à 2 décimales</caption>
     * const amt = new NAmount();
     * console.log(amt.divide(100, 3)); // 33.33
     */
    divide(amount, divisor, decimals = 2) {
        const a = this.parse(amount, 0);
        const d = this.parse(divisor, 0);
        if (d === 0) {
            return 0;
        }
        return this.#round(a / d, decimals);
    }

    /**
     * Répartit un montant en `parts` parts (ou selon un tableau de ratios) sans perdre ni créer
     * le moindre centime (le reste des centimes est distribué un par un sur les premières parts).
     *
     * @param {number|string} amount - Montant total à répartir.
     * @param {number|number[]} partsOrRatios - Nombre de parts égales (ex: `3`) ou tableau de poids (ex: `[50, 30, 20]`).
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {number[]} Tableau des montants répartis dont la somme vaut exactement `amount`.
     *
     * @example <caption>Exemple 1 : Répartition en 3 parts égales de 100 €</caption>
     * const amt = new NAmount();
     * console.log(amt.allocate(100, 3)); // [33.34, 33.33, 33.33]
     *
     * @example <caption>Exemple 2 : Répartition par ratios [50, 30, 20]</caption>
     * const amt = new NAmount();
     * console.log(amt.allocate(250, [50, 30, 20])); // [125, 75, 50]
     */
    allocate(amount, partsOrRatios, decimals = 2) {
        const totalMinor = this.toMinorUnits(amount, decimals);
        let ratios = [];

        if (typeof partsOrRatios === 'number' && partsOrRatios > 0) {
            ratios = Array(Math.trunc(partsOrRatios)).fill(1);
        } else if (Array.isArray(partsOrRatios) && partsOrRatios.length > 0) {
            ratios = partsOrRatios.map((r) => Math.max(0, Number(r) || 0));
        } else {
            return [];
        }

        const totalRatio = ratios.reduce((acc, r) => acc + r, 0);
        if (totalRatio <= 0) {
            return ratios.map(() => 0);
        }

        let remainder = totalMinor;
        const shares = ratios.map((ratio) => {
            const share = Math.trunc((totalMinor * ratio) / totalRatio);
            remainder -= share;
            return share;
        });

        const step = remainder >= 0 ? 1 : -1;
        let i = 0;
        while (remainder !== 0) {
            shares[i % shares.length] += step;
            remainder -= step;
            i++;
        }

        return shares.map((s) => this.fromMinorUnits(s, decimals));
    }

    // =========================================================================
    // Méthodes publiques — Taxes (TVA / HT / TTC), Remises & Marges
    // =========================================================================

    /**
     * Calcule uniquement le montant de la taxe (TVA) sur un montant hors taxe (HT).
     *
     * @param {number|string} amountHT - Montant Hors Taxes (HT).
     * @param {number} taxRate - Taux de taxe en pourcentage (ex: `18` pour 18%, `20` pour 20%).
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {number} Montant de la taxe.
     *
     * @example <caption>Exemple 1 : TVA à 20% sur 150 € HT</caption>
     * const amt = new NAmount();
     * console.log(amt.taxAmount(150, 20)); // 30
     *
     * @example <caption>Exemple 2 : TVA à 18% en FCFA (0 décimale)</caption>
     * const amt = new NAmount();
     * console.log(amt.taxAmount(10000, 18, 0)); // 1800
     */
    taxAmount(amountHT, taxRate, decimals = 2) {
        const ht = this.parse(amountHT, 0);
        const rate = this.parse(taxRate, 0);
        return this.#round((ht * rate) / 100, decimals);
    }

    /**
     * Ajoute une taxe (TVA) à un montant Hors Taxes (HT) pour obtenir le montant Toutes Taxes Comprises (TTC).
     *
     * @param {number|string} amountHT - Montant Hors Taxes (HT).
     * @param {number} taxRate - Taux de taxe en pourcentage (ex: `18` ou `20`).
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {number} Montant TTC.
     *
     * @example <caption>Exemple 1 : Calculer le TTC à partir du HT</caption>
     * const amt = new NAmount();
     * console.log(amt.addTax(100, 20)); // 120
     *
     * @example <caption>Exemple 2 : Calculer le TTC avec TVA 18%</caption>
     * const amt = new NAmount();
     * console.log(amt.addTax(50000, 18, 0)); // 59000
     */
    addTax(amountHT, taxRate, decimals = 2) {
        const ht = this.parse(amountHT, 0);
        const tax = this.taxAmount(ht, taxRate, decimals);
        return this.add(ht, tax, decimals);
    }

    /**
     * Extrait le montant Hors Taxes (HT) et le montant de la TVA à partir d'un montant TTC.
     *
     * @param {number|string} amountTTC - Montant Toutes Taxes Comprises (TTC).
     * @param {number} taxRate - Taux de taxe en pourcentage (ex: `18` ou `20`).
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {{ ht: number, tax: number, ttc: number }} Objet détaillant `ht`, `tax` et `ttc`.
     *
     * @example <caption>Exemple 1 : Extraire HT et TVA d'un montant TTC</caption>
     * const amt = new NAmount();
     * console.log(amt.extractTax(120, 20)); // { ht: 100, tax: 20, ttc: 120 }
     *
     * @example <caption>Exemple 2 : TVA 18%</caption>
     * const amt = new NAmount();
     * console.log(amt.extractTax(118, 18)); // { ht: 100, tax: 18, ttc: 118 }
     */
    extractTax(amountTTC, taxRate, decimals = 2) {
        const ttc = this.#round(this.parse(amountTTC, 0), decimals);
        const rate = this.parse(taxRate, 0);
        const ht = this.#round(ttc / (1 + rate / 100), decimals);
        const tax = this.subtract(ttc, ht, decimals);
        return { ht, tax, ttc };
    }

    /**
     * Applique un pourcentage de remise sur un montant et retourne le montant net à payer.
     *
     * @param {number|string} amount - Montant initial.
     * @param {number} discountPercent - Pourcentage de remise (ex: `15` pour 15%).
     * @param {number} [decimals=2] - Précision décimale.
     * @returns {number} Montant net après remise.
     *
     * @example <caption>Exemple 1 : Appliquer 15% de remise sur 200</caption>
     * const amt = new NAmount();
     * console.log(amt.applyDiscount(200, 15)); // 170
     *
     * @example <caption>Exemple 2 : Remise de 25%</caption>
     * const amt = new NAmount();
     * console.log(amt.applyDiscount(99.90, 25)); // 74.93
     */
    applyDiscount(amount, discountPercent, decimals = 2) {
        const base = this.#round(this.parse(amount, 0), decimals);
        const rate = this.parse(discountPercent, 0);
        const discount = this.#round((base * rate) / 100, decimals);
        return this.subtract(base, discount, decimals);
    }

    /**
     * Convertit un montant d'une devise à une autre selon un taux de change.
     *
     * @param {number|string} amount - Montant source.
     * @param {number} exchangeRate - Taux de change (`1 unité source = exchangeRate unités cibles`).
     * @param {number} [decimals=2] - Décimales de la devise cible.
     * @returns {number} Montant converti.
     *
     * @example <caption>Exemple 1 : Convertir EUR vers XOF (1 EUR = 655.957 FCFA)</caption>
     * const amt = new NAmount();
     * console.log(amt.convert(100, 655.957, 0)); // 65596
     *
     * @example <caption>Exemple 2 : Convertir USD vers EUR</caption>
     * const amt = new NAmount();
     * console.log(amt.convert(250, 0.92, 2)); // 230
     */
    convert(amount, exchangeRate, decimals = 2) {
        return this.multiply(amount, exchangeRate, decimals);
    }

    // =========================================================================
    // Méthodes publiques — Formatage Monétaire
    // =========================================================================

    /**
     * Formate un montant avec séparateur de milliers, décimales et devise optionnelle.
     *
     * @param {number|string} amount - Montant à formater.
     * @param {string} [currency=''] - Code ISO (`'EUR'`, `'XOF'`, `'USD'`) ou symbole (`'€'`, `'FCFA'`).
     * @param {Object} [options={}] - Options de formatage.
     * @param {number} [options.decimals] - Nombre de décimales (par défaut `0` pour `XOF`/`XAF`/`JPY`, sinon `2`).
     * @param {string} [options.thousandsSeparator=' '] - Séparateur des milliers.
     * @param {string} [options.decimalSeparator=','] - Séparateur décimal.
     * @param {'after'|'before'} [options.symbolPosition='after'] - Position du symbole de devise.
     * @param {boolean} [options.showPlusSign=false] - Si `true`, affiche `'+'` devant les montants positifs.
     * @returns {string} Montant formaté (ou `''` si invalide).
     *
     * @example <caption>Exemple 1 : Formatage en Euros et Francs CFA</caption>
     * const amt = new NAmount();
     * console.log(amt.format(1250.5, 'EUR'));   // '1 250,50 €'
     * console.log(amt.format(75000, 'XOF'));    // '75 000 FCFA'
     *
     * @example <caption>Exemple 2 : Formatage en Dollars avec symbole devant</caption>
     * const amt = new NAmount();
     * console.log(amt.format(1250.5, 'USD', {
     *     thousandsSeparator: ',',
     *     decimalSeparator: '.',
     *     symbolPosition: 'before'
     * })); // '$1,250.50'
     */
    format(amount, currency = '', options = {}) {
        const num = this.parse(amount, null);
        if (num === null) {
            return '';
        }

        const upperCurr = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
        const isZeroDecimalCurrency = upperCurr === 'XOF' || upperCurr === 'XAF' || upperCurr === 'JPY' || upperCurr === 'FCFA';
        const decimals = options?.decimals !== undefined
            ? Math.max(0, Math.trunc(options.decimals))
            : (isZeroDecimalCurrency ? 0 : 2);

        const thousandsSeparator = options?.thousandsSeparator ?? ' ';
        const decimalSeparator = options?.decimalSeparator ?? ',';
        const symbolPosition = options?.symbolPosition ?? 'after';
        const showPlusSign = options?.showPlusSign ?? false;

        const rounded = this.#round(num, decimals);
        const isNeg = rounded < 0;
        const absFixed = Math.abs(rounded).toFixed(decimals);
        const [intPart, decPart] = absFixed.split('.');

        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
        const sign = isNeg ? '-' : (showPlusSign && rounded > 0 ? '+' : '');
        const numberStr = decPart !== undefined ? `${formattedInt}${decimalSeparator}${decPart}` : formattedInt;

        const symbol = this.#resolveCurrencySymbol(currency);
        if (!symbol) {
            return `${sign}${numberStr}`;
        }

        if (symbolPosition === 'before') {
            return `${sign}${symbol}${numberStr}`;
        }
        return `${sign}${numberStr} ${symbol}`;
    }
}

export default NAmount;

