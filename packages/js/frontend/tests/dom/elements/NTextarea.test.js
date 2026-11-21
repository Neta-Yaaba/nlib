import { describe, it, assert } from '../../index.js';
import { NTextarea, NTag } from '../../../index.js';

describe('NTextarea (dom/elements/NTextarea.js)', () => {
    it('hérite de NTag, crée une balise textarea et gère rows, cols, wrap, readonly et validation', () => {
        const ta = new NTextarea({
            name: 'bio',
            placeholder: 'Bio...',
            rows: 5,
            cols: 40,
            wrap: 'soft',
            minLength: 3,
            maxLength: 200,
            value: 'Bonjour'
        });

        assert.equal(ta instanceof NTag, true);
        assert.equal(ta.tagName, 'textarea');
        assert.equal(ta.hasClass('n-textarea'), true);
        assert.equal(ta.name, 'bio');
        assert.equal(ta.placeholder, 'Bio...');
        assert.equal(ta.rows, 5);
        assert.equal(ta.cols, 40);
        assert.equal(ta.getValue(), 'Bonjour');
        assert.equal(ta.isValid(), true);

        ta.setReadOnly(true).setDisabled(true);
        assert.equal(ta.isReadOnly(), true);
        assert.equal(ta.isDisabled(), true);

        ta.setDisabled(false).setRequired(true).clear();
        assert.equal(ta.getValue(), '');
        assert.equal(ta.isValid(), false);

        ta.destroy();
    });
});
