import { describe, it, assert } from '../index.js';
import { NString } from '../../index.js';

describe('NString (utils/NString.js)', () => {
    const str = new NString();

    it('valide, compare et nettoie les chaînes avec accents et casse', () => {
        assert.equal(str.isString('abc'), true);
        assert.equal(str.isEmpty('   '), true);
        assert.equal(str.isEmpty(' a '), false);
        assert.equal(str.equals('Éléphant', 'elephant', { caseSensitive: false, ignoreAccents: true }), true);
        assert.equal(str.contains('Bonjour le monde', 'MONDE', { caseSensitive: false }), true);
        assert.equal(str.cleanSpaces('  un   deux   trois  '), 'un deux trois');
    });

    it('transforme la casse, génère des slugs et interpole des templates', () => {
        assert.equal(str.capitalize('bonjour'), 'Bonjour');
        assert.equal(str.toTitleCase('jean pierre'), 'Jean Pierre');
        assert.equal(str.toCamelCase('user_first_name'), 'userFirstName');
        assert.equal(str.toPascalCase('user_first_name'), 'UserFirstName');
        assert.equal(str.toSnakeCase('userFirstName'), 'user_first_name');
        assert.equal(str.toKebabCase('userFirstName'), 'user-first-name');
        assert.equal(str.slugify('Facture N° 2026 - Édition'), 'facture-n-2026-edition');
        assert.equal(str.splitAt('a/b/c/doc.pdf', '/', -1), 'doc.pdf');
        assert.equal(str.template('Salut {name}!', { name: 'Alice' }), 'Salut Alice!');
        assert.equal(str.mask('1234567890', { visibleStart: 2, visibleEnd: 2 }), '12******90');
    });

    it('gère escapeHtml/unescapeHtml, truncate, pad, repeat, reverse, countOccurrences et wordCount', () => {
        assert.equal(str.startsWith('Bonjour', 'bon', { caseSensitive: false }), true);
        assert.equal(str.endsWith('fichier.PDF', '.pdf', { caseSensitive: false }), true);
        assert.equal(str.isEmail('contact@nlib.dev'), true);
        assert.equal(str.isAlphanumeric('NLib2026'), true);
        assert.equal(str.indexOf('Café crème', 'creme', { ignoreAccents: true }), 5);

        const escaped = str.escapeHtml('<script>"test"</script>');
        assert.equal(str.unescapeHtml(escaped), '<script>"test"</script>');
        assert.equal(str.truncate('Bonjour tout le monde', 10), 'Bonjour...');
        assert.equal(str.padStart('7', 3, '0'), '007');
        assert.equal(str.padEnd('A', 3, '_'), 'A__');
        assert.equal(str.repeat('ab', 3), 'ababab');
        assert.equal(str.reverse('abc'), 'cba');
        assert.equal(str.replaceAll('a-b-c', '-', '_'), 'a_b_c');
        assert.equal(str.insertEvery('12345678', 4, ' '), '1234 5678');
        assert.equal(str.countOccurrences('banane', 'an'), 2);
        assert.equal(str.wordCount('Un deux trois'), 3);
        assert.equal(str.random(12).length, 12);
    });
});
