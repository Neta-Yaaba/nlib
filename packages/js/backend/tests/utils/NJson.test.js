import { describe, it, assert } from '../test-helper.js';
import { NJson } from '../../index.js';

describe('NJson (utils/NJson.js)', () => {
    const json = new NJson();

    it('parse, sérialise, clone, fusionne et compare profondément', () => {
        const raw = '{"user":{"name":"Alice","scores":[10,20]}}';
        assert.equal(json.isValid(raw), true);

        const parsed = json.parse(raw);
        const cloned = json.clone(parsed);
        assert.equal(json.equals(parsed, cloned), true);

        const merged = json.merge({ a: 1, nested: { x: 1 } }, { b: 2, nested: { y: 2 } });
        assert.deepEqual(merged, { a: 1, b: 2, nested: { x: 1, y: 2 } });
    });

    it('lit, modifie, aplatit et filtre par chemin ou index', () => {
        const data = { users: [{ id: 1, name: 'Bob', secret: 'xxx' }] };
        assert.equal(json.getString(data, ['users', 0, 'name']), 'Bob');

        json.set(data, ['users', 0, 'active'], true);
        assert.equal(json.get(data, ['users', 0, 'active']), true);

        assert.deepEqual(json.omit(data.users[0], ['secret']), { id: 1, name: 'Bob', active: true });

        const flat = json.flatten({ a: { b: 1 } });
        assert.deepEqual(flat, { 'a.b': 1 });
        assert.deepEqual(json.unflatten(flat), { a: { b: 1 } });
    });
});
