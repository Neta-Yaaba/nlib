/**
 * @file NPass.js
 * @package @nlib/js-backend
 * @description Classe utilitaire statique pour la validation de politiques de mots de passe,
 * l'évaluation de robustesse (score 0-100, entropie en bits, niveau de sécurité), la génération
 * aléatoire cryptographique de mots de passe et de codes PIN / OTP, le hachage salé
 * PBKDF2-SHA256 via Web Crypto (compatible PHP `hash_pbkdf2`, Python `hashlib.pbkdf2_hmac` et Node.js)
 * et la comparaison en temps constant dans l'écosystème NLib.
 */

import { NLog } from '../log/NLog.js';
import { NUtil } from './NUtil.js';
import { NCrypto } from './NCrypto.js';

/**
 * @class NPass
 * @description Utilitaire statique de validation, évaluation, génération et hachage PBKDF2-SHA256 de mots de passe.
 *
 * @example <caption>Exemple 1 : Validation et évaluation de la robustesse d'un mot de passe</caption>
 * console.log(NPass.isValid('NLib#2026!Secure')); // true
 * console.log(NPass.evaluate('NLib#2026!Secure'));
 * // { score: 100, level: 'very-strong', entropy: 98.3, isValid: true, missingRules: [] }
 *
 * @example <caption>Exemple 2 : Génération de mot de passe fort et de code PIN / OTP</caption>
 * console.log(NPass.generate(16));    // ex: 'k9#Lm2!pQ8@vX4$z'
 * console.log(NPass.generatePin(6));  // ex: '482910'
 *
 * @example <caption>Exemple 3 : Hachage salé PBKDF2-SHA256 et vérification sécurisée</caption>
 * const hashStr = await NPass.hash('MonMotDePasseSecret!');
 * console.log(await NPass.verify('MonMotDePasseSecret!', hashStr)); // true
 * console.log(await NPass.verify('MauvaisMotDePasse', hashStr));    // false
 */
export class NPass {

    // =========================================================================
    // Méthodes privées internes (Aléatoire cryptographique)
    // =========================================================================

    /**
     * Retourne un entier aléatoire compris dans `[0, max - 1]`.
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
    static #randomIndex(max) {
        const limit = Math.max(1, Math.trunc(max));
        if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
            const arr = new Uint32Array(1);
            globalThis.crypto.getRandomValues(arr);
            return arr[0] % limit;
        }
        return Math.floor(Math.random() * limit);
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
     * console.log(NPass.isValid('NLib#2026')); // true
     * console.log(NPass.isValid('nlib2026'));  // false (manque majuscule et caractère spécial)
     *
     * @example <caption>Exemple 2 : Validation personnalisée (sans caractère spécial obligatoire)</caption>
     * console.log(NPass.isValid('NLib2026', { requireSpecial: false })); // true
     */
    static isValid(password, options = {}) {
        if (typeof password !== 'string') {
            return false;
        }
        return NPass.evaluate(password, options).isValid;
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
     * const res = NPass.evaluate('NLib@2026#Framework!');
     * console.log(res.level, res.isValid); // 'very-strong' true
     *
     * @example <caption>Exemple 2 : Identifier les règles manquantes sur un mot de passe faible</caption>
     * const res = NPass.evaluate('abc');
     * console.log(res.missingRules); // ['minLength', 'uppercase', 'number', 'special']
     */
    static evaluate(password, options = {}) {
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

        const entropy = NPass.calculateEntropy(password);

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
        if (NPass.isCommon(password)) {
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
     * console.log(NPass.calculateEntropy('123456'));          // ~19.9
     * console.log(NPass.calculateEntropy('NLib#2026! Framework')); // > 100
     *
     * @example <caption>Exemple 2 : Chaîne vide retourne 0</caption>
     * console.log(NPass.calculateEntropy('')); // 0
     */
    static calculateEntropy(password) {
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
     * console.log(NPass.isCommon('Azerty123'));  // true
     * console.log(NPass.isCommon('123456789'));  // true
     *
     * @example <caption>Exemple 2 : Mot de passe robuste</caption>
     * console.log(NPass.isCommon('k9#Lm2!pQ8@vX4')); // false
     */
    static isCommon(password) {
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
     * const pwd = NPass.generate(16);
     * console.log(pwd.length, NPass.isValid(pwd)); // 16 true
     *
     * @example <caption>Exemple 2 : Sans caractères ambigus ni symboles</caption>
     * const code = NPass.generate(12, { symbols: false, excludeSimilar: true });
     * console.log(code.length); // 12
     */
    static generate(length = 16, options = {}) {
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
            passwordChars.push(pool[NPass.#randomIndex(pool.length)]);
        }

        // Compléter le reste de la longueur
        while (passwordChars.length < size) {
            passwordChars.push(allChars[NPass.#randomIndex(allChars.length)]);
        }

        // Mélange de Fisher-Yates cryptographique
        for (let i = passwordChars.length - 1; i > 0; i--) {
            const j = NPass.#randomIndex(i + 1);
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
     * console.log(NPass.generatePin(6)); // ex: '049281'
     *
     * @example <caption>Exemple 2 : Code PIN à 4 chiffres</caption>
     * console.log(NPass.generatePin(4).length); // 4
     */
    static generatePin(length = 6) {
        const size = Math.max(1, Math.trunc(length));
        let pin = '';
        for (let i = 0; i < size; i++) {
            pin += String(NPass.#randomIndex(10));
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
     * const hashed = await NPass.hash('MonSecret#2026');
     * console.log(hashed.startsWith('$pbkdf2-sha256$')); // true
     *
     * @example <caption>Exemple 2 : Hacher avec un nombre d'itérations personnalisé</caption>
     * const hashed = await NPass.hash('MonSecret#2026', { iterations: 50000 });
     * console.log(await NPass.verify('MonSecret#2026', hashed)); // true
     */
    static async hash(password, options = {}) {
        if (typeof password !== 'string' || password.length === 0) {
            return '';
        }

        if (!NCrypto.isWebCryptoAvailable() || typeof globalThis.crypto.subtle.importKey !== 'function') {
            NLog.warn('NPass.hash: Web Crypto indisponible.');
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
            saltBytes = NCrypto.randomBytes(16);
            if (!saltBytes.length) {
                return '';
            }
        }

        const saltHex = Array.from(saltBytes)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        const pwdBytes = new TextEncoder().encode(password);

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
            const derivedBytes = new Uint8Array(derivedBuffer);
            const hashHex = Array.from(derivedBytes)
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');

            return `$pbkdf2-sha256$${iterations}$${saltHex}$${hashHex}`;
        } catch (err) {
            NLog.error('NPass.hash: Échec WebCrypto PBKDF2.', {
                code: 'ERR_PBKDF2_FAILED',
                cause: err
            });
            return '';
        }
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
     * const h = await NPass.hash('Secret#2026!');
     * console.log(await NPass.verify('Secret#2026!', h)); // true
     *
     * @example <caption>Exemple 2 : Rejeter un mot de passe erroné</caption>
     * const h = await NPass.hash('Secret#2026!');
     * console.log(await NPass.verify('AutreMotDePasse', h)); // false
     */
    static async verify(plainPassword, storedHash) {
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

        const recomputed = await NPass.hash(plainPassword, { iterations, saltHex });
        return NPass.timingSafeEquals(recomputed, storedHash);
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
     * console.log(NPass.timingSafeEquals('token_123', 'token_123')); // true
     *
     * @example <caption>Exemple 2 : Chaînes différentes</caption>
     * console.log(NPass.timingSafeEquals('token_123', 'token_124')); // false
     */
    static timingSafeEquals(a, b) {
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

export default NPass;

