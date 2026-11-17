import { describe, it, assert } from '../../../../backend/tests/test-helper.js';
import { NInput, NTag } from '../../../index.js';

describe('NInput (dom/elements/NInput.js)', () => {
    it('hérite de NTag, crée un input et gère les types texte, email, password et nombre', () => {
        const email = new NInput({
            type: 'email',
            name: 'userEmail',
            placeholder: 'nom@exemple.com',
            required: true,
            autocomplete: 'email'
        });

        assert.equal(email instanceof NTag, true);
        assert.equal(email.tagName, 'input');
        assert.equal(email.hasClass('n-input'), true);
        assert.equal(email.type, 'email');
        assert.equal(email.name, 'userEmail');
        assert.equal(email.placeholder, 'nom@exemple.com');
        assert.equal(email.isRequired(), true);
        assert.equal(email.getAttr('autocomplete'), 'email');

        email.setValue('invalide');
        assert.equal(email.isValid(), false);
        assert.equal(email.hasClass('n-input--invalid'), true);

        email.setValue('madi@nlib.dev');
        assert.equal(email.isValid(), true);
        assert.equal(email.hasClass('n-input--invalid'), false);

        const num = new NInput({ type: 'number', min: 0, max: 100, step: 5, value: 45 });
        assert.equal(num.getValueAsNumber(), 45);
        assert.equal(num.getAttr('min'), '0');
        assert.equal(num.getAttr('max'), '100');
        assert.equal(num.getAttr('step'), '5');

        num.clear();
        assert.equal(num.value, '');
        assert.equal(num.getValueAsNumber(), null);

        email.destroy();
        num.destroy();
    });

    it('gère checkbox, indeterminate, file, disabled, readonly et validation personnalisée', () => {
        const cb = new NInput({ type: 'checkbox', checked: true, indeterminate: true });
        assert.equal(cb.isChecked(), true);
        assert.equal(cb.isIndeterminate(), true);
        cb.toggleChecked();
        assert.equal(cb.isChecked(), false);
        cb.clear();
        assert.equal(cb.isChecked(), false);
        assert.equal(cb.isIndeterminate(), false);

        const file = new NInput({ type: 'file', accept: ['.png', '.jpg'], multiple: true });
        assert.equal(file.getAttr('accept'), '.png,.jpg');
        assert.equal(file.hasAttr('multiple'), true);
        assert.deepEqual(file.getFiles(), []);

        const text = new NInput('text').setDisabled(true).setReadOnly(true);
        assert.equal(text.isDisabled(), true);
        assert.equal(text.hasClass('n-input--disabled'), true);
        assert.equal(text.isReadOnly(), true);
        assert.equal(text.hasClass('n-input--readonly'), true);

        text.setDisabled(false).setReadOnly(false);
        text.setCustomValidity('Erreur métier');
        assert.equal(text.hasClass('n-input--invalid'), true);
        assert.equal(text.getValidationMessage(), 'Erreur métier');
        text.setCustomValidity('');
        assert.equal(text.hasClass('n-input--invalid'), false);

        cb.destroy();
        file.destroy();
        text.destroy();
    });
});
