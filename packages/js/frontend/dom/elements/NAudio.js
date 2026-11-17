/**
 * @file NAudio.js
 * @package @nlib/js-frontend
 * @description Composant audio (`<audio>`) héritant de `NTag`, avec gestion des sources,
 * contrôles de lecture (`play`, `pause`, `stop`, `seek`), volume, vitesse et état `isReady()`.
 */

import { NTag } from './NTag.js';

/**
 * @class NAudio
 * @extends NTag
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
export class NAudio extends NTag {

    /**
     * Crée une nouvelle instance `NAudio`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou URL `src`.
     * @param {string} [options.src] - URL du flux audio.
     * @param {boolean} [options.controls=false] - Affiche les contrôles natifs.
     * @param {boolean} [options.autoplay=false] - Lecture automatique.
     * @param {boolean} [options.loop=false] - Lecture en boucle.
     * @param {boolean} [options.muted=false] - Coupe le son.
     * @param {'none'|'metadata'|'auto'} [options.preload] - Stratégie de préchargement.
     * @param {number} [options.volume] - Volume initial entre `0` et `1`.
     * @param {number} [options.playbackRate] - Vitesse de lecture initiale (`> 0`).
     * @param {string|null} [options.crossOrigin] - Politique CORS (`'anonymous'`, `'use-credentials'`).
     * @param {Array<{ src: string, type?: string }|string>} [options.sources] - Liste de sources `<source>`.
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
        if (opts.preload) {
            this.setPreload(opts.preload);
        }
        if (opts.crossOrigin !== undefined) {
            this.setCrossOrigin(opts.crossOrigin);
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
     * Retourne l'attribut `src` de l'audio.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire la source</caption>
     * console.log(audio.src);
     *
     * @example <caption>Exemple 2 : Audio sans source</caption>
     * console.log(new NAudio().src); // ''
     */
    get src() {
        return this.getAttr('src') ?? '';
    }

    /**
     * Définit l'attribut `src` de l'audio.
     * @param {string|null} value - URL du fichier audio.
     *
     * @example <caption>Exemple 1 : Définir via setter</caption>
     * audio.src = '/sounds/notify.mp3';
     *
     * @example <caption>Exemple 2 : Supprimer la source</caption>
     * audio.src = null;
     */
    set src(value) {
        this.setSrc(value);
    }

    /**
     * Retourne la position de lecture courante en secondes (`currentTime`).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la position</caption>
     * console.log(audio.currentTime);
     *
     * @example <caption>Exemple 2 : Audio neuf</caption>
     * console.log(new NAudio().currentTime); // 0
     */
    get currentTime() {
        return Number(this.element?.currentTime) || 0;
    }

    /**
     * Définit la position de lecture en secondes (`currentTime`).
     * @param {number} value - Temps en secondes.
     *
     * @example <caption>Exemple 1 : Aller à 10 secondes</caption>
     * audio.currentTime = 10;
     *
     * @example <caption>Exemple 2 : Revenir au début</caption>
     * audio.currentTime = 0;
     */
    set currentTime(value) {
        this.seek(value);
    }

    /**
     * Retourne la durée totale de la piste audio en secondes (ou `0` si inconnue).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la durée</caption>
     * console.log(audio.duration);
     *
     * @example <caption>Exemple 2 : Avant chargement des métadonnées</caption>
     * console.log(new NAudio().duration); // 0
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
     * console.log(audio.volume); // 1
     *
     * @example <caption>Exemple 2 : Après réglage</caption>
     * audio.setVolume(0.5);
     * console.log(audio.volume); // 0.5
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
     * audio.volume = 0.5;
     *
     * @example <caption>Exemple 2 : Couper le volume</caption>
     * audio.volume = 0;
     */
    set volume(value) {
        this.setVolume(value);
    }

    /**
     * Retourne la vitesse de lecture courante (`playbackRate`).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Vitesse par défaut</caption>
     * console.log(new NAudio().playbackRate); // 1
     *
     * @example <caption>Exemple 2 : Vitesse accélérée</caption>
     * audio.setPlaybackRate(1.5);
     * console.log(audio.playbackRate); // 1.5
     */
    get playbackRate() {
        const r = this.element?.playbackRate;
        return typeof r === 'number' && Number.isFinite(r) ? r : 1;
    }

    /**
     * Définit la vitesse de lecture (`playbackRate`).
     * @param {number} value - Facteur de vitesse (`> 0`).
     *
     * @example <caption>Exemple 1 : Lire à 1.25x</caption>
     * audio.playbackRate = 1.25;
     *
     * @example <caption>Exemple 2 : Revenir à 1x</caption>
     * audio.playbackRate = 1;
     */
    set playbackRate(value) {
        this.setPlaybackRate(value);
    }

    /**
     * Définit l'URL source (`src`) de l'audio.
     *
     * @param {string|null} src - URL du fichier audio (`null` pour supprimer l'attribut).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Charger une piste</caption>
     * audio.setSrc('/audio/intro.mp3');
     *
     * @example <caption>Exemple 2 : Supprimer l'attribut src</caption>
     * audio.setSrc(null);
     */
    setSrc(src) {
        if (src === null || src === undefined || src === '') {
            return this.removeAttr('src');
        }
        return this.setAttr('src', String(src));
    }

    /**
     * Ajoute une balise enfant `<source>` à l'élément `<audio>`.
     *
     * @param {string} src - URL de la source média.
     * @param {string} [type] - Type MIME optionnel (ex: `'audio/mpeg'`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter une source OGG</caption>
     * audio.addSource('/audio/song.ogg', 'audio/ogg');
     *
     * @example <caption>Exemple 2 : Chaîner plusieurs formats</caption>
     * audio.addSource('/song.ogg', 'audio/ogg').addSource('/song.mp3', 'audio/mpeg');
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
     * audio.setControls(true);
     *
     * @example <caption>Exemple 2 : Masquer les contrôles</caption>
     * audio.setControls(false);
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
     * audio.setAutoplay(true);
     *
     * @example <caption>Exemple 2 : Désactiver autoplay</caption>
     * audio.setAutoplay(false);
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
     * audio.setLoop(true);
     *
     * @example <caption>Exemple 2 : Désactiver loop</caption>
     * audio.setLoop(false);
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
     * audio.setMuted(true);
     *
     * @example <caption>Exemple 2 : Rétablir le son</caption>
     * audio.setMuted(false);
     */
    setMuted(enabled = true) {
        const flag = Boolean(enabled);
        return this.setProperty('muted', flag).setAttr('muted', flag);
    }

    /**
     * Définit la stratégie de préchargement (`preload`).
     *
     * @param {'none'|'metadata'|'auto'} mode - Mode de préchargement.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Précharger uniquement les métadonnées</caption>
     * audio.setPreload('metadata');
     *
     * @example <caption>Exemple 2 : Désactiver le préchargement</caption>
     * audio.setPreload('none');
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
     * audio.setCrossOrigin('anonymous');
     *
     * @example <caption>Exemple 2 : Supprimer crossorigin</caption>
     * audio.setCrossOrigin(null);
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
     * @example <caption>Exemple 1 : Régler le volume à 60 %</caption>
     * audio.setVolume(0.6);
     *
     * @example <caption>Exemple 2 : Bornage automatique</caption>
     * audio.setVolume(-1); // ramené à 0
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
     * audio.setPlaybackRate(1.5);
     *
     * @example <caption>Exemple 2 : Revenir à la vitesse normale</caption>
     * audio.setPlaybackRate(1);
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
     * audio.seek(30);
     *
     * @example <caption>Exemple 2 : Revenir au début</caption>
     * audio.seek(0);
     */
    seek(seconds) {
        if (this.element && typeof seconds === 'number' && Number.isFinite(seconds)) {
            this.element.currentTime = Math.max(0, seconds);
        }
        return this;
    }

    /**
     * Démarre la lecture audio.
     *
     * @returns {Promise<void>} Promesse résolue au démarrage de la lecture.
     *
     * @example <caption>Exemple 1 : Lancer la lecture</caption>
     * await audio.play();
     *
     * @example <caption>Exemple 2 : Lecture sur clic</caption>
     * btn.on('click', () => audio.play());
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
     * audio.pause();
     *
     * @example <caption>Exemple 2 : Mettre en pause puis replacer à 0s</caption>
     * audio.pause().seek(0);
     */
    pause() {
        if (this.element && typeof this.element.pause === 'function') {
            this.element.pause();
        }
        return this;
    }

    /**
     * Met l'audio en pause et remet la position de lecture à `0`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Arrêter la lecture</caption>
     * audio.stop();
     *
     * @example <caption>Exemple 2 : Arrêter et couper le son</caption>
     * audio.stop().setMuted(true);
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
     * toggleBtn.on('click', () => audio.togglePlay());
     *
     * @example <caption>Exemple 2 : Bascule programmatique</caption>
     * audio.togglePlay();
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
     * audio.addSource('/track.mp3', 'audio/mpeg').load();
     *
     * @example <caption>Exemple 2 : Réinitialiser le lecteur</caption>
     * audio.setSrc('/new.mp3').load();
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
     * @example <caption>Exemple 1 : Vérifier si la piste est prête</caption>
     * audio.on('canplay', () => console.log(audio.isReady())); // true
     *
     * @example <caption>Exemple 2 : Exiger un préchargement complet (HAVE_ENOUGH_DATA = 4)</caption>
     * if (audio.isReady(4)) audio.play();
     */
    isReady(minReadyState = 3) {
        const threshold = typeof minReadyState === 'number' && Number.isFinite(minReadyState)
            ? minReadyState
            : 3;
        return Boolean(this.element && this.element.readyState >= threshold);
    }

    /**
     * Indique si l'audio est en pause.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : État initial</caption>
     * console.log(new NAudio().isPaused()); // true
     *
     * @example <caption>Exemple 2 : Vérifier avant lecture</caption>
     * if (audio.isPaused()) audio.play();
     */
    isPaused() {
        return this.element ? Boolean(this.element.paused) : true;
    }

    /**
     * Indique si la lecture a atteint la fin de la piste audio.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier si terminée</caption>
     * console.log(audio.isEnded());
     *
     * @example <caption>Exemple 2 : Réagir sur l'événement ended</caption>
     * audio.on('ended', () => console.log(audio.isEnded())); // true
     */
    isEnded() {
        return Boolean(this.element?.ended);
    }

    /**
     * Indique si le son de l'audio est coupé (`muted`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier le mode muet</caption>
     * audio.setMuted(true);
     * console.log(audio.isMuted()); // true
     *
     * @example <caption>Exemple 2 : Rétablir le son</caption>
     * audio.setMuted(false);
     * console.log(audio.isMuted()); // false
     */
    isMuted() {
        return Boolean(this.element?.muted);
    }

    /**
     * Met la lecture en pause, libère les ressources et détruit l'instance `NAudio`.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire le lecteur</caption>
     * audio.destroy();
     *
     * @example <caption>Exemple 2 : Vérifier la destruction</caption>
     * audio.destroy();
     * console.log(audio.isDestroyed); // true
     */
    destroy() {
        this.pause();
        super.destroy();
    }
}

export default NAudio;
