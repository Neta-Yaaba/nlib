/**
 * @file NObject.js
 * @package @nlib/js-backend
 * @description Classe de base universelle (sans interface / headless) de l'écosystème NLib.
 * Toutes les classes logiques du backend héritent de `NObject` pour bénéficier :
 * - du cycle de vie standardisé (`initialize`, `destroy`),
 * - de la gestion d'état réactif avec allocation mémoire à la demande (`hasState`, `getState`, `setState`),
 * - du moteur d'événements interne avec allocation mémoire à la demande (`hasListener`, `on`, `once`, `off`, `emit`),
 * - et de la sérialisation / clonage (`toJSON`, `fromJSON`, `clone`).
 */

import { NException } from './NException.js';

/**
 * @class NObject
 * @description Classe mère de tous les objets logiques de NLib.
 * Conçue avec une empreinte mémoire minimale (*Lazy Initialization*) : `#state` et `#listeners`
 * restent à `null` tant qu'aucun état ou écouteur d'événement n'est réellement utilisé.
 *
 * @example <caption>Exemple 1 : Utilisation directe avec état réactif et écoute d'événement</caption>
 * const compteur = new NObject({ state: { total: 0 } });
 * compteur.on('state:total', ({ value, oldValue }) => {
 *     console.log(`Total passé de ${oldValue} à ${value}`);
 * });
 * compteur.setState('total', 10);
 *
 * @example <caption>Exemple 2 : Héritage par une classe métier personnalisée</caption>
 * class ServiceUtilisateur extends NObject {
 *     connecter(nom) {
 *         this.setState({ utilisateur: nom, connecte: true });
 *         this.emit('connexion', { nom });
 *     }
 * }
 * const service = ServiceUtilisateur.create();
 * service.on('connexion', ({ nom }) => console.log(`Bienvenue ${nom}`));
 * service.connecter('Neta');
 *
 * @example <caption>Exemple 3 : Initialisation différée, sérialisation JSON et clonage</caption>
 * const config = new NObject({ state: { mode: 'hors-ligne' }, autoInit: false });
 * config.initialize();
 * const sauvegarde = JSON.stringify(config);
 * const copie = config.clone();
 * config.destroy();
 */
export class NObject {

    // =========================================================================
    // Propriétés privées (Variables internes)
    // =========================================================================

    /**
     * Dictionnaire interne stockant les variables d'état (clé -> valeur) de l'instance.
     * Reste à `null` tant qu'aucune donnée d'état n'est définie (économie de mémoire).
     * @type {Map<string, any>|null}
     * @private
     */
    #state = null;

    /**
     * Registre interne des écouteurs d'événements (nom d'événement -> ensemble de fonctions).
     * Reste à `null` tant qu'aucun écouteur n'est abonné via `on()` (économie de mémoire).
     * @type {Map<string, Set<Function>>|null}
     * @private
     */
    #listeners = null;

    /**
     * Indique si la méthode `initialize()` a déjà été exécutée avec succès sur cette instance.
     * @type {boolean}
     * @private
     */
    #initialized = false;

    /**
     * Indique si la méthode `destroy()` a été appelée et que l'instance est détruite.
     * @type {boolean}
     * @private
     */
    #destroyed = false;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NObject`.
     * N'alloue `#state` en mémoire que si `options.state` contient au moins une propriété.
     *
     * @param {Object} [options={}] - Options de configuration de l'instance.
     * @param {Object<string, any>} [options.state] - Valeurs initiales optionnelles de l'état interne (`#state`).
     * @param {boolean} [options.autoInit=true] - Si `true` (par défaut), appelle automatiquement `initialize()` à la construction.
     *
     * @example <caption>Exemple 1 : Création légère (zéro Map allouée en mémoire)</caption>
     * const obj = new NObject();
     * console.log(obj.isInitialized); // true
     *
     * @example <caption>Exemple 2 : Création avec un état initial</caption>
     * const obj = new NObject({ state: { langue: 'fr', actif: true } });
     * console.log(obj.getState('langue')); // 'fr'
     *
     * @example <caption>Exemple 3 : Création sans initialisation automatique (autoInit: false)</caption>
     * const obj = new NObject({ autoInit: false });
     * console.log(obj.isInitialized); // false
     * obj.initialize();
     */
    constructor(options = {}) {
        if (options.state && typeof options.state === 'object') {
            const entries = Object.entries(options.state);
            if (entries.length > 0) {
                this.#state = new Map(entries);
            }
        }

        if (options.autoInit !== false) {
            this.initialize();
        }
    }

    // =========================================================================
    // Getters (Accesseurs en lecture)
    // =========================================================================

    /**
     * Retourne le nom exact de la classe de l'instance (ex: `"NObject"` ou le nom de la sous-classe).
     *
     * @returns {string} Nom de la classe.
     *
     * @example <caption>Exemple 1 : Sur une instance directe de NObject</caption>
     * const obj = new NObject();
     * console.log(obj.className); // 'NObject'
     *
     * @example <caption>Exemple 2 : Sur une sous-classe héritant de NObject</caption>
     * class MonMoteur extends NObject {}
     * const moteur = new MonMoteur();
     * console.log(moteur.className); // 'MonMoteur'
     */
    get className() {
        return this.constructor.name;
    }

    /**
     * Retourne une copie sous forme d'objet JavaScript simple de tout l'état interne (`#state`).
     * Si aucun état n'a encore été initialisé (`#state === null`), retourne `{}` sans allouer de `Map`.
     *
     * @returns {Object<string, any>} Copie clé-valeur de l'état actuel.
     *
     * @example <caption>Exemple 1 : Lecture de l'état complet</caption>
     * const obj = new NObject({ state: { x: 10, y: 20 } });
     * console.log(obj.state); // { x: 10, y: 20 }
     *
     * @example <caption>Exemple 2 : Protection de l'état interne contre les modifications directes</caption>
     * const obj = new NObject({ state: { version: 1 } });
     * const copie = obj.state;
     * copie.version = 99;
     * console.log(obj.getState('version')); // 1 (l'état interne reste intact)
     */
    get state() {
        return this.#state ? Object.fromEntries(this.#state) : {};
    }

    /**
     * Indique si l'instance est initialisée.
     *
     * @returns {boolean} `true` si `initialize()` a été exécuté, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérification après création standard</caption>
     * const obj = new NObject();
     * console.log(obj.isInitialized); // true
     *
     * @example <caption>Exemple 2 : Vérification avant et après initialize()</caption>
     * const obj = new NObject({ autoInit: false });
     * console.log(obj.isInitialized); // false
     * obj.initialize();
     * console.log(obj.isInitialized); // true
     */
    get isInitialized() {
        return this.#initialized;
    }

    /**
     * Indique si l'instance a été détruite.
     *
     * @returns {boolean} `true` si `destroy()` a été appelé, sinon `false`.
     *
     * @example <caption>Exemple 1 : Objet actif non détruit</caption>
     * const obj = new NObject();
     * console.log(obj.isDestroyed); // false
     *
     * @example <caption>Exemple 2 : Vérification après appel à destroy()</caption>
     * const obj = new NObject();
     * obj.destroy();
     * console.log(obj.isDestroyed); // true
     */
    get isDestroyed() {
        return this.#destroyed;
    }

    // =========================================================================
    // Méthodes publiques — Cycle de vie (Lifecycle)
    // =========================================================================

    /**
     * Initialise l'instance après vérification par `#validate()`.
     * Émet l'événement `'initialize'` avec `{ target: this }`.
     * Si l'instance est déjà initialisée ou détruite, la méthode ne fait rien.
     *
     * @throws {NException} Si la validation interne `#validate()` échoue (`code: 'ERR_INIT_VALIDATION'`).
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Initialisation manuelle avec écoute de l'événement 'initialize'</caption>
     * const obj = new NObject({ autoInit: false });
     * obj.on('initialize', () => console.log('Objet initialisé !'));
     * obj.initialize();
     *
     * @example <caption>Exemple 2 : Chaînage fluide après initialize()</caption>
     * const obj = new NObject({ autoInit: false })
     *     .initialize()
     *     .setState('pret', true);
     */
    initialize() {
        if (this.#initialized || this.#destroyed) {
            return this;
        }
        if (!this.#validate()) {
            NException.create(
                `NObject: Échec de validation lors de l'initialisation de ${this.className}.`,
                { code: 'ERR_INIT_VALIDATION' }
            ).throw();
        }
        this.#initialized = true;
        this.emit('initialize', { target: this });
        return this;
    }

    /**
     * Détruit proprement l'instance et libère toutes ses références en mémoire (`#state = null` et `#listeners = null`).
     * Émet l'événement `'beforeDestroy'` juste avant le nettoyage.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Destruction simple et libération mémoire</caption>
     * const obj = new NObject({ state: { secret: '1234' } });
     * obj.destroy();
     * console.log(obj.state); // {}
     *
     * @example <caption>Exemple 2 : Exécuter une sauvegarde juste avant la destruction</caption>
     * const obj = new NObject({ state: { donnees: 42 } });
     * obj.on('beforeDestroy', ({ target }) => {
     *     console.log('Sauvegarde avant fermeture :', target.state);
     * });
     * obj.destroy();
     */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        this.emit('beforeDestroy', { target: this });
        if (this.#state) {
            this.#state.clear();
            this.#state = null;
        }
        if (this.#listeners) {
            this.#listeners.clear();
            this.#listeners = null;
        }
        this.#destroyed = true;
    }

    // =========================================================================
    // Méthodes publiques — Gestion de l'état (State)
    // =========================================================================

    /**
     * Vérifie si une clé existe dans l'état interne `#state`.
     * N'alloue aucune mémoire si `#state` est encore à `null`.
     *
     * @param {string} key - Clé de la variable d'état à vérifier.
     * @returns {boolean} `true` si la clé existe dans `#state`, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier une clé présente et une clé absente</caption>
     * const obj = new NObject({ state: { port: 8080 } });
     * console.log(obj.hasState('port')); // true
     * console.log(obj.hasState('hote')); // false
     *
     * @example <caption>Exemple 2 : Vérifier une clé dont la valeur est undefined ou null</caption>
     * const obj = new NObject({ state: { jeton: null } });
     * console.log(obj.hasState('jeton')); // true (la clé existe même si sa valeur vaut null)
     */
    hasState(key) {
        return Boolean(this.#state && this.#state.has(key));
    }

    /**
     * Récupère la valeur d'une variable dans l'état interne `#state`.
     * N'alloue aucune mémoire si `#state` est encore à `null`.
     *
     * @param {string} key - Clé de la variable d'état recherchée.
     * @param {any} [defaultValue=undefined] - Valeur retournée si la clé n'existe pas dans `#state`.
     * @returns {any} La valeur associée à `key` ou `defaultValue`.
     *
     * @example <caption>Exemple 1 : Lecture d'une clé existante</caption>
     * const obj = new NObject({ state: { port: 8080 } });
     * console.log(obj.getState('port')); // 8080
     *
     * @example <caption>Exemple 2 : Lecture d'une clé absente avec valeur par défaut</caption>
     * const obj = new NObject();
     * console.log(obj.getState('hote', '127.0.0.1')); // '127.0.0.1'
     */
    getState(key, defaultValue = undefined) {
        if (!this.#state || !this.#state.has(key)) {
            return defaultValue;
        }
        return this.#state.get(key);
    }

    /**
     * Modifie une ou plusieurs variables de l'état interne `#state`.
     * Initialise automatiquement `this.#state = new Map()` lors du tout premier besoin.
     * Pour chaque clé dont la valeur change réellement, émet :
     * - `'state:<key>'` avec `{ key, value, oldValue, target: this }`
     * - `'stateChange'` avec `{ key, value, oldValue, target: this }`
     *
     * @param {string|Object<string, any>} keyOrObject - Nom de la clé à modifier, ou objet contenant plusieurs paires `{ clé: valeur }`.
     * @param {any} [value] - Nouvelle valeur (utilisée uniquement lorsque le premier paramètre est une clé `string`).
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Modification d'une seule clé</caption>
     * const obj = new NObject();
     * obj.setState('statut', 'en_ligne');
     * console.log(obj.getState('statut')); // 'en_ligne'
     *
     * @example <caption>Exemple 2 : Modification de plusieurs clés en une seule fois via un objet</caption>
     * const obj = new NObject();
     * obj.setState({ largeur: 1920, hauteur: 1080, pleinEcran: true });
     *
     * @example <caption>Exemple 3 : Chaînage de plusieurs appels setState()</caption>
     * const obj = new NObject();
     * obj.setState('etape', 1).setState('termine', false);
     */
    setState(keyOrObject, value) {
        if (this.#destroyed) {
            return this;
        }
        const entries = (typeof keyOrObject === 'object' && keyOrObject !== null)
            ? Object.entries(keyOrObject)
            : [[keyOrObject, value]];

        if (entries.length === 0) {
            return this;
        }

        if (!this.#state) {
            this.#state = new Map();
        }

        for (const [k, v] of entries) {
            const oldValue = this.#state.get(k);
            if (oldValue !== v) {
                this.#state.set(k, v);
                this.emit(`state:${k}`, { key: k, value: v, oldValue, target: this });
                this.emit('stateChange', { key: k, value: v, oldValue, target: this });
            }
        }
        return this;
    }

    // =========================================================================
    // Méthodes publiques — Événements (Events)
    // =========================================================================

    /**
     * Vérifie s'il existe déjà au moins un écouteur pour un événement donné,
     * ou si une fonction de rappel spécifique (`callback`) y est déjà abonnée.
     * N'alloue aucune mémoire si `#listeners` est encore à `null`.
     *
     * @param {string} event - Nom de l'événement à vérifier.
     * @param {Function} [callback] - Fonction précise à rechercher (optionnel).
     * @returns {boolean} `true` si l'événement (ou le couple événement + callback) est écouté, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier si un événement possède au moins un écouteur</caption>
     * const obj = new NObject();
     * console.log(obj.hasListener('message')); // false
     * obj.on('message', () => {});
     * console.log(obj.hasListener('message')); // true
     *
     * @example <caption>Exemple 2 : Vérifier si une fonction précise écoute déjà l'événement</caption>
     * const obj = new NObject();
     * const monHandler = () => console.log('Reçu');
     * obj.on('message', monHandler);
     * console.log(obj.hasListener('message', monHandler)); // true
     * console.log(obj.hasListener('message', () => {}));   // false
     */
    hasListener(event, callback) {
        if (!this.#listeners || !this.#listeners.has(event)) {
            return false;
        }
        const set = this.#listeners.get(event);
        if (!callback) {
            return set.size > 0;
        }
        return set.has(callback);
    }

    /**
     * Abonne une fonction de rappel (`callback`) à un événement nommé.
     * Initialise automatiquement `this.#listeners = new Map()` lors du tout premier abonnement.
     *
     * @param {string} event - Nom de l'événement à écouter (ex: `'initialize'`, `'stateChange'`, `'state:score'`).
     * @param {Function} callback - Fonction exécutée lorsque l'événement est émis.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Écouter un événement personnalisé</caption>
     * const obj = new NObject();
     * obj.on('message', (texte) => console.log('Reçu :', texte));
     * obj.emit('message', 'Bonjour NLib');
     *
     * @example <caption>Exemple 2 : Écouter le changement d'une variable d'état précise</caption>
     * const obj = new NObject({ state: { niveau: 1 } });
     * obj.on('state:niveau', ({ value, oldValue }) => {
     *     console.log(`Niveau : ${oldValue} -> ${value}`);
     * });
     * obj.setState('niveau', 2);
     */
    on(event, callback) {
        if (this.#destroyed || typeof callback !== 'function') {
            return this;
        }
        if (!this.#listeners) {
            this.#listeners = new Map();
        }
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event).add(callback);
        return this;
    }

    /**
     * Abonne une fonction de rappel (`callback`) qui ne sera exécutée qu'une seule fois
     * lors de la prochaine émission de l'événement, puis automatiquement désabonnée.
     *
     * @param {string} event - Nom de l'événement à écouter une seule fois.
     * @param {Function} callback - Fonction exécutée lors de la première émission.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Réagir uniquement au premier événement</caption>
     * const obj = new NObject();
     * obj.once('pret', () => console.log('Exécuté une seule fois'));
     * obj.emit('pret'); // Affiche 'Exécuté une seule fois'
     * obj.emit('pret'); // Ne fait plus rien
     *
     * @example <caption>Exemple 2 : Capturer uniquement la première modification d'état</caption>
     * const obj = new NObject({ state: { tentatives: 0 } });
     * obj.once('stateChange', ({ key, value }) => {
     *     console.log(`Première modification détectée sur ${key} = ${value}`);
     * });
     * obj.setState('tentatives', 1);
     * obj.setState('tentatives', 2);
     */
    once(event, callback) {
        if (typeof callback !== 'function') {
            return this;
        }
        const wrapper = (payload) => {
            this.off(event, wrapper);
            callback.call(this, payload);
        };
        return this.on(event, wrapper);
    }

    /**
     * Désabonne une fonction de rappel spécifique (ou tous les écouteurs si `callback` est omis) pour un événement donné.
     * Si plus aucun écouteur n'existe sur l'objet, libère automatiquement `this.#listeners = null`.
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} [callback] - Fonction spécifique à retirer. Si omis, supprime tous les écouteurs de cet événement.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Retirer un écouteur spécifique</caption>
     * const obj = new NObject();
     * const monEcouteur = () => console.log('Alarme !');
     * obj.on('alarme', monEcouteur);
     * obj.off('alarme', monEcouteur);
     *
     * @example <caption>Exemple 2 : Supprimer tous les écouteurs d'un événement</caption>
     * const obj = new NObject();
     * obj.on('log', () => console.log('Log 1'));
     * obj.on('log', () => console.log('Log 2'));
     * obj.off('log'); // Retire tous les écouteurs de 'log'
     */
    off(event, callback) {
        if (!this.#listeners || !this.#listeners.has(event)) {
            return this;
        }
        if (!callback) {
            this.#listeners.delete(event);
        } else {
            const set = this.#listeners.get(event);
            set.delete(callback);
            if (set.size === 0) {
                this.#listeners.delete(event);
            }
        }
        if (this.#listeners.size === 0) {
            this.#listeners = null;
        }
        return this;
    }

    /**
     * Émet un événement et déclenche de manière synchrone tous les écouteurs enregistrés sur cet événement.
     * N'effectue aucune allocation si aucun écouteur n'est enregistré (`#listeners === null`).
     *
     * @param {string} event - Nom de l'événement à émettre.
     * @param {any} [data=null] - Données transmises en argument à chaque écouteur.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Émettre un événement simple sans données</caption>
     * const obj = new NObject();
     * obj.on('ping', () => console.log('pong'));
     * obj.emit('ping');
     *
     * @example <caption>Exemple 2 : Émettre un événement avec un objet de données</caption>
     * const obj = new NObject();
     * obj.on('erreur', ({ code, message }) => console.error(`Erreur ${code} : ${message}`));
     * obj.emit('erreur', { code: 500, message: 'Serveur indisponible' });
     */
    emit(event, data = null) {
        if (this.#destroyed || !this.#listeners || !this.#listeners.has(event)) {
            return this;
        }
        for (const callback of Array.from(this.#listeners.get(event))) {
            callback.call(this, data);
        }
        return this;
    }

    // =========================================================================
    // Méthodes publiques — Sérialisation & Utilitaires
    // =========================================================================

    /**
     * Sérialise l'instance en un objet JavaScript pur compatible avec `JSON.stringify()`.
     *
     * @returns {{ className: string, state: Object<string, any> }} Représentation JSON de l'objet.
     *
     * @example <caption>Exemple 1 : Obtenir l'objet sérialisé directement</caption>
     * const obj = new NObject({ state: { theme: 'sombre' } });
     * console.log(obj.toJSON()); // { className: 'NObject', state: { theme: 'sombre' } }
     *
     * @example <caption>Exemple 2 : Conversion automatique avec JSON.stringify()</caption>
     * const obj = new NObject({ state: { sauvegarde: true } });
     * const jsonTexte = JSON.stringify(obj);
     * console.log(jsonTexte);
     */
    toJSON() {
        return {
            className: this.className,
            state: this.state
        };
    }

    /**
     * Restaure l'état de l'instance à partir d'un objet désérialisé.
     *
     * @param {Object} [data={}] - Données issues d'une sauvegarde ou de `toJSON()`.
     * @param {Object<string, any>} [data.state] - État à restaurer via `setState()`.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Restaurer à partir d'un objet JavaScript</caption>
     * const obj = new NObject();
     * obj.fromJSON({ state: { volume: 80, muet: false } });
     * console.log(obj.getState('volume')); // 80
     *
     * @example <caption>Exemple 2 : Sauvegarder et restaurer via JSON.stringify / JSON.parse</caption>
     * const source = new NObject({ state: { jeton: 'abc123' } });
     * const dump = JSON.stringify(source);
     * const cible = new NObject().fromJSON(JSON.parse(dump));
     * console.log(cible.getState('jeton')); // 'abc123'
     */
    fromJSON(data = {}) {
        if (data.state && typeof data.state === 'object') {
            this.setState(data.state);
        }
        return this;
    }

    /**
     * Crée et retourne une nouvelle instance indépendante de la même classe avec une copie profonde de `#state`.
     * Si `#state` est `null`, la nouvelle instance reste également à `#state = null`.
     *
     * @returns {NObject} Nouvelle instance clonée.
     *
     * @example <caption>Exemple 1 : Cloner une instance et modifier le clone sans affecter l'original</caption>
     * const original = new NObject({ state: { score: 100 } });
     * const copie = original.clone();
     * copie.setState('score', 200);
     * console.log(original.getState('score')); // 100
     *
     * @example <caption>Exemple 2 : Cloner une instance d'une sous-classe personnalisée</caption>
     * class Configuration extends NObject {}
     * const conf1 = new Configuration({ state: { debug: true } });
     * const conf2 = conf1.clone();
     * console.log(conf2 instanceof Configuration); // true
     */
    clone() {
        const Cls = this.constructor;
        if (!this.#state) {
            return new Cls();
        }
        return new Cls({
            state: typeof structuredClone === 'function'
                ? structuredClone(this.state)
                : JSON.parse(JSON.stringify(this.state))
        });
    }

    /**
     * Retourne une représentation textuelle concise de l'instance.
     *
     * @returns {string} Chaîne décrivant la classe de l'objet (ex: `"[NObject]"`).
     *
     * @example <caption>Exemple 1 : Appel explicite de toString()</caption>
     * const obj = new NObject();
     * console.log(obj.toString()); // '[NObject]'
     *
     * @example <caption>Exemple 2 : Interpolation automatique dans une chaîne de caractères</caption>
     * class Gestionnaire extends NObject {}
     * const g = new Gestionnaire();
     * console.log(`Instance active : ${g}`); // 'Instance active : [Gestionnaire]'
     */
    toString() {
        return `[${this.className}]`;
    }

    // =========================================================================
    // Méthodes statiques
    // =========================================================================

    /**
     * Méthode de fabrique (Factory) permettant d'instancier la classe (ou une sous-classe) sans utiliser `new`.
     *
     * @param {Object} [options={}] - Options passées au constructeur.
     * @returns {NObject} Nouvelle instance créée.
     *
     * @example <caption>Exemple 1 : Création directe via NObject.create()</caption>
     * const obj = NObject.create({ state: { pret: true } });
     *
     * @example <caption>Exemple 2 : Création depuis une sous-classe</caption>
     * class Service extends NObject {}
     * const srv = Service.create({ state: { port: 3000 } });
     * console.log(srv instanceof Service); // true
     */
    static create(options = {}) {
        return new this(options);
    }

    /**
     * Vérifie si une valeur quelconque est une instance de `NObject` (ou d'une classe qui en hérite).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `value` hérite de `NObject`, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester une instance valide de NObject</caption>
     * const obj = new NObject();
     * console.log(NObject.isNObject(obj)); // true
     *
     * @example <caption>Exemple 2 : Tester un objet JavaScript ordinaire ou null</caption>
     * console.log(NObject.isNObject({ a: 1 })); // false
     * console.log(NObject.isNObject(null));     // false
     */
    static isNObject(value) {
        return value instanceof NObject;
    }

    // =========================================================================
    // Méthodes privées
    // =========================================================================

    /**
     * Vérifie la validité interne de l'instance avant son initialisation.
     *
     * @private
     * @returns {boolean} `true` si l'instance est valide.
     *
     * @example <caption>Exemple 1 : Appel interne lors de initialize()</caption>
     * // Exécuté automatiquement par this.initialize() :
     * // if (!this.#validate()) throw new Error(...);
     *
     * @example <caption>Exemple 2 : Comportement par défaut</caption>
     * // Retourne toujours true lorsque l'objet est dans un état cohérent.
     */
    #validate() {
        return true;
    }
}

export default NObject;
