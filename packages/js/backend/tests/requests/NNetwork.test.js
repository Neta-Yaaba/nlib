import { describe, it, assert } from '../test-helper.js';
import { NNetwork } from '../../index.js';

describe('NNetwork (requests/NNetwork.js)', () => {
    it('configure baseUrl, driver et chiffrement de payload', async () => {
        const net = new NNetwork({ baseUrl: 'https://api.nlib.dev/', timeout: 15000 });
        assert.equal(net.baseUrl, 'https://api.nlib.dev');
        assert.equal(typeof net.driver, 'string');

        const encrypted = await net.encryptPayload({ hello: 'world' }, { secret: 'SharedKey2026!' });
        if (encrypted) {
            const decrypted = await net.decryptPayload(encrypted, { secret: 'SharedKey2026!' });
            assert.deepEqual(JSON.parse(decrypted), { hello: 'world' });
        }
    });
});
