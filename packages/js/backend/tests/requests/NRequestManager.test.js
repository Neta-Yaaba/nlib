import { describe, it, assert } from '../test-helper.js';
import { NRequestManager, NTableRequest, NDataSynchronizer } from '../../index.js';

describe('NRequestManager (requests/NRequestManager.js)', () => {
    it('enregistre, récupère et supprime des instances de NTableRequest', () => {
        const mgr = new NRequestManager();
        assert.equal(mgr.count, 0);
        assert.equal(mgr.synchronizer instanceof NDataSynchronizer, true);

        const usersReq = new NTableRequest({ table: 'users', primaryKey: 'id' });
        mgr.addTableRequest('users', usersReq);
        assert.equal(mgr.hasTableRequest('users'), true);
        assert.equal(mgr.getTableRequest('users'), usersReq);
        assert.equal(usersReq.request, mgr);
        assert.deepEqual(mgr.tableNames, ['users']);

        const autoReq = mgr.getTableRequest('products');
        assert.equal(autoReq.request, mgr);
        assert.equal(autoReq.synchronizer, mgr.synchronizer);

        assert.equal(mgr.removeTableRequest('users'), true);
        assert.equal(mgr.hasTableRequest('users'), false);
        mgr.clear();
        assert.equal(mgr.count, 0);
        mgr.destroy();
    });

    it('délègue sync() à son instance NDataSynchronizer', async () => {
        const customSync = new NDataSynchronizer({
            network: {
                isOnline: true,
                async post() { return { ok: true, data: { confirmed: [] } }; },
                async get() { return { ok: true, data: { changes: [], cursor: 'c1', hasMore: false } }; }
            }
        });
        const mgr = new NRequestManager({ synchronizer: customSync });
        assert.equal(mgr.synchronizer, customSync);

        const tr = new NTableRequest({
            table: 'items',
            sync: { endpoint: 'https://api.test.local/sync/items' }
        });
        mgr.addTableRequest('items', tr);

        const report = await mgr.sync('items');
        assert.equal(report.ok, true);
        assert.equal(report.collection, 'items');

        mgr.destroy();
        customSync.destroy();
    });
});
