import { describe, it, assert } from '../../index.js';
import { NCheckBox, NTag } from '../../../index.js';

describe('NCheckBox (dom/elements/NCheckBox.js)', () => {
    it('hérite de NTag, crée un input checkbox et gère checked, indeterminate et clear', () => {
        const cb = new NCheckBox({
            name: 'terms',
            value: 'accepted',
            checked: true,
            indeterminate: true,
            required: true
        });

        assert.equal(cb instanceof NTag, true);
        assert.equal(cb.hasClass('n-checkbox'), true);
        assert.equal(cb.getAttr('type'), 'checkbox');
        assert.equal(cb.name, 'terms');
        assert.equal(cb.value, 'accepted');
        assert.equal(cb.isChecked(), true);
        assert.equal(cb.isIndeterminate(), true);
        assert.equal(cb.isRequired(), true);
        assert.equal(cb.isValid(), true);

        cb.toggleChecked();
        assert.equal(cb.isChecked(), false);
        assert.equal(cb.isValid(), false);

        cb.setChecked(true).clear();
        assert.equal(cb.isChecked(), false);
        assert.equal(cb.isIndeterminate(), false);

        cb.destroy();
    });
});
