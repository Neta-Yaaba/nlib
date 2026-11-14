import { describe, it, assert } from '../test-helper.js';
import { NDateTime } from '../../index.js';

describe('NDateTime (utils/NDateTime.js)', () => {
    const dt = new NDateTime();

    it('parse, valide et extrait les composants dune date', () => {
        const d = dt.toDate('2026-11-14T15:30:45');
        assert.equal(dt.isValid(d), true);
        assert.equal(dt.isLeapYear(2024), true);
        assert.equal(dt.isLeapYear(2026), false);
        assert.equal(dt.getYear(d), 2026);
        assert.equal(dt.getMonth(d), 11);
        assert.equal(dt.getDay(d), 14);
        assert.equal(dt.getHours(d), 15);
        assert.equal(dt.getMinutes(d), 30);
        assert.equal(dt.getSeconds(d), 45);
        assert.equal(dt.daysInMonth(2024, 2), 29);
    });

    it('effectue des calculs calendaires, des différences et du formatage', () => {
        const start = dt.toDate('2026-11-01T00:00:00');
        const plus10 = dt.addDays(start, 10);
        assert.equal(dt.format(plus10, 'DD/MM/YYYY'), '11/11/2026');
        assert.equal(dt.diffInDays(start, plus10), 10);
        assert.equal(dt.isBefore(start, plus10), true);
        assert.equal(dt.isAfter(plus10, start), true);
        assert.equal(dt.toSql(start, false), '2026-11-01');
    });
});
