/**
 * @file NCrypto.js
 * @package @nlib/js-backend
 * @description Classe utilitaire statique de cryptographie basée sur l'API Web Crypto (`globalThis.crypto.subtle`)
 * dans l'écosystème NLib :
 * - Génération d'octets aléatoires cryptographiquement sûrs (`randomBytes`) et encodage Base64 / UTF-8 (`bytesToBase64`, `base64ToBytes`, `encodeBase64`, `decodeBase64`),
 * - Hachage SHA-256 (`sha256`),
 * - Gestion de clés asymétriques RSA-OAEP (`generateKeyPair`, `exportPublicKeyToPem`, `importPublicKeyFromPem`),
 * - Chiffrement et déchiffrement hybride RSA-OAEP + AES-256-CBC (`encrypt`, `decrypt`),
 * - Chiffrement et déchiffrement symétrique AES-256-CBC (`encryptSymmetric`, `decryptSymmetric`),
 * - Chiffrement et déchiffrement local AES-256-GCM avec clé persistée dans IndexedDB (`encryptLocal`, `decryptLocal`).
 */

import { NLog } from '../log/NLog.js';
import { NUtil } from './NUtil.js';
import { NIndexedDB } from '../database/NIndexedDB.js';

/**
 * @class NCrypto
 * @description Fournit les opérations cryptographiques statiques Web Crypto pour le hachage SHA-256,
 * l'encodage Base64 et le chiffrement symétrique, asymétrique, hybride et local dans NLib.
 *
 * @example <caption>Exemple 1 : Hachage SHA-256 et encodage Base64</caption>
 * const hash = await NCrypto.sha256('nlib-secret');
 * const b64 = NCrypto.encodeBase64('Bonjour NLib');
 * console.log(NCrypto.decodeBase64(b64)); // 'Bonjour NLib'
 *
 * @example <caption>Exemple 2 : Chiffrement symétrique AES-256-CBC</caption>
 * const payload = await NCrypto.encryptSymmetric('Données sensibles', 'MaCleSecrete');
 * const plain = await NCrypto.decryptSymmetric(payload, 'MaCleSecrete');
 * console.log(plain); // 'Données sensibles'
 *
 * @example <caption>Exemple 3 : Chiffrement asymétrique / hybride RSA-OAEP</caption>
 * const keyPair = await NCrypto.generateKeyPair({ modulusLength: 2048, hash: 'SHA-256' });
 * if (keyPair) {
 *     const encrypted = await NCrypto.encrypt({ id: 42 }, keyPair.publicKey);
 *     const decrypted = await NCrypto.decrypt(encrypted, keyPair.privateKey);
 *     console.log(decrypted); // '{"id":42}'
 * }
 */
export class NCrypto {

    /**
     * Promesse en cours pour la récupération ou génération de la clé locale AES-256-GCM.
     * @type {Promise<CryptoKey|null>|null}
     * @private
     */
    static #localKeyPromise = null;

    // =========================================================================
    // Méthodes publiques — Environnement, Aléatoire & Encodage Base64
    // =========================================================================

    /**
     * Vérifie si l'API Web Crypto (`crypto.subtle` et `crypto.getRandomValues`) est disponible
     * dans l'environnement d'exécution courant (navigateur, Web Worker ou Node.js récent).
     *
     * @returns {boolean} `true` si Web Crypto est pleinement disponible, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier le support Web Crypto</caption>
     * if (NCrypto.isWebCryptoAvailable()) {
     *     console.log('Web Crypto prêt.');
     * }
     *
     * @example <caption>Exemple 2 : Repli conditionnel avant une opération</caption>
     * const canEncrypt = NCrypto.isWebCryptoAvailable();
     * console.log(canEncrypt); // true dans un navigateur/contexte sécurisé
     */
    static isWebCryptoAvailable() {
        return (
            typeof globalThis !== 'undefined' &&
            !!globalThis.crypto?.subtle &&
            typeof globalThis.crypto.getRandomValues === 'function'
        );
    }

    /**
     * Génère un tableau d'octets aléatoires cryptographiquement sûrs.
     * Gère automatiquement le découpage par blocs de 65 536 octets imposé par `crypto.getRandomValues`.
     *
     * @param {number} [length=16] - Nombre d'octets aléatoires à générer (entier positif >= 1).
     * @returns {Uint8Array} Tableau d'octets aléatoires, ou `Uint8Array(0)` si Web Crypto est indisponible ou la longueur invalide.
     *
     * @example <caption>Exemple 1 : Générer un IV de 16 octets</caption>
     * const iv = NCrypto.randomBytes(16);
     * console.log(iv.length); // 16
     *
     * @example <caption>Exemple 2 : Générer un sel de 32 octets en Base64</caption>
     * const salt = NCrypto.bytesToBase64(NCrypto.randomBytes(32));
     */
    static randomBytes(length = 16) {
        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.randomBytes: Web Crypto indisponible.');
            return new Uint8Array(0);
        }

        if (!Number.isInteger(length) || length < 1) {
            NLog.warn('NCrypto.randomBytes: La longueur doit être un entier positif.', { length });
            return new Uint8Array(0);
        }

        try {
            const bytes = new Uint8Array(length);

            for (let offset = 0; offset < length; offset += 65536) {
                globalThis.crypto.getRandomValues(
                    bytes.subarray(offset, Math.min(offset + 65536, length))
                );
            }

            return bytes;
        } catch (error) {
            NLog.error('NCrypto.randomBytes: Échec de génération aléatoire.', error);
            return new Uint8Array(0);
        }
    }

    /**
     * Convertit un tampon binaire (`Uint8Array` ou `ArrayBuffer`) en chaîne encodée en Base64.
     *
     * @param {Uint8Array|ArrayBuffer} bytes - Données binaires à encoder.
     * @returns {string} Chaîne Base64 correspondante, ou `''` si l'entrée est invalide ou vide.
     *
     * @example <caption>Exemple 1 : Encoder un Uint8Array en Base64</caption>
     * console.log(NCrypto.bytesToBase64(new Uint8Array([78, 76, 105, 98]))); // 'TkxpYg=='
     *
     * @example <caption>Exemple 2 : Encoder un ArrayBuffer en Base64</caption>
     * const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
     * console.log(NCrypto.bytesToBase64(buffer)); // 'AQIDBA=='
     */
    static bytesToBase64(bytes) {
        const data = bytes instanceof ArrayBuffer
            ? new Uint8Array(bytes)
            : bytes;

        if (!(data instanceof Uint8Array) || data.length === 0) {
            return '';
        }

        let binary = '';
        const chunkSize = 0x8000;

        for (let i = 0; i < data.length; i += chunkSize) {
            binary += String.fromCharCode(
                ...data.subarray(i, i + chunkSize)
            );
        }

        return btoa(binary);
    }

    /**
     * Décode une chaîne Base64 en tableau d'octets (`Uint8Array`).
     *
     * @param {string} base64 - Chaîne Base64 à décoder.
     * @returns {Uint8Array} Tableau d'octets décodé, ou `Uint8Array(0)` si l'entrée est vide ou invalide.
     *
     * @example <caption>Exemple 1 : Décoder une chaîne Base64 en octets</caption>
     * const bytes = NCrypto.base64ToBytes('TkxpYg==');
     * console.log(Array.from(bytes)); // [78, 76, 105, 98]
     *
     * @example <caption>Exemple 2 : Gestion d'une chaîne Base64 invalide</caption>
     * const empty = NCrypto.base64ToBytes('###invalide###');
     * console.log(empty.length); // 0
     */
    static base64ToBytes(base64) {
        if (typeof base64 !== 'string' || !base64.trim()) {
            return new Uint8Array(0);
        }

        try {
            const binary = atob(base64.replace(/\s+/g, ''));
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            return bytes;
        } catch {
            return new Uint8Array(0);
        }
    }

    /**
     * Encode une chaîne de texte UTF-8 en Base64.
     *
     * @param {string} text - Texte en clair à encoder.
     * @returns {string} Texte encodé en Base64, ou `''` si l'entrée n'est pas une chaîne non vide.
     *
     * @example <caption>Exemple 1 : Encodage UTF-8 vers Base64</caption>
     * console.log(NCrypto.encodeBase64('NLib 🔒'));
     *
     * @example <caption>Exemple 2 : Encodage d'une chaîne accentuée</caption>
     * console.log(NCrypto.encodeBase64('Sécurité')); // 'U8OpY3VyaXTDqQ=='
     */
    static encodeBase64(text) {
        if (typeof text !== 'string' || !text.length) {
            return '';
        }

        return NCrypto.bytesToBase64(
            new TextEncoder().encode(text)
        );
    }

    /**
     * Décode une chaîne Base64 en texte UTF-8 valide.
     *
     * @param {string} base64 - Chaîne Base64 à décoder.
     * @returns {string} Texte UTF-8 décodé, ou `''` si le format Base64 ou UTF-8 est invalide.
     *
     * @example <caption>Exemple 1 : Décodage Base64 vers UTF-8</caption>
     * const encoded = NCrypto.encodeBase64('Bonjour');
     * console.log(NCrypto.decodeBase64(encoded)); // 'Bonjour'
     *
     * @example <caption>Exemple 2 : Entrée invalide retournant une chaîne vide</caption>
     * console.log(NCrypto.decodeBase64('invalide!')); // ''
     */
    static decodeBase64(base64) {
        const bytes = NCrypto.base64ToBytes(base64);

        if (!bytes.length) {
            return '';
        }

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
            return '';
        }
    }

    // =========================================================================
    // Méthodes publiques — Hachage SHA-256
    // =========================================================================

    /**
     * Calcule l'empreinte cryptographique SHA-256 d'une donnée (chaîne ou `Uint8Array`)
     * via Web Crypto.
     *
     * @param {string|Uint8Array|any} data - Donnée à hacher (convertie en chaîne UTF-8 si ce n'est pas un `Uint8Array`).
     * @param {'hex'|'base64'|'bytes'} [outputFormat='hex'] - Format de sortie souhaité.
     * @returns {Promise<string|Uint8Array>} Empreinte au format demandé, ou `''` / `Uint8Array(0)` en cas d'indisponibilité ou d'erreur.
     *
     * @example <caption>Exemple 1 : Empreinte hexadécimale</caption>
     * const hex = await NCrypto.sha256('nlib');
     * console.log(hex.length); // 64
     *
     * @example <caption>Exemple 2 : Empreinte binaire (Uint8Array)</caption>
     * const bytes = await NCrypto.sha256('nlib', 'bytes');
     * console.log(bytes.length); // 32
     */
    static async sha256(data, outputFormat = 'hex') {
        const emptyFallback = outputFormat === 'bytes' ? new Uint8Array(0) : '';

        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.sha256: Web Crypto indisponible.');
            return emptyFallback;
        }

        try {
            const input = data instanceof Uint8Array
                ? data
                : new TextEncoder().encode(String(data ?? ''));

            const digest = new Uint8Array(
                await globalThis.crypto.subtle.digest('SHA-256', input)
            );

            if (outputFormat === 'bytes') {
                return digest;
            }

            if (outputFormat === 'base64') {
                return NCrypto.bytesToBase64(digest);
            }

            return Array.from(digest)
                .map(byte => byte.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            NLog.error('NCrypto.sha256: Échec du calcul SHA-256.', error);
            return emptyFallback;
        }
    }

    // =========================================================================
    // Méthodes publiques — Gestion des clés RSA-OAEP
    // =========================================================================

    /**
     * Génère une paire de clés asymétriques RSA-OAEP (`publicKey` et `privateKey`) exportable.
     *
     * @param {Object} [options={}] - Options de génération de la paire de clés.
     * @param {2048|3072|4096} [options.modulusLength=4096] - Taille du module RSA en bits (`2048`, `3072` ou `4096`).
     * @param {'SHA-1'|'SHA-256'} [options.hash='SHA-1'] - Algorithme de hachage associé à RSA-OAEP.
     * @returns {Promise<CryptoKeyPair|null>} Paire de clés `{ publicKey, privateKey }`, ou `null` en cas d'erreur ou de paramètre invalide.
     *
     * @example <caption>Exemple 1 : Génération avec les paramètres par défaut (4096 bits, SHA-1)</caption>
     * const pair = await NCrypto.generateKeyPair();
     *
     * @example <caption>Exemple 2 : Génération 2048 bits avec SHA-256</caption>
     * const pair = await NCrypto.generateKeyPair({ modulusLength: 2048, hash: 'SHA-256' });
     */
    static async generateKeyPair(options = {}) {
        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.generateKeyPair: Web Crypto indisponible.');
            return null;
        }

        const opts = (options && typeof options === 'object') ? options : {};
        const modulusLength = opts.modulusLength ?? 4096;
        const hash = opts.hash ?? 'SHA-1';

        if (![2048, 3072, 4096].includes(modulusLength)) {
            NLog.warn('NCrypto.generateKeyPair: Taille RSA non autorisée.', { modulusLength });
            return null;
        }

        if (!['SHA-1', 'SHA-256'].includes(hash)) {
            NLog.warn('NCrypto.generateKeyPair: Algorithme RSA invalide.', { hash });
            return null;
        }

        try {
            return await globalThis.crypto.subtle.generateKey(
                {
                    name: 'RSA-OAEP',
                    modulusLength,
                    publicExponent: new Uint8Array([1, 0, 1]),
                    hash
                },
                true,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            NLog.error('NCrypto.generateKeyPair: Échec de génération de la paire de clés.', error);
            return null;
        }
    }

    /**
     * Exporte une clé publique `CryptoKey` au format PEM SPKI (`-----BEGIN PUBLIC KEY-----`).
     *
     * @param {CryptoKey} publicKey - Clé publique Web Crypto à exporter.
     * @returns {Promise<string>} Clé formatée au standard PEM, ou `''` en cas d'échec.
     *
     * @example <caption>Exemple 1 : Exporter une clé publique en PEM</caption>
     * const pair = await NCrypto.generateKeyPair({ modulusLength: 2048 });
     * if (pair) {
     *     const pem = await NCrypto.exportPublicKeyToPem(pair.publicKey);
     *     console.log(pem);
     * }
     *
     * @example <caption>Exemple 2 : Gestion d'une clé absente ou invalide</caption>
     * const pem = await NCrypto.exportPublicKeyToPem(null);
     * console.log(pem); // ''
     */
    static async exportPublicKeyToPem(publicKey) {
        if (!publicKey || !NCrypto.isWebCryptoAvailable()) {
            return '';
        }

        try {
            const buffer = await globalThis.crypto.subtle.exportKey(
                'spki',
                publicKey
            );

            const base64 = NCrypto.bytesToBase64(buffer);
            const formatted = (base64.match(/.{1,64}/g) || []).join('\n');

            return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`;
        } catch (error) {
            NLog.error('NCrypto.exportPublicKeyToPem', error);
            return '';
        }
    }

    /**
     * Importe une clé publique RSA-OAEP (SHA-1 pour compatibilité PHP OAEP)
     * depuis une chaîne PEM au format SPKI.
     *
     * @param {string} pemKey - Clé publique au format PEM (`-----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----`).
     * @returns {Promise<CryptoKey|null>} Clé publique `CryptoKey` prête pour le chiffrement, ou `null` si invalide.
     *
     * @example <caption>Exemple 1 : Importer une clé publique PEM</caption>
     * const pubKey = await NCrypto.importPublicKeyFromPem(pemString);
     *
     * @example <caption>Exemple 2 : Importer la clé publique du serveur et vérifier sa validité</caption>
     * const serverKey = await NCrypto.importPublicKeyFromPem(serverPem);
     * if (serverKey) {
     *     const encrypted = await NCrypto.encrypt('Ping', serverKey);
     * }
     */
    static async importPublicKeyFromPem(pemKey) {
        if (typeof pemKey !== 'string' || !NCrypto.isWebCryptoAvailable()) {
            return null;
        }

        try {
            // Nettoyer le PEM : retirer header/footer et tous les espaces/retours à la ligne
            const pemHeader = '-----BEGIN PUBLIC KEY-----';
            const pemFooter = '-----END PUBLIC KEY-----';
            let pemContents = pemKey.replace(pemHeader, '').replace(pemFooter, '');
            pemContents = pemContents.replace(/\s+/g, '');

            const binaryKeyBuffer = NCrypto.base64ToBytes(pemContents);
            if (!binaryKeyBuffer.length) {
                return null;
            }

            return await globalThis.crypto.subtle.importKey(
                'spki',
                binaryKeyBuffer,
                {
                    name: 'RSA-OAEP',
                    hash: 'SHA-1' // Compatibilité PHP OAEP
                },
                true,
                ['encrypt']
            );
        } catch (error) {
            NLog.error('NCrypto.importPublicKeyFromPem', error);
            return null;
        }
    }

    // =========================================================================
    // Méthodes publiques — Chiffrement asymétrique & hybride (RSA-OAEP / AES-CBC)
    // =========================================================================

    /**
     * Chiffre une donnée (chaîne ou objet sérialisable en JSON) à l'aide d'une clé publique RSA (`CryptoKey`).
     * - Si la taille <= 190 octets, utilise le chiffrement asymétrique direct (`type: 'asymmetric'`).
     * - Au-delà, génère une clé éphémère AES-256-CBC pour chiffrer les données et chiffre cette clé
     *   avec RSA-OAEP (`type: 'hybrid'`).
     *
     * @param {any} data - Donnée à chiffrer.
     * @param {CryptoKey|null} [publicKey=null] - Clé publique RSA `CryptoKey` (issue de `generateKeyPair()` ou `importPublicKeyFromPem()`).
     * @returns {Promise<Object>} Charge chiffrée (`{ type, data }` ou `{ type, key, iv, data }`), ou `{}` en cas d'entrée vide ou d'erreur.
     *
     * @example <caption>Exemple 1 : Chiffrer un message court (mode asymétrique)</caption>
     * const payload = await NCrypto.encrypt('Message confidentiel', keyPair.publicKey);
     * console.log(payload.type); // 'asymmetric'
     *
     * @example <caption>Exemple 2 : Chiffrer un objet volumineux (mode hybride RSA + AES)</caption>
     * const largeObj = { token: 'x'.repeat(300), items: [1, 2, 3] };
     * const payload = await NCrypto.encrypt(largeObj, keyPair.publicKey);
     * console.log(payload.type); // 'hybrid'
     */
    static async encrypt(data, publicKey = null) {
        if (data === null || data === undefined || data === '') {
            return {};
        }

        if (!NCrypto.isWebCryptoAvailable() || !publicKey) {
            NLog.warn('NCrypto.encrypt: Une clé publique RSA et Web Crypto sont nécessaires.');
            return {};
        }

        try {
            const plainText = typeof data === 'string'
                ? data
                : JSON.stringify(data);

            const bytes = new TextEncoder().encode(plainText);

            if (bytes.length <= 190) {
                const encrypted = await globalThis.crypto.subtle.encrypt(
                    { name: 'RSA-OAEP' },
                    publicKey,
                    bytes
                );

                return {
                    type: 'asymmetric',
                    data: NCrypto.bytesToBase64(encrypted)
                };
            }

            const aesKey = await globalThis.crypto.subtle.generateKey(
                { name: 'AES-CBC', length: 256 },
                true,
                ['encrypt']
            );

            const iv = NCrypto.randomBytes(16);
            if (!iv.length) {
                return {};
            }

            const encryptedData = await globalThis.crypto.subtle.encrypt(
                { name: 'AES-CBC', iv },
                aesKey,
                bytes
            );

            const rawKey = await globalThis.crypto.subtle.exportKey(
                'raw',
                aesKey
            );

            const encryptedKey = await globalThis.crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                publicKey,
                rawKey
            );

            return {
                type: 'hybrid',
                key: NCrypto.bytesToBase64(encryptedKey),
                iv: NCrypto.bytesToBase64(iv),
                data: NCrypto.bytesToBase64(encryptedData)
            };
        } catch (error) {
            NLog.error('NCrypto.encrypt', error);
            return {};
        }
    }

    /**
     * Déchiffre une charge produite par `encrypt()` (mode `'asymmetric'` ou `'hybrid'`)
     * à l'aide de la clé privée RSA (`CryptoKey`) correspondante.
     *
     * @param {Object|string} encryptedPayload - Objet ou chaîne JSON contenant la charge chiffrée.
     * @param {CryptoKey|null} [privateKey=null] - Clé privée RSA `CryptoKey` issue de `generateKeyPair()`.
     * @returns {Promise<string>} Texte en clair déchiffré, ou `''` en cas d'échec ou de données invalides.
     *
     * @example <caption>Exemple 1 : Déchiffrer un objet chiffré reçu</caption>
     * const clearText = await NCrypto.decrypt(payload, keyPair.privateKey);
     *
     * @example <caption>Exemple 2 : Déchiffrer une charge sérialisée en JSON</caption>
     * const jsonPayload = JSON.stringify(payload);
     * const clearText = await NCrypto.decrypt(jsonPayload, keyPair.privateKey);
     */
    static async decrypt(encryptedPayload, privateKey = null) {
        if (!encryptedPayload || !privateKey) {
            return '';
        }

        let payload = encryptedPayload;

        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch {
                return '';
            }
        }

        if (!payload || typeof payload !== 'object' || !payload.data) {
            return '';
        }

        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.decrypt: Web Crypto indisponible.');
            return '';
        }

        try {
            if (payload.type === 'hybrid') {
                const encryptedKey = NCrypto.base64ToBytes(payload.key);
                const rawKey = await globalThis.crypto.subtle.decrypt(
                    { name: 'RSA-OAEP' },
                    privateKey,
                    encryptedKey
                );

                const aesKey = await globalThis.crypto.subtle.importKey(
                    'raw',
                    rawKey,
                    { name: 'AES-CBC', length: 256 },
                    false,
                    ['decrypt']
                );

                const iv = NCrypto.base64ToBytes(payload.iv);
                const encryptedData = NCrypto.base64ToBytes(payload.data);

                const decrypted = await globalThis.crypto.subtle.decrypt(
                    { name: 'AES-CBC', iv },
                    aesKey,
                    encryptedData
                );

                return new TextDecoder().decode(decrypted);
            }

            if (payload.type === 'asymmetric') {
                const decrypted = await globalThis.crypto.subtle.decrypt(
                    { name: 'RSA-OAEP' },
                    privateKey,
                    NCrypto.base64ToBytes(payload.data)
                );

                return new TextDecoder().decode(decrypted);
            }

            return '';
        } catch (error) {
            NLog.error('NCrypto.decrypt', error);
            return '';
        }
    }

    // =========================================================================
    // Méthodes publiques — Chiffrement symétrique AES-256-CBC
    // =========================================================================

    /**
     * Chiffre une donnée en AES-256-CBC à partir d'une clé secrète dérivée par SHA-256.
     *
     * @param {any} data - Donnée à chiffrer (convertie en chaîne UTF-8).
     * @param {string} secretKey - Secret partagé servant à dériver la clé AES-256.
     * @returns {Promise<{type: string, iv: string, data: string}|null>} Objet chiffré, ou `null` si les paramètres sont invalides ou en cas d'erreur.
     *
     * @example <caption>Exemple 1 : Chiffrement symétrique d'une chaîne</caption>
     * const res = await NCrypto.encryptSymmetric('Secret', 'MotDePasseFort');
     *
     * @example <caption>Exemple 2 : Chiffrement symétrique d'un JSON sérialisé</caption>
     * const res = await NCrypto.encryptSymmetric(JSON.stringify({ id: 10 }), 'ClePartagee');
     * console.log(res?.type); // 'aes-256-cbc'
     */
    static async encryptSymmetric(data, secretKey) {
        if (data === null || data === undefined || !secretKey) {
            return null;
        }

        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.encryptSymmetric: Web Crypto indisponible.');
            return null;
        }

        try {
            const keyBytes = await NCrypto.sha256(secretKey, 'bytes');
            if (!keyBytes.length) {
                return null;
            }

            const key = await globalThis.crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-CBC', length: 256 },
                false,
                ['encrypt']
            );

            const iv = NCrypto.randomBytes(16);
            if (!iv.length) {
                return null;
            }

            const bytes = new TextEncoder().encode(String(data));

            const encrypted = await globalThis.crypto.subtle.encrypt(
                { name: 'AES-CBC', iv },
                key,
                bytes
            );

            return {
                type: 'aes-256-cbc',
                iv: NCrypto.bytesToBase64(iv),
                data: NCrypto.bytesToBase64(encrypted)
            };
        } catch (error) {
            NLog.error('NCrypto.encryptSymmetric', error);
            return null;
        }
    }

    /**
     * Déchiffre une charge produite par `encryptSymmetric()`.
     *
     * @param {Object|string} payload - Objet `{ type: 'aes-256-cbc', iv, data }` ou sa représentation JSON.
     * @param {string} secretKey - Secret partagé identique à celui utilisé pour le chiffrement.
     * @returns {Promise<string>} Texte en clair déchiffré, ou `''` si le déchiffrement échoue.
     *
     * @example <caption>Exemple 1 : Déchiffrement depuis l'objet retourné par encryptSymmetric</caption>
     * const plain = await NCrypto.decryptSymmetric(encryptedObj, 'MotDePasseFort');
     *
     * @example <caption>Exemple 2 : Déchiffrement depuis une chaîne JSON</caption>
     * const plain = await NCrypto.decryptSymmetric(JSON.stringify(encryptedObj), 'MotDePasseFort');
     */
    static async decryptSymmetric(payload, secretKey) {
        if (!payload || !secretKey) {
            return '';
        }

        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.decryptSymmetric: Web Crypto indisponible.');
            return '';
        }

        let parsed = payload;

        if (typeof payload === 'string') {
            try {
                parsed = JSON.parse(payload);
            } catch {
                return '';
            }
        }

        if (!parsed || typeof parsed !== 'object' || parsed.type !== 'aes-256-cbc' || !parsed.iv || !parsed.data) {
            return '';
        }

        try {
            const keyBytes = await NCrypto.sha256(secretKey, 'bytes');
            if (!keyBytes.length) {
                return '';
            }

            const key = await globalThis.crypto.subtle.importKey(
                'raw',
                keyBytes,
                { name: 'AES-CBC', length: 256 },
                false,
                ['decrypt']
            );

            const decrypted = await globalThis.crypto.subtle.decrypt(
                {
                    name: 'AES-CBC',
                    iv: NCrypto.base64ToBytes(parsed.iv)
                },
                key,
                NCrypto.base64ToBytes(parsed.data)
            );

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            NLog.error('NCrypto.decryptSymmetric', error);
            return '';
        }
    }

    // =========================================================================
    // Méthodes publiques — Chiffrement local AES-256-GCM (clé persistée en IDB)
    // =========================================================================

    /**
     * Chiffre localement une donnée (chaîne ou objet sérialisable en JSON) en AES-256-GCM
     * à l'aide d'une clé locale non exportable conservée dans IndexedDB (`NIndexedDB.instance`)
     * et d'un IV aléatoire de 96 bits.
     * Le résultat Base64 préfixe l'octet de version (`0x04`), l'IV de 12 octets et le texte chiffré authentifié.
     *
     * @param {any} data - Donnée à chiffrer localement.
     * @returns {Promise<string>} Chaîne Base64 versionnée (`0x04`), ou `''` en cas d'entrée vide, d'indisponibilité ou d'erreur.
     *
     * @example <caption>Exemple 1 : Chiffrer un objet localement sans fournir de clé</caption>
     * const token = await NCrypto.encryptLocal({ userId: 7, role: 'admin' });
     *
     * @example <caption>Exemple 2 : Chiffrer une chaîne de texte pour le stockage local</caption>
     * const cipher = await NCrypto.encryptLocal('Préférences confidentielles');
     */
    static async encryptLocal(data) {
        if (data === null || data === undefined || data === '') {
            return '';
        }

        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.encryptLocal: Web Crypto indisponible.');
            return '';
        }

        try {
            const plainText = typeof data === 'string'
                ? data
                : JSON.stringify(data);

            const bytes = new TextEncoder().encode(plainText);

            // Récupération automatique de la clé locale.
            const key = await NCrypto.#generateLocalKey();
            if (!key) {
                return '';
            }

            // Génération d'un IV aléatoire de 96 bits.
            const iv = NCrypto.randomBytes(12);
            if (iv.length !== 12) {
                return '';
            }

            const encrypted = await globalThis.crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv,
                    tagLength: 128
                },
                key,
                bytes
            );

            const cipherBytes = new Uint8Array(encrypted);
            const result = new Uint8Array(1 + iv.length + cipherBytes.length);

            // Version du format de chiffrement.
            result[0] = 0x04;

            result.set(iv, 1);
            result.set(cipherBytes, 13);

            return NCrypto.bytesToBase64(result);
        } catch (error) {
            NLog.error('NCrypto.encryptLocal: Échec du chiffrement local.', error);
            return '';
        }
    }

    /**
     * Déchiffre une donnée produite par `encryptLocal()` en vérifiant la version (`0x04`)
     * et l'authentification GCM.
     *
     * @param {string} encryptedData - Chaîne Base64 générée par `encryptLocal()`.
     * @returns {Promise<string>} Chaîne en clair déchiffrée, ou `''` si la donnée est invalide ou l'authentification échoue.
     *
     * @example <caption>Exemple 1 : Déchiffrer un objet JSON stocké localement</caption>
     * const raw = await NCrypto.decryptLocal(token);
     * const obj = raw ? JSON.parse(raw) : null;
     *
     * @example <caption>Exemple 2 : Déchiffrer une chaîne simple</caption>
     * const text = await NCrypto.decryptLocal(cipher);
     * console.log(text); // 'Préférences confidentielles'
     */
    static async decryptLocal(encryptedData) {
        if (typeof encryptedData !== 'string' || !encryptedData) {
            return '';
        }

        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.decryptLocal: Web Crypto indisponible.');
            return '';
        }

        const combined = NCrypto.base64ToBytes(encryptedData);

        if (
            combined.length < 30 ||
            combined[0] !== 0x04
        ) {
            return '';
        }

        try {
            // Récupération automatique de la même clé locale.
            const key = await NCrypto.#generateLocalKey();
            if (!key) {
                return '';
            }

            const iv = combined.slice(1, 13);
            const cipherBytes = combined.slice(13);

            const decrypted = await globalThis.crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv,
                    tagLength: 128
                },
                key,
                cipherBytes
            );

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            NLog.warn(
                'NCrypto.decryptLocal: Authentification échouée.',
                error
            );

            return '';
        }
    }

    // =========================================================================
    // Méthodes privées internes
    // =========================================================================

    /**
     * Vérifie qu'une clé est une `CryptoKey` AES-GCM valide avec usages `encrypt` et `decrypt`
     * et non extractible.
     * @private
     * @param {any} key - Clé candidate.
     * @returns {boolean}
     */
    static #isValidLocalKey(key) {
        return Boolean(
            key &&
            typeof key === 'object' &&
            key.type === 'secret' &&
            key.algorithm?.name === 'AES-GCM' &&
            key.extractable === false &&
            Array.isArray(key.usages) &&
            key.usages.includes('encrypt') &&
            key.usages.includes('decrypt')
        );
    }

    /**
     * Récupère ou génère la clé locale AES-256-GCM non exportable stockée dans IndexedDB
     * sous la clé `"n_local_key"` de la table `"ntable"`.
     * Sécurise les appels concurrents et vérifie la persistance effective avant de retourner la clé.
     *
     * @returns {Promise<CryptoKey|null>} Clé `CryptoKey` AES-GCM, ou `null` si Web Crypto ou le stockage échoue.
     * @private
     *
     * @example <caption>Exemple 1 : Récupération ou création automatique lors du chiffrement local</caption>
     * // Interne : const key = await NCrypto.#generateLocalKey();
     *
     * @example <caption>Exemple 2 : Réutilisation de la même clé lors du déchiffrement local</caption>
     * // Interne : const key = await NCrypto.#generateLocalKey(); // Lit "n_local_key" depuis "ntable"
     */
    static async #generateLocalKey() {
        if (!NCrypto.isWebCryptoAvailable()) {
            NLog.warn('NCrypto.#generateLocalKey: Web Crypto indisponible.');
            return null;
        }

        if (NCrypto.#localKeyPromise) {
            return await NCrypto.#localKeyPromise;
        }

        NCrypto.#localKeyPromise = (async () => {
            try {
                const existingRes = await NIndexedDB.instance.get('ntable', 'n_local_key');
                if (!existingRes || !existingRes.ok) {
                    NLog.error(
                        'NCrypto.#generateLocalKey: Impossible de lire la clé locale depuis IndexedDB.',
                        existingRes
                    );
                    return null;
                }

                if (existingRes.data) {
                    if (!NCrypto.#isValidLocalKey(existingRes.data)) {
                        NLog.error(
                            'NCrypto.#generateLocalKey: Clé locale stockée invalide ou extractible pour AES-GCM.'
                        );
                        return null;
                    }
                    return existingRes.data;
                }

                const newKey = await globalThis.crypto.subtle.generateKey(
                    {
                        name: 'AES-GCM',
                        length: 256
                    },
                    false,
                    ['encrypt', 'decrypt']
                );

                const putRes = await NIndexedDB.instance.put('ntable', newKey, 'n_local_key');
                if (!putRes || !putRes.ok) {
                    NLog.error(
                        'NCrypto.#generateLocalKey: Échec de persistance de la clé locale dans IndexedDB.',
                        putRes
                    );
                    return null;
                }

                return newKey;
            } catch (error) {
                NLog.error('NCrypto.#generateLocalKey: Échec de récupération ou création de la clé locale.', error);
                return null;
            } finally {
                NCrypto.#localKeyPromise = null;
            }
        })();

        return await NCrypto.#localKeyPromise;
    }
}

export default NCrypto;
