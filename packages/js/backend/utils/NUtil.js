/**
 * @file NUtil.js
 * @package @nlib/js-backend
 * @description Utilitaires transversaux statiques de NLib (génération UUID v4 et identifiants courts,
 * vérification de types, temporisation datetime-driven `setTimeout` / `clearTimeout`, `sleep`,
 * `debounce`, `throttle`, `retry`).
 */

import { NEvent } from '../core/NEvent.js';
import { NObject } from '../core/NObject.js';
import { NStr } from './NStr.js';
import { NCrypto } from './NCrypto.js';
import { NJson } from './NJson.js';
import { NLog } from '../log/NLog.js';

/**
 * @class NUtil
 * @description Classe statique regroupant les méthodes utilitaires transversales de NLib
 * (identifiants uniques, inspection de types, temporisation et résilience).
 *
 * @example <caption>Exemple 1 : Générer des identifiants et inspecter des types</caption>
 * console.log(NUtil.uuid());             // ex: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
 * console.log(NUtil.uid('usr_'));        // ex: 'usr_1731312000000_a1b2c3'
 * console.log(NUtil.isEmpty(''));        // true
 * console.log(NUtil.getType([1, 2, 3])); // 'array'
 *
 * @example <caption>Exemple 2 : Temporisation et nouvelles tentatives</caption>
 * await NUtil.sleep(100);
 * const res = await NUtil.retry(async () => 'ok', { attempts: 3, delayMs: 100 });
 */
export class NUtil {
    /** @type {number} */
    static #timerSeq = 0;

    /** @type {Map<number, Object>} */
    static #activeTimers = new Map();

    // =========================================================================
    // Méthodes statiques transversales — Identifiants Uniques (UUID & Short ID)
    // =========================================================================

    /**
     * Génère un identifiant unique universel au format standard UUID v4
     * (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`).
     *
     * @returns {string} Chaîne UUID v4 en minuscules.
     *
     * @example <caption>Exemple 1 : Générer un UUID v4</caption>
     * const id = NUtil.uuid();
     * console.log(id.length); // 36
     *
     * @example <caption>Exemple 2 : Vérifier la validité de l'UUID généré</caption>
     * console.log(NUtil.isUuid(NUtil.uuid())); // true
     */
    static uuid() {
        if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
            return globalThis.crypto.randomUUID();
        }
        const bytes = NCrypto.randomBytes(16);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122
        const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }

    /**
     * Vérifie si une chaîne de caractères est un UUID valide (versions 1 à 5).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si la chaîne est un UUID valide, sinon `false`.
     *
     * @example <caption>Exemple 1 : UUID valide</caption>
     * console.log(NUtil.isUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479')); // true
     *
     * @example <caption>Exemple 2 : Chaîne non UUID</caption>
     * console.log(NUtil.isUuid('12345')); // false
     */
    static isUuid(value) {
        if (typeof value !== 'string') {
            return false;
        }
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
    }

    /**
     * Génère un identifiant court unique horodaté (avec préfixe optionnel), idéal pour les clés
     * locales, identifiants de transactions ou de composants.
     *
     * @param {string} [prefix=''] - Préfixe optionnel (ex: `'usr_'`, `'tx_'`).
     * @param {number} [randomLength=8] - Nombre de caractères aléatoires après l'horodatage Base36.
     * @returns {string} Identifiant court unique.
     *
     * @example <caption>Exemple 1 : Générer un ID court avec préfixe</caption>
     * console.log(NUtil.uid('tx_')); // ex: 'tx_m3k9z1_a8f4k2p9'
     *
     * @example <caption>Exemple 2 : Générer un ID court sans préfixe</caption>
     * console.log(typeof NUtil.uid()); // 'string'
     */
    static uid(prefix = '', randomLength = 8) {
        const timePart = Date.now().toString(36);
        const randPart = NStr.random(Math.max(4, Math.trunc(randomLength)));
        return prefix ? `${prefix}${timePart}_${randPart}` : `${timePart}_${randPart}`;
    }

    // =========================================================================
    // Méthodes statiques transversales — Inspection & Vérification de Types
    // =========================================================================

    /**
     * Vérifie si une valeur est définie (ni `null`, ni `undefined`).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si la valeur n'est ni `null` ni `undefined`.
     *
     * @example <caption>Exemple 1 : Valeurs définies (y compris 0, false et '')</caption>
     * console.log(NUtil.isDefined(0));     // true
     * console.log(NUtil.isDefined(false)); // true
     *
     * @example <caption>Exemple 2 : null et undefined</caption>
     * console.log(NUtil.isDefined(null));      // false
     * console.log(NUtil.isDefined(undefined)); // false
     */
    static isDefined(value) {
        return value !== null && value !== undefined;
    }

    /**
     * Vérifie de manière universelle si une valeur quelconque est vide :
     * - `null`, `undefined`, `NaN` -> `true`
     * - `string` vide ou composée uniquement d'espaces -> `true`
     * - `Array` de longueur `0` -> `true`
     * - `Map` ou `Set` de taille `0` -> `true`
     * - `Object` simple sans clés propres -> `true`
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si la valeur est considérée comme vide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester différents types vides</caption>
     * console.log(NUtil.isEmpty('   ')); // true
     * console.log(NUtil.isEmpty([]));    // true
     * console.log(NUtil.isEmpty({}));    // true
     *
     * @example <caption>Exemple 2 : Tester des valeurs non vides</caption>
     * console.log(NUtil.isEmpty(0));        // false
     * console.log(NUtil.isEmpty('NLib'));   // false
     * console.log(NUtil.isEmpty([1]));      // false
     */
    static isEmpty(value) {
        if (value === null || value === undefined) {
            return true;
        }
        if (typeof value === 'number') {
            return Number.isNaN(value);
        }
        if (typeof value === 'string') {
            return NStr.isEmpty(value);
        }
        if (Array.isArray(value)) {
            return value.length === 0;
        }
        if (value instanceof Map || value instanceof Set) {
            return value.size === 0;
        }
        if (NJson.isPlainObject(value)) {
            return Object.keys(value).length === 0;
        }
        return false;
    }

    /**
     * Vérifie si une valeur est un booléen (`true` ou `false`).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `typeof value === 'boolean'`.
     *
     * @example <caption>Exemple 1 : Valeur booléenne</caption>
     * console.log(NUtil.isBoolean(false)); // true
     *
     * @example <caption>Exemple 2 : Chaîne ou nombre</caption>
     * console.log(NUtil.isBoolean('true')); // false
     * console.log(NUtil.isBoolean(1));      // false
     */
    static isBoolean(value) {
        return typeof value === 'boolean';
    }

    /**
     * Convertit intelligemment une valeur (`true`, `1`, `'1'`, `'true'`, `'yes'`, `'oui'`, `'on'`)
     * en booléen `true` ou `false`.
     *
     * @param {any} value - Valeur à convertir.
     * @param {boolean} [fallback=false] - Valeur par défaut si non reconnue.
     * @returns {boolean} Booléen converti.
     *
     * @example <caption>Exemple 1 : Valeurs reconnues comme true</caption>
     * console.log(NUtil.toBoolean('true')); // true
     * console.log(NUtil.toBoolean('oui'));  // true
     * console.log(NUtil.toBoolean(1));      // true
     *
     * @example <caption>Exemple 2 : Valeurs reconnues comme false</caption>
     * console.log(NUtil.toBoolean('false')); // false
     * console.log(NUtil.toBoolean('0'));     // false
     */
    static toBoolean(value, fallback = false) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value === 1 ? true : (value === 0 ? false : fallback);
        }
        if (typeof value === 'string') {
            const norm = value.trim().toLowerCase();
            if (['true', '1', 'yes', 'oui', 'on', 'vrai'].includes(norm)) {
                return true;
            }
            if (['false', '0', 'no', 'non', 'off', 'faux', ''].includes(norm)) {
                return false;
            }
        }
        return fallback;
    }

    /**
     * Vérifie si une valeur est une fonction exécutable.
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `typeof value === 'function'`.
     *
     * @example <caption>Exemple 1 : Fonction valide</caption>
     * console.log(NUtil.isFunction(() => {})); // true
     *
     * @example <caption>Exemple 2 : Objet non fonction</caption>
     * console.log(NUtil.isFunction({})); // false
     */
    static isFunction(value) {
        return typeof value === 'function';
    }

    /**
     * Vérifie si une valeur est une `Promise` (ou un objet *thenable* possédant `.then()`).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si la valeur est une promesse.
     *
     * @example <caption>Exemple 1 : Promise native</caption>
     * console.log(NUtil.isPromise(Promise.resolve(1))); // true
     *
     * @example <caption>Exemple 2 : Valeur synchrone</caption>
     * console.log(NUtil.isPromise(42)); // false
     */
    static isPromise(value) {
        return value instanceof Promise || (value !== null && typeof value === 'object' && typeof value.then === 'function');
    }

    /**
     * Retourne le type précis et normalisé en minuscules d'une valeur JavaScript
     * (`'null'`, `'undefined'`, `'array'`, `'date'`, `'regexp'`, `'map'`, `'set'`, `'promise'`, `'error'`, `'object'`, `'string'`, `'number'`, `'boolean'`, `'function'`).
     *
     * @param {any} value - Valeur à inspecter.
     * @returns {string} Nom du type en minuscules.
     *
     * @example <caption>Exemple 1 : Types distingués avec précision</caption>
     * console.log(NUtil.getType(null));       // 'null'
     * console.log(NUtil.getType([1, 2]));     // 'array'
     * console.log(NUtil.getType(new Date())); // 'date'
     *
     * @example <caption>Exemple 2 : Objets et primitives</caption>
     * console.log(NUtil.getType({ a: 1 }));   // 'object'
     * console.log(NUtil.getType('NLib'));     // 'string'
     */
    static getType(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        return Object.prototype.toString.call(value).slice(8, -1).toLowerCase();
    }

    // =========================================================================
    // Méthodes statiques transversales — Asynchrone & Contrôle de Flux
    // =========================================================================

    /**
     * Planifie l'exécution d'un callback synchronisée sur l'horloge réelle (`Date.now()`),
     * indépendamment des fluctuations de la vitesse du processeur, des ralentissements du système,
     * du throttling des onglets de navigateur en arrière-plan ou des mises en veille.
     *
     * Le mécanisme calcule le timestamp cible réel (`targetTime = Date.now() + delay`) et recalibre
     * en continu le délai restant par découpage dynamique. Ainsi, un délai de 60 secondes (1 minute)
     * s'exécute exactement après 1 minute de temps réel (datetime), même en cas de mise en veille
     * temporaire de l'ordinateur ou de surcharge importante du CPU.
     *
     * @param {Function} callback - Fonction à exécuter lorsque le délai est écoulé.
     * @param {number|Date|string} [delayOrTarget=0] - Délai en millisecondes ou date cible (objet `Date` ou chaîne ISO).
     * @param {...any} args - Arguments optionnels transmis au callback lors de son exécution.
     * @returns {Object} Descripteur de timer doté des méthodes `.cancel()` et `.clear()`.
     *
     * @example <caption>Exemple 1 : Délai d'une minute (60 000 ms) synchronisé sur l'heure réelle</caption>
     * const timer = NUtil.setTimeout(() => {
     *     console.log('1 minute réelle écoulée');
     * }, 60000);
     *
     * @example <caption>Exemple 2 : Date cible absolue avec transmission d'arguments</caption>
     * const targetDate = new Date(Date.now() + 5000);
     * NUtil.setTimeout((user, role) => {
     *     console.log(`Notification envoyée à ${user} (${role})`);
     * }, targetDate, 'Alice', 'admin');
     *
     * @example <caption>Exemple 3 : Annuler un timer avant son échéance</caption>
     * const timer = NUtil.setTimeout(() => console.log('Ne s\'exécutera pas'), 30000);
     * timer.cancel(); // ou NUtil.clearTimeout(timer);
     */
    static setTimeout(callback, delayOrTarget = 0, ...args) {
        if (typeof callback !== 'function') {
            NLog.error('NUtil.setTimeout: Le paramètre callback doit être une fonction', {
                code: 'ERR_INVALID_ARGUMENT',
                callback
            });
            return {
                id: 0,
                targetTime: 0,
                delay: 0,
                active: false,
                cancel: () => { },
                clear: () => { }
            };
        }

        const now = Date.now();
        let targetTime;
        let requestedDelay = 0;

        if (delayOrTarget instanceof Date) {
            targetTime = delayOrTarget.getTime();
            requestedDelay = Math.max(0, targetTime - now);
        } else if (typeof delayOrTarget === 'string') {
            const parsed = Date.parse(delayOrTarget);
            if (!Number.isNaN(parsed)) {
                targetTime = parsed;
                requestedDelay = Math.max(0, targetTime - now);
            } else {
                const num = Number(delayOrTarget);
                requestedDelay = Number.isNaN(num) ? 0 : Math.max(0, num);
                targetTime = now + requestedDelay;
            }
        } else if (typeof delayOrTarget === 'number' && !Number.isNaN(delayOrTarget)) {
            requestedDelay = Math.max(0, delayOrTarget);
            targetTime = now + requestedDelay;
        } else {
            requestedDelay = 0;
            targetTime = now;
        }

        const timerId = ++NUtil.#timerSeq;
        let nativeTimeoutId = null;
        let isActive = true;

        const cleanup = () => {
            isActive = false;
            if (nativeTimeoutId !== null) {
                clearTimeout(nativeTimeoutId);
                nativeTimeoutId = null;
            }
            NUtil.#activeTimers.delete(timerId);
        };

        const tick = () => {
            if (!isActive) return;

            const current = Date.now();
            const remaining = targetTime - current;

            // Si le temps réel (datetime horloge) est atteint ou dépassé
            if (remaining <= 0) {
                cleanup();
                try {
                    callback(...args);
                } catch (err) {
                    NLog.error('NUtil.setTimeout: Erreur lors de l\'exécution du callback', {
                        timerId,
                        targetTime,
                        error: err?.message || String(err)
                    });
                }
                return;
            }

            // Découpage dynamique par tranches (au plus 1000 ms) pour recalibrer en continu
            // l'échéance par rapport à Date.now(), évitant toute dérive due au throttling de l'onglet,
            // à la charge CPU ou à la mise en veille de la machine.
            const nextStep = remaining > 1000 ? Math.min(1000, remaining) : remaining;
            nativeTimeoutId = setTimeout(tick, nextStep);
        };

        const timerHandle = {
            id: timerId,
            targetTime,
            delay: requestedDelay,
            get active() {
                return isActive;
            },
            cancel: () => cleanup(),
            clear: () => cleanup()
        };

        NUtil.#activeTimers.set(timerId, timerHandle);

        const initialRemaining = targetTime - now;
        if (initialRemaining <= 0) {
            nativeTimeoutId = setTimeout(tick, 0);
        } else {
            const firstStep = initialRemaining > 1000 ? Math.min(1000, initialRemaining) : initialRemaining;
            nativeTimeoutId = setTimeout(tick, firstStep);
        }

        return timerHandle;
    }

    /**
     * Annule un timer planifié par `NUtil.setTimeout`.
     *
     * @param {Object|number} timerOrId - Objet timer retourné par `NUtil.setTimeout` ou son identifiant numérique.
     * @returns {boolean} `true` si le timer était actif et a été annulé, `false` sinon.
     *
     * @example <caption>Exemple 1 : Annuler un timer à l'aide de l'objet timer</caption>
     * const timer = NUtil.setTimeout(() => console.log('Action'), 60000);
     * NUtil.clearTimeout(timer);
     *
     * @example <caption>Exemple 2 : Annuler un timer à partir de son identifiant numérique</caption>
     * const timer = NUtil.setTimeout(() => {}, 10000);
     * NUtil.clearTimeout(timer.id);
     */
    static clearTimeout(timerOrId) {
        if (!timerOrId) return false;

        if (typeof timerOrId === 'object' && typeof timerOrId.cancel === 'function') {
            const wasActive = timerOrId.active;
            timerOrId.cancel();
            return Boolean(wasActive);
        }

        const id = Number(timerOrId);
        if (!Number.isNaN(id) && NUtil.#activeTimers.has(id)) {
            const handle = NUtil.#activeTimers.get(id);
            if (handle) {
                const wasActive = handle.active;
                handle.cancel();
                return Boolean(wasActive);
            }
        }

        return false;
    }

    /**
     * Met en pause l'exécution asynchrone pendant `ms` millisecondes.
     * S'appuie sur `NUtil.setTimeout` synchronisé sur l'horloge réelle (`Date.now()`)
     * pour garantir que la durée de pause réelle écoulée corresponde exactement au temps demandé,
     * même en cas de baisse de fréquence CPU ou de mise en veille.
     *
     * @param {number} [ms=0] - Durée de la pause en millisecondes.
     * @returns {Promise<void>} Promesse résolue après le délai réel.
     *
     * @example <caption>Exemple 1 : Attendre 200 ms</caption>
     * await NUtil.sleep(200);
     *
     * @example <caption>Exemple 2 : Attendre 1 minute (60 000 ms réelles)</caption>
     * await NUtil.sleep(60000);
     */
    static sleep(ms = 0) {
        return new Promise((resolve) => {
            NUtil.setTimeout(resolve, ms);
        });
    }

    /**
     * Crée une fonction *debounced* qui retarde l'exécution de `fn` jusqu'à ce qu'un délai de `waitMs`
     * millisecondes se soit écoulé depuis le dernier appel.
     *
     * @param {Function} fn - Fonction à retarder.
     * @param {number} [waitMs=300] - Délai d'inactivité en millisecondes.
     * @returns {Function} Fonction debounced dotée d'une méthode `.cancel()`.
     *
     * @example <caption>Exemple 1 : Retarder une recherche lors de la saisie</caption>
     * const onSearch = NUtil.debounce((q) => console.log(q), 250);
     * onSearch('n');
     * onSearch('nlib');
     *
     * @example <caption>Exemple 2 : Annuler un appel en attente</caption>
     * const task = NUtil.debounce(() => {}, 500);
     * task.cancel();
     */
    static debounce(fn, waitMs = 300) {
        let timerId = null;
        const delay = Math.max(0, Math.trunc(Number(waitMs) || 0));

        const debounced = function (...args) {
            if (timerId !== null) {
                clearTimeout(timerId);
            }
            timerId = setTimeout(() => {
                timerId = null;
                fn.apply(this, args);
            }, delay);
        };

        debounced.cancel = () => {
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }
        };

        return debounced;
    }

    /**
     * Crée une fonction *throttled* qui n'exécute `fn` qu'au maximum une fois toutes les `limitMs` millisecondes.
     *
     * @param {Function} fn - Fonction à limiter.
     * @param {number} [limitMs=200] - Intervalle minimal entre deux exécutions en millisecondes.
     * @returns {Function} Fonction limitée.
     *
     * @example <caption>Exemple 1 : Limiter la fréquence d'un gestionnaire d'événement</caption>
     * const onScroll = NUtil.throttle(() => console.log('scroll'), 100);
     * onScroll();
     *
     * @example <caption>Exemple 2 : Avec arguments transmis</caption>
     * const logPos = NUtil.throttle((x, y) => console.log(x, y), 200);
     * logPos(10, 20);
     */
    static throttle(fn, limitMs = 200) {
        let lastCall = 0;
        const interval = Math.max(0, Math.trunc(Number(limitMs) || 0));

        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= interval) {
                lastCall = now;
                return fn.apply(this, args);
            }
        };
    }

    /**
     * Exécute une fonction asynchrone `fn` et réessaie automatiquement en cas d'échec
     * jusqu'à `attempts` tentatives avec un délai `delayMs` entre chaque essai.
     * En cas d'échec total, consigne l'erreur via `NLog.error` et retourne `options.fallback`
     * si défini, ou un objet d'erreur standard `{ success: false, code, error, attempts }`.
     *
     * @param {Function} fn - Fonction asynchrone `(attemptIndex) => Promise<any>`.
     * @param {Object} [options={}] - Options de réessai.
     * @param {number} [options.attempts=3] - Nombre maximal de tentatives.
     * @param {number} [options.delayMs=300] - Délai initial entre deux tentatives en ms.
     * @param {boolean} [options.exponential=false] - Si `true`, double le délai à chaque échec.
     * @param {any} [options.fallback] - Valeur de repli retournée si toutes les tentatives échouent.
     * @returns {Promise<any>} Résultat de `fn` dès qu'elle réussit, ou repli / objet d'erreur standard.
     *
     * @example <caption>Exemple 1 : Réessayer une opération réseau jusqu'à 3 fois</caption>
     * const res = await NUtil.retry(async () => 'succès', { attempts: 3, delayMs: 100 });
     * console.log(res); // 'succès'
     *
     * @example <caption>Exemple 2 : Backoff exponentiel avec valeur de repli</caption>
     * const data = await NUtil.retry(async (attempt) => attempt, { attempts: 2, exponential: true, fallback: null });
     */
    static async retry(fn, options = {}) {
        if (typeof fn !== 'function') {
            NLog.error('NUtil.retry: Le paramètre fn doit être une fonction', {
                code: 'ERR_INVALID_ARGUMENT',
                fn
            });
            if ('fallback' in (options || {})) {
                return options.fallback;
            }
            return {
                success: false,
                code: 'ERR_INVALID_ARGUMENT',
                error: 'Le paramètre fn doit être une fonction',
                attempts: 0
            };
        }

        const maxAttempts = Math.max(1, Math.trunc(options?.attempts ?? 3));
        const baseDelay = Math.max(0, Math.trunc(options?.delayMs ?? 300));
        const exponential = options?.exponential ?? false;

        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn(attempt);
            } catch (err) {
                lastError = err;
                NLog.warn('NUtil.retry: Échec de la tentative', {
                    attempt,
                    maxAttempts,
                    error: err?.message || String(err)
                });
                if (attempt < maxAttempts && baseDelay > 0) {
                    const wait = exponential ? baseDelay * (2 ** (attempt - 1)) : baseDelay;
                    await NUtil.sleep(wait);
                }
            }
        }

        NLog.error('NUtil.retry: Épuisement de toutes les tentatives', {
            code: 'ERR_RETRY_EXHAUSTED',
            attempts: maxAttempts,
            error: lastError?.message || String(lastError)
        });

        if ('fallback' in (options || {})) {
            return options.fallback;
        }

        return {
            success: false,
            code: 'ERR_RETRY_EXHAUSTED',
            error: lastError?.message || String(lastError),
            attempts: maxAttempts
        };
    }
}

NEvent.registerUtil(NUtil);
NObject.registerUtil(NUtil);

export default NUtil;
