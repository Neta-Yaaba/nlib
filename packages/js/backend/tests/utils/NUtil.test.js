import { describe, it, assert } from '../test-helper.js';
import { NUtil } from '../../index.js';

describe('NUtil (utils/NUtil.js)', () => {
    it('expose tous les singletons paresseux', () => {
        assert.ok(NUtil.str);
        assert.ok(NUtil.num);
        assert.ok(NUtil.date);
        assert.ok(NUtil.amount);
        assert.ok(NUtil.email);
        assert.ok(NUtil.phone);
        assert.ok(NUtil.crypto);
        assert.ok(NUtil.url);
        assert.ok(NUtil.json);
        assert.ok(NUtil.password);
        assert.ok(NUtil.arr);
        assert.ok(NUtil.env);
        assert.ok(NUtil.config);
        assert.ok(NUtil.sys);
        assert.ok(NUtil.worker);
        assert.ok(NUtil.net);
        assert.ok(NUtil.db);
        assert.ok(NUtil.file);
        assert.ok(NUtil.dir);
        assert.ok(NUtil.cache);
        assert.ok(NUtil.log);
    });

    it('génère des identifiants uuid/uid et vérifie les types/valeurs', () => {
        const id = NUtil.uuid();
        assert.equal(id.length, 36);
        const uid = NUtil.uid('usr_');
        assert.equal(uid.startsWith('usr_'), true);

        assert.equal(NUtil.getType([]), 'array');
        assert.equal(NUtil.getType(null), 'null');
        assert.equal(NUtil.isEmpty('   '), true);
        assert.equal(NUtil.isEmpty([1]), false);
        assert.equal(NUtil.isDefined(0), true);
        assert.equal(NUtil.isDefined(undefined), false);
        assert.equal(NUtil.isEqual({ a: [1, 2] }, { a: [1, 2] }), true);
        assert.equal(NUtil.toBoolean('oui'), true);
        assert.equal(NUtil.toBoolean('0'), false);
    });

    it('supporte sleep et retry', async () => {
        let attempts = 0;
        const result = await NUtil.retry(async (attempt) => {
            attempts = attempt;
            if (attempt < 2) throw new Error('Retry me');
            return 'success';
        }, { retries: 3, delay: 10, backoff: 1 });

        assert.equal(result, 'success');
        assert.equal(attempts, 2);
    });
});
