import { describe, it, assert } from '../index.js';
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

    it('construit les clauses SQL de recherche paramétrée et de pagination', () => {
        const sql = new NSql({ name: 'test_sql_clauses' });

        const search = sql.buildSearchClause('alice paris', ['nom', 'ville']);
        assert.equal(search.where.includes('LIKE'), true);
        assert.equal(search.order.includes('CASE WHEN'), true);
        assert.equal(Object.keys(search.params).length, 4);

        const limited = sql.buildLimitClause(25, 50);
        assert.equal(limited.trim(), 'LIMIT 50, 25');
        assert.equal(sql.buildLimitClause(10).trim(), 'LIMIT 10');
        assert.equal(sql.buildLimitClause(0), '');

        sql.destroy();
    });

    it('fournit une instance statique initialisée avec les options du premier appel', () => {
        const inst1 = NSql.instance({ name: 'shared_sql' });
        assert.equal(inst1 instanceof NSql, true);
        assert.equal(inst1.name, 'shared_sql');

        const inst2 = NSql.instance({ name: 'other_sql' });
        assert.equal(inst2, inst1);
        assert.equal(inst2.name, 'shared_sql');

        inst1.destroy();
        const inst3 = NSql.instance({ name: 'recreated_sql' });
        assert.equal(inst3 !== inst1, true);
        assert.equal(inst3.name, 'recreated_sql');
        inst3.destroy();
    });

    it('configure autoSave, autoSaveDelay et gère saveToIndexedDB / loadFromIndexedDB / cancelAutoSave', async () => {
        const sql = new NSql({ name: 'test_autosave_sql', autoSave: true, autoSaveDelay: 250 });
        assert.equal(sql.autoSave, true);
        assert.equal(sql.autoSaveDelay, 250);

        sql.scheduleAutoSave();
        assert.equal(sql.cancelAutoSave(), true);
        assert.equal(sql.cancelAutoSave(), false);
        assert.equal(await sql.flushAutoSave(), null);

        sql.autoSave = false;
        sql.autoSaveDelay = 600;
        assert.equal(sql.autoSave, false);
        assert.equal(sql.autoSaveDelay, 600);

        const saveClosed = await sql.saveToIndexedDB();
        assert.equal(saveClosed.ok, false);

        sql.destroy();
    });
});
