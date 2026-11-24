import { describe, it, assert } from '../index.js';
import { NEmail } from '../../index.js';

describe('NEmail (utils/NEmail.js)', () => {
    it('valide, classifie et analyse les adresses e-mail', () => {
        assert.equal(NEmail.isValid('contact@nlib.dev'), true);
        assert.equal(NEmail.isValid('invalide@@test'), false);
        assert.equal(NEmail.isFreeProvider('user@gmail.com'), true);
        assert.equal(NEmail.isDisposable('temp@yopmail.com'), true);
        assert.equal(NEmail.isBusiness('direction@nlib.dev'), true);

        const parsed = NEmail.parse('Client+VIP@Boutique.FR');
        assert.equal(parsed.baseLocal, 'client');
        assert.equal(parsed.tag, 'vip');
        assert.equal(parsed.domain, 'boutique.fr');
        assert.equal(parsed.tld, 'fr');
    });

    it('normalise, masque et extrait les adresses dun texte', () => {
        assert.equal(NEmail.normalize('User+Tag@Gmail.com', { stripPlusTag: true }), 'user@gmail.com');
        assert.equal(NEmail.mask('contact@nlib.dev'), 'co****t@nlib.dev');
        assert.equal(NEmail.formatDisplay('contact@nlib.dev', 'Support NLib'), 'Support NLib <contact@nlib.dev>');
        assert.deepEqual(
            NEmail.extractFromText('Écrivez à a@test.com ou b@test.org et encore a@test.com'),
            ['a@test.com', 'b@test.org']
        );
    });

    it('gère hasDomain, equals, getLocalPart/getDomain/getTld et listes personnalisées', () => {
        assert.equal(NEmail.hasDomain('admin@sub.nlib.dev', 'nlib.dev', true), true);
        assert.equal(NEmail.hasDomain('admin@sub.nlib.dev', 'nlib.dev', false), false);
        assert.equal(NEmail.equals('User+1@Gmail.com', 'user@gmail.com', { stripPlusTag: true }), true);
        assert.equal(NEmail.getLocalPart('User+VIP@Test.fr', true), 'user');
        assert.equal(NEmail.getDomain('User@Test.FR'), 'test.fr');
        assert.equal(NEmail.getTld('User@Test.FR'), 'fr');
        assert.equal(NEmail.isFreeProvider('a@customfree.org', ['customfree.org']), true);
        assert.equal(NEmail.isDisposable('a@trash.org', ['trash.org']), true);
    });
});
