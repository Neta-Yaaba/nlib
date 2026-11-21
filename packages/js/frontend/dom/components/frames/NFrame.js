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
 * @example <caption>Exemple 1 : Créer une page simple avec titre et URL</caption>
 * const page = new NFrame({
 *     title: 'Accueil',
 *     url: 'https://app.example.com/home',
 *     text: 'Bienvenue'
 * });
 *
 * @example <caption>Exemple 2 : Créer une sous-classe de page personnalisée</caption>
 * class ProfileFrame extends NFrame {
 *     _init() {
 *         this.setTitle('Profil');
 *         this.append(new NTag({ tagName: 'h1', text: 'Mon profil' }));
 *     }
 * }
 * const profile = new ProfileFrame();
 */
export class NFrame extends NTag {

    /**
     * Indique si les instances créées par cette classe s'affichent par défaut en mode flottant.
     * @type {boolean}
     */
    static overlay = false;

    /**
     * Pattern de route associe a la classe de frame (`string` comme `'/users/:id'`, `RegExp`, ou `null`).
     *
     * @type {string|RegExp|null}
     */
    static route = null;

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
     * URL associée à la frame.
     * @type {string}
     * @private
     */
    #url = '';

    /**
     * URL de retour utilisée lors d'une navigation arrière.
     * @type {string}
     * @private
     */
    #backUrl = '';

    /**
     * Indique si la frame s'affiche en mode flottant (superposé).
     * @type {boolean}
     * @private
     */
    #overlay = false;

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
     * @param {string} [options.url=''] - URL associée à la frame.
     * @param {string} [options.backUrl=''] - URL de retour arrière.
     * @param {boolean} [options.overlay=false] - Active le mode superposition (`overlay`).
     * @param {boolean} [options.pullToRefresh=false] - Active le pull-to-refresh.
     *
     * @example <caption>Exemple 1 : Instanciation avec options</caption>
     * const frame = new NFrame({ title: 'Paramètres', url: 'https://app.example.com/settings', overlay: true });
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
            url = '',
            backUrl = '',
            overlay = Boolean(new.target.overlay),
            pullToRefresh = false,
            ...tagOpts
        } = opts;

        super({ tagName: 'div', ...tagOpts });

        this.addClass('n-frame');

        if (title) {
            this.setTitle(title);
        }
        if (url) {
            this.setUrl(url);
        }
        if (backUrl) {
            this.setBackUrl(backUrl);
        }

        this.setOverlay(Boolean(overlay));
        if (pullToRefresh) {
            this.setPullToRefresh(true);
        }
    }

    /**
     * Point d'extension protégé hérité de `NObject`, appelé automatiquement en micro-tâche après la construction.
     * Destiné à être redéfini dans les sous-classes pour construire le contenu de la page.
     *
     * @protected
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Redéfinir _init() dans une sous-classe</caption>
     * class DashboardFrame extends NFrame {
     *     _init() {
     *         this.setTitle('Tableau de bord');
     *     }
     * }
     *
     * @example <caption>Exemple 2 : Appeler super._init() lors d'un héritage</caption>
     * class AdminDashboardFrame extends DashboardFrame {
     *     _init() {
     *         super._init();
     *         this.addClass('admin-view');
     *     }
     * }
     */
    _init() {
        // Point d'extension protégé pour les sous-classes
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
     * @example <caption>Exemple 2 : Chaîner avec setUrl</caption>
     * frame.setTitle('Utilisateurs').setUrl('https://app.example.com/users');
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
     * Définit l'URL associée à cette frame.
     *
     * @param {string} url - URL associée à la frame.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir une URL</caption>
     * frame.setUrl('https://app.example.com/products/42');
     *
     * @example <caption>Exemple 2 : Réinitialiser l'URL</caption>
     * frame.setUrl('');
     */
    setUrl(url) {
        if (!this.isDestroyed) {
            this.#url = (url === null || url === undefined) ? '' : String(url);
        }
        return this;
    }

    /**
     * Retourne l'URL associée à cette frame.
     *
     * @returns {string} URL ou chaîne vide.
     *
     * @example <caption>Exemple 1 : Lire l'URL</caption>
     * const f = new NFrame({ url: 'https://app.example.com/home' });
     * console.log(f.getUrl()); // 'https://app.example.com/home'
     *
     * @example <caption>Exemple 2 : URL par défaut</caption>
     * console.log(new NFrame().getUrl()); // ''
     */
    getUrl() {
        return this.#url;
    }

    /**
     * Vérifie si l'URL fournie correspond à cette frame (égalité exacte par défaut, redéfinissable en sous-classe
     * pour associer plusieurs URLs ou sous-routes à une même instance).
     *
     * @param {string} url - URL à comparer.
     * @returns {boolean} `true` si la frame correspond à cette URL.
     *
     * @example <caption>Exemple 1 : Comparaison exacte par défaut</caption>
     * const f = new NFrame({ url: 'https://app.example.com/home' });
     * console.log(f.matchesUrl('https://app.example.com/home')); // true
     *
     * @example <caption>Exemple 2 : Redéfinir matchesUrl pour partager une frame sur plusieurs URLs</caption>
     * class UserFrame extends NFrame {
     *     matchesUrl(url) {
     *         return url.startsWith('https://app.example.com/users/1');
     *     }
     * }
     */
    matchesUrl(url) {
        return this.#url === String(url ?? '');
    }

    /**
     * Définit l'URL de retour utilisée lors d'une navigation arrière.
     *
     * @param {string} url - URL de retour.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir une URL de retour</caption>
     * frame.setBackUrl('https://app.example.com/dashboard');
     *
     * @example <caption>Exemple 2 : Réinitialiser</caption>
     * frame.setBackUrl('');
     */
    setBackUrl(url) {
        if (!this.isDestroyed) {
            this.#backUrl = (url === null || url === undefined) ? '' : String(url);
        }
        return this;
    }

    /**
     * Retourne l'URL de retour associée à la frame.
     *
     * @returns {string} URL de retour ou `''`.
     *
     * @example <caption>Exemple 1 : Lire l'URL de retour</caption>
     * const f = new NFrame({ backUrl: 'https://app.example.com/home' });
     * console.log(f.getBackUrl()); // 'https://app.example.com/home'
     *
     * @example <caption>Exemple 2 : Valeur par défaut</caption>
     * console.log(new NFrame().getBackUrl()); // ''
     */
    getBackUrl() {
        return this.#backUrl;
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
     * Active ou désactive le mode superposition (`overlay`) de la frame via la classe CSS `.n-frame--overlay`.
     *
     * @param {boolean} [overlay=true] - `true` pour afficher la frame en superposition.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Passer en mode overlay</caption>
     * frame.setOverlay(true);
     * console.log(frame.isOverlay()); // true
     *
     * @example <caption>Exemple 2 : Revenir en mode normal</caption>
     * frame.setOverlay(false);
     */
    setOverlay(overlay = true) {
        if (this.isDestroyed) {
            return this;
        }
        this.#overlay = Boolean(overlay);
        this.toggleClass('n-frame--overlay', this.#overlay);
        return this;
    }

    /**
     * Indique si la frame est en mode superposition (`overlay`).
     *
     * @returns {boolean} `true` si la frame est en mode overlay.
     *
     * @example <caption>Exemple 1 : Mode normal par défaut</caption>
     * console.log(new NFrame().isOverlay()); // false
     *
     * @example <caption>Exemple 2 : Après activation</caption>
     * const modal = new NFrame({ overlay: true });
     * console.log(modal.isOverlay()); // true
     */
    isOverlay() {
        return this.#overlay;
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
        } else if (this.#overlay && el) {
            this.#scrollX = el.scrollLeft || 0;
        } else if (typeof document !== 'undefined' && document.documentElement) {
            this.#scrollX = document.documentElement.scrollLeft || 0;
        }

        if (typeof scrollY === 'number' && Number.isFinite(scrollY)) {
            this.#scrollY = scrollY;
        } else if (this.#overlay && el) {
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
     * Fait défiler la frame (ou le document si non overlay) aux coordonnées indiquées.
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
        const target = this.#overlay ? this.element : (typeof document !== 'undefined' ? document.documentElement : null);
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
     * Vérifie si une URL correspond à la route déclarée sur la classe de frame et extrait les paramètres dynamiques.
     * Prend en charge `static route` sous forme de `RegExp` ou de motif textuel (`/users/:id`, `/docs/*`).
     * Retourne un objet contenant les paramètres extraits en cas de correspondance, ou `false` sinon.
     *
     * @param {string} url - URL complète ou chemin à évaluer.
     * @param {Object} [params={}] - Paramètres de navigation déjà analysés (ex. `{ path, query }`).
     * @returns {Object|boolean} Objet de paramètres extraits si la route correspond, sinon `false`.
     *
     * @example <caption>Exemple 1 : Route paramétrée</caption>
     * class UserFrame extends NFrame {
     *     static route = '/users/:id';
     * }
     * const match = UserFrame.matchUrl('https://app.example.com/users/42');
     * // match => { id: '42' }
     *
     * @example <caption>Exemple 2 : Route par expression régulière</caption>
     * class DocsFrame extends NFrame {
     *     static route = /^\/docs\/(.+)$/;
     * }
     * const match = DocsFrame.matchUrl('https://app.example.com/docs/guide/intro');
     * // match => { 0: 'guide/intro' }
     */
    static matchUrl(url, params = {}) {
        const route = this.route;
        if (!route) return false;

        let path = (params && typeof params.path === 'string' && params.path) ? params.path : '';
        if (!path) {
            const raw = String(url || '').trim();
            if (!raw) return false;
            try {
                path = new URL(raw, 'http://localhost').pathname || '/';
            } catch {
                path = raw.split('?')[0].split('#')[0] || '/';
            }
        }
        if (!path.startsWith('/')) path = `/${path}`;

        if (route instanceof RegExp) {
            const m = route.exec(path);
            if (!m) return false;
            const extracted = {};
            if (m.groups) {
                Object.assign(extracted, m.groups);
            }
            for (let i = 1; i < m.length; i++) {
                extracted[i - 1] = m[i];
            }
            return extracted;
        }

        if (typeof route === 'string') {
            const normRoute = route === '/' ? '/' : route.replace(/\/+$/, '');
            const normPath = path === '/' ? '/' : path.replace(/\/+$/, '');
            const routeSegs = normRoute.split('/').filter(Boolean);
            const pathSegs = normPath.split('/').filter(Boolean);

            const extracted = {};
            for (let i = 0; i < routeSegs.length; i++) {
                const seg = routeSegs[i];
                if (seg === '*') {
                    extracted['*'] = pathSegs.slice(i).join('/');
                    return extracted;
                }
                if (i >= pathSegs.length) return false;
                if (seg.startsWith(':')) {
                    const key = seg.slice(1);
                    try {
                        extracted[key] = decodeURIComponent(pathSegs[i]);
                    } catch {
                        extracted[key] = pathSegs[i];
                    }
                } else if (seg !== pathSegs[i]) {
                    return false;
                }
            }
            return routeSegs.length === pathSegs.length ? extracted : false;
        }

        return false;
    }

    /**
     * Garde d'accès statique indiquant si cette frame peut être activée pour les paramètres donnés.
     * Retourne un objet décrivant la décision (`{ status: 'allow' }`, `{ status: 'deny', reason? }` ou `{ status: 'redirect', url, params? }`).
     *
     * @param {Object} [params={}] - Paramètres de navigation résolus.
     * @returns {{ status: 'allow' | 'deny' | 'redirect', url?: string, params?: Object, reason?: string }} Décision de garde.
     *
     * @example <caption>Exemple 1 : Autorisation par défaut</caption>
     * console.log(NFrame.canActivate({ url: 'https://app.example.com/home' }));
     * // { status: 'allow' }
     *
     * @example <caption>Exemple 2 : Refus ou redirection dans une sous-classe</caption>
     * class AdminFrame extends NFrame {
     *     static canActivate(params) {
     *         if (!params.isAuthenticated) {
     *             return { status: 'redirect', url: 'https://app.example.com/login' };
     *         }
     *         return params.isAdmin ? { status: 'allow' } : { status: 'deny', reason: 'forbidden' };
     *     }
     * }
     */
    static canActivate(params = {}) {
        return { status: 'allow' };
    }

    /**
     * Fabrique statique créant une nouvelle instance de frame à partir de `params`.
     *
     * @param {Object} [params={}] - Options et paramètres transmis au constructeur.
     * @returns {NFrame|null} Instance créée ou `null` si annulée.
     *
     * @example <caption>Exemple 1 : Création via la fabrique statique</caption>
     * const frame = NFrame.create({ title: 'Accueil' });
     * console.log(frame instanceof NFrame); // true
     *
     * @example <caption>Exemple 2 : Création d'une sous-classe</caption>
     * class HomeFrame extends NFrame {}
     * const home = HomeFrame.create({ title: 'Accueil' });
     * console.log(home instanceof HomeFrame); // true
     */
    static create(params = {}) {
        const opts = (params && typeof params === 'object') ? params : {};
        opts.isNew = true;
        return new this(opts);
    }
}

export default NFrame;
