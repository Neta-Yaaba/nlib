import { NTag } from './NTag.js';

/**
 * @class NFilePicker
 * @extends NTag
 * @description Élément natif `<input type="file">` (`.n-filepicker`) héritant de `NTag`.
 *
 * @example <caption>Exemple 1 : Sélecteur d'images</caption>
 * const picker = new NFilePicker({ name: 'avatar', accept: 'image/*' });
 *
 * @example <caption>Exemple 2 : Sélection multiple de PDF</caption>
 * const docs = new NFilePicker({ accept: '.pdf', multiple: true });
 */
export class NFilePicker extends NTag {

    /**
     * Crée une nouvelle instance `NFilePicker`.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration.
     * @param {string} [options.name] - Nom du champ.
     * @param {string} [options.accept] - Types MIME ou extensions acceptées.
     * @param {boolean} [options.multiple=false] - Autorise la sélection multiple.
     * @param {boolean} [options.disabled=false] - Désactive le sélecteur.
     * @param {boolean} [options.required=false] - Rend la sélection obligatoire.
     * @param {boolean} [options.autofocus=false] - Focus automatique.
     *
     * @example <caption>Exemple 1 : Fichier unique</caption>
     * const upload = new NFilePicker({ accept: 'image/png,image/jpeg' });
     *
     * @example <caption>Exemple 2 : Plusieurs fichiers requis</caption>
     * const attachments = new NFilePicker({ multiple: true, required: true });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};
        super({ ...opts, tagName: 'input', text: undefined, html: undefined });

        this.addClass('n-filepicker');
        this.setAttr('type', 'file');

        if (opts.name !== undefined) this.setName(opts.name);
        if (opts.accept !== undefined) this.setAccept(opts.accept);
        if (opts.multiple !== undefined) this.setMultiple(Boolean(opts.multiple));
        if (opts.disabled !== undefined) this.setDisabled(Boolean(opts.disabled));
        if (opts.required !== undefined) this.setRequired(Boolean(opts.required));
        if (opts.autofocus) this.setAttr('autofocus', true);
    }

    /**
     * Nom du champ (`name`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le nom</caption>
     * console.log(fb.name);
     *
     * @example <caption>Exemple 2 : Modifier le nom</caption>
     * fb.name = 'documents';
     */
    get name() {
        return this.element?.name ?? '';
    }

    set name(value) {
        this.setName(value);
    }

    /**
     * Définit ou retire l'attribut `name`.
     *
     * @param {string|null} name - Nom du champ.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir le nom</caption>
     * fb.setName('photo');
     *
     * @example <caption>Exemple 2 : Retirer le nom</caption>
     * fb.setName(null);
     */
    setName(name) {
        if (name === null || name === undefined || name === '') {
            return this.removeAttr('name');
        }
        return this.setAttr('name', String(name));
    }

    /**
     * Définit ou retire les types de fichiers acceptés (`accept`).
     *
     * @param {string|null} accept - Types MIME ou extensions (ex. `'image/*,.pdf'`).
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Accepter uniquement les images</caption>
     * fb.setAccept('image/*');
     *
     * @example <caption>Exemple 2 : Accepter tout type de fichier</caption>
     * fb.setAccept(null);
     */
    setAccept(accept) {
        if (accept === null || accept === undefined || accept === '') {
            return this.removeAttr('accept');
        }
        return this.setAttr('accept', String(accept));
    }

    /**
     * Active ou désactive la sélection multiple (`multiple`).
     *
     * @param {boolean} [multiple=true] - `true` pour autoriser plusieurs fichiers.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Autoriser plusieurs fichiers</caption>
     * fb.setMultiple(true);
     *
     * @example <caption>Exemple 2 : Limiter à un seul fichier</caption>
     * fb.setMultiple(false);
     */
    setMultiple(multiple = true) {
        if (this.element) {
            this.element.multiple = Boolean(multiple);
        }
        return multiple ? this.setAttr('multiple', true) : this.removeAttr('multiple');
    }

    /**
     * Retourne la liste des fichiers sélectionnés sous forme de tableau.
     *
     * @returns {File[]} Tableau de `File`.
     *
     * @example <caption>Exemple 1 : Récupérer les fichiers</caption>
     * const files = fb.getFiles();
     *
     * @example <caption>Exemple 2 : Lire le nom du premier fichier</caption>
     * const first = fb.getFiles()[0];
     * if (first) console.log(first.name);
     */
    getFiles() {
        return this.element?.files ? Array.from(this.element.files) : [];
    }

    /**
     * Active ou désactive le sélecteur de fichiers.
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver</caption>
     * fb.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver</caption>
     * fb.setDisabled(false);
     */
    setDisabled(disabled = true) {
        if (this.element) {
            this.element.disabled = Boolean(disabled);
        }
        return disabled ? this.setAttr('disabled', true) : this.removeAttr('disabled');
    }

    /**
     * Indique si le sélecteur est désactivé.
     *
     * @returns {boolean} `true` si désactivé.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(fb.isDisabled());
     *
     * @example <caption>Exemple 2 : Après setDisabled</caption>
     * fb.setDisabled(true);
     * console.log(fb.isDisabled()); // true
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
     * fb.setRequired(true);
     *
     * @example <caption>Exemple 2 : Rendre optionnel</caption>
     * fb.setRequired(false);
     */
    setRequired(required = true) {
        return required ? this.setAttr('required', true) : this.removeAttr('required');
    }

    /**
     * Indique si la sélection est obligatoire.
     *
     * @returns {boolean} `true` si `required` est présent.
     *
     * @example <caption>Exemple 1 : Vérifier l'obligation</caption>
     * console.log(fb.isRequired());
     *
     * @example <caption>Exemple 2 : Après setRequired</caption>
     * fb.setRequired(true);
     * console.log(fb.isRequired()); // true
     */
    isRequired() {
        return Boolean(this.element?.required || this.hasAttr('required'));
    }

    /**
     * Vérifie la validité HTML5 du sélecteur.
     *
     * @returns {boolean} `true` si valide.
     *
     * @example <caption>Exemple 1 : Valider</caption>
     * console.log(fb.isValid());
     *
     * @example <caption>Exemple 2 : Champ requis sans fichier</caption>
     * fb.setRequired(true);
     * console.log(fb.isValid()); // false
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
     * fb.reportValidity();
     *
     * @example <caption>Exemple 2 : Avant envoi</caption>
     * if (!fb.reportValidity()) console.log('Fichier requis');
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
     * fb.setCustomValidity('Fichier trop volumineux.');
     *
     * @example <caption>Exemple 2 : Effacer l'erreur</caption>
     * fb.setCustomValidity('');
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
     * console.log(fb.getValidationMessage());
     *
     * @example <caption>Exemple 2 : Après erreur personnalisée</caption>
     * fb.setCustomValidity('Format refusé');
     * console.log(fb.getValidationMessage()); // 'Format refusé'
     */
    getValidationMessage() {
        return this.element?.validationMessage || '';
    }

    /**
     * Réinitialise la sélection de fichiers.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Vider la sélection</caption>
     * fb.clear();
     *
     * @example <caption>Exemple 2 : Vérifier après vidage</caption>
     * fb.clear();
     * console.log(fb.getFiles().length); // 0
     */
    clear() {
        if (this.element) {
            this.element.value = '';
        }
        return this;
    }
}

export default NFilePicker;
