import { describe, it, assert } from '../../index.js';
import { NEditNumber, NTag } from '../../../index.js';

describe('NEditNumber (dom/elements/NEditNumber.js)', () => {
    it('hérite de NTag, gère number/range, min/max/step et getValueAsNumber', () => {
        const nb = new NEditNumber({
            name: 'qty',
            min: 1,
            max: 10,
            step: 0.5,
            value: 4.5
        });

        assert.equal(nb instanceof NTag, true);
        assert.equal(nb.hasClass('n-editnumber'), true);
        assert.equal(nb.type, 'number');
        assert.equal(nb.getValueAsNumber(), 4.5);
        assert.equal(nb.isValid(), true);

        nb.setValue(20);
        assert.equal(nb.isValid(), false);

        nb.setType('range');
        assert.equal(nb.type, 'range');

        nb.setType('number').clear();
        assert.equal(nb.getValueAsNumber(), null);

        nb.destroy();
    });
});
