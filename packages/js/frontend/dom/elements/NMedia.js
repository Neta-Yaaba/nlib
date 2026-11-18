/**
 * @file NMedia.js
 * @package @nlib/js-frontend
 * @description Classe de base média (`HTMLMediaElement`) héritant de `NTag` pour `NAudio` et `NVideo`.
 * Centralise la gestion des sources, de la lecture (`play`, `pause`, `stop`, `seek`),
 * du volume, de la vitesse de lecture et de l'état `isReady()`.
 */

import { NTag } from './NTag.js';

/**
 * @class NMedia
 * @extends NTag
 * @description Classe de base commune aux balises média `<audio>` et `<video>`.
 *
 * @example <caption>Exemple 1 : Instanciation directe</caption>
 * const media = new NMedia({ tagName: 'audio', src: '/sound.mp3', controls: true });
 *
 * @example <caption>Exemple 2 : Sous-classe spécialisée</caption>
 * class CustomAudio extends NMedia {
 *     constructor(options = {}) {
 *         super({ ...options, tagName: 'audio' });
 *     }
 * }
 */
export class NMedia extends NTag {

    static #ALLOWED_TAGS = new Set(['audio', 'video']);

    /**
     * Crée une nouvelle instance `NMedia`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou URL `src`.
     * @param {'audio'|'video'} [options.tagName='audio'] - Nom de la balise média (`'audio'` ou `'video'`).
     * @param {string} [options.src] - URL directe du flux média (mutuellement exclusif avec `sources` ; prioritaire si les deux sont fournis).
     * @param {boolean} [options.controls=false] - Affiche les contrôles natifs.
     * @param {boolean} [options.autoplay=false] - Lecture automatique.
     * @param {boolean} [options.loop=false] - Lecture en boucle.
     * @param {boolean} [options.muted=false] - Coupe le son.
     * @param {'none'|'metadata'|'auto'} [options.preload] - Stratégie de préchargement.
     * @param {number} [options.volume] - Volume initial entre `0` et `1`.
     * @param {number} [options.playbackRate] - Vitesse de lecture initiale (`> 0`).
     * @param {string|null} [options.crossOrigin] - Politique CORS (`'anonymous'`, `'use-credentials'`).
     * @param {Array<{ src: string, type?: string }|string>} [options.sources] - Liste de sources `<source>` (utilisée uniquement si `src` est omis).
     *
     * @example <caption>Exemple 1 : Créer un média avec contrôles</caption>
     * const m = new NMedia({ tagName: 'video', src: '/clip.mp4', controls: true });
     *
     * @example <caption>Exemple 2 : Créer avec plusieurs sources</caption>
     * const m = new NMedia({
     *     tagName: 'audio',
     *     sources: [{ src: '/track.ogg', type: 'audio/ogg' }, { src: '/track.mp3', type: 'audio/mpeg' }]
     * });
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { src: options }
            : (options && typeof options === 'object' ? options : {});

        const rawTag = typeof opts.tagName === 'string'
            ? opts.tagName.trim().toLowerCase()
            : 'audio';

        const safeTag = NMedia.#ALLOWED_TAGS.has(rawTag) ? rawTag : 'audio';

        super({ ...opts, tagName: safeTag });

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
        if (opts.src !== undefined && opts.src !== null && opts.src !== '') {
            this.setSrc(opts.src);
        } else if (Array.isArray(opts.sources)) {
            for (const entry of opts.sources) {
                if (typeof entry === 'string') {
                    this.addSource(entry);
                } else if (entry && typeof entry === 'object' && entry.src) {
                    this.addSource(entry.src, entry.type);
                }
            }
        }
        if (typeof opts.volume === 'number') {
            this.setVolume(opts.volume);
        }
        if (typeof opts.playbackRate === 'number') {
            this.setPlaybackRate(opts.playbackRate);
        }
    }

    /**
     * Retourne l'attribut `src` du média.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire la source</caption>
     * console.log(media.src);
     *
     * @example <caption>Exemple 2 : Média sans source</caption>
     * console.log(new NMedia().src); // ''
     */
    get src() {
        return this.getAttr('src') ?? '';
    }

    /**
     * Définit l'attribut `src` du média.
     * @param {string|null} value - URL du média.
     *
     * @example <caption>Exemple 1 : Définir via setter</caption>
     * media.src = '/audio/track.mp3';
     *
     * @example <caption>Exemple 2 : Supprimer la source</caption>
     * media.src = null;
     */
    set src(value) {
        this.setSrc(value);
    }

    /**
     * Retourne la position de lecture courante en secondes (`currentTime`).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la position</caption>
     * console.log(media.currentTime);
     *
     * @example <caption>Exemple 2 : Média neuf</caption>
     * console.log(new NMedia().currentTime); // 0
     */
    get currentTime() {
        return Number(this.element?.currentTime) || 0;
    }

    /**
     * Définit la position de lecture en secondes (`currentTime`).
     * @param {number} value - Temps en secondes.
     *
     * @example <caption>Exemple 1 : Aller à 15 secondes</caption>
     * media.currentTime = 15;
     *
     * @example <caption>Exemple 2 : Revenir au début</caption>
     * media.currentTime = 0;
     */
    set currentTime(value) {
        this.seek(value);
    }

    /**
     * Retourne la durée totale du média en secondes (ou `0` si inconnue).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la durée</caption>
     * console.log(media.duration);
     *
     * @example <caption>Exemple 2 : Avant chargement des métadonnées</caption>
     * console.log(new NMedia().duration); // 0
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
     * console.log(media.volume); // 1
     *
     * @example <caption>Exemple 2 : Après réglage</caption>
     * media.setVolume(0.5);
     * console.log(media.volume); // 0.5
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
     * media.volume = 0.5;
     *
     * @example <caption>Exemple 2 : Couper le volume</caption>
     * media.volume = 0;
     */
    set volume(value) {
        this.setVolume(value);
    }

    /**
     * Retourne la vitesse de lecture courante (`playbackRate`).
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Vitesse par défaut</caption>
     * console.log(new NMedia().playbackRate); // 1
     *
     * @example <caption>Exemple 2 : Vitesse accélérée</caption>
     * media.setPlaybackRate(1.5);
     * console.log(media.playbackRate); // 1.5
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
     * media.playbackRate = 2;
     *
     * @example <caption>Exemple 2 : Ralenti</caption>
     * media.playbackRate = 0.5;
     */
    set playbackRate(value) {
        this.setPlaybackRate(value);
    }

    /**
     * Définit l'URL source (`src`) du média et supprime les éventuels enfants `<source>` existants
     * (`src` et `<source>` étant mutuellement exclusifs en HTML5).
     *
     * @param {string|null} src - URL du média (`null` pour supprimer l'attribut).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Charger une source</caption>
     * media.setSrc('/media/intro.mp3');
     *
     * @example <caption>Exemple 2 : Supprimer l'attribut src</caption>
     * media.setSrc(null);
     */
    setSrc(src) {
        if (src === null || src === undefined || src === '') {
            return this.removeAttr('src');
        }
        for (const child of this.children) {
            if (child.tagName === 'source') {
                this.removeChild(child);
                if (!child.isDestroyed) {
                    child.destroy();
                }
            }
        }
        return this.setAttr('src', String(src));
    }

    /**
     * Ajoute une balise enfant `<source>` au média et supprime l'attribut `src` s'il était défini
     * (`src` et `<source>` étant mutuellement exclusifs en HTML5).
     *
     * @param {string} src - URL de la source média.
     * @param {string} [type] - Type MIME optionnel.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter une source</caption>
     * media.addSource('/media/clip.webm', 'video/webm');
     *
     * @example <caption>Exemple 2 : Chaîner plusieurs formats</caption>
     * media.addSource('/track.ogg', 'audio/ogg').addSource('/track.mp3', 'audio/mpeg');
     */
    addSource(src, type) {
        if (this.isDestroyed || typeof src !== 'string' || !src.trim()) {
            return this;
        }
        this.removeAttr('src');
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
     * media.setControls(true);
     *
     * @example <caption>Exemple 2 : Masquer les contrôles</caption>
     * media.setControls(false);
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
     * media.setAutoplay(true);
     *
     * @example <caption>Exemple 2 : Désactiver autoplay</caption>
     * media.setAutoplay(false);
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
     * media.setLoop(true);
     *
     * @example <caption>Exemple 2 : Désactiver loop</caption>
     * media.setLoop(false);
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
     * media.setMuted(true);
     *
     * @example <caption>Exemple 2 : Rétablir le son</caption>
     * media.setMuted(false);
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
     * media.setPreload('metadata');
     *
     * @example <caption>Exemple 2 : Désactiver le préchargement</caption>
     * media.setPreload('none');
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
     * media.setCrossOrigin('anonymous');
     *
     * @example <caption>Exemple 2 : Supprimer crossorigin</caption>
     * media.setCrossOrigin(null);
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
     * media.setVolume(0.75);
     *
     * @example <caption>Exemple 2 : Bornage automatique</caption>
     * media.setVolume(2); // ramené à 1
     */
    setVolume(value) {
        if (this.element && typeof value === 'number' && Number.isFinite(value)) {
            this.element.volume = Math.max(0, Math.min(1, value));
        }
        return this;
    }

    /**
     * Règle la vitesse de lecture (`defaultPlaybackRate` et `playbackRate > 0`).
     *
     * @param {number} rate - Facteur de vitesse.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Lire à 1.5x</caption>
     * media.setPlaybackRate(1.5);
     *
     * @example <caption>Exemple 2 : Revenir à la vitesse normale</caption>
     * media.setPlaybackRate(1);
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
     * media.seek(30);
     *
     * @example <caption>Exemple 2 : Revenir au début</caption>
     * media.seek(0);
     */
    seek(seconds) {
        if (this.element && typeof seconds === 'number' && Number.isFinite(seconds)) {
            this.element.currentTime = Math.max(0, seconds);
        }
        return this;
    }

    /**
     * Démarre la lecture du média.
     *
     * @returns {Promise<void>} Promesse résolue au démarrage de la lecture.
     *
     * @example <caption>Exemple 1 : Lancer la lecture</caption>
     * await media.play();
     *
     * @example <caption>Exemple 2 : Lecture sur interaction</caption>
     * btn.on('click', () => media.play());
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
     * media.pause();
     *
     * @example <caption>Exemple 2 : Mettre en pause puis replacer à 10s</caption>
     * media.pause().seek(10);
     */
    pause() {
        if (this.element && typeof this.element.pause === 'function') {
            this.element.pause();
        }
        return this;
    }

    /**
     * Met le média en pause et remet la position de lecture à `0`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Arrêter la lecture</caption>
     * media.stop();
     *
     * @example <caption>Exemple 2 : Arrêter et masquer</caption>
     * media.stop().hide();
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
     * toggleBtn.on('click', () => media.togglePlay());
     *
     * @example <caption>Exemple 2 : Bascule programmatique</caption>
     * media.togglePlay();
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
     * media.addSource('/track.mp3', 'audio/mpeg').load();
     *
     * @example <caption>Exemple 2 : Réinitialiser le lecteur</caption>
     * media.setSrc('/new.mp3').load();
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
     * @example <caption>Exemple 1 : Vérifier si le média est prêt</caption>
     * media.on('canplay', () => console.log(media.isReady())); // true
     *
     * @example <caption>Exemple 2 : Exiger un préchargement complet (HAVE_ENOUGH_DATA = 4)</caption>
     * if (media.isReady(4)) media.play();
     */
    isReady(minReadyState = 3) {
        const threshold = typeof minReadyState === 'number' && Number.isFinite(minReadyState)
            ? minReadyState
            : 3;
        return Boolean(this.element && this.element.readyState >= threshold);
    }

    /**
     * Indique si le média est en pause.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : État initial</caption>
     * console.log(new NMedia().isPaused()); // true
     *
     * @example <caption>Exemple 2 : Vérifier avant lecture</caption>
     * if (media.isPaused()) media.play();
     */
    isPaused() {
        return this.element ? Boolean(this.element.paused) : true;
    }

    /**
     * Indique si la lecture a atteint la fin du média.
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier si terminée</caption>
     * console.log(media.isEnded());
     *
     * @example <caption>Exemple 2 : Réagir sur l'événement ended</caption>
     * media.on('ended', () => console.log(media.isEnded())); // true
     */
    isEnded() {
        return Boolean(this.element?.ended);
    }

    /**
     * Indique si le son du média est coupé (`muted`).
     *
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier le mode muet</caption>
     * media.setMuted(true);
     * console.log(media.isMuted()); // true
     *
     * @example <caption>Exemple 2 : Rétablir le son</caption>
     * media.setMuted(false);
     * console.log(media.isMuted()); // false
     */
    isMuted() {
        return Boolean(this.element?.muted);
    }

    /**
     * Met la lecture en pause, libère les ressources et détruit l'instance `NMedia`.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire le lecteur</caption>
     * media.destroy();
     *
     * @example <caption>Exemple 2 : Vérifier la destruction</caption>
     * media.destroy();
     * console.log(media.isDestroyed); // true
     */
    destroy() {
        this.pause();
        super.destroy();
    }
}

export default NMedia;
