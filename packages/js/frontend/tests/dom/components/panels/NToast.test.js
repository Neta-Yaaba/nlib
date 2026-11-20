import { describe, it, assert } from '../../../index.js';
import { NToast, NTag } from '../../../../index.js';

describe('NToast (dom/components/panels/NToast.js)', () => {
    it('hérite de NTag, crée une instance statique avec show() et masque avec hide()', () => {
        const toast = NToast.show('Sauvegardé', { type: 'success', duration: 0, position: 'top' });

        assert.equal(toast instanceof NTag, true);
        assert.equal(toast.hasClass('n-toast'), true);
        assert.equal(toast.hasClass('n-toast--success'), true);
        assert.equal(toast.hasClass('n-toast--top'), true);
        assert.equal(toast.text, 'Sauvegardé');
        assert.equal(toast.isVisible(), true);

        NToast.hide();
        assert.equal(toast.isVisible(), false);

        toast.destroy();
        assert.equal(toast.isDestroyed, true);
    });
});
