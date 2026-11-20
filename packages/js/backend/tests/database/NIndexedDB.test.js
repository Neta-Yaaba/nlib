import { describe, it, assert } from '../index.js';
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
            const put1 = await idb.put('kv', { id: 'k1', secret: 'val123' }, 'k1');
            assert.equal(put1.ok, true);
            assert.equal(put1.data, 'k1');

            await idb.put('kv', { id: 'k1', secret: 'val456' }, 'k1');
            const restored = await idb.get('kv', 'k1');
            assert.equal(restored.ok, true);
            assert.deepEqual(restored.data, { id: 'k1', secret: 'val456' });

            const allKeys = await idb.getAllKeys('kv');
            assert.equal(allKeys.data.length, 1);

            const delRes = await idb.delete('kv', 'k1');
            assert.equal(delRes.ok, true);
            assert.equal(delRes.data, undefined);

            const afterDel = await idb.get('kv', 'k1');
            assert.equal(afterDel.data, null);

            // Store inexistant -> échec explicite (ok: false)
            const badStore = await idb.get('inexistant_store', 'k1');
            assert.equal(badStore.ok, false);

            // Persistance d'une CryptoKey AES-GCM non extractible
            if (typeof globalThis.crypto?.subtle?.generateKey === 'function') {
                const ck = await globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
                const putKey = await idb.put('kv', { id: 'ck1', key: ck });
                assert.equal(putKey.ok, true);
            }

            const clr = await idb.clear('kv');
            assert.equal(clr.ok, true);
            assert.equal(clr.data, undefined);
            idb.close();
        } else {
            const val = await idb.get('kv', 'k1');
            assert.equal(val.ok, false);
        }
    });
});
