/**
 * @file NDateTime.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation, la conversion, le calcul, la comparaison
 * et le formatage des dates et heures dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

/**
 * @class NDateTime
 * @description Utilitaire de gestion et traitement des dates et heures sans état interne.
 *
 * @example <caption>Exemple 1 : Création, formatage et extraction de composants</caption>
 * const dt = new NDateTime();
 * const date = dt.create(2026, 11, 10, 14, 30, 0);
 * console.log(dt.format(date, 'DD/MM/YYYY HH:mm')); // '10/11/2026 14:30'
 * console.log(dt.toSql(date));                      // '2026-11-10 14:30:00'
 *
 * @example <caption>Exemple 2 : Arithmétique de dates (ajout et soustraction)</caption>
 * const dt = new NDateTime();
 * const nextWeek = dt.addDays('2026-11-10', 7);
 * console.log(dt.format(nextWeek, 'YYYY-MM-DD'));   // '2026-11-17'
 *
 * @example <caption>Exemple 3 : Comparaison, écarts et âge</caption>
 * const dt = new NDateTime();
 * console.log(dt.diffInDays('2026-11-01', '2026-11-10')); // 9
 * console.log(dt.isBetween('2026-11-10', '2026-11-01', '2026-11-30')); // true
 * console.log(dt.getAge('2000-05-15', '2026-11-10'));     // 26
 */
export class NDateTime {

    // =========================================================================
    // Méthodes privées internes (Normalisation & Helpers sans état)
    // =========================================================================

    /**
     *Complète un nombre avec des zéros en tête (ex: `5` -> `'05'`).
     *
     * @param {number} num - Nombre à formater.
     * @param {number} [length=2] - Longueur souhaitée.
     * @returns {string} Chaîne complétée avec des zéros.
     *
     * @example <caption>Exemple 1 : Compléter sur 2 chiffres</caption>
     * // Interne : #pad(5, 2) -> '05'
     *
     * @example <caption>Exemple 2 : Compléter les millisecondes sur 3 chiffres</caption>
     * // Interne : #pad(7, 3) -> '007'
     */
    #pad(num, length = 2) {
        return String(Math.trunc(Math.abs(num))).padStart(length, '0');
    }

    // =========================================================================
    // Méthodes publiques — Création & Conversion (Parsing)
    // =========================================================================

    /**
     * Retourne la date et l'heure actuelles (UTC par défaut) sous forme de chaîne formatée.
     *
     * @param {string} [format='YYYY-MM-DD HH:mm:ss'] - Modèle de formatage (`YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`, `SSS`).
     * @param {boolean} [utc=true] - Si `true`, utilise l'heure UTC (`getUTCFullYear`, etc.) ; sinon l'heure locale.
     * @returns {string} Date et heure actuelles formatées en chaîne de caractères.
     *
     * @example <caption>Exemple 1 : Date et heure actuelles au format standard</caption>
     * const dt = new NDateTime();
     * console.log(dt.now()); // ex: '2026-11-10 10:02:11'
     *
     * @example <caption>Exemple 2 : Format personnalisé</caption>
     * const dt = new NDateTime();
     * console.log(dt.now('DD/MM/YYYY HH:mm')); // ex: '10/11/2026 10:02'
     */
    now(format = 'YYYY-MM-DD HH:mm:ss', utc = true) {
        const date = new Date();
        const formatMap = utc
            ? {
                YYYY: String(date.getUTCFullYear()),
                YY: String(date.getUTCFullYear()).slice(-2),
                MM: String(date.getUTCMonth() + 1).padStart(2, '0'),
                DD: String(date.getUTCDate()).padStart(2, '0'),
                HH: String(date.getUTCHours()).padStart(2, '0'),
                mm: String(date.getUTCMinutes()).padStart(2, '0'),
                ss: String(date.getUTCSeconds()).padStart(2, '0'),
                SSS: String(date.getUTCMilliseconds()).padStart(3, '0')
            }
            : {
                YYYY: String(date.getFullYear()),
                YY: String(date.getFullYear()).slice(-2),
                MM: String(date.getMonth() + 1).padStart(2, '0'),
                DD: String(date.getDate()).padStart(2, '0'),
                HH: String(date.getHours()).padStart(2, '0'),
                mm: String(date.getMinutes()).padStart(2, '0'),
                ss: String(date.getSeconds()).padStart(2, '0'),
                SSS: String(date.getMilliseconds()).padStart(3, '0')
            };

        return String(format).replace(/YYYY|YY|MM|DD|HH|mm|ss|SSS/g, (match) => formatMap[match]);
    }

    /**
     * Retourne uniquement la date actuelle (UTC par défaut) sous forme de chaîne formatée.
     *
     * @param {string} [format='YYYY-MM-DD'] - Modèle de formatage de la date (`YYYY`, `MM`, `DD`).
     * @param {boolean} [utc=true] - Si `true`, utilise la date UTC ; sinon la date locale.
     * @returns {string} Date actuelle formatée en chaîne de caractères.
     *
     * @example <caption>Exemple 1 : Date actuelle au format YYYY-MM-DD</caption>
     * const dt = new NDateTime();
     * console.log(dt.nowDate()); // ex: '2026-11-10'
     *
     * @example <caption>Exemple 2 : Date actuelle au format français DD/MM/YYYY</caption>
     * const dt = new NDateTime();
     * console.log(dt.nowDate('DD/MM/YYYY')); // ex: '10/11/2026'
     */
    nowDate(format = 'YYYY-MM-DD', utc = true) {
        return this.now(format, utc);
    }

    /**
     * Retourne uniquement l'heure actuelle (UTC par défaut) sous forme de chaîne formatée.
     *
     * @param {string} [format='HH:mm:ss'] - Modèle de formatage de l'heure (`HH`, `mm`, `ss`, `SSS`).
     * @param {boolean} [utc=true] - Si `true`, utilise l'heure UTC ; sinon l'heure locale.
     * @returns {string} Heure actuelle formatée en chaîne de caractères.
     *
     * @example <caption>Exemple 1 : Heure actuelle complète HH:mm:ss</caption>
     * const dt = new NDateTime();
     * console.log(dt.nowTime()); // ex: '10:02:11'
     *
     * @example <caption>Exemple 2 : Heure et minutes uniquement</caption>
     * const dt = new NDateTime();
     * console.log(dt.nowTime('HH:mm')); // ex: '10:02'
     */
    nowTime(format = 'HH:mm:ss', utc = true) {
        return this.now(format, utc);
    }

    /**
     * Retourne le timestamp actuel en millisecondes (ou en secondes si `inSeconds = true`).
     *
     * @param {boolean} [inSeconds=false] - Si `true`, retourne le timestamp Unix en secondes.
     * @returns {number} Timestamp numérique.
     *
     * @example <caption>Exemple 1 : Timestamp en millisecondes</caption>
     * const dt = new NDateTime();
     * console.log(typeof dt.timestamp()); // 'number'
     *
     * @example <caption>Exemple 2 : Timestamp Unix en secondes</caption>
     * const dt = new NDateTime();
     * console.log(dt.timestamp(true)); // ex: 1794304174
     */
    timestamp(inSeconds = false) {
        const ms = Date.now();
        return inSeconds ? Math.floor(ms / 1000) : ms;
    }

    /**
     * Crée une instance `Date` à partir des composants humains (mois de `1` à `12`).
     *
     * @param {number} year - Année complète (ex: `2026`).
     * @param {number} [month=1] - Mois de `1` (Janvier) à `12` (Décembre).
     * @param {number} [day=1] - Jour du mois (`1` à `31`).
     * @param {number} [hours=0] - Heures (`0` à `23`).
     * @param {number} [minutes=0] - Minutes (`0` à `59`).
     * @param {number} [seconds=0] - Secondes (`0` à `59`).
     * @param {number} [ms=0] - Millisecondes (`0` à `999`).
     * @returns {Date} Nouvelle instance `Date`.
     *
     * @example <caption>Exemple 1 : Créer une date simple</caption>
     * const dt = new NDateTime();
     * const d = dt.create(2026, 11, 10);
     * console.log(dt.format(d, 'YYYY-MM-DD')); // '2026-11-10'
     *
     * @example <caption>Exemple 2 : Créer une date avec heure précise</caption>
     * const dt = new NDateTime();
     * const d = dt.create(2026, 11, 10, 14, 30, 45);
     * console.log(dt.toSql(d)); // '2026-11-10 14:30:45'
     */
    create(year, month = 1, day = 1, hours = 0, minutes = 0, seconds = 0, ms = 0) {
        return new Date(year, month - 1, day, hours, minutes, seconds, ms);
    }

    /**
     * Convertit une valeur (`Date`, timestamp numérique, chaîne ISO/SQL ou format `DD/MM/YYYY`)
     * en une nouvelle instance `Date` valide, ou retourne `null` si la valeur est invalide.
     *
     * @param {Date|number|string} value - Valeur à convertir en `Date`.
     * @returns {Date|null} Nouvelle instance `Date` clonée ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Convertir une chaîne ISO ou SQL</caption>
     * const dt = new NDateTime();
     * const d1 = dt.toDate('2026-11-10 14:30:00');
     * const d2 = dt.toDate('10/11/2026');
     * console.log(dt.format(d1, 'YYYY-MM-DD'), dt.format(d2, 'YYYY-MM-DD')); // '2026-11-10' '2026-11-10'
     *
     * @example <caption>Exemple 2 : Valeur invalide retourne null</caption>
     * const dt = new NDateTime();
     * console.log(dt.toDate('date-invalide')); // null
     * console.log(dt.toDate(null));            // null
     */
    toDate(value) {
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            const d = new Date(value);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.length === 0) {
                return null;
            }
            // Format YYYY-MM-DD (avec ou sans HH:mm:ss) interprété en heure locale
            const isoLocalMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/.exec(trimmed);
            if (isoLocalMatch) {
                const y = Number(isoLocalMatch[1]);
                const m = Number(isoLocalMatch[2]);
                const day = Number(isoLocalMatch[3]);
                const h = isoLocalMatch[4] ? Number(isoLocalMatch[4]) : 0;
                const min = isoLocalMatch[5] ? Number(isoLocalMatch[5]) : 0;
                const sec = isoLocalMatch[6] ? Number(isoLocalMatch[6]) : 0;
                const ms = isoLocalMatch[7] ? Number(isoLocalMatch[7].padEnd(3, '0')) : 0;
                const constructed = new Date(y, m - 1, day, h, min, sec, ms);
                if (
                    constructed.getFullYear() === y &&
                    constructed.getMonth() === m - 1 &&
                    constructed.getDate() === day
                ) {
                    return constructed;
                }
                return null;
            }
            // Format DD/MM/YYYY (avec ou sans HH:mm:ss)
            const frMatch = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmed);
            if (frMatch) {
                const day = Number(frMatch[1]);
                const m = Number(frMatch[2]);
                const y = Number(frMatch[3]);
                const h = frMatch[4] ? Number(frMatch[4]) : 0;
                const min = frMatch[5] ? Number(frMatch[5]) : 0;
                const sec = frMatch[6] ? Number(frMatch[6]) : 0;
                const constructed = new Date(y, m - 1, day, h, min, sec, 0);
                if (
                    constructed.getFullYear() === y &&
                    constructed.getMonth() === m - 1 &&
                    constructed.getDate() === day
                ) {
                    return constructed;
                }
                return null;
            }
            const parsed = new Date(trimmed);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
        return null;
    }

    // =========================================================================
    // Méthodes publiques — Vérifications & Comparaisons
    // =========================================================================

    /**
     * Vérifie si la valeur fournie est une date valide (ou convertible en date valide).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si la date est valide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Dates valides</caption>
     * const dt = new NDateTime();
     * console.log(dt.isValid(new Date()));      // true
     * console.log(dt.isValid('2026-11-10'));    // true
     * console.log(dt.isValid('10/11/2026'));    // true
     *
     * @example <caption>Exemple 2 : Dates invalides (ex: 31 février)</caption>
     * const dt = new NDateTime();
     * console.log(dt.isValid('2026-02-31'));    // false
     * console.log(dt.isValid('texte'));         // false
     */
    isValid(value) {
        return this.toDate(value) !== null;
    }

    /**
     * Vérifie si une année (ou la date fournie) est une année bissextile.
     *
     * @param {number|Date|string} yearOrDate - Année numérique (ex: `2024`) ou date.
     * @returns {boolean} `true` si l'année est bissextile, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester une année numérique</caption>
     * const dt = new NDateTime();
     * console.log(dt.isLeapYear(2024)); // true
     * console.log(dt.isLeapYear(2026)); // false
     *
     * @example <caption>Exemple 2 : Tester à partir d'une date</caption>
     * const dt = new NDateTime();
     * console.log(dt.isLeapYear('2024-02-29')); // true
     */
    isLeapYear(yearOrDate) {
        const year = typeof yearOrDate === 'number'
            ? Math.trunc(yearOrDate)
            : this.getYear(yearOrDate);
        if (year === null || !Number.isFinite(year)) {
            return false;
        }
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    /**
     * Vérifie si la date tombe un week-end (samedi ou dimanche).
     *
     * @param {Date|number|string} value - Date à tester.
     * @returns {boolean} `true` si c'est samedi ou dimanche, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester un samedi</caption>
     * const dt = new NDateTime();
     * console.log(dt.isWeekend('2026-11-14')); // true (Samedi)
     *
     * @example <caption>Exemple 2 : Tester un jour ouvré</caption>
     * const dt = new NDateTime();
     * console.log(dt.isWeekend('2026-11-10')); // false (Mardi)
     */
    isWeekend(value) {
        const d = this.toDate(value);
        if (!d) {
            return false;
        }
        const day = d.getDay();
        return day === 0 || day === 6;
    }

    /**
     * Vérifie si la date tombe un jour de semaine ouvré (du lundi au vendredi).
     *
     * @param {Date|number|string} value - Date à tester.
     * @returns {boolean} `true` si c'est entre lundi et vendredi, sinon `false`.
     *
     * @example <caption>Exemple 1 : Jour de semaine</caption>
     * const dt = new NDateTime();
     * console.log(dt.isWeekday('2026-11-10')); // true
     *
     * @example <caption>Exemple 2 : Week-end</caption>
     * const dt = new NDateTime();
     * console.log(dt.isWeekday('2026-11-15')); // false (Dimanche)
     */
    isWeekday(value) {
        const d = this.toDate(value);
        if (!d) {
            return false;
        }
        const day = d.getDay();
        return day >= 1 && day <= 5;
    }

    /**
     * Vérifie si la date fournie correspond à la date d'aujourd'hui (même année, mois et jour).
     *
     * @param {Date|number|string} value - Date à tester.
     * @returns {boolean} `true` si la date est aujourd'hui, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester l'instant présent</caption>
     * const dt = new NDateTime();
     * console.log(dt.isToday(dt.now())); // true
     *
     * @example <caption>Exemple 2 : Tester une date passée</caption>
     * const dt = new NDateTime();
     * console.log(dt.isToday('2000-01-01')); // false
     */
    isToday(value) {
        return this.equals(value, new Date(), { ignoreTime: true });
    }

    /**
     * Vérifie si la date fournie est dans le passé par rapport à une date de référence (par défaut maintenant).
     *
     * @param {Date|number|string} value - Date à tester.
     * @param {Date|number|string} [reference=new Date()] - Date de référence.
     * @returns {boolean} `true` si `value` est antérieure à `reference`.
     *
     * @example <caption>Exemple 1 : Date passée</caption>
     * const dt = new NDateTime();
     * console.log(dt.isPast('2020-01-01')); // true
     *
     * @example <caption>Exemple 2 : Avec une date de référence</caption>
     * const dt = new NDateTime();
     * console.log(dt.isPast('2026-11-05', '2026-11-10')); // true
     */
    isPast(value, reference = new Date()) {
        return this.isBefore(value, reference);
    }

    /**
     * Vérifie si la date fournie est dans le futur par rapport à une date de référence (par défaut maintenant).
     *
     * @param {Date|number|string} value - Date à tester.
     * @param {Date|number|string} [reference=new Date()] - Date de référence.
     * @returns {boolean} `true` si `value` est postérieure à `reference`.
     *
     * @example <caption>Exemple 1 : Date future</caption>
     * const dt = new NDateTime();
     * console.log(dt.isFuture('2099-01-01')); // true
     *
     * @example <caption>Exemple 2 : Avec une date de référence</caption>
     * const dt = new NDateTime();
     * console.log(dt.isFuture('2026-11-15', '2026-11-10')); // true
     */
    isFuture(value, reference = new Date()) {
        return this.isAfter(value, reference);
    }

    /**
     * Vérifie si deux dates sont égales.
     *
     * @param {Date|number|string} dateA - Première date.
     * @param {Date|number|string} dateB - Seconde date.
     * @param {Object} [options={}] - Options de comparaison.
     * @param {boolean} [options.ignoreTime=false] - Si `true`, compare uniquement l'année, le mois et le jour.
     * @returns {boolean} `true` si les deux dates sont égales, sinon `false`.
     *
     * @example <caption>Exemple 1 : Comparaison exacte</caption>
     * const dt = new NDateTime();
     * console.log(dt.equals('2026-11-10 14:00:00', '2026-11-10 14:00:00')); // true
     *
     * @example <caption>Exemple 2 : Comparer uniquement le jour (ignoreTime)</caption>
     * const dt = new NDateTime();
     * console.log(dt.equals('2026-11-10 08:00:00', '2026-11-10 22:30:00', { ignoreTime: true })); // true
     */
    equals(dateA, dateB, options = {}) {
        const a = this.toDate(dateA);
        const b = this.toDate(dateB);
        if (!a || !b) {
            return false;
        }
        if (options?.ignoreTime === true) {
            return (
                a.getFullYear() === b.getFullYear() &&
                a.getMonth() === b.getMonth() &&
                a.getDate() === b.getDate()
            );
        }
        return a.getTime() === b.getTime();
    }

    /**
     * Vérifie si `dateA` est strictement antérieure à `dateB`.
     *
     * @param {Date|number|string} dateA - Date à vérifier.
     * @param {Date|number|string} dateB - Date de référence.
     * @returns {boolean} `true` si `dateA < dateB`, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier l'antériorité</caption>
     * const dt = new NDateTime();
     * console.log(dt.isBefore('2026-11-01', '2026-11-10')); // true
     *
     * @example <caption>Exemple 2 : Cas où la date est postérieure</caption>
     * const dt = new NDateTime();
     * console.log(dt.isBefore('2026-11-15', '2026-11-10')); // false
     */
    isBefore(dateA, dateB) {
        const a = this.toDate(dateA);
        const b = this.toDate(dateB);
        if (!a || !b) {
            return false;
        }
        return a.getTime() < b.getTime();
    }

    /**
     * Vérifie si `dateA` est strictement postérieure à `dateB`.
     *
     * @param {Date|number|string} dateA - Date à vérifier.
     * @param {Date|number|string} dateB - Date de référence.
     * @returns {boolean} `true` si `dateA > dateB`, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier la postériorité</caption>
     * const dt = new NDateTime();
     * console.log(dt.isAfter('2026-11-15', '2026-11-10')); // true
     *
     * @example <caption>Exemple 2 : Cas où la date est antérieure</caption>
     * const dt = new NDateTime();
     * console.log(dt.isAfter('2026-11-01', '2026-11-10')); // false
     */
    isAfter(dateA, dateB) {
        const a = this.toDate(dateA);
        const b = this.toDate(dateB);
        if (!a || !b) {
            return false;
        }
        return a.getTime() > b.getTime();
    }

    /**
     * Vérifie si une date est comprise dans un intervalle `[start, end]`.
     *
     * @param {Date|number|string} value - Date à tester.
     * @param {Date|number|string} start - Date de début.
     * @param {Date|number|string} end - Date de fin.
     * @param {boolean} [inclusive=true] - Si `true`, inclut les bornes `start` et `end`.
     * @returns {boolean} `true` si la date est dans l'intervalle, sinon `false`.
     *
     * @example <caption>Exemple 1 : Intervalle inclusif</caption>
     * const dt = new NDateTime();
     * console.log(dt.isBetween('2026-11-10', '2026-11-01', '2026-11-30')); // true
     *
     * @example <caption>Exemple 2 : Intervalle exclusif sur une borne</caption>
     * const dt = new NDateTime();
     * console.log(dt.isBetween('2026-11-01', '2026-11-01', '2026-11-30', false)); // false
     */
    isBetween(value, start, end, inclusive = true) {
        const d = this.toDate(value);
        const s = this.toDate(start);
        const e = this.toDate(end);
        if (!d || !s || !e) {
            return false;
        }
        const t = d.getTime();
        const min = Math.min(s.getTime(), e.getTime());
        const max = Math.max(s.getTime(), e.getTime());
        return inclusive ? (t >= min && t <= max) : (t > min && t < max);
    }

    // =========================================================================
    // Méthodes publiques — Extraction de Composants
    // =========================================================================

    /**
     * Retourne l'année à 4 chiffres d'une date (ex: `2026`), ou `null` si invalide.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {number|null} Année ou `null`.
     *
     * @example <caption>Exemple 1 : Extraire l'année</caption>
     * const dt = new NDateTime();
     * console.log(dt.getYear('2026-11-10')); // 2026
     *
     * @example <caption>Exemple 2 : Date invalide</caption>
     * const dt = new NDateTime();
     * console.log(dt.getYear('invalide')); // null
     */
    getYear(value) {
        const d = this.toDate(value);
        return d ? d.getFullYear() : null;
    }

    /**
     * Retourne le numéro du mois humain de `1` (Janvier) à `12` (Décembre), ou `null` si invalide.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {number|null} Mois (`1` à `12`) ou `null`.
     *
     * @example <caption>Exemple 1 : Extraire le mois (1-12)</caption>
     * const dt = new NDateTime();
     * console.log(dt.getMonth('2026-11-10')); // 11
     *
     * @example <caption>Exemple 2 : Janvier retourne 1</caption>
     * const dt = new NDateTime();
     * console.log(dt.getMonth('2026-01-15')); // 1
     */
    getMonth(value) {
        const d = this.toDate(value);
        return d ? d.getMonth() + 1 : null;
    }

    /**
     * Retourne le jour du mois (`1` à `31`), ou `null` si invalide.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {number|null} Jour du mois (`1` à `31`) ou `null`.
     *
     * @example <caption>Exemple 1 : Extraire le jour du mois</caption>
     * const dt = new NDateTime();
     * console.log(dt.getDay('2026-11-10')); // 10
     *
     * @example <caption>Exemple 2 : À partir d'un format français</caption>
     * const dt = new NDateTime();
     * console.log(dt.getDay('25/12/2026')); // 25
     */
    getDay(value) {
        const d = this.toDate(value);
        return d ? d.getDate() : null;
    }

    /**
     * Retourne le jour de la semaine (`1` = Lundi ... `7` = Dimanche selon la norme ISO 8601),
     * ou `null` si la date est invalide.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {number|null} Jour ISO (`1` à `7`) ou `null`.
     *
     * @example <caption>Exemple 1 : Mardi retourne 2</caption>
     * const dt = new NDateTime();
     * console.log(dt.getDayOfWeek('2026-11-10')); // 2
     *
     * @example <caption>Exemple 2 : Dimanche retourne 7</caption>
     * const dt = new NDateTime();
     * console.log(dt.getDayOfWeek('2026-11-15')); // 7
     */
    getDayOfWeek(value) {
        const d = this.toDate(value);
        if (!d) {
            return null;
        }
        const day = d.getDay();
        return day === 0 ? 7 : day;
    }

    /**
     * Retourne les heures (`0` à `23`), ou `null` si invalide.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {number|null} Heures (`0` à `23`) ou `null`.
     *
     * @example <caption>Exemple 1 : Extraire l'heure</caption>
     * const dt = new NDateTime();
     * console.log(dt.getHours('2026-11-10 14:35:20')); // 14
     *
     * @example <caption>Exemple 2 : Date sans heure spécifiée</caption>
     * const dt = new NDateTime();
     * console.log(dt.getHours('2026-11-10')); // 0
     */
    getHours(value) {
        const d = this.toDate(value);
        return d ? d.getHours() : null;
    }

    /**
     * Retourne les minutes (`0` à `59`), ou `null` si invalide.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {number|null} Minutes (`0` à `59`) ou `null`.
     *
     * @example <caption>Exemple 1 : Extraire les minutes</caption>
     * const dt = new NDateTime();
     * console.log(dt.getMinutes('2026-11-10 14:35:20')); // 35
     *
     * @example <caption>Exemple 2 : Date invalide</caption>
     * const dt = new NDateTime();
     * console.log(dt.getMinutes('invalide')); // null
     */
    getMinutes(value) {
        const d = this.toDate(value);
        return d ? d.getMinutes() : null;
    }

    /**
     * Retourne les secondes (`0` à `59`), ou `null` si invalide.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {number|null} Secondes (`0` à `59`) ou `null`.
     *
     * @example <caption>Exemple 1 : Extraire les secondes</caption>
     * const dt = new NDateTime();
     * console.log(dt.getSeconds('2026-11-10 14:35:20')); // 20
     *
     * @example <caption>Exemple 2 : Date sans secondes</caption>
     * const dt = new NDateTime();
     * console.log(dt.getSeconds('2026-11-10 14:35')); // 0
     */
    getSeconds(value) {
        const d = this.toDate(value);
        return d ? d.getSeconds() : null;
    }

    /**
     * Retourne le nombre total de jours dans le mois de la date fournie (ou d'un couple `(year, month)`).
     *
     * @param {Date|number|string} yearOrDate - Date ou année numérique.
     * @param {number} [month] - Mois (`1` à `12`) si le premier argument est une année.
     * @returns {number|null} Nombre de jours (`28`, `29`, `30` ou `31`) ou `null`.
     *
     * @example <caption>Exemple 1 : Nombre de jours à partir d'une date</caption>
     * const dt = new NDateTime();
     * console.log(dt.daysInMonth('2026-11-10')); // 30
     *
     * @example <caption>Exemple 2 : Février d'une année bissextile</caption>
     * const dt = new NDateTime();
     * console.log(dt.daysInMonth(2024, 2)); // 29
     */
    daysInMonth(yearOrDate, month) {
        if (typeof yearOrDate === 'number' && typeof month === 'number') {
            if (month < 1 || month > 12) {
                return null;
            }
            return new Date(yearOrDate, month, 0).getDate();
        }
        const d = this.toDate(yearOrDate);
        if (!d) {
            return null;
        }
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    }

    // =========================================================================
    // Méthodes publiques — Arithmétique & Manipulation de Dates
    // =========================================================================

    /**
     * Ajoute (ou soustrait si négatif) un nombre d'années à une date.
     *
     * @param {Date|number|string} value - Date initiale.
     * @param {number} years - Nombre d'années à ajouter (ou soustraire).
     * @returns {Date|null} Nouvelle instance `Date` ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Ajouter 5 ans</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.addYears('2026-11-10', 5), 'YYYY-MM-DD')); // '2031-11-10'
     *
     * @example <caption>Exemple 2 : Retirer 2 ans</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.addYears('2026-11-10', -2), 'YYYY-MM-DD')); // '2024-11-10'
     */
    addYears(value, years) {
        return this.addMonths(value, Math.trunc(years) * 12);
    }

    /**
     * Ajoute (ou soustrait si négatif) un nombre de mois à une date en gérant les fins de mois
     * (ex: 31 janvier + 1 mois -> 28 ou 29 février).
     *
     * @param {Date|number|string} value - Date initiale.
     * @param {number} months - Nombre de mois à ajouter (ou soustraire).
     * @returns {Date|null} Nouvelle instance `Date` ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Ajouter 3 mois</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.addMonths('2026-11-10', 3), 'YYYY-MM-DD')); // '2027-02-10'
     *
     * @example <caption>Exemple 2 : Gestion automatique de fin de mois</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.addMonths('2026-01-31', 1), 'YYYY-MM-DD')); // '2026-02-28'
     */
    addMonths(value, months) {
        const d = this.toDate(value);
        if (!d || typeof months !== 'number' || !Number.isFinite(months)) {
            return null;
        }
        const originalDay = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + Math.trunc(months));
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(originalDay, maxDay));
        return d;
    }

    /**
     * Ajoute (ou soustrait si négatif) un nombre de jours à une date.
     *
     * @param {Date|number|string} value - Date initiale.
     * @param {number} days - Nombre de jours à ajouter (ou soustraire).
     * @returns {Date|null} Nouvelle instance `Date` ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Ajouter 10 jours</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.addDays('2026-11-10', 10), 'YYYY-MM-DD')); // '2026-11-20'
     *
     * @example <caption>Exemple 2 : Soustraire 15 jours</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.addDays('2026-11-10', -15), 'YYYY-MM-DD')); // '2026-10-26'
     */
    addDays(value, days) {
        const d = this.toDate(value);
        if (!d || typeof days !== 'number' || !Number.isFinite(days)) {
            return null;
        }
        d.setDate(d.getDate() + Math.trunc(days));
        return d;
    }

    /**
     * Ajoute (ou soustrait si négatif) un nombre d'heures à une date.
     *
     * @param {Date|number|string} value - Date initiale.
     * @param {number} hours - Nombre d'heures à ajouter.
     * @returns {Date|null} Nouvelle instance `Date` ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Ajouter 5 heures</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.addHours('2026-11-10 10:00:00', 5))); // '2026-11-10 15:00:00'
     *
     * @example <caption>Exemple 2 : Retirer 2 heures</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.addHours('2026-11-10 01:00:00', -2))); // '2026-11-09 23:00:00'
     */
    addHours(value, hours) {
        return this.addMinutes(value, hours * 60);
    }

    /**
     * Ajoute (ou soustrait si négatif) un nombre de minutes à une date.
     *
     * @param {Date|number|string} value - Date initiale.
     * @param {number} minutes - Nombre de minutes à ajouter.
     * @returns {Date|null} Nouvelle instance `Date` ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Ajouter 45 minutes</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.addMinutes('2026-11-10 14:30:00', 45))); // '2026-11-10 15:15:00'
     *
     * @example <caption>Exemple 2 : Retirer 30 minutes</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.addMinutes('2026-11-10 14:15:00', -30))); // '2026-11-10 13:45:00'
     */
    addMinutes(value, minutes) {
        return this.addSeconds(value, minutes * 60);
    }

    /**
     * Ajoute (ou soustrait si négatif) un nombre de secondes à une date.
     *
     * @param {Date|number|string} value - Date initiale.
     * @param {number} seconds - Nombre de secondes à ajouter.
     * @returns {Date|null} Nouvelle instance `Date` ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Ajouter 90 secondes</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.addSeconds('2026-11-10 14:00:00', 90))); // '2026-11-10 14:01:30'
     *
     * @example <caption>Exemple 2 : Retirer 10 secondes</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.addSeconds('2026-11-10 14:00:05', -10))); // '2026-11-10 13:59:55'
     */
    addSeconds(value, seconds) {
        const d = this.toDate(value);
        if (!d || typeof seconds !== 'number' || !Number.isFinite(seconds)) {
            return null;
        }
        return new Date(d.getTime() + Math.trunc(seconds * 1000));
    }

    // =========================================================================
    // Méthodes publiques — Bornes de Périodes (Début / Fin de journée, mois, année)
    // =========================================================================

    /**
     * Retourne une nouvelle date positionnée au tout début de la journée (`00:00:00.000`).
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {Date|null} Date à `00:00:00.000` ou `null`.
     *
     * @example <caption>Exemple 1 : Début de journée</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.startOfDay('2026-11-10 18:45:12'))); // '2026-11-10 00:00:00'
     *
     * @example <caption>Exemple 2 : Date invalide</caption>
     * const dt = new NDateTime();
     * console.log(dt.startOfDay('invalide')); // null
     */
    startOfDay(value) {
        const d = this.toDate(value);
        if (!d) {
            return null;
        }
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Retourne une nouvelle date positionnée à la toute fin de la journée (`23:59:59.999`).
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {Date|null} Date à `23:59:59.999` ou `null`.
     *
     * @example <caption>Exemple 1 : Fin de journée</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.endOfDay('2026-11-10 09:15:00'))); // '2026-11-10 23:59:59'
     *
     * @example <caption>Exemple 2 : Vérifier les millisecondes</caption>
     * const dt = new NDateTime();
     * console.log(dt.endOfDay('2026-11-10').getMilliseconds()); // 999
     */
    endOfDay(value) {
        const d = this.toDate(value);
        if (!d) {
            return null;
        }
        d.setHours(23, 59, 59, 999);
        return d;
    }

    /**
     * Retourne une nouvelle date positionnée au premier jour du mois à `00:00:00.000`.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {Date|null} Début du mois ou `null`.
     *
     * @example <caption>Exemple 1 : Premier jour du mois</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.startOfMonth('2026-11-18 14:20:00'))); // '2026-11-01 00:00:00'
     *
     * @example <caption>Exemple 2 : Format date simple</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.startOfMonth('2026-02-15'), 'YYYY-MM-DD')); // '2026-02-01'
     */
    startOfMonth(value) {
        const d = this.toDate(value);
        if (!d) {
            return null;
        }
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Retourne une nouvelle date positionnée au dernier jour du mois à `23:59:59.999`.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {Date|null} Fin du mois ou `null`.
     *
     * @example <caption>Exemple 1 : Dernier jour de novembre</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.endOfMonth('2026-11-10'))); // '2026-11-30 23:59:59'
     *
     * @example <caption>Exemple 2 : Dernier jour de février bissextile</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.endOfMonth('2024-02-05'), 'YYYY-MM-DD')); // '2024-02-29'
     */
    endOfMonth(value) {
        const d = this.toDate(value);
        if (!d) {
            return null;
        }
        d.setMonth(d.getMonth() + 1, 0);
        d.setHours(23, 59, 59, 999);
        return d;
    }

    /**
     * Retourne une nouvelle date positionnée au 1er janvier de l'année à `00:00:00.000`.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {Date|null} Début de l'année ou `null`.
     *
     * @example <caption>Exemple 1 : Début de l'année</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.startOfYear('2026-11-10'))); // '2026-01-01 00:00:00'
     *
     * @example <caption>Exemple 2 : Format court</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.startOfYear('2026-07-14'), 'DD/MM/YYYY')); // '01/01/2026'
     */
    startOfYear(value) {
        const d = this.toDate(value);
        if (!d) {
            return null;
        }
        d.setMonth(0, 1);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Retourne une nouvelle date positionnée au 31 décembre de l'année à `23:59:59.999`.
     *
     * @param {Date|number|string} value - Date cible.
     * @returns {Date|null} Fin de l'année ou `null`.
     *
     * @example <caption>Exemple 1 : Fin de l'année</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql(dt.endOfYear('2026-11-10'))); // '2026-12-31 23:59:59'
     *
     * @example <caption>Exemple 2 : Format court</caption>
     * const dt = new NDateTime();
     * console.log(dt.format(dt.endOfYear('2026-03-01'), 'DD/MM/YYYY')); // '31/12/2026'
     */
    endOfYear(value) {
        const d = this.toDate(value);
        if (!d) {
            return null;
        }
        d.setMonth(11, 31);
        d.setHours(23, 59, 59, 999);
        return d;
    }

    // =========================================================================
    // Méthodes publiques — Calculs d'Écarts (Différences & Âge)
    // =========================================================================

    /**
     * Calcule la différence en secondes entre deux dates (`dateB - dateA`).
     *
     * @param {Date|number|string} dateA - Date de départ.
     * @param {Date|number|string} dateB - Date de fin.
     * @param {boolean} [absolute=true] - Si `true`, retourne une valeur absolue positive.
     * @returns {number|null} Différence en secondes ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Écart en secondes</caption>
     * const dt = new NDateTime();
     * console.log(dt.diffInSeconds('2026-11-10 14:00:00', '2026-11-10 14:02:30')); // 150
     *
     * @example <caption>Exemple 2 : Écart signé (non absolu)</caption>
     * const dt = new NDateTime();
     * console.log(dt.diffInSeconds('2026-11-10 14:02:00', '2026-11-10 14:00:00', false)); // -120
     */
    diffInSeconds(dateA, dateB, absolute = true) {
        const a = this.toDate(dateA);
        const b = this.toDate(dateB);
        if (!a || !b) {
            return null;
        }
        const diff = Math.trunc((b.getTime() - a.getTime()) / 1000);
        return absolute ? Math.abs(diff) : diff;
    }

    /**
     * Calcule la différence en minutes entre deux dates (`dateB - dateA`).
     *
     * @param {Date|number|string} dateA - Date de départ.
     * @param {Date|number|string} dateB - Date de fin.
     * @param {boolean} [absolute=true] - Si `true`, retourne une valeur absolue positive.
     * @returns {number|null} Différence en minutes ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Écart en minutes</caption>
     * const dt = new NDateTime();
     * console.log(dt.diffInMinutes('2026-11-10 14:00:00', '2026-11-10 15:30:00')); // 90
     *
     * @example <caption>Exemple 2 : Écart signé</caption>
     * const dt = new NDateTime();
     * console.log(dt.diffInMinutes('2026-11-10 15:30:00', '2026-11-10 14:00:00', false)); // -90
     */
    diffInMinutes(dateA, dateB, absolute = true) {
        const sec = this.diffInSeconds(dateA, dateB, absolute);
        return sec === null ? null : Math.trunc(sec / 60);
    }

    /**
     * Calcule la différence en heures entre deux dates (`dateB - dateA`).
     *
     * @param {Date|number|string} dateA - Date de départ.
     * @param {Date|number|string} dateB - Date de fin.
     * @param {boolean} [absolute=true] - Si `true`, retourne une valeur absolue positive.
     * @returns {number|null} Différence en heures ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Écart en heures</caption>
     * const dt = new NDateTime();
     * console.log(dt.diffInHours('2026-11-10 08:00:00', '2026-11-10 20:00:00')); // 12
     *
     * @example <caption>Exemple 2 : Sur plusieurs jours</caption>
     * const dt = new NDateTime();
     * console.log(dt.diffInHours('2026-11-10 00:00:00', '2026-11-12 00:00:00')); // 48
     */
    diffInHours(dateA, dateB, absolute = true) {
        const min = this.diffInMinutes(dateA, dateB, absolute);
        return min === null ? null : Math.trunc(min / 60);
    }

    /**
     * Calcule la différence en jours entre deux dates (`dateB - dateA`).
     *
     * @param {Date|number|string} dateA - Date de départ.
     * @param {Date|number|string} dateB - Date de fin.
     * @param {boolean} [absolute=true] - Si `true`, retourne une valeur absolue positive.
     * @returns {number|null} Différence en jours ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Écart en jours</caption>
     * const dt = new NDateTime();
     * console.log(dt.diffInDays('2026-11-01', '2026-11-10')); // 9
     *
     * @example <caption>Exemple 2 : Écart négatif si non absolu</caption>
     * const dt = new NDateTime();
     * console.log(dt.diffInDays('2026-11-10', '2026-11-01', false)); // -9
     */
    diffInDays(dateA, dateB, absolute = true) {
        const a = this.toDate(dateA);
        const b = this.toDate(dateB);
        if (!a || !b) {
            return null;
        }
        const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        const diff = Math.trunc((utcB - utcA) / 86400000);
        return absolute ? Math.abs(diff) : diff;
    }

    /**
     * Calcule l'âge en années révolues à partir d'une date de naissance.
     *
     * @param {Date|number|string} birthDate - Date de naissance.
     * @param {Date|number|string} [referenceDate=new Date()] - Date de référence pour le calcul.
     * @returns {number|null} Âge en années ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Calculer l'âge à une date donnée</caption>
     * const dt = new NDateTime();
     * console.log(dt.getAge('1995-06-15', '2026-11-10')); // 31
     *
     * @example <caption>Exemple 2 : Anniversaire non encore passé dans l'année</caption>
     * const dt = new NDateTime();
     * console.log(dt.getAge('1995-12-25', '2026-11-10')); // 30
     */
    getAge(birthDate, referenceDate = new Date()) {
        const birth = this.toDate(birthDate);
        const ref = this.toDate(referenceDate);
        if (!birth || !ref) {
            return null;
        }
        let age = ref.getFullYear() - birth.getFullYear();
        const monthDiff = ref.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }

    // =========================================================================
    // Méthodes publiques — Formatage (Pattern, SQL, ISO)
    // =========================================================================

    /**
     * Formate une date selon un motif de jetons (`YYYY`, `YY`, `MM`, `DD`, `HH`, `mm`, `ss`, `SSS`).
     *
     * Jetons supportés :
     * - `YYYY` : Année sur 4 chiffres (`2026`)
     * - `YY`   : Année sur 2 chiffres (`26`)
     * - `MM`   : Mois sur 2 chiffres (`01` à `12`)
     * - `DD`   : Jour sur 2 chiffres (`01` à `31`)
     * - `HH`   : Heures sur 2 chiffres 24h (`00` à `23`)
     * - `mm`   : Minutes sur 2 chiffres (`00` à `59`)
     * - `ss`   : Secondes sur 2 chiffres (`00` à `59`)
     * - `SSS`  : Millisecondes sur 3 chiffres (`000` à `999`)
     *
     * @param {Date|number|string} value - Date à formater.
     * @param {string} [pattern='YYYY-MM-DD HH:mm:ss'] - Modèle de formatage.
     * @returns {string} Chaîne formatée, ou `''` si la date est invalide.
     *
     * @example <caption>Exemple 1 : Format français</caption>
     * const dt = new NDateTime();
     * console.log(dt.format('2026-11-10 14:05:09', 'DD/MM/YYYY à HH:mm')); // '10/11/2026 à 14:05'
     *
     * @example <caption>Exemple 2 : Format compact avec millisecondes</caption>
     * const dt = new NDateTime();
     * const d = dt.create(2026, 11, 10, 8, 5, 3, 42);
     * console.log(dt.format(d, 'YYYYMMDD_HHmmss_SSS')); // '20261110_080503_042'
     */
    format(value, pattern = 'YYYY-MM-DD HH:mm:ss') {
        const d = this.toDate(value);
        if (!d || typeof pattern !== 'string') {
            return '';
        }
        const tokens = {
            YYYY: String(d.getFullYear()),
            YY: String(d.getFullYear()).slice(-2),
            MM: this.#pad(d.getMonth() + 1, 2),
            DD: this.#pad(d.getDate(), 2),
            HH: this.#pad(d.getHours(), 2),
            mm: this.#pad(d.getMinutes(), 2),
            ss: this.#pad(d.getSeconds(), 2),
            SSS: this.#pad(d.getMilliseconds(), 3)
        };
        return pattern.replace(/YYYY|YY|MM|DD|HH|mm|ss|SSS/g, (match) => tokens[match]);
    }

    /**
     * Formate une date au standard SQL (`YYYY-MM-DD HH:mm:ss` ou `YYYY-MM-DD` si `includeTime = false`).
     *
     * @param {Date|number|string} [value=new Date()] - Date à formater.
     * @param {boolean} [includeTime=true] - Si `false`, retourne uniquement `YYYY-MM-DD`.
     * @returns {string} Date formatée pour SQLite/SQL, ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Format DATETIME SQL complet</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql('10/11/2026 14:30:00')); // '2026-11-10 14:30:00'
     *
     * @example <caption>Exemple 2 : Format DATE SQL sans l'heure</caption>
     * const dt = new NDateTime();
     * console.log(dt.toSql('10/11/2026 14:30:00', false)); // '2026-11-10'
     */
    toSql(value = new Date(), includeTime = true) {
        return this.format(value, includeTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD');
    }

    /**
     * Formate une date au standard ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
     *
     * @param {Date|number|string} [value=new Date()] - Date à convertir.
     * @returns {string} Chaîne ISO 8601 ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Obtenir la chaîne ISO 8601</caption>
     * const dt = new NDateTime();
     * console.log(dt.toIso('2026-11-10').startsWith('2026-11-')); // true
     *
     * @example <caption>Exemple 2 : Date invalide retourne une chaîne vide</caption>
     * const dt = new NDateTime();
     * console.log(dt.toIso('invalide')); // ''
     */
    toIso(value = new Date()) {
        const d = this.toDate(value);
        return d ? d.toISOString() : '';
    }
}

export default NDateTime;

