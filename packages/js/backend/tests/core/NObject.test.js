import { describe, it, assert } from '../test-helper.js';
import { NObject, NEvent, NUtil } from '../../index.js';

describe('NObject (core/NObject.js)', () => {
    it('initialise automatiquement et expose className, util et event', () => {
        const obj = new NObject({ state: { count: 1, active: true } });
        assert.equal(obj.className, 'NObject');
        assert.equal(obj.util, NUtil);
        assert.equal(obj.isDestroyed, false);
        assert.ok(obj.event instanceof NEvent);
        assert.deepEqual(obj.state, { count: 1, active: true });
    });

    it('gère les opérations CRUD sur state et émet les événements', () => {
        const obj = new NObject();
        const changes = [];
        obj.event.on('stateChange', (payload) => changes.push(payload));

        obj.setState('name', 'NLib');
        assert.equal(obj.hasState('name'), true);
        assert.equal(obj.getState('name'), 'NLib');
        assert.equal(obj.getState('missing', 'fallback'), 'fallback');

        obj.setState({ version: 2, ready: true });
        assert.equal(obj.getState('version'), 2);
        assert.equal(changes.length, 3);
        assert.equal(obj.hasState('ready'), true);
    });

    it('sérialise (toJSON), restaure (fromJSON), clone et détruit (destroy)', () => {
        const obj = NObject.create({ state: { role: 'admin', level: 5 } });
        const json = obj.toJSON();
        assert.equal(json.className, 'NObject');
        assert.deepEqual(json.state, { role: 'admin', level: 5 });

        const cloned = obj.clone();
        assert.notEqual(cloned, obj);
        assert.deepEqual(cloned.state, obj.state);

        const restored = new NObject();
        restored.fromJSON(JSON.parse(JSON.stringify(json)));
        assert.deepEqual(restored.state, { role: 'admin', level: 5 });

        obj.destroy();
        assert.equal(obj.isDestroyed, true);
        assert.deepEqual(obj.state, {});
    });

    it('délègue directement les méthodes de NEvent (on, once, off, emit, waitFor, etc.)', async () => {
        const obj = new NObject();
        const received = [];
        const onPing = (d) => received.push(d);

        obj.on('ping', onPing);
        obj.once('one', (d) => received.push(`once:${d}`));
        assert.equal(obj.hasListener('ping', onPing), true);
        assert.equal(obj.listenerCount('ping'), 1);
        assert.deepEqual(obj.eventNames(), ['ping', 'one']);

        obj.emit('ping', 1).emit('one', 'a').emit('one', 'b');
        assert.deepEqual(received, [1, 'once:a']);

        obj.off('ping', onPing);
        assert.equal(obj.hasListener('ping', onPing), false);

        setTimeout(() => obj.emit('done', 42), 10);
        assert.equal(await obj.waitFor('done', 500), 42);

        obj.on('tmp', () => {}).clearEvents();
        assert.equal(obj.listenerCount(), 0);
        obj.destroy();
    });

    it('émet state:<key> et beforeDestroy, gère toString(), isNObject() et les cas limites', () => {
        class CustomEntity extends NObject {}
        const entity = CustomEntity.create({ state: { status: 'idle' } });

        assert.equal(entity.toString(), '[CustomEntity]');
        assert.equal(NObject.isNObject(entity), true);
        assert.equal(NObject.isNObject({}), false);
        assert.equal(NObject.isNObject(null), false);

        // Sous-classe clonée préserve sa classe
        const cloned = entity.clone();
        assert.equal(cloned instanceof CustomEntity, true);
        assert.equal(cloned.getState('status'), 'idle');

        // Événement spécifique state:<key> et beforeDestroy
        const events = [];
        entity.on('state:status', (p) => events.push(`status:${p.oldValue}->${p.value}`));
        entity.on('beforeDestroy', ({ target }) => events.push(`destroy:${target.className}`));

        entity.setState('status', 'running');
        entity.setState('status', 'running'); // Pas de changement -> pas d'événement
        entity.fromJSON(null); // Ignoré sans erreur
        entity.destroy();
        entity.setState('status', 'after'); // Ignoré après destruction

        assert.deepEqual(events, ['status:idle->running', 'destroy:CustomEntity']);
        assert.equal(entity.isDestroyed, true);
        assert.equal(entity.hasListener('state:status', () => {}), false);
        assert.equal(entity.listenerCount(), 0);
        assert.deepEqual(entity.eventNames(), []);
    });
});
