import { describe, it, assert } from '../../index.js';
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

        // NTag externe refusé en icône et en texte
        const externalTag = new NTag('span').setText('Externe');
        btn.setIcon(externalTag);
        assert.equal(btn.children[1], oldIcon);
        btn.setText(externalTag);
        assert.equal(btn.getText(), 'Suivant');
        externalTag.destroy();

        btn.setIcon({ type: 'image', value: '/icons/custom.png' });
        assert.equal(oldIcon.isDestroyed, false);
        assert.equal(btn.children[1].src, '/icons/custom.png');
        btn.setIcon({ src: '/icons/custom2.png' });
        assert.equal(oldIcon.isDestroyed, true);
        btn.setIcon(null);
        assert.equal(btn.children.length, 1);
        btn.setIcon('/icons/custom.png');

        // Icône emoji via { type: 'emoji', value } dans le constructeur et setIcon()
        const emojiBtn = new NButton({
            text: 'Lancer',
            icon: { type: 'emoji', value: '🚀' }
        });
        const emojiTag = emojiBtn.children[0];
        assert.equal(emojiTag instanceof NImage, false);
        assert.equal(emojiTag.tagName, 'span');
        assert.equal(emojiTag.text, '🚀');
        assert.equal(emojiTag.hasClass('n-button__icon'), true);
        emojiBtn.setIcon({ type: 'emoji', value: '🔥' });
        assert.equal(emojiBtn.children[0], emojiTag);
        assert.equal(emojiBtn.children[0].text, '🔥');
        emojiBtn.destroy();

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

        // Si icône seule avec alt -> aria-label auto, puis supprimé quand du texte est ajouté
        const iconOnly = new NButton({ icon: { src: '/icons/close.png', alt: 'Fermer' } });
        assert.equal(iconOnly.getAttr('aria-label'), 'Fermer');
        iconOnly.setText('Fermer la fenêtre');
        assert.equal(iconOnly.hasAttr('aria-label'), false);
        iconOnly.destroy();

        btn.setIcon(null);
        assert.equal(btn.children.length, 0);
        assert.equal(btn.hasClass('n-button--icon-only'), false);

        btn.destroy();
    });

    it('gère loading sans écraser disabled initial, bloque les clics et supporte applyLanguage()', async () => {
        const btn = new NButton({
            text: 'Envoyer',
            disabled: false,
            applyLanguage: (b) => b.setText(b.lang.get('actions.send'))
        });

        await btn.lang.init({
            language: 'fr',
            fallback: 'en',
            languages: {
                fr: { actions: { send: 'Envoyer' } },
                en: { actions: { send: 'Send' } }
            }
        });
        btn.applyLanguage();
        assert.equal(btn.getText(), 'Envoyer');

        await btn.lang.setLanguage('en');
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
