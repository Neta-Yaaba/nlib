import { describe, it, assert } from '../../../../backend/tests/test-helper.js';
import { NVideo, NTag } from '../../../index.js';

describe('NVideo (dom/elements/NVideo.js)', () => {
    it('hérite de NTag, crée une balise video et configure attributs, sources, volume et vitesse', () => {
        const video = new NVideo({
            poster: '/poster.jpg',
            controls: true,
            loop: true,
            muted: true,
            playsInline: true,
            preload: 'metadata',
            volume: 0.4,
            playbackRate: 1.5,
            width: 640,
            height: 360,
            sources: [
                { src: '/demo.webm', type: 'video/webm' }
            ]
        });

        assert.equal(video instanceof NTag, true);
        assert.equal(video.tagName, 'video');
        assert.equal(video.src, '');
        assert.equal(video.poster, '/poster.jpg');
        assert.equal(video.hasAttr('controls'), true);
        assert.equal(video.hasAttr('loop'), true);
        assert.equal(video.isMuted(), true);
        assert.equal(video.hasAttr('playsinline'), true);
        assert.equal(video.getAttr('preload'), 'metadata');
        assert.equal(video.volume, 0.4);
        assert.equal(video.playbackRate, 1.5);
        assert.equal(video.children.length, 1);
        assert.equal(video.children[0].tagName, 'source');
        assert.equal(video.children[0].getAttr('type'), 'video/webm');

        video.setSrc('/demo.mp4');
        assert.equal(video.src, '/demo.mp4');
        assert.equal(video.children.length, 0);

        video.setVolume(2).setPlaybackRate(0.75);
        assert.equal(video.volume, 1);
        assert.equal(video.playbackRate, 0.75);

        assert.equal(video.isReady(), false);
        assert.equal(video.isPaused(), true);
        assert.equal(video.isEnded(), false);
        assert.deepEqual(video.getVideoSize(), { width: 0, height: 0 });

        video.destroy();
        assert.equal(video.isDestroyed, true);
    });

    it('gère setSrc(null), setPoster(null), stop() et destroy()', () => {
        const video = new NVideo('/clip.mp4');
        video.setPoster('/cover.png');
        assert.equal(video.src, '/clip.mp4');
        assert.equal(video.poster, '/cover.png');

        video.setSrc(null).setPoster(null).stop();
        assert.equal(video.src, '');
        assert.equal(video.poster, '');
        assert.equal(video.currentTime, 0);

        video.destroy();
        assert.equal(video.isDestroyed, true);
    });
});
