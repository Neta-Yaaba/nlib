import { describe, it, assert } from '../index.js';
import { NWorker } from '../../index.js';

describe('NWorker (worker/NWorker.js)', () => {
    it('enregistre des actions statiques et exécute des requêtes avec repli local ou Worker', async () => {
        NWorker.addActionInstance('addition', () => ({
            request: async ({ a, b }) => a + b
        }));

        assert.equal(typeof NWorker.getActionInstance('addition')?.request, 'function');

        const worker = new NWorker({ name: 'mathWorker' });
        assert.equal(worker.name, 'mathWorker');

        const res = await worker.request('addition', { a: 15, b: 27 });
        assert.equal(res.success, true);
        assert.equal(res.result, 42);
        assert.equal(typeof worker.isRunning, 'boolean');
        assert.equal(worker.pendingCount, 0);

        const missingRes = await worker.request('unknown_action', {});
        assert.equal(missingRes.success, false);

        worker.terminate();
        worker.destroy();
        assert.equal(worker.isDestroyed, true);
    });
});
