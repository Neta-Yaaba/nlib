/**
 * @file NEvent.js
 * @package @nlib/js-backend
 * @description Gestionnaire d'événements autonome avec allocation mémoire à la demande (*Lazy Initialization*)
 * dans l'écosystème NLib.
 *
 * Gestion des erreurs et promesses :
 * - Les erreurs survenues dans les fonctions de rappel (listeners) sont capturées et journalisées via `NUtil.log.error`
 *   tout en poursuivant l'exécution des autres écouteurs,
 * - `waitFor()` résout avec la valeur de l'événement ou `null` en cas d'expiration ou d'erreur.
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
    // Propriétés statiques privées (Injection de la façade NUtil)
    // =========================================================================

    /**
     * Référence vers la façade utilitaire `NUtil` enregistrée par `NEvent.registerUtil()`.
     * Reste à `null` tant que `NUtil` n'a pas été chargé.
     * @type {any}
     * @private
     */
    static #util = null;

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

    /**
     * Métadonnées des écouteurs `once` (`wrapper -> { event, callback, handlerRemove }`).
     * Reste à `null` tant qu'aucun écouteur `once` n'est actif.
     * @type {Map<Function, { event: string, callback: Function, handlerRemove: Function|null }>|null}
     * @private
     */
    #onceEntries = null;

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

    /**
     * Retourne l'objet cible utilisé comme contexte `this` dans les fonctions de rappel.
     *
     * @returns {any} Contexte cible ou `null`.
     *
     * @example <caption>Exemple 1 : Lecture du contexte cible défini</caption>
     * const proprietaire = { service: 'Auth' };
     * const evt = new NEvent(proprietaire);
     * console.log(evt.target.service); // 'Auth'
     *
     * @example <caption>Exemple 2 : Lecture sur instance autonome sans cible</caption>
     * const evt = new NEvent();
     * console.log(evt.target); // null
     */
    get target() {
        return this.#target;
    }

    /**
     * Accès direct à la classe utilitaire transversale `NUtil`.
     *
     * @returns {typeof NUtil} Classe utilitaire `NUtil`.
     *
     * @example <caption>Exemple 1 : Journaliser un message d'information</caption>
     * const evt = new NEvent();
     * evt.util.log.info('Bus d\'événements initialisé');
     *
     * @example <caption>Exemple 2 : Accéder aux modules utilitaires</caption>
     * const evt = new NEvent();
     * console.log(evt.util.str.slug('Mon Titre'));
     */
    get util() {
        return NEvent.#util;
    }

    // =========================================================================
    // Méthodes publiques — Consultation & Décompte
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
        if (typeof event !== 'string' || !this.#listeners || !this.#listeners.has(event)) {
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
     * @example <caption>Exemple 2 : Aucun événement enregistré</caption>
     * const evt = new NEvent();
     * console.log(evt.eventNames()); // []
     */
    eventNames() {
        return this.#listeners ? Array.from(this.#listeners.keys()) : [];
    }

    // =========================================================================
    // Méthodes publiques — Abonnement, Désabonnement & Émission
    // =========================================================================

    /**
     * Abonne une fonction de rappel (`callback`) à un événement nommé.
     * Initialise automatiquement `this.#listeners = new Map()` lors du tout premier abonnement.
     * Si l'événement ou le rappel est invalide, consigne un avertissement et retourne `this` sans lever d'exception.
     *
     * @param {string} event - Nom de l'événement à écouter.
     * @param {Function} callback - Fonction exécutée lorsque l'événement est émis.
     * @returns {this} L'instance courante pour permettre le chaînage fluide.
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
        if (typeof event !== 'string' || event.trim().length === 0) {
            this.util?.log?.warn?.('NEvent.on: Nom d\'événement invalide fourni.', {
                code: 'WARN_EVENT_INVALID',
                event
            });
            return this;
        }
        if (typeof callback !== 'function') {
            this.util?.log?.warn?.(`NEvent.on: Écouteur de type fonction attendu pour "${event}".`, {
                code: 'WARN_LISTENER_NOT_FUNCTION',
                event,
                callback
            });
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
     * Un rappel optionnel `handlerRemove` peut être fourni pour être notifié lorsque l'écouteur est retiré
     * (après exécution, via `off()` ou via `clear()`).
     *
     * @param {string} event - Nom de l'événement à écouter une seule fois.
     * @param {Function} callback - Fonction exécutée lors de la première émission.
     * @param {Function|null} [handlerRemove=null] - Fonction appelée lorsque l'écouteur est retiré.
     * @returns {this} L'instance courante pour permettre le chaînage fluide.
     *
     * @example <caption>Exemple 1 : Réagir uniquement au premier événement</caption>
     * const evt = new NEvent();
     * evt.once('pret', () => console.log('Exécuté une seule fois'));
     * evt.emit('pret'); // Affiche 'Exécuté une seule fois'
     * evt.emit('pret'); // Ne fait plus rien
     *
     * @example <caption>Exemple 2 : Nettoyer une ressource au retrait via handlerRemove</caption>
     * const evt = new NEvent();
     * evt.once('init', () => {}, ({ event }) => {
     *     console.log(`Écouteur ${event} retiré`);
     * });
     * evt.emit('init');
     * console.log(evt.isEmpty); // true
     */
    once(event, callback, handlerRemove = null) {
        if (typeof event !== 'string' || event.trim().length === 0) {
            this.util?.log?.warn?.('NEvent.once: Nom d\'événement invalide fourni.', {
                code: 'WARN_EVENT_INVALID',
                event
            });
            return this;
        }
        if (typeof callback !== 'function') {
            this.util?.log?.warn?.(`NEvent.once: Écouteur de type fonction attendu pour "${event}".`, {
                code: 'WARN_LISTENER_NOT_FUNCTION',
                event,
                callback
            });
            return this;
        }
        const removeCb = typeof handlerRemove === 'function' ? handlerRemove : null;
        const wrapper = (payload) => {
            this.off(event, wrapper);
            try {
                callback.call(this.#target ?? this, payload);
            } catch (error) {
                this.util?.log?.error?.(`NEvent: Erreur lors de l'exécution d'un écouteur 'once' pour "${event}".`, {
                    code: 'ERR_EVENT_ONCE_LISTENER',
                    event,
                    error,
                    stack: error?.stack,
                    target: this.#target ?? this
                });
            }
        };
        if (!this.#onceEntries) {
            this.#onceEntries = new Map();
        }
        this.#onceEntries.set(wrapper, {
            event,
            callback,
            handlerRemove: removeCb
        });
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
        if (typeof event !== 'string' || !this.#listeners || !this.#listeners.has(event)) {
            return this;
        }
        if (!callback) {
            const removed = Array.from(this.#listeners.get(event));
            this.#listeners.delete(event);
            if (this.#listeners.size === 0) {
                this.#listeners = null;
            }
            for (const fn of removed) {
                this.#notifyOnceRemoved(fn);
            }
            return this;
        }
        const set = this.#listeners.get(event);
        let targetFn = null;
        if (set.has(callback)) {
            targetFn = callback;
        } else if (this.#onceEntries) {
            for (const [wrapper, entry] of this.#onceEntries.entries()) {
                if (entry.event === event && entry.callback === callback && set.has(wrapper)) {
                    targetFn = wrapper;
                    break;
                }
            }
        }
        if (targetFn) {
            set.delete(targetFn);
            if (set.size === 0) {
                this.#listeners.delete(event);
            }
            if (this.#listeners.size === 0) {
                this.#listeners = null;
            }
            this.#notifyOnceRemoved(targetFn);
        }
        return this;
    }

    /**
     * Émet un événement et déclenche de manière synchrone tous les écouteurs enregistrés sur cet événement.
     * N'effectue aucune allocation si aucun écouteur n'est enregistré (`#listeners === null`).
     * Chaque écouteur est encapsulé dans un bloc sécurisé : si une fonction de rappel lève une erreur,
     * celle-ci est journalisée tout en poursuivant l'exécution des autres écouteurs.
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
     * evt.on('erreur', ({ code, message }) => NUtil.log.error(`Erreur ${code} : ${message}`));
     * evt.emit('erreur', { code: 500, message: 'Serveur indisponible' });
     */
    emit(event, data = null) {
        if (typeof event !== 'string' || !this.#listeners || !this.#listeners.has(event)) {
            return this;
        }
        const ctx = this.#target ?? this;
        const listenersList = Array.from(this.#listeners.get(event));
        for (const callback of listenersList) {
            try {
                callback.call(ctx, data);
            } catch (error) {
                this.util?.log?.error?.(`NEvent: Erreur lors de l'exécution d'un écouteur pour l'événement "${event}".`, {
                    code: 'ERR_EVENT_LISTENER',
                    event,
                    error,
                    stack: error?.stack,
                    target: ctx
                });
            }
        }
        return this;
    }

    /**
     * Attend de manière asynchrone (`Promise`) la prochaine émission d'un événement.
     * Résout toujours avec la valeur de l'événement ou `null` en cas d'expiration.
     * En cas de délai expiré ou de nom d'événement invalide, résout avec `null`.
     *
     * @param {string} event - Nom de l'événement attendu.
     * @param {number} [timeoutMs=0] - Délai d'expiration optionnel en millisecondes (0 = sans limite).
     * @returns {Promise<any>} Promesse résolue avec les données de l'événement ou `null` en cas d'expiration/erreur.
     *
     * @example <caption>Exemple 1 : Attendre un événement avec await</caption>
     * const evt = new NEvent();
     * setTimeout(() => evt.emit('done', { ok: true }), 20);
     * const res = await evt.waitFor('done');
     * console.log(res.ok); // true
     *
     * @example <caption>Exemple 2 : Attente avec délai maximal d'expiration (timeout)</caption>
     * const evt = new NEvent();
     * const resultat = await evt.waitFor('introuvable', 50);
     * console.log(resultat); // null (délai dépassé sans lever d'erreur)
     */
    waitFor(event, timeoutMs = 0) {
        if (typeof event !== 'string' || event.trim().length === 0) {
            this.util?.log?.warn?.('NEvent.waitFor: Nom d\'événement invalide.', {
                code: 'WARN_EVENT_INVALID',
                event
            });
            return Promise.resolve(null);
        }
        return new Promise((resolve) => {
            let settled = false;
            let timer = null;
            const settle = (value) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                resolve(value);
            };
            const handler = (data) => {
                settle(data);
            };
            this.once(event, handler, () => {
                settle(null);
            });
            if (typeof timeoutMs === 'number' && timeoutMs > 0) {
                timer = setTimeout(() => {
                    timer = null;
                    this.off(event, handler);
                    this.util?.log?.warn?.(`NEvent.waitFor: Délai d'attente expiré (${timeoutMs}ms) pour l'événement "${event}".`, {
                        code: 'WARN_EVENT_TIMEOUT',
                        event,
                        timeoutMs
                    });
                    settle(null);
                }, timeoutMs);
            }
        });
    }

    /**
     * Supprime tous les écouteurs de tous les événements et libère la mémoire (`#listeners = null`).
     *
     * @returns {this} L'instance courante pour permettre le chaînage.
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
        if (this.#onceEntries) {
            const pending = Array.from(this.#onceEntries.values());
            this.#onceEntries.clear();
            this.#onceEntries = null;
            for (const entry of pending) {
                this.#invokeRemoveHandler(entry);
            }
        }
        return this;
    }

    /**
     * Notifie et supprime l'entrée `once` associée à un wrapper retiré.
     * @param {Function} wrapper - Fonction enveloppe enregistrée par `once()`.
     * @private
     */
    #notifyOnceRemoved(wrapper) {
        if (!this.#onceEntries || !this.#onceEntries.has(wrapper)) {
            return;
        }
        const entry = this.#onceEntries.get(wrapper);
        this.#onceEntries.delete(wrapper);
        if (this.#onceEntries.size === 0) {
            this.#onceEntries = null;
        }
        this.#invokeRemoveHandler(entry);
    }

    /**
     * Exécute en toute sécurité le callback `handlerRemove` d'une entrée `once`.
     * @param {{ event: string, callback: Function, handlerRemove: Function|null }} entry - Métadonnées `once`.
     * @private
     */
    #invokeRemoveHandler(entry) {
        if (!entry || typeof entry.handlerRemove !== 'function') {
            return;
        }
        try {
            entry.handlerRemove.call(this.#target ?? this, {
                event: entry.event,
                callback: entry.callback,
                target: this.#target ?? this
            });
        } catch (error) {
            this.util?.log?.error?.(`NEvent: Erreur dans handlerRemove pour "${entry.event}".`, {
                code: 'ERR_EVENT_ONCE_REMOVE_HANDLER',
                event: entry.event,
                error,
                stack: error?.stack,
                target: this.#target ?? this
            });
        }
    }

    // =========================================================================
    // Méthodes statiques
    // =========================================================================

    /**
     * Méthode de fabrique (Factory) permettant d'instancier `NEvent` sans utiliser `new`.
     *
     * @param {any} [target=null] - Objet cible optionnel rattaché à l'instance.
     * @returns {NEvent} Nouvelle instance créée.
     *
     * @example <caption>Exemple 1 : Création autonome via NEvent.create()</caption>
     * const bus = NEvent.create();
     * bus.emit('initialise');
     *
     * @example <caption>Exemple 2 : Création avec contexte cible rattaché</caption>
     * const ctx = { nom: 'ModulePrincipal' };
     * const bus = NEvent.create(ctx);
     * console.log(bus.target.nom); // 'ModulePrincipal'
     */
    static create(target = null) {
        return new NEvent(target);
    }

    /**
     * Enregistre la façade utilitaire `NUtil` auprès de `NEvent` pour permettre l'accès
     * via `evt.util` et la journalisation via `NUtil.log` sans import circulaire.
     *
     * @param {any} util - Classe ou façade `NUtil` à associer.
     * @returns {typeof NEvent} La classe `NEvent` pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Enregistrer NUtil auprès de NEvent</caption>
     * NEvent.registerUtil(NUtil);
     * const bus = new NEvent();
     * console.log(bus.util === NUtil); // true
     *
     * @example <caption>Exemple 2 : Utiliser evt.util après enregistrement</caption>
     * NEvent.registerUtil(NUtil);
     * const bus = new NEvent();
     * bus.util.log.info('Bus prêt');
     */
    static registerUtil(util) {
        if (util) {
            NEvent.#util = util;
        }
        return NEvent;
    }
}

export default NEvent;
