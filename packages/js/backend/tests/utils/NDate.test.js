import { describe, it, assert } from '../index.js';
import { NDate } from '../../index.js';

describe('NDate (utils/NDate.js)', () => {
    it('parse, valide et extrait les composants dune date', () => {
        const d = NDate.toDate('2026-11-14T15:30:45');
        assert.equal(NDate.isValid(d), true);
        assert.equal(NDate.isLeapYear(2024), true);
        assert.equal(NDate.isLeapYear(2026), false);
        assert.equal(NDate.getYear(d), 2026);
        assert.equal(NDate.getMonth(d), 11);
        assert.equal(NDate.getDay(d), 14);
        assert.equal(NDate.getHours(d), 15);
        assert.equal(NDate.getMinutes(d), 30);
        assert.equal(NDate.getSeconds(d), 45);
        assert.equal(NDate.daysInMonth(2024, 2), 29);
    });

    it('effectue des calculs calendaires, des différences et du formatage', () => {
        const start = NDate.toDate('2026-11-01T00:00:00');
        const plus10 = NDate.addDays(start, 10);
        assert.equal(NDate.format(plus10, 'DD/MM/YYYY'), '11/11/2026');
        assert.equal(NDate.diffInDays(start, plus10), 10);
        assert.equal(NDate.isBefore(start, plus10), true);
        assert.equal(NDate.isAfter(plus10, start), true);
        assert.equal(NDate.toSql(start, false), '2026-11-01');
    });

    it('gère startOf/endOf, addMonths/addYears, equals, isBetween, diffInHours/Minutes/Seconds et getAge', () => {
        const d1 = NDate.create(2026, 5, 15, 14, 30, 0);
        const d2 = NDate.create(2026, 5, 15, 16, 30, 0);
        assert.equal(NDate.equals(d1, d2, { ignoreTime: true }), true);
        assert.equal(NDate.diffInHours(d1, d2), 2);
        assert.equal(NDate.diffInMinutes(d1, d2), 120);
        assert.equal(NDate.diffInSeconds(d1, d2), 7200);

        const sod = NDate.startOfDay(d1);
        const eod = NDate.endOfDay(d1);
        assert.equal(NDate.getHours(sod), 0);
        assert.equal(NDate.getHours(eod), 23);
        assert.equal(NDate.isBetween(d1, sod, eod), true);

        const eom = NDate.endOfMonth(NDate.create(2024, 2, 1));
        assert.equal(NDate.getDay(eom), 29);
        assert.equal(NDate.getAge('2000-01-01', '2026-06-01'), 26);
        assert.equal(NDate.isPast('2020-01-01', '2026-01-01'), true);
        assert.equal(NDate.isFuture('2030-01-01', '2026-01-01'), true);
    });
});
