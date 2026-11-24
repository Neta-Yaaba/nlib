import { describe, it, assert } from '../index.js';
import { NArr } from '../../index.js';

describe('NArr (utils/NArr.js)', () => {
    it('manipule les tableaux de manière immuable (unique, compact, chunk, paginate, groupBy, sortBy)', () => {
        assert.equal(NArr.isArray([1, 2]), true);
        assert.equal(NArr.first([10, 20, 30]), 10);
        assert.equal(NArr.last([10, 20, 30]), 30);
        assert.equal(NArr.get([10, 20, 30], -1), 30);
        assert.deepEqual(NArr.compact([0, 1, null, '', 2, undefined]), [0, 1, 2]);
        assert.deepEqual(NArr.unique([1, 2, 2, 3, 1]), [1, 2, 3]);
        assert.deepEqual(NArr.chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);

        const items = [
            { id: 1, group: 'A', price: 30 },
            { id: 2, group: 'B', price: 10 },
            { id: 3, group: 'A', price: 20 }
        ];
        assert.deepEqual(NArr.pluck(items, 'id'), [1, 2, 3]);
        const sorted = NArr.sortBy(items, 'price', 'asc');
        assert.deepEqual(NArr.pluck(sorted, 'price'), [10, 20, 30]);

        const page = NArr.paginate([1, 2, 3, 4, 5], 2, 2);
        assert.deepEqual(page.data, [3, 4]);
        assert.equal(page.totalPages, 3);
    });

    it('gère equals, contains, insertAt/removeAt/removeValue, groupBy, keyBy, flatten, ensembles et range', () => {
        assert.equal(NArr.equals([1, 2, 3], [3, 1, 2], true), true);
        assert.equal(NArr.contains([{ id: 1 }, { id: 2 }], 2, 'id'), true);
        assert.deepEqual(NArr.insertAt([1, 3], 1, 2), [1, 2, 3]);
        assert.deepEqual(NArr.removeAt([1, 2, 3], 1), [1, 3]);
        assert.deepEqual(NArr.removeValue([{ id: 1 }, { id: 2 }], 1, 'id'), [{ id: 2 }]);
        assert.deepEqual(NArr.flatten([1, [2, [3]]]), [1, 2, 3]);

        const grouped = NArr.groupBy([{ t: 'A', v: 1 }, { t: 'B', v: 2 }, { t: 'A', v: 3 }], 't');
        assert.equal(grouped.A.length, 2);
        const keyed = NArr.keyBy([{ id: 'x' }, { id: 'y' }], 'id');
        assert.deepEqual(keyed.x, { id: 'x' });

        assert.deepEqual(NArr.intersection([1, 2, 3], [2, 3, 4]), [2, 3]);
        assert.deepEqual(NArr.difference([1, 2, 3], [2]), [1, 3]);
        assert.deepEqual(NArr.union([1, 2], [2, 3]), [1, 2, 3]);
        assert.deepEqual(NArr.range(1, 5, 2), [1, 3, 5]);
    });
});
