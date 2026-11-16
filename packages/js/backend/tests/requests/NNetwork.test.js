import { describe, it, assert } from '../test-helper.js';
import { NNetwork, NUtil } from '../../index.js';

describe('NNetwork (requests/NNetwork.js)', () => {
    it('configure baseUrl, driver et chiffrement asymétrique CryptoKey', async () => {
        const net = new NNetwork({ baseUrl: 'https://api.nlib.dev/', timeout: 15000 });
        assert.equal(net.baseUrl, 'https://api.nlib.dev');
        assert.equal(typeof net.driver, 'string');

        if (NUtil.crypto.isWebCryptoAvailable()) {
            const kp = await net.generateClientKeyPair({ modulusLength: 2048 });
            if (kp) {
                await net.setServerPublicKey(kp.publicKey);
                assert.equal(net.hasServerPublicKey(), true);
                assert.equal(net.getServerPublicKey(), kp.publicKey);

                const encrypted = await net.encryptPayload({ hello: 'world' });
                assert.ok(encrypted && encrypted.data);

                const decrypted = await net.decryptPayload(encrypted);
                assert.deepEqual(JSON.parse(decrypted), { hello: 'world' });

                await net.clearCryptoSession();
                assert.equal(net.hasServerPublicKey(), false);
            }
        }

        net.destroy();
        assert.equal(net.isDestroyed, true);
    });
});
