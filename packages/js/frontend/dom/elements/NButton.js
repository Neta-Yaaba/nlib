/**
 * @file NButton.js
 * @package @nlib/js-frontend
 * @description Composant bouton (`<button>`) héritant de `NTag`, avec gestion dynamique
 * du texte, d'une icône (`NImage`), des états `disabled` / `loading`, des variantes,
 * des tailles et de l'accessibilité ARIA.
 */

import { NTag } from './NTag.js';
import { NImage } from './NImage.js';

/**
 * @class NButton
 * @extends NTag
 * @description Représente un bouton `<button>` enrichi, construit à partir de `NTag` et `NImage`.
 *
 * @example <caption>Exemple 1 : Bouton principal avec texte et icône</caption>
 * const saveBtn = new NButton({
 *     text: 'Enregistrer',
 *     icon: '/icons/check.svg',
 *     type: 'submit'
 * }).mount('#actions');
 *
 * @example <caption>Exemple 2 : Bouton avec état de chargement et traduction</caption>
 * const submitBtn = new NButton({
 *     type: 'submit',
 *     applyLanguage: (btn) => btn.setText(btn.util.lang.get('actions.submit'))
 * });
 * submitBtn.applyLanguage().setLoading(true);
 */
export class NButton extends NTag {

    static #VALID_TYPES = new Set(['button', 'submit', 'reset']);
    static #VALID_POSITIONS = new Set(['left', 'right', 'top', 'bottom']);

    /**
     * Élément interne affichant le texte (`span.n-button__text`).
     * @type {NTag|null}
     * @private
     */
    #textTag = null;

    /**
     * Élément interne affichant l'icône (`NImage` ou `NTag`).
     * @type {NTag|null}
     * @private
     */
    #iconTag = null;

    /**
     * Élément interne affichant l'indicateur de chargement (`span.n-button__spinner`).
     * @type {NTag|null}
     * @private
     */
    #spinnerTag = null;

    /**
     * Position de l'icône par rapport au texte (`left`, `right`, `top`, `bottom`).
     * @type {'left'|'right'|'top'|'bottom'}
     * @private
     */
    #iconPosition = 'left';

    /**
     * État `disabled` explicite configuré par l'utilisateur.
     * @type {boolean}
     * @private
     */
    #disabled = false;

    /**
     * État `loading` courant du bouton.
     * @type {boolean}
     * @private
     */
    #loading = false;

    /**
     * Valeur d'`aria-label` générée automatiquement depuis `icon.alt` en mode icône seule.
     * @type {string}
     * @private
     */
    #autoAriaLabel = '';

    /**
     * Crée une nouvelle instance `NButton`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou texte du bouton.
     * @param {string} [options.text] - Texte du bouton.
     * @param {string|Object|NImage|NTag} [options.icon] - Source d'image, options `NImage` ou instance `NImage`/`NTag`.
     * @param {'left'|'right'|'top'|'bottom'} [options.iconPosition='left'] - Position de l'icône.
     * @param {boolean} [options.disabled=false] - Désactive le bouton.
     * @param {boolean} [options.loading=false] - Active l'indicateur de chargement.
     * @param {'button'|'submit'|'reset'} [options.type='button'] - Type HTML du bouton.
     * @param {Function} [options.applyLanguage] - Fonction personnalisée pour appliquer la traduction.
     *
     * @example <caption>Exemple 1 : Instanciation rapide par texte</caption>
     * const btn = new NButton('Valider');
     *
     * @example <caption>Exemple 2 : Bouton icône seule accessible</caption>
     * const closeBtn = new NButton({
     *     icon: '/icons/close.svg',
     *     attrs: { 'aria-label': 'Fermer' }
     * });
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { text: options }
            : (options && typeof options === 'object' ? options : {});

        const {
            text,
            icon,
            iconPosition = 'left',
            disabled = false,
            loading = false,
            type = 'button',
            ...tagOpts
        } = opts;

        super({ ...tagOpts, tagName: 'button', html: undefined });

        this.addClass('n-button');
        this.setIconPosition(iconPosition);
        this.setType(type);

        if (icon !== undefined && icon !== null) {
            this.setIcon(icon);
        }
        if (text !== undefined && text !== null) {
            this.setText(text);
        }

        this.setDisabled(disabled);
        this.setLoading(loading);
    }

    /**
     * Définit ou met à jour le texte du bouton dans son élément interne `span.n-button__text`.
     *
     * @param {string|number|null} text - Texte à afficher (`null` ou `''` supprime l'élément texte).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Modifier le texte du bouton</caption>
     * btn.setText('Confirmer');
     *
     * @example <caption>Exemple 2 : Supprimer le texte pour passer en icône seule</caption>
     * btn.setText('');
     */
    setText(text) {
        if (this.isDestroyed) {
            return this;
        }
        const value = (text === null || text === undefined) ? '' : String(text);

        if (!value) {
            if (this.#textTag) {
                this.removeChild(this.#textTag);
                this.#textTag.destroy();
                this.#textTag = null;
            }
            this.#syncStructure();
            return this;
        }

        if (!this.#textTag) {
            this.#textTag = new NTag({
                tagName: 'span',
                classes: ['n-button__text']
            });
        }
        this.#textTag.setText(value);
        this.#syncStructure();
        return this;
    }

    /**
     * Retourne le texte courant du bouton.
     *
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire le texte</caption>
     * const btn = new NButton('Envoyer');
     * console.log(btn.getText()); // 'Envoyer'
     *
     * @example <caption>Exemple 2 : Bouton sans texte</caption>
     * console.log(new NButton({ icon: '/icons/plus.svg' }).getText()); // ''
     */
    getText() {
        return this.#textTag ? this.#textTag.text : '';
    }

    /**
     * Définit, remplace ou supprime l'icône du bouton (`string` URL pour `NImage`, objet d'options `NImage`/`NTag`,
     * instance `NImage`/`NTag`, ou `null`/`''` pour la supprimer et la détruire).
     *
     * @param {string|Object|NImage|NTag|null} icon - Source, configuration ou instance de l'icône.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter une icône par URL ou emoji NTag</caption>
     * btn.setIcon('/icons/save.svg');
     * btn.setIcon(new NTag({ tagName: 'span', text: '🚀' }));
     *
     * @example <caption>Exemple 2 : Supprimer l'icône</caption>
     * btn.setIcon(null);
     */
    setIcon(icon) {
        if (this.isDestroyed) {
            return this;
        }
        if (icon === null || icon === undefined || icon === '') {
            if (this.#iconTag) {
                this.#clearIcon();
                this.#syncStructure();
            }
            return this;
        }

        if (typeof icon === 'string' && this.#iconTag instanceof NImage && !this.#iconTag.isDestroyed) {
            this.#iconTag.setSrc(icon);
            this.#syncStructure();
            return this;
        }

        this.#clearIcon();

        let iconTag = null;
        if (icon instanceof NTag) {
            iconTag = icon;
        } else if (typeof icon === 'string') {
            iconTag = new NImage({
                src: icon,
                alt: '',
                attrs: { 'aria-hidden': 'true' }
            });
        } else if (typeof icon === 'object') {
            const isTagConfig = !('src' in icon) && ('tagName' in icon || 'text' in icon || 'html' in icon || 'classes' in icon);
            iconTag = isTagConfig
                ? new NTag({
                    tagName: 'span',
                    ...icon,
                    attrs: { 'aria-hidden': 'true', ...(icon.attrs || {}) }
                })
                : new NImage({
                    alt: '',
                    ...icon,
                    attrs: { 'aria-hidden': 'true', ...(icon.attrs || {}) }
                });
        }

        if (iconTag) {
            iconTag.addClass('n-button__icon');
            if (!iconTag.hasAttr('aria-hidden') && !(iconTag instanceof NImage && iconTag.alt)) {
                iconTag.setAttr('aria-hidden', 'true');
            }
            this.#iconTag = iconTag;
            this.#syncStructure();
        }
        return this;
    }

    /**
     * Modifie la position de l'icône par rapport au texte (`left`, `right`, `top`, `bottom`).
     *
     * @param {'left'|'right'|'top'|'bottom'} position - Position de l'icône.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Placer l'icône au-dessus du texte</caption>
     * btn.setIconPosition('top');
     *
     * @example <caption>Exemple 2 : Placer l'icône à droite</caption>
     * btn.setIconPosition('right');
     */
    setIconPosition(position) {
        if (this.isDestroyed || typeof position !== 'string') {
            return this;
        }
        const next = position.trim().toLowerCase();
        if (!NButton.#VALID_POSITIONS.has(next)) {
            return this;
        }
        if (this.#iconPosition) {
            this.removeClass(`n-button--icon-${this.#iconPosition}`);
        }
        this.#iconPosition = next;
        this.addClass(`n-button--icon-${next}`);
        this.#syncStructure();
        return this;
    }

    /**
     * Active ou désactive l'état `disabled` du bouton.
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver, `false` pour réactiver.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Désactiver le bouton</caption>
     * btn.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver le bouton</caption>
     * btn.setDisabled(false);
     */
    setDisabled(disabled = true) {
        if (this.isDestroyed) {
            return this;
        }
        this.#disabled = Boolean(disabled);
        this.toggleClass('n-button--disabled', this.#disabled);
        this.#syncInteractionState();
        return this;
    }

    /**
     * Indique si le bouton est explicitement désactivé (`disabled`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Tester l'état désactivé</caption>
     * btn.setDisabled(true);
     * console.log(btn.isDisabled()); // true
     *
     * @example <caption>Exemple 2 : Bouton actif</caption>
     * console.log(new NButton('OK').isDisabled()); // false
     */
    isDisabled() {
        return this.#disabled;
    }

    /**
     * Active ou désactive l'état de chargement (`loading`) tout en préservant l'état `disabled` initial.
     *
     * @param {boolean} [loading=true] - `true` pour afficher l'indicateur de chargement.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Passer en chargement puis restaurer</caption>
     * btn.setLoading(true);
     * await save();
     * btn.setLoading(false);
     *
     * @example <caption>Exemple 2 : Chaîner avec setText</caption>
     * btn.setLoading(true).setText('Envoi...');
     */
    setLoading(loading = true) {
        if (this.isDestroyed) {
            return this;
        }
        const next = Boolean(loading);

        if (next === this.#loading) {
            this.#syncInteractionState();
            return this;
        }

        this.#loading = next;
        this.toggleClass('n-button--loading', next);

        if (next) {
            this.setAttr('aria-busy', 'true');
            if (!this.#spinnerTag) {
                this.#spinnerTag = new NTag({
                    tagName: 'span',
                    classes: ['n-button__spinner'],
                    attrs: { 'aria-hidden': 'true' }
                });
            }
        } else {
            this.removeAttr('aria-busy');
            if (this.#spinnerTag) {
                this.removeChild(this.#spinnerTag);
                this.#spinnerTag.destroy();
                this.#spinnerTag = null;
            }
        }

        this.#syncInteractionState();
        this.#syncStructure();
        return this;
    }

    /**
     * Indique si le bouton est actuellement en état de chargement (`loading`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier l'état loading</caption>
     * btn.setLoading(true);
     * console.log(btn.isLoading()); // true
     *
     * @example <caption>Exemple 2 : État par défaut</caption>
     * console.log(new NButton('OK').isLoading()); // false
     */
    isLoading() {
        return this.#loading;
    }

    /**
     * Définit l'attribut `type` du bouton (`button`, `submit`, `reset`).
     *
     * @param {'button'|'submit'|'reset'} type - Type HTML du bouton.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir comme bouton de soumission</caption>
     * btn.setType('submit');
     *
     * @example <caption>Exemple 2 : Définir comme bouton de réinitialisation</caption>
     * btn.setType('reset');
     */
    setType(type) {
        if (this.isDestroyed || typeof type !== 'string') {
            return this;
        }
        const next = type.trim().toLowerCase();
        if (!NButton.#VALID_TYPES.has(next)) {
            return this;
        }
        return this.setAttr('type', next);
    }

    /**
     * Nettoie les références internes et détruit le bouton ainsi que ses enfants `NTag` / `NImage`.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire un bouton</caption>
     * btn.destroy();
     *
     * @example <caption>Exemple 2 : Vérifier la destruction</caption>
     * btn.destroy();
     * console.log(btn.isDestroyed); // true
     */
    destroy() {
        this.#textTag = null;
        this.#iconTag = null;
        this.#spinnerTag = null;
        this.#autoAriaLabel = '';
        super.destroy();
    }

    /**
     * Détache et détruit l'icône interne du bouton.
     * @private
     */
    #clearIcon() {
        if (!this.#iconTag) {
            return;
        }
        const tag = this.#iconTag;
        this.#iconTag = null;
        this.removeChild(tag);
        if (!tag.isDestroyed) {
            tag.destroy();
        }
    }

    /**
     * Synchronise l'état natif `disabled` du `<button>` à partir de `#disabled` et `#loading`.
     * @private
     */
    #syncInteractionState() {
        const blocked = Boolean(this.#disabled || this.#loading);
        this.setProperty('disabled', blocked);
        this.setAttr('disabled', blocked);
    }

    /**
     * Réordonne dynamiquement les enfants internes (`spinner`, `icon`, `text`)
     * et met à jour les classes utilitaires (`n-button--icon-only`) et l'accessibilité.
     * @private
     */
    #syncStructure() {
        if (this.isDestroyed) {
            return;
        }

        const ordered = [];
        if (this.#spinnerTag) {
            ordered.push(this.#spinnerTag);
        }
        const iconBefore = this.#iconPosition === 'left' || this.#iconPosition === 'top';
        if (this.#iconTag && iconBefore) {
            ordered.push(this.#iconTag);
        }
        if (this.#textTag) {
            ordered.push(this.#textTag);
        }
        if (this.#iconTag && !iconBefore) {
            ordered.push(this.#iconTag);
        }

        if (ordered.length > 0) {
            this.append(...ordered);
        }

        const hasText = Boolean(this.#textTag && this.#textTag.text);
        const hasVisual = Boolean(this.#iconTag || this.#spinnerTag);
        this.toggleClass('n-button--icon-only', !hasText && hasVisual);

        if (hasText) {
            if (this.#autoAriaLabel && this.getAttr('aria-label') === this.#autoAriaLabel) {
                this.removeAttr('aria-label');
            }
            this.#autoAriaLabel = '';
        } else if (this.#iconTag instanceof NImage && this.#iconTag.alt && !this.hasAttr('aria-label')) {
            this.#autoAriaLabel = this.#iconTag.alt;
            this.setAttr('aria-label', this.#autoAriaLabel);
        }
    }
}

export default NButton;
