import { describe, it, assert } from '../test-helper.js';
import { NNetwork } from '../../index.js';

describe('NNetwork (requests/NNetwork.js)', () => {
    it('configure baseUrl, headers, bearer token et chiffrement symétrique/asymétrique', async () => {
        const net = new NNetwork({ baseUrl: 'https://api.nlib.dev/', timeout: 15000 });
        assert.equal(net.baseUrl, 'https://api.nlib.dev');
        assert.equal(net.defaultTimeout, 15000);

        net.setBearerToken('jwt_123');
        assert.equal(net.defaultHeaders.Authorization, 'Bearer jwt_123');

        await net.configureEncryption({
            enabled: true,
            mode: 'symmetric',
            sharedSecret: 'SharedKey2026!',
            persistKeys: false
        });
        assert.equal(net.isEncryptionEnabled, true);
        assert.equal(net.encryptionMode, 'symmetric');
        assert.equal(net.hasEncryptionKeys, true);

        const encrypted = await net.encryptPayload({ hello: 'world' });
        if (encrypted) {
            const decrypted = await net.decryptPayload(encrypted);
            assert.deepEqual(decrypted, { hello: 'world' });
        }

        await net.clearEncryptionKeys(false);
    });
});
