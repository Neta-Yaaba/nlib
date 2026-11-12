/**
 * @file NObject.js
 * @package @nlib/js-backend
 * @description Classe de base universelle (sans interface / headless) de l'écosystème NLib.
 * Toutes les classes d'entités ou de composants logiques héritant de `NObject` bénéficient :
 * - du cycle de vie standardisé (`initialize`, `destroy`),
 * - de la gestion d'état réactif avec allocation mémoire à la demande (`hasState`, `getState`, `setState`),
 * - du gestionnaire d'événements `NEvent` avec initialisation paresseuse via `this.event` (`#event`),
 * - et de la sérialisation / clonage (`toJSON`, `fromJSON`, `clone`).
 */

import { NException } from './NException.js';
import { NEvent } from './NEvent.js';

/**
 * @class NObject
 * @description Classe mère des objets logiques de NLib.
 * Conçue avec une empreinte mémoire minimale (*Lazy Initialization*) : `#state` et `#event`
 * restent à `null` tant qu'aucun état ou gestionnaire d'événement n'est réellement appelé.
 *
 * @example <caption>Exemple 1 : Utilisation directe avec état réactif et écoute d'événement via obj.event</caption>
 * const compteur = new NObject({ state: { total: 0 } });
 * compteur.event.on('state:total', ({ value, oldValue }) => {
 *     console.log(`Total passé de ${oldValue} à ${value}`);
 * });
 * compteur.setState('total', 10);
 *
 * @example <caption>Exemple 2 : Héritage par une classe métier personnalisée</caption>
 * class ServiceUtilisateur extends NObject {
 *     connecter(nom) {
 *         this.setState({ utilisateur: nom, connecte: true });
 *         this.event.emit('connexion', { nom });
 *     }
 * }
 * const service = ServiceUtilisateur.create();
 * service.event.on('connexion', ({ nom }) => console.log(`Bienvenue ${nom}`));
 * service.connecter('Neta');
 *
 * @example <caption>Exemple 3 : Initialisation différée, sérialisation JSON et clonage</caption>
 * const obj = new NObject({ state: { mode: 'hors-ligne' }, autoInit: false });
 * obj.initialize();
 * const sauvegarde = JSON.stringify(obj);
 * const copie = obj.clone();
 * obj.destroy();
 */
export class NObject {

    // =========================================================================
    // Propriétés privées (Variables internes à initialisation paresseuse)
    // =========================================================================

    /**
     * Dictionnaire interne stockant les variables d'état (clé -> valeur) de l'instance.
     * Reste à `null` tant qu'aucune donnée d'état n'est définie (économie de mémoire).
     * @type {Map<string, any>|null}
     * @private
     */
    #state = null;

    /**
     * Instance interne de `NEvent` gérant les événements de cet objet.
     * Reste à `null` et n'est instanciée que lors du premier appel à `this.event` (économie de mémoire).
     * @type {NEvent|null}
     * @private
     */
    #event = null;

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
     * N'alloue `#state` en mémoire que si `options.state` contient au moins une propriété,
     * et laisse `#event` à `null` jusqu'au premier accès à `this.event`.
     *
     * @param {Object} [options={}] - Options de configuration de l'instance.
     * @param {Object<string, any>} [options.state] - Valeurs initiales optionnelles de l'état interne (`#state`).
     * @param {boolean} [options.autoInit=true] - Si `true` (par défaut), appelle automatiquement `initialize()` à la construction.
     *
     * @example <caption>Exemple 1 : Création légère (zéro Map ni NEvent alloués en mémoire)</caption>
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
     * Retourne l'instance `NEvent` associée à cet objet.
     * La variable privée `#event` est initialisée uniquement lors du tout premier appel à ce getter.
     *
     * @returns {NEvent} Gestionnaire d'événements de l'instance.
     *
     * @example <caption>Exemple 1 : Écouter et émettre un événement</caption>
     * const obj = new NObject();
     * obj.event.on('message', (txt) => console.log('Reçu :', txt));
     * obj.event.emit('message', 'Bonjour');
     *
     * @example <caption>Exemple 2 : Écouter un changement d'état</caption>
     * const obj = new NObject({ state: { score: 0 } });
     * obj.event.on('state:score', ({ value }) => console.log('Nouveau score :', value));
     * obj.setState('score', 42);
     */
    get event() {
        if (!this.#event) {
            this.#event = new NEvent(this);
        }
        return this.#event;
    }

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
     * Si `#event` a été initialisé, émet l'événement `'initialize'` avec `{ target: this }`.
     * Si l'instance est déjà initialisée ou détruite, la méthode ne fait rien.
     *
     * @throws {NException} Si la validation interne `#validate()` échoue (`code: 'ERR_INIT_VALIDATION'`).
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Initialisation manuelle avec écoute de l'événement 'initialize'</caption>
     * const obj = new NObject({ autoInit: false });
     * obj.event.on('initialize', () => console.log('Objet initialisé !'));
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
        if (this.#event) {
            this.#event.emit('initialize', { target: this });
        }
        return this;
    }

    /**
     * Détruit proprement l'instance et libère toutes ses références en mémoire (`#state = null` et `#event = null`).
     * Si `#event` a été initialisé, émet l'événement `'beforeDestroy'` juste avant le nettoyage.
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
     * obj.event.on('beforeDestroy', ({ target }) => {
     *     console.log('Sauvegarde avant fermeture :', target.state);
     * });
     * obj.destroy();
     */
    destroy() {
        if (this.#destroyed) {
            return;
        }
        if (this.#event) {
            this.#event.emit('beforeDestroy', { target: this });
            this.#event.clear();
            this.#event = null;
        }
        if (this.#state) {
            this.#state.clear();
            this.#state = null;
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
     * Si `#event` est actif, émet pour chaque clé dont la valeur change réellement :
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
                if (this.#event) {
                    this.#event.emit(`state:${k}`, { key: k, value: v, oldValue, target: this });
                    this.#event.emit('stateChange', { key: k, value: v, oldValue, target: this });
                }
            }
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
