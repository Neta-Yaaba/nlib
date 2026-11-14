import { describe, it, assert } from '../test-helper.js';
import { NArray } from '../../index.js';

describe('NArray (utils/NArray.js)', () => {
    const arr = new NArray();

    it('manipule les tableaux de manière immuable (unique, compact, chunk, paginate, groupBy, sortBy)', () => {
        assert.equal(arr.isArray([1, 2]), true);
        assert.equal(arr.first([10, 20, 30]), 10);
        assert.equal(arr.last([10, 20, 30]), 30);
        assert.equal(arr.at([10, 20, 30], -1), 30);
        assert.deepEqual(arr.compact([0, 1, null, '', 2, undefined]), [1, 2]);
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
});
