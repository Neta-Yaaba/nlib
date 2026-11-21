import { NTag } from './NTag.js';

const NUMBER_TYPES = new Set(['number', 'range']);

/**
 * @class NEditNumber
 * @extends NTag
 * @description �l�ment natif `<input>` num�rique (`number`, `range`, `.n-editnumber`) h�ritant de `NTag`.
 *
 * @example <caption>Exemple 1 : Champ quantit�</caption>
 * const qty = new NEditNumber({ name: 'qty', min: 1, max: 99, step: 1, value: 1 });
 *
 * @example <caption>Exemple 2 : Curseur de plage</caption>
 * const volume = new NEditNumber({ type: 'range', min: 0, max: 100, step: 5, value: 50 });
 */
export class NEditNumber extends NTag {

    /**
     * Cr�e une nouvelle instance `NEditNumber`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration.
     * @param {'number'|'range'} [options.type='number'] - Type num�rique.
     * @param {string} [options.name] - Nom du champ.
     * @param {number|string} [options.value] - Valeur initiale.
     * @param {string} [options.placeholder] - Texte indicatif.
     * @param {number|string} [options.min] - Valeur minimale.
     * @param {number|string} [options.max] - Valeur maximale.
     * @param {number|string} [options.step] - Pas d'incr�mentation.
     * @param {string} [options.autocomplete] - Attribut `autocomplete`.
     * @param {boolean} [options.autofocus=false] - Focus automatique.
     * @param {boolean} [options.disabled=false] - D�sactive le champ.
     * @param {boolean} [options.readonly=false] - Passe en lecture seule.
     * @param {boolean} [options.required=false] - Rend le champ obligatoire.
     *
     * @example <caption>Exemple 1 : Prix d�cimal</caption>
     * const price = new NEditNumber({ min: 0, step: 0.01, placeholder: '0.00' });
     *
     * @example <caption>Exemple 2 : Plage de pourcentage</caption>
     * const pct = new NEditNumber({ type: 'range', min: 0, max: 100, value: 25 });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        super({ ...opts, tagName: 'input', text: undefined, html: undefined });

        this.addClass('n-editnumber');
        this.setType(opts.type || 'number');

        if (opts.name !== undefined) this.setName(opts.name);
        if (opts.placeholder !== undefined) this.setPlaceholder(opts.placeholder);
        if (opts.min !== undefined) this.setMin(opts.min);
        if (opts.max !== undefined) this.setMax(opts.max);
        if (opts.step !== undefined) this.setStep(opts.step);
        if (opts.autocomplete !== undefined) this.setAutocomplete(opts.autocomplete);
        if (opts.autofocus) this.setAttr('autofocus', true);
        if (opts.value !== undefined) this.setValue(opts.value);
        if (opts.disabled !== undefined) this.setDisabled(Boolean(opts.disabled));
        if (opts.readonly !== undefined) this.setReadOnly(Boolean(opts.readonly));
        if (opts.required !== undefined) this.setRequired(Boolean(opts.required));
    }

    /**
     * Type HTML (`number` ou `range`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le type</caption>
     * console.log(nb.type);
     *
     * @example <caption>Exemple 2 : Basculer en range</caption>
     * nb.type = 'range';
     */
    get type() {
        return this.element?.type || this.getAttr('type') || 'number';
    }

    set type(value) {
        this.setType(value);
    }

    /**
     * Nom du champ (`name`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le nom</caption>
     * console.log(nb.name);
     *
     * @example <caption>Exemple 2 : Modifier le nom</caption>
     * nb.name = 'quantity';
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
     * console.log(nb.value);
     *
     * @example <caption>Exemple 2 : Modifier la valeur</caption>
     * nb.value = '10';
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
     * console.log(nb.placeholder);
     *
     * @example <caption>Exemple 2 : Modifier le placeholder</caption>
     * nb.placeholder = '0';
     */
    get placeholder() {
        return this.element?.placeholder ?? '';
    }

    set placeholder(value) {
        this.setPlaceholder(value);
    }

    /**
     * D�finit le type num�rique (`number` ou `range`).
     *
     * @param {string} type - Type num�rique.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Passer en curseur range</caption>
     * nb.setType('range');
     *
     * @example <caption>Exemple 2 : Passer en champ number</caption>
     * nb.setType('number');
     */
    setType(type) {
        const clean = typeof type === 'string' ? type.trim().toLowerCase() : 'number';
        const resolved = NUMBER_TYPES.has(clean) ? clean : 'number';
        return this.setAttr('type', resolved);
    }

    /**
     * D�finit ou retire l'attribut `name`.
     *
     * @param {string|null} name - Nom du champ.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : D�finir le nom</caption>
     * nb.setName('amount');
     *
     * @example <caption>Exemple 2 : Retirer le nom</caption>
     * nb.setName(null);
     */
    setName(name) {
        if (name === null || name === undefined || name === '') {
            return this.removeAttr('name');
        }
        return this.setAttr('name', String(name));
    }

    /**
     * D�finit la valeur du champ num�rique.
     *
     * @param {*} value - Nombre ou cha�ne num�rique.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Assigner un entier</caption>
     * nb.setValue(42);
     *
     * @example <caption>Exemple 2 : Vider avec null</caption>
     * nb.setValue(null);
     */
    setValue(value) {
        if (this.element) {
            this.element.value = value === null || value === undefined ? '' : String(value);
        }
        return this;
    }

    /**
     * Retourne la valeur brute sous forme de cha�ne.
     *
     * @returns {string} Valeur courante.
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * console.log(nb.getValue());
     *
     * @example <caption>Exemple 2 : V�rifier apr�s affectation</caption>
     * nb.setValue(12);
     * console.log(nb.getValue()); // '12'
     */
    getValue() {
        return this.element ? this.element.value : '';
    }

    /**
     * Retourne la valeur convertie en nombre (`number` ou `null` si vide/invalide).
     *
     * @returns {number|null} Valeur num�rique ou `null`.
     *
     * @example <caption>Exemple 1 : Lire un nombre</caption>
     * nb.setValue('15.5');
     * console.log(nb.getValueAsNumber()); // 15.5
     *
     * @example <caption>Exemple 2 : Champ vide</caption>
     * nb.clear();
     * console.log(nb.getValueAsNumber()); // null
     */
    getValueAsNumber() {
        if (!this.element) return null;
        const n = this.element.valueAsNumber;
        if (typeof n === 'number' && Number.isFinite(n)) {
            return n;
        }
        const raw = this.getValue().trim();
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    }

    /**
     * D�finit ou retire l'attribut `placeholder`.
     *
     * @param {string|null} placeholder - Texte indicatif.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : D�finir le placeholder</caption>
     * nb.setPlaceholder('Quantit�');
     *
     * @example <caption>Exemple 2 : Retirer le placeholder</caption>
     * nb.setPlaceholder(null);
     */
    setPlaceholder(placeholder) {
        if (placeholder === null || placeholder === undefined || placeholder === '') {
            return this.removeAttr('placeholder');
        }
        return this.setAttr('placeholder', String(placeholder));
    }

    /**
     * D�finit ou retire la borne minimale (`min`).
     *
     * @param {number|string|null} min - Borne minimale.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Fixer un minimum � 0</caption>
     * nb.setMin(0);
     *
     * @example <caption>Exemple 2 : Retirer le minimum</caption>
     * nb.setMin(null);
     */
    setMin(min) {
        return (min === null || min === undefined || min === '')
            ? this.removeAttr('min')
            : this.setAttr('min', String(min));
    }

    /**
     * D�finit ou retire la borne maximale (`max`).
     *
     * @param {number|string|null} max - Borne maximale.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Fixer un maximum � 100</caption>
     * nb.setMax(100);
     *
     * @example <caption>Exemple 2 : Retirer le maximum</caption>
     * nb.setMax(null);
     */
    setMax(max) {
        return (max === null || max === undefined || max === '')
            ? this.removeAttr('max')
            : this.setAttr('max', String(max));
    }

    /**
     * D�finit ou retire le pas (`step`).
     *
     * @param {number|string|null} step - Pas d'incr�mentation (`0.1`, `'any'`, etc.).
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Pas de 0.5</caption>
     * nb.setStep(0.5);
     *
     * @example <caption>Exemple 2 : Retirer le pas</caption>
     * nb.setStep(null);
     */
    setStep(step) {
        return (step === null || step === undefined || step === '')
            ? this.removeAttr('step')
            : this.setAttr('step', String(step));
    }

    /**
     * D�finit ou retire l'attribut `autocomplete`.
     *
     * @param {string|null} value - Valeur `autocomplete`.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : D�sactiver l'autocompl�tion</caption>
     * nb.setAutocomplete('off');
     *
     * @example <caption>Exemple 2 : Retirer l'attribut</caption>
     * nb.setAutocomplete(null);
     */
    setAutocomplete(value) {
        if (value === null || value === undefined || value === '') {
            return this.removeAttr('autocomplete');
        }
        return this.setAttr('autocomplete', String(value));
    }

    /**
     * Active ou d�sactive le champ.
     *
     * @param {boolean} [disabled=true] - `true` pour d�sactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : D�sactiver</caption>
     * nb.setDisabled(true);
     *
     * @example <caption>Exemple 2 : R�activer</caption>
     * nb.setDisabled(false);
     */
    setDisabled(disabled = true) {
        if (this.element) {
            this.element.disabled = Boolean(disabled);
        }
        return disabled ? this.setAttr('disabled', true) : this.removeAttr('disabled');
    }

    /**
     * Indique si le champ est d�sactiv�.
     *
     * @returns {boolean} `true` si d�sactiv�.
     *
     * @example <caption>Exemple 1 : V�rifier l'�tat</caption>
     * console.log(nb.isDisabled());
     *
     * @example <caption>Exemple 2 : Apr�s setDisabled</caption>
     * nb.setDisabled(true);
     * console.log(nb.isDisabled()); // true
     */
    isDisabled() {
        return Boolean(this.element?.disabled || this.hasAttr('disabled'));
    }

    /**
     * Passe le champ en lecture seule ou �ditable.
     *
     * @param {boolean} [readonly=true] - `true` pour lecture seule.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Lecture seule</caption>
     * nb.setReadOnly(true);
     *
     * @example <caption>Exemple 2 : �ditable</caption>
     * nb.setReadOnly(false);
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
     * @example <caption>Exemple 1 : V�rifier l'�tat</caption>
     * console.log(nb.isReadOnly());
     *
     * @example <caption>Exemple 2 : Apr�s setReadOnly</caption>
     * nb.setReadOnly(true);
     * console.log(nb.isReadOnly()); // true
     */
    isReadOnly() {
        return Boolean(this.element?.readOnly || this.hasAttr('readonly'));
    }

    /**
     * D�finit le caract�re obligatoire (`required`).
     *
     * @param {boolean} [required=true] - `true` pour rendre obligatoire.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Rendre obligatoire</caption>
     * nb.setRequired(true);
     *
     * @example <caption>Exemple 2 : Rendre optionnel</caption>
     * nb.setRequired(false);
     */
    setRequired(required = true) {
        return required ? this.setAttr('required', true) : this.removeAttr('required');
    }

    /**
     * Indique si le champ est obligatoire.
     *
     * @returns {boolean} `true` si `required` est pr�sent.
     *
     * @example <caption>Exemple 1 : V�rifier l'obligation</caption>
     * console.log(nb.isRequired());
     *
     * @example <caption>Exemple 2 : Apr�s setRequired</caption>
     * nb.setRequired(true);
     * console.log(nb.isRequired()); // true
     */
    isRequired() {
        return Boolean(this.element?.required || this.hasAttr('required'));
    }

    /**
     * S�lectionne le texte contenu dans le champ.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : S�lectionner</caption>
     * nb.select();
     *
     * @example <caption>Exemple 2 : Focus puis s�lection</caption>
     * nb.focus().select();
     */
    select() {
        if (this.element && typeof this.element.select === 'function') {
            this.element.select();
        }
        return this;
    }

    /**
     * V�rifie la validit� HTML5 (bornes `min`, `max`, `step`, `required`).
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Valider</caption>
     * console.log(nb.isValid());
     *
     * @example <caption>Exemple 2 : Hors borne</caption>
     * nb.setMin(10).setValue(2);
     * console.log(nb.isValid()); // false
     */
    isValid() {
        return this.element && typeof this.element.checkValidity === 'function'
            ? this.element.checkValidity()
            : true;
    }

    /**
     * D�clenche l'affichage natif du message de validation.
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Reporter la validit�</caption>
     * nb.reportValidity();
     *
     * @example <caption>Exemple 2 : Avant soumission</caption>
     * if (!nb.reportValidity()) console.log('Nombre invalide');
     */
    reportValidity() {
        return this.element && typeof this.element.reportValidity === 'function'
            ? this.element.reportValidity()
            : true;
    }

    /**
     * D�finit un message de validation personnalis�.
     *
     * @param {string} [message=''] - Message d'erreur ou cha�ne vide.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : D�finir une erreur</caption>
     * nb.setCustomValidity('Montant insuffisant.');
     *
     * @example <caption>Exemple 2 : Effacer l'erreur</caption>
     * nb.setCustomValidity('');
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
     * console.log(nb.getValidationMessage());
     *
     * @example <caption>Exemple 2 : Apr�s erreur personnalis�e</caption>
     * nb.setCustomValidity('Trop �lev�');
     * console.log(nb.getValidationMessage()); // 'Trop �lev�'
     */
    getValidationMessage() {
        return this.element?.validationMessage || '';
    }

    /**
     * Vide la valeur du champ.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Vider</caption>
     * nb.clear();
     *
     * @example <caption>Exemple 2 : V�rifier apr�s vidage</caption>
     * nb.clear();
     * console.log(nb.getValueAsNumber()); // null
     */
    clear() {
        return this.setValue('');
    }
}

export default NEditNumber;
