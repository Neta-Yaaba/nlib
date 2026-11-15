import { describe, it, assert } from '../test-helper.js';
import { NEmail } from '../../index.js';

describe('NEmail (utils/NEmail.js)', () => {
    const email = new NEmail();

    it('valide, classifie et analyse les adresses e-mail', () => {
        assert.equal(email.isValid('contact@nlib.dev'), true);
        assert.equal(email.isValid('invalide@@test'), false);
        assert.equal(email.isFreeProvider('user@gmail.com'), true);
        assert.equal(email.isDisposable('temp@yopmail.com'), true);
        assert.equal(email.isBusiness('direction@nlib.dev'), true);

        const parsed = email.parse('Client+VIP@Boutique.FR');
        assert.equal(parsed.baseLocal, 'client');
        assert.equal(parsed.tag, 'vip');
        assert.equal(parsed.domain, 'boutique.fr');
        assert.equal(parsed.tld, 'fr');
    });

    it('normalise, masque et extrait les adresses dun texte', () => {
        assert.equal(email.normalize('User+Tag@Gmail.com', { stripPlusTag: true }), 'user@gmail.com');
        assert.equal(email.mask('contact@nlib.dev'), 'co****t@nlib.dev');
        assert.equal(email.formatDisplay('contact@nlib.dev', 'Support NLib'), 'Support NLib <contact@nlib.dev>');
        assert.deepEqual(
            email.extractFromText('Écrivez à a@test.com ou b@test.org et encore a@test.com'),
            ['a@test.com', 'b@test.org']
        );
    });
});
