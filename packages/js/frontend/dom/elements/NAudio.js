/**
 * @file NAudio.js
 * @package @nlib/js-frontend
 * @description Composant audio (`<audio>`) héritant de `NMedia`.
 */

import { NMedia } from './NMedia.js';

/**
 * @class NAudio
 * @extends NMedia
 * @description Représente une balise `<audio>` manipulable de manière fluide.
 *
 * @example <caption>Exemple 1 : Lecteur audio avec contrôles</caption>
 * const player = new NAudio({
 *     src: '/audio/podcast.mp3',
 *     controls: true,
 *     preload: 'metadata'
 * }).mount('#player');
 *
 * @example <caption>Exemple 2 : Effet sonore en boucle</caption>
 * const ambiance = new NAudio({
 *     src: '/audio/rain.ogg',
 *     loop: true,
 *     volume: 0.35
 * });
 */
export class NAudio extends NMedia {

    /**
     * Crée une nouvelle instance `NAudio`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration (`NMedia`) ou URL `src`.
     *
     * @example <caption>Exemple 1 : Par chaîne URL</caption>
     * const audio = new NAudio('/sounds/click.mp3').setVolume(0.8);
     *
     * @example <caption>Exemple 2 : Multi-sources</caption>
     * const audio = new NAudio({
     *     controls: true,
     *     sources: [
     *         { src: '/track.ogg', type: 'audio/ogg' },
     *         { src: '/track.mp3', type: 'audio/mpeg' }
     *     ]
     * });
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { src: options }
            : (options && typeof options === 'object' ? options : {});

        super({ ...opts, tagName: 'audio' });
        this.addClass('n-audio');
    }
}

export default NAudio;
