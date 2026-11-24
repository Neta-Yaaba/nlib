import { describe, it, assert } from '../index.js';
import { NPhone } from '../../index.js';

describe('NPhone (utils/NPhone.js)', () => {
    it('nettoie, valide, parse et formate les numéros de téléphone', () => {
        assert.equal(NPhone.clean('00226 70-12-34-56'), '+22670123456');
        assert.equal(NPhone.isValid('+22670123456'), true);
        assert.equal(NPhone.isE164('+22670123456'), true);
        assert.equal(NPhone.toE164('70 12 34 56', '226'), '+22670123456');
        assert.equal(NPhone.toNational('+22670123456', '226'), '70123456');
        assert.equal(NPhone.equals('70123456', '+226 70 12 34 56', '226'), true);
        assert.equal(NPhone.format('+22670123456', { countryCode: '226', separator: ' ' }), '+226 70 12 34 56');
        assert.equal(NPhone.format('70123456'), '70 12 34 56');
        assert.equal(NPhone.mask('+22670123456'), '+226******56');
        assert.equal(NPhone.toTelUri('+22670123456'), 'tel:+22670123456');
        assert.ok(NPhone.toWhatsAppUrl('+22670123456', 'Salut').startsWith('https://wa.me/22670123456'));
    });
});
