import { NTag } from './NTag.js';

/**
 * @class NCheckBox
 * @extends NTag
 * @description Élément natif `<input type="checkbox">` (`.n-checkbox`) héritant de `NTag`.
 *
 * @example <caption>Exemple 1 : Créer une case à cocher</caption>
 * const cb = new NCheckBox({ name: 'terms', value: 'accepted', checked: true });
 *
 * @example <caption>Exemple 2 : Basculer l'état coché</caption>
 * const cb = new NCheckBox();
 * cb.toggleChecked();
 */
export class NCheckBox extends NTag {

    /**
     * Crée une nouvelle instance `NCheckBox`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration.
     * @param {string} [options.name] - Nom du champ.
     * @param {string} [options.value] - Valeur soumise lorsque la case est cochée.
     * @param {boolean} [options.checked=false] - État coché initial.
     * @param {boolean} [options.indeterminate=false] - État indéterminé initial.
     * @param {boolean} [options.disabled=false] - Désactive le contrôle.
     * @param {boolean} [options.required=false] - Rend la case obligatoire.
     * @param {boolean} [options.autofocus=false] - Donne le focus automatiquement.
     *
     * @example <caption>Exemple 1 : Case cochée par défaut</caption>
     * const cb = new NCheckBox({ name: 'newsletter', checked: true });
     *
     * @example <caption>Exemple 2 : Case indéterminée</caption>
     * const cb = new NCheckBox({ indeterminate: true });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        super({ ...opts, tagName: 'input', text: undefined, html: undefined });

        this.addClass('n-checkbox');
        this.setAttr('type', 'checkbox');

        if (opts.name !== undefined) this.setName(opts.name);
        if (opts.value !== undefined) this.setValue(opts.value);
        if (opts.checked !== undefined) this.setChecked(Boolean(opts.checked));
        if (opts.indeterminate !== undefined) this.setIndeterminate(Boolean(opts.indeterminate));
        if (opts.disabled !== undefined) this.setDisabled(Boolean(opts.disabled));
        if (opts.required !== undefined) this.setRequired(Boolean(opts.required));
        if (opts.autofocus) this.setAttr('autofocus', true);
    }

    /**
     * Nom du champ (`name`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le nom</caption>
     * console.log(cb.name);
     *
     * @example <caption>Exemple 2 : Modifier le nom</caption>
     * cb.name = 'accept_cgu';
     */
    get name() {
        return this.element?.name ?? '';
    }

    set name(value) {
        this.setName(value);
    }

    /**
     * Valeur associée à la case (`value`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * console.log(cb.value);
     *
     * @example <caption>Exemple 2 : Modifier la valeur</caption>
     * cb.value = 'yes';
     */
    get value() {
        return this.getValue();
    }

    set value(val) {
        this.setValue(val);
    }

    /**
     * État coché (`checked`).
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Lire l'état</caption>
     * console.log(cb.checked);
     *
     * @example <caption>Exemple 2 : Cocher via propriété</caption>
     * cb.checked = true;
     */
    get checked() {
        return this.isChecked();
    }

    set checked(val) {
        this.setChecked(Boolean(val));
    }

    /**
     * État indéterminé (`indeterminate`).
     * @type {boolean}
     *
     * @example <caption>Exemple 1 : Lire l'état indéterminé</caption>
     * console.log(cb.indeterminate);
     *
     * @example <caption>Exemple 2 : Activer l'état indéterminé</caption>
     * cb.indeterminate = true;
     */
    get indeterminate() {
        return this.isIndeterminate();
    }

    set indeterminate(val) {
        this.setIndeterminate(Boolean(val));
    }

    /**
     * Définit ou retire l'attribut `name`.
     *
     * @param {string|null} name - Nom du champ.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir le nom</caption>
     * cb.setName('terms');
     *
     * @example <caption>Exemple 2 : Retirer le nom</caption>
     * cb.setName(null);
     */
    setName(name) {
        if (name === null || name === undefined || name === '') {
            return this.removeAttr('name');
        }
        return this.setAttr('name', String(name));
    }

    /**
     * Définit la valeur de soumission de la case.
     *
     * @param {*} value - Valeur à assigner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir la valeur</caption>
     * cb.setValue('accepted');
     *
     * @example <caption>Exemple 2 : Chaîner la configuration</caption>
     * cb.setValue('1').setChecked(true);
     */
    setValue(value) {
        if (this.element) {
            this.element.value = value === null || value === undefined ? '' : String(value);
        }
        return this;
    }

    /**
     * Retourne la valeur de la case.
     *
     * @returns {string} Valeur courante.
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * const val = cb.getValue();
     *
     * @example <caption>Exemple 2 : Vérifier après modification</caption>
     * cb.setValue('ok');
     * console.log(cb.getValue()); // 'ok'
     */
    getValue() {
        return this.element ? this.element.value : '';
    }

    /**
     * Définit l'état coché de la case.
     *
     * @param {boolean} [checked=true] - `true` pour cocher, `false` pour décocher.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Cocher</caption>
     * cb.setChecked(true);
     *
     * @example <caption>Exemple 2 : Décocher</caption>
     * cb.setChecked(false);
     */
    setChecked(checked = true) {
        if (this.element) {
            this.element.checked = Boolean(checked);
        }
        return this;
    }

    /**
     * Indique si la case est cochée.
     *
     * @returns {boolean} `true` si cochée.
     *
     * @example <caption>Exemple 1 : Tester l'état</caption>
     * if (cb.isChecked()) console.log('Cochée');
     *
     * @example <caption>Exemple 2 : Vérification après setChecked</caption>
     * cb.setChecked(true);
     * console.log(cb.isChecked()); // true
     */
    isChecked() {
        return Boolean(this.element?.checked);
    }

    /**
     * Inverse l'état coché courant.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Basculer l'état</caption>
     * cb.toggleChecked();
     *
     * @example <caption>Exemple 2 : Double bascule</caption>
     * cb.toggleChecked().toggleChecked();
     */
    toggleChecked() {
        return this.setChecked(!this.isChecked());
    }

    /**
     * Définit l'état visuel indéterminé de la case.
     *
     * @param {boolean} [indeterminate=true] - `true` pour activer l'état indéterminé.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Activer l'état indéterminé</caption>
     * cb.setIndeterminate(true);
     *
     * @example <caption>Exemple 2 : Désactiver l'état indéterminé</caption>
     * cb.setIndeterminate(false);
     */
    setIndeterminate(indeterminate = true) {
        if (this.element) {
            this.element.indeterminate = Boolean(indeterminate);
        }
        return this;
    }

    /**
     * Indique si la case est en état indéterminé.
     *
     * @returns {boolean} `true` si indéterminée.
     *
     * @example <caption>Exemple 1 : Lire l'état</caption>
     * console.log(cb.isIndeterminate());
     *
     * @example <caption>Exemple 2 : Vérifier après activation</caption>
     * cb.setIndeterminate(true);
     * console.log(cb.isIndeterminate()); // true
     */
    isIndeterminate() {
        return Boolean(this.element?.indeterminate);
    }

    /**
     * Active ou désactive la case à cocher.
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver</caption>
     * cb.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver</caption>
     * cb.setDisabled(false);
     */
    setDisabled(disabled = true) {
        if (this.element) {
            this.element.disabled = Boolean(disabled);
        }
        return disabled ? this.setAttr('disabled', true) : this.removeAttr('disabled');
    }

    /**
     * Indique si la case est désactivée.
     *
     * @returns {boolean} `true` si désactivée.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(cb.isDisabled());
     *
     * @example <caption>Exemple 2 : Après setDisabled</caption>
     * cb.setDisabled(true);
     * console.log(cb.isDisabled()); // true
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
     * cb.setRequired(true);
     *
     * @example <caption>Exemple 2 : Rendre optionnelle</caption>
     * cb.setRequired(false);
     */
    setRequired(required = true) {
        return required ? this.setAttr('required', true) : this.removeAttr('required');
    }

    /**
     * Indique si la case est obligatoire.
     *
     * @returns {boolean} `true` si `required` est présent.
     *
     * @example <caption>Exemple 1 : Tester l'obligation</caption>
     * console.log(cb.isRequired());
     *
     * @example <caption>Exemple 2 : Après setRequired</caption>
     * cb.setRequired(true);
     * console.log(cb.isRequired()); // true
     */
    isRequired() {
        return Boolean(this.element?.required || this.hasAttr('required'));
    }

    /**
     * Vérifie la validité HTML5 de la case.
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Valider</caption>
     * console.log(cb.isValid());
     *
     * @example <caption>Exemple 2 : Case obligatoire non cochée</caption>
     * cb.setRequired(true).setChecked(false);
     * console.log(cb.isValid()); // false
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
     * cb.reportValidity();
     *
     * @example <caption>Exemple 2 : Avant soumission</caption>
     * if (!cb.reportValidity()) console.log('Case requise');
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
     * cb.setCustomValidity('Veuillez accepter les conditions.');
     *
     * @example <caption>Exemple 2 : Effacer l'erreur</caption>
     * cb.setCustomValidity('');
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
     * console.log(cb.getValidationMessage());
     *
     * @example <caption>Exemple 2 : Après erreur personnalisée</caption>
     * cb.setCustomValidity('Requis');
     * console.log(cb.getValidationMessage()); // 'Requis'
     */
    getValidationMessage() {
        return this.element?.validationMessage || '';
    }

    /**
     * Décoche la case et réinitialise l'état indéterminé.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Réinitialiser la case</caption>
     * cb.clear();
     *
     * @example <caption>Exemple 2 : Réinitialiser puis vérifier</caption>
     * cb.clear();
     * console.log(cb.isChecked(), cb.isIndeterminate()); // false, false
     */
    clear() {
        return this.setChecked(false).setIndeterminate(false);
    }
}

export default NCheckBox;
