import { describe, it, assert } from '../index.js';
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

    it('gère startOf/endOf, addMonths/addYears, equals, isBetween, diffInHours/Minutes/Seconds et getAge', () => {
        const d1 = dt.create(2026, 5, 15, 14, 30, 0);
        const d2 = dt.create(2026, 5, 15, 16, 30, 0);
        assert.equal(dt.equals(d1, d2, { ignoreTime: true }), true);
        assert.equal(dt.diffInHours(d1, d2), 2);
        assert.equal(dt.diffInMinutes(d1, d2), 120);
        assert.equal(dt.diffInSeconds(d1, d2), 7200);

        const sod = dt.startOfDay(d1);
        const eod = dt.endOfDay(d1);
        assert.equal(dt.getHours(sod), 0);
        assert.equal(dt.getHours(eod), 23);
        assert.equal(dt.isBetween(d1, sod, eod), true);

        const eom = dt.endOfMonth(dt.create(2024, 2, 1));
        assert.equal(dt.getDay(eom), 29);
        assert.equal(dt.getAge('2000-01-01', '2026-06-01'), 26);
        assert.equal(dt.isPast('2020-01-01', '2026-01-01'), true);
        assert.equal(dt.isFuture('2030-01-01', '2026-01-01'), true);
    });
});
