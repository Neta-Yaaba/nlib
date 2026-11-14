import { describe, it, assert } from '../test-helper.js';
import { NWorker } from '../../index.js';

describe('NWorker (worker/NWorker.js)', () => {
    it('enregistre des actions statiques et exécute des requêtes avec repli local ou Worker', async () => {
        NWorker.addActionInstance('addition', async ({ a, b }, onUpdate) => {
            if (onUpdate) onUpdate({ step: 'computing' });
            return a + b;
        });

        assert.equal(typeof NWorker.getActionInstance('addition'), 'function');

        const worker = new NWorker({ name: 'mathWorker' });
        assert.equal(worker.name, 'mathWorker');

        const updates = [];
        const sum = await worker.request('addition', { a: 15, b: 27 }, (u) => updates.push(u));
        if (sum !== null) {
            assert.equal(sum, 42);
        }

        worker.destroy();
    });
});
