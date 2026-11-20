/**
 * @file NFrame.js
 * @package @nlib/js-frontend
 * @description Classe de base des vues et pages applicatives (`NFrame`) héritant de `NTag`.
 * Gère le titre, le lien de navigation, le mode flottant, la position de défilement,
 * les zones d'alerte d'état, le pull-to-refresh et le cycle de vie au sein de `NWindow`.
 */

import { NTag } from '../../elements/NTag.js';
import { NImage } from '../../elements/NImage.js';

/**
 * @class NFrame
 * @extends NTag
 * @description Représente une page ou vue conteneur gérée par `NWindow`.
 *
 * @example <caption>Exemple 1 : Créer une page simple avec titre et lien</caption>
 * const page = new NFrame({
 *     title: 'Accueil',
 *     link: '/home',
 *     text: 'Bienvenue'
 * });
 *
 * @example <caption>Exemple 2 : Créer une sous-classe de page personnalisée</caption>
 * class ProfileFrame extends NFrame {
 *     init() {
 *         this.setTitle('Profil');
 *         this.append(new NTag({ tagName: 'h1', text: 'Mon profil' }));
 *     }
 * }
 * const profile = new ProfileFrame();
 */
export class NFrame extends NTag {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Titre de la frame.
     * @type {string}
     * @private
     */
    #title = '';

    /**
     * Lien ou route associée à la frame.
     * @type {string}
     * @private
     */
    #link = '';

    /**
     * Lien de retour utilisé lors d'une navigation arrière.
     * @type {string}
     * @private
     */
    #backLink = '';

    /**
     * Indique si la frame s'affiche en mode flottant (superposé).
     * @type {boolean}
     * @private
     */
    #floating = false;

    /**
     * Indique si le geste pull-to-refresh est activé sur cette frame.
     * @type {boolean}
     * @private
     */
    #pullToRefresh = false;

    /**
     * Position horizontale de défilement sauvegardée.
     * @type {number}
     * @private
     */
    #scrollX = 0;

    /**
     * Position verticale de défilement sauvegardée.
     * @type {number}
     * @private
     */
    #scrollY = 0;

    /**
     * Zone d'alerte interne (`.n-frame__alert`) créée par `initAlert()`.
     * @type {NTag|null}
     * @private
     */
    #alertZone = null;

    /**
     * Icône de la zone d'alerte interne.
     * @type {NImage|null}
     * @private
     */
    #alertIcon = null;

    /**
     * Texte de la zone d'alerte interne.
     * @type {NTag|null}
     * @private
     */
    #alertText = null;

    // =========================================================================
    // Constructeur & Initialisation
    // =========================================================================

    /**
     * Crée une nouvelle instance `NFrame`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou nom de balise HTML.
     * @param {string} [options.tagName='div'] - Nom de la balise HTML racine.
     * @param {string} [options.title=''] - Titre de la frame.
     * @param {string} [options.link=''] - Lien ou route associée.
     * @param {string} [options.backLink=''] - Lien de retour arrière.
     * @param {boolean} [options.floating=false] - Active le mode flottant.
     * @param {boolean} [options.pullToRefresh=false] - Active le pull-to-refresh.
     *
     * @example <caption>Exemple 1 : Instanciation avec options</caption>
     * const frame = new NFrame({ title: 'Paramètres', link: '/settings', floating: true });
     *
     * @example <caption>Exemple 2 : Instanciation rapide par nom de balise</caption>
     * const section = new NFrame('section');
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { tagName: options }
            : (options && typeof options === 'object' ? options : {});

        const {
            title = '',
            link = '',
            backLink = '',
            floating = false,
            pullToRefresh = false,
            ...tagOpts
        } = opts;

        super({ tagName: 'div', ...tagOpts });

        this.addClass('n-frame');

        if (title) {
            this.setTitle(title);
        }
        if (link) {
            this.setLink(link);
        }
        if (backLink) {
            this.setBackLink(backLink);
        }

        this.setFloating(Boolean(floating));
        if (pullToRefresh) {
            this.setPullToRefresh(true);
        }

        this.init();
        this.applyLanguage();
    }

    /**
     * Point d'extension appelé à la fin du constructeur avant `applyLanguage()`.
     * Destiné à être redéfini dans les sous-classes pour construire le contenu de la page.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Redéfinir init() dans une sous-classe</caption>
     * class DashboardFrame extends NFrame {
     *     init() {
     *         this.setTitle('Tableau de bord');
     *     }
     * }
     *
     * @example <caption>Exemple 2 : Appel manuel de réinitialisation</caption>
     * const frame = new NFrame();
     * frame.init();
     */
    init() {
        // Point d'extension pour les sous-classes
    }

    // =========================================================================
    // Titre & Liens
    // =========================================================================

    /**
     * Définit le titre de la frame et met à jour `document.title` si elle est la frame active de `NWindow`.
     *
     * @param {string} title - Nouveau titre de la frame.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir le titre</caption>
     * frame.setTitle('Utilisateurs');
     *
     * @example <caption>Exemple 2 : Chaîner avec setLink</caption>
     * frame.setTitle('Utilisateurs').setLink('/users');
     */
    setTitle(title) {
        if (this.isDestroyed) {
            return this;
        }
        this.#title = (title === null || title === undefined) ? '' : String(title);
        const win = this.getWindow();
        if (win && typeof win.getCurrentFrame === 'function' && win.getCurrentFrame() === this) {
            if (typeof document !== 'undefined') {
                document.title = this.#title;
            }
        }
        return this;
    }

    /**
     * Retourne le titre courant de la frame.
     *
     * @returns {string} Titre de la frame.
     *
     * @example <caption>Exemple 1 : Lire le titre</caption>
     * const f = new NFrame({ title: 'Accueil' });
     * console.log(f.getTitle()); // 'Accueil'
     *
     * @example <caption>Exemple 2 : Titre par défaut</caption>
     * console.log(new NFrame().getTitle()); // ''
     */
    getTitle() {
        return this.#title;
    }

    /**
     * Définit le lien ou la route associée à cette frame.
     *
     * @param {string} link - Lien ou chemin de route.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir une route</caption>
     * frame.setLink('/products/42');
     *
     * @example <caption>Exemple 2 : Réinitialiser le lien</caption>
     * frame.setLink('');
     */
    setLink(link) {
        if (!this.isDestroyed) {
            this.#link = (link === null || link === undefined) ? '' : String(link);
        }
        return this;
    }

    /**
     * Retourne le lien associé à cette frame.
     *
     * @returns {string} Lien ou chaîne vide.
     *
     * @example <caption>Exemple 1 : Lire le lien</caption>
     * const f = new NFrame({ link: '/home' });
     * console.log(f.getLink()); // '/home'
     *
     * @example <caption>Exemple 2 : Lien par défaut</caption>
     * console.log(new NFrame().getLink()); // ''
     */
    getLink() {
        return this.#link;
    }

    /**
     * Vérifie si le lien fourni correspond exactement au lien de la frame.
     *
     * @param {string} link - Lien à comparer.
     * @returns {boolean} `true` si les liens sont identiques.
     *
     * @example <caption>Exemple 1 : Correspondance exacte</caption>
     * const f = new NFrame({ link: '/home' });
     * console.log(f.isLink('/home')); // true
     *
     * @example <caption>Exemple 2 : Lien différent</caption>
     * console.log(f.isLink('/about')); // false
     */
    isLink(link) {
        return this.#link === String(link ?? '');
    }

    /**
     * Définit le lien de retour utilisé lors d'une navigation arrière.
     *
     * @param {string} link - Lien de retour.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir un lien de retour</caption>
     * frame.setBackLink('/dashboard');
     *
     * @example <caption>Exemple 2 : Réinitialiser</caption>
     * frame.setBackLink('');
     */
    setBackLink(link) {
        if (!this.isDestroyed) {
            this.#backLink = (link === null || link === undefined) ? '' : String(link);
        }
        return this;
    }

    /**
     * Retourne le lien de retour associé à la frame.
     *
     * @returns {string} Lien de retour ou `''`.
     *
     * @example <caption>Exemple 1 : Lire le lien de retour</caption>
     * const f = new NFrame({ backLink: '/home' });
     * console.log(f.getBackLink()); // '/home'
     *
     * @example <caption>Exemple 2 : Valeur par défaut</caption>
     * console.log(new NFrame().getBackLink()); // ''
     */
    getBackLink() {
        return this.#backLink;
    }

    /**
     * Indique si le retour arrière depuis cette frame est autorisé.
     *
     * @returns {boolean} `true` si la navigation arrière est autorisée.
     *
     * @example <caption>Exemple 1 : Vérification par défaut</caption>
     * console.log(new NFrame().canGoBack()); // true
     *
     * @example <caption>Exemple 2 : Surcharge dans une sous-classe</caption>
     * class FormFrame extends NFrame {
     *     canGoBack() { return !this.getState('dirty', false); }
     * }
     */
    canGoBack() {
        return true;
    }

    // =========================================================================
    // Mode Flottant & Pull-To-Refresh
    // =========================================================================

    /**
     * Active ou désactive le mode flottant de la frame via la classe CSS `.n-frame--floating`.
     *
     * @param {boolean} [floating=true] - `true` pour afficher la frame en superposition.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Passer en mode flottant</caption>
     * frame.setFloating(true);
     * console.log(frame.isFloating()); // true
     *
     * @example <caption>Exemple 2 : Revenir en mode normal</caption>
     * frame.setFloating(false);
     */
    setFloating(floating = true) {
        if (this.isDestroyed) {
            return this;
        }
        this.#floating = Boolean(floating);
        this.toggleClass('n-frame--floating', this.#floating);
        return this;
    }

    /**
     * Indique si la frame est en mode flottant.
     *
     * @returns {boolean} `true` si la frame est flottante.
     *
     * @example <caption>Exemple 1 : Mode normal par défaut</caption>
     * console.log(new NFrame().isFloating()); // false
     *
     * @example <caption>Exemple 2 : Après activation</caption>
     * const modal = new NFrame({ floating: true });
     * console.log(modal.isFloating()); // true
     */
    isFloating() {
        return this.#floating;
    }

    /**
     * Active ou désactive la prise en charge du geste pull-to-refresh sur la frame.
     *
     * @param {boolean} [enabled=true] - `true` pour activer le pull-to-refresh.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer le pull-to-refresh</caption>
     * frame.setPullToRefresh(true);
     *
     * @example <caption>Exemple 2 : Désactiver le pull-to-refresh</caption>
     * frame.setPullToRefresh(false);
     */
    setPullToRefresh(enabled = true) {
        if (!this.isDestroyed) {
            this.#pullToRefresh = Boolean(enabled);
        }
        return this;
    }

    /**
     * Indique si le pull-to-refresh est activé sur cette frame.
     *
     * @returns {boolean} `true` si actif.
     *
     * @example <caption>Exemple 1 : Vérifier l'état par défaut</caption>
     * console.log(new NFrame().isPullToRefresh()); // false
     *
     * @example <caption>Exemple 2 : Vérifier après activation</caption>
     * const f = new NFrame({ pullToRefresh: true });
     * console.log(f.isPullToRefresh()); // true
     */
    isPullToRefresh() {
        return this.#pullToRefresh;
    }

    /**
     * Déclenche l'événement `'pullToRefresh'` sur la frame.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Écouter et déclencher le rafraîchissement</caption>
     * frame.on('pullToRefresh', () => console.log('Rechargement...'));
     * frame.onPullToRefresh();
     *
     * @example <caption>Exemple 2 : Chaîner après mise à jour</caption>
     * frame.onPullToRefresh().hideAlert();
     */
    onPullToRefresh() {
        if (!this.isDestroyed) {
            this.emit('pullToRefresh', { target: this });
        }
        return this;
    }

    // =========================================================================
    // Zone d'alerte / état vide
    // =========================================================================

    /**
     * Initialise la zone d'alerte interne (`.n-frame__alert`) dans `parentTag` (masquée par défaut).
     *
     * @param {NTag} [parentTag=this] - Conteneur cible recevant la zone d'alerte.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Initialiser dans la frame elle-même</caption>
     * frame.initAlert();
     *
     * @example <caption>Exemple 2 : Initialiser dans un conteneur enfant</caption>
     * const body = new NTag('div').mount(frame.element);
     * frame.initAlert(body);
     */
    initAlert(parentTag = this) {
        if (this.isDestroyed || this.#alertZone) {
            return this;
        }
        const target = parentTag instanceof NTag ? parentTag : this;

        const alertZone = new NTag({
            tagName: 'div',
            classes: ['n-frame__alert']
        });
        alertZone.hide();

        const alertIcon = new NImage({
            classes: ['n-frame__alert-icon'],
            attrs: { 'aria-hidden': 'true' }
        });

        const alertText = new NTag({
            tagName: 'p',
            classes: ['n-frame__alert-text']
        });

        alertZone.append(alertIcon, alertText);
        target.append(alertZone);

        this.#alertZone = alertZone;
        this.#alertIcon = alertIcon;
        this.#alertText = alertText;
        return this;
    }

    /**
     * Affiche la zone d'alerte interne avec un message et une URL d'icône optionnelle.
     * Initialise automatiquement la zone si `initAlert()` n'a pas encore été appelé.
     *
     * @param {string} message - Message à afficher.
     * @param {string|null} [icon=null] - URL de l'icône à afficher.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Afficher un message d'état vide</caption>
     * frame.showAlert('Aucun élément trouvé', '/icons/empty.svg');
     *
     * @example <caption>Exemple 2 : Afficher un message sans icône</caption>
     * frame.showAlert('Connexion requise');
     */
    showAlert(message, icon = null) {
        if (this.isDestroyed) {
            return this;
        }
        if (!this.#alertZone) {
            this.initAlert();
        }
        if (this.#alertIcon) {
            if (typeof icon === 'string' && icon.trim()) {
                this.#alertIcon.setSrc(icon.trim()).show();
            } else {
                this.#alertIcon.setSrc(null).hide();
            }
        }
        if (this.#alertText) {
            this.#alertText.setText(message ?? '');
        }
        this.#alertZone?.show();
        return this;
    }

    /**
     * Masque la zone d'alerte interne si elle est initialisée.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Masquer l'alerte après chargement</caption>
     * frame.hideAlert();
     *
     * @example <caption>Exemple 2 : Chaîner après affichage</caption>
     * frame.showAlert('Chargement...').hideAlert();
     */
    hideAlert() {
        if (this.#alertZone && !this.isDestroyed) {
            this.#alertZone.hide();
        }
        return this;
    }

    /**
     * Analyse une réponse de données (`{ error, message }` ou collection/tableau vide)
     * et affiche ou masque automatiquement la zone d'alerte.
     *
     * @param {any} data - Données ou réponse à vérifier.
     * @param {string} [emptyMessage='Aucune donnée'] - Message affiché si les données sont vides.
     * @returns {boolean} `true` si une alerte a été affichée, sinon `false`.
     *
     * @example <caption>Exemple 1 : Tableau vide affiche l'alerte</caption>
     * console.log(frame.verifyAlert([])); // true
     *
     * @example <caption>Exemple 2 : Données valides masquent l'alerte</caption>
     * console.log(frame.verifyAlert([{ id: 1 }])); // false
     */
    verifyAlert(data, emptyMessage = '') {
        if (!emptyMessage) {
            emptyMessage = this.util.lang.get('no_data');
        }
        if (data && typeof data === 'object' && !Array.isArray(data) && data.error) {
            this.showAlert(String(data.message || data.error), data.icon ?? null);
            return true;
        }
        if (this.util?.isEmpty?.(data)) {
            this.showAlert(emptyMessage);
            return true;
        }
        this.hideAlert();
        return false;
    }

    // =========================================================================
    // Défilement (Scroll) & Cycle de vie de navigation
    // =========================================================================

    /**
     * Sauvegarde la position de défilement courante (ou les coordonnées fournies).
     *
     * @param {number} [scrollX] - Position horizontale explicite.
     * @param {number} [scrollY] - Position verticale explicite.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Sauvegarder la position courante</caption>
     * frame.saveScrollPosition();
     *
     * @example <caption>Exemple 2 : Sauvegarder des coordonnées explicites</caption>
     * frame.saveScrollPosition(0, 240);
     */
    saveScrollPosition(scrollX, scrollY) {
        const el = this.element;
        if (typeof scrollX === 'number' && Number.isFinite(scrollX)) {
            this.#scrollX = scrollX;
        } else if (this.#floating && el) {
            this.#scrollX = el.scrollLeft || 0;
        } else if (typeof document !== 'undefined' && document.documentElement) {
            this.#scrollX = document.documentElement.scrollLeft || 0;
        }

        if (typeof scrollY === 'number' && Number.isFinite(scrollY)) {
            this.#scrollY = scrollY;
        } else if (this.#floating && el) {
            this.#scrollY = el.scrollTop || 0;
        } else if (typeof document !== 'undefined' && document.documentElement) {
            this.#scrollY = document.documentElement.scrollTop || 0;
        }
        return this;
    }

    /**
     * Restaure la position de défilement selon les paramètres de navigation (`scrollToTag`, `scrollTo`, `isBack`).
     *
     * @param {Object} [params={}] - Paramètres de transition fournis par `NWindow`.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Restaurer après un retour arrière</caption>
     * frame.restoreScrollPosition({ isBack: true });
     *
     * @example <caption>Exemple 2 : Défiler vers une position précise</caption>
     * frame.restoreScrollPosition({ scrollTo: { x: 0, y: 300 } });
     */
    restoreScrollPosition(params = {}) {
        const p = (params && typeof params === 'object') ? params : {};
        if (p.scrollToTag instanceof NTag) {
            p.scrollToTag.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return this;
        }
        if (p.scrollTo && typeof p.scrollTo === 'object') {
            return this.scrollTo(p.scrollTo.x ?? 0, p.scrollTo.y ?? 0);
        }
        if (p.isBack) {
            return this.scrollTo(this.#scrollX, this.#scrollY);
        }
        return this.scrollTo(0, 0);
    }

    /**
     * Fait défiler la frame (ou le document si non flottante) aux coordonnées indiquées.
     *
     * @param {number} [scrollX=0] - Coordonnée horizontale cible.
     * @param {number} [scrollY=0] - Coordonnée verticale cible.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Remonter en haut de la page</caption>
     * frame.scrollTo(0, 0);
     *
     * @example <caption>Exemple 2 : Défiler à 400px verticalement</caption>
     * frame.scrollTo(0, 400);
     */
    scrollTo(scrollX = 0, scrollY = 0) {
        const x = Number(scrollX) || 0;
        const y = Number(scrollY) || 0;
        const target = this.#floating ? this.element : (typeof document !== 'undefined' ? document.documentElement : null);
        if (target && typeof target.scrollTo === 'function') {
            this.requestAnimationFrame(() => {
                target.scrollTo({ left: x, top: y });
            });
        }
        return this;
    }

    /**
     * Appelé par `NWindow` lorsque la frame passe au premier plan (devient active).
     * Restaure la position de défilement et émet l'événement `'activate'`.
     *
     * @param {Object} [params={}] - Paramètres de transition.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Écouter l'activation de la page</caption>
     * frame.on('activate', () => console.log('Page visible'));
     *
     * @example <caption>Exemple 2 : Appel direct</caption>
     * frame.onActivate({ isNew: true });
     */
    onActivate(params = {}) {
        if (!this.isDestroyed) {
            this.restoreScrollPosition(params);
            this.emit('activate', { params, target: this });
        }
        return this;
    }

    /**
     * Appelé par `NWindow` lorsque la frame passe en arrière-plan.
     * Sauvegarde la position de défilement et émet l'événement `'deactivate'`.
     *
     * @param {Object} [params={}] - Paramètres de transition.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Écouter la mise en arrière-plan</caption>
     * frame.on('deactivate', () => console.log('Page masquée'));
     *
     * @example 2 : Appel direct</caption>
     * frame.onDeactivate();
     */
    onDeactivate(params = {}) {
        if (!this.isDestroyed) {
            this.saveScrollPosition();
            this.emit('deactivate', { params, target: this });
        }
        return this;
    }

    /**
     * Appelé lorsque l'application ou la fenêtre reprend son activité (point d'extension pour les sous-classes).
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Redéfinir dans une sous-classe</caption>
     * class LiveFrame extends NFrame {
     *     onResume() { console.log('Reprise'); return this; }
     * }
     *
     * @example <caption>Exemple 2 : Appel direct</caption>
     * frame.onResume();
     */
    onResume() {
        return this;
    }

    /**
     * Appelé lorsque l'application ou la fenêtre est mise en pause (point d'extension pour les sous-classes).
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Redéfinir dans une sous-classe</caption>
     * class LiveFrame extends NFrame {
     *     onPause() { console.log('Pause'); return this; }
     * }
     *
     * @example <caption>Exemple 2 : Appel direct</caption>
     * frame.onPause();
     */
    onPause() {
        return this;
    }

    /**
     * Appelé lorsque la fenêtre reçoit le focus (point d'extension pour les sous-classes).
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Redéfinir dans une sous-classe</caption>
     * class FormFrame extends NFrame {
     *     onFocus() { console.log('Focus fenêtre'); return this; }
     * }
     *
     * @example <caption>Exemple 2 : Appel direct</caption>
     * frame.onFocus();
     */
    onFocus() {
        return this;
    }

    /**
     * Appelé lorsque la fenêtre perd le focus (point d'extension pour les sous-classes).
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Redéfinir dans une sous-classe</caption>
     * class FormFrame extends NFrame {
     *     onBlur() { console.log('Blur fenêtre'); return this; }
     * }
     *
     * @example <caption>Exemple 2 : Appel direct</caption>
     * frame.onBlur();
     */
    onBlur() {
        return this;
    }

    /**
     * Détruit la frame, libère ses références internes et détruit ses enfants DOM.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire une frame</caption>
     * frame.destroy();
     * console.log(frame.isDestroyed); // true
     *
     * @example <caption>Exemple 2 : Nettoyage conditionnel</caption>
     * if (!frame.isDestroyed) frame.destroy();
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }
        this.#alertZone = null;
        this.#alertIcon = null;
        this.#alertText = null;
        super.destroy();
    }

    // =========================================================================
    // Méthodes statiques (Contrat avec NWindow)
    // =========================================================================

    /**
     * Valide si un lien est autorisé pour cette classe de frame.
     *
     * @param {any} windowInstance - Instance `NWindow` appelante.
     * @param {Object} [params={}] - Paramètres de navigation.
     * @returns {boolean} `true` si la navigation est autorisée.
     *
     * @example <caption>Exemple 1 : Validation par défaut</caption>
     * console.log(NFrame.validateLink(appWindow, { link: '/home' })); // true
     *
     * @example <caption>Exemple 2 : Surcharge dans une page protégée</caption>
     * class AdminFrame extends NFrame {
     *     static validateLink(windowInstance) { return Boolean(windowInstance); }
     * }
     */
    static validateLink(windowInstance, params = {}) {
        return true;
    }

    /**
     * Indique si la frame créée par cette classe doit être affichée en mode flottant.
     *
     * @param {any} windowInstance - Instance `NWindow` appelante.
     * @param {Object} [params={}] - Paramètres de navigation.
     * @returns {boolean} `true` si la frame est flottante.
     *
     * @example <caption>Exemple 1 : Vérification par défaut</caption>
     * console.log(NFrame.isFloating(appWindow)); // false
     *
     * @example <caption>Exemple 2 : Sous-classe modale flottante</caption>
     * class ModalFrame extends NFrame {
     *     static isFloating() { return true; }
     * }
     */
    static isFloating(windowInstance, params = {}) {
        return false;
    }

    /**
     * Fabrique statique créant une nouvelle instance de frame associée à `windowInstance`.
     *
     * @param {any} windowInstance - Instance `NWindow` parente.
     * @param {Object} [params={}] - Options transmises au constructeur.
     * @returns {{ window: any, isNew: boolean, frame: NFrame }} Descripteur de frame créée.
     *
     * @example <caption>Exemple 1 : Création via la fabrique statique</caption>
     * const res = NFrame.createFrame(appWindow, { title: 'Accueil' });
     * console.log(res.isNew, res.frame instanceof NFrame); // true true
     *
     * @example <caption>Exemple 2 : Création d'une sous-classe</caption>
     * class HomeFrame extends NFrame {}
     * const res = HomeFrame.createFrame(appWindow);
     * console.log(res.frame instanceof HomeFrame); // true
     */
    static createFrame(windowInstance, params = {}) {
        const opts = (params && typeof params === 'object') ? params : {};
        return {
            window: windowInstance ?? null,
            isNew: true,
            frame: new this({ ...opts, window: windowInstance ?? null })
        };
    }
}

export default NFrame;
