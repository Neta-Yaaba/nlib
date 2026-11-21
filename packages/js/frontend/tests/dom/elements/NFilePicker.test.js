import { describe, it, assert } from '../../index.js';
import { NFilePicker, NTag } from '../../../index.js';

describe('NFilePicker (dom/elements/NFilePicker.js)', () => {
    it('hérite de NTag, crée un input file et gère accept, multiple et getFiles', () => {
        const fb = new NFilePicker({
            name: 'docs',
            accept: '.pdf,image/*',
            multiple: true,
            required: true
        });

        assert.equal(fb instanceof NTag, true);
        assert.equal(fb.hasClass('n-filepicker'), true);
        assert.equal(fb.getAttr('type'), 'file');
        assert.equal(fb.name, 'docs');
        assert.equal(fb.getAttr('accept'), '.pdf,image/*');
        assert.equal(fb.element.multiple, true);
        assert.deepEqual(fb.getFiles(), []);
        assert.equal(fb.isValid(), false);

        fb.setDisabled(true);
        assert.equal(fb.isDisabled(), true);

        fb.destroy();
    });
});
