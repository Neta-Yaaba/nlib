import { describe, it, assert } from '../test-helper.js';
import { NPassword } from '../../index.js';

describe('NPassword (utils/NPassword.js)', () => {
    const pwd = new NPassword();

    it('génère, valide et évalue la robustesse des mots de passe et PIN', async () => {
        const generated = pwd.generate(16);
        assert.equal(generated.length, 16);
        assert.equal(pwd.isStrong(generated), true);

        const evalResult = pwd.strength(generated);
        assert.ok(evalResult.score >= 3);

        const pin = pwd.generatePin(6);
        assert.equal(pin.length, 6);
        assert.equal(/^\d{6}$/.test(pin), true);

        const hashed = await pwd.hash('MonSuperMotDePasse!2026', 1000);
        if (hashed) {
            const verified = await pwd.verify('MonSuperMotDePasse!2026', hashed);
            const wrong = await pwd.verify('MauvaisMotDePasse', hashed);
            assert.equal(verified, true);
            assert.equal(wrong, false);
        }
    });
});
