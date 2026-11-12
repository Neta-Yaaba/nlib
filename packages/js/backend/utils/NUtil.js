/**
 * @file NUtil.js
 * @package @nlib/js-backend
 * @description Façade statique centrale regroupant toutes les classes utilitaires et services de l'écosystème NLib
 * (`NString`, `NNumber`, `NDateTime`, `NAmount`, `NEmail`, `NPhoneNumber`, `NCryptography`, `NUrl`,
 * `NJson`, `NPassword`, `NArray`, `NEnvironment`, `NConfig`, `NSystem`) sous forme de propriétés statiques
 * à initialisation paresseuse (`NUtil.str`, `NUtil.num`, `NUtil.date`, `NUtil.amount`, `NUtil.email`, `NUtil.phone`,
 * `NUtil.crypto`, `NUtil.url`, `NUtil.json`, `NUtil.password`, `NUtil.arr`, `NUtil.env`, `NUtil.config`, `NUtil.sys`),
 * ainsi que des méthodes utilitaires transversales statiques (UUID v4, vérification de types, temporisation,
 * debounce, throttle, retry).
 */

import { NString } from './NString.js';
import { NNumber } from './NNumber.js';
import { NDateTime } from './NDateTime.js';
import { NAmount } from './NAmount.js';
import { NEmail } from './NEmail.js';
import { NPhoneNumber } from './NPhoneNumber.js';
import { NCryptography } from './NCryptography.js';
import { NUrl } from './NUrl.js';
import { NJson } from './NJson.js';
import { NPassword } from './NPassword.js';
import { NArray } from './NArray.js';
import { NEnvironment } from '../environment/NEnvironment.js';
import { NConfig } from '../config/NConfig.js';
import { NSystem } from '../system/NSystem.js';
import { NWorkerManager } from '../worker/NWorkerManager.js';

/**
 * @class NUtil
 * @description Point d'accès statique universel vers tous les utilitaires de NLib et fonctions
 * transversales générales.
 *
 * @example <caption>Exemple 1 : Utiliser les instances statiques de NString, NNumber, NDateTime et NAmount</caption>
 * console.log(NUtil.str.equals('NLib', 'nlib', { caseSensitive: false })); // true
 * console.log(NUtil.num.round(3.14159, 2));                                // 3.14
 * console.log(NUtil.date.nowDate());                                       // ex: '2026-11-11'
 * console.log(NUtil.amount.format(25000, 'XOF'));                          // '25 000 FCFA'
 *
 * @example <caption>Exemple 2 : Utiliser NEnvironment, NConfig et NSystem</caption>
 * console.log(NUtil.env.os, NUtil.env.type);
 * NUtil.config.set('app.name', 'NLib');
 * console.log(NUtil.config.getString('app.name')); // 'NLib'
 * console.log(NUtil.sys.cpuCores);                 // ex: 8
 *
 * @example <caption>Exemple 3 : Méthodes transversales statiques de NUtil (UUID, types, sleep, retry)</caption>
 * console.log(NUtil.uuid());                  // ex: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
 * console.log(NUtil.isEmpty(''));             // true
 * console.log(NUtil.getType([1, 2, 3]));      // 'array'
 * await NUtil.sleep(100);
 */
export class NUtil {

    // =========================================================================
    // Variables statiques privées (Lazy Singletons : initialisées au 1er appel)
    // =========================================================================

    /** @type {NString|null} */
    static #str = null;

    /** @type {NNumber|null} */
    static #num = null;

    /** @type {NDateTime|null} */
    static #date = null;

    /** @type {NAmount|null} */
    static #amount = null;

    /** @type {NEmail|null} */
    static #email = null;

    /** @type {NPhoneNumber|null} */
    static #phone = null;

    /** @type {NCryptography|null} */
    static #crypto = null;

    /** @type {NUrl|null} */
    static #url = null;

    /** @type {NJson|null} */
    static #json = null;

    /** @type {NPassword|null} */
    static #password = null;

    /** @type {NArray|null} */
    static #arr = null;

    /** @type {NEnvironment|null} */
    static #env = null;

    /** @type {NConfig|null} */
    static #config = null;

    /** @type {NSystem|null} */
    static #sys = null;

    /** @type {NWorkerManager|null} */
    static #worker = null;

    // =========================================================================
    // Accesseurs statiques (Getters avec initialisation paresseuse au 1er appel)
    // =========================================================================

    /**
     * Retourne l'instance partagée de `NString` (instanciée uniquement lors du premier accès).
     *
     * @returns {NString} Instance de `NString`.
     *
     * @example <caption>Exemple 1 : Comparer deux chaînes</caption>
     * console.log(NUtil.str.equals('Bonjour', 'bonjour', { caseSensitive: false })); // true
     *
     * @example <caption>Exemple 2 : Masquer ou formater une chaîne</caption>
     * console.log(NUtil.str.insertEvery('12003', ' ', 2)); // '12 00 3'
     */
    static get str() {
        if (!this.#str) {
            this.#str = new NString();
        }
        return this.#str;
    }

    /**
     * Retourne l'instance partagée de `NNumber` (instanciée uniquement lors du premier accès).
     *
     * @returns {NNumber} Instance de `NNumber`.
     *
     * @example <caption>Exemple 1 : Vérifier et arrondir un nombre</caption>
     * console.log(NUtil.num.isNumeric('42.5')); // true
     * console.log(NUtil.num.round(12.3456, 2)); // 12.35
     *
     * @example <caption>Exemple 2 : Formater une taille en octets</caption>
     * console.log(NUtil.num.formatBytes(1048576)); // '1 MB'
     */
    static get num() {
        if (!this.#num) {
            this.#num = new NNumber();
        }
        return this.#num;
    }

    /**
     * Retourne l'instance partagée de `NDateTime` (instanciée uniquement lors du premier accès).
     *
     * @returns {NDateTime} Instance de `NDateTime`.
     *
     * @example <caption>Exemple 1 : Obtenir la date et l'heure actuelles</caption>
     * console.log(NUtil.date.now());     // 'YYYY-MM-DD HH:mm:ss'
     * console.log(NUtil.date.nowDate()); // 'YYYY-MM-DD'
     *
     * @example <caption>Exemple 2 : Ajouter des jours</caption>
     * console.log(NUtil.date.format(NUtil.date.addDays('2026-11-10', 5), 'DD/MM/YYYY')); // '15/11/2026'
     */
    static get date() {
        if (!this.#date) {
            this.#date = new NDateTime();
        }
        return this.#date;
    }

    /**
     * Retourne l'instance partagée de `NAmount` (instanciée uniquement lors du premier accès).
     *
     * @returns {NAmount} Instance de `NAmount`.
     *
     * @example <caption>Exemple 1 : Additionner et formater un montant</caption>
     * const total = NUtil.amount.add(19.99, 5.01);
     * console.log(NUtil.amount.format(total, 'EUR')); // '25,00 €'
     *
     * @example <caption>Exemple 2 : Calculer la TVA</caption>
     * console.log(NUtil.amount.addTax(100, 18)); // 118
     */
    static get amount() {
        if (!this.#amount) {
            this.#amount = new NAmount();
        }
        return this.#amount;
    }

    /**
     * Retourne l'instance partagée de `NEmail` (instanciée uniquement lors du premier accès).
     *
     * @returns {NEmail} Instance de `NEmail`.
     *
     * @example <caption>Exemple 1 : Valider et normaliser un e-mail</caption>
     * console.log(NUtil.email.isValid('Contact@NLib.dev'));  // true
     * console.log(NUtil.email.normalize(' Contact@NLib.dev ')); // 'contact@nlib.dev'
     *
     * @example <caption>Exemple 2 : Masquer un e-mail</caption>
     * console.log(NUtil.email.mask('contact@nlib.dev')); // 'co****t@nlib.dev'
     */
    static get email() {
        if (!this.#email) {
            this.#email = new NEmail();
        }
        return this.#email;
    }

    /**
     * Retourne l'instance partagée de `NPhoneNumber` (instanciée uniquement lors du premier accès).
     *
     * @returns {NPhoneNumber} Instance de `NPhoneNumber`.
     *
     * @example <caption>Exemple 1 : Normaliser en E.164</caption>
     * console.log(NUtil.phone.toE164('70 12 34 56', '226')); // '+22670123456'
     *
     * @example <caption>Exemple 2 : Formater par groupes de 2 chiffres</caption>
     * console.log(NUtil.phone.format('70123456')); // '70 12 34 56'
     */
    static get phone() {
        if (!this.#phone) {
            this.#phone = new NPhoneNumber();
        }
        return this.#phone;
    }

    /**
     * Retourne l'instance partagée de `NCryptography` (instanciée uniquement lors du premier accès).
     *
     * @returns {NCryptography} Instance de `NCryptography`.
     *
     * @example <caption>Exemple 1 : Hacher en SHA-256</caption>
     * const hash = await NUtil.crypto.sha256('MonSecret');
     *
     * @example <caption>Exemple 2 : Chiffrement local</caption>
     * const enc = await NUtil.crypto.encryptLocal('Donnée');
     * console.log(await NUtil.crypto.decryptLocal(enc)); // 'Donnée'
     */
    static get crypto() {
        if (!this.#crypto) {
            this.#crypto = new NCryptography();
        }
        return this.#crypto;
    }

    /**
     * Retourne l'instance partagée de `NUrl` (instanciée uniquement lors du premier accès).
     *
     * @returns {NUrl} Instance de `NUrl`.
     *
     * @example <caption>Exemple 1 : Joindre des chemins d'URL</caption>
     * console.log(NUtil.url.join('https://api.nlib.dev/', '/v1/', '/users'));
     * // 'https://api.nlib.dev/v1/users'
     *
     * @example <caption>Exemple 2 : Masquer et décoder un ID de table dans une URL</caption>
     * const token = NUtil.url.encodeId(42, 'cle');
     * console.log(NUtil.url.decodeId(token, 'cle', true)); // 42
     */
    static get url() {
        if (!this.#url) {
            this.#url = new NUrl();
        }
        return this.#url;
    }

    /**
     * Retourne l'instance partagée de `NJson` (instanciée uniquement lors du premier accès).
     *
     * @returns {NJson} Instance de `NJson`.
     *
     * @example <caption>Exemple 1 : Lire dans un objet ou tableau via un chemin</caption>
     * console.log(NUtil.json.getString({ users: ['Ali', 'Neta'] }, 'users.1')); // 'Neta'
     *
     * @example <caption>Exemple 2 : Compter le nombre d'entrées</caption>
     * console.log(NUtil.json.size({ a: 1, b: 2 })); // 2
     */
    static get json() {
        if (!this.#json) {
            this.#json = new NJson();
        }
        return this.#json;
    }

    /**
     * Retourne l'instance partagée de `NPassword` (instanciée uniquement lors du premier accès).
     *
     * @returns {NPassword} Instance de `NPassword`.
     *
     * @example <caption>Exemple 1 : Générer un mot de passe fort</caption>
     * console.log(NUtil.password.generate(16));
     *
     * @example <caption>Exemple 2 : Générer un code PIN</caption>
     * console.log(NUtil.password.generatePin(6));
     */
    static get password() {
        if (!this.#password) {
            this.#password = new NPassword();
        }
        return this.#password;
    }

    /**
     * Retourne l'instance partagée de `NArray` (instanciée uniquement lors du premier accès).
     *
     * @returns {NArray} Instance de `NArray`.
     *
     * @example <caption>Exemple 1 : Dédoublonner et compter un tableau</caption>
     * console.log(NUtil.arr.unique([1, 2, 2, 3])); // [1, 2, 3]
     * console.log(NUtil.arr.size([1, 2, 3]));      // 3
     *
     * @example <caption>Exemple 2 : Découper en lots</caption>
     * console.log(NUtil.arr.chunk([1, 2, 3, 4], 2)); // [[1, 2], [3, 4]]
     */
    static get arr() {
        if (!this.#arr) {
            this.#arr = new NArray();
        }
        return this.#arr;
    }

    /**
     * Retourne l'instance partagée de `NEnvironment` (instanciée uniquement lors du premier accès).
     *
     * @returns {NEnvironment} Instance de `NEnvironment`.
     *
     * @example <caption>Exemple 1 : Détecter l'OS, le navigateur et le type d'environnement</caption>
     * console.log(NUtil.env.type);    // 'browser' | 'node' | 'worker' | 'unknown'
     * console.log(NUtil.env.os);      // 'windows' | 'android' | 'ios' | 'macos' | 'linux' | 'harmonyos'
     * console.log(NUtil.env.browser); // 'chrome' | 'edge' | 'firefox' | 'safari' | 'opera'
     *
     * @example <caption>Exemple 2 : Vérifier l'état de connexion et WebView</caption>
     * console.log(NUtil.env.isOnline);
     * console.log(NUtil.env.isWebView);
     */
    static get env() {
        if (!this.#env) {
            this.#env = new NEnvironment();
        }
        return this.#env;
    }

    /**
     * Retourne l'instance partagée de `NConfig` (instanciée uniquement lors du premier accès).
     *
     * @returns {NConfig} Instance de `NConfig`.
     *
     * @example <caption>Exemple 1 : Définir et lire des paramètres de configuration</caption>
     * NUtil.config.set('server.port', 8080);
     * console.log(NUtil.config.getInt('server.port')); // 8080
     *
     * @example <caption>Exemple 2 : Charger un contenu .env</caption>
     * NUtil.config.loadFromDotEnv('APP_NAME="NLib"\nDEBUG=true');
     * console.log(NUtil.config.getBoolean('DEBUG')); // true
     */
    static get config() {
        if (!this.#config) {
            this.#config = new NConfig();
        }
        return this.#config;
    }

    /**
     * Retourne l'instance partagée de `NSystem` (instanciée uniquement lors du premier accès).
     *
     * @returns {NSystem} Instance de `NSystem`.
     *
     * @example <caption>Exemple 1 : Inspecter le CPU, la mémoire et l'écran</caption>
     * console.log(NUtil.sys.cpuCores);
     * console.log(NUtil.sys.memory.formattedUsed);
     *
     * @example <caption>Exemple 2 : Mesurer une tâche</caption>
     * const report = await NUtil.sys.measure('Test', () => 42);
     * console.log(report.durationMs);
     */
    static get sys() {
        if (!this.#sys) {
            this.#sys = new NSystem();
        }
        return this.#sys;
    }

    /**
     * Alias de `NUtil.sys` retournant la même instance partagée de `NSystem`.
     *
     * @returns {NSystem} Instance de `NSystem`.
     *
     * @example <caption>Exemple 1 : Obtenir l'état réseau via NUtil.system</caption>
     * console.log(NUtil.system.network.online);
     *
     * @example <caption>Exemple 2 : Obtenir un rapport complet du système</caption>
     * const snap = await NUtil.system.getSnapshot();
     */
    static get system() {
        return this.sys;
    }

    /**
     * Retourne l'instance partagée de `NWorkerManager` (instanciée uniquement lors du premier accès).
     *
     * @returns {NWorkerManager} Instance de `NWorkerManager`.
     *
     * @example <caption>Exemple 1 : Thread principal — créer et appeler un worker</caption>
     * NUtil.worker.create('sql', { url: './workers/sql.js' });
     * const rows = await NUtil.worker.call('sql', 'query', { sql: 'SELECT 1' });
     *
     * @example <caption>Exemple 2 : Côté Worker — exposer une méthode au thread principal</caption>
     * NUtil.worker.parent.handle('query', async ({ sql }) => db.exec(sql));
     */
    static get worker() {
        if (!this.#worker) {
            this.#worker = new NWorkerManager();
        }
        return this.#worker;
    }

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
        const bytes = NUtil.crypto.randomBytes(16);
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
        const randPart = NUtil.str.random(Math.max(4, Math.trunc(randomLength)));
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
            return NUtil.str.isEmpty(value);
        }
        if (Array.isArray(value)) {
            return value.length === 0;
        }
        if (value instanceof Map || value instanceof Set) {
            return value.size === 0;
        }
        if (NUtil.json.isPlainObject(value)) {
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
     * Met en pause l'exécution asynchrone pendant `ms` millisecondes.
     *
     * @param {number} [ms=0] - Durée de la pause en millisecondes.
     * @returns {Promise<void>} Promesse résolue après le délai.
     *
     * @example <caption>Exemple 1 : Attendre 200 ms</caption>
     * await NUtil.sleep(200);
     *
     * @example <caption>Exemple 2 : Pause minimale au prochain tick</caption>
     * await NUtil.sleep();
     */
    static sleep(ms = 0) {
        const delay = Math.max(0, Math.trunc(Number(ms) || 0));
        return new Promise((resolve) => setTimeout(resolve, delay));
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
     *
     * @param {Function} fn - Fonction asynchrone `(attemptIndex) => Promise<any>`.
     * @param {Object} [options={}] - Options de réessai.
     * @param {number} [options.attempts=3] - Nombre maximal de tentatives.
     * @param {number} [options.delayMs=300] - Délai initial entre deux tentatives en ms.
     * @param {boolean} [options.exponential=false] - Si `true`, double le délai à chaque échec.
     * @returns {Promise<any>} Résultat de `fn` dès qu'elle réussit.
     *
     * @example <caption>Exemple 1 : Réessayer une opération réseau jusqu'à 3 fois</caption>
     * const res = await NUtil.retry(async () => 'succès', { attempts: 3, delayMs: 100 });
     * console.log(res); // 'succès'
     *
     * @example <caption>Exemple 2 : Backoff exponentiel</caption>
     * const data = await NUtil.retry(async (attempt) => attempt, { attempts: 2, exponential: true });
     */
    static async retry(fn, options = {}) {
        const maxAttempts = Math.max(1, Math.trunc(options?.attempts ?? 3));
        const baseDelay = Math.max(0, Math.trunc(options?.delayMs ?? 300));
        const exponential = options?.exponential ?? false;

        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn(attempt);
            } catch (err) {
                lastError = err;
                if (attempt < maxAttempts && baseDelay > 0) {
                    const wait = exponential ? baseDelay * (2 ** (attempt - 1)) : baseDelay;
                    await NUtil.sleep(wait);
                }
            }
        }
        throw lastError;
    }
}

export default NUtil;
