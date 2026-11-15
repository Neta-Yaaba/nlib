import { describe, it, assert } from '../test-helper.js';
import { NAmount } from '../../index.js';

describe('NAmount (utils/NAmount.js)', () => {
    const amount = new NAmount();

    it('effectue des calculs monétaires exacts sans erreur de virgule flottante', () => {
        assert.equal(amount.isValid(125.5), true);
        assert.equal(amount.parse('12 500,50 FCFA'), 12500.5);
        assert.equal(amount.add(0.1, 0.2), 0.3);
        assert.equal(amount.subtract(10, 3.25), 6.75);
        assert.equal(amount.multiply(19.99, 3), 59.97);
        assert.equal(amount.divide(100, 4), 25);
        assert.equal(amount.add([0.1, 0.2, 0.3], 2), 0.6);
        assert.deepEqual(amount.allocate(100, 3), [33.34, 33.33, 33.33]);
    });

    it('calcule la TVA (HT/TTC), les remises et formate les devises', () => {
        assert.equal(amount.taxAmount(1000, 18), 180);
        assert.equal(amount.addTax(1000, 18), 1180);
        assert.deepEqual(amount.extractTax(1180, 18), { ht: 1000, tax: 180, ttc: 1180 });
        assert.equal(amount.applyDiscount(200, 15), 170);
        assert.equal(amount.format(75000, 'XOF'), '75 000 FCFA');
    });
});
