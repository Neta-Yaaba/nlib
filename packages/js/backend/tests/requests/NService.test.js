import { describe, it, assert } from '../test-helper.js';
import { NService } from '../../index.js';

describe('NService (requests/NService.js)', () => {
    it('initialise lastId (int), persiste dans IndexedDB sans chiffrement et sélectionne un seul driver', async () => {
        const srv = new NService({
            id: 'sync_events',
            url: 'https://api.nlib.dev/events',
            lastId: 10,
            persistLastId: true,
            pollingInterval: 2000
        });

        assert.equal(srv.serviceId, 'sync_events');
        assert.equal(srv.url, 'https://api.nlib.dev/events');
        assert.equal(srv.lastId, 10);
        assert.equal(srv.isRunning, false);
        assert.equal(srv.activeDriver, null);
        assert.equal(['native', 'websocket', 'sse', 'polling'].includes(srv.driver), true);

        await srv.saveLastId(25);
        assert.equal(srv.lastId, 25);

        const loaded = await srv.loadLastId();
        assert.equal(loaded, 25);

        await srv.resetLastId(0);
        assert.equal(srv.lastId, 0);

        assert.equal(typeof srv.refreshId, 'function');
        assert.equal(typeof srv.fetchId, 'function');
        assert.equal(srv.pollingInterval, 2000);
        assert.equal(typeof srv.isNativeAvailable, 'boolean');
        assert.equal(typeof srv.isWebSocketAvailable, 'boolean');
        assert.equal(typeof srv.isSseAvailable, 'boolean');
        assert.equal(typeof srv.isPollingAvailable, 'boolean');

        srv.configure({ pollingInterval: 3000 });
        assert.equal(srv.pollingInterval, 3000);

        const fn = () => {};
        srv.on('id', fn).off('id', fn);

        srv.destroy();
        assert.equal(srv.isDestroyed, true);
    });
});
