/**
 * @file NConfig.js
 * @package @nlib/js-backend
 * @description Classe autonome de gestion de la configuration applicative (paramètres hiérarchiques par chemin
 * `a.b.c`, variables `.env`, `process.env`, valeurs par défaut, verrouillage `freeze` et accesseurs typés)
 * dans l'écosystème NLib.
 *
 * Ne dépend pas de `NObject` et est exposée sous forme d'instance partagée à initialisation paresseuse
 * via `NUtil.config`.
 */

import { NUtil } from '../utils/NUtil.js';

/**
 * @class NConfig
 * @description Gestionnaire de configuration hiérarchique et de variables d'environnement (`.env` / `process.env`).
 * Conçu avec allocation mémoire à la demande (*Lazy Initialization*) : `#data` et `#defaults`
 * restent à `null` tant qu'aucune configuration n'est chargée.
 *
 * @example <caption>Exemple 1 : Utiliser via NUtil.config avec accesseurs typés</caption>
 * NUtil.config.merge({
 *     app: { name: 'NLib', env: 'development', debug: true },
 *     server: { host: '127.0.0.1', port: '8080' }
 * });
 * console.log(NUtil.config.getString('app.name'));   // 'NLib'
 * console.log(NUtil.config.getInt('server.port'));   // 8080
 * console.log(NUtil.config.getBoolean('app.debug')); // true
 *
 * @example <caption>Exemple 2 : Charger un contenu .env et lire les clés</caption>
 * NUtil.config.loadFromDotEnv('DB_NAME="nlib.db"\nAPP_PORT=3000');
 * console.log(NUtil.config.getString('DB_NAME')); // 'nlib.db'
 * console.log(NUtil.config.getInt('APP_PORT'));   // 3000
 *
 * @example <caption>Exemple 3 : Valeurs par défaut, validation (require) et verrouillage (freeze)</caption>
 * const cfg = new NConfig({
 *     defaults: { timeout: 5000, retries: 3 },
 *     data: { apiKey: 'sec_123' }
 * });
 * cfg.require(['apiKey']);
 * cfg.freeze(); // Empêche toute modification ultérieure
 */
export class NConfig {

    // =========================================================================
    // Propriétés privées (Allocation paresseuse : null par défaut)
    // =========================================================================

    /**
     * Arbre principal des données de configuration.
     * @type {Object<string, any>|null}
     * @private
     */
    #data = null;

    /**
     * Arbre des valeurs de configuration par défaut (utilisé lors d'un `reset()` ou en repli).
     * @type {Object<string, any>|null}
     * @private
     */
    #defaults = null;

    /**
     * Indique si la configuration est verrouillée en lecture seule (`freeze()`).
     * @type {boolean}
     * @private
     */
    #frozen = false;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NConfig`.
     *
     * @param {Object} [options={}] - Options de construction.
     * @param {Object<string, any>} [options.defaults] - Configuration par défaut initiale.
     * @param {Object<string, any>} [options.data] - Données de configuration initiales.
     * @param {string} [options.dotEnv] - Contenu texte `.env` optionnel à charger.
     * @param {boolean} [options.loadProcessEnv=false] - Si `true` (sous Node.js), importe `process.env`.
     * @param {boolean} [options.freeze=false] - Si `true`, verrouille immédiatement la configuration après chargement.
     *
     * @example <caption>Exemple 1 : Création légère (zéro objet alloué tant que vide)</caption>
     * const cfg = new NConfig();
     * console.log(cfg.isEmpty); // true
     *
     * @example <caption>Exemple 2 : Création avec valeurs par défaut et données</caption>
     * const cfg = new NConfig({
     *     defaults: { app: { locale: 'fr', timeout: 3000 } },
     *     data: { app: { locale: 'en' } }
     * });
     * console.log(cfg.getString('app.locale')); // 'en'
     * console.log(cfg.getInt('app.timeout'));   // 3000
     */
    constructor(options = {}) {
        if (options?.defaults && NUtil.json.isPlainObject(options.defaults) && !NUtil.json.isEmpty(options.defaults)) {
            this.#defaults = NUtil.json.clone(options.defaults);
            this.#data = NUtil.json.clone(options.defaults);
        }

        if (options?.loadProcessEnv === true) {
            this.loadFromProcess(false);
        }

        if (options?.data && NUtil.json.isPlainObject(options.data) && !NUtil.json.isEmpty(options.data)) {
            this.merge(options.data);
        }

        if (typeof options?.dotEnv === 'string' && options.dotEnv.trim().length > 0) {
            this.loadFromDotEnv(options.dotEnv);
        }

        if (options?.freeze === true) {
            this.#frozen = true;
        }
    }

    // =========================================================================
    // Getters d'état de la configuration
    // =========================================================================

    /**
     * Indique si la configuration est verrouillée en lecture seule (`true` après `freeze()`).
     *
     * @returns {boolean} `true` si verrouillée, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier si la configuration est gelée</caption>
     * console.log(NUtil.config.isFrozen); // false
     *
     * @example <caption>Exemple 2 : Après appel à freeze()</caption>
     * const cfg = new NConfig().freeze();
     * console.log(cfg.isFrozen); // true
     */
    get isFrozen() {
        return this.#frozen;
    }

    /**
     * Indique si la configuration ne contient aucune clé.
     *
     * @returns {boolean} `true` si `#data` est vide ou `null`.
     *
     * @example <caption>Exemple 1 : Configuration vide</caption>
     * const cfg = new NConfig();
     * console.log(cfg.isEmpty); // true
     *
     * @example <caption>Exemple 2 : Configuration remplie</caption>
     * const cfg = new NConfig({ data: { port: 8080 } });
     * console.log(cfg.isEmpty); // false
     */
    get isEmpty() {
        return this.#data === null || NUtil.json.isEmpty(this.#data);
    }

    // =========================================================================
    // Méthodes privées internes
    // =========================================================================

    /**
     * Vérifie si l'instance est verrouillée (`#frozen`) avant une opération d'écriture.
     * Consigne un avertissement via `NUtil.log.warn` si la configuration est gelée.
     *
     * @param {string} [operation='modifier'] - Nom de l'opération tentée.
     * @returns {boolean} `true` si l'écriture est autorisée, `false` si l'instance est verrouillée.
     *
     * @example <caption>Exemple 1 : Configuration non verrouillée</caption>
     * // Interne : this.#ensureNotFrozen('modifier') -> true
     *
     * @example <caption>Exemple 2 : Configuration gelée</caption>
     * // Interne : this.#ensureNotFrozen('modifier') -> false (avec avertissement NUtil.log.warn)
     */
    #ensureNotFrozen(operation = 'modifier') {
        if (this.#frozen) {
            NUtil.log.warn(`NConfig: Impossible de ${operation} la configuration, cette instance est verrouillée (frozen).`, {
                code: 'WARN_CONFIG_FROZEN',
                operation
            });
            return false;
        }
        return true;
    }

    // =========================================================================
    // Méthodes publiques — Lecture & Accesseurs Typés (Chemin `a.b.c` ou Clé)
    // =========================================================================

    /**
     * Vérifie si une clé ou un chemin imbriqué (ex: `'server.port'`, `['users', 0]`) existe dans la configuration.
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin en notation pointée.
     * @returns {boolean} `true` si le chemin existe, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier un chemin imbriqué</caption>
     * const cfg = new NConfig({ data: { db: { host: 'localhost' } } });
     * console.log(cfg.has('db.host')); // true
     *
     * @example <caption>Exemple 2 : Chemin absent</caption>
     * const cfg = new NConfig();
     * console.log(cfg.has('db.password')); // false
     */
    has(path) {
        if (!this.#data) {
            return false;
        }
        return NUtil.json.has(this.#data, path);
    }

    /**
     * Récupère une valeur de configuration à partir de sa clé ou de son chemin (`'app.name'`, `'items.0'`),
     * ou retourne `fallback` si elle n'existe pas.
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin en notation pointée.
     * @param {any} [fallback=undefined] - Valeur de repli si introuvable.
     * @returns {any} Valeur trouvée ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire une valeur imbriquée</caption>
     * const cfg = new NConfig({ data: { api: { url: 'https://api.nlib.dev' } } });
     * console.log(cfg.get('api.url')); // 'https://api.nlib.dev'
     *
     * @example <caption>Exemple 2 : Lire avec une valeur par défaut</caption>
     * console.log(NUtil.config.get('api.timeout', 5000)); // 5000
     */
    get(path, fallback = undefined) {
        if (!this.#data) {
            return fallback;
        }
        return NUtil.json.get(this.#data, path, fallback);
    }

    /**
     * Récupère une valeur de configuration sous forme de chaîne de caractères (`string`).
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin.
     * @param {string} [fallback=''] - Chaîne par défaut.
     * @returns {string} Chaîne trouvée ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire une chaîne</caption>
     * const cfg = new NConfig({ data: { app: { title: 'NLib App' } } });
     * console.log(cfg.getString('app.title')); // 'NLib App'
     *
     * @example <caption>Exemple 2 : Chaîne par défaut</caption>
     * console.log(NUtil.config.getString('app.locale', 'fr')); // 'fr'
     */
    getString(path, fallback = '') {
        if (!this.#data) {
            return fallback;
        }
        return NUtil.json.getString(this.#data, path, fallback);
    }

    /**
     * Récupère une valeur de configuration et la convertit en nombre fini (`number`).
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin.
     * @param {number} [fallback=0] - Nombre par défaut.
     * @returns {number} Nombre ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire un nombre</caption>
     * const cfg = new NConfig({ data: { tax: '18.5' } });
     * console.log(cfg.getNumber('tax')); // 18.5
     *
     * @example <caption>Exemple 2 : Fallback</caption>
     * console.log(NUtil.config.getNumber('tax', 20)); // 20
     */
    getNumber(path, fallback = 0) {
        if (!this.#data) {
            return fallback;
        }
        return NUtil.json.getNumber(this.#data, path, fallback);
    }

    /**
     * Récupère une valeur de configuration et la convertit en nombre entier (`integer`).
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin.
     * @param {number} [fallback=0] - Entier par défaut.
     * @returns {number} Entier ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire un port</caption>
     * const cfg = new NConfig({ data: { server: { port: '8080' } } });
     * console.log(cfg.getInt('server.port')); // 8080
     *
     * @example <caption>Exemple 2 : Fallback</caption>
     * console.log(NUtil.config.getInt('server.port', 3000)); // 3000
     */
    getInt(path, fallback = 0) {
        if (!this.#data) {
            return fallback;
        }
        return NUtil.json.getInt(this.#data, path, fallback);
    }

    /**
     * Récupère une valeur de configuration et la convertit en nombre flottant (`float`).
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin.
     * @param {number} [fallback=0.0] - Flottant par défaut.
     * @returns {number} Flottant ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire un flottant</caption>
     * const cfg = new NConfig({ data: { ratio: '1,75' } });
     * console.log(cfg.getFloat('ratio')); // 1.75
     *
     * @example <caption>Exemple 2 : Fallback</caption>
     * console.log(NUtil.config.getFloat('ratio', 1.0)); // 1.0
     */
    getFloat(path, fallback = 0.0) {
        if (!this.#data) {
            return fallback;
        }
        return NUtil.json.getFloat(this.#data, path, fallback);
    }

    /**
     * Récupère une valeur de configuration et la convertit en booléen (`true`, `'true'`, `'1'`, `'yes'`, `'oui'`).
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin.
     * @param {boolean} [fallback=false] - Booléen par défaut.
     * @returns {boolean} Booléen ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire un booléen</caption>
     * const cfg = new NConfig({ data: { app: { debug: 'true' } } });
     * console.log(cfg.getBoolean('app.debug')); // true
     *
     * @example <caption>Exemple 2 : Fallback</caption>
     * console.log(NUtil.config.getBoolean('app.debug', false)); // false
     */
    getBoolean(path, fallback = false) {
        const val = this.get(path, undefined);
        if (val === undefined || val === null) {
            return fallback;
        }
        return NUtil.toBoolean(val, fallback);
    }

    /**
     * Récupère une valeur de configuration sous forme de tableau (`Array`).
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin.
     * @param {Array} [fallback=[]] - Tableau par défaut.
     * @returns {Array} Tableau trouvé ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire une liste</caption>
     * const cfg = new NConfig({ data: { cors: { origins: ['https://a.com'] } } });
     * console.log(cfg.getArray('cors.origins')); // ['https://a.com']
     *
     * @example <caption>Exemple 2 : Fallback</caption>
     * console.log(NUtil.config.getArray('cors.origins')); // []
     */
    getArray(path, fallback = []) {
        if (!this.#data) {
            return fallback;
        }
        return NUtil.json.getArray(this.#data, path, fallback);
    }

    /**
     * Récupère une sous-section de configuration sous forme d'objet simple (`{}`).
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin.
     * @param {Object} [fallback={}] - Objet par défaut.
     * @returns {Object} Sous-objet ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire toute la section database</caption>
     * const cfg = new NConfig({ data: { db: { host: 'localhost', port: 3306 } } });
     * console.log(cfg.getObject('db')); // { host: 'localhost', port: 3306 }
     *
     * @example <caption>Exemple 2 : Section absente retourne {}</caption>
     * console.log(NUtil.config.getObject('db')); // {}
     */
    getObject(path, fallback = {}) {
        if (!this.#data) {
            return fallback;
        }
        return NUtil.json.getObject(this.#data, path, fallback);
    }

    // =========================================================================
    // Méthodes publiques — Écriture, Fusion, Suppression & Verrouillage
    // =========================================================================

    /**
     * Définit ou met à jour une valeur de configuration au chemin `path`.
     *
     * @param {string|number|Array<string|number>} path - Clé littérale ou tableau de chemin hiérarchique.
     * @param {any} value - Valeur à enregistrer.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir une clé imbriquée</caption>
     * NUtil.config.set(['server', 'port'], 8080);
     * console.log(NUtil.config.getInt(['server', 'port'])); // 8080
     *
     * @example <caption>Exemple 2 : Chaîner plusieurs appels</caption>
     * NUtil.config.set('app.name', 'NLib').set('app.version', '1.0.0');
     */
    set(path, value) {
        if (!this.#ensureNotFrozen('modifier')) {
            return this;
        }
        if (!this.#data) {
            this.#data = {};
        }
        NUtil.json.set(this.#data, path, value);
        return this;
    }

    /**
     * Définit ou met à jour les valeurs de configuration par défaut (`#defaults`).
     *
     * @param {Object<string, any>} defaultsObject - Objet des valeurs par défaut.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir des valeurs par défaut</caption>
     * NUtil.config.setDefaults({ app: { locale: 'fr', timeout: 3000 } });
     *
     * @example <caption>Exemple 2 : Chaîner avec merge</caption>
     * const cfg = new NConfig().setDefaults({ port: 3000 }).merge({ port: 8080 });
     */
    setDefaults(defaultsObject) {
        if (!this.#ensureNotFrozen('définir les valeurs par défaut de')) {
            return this;
        }
        if (!NUtil.json.isPlainObject(defaultsObject)) {
            return this;
        }
        this.#defaults = this.#defaults
            ? NUtil.json.merge(this.#defaults, defaultsObject)
            : NUtil.json.clone(defaultsObject);
        this.#data = this.#data
            ? NUtil.json.merge(this.#defaults, this.#data)
            : NUtil.json.clone(this.#defaults);
        return this;
    }

    /**
     * Fusionne profondément un objet de configuration dans l'instance actuelle.
     *
     * @param {Object<string, any>} configObject - Objet de configuration à fusionner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Fusionner une configuration partielle</caption>
     * const cfg = new NConfig({ data: { db: { host: 'localhost', port: 3306 } } });
     * cfg.merge({ db: { port: 5432, name: 'nlib' } });
     * console.log(cfg.getObject('db')); // { host: 'localhost', port: 5432, name: 'nlib' }
     *
     * @example <caption>Exemple 2 : Charger une configuration globale dans NUtil.config</caption>
     * NUtil.config.merge({ env: 'production' });
     */
    merge(configObject) {
        if (!this.#ensureNotFrozen('fusionner')) {
            return this;
        }
        if (!NUtil.json.isPlainObject(configObject)) {
            return this;
        }
        this.#data = this.#data
            ? NUtil.json.merge(this.#data, configObject)
            : NUtil.json.clone(configObject);
        return this;
    }

    /**
     * Supprime une entrée ou sous-section de la configuration au chemin `path`.
     *
     * @param {string|number|Array<string|number>} path - Clé ou chemin à supprimer.
     * @returns {boolean} `true` si la clé existait et a été supprimée, sinon `false`.
     *
     * @example <caption>Exemple 1 : Supprimer une clé imbriquée</caption>
     * const cfg = new NConfig({ data: { db: { host: 'localhost', password: '123' } } });
     * console.log(cfg.remove(['db', 'password'])); // true
     * console.log(cfg.has(['db', 'password']));    // false
     *
     * @example <caption>Exemple 2 : Clé inexistante</caption>
     * console.log(NUtil.config.remove('inconnu')); // false
     */
    remove(path) {
        if (!this.#ensureNotFrozen('supprimer une clé dans')) {
            return false;
        }
        if (!this.#data) {
            return false;
        }
        const removed = NUtil.json.remove(this.#data, path);
        if (NUtil.json.isEmpty(this.#data)) {
            this.#data = null;
        }
        return removed;
    }

    /**
     * Réinitialise la configuration à ses valeurs par défaut (`#defaults`), ou la vide complètement
     * si aucune valeur par défaut n'avait été définie.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Revenir aux valeurs par défaut</caption>
     * const cfg = new NConfig({ defaults: { port: 3000 }, data: { port: 8080 } });
     * cfg.reset();
     * console.log(cfg.getInt('port')); // 3000
     *
     * @example <caption>Exemple 2 : Vider une configuration sans defaults</caption>
     * const cfg = new NConfig({ data: { a: 1 } });
     * cfg.reset();
     * console.log(cfg.isEmpty); // true
     */
    reset() {
        if (!this.#ensureNotFrozen('réinitialiser')) {
            return this;
        }
        this.#data = this.#defaults ? NUtil.json.clone(this.#defaults) : null;
        return this;
    }

    /**
     * Vide complètement la configuration, les valeurs par défaut et déverrouille l'instance.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Nettoyer complètement l'instance</caption>
     * const cfg = new NConfig({ data: { a: 1 } }).clear();
     * console.log(cfg.isEmpty); // true
     *
     * @example <caption>Exemple 2 : Réinitialise aussi le verrouillage</caption>
     * const cfg = new NConfig().freeze().clear();
     * console.log(cfg.isFrozen); // false
     */
    clear() {
        this.#data = null;
        this.#defaults = null;
        this.#frozen = false;
        return this;
    }

    /**
     * Verrouille définitivement l'instance en lecture seule : tout appel ultérieur modifiant la configuration
     * sera ignoré et consignera un avertissement.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Verrouiller la configuration en production</caption>
     * const cfg = new NConfig({ data: { env: 'production' } }).freeze();
     * console.log(cfg.isFrozen); // true
     *
     * @example <caption>Exemple 2 : Modification après freeze() est ignorée</caption>
     * const cfg = new NConfig().freeze();
     * cfg.set('a', 1);
     * console.log(cfg.has('a')); // false
     */
    freeze() {
        this.#frozen = true;
        return this;
    }

    /**
     * Retourne une copie complète des données de configuration (ou uniquement de la sous-section `sectionPath`).
     *
     * @param {string} [sectionPath=''] - Chemin optionnel vers une sous-section.
     * @returns {Object<string, any>} Copie des données de configuration.
     *
     * @example <caption>Exemple 1 : Obtenir toute la configuration</caption>
     * const cfg = new NConfig({ data: { a: 1, b: 2 } });
     * console.log(cfg.all()); // { a: 1, b: 2 }
     *
     * @example <caption>Exemple 2 : Obtenir une sous-section</caption>
     * const cfg = new NConfig({ data: { server: { port: 8080 } } });
     * console.log(cfg.all('server')); // { port: 8080 }
     */
    all(sectionPath = '') {
        if (!this.#data) {
            return {};
        }
        if (typeof sectionPath === 'string' && sectionPath.trim().length > 0) {
            return NUtil.json.clone(this.getObject(sectionPath.trim(), {}));
        }
        return NUtil.json.clone(this.#data);
    }

    // =========================================================================
    // Méthodes publiques — Chargement `.env`, `process.env`, Validation & JSON
    // =========================================================================

    /**
     * Analyse le contenu d'un fichier `.env` (commentaires `#`, `export`, guillemets, interpolation `${VAR}`)
     * et charge ses variables dans la configuration.
     *
     * @param {string} dotEnvContent - Contenu texte au format `.env`.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Charger un contenu .env</caption>
     * const cfg = new NConfig();
     * cfg.loadFromDotEnv('APP_NAME="NLib"\nAPP_PORT=8080');
     * console.log(cfg.getString('APP_NAME'), cfg.getInt('APP_PORT')); // 'NLib' 8080
     *
     * @example <caption>Exemple 2 : Interpolation ${VAR} dans .env</caption>
     * const cfg = new NConfig();
     * cfg.loadFromDotEnv('HOST=localhost\nURL="http://${HOST}:8080"');
     * console.log(cfg.getString('URL')); // 'http://localhost:8080'
     */
    loadFromDotEnv(dotEnvContent) {
        if (!this.#ensureNotFrozen('charger le fichier .env dans')) {
            return this;
        }
        if (typeof dotEnvContent !== 'string' || dotEnvContent.trim().length === 0) {
            return this;
        }
        const lines = dotEnvContent.replace(/\r\n?/g, '\n').split('\n');
        const parsed = {};

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) {
                continue;
            }
            const match = /^(?:export\s+)?([a-zA-Z_][a-zA-Z0-9_.]*)\s*=\s*(.*)$/.exec(line);
            if (!match) {
                continue;
            }
            const key = match[1].trim();
            let val = match[2].trim();

            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                const quote = val[0];
                val = val.slice(1, -1);
                if (quote === '"') {
                    val = val.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"');
                }
            } else {
                const commentIdx = val.indexOf(' #');
                if (commentIdx !== -1) {
                    val = val.slice(0, commentIdx).trim();
                }
            }

            val = val.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_.]*)\}/g, (_, refKey) => {
                if (Object.prototype.hasOwnProperty.call(parsed, refKey)) {
                    return parsed[refKey];
                }
                return this.getString(refKey, '');
            });

            parsed[key] = val;
            this.set(key, val);
        }
        return this;
    }

    /**
     * Charge les variables de `process.env` (si exécuté sous Node.js) dans la configuration.
     *
     * @param {boolean} [overwrite=false] - Si `true`, écrase les clés déjà définies.
     * @param {string} [prefix=''] - Si fourni (ex: `'NLIB_'`), n'importe que les variables commençant par ce préfixe.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Importer process.env</caption>
     * NUtil.config.loadFromProcess();
     *
     * @example <caption>Exemple 2 : Importer uniquement les variables préfixées par NLIB_</caption>
     * NUtil.config.loadFromProcess(true, 'NLIB_');
     */
    loadFromProcess(overwrite = false, prefix = '') {
        if (!this.#ensureNotFrozen('charger process.env dans')) {
            return this;
        }
        if (typeof process !== 'undefined' && process && typeof process.env === 'object' && process.env !== null) {
            const keys = Object.keys(process.env);
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (prefix && !k.startsWith(prefix)) {
                    continue;
                }
                if (overwrite || !this.has(k)) {
                    this.set(k, process.env[k]);
                }
            }
        }
        return this;
    }

    /**
     * Vérifie que toutes les clés ou chemins listés dans `requiredPaths` sont présents dans la configuration.
     * Consigne une erreur via `NUtil.log.error` (`ENV_OR_CONFIG_MISSING`) et retourne `false` si au moins une clé manque.
     *
     * @param {Array<string|number|Array<string|number>>} requiredPaths - Liste des chemins de configuration obligatoires.
     * @returns {boolean} `true` si tous les chemins sont présents, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier les clés obligatoires présentes</caption>
     * const cfg = new NConfig({ data: { db: { host: 'localhost', name: 'nlib' } } });
     * console.log(cfg.require(['db', ['db', 'host']])); // true
     *
     * @example <caption>Exemple 2 : Clé absente retourne false avec log error</caption>
     * const cfg = new NConfig();
     * console.log(cfg.require(['db.password'])); // false
     */
    require(requiredPaths = []) {
        if (!Array.isArray(requiredPaths) || requiredPaths.length === 0) {
            return true;
        }
        const missing = requiredPaths.filter((p) => !this.has(p));
        if (missing.length > 0) {
            NUtil.log.error(`NConfig.require: Clés de configuration obligatoires manquantes : ${missing.join(', ')}`, {
                code: 'ENV_OR_CONFIG_MISSING',
                missing
            });
            return false;
        }
        return true;
    }

    /**
     * Sérialise l'instance `NConfig` en objet JSON.
     *
     * @returns {{ frozen: boolean, data: Object<string, any> }} Représentation JSON de la configuration.
     *
     * @example <caption>Exemple 1 : Exporter en JSON</caption>
     * const cfg = new NConfig({ data: { port: 8080 } });
     * console.log(cfg.toJSON().data); // { port: 8080 }
     *
     * @example <caption>Exemple 2 : Vérifier l'état frozen dans le JSON</caption>
     * const cfg = new NConfig().freeze();
     * console.log(cfg.toJSON().frozen); // true
     */
    toJSON() {
        return {
            frozen: this.#frozen,
            data: this.all()
        };
    }
}

export default NConfig;
