/**
 * @file NImage.js
 * @package @nlib/js-frontend
 * @description Composant image (`<img>`) héritant de `NTag`, avec gestion de `src`, `alt`,
 * chargement paresseux, décodage asynchrone et image de repli (`fallbackSrc`).
 */

import { NTag } from './NTag.js';

/**
 * @class NImage
 * @extends NTag
 * @description Représente une balise `<img>` manipulable de manière fluide.
 *
 * @example <caption>Exemple 1 : Instanciation rapide avec URL</caption>
 * const logo = new NImage('/assets/logo.png').setAlt('Logo NLib').mount('#header');
 *
 * @example <caption>Exemple 2 : Image avec repli et chargement paresseux</caption>
 * const avatar = new NImage({
 *     src: '/users/1.jpg',
 *     alt: 'Avatar',
 *     fallbackSrc: '/assets/default-avatar.png',
 *     loading: 'lazy',
 *     classes: ['rounded-full']
 * });
 */
export class NImage extends NTag {

    /**
     * URL de l'image de repli utilisée en cas d'erreur de chargement.
     * @type {string|null}
     * @private
     */
    #fallbackSrc = null;

    /**
     * Indique si l'image de repli a déjà été appliquée pour le chargement courant.
     * @type {boolean}
     * @private
     */
    #fallbackApplied = false;

    /**
     * Crée une nouvelle instance `NImage`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou URL `src`.
     * @param {string} [options.src] - URL de l'image.
     * @param {string} [options.alt=''] - Texte alternatif (`alt`).
     * @param {string|null} [options.fallbackSrc=null] - URL de repli en cas d'erreur.
     * @param {'lazy'|'eager'} [options.loading] - Stratégie de chargement natif.
     * @param {'async'|'sync'|'auto'} [options.decoding] - Mode de décodage natif.
     * @param {string|null} [options.crossOrigin] - Politique CORS (`'anonymous'`, `'use-credentials'`).
     * @param {number|string} [options.width] - Attribut `width`.
     * @param {number|string} [options.height] - Attribut `height`.
     *
     * @example <caption>Exemple 1 : Par chaîne URL</caption>
     * const img = new NImage('/banner.webp');
     *
     * @example <caption>Exemple 2 : Par objet d'options</caption>
     * const img = new NImage({ src: '/photo.jpg', alt: 'Photo', width: 320, height: 240 });
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { src: options }
            : (options && typeof options === 'object' ? options : {});

        super({ ...opts, tagName: 'img' });

        this.addClass('n-image');

        if (opts.fallbackSrc) {
            this.setFallbackSrc(opts.fallbackSrc);
        }
        if (opts.alt !== undefined) {
            this.setAlt(opts.alt);
        }
        if (opts.loading) {
            this.setLoading(opts.loading);
        }
        if (opts.decoding) {
            this.setDecoding(opts.decoding);
        }
        if (opts.crossOrigin !== undefined) {
            this.setCrossOrigin(opts.crossOrigin);
        }
        if (opts.width !== undefined) {
            this.setAttr('width', opts.width);
        }
        if (opts.height !== undefined) {
            this.setAttr('height', opts.height);
        }
        if (opts.src !== undefined) {
            this.setSrc(opts.src);
        }
    }

    /**
     * Retourne l'attribut `src` de l'image.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire la source</caption>
     * console.log(img.src);
     *
     * @example <caption>Exemple 2 : Image sans source</caption>
     * console.log(new NImage().src); // ''
     */
    get src() {
        return this.getAttr('src') ?? '';
    }

    /**
     * Définit la source `src` de l'image.
     * @param {string|null} value - URL de l'image.
     *
     * @example <caption>Exemple 1 : Modifier via setter</caption>
     * img.src = '/new.png';
     *
     * @example <caption>Exemple 2 : Effacer la source</caption>
     * img.src = null;
     */
    set src(value) {
        this.setSrc(value);
    }

    /**
     * Retourne le texte alternatif `alt` de l'image.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire alt</caption>
     * console.log(img.alt);
     *
     * @example <caption>Exemple 2 : Image sans alt</caption>
     * console.log(new NImage().alt); // ''
     */
    get alt() {
        return this.getAttr('alt') ?? '';
    }

    /**
     * Définit le texte alternatif `alt` de l'image.
     * @param {string} value - Texte alternatif.
     *
     * @example <caption>Exemple 1 : Définir alt via setter</caption>
     * img.alt = 'Illustration';
     *
     * @example <caption>Exemple 2 : Chaîne vide pour image décorative</caption>
     * img.alt = '';
     */
    set alt(value) {
        this.setAlt(value);
    }

    /**
     * Retourne le texte alternatif (`alt`) de l'image via `text`.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire text sur une image</caption>
     * const img = new NImage({ alt: 'Bannière' });
     * console.log(img.text); // 'Bannière'
     *
     * @example <caption>Exemple 2 : Image sans alt</caption>
     * console.log(new NImage().text); // ''
     */
    get text() {
        return this.alt;
    }

    /**
     * Définit le texte alternatif (`alt`) de l'image via `text`.
     * @param {string|null} value - Texte alternatif.
     *
     * @example <caption>Exemple 1 : Définir alt via img.text</caption>
     * img.text = 'Photo de profil';
     *
     * @example <caption>Exemple 2 : Vider alt via img.text</caption>
     * img.text = '';
     */
    set text(value) {
        this.setAlt(value);
    }

    /**
     * Redirige `setText()` vers `setAlt()` pour les balises `<img>`.
     *
     * @param {string|number|null} text - Texte alternatif.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir alt via setText()</caption>
     * img.setText('Logo NLib');
     * console.log(img.alt); // 'Logo NLib'
     *
     * @example <caption>Exemple 2 : Utiliser dans applyLanguage()</caption>
     * img.setText(img.util.lang.get('brand.logoAlt'));
     */
    setText(text) {
        return this.setAlt(text);
    }

    /**
     * Définit l'URL source (`src`) et réinitialise l'état de repli.
     *
     * @param {string|null} src - URL de l'image (`null` pour supprimer l'attribut).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Charger une nouvelle image</caption>
     * img.setSrc('/img/hero.jpg');
     *
     * @example <caption>Exemple 2 : Chaîner avec setAlt</caption>
     * img.setSrc('/img/hero.jpg').setAlt('Bannière');
     */
    setSrc(src) {
        this.#fallbackApplied = false;
        if (src === null || src === undefined || src === '') {
            return this.removeAttr('src');
        }
        return this.setAttr('src', String(src));
    }

    /**
     * Définit le texte alternatif (`alt`).
     *
     * @param {string|null} alt - Texte alternatif.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir un texte descriptif</caption>
     * img.setAlt('Photo de profil');
     *
     * @example <caption>Exemple 2 : Marquer comme image décorative</caption>
     * img.setAlt('');
     */
    setAlt(alt) {
        return this.setAttr('alt', alt === null || alt === undefined ? '' : String(alt));
    }

    /**
     * Configure une URL de repli appliquée automatiquement lors d'un événement `'error'`.
     *
     * @param {string|null} src - URL de repli (ou `null` pour désactiver).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir une image par défaut</caption>
     * img.setFallbackSrc('/assets/placeholder.png');
     *
     * @example <caption>Exemple 2 : Désactiver le repli</caption>
     * img.setFallbackSrc(null);
     */
    setFallbackSrc(src) {
        const hadFallback = Boolean(this.#fallbackSrc);
        this.#fallbackSrc = (typeof src === 'string' && src.trim()) ? src.trim() : null;
        this.#fallbackApplied = false;

        if (this.#fallbackSrc && !hadFallback) {
            this.on('error', this.#handleErrorFallback);
        } else if (!this.#fallbackSrc && hadFallback) {
            this.off('error', this.#handleErrorFallback);
        }
        return this;
    }

    /**
     * Définit la stratégie de chargement natif (`loading`).
     *
     * @param {'lazy'|'eager'} mode - Mode de chargement.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer le chargement paresseux</caption>
     * img.setLoading('lazy');
     *
     * @example <caption>Exemple 2 : Chargement immédiat</caption>
     * img.setLoading('eager');
     */
    setLoading(mode) {
        if (mode === 'lazy' || mode === 'eager') {
            return this.setAttr('loading', mode);
        }
        return this;
    }

    /**
     * Définit le mode de décodage natif (`decoding`).
     *
     * @param {'async'|'sync'|'auto'} mode - Mode de décodage.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Décodage asynchrone</caption>
     * img.setDecoding('async');
     *
     * @example <caption>Exemple 2 : Décodage automatique</caption>
     * img.setDecoding('auto');
     */
    setDecoding(mode) {
        if (mode === 'async' || mode === 'sync' || mode === 'auto') {
            return this.setAttr('decoding', mode);
        }
        return this;
    }

    /**
     * Définit l'attribut `crossorigin` pour le chargement CORS.
     *
     * @param {'anonymous'|'use-credentials'|null} value - Politique CORS ou `null` pour supprimer.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer CORS anonyme</caption>
     * img.setCrossOrigin('anonymous');
     *
     * @example <caption>Exemple 2 : Supprimer crossorigin</caption>
     * img.setCrossOrigin(null);
     */
    setCrossOrigin(value) {
        if (value === null || value === undefined || value === '') {
            return this.removeAttr('crossorigin');
        }
        return this.setAttr('crossorigin', String(value));
    }

    /**
     * Indique si l'image a terminé son chargement avec succès (`complete && naturalWidth > 0`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier après chargement</caption>
     * img.on('load', () => console.log(img.isLoaded())); // true
     *
     * @example <caption>Exemple 2 : Vérifier avant assignation de src</caption>
     * console.log(new NImage().isLoaded()); // false
     */
    isLoaded() {
        return Boolean(this.element?.complete && this.element?.naturalWidth > 0);
    }

    /**
     * Retourne les dimensions intrinsèques `{ width, height }` de l'image chargée.
     *
     * @returns {{ width: number, height: number }}
     *
     * @example <caption>Exemple 1 : Lire la taille réelle de l'image</caption>
     * const { width, height } = img.getNaturalSize();
     *
     * @example <caption>Exemple 2 : Image non encore chargée</caption>
     * console.log(new NImage().getNaturalSize()); // { width: 0, height: 0 }
     */
    getNaturalSize() {
        return {
            width: this.element?.naturalWidth ?? 0,
            height: this.element?.naturalHeight ?? 0
        };
    }

    /**
     * Décode l'image de manière asynchrone via `HTMLImageElement.decode()` si disponible.
     *
     * @returns {Promise<this>}
     *
     * @example <caption>Exemple 1 : Attendre le décodage avant affichage</caption>
     * await img.decode();
     * img.show();
     *
     * @example <caption>Exemple 2 : Chaînage après décodage</caption>
     * img.decode().then((i) => i.addClass('ready'));
     */
    async decode() {
        if (this.element && typeof this.element.decode === 'function') {
            await this.element.decode();
        }
        return this;
    }

    /**
     * Libère les ressources et détruit l'instance `NImage`.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire l'image</caption>
     * img.destroy();
     *
     * @example <caption>Exemple 2 : Vérifier la destruction</caption>
     * img.destroy();
     * console.log(img.isDestroyed); // true
     */
    destroy() {
        this.#fallbackSrc = null;
        this.#fallbackApplied = false;
        super.destroy();
    }

    /**
     * Gestionnaire interne appliquant `fallbackSrc` une seule fois sur erreur de chargement.
     * @private
     */
    #handleErrorFallback = () => {
        if (!this.isDestroyed && this.#fallbackSrc && !this.#fallbackApplied && this.src !== this.#fallbackSrc) {
            this.#fallbackApplied = true;
            this.setAttr('src', this.#fallbackSrc);
        }
    };
}

export default NImage;
