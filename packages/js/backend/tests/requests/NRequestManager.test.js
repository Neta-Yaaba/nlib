import { describe, it, assert } from '../test-helper.js';
import { NRequestManager, NTableRequest } from '../../index.js';

describe('NRequestManager (requests/NRequestManager.js)', () => {
    it('enregistre, récupère et supprime des instances de NTableRequest', () => {
        const mgr = new NRequestManager();
        assert.equal(mgr.count, 0);

        const usersReq = new NTableRequest({ table: 'users', primaryKey: 'id' });
        mgr.addTableRequest('users', usersReq);
        assert.equal(mgr.hasTableRequest('users'), true);
        assert.equal(mgr.getTableRequest('users'), usersReq);
        assert.deepEqual(mgr.tableNames, ['users']);

        assert.equal(mgr.removeTableRequest('users'), true);
        assert.equal(mgr.hasTableRequest('users'), false);
        mgr.clear();
        assert.equal(mgr.count, 0);
    });
});
