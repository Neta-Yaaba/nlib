import { describe, it, assert } from '../index.js';
import { NAmount } from '../../index.js';

describe('NAmount (utils/NAmount.js)', () => {
    it('effectue des calculs monétaires exacts sans erreur de virgule flottante', () => {
        assert.equal(NAmount.isValid(125.5), true);
        assert.equal(NAmount.parse('12 500,50 FCFA'), 12500.5);
        assert.equal(NAmount.add(0.1, 0.2), 0.3);
        assert.equal(NAmount.subtract(10, 3.25), 6.75);
        assert.equal(NAmount.multiply(19.99, 3), 59.97);
        assert.equal(NAmount.divide(100, 4), 25);
        assert.equal(NAmount.add([0.1, 0.2, 0.3], 2), 0.6);
        assert.deepEqual(NAmount.allocate(100, 3), [33.34, 33.33, 33.33]);
    });

    it('calcule la TVA (HT/TTC), les remises et formate les devises', () => {
        assert.equal(NAmount.taxAmount(1000, 18), 180);
        assert.equal(NAmount.addTax(1000, 18), 1180);
        assert.deepEqual(NAmount.extractTax(1180, 18), { ht: 1000, tax: 180, ttc: 1180 });
        assert.equal(NAmount.applyDiscount(200, 15), 170);
        assert.equal(NAmount.format(75000, 'XOF'), '75 000 FCFA');
    });

    it('gère equals, toMinorUnits/fromMinorUnits, allocate par ratios, convert et validation avec options', () => {
        assert.equal(NAmount.isValid(-50), false);
        assert.equal(NAmount.isValid(-50, { allowNegative: true }), true);
        assert.equal(NAmount.isValid(0, { allowZero: false }), false);
        assert.equal(NAmount.equals(10.004, 10.001, 2), true);
        assert.equal(NAmount.toMinorUnits(12.34, 2), 1234);
        assert.equal(NAmount.fromMinorUnits(1234, 2), 12.34);
        assert.deepEqual(NAmount.allocate(250, [50, 30, 20]), [125, 75, 50]);
        assert.equal(NAmount.convert(100, 655.957, 0), 65596);
        assert.equal(NAmount.divide(100, 0), 0);
    });
});
