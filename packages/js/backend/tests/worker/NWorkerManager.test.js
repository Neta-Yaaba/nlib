import { describe, it, assert } from '../test-helper.js';
import { NWorkerManager } from '../../index.js';

describe('NWorkerManager (worker/NWorkerManager.js)', () => {
    it('gère les actions globales, la création de workers et de pools Round-Robin', async () => {
        const mgr = new NWorkerManager();
        assert.equal(mgr.hasAction('invokeNative'), true);

        mgr.registerAction('doubleVal', ({ x }) => x * 2);
        assert.equal(mgr.hasAction('doubleVal'), true);
        const execResult = await mgr.executeAction('doubleVal', { x: 21 });
        assert.equal(execResult, 42);

        const pool = mgr.createPool('calcPool', {}, 2);
        assert.equal(pool.length, 2);
        assert.equal(mgr.has('calcPool'), true);

        const wA = mgr.get('calcPool');
        const wB = mgr.get('calcPool');
        assert.notEqual(wA, wB);

        mgr.terminateAll();
        assert.equal(mgr.size, 0);
    });
});
