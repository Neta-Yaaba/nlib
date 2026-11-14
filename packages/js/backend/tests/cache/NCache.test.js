import { describe, it, assert } from '../test-helper.js';
import { NCache } from '../../index.js';

describe('NCache (cache/NCache.js)', () => {
    it('met en cache, lit, utilise remember et invalide par tag', async () => {
        const cache = new NCache({ namespace: 'test_ns' });
        await cache.clear();

        await cache.set('user_1', { id: 1, name: 'Alice' }, { tags: ['users', 'admins'] });
        assert.equal(await cache.has('user_1'), true);
        assert.deepEqual(await cache.get('user_1'), { id: 1, name: 'Alice' });

        let computeCount = 0;
        const val1 = await cache.remember('computed_key', 60, async () => {
            computeCount += 1;
            return 'computed_value';
        });
        const val2 = await cache.remember('computed_key', 60, async () => {
            computeCount += 1;
            return 'other_value';
        });
        assert.equal(val1, 'computed_value');
        assert.equal(val2, 'computed_value');
        assert.equal(computeCount, 1);

        const removedByTag = await cache.clearByTag('admins');
        assert.equal(removedByTag >= 1, true);
        assert.equal(await cache.has('user_1'), false);

        await cache.clear();
    });
});
