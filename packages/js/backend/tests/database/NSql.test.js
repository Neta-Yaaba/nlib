import { describe, it, assert } from '../test-helper.js';
import { NSql, NEvent } from '../../index.js';

describe('NSql (database/NSql.js)', () => {
    it('expose ses propriétés, son bus dévénements et gère les opérations sans lever dexception', async () => {
        const sql = new NSql({ name: 'test_sql' });
        assert.equal(sql.name, 'test_sql');
        assert.equal(sql.event instanceof NEvent, true);
        assert.equal(typeof sql.isNative, 'boolean');

        const initialized = await sql.init();
        if (initialized && sql.isOpen) {
            await sql.createTable('items', 'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, label TEXT)');
            await sql.insert('items', { id: 1, label: 'Test' });
            const rows = await sql.selectAll('items');
            assert.equal(rows.length, 1);
        } else {
            const rows = await sql.select('SELECT 1');
            assert.deepEqual(rows, []);
        }

        await sql.close();
    });
});
