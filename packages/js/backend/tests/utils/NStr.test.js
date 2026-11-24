import { describe, it, assert } from '../index.js';
import { NStr } from '../../index.js';

describe('NStr (utils/NStr.js)', () => {
    it('valide, compare et nettoie les chaînes avec accents et casse', () => {
        assert.equal(NStr.isString('abc'), true);
        assert.equal(NStr.isEmpty('   '), true);
        assert.equal(NStr.isEmpty(' a '), false);
        assert.equal(NStr.equals('Éléphant', 'elephant', { caseSensitive: false, ignoreAccents: true }), true);
        assert.equal(NStr.contains('Bonjour le monde', 'MONDE', { caseSensitive: false }), true);
        assert.equal(NStr.cleanSpaces('  un   deux   trois  '), 'un deux trois');
    });

    it('transforme la casse, génère des slugs et interpole des templates', () => {
        assert.equal(NStr.capitalize('bonjour'), 'Bonjour');
        assert.equal(NStr.toTitleCase('jean pierre'), 'Jean Pierre');
        assert.equal(NStr.toCamelCase('user_first_name'), 'userFirstName');
        assert.equal(NStr.toPascalCase('user_first_name'), 'UserFirstName');
        assert.equal(NStr.toSnakeCase('userFirstName'), 'user_first_name');
        assert.equal(NStr.toKebabCase('userFirstName'), 'user-first-name');
        assert.equal(NStr.slugify('Facture N° 2026 - Édition'), 'facture-n-2026-edition');
        assert.equal(NStr.splitAt('a/b/c/doc.pdf', '/', -1), 'doc.pdf');
        assert.equal(NStr.template('Salut {name}!', { name: 'Alice' }), 'Salut Alice!');
        assert.equal(NStr.mask('1234567890', { visibleStart: 2, visibleEnd: 2 }), '12******90');
    });

    it('gère escapeHtml/unescapeHtml, truncate, pad, repeat, reverse, countOccurrences et wordCount', () => {
        assert.equal(NStr.startsWith('Bonjour', 'bon', { caseSensitive: false }), true);
        assert.equal(NStr.endsWith('fichier.PDF', '.pdf', { caseSensitive: false }), true);
        assert.equal(NStr.isEmail('contact@nlib.dev'), true);
        assert.equal(NStr.isAlphanumeric('NLib2026'), true);
        assert.equal(NStr.indexOf('Café crème', 'creme', { ignoreAccents: true }), 5);

        const escaped = NStr.escapeHtml('<script>"test"</script>');
        assert.equal(NStr.unescapeHtml(escaped), '<script>"test"</script>');
        assert.equal(NStr.truncate('Bonjour tout le monde', 10), 'Bonjour...');
        assert.equal(NStr.padStart('7', 3, '0'), '007');
        assert.equal(NStr.padEnd('A', 3, '_'), 'A__');
        assert.equal(NStr.repeat('ab', 3), 'ababab');
        assert.equal(NStr.reverse('abc'), 'cba');
        assert.equal(NStr.replaceAll('a-b-c', '-', '_'), 'a_b_c');
        assert.equal(NStr.insertEvery('12345678', 4, ' '), '1234 5678');
        assert.equal(NStr.countOccurrences('banane', 'an'), 2);
        assert.equal(NStr.wordCount('Un deux trois'), 3);
        assert.equal(NStr.random(12).length, 12);
    });
});
