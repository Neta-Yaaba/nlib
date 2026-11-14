import { describe, it, assert } from '../test-helper.js';
import { NString } from '../../index.js';

describe('NString (utils/NString.js)', () => {
    const str = new NString();

    it('valide, compare et nettoie les chaînes avec accents et casse', () => {
        assert.equal(str.isString('abc'), true);
        assert.equal(str.isEmpty('   '), true);
        assert.equal(str.isNotEmpty(' a '), true);
        assert.equal(str.equals('Éléphant', 'elephant', { caseSensitive: false, ignoreAccents: true }), true);
        assert.equal(str.contains('Bonjour le monde', 'MONDE', { caseSensitive: false }), true);
        assert.equal(str.cleanSpaces('  un   deux   trois  '), 'un deux trois');
    });

    it('transforme la casse, génère des slugs et interpole des templates', () => {
        assert.equal(str.capitalize('bonjour'), 'Bonjour');
        assert.equal(str.capitalizeWords('jean pierre'), 'Jean Pierre');
        assert.equal(str.toCamelCase('user_first_name'), 'userFirstName');
        assert.equal(str.toPascalCase('user_first_name'), 'UserFirstName');
        assert.equal(str.toSnakeCase('userFirstName'), 'user_first_name');
        assert.equal(str.toKebabCase('userFirstName'), 'user-first-name');
        assert.equal(str.slugify('Facture N° 2026 - Édition'), 'facture-n-2026-edition');
        assert.equal(str.splitAt('a/b/c/doc.pdf', '/', -1), 'doc.pdf');
        assert.equal(str.template('Salut {name}!', { name: 'Alice' }), 'Salut Alice!');
        assert.equal(str.mask('1234567890', { visibleStart: 2, visibleEnd: 2 }), '12******90');
    });
});
