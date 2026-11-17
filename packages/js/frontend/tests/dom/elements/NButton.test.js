import { describe, it, assert } from '../../../../backend/tests/test-helper.js';
import { NButton, NImage, NTag } from '../../../index.js';

describe('NButton (dom/elements/NButton.js)', () => {
    it('hérite de NTag, crée un button avec type et icône NImage', () => {
        const btn = new NButton({
            text: 'Enregistrer',
            icon: '/icons/check.png',
            type: 'submit'
        });

        assert.equal(btn instanceof NTag, true);
        assert.equal(btn.tagName, 'button');
        assert.equal(btn.getAttr('type'), 'submit');
        assert.equal(btn.hasClass('n-button'), true);
        assert.equal(btn.getText(), 'Enregistrer');
        assert.equal(btn.children.length, 2);
        assert.equal(btn.children[0] instanceof NImage, true);
        assert.equal(btn.children[0].hasClass('n-button__icon'), true);
        assert.equal(btn.children[0].getAttr('aria-hidden'), 'true');
        assert.equal(btn.children[1].hasClass('n-button__text'), true);

        btn.setType('reset');
        assert.equal(btn.getAttr('type'), 'reset');

        btn.destroy();
        assert.equal(btn.isDestroyed, true);
    });

    it('gère positionnement de l\'icône NImage, remplacement sans fuite et bouton icône seule', () => {
        const btn = new NButton({
            text: 'Suivant',
            icon: { src: '/icons/arrow.png', alt: 'Suivant' },
            iconPosition: 'right'
        });

        assert.equal(btn.children.length, 2);
        assert.equal(btn.children[0].hasClass('n-button__text'), true);
        assert.equal(btn.children[1] instanceof NImage, true);
        assert.equal(btn.children[1].hasClass('n-button__icon'), true);

        const oldIcon = btn.children[1];
        btn.setIcon('/icons/next.png');
        assert.equal(btn.children[1], oldIcon);
        assert.equal(oldIcon.src, '/icons/next.png');

        btn.setIcon(new NImage('/icons/custom.png'));
        assert.equal(oldIcon.isDestroyed, true);

        btn.setIconPosition('top');
        assert.equal(btn.hasClass('n-button--icon-top'), true);
        assert.equal(btn.children[0] instanceof NImage, true);
        assert.equal(btn.children[1].hasClass('n-button__text'), true);

        btn.setIconPosition('bottom');
        assert.equal(btn.hasClass('n-button--icon-bottom'), true);
        assert.equal(btn.children[0].hasClass('n-button__text'), true);
        assert.equal(btn.children[1] instanceof NImage, true);

        btn.setText('');
        assert.equal(btn.hasClass('n-button--icon-only'), true);
        assert.equal(btn.children.length, 1);

        btn.removeIcon();
        assert.equal(btn.children.length, 0);
        assert.equal(btn.hasClass('n-button--icon-only'), false);

        btn.destroy();
    });

    it('gère loading sans écraser disabled initial, bloque les clics et supporte applyLanguage()', async () => {
        const btn = new NButton({
            text: 'Envoyer',
            disabled: false,
            applyLanguage: (b) => b.setText(b.util.lang.get('actions.send'))
        });

        await btn.util.lang.init({
            language: 'fr',
            fallback: 'en',
            languages: {
                fr: { actions: { send: 'Envoyer' } },
                en: { actions: { send: 'Send' } }
            }
        });
        btn.applyLanguage();
        assert.equal(btn.getText(), 'Envoyer');

        await btn.util.lang.setLanguage('en');
        btn.setLanguage('en');
        assert.equal(btn.getText(), 'Send');

        // Loading activé -> aria-busy, disabled DOM true, mais isDisabled() reste false
        btn.setLoading(true).setLoading(true);
        assert.equal(btn.isLoading(), true);
        assert.equal(btn.isDisabled(), false);
        assert.equal(btn.getAttr('aria-busy'), 'true');
        assert.equal(btn.getProperty('disabled'), true);
        assert.equal(btn.children.filter((c) => c.hasClass('n-button__spinner')).length, 1);

        // Fin de chargement -> restaure l'état interactif initial
        btn.setLoading(false);
        assert.equal(btn.isLoading(), false);
        assert.equal(btn.hasAttr('aria-busy'), false);
        assert.equal(btn.getProperty('disabled'), false);
        assert.equal(btn.getText(), 'Send');

        // Si disabled initial était true, setLoading(false) garde disabled true
        btn.setDisabled(true).setLoading(true).setLoading(false);
        assert.equal(btn.isDisabled(), true);
        assert.equal(btn.getProperty('disabled'), true);

        btn.destroy();
    });
});
