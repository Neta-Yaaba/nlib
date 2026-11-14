import { describe, it, assert } from '../test-helper.js';
import { NObject, NEvent, NUtil } from '../../index.js';

describe('NObject (core/NObject.js)', () => {
    it('initialise automatiquement et expose className, util et event', () => {
        const obj = new NObject({ state: { count: 1, active: true } });
        assert.equal(obj.className, 'NObject');
        assert.equal(obj.util, NUtil);
        assert.equal(obj.isInitialized, true);
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
        assert.equal(changes.length, 2);

        assert.equal(obj.deleteState('ready'), true);
        assert.equal(obj.hasState('ready'), false);

        obj.clearState();
        assert.deepEqual(obj.state, {});
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
        restored.fromJSON(JSON.stringify(json));
        assert.deepEqual(restored.state, { role: 'admin', level: 5 });

        obj.destroy();
        assert.equal(obj.isDestroyed, true);
        assert.deepEqual(obj.state, {});
    });
});
