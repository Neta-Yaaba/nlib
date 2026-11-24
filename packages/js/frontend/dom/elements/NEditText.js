import { NTag } from './NTag.js';

/**
 * @class NEditText
 * @extends NTag
 * @description Élément natif `<input>` de saisie textuelle (`text`, `email`, `password`, `search`, `tel`, `url`, `.n-edittext`) héritant de `NTag`.
 *
 * @example <caption>Exemple 1 : Champ texte standard</caption>
 * const username = new NEditText({ name: 'username', placeholder: 'Nom d\'utilisateur' });
 *
 * @example <caption>Exemple 2 : Champ mot de passe</caption>
 * const pwd = new NEditText({ type: 'password', minLength: 8, required: true });
 */
export class NEditText extends NTag {

    /**
     * Types HTML textuels pris en charge.
     * @type {Set<string>}
     * @private
     */
    static #TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url']);

    /**
     * Crée une nouvelle instance `NEditText`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration.
     * @param {'text'|'email'|'password'|'search'|'tel'|'url'} [options.type='text'] - Type de saisie textuelle.
     * @param {string} [options.name] - Nom du champ.
     * @param {string} [options.value] - Valeur initiale.
     * @param {string} [options.placeholder] - Texte indicatif.
     * @param {number} [options.minLength] - Longueur minimale.
     * @param {number} [options.maxLength] - Longueur maximale.
     * @param {string} [options.pattern] - Expression régulière de validation.
     * @param {string} [options.autocomplete] - Attribut `autocomplete`.
     * @param {boolean} [options.autofocus=false] - Focus automatique.
     * @param {boolean} [options.disabled=false] - Désactive le champ.
     * @param {boolean} [options.readonly=false] - Passe en lecture seule.
     * @param {boolean} [options.required=false] - Rend le champ obligatoire.
     *
     * @example <caption>Exemple 1 : Champ e-mail</caption>
     * const email = new NEditText({ type: 'email', placeholder: 'nom@domaine.com', required: true });
     *
     * @example <caption>Exemple 2 : Champ de recherche</caption>
     * const search = new NEditText({ type: 'search', placeholder: 'Rechercher...' });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        super({ ...opts, tagName: 'input', text: undefined, html: undefined });

        this.addClass('n-edittext');
        this.setType(opts.type || 'text');

        if (opts.name !== undefined) this.setName(opts.name);
        if (opts.placeholder !== undefined) this.setPlaceholder(opts.placeholder);
        if (opts.minLength !== undefined) this.setMinLength(opts.minLength);
        if (opts.maxLength !== undefined) this.setMaxLength(opts.maxLength);
        if (opts.pattern !== undefined) this.setPattern(opts.pattern);
        if (opts.autocomplete !== undefined) this.setAutocomplete(opts.autocomplete);
        if (opts.autofocus) this.setAttr('autofocus', true);
        if (opts.value !== undefined) this.setValue(opts.value);
        if (opts.disabled !== undefined) this.setDisabled(Boolean(opts.disabled));
        if (opts.readonly !== undefined) this.setReadOnly(Boolean(opts.readonly));
        if (opts.required !== undefined) this.setRequired(Boolean(opts.required));
    }

    /**
     * Type HTML du champ textuel (`text`, `email`, `password`, `search`, `tel`, `url`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le type</caption>
     * console.log(tb.type);
     *
     * @example <caption>Exemple 2 : Basculer un mot de passe en texte</caption>
     * tb.type = 'text';
     */
    get type() {
        return this.element?.type || this.getAttr('type') || 'text';
    }

    set type(value) {
        this.setType(value);
    }

    /**
     * Nom du champ (`name`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le nom</caption>
     * console.log(tb.name);
     *
     * @example <caption>Exemple 2 : Modifier le nom</caption>
     * tb.name = 'email';
     */
    get name() {
        return this.element?.name ?? '';
    }

    set name(value) {
        this.setName(value);
    }

    /**
     * Valeur courante (`value`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * console.log(tb.value);
     *
     * @example <caption>Exemple 2 : Modifier la valeur</caption>
     * tb.value = 'Alice';
     */
    get value() {
        return this.getValue();
    }

    set value(val) {
        this.setValue(val);
    }

    /**
     * Texte indicatif (`placeholder`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le placeholder</caption>
     * console.log(tb.placeholder);
     *
     * @example <caption>Exemple 2 : Modifier le placeholder</caption>
     * tb.placeholder = 'Entrez votre nom';
     */
    get placeholder() {
        return this.element?.placeholder ?? '';
    }

    set placeholder(value) {
        this.setPlaceholder(value);
    }

    /**
     * Définit le type de saisie textuelle (`text`, `email`, `password`, `search`, `tel`, `url`).
     *
     * @param {string} type - Type de saisie.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Passer en mot de passe</caption>
     * tb.setType('password');
     *
     * @example <caption>Exemple 2 : Passer en recherche</caption>
     * tb.setType('search');
     */
    setType(type) {
        const clean = typeof type === 'string' ? type.trim().toLowerCase() : 'text';
        const resolved = NEditText.#TYPES.has(clean) ? clean : 'text';
        return this.setAttr('type', resolved);
    }

    /**
     * Définit ou retire l'attribut `name`.
     *
     * @param {string|null} name - Nom du champ.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir le nom</caption>
     * tb.setName('username');
     *
     * @example <caption>Exemple 2 : Retirer le nom</caption>
     * tb.setName(null);
     */
    setName(name) {
        if (name === null || name === undefined || name === '') {
            return this.removeAttr('name');
        }
        return this.setAttr('name', String(name));
    }

    /**
     * Définit la valeur textuelle du champ.
     *
     * @param {*} value - Valeur à assigner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir une valeur</caption>
     * tb.setValue('Jean');
     *
     * @example <caption>Exemple 2 : Vider avec null</caption>
     * tb.setValue(null);
     */
    setValue(value) {
        if (this.element) {
            this.element.value = value === null || value === undefined ? '' : String(value);
        }
        return this;
    }

    /**
     * Retourne la valeur textuelle du champ.
     *
     * @returns {string} Valeur courante.
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * const val = tb.getValue();
     *
     * @example <caption>Exemple 2 : Vérifier après modification</caption>
     * tb.setValue('test');
     * console.log(tb.getValue()); // 'test'
     */
    getValue() {
        return this.element ? this.element.value : '';
    }

    /**
     * Définit ou retire l'attribut `placeholder`.
     *
     * @param {string|null} placeholder - Texte indicatif.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir le placeholder</caption>
     * tb.setPlaceholder('Votre e-mail');
     *
     * @example <caption>Exemple 2 : Retirer le placeholder</caption>
     * tb.setPlaceholder(null);
     */
    setPlaceholder(placeholder) {
        if (placeholder === null || placeholder === undefined || placeholder === '') {
            return this.removeAttr('placeholder');
        }
        return this.setAttr('placeholder', String(placeholder));
    }

    /**
     * Définit la longueur minimale (`minlength`).
     *
     * @param {number|null} length - Nombre minimal de caractères.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Imposer 6 caractères</caption>
     * tb.setMinLength(6);
     *
     * @example <caption>Exemple 2 : Supprimer la limite</caption>
     * tb.setMinLength(null);
     */
    setMinLength(length) {
        if (length === null || length === undefined) {
            return this.removeAttr('minlength');
        }
        const n = Number(length);
        return Number.isFinite(n) && n >= 0 ? this.setAttr('minlength', String(Math.floor(n))) : this;
    }

    /**
     * Définit la longueur maximale (`maxlength`).
     *
     * @param {number|null} length - Nombre maximal de caractères.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Limiter à 100 caractères</caption>
     * tb.setMaxLength(100);
     *
     * @example <caption>Exemple 2 : Supprimer la limite</caption>
     * tb.setMaxLength(null);
     */
    setMaxLength(length) {
        if (length === null || length === undefined) {
            return this.removeAttr('maxlength');
        }
        const n = Number(length);
        return Number.isFinite(n) && n >= 0 ? this.setAttr('maxlength', String(Math.floor(n))) : this;
    }

    /**
     * Définit ou retire le motif de validation (`pattern`).
     *
     * @param {string|null} pattern - Expression régulière HTML5.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Code postal à 5 chiffres</caption>
     * tb.setPattern('\\d{5}');
     *
     * @example <caption>Exemple 2 : Retirer le motif</caption>
     * tb.setPattern(null);
     */
    setPattern(pattern) {
        if (pattern === null || pattern === undefined || pattern === '') {
            return this.removeAttr('pattern');
        }
        return this.setAttr('pattern', String(pattern));
    }

    /**
     * Définit ou retire l'attribut `autocomplete`.
     *
     * @param {string|null} value - Valeur `autocomplete`.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir autocomplete</caption>
     * tb.setAutocomplete('email');
     *
     * @example <caption>Exemple 2 : Retirer autocomplete</caption>
     * tb.setAutocomplete(null);
     */
    setAutocomplete(value) {
        if (value === null || value === undefined || value === '') {
            return this.removeAttr('autocomplete');
        }
        return this.setAttr('autocomplete', String(value));
    }

    /**
     * Active ou désactive le champ.
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver</caption>
     * tb.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver</caption>
     * tb.setDisabled(false);
     */
    setDisabled(disabled = true) {
        if (this.element) {
            this.element.disabled = Boolean(disabled);
        }
        return disabled ? this.setAttr('disabled', true) : this.removeAttr('disabled');
    }

    /**
     * Indique si le champ est désactivé.
     *
     * @returns {boolean} `true` si désactivé.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(tb.isDisabled());
     *
     * @example <caption>Exemple 2 : Après setDisabled</caption>
     * tb.setDisabled(true);
     * console.log(tb.isDisabled()); // true
     */
    isDisabled() {
        return Boolean(this.element?.disabled || this.hasAttr('disabled'));
    }

    /**
     * Passe le champ en lecture seule ou éditable.
     *
     * @param {boolean} [readonly=true] - `true` pour lecture seule.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Activer la lecture seule</caption>
     * tb.setReadOnly(true);
     *
     * @example <caption>Exemple 2 : Autoriser l'édition</caption>
     * tb.setReadOnly(false);
     */
    setReadOnly(readonly = true) {
        if (this.element) {
            this.element.readOnly = Boolean(readonly);
        }
        return readonly ? this.setAttr('readonly', true) : this.removeAttr('readonly');
    }

    /**
     * Indique si le champ est en lecture seule.
     *
     * @returns {boolean} `true` si en lecture seule.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(tb.isReadOnly());
     *
     * @example <caption>Exemple 2 : Après setReadOnly</caption>
     * tb.setReadOnly(true);
     * console.log(tb.isReadOnly()); // true
     */
    isReadOnly() {
        return Boolean(this.element?.readOnly || this.hasAttr('readonly'));
    }

    /**
     * Définit le caractère obligatoire (`required`).
     *
     * @param {boolean} [required=true] - `true` pour rendre obligatoire.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Rendre obligatoire</caption>
     * tb.setRequired(true);
     *
     * @example <caption>Exemple 2 : Rendre optionnel</caption>
     * tb.setRequired(false);
     */
    setRequired(required = true) {
        return required ? this.setAttr('required', true) : this.removeAttr('required');
    }

    /**
     * Indique si le champ est obligatoire.
     *
     * @returns {boolean} `true` si `required` est présent.
     *
     * @example <caption>Exemple 1 : Vérifier l'obligation</caption>
     * console.log(tb.isRequired());
     *
     * @example <caption>Exemple 2 : Après setRequired</caption>
     * tb.setRequired(true);
     * console.log(tb.isRequired()); // true
     */
    isRequired() {
        return Boolean(this.element?.required || this.hasAttr('required'));
    }

    /**
     * Sélectionne le texte contenu dans le champ.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Sélectionner le texte</caption>
     * tb.select();
     *
     * @example <caption>Exemple 2 : Focus puis sélection</caption>
     * tb.focus().select();
     */
    select() {
        if (this.element && typeof this.element.select === 'function') {
            this.element.select();
        }
        return this;
    }

    /**
     * Vérifie la validité HTML5 du champ.
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Valider un e-mail</caption>
     * console.log(tb.isValid());
     *
     * @example <caption>Exemple 2 : Champ e-mail invalide</caption>
     * tb.setType('email').setValue('invalide');
     * console.log(tb.isValid()); // false
     */
    isValid() {
        return this.element && typeof this.element.checkValidity === 'function'
            ? this.element.checkValidity()
            : true;
    }

    /**
     * Déclenche l'affichage natif du message de validation.
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Reporter la validité</caption>
     * tb.reportValidity();
     *
     * @example <caption>Exemple 2 : Avant soumission</caption>
     * if (!tb.reportValidity()) console.log('Invalide');
     */
    reportValidity() {
        return this.element && typeof this.element.reportValidity === 'function'
            ? this.element.reportValidity()
            : true;
    }

    /**
     * Définit un message de validation personnalisé.
     *
     * @param {string} [message=''] - Message d'erreur ou chaîne vide.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir une erreur</caption>
     * tb.setCustomValidity('Identifiant déjà pris.');
     *
     * @example <caption>Exemple 2 : Effacer l'erreur</caption>
     * tb.setCustomValidity('');
     */
    setCustomValidity(message = '') {
        if (this.element && typeof this.element.setCustomValidity === 'function') {
            this.element.setCustomValidity(message ? String(message) : '');
        }
        return this;
    }

    /**
     * Retourne le message de validation natif courant.
     *
     * @returns {string} Message de validation.
     *
     * @example <caption>Exemple 1 : Lire le message</caption>
     * console.log(tb.getValidationMessage());
     *
     * @example <caption>Exemple 2 : Après erreur personnalisée</caption>
     * tb.setCustomValidity('Invalide');
     * console.log(tb.getValidationMessage()); // 'Invalide'
     */
    getValidationMessage() {
        return this.element?.validationMessage || '';
    }

    /**
     * Vide la valeur du champ.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Vider le champ</caption>
     * tb.clear();
     *
     * @example <caption>Exemple 2 : Vérifier après vidage</caption>
     * tb.clear();
     * console.log(tb.getValue()); // ''
     */
    clear() {
        return this.setValue('');
    }
}

export default NEditText;
