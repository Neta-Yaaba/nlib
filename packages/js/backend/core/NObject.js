/**
 * @file NObject.js
 * @package @nlib/js-backend
 * @description Classe de base universelle de l'écosystème NLib.
 * Toutes les classes d'entités ou de composants logiques héritant de `NObject` bénéficient :
 * - du cycle de vie standardisé (`destroy`),
 * - de la gestion d'état réactif avec initialisation à la demande (`hasState`, `getState`, `setState`),
 * - du gestionnaire d'événements `NEvent` avec initialisation paresseuse via `this.event` (`#event`),
 * - et de la sérialisation / clonage (`toJSON`, `fromJSON`, `clone`).
 */

import { NEvent } from './NEvent.js';

/**
 * @class NObject
 * @description Classe mère des objets logiques de NLib.
 * Utilise l'initialisation paresseuse (*Lazy Initialization*) : `#state` et `#event`
 * restent à `null` jusqu'à leur première utilisation.
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
 * @example <caption>Exemple 3 : Sérialisation JSON, clonage et destruction</caption>
 * const obj = new NObject({ state: { mode: 'hors-ligne' } });
 * const sauvegarde = JSON.stringify(obj);
 * const copie = obj.clone();
 * obj.destroy();
 */
export class NObject {

    // =========================================================================
    // Propriétés statiques privées (Injection de la façade NUtil)
    // =========================================================================

    /**
     * Référence vers la façade utilitaire `NUtil` enregistrée par `NObject.registerUtil()`.
     * Reste à `null` tant que `NUtil` n'a pas été chargé.
     * @type {any}
     * @private
     */
    static #util = null;

    // =========================================================================
    // Propriétés privées (Variables internes à initialisation paresseuse)
    // =========================================================================

    /**
     * Dictionnaire interne stockant les variables d'état (clé -> valeur) de l'instance.
     * Initialisé à `null` jusqu'à ce qu'une donnée d'état soit définie.
     * @type {Map<string, any>|null}
     * @private
     */
    #state = null;

    /**
     * Instance interne de `NEvent` gérant les événements de cet objet.
     * Initialisée lors du premier appel à `this.event`.
     * @type {NEvent|null}
     * @private
     */
    #event = null;

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
     * Initialise `#state` si `options.state` contient au moins une propriété,
     * et laisse `#event` à `null` jusqu'au premier accès à `this.event`.
     *
     * @param {Object} [options={}] - Options de configuration de l'instance.
     * @param {Object<string, any>} [options.state] - Valeurs initiales optionnelles de l'état interne (`#state`).
     *
     * @example <caption>Exemple 1 : Création légère</caption>
     * const obj = new NObject();
     * console.log(obj.isDestroyed); // false
     *
     * @example <caption>Exemple 2 : Création avec un état initial</caption>
     * const obj = new NObject({ state: { langue: 'fr', actif: true } });
     * console.log(obj.getState('langue')); // 'fr'
     */
    constructor(options = {}) {
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.state && typeof opts.state === 'object') {
            try {
                const entries = Object.entries(opts.state);
                if (entries.length > 0) {
                    this.#state = new Map(entries);
                }
            } catch (error) {
                this.util?.log?.error?.(`NObject: Erreur lors de l'initialisation de l'état dans le constructeur de ${this.className}.`, {
                    code: 'ERR_INIT_STATE',
                    error,
                    stack: error?.stack,
                    state: opts.state,
                    target: this
                });
            }
        }

        queueMicrotask(() => {
            if (this.#destroyed) {
                return;
            }
            this._init();
        });
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
     * Si `#state` vaut `null`, retourne `{}`.
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

    // =========================================================================
    // Getters — Façade Utilitaire NUtil
    // =========================================================================

    /**
     * Accès direct à la classe utilitaire transversale NUtil.
     * Permet d'accéder à l'ensemble des modules utilitaires (log, str, num, date, crypto, etc.).
     *
     * @returns {typeof NUtil} Classe utilitaire NUtil.
     *
     * @example <caption>Exemple 1 : Journaliser un message ou une erreur via this.util.log</caption>
     * const obj = new NObject();
     * obj.util.log.info('Opération réussie');
     * obj.util.log.error('Échec de traitement', { code: 'ERR_TRAITEMENT' });
     *
     * @example <caption>Exemple 2 : Manipulation de chaînes ou dates via this.util</caption>
     * const obj = new NObject();
     * console.log(obj.util.str.camelCase('nom_utilisateur'));
     * console.log(obj.util.date.nowDate());
     */
    get util() {
        return NObject.#util;
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
    // Méthodes publiques — Événements (Délégation vers NEvent)
    // =========================================================================

    /**
     * Enregistre un écouteur pour un événement donné sur l'instance (`this.event.on`).
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} callback - Fonction appelée lors de l'émission.
     * @returns {this} L'instance courante pour chaînage fluide.
     *
     * @example <caption>Exemple 1 : Écouter un événement directement sur l'objet</caption>
     * const obj = new NObject();
     * obj.on('ready', (data) => console.log('Prêt :', data));
     * obj.emit('ready', { ok: true });
     *
     * @example <caption>Exemple 2 : Chaînage fluide avec setState</caption>
     * obj.on('state:mode', ({ value }) => console.log(value)).setState('mode', 'prod');
     */
    on(event, callback) {
        this.event.on(event, callback);
        return this;
    }

    /**
     * Supprime un écouteur ou tous les écouteurs d'un événement (`this.event.off`).
     *
     * @param {string} [event] - Nom de l'événement (tous si omis).
     * @param {Function} [callback] - Fonction spécifique à retirer.
     * @returns {this} L'instance courante pour chaînage fluide.
     *
     * @example <caption>Exemple 1 : Retirer un écouteur spécifique</caption>
     * obj.off('ready', handler);
     *
     * @example <caption>Exemple 2 : Retirer tous les écouteurs d'un événement</caption>
     * obj.off('ready');
     */
    off(event, callback) {
        if (this.#event) {
            this.#event.off(event, callback);
        }
        return this;
    }

    /**
     * Émet un événement avec une donnée associée (`this.event.emit`).
     *
     * @param {string} event - Nom de l'événement à déclencher.
     * @param {any} [data=null] - Charge utile transmise aux écouteurs.
     * @returns {this} L'instance courante pour chaînage fluide.
     *
     * @example <caption>Exemple 1 : Émettre un événement personnalisé</caption>
     * obj.emit('saved', { id: 42 });
     *
     * @example <caption>Exemple 2 : Émettre plusieurs événements en chaîne</caption>
     * obj.emit('start').emit('end');
     */
    emit(event, data = null) {
        if (this.#event) {
            this.#event.emit(event, data);
        }
        return this;
    }

    /**
     * Vérifie si un écouteur est enregistré pour un événement (`this.event.hasListener`).
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} callback - Fonction de rappel recherchée.
     * @returns {boolean} `true` si l'écouteur est présent, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier un écouteur présent</caption>
     * obj.on('ping', fn);
     * console.log(obj.hasListener('ping', fn)); // true
     *
     * @example <caption>Exemple 2 : Vérifier après suppression</caption>
     * obj.off('ping', fn);
     * console.log(obj.hasListener('ping', fn)); // false
     */
    hasListener(event, callback) {
        return this.#event ? this.#event.hasListener(event, callback) : false;
    }

    /**
     * Retourne le nombre d'écouteurs enregistrés pour un événement ou au total (`this.event.listenerCount`).
     *
     * @param {string} [event] - Nom de l'événement (total si omis).
     * @returns {number} Nombre d'écouteurs.
     *
     * @example <caption>Exemple 1 : Compter les écouteurs d'un événement</caption>
     * obj.on('save', () => {});
     * console.log(obj.listenerCount('save')); // 1
     *
     * @example <caption>Exemple 2 : Compter tous les écouteurs</caption>
     * console.log(obj.listenerCount());
     */
    listenerCount(event) {
        return this.#event ? this.#event.listenerCount(event) : 0;
    }

    /**
     * Retourne la liste des noms d'événements ayant au moins un écouteur (`this.event.eventNames`).
     *
     * @returns {string[]} Tableau des noms d'événements.
     *
     * @example <caption>Exemple 1 : Lister les événements écoutés</caption>
     * obj.on('open', () => {}).on('close', () => {});
     * console.log(obj.eventNames()); // ['open', 'close']
     *
     * @example <caption>Exemple 2 : Objet sans écouteur</caption>
     * console.log(new NObject().eventNames()); // []
     */
    eventNames() {
        return this.#event ? this.#event.eventNames() : [];
    }

    /**
     * Supprime tous les écouteurs d'événements enregistrés sur l'instance (`this.event.clear`).
     *
     * @returns {this} L'instance courante pour chaînage fluide.
     *
     * @example <caption>Exemple 1 : Vider tous les écouteurs</caption>
     * obj.clearEvents();
     *
     * @example <caption>Exemple 2 : Chaînage après nettoyage</caption>
     * obj.clearEvents().on('ready', () => {});
     */
    clearEvents() {
        if (this.#event) {
            this.#event.clear();
        }
        return this;
    }

    // =========================================================================
    // Méthodes publiques — Cycle de vie (Lifecycle)
    // =========================================================================

    /**
     * Point d'extension protégé appelé automatiquement en micro-tâche après la construction de l'instance
     * (lorsque l'objet n'a pas déjà été détruit via `destroy()`).
     *
     * @protected
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Redéfinir _init() dans une sous-classe</caption>
     * class UserModel extends NObject {
     *     _init() {
     *         this.setState('ready', true);
     *     }
     * }
     *
     * @example <caption>Exemple 2 : Appeler super._init() lors de l'héritage en cascade</caption>
     * class AuditModel extends UserModel {
     *     _init() {
     *         super._init();
     *         this.on('stateChange', () => console.log('Modifié'));
     *     }
     * }
     */
    _init() {
        // Point d'extension protégé pour les sous-classes
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
        try {
            if (this.#event) {
                this.#event.emit('beforeDestroy', { target: this });
                this.clearEvents();
                this.#event = null;
            }
            if (this.#state) {
                this.#state.clear();
                this.#state = null;
            }
        } catch (error) {
            this.util?.log?.error?.(`NObject: Erreur lors de la destruction de ${this.className}.`, {
                code: 'ERR_DESTROY_FAILED',
                error,
                stack: error?.stack,
                target: this
            });
        } finally {
            this.#destroyed = true;
        }
    }

    // =========================================================================
    // Méthodes publiques — Gestion de l'état (State)
    // =========================================================================

    /**
     * Vérifie si une clé existe dans l'état interne `#state`.
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
        if (!this.#state || key === null || key === undefined) {
            return false;
        }
        return this.#state.has(String(key));
    }

    /**
     * Récupère la valeur d'une variable dans l'état interne `#state`.
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
        if (!this.#state || key === null || key === undefined) {
            return defaultValue;
        }
        const keyStr = String(key);
        if (!this.#state.has(keyStr)) {
            return defaultValue;
        }
        return this.#state.get(keyStr);
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
        if (keyOrObject === null || keyOrObject === undefined) {
            return this;
        }
        try {
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
                if (k === null || k === undefined) {
                    continue;
                }
                const keyStr = String(k);
                const oldValue = this.#state.get(keyStr);
                if (oldValue !== v) {
                    this.#state.set(keyStr, v);
                    if (this.#event) {
                        this.#event.emit(`state:${keyStr}`, { key: keyStr, value: v, oldValue, target: this });
                        this.#event.emit('stateChange', { key: keyStr, value: v, oldValue, target: this });
                    }
                }
            }
        } catch (error) {
            this.util?.log?.error?.(`NObject: Erreur lors de la modification de l'état sur ${this.className}.`, {
                code: 'ERR_SET_STATE_FAILED',
                error,
                stack: error?.stack,
                target: this
            });
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
        try {
            return {
                className: this.className,
                state: this.state
            };
        } catch (error) {
            this.util?.log?.error?.(`NObject: Erreur lors de la sérialisation toJSON sur ${this.className}.`, {
                code: 'ERR_TO_JSON_FAILED',
                error,
                stack: error?.stack,
                target: this
            });
            return {
                className: this.className,
                state: {}
            };
        }
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
        if (!data || typeof data !== 'object') {
            this.util?.log?.warn?.(`NObject: Données invalides fournies à fromJSON sur ${this.className}.`, {
                code: 'WARN_FROM_JSON_INVALID',
                data,
                target: this
            });
            return this;
        }
        try {
            if (data.state && typeof data.state === 'object') {
                this.setState(data.state);
            }
        } catch (error) {
            this.util?.log?.error?.(`NObject: Erreur lors de la désérialisation fromJSON sur ${this.className}.`, {
                code: 'ERR_FROM_JSON_FAILED',
                error,
                stack: error?.stack,
                data,
                target: this
            });
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
        try {
            return new Cls({
                state: typeof structuredClone === 'function'
                    ? structuredClone(this.state)
                    : JSON.parse(JSON.stringify(this.state))
            });
        } catch (error) {
            this.util?.log?.error?.(`NObject: Échec du clonage de l'instance ${this.className}.`, {
                code: 'ERR_CLONE_FAILED',
                error,
                stack: error?.stack,
                target: this
            });
            return new Cls({ state: { ...this.state } });
        }
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
     * @returns {NObject|null} Nouvelle instance créée ou `null` en cas d'erreur.
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
        try {
            return new this(options);
        } catch (error) {
            const meta = {
                code: 'ERR_CREATE_FAILED',
                error,
                stack: error?.stack,
                options
            };
            if (NObject.#util?.log) {
                NObject.#util.log.error(`NObject: Échec de l'instanciation via la fabrique create() pour ${this.name}.`, meta);
            } else {
                console.error(`NObject: Échec de l'instanciation via la fabrique create() pour ${this.name}.`, meta);
            }
            return null;
        }
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
        try {
            return value instanceof NObject;
        } catch {
            return false;
        }
    }

    /**
     * Enregistre la façade utilitaire `NUtil` auprès de `NObject` pour permettre l'accès
     * via `this.util` et la journalisation dans `NObject.create()` sans import circulaire.
     *
     * @param {any} util - Classe ou façade `NUtil` à associer.
     * @returns {typeof NObject} La classe `NObject` pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Enregistrer NUtil auprès de NObject</caption>
     * NObject.registerUtil(NUtil);
     * const obj = new NObject();
     * console.log(obj.util === NUtil); // true
     *
     * @example <caption>Exemple 2 : Utiliser obj.util après enregistrement</caption>
     * NObject.registerUtil(NUtil);
     * const obj = new NObject();
     * obj.util.log.info('Instance prête');
     */
    static registerUtil(util) {
        if (util) {
            NObject.#util = util;
        }
        return NObject;
    }

}

export default NObject;
