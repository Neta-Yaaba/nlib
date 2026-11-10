/**
 * @file NException.js
 * @package @nlib/js-backend
 * @description Classe autonome de gestion des exceptions et erreurs structurées de l'écosystème NLib.
 * Hérite de la classe native `Error` de JavaScript (et non de `NObject`) afin de :
 * - garantir une empreinte mémoire minimale,
 * - éviter toute dépendance circulaire avec `NObject`,
 * - et permettre à `NObject` ainsi qu'à toutes les classes de NLib de l'utiliser directement.
 */

/**
 * @class NException
 * @extends Error
 * @description Représente une exception normalisée dans NLib avec message, code d'erreur (`#code`),
 * cause d'origine (`cause`), trace d'appel (`stack`) et sérialisation JSON (`toJSON`).
 *
 * @example <caption>Exemple 1 : Création et lancement d'une exception avec un code</caption>
 * try {
 *     throw new NException('Connexion SQL impossible', { code: 'ERR_SQL_CONNECT' });
 * } catch (err) {
 *     console.log(err instanceof Error);      // true
 *     console.log(err instanceof NException); // true
 *     console.log(err.toString());            // '[NException (ERR_SQL_CONNECT)] Connexion SQL impossible'
 * }
 *
 * @example <caption>Exemple 2 : Conversion d'une erreur native via NException.fromError()</caption>
 * try {
 *     JSON.parse('{ json_invalide }');
 * } catch (err) {
 *     const exception = NException.fromError(err, 'ERR_JSON_PARSE');
 *     console.log(exception.code);    // 'ERR_JSON_PARSE'
 *     console.log(exception.message); // Message d'erreur du parseur JSON
 * }
 *
 * @example <caption>Exemple 3 : Déclenchement fluide avec .throw() et sérialisation JSON</caption>
 * const exception = NException.create('Accès refusé', { code: 403 });
 * console.log(JSON.stringify(exception));
 * // exception.throw();
 */
export class NException extends Error {

    // =========================================================================
    // Propriétés privées (Variables internes)
    // =========================================================================

    /**
     * Code d'identification de l'exception (ex: `'ERR_INIT'`, `'ERR_SQL'`, `404`, `500`).
     * Reste à `null` tant qu'aucun code n'est fourni (économie de mémoire).
     * @type {string|number|null}
     * @private
     */
    #code = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NException`.
     * Accepte soit `(message, options)` soit directement un objet `(options)`.
     *
     * @param {string|Object} [messageOrOptions=''] - Message de l'erreur ou objet d'options `{ message, code, cause }`.
     * @param {Object} [options={}] - Options complémentaires lorsque le premier argument est une chaîne.
     * @param {string} [options.message] - Message de l'exception (si le 1er argument est un objet).
     * @param {string|number|null} [options.code=null] - Code d'erreur (ex: `'ERR_VALIDATE'`, `500`).
     * @param {Error|NException|any} [options.cause] - Erreur parente ayant provoqué l'exception.
     *
     * @example <caption>Exemple 1 : Instanciation classique avec message et code</caption>
     * const ex = new NException('Fichier introuvable', { code: 'ENOENT' });
     * console.log(ex.message); // 'Fichier introuvable'
     * console.log(ex.code);    // 'ENOENT'
     *
     * @example <caption>Exemple 2 : Instanciation avec un seul objet d'options</caption>
     * const ex = new NException({
     *     message: 'Paramètre invalide',
     *     code: 400
     * });
     * console.log(ex.hasCode()); // true
     *
     * @example <caption>Exemple 3 : Instanciation avec une cause d'origine (chaînage d'erreurs)</caption>
     * const causeInitiale = new Error('Disque plein');
     * const ex = new NException('Échec de la sauvegarde', {
     *     code: 'ERR_SAVE',
     *     cause: causeInitiale
     * });
     * console.log(ex.hasCause()); // true
     */
    constructor(messageOrOptions = '', options = {}) {
        const isObj = typeof messageOrOptions === 'object' && messageOrOptions !== null;
        const resolvedOptions = isObj ? messageOrOptions : options;
        const resolvedMessage = isObj
            ? String(resolvedOptions.message ?? '')
            : String(messageOrOptions ?? '');

        const hasCauseOption = resolvedOptions.cause !== undefined && resolvedOptions.cause !== null;
        super(resolvedMessage, hasCauseOption ? { cause: resolvedOptions.cause } : undefined);

        this.name = this.constructor.name;

        if (resolvedOptions.code !== undefined && resolvedOptions.code !== null) {
            this.#code = resolvedOptions.code;
        }

        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    // =========================================================================
    // Getters (Accesseurs en lecture)
    // =========================================================================

    /**
     * Retourne le nom exact de la classe de l'exception (ex: `"NException"` ou le nom d'une sous-classe).
     *
     * @returns {string} Nom de la classe.
     *
     * @example <caption>Exemple 1 : Sur une instance directe de NException</caption>
     * const ex = new NException('Erreur');
     * console.log(ex.className); // 'NException'
     *
     * @example <caption>Exemple 2 : Sur une sous-classe spécialisée</caption>
     * class NSqlException extends NException {}
     * const sqlEx = new NSqlException('Requête invalide');
     * console.log(sqlEx.className); // 'NSqlException'
     */
    get className() {
        return this.constructor.name;
    }

    /**
     * Retourne le code de l'exception (ou `null` s'il n'est pas défini).
     *
     * @returns {string|number|null} Code de l'exception.
     *
     * @example <caption>Exemple 1 : Lecture d'un code texte</caption>
     * const ex = new NException('Erreur réseau', { code: 'NET_ERR' });
     * console.log(ex.code); // 'NET_ERR'
     *
     * @example <caption>Exemple 2 : Lecture d'un code numérique</caption>
     * const ex = new NException('Non trouvé', { code: 404 });
     * console.log(ex.code); // 404
     */
    get code() {
        return this.#code;
    }

    // =========================================================================
    // Setters (Accesseurs en écriture)
    // =========================================================================

    /**
     * Modifie le code d'identification de l'exception.
     *
     * @param {string|number|null} value - Nouveau code d'erreur ou `null`.
     *
     * @example <caption>Exemple 1 : Attribuer un code après l'instanciation</caption>
     * const ex = new NException('Accès interdit');
     * ex.code = 'AUTH_FORBIDDEN';
     * console.log(ex.code); // 'AUTH_FORBIDDEN'
     *
     * @example <caption>Exemple 2 : Réinitialiser le code à null</caption>
     * const ex = new NException('Erreur', { code: 500 });
     * ex.code = null;
     * console.log(ex.hasCode()); // false
     */
    set code(value) {
        this.#code = value ?? null;
    }

    // =========================================================================
    // Méthodes publiques — Vérifications & Actions
    // =========================================================================

    /**
     * Vérifie si un code d'erreur est défini sur cette exception (`#code !== null`).
     *
     * @returns {boolean} `true` si un code est présent, sinon `false`.
     *
     * @example <caption>Exemple 1 : Exception avec un code défini</caption>
     * const ex = new NException('Erreur', { code: 'ERR_VALID' });
     * console.log(ex.hasCode()); // true
     *
     * @example <caption>Exemple 2 : Exception sans code</caption>
     * const ex = new NException('Erreur générique');
     * console.log(ex.hasCode()); // false
     */
    hasCode() {
        return this.#code !== null && this.#code !== undefined;
    }

    /**
     * Vérifie si une cause d'origine (`cause`) est attachée à cette exception.
     *
     * @returns {boolean} `true` si une cause est présente, sinon `false`.
     *
     * @example <caption>Exemple 1 : Exception possédant une cause</caption>
     * const ex = new NException('Échec', { cause: new Error('Source') });
     * console.log(ex.hasCause()); // true
     *
     * @example <caption>Exemple 2 : Exception sans cause</caption>
     * const ex = new NException('Échec direct');
     * console.log(ex.hasCause()); // false
     */
    hasCause() {
        return this.cause !== null && this.cause !== undefined;
    }

    /**
     * Lance (`throw`) immédiatement cette instance de `NException`.
     * Permet d'écrire `new NException('...').throw()` directement dans une expression.
     *
     * @throws {NException} Lance toujours l'instance courante (`this`).
     * @returns {never} Ne retourne jamais.
     *
     * @example <caption>Exemple 1 : Lancer directement l'exception</caption>
     * try {
     *     new NException('Action interdite', { code: 403 }).throw();
     * } catch (e) {
     *     console.log(e.code); // 403
     * }
     *
     * @example <caption>Exemple 2 : Utilisation dans une expression logique courte</caption>
     * const estValide = false;
     * try {
     *     estValide || NException.create('Validation échouée', { code: 'ERR_VALID' }).throw();
     * } catch (e) {
     *     console.log(e.message); // 'Validation échouée'
     * }
     */
    throw() {
        throw this;
    }

    // =========================================================================
    // Méthodes publiques — Sérialisation & Utilitaires
    // =========================================================================

    /**
     * Sérialise l'exception en un objet JavaScript pur compatible avec `JSON.stringify()`.
     * (Par défaut en JavaScript, `JSON.stringify(new Error())` retourne `{}` car `message` et `stack`
     * ne sont pas énumérables : `toJSON()` résout ce problème).
     *
     * @returns {{ className: string, message: string, code: string|number|null, cause: any, stack: string|null }}
     *
     * @example <caption>Exemple 1 : Obtenir l'objet JSON de l'exception</caption>
     * const ex = new NException('Introuvable', { code: 404 });
     * console.log(ex.toJSON());
     *
     * @example <caption>Exemple 2 : Sérialiser en chaîne JSON avec JSON.stringify()</caption>
     * const ex = new NException('Erreur SQL', { code: 'SQL_01' });
     * console.log(JSON.stringify(ex));
     */
    toJSON() {
        return {
            className: this.className,
            message: this.message,
            code: this.#code,
            cause: this.cause instanceof NException
                ? this.cause.toJSON()
                : (this.cause instanceof Error ? this.cause.message : (this.cause ?? null)),
            stack: this.stack ?? null
        };
    }

    /**
     * Restaure les propriétés de l'exception à partir d'un objet désérialisé.
     *
     * @param {Object} [data={}] - Données issues de `toJSON()`.
     * @param {string} [data.message] - Message à restaurer.
     * @param {string|number|null} [data.code] - Code à restaurer.
     * @param {any} [data.cause] - Cause à restaurer.
     * @returns {this} L'instance courante pour permettre le chaînage.
     *
     * @example <caption>Exemple 1 : Restaurer une exception depuis un objet</caption>
     * const ex = new NException().fromJSON({ message: 'Restaurée', code: 'RESTORED_01' });
     * console.log(ex.message); // 'Restaurée'
     * console.log(ex.code);    // 'RESTORED_01'
     *
     * @example <caption>Exemple 2 : Sauvegarder et restaurer via JSON.stringify / JSON.parse</caption>
     * const source = new NException('Erreur réseau', { code: 503 });
     * const copie = new NException().fromJSON(JSON.parse(JSON.stringify(source)));
     * console.log(copie.code); // 503
     */
    fromJSON(data = {}) {
        if (data.message !== undefined) this.message = String(data.message ?? '');
        if (data.code !== undefined) this.#code = data.code ?? null;
        if (data.cause !== undefined) this.cause = data.cause;
        return this;
    }

    /**
     * Crée et retourne une copie indépendante de cette `NException`.
     *
     * @returns {NException} Nouvelle instance clonée.
     *
     * @example <caption>Exemple 1 : Cloner une exception et modifier le code du clone</caption>
     * const ex1 = new NException('Erreur A', { code: 100 });
     * const ex2 = ex1.clone();
     * ex2.code = 200;
     * console.log(ex1.code); // 100
     *
     * @example <caption>Exemple 2 : Cloner une sous-classe d'exception</caption>
     * class NAuthException extends NException {}
     * const auth1 = new NAuthException('Session expirée', { code: 401 });
     * const auth2 = auth1.clone();
     * console.log(auth2 instanceof NAuthException); // true
     */
    clone() {
        const Cls = this.constructor;
        return new Cls(this.message, {
            code: this.#code,
            cause: this.cause
        });
    }

    /**
     * Retourne une représentation textuelle formatée de l'exception.
     *
     * @override
     * @returns {string} Chaîne formatée (ex: `"[NException (CODE)] Message"`).
     *
     * @example <caption>Exemple 1 : Formatage avec un code et un message</caption>
     * const ex = new NException('Accès refusé', { code: 403 });
     * console.log(ex.toString()); // '[NException (403)] Accès refusé'
     *
     * @example <caption>Exemple 2 : Formatage sans code</caption>
     * const ex = new NException('Erreur inattendue');
     * console.log(ex.toString()); // '[NException] Erreur inattendue'
     */
    toString() {
        const header = this.hasCode()
            ? `[${this.className} (${this.#code})]`
            : `[${this.className}]`;
        return this.message ? `${header} ${this.message}` : header;
    }

    // =========================================================================
    // Méthodes statiques
    // =========================================================================

    /**
     * Méthode de fabrique (Factory) permettant d'instancier `NException` (ou une sous-classe) sans utiliser `new`.
     *
     * @param {string|Object} [messageOrOptions=''] - Message de l'erreur ou objet d'options.
     * @param {Object} [options={}] - Options complémentaires (`{ code, cause }`).
     * @returns {NException} Nouvelle instance créée.
     *
     * @example <caption>Exemple 1 : Création directe via NException.create()</caption>
     * const ex = NException.create('Paramètre manquant', { code: 'ERR_PARAM' });
     * console.log(ex.code); // 'ERR_PARAM'
     *
     * @example <caption>Exemple 2 : Création depuis une sous-classe d'exception</caption>
     * class NDatabaseException extends NException {}
     * const dbEx = NDatabaseException.create('Table inexistante', { code: 'ERR_TABLE' });
     * console.log(dbEx instanceof NDatabaseException); // true
     */
    static create(messageOrOptions = '', options = {}) {
        return new this(messageOrOptions, options);
    }

    /**
     * Vérifie si une valeur quelconque est une instance de `NException` (ou d'une sous-classe).
     *
     * @param {any} value - Valeur à tester.
     * @returns {boolean} `true` si `value` est une `NException`, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tester une instance de NException</caption>
     * const ex = new NException('Test');
     * console.log(NException.isNException(ex)); // true
     *
     * @example <caption>Exemple 2 : Différencier d'une Error native ordinaire</caption>
     * console.log(NException.isNException(new Error('Test'))); // false
     * console.log(NException.isNException(null));              // false
     */
    static isNException(value) {
        return value instanceof NException;
    }

    /**
     * Convertit n'importe quelle erreur (`Error` native, chaîne ou objet) en `NException`.
     * Si l'argument est déjà une `NException`, la retourne directement.
     *
     * @param {Error|NException|string|any} error - Erreur source à convertir.
     * @param {string|number|null} [code=null] - Code d'erreur optionnel à associer.
     * @returns {NException} Instance de `NException`.
     *
     * @example <caption>Exemple 1 : Convertir une Error native dans un bloc catch</caption>
     * try {
     *     throw new TypeError('Type incorrect');
     * } catch (err) {
     *     const nEx = NException.fromError(err, 'TYPE_ERR');
     *     console.log(nEx.code);    // 'TYPE_ERR'
     *     console.log(nEx.message); // 'Type incorrect'
     * }
     *
     * @example <caption>Exemple 2 : Convertir une simple chaîne de caractères</caption>
     * const nEx = NException.fromError('Service indisponible', 503);
     * console.log(nEx.toString()); // '[NException (503)] Service indisponible'
     */
    static fromError(error, code = null) {
        if (error instanceof NException) {
            if (code !== null && !error.hasCode()) {
                error.code = code;
            }
            return error;
        }
        if (error instanceof Error) {
            return new this(error.message, {
                code: code ?? error.code ?? null,
                cause: error
            });
        }
        return new this(String(error ?? ''), { code });
    }
}

export default NException;
