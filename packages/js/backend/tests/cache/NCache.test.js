import { describe, it, assert } from '../index.js';
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

    it('gère stats, getOrSet, keys, delete, prune, cacheFile/getFile, putResponse/matchUrl et destroy', async () => {
        const cache = new NCache({ namespace: 'test_ns_ext' });
        await cache.clear();

        assert.equal(['native', 'caches', 'idb', 'store', 'memory'].includes(cache.driver), true);
        await cache.getOrSet('k_or_set', 60, () => 99);
        assert.equal(await cache.get('k_or_set'), 99);

        const keyList = await cache.keys();
        assert.equal(keyList.includes('k_or_set'), true);

        await cache.delete('k_or_set');
        assert.equal(await cache.has('k_or_set'), false);

        assert.equal(typeof cache.stats.hits, 'number');
        assert.equal(typeof cache.stats.misses, 'number');
        assert.equal(typeof await cache.prune(), 'number');

        await cache.cacheFile('notes.txt', 'Contenu test', { mimeType: 'text/plain' });
        const fileText = await cache.getFile('notes.txt', { format: 'text' });
        assert.equal(fileText, 'Contenu test');

        await cache.putResponse('https://nlib.dev/api/ping', { ok: true });
        const matched = await cache.matchUrl('https://nlib.dev/api/ping');
        assert.deepEqual(matched, { ok: true });
        await cache.deleteUrl('https://nlib.dev/api/ping');

        await cache.clear();
        cache.destroy();
        assert.equal(cache.isDestroyed, true);
    });
});
