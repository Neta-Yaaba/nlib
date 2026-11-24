import { describe, it, assert } from '../index.js';
import { NPass } from '../../index.js';

describe('NPass (utils/NPass.js)', () => {
    it('génère, valide et évalue la robustesse des mots de passe et PIN', async () => {
        const generated = NPass.generate(16);
        assert.equal(generated.length, 16);
        assert.equal(NPass.isValid(generated), true);

        const evalResult = NPass.evaluate(generated);
        assert.equal(evalResult.isValid, true);
        assert.ok(evalResult.score >= 50);

        assert.equal(NPass.isCommon('123456'), true);
        assert.ok(NPass.calculateEntropy('Abc123!@#xyz') > 0);
        assert.equal(NPass.timingSafeEquals('abc', 'abc'), true);
        assert.equal(NPass.timingSafeEquals('abc', 'abd'), false);

        const pin = NPass.generatePin(6);
        assert.equal(pin.length, 6);
        assert.equal(/^\d{6}$/.test(pin), true);

        const hashed = await NPass.hash('MonSuperMotDePasse!2026', { iterations: 1000 });
        if (hashed) {
            const verified = await NPass.verify('MonSuperMotDePasse!2026', hashed);
            const wrong = await NPass.verify('MauvaisMotDePasse', hashed);
            assert.equal(verified, true);
            assert.equal(wrong, false);
        }
    });
});
