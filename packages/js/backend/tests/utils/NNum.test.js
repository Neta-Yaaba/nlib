import { describe, it, assert } from '../index.js';
import { NNum } from '../../index.js';

describe('NNum (utils/NNum.js)', () => {
    it('valide et convertit les nombres', () => {
        assert.equal(NNum.isNumber(42), true);
        assert.equal(NNum.isNumeric('1250.50'), true);
        assert.equal(NNum.isInteger(10), true);
        assert.equal(NNum.isFloat(10.5), true);
        assert.equal(NNum.isPositive(5, true), true);
        assert.equal(NNum.isEven(4), true);
        assert.equal(NNum.isOdd(5), true);
        assert.equal(NNum.isBetween(5, 1, 10), true);
        assert.equal(NNum.toFloat('1250.75'), 1250.75);
        assert.equal(NNum.toInt('42px', 0), 42);
    });

    it('effectue les calculs mathématiques et le formatage', () => {
        assert.equal(NNum.round(3.14159, 2), 3.14);
        assert.equal(NNum.clamp(150, 0, 100), 100);
        assert.equal(NNum.percentage(25, 200), 12.5);
        assert.equal(NNum.percentageOf(20, 500), 100);
        assert.equal(NNum.sum([10, 20, 30]), 60);
        assert.equal(NNum.average([10, 20, 30]), 20);
        assert.equal(NNum.min([5, 2, 9]), 2);
        assert.equal(NNum.max([5, 2, 9]), 9);
        assert.equal(NNum.pad(7, 3), '007');
        assert.equal(NNum.format(1250000.5, { decimals: 2 }), '1 250 000,50');
    });

    it('gère floor, ceil, equals avec tolérance, isNegative, randomInt/randomFloat, formatCurrency et formatBytes', () => {
        assert.equal(NNum.isNegative(-3), true);
        assert.equal(NNum.equals(0.1 + 0.2, 0.3, 1e-9), true);
        assert.equal(NNum.floor(3.987, 2), 3.98);
        assert.equal(NNum.ceil(3.111, 2), 3.12);

        const ri = NNum.randomInt(5, 10);
        assert.equal(ri >= 5 && ri <= 10, true);

        const rf = NNum.randomFloat(1, 2, 2);
        assert.equal(rf >= 1 && rf <= 2, true);

        assert.equal(NNum.formatCurrency(2500, { symbol: '€', decimals: 0 }), '2 500 €');
        assert.equal(NNum.formatBytes(1048576), '1 Mo');
    });
});
