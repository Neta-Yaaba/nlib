import { describe, it, assert } from '../../index.js';
import { NEditText, NTag } from '../../../index.js';

describe('NEditText (dom/elements/NEditText.js)', () => {
    it('h�rite de NTag, g�re les types textuels, pattern, longueur et validation', () => {
        const tb = new NEditText({
            type: 'email',
            name: 'email',
            placeholder: 'nom@exemple.com',
            required: true,
            value: 'alice@example.com'
        });

        assert.equal(tb instanceof NTag, true);
        assert.equal(tb.hasClass('n-edittext'), true);
        assert.equal(tb.type, 'email');
        assert.equal(tb.getValue(), 'alice@example.com');
        assert.equal(tb.isValid(), true);

        tb.setValue('pas-un-email');
        assert.equal(tb.isValid(), false);

        tb.setCustomValidity('Erreur custom');
        assert.equal(tb.getValidationMessage(), 'Erreur custom');
        tb.setCustomValidity('');

        tb.setType('password').setMinLength(8).setMaxLength(32).clear();
        assert.equal(tb.type, 'password');
        assert.equal(tb.getValue(), '');

        tb.destroy();
    });
});
