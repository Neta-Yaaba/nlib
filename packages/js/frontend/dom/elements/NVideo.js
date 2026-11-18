/**
 * @file NVideo.js
 * @package @nlib/js-frontend
 * @description Composant vidéo (`<video>`) héritant de `NMedia`, avec gestion de `poster`,
 * `playsinline` et des dimensions vidéo intrinsèques.
 */

import { NMedia } from './NMedia.js';

/**
 * @class NVideo
 * @extends NMedia
 * @description Représente une balise `<video>` manipulable de manière fluide.
 *
 * @example <caption>Exemple 1 : Lecteur vidéo avec contrôles et poster</caption>
 * const player = new NVideo({
 *     src: '/videos/demo.mp4',
 *     poster: '/images/demo-poster.jpg',
 *     controls: true,
 *     preload: 'metadata'
 * }).mount('#player');
 *
 * @example <caption>Exemple 2 : Vidéo d'arrière-plan muette en boucle</caption>
 * const bg = new NVideo({
 *     src: '/videos/bg.webm',
 *     autoplay: true,
 *     loop: true,
 *     muted: true,
 *     playsInline: true
 * });
 */
export class NVideo extends NMedia {

    /**
     * Crée une nouvelle instance `NVideo`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration (`NMedia`) ou URL `src`.
     * @param {string} [options.poster] - URL de l'image d'aperçu (`poster`).
     * @param {boolean} [options.playsInline=false] - Lecture intégrée sur mobile (`playsinline`).
     * @param {number|string} [options.width] - Attribut `width`.
     * @param {number|string} [options.height] - Attribut `height`.
     *
     * @example <caption>Exemple 1 : Par chaîne URL</caption>
     * const v = new NVideo('/media/clip.mp4').setControls(true);
     *
     * @example <caption>Exemple 2 : Multi-sources</caption>
     * const v = new NVideo({
     *     controls: true,
     *     sources: [
     *         { src: '/clip.webm', type: 'video/webm' },
     *         { src: '/clip.mp4', type: 'video/mp4' }
     *     ]
     * });
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { src: options }
            : (options && typeof options === 'object' ? options : {});

        super({ ...opts, tagName: 'video' });
        this.addClass('n-video');

        if (opts.poster !== undefined) {
            this.setPoster(opts.poster);
        }
        if (opts.playsInline !== undefined) {
            this.setPlaysInline(opts.playsInline);
        }
        if (opts.width !== undefined) {
            this.setAttr('width', opts.width);
        }
        if (opts.height !== undefined) {
            this.setAttr('height', opts.height);
        }
    }

    /**
     * Retourne l'attribut `poster` de la vidéo.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire le poster</caption>
     * console.log(video.poster);
     *
     * @example <caption>Exemple 2 : Sans poster</caption>
     * console.log(new NVideo().poster); // ''
     */
    get poster() {
        return this.getAttr('poster') ?? '';
    }

    /**
     * Définit l'attribut `poster` de la vidéo.
     * @param {string|null} value - URL de l'image d'aperçu.
     *
     * @example <caption>Exemple 1 : Définir via setter</caption>
     * video.poster = '/poster.jpg';
     *
     * @example <caption>Exemple 2 : Supprimer le poster</caption>
     * video.poster = null;
     */
    set poster(value) {
        this.setPoster(value);
    }

    /**
     * Définit l'image d'aperçu (`poster`).
     *
     * @param {string|null} poster - URL de l'image (`null` pour supprimer).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir un poster</caption>
     * video.setPoster('/images/cover.jpg');
     *
     * @example <caption>Exemple 2 : Retirer le poster</caption>
     * video.setPoster(null);
     */
    setPoster(poster) {
        if (poster === null || poster === undefined || poster === '') {
            return this.removeAttr('poster');
        }
        return this.setAttr('poster', String(poster));
    }

    /**
     * Active ou désactive la lecture intégrée sur mobile (`playsinline`).
     *
     * @param {boolean} [enabled=true] - État souhaité.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer playsinline</caption>
     * video.setPlaysInline(true);
     *
     * @example <caption>Exemple 2 : Désactiver playsinline</caption>
     * video.setPlaysInline(false);
     */
    setPlaysInline(enabled = true) {
        const flag = Boolean(enabled);
        return this.setProperty('playsInline', flag).setAttr('playsinline', flag);
    }

    /**
     * Retourne les dimensions intrinsèques `{ width, height }` de la piste vidéo.
     *
     * @returns {{ width: number, height: number }}
     *
     * @example <caption>Exemple 1 : Lire la résolution vidéo</caption>
     * const { width, height } = video.getVideoSize();
     *
     * @example <caption>Exemple 2 : Avant chargement des métadonnées</caption>
     * console.log(new NVideo().getVideoSize()); // { width: 0, height: 0 }
     */
    getVideoSize() {
        return {
            width: this.element?.videoWidth ?? 0,
            height: this.element?.videoHeight ?? 0
        };
    }
}

export default NVideo;
