/**
 * @file NEmail.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation, la normalisation, l'extraction de composants,
 * la comparaison, le masquage et le filtrage des adresses e-mail dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

import { NUtil } from './NUtil.js';

/**
 * @class NEmail
 * @description Utilitaire de gestion et traitement des adresses e-mail sans état interne.
 *
 * @example <caption>Exemple 1 : Validation et normalisation</caption>
 * const emailUtil = new NEmail();
 * console.log(emailUtil.isValid('Contact@NLib.dev'));      // true
 * console.log(emailUtil.normalize('  Contact@NLib.DEV ')); // 'contact@nlib.dev'
 *
 * @example <caption>Exemple 2 : Extraction des composants et sous-adressage (+tag)</caption>
 * const emailUtil = new NEmail();
 * console.log(emailUtil.parse('user+promo@mail.nlib.dev'));
 * // { local: 'user+promo', baseLocal: 'user', tag: 'promo', domain: 'mail.nlib.dev', tld: 'dev' }
 *
 * @example <caption>Exemple 3 : Masquage pour la confidentialité et extraction depuis un texte</caption>
 * const emailUtil = new NEmail();
 * console.log(emailUtil.mask('jean.dupont@gmail.com')); // 'je*******nt@gmail.com'
 * console.log(emailUtil.extractFromText('Écrivez à support@nlib.dev ou info@nlib.dev'));
 * // ['support@nlib.dev', 'info@nlib.dev']
 */
export class NEmail {

    // =========================================================================
    // Méthodes publiques — Validation & Vérifications
    // =========================================================================

    /**
     * Vérifie si la valeur fournie est une adresse e-mail syntaxiquement valide
     * (respecte les limites RFC 5321 : partie locale <= 64 caractères, total <= 254 caractères,
     * absence de points consécutifs et domaine avec TLD d'au moins 2 lettres).
     *
     * @param {any} email - Adresse e-mail à tester.
     * @returns {boolean} `true` si l'adresse e-mail est valide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Adresses e-mail valides</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.isValid('user@nlib.dev'));           // true
     * console.log(emailUtil.isValid('prenom.nom+tag@sub.co.uk')); // true
     *
     * @example <caption>Exemple 2 : Adresses e-mail invalides</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.isValid('user..name@nlib.dev'));     // false
     * console.log(emailUtil.isValid('user@domaine'));            // false
     */
    isValid(email) {
        if (typeof email !== 'string') {
            return false;
        }
        const trimmed = email.trim();
        if (trimmed.length < 5 || trimmed.length > 254) {
            return false;
        }
        const atIndex = trimmed.indexOf('@');
        if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf('@')) {
            return false;
        }

        const local = trimmed.slice(0, atIndex);
        const domain = trimmed.slice(atIndex + 1);

        if (local.length === 0 || local.length > 64 || domain.length < 3 || domain.length > 253) {
            return false;
        }
        if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
            return false;
        }
        if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
            return false;
        }
        if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) {
            return false;
        }

        const domainParts = domain.split('.');
        if (domainParts.length < 2) {
            return false;
        }
        for (let i = 0; i < domainParts.length; i++) {
            const label = domainParts[i];
            if (
                label.length === 0 ||
                label.length > 63 ||
                label.startsWith('-') ||
                label.endsWith('-') ||
                !/^[a-zA-Z0-9-]+$/.test(label)
            ) {
                return false;
            }
        }

        const tld = domainParts[domainParts.length - 1];
        return /^[a-zA-Z]{2,}$/.test(tld);
    }

    /**
     * Vérifie si une adresse e-mail appartient à un fournisseur de messagerie grand public gratuit
     * (ex: Gmail, Yahoo, Outlook, Hotmail, iCloud, ProtonMail, Orange, etc.).
     *
     * @param {string} email - Adresse e-mail à vérifier.
     * @param {string[]} [customProviders=[]] - Liste supplémentaire de domaines gratuits à considérer.
     * @returns {boolean} `true` si le domaine est un fournisseur gratuit, sinon `false`.
     *
     * @example <caption>Exemple 1 : Fournisseurs gratuits</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.isFreeProvider('jean@gmail.com'));   // true
     * console.log(emailUtil.isFreeProvider('marc@outlook.fr'));  // true
     *
     * @example <caption>Exemple 2 : Domaine professionnel</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.isFreeProvider('contact@nlib.dev')); // false
     */
    isFreeProvider(email, customProviders = []) {
        const domain = this.getDomain(email);
        if (!domain) {
            return false;
        }
        const freeDomains = [
            'gmail.com', 'googlemail.com',
            'yahoo.com', 'yahoo.fr', 'yahoo.co.uk', 'ymail.com',
            'outlook.com', 'outlook.fr', 'hotmail.com', 'hotmail.fr', 'live.com', 'live.fr', 'msn.com',
            'icloud.com', 'me.com', 'mac.com',
            'proton.me', 'protonmail.com', 'pm.me',
            'aol.com', 'zoho.com', 'gmx.com', 'gmx.fr', 'mail.com', 'yandex.com',
            'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'bbox.fr'
        ];
        if (freeDomains.includes(domain)) {
            return true;
        }
        if (Array.isArray(customProviders) && customProviders.length > 0) {
            return customProviders.some((d) => typeof d === 'string' && d.trim().toLowerCase() === domain);
        }
        return false;
    }

    /**
     * Vérifie si une adresse e-mail est une adresse professionnelle (valide, non gratuite et non jetable).
     *
     * @param {string} email - Adresse e-mail à tester.
     * @returns {boolean} `true` si l'adresse utilise un domaine professionnel/personnalisé.
     *
     * @example <caption>Exemple 1 : Adresse professionnelle</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.isBusiness('direction@nlib.dev')); // true
     *
     * @example <caption>Exemple 2 : Adresse grand public</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.isBusiness('perso@gmail.com'));    // false
     */
    isBusiness(email) {
        if (!this.isValid(email)) {
            return false;
        }
        return !this.isFreeProvider(email) && !this.isDisposable(email);
    }

    /**
     * Vérifie si l'adresse e-mail provient d'un service d'e-mail jetable / temporaire connu.
     *
     * @param {string} email - Adresse e-mail à tester.
     * @param {string[]} [customBlacklist=[]] - Domaines jetables supplémentaires à bloquer.
     * @returns {boolean} `true` si le domaine est identifié comme temporaire/jetable.
     *
     * @example <caption>Exemple 1 : Détecter une adresse jetable</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.isDisposable('test@yopmail.com'));     // true
     * console.log(emailUtil.isDisposable('temp@mailinator.com'));  // true
     *
     * @example <caption>Exemple 2 : Adresse légitime</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.isDisposable('contact@nlib.dev'));     // false
     */
    isDisposable(email, customBlacklist = []) {
        const domain = this.getDomain(email);
        if (!domain) {
            return false;
        }
        const disposableDomains = [
            'yopmail.com', 'yopmail.fr', 'yopmail.net',
            'mailinator.com', 'guerrillamail.com', 'guerrillamail.net',
            '10minutemail.com', 'temp-mail.org', 'tempmail.com', 'tempmail.net',
            'trashmail.com', 'sharklasers.com', 'getnada.com', 'maildrop.cc',
            'dispostable.com', 'fakeinbox.com', 'throwawaymail.com', 'mohmal.com'
        ];
        if (disposableDomains.includes(domain)) {
            return true;
        }
        if (Array.isArray(customBlacklist) && customBlacklist.length > 0) {
            return customBlacklist.some((d) => typeof d === 'string' && d.trim().toLowerCase() === domain);
        }
        return false;
    }

    /**
     * Vérifie si l'adresse e-mail appartient à un domaine (ou une liste de domaines) donné.
     *
     * @param {string} email - Adresse e-mail à vérifier.
     * @param {string|string[]} allowedDomains - Domaine (ex: `'nlib.dev'`) ou tableau de domaines autorisés.
     * @param {boolean} [allowSubdomains=false] - Si `true`, accepte aussi les sous-domaines (ex: `'mail.nlib.dev'`).
     * @returns {boolean} `true` si le domaine correspond, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier l'appartenance à un domaine</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.hasDomain('dev@nlib.dev', 'nlib.dev')); // true
     *
     * @example <caption>Exemple 2 : Autoriser les sous-domaines</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.hasDomain('dev@ team.nlib.dev', 'nlib.dev', false)); // false
     * console.log(emailUtil.hasDomain('dev@team.nlib.dev', 'nlib.dev', true));   // true
     */
    hasDomain(email, allowedDomains, allowSubdomains = false) {
        const domain = this.getDomain(email);
        if (!domain) {
            return false;
        }
        const list = Array.isArray(allowedDomains) ? allowedDomains : [allowedDomains];
        for (let i = 0; i < list.length; i++) {
            const target = typeof list[i] === 'string' ? list[i].trim().toLowerCase().replace(/^@/, '') : '';
            if (!target) {
                continue;
            }
            if (domain === target) {
                return true;
            }
            if (allowSubdomains && domain.endsWith(`.${target}`)) {
                return true;
            }
        }
        return false;
    }

    // =========================================================================
    // Méthodes publiques — Normalisation & Comparaison
    // =========================================================================

    /**
     * Normalise une adresse e-mail (supprime les espaces, convertit en minuscules et,
     * selon les options, retire le sous-adressage `+tag` ou les points pour Gmail).
     *
     * @param {string} email - Adresse e-mail à normaliser.
     * @param {Object} [options={}] - Options de normalisation.
     * @param {boolean} [options.stripPlusTag=false] - Si `true`, retire `+tag` de la partie locale (`user+pub@x.com` -> `user@x.com`).
     * @param {boolean} [options.stripGmailDots=false] - Si `true`, retire les points dans la partie locale pour `gmail.com` / `googlemail.com`.
     * @returns {string} Adresse e-mail normalisée, ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Normalisation standard</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.normalize('  Jean.Dupont@NLib.DEV  ')); // 'jean.dupont@nlib.dev'
     *
     * @example <caption>Exemple 2 : Normalisation canonique (sans +tag ni points Gmail)</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.normalize('jean.dupont+promo@gmail.com', {
     *     stripPlusTag: true,
     *     stripGmailDots: true
     * })); // 'jeandupont@gmail.com'
     */
    normalize(email, options = {}) {
        if (!this.isValid(email)) {
            return '';
        }
        const trimmed = email.trim().toLowerCase();
        const atIndex = trimmed.indexOf('@');
        let local = trimmed.slice(0, atIndex);
        let domain = trimmed.slice(atIndex + 1);

        if (options?.stripPlusTag === true) {
            const plusIndex = local.indexOf('+');
            if (plusIndex > 0) {
                local = local.slice(0, plusIndex);
            }
        }

        if (options?.stripGmailDots === true && (domain === 'gmail.com' || domain === 'googlemail.com')) {
            local = local.replace(/\./g, '');
            domain = 'gmail.com';
        }

        return `${local}@${domain}`;
    }

    /**
     * Compare deux adresses e-mail après normalisation.
     *
     * @param {string} emailA - Première adresse e-mail.
     * @param {string} emailB - Seconde adresse e-mail.
     * @param {Object} [options={}] - Options de comparaison (`stripPlusTag`, `stripGmailDots`).
     * @returns {boolean} `true` si les deux adresses sont équivalentes, sinon `false`.
     *
     * @example <caption>Exemple 1 : Comparaison insensible à la casse et aux espaces</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.equals('Contact@NLib.dev', '  contact@nlib.dev ')); // true
     *
     * @example <caption>Exemple 2 : Comparaison en ignorant le +tag</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.equals('user+test@nlib.dev', 'user@nlib.dev', { stripPlusTag: true })); // true
     */
    equals(emailA, emailB, options = {}) {
        const normA = this.normalize(emailA, options);
        const normB = this.normalize(emailB, options);
        if (!normA || !normB) {
            return false;
        }
        return normA === normB;
    }

    // =========================================================================
    // Méthodes publiques — Extraction de Composants (Parsing)
    // =========================================================================

    /**
     * Analyse une adresse e-mail et retourne un objet contenant ses différents composants,
     * ou `null` si l'adresse est invalide.
     *
     * @param {string} email - Adresse e-mail à décomposer.
     * @returns {{ email: string, local: string, baseLocal: string, tag: string|null, domain: string, tld: string }|null} Composants de l'e-mail ou `null`.
     *
     * @example <caption>Exemple 1 : Décomposer une adresse avec sous-adressage (+tag)</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.parse('Client+Facture@Boutique.fr'));
     * // {
     * //   email: 'client+facture@boutique.fr',
     * //   local: 'client+facture',
     * //   baseLocal: 'client',
     * //   tag: 'facture',
     * //   domain: 'boutique.fr',
     * //   tld: 'fr'
     * // }
     *
     * @example <caption>Exemple 2 : Adresse invalide retourne null</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.parse('invalide@')); // null
     */
    parse(email) {
        if (!this.isValid(email)) {
            return null;
        }
        const normalized = this.normalize(email);
        const [local, domain] = normalized.split('@');
        const plusIndex = local.indexOf('+');
        const baseLocal = plusIndex !== -1 ? local.slice(0, plusIndex) : local;
        const tag = plusIndex !== -1 ? local.slice(plusIndex + 1) : null;
        const domainParts = domain.split('.');
        const tld = domainParts[domainParts.length - 1];

        return {
            email: normalized,
            local,
            baseLocal,
            tag,
            domain,
            tld
        };
    }

    /**
     * Extrait la partie locale (avant `@`) d'une adresse e-mail.
     *
     * @param {string} email - Adresse e-mail cible.
     * @param {boolean} [stripPlusTag=false] - Si `true`, retire le suffixe `+tag`.
     * @returns {string} Partie locale ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Extraire la partie locale</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.getLocalPart('admin+alerte@nlib.dev')); // 'admin+alerte'
     *
     * @example <caption>Exemple 2 : Extraire sans le +tag</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.getLocalPart('admin+alerte@nlib.dev', true)); // 'admin'
     */
    getLocalPart(email, stripPlusTag = false) {
        const parsed = this.parse(email);
        if (!parsed) {
            return '';
        }
        return stripPlusTag ? parsed.baseLocal : parsed.local;
    }

    /**
     * Extrait le domaine (après `@`, en minuscules) d'une adresse e-mail.
     *
     * @param {string} email - Adresse e-mail cible.
     * @returns {string} Domaine ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Extraire le domaine</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.getDomain('contact@NLib.dev')); // 'nlib.dev'
     *
     * @example <caption>Exemple 2 : E-mail invalide</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.getDomain('sans-domaine')); // ''
     */
    getDomain(email) {
        const parsed = this.parse(email);
        return parsed ? parsed.domain : '';
    }

    /**
     * Extrait l'extension de premier niveau (TLD, ex: `'com'`, `'fr'`, `'dev'`) d'une adresse e-mail.
     *
     * @param {string} email - Adresse e-mail cible.
     * @returns {string} Extension TLD ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Extraire le TLD</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.getTld('info@entreprise.sn')); // 'sn'
     *
     * @example <caption>Exemple 2 : Domaine invalide</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.getTld('info@entreprise')); // ''
     */
    getTld(email) {
        const parsed = this.parse(email);
        return parsed ? parsed.tld : '';
    }

    // =========================================================================
    // Méthodes publiques — Masquage, Formatage & Extraction de Texte
    // =========================================================================

    /**
     * Masque partiellement une adresse e-mail pour protéger la vie privée lors de l'affichage
     * (ex: `'jean.dupont@gmail.com'` -> `'je*******nt@gmail.com'`).
     *
     * @param {string} email - Adresse e-mail à masquer.
     * @param {Object} [options={}] - Options de masquage.
     * @param {string} [options.maskChar='*'] - Caractère de masquage.
     * @param {number} [options.visibleStart=2] - Nombre de caractères visibles au début de la partie locale.
     * @param {number} [options.visibleEnd=1] - Nombre de caractères visibles à la fin de la partie locale.
     * @param {boolean} [options.maskDomain=false] - Si `true`, masque également le nom de domaine (hors TLD).
     * @returns {string} Adresse e-mail masquée, ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Masquage standard de la partie locale</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.mask('contact@nlib.dev')); // 'co****t@nlib.dev'
     *
     * @example <caption>Exemple 2 : Masquage incluant le domaine</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.mask('contact@nlib.dev', { maskDomain: true })); // 'co****t@n***.dev'
     */
    mask(email, options = {}) {
        const parsed = this.parse(email);
        if (!parsed) {
            return '';
        }
        const maskChar = typeof options?.maskChar === 'string' && options.maskChar.length > 0 ? options.maskChar[0] : '*';
        const visibleStart = Math.max(1, Math.trunc(options?.visibleStart ?? 2));
        const visibleEnd = Math.max(0, Math.trunc(options?.visibleEnd ?? 1));
        const maskDomain = options?.maskDomain ?? false;

        const local = parsed.local;
        let maskedLocal;
        if (local.length <= 2) {
            maskedLocal = `${local[0]}${maskChar}`;
        } else if (local.length <= visibleStart + visibleEnd) {
            maskedLocal = `${local[0]}${maskChar.repeat(local.length - 1)}`;
        } else {
            const start = local.slice(0, visibleStart);
            const end = visibleEnd > 0 ? local.slice(local.length - visibleEnd) : '';
            const middleLength = local.length - visibleStart - visibleEnd;
            maskedLocal = `${start}${maskChar.repeat(middleLength)}${end}`;
        }

        if (!maskDomain) {
            return `${maskedLocal}@${parsed.domain}`;
        }

        const lastDot = parsed.domain.lastIndexOf('.');
        const domainName = parsed.domain.slice(0, lastDot);
        const tld = parsed.domain.slice(lastDot + 1);
        const maskedDomainName = domainName.length <= 1
            ? maskChar
            : `${domainName[0]}${maskChar.repeat(domainName.length - 1)}`;

        return `${maskedLocal}@${maskedDomainName}.${tld}`;
    }

    /**
     * Formate une adresse e-mail avec un nom d'affichage au standard RFC 5322
     * (ex: `'Jean Dupont <jean@nlib.dev>'`).
     *
     * @param {string} email - Adresse e-mail.
     * @param {string} [displayName=''] - Nom complet de l'expéditeur ou destinataire.
     * @returns {string} Adresse formatée, ou `''` si l'e-mail est invalide.
     *
     * @example <caption>Exemple 1 : Avec nom d'affichage</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.formatDisplay('support@nlib.dev', 'Support NLib'));
     * // 'Support NLib <support@nlib.dev>'
     *
     * @example <caption>Exemple 2 : Sans nom d'affichage</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.formatDisplay('  Support@NLib.dev ')); // 'support@nlib.dev'
     */
    formatDisplay(email, displayName = '') {
        const normalized = this.normalize(email);
        if (!normalized) {
            return '';
        }
        if (typeof displayName !== 'string' || displayName.trim().length === 0) {
            return normalized;
        }
        const cleanName = displayName.trim().replace(/"/g, '\\"');
        return /[,<>@;:\\"]/.test(cleanName)
            ? `"${cleanName}" <${normalized}>`
            : `${cleanName} <${normalized}>`;
    }

    /**
     * Extrait toutes les adresses e-mail valides présentes dans un texte libre.
     *
     * @param {string} text - Texte dans lequel rechercher des adresses e-mail.
     * @param {boolean} [unique=true] - Si `true`, dédoublonne les adresses trouvées (après normalisation).
     * @returns {string[]} Tableau des adresses e-mail extraites.
     *
     * @example <caption>Exemple 1 : Extraire les e-mails d'une phrase</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.extractFromText('Contactez dev@nlib.dev ou sales@nlib.dev.'));
     * // ['dev@nlib.dev', 'sales@nlib.dev']
     *
     * @example <caption>Exemple 2 : Dédoublonnage automatique</caption>
     * const emailUtil = new NEmail();
     * console.log(emailUtil.extractFromText('Écrire à INFO@nlib.dev et info@nlib.dev'));
     * // ['info@nlib.dev']
     */
    extractFromText(text, unique = true) {
        if (typeof text !== 'string' || text.length === 0) {
            return [];
        }
        const candidates = text.match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g) || [];
        const results = [];
        const seen = new Set();

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i].replace(/\.+$/, '');
            if (this.isValid(candidate)) {
                const normalized = this.normalize(candidate);
                if (!unique || !seen.has(normalized)) {
                    seen.add(normalized);
                    results.push(normalized);
                }
            }
        }
        return results;
    }
}

export default NEmail;

