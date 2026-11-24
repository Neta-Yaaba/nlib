import { NTag } from './NTag.js';

/**
 * @class NEditTag
 * @extends NTag
 * @description Élément HTML éditable (`contenteditable`, `.n-edittag`) basé sur n'importe quelle balise (`div`, `span`, `p`, etc.).
 *
 * @example <caption>Exemple 1 : Créer un bloc div éditable</caption>
 * const editor = new NEditTag({ placeholder: 'Écrivez ici...' });
 *
 * @example <caption>Exemple 2 : Créer un span éditable en texte brut</caption>
 * const title = new NEditTag({ tagName: 'span', editable: 'plaintext-only', value: 'Titre' });
 */
export class NEditTag extends NTag {

    /**
     * Crée une nouvelle instance `NEditTag`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou nom de balise HTML (`'div'`, `'span'`, etc.).
     * @param {string} [options.tagName='div'] - Balise HTML racine.
     * @param {boolean|'plaintext-only'} [options.editable=true] - Mode d'édition `contenteditable`.
     * @param {string} [options.value] - Contenu texte initial.
     * @param {string} [options.placeholder] - Texte indicatif affiché lorsque l'élément est vide (`data-placeholder`).
     * @param {boolean} [options.spellcheck] - Active ou désactive la vérification orthographique.
     * @param {boolean} [options.autofocus=false] - Donne le focus automatiquement.
     *
     * @example <caption>Exemple 1 : Instanciation avec options</caption>
     * const block = new NEditTag({ tagName: 'div', placeholder: 'Saisir un commentaire' });
     *
     * @example <caption>Exemple 2 : Instanciation par nom de balise</caption>
     * const inline = new NEditTag('span');
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { tagName: options }
            : (options && typeof options === 'object' ? options : {});

        const {
            tagName = 'div',
            editable = true,
            value,
            placeholder,
            spellcheck,
            autofocus = false,
            ...tagOpts
        } = opts;

        super({ ...tagOpts, tagName });

        this.addClass('n-edittag');
        this.setEditable(editable);

        if (placeholder !== undefined) this.setPlaceholder(placeholder);
        if (spellcheck !== undefined) this.setSpellcheck(Boolean(spellcheck));
        if (value !== undefined) this.setValue(value);
        if (autofocus) this.setAttr('autofocus', true);
    }

    /**
     * Mode d'édition courant (`'true'`, `'false'` ou `'plaintext-only'`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le mode d'édition</caption>
     * console.log(ed.editable);
     *
     * @example <caption>Exemple 2 : Passer en lecture seule</caption>
     * ed.editable = false;
     */
    get editable() {
        return this.element?.contentEditable ?? this.getAttr('contenteditable') ?? 'false';
    }

    set editable(mode) {
        this.setEditable(mode);
    }

    /**
     * Contenu texte courant de la balise.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le texte</caption>
     * console.log(ed.value);
     *
     * @example <caption>Exemple 2 : Modifier le texte</caption>
     * ed.value = 'Nouveau contenu';
     */
    get value() {
        return this.getValue();
    }

    set value(val) {
        this.setValue(val);
    }

    /**
     * Texte indicatif (`data-placeholder`).
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire le placeholder</caption>
     * console.log(ed.placeholder);
     *
     * @example <caption>Exemple 2 : Modifier le placeholder</caption>
     * ed.placeholder = 'Entrez votre texte...';
     */
    get placeholder() {
        return this.getAttr('data-placeholder') ?? '';
    }

    set placeholder(value) {
        this.setPlaceholder(value);
    }

    /**
     * Définit le mode `contenteditable` de la balise (`true`, `false` ou `'plaintext-only'`).
     *
     * @param {boolean|'true'|'false'|'plaintext-only'} [mode=true] - Mode d'édition.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Activer l'édition en texte brut</caption>
     * ed.setEditable('plaintext-only');
     *
     * @example <caption>Exemple 2 : Désactiver l'édition</caption>
     * ed.setEditable(false);
     */
    setEditable(mode = true) {
        const value = mode === 'plaintext-only'
            ? 'plaintext-only'
            : (mode === true || mode === 'true' ? 'true' : 'false');

        if (this.element) {
            this.element.contentEditable = value;
        }
        return this.setAttr('contenteditable', value);
    }

    /**
     * Indique si l'élément est actuellement éditable.
     *
     * @returns {boolean} `true` si `contenteditable` vaut `'true'` ou `'plaintext-only'`.
     *
     * @example <caption>Exemple 1 : Vérifier l'éditabilité</caption>
     * if (ed.isEditable()) console.log('Éditable');
     *
     * @example <caption>Exemple 2 : Après désactivation</caption>
     * ed.setEditable(false);
     * console.log(ed.isEditable()); // false
     */
    isEditable() {
        const mode = String(this.editable).toLowerCase();
        return mode === 'true' || mode === 'plaintext-only';
    }

    /**
     * Définit le contenu textuel de la balise éditable.
     *
     * @param {*} value - Texte à assigner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Assigner un texte</caption>
     * ed.setValue('Bonjour le monde');
     *
     * @example <caption>Exemple 2 : Vider avec null</caption>
     * ed.setValue(null);
     */
    setValue(value) {
        if (this.element) {
            this.element.textContent = value === null || value === undefined ? '' : String(value);
        }
        return this;
    }

    /**
     * Retourne le contenu textuel courant de la balise.
     *
     * @returns {string} Texte courant.
     *
     * @example <caption>Exemple 1 : Lire le texte</caption>
     * const content = ed.getValue();
     *
     * @example <caption>Exemple 2 : Vérifier après affectation</caption>
     * ed.setValue('Test');
     * console.log(ed.getValue()); // 'Test'
     */
    getValue() {
        return this.element ? (this.element.textContent ?? '') : '';
    }

    /**
     * Définit ou retire le texte indicatif affiché via `data-placeholder`.
     *
     * @param {string|null} placeholder - Texte indicatif.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir un placeholder</caption>
     * ed.setPlaceholder('Tapez ici...');
     *
     * @example <caption>Exemple 2 : Retirer le placeholder</caption>
     * ed.setPlaceholder(null);
     */
    setPlaceholder(placeholder) {
        if (placeholder === null || placeholder === undefined || placeholder === '') {
            return this.removeAttr('data-placeholder');
        }
        return this.setAttr('data-placeholder', String(placeholder));
    }

    /**
     * Active ou désactive la vérification orthographique native (`spellcheck`).
     *
     * @param {boolean} [enabled=true] - `true` pour activer.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver la correction orthographique</caption>
     * ed.setSpellcheck(false);
     *
     * @example <caption>Exemple 2 : Activer la correction orthographique</caption>
     * ed.setSpellcheck(true);
     */
    setSpellcheck(enabled = true) {
        const flag = Boolean(enabled);
        if (this.element) {
            this.element.spellcheck = flag;
        }
        return this.setAttr('spellcheck', String(flag));
    }

    /**
     * Sélectionne tout le contenu de l'élément via l'API `Selection` / `Range`.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Sélectionner tout le contenu</caption>
     * ed.selectAll();
     *
     * @example <caption>Exemple 2 : Donner le focus puis sélectionner</caption>
     * ed.focus().selectAll();
     */
    selectAll() {
        if (this.element && typeof document !== 'undefined' && typeof window !== 'undefined' && window.getSelection) {
            const range = document.createRange();
            range.selectNodeContents(this.element);
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
        return this;
    }

    /**
     * Vide le contenu de la balise éditable.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Vider le contenu</caption>
     * ed.clear();
     *
     * @example <caption>Exemple 2 : Vérifier après vidage</caption>
     * ed.clear();
     * console.log(ed.getValue()); // ''
     */
    clear() {
        return this.setValue('');
    }
}

export default NEditTag;
