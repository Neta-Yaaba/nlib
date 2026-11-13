/**
 * @file NPhoneNumber.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation, le nettoyage, la normalisation (E.164),
 * l'extraction d'indicatif pays, la comparaison, le formatage, le masquage et la génération de liens
 * (`tel:`, `sms:`, WhatsApp) des numéros de téléphone dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

import { NUtil } from './NUtil.js';

/**
 * @class NPhoneNumber
 * @description Utilitaire de gestion et traitement des numéros de téléphone sans état interne.
 *
 * @example <caption>Exemple 1 : Validation et normalisation au standard international E.164</caption>
 * const phoneUtil = new NPhoneNumber();
 * console.log(phoneUtil.isValid('+226 70 12 34 56'));              // true
 * console.log(phoneUtil.toE164('70 12 34 56', '226'));             // '+22670123456'
 * console.log(phoneUtil.toE164('0033 6 12 34 56 78'));             // '+33612345678'
 *
 * @example <caption>Exemple 2 : Formatage par groupes et masquage de confidentialité</caption>
 * const phoneUtil = new NPhoneNumber();
 * console.log(phoneUtil.format('70123456', { groupSize: 2 }));     // '70 12 34 56'
 * console.log(phoneUtil.mask('+22670123456'));                     // '+226****3456'
 *
 * @example <caption>Exemple 3 : Comparaison et liens d'appel / WhatsApp</caption>
 * const phoneUtil = new NPhoneNumber();
 * console.log(phoneUtil.equals('00226 70-12-34-56', '+22670123456')); // true
 * console.log(phoneUtil.toWhatsAppUrl('+226 70 12 34 56', 'Bonjour'));
 * // 'https://wa.me/22670123456?text=Bonjour'
 */
export class NPhoneNumber {

    // =========================================================================
    // Méthodes publiques — Nettoyage & Validation
    // =========================================================================

    /**
     * Nettoie un numéro de téléphone en supprimant tous les espaces, tirets, points et parenthèses.
     * Convertit également le préfixe international `'00'` en `'+'` (si `keepPlus = true`).
     *
     * @param {string|number} phone - Numéro de téléphone à nettoyer.
     * @param {boolean} [keepPlus=true] - Si `true`, conserve le signe `'+'` initial ; sinon ne garde que les chiffres.
     * @returns {string} Numéro nettoyé, ou `''` si l'entrée est invalide.
     *
     * @example <caption>Exemple 1 : Nettoyer avec conservation du '+'</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.clean('00226 (70) 12-34-56')); // '+22670123456'
     *
     * @example <caption>Exemple 2 : Extraire uniquement les chiffres</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.clean('+33 6 12 34 56 78', false)); // '33612345678'
     */
    clean(phone, keepPlus = true) {
        if (typeof phone === 'number' && Number.isFinite(phone)) {
            return String(Math.trunc(Math.abs(phone)));
        }
        if (typeof phone !== 'string') {
            return '';
        }
        let str = phone.trim();
        if (str.length === 0) {
            return '';
        }
        if (str.startsWith('00')) {
            str = `+${str.slice(2)}`;
        }
        const hasPlus = str.startsWith('+');
        const digits = str.replace(/\D/g, '');
        if (!digits) {
            return '';
        }
        return (keepPlus && hasPlus) ? `+${digits}` : digits;
    }

    /**
     * Vérifie si la valeur fournie est un numéro de téléphone valide.
     * Par défaut, accepte de `7` à `15` chiffres (norme ITU-T E.164).
     *
     * @param {any} phone - Numéro de téléphone à tester.
     * @param {Object} [options={}] - Options de validation.
     * @param {number} [options.minLength=7] - Nombre minimum de chiffres.
     * @param {number} [options.maxLength=15] - Nombre maximum de chiffres (15 selon E.164).
     * @param {boolean} [options.requireCountryCode=false] - Si `true`, exige la présence d'un `'+'` ou `'00'` en tête.
     * @param {string} [options.countryCode] - Si fourni (ex: `'226'` ou `'+226'`), vérifie que le numéro commence par cet indicatif.
     * @returns {boolean} `true` si le numéro est valide, sinon `false`.
     *
     * @example <caption>Exemple 1 : Validation standard</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.isValid('+226 70 12 34 56')); // true
     * console.log(phoneUtil.isValid('70 12 34 56'));      // true
     *
     * @example <caption>Exemple 2 : Validation avec indicatif obligatoire</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.isValid('70 12 34 56', { requireCountryCode: true })); // false
     * console.log(phoneUtil.isValid('+226 70 12 34 56', { countryCode: '226' }));  // true
     */
    isValid(phone, options = {}) {
        if (typeof phone !== 'string' && typeof phone !== 'number') {
            return false;
        }
        const rawStr = String(phone).trim();
        // Rejeter si la chaîne contient des lettres alphabétiques
        if (/[a-zA-Z]/.test(rawStr)) {
            return false;
        }

        const cleaned = this.clean(rawStr, true);
        if (!cleaned) {
            return false;
        }

        const requireCountryCode = options?.requireCountryCode ?? false;
        if (requireCountryCode && !cleaned.startsWith('+')) {
            return false;
        }

        const digits = cleaned.replace(/\D/g, '');
        const minLength = Math.max(3, Math.trunc(options?.minLength ?? 7));
        const maxLength = Math.max(minLength, Math.trunc(options?.maxLength ?? 15));

        if (digits.length < minLength || digits.length > maxLength) {
            return false;
        }

        if (typeof options?.countryCode === 'string' && options.countryCode.trim().length > 0) {
            const cc = options.countryCode.replace(/\D/g, '');
            if (cc && !digits.startsWith(cc)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Vérifie si le numéro de téléphone est strictement au format international E.164
     * (commence par `'+'` suivi de 7 à 15 chiffres sans aucun espace, le premier chiffre après `'+'` n'étant pas `'0'`).
     *
     * @param {any} phone - Numéro à tester.
     * @returns {boolean} `true` si le numéro respecte strictement E.164, sinon `false`.
     *
     * @example <caption>Exemple 1 : Numéro E.164 valide</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.isE164('+22670123456')); // true
     *
     * @example <caption>Exemple 2 : Numéro avec espaces ou sans '+'</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.isE164('+226 70 12 34 56')); // false
     * console.log(phoneUtil.isE164('22670123456'));      // false
     */
    isE164(phone) {
        if (typeof phone !== 'string') {
            return false;
        }
        return /^\+[1-9]\d{6,14}$/.test(phone);
    }

    // =========================================================================
    // Méthodes publiques — Normalisation, Indicatif & Comparaison
    // =========================================================================

    /**
     * Convertit un numéro de téléphone (local ou international) au format standard E.164 (`+XXXXXXXXXXX`).
     * Si le numéro est local et qu'un `defaultCountryCode` est fourni, le zéro initial national éventuel
     * (ex: `'06...'` en France / Côte d'Ivoire selon l'option `stripLeadingZero`) est retiré avant d'ajouter `+<indicatif>`.
     *
     * @param {string|number} phone - Numéro de téléphone à convertir.
     * @param {string|number} [defaultCountryCode=''] - Indicatif pays par défaut (ex: `'226'`, `'225'`, `'33'`, `'221'`).
     * @param {boolean} [stripLeadingZero=true] - Si `true`, retire un `'0'` initial sur un numéro local lors de l'ajout de l'indicatif.
     * @returns {string} Numéro au format E.164 (ex: `'+22670123456'`), ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Numéro local avec indicatif par défaut</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.toE164('70 12 34 56', '226'));    // '+22670123456'
     * console.log(phoneUtil.toE164('06 12 34 56 78', '33'));  // '+33612345678'
     *
     * @example <caption>Exemple 2 : Numéro commençant par 00</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.toE164('00221 77 123 45 67'));    // '+221771234567'
     */
    toE164(phone, defaultCountryCode = '', stripLeadingZero = true) {
        const cleaned = this.clean(phone, true);
        if (!cleaned) {
            return '';
        }

        const cc = String(defaultCountryCode).replace(/\D/g, '');

        if (cleaned.startsWith('+')) {
            return this.isE164(cleaned) ? cleaned : '';
        }

        let digits = cleaned;
        if (cc) {
            if (!digits.startsWith(cc)) {
                if (stripLeadingZero && digits.startsWith('0')) {
                    digits = digits.slice(1);
                }
                digits = `${cc}${digits}`;
            }
        }

        const candidate = `+${digits}`;
        return this.isE164(candidate) ? candidate : '';
    }

    /**
     * Extrait le numéro national (local) en retirant l'indicatif pays spécifié (ou détecté).
     *
     * @param {string|number} phone - Numéro de téléphone complet.
     * @param {string|number} [countryCode=''] - Indicatif pays à retirer (ex: `'226'`, `'33'`).
     * @param {string} [nationalPrefix=''] - Préfixe national à rajouter en tête si nécessaire (ex: `'0'`).
     * @returns {string} Numéro national sous forme de chiffres, ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Extraire le numéro local à partir d'un numéro +226</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.toNational('+226 70 12 34 56', '226')); // '70123456'
     *
     * @example <caption>Exemple 2 : Extraire avec préfixe national '0' (ex: France +33)</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.toNational('+33612345678', '33', '0')); // '0612345678'
     */
    toNational(phone, countryCode = '', nationalPrefix = '') {
        const digits = this.clean(phone, false);
        if (!digits) {
            return '';
        }
        const cc = String(countryCode).replace(/\D/g, '');
        let local = digits;
        if (cc && local.startsWith(cc) && local.length > cc.length) {
            local = local.slice(cc.length);
        }
        if (nationalPrefix && !local.startsWith(nationalPrefix)) {
            local = `${nationalPrefix}${local}`;
        }
        return local;
    }

    /**
     * Compare deux numéros de téléphone pour vérifier s'ils désignent la même ligne.
     *
     * @param {string|number} phoneA - Premier numéro.
     * @param {string|number} phoneB - Second numéro.
     * @param {string|number} [defaultCountryCode=''] - Indicatif pays par défaut pour normaliser un numéro local avant comparaison.
     * @returns {boolean} `true` si les deux numéros sont identiques, sinon `false`.
     *
     * @example <caption>Exemple 1 : Comparer deux écritures internationales</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.equals('00226 70 12 34 56', '+226-70-12-34-56')); // true
     *
     * @example <caption>Exemple 2 : Comparer un numéro local et un numéro international</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.equals('70 12 34 56', '+22670123456', '226')); // true
     */
    equals(phoneA, phoneB, defaultCountryCode = '') {
        if (!this.isValid(phoneA) || !this.isValid(phoneB)) {
            return false;
        }
        if (defaultCountryCode) {
            const e164A = this.toE164(phoneA, defaultCountryCode);
            const e164B = this.toE164(phoneB, defaultCountryCode);
            if (e164A && e164B) {
                return e164A === e164B;
            }
        }
        const digitsA = this.clean(phoneA, false);
        const digitsB = this.clean(phoneB, false);
        return digitsA.length > 0 && digitsA === digitsB;
    }

    // =========================================================================
    // Méthodes publiques — Formatage, Masquage & Liens (tel:, sms:, WhatsApp)
    // =========================================================================

    /**
     * Formate un numéro de téléphone en groupant ses chiffres pour faciliter la lecture.
     *
     * @param {string|number} phone - Numéro de téléphone à formater.
     * @param {Object} [options={}] - Options de formatage.
     * @param {number} [options.groupSize=2] - Taille des groupes de chiffres (ex: `2` -> `'70 12 34 56'`).
     * @param {string} [options.separator=' '] - Séparateur entre les groupes (`' '`, `'-'`, `'.'`).
     * @param {string|number} [options.countryCode=''] - Si fourni, affiche `+<countryCode>` détaché devant les groupes du numéro local.
     * @returns {string} Numéro formaté, ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Groupement par paires (standard francophone / UEMOA)</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.format('70123456')); // '70 12 34 56'
     *
     * @example <caption>Exemple 2 : Formatage international avec indicatif détaché</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.format('+22670123456', { countryCode: '226', separator: ' ' }));
     * // '+226 70 12 34 56'
     */
    format(phone, options = {}) {
        const cleaned = this.clean(phone, true);
        if (!cleaned) {
            return '';
        }

        const groupSize = Math.max(1, Math.trunc(options?.groupSize ?? 2));
        const separator = options?.separator ?? ' ';
        const cc = options?.countryCode ? String(options.countryCode).replace(/\D/g, '') : '';

        let prefix = '';
        let digits = cleaned.replace(/\D/g, '');

        if (cc && digits.startsWith(cc) && digits.length > cc.length) {
            prefix = `+${cc}`;
            digits = digits.slice(cc.length);
        } else if (cleaned.startsWith('+')) {
            prefix = '+';
        }

        const regex = new RegExp(`.{1,${groupSize}}`, 'g');
        const grouped = (digits.match(regex) || []).join(separator);

        if (prefix.length > 1) {
            return `${prefix}${separator}${grouped}`;
        }
        return `${prefix}${grouped}`;
    }

    /**
     * Masque partiellement un numéro de téléphone pour l'affichage sécurisé (ex: OTP, récupération de compte).
     *
     * @param {string|number} phone - Numéro de téléphone à masquer.
     * @param {Object} [options={}] - Options de masquage.
     * @param {string} [options.maskChar='*'] - Caractère de masquage.
     * @param {number} [options.visibleStart=4] - Nombre de caractères visibles au début (incluant `'+'` s'il est présent).
     * @param {number} [options.visibleEnd=2] - Nombre de chiffres visibles à la fin.
     * @returns {string} Numéro masqué, ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Masquer un numéro international</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.mask('+22670123456')); // '+226******56'
     *
     * @example <caption>Exemple 2 : Personnaliser le nombre de chiffres visibles</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.mask('70123456', { visibleStart: 2, visibleEnd: 2 })); // '70****56'
     */
    mask(phone, options = {}) {
        const cleaned = this.clean(phone, true);
        if (!cleaned) {
            return '';
        }

        const maskChar = typeof options?.maskChar === 'string' && options.maskChar.length > 0 ? options.maskChar[0] : '*';
        const visibleStart = Math.max(0, Math.trunc(options?.visibleStart ?? 4));
        const visibleEnd = Math.max(0, Math.trunc(options?.visibleEnd ?? 2));

        if (cleaned.length <= visibleStart + visibleEnd) {
            return maskChar.repeat(cleaned.length);
        }

        const start = cleaned.slice(0, visibleStart);
        const end = visibleEnd > 0 ? cleaned.slice(cleaned.length - visibleEnd) : '';
        const hiddenCount = cleaned.length - visibleStart - visibleEnd;

        return `${start}${maskChar.repeat(hiddenCount)}${end}`;
    }

    /**
     * Génère un lien URI `tel:` ou `sms:` standard à partir d'un numéro de téléphone.
     *
     * @param {string|number} phone - Numéro de téléphone.
     * @param {'tel'|'sms'} [scheme='tel'] - Protocole URI (`'tel'` ou `'sms'`).
     * @returns {string} URI (ex: `'tel:+22670123456'`), ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Lien d'appel téléphonique</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.toTelUri('+226 70 12 34 56')); // 'tel:+22670123456'
     *
     * @example <caption>Exemple 2 : Lien SMS</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.toTelUri('+226 70 12 34 56', 'sms')); // 'sms:+22670123456'
     */
    toTelUri(phone, scheme = 'tel') {
        const cleaned = this.clean(phone, true);
        if (!cleaned) {
            return '';
        }
        const protocol = scheme === 'sms' ? 'sms' : 'tel';
        return `${protocol}:${cleaned}`;
    }

    /**
     * Génère une URL directe WhatsApp (`https://wa.me/...`) avec un message pré-rempli optionnel.
     *
     * @param {string|number} phone - Numéro de téléphone (avec indicatif pays).
     * @param {string} [message=''] - Texte optionnel à pré-remplir.
     * @returns {string} URL WhatsApp valide, ou `''` si le numéro est invalide.
     *
     * @example <caption>Exemple 1 : Lien WhatsApp simple</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.toWhatsAppUrl('+226 70 12 34 56'));
     * // 'https://wa.me/22670123456'
     *
     * @example <caption>Exemple 2 : Lien WhatsApp avec message encodé</caption>
     * const phoneUtil = new NPhoneNumber();
     * console.log(phoneUtil.toWhatsAppUrl('+226 70 12 34 56', 'Bonjour NLib !'));
     * // 'https://wa.me/22670123456?text=Bonjour%20NLib%20!'
     */
    toWhatsAppUrl(phone, message = '') {
        const digits = this.clean(phone, false);
        if (!digits || digits.length < 7) {
            return '';
        }
        const baseUrl = `https://wa.me/${digits}`;
        if (typeof message === 'string' && message.trim().length > 0) {
            return `${baseUrl}?text=${encodeURIComponent(message)}`;
        }
        return baseUrl;
    }
}

export default NPhoneNumber;

