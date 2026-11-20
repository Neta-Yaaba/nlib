/**
 * @file NToast.js
 * @package @nlib/js-frontend
 * @description Composant de notification toast temporaire (`NToast`) héritant de `NTag`.
 * Fournit une API statique (`NToast.show`, `NToast.hide`) avec gestion automatique
 * d'une instance partagée, variantes de statut et minuterie d'auto-fermeture.
 */

import { NTag } from '../../elements/NTag.js';

/**
 * @class NToast
 * @extends NTag
 * @description Panneau de notification toast superposé (`div.n-toast`).
 *
 * @example <caption>Exemple 1 : Afficher une notification via la méthode statique</caption>
 * NToast.show('Enregistrement effectué', { type: 'success' });
 *
 * @example <caption>Exemple 2 : Afficher une alerte persistante puis la masquer</caption>
 * NToast.show('Mode hors-ligne actif', { type: 'warning', duration: 0 });
 * NToast.hide();
 */
export class NToast extends NTag {

    // =========================================================================
    // Propriétés statiques
    // =========================================================================

    /**
     * Instance partagée utilisée par `NToast.show()` et `NToast.hide()`.
     * @type {NToast|null}
     */
    static #instance = null;

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Identifiant du minuteur de masquage automatique.
     * @type {ReturnType<typeof setTimeout>|null}
     */
    #timer = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée un composant `NToast` masqué par défaut et le monte dans `document.body`.
     *
     * @param {object} [options={}] - Options de configuration.
     * @param {string} [options.id] - Identifiant DOM optionnel.
     * @param {string|string[]} [options.classes] - Classes CSS additionnelles.
     * @param {Object<string, any>} [options.attrs] - Attributs HTML additionnels.
     * @param {Object<string, string>} [options.style] - Styles CSS inline.
     * @param {string} [options.theme] - Thème appliqué au composant.
     * @param {string} [options.styleName] - Style visuel appliqué au composant.
     * @param {object} [options.state] - État initial transmis à `NTag` / `NObject`.
     *
     * @example <caption>Exemple 1 : Instancier un toast personnalisé</caption>
     * const toast = new NToast({ theme: 'dark' });
     * toast.showMessage('Bienvenue');
     *
     * @example <caption>Exemple 2 : Instancier un toast avec classes personnalisées</caption>
     * const toast = new NToast({ classes: ['custom-toast'] });
     */
    constructor(options = {}) {
        const opts = options && typeof options === 'object' ? options : {};

        super({
            tagName: 'div',
            id: opts.id,
            className: 'n-toast',
            classes: opts.classes,
            attrs: {
                role: 'status',
                'aria-live': 'polite',
                ...opts.attrs
            },
            style: opts.style,
            theme: opts.theme,
            styleName: opts.styleName,
            state: opts.state
        });

        this.hide();

        if (typeof document !== 'undefined' && document.body && this.element) {
            document.body.appendChild(this.element);
        }
    }

    // =========================================================================
    // Méthodes statiques
    // =========================================================================

    /**
     * Affiche un message toast via l'instance statique partagée (la crée si nécessaire).
     *
     * @param {string} message - Texte du message à afficher.
     * @param {object} [options={}] - Options d'affichage.
     * @param {string} [options.type='info'] - Variante (`info`, `success`, `warning`, `error`).
     * @param {number} [options.duration=3000] - Durée en millisecondes (`0` pour persistant).
     * @param {string} [options.position='bottom'] - Position verticale (`bottom`, `top`).
     * @returns {NToast} L'instance partagée `NToast`.
     *
     * @example <caption>Exemple 1 : Afficher un toast de succès</caption>
     * NToast.show('Profil mis à jour', { type: 'success' });
     *
     * @example <caption>Exemple 2 : Afficher une erreur en haut de l'écran</caption>
     * NToast.show('Erreur réseau', { type: 'error', position: 'top', duration: 5000 });
     */
    static show(message, options = {}) {
        if (!NToast.#instance || NToast.#instance.isDestroyed) {
            NToast.#instance = new NToast(options);
        }
        return NToast.#instance.showMessage(message, options);
    }

    /**
     * Masque le toast de l'instance statique partagée s'il existe.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Masquer le toast actif</caption>
     * NToast.hide();
     *
     * @example <caption>Exemple 2 : Masquer après une action utilisateur</caption>
     * button.on('click', () => NToast.hide());
     */
    static hide() {
        NToast.#instance?.hideMessage();
    }

    // =========================================================================
    // Méthodes d'instance
    // =========================================================================

    /**
     * Met à jour le texte, la variante et la position du toast, puis l'affiche.
     *
     * @param {string} message - Texte à afficher.
     * @param {object} [options={}] - Options d'affichage.
     * @param {string} [options.type='info'] - Variante (`info`, `success`, `warning`, `error`).
     * @param {number} [options.duration=3000] - Durée en millisecondes (`0` pour persistant).
     * @param {string} [options.position='bottom'] - Position verticale (`bottom`, `top`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Afficher une notification d'information</caption>
     * toast.showMessage('Synchronisation démarrée');
     *
     * @example <caption>Exemple 2 : Afficher une erreur persistante</caption>
     * toast.showMessage('Session expirée', { type: 'error', duration: 0 });
     */
    showMessage(message, options = {}) {
        const type = options.type || 'info';
        const duration = options.duration !== undefined ? options.duration : 3000;
        const position = options.position === 'top' ? 'top' : 'bottom';

        if (this.#timer !== null) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }

        this.removeClass(
            'n-toast--info',
            'n-toast--success',
            'n-toast--warning',
            'n-toast--error',
            'n-toast--top',
            'n-toast--bottom'
        )
            .addClass(`n-toast--${type}`, `n-toast--${position}`)
            .setText(message ? String(message) : '')
            .show();

        if (duration > 0) {
            this.#timer = setTimeout(() => {
                this.hideMessage();
            }, duration);
        }

        return this;
    }

    /**
     * Annule la minuterie active et masque le toast.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Masquer manuellement le toast</caption>
     * toast.hideMessage();
     *
     * @example <caption>Exemple 2 : Enchaîner le masquage avec un autre appel</caption>
     * toast.hideMessage().removeClass('custom-highlight');
     */
    hideMessage() {
        if (this.#timer !== null) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
        this.hide();
        return this;
    }

    /**
     * Annule la minuterie, détache l'instance statique si elle correspond et détruit le composant.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire un toast dédié</caption>
     * toast.destroy();
     *
     * @example <caption>Exemple 2 : Nettoyer lors du démontage d'un module</caption>
     * if (!toast.isDestroyed) {
     *     toast.destroy();
     * }
     */
    destroy() {
        if (this.#timer !== null) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
        if (NToast.#instance === this) {
            NToast.#instance = null;
        }
        super.destroy();
    }
}
