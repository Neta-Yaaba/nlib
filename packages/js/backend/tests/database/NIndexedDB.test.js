import { describe, it, assert } from '../test-helper.js';
import { NIndexedDB } from '../../index.js';

describe('NIndexedDB (database/NIndexedDB.js)', () => {
    it('configure le chiffrement local et gère les opérations IndexedDB', async () => {
        const idb = new NIndexedDB({
            name: 'TestIDB',
            version: 1,
            encrypt: true,
            encryptKey: true
        });

        assert.equal(idb.name, 'TestIDB');
        assert.equal(idb.encryptEnabled, true);
        assert.equal(idb.encryptKeyEnabled, true);

        idb.configureEncryption({ encrypt: false, encryptKey: false });
        assert.equal(idb.encryptEnabled, false);
        assert.equal(idb.encryptKeyEnabled, false);

        if (idb.isAvailable) {
            idb.configureEncryption({ encrypt: true, encryptKey: true });
            await idb.put('kv', { id: 'k1', secret: 'val123' }, 'k1');
            const restored = await idb.get('kv', 'k1');
            assert.deepEqual(restored, { id: 'k1', secret: 'val123' });
            await idb.clear('kv');
            idb.close();
        } else {
            const val = await idb.get('kv', 'k1');
            assert.equal(val, null);
        }
    });
});
