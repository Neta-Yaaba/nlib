import { describe, it, assert } from '../index.js';
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

    it('parcourt un tableau, un objet ou une chaîne JSON avec forEach', () => {
        const arrOut = [];
        assert.equal(json.forEach(['a', 'b', 'c'], (val, idx) => arrOut.push(`${idx}:${val}`)), true);
        assert.deepEqual(arrOut, ['0:a', '1:b', '2:c']);

        const objOut = [];
        json.forEach('{"x":1,"y":2,"z":3}', (val, key) => {
            objOut.push(`${key}=${val}`);
            if (key === 'y') return false;
        });
        assert.deepEqual(objOut, ['x=1', 'y=2']);
        assert.equal(json.forEach(null, () => {}), false);
    });

    it('gère isValid avec options, size/count avec chemin, has, remove, pick, prettify et minify', () => {
        assert.equal(json.isValid('42', { requireObjectOrArray: true }), false);
        assert.equal(json.isValid('{"a":1}', { requireObjectOrArray: true }), true);
        assert.equal(json.isPlainObject({ a: 1 }), true);
        assert.equal(json.isPlainObject([]), false);
        assert.equal(json.isEmpty({}), true);

        const doc = { items: [1, 2, 3], meta: { ok: true, secret: 'x' } };
        assert.equal(json.size(doc, 'items'), 3);
        assert.equal(json.count(doc, 'meta'), 2);
        assert.equal(json.has(doc, ['meta', 'ok']), true);
        assert.equal(json.remove(doc, ['meta', 'secret']), true);
        assert.equal(json.has(doc, ['meta', 'secret']), false);
        assert.deepEqual(json.pick(doc.meta, ['ok']), { ok: true });
        assert.equal(json.minify('{"a": 1, "b": 2}'), '{"a":1,"b":2}');
        assert.ok(json.prettify({ a: 1 }).includes('\n'));
    });
});
