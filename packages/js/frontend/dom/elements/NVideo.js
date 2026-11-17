/**
 * @file NVideo.js
 * @package @nlib/js-frontend
 * @description Composant vidéo (`<video>`) héritant de `NTag`, avec gestion des sources,
 * contrôles de lecture (`play`, `pause`, `stop`, `seek`), volume, vitesse et attributs média HTML5.
 */

import { NTag } from './NTag.js';

/**
 * @class NVideo
 * @extends NTag
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
export class NVideo extends NTag {

    /**
     * Crée une nouvelle instance `NVideo`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou URL `src`.
     * @param {string} [options.src] - URL de la vidéo.
     * @param {string} [options.poster] - URL de l'image d'aperçu (`poster`).
     * @param {boolean} [options.controls=false] - Affiche les contrôles natifs.
     * @param {boolean} [options.autoplay=false] - Lecture automatique.
     * @param {boolean} [options.loop=false] - Lecture en boucle.
     * @param {boolean} [options.muted=false] - Coupe le son.
     * @param {boolean} [options.playsInline=false] - Lecture intégrée sur mobile (`playsinline`).
     * @param {'none'|'metadata'|'auto'} [options.preload] - Stratégie de préchargement.
     * @param {number} [options.volume] - Volume initial entre `0` et `1`.
     * @param {number} [options.playbackRate] - Vitesse de lecture initiale (`> 0`).
     * @param {string|null} [options.crossOrigin] - Politique CORS (`'anonymous'`, `'use-credentials'`).
     * @param {number|string} [options.width] - Attribut `width`.
     * @param {number|string} [options.height] - Attribut `height`.
     * @param {Array<{ src: string, type?: string }|string>} [options.sources] - Liste de sources `<source>`.
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
        if (opts.controls !== undefined) {
            this.setControls(opts.controls);
        }
        if (opts.autoplay !== undefined) {
            this.setAutoplay(opts.autoplay);
        }
        if (opts.loop !== undefined) {
            this.setLoop(opts.loop);
        }
        if (opts.muted !== undefined) {
            this.setMuted(opts.muted);
        }
        if (opts.playsInline !== undefined) {
            this.setPlaysInline(opts.playsInline);
        }
        if (opts.preload) {
            this.setPreload(opts.preload);
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
        if (Array.isArray(opts.sources)) {
            for (const entry of opts.sources) {
                if (typeof entry === 'string') {
                    this.addSource(entry);
                } else if (entry && typeof entry === 'object' && entry.src) {
                    this.addSource(entry.src, entry.type);
                }
            }
        }
        if (opts.src !== undefined) {
            this.setSrc(opts.src);
        }
        if (typeof opts.volume === 'number') {
            this.setVolume(opts.volume);
        }
        if (typeof opts.playbackRate === 'number') {
            this.setPlaybackRate(opts.playbackRate);
        }
    }

    /**
     * Retourne l'attribut `src` de la vidéo.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire la source</caption>
     * console.log(video.src);
     *
     * @example <caption>Exemple 2 : Vidéo sans source</caption>
     * console.log(new NVideo().src); // ''
     */
    get src() {
        return this.getAttr('src') ?? '';
    }

    /**
     * Définit l'attribut `src` de la vidéo.
     * @param {string|null} value - URL de la vidéo.
     *
     * @example <caption>Exemple 1 : Définir via setter</caption>
     * video.src = '/clip.mp4';
     *
     * @example <caption>Exemple 2 : Supprimer la source</caption>
     * video.src = null;
     */
    set src(value) {
        this.setSrc(value);
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
     * Retourne la position de lecture courante en secondes (`currentTime`).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la position</caption>
     * console.log(video.currentTime);
     *
     * @example <caption>Exemple 2 : Vidéo neuve</caption>
     * console.log(new NVideo().currentTime); // 0
     */
    get currentTime() {
        return Number(this.element?.currentTime) || 0;
    }

    /**
     * Définit la position de lecture en secondes (`currentTime`).
     * @param {number} value - Temps en secondes.
     *
     * @example <caption>Exemple 1 : Aller à 15 secondes</caption>
     * video.currentTime = 15;
     *
     * @example <caption>Exemple 2 : Revenir au début</caption>
     * video.currentTime = 0;
     */
    set currentTime(value) {
        this.seek(value);
    }

    /**
     * Retourne la durée totale de la vidéo en secondes (ou `0` si inconnue).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la durée</caption>
     * console.log(video.duration);
     *
     * @example <caption>Exemple 2 : Avant chargement des métadonnées</caption>
     * console.log(new NVideo().duration); // 0
     */
    get duration() {
        const d = this.element?.duration;
        return typeof d === 'number' && Number.isFinite(d) ? d : 0;
    }

    /**
     * Retourne le volume courant (`0` à `1`).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire le volume</caption>
     * console.log(video.volume); // 1
     *
     * @example <caption>Exemple 2 : Après réglage</caption>
     * video.setVolume(0.5);
     * console.log(video.volume); // 0.5
     */
    get volume() {
        const v = this.element?.volume;
        return typeof v === 'number' && Number.isFinite(v) ? v : 1;
    }

    /**
     * Définit le volume (`0` à `1`).
     * @param {number} value - Niveau sonore.
     *
     * @example <caption>Exemple 1 : Régler à 50 %</caption>
     * video.volume = 0.5;
     *
     * @example <caption>Exemple 2 : Couper le volume</caption>
     * video.volume = 0;
     */
    set volume(value) {
        this.setVolume(value);
    }

    /**
     * Retourne la vitesse de lecture courante (`playbackRate`).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Vitesse par défaut</caption>
     * console.log(new NVideo().playbackRate); // 1
     *
     * @example <caption>Exemple 2 : Vitesse accélérée</caption>
     * video.setPlaybackRate(1.5);
     * console.log(video.playbackRate); // 1.5
     */
    get playbackRate() {
        const r = this.element?.playbackRate;
        return typeof r === 'number' && Number.isFinite(r) ? r : 1;
    }

    /**
     * Définit la vitesse de lecture (`playbackRate`).
     * @param {number} value - Facteur de vitesse (`> 0`).
     *
     * @example <caption>Exemple 1 : Doubler la vitesse</caption>
     * video.playbackRate = 2;
     *
     * @example <caption>Exemple 2 : Ralenti</caption>
     * video.playbackRate = 0.5;
     */
    set playbackRate(value) {
        this.setPlaybackRate(value);
    }

    /**
     * Définit l'URL source (`src`) de la vidéo.
     *
     * @param {string|null} src - URL de la vidéo (`null` pour supprimer l'attribut).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Charger une vidéo</caption>
     * video.setSrc('/videos/intro.mp4');
     *
     * @example <caption>Exemple 2 : Supprimer l'attribut src</caption>
     * video.setSrc(null);
     */
    setSrc(src) {
        if (src === null || src === undefined || src === '') {
            return this.removeAttr('src');
        }
        return this.setAttr('src', String(src));
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
     * Ajoute une balise enfant `<source>` à l'élément `<video>`.
     *
     * @param {string} src - URL de la source média.
     * @param {string} [type] - Type MIME optionnel (ex: `'video/mp4'`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter une source WebM</caption>
     * video.addSource('/media/clip.webm', 'video/webm');
     *
     * @example <caption>Exemple 2 : Chaîner plusieurs formats</caption>
     * video.addSource('/clip.webm', 'video/webm').addSource('/clip.mp4', 'video/mp4');
     */
    addSource(src, type) {
        if (this.isDestroyed || typeof src !== 'string' || !src.trim()) {
            return this;
        }
        const sourceTag = new NTag({
            tagName: 'source',
            attrs: {
                src: src.trim(),
                ...(typeof type === 'string' && type.trim() ? { type: type.trim() } : {})
            }
        });
        return this.append(sourceTag);
    }

    /**
     * Active ou désactive les contrôles natifs (`controls`).
     *
     * @param {boolean} [enabled=true] - État souhaité.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Afficher les contrôles</caption>
     * video.setControls(true);
     *
     * @example <caption>Exemple 2 : Masquer les contrôles</caption>
     * video.setControls(false);
     */
    setControls(enabled = true) {
        const flag = Boolean(enabled);
        return this.setProperty('controls', flag).setAttr('controls', flag);
    }

    /**
     * Active ou désactive la lecture automatique (`autoplay`).
     *
     * @param {boolean} [enabled=true] - État souhaité.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer autoplay</caption>
     * video.setAutoplay(true);
     *
     * @example <caption>Exemple 2 : Désactiver autoplay</caption>
     * video.setAutoplay(false);
     */
    setAutoplay(enabled = true) {
        const flag = Boolean(enabled);
        return this.setProperty('autoplay', flag).setAttr('autoplay', flag);
    }

    /**
     * Active ou désactive la lecture en boucle (`loop`).
     *
     * @param {boolean} [enabled=true] - État souhaité.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer loop</caption>
     * video.setLoop(true);
     *
     * @example <caption>Exemple 2 : Désactiver loop</caption>
     * video.setLoop(false);
     */
    setLoop(enabled = true) {
        const flag = Boolean(enabled);
        return this.setProperty('loop', flag).setAttr('loop', flag);
    }

    /**
     * Coupe ou rétablit le son (`muted`).
     *
     * @param {boolean} [enabled=true] - État souhaité.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Couper le son</caption>
     * video.setMuted(true);
     *
     * @example <caption>Exemple 2 : Rétablir le son</caption>
     * video.setMuted(false);
     */
    setMuted(enabled = true) {
        const flag = Boolean(enabled);
        return this.setProperty('muted', flag).setAttr('muted', flag);
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
     * Définit la stratégie de préchargement (`preload`).
     *
     * @param {'none'|'metadata'|'auto'} mode - Mode de préchargement.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Précharger uniquement les métadonnées</caption>
     * video.setPreload('metadata');
     *
     * @example <caption>Exemple 2 : Désactiver le préchargement</caption>
     * video.setPreload('none');
     */
    setPreload(mode) {
        if (mode === 'none' || mode === 'metadata' || mode === 'auto') {
            return this.setAttr('preload', mode);
        }
        return this;
    }

    /**
     * Définit l'attribut `crossorigin` pour le chargement CORS.
     *
     * @param {'anonymous'|'use-credentials'|null} value - Politique CORS ou `null`.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Activer CORS anonyme</caption>
     * video.setCrossOrigin('anonymous');
     *
     * @example <caption>Exemple 2 : Supprimer crossorigin</caption>
     * video.setCrossOrigin(null);
     */
    setCrossOrigin(value) {
        if (value === null || value === undefined || value === '') {
            return this.removeAttr('crossorigin');
        }
        return this.setAttr('crossorigin', String(value));
    }

    /**
     * Règle le volume sonore (borné entre `0` et `1`).
     *
     * @param {number} value - Niveau de volume.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Régler le volume à 75 %</caption>
     * video.setVolume(0.75);
     *
     * @example <caption>Exemple 2 : Bornage automatique</caption>
     * video.setVolume(2); // ramené à 1
     */
    setVolume(value) {
        if (this.element && typeof value === 'number' && Number.isFinite(value)) {
            this.element.volume = Math.max(0, Math.min(1, value));
        }
        return this;
    }

    /**
     * Règle la vitesse de lecture (`playbackRate > 0`).
     *
     * @param {number} rate - Facteur de vitesse.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Lire à 1.5x</caption>
     * video.setPlaybackRate(1.5);
     *
     * @example <caption>Exemple 2 : Revenir à la vitesse normale</caption>
     * video.setPlaybackRate(1);
     */
    setPlaybackRate(rate) {
        if (this.element && typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
            this.element.defaultPlaybackRate = rate;
            this.element.playbackRate = rate;
        }
        return this;
    }

    /**
     * Déplace la tête de lecture à une position donnée en secondes.
     *
     * @param {number} seconds - Position cible en secondes (`>= 0`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Avancer à 30 secondes</caption>
     * video.seek(30);
     *
     * @example <caption>Exemple 2 : Revenir au début</caption>
     * video.seek(0);
     */
    seek(seconds) {
        if (this.element && typeof seconds === 'number' && Number.isFinite(seconds)) {
            this.element.currentTime = Math.max(0, seconds);
        }
        return this;
    }

    /**
     * Démarre la lecture vidéo.
     *
     * @returns {Promise<void>} Promesse résolue au démarrage de la lecture.
     *
     * @example <caption>Exemple 1 : Lancer la lecture</caption>
     * await video.play();
     *
     * @example <caption>Exemple 2 : Lecture après interaction</caption>
     * btn.on('click', () => video.play());
     */
    play() {
        if (this.element && typeof this.element.play === 'function') {
            return Promise.resolve(this.element.play());
        }
        return Promise.resolve();
    }

    /**
     * Met la lecture en pause.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Mettre en pause</caption>
     * video.pause();
     *
     * @example <caption>Exemple 2 : Mettre en pause puis replacer à 10s</caption>
     * video.pause().seek(10);
     */
    pause() {
        if (this.element && typeof this.element.pause === 'function') {
            this.element.pause();
        }
        return this;
    }

    /**
     * Met la vidéo en pause et remet la position de lecture à `0`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Arrêter la vidéo</caption>
     * video.stop();
     *
     * @example <caption>Exemple 2 : Arrêter et masquer</caption>
     * video.stop().hide();
     */
    stop() {
        return this.pause().seek(0);
    }

    /**
     * Bascule entre lecture et pause selon l'état courant (`paused`).
     *
     * @returns {Promise<void>|this}
     *
     * @example <caption>Exemple 1 : Bouton lecture/pause</caption>
     * toggleBtn.on('click', () => video.togglePlay());
     *
     * @example <caption>Exemple 2 : Bascule programmatique</caption>
     * video.togglePlay();
     */
    togglePlay() {
        return this.isPaused() ? this.play() : this.pause();
    }

    /**
     * Recharge la ressource média via `HTMLMediaElement.load()`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Recharger après ajout de sources</caption>
     * video.addSource('/clip.mp4', 'video/mp4').load();
     *
     * @example <caption>Exemple 2 : Réinitialiser le lecteur</caption>
     * video.setSrc('/new.mp4').load();
     */
    load() {
        if (this.element && typeof this.element.load === 'function') {
            this.element.load();
        }
        return this;
    }

    /**
     * Indique si le média dispose de suffisamment de données pour être lu (`readyState >= minReadyState`).
     * Par défaut `minReadyState = 3` (`HAVE_FUTURE_DATA`).
     *
     * @param {number} [minReadyState=3] - Seuil `HTMLMediaElement.readyState` attendu (`0` à `4`).
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier si la vidéo est prête à être lue</caption>
     * video.on('canplay', () => console.log(video.isReady())); // true
     *
     * @example <caption>Exemple 2 : Exiger un préchargement complet (HAVE_ENOUGH_DATA = 4)</caption>
     * if (video.isReady(4)) video.play();
     */
    isReady(minReadyState = 3) {
        const threshold = typeof minReadyState === 'number' && Number.isFinite(minReadyState)
            ? minReadyState
            : 3;
        return Boolean(this.element && this.element.readyState >= threshold);
    }

    /**
     * Indique si la vidéo est en pause.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : État initial</caption>
     * console.log(new NVideo().isPaused()); // true
     *
     * @example <caption>Exemple 2 : Vérifier avant lecture</caption>
     * if (video.isPaused()) video.play();
     */
    isPaused() {
        return this.element ? Boolean(this.element.paused) : true;
    }

    /**
     * Indique si la lecture a atteint la fin de la vidéo.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier si terminée</caption>
     * console.log(video.isEnded());
     *
     * @example <caption>Exemple 2 : Réagir sur l'événement ended</caption>
     * video.on('ended', () => console.log(video.isEnded())); // true
     */
    isEnded() {
        return Boolean(this.element?.ended);
    }

    /**
     * Indique si le son de la vidéo est coupé (`muted`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier le mode muet</caption>
     * video.setMuted(true);
     * console.log(video.isMuted()); // true
     *
     * @example <caption>Exemple 2 : Rétablir le son</caption>
     * video.setMuted(false);
     * console.log(video.isMuted()); // false
     */
    isMuted() {
        return Boolean(this.element?.muted);
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

    /**
     * Met la lecture en pause, libère les ressources et détruit l'instance `NVideo`.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire le lecteur</caption>
     * video.destroy();
     *
     * @example <caption>Exemple 2 : Vérifier la destruction</caption>
     * video.destroy();
     * console.log(video.isDestroyed); // true
     */
    destroy() {
        this.pause();
        super.destroy();
    }
}

export default NVideo;
