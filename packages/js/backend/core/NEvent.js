/**
 * @file NEvent.js
 * @package @nlib/js-backend
 * @description Gestionnaire d'événements autonome avec allocation mémoire à la demande (*Lazy Initialization*)
 * dans l'écosystème NLib.
 *
 * Utilisé notamment par `NObject` via sa propriété paresseuse `obj.event`, ou directement
 * comme bus d'événements indépendant (`new NEvent()`).
 */

/**
 * @class NEvent
 * @description Moteur d'événements léger à initialisation paresseuse (`#listeners` reste à `null`
 * tant qu'aucun écouteur n'est enregistré via `on` ou `once`, et repasse automatiquement à `null`
 * dès que le dernier écouteur est retiré).
 *
 * @example <caption>Exemple 1 : Utiliser NEvent via un NObject (obj.event)</caption>
 * const obj = new NObject({ state: { total: 0 } });
 * obj.event.on('state:total', ({ value, oldValue }) => {
 *     console.log(`Total : ${oldValue} -> ${value}`);
 * });
 * obj.setState('total', 10);
 *
 * @example <caption>Exemple 2 : Utiliser NEvent comme bus d'événements autonome</caption>
 * const bus = new NEvent();
 * bus.on('message', (data) => console.log('Reçu :', data));
 * bus.emit('message', { texte: 'Bonjour NLib' });
 *
 * @example <caption>Exemple 3 : Écoute unique (once), attente asynchrone (waitFor) et nettoyage (clear)</caption>
 * const evt = new NEvent();
 * evt.once('pret', () => console.log('Initialisé une seule fois'));
 * evt.emit('pret');
 * evt.clear();
 */
export class NEvent {

    // =========================================================================
    // Propriétés privées (Allocation paresseuse : null par défaut)
    // =========================================================================

    /**
     * Registre interne des écouteurs d'événements (`nomEvenement -> Set<Function>`).
     * Reste à `null` tant qu'aucun écouteur n'est abonné (économie de mémoire).
     * @type {Map<string, Set<Function>>|null}
     * @private
     */
    #listeners = null;

    /**
     * Cible (`this`) optionnelle attachée aux appels des fonctions de rappel.
     * @type {any}
     * @private
     */
    #target = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NEvent`.
     *
     * @param {any} [target=null] - Objet cible optionnel qui sera utilisé comme contexte `this` dans les écouteurs.
     *
     * @example <caption>Exemple 1 : Création autonome</caption>
     * const evt = new NEvent();
     * console.log(evt.isEmpty); // true
     *
     * @example <caption>Exemple 2 : Création rattachée à une instance propriétaire</caption>
     * const owner = { name: 'MonObjet' };
     * const evt = new NEvent(owner);
     * evt.on('ping', function () { console.log(this.name); });
     * evt.emit('ping'); // 'MonObjet'
     */
    constructor(target = null) {
        this.#target = target;
    }

    // =========================================================================
    // Getters
    // =========================================================================

    /**
     * Indique si aucun écouteur d'événement n'est actuellement enregistré.
     *
     * @returns {boolean} `true` si aucun écouteur n'est actif, sinon `false`.
     *
     * @example <caption>Exemple 1 : Instance vide</caption>
     * const evt = new NEvent();
     * console.log(evt.isEmpty); // true
     *
     * @example <caption>Exemple 2 : Après ajout puis suppression d'un écouteur</caption>
     * const evt = new NEvent();
     * evt.on('test', () => {});
     * console.log(evt.isEmpty); // false
     * evt.off('test');
     * console.log(evt.isEmpty); // true
     */
    get isEmpty() {
        return !this.#listeners || this.#listeners.size === 0;
    }

    // =========================================================================
    // Méthodes publiques — Abonnement, Désabonnement & Émission
    // =========================================================================

    /**
     * Vérifie s'il existe déjà au moins un écouteur pour un événement donné,
     * ou si une fonction de rappel spécifique (`callback`) y est déjà abonnée.
     * N'alloue aucune mémoire si `#listeners` est encore à `null`.
     *
     * @param {string} event - Nom de l'événement à vérifier.
     * @param {Function} [callback] - Fonction précise à rechercher (optionnel).
     * @returns {boolean} `true` si l'événement (ou le couple `event` + `callback`) est écouté, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier si un événement possède au moins un écouteur</caption>
     * const evt = new NEvent();
     * console.log(evt.has('message')); // false
     * evt.on('message', () => {});
     * console.log(evt.has('message')); // true
     *
     * @example <caption>Exemple 2 : Vérifier si une fonction précise écoute déjà l'événement</caption>
     * const evt = new NEvent();
     * const fn = () => {};
     * evt.on('message', fn);
     * console.log(evt.has('message', fn));       // true
     * console.log(evt.has('message', () => {})); // false
     */
    has(event, callback) {
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
     * Alias de `has(event, callback)` vérifiant la présence d'un écouteur sur un événement.
     *
     * @param {string} event - Nom de l'événement à vérifier.
     * @param {Function} [callback] - Fonction précise à rechercher (optionnel).
     * @returns {boolean} `true` si l'événement est écouté, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier l'existence d'un écouteur</caption>
     * const evt = new NEvent();
     * evt.on('save', () => {});
     * console.log(evt.hasListener('save')); // true
     *
     * @example <caption>Exemple 2 : Événement non écouté</caption>
     * const evt = new NEvent();
     * console.log(evt.hasListener('inconnu')); // false
     */
    hasListener(event, callback) {
        return this.has(event, callback);
    }

    /**
     * Retourne le nombre d'écouteurs enregistrés pour un événement donné (ou le nombre total
     * d'écouteurs tous événements confondus si `event` est omis).
     *
     * @param {string} [event] - Nom de l'événement (optionnel).
     * @returns {number} Nombre d'écouteurs actifs.
     *
     * @example <caption>Exemple 1 : Compter les écouteurs d'un événement précis</caption>
     * const evt = new NEvent();
     * evt.on('log', () => {}).on('log', () => {});
     * console.log(evt.listenerCount('log')); // 2
     *
     * @example <caption>Exemple 2 : Compter le total de tous les écouteurs</caption>
     * const evt = new NEvent();
     * evt.on('a', () => {}).on('b', () => {});
     * console.log(evt.listenerCount()); // 2
     */
    listenerCount(event) {
        if (!this.#listeners) {
            return 0;
        }
        if (typeof event === 'string') {
            return this.#listeners.get(event)?.size ?? 0;
        }
        let total = 0;
        for (const set of this.#listeners.values()) {
            total += set.size;
        }
        return total;
    }

    /**
     * Retourne la liste des noms d'événements possédant actuellement au moins un écouteur.
     *
     * @returns {string[]} Tableau des noms d'événements actifs.
     *
     * @example <caption>Exemple 1 : Lister les événements écoutés</caption>
     * const evt = new NEvent();
     * evt.on('open', () => {}).on('close', () => {});
     * console.log(evt.eventNames()); // ['open', 'close']
     *
     * @example <caption>Exemple 2 : Aucun événement</caption>
     * const evt = new NEvent();
     * console.log(evt.eventNames()); // []
     */
    eventNames() {
        return this.#listeners ? Array.from(this.#listeners.keys()) : [];
    }

    /**
     * Abonne une fonction de rappel (`callback`) à un événement nommé.
     * Initialise automatiquement `this.#listeners = new Map()` lors du tout premier abonnement.
     *
     * @param {string} event - Nom de l'événement à écouter.
     * @param {Function} callback - Fonction exécutée lorsque l'événement est émis.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Écouter un événement personnalisé</caption>
     * const evt = new NEvent();
     * evt.on('message', (texte) => console.log('Reçu :', texte));
     * evt.emit('message', 'Bonjour NLib');
     *
     * @example <caption>Exemple 2 : Chaîner plusieurs abonnements</caption>
     * const evt = new NEvent();
     * evt.on('start', () => {}).on('stop', () => {});
     */
    on(event, callback) {
        if (typeof event !== 'string' || event.length === 0 || typeof callback !== 'function') {
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
     * const evt = new NEvent();
     * evt.once('pret', () => console.log('Exécuté une seule fois'));
     * evt.emit('pret'); // Affiche 'Exécuté une seule fois'
     * evt.emit('pret'); // Ne fait plus rien
     *
     * @example <caption>Exemple 2 : Libération automatique après exécution</caption>
     * const evt = new NEvent();
     * evt.once('init', () => {});
     * evt.emit('init');
     * console.log(evt.isEmpty); // true
     */
    once(event, callback) {
        if (typeof callback !== 'function') {
            return this;
        }
        const wrapper = (payload) => {
            this.off(event, wrapper);
            callback.call(this.#target ?? this, payload);
        };
        return this.on(event, wrapper);
    }

    /**
     * Désabonne une fonction de rappel spécifique (ou tous les écouteurs si `callback` est omis)
     * pour un événement donné.
     * Si plus aucun écouteur n'existe, libère automatiquement `this.#listeners = null`.
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} [callback] - Fonction spécifique à retirer. Si omis, supprime tous les écouteurs de cet événement.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Retirer un écouteur spécifique</caption>
     * const evt = new NEvent();
     * const monEcouteur = () => console.log('Alarme !');
     * evt.on('alarme', monEcouteur);
     * evt.off('alarme', monEcouteur);
     *
     * @example <caption>Exemple 2 : Supprimer tous les écouteurs d'un événement</caption>
     * const evt = new NEvent();
     * evt.on('log', () => {}).on('log', () => {});
     * evt.off('log');
     * console.log(evt.has('log')); // false
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
     * const evt = new NEvent();
     * evt.on('ping', () => console.log('pong'));
     * evt.emit('ping');
     *
     * @example <caption>Exemple 2 : Émettre un événement avec un objet de données</caption>
     * const evt = new NEvent();
     * evt.on('erreur', ({ code, message }) => console.error(`Erreur ${code} : ${message}`));
     * evt.emit('erreur', { code: 500, message: 'Serveur indisponible' });
     */
    emit(event, data = null) {
        if (!this.#listeners || !this.#listeners.has(event)) {
            return this;
        }
        const ctx = this.#target ?? this;
        for (const callback of Array.from(this.#listeners.get(event))) {
            callback.call(ctx, data);
        }
        return this;
    }

    /**
     * Attend de manière asynchrone (`Promise`) la prochaine émission d'un événement.
     *
     * @param {string} event - Nom de l'événement attendu.
     * @returns {Promise<any>} Promesse résolue avec les données de l'événement.
     *
     * @example <caption>Exemple 1 : Attendre un événement avec await</caption>
     * const evt = new NEvent();
     * setTimeout(() => evt.emit('done', { ok: true }), 20);
     * const res = await evt.waitFor('done');
     * console.log(res.ok); // true
     *
     * @example <caption>Exemple 2 : Se désabonne automatiquement dès réception</caption>
     * const evt = new NEvent();
     * queueMicrotask(() => evt.emit('ready', 42));
     * console.log(await evt.waitFor('ready')); // 42
     */
    waitFor(event) {
        return new Promise((resolve) => {
            this.once(event, (data) => resolve(data));
        });
    }

    /**
     * Supprime tous les écouteurs de tous les événements et libère la mémoire (`#listeners = null`).
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Nettoyer tous les écouteurs</caption>
     * const evt = new NEvent();
     * evt.on('a', () => {}).on('b', () => {});
     * evt.clear();
     * console.log(evt.isEmpty); // true
     *
     * @example <caption>Exemple 2 : Chaîner après clear()</caption>
     * const evt = new NEvent().clear().on('nouveau', () => {});
     */
    clear() {
        if (this.#listeners) {
            this.#listeners.clear();
            this.#listeners = null;
        }
        return this;
    }
}

export default NEvent;

