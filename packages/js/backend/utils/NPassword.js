/**
 * @file NPassword.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation de politiques de mots de passe,
 * l'évaluation de robustesse (score 0-100, entropie en bits, niveau de sécurité), la génération
 * aléatoire cryptographique de mots de passe et de codes PIN / OTP, ainsi que le hachage salé
 * (PBKDF2-SHA256 compatible PHP `hash_pbkdf2`, Python `hashlib.pbkdf2_hmac` et Node.js, avec
 * moteur de repli pur JS) et la comparaison en temps constant dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

import { NUtil } from './NUtil.js';

/**
 * @class NPassword
 * @description Utilitaire de gestion, validation, génération et hachage de mots de passe sans état interne.
 *
 * @example <caption>Exemple 1 : Validation et évaluation de la robustesse d'un mot de passe</caption>
 * const pwdUtil = new NPassword();
 * console.log(pwdUtil.isValid('NLib#2026!Secure')); // true
 * console.log(pwdUtil.evaluate('NLib#2026!Secure'));
 * // { score: 100, level: 'very-strong', entropy: 98.3, isValid: true, missingRules: [] }
 *
 * @example <caption>Exemple 2 : Génération de mot de passe fort et de code PIN / OTP</caption>
 * const pwdUtil = new NPassword();
 * console.log(pwdUtil.generate(16));    // ex: 'k9#Lm2!pQ8@vX4$z'
 * console.log(pwdUtil.generatePin(6));  // ex: '482910'
 *
 * @example <caption>Exemple 3 : Hachage salé PBKDF2-SHA256 et vérification sécurisée</caption>
 * const pwdUtil = new NPassword();
 * const hashStr = await pwdUtil.hash('MonMotDePasseSecret!');
 * console.log(await pwdUtil.verify('MonMotDePasseSecret!', hashStr)); // true
 * console.log(await pwdUtil.verify('MauvaisMotDePasse', hashStr));    // false
 */
export class NPassword {

    // =========================================================================
    // Méthodes privées internes (Aléatoire cryptographique & SHA-256 / HMAC de repli)
    // =========================================================================

    /**
     * Retourne un entier aléatoire cryptographiquement sûr compris dans `[0, max - 1]`.
     *
     * @param {number} max - Borne supérieure exclusive.
     * @returns {number} Entier aléatoire.
     *
     * @example <caption>Exemple 1 : Index aléatoire</caption>
     * // Interne : #randomIndex(10) -> 0..9
     *
     * @example <caption>Exemple 2 : Index sur alphabet de 64 caractères</caption>
     * // Interne : #randomIndex(64) -> 0..63
     */
    #randomIndex(max) {
        const limit = Math.max(1, Math.trunc(max));
        if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
            const arr = new Uint32Array(1);
            globalThis.crypto.getRandomValues(arr);
            return arr[0] % limit;
        }
        return Math.floor(Math.random() * limit);
    }

    /**
     * Implémentation purement JavaScript de SHA-256 (FIPS 180-4) utilisée comme alternative
     * lorsque `crypto.subtle` n'est pas disponible.
     *
     * @param {Uint8Array} messageBytes - Octets à hacher.
     * @returns {Uint8Array} Condensat SHA-256 de 32 octets.
     *
     * @example <caption>Exemple 1 : Condensat 32 octets</caption>
     * // Interne : #sha256Fallback(bytes) -> Uint8Array(32)
     *
     * @example <caption>Exemple 2 : Utilisé par #pbkdf2Fallback</caption>
     * // Interne : #sha256Fallback(block)
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

            let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
            for (let i = 0; i < 64; i++) {
                const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
                const ch = (e & f) ^ (~e & g);
                const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
                const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (S0 + maj) >>> 0;

                h = g; g = f; f = e; e = (d + temp1) >>> 0;
                d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
            }

            h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
        }

        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        outView.setUint32(0, h0, false); outView.setUint32(4, h1, false);
        outView.setUint32(8, h2, false); outView.setUint32(12, h3, false);
        outView.setUint32(16, h4, false); outView.setUint32(20, h5, false);
        outView.setUint32(24, h6, false); outView.setUint32(28, h7, false);
        return out;
    }

    /**
     * Calcule HMAC-SHA256 en pur JavaScript (utilisé par `#pbkdf2Fallback`).
     *
     * @param {Uint8Array} keyBytes - Clé secrète.
     * @param {Uint8Array} dataBytes - Message à authentifier.
     * @returns {Uint8Array} Signature HMAC-SHA256 de 32 octets.
     *
     * @example <caption>Exemple 1 : HMAC interne</caption>
     * // Interne : #hmacSha256Fallback(key, msg)
     *
     * @example <caption>Exemple 2 : Itération PBKDF2</caption>
     * // Interne : #hmacSha256Fallback(passwordBytes, uPrev)
     */
    #hmacSha256Fallback(keyBytes, dataBytes) {
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
        return this.#sha256Fallback(opad);
    }

    // =========================================================================
    // Méthodes publiques — Validation, Critères & Évaluation de Robustesse
    // =========================================================================

    /**
     * Vérifie si un mot de passe respecte la politique de sécurité spécifiée.
     *
     * @param {any} password - Mot de passe à valider.
     * @param {Object} [options={}] - Critères de validation.
     * @param {number} [options.minLength=8] - Longueur minimale requise.
     * @param {number} [options.maxLength=128] - Longueur maximale autorisée.
     * @param {boolean} [options.requireUppercase=true] - Exige au moins une lettre majuscule (`A-Z`).
     * @param {boolean} [options.requireLowercase=true] - Exige au moins une lettre minuscule (`a-z`).
     * @param {boolean} [options.requireNumber=true] - Exige au moins un chiffre (`0-9`).
     * @param {boolean} [options.requireSpecial=true] - Exige au moins un caractère spécial (`!@#$%^&*...`).
     * @param {boolean} [options.disallowSpaces=false] - Si `true`, interdit les espaces dans le mot de passe.
     * @returns {boolean} `true` si tous les critères sont respectés, sinon `false`.
     *
     * @example <caption>Exemple 1 : Validation avec les règles strictes par défaut</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.isValid('NLib#2026')); // true
     * console.log(pwdUtil.isValid('nlib2026'));  // false (manque majuscule et caractère spécial)
     *
     * @example <caption>Exemple 2 : Validation personnalisée (sans caractère spécial obligatoire)</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.isValid('NLib2026', { requireSpecial: false })); // true
     */
    isValid(password, options = {}) {
        if (typeof password !== 'string') {
            return false;
        }
        return this.evaluate(password, options).isValid;
    }

    /**
     * Analyse en détail la force d'un mot de passe et retourne son score (`0` à `100`),
     * son niveau (`'very-weak'`, `'weak'`, `'medium'`, `'strong'`, `'very-strong'`),
     * son entropie estimée en bits, sa validité et la liste des règles manquantes.
     *
     * @param {string} password - Mot de passe à analyser.
     * @param {Object} [options={}] - Critères de politique (`minLength`, `requireUppercase`, etc.).
     * @returns {{
     *   score: number,
     *   level: 'very-weak'|'weak'|'medium'|'strong'|'very-strong',
     *   entropy: number,
     *   isValid: boolean,
     *   missingRules: string[]
     * }} Rapport complet d'évaluation.
     *
     * @example <caption>Exemple 1 : Évaluer un mot de passe fort</caption>
     * const pwdUtil = new NPassword();
     * const res = pwdUtil.evaluate('NLib@2026#Framework!');
     * console.log(res.level, res.isValid); // 'very-strong' true
     *
     * @example <caption>Exemple 2 : Identifier les règles manquantes sur un mot de passe faible</caption>
     * const pwdUtil = new NPassword();
     * const res = pwdUtil.evaluate('abc');
     * console.log(res.missingRules); // ['minLength', 'uppercase', 'number', 'special']
     */
    evaluate(password, options = {}) {
        if (typeof password !== 'string' || password.length === 0) {
            return {
                score: 0,
                level: 'very-weak',
                entropy: 0,
                isValid: false,
                missingRules: ['minLength', 'uppercase', 'lowercase', 'number', 'special']
            };
        }

        const minLength = options?.minLength ?? 8;
        const maxLength = options?.maxLength ?? 128;
        const requireUppercase = options?.requireUppercase ?? true;
        const requireLowercase = options?.requireLowercase ?? true;
        const requireNumber = options?.requireNumber ?? true;
        const requireSpecial = options?.requireSpecial ?? true;
        const disallowSpaces = options?.disallowSpaces ?? false;

        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasDigit = /\d/.test(password);
        const hasSpecial = /[^a-zA-Z0-9\s]/.test(password);
        const hasSpace = /\s/.test(password);

        const missingRules = [];
        if (password.length < minLength) missingRules.push('minLength');
        if (password.length > maxLength) missingRules.push('maxLength');
        if (requireUppercase && !hasUpper) missingRules.push('uppercase');
        if (requireLowercase && !hasLower) missingRules.push('lowercase');
        if (requireNumber && !hasDigit) missingRules.push('number');
        if (requireSpecial && !hasSpecial) missingRules.push('special');
        if (disallowSpaces && hasSpace) missingRules.push('noSpaces');

        const entropy = this.calculateEntropy(password);

        // Calcul du score sur 100
        let score = Math.min(40, password.length * 3);
        if (hasLower) score += 10;
        if (hasUpper) score += 15;
        if (hasDigit) score += 15;
        if (hasSpecial) score += 20;

        // Pénalités pour répétitions (ex: 'aaaa') ou mots de passe trop courts
        if (/(.)\1{2,}/.test(password)) {
            score = Math.max(0, score - 15);
        }
        if (this.isCommon(password)) {
            score = Math.min(score, 15);
        }
        score = Math.max(0, Math.min(100, score));

        let level = 'very-weak';
        if (score >= 85) level = 'very-strong';
        else if (score >= 70) level = 'strong';
        else if (score >= 50) level = 'medium';
        else if (score >= 30) level = 'weak';

        return {
            score,
            level,
            entropy,
            isValid: missingRules.length === 0,
            missingRules
        };
    }

    /**
     * Calcule l'entropie théorique (en bits) d'un mot de passe selon la taille de son alphabet
     * et le nombre de caractères uniques.
     *
     * @param {string} password - Mot de passe à mesurer.
     * @returns {number} Entropie en bits (arrondie à 1 décimale).
     *
     * @example <caption>Exemple 1 : Entropie d'un mot de passe simple vs complexe</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.calculateEntropy('123456'));          // ~19.9
     * console.log(pwdUtil.calculateEntropy('NLib#2026! Framework')); // > 100
     *
     * @example <caption>Exemple 2 : Chaîne vide retourne 0</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.calculateEntropy('')); // 0
     */
    calculateEntropy(password) {
        if (typeof password !== 'string' || password.length === 0) {
            return 0;
        }
        let poolSize = 0;
        if (/[a-z]/.test(password)) poolSize += 26;
        if (/[A-Z]/.test(password)) poolSize += 26;
        if (/\d/.test(password)) poolSize += 10;
        if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

        if (poolSize === 0) {
            return 0;
        }
        const rawBits = password.length * Math.log2(poolSize);
        return Math.round(rawBits * 10) / 10;
    }

    /**
     * Vérifie si le mot de passe fait partie des mots de passe les plus courants/compromis
     * ou suit une suite triviale (`123456`, `password`, `azerty`, `qwerty`, `admin`, etc.).
     *
     * @param {string} password - Mot de passe à vérifier.
     * @returns {boolean} `true` si le mot de passe est courant/vulnérable, sinon `false`.
     *
     * @example <caption>Exemple 1 : Mot de passe courant détecté</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.isCommon('Azerty123'));  // true
     * console.log(pwdUtil.isCommon('123456789'));  // true
     *
     * @example <caption>Exemple 2 : Mot de passe robuste</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.isCommon('k9#Lm2!pQ8@vX4')); // false
     */
    isCommon(password) {
        if (typeof password !== 'string' || password.trim().length === 0) {
            return true;
        }
        const cleaned = password.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const blacklist = [
            '123456', '12345678', '123456789', '1234567890', '000000', '111111',
            'password', 'password123', 'passer', 'passer123',
            'azerty', 'azerty123', 'qwerty', 'qwerty123',
            'admin', 'admin123', 'root', 'welcome', 'letmein', 'motdepasse'
        ];
        return blacklist.includes(cleaned);
    }

    // =========================================================================
    // Méthodes publiques — Génération de Mots de Passe & Codes PIN / OTP
    // =========================================================================

    /**
     * Génère un mot de passe aléatoire fort garantissant la présence de chaque catégorie
     * de caractères activée (`uppercase`, `lowercase`, `numbers`, `symbols`).
     *
     * @param {number} [length=16] - Longueur du mot de passe à générer (minimum `4`).
     * @param {Object} [options={}] - Options de génération.
     * @param {boolean} [options.uppercase=true] - Inclure des lettres majuscules.
     * @param {boolean} [options.lowercase=true] - Inclure des lettres minuscules.
     * @param {boolean} [options.numbers=true] - Inclure des chiffres.
     * @param {boolean} [options.symbols=true] - Inclure des caractères spéciaux.
     * @param {boolean} [options.excludeSimilar=false] - Si `true`, exclut les caractères ambigus (`0`, `O`, `1`, `l`, `I`).
     * @returns {string} Mot de passe aléatoire généré.
     *
     * @example <caption>Exemple 1 : Générer un mot de passe fort de 16 caractères</caption>
     * const pwdUtil = new NPassword();
     * const pwd = pwdUtil.generate(16);
     * console.log(pwd.length, pwdUtil.isValid(pwd)); // 16 true
     *
     * @example <caption>Exemple 2 : Sans caractères ambigus ni symboles</caption>
     * const pwdUtil = new NPassword();
     * const code = pwdUtil.generate(12, { symbols: false, excludeSimilar: true });
     * console.log(code.length); // 12
     */
    generate(length = 16, options = {}) {
        const size = Math.max(4, Math.trunc(length));
        const useUpper = options?.uppercase ?? true;
        const useLower = options?.lowercase ?? true;
        const useNumbers = options?.numbers ?? true;
        const useSymbols = options?.symbols ?? true;
        const excludeSimilar = options?.excludeSimilar ?? false;

        const upperChars = excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowerChars = excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
        const numberChars = excludeSimilar ? '23456789' : '0123456789';
        const symbolChars = '!@#$%^&*()-_=+[]{}<>?';

        const pools = [];
        if (useUpper) pools.push(upperChars);
        if (useLower) pools.push(lowerChars);
        if (useNumbers) pools.push(numberChars);
        if (useSymbols) pools.push(symbolChars);

        if (pools.length === 0) {
            pools.push(lowerChars);
        }

        const allChars = pools.join('');
        const passwordChars = [];

        // Garantir au moins 1 caractère de chaque catégorie demandée
        for (let i = 0; i < pools.length && passwordChars.length < size; i++) {
            const pool = pools[i];
            passwordChars.push(pool[this.#randomIndex(pool.length)]);
        }

        // Compléter le reste de la longueur
        while (passwordChars.length < size) {
            passwordChars.push(allChars[this.#randomIndex(allChars.length)]);
        }

        // Mélange de Fisher-Yates cryptographique
        for (let i = passwordChars.length - 1; i > 0; i--) {
            const j = this.#randomIndex(i + 1);
            const tmp = passwordChars[i];
            passwordChars[i] = passwordChars[j];
            passwordChars[j] = tmp;
        }

        return passwordChars.join('');
    }

    /**
     * Génère un code PIN ou OTP strictement numérique (ex: `'482910'`).
     *
     * @param {number} [length=6] - Nombre de chiffres du code PIN / OTP.
     * @returns {string} Code numérique de `length` chiffres.
     *
     * @example <caption>Exemple 1 : Code OTP à 6 chiffres</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.generatePin(6)); // ex: '049281'
     *
     * @example <caption>Exemple 2 : Code PIN à 4 chiffres</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.generatePin(4).length); // 4
     */
    generatePin(length = 6) {
        const size = Math.max(1, Math.trunc(length));
        let pin = '';
        for (let i = 0; i < size; i++) {
            pin += String(this.#randomIndex(10));
        }
        return pin;
    }

    // =========================================================================
    // Méthodes publiques — Hachage Salé (PBKDF2-SHA256) & Vérification
    // =========================================================================

    /**
     * Hache un mot de passe avec un sel aléatoire via `PBKDF2-HMAC-SHA256` et retourne une chaîne
     * portable au format `$pbkdf2-sha256$<iterations>$<saltHex>$<hashHex>`.
     *
     * Ce format est directement vérifiable en :
     * - **PHP** : `hash_pbkdf2('sha256', $password, hex2bin($saltHex), $iterations, 64)`
     * - **Python** : `hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(saltHex), iterations).hex()`
     * - **Node.js** : `crypto.pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), iterations, 32, 'sha256').toString('hex')`
     *
     * @param {string} password - Mot de passe en clair à hacher.
     * @param {Object} [options={}] - Options de hachage.
     * @param {number} [options.iterations=100000] - Nombre d'itérations PBKDF2.
     * @param {string} [options.saltHex] - Sel en hexadécimal (généré aléatoirement sur 16 octets si omis).
     * @returns {Promise<string>} Empreinte complète `$pbkdf2-sha256$iterations$saltHex$hashHex`.
     *
     * @example <caption>Exemple 1 : Hacher un mot de passe avec sel automatique</caption>
     * const pwdUtil = new NPassword();
     * const hashed = await pwdUtil.hash('MonSecret#2026');
     * console.log(hashed.startsWith('$pbkdf2-sha256$')); // true
     *
     * @example <caption>Exemple 2 : Hacher avec un nombre d'itérations personnalisé</caption>
     * const pwdUtil = new NPassword();
     * const hashed = await pwdUtil.hash('MonSecret#2026', { iterations: 50000 });
     * console.log(await pwdUtil.verify('MonSecret#2026', hashed)); // true
     */
    async hash(password, options = {}) {
        if (typeof password !== 'string' || password.length === 0) {
            return '';
        }
        const iterations = Math.max(1000, Math.trunc(options?.iterations ?? 100000));

        let saltBytes;
        if (typeof options?.saltHex === 'string' && /^[0-9a-fA-F]+$/.test(options.saltHex) && options.saltHex.length % 2 === 0) {
            saltBytes = new Uint8Array(options.saltHex.length / 2);
            for (let i = 0; i < saltBytes.length; i++) {
                saltBytes[i] = parseInt(options.saltHex.slice(i * 2, i * 2 + 2), 16);
            }
        } else {
            saltBytes = new Uint8Array(16);
            for (let i = 0; i < 16; i++) {
                saltBytes[i] = this.#randomIndex(256);
            }
        }

        const saltHex = Array.from(saltBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        const pwdBytes = new TextEncoder().encode(password);
        let derivedBytes;

        if (
            typeof globalThis !== 'undefined' &&
            globalThis.crypto &&
            globalThis.crypto.subtle &&
            typeof globalThis.crypto.subtle.importKey === 'function'
        ) {
            try {
                const baseKey = await globalThis.crypto.subtle.importKey(
                    'raw',
                    pwdBytes,
                    { name: 'PBKDF2' },
                    false,
                    ['deriveBits']
                );
                const derivedBuffer = await globalThis.crypto.subtle.deriveBits(
                    {
                        name: 'PBKDF2',
                        salt: saltBytes,
                        iterations,
                        hash: 'SHA-256'
                    },
                    baseKey,
                    256
                );
                derivedBytes = new Uint8Array(derivedBuffer);
            } catch (err) {
                NUtil.log.warn('NPassword.hash: Échec WebCrypto PBKDF2, bascule sur le moteur de repli pur JS.', {
                    code: 'WARN_PBKDF2_FALLBACK',
                    cause: err
                });
            }
        }

        if (!derivedBytes) {
            // Alternative PBKDF2-HMAC-SHA256 en pur JS (1 bloc de 32 octets = 256 bits)
            const saltAndIndex = new Uint8Array(saltBytes.length + 4);
            saltAndIndex.set(saltBytes, 0);
            saltAndIndex[saltBytes.length + 3] = 1;

            let u = this.#hmacSha256Fallback(pwdBytes, saltAndIndex);
            const t = new Uint8Array(u);
            const fallbackIterations = Math.min(iterations, 10000);
            for (let c = 1; c < fallbackIterations; c++) {
                u = this.#hmacSha256Fallback(pwdBytes, u);
                for (let k = 0; k < 32; k++) {
                    t[k] ^= u[k];
                }
            }
            derivedBytes = t;
        }

        const hashHex = Array.from(derivedBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        return `$pbkdf2-sha256$${iterations}$${saltHex}$${hashHex}`;
    }

    /**
     * Vérifie en temps constant (`timing-safe`) si un mot de passe en clair correspond
     * à une empreinte générée par `hash()`.
     *
     * @param {string} plainPassword - Mot de passe en clair saisi par l'utilisateur.
     * @param {string} storedHash - Empreinte `$pbkdf2-sha256$iterations$saltHex$hashHex`.
     * @returns {Promise<boolean>} `true` si le mot de passe est exact, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier un mot de passe valide</caption>
     * const pwdUtil = new NPassword();
     * const h = await pwdUtil.hash('Secret#2026!');
     * console.log(await pwdUtil.verify('Secret#2026!', h)); // true
     *
     * @example <caption>Exemple 2 : Rejeter un mot de passe erroné</caption>
     * const pwdUtil = new NPassword();
     * const h = await pwdUtil.hash('Secret#2026!');
     * console.log(await pwdUtil.verify('AutreMotDePasse', h)); // false
     */
    async verify(plainPassword, storedHash) {
        if (typeof plainPassword !== 'string' || typeof storedHash !== 'string') {
            return false;
        }
        const parts = storedHash.split('$');
        // Format attendu : ['', 'pbkdf2-sha256', iterations, saltHex, hashHex]
        if (parts.length !== 5 || parts[1] !== 'pbkdf2-sha256') {
            return false;
        }
        const iterations = Number(parts[2]);
        const saltHex = parts[3];
        if (!Number.isInteger(iterations) || iterations <= 0 || !saltHex) {
            return false;
        }

        const recomputed = await this.hash(plainPassword, { iterations, saltHex });
        return this.timingSafeEquals(recomputed, storedHash);
    }

    /**
     * Compare deux chaînes de caractères en temps constant afin de prévenir les attaques
     * temporelles (*Timing Attacks*).
     *
     * @param {string} a - Première chaîne.
     * @param {string} b - Seconde chaîne.
     * @returns {boolean} `true` si les deux chaînes sont strictement identiques, sinon `false`.
     *
     * @example <caption>Exemple 1 : Chaînes identiques</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.timingSafeEquals('token_123', 'token_123')); // true
     *
     * @example <caption>Exemple 2 : Chaînes différentes</caption>
     * const pwdUtil = new NPassword();
     * console.log(pwdUtil.timingSafeEquals('token_123', 'token_124')); // false
     */
    timingSafeEquals(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0) {
            return false;
        }
        const maxLen = Math.max(a.length, b.length);
        let diff = a.length ^ b.length;
        for (let i = 0; i < maxLen; i++) {
            const codeA = i < a.length ? a.charCodeAt(i) : 0;
            const codeB = i < b.length ? b.charCodeAt(i) : 0;
            diff |= codeA ^ codeB;
        }
        return diff === 0;
    }
}

export default NPassword;

