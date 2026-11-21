import { NTag } from './NTag.js';

/**
 * @class NRadioBox
 * @extends NTag
 * @description Élément natif `<input type="radio">` (`.n-radiobox`) héritant de `NTag`.
 *
 * @example <caption>Exemple 1 : Créer un bouton radio</caption>
 * const radio = new NRadioBox({ name: 'plan', value: 'pro', checked: true });
 *
 * @example <caption>Exemple 2 : Créer un groupe de boutons radio</caption>
 * const r1 = new NRadioBox({ name: 'choice', value: 'a' });
 * const r2 = new NRadioBox({ name: 'choice', value: 'b', checked: true });
 */
export class NRadioBox extends NTag {

    /**
     * Crée une nouvelle instance `NRadioBox`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration.
     * @param {string} [options.name] - Nom du groupe radio.
     * @param {string} [options.value] - Valeur du bouton radio.
     * @param {boolean} [options.checked=false] - État sélectionné initial.
     * @param {boolean} [options.disabled=false] - Désactive le bouton.
     * @param {boolean} [options.required=false] - Rend la sélection obligatoire.
     * @param {boolean} [options.autofocus=false] - Donne le focus automatiquement.
     *
     * @example <caption>Exemple 1 : Radio sélectionné</caption>
     * const radio = new NRadioBox({ name: 'gender', value: 'f', checked: true });
     *
     * @example <caption>Exemple 2 : Radio désactivé</caption>
     * const radio = new NRadioBox({ name: 'tier', value: 'vip', disabled: true });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        super({ ...opts, tagName: 'input', text: undefined, html: undefined });

        this.addClass('n-radiobox');
        this.setAttr('type', 'radio');

        if (opts.name !== undefined) this.setName(opts.name);
        if (opts.value !== undefined) this.setValue(opts.value);
        if (opts.checked !== undefined) this.setChecked(Boolean(opts.checked));
        if (opts.disabled !== undefined) this.setDisabled(Boolean(opts.disabled));
        if (opts.required !== undefined) this.setRequired(Boolean(opts.required));
        if (opts.autofocus) this.setAttr('autofocus', true);
    }

    /**
     * Nom du groupe (`name`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le nom</caption>
     * console.log(radio.name);
     *
     * @example <caption>Exemple 2 : Modifier le nom</caption>
     * radio.name = 'payment_method';
     */
    get name() {
        return this.element?.name ?? '';
    }

    set name(value) {
        this.setName(value);
    }

    /**
     * Valeur du bouton radio (`value`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * console.log(radio.value);
     *
     * @example <caption>Exemple 2 : Modifier la valeur</caption>
     * radio.value = 'card';
     */
    get value() {
        return this.getValue();
    }

    set value(val) {
        this.setValue(val);
    }

    /**
     * État sélectionné (`checked`).
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Lire l'état</caption>
     * console.log(radio.checked);
     *
     * @example <caption>Exemple 2 : Sélectionner</caption>
     * radio.checked = true;
     */
    get checked() {
        return this.isChecked();
    }

    set checked(val) {
        this.setChecked(Boolean(val));
    }

    /**
     * Définit ou retire l'attribut `name`.
     *
     * @param {string|null} name - Nom du groupe.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir le nom</caption>
     * radio.setName('currency');
     *
     * @example <caption>Exemple 2 : Retirer le nom</caption>
     * radio.setName(null);
     */
    setName(name) {
        if (name === null || name === undefined || name === '') {
            return this.removeAttr('name');
        }
        return this.setAttr('name', String(name));
    }

    /**
     * Définit la valeur du bouton radio.
     *
     * @param {*} value - Valeur à assigner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir la valeur</caption>
     * radio.setValue('EUR');
     *
     * @example <caption>Exemple 2 : Chaîner</caption>
     * radio.setValue('USD').setChecked(true);
     */
    setValue(value) {
        if (this.element) {
            this.element.value = value === null || value === undefined ? '' : String(value);
        }
        return this;
    }

    /**
     * Retourne la valeur du bouton radio.
     *
     * @returns {string} Valeur courante.
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * console.log(radio.getValue());
     *
     * @example <caption>Exemple 2 : Vérifier après modification</caption>
     * radio.setValue('XOF');
     * console.log(radio.getValue()); // 'XOF'
     */
    getValue() {
        return this.element ? this.element.value : '';
    }

    /**
     * Définit l'état sélectionné du bouton radio.
     *
     * @param {boolean} [checked=true] - `true` pour sélectionner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Sélectionner</caption>
     * radio.setChecked(true);
     *
     * @example <caption>Exemple 2 : Désélectionner</caption>
     * radio.setChecked(false);
     */
    setChecked(checked = true) {
        if (this.element) {
            this.element.checked = Boolean(checked);
        }
        return this;
    }

    /**
     * Indique si le bouton radio est sélectionné.
     *
     * @returns {boolean} `true` si sélectionné.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * if (radio.isChecked()) console.log('Sélectionné');
     *
     * @example <caption>Exemple 2 : Après setChecked</caption>
     * radio.setChecked(true);
     * console.log(radio.isChecked()); // true
     */
    isChecked() {
        return Boolean(this.element?.checked);
    }

    /**
     * Active ou désactive le bouton radio.
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver</caption>
     * radio.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver</caption>
     * radio.setDisabled(false);
     */
    setDisabled(disabled = true) {
        if (this.element) {
            this.element.disabled = Boolean(disabled);
        }
        return disabled ? this.setAttr('disabled', true) : this.removeAttr('disabled');
    }

    /**
     * Indique si le bouton radio est désactivé.
     *
     * @returns {boolean} `true` si désactivé.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(radio.isDisabled());
     *
     * @example <caption>Exemple 2 : Après setDisabled</caption>
     * radio.setDisabled(true);
     * console.log(radio.isDisabled()); // true
     */
    isDisabled() {
        return Boolean(this.element?.disabled || this.hasAttr('disabled'));
    }

    /**
     * Définit le caractère obligatoire (`required`).
     *
     * @param {boolean} [required=true] - `true` pour rendre obligatoire.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Rendre obligatoire</caption>
     * radio.setRequired(true);
     *
     * @example <caption>Exemple 2 : Rendre optionnel</caption>
     * radio.setRequired(false);
     */
    setRequired(required = true) {
        return required ? this.setAttr('required', true) : this.removeAttr('required');
    }

    /**
     * Indique si le bouton radio est obligatoire.
     *
     * @returns {boolean} `true` si `required` est présent.
     *
     * @example <caption>Exemple 1 : Lire l'état</caption>
     * console.log(radio.isRequired());
     *
     * @example <caption>Exemple 2 : Après setRequired</caption>
     * radio.setRequired(true);
     * console.log(radio.isRequired()); // true
     */
    isRequired() {
        return Boolean(this.element?.required || this.hasAttr('required'));
    }

    /**
     * Vérifie la validité HTML5 du bouton radio.
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Valider</caption>
     * console.log(radio.isValid());
     *
     * @example <caption>Exemple 2 : Radio obligatoire non sélectionné</caption>
     * radio.setRequired(true).setChecked(false);
     * console.log(radio.isValid()); // false
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
     * radio.reportValidity();
     *
     * @example <caption>Exemple 2 : Avant soumission</caption>
     * if (!radio.reportValidity()) console.log('Choix requis');
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
     * radio.setCustomValidity('Sélectionnez une option.');
     *
     * @example <caption>Exemple 2 : Effacer l'erreur</caption>
     * radio.setCustomValidity('');
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
     * console.log(radio.getValidationMessage());
     *
     * @example <caption>Exemple 2 : Après erreur personnalisée</caption>
     * radio.setCustomValidity('Requis');
     * console.log(radio.getValidationMessage()); // 'Requis'
     */
    getValidationMessage() {
        return this.element?.validationMessage || '';
    }

    /**
     * Désélectionne le bouton radio.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Réinitialiser</caption>
     * radio.clear();
     *
     * @example <caption>Exemple 2 : Vérifier après clear</caption>
     * radio.clear();
     * console.log(radio.isChecked()); // false
     */
    clear() {
        return this.setChecked(false);
    }
}

export default NRadioBox;
