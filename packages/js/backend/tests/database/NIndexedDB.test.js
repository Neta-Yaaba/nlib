import { describe, it, assert } from '../test-helper.js';
import { NIndexedDB } from '../../index.js';

describe('NIndexedDB (database/NIndexedDB.js)', () => {
    it('configure le chiffrement local et gère les opérations IndexedDB', async () => {
        const idb = new NIndexedDB({
            name: 'TestIDB',
            version: 1,
            stores: [{ name: 'kv', keyPath: 'id' }],
            encryptData: true,
            encryptKey: true
        });

        assert.equal(idb.name, 'TestIDB');
        assert.equal(idb.isDataEncrypted, true);
        assert.equal(idb.isKeyEncrypted, true);

        const idbPlain = new NIndexedDB({ name: 'TestIDBPlain', encryptData: false, encryptKey: false });
        assert.equal(idbPlain.isDataEncrypted, false);
        assert.equal(idbPlain.isKeyEncrypted, false);

        if (idb.isAvailable) {
            await idb.put('kv', { id: 'k1', secret: 'val123' }, 'k1');
            const restored = await idb.get('kv', 'k1');
            assert.equal(restored.ok, true);
            assert.deepEqual(restored.data, { id: 'k1', secret: 'val123' });
            await idb.clear('kv');
            idb.close();
        } else {
            const val = await idb.get('kv', 'k1');
            assert.equal(val.ok, false);
        }
    });
});
