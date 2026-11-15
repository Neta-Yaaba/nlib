import { describe, it, assert } from '../test-helper.js';
import { NPhoneNumber } from '../../index.js';

describe('NPhoneNumber (utils/NPhoneNumber.js)', () => {
    const phone = new NPhoneNumber();

    it('nettoie, valide, parse et formate les numéros de téléphone', () => {
        assert.equal(phone.clean('00226 70-12-34-56'), '+22670123456');
        assert.equal(phone.isValid('+22670123456'), true);
        assert.equal(phone.isE164('+22670123456'), true);
        assert.equal(phone.toE164('70 12 34 56', '226'), '+22670123456');
        assert.equal(phone.toNational('+22670123456', '226'), '70123456');
        assert.equal(phone.equals('70123456', '+226 70 12 34 56', '226'), true);
        assert.equal(phone.format('+22670123456', 'international'), '+22 67 01 23 45 6');
    });
});
