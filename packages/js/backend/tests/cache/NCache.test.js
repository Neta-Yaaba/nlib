import { describe, it, assert } from '../index.js';
import { NCache } from '../../index.js';

describe('NCache (cache/NCache.js)', () => {
    it('met en cache, lit, utilise remember et invalide par tag', async () => {
        await NCache.clear();

        await NCache.set('user_1', { id: 1, name: 'Alice' }, { tags: ['users', 'admins'] });
        assert.equal(await NCache.has('user_1'), true);
        assert.deepEqual(await NCache.get('user_1'), { id: 1, name: 'Alice' });

        let computeCount = 0;
        const val1 = await NCache.remember('computed_key', 60, async () => {
            computeCount += 1;
            return 'computed_value';
        });
        const val2 = await NCache.remember('computed_key', 60, async () => {
            computeCount += 1;
            return 'other_value';
        });
        assert.equal(val1, 'computed_value');
        assert.equal(val2, 'computed_value');
        assert.equal(computeCount, 1);

        const removedByTag = await NCache.clearByTag('admins');
        assert.equal(removedByTag >= 1, true);
        assert.equal(await NCache.has('user_1'), false);

        await NCache.clear();
    });

    it('gère stats, getOrSet, keys, delete, prune, cacheFile/getFile et putResponse/matchUrl', async () => {
        await NCache.clear();

        assert.equal(['native', 'caches', 'idb', 'store', 'memory'].includes(NCache.driver), true);
        await NCache.getOrSet('k_or_set', 60, () => 99);
        assert.equal(await NCache.get('k_or_set'), 99);

        const keyList = await NCache.keys();
        assert.equal(keyList.includes('k_or_set'), true);

        await NCache.delete('k_or_set');
        assert.equal(await NCache.has('k_or_set'), false);

        assert.equal(typeof NCache.stats.hits, 'number');
        assert.equal(typeof NCache.stats.misses, 'number');
        assert.equal(typeof await NCache.prune(), 'number');

        await NCache.cacheFile('notes.txt', 'Contenu test', { mimeType: 'text/plain' });
        const fileText = await NCache.getFile('notes.txt', { format: 'text' });
        assert.equal(fileText, 'Contenu test');

        await NCache.putResponse('https://nlib.dev/api/ping', { ok: true });
        const matched = await NCache.matchUrl('https://nlib.dev/api/ping');
        assert.deepEqual(matched, { ok: true });
        await NCache.deleteUrl('https://nlib.dev/api/ping');

        await NCache.clear();
    });
});
