import { describe, it, assert } from '../index.js';
import { NWorkMgr } from '../../index.js';

describe('NWorkMgr (worker/NWorkMgr.js)', () => {
    it('gère les actions globales, la création de workers et de pools Round-Robin', async () => {
        assert.equal(NWorkMgr.hasAction('invokeNative'), true);

        NWorkMgr.registerAction('doubleVal', ({ x }) => x * 2);
        assert.equal(NWorkMgr.hasAction('doubleVal'), true);
        const execResult = await NWorkMgr.executeAction('doubleVal', { x: 21 });
        assert.equal(execResult, 42);

        const pool = NWorkMgr.createPool('calcPool', {}, 2);
        assert.equal(pool.length, 2);
        assert.equal(NWorkMgr.has('calcPool'), true);
        assert.notEqual(pool[0], pool[1]);

        const chosen = NWorkMgr.get('calcPool');
        assert.ok(pool.includes(chosen));
        assert.equal(typeof NWorkMgr.isWorkerContext, 'boolean');
        assert.equal(typeof NWorkMgr.isSupported, 'boolean');
        assert.deepEqual(NWorkMgr.names, ['calcPool']);
        const snapshot = NWorkMgr.toJSON();
        assert.equal(typeof snapshot, 'object');
        assert.equal(snapshot.size, 2);

        assert.equal(NWorkMgr.unregisterAction('doubleVal'), NWorkMgr);
        assert.equal(NWorkMgr.hasAction('doubleVal'), false);

        NWorkMgr.terminateAll();
        assert.equal(NWorkMgr.size, 0);
    });
});
