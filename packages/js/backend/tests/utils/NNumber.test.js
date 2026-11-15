import { describe, it, assert } from '../test-helper.js';
import { NNumber } from '../../index.js';

describe('NNumber (utils/NNumber.js)', () => {
    const num = new NNumber();

    it('valide et convertit les nombres', () => {
        assert.equal(num.isNumber(42), true);
        assert.equal(num.isNumeric('1250.50'), true);
        assert.equal(num.isInteger(10), true);
        assert.equal(num.isFloat(10.5), true);
        assert.equal(num.isPositive(5, true), true);
        assert.equal(num.isEven(4), true);
        assert.equal(num.isOdd(5), true);
        assert.equal(num.isBetween(5, 1, 10), true);
        assert.equal(num.toFloat('1250.75'), 1250.75);
        assert.equal(num.toInt('42px', 0), 42);
    });

    it('effectue les calculs mathématiques et le formatage', () => {
        assert.equal(num.round(3.14159, 2), 3.14);
        assert.equal(num.clamp(150, 0, 100), 100);
        assert.equal(num.percentage(25, 200), 12.5);
        assert.equal(num.percentageOf(20, 500), 100);
        assert.equal(num.sum([10, 20, 30]), 60);
        assert.equal(num.average([10, 20, 30]), 20);
        assert.equal(num.min([5, 2, 9]), 2);
        assert.equal(num.max([5, 2, 9]), 9);
        assert.equal(num.pad(7, 3), '007');
        assert.equal(num.format(1250000.5, { decimals: 2 }), '1 250 000,50');
    });
});
