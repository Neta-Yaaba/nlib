import { describe, it, assert } from '../../../../backend/tests/test-helper.js';
import { NImage, NTag } from '../../../index.js';

describe('NImage (dom/elements/NImage.js)', () => {
    it('hérite de NTag, crée une balise img et gère src, alt, loading, decoding et crossOrigin', () => {
        const img = new NImage({
            src: '/logo.png',
            alt: 'Logo NLib',
            loading: 'lazy',
            decoding: 'async',
            crossOrigin: 'anonymous',
            width: 120,
            height: 60
        });

        assert.equal(img instanceof NTag, true);
        assert.equal(img.tagName, 'img');
        assert.equal(img.src, '/logo.png');
        assert.equal(img.alt, 'Logo NLib');
        assert.equal(img.text, 'Logo NLib');

        img.setText('Nouveau texte');
        assert.equal(img.alt, 'Nouveau texte');
        img.text = 'Via setter';
        assert.equal(img.alt, 'Via setter');
        assert.equal(img.getAttr('loading'), 'lazy');
        assert.equal(img.getAttr('decoding'), 'async');
        assert.equal(img.getAttr('crossorigin'), 'anonymous');
        assert.equal(img.getAttr('width'), '120');
        assert.equal(img.getAttr('height'), '60');
        assert.equal(img.isLoaded(), false);
        assert.deepEqual(img.getNaturalSize(), { width: 0, height: 0 });

        img.setSrc(null).setCrossOrigin(null);
        assert.equal(img.src, '');
        assert.equal(img.hasAttr('crossorigin'), false);

        img.destroy();
    });

    it('applique fallbackSrc une seule fois en cas d\'erreur et se nettoie à la destruction', () => {
        const img = new NImage({
            src: '/broken.png',
            fallbackSrc: '/fallback.png'
        });

        img.element.dispatchEvent(new Event('error'));
        assert.equal(img.src, '/fallback.png');

        // Réinitialisation lors d'un nouveau setSrc()
        img.setSrc('/other-broken.png');
        img.element.dispatchEvent(new Event('error'));
        assert.equal(img.src, '/fallback.png');

        img.setFallbackSrc(null);
        img.setSrc('/third-broken.png');
        img.element.dispatchEvent(new Event('error'));
        assert.equal(img.src, '/third-broken.png');

        img.destroy();
        assert.equal(img.isDestroyed, true);
    });
});
