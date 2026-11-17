import { describe, it, assert } from '../../../../backend/tests/test-helper.js';
import { NAudio, NTag } from '../../../index.js';

describe('NAudio (dom/elements/NAudio.js)', () => {
    it('hérite de NTag, crée une balise audio et configure attributs, sources, volume et vitesse', () => {
        const audio = new NAudio({
            src: '/track.mp3',
            controls: true,
            loop: true,
            muted: true,
            preload: 'metadata',
            volume: 0.3,
            playbackRate: 1.25,
            sources: [
                { src: '/track.ogg', type: 'audio/ogg' }
            ]
        });

        assert.equal(audio instanceof NTag, true);
        assert.equal(audio.tagName, 'audio');
        assert.equal(audio.src, '/track.mp3');
        assert.equal(audio.hasAttr('controls'), true);
        assert.equal(audio.hasAttr('loop'), true);
        assert.equal(audio.isMuted(), true);
        assert.equal(audio.getAttr('preload'), 'metadata');
        assert.equal(audio.volume, 0.3);
        assert.equal(audio.playbackRate, 1.25);
        assert.equal(audio.children.length, 1);
        assert.equal(audio.children[0].tagName, 'source');
        assert.equal(audio.children[0].getAttr('type'), 'audio/ogg');

        audio.setVolume(-1).setPlaybackRate(0.5);
        assert.equal(audio.volume, 0);
        assert.equal(audio.playbackRate, 0.5);

        assert.equal(audio.isReady(), false);
        assert.equal(audio.isPaused(), true);
        assert.equal(audio.isEnded(), false);

        audio.destroy();
        assert.equal(audio.isDestroyed, true);
    });

    it('gère setSrc(null), stop() et destroy()', () => {
        const audio = new NAudio('/sound.mp3');
        assert.equal(audio.src, '/sound.mp3');

        audio.setSrc(null).stop();
        assert.equal(audio.src, '');
        assert.equal(audio.currentTime, 0);

        audio.destroy();
        assert.equal(audio.isDestroyed, true);
    });
});
