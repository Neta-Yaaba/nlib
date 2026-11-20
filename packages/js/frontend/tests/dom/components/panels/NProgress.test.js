import { describe, it, assert } from '../../../../backend/tests/test-helper.js';
import { NProgress, NTag } from '../../../index.js';

describe('NProgress (dom/components/panels/NProgress.js)', () => {
    it('peut être monté dans un conteneur et utilisé en mode global statique', () => {
        const container = new NTag({ tagName: 'div' });
        const localProgress = new NProgress();
        container.append(localProgress);

        assert.equal(localProgress instanceof NTag, true);
        assert.equal(localProgress.hasClass('n-progress'), true);
        assert.equal(localProgress.hasClass('n-progress--fixed'), false);
        assert.equal(localProgress.isVisible(), false);

        localProgress.showProgress('Importation', 45);
        assert.equal(localProgress.isVisible(), true);
        assert.equal(localProgress.getAttr('aria-valuenow'), '45');

        localProgress.setProgress(100, 'Terminé');
        assert.equal(localProgress.getAttr('aria-valuenow'), '100');

        localProgress.hideProgress();
        assert.equal(localProgress.isVisible(), false);

        const globalProgress = NProgress.show('Chargement...', 25);
        assert.equal(globalProgress.hasClass('n-progress--fixed'), true);
        assert.equal(globalProgress.isVisible(), true);
        NProgress.set(80);
        assert.equal(globalProgress.getAttr('aria-valuenow'), '80');
        NProgress.hide();
        assert.equal(globalProgress.isVisible(), false);

        globalProgress.destroy();
        container.destroy();
    });
});
