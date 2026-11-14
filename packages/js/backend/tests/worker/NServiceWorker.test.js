import { describe, it, assert } from '../test-helper.js';
import { NServiceWorker } from '../../index.js';

describe('NServiceWorker (worker/NServiceWorker.js)', () => {
    it('configure entryPoint, routes et active le mode Monkey Patch hors-ligne', async () => {
        const sw = new NServiceWorker({
            entryPoint: '/index.html',
            defaultStrategy: 'network-first'
        });

        assert.equal(sw.entryPoint, '/index.html');
        assert.equal(sw.mode, 'inactive');

        sw.addRoute({
            match: '/api/mock-hello',
            handler: async () => ({ status: 'ok', source: 'custom-handler' })
        });

        const status = await sw.enable({ forceMonkeyPatch: true, autoPrecache: false });
        assert.equal(status.ok, true);
        assert.equal(sw.isMonkeyPatched, true);
        assert.equal(sw.mode, 'monkey-patch');

        const response = await sw.handleRequest('https://nlib.local/api/mock-hello');
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.deepEqual(data, { status: 'ok', source: 'custom-handler' });

        await sw.disable();
        assert.equal(sw.isMonkeyPatched, false);
    });
});
