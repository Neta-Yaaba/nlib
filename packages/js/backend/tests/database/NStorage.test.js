import { describe, it, assert } from '../index.js';
import { NStorage, NObject } from '../../index.js';

describe('NStorage (database/NStorage.js)', () => {
    it('stocke, lit, gère les contextes et manipule les clés sans chiffrement', () => {
        NStorage.configure({
            prefix: 'test_store_',
            context: 'app'
        });

        assert.equal(typeof NStorage.isAvailable, 'boolean');
        assert.equal(NStorage.prefix, 'test_store_');
        assert.equal(NStorage.context, 'app');

        if (!NStorage.isAvailable) {
            NStorage.destroy();
            return;
        }

        NStorage.clear();
        NStorage.set('profile', { name: 'Alice', level: 3 });
        NStorage.set('counter', 42);

        assert.equal(NStorage.has('profile'), true);
        assert.deepEqual(NStorage.getJson('profile'), { name: 'Alice', level: 3 });
        assert.equal(NStorage.getNumber('counter'), 42);

        const keys = NStorage.keys();
        assert.equal(keys.includes('profile'), true);
        assert.equal(keys.includes('counter'), true);

        const adminStore = NStorage.withContext('admin');
        adminStore.set('theme', 'dark');
        assert.equal(adminStore.getString('theme'), 'dark');
        assert.equal(NStorage.has('theme'), false);
        adminStore.clear();

        NStorage.remove('counter');
        assert.equal(NStorage.has('counter'), false);
        assert.equal(NStorage.getBoolean('missing_bool', true), true);
        assert.deepEqual(NStorage.getArray('missing_arr', [1, 2]), [1, 2]);
        assert.deepEqual(NStorage.toObject(), { profile: { name: 'Alice', level: 3 } });
        NStorage.clear();
        assert.equal(NStorage.length, 0);

        NStorage.destroy();
    });

    it('enregistre la classe statique NStorage sur NObject via registerStorage', () => {
        NStorage.configure({ prefix: 'shared_', context: 'app' });
        assert.equal(NStorage.prefix, 'shared_');
        assert.equal(NStorage.context, 'app');

        const obj = new NObject();
        assert.equal(obj.storage, NStorage);

        NStorage.destroy();
        assert.equal(NStorage.prefix, '');
        assert.equal(NStorage.context, '');
    });
});
