import { describe, it, assert } from '../index.js';
import { NCrypto, NIndexedDB } from '../../index.js';

describe('NCrypto (utils/NCrypto.js)', () => {
    it('encode/décode Base64 et UTF-8', () => {
        const bytes = new Uint8Array([78, 76, 105, 98]);
        const b64 = NCrypto.bytesToBase64(bytes);
        assert.equal(b64, 'TkxpYg==');
        assert.deepEqual(Array.from(NCrypto.base64ToBytes(b64)), [78, 76, 105, 98]);

        const encoded = NCrypto.encodeBase64('NLib Sécurité');
        assert.equal(NCrypto.decodeBase64(encoded), 'NLib Sécurité');
    });

    it('calcule sha256 (hex, base64, bytes) et génère randomBytes via Web Crypto', async () => {
        if (!NCrypto.isWebCryptoAvailable()) {
            assert.equal(NCrypto.randomBytes(16).length, 0);
            assert.equal(await NCrypto.sha256('nlib-test'), '');
            return;
        }

        const rand = NCrypto.randomBytes(16);
        assert.equal(rand instanceof Uint8Array, true);
        assert.equal(rand.length, 16);

        const hashHex = await NCrypto.sha256('nlib-test', 'hex');
        const hashB64 = await NCrypto.sha256('nlib-test', 'base64');
        const hashBytes = await NCrypto.sha256('nlib-test', 'bytes');

        assert.equal(hashHex.length, 64);
        assert.equal(typeof hashB64, 'string');
        assert.equal(hashBytes instanceof Uint8Array, true);
        assert.equal(hashBytes.length, 32);
    });

    it('chiffre et déchiffre localement avec un IV aléatoire non déterministe via Web Crypto', async () => {
        if (!NCrypto.isWebCryptoAvailable()) {
            assert.equal(await NCrypto.encryptLocal('test'), '');
            return;
        }

        const payload = { id: 101, role: 'admin', permissions: ['read', 'write'] };
        const encrypted1 = await NCrypto.encryptLocal(payload);
        const encrypted2 = await NCrypto.encryptLocal(payload);

        if (encrypted1 && encrypted2) {
            assert.equal(encrypted1 !== encrypted2, true);
            const decrypted1 = JSON.parse(await NCrypto.decryptLocal(encrypted1));
            const decrypted2 = JSON.parse(await NCrypto.decryptLocal(encrypted2));
            assert.deepEqual(decrypted1, payload);
            assert.deepEqual(decrypted2, payload);
        }
    });

    it('gère le chiffrement symétrique et asymétrique/hybride RSA-OAEP + AES-CBC', async () => {
        if (!NCrypto.isWebCryptoAvailable()) {
            return;
        }

        const symCipher = await NCrypto.encryptSymmetric('SecretPartagé', 'MaCleSecrete123');
        if (symCipher) {
            const symPlain = await NCrypto.decryptSymmetric(symCipher, 'MaCleSecrete123');
            assert.equal(symPlain, 'SecretPartagé');
        }

        const keyPair = await NCrypto.generateKeyPair({ modulusLength: 2048, hash: 'SHA-1' });
        if (keyPair) {
            const pubPem = await NCrypto.exportPublicKeyToPem(keyPair.publicKey);
            assert.equal(pubPem.includes('BEGIN PUBLIC KEY'), true);

            const importedPub = await NCrypto.importPublicKeyFromPem(pubPem);
            assert.ok(importedPub);

            const cipherShort = await NCrypto.encrypt('Message Serveur Client', importedPub);
            assert.equal(cipherShort.type, 'asymmetric');
            assert.equal(await NCrypto.decrypt(cipherShort, keyPair.privateKey), 'Message Serveur Client');

            const longMsg = 'X'.repeat(300);
            const cipherHybrid = await NCrypto.encrypt(longMsg, keyPair.publicKey);
            assert.equal(cipherHybrid.type, 'hybrid');
            assert.equal(await NCrypto.decrypt(cipherHybrid, keyPair.privateKey), longMsg);
        }
    });

    it('gère les appels concurrents, le rechargement de clé et l\'échec de persistance IDB', async () => {
        if (!NCrypto.isWebCryptoAvailable()) {
            return;
        }

        // 1. Appels concurrents
        const [c1, c2] = await Promise.all([
            NCrypto.encryptLocal('Concurrence-1'),
            NCrypto.encryptLocal('Concurrence-2')
        ]);
        if (c1 && c2) {
            assert.equal(await NCrypto.decryptLocal(c1), 'Concurrence-1');
            assert.equal(await NCrypto.decryptLocal(c2), 'Concurrence-2');
        }

        // 2. Échec d'enregistrement de la clé dans IndexedDB -> refuse de chiffrer sans clé persistée
        const origGet = NIndexedDB.instance.get.bind(NIndexedDB.instance);
        const origPut = NIndexedDB.instance.put.bind(NIndexedDB.instance);
        try {
            NIndexedDB.instance.get = async () => ({ ok: true, data: null, error: null, code: null });
            NIndexedDB.instance.put = async () => ({ ok: false, data: null, error: 'WRITE_FAILED', code: 'IDB_ERROR' });

            const failedCipher = await NCrypto.encryptLocal('NeDoitPasPasser');
            assert.equal(failedCipher, '');
        } finally {
            NIndexedDB.instance.get = origGet;
            NIndexedDB.instance.put = origPut;
        }
    });
});
