import { describe, it, assert } from '../test-helper.js';
import { NArray } from '../../index.js';

describe('NArray (utils/NArray.js)', () => {
    const arr = new NArray();

    it('manipule les tableaux de manière immuable (unique, compact, chunk, paginate, groupBy, sortBy)', () => {
        assert.equal(arr.isArray([1, 2]), true);
        assert.equal(arr.first([10, 20, 30]), 10);
        assert.equal(arr.last([10, 20, 30]), 30);
        assert.equal(arr.get([10, 20, 30], -1), 30);
        assert.deepEqual(arr.compact([0, 1, null, '', 2, undefined]), [0, 1, 2]);
        assert.deepEqual(arr.unique([1, 2, 2, 3, 1]), [1, 2, 3]);
        assert.deepEqual(arr.chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);

        const items = [
            { id: 1, group: 'A', price: 30 },
            { id: 2, group: 'B', price: 10 },
            { id: 3, group: 'A', price: 20 }
        ];
        assert.deepEqual(arr.pluck(items, 'id'), [1, 2, 3]);
        const sorted = arr.sortBy(items, 'price', 'asc');
        assert.deepEqual(arr.pluck(sorted, 'price'), [10, 20, 30]);

        const page = arr.paginate([1, 2, 3, 4, 5], 2, 2);
        assert.deepEqual(page.data, [3, 4]);
        assert.equal(page.totalPages, 3);
    });

    it('gère equals, contains, insertAt/removeAt/removeValue, groupBy, keyBy, flatten, ensembles et range', () => {
        assert.equal(arr.equals([1, 2, 3], [3, 1, 2], true), true);
        assert.equal(arr.contains([{ id: 1 }, { id: 2 }], 2, 'id'), true);
        assert.deepEqual(arr.insertAt([1, 3], 1, 2), [1, 2, 3]);
        assert.deepEqual(arr.removeAt([1, 2, 3], 1), [1, 3]);
        assert.deepEqual(arr.removeValue([{ id: 1 }, { id: 2 }], 1, 'id'), [{ id: 2 }]);
        assert.deepEqual(arr.flatten([1, [2, [3]]]), [1, 2, 3]);

        const grouped = arr.groupBy([{ t: 'A', v: 1 }, { t: 'B', v: 2 }, { t: 'A', v: 3 }], 't');
        assert.equal(grouped.A.length, 2);
        const keyed = arr.keyBy([{ id: 'x' }, { id: 'y' }], 'id');
        assert.deepEqual(keyed.x, { id: 'x' });

        assert.deepEqual(arr.intersection([1, 2, 3], [2, 3, 4]), [2, 3]);
        assert.deepEqual(arr.difference([1, 2, 3], [2]), [1, 3]);
        assert.deepEqual(arr.union([1, 2], [2, 3]), [1, 2, 3]);
        assert.deepEqual(arr.range(1, 5, 2), [1, 3, 5]);
    });
});
