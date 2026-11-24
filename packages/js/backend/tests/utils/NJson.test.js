import { describe, it, assert } from '../index.js';
import { NJson } from '../../index.js';

describe('NJson (utils/NJson.js)', () => {
    it('parse, sérialise, clone, fusionne et compare profondément', () => {
        const raw = '{"user":{"name":"Alice","scores":[10,20]}}';
        assert.equal(NJson.isValid(raw), true);

        const parsed = NJson.parse(raw);
        const cloned = NJson.clone(parsed);
        assert.equal(NJson.equals(parsed, cloned), true);

        const merged = NJson.merge({ a: 1, nested: { x: 1 } }, { b: 2, nested: { y: 2 } });
        assert.deepEqual(merged, { a: 1, b: 2, nested: { x: 1, y: 2 } });
    });

    it('lit, modifie, aplatit et filtre par chemin ou index', () => {
        const data = { users: [{ id: 1, name: 'Bob', secret: 'xxx' }] };
        assert.equal(NJson.getString(data, ['users', 0, 'name']), 'Bob');

        NJson.set(data, ['users', 0, 'active'], true);
        assert.equal(NJson.get(data, ['users', 0, 'active']), true);

        assert.deepEqual(NJson.omit(data.users[0], ['secret']), { id: 1, name: 'Bob', active: true });

        const flat = NJson.flatten({ a: { b: 1 } });
        assert.deepEqual(flat, { 'a.b': 1 });
        assert.deepEqual(NJson.unflatten(flat), { a: { b: 1 } });
    });

    it('parcourt un tableau, un objet ou une chaîne JSON avec forEach', () => {
        const arrOut = [];
        assert.equal(NJson.forEach(['a', 'b', 'c'], (val, idx) => arrOut.push(`${idx}:${val}`)), true);
        assert.deepEqual(arrOut, ['0:a', '1:b', '2:c']);

        const objOut = [];
        NJson.forEach('{"x":1,"y":2,"z":3}', (val, key) => {
            objOut.push(`${key}=${val}`);
            if (key === 'y') return false;
        });
        assert.deepEqual(objOut, ['x=1', 'y=2']);
        assert.equal(NJson.forEach(null, () => {}), false);
    });

    it('gère isValid avec options, size/count avec chemin, has, remove, pick, prettify et minify', () => {
        assert.equal(NJson.isValid('42', { requireObjectOrArray: true }), false);
        assert.equal(NJson.isValid('{"a":1}', { requireObjectOrArray: true }), true);
        assert.equal(NJson.isPlainObject({ a: 1 }), true);
        assert.equal(NJson.isPlainObject([]), false);
        assert.equal(NJson.isEmpty({}), true);

        const doc = { items: [1, 2, 3], meta: { ok: true, secret: 'x' } };
        assert.equal(NJson.size(doc, 'items'), 3);
        assert.equal(NJson.count(doc, 'meta'), 2);
        assert.equal(NJson.has(doc, ['meta', 'ok']), true);
        assert.equal(NJson.remove(doc, ['meta', 'secret']), true);
        assert.equal(NJson.has(doc, ['meta', 'secret']), false);
        assert.deepEqual(NJson.pick(doc.meta, ['ok']), { ok: true });
        assert.equal(NJson.minify('{"a": 1, "b": 2}'), '{"a":1,"b":2}');
        assert.ok(NJson.prettify({ a: 1 }).includes('\n'));
    });
});
