import { describe, it, assert } from '../test-helper.js';
import { NStorage } from '../../index.js';

describe('NStorage (database/NStorage.js)', () => {
    it('stocke, lit, gère les contextes et manipule les clés sans chiffrement', () => {
        const store = new NStorage({
            prefix: 'test_store_',
            context: 'app'
        });

        assert.equal(typeof store.isAvailable, 'boolean');
        assert.equal(store.prefix, 'test_store_');
        assert.equal(store.context, 'app');

        if (!store.isAvailable) {
            return;
        }

        store.clear();
        store.set('profile', { name: 'Alice', level: 3 });
        store.set('counter', 42);

        assert.equal(store.has('profile'), true);
        assert.deepEqual(store.getJson('profile'), { name: 'Alice', level: 3 });
        assert.equal(store.getNumber('counter'), 42);

        const keys = store.keys();
        assert.equal(keys.includes('profile'), true);
        assert.equal(keys.includes('counter'), true);

        const adminStore = store.withContext('admin');
        adminStore.set('theme', 'dark');
        assert.equal(adminStore.getString('theme'), 'dark');
        assert.equal(store.has('theme'), false);
        adminStore.clear();

        store.remove('counter');
        assert.equal(store.has('counter'), false);
        store.clear();
        assert.equal(store.length, 0);

        store.destroy();
        assert.equal(store.isDestroyed, true);
    });
});
