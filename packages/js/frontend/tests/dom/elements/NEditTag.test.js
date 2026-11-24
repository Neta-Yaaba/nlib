import { describe, it, assert } from '../../index.js';
import { NEditTag, NTag } from '../../../index.js';

describe('NEditTag (dom/elements/NEditTag.js)', () => {
    it('hérite de NTag, configure contenteditable, data-placeholder et value', () => {
        const ed = new NEditTag({
            tagName: 'span',
            placeholder: 'Saisir...',
            spellcheck: false,
            value: 'Initial'
        });

        assert.equal(ed instanceof NTag, true);
        assert.equal(ed.tagName, 'span');
        assert.equal(ed.hasClass('n-edittag'), true);
        assert.equal(ed.isEditable(), true);
        assert.equal(ed.placeholder, 'Saisir...');
        assert.equal(ed.getAttr('spellcheck'), 'false');
        assert.equal(ed.getValue(), 'Initial');

        ed.setEditable('plaintext-only');
        assert.equal(ed.editable, 'plaintext-only');
        assert.equal(ed.isEditable(), true);

        ed.setEditable(false);
        assert.equal(ed.isEditable(), false);

        ed.setPlaceholder(null);
        assert.equal(ed.placeholder, '');

        ed.clear();
        assert.equal(ed.getValue(), '');

        ed.destroy();
    });
});
