import { describe, it, assert } from '../../index.js';
import { NMedia, NTag } from '../../../index.js';

describe('NMedia (dom/elements/NMedia.js)', () => {
    it('hérite de NTag et configure les options média de base', () => {
        const media = new NMedia({
            tagName: 'audio',
            controls: true,
            autoplay: false,
            loop: true,
            muted: true,
            preload: 'auto',
            crossOrigin: 'anonymous',
            volume: 0.6,
            playbackRate: 1.5
        });

        assert.equal(media instanceof NTag, true);
        assert.equal(media.tagName, 'audio');
        assert.equal(media.hasAttr('controls'), true);
        assert.equal(media.hasAttr('loop'), true);
        assert.equal(media.isMuted(), true);
        assert.equal(media.getAttr('preload'), 'auto');
        assert.equal(media.getAttr('crossorigin'), 'anonymous');
        assert.equal(media.volume, 0.6);
        assert.equal(media.playbackRate, 1.5);

        media.setCrossOrigin(null);
        assert.equal(media.hasAttr('crossorigin'), false);

        media.setControls(false).setLoop(false).setMuted(false);
        assert.equal(media.hasAttr('controls'), false);
        assert.equal(media.hasAttr('loop'), false);
        assert.equal(media.isMuted(), false);

        media.destroy();
        assert.equal(media.isDestroyed, true);
    });

    it('gère seek, stop, load, addSource et le repli vers audio pour un tagName invalide', () => {
        const media = new NMedia({ tagName: 'span', src: '/clip.mp3' });
        assert.equal(media.tagName, 'audio');
        assert.equal(media.src, '/clip.mp3');

        media.seek(12);
        assert.equal(typeof media.currentTime, 'number');
        assert.equal(typeof media.duration, 'number');

        media.addSource('/clip.ogg', 'audio/ogg');
        assert.equal(media.src, '');
        assert.equal(media.children.length, 1);

        media.stop().load();
        assert.equal(media.isPaused(), true);
        assert.equal(media.isEnded(), false);
        assert.equal(media.isReady(), false);

        media.destroy();
    });
});
