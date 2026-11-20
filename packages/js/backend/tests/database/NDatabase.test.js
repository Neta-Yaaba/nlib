import { describe, it, assert } from '../index.js';
import { NDatabase, NSql, NIndexedDB, NStorage } from '../../index.js';

describe('NDatabase (database/NDatabase.js)', () => {
    it('expose les sous-moteurs sql, idb et store ainsi que la configuration autoSave', async () => {
        const db = new NDatabase({
            name: 'TestNLibDB',
            version: 1,
            storagePrefix: 'test_db_',
            autoSave: true,
            autoSaveDelay: 250
        });

        assert.equal(db.name, 'TestNLibDB');
        assert.equal(db.version, 1);
        assert.equal(db.autoSave, true);
        assert.equal(db.autoSaveDelay, 250);
        assert.equal(db.sql instanceof NSql, true);
        assert.equal(db.idb instanceof NIndexedDB, true);
        assert.equal(db.store instanceof NStorage, true);

        db.cancelAutoSave();
        db.autoSave = false;
        db.autoSaveDelay = 500;
        assert.equal(db.autoSave, false);
        assert.equal(db.autoSaveDelay, 500);
        assert.equal(db.indexed, db.idb);
        assert.equal(db.storage, db.store);
        assert.equal(typeof db.context, 'string');

        db.close();
        db.destroy();
        assert.equal(db.isDestroyed, true);
    });
});
