import { describe, it, assert } from '../../index.js';
import { NRadioBox, NTag } from '../../../index.js';

describe('NRadioBox (dom/elements/NRadioBox.js)', () => {
    it('hérite de NTag, crée un input radio et gère checked, disabled et validation', () => {
        const radio = new NRadioBox({
            name: 'plan',
            value: 'pro',
            checked: true,
            required: true
        });

        assert.equal(radio instanceof NTag, true);
        assert.equal(radio.hasClass('n-radiobox'), true);
        assert.equal(radio.getAttr('type'), 'radio');
        assert.equal(radio.name, 'plan');
        assert.equal(radio.value, 'pro');
        assert.equal(radio.isChecked(), true);
        assert.equal(radio.isValid(), true);

        radio.clear();
        assert.equal(radio.isChecked(), false);

        radio.setDisabled(true);
        assert.equal(radio.isDisabled(), true);

        radio.destroy();
    });
});
