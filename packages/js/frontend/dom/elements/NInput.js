/**
 * @file NInput.js
 * @package @nlib/js-frontend
 * @description Composant champ de saisie universel (`<input>`) héritant de `NTag`,
 * prenant en charge tous les types HTML5 (`text`, `email`, `password`, `number`, `checkbox`,
 * `radio`, `file`, `range`, `date`, `color`, `hidden`, etc.) et la validation native.
 */

import { NTag } from './NTag.js';

/**
 * @class NInput
 * @extends NTag
 * @description Représente une balise `<input>` universelle manipulable de manière fluide.
 *
 * @example <caption>Exemple 1 : Champ texte email requis</caption>
 * const email = new NInput({
 *     type: 'email',
 *     name: 'email',
 *     placeholder: 'nom@exemple.com',
 *     required: true
 * }).mount('#form');
 *
 * @example <caption>Exemple 2 : Case à cocher ou curseur numérique</caption>
 * const remember = new NInput({ type: 'checkbox', name: 'remember', checked: true });
 * const volume = new NInput({ type: 'range', min: 0, max: 100, value: 50 });
 */
export class NInput extends NTag {

    /**
     * État `disabled` explicite de l'input.
     * @type {boolean}
     * @private
     */
    #disabled = false;

    /**
     * État `readonly` explicite de l'input.
     * @type {boolean}
     * @private
     */
    #readonly = false;

    /**
     * Crée une nouvelle instance `NInput`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou type HTML (`'text'`, `'email'`, `'checkbox'`, etc.).
     * @param {string} [options.type='text'] - Type de l'input HTML.
     * @param {string} [options.name] - Attribut `name`.
     * @param {string|number} [options.value] - Valeur initiale.
     * @param {string} [options.placeholder] - Texte d'indication (`placeholder`).
     * @param {boolean} [options.checked] - État coché (`checkbox` / `radio`).
     * @param {boolean} [options.indeterminate] - État indéterminé (`checkbox`).
     * @param {boolean} [options.disabled=false] - Désactive le champ.
     * @param {boolean} [options.readonly=false] - Passe le champ en lecture seule.
     * @param {boolean} [options.required=false] - Rend le champ obligatoire.
     * @param {string} [options.autocomplete] - Attribut `autocomplete`.
     * @param {boolean} [options.autofocus] - Attribut `autofocus`.
     * @param {string|number} [options.min] - Valeur minimale (`min`).
     * @param {string|number} [options.max] - Valeur maximale (`max`).
     * @param {string|number} [options.step] - Pas d'incrément (`step`).
     * @param {number} [options.minLength] - Longueur minimale (`minlength`).
     * @param {number} [options.maxLength] - Longueur maximale (`maxlength`).
     * @param {string} [options.pattern] - Expression régulière de validation (`pattern`).
     * @param {string} [options.accept] - Types MIME/extensions acceptés (`type="file"`).
     * @param {boolean} [options.multiple] - Sélection multiple (`type="file"` / `type="email"`).
     *
     * @example <caption>Exemple 1 : Par nom de type</caption>
     * const pwd = new NInput('password').setPlaceholder('Mot de passe');
     *
     * @example <caption>Exemple 2 : Par objet de configuration</caption>
     * const age = new NInput({ type: 'number', name: 'age', min: 0, max: 120, value: 25 });
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { type: options }
            : (options && typeof options === 'object' ? options : {});

        super({ ...opts, tagName: 'input', text: undefined, html: undefined });

        this.addClass('n-input');
        this.setType(opts.type ?? 'text');

        if (opts.name !== undefined) {
            this.setName(opts.name);
        }
        if (opts.placeholder !== undefined) {
            this.setPlaceholder(opts.placeholder);
        }
        if (opts.autocomplete !== undefined) {
            this.setAutocomplete(opts.autocomplete);
        }
        if (opts.autofocus !== undefined) {
            this.setAttr('autofocus', Boolean(opts.autofocus));
        }
        if (opts.min !== undefined) {
            this.setMin(opts.min);
        }
        if (opts.max !== undefined) {
            this.setMax(opts.max);
        }
        if (opts.step !== undefined) {
            this.setStep(opts.step);
        }
        if (opts.minLength !== undefined) {
            this.setMinLength(opts.minLength);
        }
        if (opts.maxLength !== undefined) {
            this.setMaxLength(opts.maxLength);
        }
        if (opts.pattern !== undefined) {
            this.setPattern(opts.pattern);
        }
        if (opts.accept !== undefined) {
            this.setAccept(opts.accept);
        }
        if (opts.multiple !== undefined) {
            this.setMultiple(opts.multiple);
        }
        if (opts.value !== undefined) {
            this.setValue(opts.value);
        }
        if (opts.checked !== undefined) {
            this.setChecked(opts.checked);
        }
        if (opts.indeterminate !== undefined) {
            this.setIndeterminate(opts.indeterminate);
        }
        this.setDisabled(Boolean(opts.disabled));
        this.setReadOnly(Boolean(opts.readonly));
        if (opts.required !== undefined) {
            this.setRequired(opts.required);
        }
    }

    /**
     * Retourne le type courant de l'input (`'text'`, `'email'`, `'checkbox'`, etc.).
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire le type</caption>
     * console.log(new NInput('email').type); // 'email'
     *
     * @example <caption>Exemple 2 : Type par défaut</caption>
     * console.log(new NInput().type); // 'text'
     */
    get type() {
        return this.getAttr('type') ?? 'text';
    }

    /**
     * Définit le type de l'input.
     * @param {string} value - Type HTML.
     *
     * @example <caption>Exemple 1 : Passer en mot de passe</caption>
     * input.type = 'password';
     *
     * @example <caption>Exemple 2 : Révéler en texte</caption>
     * input.type = 'text';
     */
    set type(value) {
        this.setType(value);
    }

    /**
     * Retourne l'attribut `name` de l'input.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire name</caption>
     * console.log(input.name);
     *
     * @example <caption>Exemple 2 : Input sans name</caption>
     * console.log(new NInput().name); // ''
     */
    get name() {
        return this.getAttr('name') ?? '';
    }

    /**
     * Définit l'attribut `name` de l'input.
     * @param {string|null} value - Nom du champ.
     *
     * @example <caption>Exemple 1 : Définir name via setter</caption>
     * input.name = 'username';
     *
     * @example <caption>Exemple 2 : Supprimer name</caption>
     * input.name = null;
     */
    set name(value) {
        this.setName(value);
    }

    /**
     * Retourne la valeur courante (`element.value`).
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire la valeur saisie</caption>
     * console.log(input.value);
     *
     * @example <caption>Exemple 2 : Input neuf</caption>
     * console.log(new NInput().value); // ''
     */
    get value() {
        return this.getValue();
    }

    /**
     * Définit la valeur courante (`element.value`).
     * @param {string|number|null} val - Nouvelle valeur.
     *
     * @example <caption>Exemple 1 : Définir via setter</caption>
     * input.value = 'Madi';
     *
     * @example 2 : Vider via setter</caption>
     * input.value = '';
     */
    set value(val) {
        this.setValue(val);
    }

    /**
     * Retourne l'état coché (`checkbox` / `radio`).
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Lire checked</caption>
     * console.log(checkbox.checked);
     *
     * @example <caption>Exemple 2 : Case non cochée</caption>
     * console.log(new NInput('checkbox').checked); // false
     */
    get checked() {
        return this.isChecked();
    }

    /**
     * Définit l'état coché (`checkbox` / `radio`).
     * @param {boolean} val - État souhaité.
     *
     * @example <caption>Exemple 1 : Cocher via setter</caption>
     * checkbox.checked = true;
     *
     * @example <caption>Exemple 2 : Décocher via setter</caption>
     * checkbox.checked = false;
     */
    set checked(val) {
        this.setChecked(val);
    }

    /**
     * Retourne le texte `placeholder`.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire le placeholder</caption>
     * console.log(input.placeholder);
     *
     * @example <caption>Exemple 2 : Input sans placeholder</caption>
     * console.log(new NInput().placeholder); // ''
     */
    get placeholder() {
        return this.getAttr('placeholder') ?? '';
    }

    /**
     * Définit le texte `placeholder`.
     * @param {string|null} value - Texte d'indication.
     *
     * @example <caption>Exemple 1 : Définir placeholder via setter</caption>
     * input.placeholder = 'Rechercher...';
     *
     * @example <caption>Exemple 2 : Supprimer placeholder</caption>
     * input.placeholder = null;
     */
    set placeholder(value) {
        this.setPlaceholder(value);
    }

    /**
     * Définit le type HTML de l'input (`text`, `password`, `email`, `number`, `checkbox`, `radio`, `file`, etc.).
     *
     * @param {string} type - Type HTML de l'input.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Basculer un champ mot de passe en texte</caption>
     * passwordInput.setType('text');
     *
     * @example <caption>Exemple 2 : Configurer un sélecteur de date</caption>
     * dateInput.setType('date');
     */
    setType(type) {
        if (!this.isDestroyed && typeof type === 'string' && type.trim()) {
            this.setAttr('type', type.trim().toLowerCase());
        }
        return this;
    }

    /**
     * Définit l'attribut `name` de l'input.
     *
     * @param {string|null} name - Nom du champ (`null` pour supprimer).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir le nom du champ</caption>
     * input.setName('email');
     *
     * @example <caption>Exemple 2 : Supprimer l'attribut name</caption>
     * input.setName(null);
     */
    setName(name) {
        if (name === null || name === undefined || name === '') {
            return this.removeAttr('name');
        }
        return this.setAttr('name', String(name).trim());
    }

    /**
     * Définit la valeur de l'input (`element.value`).
     *
     * @param {string|number|null} value - Valeur à affecter (`null`/`undefined` vide le champ).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Préremplir un champ texte</caption>
     * input.setValue('NLib');
     *
     * @example <caption>Exemple 2 : Définir une valeur numérique</caption>
     * rangeInput.setValue(75);
     */
    setValue(value) {
        if (this.element) {
            this.setProperty('value', value === null || value === undefined ? '' : String(value));
        }
        return this;
    }

    /**
     * Retourne la valeur courante de l'input (`element.value`).
     *
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * const val = input.getValue();
     *
     * @example <caption>Exemple 2 : Champ vide</caption>
     * console.log(new NInput().getValue()); // ''
     */
    getValue() {
        return this.element ? String(this.element.value ?? '') : '';
    }

    /**
     * Retourne la valeur numérique (`valueAsNumber`) pour les inputs `number`, `range`, `date`, etc.,
     * ou `null` si non convertible en nombre fini.
     *
     * @returns {number|null}
     *
     * @example <caption>Exemple 1 : Lire un champ numérique</caption>
     * const qty = new NInput({ type: 'number', value: '42' });
     * console.log(qty.getValueAsNumber()); // 42
     *
     * @example <caption>Exemple 2 : Champ vide ou non numérique</caption>
     * console.log(new NInput('number').getValueAsNumber()); // null
     */
    getValueAsNumber() {
        if (!this.element) {
            return null;
        }
        const n = this.element.valueAsNumber;
        if (typeof n === 'number' && Number.isFinite(n)) {
            return n;
        }
        const parsed = Number(this.element.value);
        return this.element.value !== '' && Number.isFinite(parsed) ? parsed : null;
    }

    /**
     * Définit le texte `placeholder`.
     *
     * @param {string|null} placeholder - Texte d'indication (`null` pour supprimer).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter un placeholder</caption>
     * input.setPlaceholder('Saisissez votre nom');
     *
     * @example <caption>Exemple 2 : Retirer le placeholder</caption>
     * input.setPlaceholder(null);
     */
    setPlaceholder(placeholder) {
        if (placeholder === null || placeholder === undefined || placeholder === '') {
            return this.removeAttr('placeholder');
        }
        return this.setAttr('placeholder', String(placeholder));
    }

    /**
     * Coche ou décoche l'input (`checkbox` / `radio`).
     *
     * @param {boolean} [checked=true] - État souhaité.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Cocher une case</caption>
     * checkbox.setChecked(true);
     *
     * @example <caption>Exemple 2 : Décocher une case</caption>
     * checkbox.setChecked(false);
     */
    setChecked(checked = true) {
        const flag = Boolean(checked);
        return this.setProperty('checked', flag).setAttr('checked', flag);
    }

    /**
     * Indique si l'input (`checkbox` / `radio`) est coché.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier si coché</caption>
     * checkbox.setChecked(true);
     * console.log(checkbox.isChecked()); // true
     *
     * @example <caption>Exemple 2 : État initial</caption>
     * console.log(new NInput('checkbox').isChecked()); // false
     */
    isChecked() {
        return Boolean(this.element?.checked);
    }

    /**
     * Bascule l'état coché d'une case à cocher.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Inverser l'état</caption>
     * checkbox.toggleChecked();
     *
     * @example <caption>Exemple 2 : Chaîner</caption>
     * checkbox.toggleChecked().focus();
     */
    toggleChecked() {
        return this.setChecked(!this.isChecked());
    }

    /**
     * Définit l'état indéterminé (`indeterminate`) d'une case à cocher.
     *
     * @param {boolean} [indeterminate=true] - État indéterminé.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer l'état partiel</caption>
     * selectAll.setIndeterminate(true);
     *
     * @example <caption>Exemple 2 : Réinitialiser l'état partiel</caption>
     * selectAll.setIndeterminate(false);
     */
    setIndeterminate(indeterminate = true) {
        return this.setProperty('indeterminate', Boolean(indeterminate));
    }

    /**
     * Indique si la case à cocher est dans l'état `indeterminate`.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier l'état indéterminé</caption>
     * selectAll.setIndeterminate(true);
     * console.log(selectAll.isIndeterminate()); // true
     *
     * @example <caption>Exemple 2 : État normal</caption>
     * console.log(new NInput('checkbox').isIndeterminate()); // false
     */
    isIndeterminate() {
        return Boolean(this.element?.indeterminate);
    }

    /**
     * Active ou désactive l'input (`disabled`).
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Désactiver le champ</caption>
     * input.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver le champ</caption>
     * input.setDisabled(false);
     */
    setDisabled(disabled = true) {
        this.#disabled = Boolean(disabled);
        this.toggleClass('n-input--disabled', this.#disabled);
        return this.setProperty('disabled', this.#disabled).setAttr('disabled', this.#disabled);
    }

    /**
     * Indique si l'input est désactivé.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier disabled</caption>
     * input.setDisabled(true);
     * console.log(input.isDisabled()); // true
     *
     * @example <caption>Exemple 2 : Champ actif</caption>
     * console.log(new NInput().isDisabled()); // false
     */
    isDisabled() {
        return this.#disabled;
    }

    /**
     * Active ou désactive le mode lecture seule (`readonly`).
     *
     * @param {boolean} [readonly=true] - `true` pour lecture seule.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Passer en lecture seule</caption>
     * input.setReadOnly(true);
     *
     * @example <caption>Exemple 2 : Autoriser la modification</caption>
     * input.setReadOnly(false);
     */
    setReadOnly(readonly = true) {
        this.#readonly = Boolean(readonly);
        this.toggleClass('n-input--readonly', this.#readonly);
        return this.setProperty('readOnly', this.#readonly).setAttr('readonly', this.#readonly);
    }

    /**
     * Indique si l'input est en lecture seule (`readonly`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier readonly</caption>
     * input.setReadOnly(true);
     * console.log(input.isReadOnly()); // true
     *
     * @example <caption>Exemple 2 : Champ éditable</caption>
     * console.log(new NInput().isReadOnly()); // false
     */
    isReadOnly() {
        return this.#readonly;
    }

    /**
     * Définit si le champ est obligatoire (`required`).
     *
     * @param {boolean} [required=true] - État obligatoire.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Rendre obligatoire</caption>
     * input.setRequired(true);
     *
     * @example <caption>Exemple 2 : Rendre facultatif</caption>
     * input.setRequired(false);
     */
    setRequired(required = true) {
        const flag = Boolean(required);
        return this.setProperty('required', flag).setAttr('required', flag);
    }

    /**
     * Indique si le champ est obligatoire (`required`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier required</caption>
     * input.setRequired(true);
     * console.log(input.isRequired()); // true
     *
     * @example <caption>Exemple 2 : Champ facultatif</caption>
     * console.log(new NInput().isRequired()); // false
     */
    isRequired() {
        return Boolean(this.element?.required);
    }

    /**
     * Définit l'attribut `autocomplete`.
     *
     * @param {string|null} value - Valeur `autocomplete` (ex: `'email'`, `'off'`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer l'autocomplétion email</caption>
     * input.setAutocomplete('email');
     *
     * @example <caption>Exemple 2 : Désactiver l'autocomplétion</caption>
     * input.setAutocomplete('off');
     */
    setAutocomplete(value) {
        if (value === null || value === undefined || value === '') {
            return this.removeAttr('autocomplete');
        }
        return this.setAttr('autocomplete', String(value));
    }

    /**
     * Définit la valeur minimale (`min`) pour les types numériques, `range` ou temporels.
     *
     * @param {string|number|null} min - Borne minimale.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Borne minimale numérique</caption>
     * qty.setMin(1);
     *
     * @example <caption>Exemple 2 : Borne de date</caption>
     * dateInput.setMin('2026-01-01');
     */
    setMin(min) {
        return (min === null || min === undefined || min === '')
            ? this.removeAttr('min')
            : this.setAttr('min', min);
    }

    /**
     * Définit la valeur maximale (`max`) pour les types numériques, `range` ou temporels.
     *
     * @param {string|number|null} max - Borne maximale.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Borne maximale numérique</caption>
     * qty.setMax(100);
     *
     * @example <caption>Exemple 2 : Supprimer la borne maximale</caption>
     * qty.setMax(null);
     */
    setMax(max) {
        return (max === null || max === undefined || max === '')
            ? this.removeAttr('max')
            : this.setAttr('max', max);
    }

    /**
     * Définit le pas d'incrément (`step`) pour les types numériques, `range` ou temporels.
     *
     * @param {string|number|null} step - Valeur du pas (ou `'any'`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Pas décimal</caption>
     * price.setStep('0.01');
     *
     * @example <caption>Exemple 2 : Pas entier</caption>
     * qty.setStep(5);
     */
    setStep(step) {
        return (step === null || step === undefined || step === '')
            ? this.removeAttr('step')
            : this.setAttr('step', step);
    }

    /**
     * Définit la longueur minimale (`minlength`).
     *
     * @param {number|null} length - Nombre minimal de caractères.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Exiger 8 caractères</caption>
     * pwd.setMinLength(8);
     *
     * @example <caption>Exemple 2 : Supprimer la contrainte</caption>
     * pwd.setMinLength(null);
     */
    setMinLength(length) {
        if (length === null || length === undefined) {
            return this.removeAttr('minlength');
        }
        return typeof length === 'number' && Number.isFinite(length) && length >= 0
            ? this.setAttr('minlength', Math.trunc(length))
            : this;
    }

    /**
     * Définit la longueur maximale (`maxlength`).
     *
     * @param {number|null} length - Nombre maximal de caractères.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Limiter à 50 caractères</caption>
     * title.setMaxLength(50);
     *
     * @example <caption>Exemple 2 : Supprimer la limite</caption>
     * title.setMaxLength(null);
     */
    setMaxLength(length) {
        if (length === null || length === undefined) {
            return this.removeAttr('maxlength');
        }
        return typeof length === 'number' && Number.isFinite(length) && length >= 0
            ? this.setAttr('maxlength', Math.trunc(length))
            : this;
    }

    /**
     * Définit le motif de validation (`pattern`).
     *
     * @param {string|RegExp|null} pattern - Motif regex.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Code postal à 5 chiffres</caption>
     * zip.setPattern('[0-9]{5}');
     *
     * @example <caption>Exemple 2 : À partir d'une RegExp</caption>
     * code.setPattern(/^[A-Z]{3}$/);
     */
    setPattern(pattern) {
        if (pattern === null || pattern === undefined || pattern === '') {
            return this.removeAttr('pattern');
        }
        const source = pattern instanceof RegExp ? pattern.source : String(pattern);
        return this.setAttr('pattern', source);
    }

    /**
     * Définit les types de fichiers acceptés (`accept`) pour `type="file"`.
     *
     * @param {string|string[]|null} accept - Liste MIME/extensions (ex: `'image/*,.pdf'`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Accepter uniquement les images</caption>
     * fileInput.setAccept('image/*');
     *
     * @example <caption>Exemple 2 : Accepter via un tableau</caption>
     * fileInput.setAccept(['.png', '.jpg', '.webp']);
     */
    setAccept(accept) {
        if (accept === null || accept === undefined || accept === '') {
            return this.removeAttr('accept');
        }
        const val = Array.isArray(accept) ? accept.filter(Boolean).join(',') : String(accept);
        return this.setAttr('accept', val);
    }

    /**
     * Active ou désactive la sélection multiple (`multiple`) pour `type="file"` ou `type="email"`.
     *
     * @param {boolean} [multiple=true] - État souhaité.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Autoriser plusieurs fichiers</caption>
     * fileInput.setMultiple(true);
     *
     * @example <caption>Exemple 2 : Limiter à un seul fichier</caption>
     * fileInput.setMultiple(false);
     */
    setMultiple(multiple = true) {
        const flag = Boolean(multiple);
        return this.setProperty('multiple', flag).setAttr('multiple', flag);
    }

    /**
     * Retourne les fichiers sélectionnés (`File[]`) pour un input de type `file`.
     *
     * @returns {File[]}
     *
     * @example <caption>Exemple 1 : Lire les fichiers après sélection</caption>
     * fileInput.on('change', () => console.log(fileInput.getFiles().length));
     *
     * @example <caption>Exemple 2 : Aucun fichier sélectionné</caption>
     * console.log(new NInput('file').getFiles()); // []
     */
    getFiles() {
        return this.element?.files ? Array.from(this.element.files) : [];
    }

    /**
     * Sélectionne tout le texte contenu dans l'input si supporté.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Sélectionner le texte au focus</caption>
     * input.on('focus', () => input.select());
     *
     * @example <caption>Exemple 2 : Chaîner focus et select</caption>
     * input.focus().select();
     */
    select() {
        if (this.element && typeof this.element.select === 'function') {
            this.element.select();
        }
        return this;
    }

    /**
     * Vérifie la validité native de l'input via `checkValidity()` et met à jour `n-input--invalid`.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Valider un champ email</caption>
     * email.setValue('invalide');
     * console.log(email.isValid()); // false
     *
     * @example <caption>Exemple 2 : Champ valide</caption>
     * email.setValue('test@nlib.dev');
     * console.log(email.isValid()); // true
     */
    isValid() {
        if (!this.element || typeof this.element.checkValidity !== 'function') {
            return true;
        }
        const valid = this.element.checkValidity();
        this.toggleClass('n-input--invalid', !valid);
        return valid;
    }

    /**
     * Déclenche l'affichage du message de validation natif (`reportValidity()`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier et afficher l'erreur native</caption>
     * if (!email.reportValidity()) email.focus();
     *
     * @example <caption>Exemple 2 : Contrôle avant envoi</caption>
     * formBtn.on('click', () => email.reportValidity());
     */
    reportValidity() {
        if (!this.element || typeof this.element.reportValidity !== 'function') {
            return true;
        }
        const valid = this.element.reportValidity();
        this.toggleClass('n-input--invalid', !valid);
        return valid;
    }

    /**
     * Définit un message d'erreur de validation personnalisé (`setCustomValidity()`).
     *
     * @param {string} [message=''] - Message d'erreur (`''` pour marquer valide).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir une erreur métier</caption>
     * username.setCustomValidity('Ce nom est déjà pris.');
     *
     * @example <caption>Exemple 2 : Effacer l'erreur personnalisée</caption>
     * username.setCustomValidity('');
     */
    setCustomValidity(message = '') {
        if (this.element && typeof this.element.setCustomValidity === 'function') {
            const msg = message === null || message === undefined ? '' : String(message);
            this.element.setCustomValidity(msg);
            this.toggleClass('n-input--invalid', Boolean(msg));
        }
        return this;
    }

    /**
     * Retourne le message d'erreur de validation natif courant (`validationMessage`).
     *
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire le message d'erreur</caption>
     * console.log(email.getValidationMessage());
     *
     * @example <caption>Exemple 2 : Champ valide</caption>
     * console.log(new NInput().getValidationMessage()); // ''
     */
    getValidationMessage() {
        return this.element?.validationMessage ?? '';
    }

    /**
     * Réinitialise la valeur du champ (`''`) ainsi que `checked` / `indeterminate` / l'erreur personnalisée.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Vider un champ texte</caption>
     * searchInput.clear();
     *
     * @example <caption>Exemple 2 : Réinitialiser une case à cocher</caption>
     * checkbox.clear();
     */
    clear() {
        this.setValue('');
        if (this.type === 'checkbox' || this.type === 'radio') {
            this.setChecked(false).setIndeterminate(false);
        }
        this.setCustomValidity('');
        return this;
    }
}

export default NInput;
