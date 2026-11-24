/**
 * @file NEnv.js
 * @package @nlib/js-backend
 * @description Classe utilitaire statique d'inspection et de détection de l'environnement d'exécution matériel
 * et logiciel dans l'écosystème NLib :
 * - Type d'environnement (`browser`, `node`, `worker`, `unknown`)
 * - Système d'exploitation (`android`, `harmonyos`, `ios`, `windows`, `macos`, `linux`, `unknown`)
 * - Navigateur (`edge`, `opera`, `firefox`, `chrome`, `safari`, `unknown`)
 * - Type d'appareil (`isMobile`, `isTablet`, `isDesktop`, `isTouch`)
 * - Hôte natif / WebView (`isWebView`)
 * - État réseau et préférences système (`isOnline`, `isOffline`, `isSecureContext`, `isDarkMode`, `language`, `timezone`).
 */

/**
 * @class NEnv
 * @description Utilitaire statique fournissant toutes les informations sur l'environnement d'exécution
 * (plateforme, OS, navigateur, WebView, appareil mobile, connexion Internet).
 *
 * @example <caption>Exemple 1 : Détecter le type d'environnement, l'OS et le navigateur</caption>
 * console.log(NEnv.type);    // 'browser' | 'node' | 'worker' | 'unknown'
 * console.log(NEnv.os);      // 'windows' | 'android' | 'ios' | 'macos' | 'linux' | 'harmonyos'
 * console.log(NEnv.browser); // 'chrome' | 'edge' | 'firefox' | 'safari' | 'opera' | 'unknown'
 *
 * @example <caption>Exemple 2 : Vérifier le type d'appareil, WebView et l'état de la connexion</caption>
 * console.log(NEnv.isMobile);  // true / false
 * console.log(NEnv.isWebView); // true si exécuté dans le conteneur OS natif NLib
 * console.log(NEnv.isOnline);  // true si connecté au réseau
 *
 * @example <caption>Exemple 3 : Utilisation directe Accès direct via NEnv</caption>
 * console.log(NEnv.os);
 * console.log(NEnv.info);
 */
export class NEnv {

    // =========================================================================
    // Getters statiques — Type d'Environnement (Runtime)
    // =========================================================================

    /**
     * Retourne le type d'environnement d'exécution JavaScript actuel :
     * `'browser'`, `'node'`, `'worker'` ou `'unknown'`.
     *
     * @returns {'browser'|'node'|'worker'|'unknown'} Type d'environnement.
     *
     * @example <caption>Exemple 1 : Lire le type d'environnement</caption>
     * console.log(NEnv.type); // 'browser' ou 'node'
     *
     * @example <caption>Exemple 2 : Accès direct via NEnv</caption>
     * console.log(NEnv.type !== 'unknown');
     */
    static get type() {
        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            return 'browser';
        }
        if (typeof process !== 'undefined' && process.versions?.node) {
            return 'node';
        }
        if (typeof self === 'object' && typeof self.importScripts === 'function') {
            return 'worker';
        }
        return 'unknown';
    }

    /**
     * Indique si le code s'exécute dans un navigateur ou WebView (`type === 'browser'`).
     *
     * @returns {boolean} `true` si exécuté dans un navigateur.
     *
     * @example <caption>Exemple 1 : Vérifier si l'environnement est un navigateur</caption>
     * if (NEnv.isBrowser) { console.log('DOM disponible'); }
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NEnv.isBrowser); // 'boolean'
     */
    static get isBrowser() {
        return NEnv.type === 'browser';
    }

    /**
     * Indique si le code s'exécute sous Node.js (`type === 'node'`).
     *
     * @returns {boolean} `true` si exécuté sous Node.js.
     *
     * @example <caption>Exemple 1 : Vérifier si l'environnement est Node.js</caption>
     * if (NEnv.isNode) { console.log('Serveur Node.js'); }
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NEnv.isNode); // 'boolean'
     */
    static get isNode() {
        return NEnv.type === 'node';
    }

    /**
     * Indique si le code s'exécute dans un Web Worker ou Service Worker (`type === 'worker'`).
     *
     * @returns {boolean} `true` si exécuté dans un Worker.
     *
     * @example <caption>Exemple 1 : Vérifier si l'environnement est un Worker</caption>
     * if (NEnv.isWorker) { console.log('Web Worker actif'); }
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NEnv.isWorker); // 'boolean'
     */
    static get isWorker() {
        return NEnv.type === 'worker';
    }

    // =========================================================================
    // Getters statiques — Système d'Exploitation (OS)
    // =========================================================================

    /**
     * Détecte le système d'exploitation courant parmi les 6 OS supportés par NLib :
     * `'android'`, `'harmonyos'`, `'ios'`, `'windows'`, `'macos'`, `'linux'` ou `'unknown'`.
     * Fonctionne aussi bien dans le navigateur (`navigator.userAgent`) que sous Node.js (`process.platform`).
     *
     * @returns {'android'|'harmonyos'|'ios'|'windows'|'macos'|'linux'|'unknown'} Nom de l'OS.
     *
     * @example <caption>Exemple 1 : Obtenir le système d'exploitation</caption>
     * console.log(NEnv.os); // ex: 'windows', 'android', 'ios', etc.
     *
     * @example <caption>Exemple 2 : Adapter un comportement selon l'OS</caption>
     * const isApple = NEnv.os === 'ios' || NEnv.os === 'macos';
     */
    static get os() {
        if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
            const ua = navigator.userAgent.toLowerCase();

            if (ua.includes('openharmony') || ua.includes('harmonyos') || ua.includes('arkweb')) {
                return 'harmonyos';
            }
            if (ua.includes('android')) {
                return 'android';
            }
            if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
                return 'ios';
            }
            if (ua.includes('windows')) {
                return 'windows';
            }
            if (ua.includes('mac os') || ua.includes('macintosh')) {
                if (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1) {
                    return 'ios';
                }
                return 'macos';
            }
            if (ua.includes('linux')) {
                return 'linux';
            }
        }

        if (typeof process !== 'undefined' && typeof process.platform === 'string') {
            const p = process.platform.toLowerCase();
            if (p === 'win32') return 'windows';
            if (p === 'darwin') return 'macos';
            if (p === 'android') return 'android';
            if (p === 'linux') return 'linux';
        }

        return 'unknown';
    }

    /**
     * Indique si le système d'exploitation est Android.
     *
     * @returns {boolean} `true` sur Android.
     *
     * @example <caption>Exemple 1 : Tester Android</caption>
     * console.log(NEnv.isAndroid);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * console.log(NEnv.isAndroid === (NEnv.os === 'android')); // true
     */
    static get isAndroid() {
        return NEnv.os === 'android';
    }

    /**
     * Indique si le système d'exploitation est HarmonyOS (OpenHarmony).
     *
     * @returns {boolean} `true` sur HarmonyOS.
     *
     * @example <caption>Exemple 1 : Tester HarmonyOS</caption>
     * console.log(NEnv.isHarmonyOS);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * console.log(NEnv.isHarmonyOS === (NEnv.os === 'harmonyos')); // true
     */
    static get isHarmonyOS() {
        return NEnv.os === 'harmonyos';
    }

    /**
     * Indique si le système d'exploitation est iOS / iPadOS.
     *
     * @returns {boolean} `true` sur iOS / iPadOS.
     *
     * @example <caption>Exemple 1 : Tester iOS</caption>
     * console.log(NEnv.isIOS);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * console.log(NEnv.isIOS === (NEnv.os === 'ios')); // true
     */
    static get isIOS() {
        return NEnv.os === 'ios';
    }

    /**
     * Indique si le système d'exploitation est Windows.
     *
     * @returns {boolean} `true` sur Windows.
     *
     * @example <caption>Exemple 1 : Tester Windows</caption>
     * console.log(NEnv.isWindows);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * console.log(NEnv.isWindows === (NEnv.os === 'windows')); // true
     */
    static get isWindows() {
        return NEnv.os === 'windows';
    }

    /**
     * Indique si le système d'exploitation est macOS.
     *
     * @returns {boolean} `true` sur macOS.
     *
     * @example <caption>Exemple 1 : Tester macOS</caption>
     * console.log(NEnv.isMacOS);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * console.log(NEnv.isMacOS === (NEnv.os === 'macos')); // true
     */
    static get isMacOS() {
        return NEnv.os === 'macos';
    }

    /**
     * Indique si le système d'exploitation est Linux.
     *
     * @returns {boolean} `true` sur Linux.
     *
     * @example <caption>Exemple 1 : Tester Linux</caption>
     * console.log(NEnv.isLinux);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * console.log(NEnv.isLinux === (NEnv.os === 'linux')); // true
     */
    static get isLinux() {
        return NEnv.os === 'linux';
    }

    // =========================================================================
    // Getters statiques — Navigateur, WebView & Type d'Appareil
    // =========================================================================

    /**
     * Détecte le navigateur courant : `'edge'`, `'opera'`, `'firefox'`, `'chrome'`, `'safari'` ou `'unknown'`.
     *
     * @returns {'edge'|'opera'|'firefox'|'chrome'|'safari'|'unknown'} Nom du navigateur.
     *
     * @example <caption>Exemple 1 : Obtenir le nom du navigateur</caption>
     * console.log(NEnv.browser); // ex: 'chrome', 'edge', 'firefox', 'safari'
     *
     * @example <caption>Exemple 2 : Sous Node.js retourne 'unknown'</caption>
     * if (NEnv.isNode) { console.log(NEnv.browser); } // 'unknown'
     */
    static get browser() {
        if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
            return 'unknown';
        }

        const ua = navigator.userAgent;

        if (ua.includes('Edg/') || ua.includes('EdgA/') || ua.includes('EdgiOS/')) return 'edge';
        if (ua.includes('OPR/') || ua.includes('Opera/')) return 'opera';
        if (ua.includes('Firefox/') || ua.includes('FxiOS/')) return 'firefox';
        if (ua.includes('Chrome/') || ua.includes('CriOS/')) return 'chrome';
        if (ua.includes('Safari/')) return 'safari';

        return 'unknown';
    }

    /**
     * Indique si l'appareil courant est un appareil mobile (smartphone).
     *
     * @returns {boolean} `true` si l'appareil est mobile.
     *
     * @example <caption>Exemple 1 : Vérifier si l'appareil est mobile</caption>
     * console.log(NEnv.isMobile); // true ou false
     *
     * @example <caption>Exemple 2 : Adapter l'interface</caption>
     * const layout = NEnv.isMobile ? 'compact' : 'wide';
     */
    static get isMobile() {
        return (
            typeof navigator !== 'undefined' &&
            typeof navigator.userAgent === 'string' &&
            /Android|iPhone|iPod|Mobile|HarmonyOS|OpenHarmony/i.test(navigator.userAgent)
        );
    }

    /**
     * Indique si l'appareil courant est une tablette (iPad, tablette Android sans jeton Mobile).
     *
     * @returns {boolean} `true` si l'appareil est une tablette.
     *
     * @example <caption>Exemple 1 : Vérifier si l'appareil est une tablette</caption>
     * console.log(NEnv.isTablet);
     *
     * @example <caption>Exemple 2 : Tester mobile ou tablette</caption>
     * const isHandheld = NEnv.isMobile || NEnv.isTablet;
     */
    static get isTablet() {
        if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
            return false;
        }
        const ua = navigator.userAgent;
        const isIpad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
        const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
        return Boolean(isIpad || isAndroidTablet);
    }

    /**
     * Indique si l'appareil courant est un ordinateur de bureau (`!isMobile && !isTablet`).
     *
     * @returns {boolean} `true` si l'appareil est un ordinateur de bureau.
     *
     * @example <caption>Exemple 1 : Vérifier le mode Desktop</caption>
     * console.log(NEnv.isDesktop);
     *
     * @example <caption>Exemple 2 : Exclusif avec mobile et tablette</caption>
     * console.log(NEnv.isDesktop === (!NEnv.isMobile && !NEnv.isTablet)); // true
     */
    static get isDesktop() {
        return !NEnv.isMobile && !NEnv.isTablet;
    }

    /**
     * Indique si l'écran de l'appareil prend en charge les interactions tactiles (`touch`).
     *
     * @returns {boolean} `true` si l'appareil possède un écran tactile.
     *
     * @example <caption>Exemple 1 : Détecter le support tactile</caption>
     * console.log(NEnv.isTouch);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NEnv.isTouch); // 'boolean'
     */
    static get isTouch() {
        if (typeof window === 'undefined' && typeof navigator === 'undefined') {
            return false;
        }
        return (
            (typeof window !== 'undefined' && 'ontouchstart' in window) ||
            (typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints) > 0)
        );
    }

    /**
     * Indique si l'application s'exécute à l'intérieur d'un composant WebView natif
     * (Android WebView, iOS WKWebView, Windows WebView2, Linux WebKitGTK, HarmonyOS ArkWeb).
     *
     * @returns {boolean} `true` si exécuté dans une WebView.
     *
     * @example <caption>Exemple 1 : Détecter l'exécution dans une WebView</caption>
     * console.log(NEnv.isWebView);
     *
     * @example <caption>Exemple 2 : Activer la passerelle native si WebView</caption>
     * if (NEnv.isWebView) { console.log('Conteneur natif détecté'); }
     */
    static get isWebView() {
        if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
            return false;
        }
        const ua = navigator.userAgent;

        if (typeof window !== 'undefined' && window.NLibNativeBridge) {
            return true;
        }

        if (/wv|WebView|ArkWeb/i.test(ua)) {
            return true;
        }
        if (/iPhone|iPod|iPad/i.test(ua) && !/Safari\//i.test(ua)) {
            return true;
        }

        return false;
    }

    // =========================================================================
    // Getters statiques — Connexion Réseau, Sécurité & Préférences Système
    // =========================================================================

    /**
     * Indique si l'appareil dispose actuellement d'une connexion réseau (`navigator.onLine`).
     * Retourne `true` par défaut dans les environnements serveur où `navigator` est absent.
     *
     * @returns {boolean} `true` si en ligne, `false` si hors-ligne.
     *
     * @example <caption>Exemple 1 : Vérifier si l'appareil est en ligne</caption>
     * console.log(NEnv.isOnline); // true
     *
     * @example <caption>Exemple 2 : Basculer entre SQL local et serveur</caption>
     * const target = NEnv.isOnline ? 'remote' : 'local';
     */
    static get isOnline() {
        return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean'
            ? true
            : navigator.onLine;
    }

    /**
     * Indique si l'appareil est actuellement hors-ligne (`!isOnline`).
     *
     * @returns {boolean} `true` si hors-ligne.
     *
     * @example <caption>Exemple 1 : Vérifier le mode hors-ligne</caption>
     * console.log(NEnv.isOffline);
     *
     * @example <caption>Exemple 2 : Opposé de isOnline</caption>
     * console.log(NEnv.isOffline === !NEnv.isOnline); // true
     */
    static get isOffline() {
        return !NEnv.isOnline;
    }

    /**
     * Indique si le contexte d'exécution est sécurisé (`HTTPS`, `localhost`, `file://` ou `Node.js`).
     *
     * @returns {boolean} `true` si le contexte est sécurisé.
     *
     * @example <caption>Exemple 1 : Vérifier le contexte sécurisé</caption>
     * console.log(NEnv.isSecureContext);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NEnv.isSecureContext); // 'boolean'
     */
    static get isSecureContext() {
        if (typeof window !== 'undefined' && typeof window.isSecureContext === 'boolean') {
            return window.isSecureContext;
        }
        return true;
    }

    /**
     * Indique si le système d'exploitation de l'utilisateur préfère le thème sombre (`prefers-color-scheme: dark`).
     *
     * @returns {boolean} `true` si le mode sombre est activé sur le système.
     *
     * @example <caption>Exemple 1 : Détecter le thème sombre du système</caption>
     * console.log(NEnv.isDarkMode);
     *
     * @example <caption>Exemple 2 : Choisir le thème par défaut</caption>
     * const theme = NEnv.isDarkMode ? 'dark' : 'light';
     */
    static get isDarkMode() {
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    }

    /**
     * Retourne le code de langue principal du système ou du navigateur (ex: `'fr-FR'`, `'fr'`, `'en-US'`).
     *
     * @returns {string} Code de langue (par défaut `'fr'`).
     *
     * @example <caption>Exemple 1 : Lire la langue de l'environnement</caption>
     * console.log(NEnv.language); // ex: 'fr-FR'
     *
     * @example <caption>Exemple 2 : Toujours une chaîne non vide</caption>
     * console.log(NEnv.language.length > 0); // true
     */
    static get language() {
        if (typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.length > 0) {
            return navigator.language;
        }
        if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
            const locale = Intl.DateTimeFormat().resolvedOptions()?.locale;
            if (locale) return locale;
        }
        return 'fr';
    }

    /**
     * Retourne le fuseau horaire IANA du système (ex: `'Africa/Ouagadougou'`, `'Europe/Paris'`, `'UTC'`).
     *
     * @returns {string} Fuseau horaire IANA.
     *
     * @example <caption>Exemple 1 : Obtenir le fuseau horaire</caption>
     * console.log(NEnv.timezone); // ex: 'Africa/Ouagadougou'
     *
     * @example <caption>Exemple 2 : Toujours une chaîne non vide</caption>
     * console.log(typeof NEnv.timezone); // 'string'
     */
    static get timezone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch {
            return 'UTC';
        }
    }

    /**
     * Retourne la chaîne `userAgent` brute du navigateur ou de l'environnement (ou `''` si absente).
     *
     * @returns {string} Chaîne User-Agent.
     *
     * @example <caption>Exemple 1 : Lire le User-Agent</caption>
     * console.log(typeof NEnv.userAgent); // 'string'
     *
     * @example <caption>Exemple 2 : Vérifier un mot-clé</caption>
     * console.log(NEnv.userAgent.includes('Mozilla'));
     */
    static get userAgent() {
        if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
            return navigator.userAgent;
        }
        return '';
    }

    /**
     * Retourne un objet récapitulatif complet de l'environnement d'exécution actuel.
     *
     * @returns {{
     *   type: string,
     *   os: string,
     *   browser: string,
     *   isMobile: boolean,
     *   isTablet: boolean,
     *   isDesktop: boolean,
     *   isTouch: boolean,
     *   isOnline: boolean,
     *   isWebView: boolean,
     *   isSecureContext: boolean,
     *   isDarkMode: boolean,
     *   language: string,
     *   timezone: string
     * }} Informations complètes sur l'environnement.
     *
     * @example <caption>Exemple 1 : Inspecter tout l'environnement en un appel</caption>
     * console.log(NEnv.info);
     *
     * @example <caption>Exemple 2 : Sérialiser pour un rapport de diagnostic</caption>
     * console.log(JSON.stringify(NEnv.info));
     */
    static get info() {
        return {
            type: NEnv.type,
            os: NEnv.os,
            browser: NEnv.browser,
            isMobile: NEnv.isMobile,
            isTablet: NEnv.isTablet,
            isDesktop: NEnv.isDesktop,
            isTouch: NEnv.isTouch,
            isOnline: NEnv.isOnline,
            isWebView: NEnv.isWebView,
            isSecureContext: NEnv.isSecureContext,
            isDarkMode: NEnv.isDarkMode,
            language: NEnv.language,
            timezone: NEnv.timezone
        };
    }
}

export default NEnv;
