import { describe, it, assert } from '../test-helper.js';
import { NEvent } from '../../index.js';

describe('NEvent (core/NEvent.js)', () => {
    it('enregistre, compte et déclenche des écouteurs avec on / emit / off', () => {
        const bus = new NEvent();
        assert.equal(bus.isEmpty, true);

        const received = [];
        const handler = (val) => received.push(val);

        bus.on('ping', handler);
        assert.equal(bus.isEmpty, false);
        assert.equal(bus.has('ping'), true);
        assert.equal(bus.hasListener('ping', handler), true);
        assert.equal(bus.listenerCount('ping'), 1);
        assert.deepEqual(bus.eventNames(), ['ping']);

        bus.emit('ping', 42);
        bus.emit('ping', 99);
        assert.deepEqual(received, [42, 99]);

        bus.off('ping', handler);
        assert.equal(bus.has('ping'), false);
    });

    it('exécute once une seule fois', () => {
        const bus = new NEvent();
        let count = 0;
        bus.once('init', () => { count += 1; });

        bus.emit('init');
        bus.emit('init');
        assert.equal(count, 1);
    });

    it('supporte waitFor (résolution et timeout) et clear', async () => {
        const bus = new NEvent();

        setTimeout(() => bus.emit('ready', { ok: true }), 20);
        const payload = await bus.waitFor('ready', 500);
        assert.deepEqual(payload, { ok: true });

        const expired = await bus.waitFor('never', 30);
        assert.equal(expired, null);

        bus.on('tmp', () => {});
        bus.clear();
        assert.equal(bus.isEmpty, true);
    });
});
