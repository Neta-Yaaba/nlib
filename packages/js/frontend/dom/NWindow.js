/**
 * @file NWindow.js
 * @package @nlib/js-frontend
 * @description Composant fenêtre applicative (`NWindow`) héritant de `NTag` (`div.n-window`).
 * Orchestre les vues (`NFrame`), le registre de routes/frames, la navigation,
 * l'historique interne et navigateur, le cycle de vie de l'onglet et le pull-to-refresh.
 */

import { NUtil } from '../../backend/index.js';
import { NTag } from './elements/NTag.js';

/**
 * @class NWindow
 * @extends NTag
 * @description Conteneur applicatif `div.n-window` gérant les vues `NFrame`, la navigation et le cycle de vie.
 *
 * @example <caption>Exemple 1 : Initialiser NWindow et enregistrer une frame</caption>
 * const app = new NWindow({
 *     theme: 'auto',
 *     styleName: 'glass'
 * });
 * app.registerFrame(HomeFrame);
 * app.navigate(`${app.getBaseUrl()}/home`);
 *
 * @example <caption>Exemple 2 : Récupérer l'instance unique et revenir en arrière</caption>
 * const win = NWindow.instance();
 * if (win) {
 *     win.back();
 * }
 */
export class NWindow extends NTag {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * URL initiale résolue à l'ouverture de la fenêtre.
     * @type {string}
     */
    #initialUrl = '';

    /**
     * Registre des classes de frames enregistrées pour le routage (ordre d'insertion) et leurs options (`overlay`).
     * @type {Map<Function, { overlay: boolean }>}
     */
    #frameRegistry = new Map();

    /**
     * Liste des instances `NFrame` actuellement montées.
     * @type {Array<import('./components/frames/NFrame.js').NFrame>}
     */
    #frames = [];

    /**
     * Frame actuellement active au premier plan.
     * @type {import('./components/frames/NFrame.js').NFrame|null}
     */
    #currentFrame = null;

    /**
     * Pile d'historique de navigation interne contenant uniquement les liens des frames.
     * @type {Array<string>}
     */
    #history = [];

    /**
     * Compteur de z-index pour les frames flottantes superposées.
     * @type {number}
     */
    #overlayZIndex = 1000;

    /**
     * Liste des fonctions de détachement des écouteurs DOM/navigateur.
     * @type {Array<Function>}
     */
    #cleanups = [];

    /**
     * Coordonnée Y de départ pour la détection du pull-to-refresh.
     * @type {number|null}
     */
    #pullStartY = null;

    /**
     * Dernier déplacement vertical mesuré lors du geste pull-to-refresh.
     * @type {number}
     */
    #pullDeltaY = 0;

    /**
     * Indicateur visuel affiché lors du geste pull-to-refresh.
     * @type {NTag|null}
     */
    #pullIndicatorTag = null;

    /**
     * Écouteurs globaux attachés sur `document` / `window` pour `scroll` et `resize` (initialisation paresseuse).
     * @type {Map<string, {target: EventTarget, handler: Function}>|null}
     */
    #globalBridges = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une instance de `NWindow` (`div.n-window`), la monte dans le conteneur cible
     * et attache les écouteurs de cycle de vie.
     *
     * @param {object} [options={}] - Options de configuration de la fenêtre.
     * @param {string} [options.id] - Identifiant DOM optionnel de la fenêtre.
     * @param {string|string[]} [options.classes] - Classes CSS additionnelles.
     * @param {Object<string, any>} [options.attrs] - Attributs HTML additionnels.
     * @param {string} [options.theme] - Thème appliqué à la fenêtre (`light`, `dark`, `auto`, `system`).
     * @param {string} [options.styleName] - Style visuel appliqué à la fenêtre (`default`, `glass`).
     * @param {Object<string, string>} [options.style] - Styles CSS inline appliqués à la balise racine.
     * @param {object} [options.config] - Paires clé/valeur injectées dans `NUtil.config` (ex. `{ baseUrl }`).
     * @param {Array<Function|Array|object>|Object<string, Function|Array|object>} [options.frames] - Liste ou dictionnaire initial des frames (`FrameClass`, `[FrameClass, overlay]` ou `{ FrameClass, overlay }`) enregistrées au démarrage.
     * @param {object} [options.state] - État initial transmis à `NTag` / `NObject`.
     *
     * @example <caption>Exemple 1 : Création standard</caption>
     * const win = new NWindow({ theme: 'light', styleName: 'default' });
     *
     * @example <caption>Exemple 2 : Création avec configuration</caption>
     * const win = new NWindow({
     *     config: { baseUrl: 'https://app.example.com' }
     * });
     */
    constructor(options = {}) {
        if (typeof document !== 'undefined' && document.body?._nwindow) {
            return document.body._nwindow;
        }

        const opts = options && typeof options === 'object' ? options : {};

        super({
            tagName: 'div',
            id: opts.id,
            className: 'n-window',
            classes: opts.classes,
            attrs: opts.attrs,
            style: opts.style && typeof opts.style === 'object' ? opts.style : undefined,
            theme: opts.theme,
            styleName: opts.styleName || undefined,
            state: opts.state
        });

        if (opts.config && typeof opts.config === 'object') {
            for (const [key, value] of Object.entries(opts.config)) {
                this.util.config.set(key, value);
            }
        }

        if (typeof document !== 'undefined' && document.body) {
            Object.defineProperty(document.body, '_nwindow', {
                value: this,
                configurable: true,
                writable: true
            });
            if (this.element) {
                document.body.appendChild(this.element);
            }
        }

        const frameEntries = Array.isArray(opts.frames)
            ? opts.frames
            : (opts.frames && typeof opts.frames === 'object' ? Object.values(opts.frames) : []);

        for (const entry of frameEntries) {
            if (typeof entry === 'function') {
                this.registerFrame(entry);
            } else if (Array.isArray(entry)) {
                this.registerFrame(entry[0], entry[1]);
            } else if (entry && typeof entry === 'object') {
                this.registerFrame(entry.FrameClass || entry.frame, entry.overlay);
            }
        }

        const currentUrl = NUtil.sys.getBrowserUrl();
        const welcomeLink = this.getWelcomeUrl();
        if (welcomeLink && currentUrl.includes(welcomeLink)) {
            this.setInitialUrl(this.getHomeUrl() || '');
        } else {
            this.setInitialUrl(currentUrl);
        }

        const initialParams = this.linkToParams(this.#initialUrl);
        if (initialParams) {
            initialParams.isFirst = true;
            const resolved = this.resolveFrame(initialParams);
            if (resolved?.overlay) {
                this.setInitialUrl('');
            }
        }

        this.#bindBrowserEvents();
        this.#bindPullToRefresh();
        queueMicrotask(() => {
            if (this.isDestroyed) {
                return;
            }
            if (this.getWelcomeUrl()) {
                this.navigate(this.getWelcomeUrl());
            } else {
                this.openInitialLink(this.getHomeUrl());
            }
        });
    }

    /**
     * Point d'extension protégé hérité de `NObject`, appelé automatiquement en micro-tâche après la construction.
     * Déclenche la navigation initiale vers `getWelcomeUrl()` ou `openInitialLink(getHomeUrl())`.
     *
     * @protected
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Enregistrer les frames dans une sous-classe puis appeler super._init()</caption>
     * class AppWindow extends NWindow {
     *     _init() {
     *         this.registerFrame(HomeFrame);
     *         super._init();
     *     }
     * }
     *
     * @example <caption>Exemple 2 : Personnaliser le démarrage sans navigation automatique</caption>
     * class CustomWindow extends NWindow {
     *     _init() {
     *         this.registerFrame(LoginFrame);
     *         this.navigate(`${this.getBaseUrl()}/login`);
     *     }
     * }
     */
    _init() {

    }

    // =========================================================================
    // Accesseur statique
    // =========================================================================

    /**
     * Retourne l'instance unique `NWindow` attachée à `document.body`.
     *
     * @returns {NWindow|null} Instance `NWindow` ou `null` si aucune n'est initialisée.
     *
     * @example <caption>Exemple 1 : Accéder à la fenêtre applicative</caption>
     * const win = NWindow.instance();
     *
     * @example <caption>Exemple 2 : Naviguer depuis n'importe quel module</caption>
     * const win = NWindow.instance();
     * win?.navigate(`${win.getBaseUrl()}/settings`);
     */
    static instance() {
        if (typeof document === 'undefined') {
            return null;
        }
        return document.body?._nwindow || null;
    }

    // =========================================================================
    // Accesseurs d'instance
    // =========================================================================

    /**
     * Retourne l'URL de base configurée dans `this.util.config` (clé `'baseUrl'`), ou `window.location.origin` par défaut.
     *
     * @returns {string} URL de base.
     *
     * @example <caption>Exemple 1 : Lire l'URL de base</caption>
     * const base = win.getBaseUrl();
     *
     * @example <caption>Exemple 2 : Construire une URL d'API relative</caption>
     * const endpoint = `${win.getBaseUrl()}/api/users`;
     */
    getBaseUrl() {
        const fallback = typeof window !== 'undefined' && window.location ? window.location.origin : '';
        return this.util.config.get('baseUrl', fallback) || fallback;
    }

    /**
     * Retourne la liste des instances `NFrame` actuellement gérées.
     *
     * @returns {Array<import('./components/frames/NFrame.js').NFrame>} Copie du tableau de frames.
     *
     * @example <caption>Exemple 1 : Compter les frames ouvertes</caption>
     * const count = win.getFrames().length;
     *
     * @example <caption>Exemple 2 : Parcourir les titres des frames</caption>
     * const titles = win.getFrames().map((f) => f.getTitle());
     */
    getFrames() {
        return [...this.#frames];
    }

    /**
     * Retourne la frame actuellement active au premier plan.
     *
     * @returns {import('./components/frames/NFrame.js').NFrame|null} Frame active ou `null`.
     *
     * @example <caption>Exemple 1 : Lire le titre de la frame active</caption>
     * const title = win.getCurrentFrame()?.getTitle();
     *
     * @example <caption>Exemple 2 : Vérifier si une frame est active</caption>
     * const hasActive = win.getCurrentFrame() !== null;
     */
    getCurrentFrame() {
        return this.#currentFrame;
    }

    /**
     * Définit l'URL initiale utilisée au démarrage de la fenêtre.
     *
     * @param {string} url - URL initiale.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir l'URL initiale</caption>
     * win.setInitialUrl(`${win.getBaseUrl()}/dashboard`);
     *
     * @example <caption>Exemple 2 : Réinitialiser l'URL initiale</caption>
     * win.setInitialUrl('');
     */
    setInitialUrl(url) {
        this.#initialUrl = typeof url === 'string' ? url.trim() : '';
        return this;
    }

    /**
     * Retourne l'URL initiale résolue lors de la création de la fenêtre.
     *
     * @returns {string} URL initiale ou chaîne vide.
     *
     * @example <caption>Exemple 1 : Lire l'URL initiale détectée</caption>
     * const startUrl = win.getInitialUrl();
     *
     * @example <caption>Exemple 2 : Naviguer vers l'URL initiale ou l'accueil</caption>
     * win.navigate(win.getInitialUrl() || win.getHomeUrl());
     */
    getInitialUrl() {
        return this.#initialUrl;
    }

    /**
     * Exécute la navigation initiale vers `#initialUrl`, ou bascule vers `defaultLink` (ou `getHomeUrl()`).
     *
     * @param {string|null} [defaultLink=null] - Lien de repli utilisé si `#initialUrl` est vide ou échoue.
     * @returns {import('./components/frames/NFrame.js').NFrame|null} Frame activée ou `null`.
     *
     * @example <caption>Exemple 1 : Démarrer la navigation avec repli sur getHomeUrl()</caption>
     * win.openInitialLink();
     *
     * @example <caption>Exemple 2 : Démarrer avec un lien de repli personnalisé</caption>
     * win.openInitialLink(`${win.getBaseUrl()}/welcome`);
     */
    openInitialLink(defaultLink = null) {
        if (this.#initialUrl) {
            const frame = this.navigate(this.#initialUrl);
            if (frame) {
                return frame;
            }
        }
        const fallback = defaultLink;
        return fallback ? this.navigate(fallback) : null;
    }

    /**
     * Retourne le lien de la page d'accueil principale (redéfinissable en sous-classe, `null` par défaut).
     *
     * @returns {string|null} Lien de la frame d'accueil ou `null`.
     *
     * @example <caption>Exemple 1 : Naviguer vers la page d'accueil si définie</caption>
     * if (win.getHomeUrl()) { win.navigate(win.getHomeUrl()); }
     *
     * @example <caption>Exemple 2 : Redéfinir getHomeUrl dans une sous-classe</caption>
     * class AppWindow extends NWindow {
     *     getHomeUrl() { return `${this.getBaseUrl()}/dashboard`; }
     * }
     */
    getHomeUrl() {
        return null;
    }

    /**
     * Retourne le lien de la page de bienvenue / démarrage (redéfinissable en sous-classe, `null` par défaut).
     *
     * @returns {string|null} Lien de la frame de bienvenue ou `null`.
     *
     * @example <caption>Exemple 1 : Vérifier si un écran de bienvenue est configuré</caption>
     * if (win.getWelcomeUrl()) { win.navigate(win.getWelcomeUrl()); }
     *
     * @example <caption>Exemple 2 : Redéfinir getWelcomeUrl dans une sous-classe</caption>
     * class AppWindow extends NWindow {
     *     getWelcomeUrl() { return `${this.getBaseUrl()}/onboarding`; }
     * }
     */
    getWelcomeUrl() {
        return null;
    }

    /**
     * Recherche une instance de frame active correspondant au lien donné.
     *
     * @param {string} link - Lien ou route à rechercher.
     * @returns {import('./components/frames/NFrame.js').NFrame|null} Frame correspondante ou `null`.
     *
     * @example <caption>Exemple 1 : Retrouver une frame déjà montée</caption>
     * const profile = win.getFrame(`${win.getBaseUrl()}/profile`);
     *
     * @example <caption>Exemple 2 : Vérifier si une route est déjà ouverte</caption>
     * const isOpen = win.getFrame(`${win.getBaseUrl()}/settings`) !== null;
     */
    getFrame(link) {
        if (!link) {
            return null;
        }
        return this.#frames.find((frame) => frame.matchesUrl(link) || frame.getUrl() === link) || null;
    }

    // =========================================================================
    // Registre de frames
    // =========================================================================

    /**
     * Enregistre une classe `NFrame` dans le registre de routage.
     * La classe déclare sa route via `static route` et/ou `static matchUrl(url, params)`.
     *
     * @param {Function} FrameClass - Classe héritant de `NFrame`.
     * @param {boolean} [overlay] - Indique si la frame doit s'ouvrir en mode superposition (`overlay`). Par défaut `Boolean(FrameClass.overlay)`.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Enregistrer une page standard et une frame overlay</caption>
     * win.registerFrame(HomeFrame)
     *    .registerFrame(ModalFrame, true);
     *
     * @example <caption>Exemple 2 : Forcer le mode non-overlay</caption>
     * win.registerFrame(SettingsFrame, false);
     */
    registerFrame(FrameClass, overlay = undefined) {
        if (typeof FrameClass === 'function') {
            const isOverlay = overlay !== undefined ? Boolean(overlay) : Boolean(FrameClass.overlay);
            this.#frameRegistry.set(FrameClass, { overlay: isOverlay });
        }
        return this;
    }

    /**
     * Supprime une classe de frame du registre de routage.
     *
     * @param {Function} FrameClass - Classe `NFrame` à retirer.
     * @returns {boolean} `true` si la classe était enregistrée et a été supprimée.
     *
     * @example <caption>Exemple 1 : Retirer une frame temporaire</caption>
     * win.unregisterFrame(OnboardingFrame);
     *
     * @example <caption>Exemple 2 : Vérifier la suppression</caption>
     * const removed = win.unregisterFrame(LegacyFrame);
     */
    unregisterFrame(FrameClass) {
        return this.#frameRegistry.delete(FrameClass);
    }

    /**
     * Retourne la liste des classes de frames enregistrées dans l'ordre d'inscription.
     *
     * @returns {Array<Function>} Tableau des classes `NFrame` enregistrées.
     *
     * @example <caption>Exemple 1 : Lister les frames enregistrées</caption>
     * const classes = win.getFrameClasses();
     *
     * @example <caption>Exemple 2 : Vérifier si une classe est enregistrée</caption>
     * const hasHome = win.getFrameClasses().includes(HomeFrame);
     */
    getFrameClasses() {
        return Array.from(this.#frameRegistry.keys());
    }

    /**
     * Résout la classe `NFrame`, les paramètres de route et l'option `overlay` correspondant à une URL ou un objet de navigation.
     * Parcourt les classes enregistrées dans l'ordre et appelle `FrameClass.matchUrl(params.link, params)`.
     *
     * @param {string|object} urlOrParams - URL complète ou objet de paramètres normalisés.
     * @returns {{ FrameClass: Function, params: object, overlay: boolean }|null} Correspondance trouvée ou `null`.
     *
     * @example <caption>Exemple 1 : Résoudre une URL complète</caption>
     * const match = win.resolveFrame(`${win.getBaseUrl()}/users/42`);
     *
     * @example <caption>Exemple 2 : Résoudre depuis un objet de paramètres</caption>
     * const match = win.resolveFrame(win.linkToParams(`${win.getBaseUrl()}/settings`));
     */
    resolveFrame(urlOrParams) {
        const params = (urlOrParams && typeof urlOrParams === 'object' && urlOrParams.link)
            ? urlOrParams
            : this.linkToParams(urlOrParams);

        for (const [FrameClass, meta] of this.#frameRegistry) {
            if (typeof FrameClass.matchUrl !== 'function') continue;
            const matched = FrameClass.matchUrl(params.link, params);
            if (matched !== false && matched !== null && matched !== undefined) {
                const routeParams = (matched && typeof matched === 'object') ? matched : {};
                return { FrameClass, params: routeParams, overlay: meta.overlay };
            }
        }
        return null;
    }

    // =========================================================================
    // Routage, navigation et historique
    // =========================================================================

    /**
     * Convertit un lien textuel ou un objet de paramètres en objet de navigation normalisé.
     *
     * @param {string|object} linkOrParams - URL ou objet de paramètres de navigation.
     * @returns {object} Paramètres normalisés `{ link, path, query, ... }`.
     *
     * @example <caption>Exemple 1 : Analyser une chaîne de lien avec query string</caption>
     * const params = win.linkToParams(`${win.getBaseUrl()}/users?page=2&sort=name`);
     *
     * @example <caption>Exemple 2 : Normaliser un objet de paramètres</caption>
     * const params = win.linkToParams({ link: `${win.getBaseUrl()}/profile`, id: 12 });
     */
    linkToParams(linkOrParams) {
        if (linkOrParams && typeof linkOrParams === 'object') {
            const rawLink = linkOrParams.link || linkOrParams.path || '/';
            const parsed = this.#parseLinkString(rawLink);
            return {
                ...parsed.query,
                ...linkOrParams,
                link: parsed.link,
                path: linkOrParams.path || parsed.path,
                query: { ...parsed.query, ...(linkOrParams.query || {}) }
            };
        }

        const parsed = this.#parseLinkString(typeof linkOrParams === 'string' ? linkOrParams : '/');
        return {
            ...parsed.query,
            ...parsed
        };
    }

    /**
     * Navigue vers un lien ou un objet de paramètres de frame, crée ou réutilise la frame et l'amène au premier plan.
     *
     * @param {string|object} linkOrParams - Lien cible ou objet de paramètres (`link`, `frameClass`, `forceNew`, `isBack`, `target`, etc.).
     * @returns {import('./components/frames/NFrame.js').NFrame|null} Frame activée ou `null` si introuvable/refusée/externe.
     *
     * @example <caption>Exemple 1 : Naviguer vers une route enregistrée</caption>
     * win.navigate(`${win.getBaseUrl()}/home`);
     *
     * @example <caption>Exemple 2 : Naviguer en remplaçant la barre d'adresse via isBack</caption>
     * win.navigate({ link: `${win.getBaseUrl()}/login`, isBack: true });
     */
    navigate(linkOrParams) {
        const rawLink = typeof linkOrParams === 'string'
            ? linkOrParams.trim()
            : (typeof linkOrParams?.link === 'string' ? linkOrParams.link.trim() : '');
        const baseUrl = this.getBaseUrl();

        if (rawLink && /^https?:\/\//i.test(rawLink) && baseUrl && !rawLink.startsWith(baseUrl)) {
            const target = typeof linkOrParams === 'object' ? linkOrParams?.target : undefined;
            NUtil.sys.openUrl(rawLink, target);
            return null;
        }

        const baseParams = this.linkToParams(linkOrParams);
        let FrameClass = baseParams.frameClass || null;
        let params = baseParams;
        let registeredOverlay;

        if (!FrameClass) {
            const resolved = this.resolveFrame(baseParams);
            if (resolved) {
                FrameClass = resolved.FrameClass;
                params = { ...baseParams, ...resolved.params };
                registeredOverlay = resolved.overlay;
            }
        } else {
            registeredOverlay = this.#frameRegistry.get(FrameClass)?.overlay;
        }

        if (!FrameClass) {
            this.emit('navigation:not-found', { params });
            return null;
        }

        const isOverlay = params.overlay !== undefined
            ? Boolean(params.overlay)
            : (registeredOverlay !== undefined ? registeredOverlay : Boolean(FrameClass.overlay));
        params = { ...params, overlay: isOverlay };

        if (typeof FrameClass.canActivate === 'function') {
            const rawGuard = FrameClass.canActivate(params);
            const guard = (rawGuard && typeof rawGuard === 'object')
                ? rawGuard
                : { status: rawGuard ? 'allow' : 'deny' };

            if (guard.status === 'redirect' && guard.url) {
                const redirectCount = Number(params._redirectCount || 0);
                if (redirectCount >= 5) {
                    this.emit('navigation:denied', { params, FrameClass, reason: 'too-many-redirects', guard });
                    return null;
                }
                this.emit('navigation:redirect', { params, FrameClass, url: guard.url, guard });
                const nextTarget = (guard.params && typeof guard.params === 'object')
                    ? { ...guard.params, link: guard.url, _redirectCount: redirectCount + 1 }
                    : { link: guard.url, _redirectCount: redirectCount + 1 };
                return this.navigate(nextTarget);
            }

            if (guard.status !== 'allow') {
                this.emit('navigation:denied', { params, FrameClass, reason: guard.reason, guard });
                return null;
            }
        }

        let frame = !params.forceNew ? this.getFrame(params.link) : null;
        if (!frame) {
            if (typeof FrameClass.create === 'function') {
                frame = FrameClass.create(params);
            } else {
                frame = new FrameClass(params);
            }
        }

        if (!frame) {
            return null;
        }

        if (!frame.getUrl()) {
            frame.setUrl(params.link);
        }

        if (!this.#frames.includes(frame)) {
            this.#frames.push(frame);
            this.append(frame);
        }

        this.bringToFront(frame, params);
        return frame;
    }

    /**
     * Place une frame au premier plan, gère la superposition flottante, l'activation et l'historique.
     *
     * @param {import('./components/frames/NFrame.js').NFrame} frame - Frame à activer.
     * @param {object} [params={}] - Paramètres et options d'activation (`isBack`, etc.) transmis à `onActivate`.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer une frame existante</caption>
     * win.bringToFront(existingFrame, { tab: 'details' });
     *
     * @example <caption>Exemple 2 : Activer une frame lors d'un retour arrière</caption>
     * win.bringToFront(previousFrame, { ...previousParams, isBack: true });
     */
    bringToFront(frame, params = {}) {
        if (!frame) {
            return this;
        }

        const previousFrame = this.#currentFrame;
        const isOverlay = frame.isOverlay();

        if (previousFrame && previousFrame !== frame) {
            if (typeof previousFrame.onDeactivate === 'function') {
                previousFrame.onDeactivate(params);
            }
        }

        if (!isOverlay) {
            for (const item of this.#frames) {
                if (item !== frame) {
                    item.hide();
                }
            }
            frame.show();
        } else {
            this.#overlayZIndex += 1;
            frame.setStyle('z-index', String(this.#overlayZIndex));
            frame.show();
        }

        this.#currentFrame = frame;

        const isBack = Boolean(params.isBack);

        if (typeof frame.onActivate === 'function') {
            frame.onActivate(params);
        }

        if (frame.getTitle()) {
            NUtil.sys.setBrowserTitle(frame.getTitle());
        }

        const resolvedLink = this.#parseLinkString(String(params.link || frame.getUrl() || '/')).link;

        if (isBack) {
            NUtil.sys.setBrowserUrl(resolvedLink, { link: resolvedLink });
            if (this.#history.length > 0) {
                this.#history[this.#history.length - 1] = resolvedLink;
            } else {
                this.#history.push(resolvedLink);
            }
        } else {
            this.#history.push(resolvedLink);
            NUtil.sys.pushBrowserUrl(resolvedLink, { link: resolvedLink });
        }

        this.emit('frame:change', {
            frame,
            previousFrame,
            params: { ...params, link: resolvedLink }
        });
        return this;
    }

    /**
     * Revient à la frame précédente (ferme d'abord une frame flottante active, puis remonte l'historique),
     * avec repli éventuel sur `current.getBackLink()` ou `defaultLink`.
     *
     * @param {string|null} [defaultLink=null] - Lien de repli si l'historique et `backLink` sont vides.
     * @returns {boolean} `true` si un retour a été effectué.
     *
     * @example <caption>Exemple 1 : Revenir à la vue précédente</caption>
     * win.back();
     *
     * @example <caption>Exemple 2 : Revenir avec un lien de repli vers l'accueil</caption>
     * win.back(`${win.getBaseUrl()}/home`);
     */
    back(defaultLink = null) {
        const current = this.#currentFrame;
        if (!current) {
            const b = defaultLink ? this.navigate({ link: defaultLink, isBack: true }) !== null : false;
            if (!b) {
                this.util.sys.browserBack();
            }
            return b;
        }
        if (!current.canGoBack()) {
            return false;
        }
        if (!defaultLink) {
            defaultLink = current.getBackUrl();
        }
        if (!defaultLink && !this.util.str.equals(current.getUrl(), this.getHomeUrl())) {
            defaultLink = this.getHomeUrl();
        }

        const activateHistoryTop = () => {
            const targetLink = this.#history[this.#history.length - 1];
            if (!targetLink) {
                return false;
            }
            const targetFrame = this.getFrame(targetLink);
            if (targetFrame) {
                this.bringToFront(targetFrame, { ...this.linkToParams(targetLink), isBack: true });
                return true;
            }
            return this.navigate({ link: targetLink, isBack: true }) !== null;
        };

        if (this.#history.length > 1) {
            this.#history.pop();
            if (activateHistoryTop()) {
                return true;
            }
        }

        if (defaultLink) {
            const b = this.navigate({ link: defaultLink, isBack: true }) !== null;
            if (!b) {
                this.util.sys.browserBack();
            }
            return b;
        }

        this.util.sys.browserBack();
        return true;
    }

    /**
     * Retire une frame de la fenêtre et détruit optionnellement son instance.
     *
     * @param {import('./components/frames/NFrame.js').NFrame} frame - Frame à retirer.
     * @param {boolean} [destroyFrame=true] - Appelle `frame.destroy()` après retrait.
     * @returns {boolean} `true` si la frame était gérée par cette fenêtre.
     *
     * @example <caption>Exemple 1 : Fermer et détruire une frame</caption>
     * win.removeFrame(modalFrame);
     *
     * @example <caption>Exemple 2 : Détacher une frame sans la détruire</caption>
     * win.removeFrame(cachedFrame, false);
     */
    removeFrame(frame, destroyFrame = true) {
        const index = this.#frames.indexOf(frame);
        if (index === -1) {
            return false;
        }

        this.#frames.splice(index, 1);

        if (this.#currentFrame === frame) {
            this.#currentFrame = null;
        }

        if (destroyFrame && typeof frame.destroy === 'function') {
            frame.destroy();
        } else if (frame.element && frame.element.parentNode) {
            frame.element.parentNode.removeChild(frame.element);
        }

        return true;
    }

    /**
     * Retourne une copie de l'historique interne de navigation (liens des frames).
     *
     * @returns {Array<string>} Pile de liens.
     *
     * @example <caption>Exemple 1 : Consulter l'historique</caption>
     * const history = win.getHistory();
     *
     * @example <caption>Exemple 2 : Vérifier la profondeur de navigation</caption>
     * const depth = win.getHistory().length;
     */
    getHistory() {
        return [...this.#history];
    }

    /**
     * Vide l'historique interne de navigation.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Réinitialiser l'historique après déconnexion</caption>
     * win.clearHistory();
     *
     * @example <caption>Exemple 2 : Vider l'historique puis naviguer</caption>
     * win.clearHistory().navigate({ link: `${win.getBaseUrl()}/login`, isBack: true });
     */
    clearHistory() {
        this.#history = [];
        return this;
    }

    /**
     * Fait défiler la fenêtre (ou le document) aux coordonnées ou options indiquées.
     *
     * @param {number|ScrollToOptions} [scrollX=0] - Coordonnée horizontale cible ou objet d'options `ScrollToOptions`.
     * @param {number} [scrollY=0] - Coordonnée verticale cible (lorsque `scrollX` est numérique).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Remonter en haut de la fenêtre</caption>
     * win.scrollTo(0, 0);
     *
     * @example <caption>Exemple 2 : Défiler en douceur avec options</caption>
     * win.scrollTo({ top: 300, behavior: 'smooth' });
     */
    scrollTo(scrollX = 0, scrollY = 0) {
        const scrollOptions = scrollX && typeof scrollX === 'object'
            ? { left: Number(scrollX.left ?? scrollX.x) || 0, top: Number(scrollX.top ?? scrollX.y) || 0, behavior: scrollX.behavior }
            : { left: Number(scrollX) || 0, top: Number(scrollY) || 0 };

        const target = (typeof window !== 'undefined' && typeof window.scrollTo === 'function')
            ? window
            : (typeof document !== 'undefined' && typeof document.documentElement?.scrollTo === 'function' ? document.documentElement : null);

        if (target) {
            this.requestAnimationFrame(() => {
                target.scrollTo(scrollOptions);
            });
        }
        return this;
    }

    // =========================================================================
    // Cycle de vie applicatif
    // =========================================================================

    /**
     * Relaye l'événement de reprise d'onglet vers la frame active.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Déclencher la reprise manuellement</caption>
     * win.onResume();
     *
     * @example <caption>Exemple 2 : Enchaîner reprise et focus</caption>
     * win.onResume().onFocus();
     */
    onResume() {
        this.#currentFrame?.onResume?.();
        this.emit('resume', { frame: this.#currentFrame });
        return this;
    }

    /**
     * Relaye l'événement de mise en pause d'onglet vers la frame active et émet `'pause'`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Déclencher la pause manuellement</caption>
     * win.onPause();
     *
     * @example <caption>Exemple 2 : Enchaîner pause et perte de focus</caption>
     * win.onPause().onBlur();
     */
    onPause() {
        this.#currentFrame?.onPause?.();
        this.emit('pause', { frame: this.#currentFrame });
        return this;
    }

    /**
     * Relaye l'événement de prise de focus fenêtre vers la frame active et émet `'focus'`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Simuler une prise de focus</caption>
     * win.onFocus();
     *
     * @example <caption>Exemple 2 : Chaîner focus</caption>
     * win.onFocus();
     */
    onFocus() {
        this.#currentFrame?.onFocus?.();
        this.emit('focus', { frame: this.#currentFrame });
        return this;
    }

    /**
     * Relaye l'événement de perte de focus fenêtre vers la frame active et émet `'blur'`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Simuler une perte de focus</caption>
     * win.onBlur();
     *
     * @example <caption>Exemple 2 : Chaîner blur</caption>
     * win.onBlur();
     */
    onBlur() {
        this.#currentFrame?.onBlur?.();
        this.emit('blur', { frame: this.#currentFrame });
        return this;
    }

    // =========================================================================
    // Événements globaux (scroll / resize)
    // =========================================================================

    /**
     * Enregistre un écouteur d'événement et attache, pour `'scroll'` et `'resize'`,
     * un pont vers `document` / `window` en complément du pont DOM `NTag`.
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} callback - Fonction appelée lors du déclenchement.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Écouter le défilement global du document</caption>
     * win.on('scroll', (ev) => console.log('Scroll', window.scrollY));
     *
     * @example <caption>Exemple 2 : Écouter le redimensionnement du viewport</caption>
     * win.on('resize', () => console.log(window.innerWidth, window.innerHeight));
     */
    on(event, callback) {
        super.on(event, callback);
        if (!this.isDestroyed && typeof callback === 'function' && !this.#globalBridges?.has(event)) {
            if (event === 'scroll' && typeof document !== 'undefined') {
                const handler = (ev) => this.emit('scroll', ev);
                document.addEventListener('scroll', handler, { passive: true });
                if (!this.#globalBridges) {
                    this.#globalBridges = new Map();
                }
                this.#globalBridges.set('scroll', { target: document, handler });
            } else if (event === 'resize' && typeof window !== 'undefined') {
                const handler = (ev) => this.emit('resize', ev);
                window.addEventListener('resize', handler);
                if (!this.#globalBridges) {
                    this.#globalBridges = new Map();
                }
                this.#globalBridges.set('resize', { target: window, handler });
            }
        }
        return this;
    }

    /**
     * Supprime un ou plusieurs écouteurs et détache les ponts globaux `'scroll'` / `'resize'`
     * lorsqu'aucun écouteur n'est plus actif.
     *
     * @param {string} [event] - Nom de l'événement (tous si omis).
     * @param {Function} [callback] - Fonction spécifique à retirer.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Retirer un écouteur de scroll</caption>
     * win.off('scroll', onScroll);
     *
     * @example <caption>Exemple 2 : Retirer tous les écouteurs de resize</caption>
     * win.off('resize');
     */
    off(event, callback) {
        super.off(event, callback);
        if (!this.#globalBridges) {
            return this;
        }
        if (!event) {
            for (const [evName, { target, handler }] of this.#globalBridges.entries()) {
                target.removeEventListener(evName, handler);
            }
            this.#globalBridges = null;
        } else if (this.listenerCount(event) === 0 && this.#globalBridges.has(event)) {
            const { target, handler } = this.#globalBridges.get(event);
            target.removeEventListener(event, handler);
            this.#globalBridges.delete(event);
            if (this.#globalBridges.size === 0) {
                this.#globalBridges = null;
            }
        }
        return this;
    }

    // =========================================================================
    // Destruction
    // =========================================================================

    /**
     * Libère les écouteurs navigateur, détruit toutes les frames et la balise fenêtre.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire l'instance applicative</caption>
     * win.destroy();
     *
     * @example <caption>Exemple 2 : Nettoyer lors du démontage de l'application</caption>
     * if (!win.isDestroyed) {
     *     win.destroy();
     * }
     */
    destroy() {
        for (const cleanup of this.#cleanups) {
            cleanup();
        }
        this.#cleanups = [];

        if (this.#globalBridges) {
            for (const [evName, { target, handler }] of this.#globalBridges.entries()) {
                target.removeEventListener(evName, handler);
            }
            this.#globalBridges = null;
        }

        this.#pullIndicatorTag?.destroy();
        this.#pullIndicatorTag = null;

        for (const frame of [...this.#frames]) {
            this.removeFrame(frame, true);
        }
        this.#frames = [];
        this.#currentFrame = null;
        this.#history = [];
        this.#frameRegistry.clear();

        if (typeof document !== 'undefined' && document.body?._nwindow === this) {
            delete document.body._nwindow;
        }

        super.destroy();
    }

    // =========================================================================
    // Méthodes privées
    // =========================================================================

    /**
     * Analyse une chaîne de lien en URL complète normalisée, chemin relatif et paramètres query.
     *
     * @param {string} rawLink - Chaîne de lien brute (relative ou URL complète).
     * @returns {{link: string, path: string, query: object}} Résultat normalisé avec `link` en URL complète.
     *
     * @example <caption>Exemple 1 : URL complète avec paramètres query</caption>
     * this.#parseLinkString('https://app.example.com/users/42?tab=posts');
     * // { link: 'https://app.example.com/users/42?tab=posts', path: '/users/42', query: { tab: 'posts' } }
     *
     * @example <caption>Exemple 2 : URL complète incluant baseUrl</caption>
     * this.#parseLinkString('https://app.example.com/settings?section=theme');
     * // { link: 'https://app.example.com/settings?section=theme', path: '/settings', query: { section: 'theme' } }
     */
    #parseLinkString(rawLink) {
        const cleaned = rawLink && rawLink.trim() ? rawLink.trim() : '/';
        const [rawPath, rawQuery = ''] = cleaned.split('?');
        let path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

        const baseUrl = (this.getBaseUrl() || '').replace(/\/+$/, '');
        if (baseUrl && cleaned.startsWith(baseUrl)) {
            const relative = cleaned.slice(baseUrl.length).split('?')[0];
            path = relative.startsWith('/') ? relative : `/${relative}`;
        }

        const query = {};
        if (rawQuery) {
            const searchParams = new URLSearchParams(rawQuery);
            for (const [k, v] of searchParams.entries()) {
                query[k] = v;
            }
        }

        const relativeLink = rawQuery ? `${path}?${rawQuery}` : path;
        const link = baseUrl ? `${baseUrl}${relativeLink}` : relativeLink;

        return { link, path, query };
    }

    /**
     * Attache les écouteurs `window` et `document` de navigation et cycle de vie.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Liaison automatique à l'instanciation</caption>
     * this.#bindBrowserEvents();
     *
     * @example <caption>Exemple 2 : Nettoyage lors de destroy()</caption>
     * // Les écouteurs enregistrés dans #cleanups sont retirés par win.destroy().
     */
    #bindBrowserEvents() {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return;
        }

        const onPopState = () => {
            this.back();
        };
        const onFocus = () => this.onFocus();
        const onBlur = () => this.onBlur();
        const onPageHide = (event) => {
            if (!event?.persisted) {
                this.destroy();
            }
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                this.onResume();
            } else {
                this.onPause();
            }
        };

        window.addEventListener('popstate', onPopState);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        window.addEventListener('pagehide', onPageHide);
        document.addEventListener('visibilitychange', onVisibilityChange);

        this.#cleanups.push(
            () => window.removeEventListener('popstate', onPopState),
            () => window.removeEventListener('focus', onFocus),
            () => window.removeEventListener('blur', onBlur),
            () => window.removeEventListener('pagehide', onPageHide),
            () => document.removeEventListener('visibilitychange', onVisibilityChange)
        );
    }

    /**
     * Attache la détection tactile de pull-to-refresh sur l'élément de la fenêtre
     * avec indicateur visuel, vérification du scroll document/frame et gestion de `touchcancel`.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Liaison automatique sur this.element</caption>
     * this.#bindPullToRefresh();
     *
     * @example <caption>Exemple 2 : Activation sur une NFrame enfant</caption>
     * frame.setPullToRefresh(true);
     */
    #bindPullToRefresh() {
        const el = this.element;
        if (!el) {
            return;
        }

        const threshold = 72;
        const maxPull = 110;

        const ensureIndicator = () => {
            if (!this.#pullIndicatorTag) {
                this.#pullIndicatorTag = new NTag({
                    tagName: 'div',
                    className: 'n-window__pull',
                    attrs: { 'aria-hidden': 'true' }
                });
                this.#pullIndicatorTag.setText('↓');
                this.#pullIndicatorTag.hide();
                this.append(this.#pullIndicatorTag);
            }
            return this.#pullIndicatorTag;
        };

        const resetIndicator = () => {
            this.#pullStartY = null;
            this.#pullDeltaY = 0;
            if (this.#pullIndicatorTag) {
                this.#pullIndicatorTag
                    .removeClass('n-window__pull--ready', 'n-window__pull--refreshing')
                    .setStyle({ transform: '', opacity: '' })
                    .hide();
            }
        };

        const isAtTop = (frame) => {
            const frameScrollTop = frame.element?.scrollTop ?? 0;
            const docScrollTop = typeof window !== 'undefined'
                ? (window.scrollY ?? document.documentElement?.scrollTop ?? 0)
                : 0;
            return frameScrollTop <= 0 && docScrollTop <= 0;
        };

        const onTouchStart = (event) => {
            const frame = this.#currentFrame;
            if (!frame || !frame.isPullToRefresh() || !isAtTop(frame) || !event.touches?.[0]) {
                this.#pullStartY = null;
                this.#pullDeltaY = 0;
                return;
            }
            this.#pullStartY = event.touches[0].clientY;
            this.#pullDeltaY = 0;
        };

        const onTouchMove = (event) => {
            if (this.#pullStartY === null || !event.touches?.[0]) {
                return;
            }
            const frame = this.#currentFrame;
            if (!frame || !frame.isPullToRefresh() || !isAtTop(frame)) {
                resetIndicator();
                return;
            }

            const deltaY = event.touches[0].clientY - this.#pullStartY;
            this.#pullDeltaY = deltaY;

            if (deltaY <= 0) {
                if (this.#pullIndicatorTag) {
                    this.#pullIndicatorTag.hide();
                }
                return;
            }

            const indicator = ensureIndicator();
            const damped = Math.min(maxPull, deltaY * 0.55);
            const progress = Math.min(1, deltaY / threshold);

            indicator
                .removeClass('n-window__pull--refreshing')
                .setStyle({
                    transform: `translate(-50%, ${Math.round(damped - 36)}px)`,
                    opacity: String(progress)
                })
                .show();

            if (deltaY >= threshold) {
                indicator.addClass('n-window__pull--ready');
            } else {
                indicator.removeClass('n-window__pull--ready');
            }
        };

        const onTouchEnd = (event) => {
            if (this.#pullStartY === null) {
                return;
            }
            const endY = event.changedTouches?.[0]?.clientY;
            const deltaY = typeof endY === 'number' ? endY - this.#pullStartY : this.#pullDeltaY;
            this.#pullStartY = null;
            this.#pullDeltaY = 0;

            if (deltaY >= threshold && this.#currentFrame?.isPullToRefresh()) {
                const indicator = ensureIndicator();
                indicator
                    .removeClass('n-window__pull--ready')
                    .addClass('n-window__pull--refreshing')
                    .setStyle({
                        transform: 'translate(-50%, 12px)',
                        opacity: '1'
                    })
                    .show();

                Promise.resolve(this.#currentFrame.onPullToRefresh())
                    .catch(() => { })
                    .finally(() => {
                        if (!this.isDestroyed) {
                            resetIndicator();
                        }
                    });
            } else {
                resetIndicator();
            }
        };

        const onTouchCancel = () => {
            resetIndicator();
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });
        el.addEventListener('touchcancel', onTouchCancel, { passive: true });

        this.#cleanups.push(
            () => el.removeEventListener('touchstart', onTouchStart),
            () => el.removeEventListener('touchmove', onTouchMove),
            () => el.removeEventListener('touchend', onTouchEnd),
            () => el.removeEventListener('touchcancel', onTouchCancel)
        );
    }
}
