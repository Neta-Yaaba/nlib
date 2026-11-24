import { NTag } from './NTag.js';

/**
 * @class NSelect
 * @extends NTag
 * @description Élément natif `<select>` (`.n-select`) héritant de `NTag`.
 *
 * @example <caption>Exemple 1 : Liste déroulante simple</caption>
 * const country = new NSelect({
 *     name: 'country',
 *     options: [{ value: 'fr', label: 'France' }, { value: 'sn', label: 'Sénégal' }],
 *     value: 'sn'
 * });
 *
 * @example <caption>Exemple 2 : Ajouter des options dynamiquement</caption>
 * const sel = new NSelect();
 * sel.addOption('a', 'Option A').addOption('b', 'Option B', { selected: true });
 */
export class NSelect extends NTag {

    /**
     * Crée une nouvelle instance `NSelect`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration.
     * @param {string} [options.name] - Nom du champ.
     * @param {Array<string|{value: string, label?: string, disabled?: boolean, selected?: boolean}>} [options.options] - Options initiales.
     * @param {string} [options.value] - Valeur sélectionnée initiale.
     * @param {boolean} [options.multiple=false] - Autorise la sélection multiple.
     * @param {number} [options.size] - Nombre de lignes visibles.
     * @param {boolean} [options.disabled=false] - Désactive la liste.
     * @param {boolean} [options.required=false] - Rend la sélection obligatoire.
     * @param {boolean} [options.autofocus=false] - Focus automatique.
     *
     * @example <caption>Exemple 1 : Liste avec options initiales</caption>
     * const role = new NSelect({ options: ['user', 'admin'], value: 'admin' });
     *
     * @example <caption>Exemple 2 : Liste multiple</caption>
     * const tags = new NSelect({ multiple: true, size: 4, options: ['js', 'css', 'html'] });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        super({ ...opts, tagName: 'select', text: undefined, html: undefined });

        this.addClass('n-select');

        if (opts.name !== undefined) this.setName(opts.name);
        if (opts.multiple !== undefined) this.setMultiple(Boolean(opts.multiple));
        if (opts.size !== undefined) this.setSize(opts.size);
        if (Array.isArray(opts.options)) {
            for (const item of opts.options) {
                if (typeof item === 'string' || typeof item === 'number') {
                    this.addOption(String(item), String(item));
                } else if (item && typeof item === 'object') {
                    this.addOption(item.value ?? '', item.label ?? item.value ?? '', item);
                }
            }
        }
        if (opts.value !== undefined) this.setValue(opts.value);
        if (opts.disabled !== undefined) this.setDisabled(Boolean(opts.disabled));
        if (opts.required !== undefined) this.setRequired(Boolean(opts.required));
        if (opts.autofocus) this.setAttr('autofocus', true);
    }

    /**
     * Nom du champ (`name`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le nom</caption>
     * console.log(sel.name);
     *
     * @example <caption>Exemple 2 : Modifier le nom</caption>
     * sel.name = 'category';
     */
    get name() {
        return this.element?.name ?? '';
    }

    set name(value) {
        this.setName(value);
    }

    /**
     * Valeur sélectionnée (`value`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * console.log(sel.value);
     *
     * @example <caption>Exemple 2 : Sélectionner une valeur</caption>
     * sel.value = 'fr';
     */
    get value() {
        return this.getValue();
    }

    set value(val) {
        this.setValue(val);
    }

    /**
     * Définit ou retire l'attribut `name`.
     *
     * @param {string|null} name - Nom du champ.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir le nom</caption>
     * sel.setName('status');
     *
     * @example <caption>Exemple 2 : Retirer le nom</caption>
     * sel.setName(null);
     */
    setName(name) {
        if (name === null || name === undefined || name === '') {
            return this.removeAttr('name');
        }
        return this.setAttr('name', String(name));
    }

    /**
     * Définit la ou les valeurs sélectionnées (accepte une valeur simple ou un tableau en mode `multiple`).
     *
     * @param {*|Array<*>} value - Valeur ou tableau de valeurs des options à sélectionner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Sélectionner une valeur simple</caption>
     * sel.setValue('fr');
     *
     * @example <caption>Exemple 2 : Sélectionner plusieurs valeurs en mode multiple</caption>
     * sel.setMultiple(true).setValue(['fr', 'sn']);
     */
    setValue(value) {
        if (!this.element) return this;
        if (Array.isArray(value)) {
            const selected = new Set(value.map((v) => (v === null || v === undefined ? '' : String(v))));
            for (const opt of Array.from(this.element.options)) {
                opt.selected = selected.has(opt.value);
            }
        } else {
            this.element.value = value === null || value === undefined ? '' : String(value);
        }
        return this;
    }

    /**
     * Retourne la valeur sélectionnée courante.
     *
     * @returns {string} Valeur sélectionnée.
     *
     * @example <caption>Exemple 1 : Lire la valeur</caption>
     * console.log(sel.getValue());
     *
     * @example <caption>Exemple 2 : Vérifier après setValue</caption>
     * sel.setValue('admin');
     * console.log(sel.getValue()); // 'admin'
     */
    getValue() {
        return this.element ? this.element.value : '';
    }

    /**
     * Active ou désactive la sélection multiple (`multiple`).
     *
     * @param {boolean} [multiple=true] - `true` pour autoriser plusieurs sélections.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Activer la sélection multiple</caption>
     * sel.setMultiple(true);
     *
     * @example <caption>Exemple 2 : Revenir en sélection simple</caption>
     * sel.setMultiple(false);
     */
    setMultiple(multiple = true) {
        if (this.element) {
            this.element.multiple = Boolean(multiple);
        }
        return multiple ? this.setAttr('multiple', true) : this.removeAttr('multiple');
    }

    /**
     * Définit le nombre d'options visibles simultanément (`size`).
     *
     * @param {number|null} size - Nombre de lignes visibles.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Afficher 5 lignes</caption>
     * sel.setSize(5);
     *
     * @example <caption>Exemple 2 : Retirer l'attribut</caption>
     * sel.setSize(null);
     */
    setSize(size) {
        if (size === null || size === undefined) {
            return this.removeAttr('size');
        }
        const n = Number(size);
        return Number.isFinite(n) && n > 0 ? this.setAttr('size', String(Math.floor(n))) : this;
    }

    /**
     * Ajoute une `<option>` à la liste déroulante.
     *
     * @param {string} value - Valeur de l'option.
     * @param {string} [label=value] - Libellé affiché.
     * @param {Object} [opts={}] - Options (`{ disabled, selected }`).
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Ajouter une option</caption>
     * sel.addOption('en', 'English');
     *
     * @example <caption>Exemple 2 : Ajouter une option sélectionnée</caption>
     * sel.addOption('fr', 'Français', { selected: true });
     */
    addOption(value, label = value, opts = {}) {
        if (!this.element || typeof document === 'undefined') return this;
        const opt = document.createElement('option');
        opt.value = value === null || value === undefined ? '' : String(value);
        opt.textContent = label === null || label === undefined ? '' : String(label);
        if (opts.disabled) opt.disabled = true;
        if (opts.selected) opt.selected = true;
        this.element.appendChild(opt);
        return this;
    }

    /**
     * Supprime la ou les options correspondant à `value`.
     *
     * @param {string} value - Valeur de l'option à retirer.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Retirer une option</caption>
     * sel.removeOption('legacy');
     *
     * @example <caption>Exemple 2 : Enchaîner les suppressions</caption>
     * sel.removeOption('a').removeOption('b');
     */
    removeOption(value) {
        if (!this.element) return this;
        const target = String(value);
        for (const opt of Array.from(this.element.options)) {
            if (opt.value === target) {
                opt.remove();
            }
        }
        return this;
    }

    /**
     * Supprime toutes les options de la liste.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Vider les options</caption>
     * sel.clearOptions();
     *
     * @example <caption>Exemple 2 : Remplacer toutes les options</caption>
     * sel.clearOptions().addOption('1', 'Un');
     */
    clearOptions() {
        if (this.element) {
            this.element.innerHTML = '';
        }
        return this;
    }

    /**
     * Retourne les éléments `<option>` actuellement sélectionnés.
     *
     * @returns {HTMLOptionElement[]} Tableau des options sélectionnées.
     *
     * @example <caption>Exemple 1 : Lire les options sélectionnées</caption>
     * const selected = sel.getSelectedOptions();
     *
     * @example <caption>Exemple 2 : Compter les sélections</caption>
     * console.log(sel.getSelectedOptions().length);
     */
    getSelectedOptions() {
        return this.element?.selectedOptions ? Array.from(this.element.selectedOptions) : [];
    }

    /**
     * Retourne les valeurs des options actuellement sélectionnées.
     *
     * @returns {string[]} Tableau des valeurs sélectionnées.
     *
     * @example <caption>Exemple 1 : Lire toutes les valeurs sélectionnées</caption>
     * console.log(sel.getSelectedValues());
     *
     * @example <caption>Exemple 2 : Vérifier une sélection multiple</caption>
     * if (sel.getSelectedValues().includes('js')) console.log('JS sélectionné');
     */
    getSelectedValues() {
        return this.getSelectedOptions().map((opt) => opt.value);
    }

    /**
     * Active ou désactive la liste déroulante.
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver</caption>
     * sel.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver</caption>
     * sel.setDisabled(false);
     */
    setDisabled(disabled = true) {
        if (this.element) {
            this.element.disabled = Boolean(disabled);
        }
        return disabled ? this.setAttr('disabled', true) : this.removeAttr('disabled');
    }

    /**
     * Indique si la liste est désactivée.
     *
     * @returns {boolean} `true` si désactivée.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(sel.isDisabled());
     *
     * @example <caption>Exemple 2 : Après setDisabled</caption>
     * sel.setDisabled(true);
     * console.log(sel.isDisabled()); // true
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
     * sel.setRequired(true);
     *
     * @example <caption>Exemple 2 : Rendre optionnel</caption>
     * sel.setRequired(false);
     */
    setRequired(required = true) {
        return required ? this.setAttr('required', true) : this.removeAttr('required');
    }

    /**
     * Indique si la liste est obligatoire.
     *
     * @returns {boolean} `true` si `required` est présent.
     *
     * @example <caption>Exemple 1 : Vérifier l'obligation</caption>
     * console.log(sel.isRequired());
     *
     * @example <caption>Exemple 2 : Après setRequired</caption>
     * sel.setRequired(true);
     * console.log(sel.isRequired()); // true
     */
    isRequired() {
        return Boolean(this.element?.required || this.hasAttr('required'));
    }

    /**
     * Vérifie la validité HTML5 de la liste.
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Valider</caption>
     * console.log(sel.isValid());
     *
     * @example <caption>Exemple 2 : Liste requise sans valeur</caption>
     * sel.setRequired(true).clear();
     * console.log(sel.isValid()); // false
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
     * sel.reportValidity();
     *
     * @example <caption>Exemple 2 : Avant soumission</caption>
     * if (!sel.reportValidity()) console.log('Sélection requise');
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
     * sel.setCustomValidity('Choix invalide.');
     *
     * @example <caption>Exemple 2 : Effacer l'erreur</caption>
     * sel.setCustomValidity('');
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
     * console.log(sel.getValidationMessage());
     *
     * @example <caption>Exemple 2 : Après erreur personnalisée</caption>
     * sel.setCustomValidity('Requis');
     * console.log(sel.getValidationMessage()); // 'Requis'
     */
    getValidationMessage() {
        return this.element?.validationMessage || '';
    }

    /**
     * Réinitialise la sélection (`selectedIndex = -1`).
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Réinitialiser</caption>
     * sel.clear();
     *
     * @example <caption>Exemple 2 : Vérifier après réinitialisation</caption>
     * sel.clear();
     * console.log(sel.getSelectedValues().length); // 0
     */
    clear() {
        if (this.element) {
            this.element.selectedIndex = -1;
        }
        return this;
    }
}

export default NSelect;
