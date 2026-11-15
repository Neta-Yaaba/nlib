import { describe, it, assert } from '../test-helper.js';
import { NStorage } from '../../index.js';

describe('NStorage (database/NStorage.js)', () => {
    it('stocke, lit, chiffre de manière synchrone et gère les clés', () => {
        const store = new NStorage({
            prefix: 'test_store_',
            encryptData: true,
            encryptKey: true
        });

        assert.equal(store.isAvailable, true);
        assert.equal(store.isDataEncrypted, true);
        assert.equal(store.isKeyEncrypted, true);

        store.clear();
        store.set('profile', { name: 'Alice', level: 3 });
        store.set('counter', 42);

        assert.equal(store.has('profile'), true);
        assert.deepEqual(store.getJson('profile'), { name: 'Alice', level: 3 });
        assert.equal(store.getNumber('counter'), 42);

        const keys = store.keys();
        assert.equal(keys.includes('profile'), true);
        assert.equal(keys.includes('counter'), true);

        store.remove('counter');
        assert.equal(store.has('counter'), false);
        store.clear();
        assert.equal(store.length, 0);
    });
});
