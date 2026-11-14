import { describe, it, assert } from '../test-helper.js';
import { NManagedWorker, NWorkerManager } from '../../index.js';

describe('NManagedWorker (worker/NManagedWorker.js)', () => {
    it('délègue onRequest au NWorkerManager parent', async () => {
        const manager = new NWorkerManager();
        manager.registerAction('pingMain', async ({ msg }) => `pong:${msg}`);

        const managed = new NManagedWorker({ name: 'w1' }, manager);
        assert.equal(managed.manager, manager);

        const res = await managed.onRequest('pingMain', { msg: 'hello' });
        assert.equal(res, 'pong:hello');

        managed.destroy();
        manager.terminateAll();
    });
});
