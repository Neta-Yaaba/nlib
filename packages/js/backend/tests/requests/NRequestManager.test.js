import { describe, it, assert } from '../test-helper.js';
import { NRequestManager, NTableRequest } from '../../index.js';

describe('NRequestManager (requests/NRequestManager.js)', () => {
    it('enregistre, récupère et supprime des instances de NTableRequest', () => {
        const mgr = new NRequestManager();
        assert.equal(mgr.size, 0);

        const usersReq = mgr.table('users', { primaryKey: 'id' });
        assert.equal(usersReq instanceof NTableRequest, true);
        assert.equal(mgr.has('users'), true);
        assert.equal(mgr.get('users'), usersReq);
        assert.deepEqual(mgr.tables, ['users']);

        mgr.unregister('users');
        assert.equal(mgr.has('users'), false);
        mgr.clear();
    });
});
