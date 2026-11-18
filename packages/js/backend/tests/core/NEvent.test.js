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

    it('exécute once une seule fois et appelle handlerRemove au retrait (emit, off, clear)', () => {
        const bus = new NEvent();
        let count = 0;
        let removedReasons = 0;
        bus.once('init', () => { count += 1; }, ({ event }) => {
            if (event === 'init') removedReasons += 1;
        });

        bus.emit('init');
        bus.emit('init');
        assert.equal(count, 1);
        assert.equal(removedReasons, 1);

        // Retrait manuel via off(event, callback original)
        let manualRemoved = 0;
        const fn = () => { count += 1; };
        bus.once('step', fn, () => { manualRemoved += 1; });
        bus.off('step', fn);
        bus.emit('step');
        assert.equal(count, 1);
        assert.equal(manualRemoved, 1);

        // Retrait via clear()
        let clearedCount = 0;
        bus.once('later', () => {}, () => { clearedCount += 1; });
        bus.clear();
        assert.equal(clearedCount, 1);
    });

    it('supporte waitFor (résolution et timeout) et clear', async () => {
        const bus = new NEvent();

        setTimeout(() => bus.emit('ready', { ok: true }), 20);
        const payload = await bus.waitFor('ready', 500);
        assert.deepEqual(payload, { ok: true });

        const expired = await bus.waitFor('never', 30);
        assert.equal(expired, null);
        assert.equal(bus.listenerCount('never'), 0);

        // Annulation d'un waitFor via clear()
        const pending = bus.waitFor('cancelled', 5000);
        bus.on('tmp', () => {});
        bus.clear();
        assert.equal(await pending, null);
        assert.equal(bus.isEmpty, true);
    });
});
