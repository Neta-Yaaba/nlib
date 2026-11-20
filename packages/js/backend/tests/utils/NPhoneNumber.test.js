import { describe, it, assert } from '../index.js';
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
        assert.equal(phone.format('+22670123456', { countryCode: '226', separator: ' ' }), '+226 70 12 34 56');
        assert.equal(phone.format('70123456'), '70 12 34 56');
        assert.equal(phone.mask('+22670123456'), '+226******56');
        assert.equal(phone.toTelUri('+22670123456'), 'tel:+22670123456');
        assert.ok(phone.toWhatsAppUrl('+22670123456', 'Salut').startsWith('https://wa.me/22670123456'));
    });
});
