/**
 * @file NProgress.js
 * @package @nlib/js-frontend
 * @description Composant de barre et superposition de progression (`NProgress`) héritant de `NTag`.
 * Peut être monté dans n'importe quel conteneur (`NFrame`, panneau, `div`) pour bloquer les interactions
 * pendant un traitement, ou utilisé globalement via l'API statique (`NProgress.show`, `NProgress.set`, `NProgress.hide`).
 */

import { NTag } from '../../elements/NTag.js';

/**
 * @class NProgress
 * @extends NTag
 * @description Panneau de progression superposé (`div.n-progress`) bloquant les interactions sur son conteneur hôte.
 *
 * @example <caption>Exemple 1 : Afficher une progression globale sur document.body</caption>
 * NProgress.show('Chargement des données...');
 * NProgress.hide();
 *
 * @example <caption>Exemple 2 : Attacher un indicateur de progression à une frame ou un panneau</caption>
 * const progress = new NProgress();
 * myPanel.append(progress);
 * progress.showProgress('Envoi en cours...', 35);
 */
export class NProgress extends NTag {

    // =========================================================================
    // Propriétés statiques
    // =========================================================================

    /**
     * Instance globale partagée montée sur `document.body` pour `NProgress.show()`, `NProgress.set()` et `NProgress.hide()`.
     * @type {NProgress|null}
     */
    static #instance = null;

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Libellé textuel de la progression.
     * @type {NTag|null}
     */
    #textTag = null;

    /**
     * Barre interne de remplissage de la progression.
     * @type {NTag|null}
     */
    #barTag = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée un composant `NProgress` masqué par défaut, prêt à être monté dans un conteneur.
     *
     * @param {object} [options={}] - Options de configuration.
     * @param {string} [options.id] - Identifiant DOM optionnel.
     * @param {string|string[]} [options.classes] - Classes CSS additionnelles.
     * @param {Object<string, any>} [options.attrs] - Attributs HTML additionnels.
     * @param {Object<string, string>} [options.style] - Styles CSS inline.
     * @param {string} [options.theme] - Thème appliqué au composant.
     * @param {string} [options.styleName] - Style visuel appliqué au composant.
     * @param {boolean} [options.fixed=false] - Utilise `position: fixed` (activé automatiquement pour l'instance globale).
     * @param {object} [options.state] - État initial transmis à `NTag` / `NObject`.
     *
     * @example <caption>Exemple 1 : Instancier un indicateur pour une frame ou un div</caption>
     * const progress = new NProgress();
     * frame.append(progress);
     * progress.showProgress('Chargement...', 25);
     *
     * @example <caption>Exemple 2 : Instancier un indicateur avec classe et thème</caption>
     * const progress = new NProgress({ theme: 'dark', classes: ['custom-progress'] });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};

        super({
            tagName: 'div',
            id: opts.id,
            className: opts.fixed ? 'n-progress n-progress--fixed' : 'n-progress',
            classes: opts.classes,
            attrs: {
                role: 'progressbar',
                'aria-valuemin': '0',
                'aria-valuemax': '100',
                'aria-busy': 'true',
                ...opts.attrs
            },
            style: opts.style,
            theme: opts.theme,
            styleName: opts.styleName,
            state: opts.state
        });

        const box = new NTag({ tagName: 'div', className: 'n-progress__box' });
        this.#textTag = new NTag({ tagName: 'p', className: 'n-progress__text' });
        const track = new NTag({ tagName: 'div', className: 'n-progress__track' });
        this.#barTag = new NTag({ tagName: 'div', className: 'n-progress__bar' });

        track.append(this.#barTag);
        box.append(this.#textTag, track);
        this.append(box);
        this.hide();
    }

    // =========================================================================
    // Méthodes statiques
    // =========================================================================

    /**
     * Affiche l'indicateur de progression global monté sur `document.body` (le crée si nécessaire).
     *
     * @param {string} [message=''] - Texte descriptif optionnel.
     * @param {number|null} [value=null] - Pourcentage (`0..100`) ou `null` pour un état indéterminé.
     * @param {object} [options={}] - Options transmises lors de la création de l'instance globale.
     * @returns {NProgress} L'instance globale `NProgress`.
     *
     * @example <caption>Exemple 1 : Afficher une progression globale indéterminée</caption>
     * NProgress.show('Chargement...');
     *
     * @example <caption>Exemple 2 : Afficher une progression globale à 50 %</caption>
     * NProgress.show('Téléchargement', 50);
     */
    static show(message = '', value = null, options = {}) {
        if (!NProgress.#instance || NProgress.#instance.isDestroyed) {
            NProgress.#instance = new NProgress({ ...options, fixed: true });
            if (typeof document !== 'undefined' && document.body && NProgress.#instance.element) {
                document.body.appendChild(NProgress.#instance.element);
            }
        }
        return NProgress.#instance.showProgress(message, value);
    }

    /**
     * Met à jour le pourcentage et le libellé de l'instance globale.
     *
     * @param {number|null} value - Pourcentage (`0..100`) ou `null` pour un état indéterminé.
     * @param {string} [message] - Nouveau libellé optionnel.
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Mettre à jour le pourcentage</caption>
     * NProgress.set(75);
     *
     * @example <caption>Exemple 2 : Mettre à jour le pourcentage et le message</caption>
     * NProgress.set(100, 'Terminé');
     */
    static set(value, message) {
        NProgress.#instance?.setProgress(value, message);
    }

    /**
     * Masque l'indicateur de progression global s'il existe.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Masquer la progression globale</caption>
     * NProgress.hide();
     *
     * @example <caption>Exemple 2 : Masquer après un traitement asynchrone</caption>
     * await doWork().finally(() => NProgress.hide());
     */
    static hide() {
        NProgress.#instance?.hideProgress();
    }

    // =========================================================================
    // Méthodes d'instance
    // =========================================================================

    /**
     * Met à jour le libellé et le pourcentage, garantit le positionnement du parent et affiche la superposition.
     *
     * @param {string} [message=''] - Texte descriptif optionnel.
     * @param {number|null} [value=null] - Pourcentage (`0..100`) ou `null` pour indéterminé.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Afficher sur le conteneur parent</caption>
     * progress.showProgress('Préparation...');
     *
     * @example <caption>Exemple 2 : Afficher avec une valeur initiale</caption>
     * progress.showProgress('Analyse', 10);
     */
    showProgress(message = '', value = null) {
        const parent = this.element?.parentElement;
        if (parent && !this.hasClass('n-progress--fixed') && typeof getComputedStyle === 'function') {
            if (getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }
        }
        this.setProgress(value, message);
        this.show();
        return this;
    }

    /**
     * Met à jour la valeur (`0..100` ou indéterminée) et optionnellement le texte affiché.
     *
     * @param {number|null} value - Pourcentage (`0..100`) ou `null` pour indéterminé.
     * @param {string} [message] - Nouveau message optionnel.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir une progression à 65 %</caption>
     * progress.setProgress(65);
     *
     * @example <caption>Exemple 2 : Passer en mode indéterminé avec message</caption>
     * progress.setProgress(null, 'En attente du serveur...');
     */
    setProgress(value, message) {
        if (message !== undefined && this.#textTag) {
            this.#textTag.setText(message ? String(message) : '');
        }
        if (this.#barTag) {
            if (typeof value === 'number' && !Number.isNaN(value)) {
                const clamped = Math.max(0, Math.min(100, value));
                this.setAttr('aria-valuenow', String(clamped));
                this.#barTag
                    .removeClass('n-progress__bar--indeterminate')
                    .setStyle('width', `${clamped}%`);
            } else {
                this.setAttr('aria-valuenow', null);
                this.#barTag
                    .addClass('n-progress__bar--indeterminate')
                    .setStyle('width', '40%');
            }
        }
        return this;
    }

    /**
     * Masque la superposition de progression.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Masquer l'indicateur</caption>
     * progress.hideProgress();
     *
     * @example <caption>Exemple 2 : Masquer puis retirer une classe</caption>
     * progress.hideProgress().removeClass('is-busy');
     */
    hideProgress() {
        this.hide();
        return this;
    }

    /**
     * Détache l'instance statique si elle correspond et détruit le composant.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire un indicateur dédié</caption>
     * progress.destroy();
     *
     * @example <caption>Exemple 2 : Nettoyer lors du démontage d'un module</caption>
     * if (!progress.isDestroyed) {
     *     progress.destroy();
     * }
     */
    destroy() {
        if (NProgress.#instance === this) {
            NProgress.#instance = null;
        }
        this.#textTag = null;
        this.#barTag = null;
        super.destroy();
    }
}
