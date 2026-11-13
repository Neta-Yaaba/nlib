/**
 * @file NLog.js
 * @package @nlib/js-backend
 * @description Classe universelle de journalisation (Logging) pour l'écosystème NLib.
 *
 * Conçue selon la philosophie **« Zero Throw / Zero Reject »** :
 * - Tous les logs (debug, info, warn, error) sont systématiquement enregistrés dans un tampon en mémoire.
 * - L'affichage sur la console peut être activé à tout moment via `consoleEnabled`.
 * - Intégration native de `NEvent` avec initialisation paresseuse via `this.event` pour écouter les événements du logger.
 * - Méthodes complètes d'exportation (`export`) et d'importation (`import`) permettant à l'utilisateur de
 *   sauvegarder les données où il le souhaite (localStorage, base SQLite, IndexedDB) ou de les expédier vers son serveur.
 * - Remplacement propre des lancers d'exceptions (`throw`) grâce à `error()` et `captureException()`.
 */

import { NEvent } from '../core/NEvent.js';

/**
 * @class NLog
 * @description Gestionnaire d'enregistrement, de capture d'erreurs, d'événements et de consultation de journaux.
 *
 * @example <caption>Exemple 1 : Utilisation basique avec affichage console</caption>
 * const logger = new NLog({ consoleEnabled: true });
 * logger.info('Système prêt', { version: '1.0.0' });
 * logger.warn('Latence réseau élevée', { pingMs: 350 });
 * logger.error('Échec de lecture', { fichier: 'user.json' });
 *
 * @example <caption>Exemple 2 : Écoute des événements via logger.event</caption>
 * const logger = new NLog();
 * logger.event.on('log:error', (entry) => {
 *     console.error('Alerte critique :', entry.message);
 * });
 * logger.event.on('clear', () => {
 *     console.log('Tampon de logs réinitialisé');
 * });
 * logger.error('Erreur SQL');
 * logger.clear();
 *
 * @example <caption>Exemple 3 : Exportation et réimportation des journaux</caption>
 * const loggerA = new NLog();
 * loggerA.info('Étape 1 validée');
 * loggerA.info('Étape 2 validée');
 *
 * // Sérialisation pour stockage ou transmission
 * const dump = loggerA.export('json');
 *
 * // Restauration dans une autre instance
 * const loggerB = new NLog();
 * loggerB.import(dump);
 * console.log(loggerB.getLogs().length); // 2
 */
export class NLog {

    // =========================================================================
    // Constantes statiques (Niveaux de sévérité)
    // =========================================================================

    /**
     * Niveaux de sévérité des logs avec priorités numériques associées.
     * @readonly
     * @enum {number}
     *
     * @example <caption>Exemple 1 : Accéder aux constantes de niveau</caption>
     * console.log(NLog.LEVEL.DEBUG); // 0
     * console.log(NLog.LEVEL.ERROR); // 3
     *
     * @example <caption>Exemple 2 : Écrire un log en spécifiant directement le niveau statique</caption>
     * const logger = new NLog();
     * logger.write(NLog.LEVEL.WARN, 'Avertissement spécifique');
     */
    static LEVEL = Object.freeze({
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 99
    });

    /**
     * Dictionnaire interne de normalisation des noms de niveaux vers leur code numérique.
     * @type {Record<string, number>}
     * @private
     */
    static #LEVEL_NAMES = Object.freeze({
        debug: 0,
        info: 1,
        warn: 2,
        warning: 2,
        error: 3,
        none: 99
    });

    // =========================================================================
    // Propriétés privées d'instance
    // =========================================================================

    /**
     * Instance interne de `NEvent` gérant les événements de ce logger.
     * Reste à `null` et n'est instanciée que lors du premier appel à `this.event` (Lazy Initialization).
     * @type {NEvent|null}
     * @private
     */
    #event = null;

    /**
     * Indique si l'affichage sur la console JavaScript est actif.
     * @type {boolean}
     * @private
     */
    #consoleEnabled = false;

    /**
     * Indique si la capture et l'affichage des traces (stack trace) sont actifs.
     * @type {boolean}
     * @private
     */
    #traceEnabled = true;

    /**
     * Nombre maximum d'entrées conservées dans le tampon mémoire.
     * @type {number}
     * @private
     */
    #maxLogs = 1000;

    /**
     * Tampon circulaire contenant toutes les entrées enregistrées.
     * @type {Array<Object>}
     * @private
     */
    #buffer = [];

    /**
     * Contexte global par défaut associé à chaque entrée de log.
     * @type {string|Object|null}
     * @private
     */
    #context = null;

    /**
     * Compteur séquentiel d'identifiant unique local pour chaque log.
     * @type {number}
     * @private
     */
    #sequenceId = 0;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NLog`.
     *
     * @param {Object} [options={}] - Options d'initialisation du logger.
     * @param {boolean} [options.consoleEnabled=false] - Active immédiatement la sortie console.
     * @param {boolean} [options.traceEnabled=true] - Active la capture et l'affichage des traces d'appel (activé par défaut).
     * @param {number} [options.maxLogs=1000] - Capacité maximale du tampon en mémoire.
     * @param {string|Object|null} [options.context=null] - Contexte ou tag par défaut appliqué à chaque log.
     *
     * @example <caption>Exemple 1 : Instanciation minimale par défaut avec traces actives</caption>
     * const logger = new NLog();
     * logger.info('Message avec trace capturée');
     * console.log(logger.getLogs()[0].caller); // Emplacement de l'appelant
     *
     * @example <caption>Exemple 2 : Instanciation avec affichage console et traces</caption>
     * const logger = new NLog({
     *     consoleEnabled: true,
     *     traceEnabled: true,
     *     context: 'BaseDeDonnees',
     *     maxLogs: 500
     * });
     * logger.info('Connexion établie à SQLite');
     */
    constructor(options = {}) {
        if (options && typeof options === 'object') {
            if (typeof options.consoleEnabled === 'boolean') {
                this.setConsoleEnabled(options.consoleEnabled);
            }
            if (typeof options.traceEnabled === 'boolean') {
                this.#traceEnabled = options.traceEnabled;
            }
            if (typeof options.maxLogs === 'number' && options.maxLogs > 0) {
                this.#maxLogs = Math.floor(options.maxLogs);
            }
            if (options.context !== undefined) {
                this.#context = options.context;
            }
        }
    }

    // =========================================================================
    // Getters & Setters de configuration & Événements
    // =========================================================================

    /**
     * Retourne le gestionnaire d'événements `NEvent` associé à ce logger.
     * La variable privée `#event` est initialisée uniquement lors du premier appel (économie de mémoire).
     *
     * Événements émis :
     * - `'log'` : émis à chaque écriture de log avec `{ entry, target }`.
     * - `'log:debug'`, `'log:info'`, `'log:warn'`, `'log:error'` : émis selon la sévérité du log avec `{ entry, target }`.
     * - `'maxLogs'` : émis lorsque le tampon atteint ou dépasse la capacité maximale `maxLogs` avec `{ maxLogs, total, dropped, target }`.
     * - `'exception'` : émis lors d'une capture d'exception via `captureException()` avec `{ error, entry, target }`.
     * - `'clear'` : émis lors du vidage complet du tampon mémoire avec `{ target }`.
     * - `'import'` : émis lors d'une importation de logs avec `{ count, target }`.
     * - `'beforeDestroy'` : émis juste avant la destruction du logger avec `{ target }`.
     *
     * @returns {NEvent} Instance du gestionnaire d'événements.
     *
     * @example <caption>Exemple 1 : Écouter l'événement maxLogs pour archiver et vider le tampon</caption>
     * const logger = new NLog({ maxLogs: 500 });
     * logger.event.on('maxLogs', ({ maxLogs, target }) => {
     *     console.log(`Capacité maximale atteinte (${maxLogs}) : sauvegarde automatique`);
     *     const dump = target.export('json');
     *     target.clear();
     * });
     *
     * @example <caption>Exemple 2 : Écouter spécifiquement les avertissements ou erreurs</caption>
     * const logger = new NLog();
     * logger.event.on('log:warn', (entry) => {
     *     console.warn(`Attention requise : ${entry.message}`);
     * });
     * logger.warn('Charge CPU élevée');
     */
    get event() {
        if (!this.#event) {
            this.#event = new NEvent(this);
        }
        return this.#event;
    }

    /**
     * Active ou désactive l'affichage sur la console.
     *
     * @param {boolean} [enabled=true] - `true` pour activer l'affichage console, `false` pour le couper.
     * @returns {this} L'instance courante pour permettre le chaînage fluide.
     *
     * @example <caption>Exemple 1 : Activer la console dynamiquement</caption>
     * const logger = new NLog();
     * logger.setConsoleEnabled(true);
     * logger.info('Ce log apparaît maintenant sur la console');
     *
     * @example <caption>Exemple 2 : Désactiver la console pour le mode silencieux</caption>
     * const logger = new NLog({ consoleEnabled: true });
     * logger.setConsoleEnabled(false);
     * logger.warn('Ce log est enregistré en mémoire mais pas affiché');
     */
    setConsoleEnabled(enabled = true) {
        this.#consoleEnabled = Boolean(enabled);
        return this;
    }

    /**
     * Indique si l'affichage dans la console est actuellement activé.
     *
     * @returns {boolean} `true` si les logs sont affichés sur la console, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérification de l'état de la console</caption>
     * const logger = new NLog({ consoleEnabled: true });
     * console.log(logger.isConsoleEnabled); // true
     *
     * @example <caption>Exemple 2 : Conditionner un affichage personnalisé selon l'état</caption>
     * const logger = new NLog();
     * if (!logger.isConsoleEnabled) {
     *     logger.setConsoleEnabled(true);
     * }
     */
    get isConsoleEnabled() {
        return this.#consoleEnabled;
    }

    /**
     * Active ou désactive la capture et l'affichage des traces d'appel sur la console.
     *
     * @param {boolean} [enabled=true] - `true` pour capturer et afficher les traces, `false` pour couper.
     * @returns {this} L'instance courante pour permettre le chaînage fluide.
     *
     * @example <caption>Exemple 1 : Désactiver temporairement les traces</caption>
     * const logger = new NLog();
     * logger.setTraceEnabled(false);
     * logger.info('Log concis sans trace');
     *
     * @example <caption>Exemple 2 : Réactiver les traces d'appel</caption>
     * const logger = new NLog({ traceEnabled: false });
     * logger.setTraceEnabled(true);
     * logger.warn('Avertissement avec trace d\'appel');
     */
    setTraceEnabled(enabled = true) {
        this.#traceEnabled = Boolean(enabled);
        return this;
    }

    /**
     * Indique si la capture et l'affichage des traces d'appel sont actuellement activés.
     *
     * @returns {boolean} `true` si les traces sont activées, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérification de l'état des traces</caption>
     * const logger = new NLog();
     * console.log(logger.isTraceEnabled); // true
     *
     * @example <caption>Exemple 2 : Conditionner un affichage selon l'état des traces</caption>
     * const logger = new NLog();
     * if (logger.isTraceEnabled) {
     *     console.log('Capture de trace active');
     * }
     */
    get isTraceEnabled() {
        return this.#traceEnabled;
    }

    /**
     * Modifie le nombre maximal de logs conservés dans le tampon mémoire.
     * Si la nouvelle limite est inférieure à la taille actuelle, les logs les plus anciens sont tronqués.
     *
     * @param {number} max - Nouvelle capacité maximale (doit être un entier supérieur à zéro).
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Augmenter la capacité du tampon</caption>
     * const logger = new NLog();
     * logger.setMaxLogs(5000);
     * console.log(logger.maxLogs); // 5000
     *
     * @example <caption>Exemple 2 : Réduire la taille du tampon avec tronquage automatique</caption>
     * const logger = new NLog({ maxLogs: 100 });
     * for (let i = 0; i < 50; i++) logger.info(`Log ${i}`);
     * logger.setMaxLogs(20);
     * console.log(logger.getLogs().length); // 20
     */
    setMaxLogs(max) {
        if (typeof max === 'number' && max > 0) {
            this.#maxLogs = Math.floor(max);
            let dropped = null;
            if (this.#buffer.length > this.#maxLogs) {
                dropped = this.#buffer.splice(0, this.#buffer.length - this.#maxLogs);
            }
            if (this.#buffer.length >= this.#maxLogs && this.#event) {
                this.#event.emit('maxLogs', {
                    maxLogs: this.#maxLogs,
                    total: this.#buffer.length,
                    dropped,
                    target: this
                });
            }
        }
        return this;
    }

    /**
     * Retourne la capacité maximale actuelle du tampon de logs.
     *
     * @returns {number} Nombre maximum d'entrées conservées.
     *
     * @example <caption>Exemple 1 : Consulter la limite par défaut</caption>
     * const logger = new NLog();
     * console.log(logger.maxLogs); // 1000
     *
     * @example <caption>Exemple 2 : Consulter une limite personnalisée</caption>
     * const logger = new NLog({ maxLogs: 250 });
     * console.log(logger.maxLogs); // 250
     */
    get maxLogs() {
        return this.#maxLogs;
    }

    /**
     * Définit le contexte par défaut associé à chaque log.
     *
     * @param {string|Object|null} context - Tag textuel (ex: `'Auth'`) ou objet de métadonnées.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Définir un tag textuel de service</caption>
     * const logger = new NLog();
     * logger.setContext('ServicePaiement');
     * logger.info('Transaction créée'); // L'entrée aura context: 'ServicePaiement'
     *
     * @example <caption>Exemple 2 : Définir un objet contextuel complexe</caption>
     * const logger = new NLog();
     * logger.setContext({ module: 'Reseau', ip: '192.168.1.1' });
     * logger.warn('Paquet retardé');
     */
    setContext(context) {
        this.#context = context;
        return this;
    }

    /**
     * Retourne le contexte global par défaut actuellement configuré.
     *
     * @returns {string|Object|null} Le contexte actif ou `null`.
     *
     * @example <caption>Exemple 1 : Vérifier le contexte par défaut</caption>
     * const logger = new NLog({ context: 'Securite' });
     * console.log(logger.context); // 'Securite'
     *
     * @example <caption>Exemple 2 : Vérification sur une instance sans contexte</caption>
     * const logger = new NLog();
     * console.log(logger.context); // null
     */
    get context() {
        return this.#context;
    }

    // =========================================================================
    // Méthodes d'écriture de logs (Zero Throw)
    // =========================================================================

    /**
     * Enregistre un message d'information détaillée de niveau `DEBUG`.
     *
     * @param {string} message - Description textuelle du point de débogage.
     * @param {any} [details=null] - Données, variables d'état ou paramètres associés.
     * @param {string|Object} [context=null] - Tag ou contexte spécifique surchargeant le contexte global.
     * @returns {Object} L'objet entrée de log créé et stocké.
     *
     * @example <caption>Exemple 1 : Débogage simple d'une valeur de variable</caption>
     * const logger = new NLog({ consoleEnabled: true });
     * logger.debug('Valeur reçue du formulaire', { champ: 'email', valeur: 'test@example.com' });
     *
     * @example <caption>Exemple 2 : Débogage avec surcharge ponctuelle du contexte</caption>
     * const logger = new NLog({ context: 'Global' });
     * logger.debug('Requête SQL brute', { sql: 'SELECT * FROM clients' }, 'SQLDriver');
     */
    debug(message, details = null, context = null) {
        return this.write(NLog.LEVEL.DEBUG, message, details, context);
    }

    /**
     * Enregistre un message informatif standard de niveau `INFO`.
     *
     * @param {string} message - Message informatif.
     * @param {any} [details=null] - Données d'accompagnement.
     * @param {string|Object} [context=null] - Contexte spécifique pour cette entrée.
     * @returns {Object} L'objet entrée de log créé et stocké.
     *
     * @example <caption>Exemple 1 : Informer du démarrage d'une opération</caption>
     * const logger = new NLog();
     * logger.info('Initialisation de l application terminée');
     *
     * @example <caption>Exemple 2 : Journaliser un événement métier avec détails</caption>
     * const logger = new NLog({ consoleEnabled: true });
     * logger.info('Utilisateur connecté', { utilisateurId: 42, role: 'admin' }, 'Authentification');
     */
    info(message, details = null, context = null) {
        return this.write(NLog.LEVEL.INFO, message, details, context);
    }

    /**
     * Enregistre un avertissement de niveau `WARN`.
     *
     * @param {string} message - Description de l'avertissement ou de la situation inhabituelle.
     * @param {any} [details=null] - Informations sur l'anomalie détectée.
     * @param {string|Object} [context=null] - Contexte spécifique.
     * @returns {Object} L'objet entrée de log créé et stocké.
     *
     * @example <caption>Exemple 1 : Signaler une ressource presque saturée</caption>
     * const logger = new NLog({ consoleEnabled: true });
     * logger.warn('Espace disque disponible inférieur à 10%', { disponibleMo: 450 });
     *
     * @example <caption>Exemple 2 : Signaler l'utilisation d'une méthode dépréciée</caption>
     * const logger = new NLog();
     * logger.warn('La méthode getAnciennesDonnees() est dépréciée', { alternative: 'getDonnees()' });
     */
    warn(message, details = null, context = null) {
        return this.write(NLog.LEVEL.WARN, message, details, context);
    }

    /**
     * Enregistre une anomalie majeure ou une erreur de niveau `ERROR`.
     * Remplace le lancer d'exception en archivant l'erreur sans interrompre l'application.
     *
     * @param {string} message - Description explicite de l'erreur survenue.
     * @param {Error|Object|any} [errorOrDetails=null] - Instance native d'Error ou données complémentaires.
     * @param {string|Object} [context=null] - Contexte spécifique de l'erreur.
     * @returns {Object} L'objet entrée de log créé et stocké.
     *
     * @example <caption>Exemple 1 : Journaliser une erreur avec un message et des détails</caption>
     * const logger = new NLog({ consoleEnabled: true });
     * logger.error('Échec de la validation du formulaire', { champ: 'motDePasse', erreur: 'Trop court' });
     *
     * @example <caption>Exemple 2 : Passer un objet d'erreur natif avec trace d'appel automatique</caption>
     * const logger = new NLog();
     * const err = new Error('Connexion réseau interrompue');
     * logger.error('Impossible de joindre le serveur distant', err, 'Reseau');
     */
    error(message, errorOrDetails = null, context = null) {
        return this.write(NLog.LEVEL.ERROR, message, errorOrDetails, context);
    }

    /**
     * Capture une exception ou une erreur survenue dans un bloc try/catch,
     * l'enregistre au niveau `ERROR` avec sa stack trace et son code,
     * émet l'événement `'exception'` sur `this.event` si initialisé,
     * et retourne un résultat standardisé `{ success: false, ... }` au lieu de lever une exception.
     *
     * @param {Error|any} error - L'objet exception ou l'erreur interceptée.
     * @param {Object} [additionalContext={}] - Métadonnées contextuelles sur l'opération en cours.
     * @returns {{ success: boolean, message: string, code: any, log: Object }} Objet résultat sécurisé.
     *
     * @example <caption>Exemple 1 : Capture lors d'un parsing JSON erroné</caption>
     * const logger = new NLog({ consoleEnabled: true });
     * try {
     *     JSON.parse('invalide');
     * } catch (err) {
     *     const res = logger.captureException(err, { source: 'fichierConfig' });
     *     console.log(res.success); // false
     *     console.log(res.message); // message de SyntaxError natif
     * }
     *
     * @example <caption>Exemple 2 : Capture d'une erreur personnalisée avec code d'erreur et écoute d'événement</caption>
     * const logger = new NLog();
     * logger.event.on('exception', ({ error }) => {
     *     console.log('Capture effectuée pour code :', error.code);
     * });
     * const customErr = new Error('Accès interdit');
     * customErr.code = 403;
     * const rapport = logger.captureException(customErr, { utilisateur: 'invite' });
     * console.log(rapport.code); // 403
     */
    captureException(error, additionalContext = {}) {
        let message = 'Une erreur est survenue';
        let stack = null;
        let code = null;
        let details = null;

        if (error instanceof Error) {
            message = error.message || error.name || message;
            stack = error.stack || null;
            code = error.code ?? null;
            details = {
                name: error.name,
                cause: error.cause ?? null,
                ...additionalContext
            };
        } else if (typeof error === 'string') {
            message = error;
            details = additionalContext;
        } else if (error && typeof error === 'object') {
            message = error.message || error.msg || message;
            code = error.code ?? null;
            stack = error.stack ?? null;
            details = { ...error, ...additionalContext };
        } else {
            message = String(error ?? message);
            details = additionalContext;
        }

        const entry = this.write(NLog.LEVEL.ERROR, message, details, additionalContext, { stack, code });

        if (this.#event) {
            this.#event.emit('exception', { error, entry, target: this });
        }

        return {
            success: false,
            message,
            code,
            log: entry
        };
    }

    /**
     * Méthode générique d'écriture d'une entrée de log.
     * Ne lève JAMAIS d'erreur. Si la console est active, affiche immédiatement le message.
     * Enregistre systématiquement chaque entrée dans le tampon mémoire et émet les événements correspondants.
     *
     * @param {number|string} level - Niveau de sévérité (ex: `NLog.LEVEL.INFO` ou `'info'`).
     * @param {string} message - Message textuel de l'événement.
     * @param {any} [details=null] - Données associées.
     * @param {string|Object} [context=null] - Tag ou contexte spécifique.
     * @param {Object} [extra={}] - Métadonnées facultatives (stack, code).
     * @returns {Object} L'entrée créée et archivée.
     *
     * @example <caption>Exemple 1 : Écriture d'un log avec niveau numérique statique</caption>
     * const logger = new NLog();
     * const entree = logger.write(NLog.LEVEL.INFO, 'Sauvegarde achevée', { dureeMs: 120 });
     * console.log(entree.level); // 'INFO'
     *
     * @example <caption>Exemple 2 : Écriture d'un log avec écoute d'événement en temps réel</caption>
     * const logger = new NLog();
     * logger.event.on('log', (entree) => console.log('Événement log :', entree.message));
     * logger.write('warn', 'Fichier temporaire non purgé');
     */
    write(level, message, details = null, context = null, extra = {}) {
        try {
            const levelNum = typeof level === 'number'
                ? level
                : (NLog.#LEVEL_NAMES[String(level).toLowerCase()] ?? NLog.LEVEL.INFO);
            const levelLabel = this.#getLevelLabel(levelNum);

            let stack = extra.stack ?? null;
            let code = extra.code ?? null;
            let caller = extra.caller ?? null;
            let payloadDetails = details;

            if (details instanceof Error) {
                stack = stack || details.stack || null;
                code = code || details.code || null;
                payloadDetails = {
                    name: details.name,
                    message: details.message,
                    cause: details.cause ?? null
                };
            }

            // Capture systématique de la trace et de l'appelant pour tous les logs
            if (this.#traceEnabled) {
                const traceInfo = this.#captureTrace(stack);
                if (!stack) {
                    stack = traceInfo.stack;
                }
                if (!caller) {
                    caller = traceInfo.caller;
                }
            }

            const resolvedContext = (context !== null && context !== undefined)
                ? context
                : this.#context;

            this.#sequenceId += 1;

            const entry = {
                id: this.#sequenceId,
                timestamp: new Date().toISOString(),
                level: levelLabel,
                levelNum,
                message: String(message ?? ''),
                context: resolvedContext,
                caller: caller || null,
                details: payloadDetails,
                code: code !== undefined ? code : null,
                stack: stack || null
            };

            // Affichage immédiat sur la console si activé
            if (this.#consoleEnabled) {
                this.#printToConsole(entry);
            }

            // Enregistrement systématique de tous les logs dans le tampon mémoire
            this.#buffer.push(entry);
            const isMaxReached = this.#buffer.length >= this.#maxLogs;
            let dropped = null;

            if (this.#buffer.length > this.#maxLogs) {
                dropped = this.#buffer.splice(0, this.#buffer.length - this.#maxLogs);
            }

            // Déclenchement des événements si le gestionnaire NEvent a été sollicité
            if (this.#event) {
                this.#event.emit('log', entry);
                this.#event.emit(`log:${levelLabel.toLowerCase()}`, entry);

                if (isMaxReached) {
                    this.#event.emit('maxLogs', {
                        maxLogs: this.#maxLogs,
                        total: this.#buffer.length,
                        dropped,
                        target: this
                    });
                }
            }

            return entry;
        } catch {
            return {
                id: 0,
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                levelNum: NLog.LEVEL.ERROR,
                message: String(message ?? ''),
                context: null,
                caller: null,
                details: null,
                code: null,
                stack: null
            };
        }
    }

    // =========================================================================
    // Consultation, Import & Export & Cycle de vie
    // =========================================================================

    /**
     * Retourne la liste des logs du tampon mémoire, avec critères de filtrage optionnels.
     *
     * @param {Object} [filter={}] - Options de filtrage.
     * @param {string|number} [filter.level] - Filtrer par niveau spécifique ('error', 'warn', etc.).
     * @param {string} [filter.context] - Recherche par sous-chaîne dans le contexte.
     * @param {string} [filter.search] - Recherche insensible à la casse dans le message.
     * @param {number} [filter.limit] - Nombre maximal d'entrées retournées (les plus récentes).
     * @returns {Array<Object>} Copie des entrées correspondantes.
     *
     * @example <caption>Exemple 1 : Obtenir tous les logs enregistrés</caption>
     * const logger = new NLog();
     * logger.info('Message 1');
     * logger.warn('Message 2');
     * console.log(logger.getLogs().length); // 2
     *
     * @example <caption>Exemple 2 : Filtrer les erreurs uniquement avec une limite</caption>
     * const logger = new NLog();
     * logger.info('Info 1');
     * logger.error('Erreur SQL');
     * logger.error('Erreur Fichier');
     * const erreurs = logger.getLogs({ level: 'error', limit: 1 });
     * console.log(erreurs.length); // 1
     */
    getLogs(filter = {}) {
        try {
            let result = [...this.#buffer];

            if (filter.level !== undefined) {
                const targetLevel = typeof filter.level === 'number'
                    ? filter.level
                    : (NLog.#LEVEL_NAMES[String(filter.level).toLowerCase()] ?? null);
                if (targetLevel !== null) {
                    result = result.filter(item => item.levelNum === targetLevel);
                }
            }

            if (typeof filter.context === 'string' && filter.context.trim() !== '') {
                const needle = filter.context.trim().toLowerCase();
                result = result.filter(item => {
                    if (typeof item.context === 'string') {
                        return item.context.toLowerCase().includes(needle);
                    }
                    if (item.context && typeof item.context === 'object') {
                        return JSON.stringify(item.context).toLowerCase().includes(needle);
                    }
                    return false;
                });
            }

            if (typeof filter.search === 'string' && filter.search.trim() !== '') {
                const needle = filter.search.trim().toLowerCase();
                result = result.filter(item => item.message.toLowerCase().includes(needle));
            }

            if (typeof filter.limit === 'number' && filter.limit > 0) {
                result = result.slice(-filter.limit);
            }

            return result;
        } catch {
            return [];
        }
    }

    /**
     * Vide intégralement le tampon de logs en mémoire et émet l'événement `'clear'` si des écouteurs sont enregistrés.
     *
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Réinitialiser le tampon après traitement</caption>
     * const logger = new NLog();
     * logger.info('Donnée temporaire');
     * logger.clear();
     * console.log(logger.getLogs().length); // 0
     *
     * @example <caption>Exemple 2 : Chaînage après vidage avec notification d'événement</caption>
     * const logger = new NLog();
     * logger.event.on('clear', () => console.log('Journal effacé'));
     * logger.info('Ancien log');
     * logger.clear().info('Nouveau log post-nettoyage');
     */
    clear() {
        this.#buffer = [];
        if (this.#event) {
            this.#event.emit('clear', { target: this });
        }
        return this;
    }

    /**
     * Exporte les logs enregistrés sous forme sérialisée (`'json'`, `'raw'` ou `'text'`).
     * Permet à l'utilisateur d'obtenir une copie complète des données pour les sauvegarder
     * (dans un fichier, dans `localStorage`, dans IndexedDB ou SQLite) ou les expédier vers son serveur.
     *
     * @param {'json'|'text'|'raw'} [format='json'] - Format souhaité (`'json'` par défaut).
     * @returns {string|Array<Object>} Chaîne sérialisée ou tableau clone selon le format choisi.
     *
     * @example <caption>Exemple 1 : Exportation au format JSON</caption>
     * const logger = new NLog();
     * logger.info('Connexion réussie', { id: 10 });
     * const jsonTexte = logger.export('json');
     * console.log(typeof jsonTexte); // 'string'
     *
     * @example <caption>Exemple 2 : Exportation au format texte brut lisible ou tableau brut</caption>
     * const logger = new NLog();
     * logger.warn('Disque presque saturé');
     * const texteRapport = logger.export('text'); // Lignes formatées
     * const copieTableau = logger.export('raw');  // Array d'objets indépendant
     */
    export(format = 'json') {
        try {
            if (format === 'raw') {
                return typeof structuredClone === 'function'
                    ? structuredClone(this.#buffer)
                    : JSON.parse(JSON.stringify(this.#buffer));
            }
            if (format === 'text') {
                return this.#buffer.map(e => {
                    const ctx = e.context ? ` [${typeof e.context === 'object' ? JSON.stringify(e.context) : e.context}]` : '';
                    const caller = e.caller ? ` [${e.caller}]` : '';
                    const det = e.details ? ` | ${JSON.stringify(e.details)}` : '';
                    const stack = e.stack ? `\n  Trace:\n  ${e.stack.replace(/\n/g, '\n  ')}` : '';
                    return `[${e.timestamp}] [${e.level}]${ctx}${caller} ${e.message}${det}${stack}`;
                }).join('\n');
            }
            return JSON.stringify(this.#buffer, null, 2);
        } catch {
            return format === 'text' ? '' : (format === 'raw' ? [] : '[]');
        }
    }

    /**
     * Importe des logs précédemment exportés dans le tampon en mémoire et émet l'événement `'import'`.
     * Accepte soit une chaîne JSON sérialisée, soit un tableau d'objets logs.
     *
     * @param {string|Array<Object>} data - Données issues d'un appel à `export()`.
     * @param {Object} [options={}] - Options d'importation.
     * @param {boolean} [options.merge=true] - Si `true`, fusionne avec les logs existants ; si `false`, remplace le tampon.
     * @returns {{ success: boolean, count: number }} Résultat sécurisé de l'importation.
     *
     * @example <caption>Exemple 1 : Restaurer des logs depuis une chaîne JSON</caption>
     * const logger = new NLog();
     * const dump = '[{"id":1,"timestamp":"2026-11-13T09:00:00Z","level":"INFO","message":"Test import"}]';
     * const res = logger.import(dump);
     * console.log(res.success); // true
     * console.log(res.count);   // 1
     *
     * @example <caption>Exemple 2 : Écraser le tampon actuel sans fusion (merge: false) avec écoute d'événement</caption>
     * const logger = new NLog();
     * logger.event.on('import', ({ count }) => console.log(`${count} logs importés`));
     * logger.info('Log existant qui sera remplacé');
     * logger.import([{ message: 'Seul log restant', level: 'WARN' }], { merge: false });
     * console.log(logger.getLogs().length); // 1
     */
    import(data, options = {}) {
        try {
            let parsed = data;
            if (typeof data === 'string') {
                parsed = JSON.parse(data);
            }

            if (!Array.isArray(parsed)) {
                return { success: false, count: 0 };
            }

            const merge = options.merge !== false;
            const validEntries = parsed.filter(item => item && typeof item === 'object' && item.message !== undefined);

            if (merge) {
                this.#buffer = [...this.#buffer, ...validEntries];
            } else {
                this.#buffer = [...validEntries];
            }

            const isMaxReached = this.#buffer.length >= this.#maxLogs;
            let dropped = null;

            if (this.#buffer.length > this.#maxLogs) {
                dropped = this.#buffer.splice(0, this.#buffer.length - this.#maxLogs);
            }

            if (this.#event) {
                this.#event.emit('import', { count: validEntries.length, target: this });
                if (isMaxReached) {
                    this.#event.emit('maxLogs', {
                        maxLogs: this.#maxLogs,
                        total: this.#buffer.length,
                        dropped,
                        target: this
                    });
                }
            }

            return {
                success: true,
                count: validEntries.length
            };
        } catch {
            return {
                success: false,
                count: 0
            };
        }
    }

    /**
     * Détruit proprement l'instance, vide le tampon et libère le gestionnaire d'événements.
     * Si `#event` est actif, émet l'événement `'beforeDestroy'` juste avant le nettoyage.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Destruction simple et libération mémoire</caption>
     * const logger = new NLog();
     * logger.info('Données à supprimer');
     * logger.destroy();
     * console.log(logger.getLogs().length); // 0
     *
     * @example <caption>Exemple 2 : Écouter l'événement beforeDestroy pour effectuer une sauvegarde finale</caption>
     * const logger = new NLog();
     * logger.event.on('beforeDestroy', () => {
     *     const dump = logger.export('json');
     *     // Sauvegarde finale...
     * });
     * logger.destroy();
     */
    destroy() {
        if (this.#event) {
            this.#event.emit('beforeDestroy', { target: this });
            this.#event.clear();
            this.#event = null;
        }
        this.#buffer = [];
    }

    // =========================================================================
    // Méthodes privées d'assistance
    // =========================================================================

    /**
     * Affiche une entrée de façon formatée sur la console JavaScript selon sa sévérité.
     *
     * @param {Object} entry - L'objet représentant le log à afficher.
     * @private
     */
    #printToConsole(entry) {
        try {
            const prefix = `[${entry.timestamp}] [${entry.level}]`;
            const ctx = entry.context ? `[${typeof entry.context === 'object' ? JSON.stringify(entry.context) : entry.context}]` : '';
            const callerTag = entry.caller ? `[${entry.caller}]` : '';
            const banner = `${prefix}${ctx}${callerTag ? ' ' + callerTag : ''} ${entry.message}`;

            const args = [banner];
            if (entry.details !== null && entry.details !== undefined) {
                args.push(entry.details);
            }
            if (entry.stack && this.#traceEnabled) {
                args.push(`\nTrace:\n${entry.stack}`);
            }

            switch (entry.levelNum) {
                case NLog.LEVEL.DEBUG:
                    if (typeof console.debug === 'function') {
                        console.debug(...args);
                    } else {
                        console.log(...args);
                    }
                    break;
                case NLog.LEVEL.INFO:
                    if (typeof console.info === 'function') {
                        console.info(...args);
                    } else {
                        console.log(...args);
                    }
                    break;
                case NLog.LEVEL.WARN:
                    if (typeof console.warn === 'function') {
                        console.warn(...args);
                    } else {
                        console.log(...args);
                    }
                    break;
                case NLog.LEVEL.ERROR:
                    if (typeof console.error === 'function') {
                        console.error(...args);
                    } else {
                        console.log(...args);
                    }
                    break;
                default:
                    console.log(...args);
                    break;
            }
        } catch {
            // Silencieux si la console n'est pas accessible
        }
    }

    /**
     * Capture la pile d'exécution actuelle ou analyse une pile existante
     * pour en extraire la trace propre et l'emplacement exact de l'appelant.
     *
     * @param {string} [existingStack=null] - Pile d'exécution brute préexistante (ex: issue d'une Error).
     * @returns {{ stack: string|null, caller: string|null }} Objet contenant la trace propre et l'appelant.
     * @private
     */
    #captureTrace(existingStack = null) {
        try {
            const rawStack = existingStack || (new Error().stack);
            if (!rawStack || typeof rawStack !== 'string') {
                return { stack: null, caller: null };
            }

            const lines = rawStack.split('\n');
            const filteredLines = [];
            let caller = null;

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'Error' || trimmed.startsWith('Error:')) {
                    continue;
                }
                // Si c'est une pile capturée à la volée par NLog, on filtre les méthodes internes de NLog
                if (!existingStack) {
                    if (
                        trimmed.includes('NLog.js') ||
                        trimmed.includes('#captureTrace') ||
                        trimmed.includes('at write ') ||
                        trimmed.includes('.write (') ||
                        trimmed.includes('at debug ') ||
                        trimmed.includes('at info ') ||
                        trimmed.includes('at warn ') ||
                        trimmed.includes('at error ') ||
                        trimmed.includes('at captureException ') ||
                        trimmed.includes('.debug (') ||
                        trimmed.includes('.info (') ||
                        trimmed.includes('.warn (') ||
                        trimmed.includes('.error (') ||
                        trimmed.includes('.captureException (')
                    ) {
                        continue;
                    }
                }

                filteredLines.push(line);

                if (!caller) {
                    // Format V8 (Node, Chrome, Edge) : "at Function (file:line:col)" ou "at file:line:col"
                    const v8Match = trimmed.match(/at\s+(?:([^\s(]+)\s+\()?(?:.*[\\/])?([^\\/\s)]+:\d+(?::\d+)?)\)?/);
                    if (v8Match) {
                        caller = v8Match[1] ? `${v8Match[1]} (${v8Match[2]})` : v8Match[2];
                    } else {
                        // Format Firefox / Safari : "function@file:line:col"
                        const ffMatch = trimmed.match(/^([^@]*)@(?:.*[\\/])?([^\\/:]+:\d+(?::\d+)?)$/);
                        if (ffMatch) {
                            caller = ffMatch[1] ? `${ffMatch[1]} (${ffMatch[2]})` : ffMatch[2];
                        } else {
                            caller = trimmed.replace(/^at\s+/, '');
                        }
                    }
                }
            }

            const cleanStack = filteredLines.length > 0 ? filteredLines.join('\n') : rawStack;
            return {
                stack: cleanStack,
                caller: caller || null
            };
        } catch {
            return { stack: null, caller: null };
        }
    }

    /**
     * Convertit un code de sévérité numérique en chaîne descriptive normalisée.
     *
     * @param {number} num - Code numérique du niveau.
     * @returns {string} Nom du niveau en majuscules (ex: `'INFO'`, `'ERROR'`).
     * @private
     */
    #getLevelLabel(num) {
        switch (num) {
            case NLog.LEVEL.DEBUG: return 'DEBUG';
            case NLog.LEVEL.INFO:  return 'INFO';
            case NLog.LEVEL.WARN:  return 'WARN';
            case NLog.LEVEL.ERROR: return 'ERROR';
            case NLog.LEVEL.NONE:  return 'NONE';
            default:              return 'INFO';
        }
    }

    // =========================================================================
    // Méthode statique de fabrique
    // =========================================================================

    /**
     * Méthode de fabrique standard permettant d'instancier la classe sans utiliser directement le mot-clé `new`.
     *
     * @param {Object} [options={}] - Options de configuration identiques au constructeur.
     * @returns {NLog} Nouvelle instance configurée de `NLog`.
     *
     * @example <caption>Exemple 1 : Création directe via la méthode statique create</caption>
     * const logger = NLog.create({ consoleEnabled: true });
     * logger.info('Logger créé via factory');
     *
     * @example <caption>Exemple 2 : Création avec un contexte et une limite mémoire</caption>
     * const logger = NLog.create({ context: 'WorkerCalcul', maxLogs: 200 });
     * logger.debug('Traitement démarré');
     */
    static create(options = {}) {
        return new this(options);
    }
}

export default NLog;
