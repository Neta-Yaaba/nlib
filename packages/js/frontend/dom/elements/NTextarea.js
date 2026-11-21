import { NTag } from './NTag.js';

/**
 * @class NTextarea
 * @extends NTag
 * @description Élément natif `<textarea>` (`.n-textarea`) héritant de `NTag`.
 *
 * @example <caption>Exemple 1 : Créer une zone de texte</caption>
 * const bio = new NTextarea({ name: 'bio', placeholder: 'Votre biographie...', rows: 4 });
 *
 * @example <caption>Exemple 2 : Lire et modifier le contenu</caption>
 * const notes = new NTextarea({ value: 'Initial' });
 * notes.setValue('Mis à jour');
 */
export class NTextarea extends NTag {

    /**
     * Crée une nouvelle instance `NTextarea`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration.
     * @param {string} [options.name] - Nom du champ.
     * @param {string} [options.value] - Contenu initial.
     * @param {string} [options.placeholder] - Texte indicatif.
     * @param {number} [options.rows] - Nombre de lignes visibles.
     * @param {number} [options.cols] - Nombre de colonnes visibles.
     * @param {'soft'|'hard'|'off'} [options.wrap] - Mode de retour à la ligne.
     * @param {number} [options.minLength] - Longueur minimale.
     * @param {number} [options.maxLength] - Longueur maximale.
     * @param {string} [options.autocomplete] - Attribut `autocomplete`.
     * @param {boolean} [options.autofocus=false] - Focus automatique.
     * @param {boolean} [options.disabled=false] - Désactive la zone.
     * @param {boolean} [options.readonly=false] - Passe en lecture seule.
     * @param {boolean} [options.required=false] - Rend le champ obligatoire.
     *
     * @example <caption>Exemple 1 : Zone de commentaire</caption>
     * const comment = new NTextarea({ rows: 5, maxLength: 500, required: true });
     *
     * @example <caption>Exemple 2 : Zone en lecture seule</caption>
     * const logView = new NTextarea({ value: 'Logs...', readonly: true });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        super({ ...opts, tagName: 'textarea', text: undefined, html: undefined });

        this.addClass('n-textarea');

        if (opts.name !== undefined) this.setName(opts.name);
        if (opts.placeholder !== undefined) this.setPlaceholder(opts.placeholder);
        if (opts.rows !== undefined) this.setRows(opts.rows);
        if (opts.cols !== undefined) this.setCols(opts.cols);
        if (opts.wrap !== undefined) this.setWrap(opts.wrap);
        if (opts.minLength !== undefined) this.setMinLength(opts.minLength);
        if (opts.maxLength !== undefined) this.setMaxLength(opts.maxLength);
        if (opts.autocomplete !== undefined) this.setAutocomplete(opts.autocomplete);
        if (opts.autofocus) this.setAttr('autofocus', true);
        if (opts.value !== undefined) this.setValue(opts.value);
        if (opts.disabled !== undefined) this.setDisabled(Boolean(opts.disabled));
        if (opts.readonly !== undefined) this.setReadOnly(Boolean(opts.readonly));
        if (opts.required !== undefined) this.setRequired(Boolean(opts.required));
    }

    /**
     * Nom du champ (`name`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le nom</caption>
     * console.log(ta.name);
     *
     * @example <caption>Exemple 2 : Modifier le nom</caption>
     * ta.name = 'description';
     */
    get name() {
        return this.element?.name ?? '';
    }

    set name(value) {
        this.setName(value);
    }

    /**
     * Valeur textuelle courante (`value`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * console.log(ta.value);
     *
     * @example <caption>Exemple 2 : Modifier la valeur</caption>
     * ta.value = 'Bonjour';
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
     * console.log(ta.placeholder);
     *
     * @example <caption>Exemple 2 : Modifier le placeholder</caption>
     * ta.placeholder = 'Saisissez un texte...';
     */
    get placeholder() {
        return this.element?.placeholder ?? '';
    }

    set placeholder(value) {
        this.setPlaceholder(value);
    }

    /**
     * Nombre de lignes (`rows`).
     * @type {number}
     *
     * @example <caption>Exemple 1 : Lire rows</caption>
     * console.log(ta.rows);
     *
     * @example <caption>Exemple 2 : Modifier rows</caption>
     * ta.rows = 8;
     */
    get rows() {
        return this.element?.rows ?? 2;
    }

    set rows(value) {
        this.setRows(value);
    }

    /**
     * Nombre de colonnes (`cols`).
     * @type {number}
     *
     * @example <caption>Exemple 1 : Lire cols</caption>
     * console.log(ta.cols);
     *
     * @example <caption>Exemple 2 : Modifier cols</caption>
     * ta.cols = 40;
     */
    get cols() {
        return this.element?.cols ?? 20;
    }

    set cols(value) {
        this.setCols(value);
    }

    /**
     * Définit ou retire l'attribut `name`.
     *
     * @param {string|null} name - Nom du champ.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir le nom</caption>
     * ta.setName('notes');
     *
     * @example <caption>Exemple 2 : Retirer le nom</caption>
     * ta.setName(null);
     */
    setName(name) {
        if (name === null || name === undefined || name === '') {
            return this.removeAttr('name');
        }
        return this.setAttr('name', String(name));
    }

    /**
     * Définit le texte contenu dans la zone.
     *
     * @param {*} value - Texte à assigner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir le texte</caption>
     * ta.setValue('Ligne 1\nLigne 2');
     *
     * @example <caption>Exemple 2 : Vider avec null</caption>
     * ta.setValue(null);
     */
    setValue(value) {
        if (this.element) {
            this.element.value = value === null || value === undefined ? '' : String(value);
        }
        return this;
    }

    /**
     * Retourne le texte courant de la zone.
     *
     * @returns {string} Valeur courante.
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * const text = ta.getValue();
     *
     * @example <caption>Exemple 2 : Vérifier après modification</caption>
     * ta.setValue('ABC');
     * console.log(ta.getValue()); // 'ABC'
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
     * ta.setPlaceholder('Votre message');
     *
     * @example <caption>Exemple 2 : Retirer le placeholder</caption>
     * ta.setPlaceholder(null);
     */
    setPlaceholder(placeholder) {
        if (placeholder === null || placeholder === undefined || placeholder === '') {
            return this.removeAttr('placeholder');
        }
        return this.setAttr('placeholder', String(placeholder));
    }

    /**
     * Définit le nombre de lignes visibles (`rows`).
     *
     * @param {number|null} rows - Nombre de lignes (> 0).
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir 6 lignes</caption>
     * ta.setRows(6);
     *
     * @example <caption>Exemple 2 : Retirer l'attribut</caption>
     * ta.setRows(null);
     */
    setRows(rows) {
        if (rows === null || rows === undefined) {
            return this.removeAttr('rows');
        }
        const n = Number(rows);
        return Number.isFinite(n) && n > 0 ? this.setAttr('rows', String(Math.floor(n))) : this;
    }

    /**
     * Définit le nombre de colonnes visibles (`cols`).
     *
     * @param {number|null} cols - Nombre de colonnes (> 0).
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir 50 colonnes</caption>
     * ta.setCols(50);
     *
     * @example <caption>Exemple 2 : Retirer l'attribut</caption>
     * ta.setCols(null);
     */
    setCols(cols) {
        if (cols === null || cols === undefined) {
            return this.removeAttr('cols');
        }
        const n = Number(cols);
        return Number.isFinite(n) && n > 0 ? this.setAttr('cols', String(Math.floor(n))) : this;
    }

    /**
     * Définit le mode de retour à la ligne (`wrap`).
     *
     * @param {'soft'|'hard'|'off'|null} wrap - Mode de retour à la ligne.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver le retour à la ligne</caption>
     * ta.setWrap('off');
     *
     * @example <caption>Exemple 2 : Retirer l'attribut</caption>
     * ta.setWrap(null);
     */
    setWrap(wrap) {
        if (wrap === null || wrap === undefined || wrap === '') {
            return this.removeAttr('wrap');
        }
        return this.setAttr('wrap', String(wrap));
    }

    /**
     * Définit la longueur minimale (`minlength`).
     *
     * @param {number|null} length - Nombre minimal de caractères.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Imposer 10 caractères</caption>
     * ta.setMinLength(10);
     *
     * @example <caption>Exemple 2 : Supprimer la limite</caption>
     * ta.setMinLength(null);
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
     * @example <caption>Exemple 1 : Limiter à 280 caractères</caption>
     * ta.setMaxLength(280);
     *
     * @example <caption>Exemple 2 : Supprimer la limite</caption>
     * ta.setMaxLength(null);
     */
    setMaxLength(length) {
        if (length === null || length === undefined) {
            return this.removeAttr('maxlength');
        }
        const n = Number(length);
        return Number.isFinite(n) && n >= 0 ? this.setAttr('maxlength', String(Math.floor(n))) : this;
    }

    /**
     * Définit ou retire l'attribut `autocomplete`.
     *
     * @param {string|null} value - Valeur `autocomplete`.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver l'autocomplétion</caption>
     * ta.setAutocomplete('off');
     *
     * @example <caption>Exemple 2 : Retirer l'attribut</caption>
     * ta.setAutocomplete(null);
     */
    setAutocomplete(value) {
        if (value === null || value === undefined || value === '') {
            return this.removeAttr('autocomplete');
        }
        return this.setAttr('autocomplete', String(value));
    }

    /**
     * Active ou désactive la zone de texte.
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver</caption>
     * ta.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver</caption>
     * ta.setDisabled(false);
     */
    setDisabled(disabled = true) {
        if (this.element) {
            this.element.disabled = Boolean(disabled);
        }
        return disabled ? this.setAttr('disabled', true) : this.removeAttr('disabled');
    }

    /**
     * Indique si la zone de texte est désactivée.
     *
     * @returns {boolean} `true` si désactivée.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(ta.isDisabled());
     *
     * @example <caption>Exemple 2 : Après setDisabled</caption>
     * ta.setDisabled(true);
     * console.log(ta.isDisabled()); // true
     */
    isDisabled() {
        return Boolean(this.element?.disabled || this.hasAttr('disabled'));
    }

    /**
     * Passe la zone en lecture seule ou éditable.
     *
     * @param {boolean} [readonly=true] - `true` pour lecture seule.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Activer la lecture seule</caption>
     * ta.setReadOnly(true);
     *
     * @example <caption>Exemple 2 : Autoriser l'édition</caption>
     * ta.setReadOnly(false);
     */
    setReadOnly(readonly = true) {
        if (this.element) {
            this.element.readOnly = Boolean(readonly);
        }
        return readonly ? this.setAttr('readonly', true) : this.removeAttr('readonly');
    }

    /**
     * Indique si la zone est en lecture seule.
     *
     * @returns {boolean} `true` si en lecture seule.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(ta.isReadOnly());
     *
     * @example <caption>Exemple 2 : Après setReadOnly</caption>
     * ta.setReadOnly(true);
     * console.log(ta.isReadOnly()); // true
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
     * ta.setRequired(true);
     *
     * @example <caption>Exemple 2 : Rendre optionnel</caption>
     * ta.setRequired(false);
     */
    setRequired(required = true) {
        return required ? this.setAttr('required', true) : this.removeAttr('required');
    }

    /**
     * Indique si la zone est obligatoire.
     *
     * @returns {boolean} `true` si `required` est présent.
     *
     * @example <caption>Exemple 1 : Vérifier l'obligation</caption>
     * console.log(ta.isRequired());
     *
     * @example <caption>Exemple 2 : Après setRequired</caption>
     * ta.setRequired(true);
     * console.log(ta.isRequired()); // true
     */
    isRequired() {
        return Boolean(this.element?.required || this.hasAttr('required'));
    }

    /**
     * Sélectionne tout le texte contenu dans la zone.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Sélectionner le contenu</caption>
     * ta.select();
     *
     * @example <caption>Exemple 2 : Donner le focus puis sélectionner</caption>
     * ta.focus().select();
     */
    select() {
        if (this.element && typeof this.element.select === 'function') {
            this.element.select();
        }
        return this;
    }

    /**
     * Vérifie la validité HTML5 de la zone de texte.
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Valider</caption>
     * console.log(ta.isValid());
     *
     * @example <caption>Exemple 2 : Champ obligatoire vide</caption>
     * ta.setRequired(true).setValue('');
     * console.log(ta.isValid()); // false
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
     * ta.reportValidity();
     *
     * @example <caption>Exemple 2 : Avant soumission</caption>
     * if (!ta.reportValidity()) console.log('Texte invalide');
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
     * ta.setCustomValidity('Contenu trop court.');
     *
     * @example <caption>Exemple 2 : Effacer l'erreur</caption>
     * ta.setCustomValidity('');
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
     * console.log(ta.getValidationMessage());
     *
     * @example <caption>Exemple 2 : Après erreur personnalisée</caption>
     * ta.setCustomValidity('Erreur');
     * console.log(ta.getValidationMessage()); // 'Erreur'
     */
    getValidationMessage() {
        return this.element?.validationMessage || '';
    }

    /**
     * Vide le contenu de la zone de texte.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Vider la zone</caption>
     * ta.clear();
     *
     * @example <caption>Exemple 2 : Vérifier après vidage</caption>
     * ta.clear();
     * console.log(ta.getValue()); // ''
     */
    clear() {
        return this.setValue('');
    }
}

export default NTextarea;
