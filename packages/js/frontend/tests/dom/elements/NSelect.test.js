import { describe, it, assert } from '../../index.js';
import { NSelect, NTag } from '../../../index.js';

describe('NSelect (dom/elements/NSelect.js)', () => {
    it('hérite de NTag, crée un select et gère options, sélection simple/multiple et clear', () => {
        const sel = new NSelect({
            name: 'country',
            options: [
                { value: 'fr', label: 'France' },
                { value: 'sn', label: 'Sénégal' }
            ],
            value: 'sn',
            required: true
        });

        assert.equal(sel instanceof NTag, true);
        assert.equal(sel.tagName, 'select');
        assert.equal(sel.hasClass('n-select'), true);
        assert.equal(sel.getValue(), 'sn');
        assert.deepEqual(sel.getSelectedValues(), ['sn']);
        assert.equal(sel.isValid(), true);

        sel.addOption('ci', 'Côte d\'Ivoire');
        sel.setValue('ci');
        assert.equal(sel.getValue(), 'ci');

        sel.removeOption('ci');
        sel.clear();
        assert.deepEqual(sel.getSelectedValues(), []);
        assert.equal(sel.isValid(), false);

        sel.clearOptions();
        assert.equal(sel.element.options.length, 0);

        const multi = new NSelect({
            multiple: true,
            options: ['js', 'css', 'html'],
            value: ['js', 'html']
        });
        assert.deepEqual(multi.getSelectedValues(), ['js', 'html']);
        multi.setValue(['css']);
        assert.deepEqual(multi.getSelectedValues(), ['css']);
        multi.destroy();

        sel.destroy();
    });
});
