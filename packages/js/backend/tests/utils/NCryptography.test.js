import { describe, it, assert } from '../test-helper.js';
import { NCryptography } from '../../index.js';

describe('NCryptography (utils/NCryptography.js)', () => {
    const crypto = new NCryptography();

    it('calcule sha256 (sync/async) et hmacSha256Sync', async () => {
        const hashSync = crypto.sha256Sync('nlib-test');
        const hashAsync = await crypto.sha256('nlib-test');
        assert.equal(hashSync.length, 64);
        assert.equal(hashSync, hashAsync);

        const mac = crypto.hmacSha256Sync('message', 'secret');
        assert.equal(mac instanceof Uint8Array, true);
        assert.equal(mac.length, 32);
    });

    it('chiffre et déchiffre localement en mode synchrone et asynchrone sans clé externe', async () => {
        const payload = { id: 101, role: 'admin', permissions: ['read', 'write'] };

        const encryptedSync = crypto.encryptLocalSync(payload);
        assert.equal(encryptedSync.startsWith('NLOC1:'), true);
        const decryptedSync = crypto.decryptLocalSync(encryptedSync);
        assert.deepEqual(decryptedSync, payload);

        const encryptedAsync = await crypto.encryptLocal(payload);
        assert.equal(typeof encryptedAsync, 'string');
        const decryptedAsync = await crypto.decryptLocal(encryptedAsync);
        assert.deepEqual(decryptedAsync, payload);
    });

    it('gère le chiffrement symétrique et hybride RSA-OAEP + AES-GCM client-serveur', async () => {
        const symCipher = await crypto.encryptSymmetric('SecretPartagé', 'MaCleSecrete123');
        if (symCipher) {
            const symPlain = await crypto.decryptSymmetric(symCipher, 'MaCleSecrete123');
            assert.equal(symPlain, 'SecretPartagé');
        }

        const keyPair = await crypto.generateKeyPair();
        if (keyPair) {
            const pubPem = await crypto.exportPublicKeyToPem(keyPair.publicKey);
            const privPem = await crypto.exportPrivateKeyToPem(keyPair.privateKey);
            assert.equal(pubPem.includes('BEGIN PUBLIC KEY'), true);
            assert.equal(privPem.includes('BEGIN PRIVATE KEY'), true);

            const importedPub = await crypto.importPublicKeyFromPem(pubPem);
            const importedPriv = await crypto.importPrivateKeyFromPem(privPem);
            const cipher = await crypto.encrypt('Message Serveur Client', importedPub);
            const plain = await crypto.decrypt(cipher, importedPriv);
            assert.equal(plain, 'Message Serveur Client');
        }
    });
});
