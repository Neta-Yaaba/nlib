/**
 * @file NCryptography.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la cryptographie asymétrique (RSA-OAEP), symétrique (AES-CBC / AES-GCM),
 * hybride (RSA + AES), le hachage (SHA-256) et l'encodage binaire/Base64 dans l'écosystème NLib.
 *
 * Conçue pour une interopérabilité totale avec les backends PHP (`openssl_private_decrypt` avec
 * `OPENSSL_PKCS1_OAEP_PADDING` + `openssl_decrypt('aes-256-cbc')`), Python (`cryptography` / `PyCryptodome`),
 * Node.js (`node:crypto`) et les OS natifs (Android, iOS, Windows, Linux, HarmonyOS).
 *
 * Intègre également un moteur de repli (Fallback Stream Cipher + SHA-256 pur JS) lorsque l'API
 * native `crypto.subtle` n'est pas disponible (ex: contexte HTTP non sécurisé ou WebView restreint).
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

import { NUtil } from './NUtil.js';

/**
 * @class NCryptography
 * @description Utilitaire de chiffrement, déchiffrement, gestion de clés PEM et hachage sans état interne.
 *
 * @example <caption>Exemple 1 : Génération de clés RSA, export/import PEM et chiffrement hybride (compatible PHP/Python)</caption>
 * const cryptoUtil = new NCryptography();
 * const keyPair = await cryptoUtil.generateKeyPair();
 * const publicPem = await cryptoUtil.exportPublicKeyToPem(keyPair.publicKey);
 * const importedPub = await cryptoUtil.importPublicKeyFromPem(publicPem);
 * const payload = await cryptoUtil.encrypt('Message confidentiel pour le serveur PHP', importedPub);
 * const clearText = await cryptoUtil.decrypt(payload, keyPair.privateKey);
 * console.log(clearText); // 'Message confidentiel pour le serveur PHP'
 *
 * @example <caption>Exemple 2 : Chiffrement local autonome (asynchrone AES-GCM ou synchrone pur JS)</caption>
 * const cryptoUtil = new NCryptography();
 * const cipherAsync = await cryptoUtil.encryptLocal('Données hors-ligne SQLite');
 * console.log(await cryptoUtil.decryptLocal(cipherAsync)); // 'Données hors-ligne SQLite'
 * const cipherSync = cryptoUtil.encryptLocalSync('Données locales synchrones');
 * console.log(cryptoUtil.decryptLocalSync(cipherSync));    // 'Données locales synchrones'
 *
 * @example <caption>Exemple 3 : Chiffrement symétrique interopérable (AES-256-CBC) et hachage SHA-256</caption>
 * const cryptoUtil = new NCryptography();
 * const hash = await cryptoUtil.sha256('MonSecret');
 * const encrypted = await cryptoUtil.encryptSymmetric('Texte secret', 'MaCleSecrete');
 * const decrypted = await cryptoUtil.decryptSymmetric(encrypted, 'MaCleSecrete');
 * console.log(decrypted); // 'Texte secret'
 */
export class NCryptography {

    // =========================================================================
    // Méthodes privées internes (Moteur de repli JS pur : SHA-256 & Stream Cipher)
    // =========================================================================

    /**
     * Implémentation purement JavaScript de SHA-256 (FIPS 180-4) utilisée comme alternative
     * lorsque `crypto.subtle.digest` n'est pas disponible.
     *
     * @param {Uint8Array} messageBytes - Octets du message à hacher.
     * @returns {Uint8Array} Condensat SHA-256 de 32 octets.
     *
     * @example <caption>Exemple 1 : Hachage interne</caption>
     * // Interne : #sha256Fallback(new Uint8Array([97, 98, 99])) -> Uint8Array(32)
     *
     * @example <caption>Exemple 2 : Dérivation de clé 256 bits</caption>
     * // Interne : #sha256Fallback(secretBytes) -> 32 octets
     */
    #sha256Fallback(messageBytes) {
        const K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];

        let h0 = 0x6a09e667;
        let h1 = 0xbb67ae85;
        let h2 = 0x3c6ef372;
        let h3 = 0xa54ff53a;
        let h4 = 0x510e527f;
        let h5 = 0x9b05688c;
        let h6 = 0x1f83d9ab;
        let h7 = 0x5be0cd19;

        const bitLength = messageBytes.length * 8;
        const paddedLength = Math.ceil((messageBytes.length + 9) / 64) * 64;
        const padded = new Uint8Array(paddedLength);
        padded.set(messageBytes);
        padded[messageBytes.length] = 0x80;

        const view = new DataView(padded.buffer);
        view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
        view.setUint32(paddedLength - 4, bitLength >>> 0, false);

        const W = new Uint32Array(64);
        const rotr = (n, x) => (x >>> n) | (x << (32 - n));

        for (let offset = 0; offset < paddedLength; offset += 64) {
            for (let i = 0; i < 16; i++) {
                W[i] = view.getUint32(offset + i * 4, false);
            }
            for (let i = 16; i < 64; i++) {
                const s0 = rotr(7, W[i - 15]) ^ rotr(18, W[i - 15]) ^ (W[i - 15] >>> 3);
                const s1 = rotr(17, W[i - 2]) ^ rotr(19, W[i - 2]) ^ (W[i - 2] >>> 10);
                W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
            }

            let a = h0;
            let b = h1;
            let c = h2;
            let d = h3;
            let e = h4;
            let f = h5;
            let g = h6;
            let h = h7;

            for (let i = 0; i < 64; i++) {
                const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
                const ch = (e & f) ^ (~e & g);
                const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
                const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (S0 + maj) >>> 0;

                h = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }

            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
            h5 = (h5 + f) >>> 0;
            h6 = (h6 + g) >>> 0;
            h7 = (h7 + h) >>> 0;
        }

        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        outView.setUint32(0, h0, false);
        outView.setUint32(4, h1, false);
        outView.setUint32(8, h2, false);
        outView.setUint32(12, h3, false);
        outView.setUint32(16, h4, false);
        outView.setUint32(20, h5, false);
        outView.setUint32(24, h6, false);
        outView.setUint32(28, h7, false);
        return out;
    }

    /**
     * Applique un chiffrement/déchiffrement symétrique par flot (KSA/PRGA 256 bits combiné à un IV)
     * en pur JavaScript. Utilisé comme alternative universelle (compatible PHP/Python) lorsque
     * `crypto.subtle` est indisponible.
     *
     * @param {Uint8Array} dataBytes - Octets à chiffrer ou déchiffrer.
     * @param {Uint8Array} keyBytes - Clé secrète.
     * @param {Uint8Array} ivBytes - Vecteur d'initialisation (nonce).
     * @returns {Uint8Array} Octets transformés.
     *
     * @example <caption>Exemple 1 : Chiffrement de repli</caption>
     * // Interne : #streamCipherFallback(data, key, iv)
     *
     * @example <caption>Exemple 2 : Déchiffrement symétrique (opération réversible)</caption>
     * // Interne : #streamCipherFallback(cipher, key, iv)
     */
    #streamCipherFallback(dataBytes, keyBytes, ivBytes) {
        const combinedKey = new Uint8Array(keyBytes.length + ivBytes.length);
        combinedKey.set(keyBytes, 0);
        combinedKey.set(ivBytes, keyBytes.length);
        const derivedKey = this.#sha256Fallback(combinedKey);

        const S = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            S[i] = i;
        }
        let j = 0;
        for (let i = 0; i < 256; i++) {
            j = (j + S[i] + derivedKey[i % derivedKey.length]) & 0xff;
            const tmp = S[i];
            S[i] = S[j];
            S[j] = tmp;
        }

        const result = new Uint8Array(dataBytes.length);
        let x = 0;
        let y = 0;
        for (let k = 0; k < dataBytes.length; k++) {
            x = (x + 1) & 0xff;
            y = (y + S[x]) & 0xff;
            const tmp = S[x];
            S[x] = S[y];
            S[y] = tmp;
            const rnd = S[(S[x] + S[y]) & 0xff];
            result[k] = dataBytes[k] ^ rnd;
        }
        return result;
    }

    /**
     * Construit à la volée (sans aucun stockage persistant) la signature matérielle et logicielle
     * stable du navigateur et de l'appareil courant.
     * Combine les informations de `NUtil.env`, `NUtil.sys`, `navigator`, `Intl` et `location.origin`.
     *
     * @returns {string} Chaîne brute d'empreinte du navigateur courant.
     *
     * @example <caption>Exemple 1 : Empreinte interne</caption>
     * // Interne : #buildBrowserFingerprintRaw()
     *
     * @example <caption>Exemple 2 : Toujours déterministe sur le même navigateur</caption>
     * // Interne : #buildBrowserFingerprintRaw() === #buildBrowserFingerprintRaw()
     */
    #buildBrowserFingerprintRaw() {
        const parts = ['nlib-browser-key-v1'];

        try {
            parts.push(
                String(NUtil.env?.os || 'unknown'),
                String(NUtil.env?.browser || 'unknown'),
                String(Boolean(NUtil.env?.isMobile)),
                String(Boolean(NUtil.env?.isTablet)),
                String(Boolean(NUtil.env?.isDesktop)),
                String(Boolean(NUtil.env?.isWebView)),
                String(NUtil.sys?.arch || 'unknown'),
                String(NUtil.sys?.cpuCores || 1),
                String(NUtil.sys?.deviceMemory ?? 'na')
            );
        } catch {
            // Ignore
        }

        if (typeof navigator !== 'undefined') {
            parts.push(
                String(navigator.userAgent || ''),
                String(navigator.platform || ''),
                String(navigator.vendor || ''),
                String(navigator.product || ''),
                String(navigator.productSub || ''),
                String(navigator.language || ''),
                String(Array.isArray(navigator.languages) ? navigator.languages.join(',') : ''),
                String(navigator.maxTouchPoints ?? 0),
                String(navigator.pdfViewerEnabled ?? ''),
                String(navigator.cookieEnabled ?? '')
            );

            if (navigator.userAgentData && typeof navigator.userAgentData === 'object') {
                const brands = Array.isArray(navigator.userAgentData.brands)
                    ? navigator.userAgentData.brands.map((b) => `${b.brand || ''}:${b.version || ''}`).join('|')
                    : '';
                parts.push(
                    String(navigator.userAgentData.platform || ''),
                    String(Boolean(navigator.userAgentData.mobile)),
                    brands
                );
            }
        }

        if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
            try {
                const resolved = Intl.DateTimeFormat().resolvedOptions();
                parts.push(
                    String(resolved?.timeZone || ''),
                    String(resolved?.calendar || ''),
                    String(resolved?.numberingSystem || '')
                );
            } catch {
                // Ignore
            }
        }

        if (typeof globalThis !== 'undefined' && globalThis.location) {
            parts.push(String(globalThis.location.origin || globalThis.location.host || ''));
        }

        return parts.join('||');
    }

    /**
     * Dérive à la volée une clé cryptographique de 256 bits (`Uint8Array` de 32 octets)
     * exclusivement à partir des informations intrinsèques du navigateur courant,
     * sans jamais stocker de clé en persistance ni l'embarquer dans les données chiffrées.
     *
     * @returns {Uint8Array} Clé de 32 octets propre au navigateur courant.
     *
     * @example <caption>Exemple 1 : Clé 256 bits du navigateur</caption>
     * // Interne : #getBrowserKeyBytes() -> Uint8Array(32)
     *
     * @example <caption>Exemple 2 : Identique à chaque appel dans le même navigateur</caption>
     * // Interne : #getBrowserKeyBytes()
     */
    #getBrowserKeyBytes() {
        const rawFingerprint = this.#buildBrowserFingerprintRaw();
        const rawBytes = new TextEncoder().encode(rawFingerprint);
        return this.#sha256Fallback(rawBytes);
    }

    /**
     * Vérifie en temps constant si deux tableaux d'octets (`Uint8Array`) sont strictement identiques.
     *
     * @param {Uint8Array} a - Premier tableau d'octets.
     * @param {Uint8Array} b - Second tableau d'octets.
     * @returns {boolean} `true` si identiques.
     */
    #timingSafeEqualBytes(a, b) {
        if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length || a.length === 0) {
            return false;
        }
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a[i] ^ b[i];
        }
        return diff === 0;
    }

    // =========================================================================
    // Méthodes publiques — Détection d'Environnement & Aléatoire Cryptographique
    // =========================================================================

    /**
     * Vérifie si l'API native Web Crypto (`crypto.subtle`) est disponible dans l'environnement d'exécution actuel.
     *
     * @returns {boolean} `true` si `crypto.subtle` est disponible, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier la disponibilité de Web Crypto</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(cryptoUtil.isWebCryptoAvailable()); // true (HTTPS / localhost / Node.js)
     *
     * @example <caption>Exemple 2 : Choisir dynamiquement une stratégie</caption>
     * const cryptoUtil = new NCryptography();
     * const mode = cryptoUtil.isWebCryptoAvailable() ? 'native' : 'fallback';
     */
    isWebCryptoAvailable() {
        return (
            typeof globalThis !== 'undefined' &&
            typeof globalThis.crypto !== 'undefined' &&
            typeof globalThis.crypto.subtle !== 'undefined'
        );
    }

    /**
     * Génère un tableau d'octets aléatoires (`Uint8Array`) de la longueur demandée.
     * Utilise `crypto.getRandomValues` si disponible, ou un générateur de repli horodaté.
     *
     * @param {number} [length=16] - Nombre d'octets aléatoires à générer.
     * @returns {Uint8Array} Tableau d'octets aléatoires.
     *
     * @example <caption>Exemple 1 : Générer un IV de 16 octets pour AES-CBC</caption>
     * const cryptoUtil = new NCryptography();
     * const iv = cryptoUtil.randomBytes(16);
     * console.log(iv.length); // 16
     *
     * @example <caption>Exemple 2 : Générer une clé brute de 32 octets (256 bits)</caption>
     * const cryptoUtil = new NCryptography();
     * const rawKey = cryptoUtil.randomBytes(32);
     * console.log(rawKey.length); // 32
     */
    randomBytes(length = 16) {
        const size = Math.max(1, Math.trunc(length));
        const bytes = new Uint8Array(size);
        if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
            try {
                globalThis.crypto.getRandomValues(bytes);
                return bytes;
            } catch (err) {
                NUtil.log.warn('NCryptography.randomBytes: Échec crypto.getRandomValues, repli pseudo-aléatoire.', {
                    code: 'WARN_CRYPTO_RANDOM_FALLBACK',
                    cause: err
                });
            }
        }
        for (let i = 0; i < size; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    }

    // =========================================================================
    // Méthodes publiques — Conversions Binaires, Base64 & Hexadécimal
    // =========================================================================

    /**
     * Convertit un `Uint8Array` (ou `ArrayBuffer`) en chaîne Base64 par blocs de 32 Ko
     * afin d'éviter toute erreur `Maximum call stack size exceeded` sur les données volumineuses.
     *
     * @param {Uint8Array|ArrayBuffer} bytes - Données binaires à encoder.
     * @returns {string} Chaîne encodée en Base64.
     *
     * @example <caption>Exemple 1 : Encoder un Uint8Array en Base64</caption>
     * const cryptoUtil = new NCryptography();
     * const b64 = cryptoUtil.bytesToBase64(new Uint8Array([78, 76, 105, 98]));
     * console.log(b64); // 'TkxpYg=='
     *
     * @example <caption>Exemple 2 : Encoder un bloc aléatoire</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(typeof cryptoUtil.bytesToBase64(cryptoUtil.randomBytes(32))); // 'string'
     */
    bytesToBase64(bytes) {
        const u8Arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
        if (!(u8Arr instanceof Uint8Array) || u8Arr.length === 0) {
            return '';
        }
        const chunkSize = 0x8000; // 32 KB
        let binary = '';
        for (let i = 0; i < u8Arr.length; i += chunkSize) {
            const chunk = u8Arr.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
    }

    /**
     * Convertit une chaîne Base64 en `Uint8Array`.
     *
     * @param {string} base64 - Chaîne Base64 à décoder.
     * @returns {Uint8Array} Tableau d'octets décodé (vide si invalide).
     *
     * @example <caption>Exemple 1 : Décoder du Base64 en Uint8Array</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(Array.from(cryptoUtil.base64ToBytes('TkxpYg=='))); // [78, 76, 105, 98]
     *
     * @example <caption>Exemple 2 : Chaîne vide ou invalide</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(cryptoUtil.base64ToBytes('').length); // 0
     */
    base64ToBytes(base64) {
        if (typeof base64 !== 'string' || base64.trim().length === 0) {
            return new Uint8Array(0);
        }
        try {
            const clean = base64.replace(/\s+/g, '');
            const binary = atob(clean);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        } catch (err) {
            NUtil.log.warn('NCryptography.base64ToBytes: Échec du décodage Base64.', {
                code: 'ERR_BASE64_DECODE',
                cause: err
            });
            return new Uint8Array(0);
        }
    }

    /**
     * Encode une chaîne de caractères UTF-8 directement en Base64.
     *
     * @param {string} text - Texte UTF-8 à encoder.
     * @returns {string} Chaîne Base64.
     *
     * @example <caption>Exemple 1 : Encoder un texte avec accents</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(cryptoUtil.encodeBase64('Écosystème NLib')); // 'w4ljb3N5c3TDqG1lIE5MaWI='
     *
     * @example <caption>Exemple 2 : Décoder ensuite avec decodeBase64</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(cryptoUtil.decodeBase64('w4ljb3N5c3TDqG1lIE5MaWI=')); // 'Écosystème NLib'
     */
    encodeBase64(text) {
        if (typeof text !== 'string' || text.length === 0) {
            return '';
        }
        return this.bytesToBase64(new TextEncoder().encode(text));
    }

    /**
     * Décode une chaîne Base64 en texte UTF-8.
     *
     * @param {string} base64 - Chaîne Base64 à décoder.
     * @returns {string} Texte UTF-8 décodé.
     *
     * @example <caption>Exemple 1 : Décoder une chaîne Base64</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(cryptoUtil.decodeBase64('TkxpYg==')); // 'NLib'
     *
     * @example <caption>Exemple 2 : Entrée invalide retourne une chaîne vide</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(cryptoUtil.decodeBase64(null)); // ''
     */
    decodeBase64(base64) {
        const bytes = this.base64ToBytes(base64);
        return bytes.length > 0 ? new TextDecoder().decode(bytes) : '';
    }

    // =========================================================================
    // Méthodes publiques — Hachage Cryptographique (SHA-256)
    // =========================================================================

    /**
     * Calcule l'empreinte SHA-256 d'un texte ou d'un `Uint8Array` (utilise `crypto.subtle.digest`
     * ou le moteur SHA-256 pur JS en repli).
     *
     * @param {string|Uint8Array} data - Données à hacher.
     * @param {'hex'|'base64'|'bytes'} [outputFormat='hex'] - Format de sortie (`'hex'`, `'base64'` ou `'bytes'`).
     * @returns {Promise<string|Uint8Array>} Empreinte SHA-256.
     *
     * @example <caption>Exemple 1 : Empreinte SHA-256 en hexadécimal</caption>
     * const cryptoUtil = new NCryptography();
     * const hash = await cryptoUtil.sha256('NLib');
     * console.log(hash.length); // 64
     *
     * @example <caption>Exemple 2 : Empreinte SHA-256 en Base64</caption>
     * const cryptoUtil = new NCryptography();
     * const hashB64 = await cryptoUtil.sha256('NLib', 'base64');
     * console.log(typeof hashB64); // 'string'
     */
    async sha256(data, outputFormat = 'hex') {
        const inputBytes = data instanceof Uint8Array
            ? data
            : new TextEncoder().encode(String(data ?? ''));

        let digestBytes;
        if (this.isWebCryptoAvailable() && typeof globalThis.crypto.subtle.digest === 'function') {
            try {
                const buffer = await globalThis.crypto.subtle.digest('SHA-256', inputBytes);
                digestBytes = new Uint8Array(buffer);
            } catch (err) {
                NUtil.log.warn('NCryptography.sha256: Échec crypto.subtle.digest, bascule sur le moteur SHA-256 pur JS.', {
                    code: 'WARN_CRYPTO_DIGEST_FALLBACK',
                    cause: err
                });
                digestBytes = this.#sha256Fallback(inputBytes);
            }
        } else {
            digestBytes = this.#sha256Fallback(inputBytes);
        }

        if (outputFormat === 'bytes') {
            return digestBytes;
        }
        if (outputFormat === 'base64') {
            return this.bytesToBase64(digestBytes);
        }
        return Array.from(digestBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Calcule de manière totalement **synchrone** l'empreinte SHA-256 d'un texte ou d'un `Uint8Array`
     * en utilisant directement le moteur SHA-256 pur JS (ignore `crypto.subtle`).
     *
     * @param {string|Uint8Array} data - Données à hacher.
     * @param {'hex'|'base64'|'bytes'} [outputFormat='hex'] - Format de sortie (`'hex'`, `'base64'` ou `'bytes'`).
     * @returns {string|Uint8Array} Empreinte SHA-256 synchrone.
     *
     * @example <caption>Exemple 1 : Empreinte SHA-256 synchrone en hexadécimal</caption>
     * const cryptoUtil = new NCryptography();
     * const hash = cryptoUtil.sha256Sync('NLib');
     * console.log(hash.length); // 64
     *
     * @example <caption>Exemple 2 : Empreinte SHA-256 synchrone en octets (Uint8Array 32 octets)</caption>
     * const cryptoUtil = new NCryptography();
     * const keyBytes = cryptoUtil.sha256Sync('MonSecret', 'bytes');
     * console.log(keyBytes.length); // 32
     */
    sha256Sync(data, outputFormat = 'hex') {
        const inputBytes = data instanceof Uint8Array
            ? data
            : new TextEncoder().encode(String(data ?? ''));

        const digestBytes = this.#sha256Fallback(inputBytes);

        if (outputFormat === 'bytes') {
            return digestBytes;
        }
        if (outputFormat === 'base64') {
            return this.bytesToBase64(digestBytes);
        }
        return Array.from(digestBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Calcule de manière **synchrone** une signature HMAC-SHA256 en pur JavaScript.
     *
     * @param {string|Uint8Array} key - Clé secrète HMAC.
     * @param {string|Uint8Array} data - Données à signer.
     * @param {'hex'|'base64'|'bytes'} [outputFormat='bytes'] - Format de sortie (`'bytes'`, `'hex'` ou `'base64'`).
     * @returns {Uint8Array|string} Signature HMAC-SHA256 de 32 octets (ou chaîne `'hex'` / `'base64'`).
     *
     * @example <caption>Exemple 1 : Signature HMAC-SHA256 en octets</caption>
     * const cryptoUtil = new NCryptography();
     * const mac = cryptoUtil.hmacSha256Sync('MaCleSecrete', 'Message');
     * console.log(mac.length); // 32
     *
     * @example <caption>Exemple 2 : Signature HMAC-SHA256 en hexadécimal</caption>
     * const cryptoUtil = new NCryptography();
     * const macHex = cryptoUtil.hmacSha256Sync('MaCleSecrete', 'Message', 'hex');
     * console.log(macHex.length); // 64
     */
    hmacSha256Sync(key, data, outputFormat = 'bytes') {
        const keyBytes = key instanceof Uint8Array
            ? key
            : new TextEncoder().encode(String(key ?? ''));
        const dataBytes = data instanceof Uint8Array
            ? data
            : new TextEncoder().encode(String(data ?? ''));

        const blockSize = 64;
        const normalizedKey = keyBytes.length > blockSize
            ? this.#sha256Fallback(keyBytes)
            : keyBytes;

        const ipad = new Uint8Array(blockSize + dataBytes.length);
        const opad = new Uint8Array(blockSize + 32);

        for (let i = 0; i < blockSize; i++) {
            const k = i < normalizedKey.length ? normalizedKey[i] : 0;
            ipad[i] = k ^ 0x36;
            opad[i] = k ^ 0x5c;
        }
        ipad.set(dataBytes, blockSize);
        const innerHash = this.#sha256Fallback(ipad);
        opad.set(innerHash, blockSize);
        const macBytes = this.#sha256Fallback(opad);

        if (outputFormat === 'hex') {
            return Array.from(macBytes)
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');
        }
        if (outputFormat === 'base64') {
            return this.bytesToBase64(macBytes);
        }
        return macBytes;
    }

    // =========================================================================
    // Méthodes publiques — Gestion des Clés RSA-OAEP & Format PEM (PHP / Python)
    // =========================================================================

    /**
     * Génère une paire de clés asymétriques RSA-OAEP (`publicKey` et `privateKey`).
     * Par défaut configurée en `4096` bits avec hachage `'SHA-1'` pour une compatibilité directe
     * avec la constante `OPENSSL_PKCS1_OAEP_PADDING` de PHP (`openssl_private_decrypt`).
     *
     * @param {Object} [options={}] - Options de génération RSA.
     * @param {number} [options.modulusLength=4096] - Taille de la clé en bits (`2048` ou `4096`).
     * @param {'SHA-1'|'SHA-256'} [options.hash='SHA-1'] - Algorithme de hachage OAEP (`'SHA-1'` pour PHP standard, `'SHA-256'` pour Python/Node personnalisés).
     * @returns {Promise<CryptoKeyPair|null>} Paire `{ publicKey, privateKey }` ou `null` si Web Crypto est absent.
     *
     * @example <caption>Exemple 1 : Générer une paire RSA-OAEP 4096 bits compatible PHP</caption>
     * const cryptoUtil = new NCryptography();
     * const keyPair = await cryptoUtil.generateKeyPair();
     * console.log(keyPair !== null);
     *
     * @example <caption>Exemple 2 : Générer une paire RSA-OAEP 2048 bits avec SHA-256</caption>
     * const cryptoUtil = new NCryptography();
     * const keyPair = await cryptoUtil.generateKeyPair({ modulusLength: 2048, hash: 'SHA-256' });
     */
    async generateKeyPair(options = {}) {
        if (!this.isWebCryptoAvailable() || typeof globalThis.crypto.subtle.generateKey !== 'function') {
            NUtil.log.warn('NCryptography.generateKeyPair: Web Crypto API non disponible dans cet environnement.', {
                code: 'WARN_CRYPTO_UNAVAILABLE'
            });
            return null;
        }
        const modulusLength = options?.modulusLength ?? 4096;
        const hash = options?.hash ?? 'SHA-1';

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
        } catch (err) {
            NUtil.log.error('NCryptography.generateKeyPair: Échec de génération de la paire de clés RSA.', {
                code: 'ERR_CRYPTO_GENERATE_KEY',
                cause: err
            });
            return null;
        }
    }

    /**
     * Exporte une clé publique `CryptoKey` au format standard PEM (`-----BEGIN PUBLIC KEY-----`),
     * directement lisible par PHP (`openssl_pkey_get_public`) et Python (`serialization.load_pem_public_key`).
     *
     * @param {CryptoKey} publicKey - Clé publique RSA à exporter.
     * @returns {Promise<string>} Clé publique au format PEM, ou `''` si indisponible.
     *
     * @example <caption>Exemple 1 : Exporter une clé publique en PEM</caption>
     * const cryptoUtil = new NCryptography();
     * const keyPair = await cryptoUtil.generateKeyPair({ modulusLength: 2048 });
     * const pem = await cryptoUtil.exportPublicKeyToPem(keyPair.publicKey);
     * console.log(pem.startsWith('-----BEGIN PUBLIC KEY-----')); // true
     *
     * @example <caption>Exemple 2 : Clé invalide retourne une chaîne vide</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(await cryptoUtil.exportPublicKeyToPem(null)); // ''
     */
    async exportPublicKeyToPem(publicKey) {
        if (!publicKey || !this.isWebCryptoAvailable() || typeof globalThis.crypto.subtle.exportKey !== 'function') {
            return '';
        }
        try {
            const spkiBuffer = await globalThis.crypto.subtle.exportKey('spki', publicKey);
            const b64 = this.bytesToBase64(spkiBuffer);
            const formattedB64 = (b64.match(/.{1,64}/g) || []).join('\n');
            return `-----BEGIN PUBLIC KEY-----\n${formattedB64}\n-----END PUBLIC KEY-----`;
        } catch (err) {
            NUtil.log.error('NCryptography.exportPublicKeyToPem: Échec de l\'export de la clé publique RSA.', {
                code: 'ERR_CRYPTO_EXPORT_KEY',
                cause: err
            });
            return '';
        }
    }

    /**
     * Exporte une clé privée `CryptoKey` au format standard PKCS#8 PEM (`-----BEGIN PRIVATE KEY-----`),
     * directement lisible par PHP (`openssl_pkey_get_private`) et Python (`serialization.load_pem_private_key`).
     *
     * @param {CryptoKey} privateKey - Clé privée RSA à exporter.
     * @returns {Promise<string>} Clé privée au format PEM, ou `''` si indisponible.
     *
     * @example <caption>Exemple 1 : Exporter une clé privée en PEM</caption>
     * const cryptoUtil = new NCryptography();
     * const keyPair = await cryptoUtil.generateKeyPair({ modulusLength: 2048 });
     * const pem = await cryptoUtil.exportPrivateKeyToPem(keyPair.privateKey);
     * console.log(pem.startsWith('-----BEGIN PRIVATE KEY-----')); // true
     *
     * @example <caption>Exemple 2 : Clé nulle retourne une chaîne vide</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(await cryptoUtil.exportPrivateKeyToPem(null)); // ''
     */
    async exportPrivateKeyToPem(privateKey) {
        if (!privateKey || !this.isWebCryptoAvailable() || typeof globalThis.crypto.subtle.exportKey !== 'function') {
            return '';
        }
        try {
            const pkcs8Buffer = await globalThis.crypto.subtle.exportKey('pkcs8', privateKey);
            const b64 = this.bytesToBase64(pkcs8Buffer);
            const formattedB64 = (b64.match(/.{1,64}/g) || []).join('\n');
            return `-----BEGIN PRIVATE KEY-----\n${formattedB64}\n-----END PRIVATE KEY-----`;
        } catch (err) {
            NUtil.log.error('NCryptography.exportPrivateKeyToPem: Échec de l\'export de la clé privée RSA.', {
                code: 'ERR_CRYPTO_EXPORT_KEY',
                cause: err
            });
            return '';
        }
    }

    /**
     * Importe une clé publique RSA depuis une chaîne PEM (`-----BEGIN PUBLIC KEY-----`)
     * envoyée par un serveur PHP, Python ou Node.js.
     *
     * @param {string} pemKey - Clé publique au format PEM.
     * @param {'SHA-1'|'SHA-256'} [hash='SHA-1'] - Algorithme de hachage OAEP (`'SHA-1'` par défaut pour PHP).
     * @returns {Promise<CryptoKey|null>} Instance `CryptoKey` utilisable pour `encrypt()`, ou `null`.
     *
     * @example <caption>Exemple 1 : Importer la clé publique PEM du serveur</caption>
     * const cryptoUtil = new NCryptography();
     * const serverPubKey = await cryptoUtil.importPublicKeyFromPem(serverPemString);
     *
     * @example <caption>Exemple 2 : Importer avec SHA-256</caption>
     * const cryptoUtil = new NCryptography();
     * const pubKey256 = await cryptoUtil.importPublicKeyFromPem(serverPemString, 'SHA-256');
     */
    async importPublicKeyFromPem(pemKey, hash = 'SHA-1') {
        if (typeof pemKey !== 'string' || !this.isWebCryptoAvailable() || typeof globalThis.crypto.subtle.importKey !== 'function') {
            return null;
        }
        try {
            const cleanPem = pemKey
                .replace(/-----BEGIN PUBLIC KEY-----/g, '')
                .replace(/-----END PUBLIC KEY-----/g, '')
                .replace(/\s+/g, '');
            const binaryDer = this.base64ToBytes(cleanPem);
            if (binaryDer.length === 0) {
                NUtil.log.warn('NCryptography.importPublicKeyFromPem: Données DER vides après nettoyage PEM.', {
                    code: 'ERR_CRYPTO_INVALID_PEM'
                });
                return null;
            }
            return await globalThis.crypto.subtle.importKey(
                'spki',
                binaryDer,
                { name: 'RSA-OAEP', hash },
                true,
                ['encrypt']
            );
        } catch (err) {
            NUtil.log.error('NCryptography.importPublicKeyFromPem: Clé publique PEM invalide ou non supportée.', {
                code: 'ERR_CRYPTO_IMPORT_KEY',
                cause: err
            });
            return null;
        }
    }

    /**
     * Importe une clé privée RSA depuis une chaîne PKCS#8 PEM (`-----BEGIN PRIVATE KEY-----`).
     *
     * @param {string} pemKey - Clé privée au format PEM.
     * @param {'SHA-1'|'SHA-256'} [hash='SHA-1'] - Algorithme de hachage OAEP.
     * @returns {Promise<CryptoKey|null>} Instance `CryptoKey` utilisable pour `decrypt()`, ou `null`.
     *
     * @example <caption>Exemple 1 : Importer une clé privée PEM</caption>
     * const cryptoUtil = new NCryptography();
     * const privKey = await cryptoUtil.importPrivateKeyFromPem(privatePemString);
     *
     * @example <caption>Exemple 2 : PEM invalide retourne null</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(await cryptoUtil.importPrivateKeyFromPem('invalide')); // null
     */
    async importPrivateKeyFromPem(pemKey, hash = 'SHA-1') {
        if (typeof pemKey !== 'string' || !this.isWebCryptoAvailable() || typeof globalThis.crypto.subtle.importKey !== 'function') {
            return null;
        }
        try {
            const cleanPem = pemKey
                .replace(/-----BEGIN PRIVATE KEY-----/g, '')
                .replace(/-----END PRIVATE KEY-----/g, '')
                .replace(/\s+/g, '');
            const binaryDer = this.base64ToBytes(cleanPem);
            if (binaryDer.length === 0) {
                NUtil.log.warn('NCryptography.importPrivateKeyFromPem: Données DER vides après nettoyage PEM.', {
                    code: 'ERR_CRYPTO_INVALID_PEM'
                });
                return null;
            }
            return await globalThis.crypto.subtle.importKey(
                'pkcs8',
                binaryDer,
                { name: 'RSA-OAEP', hash },
                true,
                ['decrypt']
            );
        } catch (err) {
            NUtil.log.error('NCryptography.importPrivateKeyFromPem: Clé privée PEM invalide ou non supportée.', {
                code: 'ERR_CRYPTO_IMPORT_KEY',
                cause: err
            });
            return null;
        }
    }

    // =========================================================================
    // Méthodes publiques — Chiffrement & Déchiffrement Asymétrique / Hybride (Serveur PHP/Python)
    // =========================================================================

    /**
     * Chiffre des données à destination d'un serveur (PHP, Python, Node.js) ou d'un pair.
     *
     * Stratégie adaptative à 3 niveaux :
     * 1. **Asymétrique direct (`type: 'asymmetric'`)** : Si `publicKey` est fournie et que les données <= 256 octets, chiffre directement avec `RSA-OAEP`.
     * 2. **Hybride (`type: 'hybrid'`)** : Si `publicKey` est fournie et que les données > 256 octets, chiffre le contenu en `AES-256-CBC` avec un IV aléatoire de 16 octets, puis chiffre la clé AES avec `RSA-OAEP`.
     * 3. **Alternative de repli (`type: 'nlib-fallback'` ou `'nlib'`)** : Si `crypto.subtle` est indisponible, utilise le chiffrement par flot avec secret partagé (`fallbackSecret`) ou l'encodage enveloppé `'nlib'`.
     *
     * @param {string|Object} data - Chaîne ou objet JSON à chiffrer.
     * @param {CryptoKey|string|null} [publicKey=null] - Clé publique RSA (`CryptoKey` ou chaîne PEM).
     * @param {Object} [options={}] - Options supplémentaires.
     * @param {string} [options.fallbackSecret=''] - Secret partagé optionnel pour chiffrer si `crypto.subtle` est absent.
     * @param {'SHA-1'|'SHA-256'} [options.hash='SHA-1'] - Hash OAEP si `publicKey` est fournie sous forme de chaîne PEM.
     * @returns {Promise<{ type: string, data: string, key?: string, iv?: string }>} Enveloppe chiffrée sérialisable en JSON.
     *
     * @example <caption>Exemple 1 : Chiffrer un message avec la clé publique du serveur</caption>
     * const cryptoUtil = new NCryptography();
     * const envelope = await cryptoUtil.encrypt('Données sensibles', serverPublicKey);
     * // { type: 'asymmetric', data: '...' } ou { type: 'hybrid', key: '...', iv: '...', data: '...' }
     *
     * @example <caption>Exemple 2 : Chiffrer directement avec une clé PEM et secret de repli</caption>
     * const cryptoUtil = new NCryptography();
     * const envelope = await cryptoUtil.encrypt('Payload', pemString, { fallbackSecret: 'ClePartagee' });
     */
    async encrypt(data, publicKey = null, options = {}) {
        if (data === null || data === undefined || data === '') {
            return {};
        }
        const plainString = typeof data === 'string' ? data : JSON.stringify(data);
        const textBytes = new TextEncoder().encode(plainString);

        let resolvedKey = publicKey;
        if (typeof publicKey === 'string' && publicKey.includes('BEGIN PUBLIC KEY')) {
            resolvedKey = await this.importPublicKeyFromPem(publicKey, options?.hash ?? 'SHA-1');
        }

        if (this.isWebCryptoAvailable() && resolvedKey) {
            try {
                if (textBytes.length > 256) {
                    const aesKey = await globalThis.crypto.subtle.generateKey(
                        { name: 'AES-CBC', length: 256 },
                        true,
                        ['encrypt']
                    );
                    const iv = this.randomBytes(16);
                    const encryptedData = await globalThis.crypto.subtle.encrypt(
                        { name: 'AES-CBC', iv },
                        aesKey,
                        textBytes
                    );
                    const rawAesKey = await globalThis.crypto.subtle.exportKey('raw', aesKey);
                    const encryptedAesKey = await globalThis.crypto.subtle.encrypt(
                        { name: 'RSA-OAEP' },
                        resolvedKey,
                        rawAesKey
                    );

                    return {
                        type: 'hybrid',
                        key: this.bytesToBase64(encryptedAesKey),
                        iv: this.bytesToBase64(iv),
                        data: this.bytesToBase64(encryptedData)
                    };
                }

                const encryptedData = await globalThis.crypto.subtle.encrypt(
                    { name: 'RSA-OAEP' },
                    resolvedKey,
                    textBytes
                );

                return {
                    type: 'asymmetric',
                    data: this.bytesToBase64(encryptedData)
                };
            } catch (err) {
                NUtil.log.warn('NCryptography.encrypt: Échec du chiffrement WebCrypto RSA, bascule sur l\'alternative de repli.', {
                    code: 'WARN_CRYPTO_ENCRYPT_FALLBACK',
                    cause: err
                });
            }
        }

        // Alternative si Web Crypto est absent ou si aucune clé RSA n'est fournie
        if (typeof options?.fallbackSecret === 'string' && options.fallbackSecret.length > 0) {
            const iv = this.randomBytes(16);
            const keyBytes = new TextEncoder().encode(options.fallbackSecret);
            const cipherBytes = this.#streamCipherFallback(textBytes, keyBytes, iv);
            return {
                type: 'nlib-fallback',
                iv: this.bytesToBase64(iv),
                data: this.bytesToBase64(cipherBytes)
            };
        }

        return {
            type: 'nlib',
            data: this.bytesToBase64(textBytes)
        };
    }

    /**
     * Déchiffre une enveloppe générée par `encrypt()` (ou envoyée par un serveur PHP / Python au même format).
     * Supporte les types `'hybrid'`, `'asymmetric'`, `'nlib-fallback'` et `'nlib'`.
     *
     * @param {Object|string} encryptedPayload - Objet enveloppe `{ type, data, key?, iv? }` ou chaîne JSON.
     * @param {CryptoKey|string|null} [privateKey=null] - Clé privée RSA (`CryptoKey` ou chaîne PEM).
     * @param {Object} [options={}] - Options supplémentaires.
     * @param {string} [options.fallbackSecret=''] - Secret partagé si le paquet est de type `'nlib-fallback'`.
     * @param {'SHA-1'|'SHA-256'} [options.hash='SHA-1'] - Hash OAEP si `privateKey` est en PEM.
     * @returns {Promise<string>} Texte déchiffré en clair, ou `''` en cas d'échec.
     *
     * @example <caption>Exemple 1 : Déchiffrer une enveloppe hybride ou asymétrique</caption>
     * const cryptoUtil = new NCryptography();
     * const clear = await cryptoUtil.decrypt(envelope, keyPair.privateKey);
     *
     * @example <caption>Exemple 2 : Déchiffrer une chaîne JSON reçue du réseau</caption>
     * const cryptoUtil = new NCryptography();
     * const clear = await cryptoUtil.decrypt(jsonResponseString, privatePemString);
     */
    async decrypt(encryptedPayload, privateKey = null, options = {}) {
        if (!encryptedPayload) {
            return '';
        }

        let payload = encryptedPayload;
        if (typeof encryptedPayload === 'string') {
            try {
                payload = JSON.parse(encryptedPayload);
            } catch (err) {
                NUtil.log.warn('NCryptography.decrypt: Format d\'enveloppe JSON invalide.', {
                    code: 'ERR_CRYPTO_PAYLOAD_JSON',
                    cause: err
                });
                return '';
            }
        }
        if (typeof payload !== 'object' || !payload.data) {
            return '';
        }

        if (payload.type === 'nlib') {
            return this.decodeBase64(payload.data);
        }

        if (payload.type === 'nlib-fallback') {
            const secret = options?.fallbackSecret ?? '';
            const iv = this.base64ToBytes(payload.iv || '');
            const cipherBytes = this.base64ToBytes(payload.data);
            const keyBytes = new TextEncoder().encode(secret);
            const plainBytes = this.#streamCipherFallback(cipherBytes, keyBytes, iv);
            return new TextDecoder().decode(plainBytes);
        }

        let resolvedKey = privateKey;
        if (typeof privateKey === 'string' && privateKey.includes('BEGIN PRIVATE KEY')) {
            resolvedKey = await this.importPrivateKeyFromPem(privateKey, options?.hash ?? 'SHA-1');
        }

        if (!this.isWebCryptoAvailable() || !resolvedKey) {
            return '';
        }

        try {
            if (payload.type === 'hybrid') {
                const encryptedAesKey = this.base64ToBytes(payload.key);
                const rawAesKey = await globalThis.crypto.subtle.decrypt(
                    { name: 'RSA-OAEP' },
                    resolvedKey,
                    encryptedAesKey
                );
                const importedAesKey = await globalThis.crypto.subtle.importKey(
                    'raw',
                    rawAesKey,
                    { name: 'AES-CBC', length: 256 },
                    false,
                    ['decrypt']
                );
                const iv = this.base64ToBytes(payload.iv);
                const encryptedContent = this.base64ToBytes(payload.data);
                const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
                    { name: 'AES-CBC', iv },
                    importedAesKey,
                    encryptedContent
                );
                return new TextDecoder().decode(decryptedBuffer);
            }

            const encryptedContent = this.base64ToBytes(payload.data);
            const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
                { name: 'RSA-OAEP' },
                resolvedKey,
                encryptedContent
            );
            return new TextDecoder().decode(decryptedBuffer);
        } catch (err) {
            NUtil.log.error('NCryptography.decrypt: Échec du déchiffrement asymétrique/hybride.', {
                code: 'ERR_CRYPTO_DECRYPT',
                cause: err
            });
            return '';
        }
    }

    // =========================================================================
    // Méthodes publiques — Chiffrement Symétrique Interopérable (AES-256-CBC / PHP / Python)
    // =========================================================================

    /**
     * Chiffre des données avec une clé secrète partagée en utilisant `AES-256-CBC`
     * (la clé est dérivée en 256 bits via `SHA-256`). Directement déchiffrable en PHP avec
     * `openssl_decrypt($data, 'aes-256-cbc', hash('sha256', $secret, true), OPENSSL_RAW_DATA, $iv)`.
     * Bascule automatiquement sur le chiffrement de repli si `crypto.subtle` est indisponible.
     *
     * @param {string} data - Texte à chiffrer.
     * @param {string} secretKey - Mot de passe ou clé secrète partagée.
     * @returns {Promise<{ type: string, iv: string, data: string }|null>} Objet `{ type, iv, data }` en Base64.
     *
     * @example <caption>Exemple 1 : Chiffrer avec une clé secrète partagée</caption>
     * const cryptoUtil = new NCryptography();
     * const enc = await cryptoUtil.encryptSymmetric('Message secret', 'ClePartageePHP');
     * console.log(enc.type); // 'aes-256-cbc' (ou 'nlib-fallback')
     *
     * @example <caption>Exemple 2 : Déchiffrer ensuite avec decryptSymmetric</caption>
     * const cryptoUtil = new NCryptography();
     * const enc = await cryptoUtil.encryptSymmetric('Bonjour', 'Secret123');
     * console.log(await cryptoUtil.decryptSymmetric(enc, 'Secret123')); // 'Bonjour'
     */
    async encryptSymmetric(data, secretKey) {
        if (!data || typeof secretKey !== 'string' || secretKey.length === 0) {
            return null;
        }
        const textBytes = new TextEncoder().encode(String(data));
        const iv = this.randomBytes(16);
        const keyMaterial = await this.sha256(secretKey, 'bytes');

        if (this.isWebCryptoAvailable()) {
            try {
                const cryptoKey = await globalThis.crypto.subtle.importKey(
                    'raw',
                    keyMaterial,
                    { name: 'AES-CBC', length: 256 },
                    false,
                    ['encrypt']
                );
                const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
                    { name: 'AES-CBC', iv },
                    cryptoKey,
                    textBytes
                );
                return {
                    type: 'aes-256-cbc',
                    iv: this.bytesToBase64(iv),
                    data: this.bytesToBase64(encryptedBuffer)
                };
            } catch (err) {
                NUtil.log.warn('NCryptography.encryptSymmetric: Échec WebCrypto AES-CBC, bascule en mode repli.', {
                    code: 'WARN_CRYPTO_FALLBACK',
                    cause: err
                });
            }
        }

        const cipherBytes = this.#streamCipherFallback(textBytes, keyMaterial, iv);
        return {
            type: 'nlib-fallback',
            iv: this.bytesToBase64(iv),
            data: this.bytesToBase64(cipherBytes)
        };
    }

    /**
     * Déchiffre un paquet symétrique généré par `encryptSymmetric()` (ou par PHP / Python en `AES-256-CBC`).
     *
     * @param {{ type?: string, iv: string, data: string }|string} payload - Paquet chiffré ou chaîne JSON.
     * @param {string} secretKey - Mot de passe ou clé secrète partagée.
     * @returns {Promise<string>} Texte déchiffré, ou `''` en cas d'erreur.
     *
     * @example <caption>Exemple 1 : Déchiffrer un paquet AES-256-CBC</caption>
     * const cryptoUtil = new NCryptography();
     * const plain = await cryptoUtil.decryptSymmetric(payload, 'ClePartageePHP');
     *
     * @example <caption>Exemple 2 : Mauvaise clé retourne une chaîne vide</caption>
     * const cryptoUtil = new NCryptography();
     * const enc = await cryptoUtil.encryptSymmetric('Secret', 'BonneCle');
     * console.log(await cryptoUtil.decryptSymmetric(enc, 'MauvaiseCle')); // ''
     */
    async decryptSymmetric(payload, secretKey) {
        if (!payload || typeof secretKey !== 'string' || secretKey.length === 0) {
            return '';
        }
        let parsed = payload;
        if (typeof payload === 'string') {
            try {
                parsed = JSON.parse(payload);
            } catch (err) {
                NUtil.log.warn('NCryptography.decryptSymmetric: Format JSON invalide.', {
                    code: 'ERR_CRYPTO_PAYLOAD_JSON',
                    cause: err
                });
                return '';
            }
        }
        if (!parsed?.iv || !parsed?.data) {
            return '';
        }

        const iv = this.base64ToBytes(parsed.iv);
        const cipherBytes = this.base64ToBytes(parsed.data);
        const keyMaterial = await this.sha256(secretKey, 'bytes');

        try {
            if (parsed.type === 'nlib-fallback' || !this.isWebCryptoAvailable()) {
                const plainBytes = this.#streamCipherFallback(cipherBytes, keyMaterial, iv);
                return new TextDecoder().decode(plainBytes);
            }

            const cryptoKey = await globalThis.crypto.subtle.importKey(
                'raw',
                keyMaterial,
                { name: 'AES-CBC', length: 256 },
                false,
                ['decrypt']
            );
            const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
                { name: 'AES-CBC', iv },
                cryptoKey,
                cipherBytes
            );
            return new TextDecoder().decode(decryptedBuffer);
        } catch (err) {
            NUtil.log.error('NCryptography.decryptSymmetric: Échec du déchiffrement AES-CBC.', {
                code: 'ERR_CRYPTO_DECRYPT_SYMMETRIC',
                cause: err
            });
            return '';
        }
    }

    // =========================================================================
    // Méthodes publiques — Chiffrement Local Lié au Navigateur (Asynchrone & Synchrone)
    // =========================================================================

    /**
     * Chiffre des données de manière **asynchrone** pour le stockage local (ex: `NIndexedDB`).
     *
     * Fonctionnement :
     * - Par défaut (**sans clé fournie**), la clé de 256 bits (`32 octets`) est dérivée dynamiquement à la volée
     *   à partir des informations intrinsèques du navigateur et de l'appareil courant (`#getBrowserKeyBytes()`).
     * - Aucune clé n'est enregistrée en persistance et aucune clé n'est incluse dans la chaîne Base64.
     * - Seul ce même navigateur pourra reconstituer la clé à la volée pour déchiffrer la donnée avec `decryptLocal()`.
     * - Supporte optionnellement une `secretKey` personnalisée ainsi que le mode `deterministic: true` (pour chiffrer
     *   des clés de recherche en `O(1)`).
     * - Utilise `AES-GCM 256 bits` (avec tag d'authentification matériel 128 bits) si `crypto.subtle` est disponible,
     *   ou le chiffrement par flot 256 bits authentifié par `HMAC-SHA256` en repli.
     *
     * @param {string|Object} data - Données à protéger pour le stockage local.
     * @param {string|Object} [optionsOrSecret={}] - Clé secrète optionnelle (`string`) ou objet d'options.
     * @param {string} [optionsOrSecret.secretKey=''] - Clé secrète personnalisée optionnelle (si omise, utilise les informations du navigateur).
     * @param {boolean} [optionsOrSecret.deterministic=false] - Si `true`, génère un IV déterministe de 12 octets pour produire toujours le même chiffré sur ce navigateur.
     * @returns {Promise<string>} Chaîne Base64 contenant uniquement `[Mode (1B) + IV + Ciphertext (+ Tag)]`.
     *
     * @example <caption>Exemple 1 : Chiffrer une donnée locale liée exclusivement au navigateur courant (sans clé)</caption>
     * const cryptoUtil = new NCryptography();
     * const token = await cryptoUtil.encryptLocal('SessionUtilisateur123');
     * console.log(await cryptoUtil.decryptLocal(token)); // 'SessionUtilisateur123'
     *
     * @example <caption>Exemple 2 : Chiffrement local déterministe pour une clé IndexedDB</caption>
     * const cryptoUtil = new NCryptography();
     * const k1 = await cryptoUtil.encryptLocal('user_42', { deterministic: true });
     * const k2 = await cryptoUtil.encryptLocal('user_42', { deterministic: true });
     * console.log(k1 === k2); // true
     */
    async encryptLocal(data, optionsOrSecret = {}) {
        if (data === null || data === undefined || data === '') {
            return '';
        }
        try {
            const plainString = typeof data === 'string' ? data : JSON.stringify(data);
            if (!plainString) {
                return '';
            }
            const dataBuffer = new TextEncoder().encode(plainString);

            const secretKey = typeof optionsOrSecret === 'string'
                ? optionsOrSecret.trim()
                : (typeof optionsOrSecret?.secretKey === 'string' ? optionsOrSecret.secretKey.trim() : '');
            const deterministic = typeof optionsOrSecret === 'object' && optionsOrSecret !== null
                ? Boolean(optionsOrSecret.deterministic)
                : false;

            const keyMaterial = secretKey.length > 0
                ? await this.sha256(secretKey, 'bytes')
                : this.#getBrowserKeyBytes();

            let iv;
            if (deterministic) {
                const ivInput = new Uint8Array(dataBuffer.length + keyMaterial.length);
                ivInput.set(dataBuffer, 0);
                ivInput.set(keyMaterial, dataBuffer.length);
                iv = this.#sha256Fallback(ivInput).slice(0, 12);
            } else {
                iv = this.randomBytes(12);
            }

            if (this.isWebCryptoAvailable()) {
                try {
                    const key = await globalThis.crypto.subtle.importKey(
                        'raw',
                        keyMaterial,
                        { name: 'AES-GCM', length: 256 },
                        false,
                        ['encrypt']
                    );
                    const encrypted = await globalThis.crypto.subtle.encrypt(
                        { name: 'AES-GCM', iv },
                        key,
                        dataBuffer
                    );
                    const encryptedBytes = new Uint8Array(encrypted);
                    // Format binaire : [0x01 (AES-GCM, 1 octet) | IV (12 octets) | Ciphertext+AuthTag]
                    const combined = new Uint8Array(1 + iv.length + encryptedBytes.length);
                    combined[0] = 0x01;
                    combined.set(iv, 1);
                    combined.set(encryptedBytes, 1 + iv.length);

                    return this.bytesToBase64(combined);
                } catch (err) {
                    NUtil.log.warn('NCryptography.encryptLocal: Échec WebCrypto AES-GCM, bascule sur le chiffrement de repli.', {
                        code: 'WARN_CRYPTO_FALLBACK',
                        cause: err
                    });
                }
            }

            // Repli sans WebCrypto : délègue à encryptLocalSync
            return this.encryptLocalSync(plainString, optionsOrSecret);
        } catch (err) {
            NUtil.log.warn('NCryptography.encryptLocal: Échec du chiffrement local.', {
                code: 'ERR_CRYPTO_ENCRYPT_LOCAL',
                cause: err
            });
            return '';
        }
    }

    /**
     * Déchiffre de manière **asynchrone** une chaîne Base64 issue de `encryptLocal()`.
     * Par défaut (sans clé fournie), recalcule à la volée la clé de 256 bits à partir des informations
     * du navigateur courant (`#getBrowserKeyBytes()`).
     * Si la chaîne provient d'un autre navigateur ou a été altérée, la vérification d'intégrité
     * (`AES-GCM` ou `HMAC-SHA256`) échoue et la méthode retourne `''`.
     *
     * @param {string} encryptedData - Chaîne Base64 générée par `encryptLocal()`.
     * @param {string|Object} [optionsOrSecret={}] - Clé secrète personnalisée optionnelle (`string`) ou `{ secretKey }`.
     * @returns {Promise<string>} Données déchiffrées en clair, ou `''` si le navigateur ne correspond pas ou si la donnée est invalide.
     *
     * @example <caption>Exemple 1 : Déchiffrer une donnée locale sur le même navigateur</caption>
     * const cryptoUtil = new NCryptography();
     * const encrypted = await cryptoUtil.encryptLocal('SecretLocal');
     * console.log(await cryptoUtil.decryptLocal(encrypted)); // 'SecretLocal'
     *
     * @example <caption>Exemple 2 : Donnée corrompue ou issue d'un autre navigateur retourne ''</caption>
     * const cryptoUtil = new NCryptography();
     * console.log(await cryptoUtil.decryptLocal('invalide')); // ''
     */
    async decryptLocal(encryptedData, optionsOrSecret = {}) {
        if (!encryptedData || typeof encryptedData !== 'string') {
            return '';
        }
        try {
            const combined = this.base64ToBytes(encryptedData);
            if (combined.length < 14) {
                return '';
            }

            const secretKey = typeof optionsOrSecret === 'string'
                ? optionsOrSecret.trim()
                : (typeof optionsOrSecret?.secretKey === 'string' ? optionsOrSecret.secretKey.trim() : '');

            const keyMaterial = secretKey.length > 0
                ? await this.sha256(secretKey, 'bytes')
                : this.#getBrowserKeyBytes();

            const mode = combined[0];

            // Mode 0x01 : AES-GCM 256 bits lié à l'empreinte du navigateur (ou secretKey)
            if (mode === 0x01) {
                if (!this.isWebCryptoAvailable() || combined.length <= 13) {
                    return '';
                }
                const iv = combined.slice(1, 13);
                const encrypted = combined.slice(13);
                try {
                    const key = await globalThis.crypto.subtle.importKey(
                        'raw',
                        keyMaterial,
                        { name: 'AES-GCM', length: 256 },
                        false,
                        ['decrypt']
                    );
                    const decrypted = await globalThis.crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv },
                        key,
                        encrypted
                    );
                    return new TextDecoder().decode(decrypted);
                } catch (err) {
                    NUtil.log.warn('NCryptography.decryptLocal: Échec du déchiffrement AES-GCM (navigateur différent ou donnée altérée).', {
                        code: 'WARN_CRYPTO_LOCAL_AUTH_FAILED',
                        cause: err
                    });
                    return '';
                }
            }

            // Modes 0x02 et 0x03 (Stream Cipher + HMAC / Déterministe)
            return this.decryptLocalSync(encryptedData, optionsOrSecret);
        } catch (err) {
            NUtil.log.warn('NCryptography.decryptLocal: Échec du déchiffrement local.', {
                code: 'ERR_CRYPTO_DECRYPT_LOCAL',
                cause: err
            });
            return '';
        }
    }

    /**
     * Chiffre des données de manière **totalement synchrone** pour le stockage local (ex: `NStorage`).
     * Ignore `crypto.subtle` et utilise directement le moteur synchrone SHA-256 + Stream Cipher 256 bits + HMAC-SHA256.
     *
     * Deux modes de fonctionnement :
     * 1. **Mode autonome lié au navigateur (sans clé fournie)** : Dérive la clé de 256 bits à la volée depuis
     *    les informations du navigateur courant (`#getBrowserKeyBytes()`), sans aucune clé enregistrée en persistance
     *    ni embarquée dans le Base64, et authentifie le chiffré avec un tag HMAC-SHA256 de 16 octets.
     * 2. **Mode à clé secrète personnalisée (`secretKey`)** : Dérive la clé en 256 bits via `sha256Sync(secretKey, 'bytes')`.
     *    Si `deterministic: true` (pour les clés de stockage `O(1)`), utilise un IV déterministe de 16 octets.
     *    Sinon, utilise un IV aléatoire de 12 octets et un tag HMAC-SHA256 de 16 octets.
     *
     * @param {string|Object} data - Chaîne ou donnée à chiffrer localement.
     * @param {string|Object} [optionsOrSecret={}] - Clé secrète (`string`) ou objet d'options.
     * @param {string} [optionsOrSecret.secretKey=''] - Clé secrète personnalisée optionnelle (si omise, utilise les informations du navigateur).
     * @param {boolean} [optionsOrSecret.deterministic=false] - Si `true`, génère un IV déterministe pour produire toujours le même chiffré à partir de la même entrée sur ce navigateur.
     * @returns {string} Chaîne Base64 chiffrée (ou `''` si l'entrée est vide).
     *
     * @example <caption>Exemple 1 : Chiffrement local synchrone lié au navigateur (sans clé à donner)</caption>
     * const cryptoUtil = new NCryptography();
     * const token = cryptoUtil.encryptLocalSync('SessionUtilisateur123');
     * console.log(cryptoUtil.decryptLocalSync(token)); // 'SessionUtilisateur123'
     *
     * @example <caption>Exemple 2 : Chiffrement local synchrone déterministe (pour clés de stockage)</caption>
     * const cryptoUtil = new NCryptography();
     * const encKey1 = cryptoUtil.encryptLocalSync('user_id', { deterministic: true });
     * const encKey2 = cryptoUtil.encryptLocalSync('user_id', { deterministic: true });
     * console.log(encKey1 === encKey2); // true
     * console.log(cryptoUtil.decryptLocalSync(encKey1)); // 'user_id'
     */
    encryptLocalSync(data, optionsOrSecret = {}) {
        if (data === null || data === undefined || data === '') {
            return '';
        }

        try {
            const plainString = typeof data === 'string' ? data : JSON.stringify(data);
            if (!plainString) {
                return '';
            }
            const dataBuffer = new TextEncoder().encode(plainString);

            const secretKey = typeof optionsOrSecret === 'string'
                ? optionsOrSecret.trim()
                : (typeof optionsOrSecret?.secretKey === 'string' ? optionsOrSecret.secretKey.trim() : '');
            const deterministic = typeof optionsOrSecret === 'object' && optionsOrSecret !== null
                ? Boolean(optionsOrSecret.deterministic)
                : false;

            // Clé 256 bits : soit dérivée de secretKey si fournie, soit dérivée des informations du navigateur courant
            const keyMaterial = secretKey.length > 0
                ? this.sha256Sync(secretKey, 'bytes')
                : this.#getBrowserKeyBytes();

            // Cas A : Mode déterministe (pour les clés O(1) de NStorage) -> [0x03 | IV déterministe (16B) | Ciphertext]
            if (deterministic) {
                const ivInput = new Uint8Array(dataBuffer.length + keyMaterial.length);
                ivInput.set(dataBuffer, 0);
                ivInput.set(keyMaterial, dataBuffer.length);
                const iv = this.#sha256Fallback(ivInput).slice(0, 16);

                const cipherBytes = this.#streamCipherFallback(dataBuffer, keyMaterial, iv);
                const combined = new Uint8Array(1 + 16 + cipherBytes.length);
                combined[0] = 0x03;
                combined.set(iv, 1);
                combined.set(cipherBytes, 17);
                return this.bytesToBase64(combined);
            }

            // Cas B : Mode standard avec IV aléatoire (12B) + Tag d'intégrité HMAC-SHA256 (16B) -> [0x02 | IV (12B) | Tag (16B) | Ciphertext]
            const iv = this.randomBytes(12);
            const cipherBytes = this.#streamCipherFallback(dataBuffer, keyMaterial, iv);
            const macInput = new Uint8Array(iv.length + cipherBytes.length);
            macInput.set(iv, 0);
            macInput.set(cipherBytes, iv.length);
            const macTag = this.hmacSha256Sync(keyMaterial, macInput, 'bytes').slice(0, 16);

            const combined = new Uint8Array(1 + 12 + 16 + cipherBytes.length);
            combined[0] = 0x02;
            combined.set(iv, 1);
            combined.set(macTag, 13);
            combined.set(cipherBytes, 29);
            return this.bytesToBase64(combined);
        } catch (err) {
            NUtil.log.warn('NCryptography.encryptLocalSync: Échec du chiffrement local synchrone.', {
                code: 'ERR_CRYPTO_ENCRYPT_LOCAL_SYNC',
                cause: err
            });
            return '';
        }
    }

    /**
     * Déchiffre de manière **totalement synchrone** une chaîne Base64 générée par `encryptLocalSync()`.
     * Par défaut (sans clé fournie), utilise la clé de 256 bits dérivée à la volée des informations du navigateur courant.
     * Si la chaîne provient d'un autre navigateur ou a été altérée, retourne `''`.
     *
     * @param {string} encryptedData - Chaîne Base64 générée par `encryptLocalSync()`.
     * @param {string|Object} [optionsOrSecret={}] - Clé secrète personnalisée optionnelle (`string`) ou `{ secretKey }`.
     * @returns {string} Données déchiffrées en clair, ou `''` si le navigateur/clé ne correspond pas.
     *
     * @example <caption>Exemple 1 : Déchiffrer une donnée locale sur le même navigateur (sans clé)</caption>
     * const cryptoUtil = new NCryptography();
     * const encrypted = cryptoUtil.encryptLocalSync('SecretLocalSync');
     * console.log(cryptoUtil.decryptLocalSync(encrypted)); // 'SecretLocalSync'
     *
     * @example <caption>Exemple 2 : Déchiffrer une donnée protégée par une clé secrète personnalisée</caption>
     * const cryptoUtil = new NCryptography();
     * const encrypted = cryptoUtil.encryptLocalSync('DonnéeSensible', 'MonSecret');
     * console.log(cryptoUtil.decryptLocalSync(encrypted, 'MonSecret')); // 'DonnéeSensible'
     */
    decryptLocalSync(encryptedData, optionsOrSecret = {}) {
        if (!encryptedData || typeof encryptedData !== 'string') {
            return '';
        }

        try {
            const combined = this.base64ToBytes(encryptedData);
            if (combined.length < 18) {
                return '';
            }

            const secretKey = typeof optionsOrSecret === 'string'
                ? optionsOrSecret.trim()
                : (typeof optionsOrSecret?.secretKey === 'string' ? optionsOrSecret.secretKey.trim() : '');

            const keyMaterial = secretKey.length > 0
                ? this.sha256Sync(secretKey, 'bytes')
                : this.#getBrowserKeyBytes();

            const mode = combined[0];

            // Mode 0x03 : Déterministe [0x03 | IV (16B) | Ciphertext]
            if (mode === 0x03) {
                const iv = combined.slice(1, 17);
                const cipherBytes = combined.slice(17);
                const plainBytes = this.#streamCipherFallback(cipherBytes, keyMaterial, iv);
                const expectedIvInput = new Uint8Array(plainBytes.length + keyMaterial.length);
                expectedIvInput.set(plainBytes, 0);
                expectedIvInput.set(keyMaterial, plainBytes.length);
                const expectedIv = this.#sha256Fallback(expectedIvInput).slice(0, 16);

                if (!this.#timingSafeEqualBytes(iv, expectedIv)) {
                    return '';
                }
                return new TextDecoder().decode(plainBytes);
            }

            // Mode 0x02 : Authentifié par HMAC [0x02 | IV (12B) | Tag (16B) | Ciphertext]
            if (mode === 0x02) {
                if (combined.length <= 29) {
                    return '';
                }
                const iv = combined.slice(1, 13);
                const expectedTag = combined.slice(13, 29);
                const cipherBytes = combined.slice(29);

                const macInput = new Uint8Array(iv.length + cipherBytes.length);
                macInput.set(iv, 0);
                macInput.set(cipherBytes, iv.length);
                const computedTag = this.hmacSha256Sync(keyMaterial, macInput, 'bytes').slice(0, 16);

                if (!this.#timingSafeEqualBytes(expectedTag, computedTag)) {
                    return '';
                }

                const plainBytes = this.#streamCipherFallback(cipherBytes, keyMaterial, iv);
                return new TextDecoder().decode(plainBytes);
            }

            return '';
        } catch (err) {
            NUtil.log.warn('NCryptography.decryptLocalSync: Échec du déchiffrement local synchrone.', {
                code: 'ERR_CRYPTO_DECRYPT_LOCAL_SYNC',
                cause: err
            });
            return '';
        }
    }
}

export default NCryptography;

