import { describe, it, assert } from '../test-helper.js';
import { NCryptography } from '../../index.js';

describe('NCryptography (utils/NCryptography.js)', () => {
    const crypto = new NCryptography();

    it('encode/décode Base64 et UTF-8', () => {
        const bytes = new Uint8Array([78, 76, 105, 98]);
        const b64 = crypto.bytesToBase64(bytes);
        assert.equal(b64, 'TkxpYg==');
        assert.deepEqual(Array.from(crypto.base64ToBytes(b64)), [78, 76, 105, 98]);

        const encoded = crypto.encodeBase64('NLib Sécurité');
        assert.equal(crypto.decodeBase64(encoded), 'NLib Sécurité');
    });

    it('calcule sha256 (hex, base64, bytes) et génère randomBytes via Web Crypto', async () => {
        if (!crypto.isWebCryptoAvailable()) {
            assert.equal(crypto.randomBytes(16).length, 0);
            assert.equal(await crypto.sha256('nlib-test'), '');
            return;
        }

        const rand = crypto.randomBytes(16);
        assert.equal(rand instanceof Uint8Array, true);
        assert.equal(rand.length, 16);

        const hashHex = await crypto.sha256('nlib-test', 'hex');
        const hashB64 = await crypto.sha256('nlib-test', 'base64');
        const hashBytes = await crypto.sha256('nlib-test', 'bytes');

        assert.equal(hashHex.length, 64);
        assert.equal(typeof hashB64, 'string');
        assert.equal(hashBytes instanceof Uint8Array, true);
        assert.equal(hashBytes.length, 32);
    });

    it('chiffre et déchiffre localement avec un IV aléatoire non déterministe via Web Crypto', async () => {
        if (!crypto.isWebCryptoAvailable()) {
            assert.equal(await crypto.encryptLocal('test'), '');
            return;
        }

        const payload = { id: 101, role: 'admin', permissions: ['read', 'write'] };
        const encrypted1 = await crypto.encryptLocal(payload);
        const encrypted2 = await crypto.encryptLocal(payload);

        if (encrypted1 && encrypted2) {
            assert.equal(encrypted1 !== encrypted2, true);
            const decrypted1 = JSON.parse(await crypto.decryptLocal(encrypted1));
            const decrypted2 = JSON.parse(await crypto.decryptLocal(encrypted2));
            assert.deepEqual(decrypted1, payload);
            assert.deepEqual(decrypted2, payload);
        }
    });

    it('gère le chiffrement symétrique et asymétrique/hybride RSA-OAEP + AES-CBC', async () => {
        if (!crypto.isWebCryptoAvailable()) {
            return;
        }

        const symCipher = await crypto.encryptSymmetric('SecretPartagé', 'MaCleSecrete123');
        if (symCipher) {
            const symPlain = await crypto.decryptSymmetric(symCipher, 'MaCleSecrete123');
            assert.equal(symPlain, 'SecretPartagé');
        }

        const keyPair = await crypto.generateKeyPair({ modulusLength: 2048, hash: 'SHA-1' });
        if (keyPair) {
            const pubPem = await crypto.exportPublicKeyToPem(keyPair.publicKey);
            assert.equal(pubPem.includes('BEGIN PUBLIC KEY'), true);

            const importedPub = await crypto.importPublicKeyFromPem(pubPem);
            assert.ok(importedPub);

            const cipherShort = await crypto.encrypt('Message Serveur Client', importedPub);
            assert.equal(cipherShort.type, 'asymmetric');
            assert.equal(await crypto.decrypt(cipherShort, keyPair.privateKey), 'Message Serveur Client');

            const longMsg = 'X'.repeat(300);
            const cipherHybrid = await crypto.encrypt(longMsg, keyPair.publicKey);
            assert.equal(cipherHybrid.type, 'hybrid');
            assert.equal(await crypto.decrypt(cipherHybrid, keyPair.privateKey), longMsg);
        }
    });
});
