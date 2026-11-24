import { describe, it, assert } from '../index.js';
import { NNet, NCrypto } from '../../index.js';

describe('NNet (requests/NNet.js)', () => {
    it('configure baseUrl, driver et chiffrement asymétrique CryptoKey', async () => {
        NNet.baseUrl = 'https://api.nlib.dev/';
        assert.equal(NNet.baseUrl, 'https://api.nlib.dev');
        assert.equal(typeof NNet.driver, 'string');
        assert.equal(NNet.CHUNK_SIZE, 1024 * 1024);

        NNet.baseUrl = 'https://v2.nlib.dev/';
        assert.equal(NNet.baseUrl, 'https://v2.nlib.dev');
        NNet.driver = 'fetch';
        assert.equal(NNet.driver, 'fetch');

        if (NCrypto.isWebCryptoAvailable()) {
            const kp = await NNet.generateClientKeyPair({ modulusLength: 2048 });
            if (kp) {
                await NNet.setServerPublicKey(kp.publicKey);
                assert.equal(NNet.hasServerPublicKey(), true);
                assert.equal(NNet.getServerPublicKey(), kp.publicKey);

                const encrypted = await NNet.encryptPayload({ hello: 'world' });
                assert.ok(encrypted && encrypted.data);

                const decrypted = await NNet.decryptPayload(encrypted);
                assert.deepEqual(JSON.parse(decrypted), { hello: 'world' });

                await NNet.clearCryptoSession();
                assert.equal(NNet.hasServerPublicKey(), false);
            }
        }
    });
});
