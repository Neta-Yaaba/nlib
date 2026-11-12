/**
 * @file NEnvironment.js
 * @package @nlib/js-backend
 * @description Classe utilitaire d'inspection et de détection de l'environnement d'exécution matériel
 * et logiciel dans l'écosystème NLib :
 * - Type d'environnement (`browser`, `node`, `worker`, `unknown`)
 * - Système d'exploitation (`android`, `harmonyos`, `ios`, `windows`, `macos`, `linux`, `unknown`)
 * - Navigateur (`edge`, `opera`, `firefox`, `chrome`, `safari`, `unknown`)
 * - Type d'appareil (`isMobile`, `isTablet`, `isDesktop`, `isTouch`)
 * - Hôte natif / WebView (`isWebView`)
 * - État réseau et préférences système (`isOnline`, `isOffline`, `isSecureContext`, `isDarkMode`, `language`, `timezone`).
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : s'utilise via une instance ou via `NUtil.env`.
 */

import { NEvent } from '../core/NEvent.js';
import { NWorker } from '../worker/NWorker.js';

/**
 * @class NEnvironment
 * @description Utilitaire fournissant toutes les informations sur l'environnement d'exécution
 * (plateforme, OS, navigateur, WebView, appareil mobile, connexion Internet).
 *
 * @example <caption>Exemple 1 : Détecter le type d'environnement, l'OS et le navigateur</caption>
 * const env = new NEnvironment();
 * console.log(env.type);    // 'browser' | 'node' | 'worker' | 'unknown'
 * console.log(env.os);      // 'windows' | 'android' | 'ios' | 'macos' | 'linux' | 'harmonyos'
 * console.log(env.browser); // 'chrome' | 'edge' | 'firefox' | 'safari' | 'opera' | 'unknown'
 *
 * @example <caption>Exemple 2 : Vérifier le type d'appareil, WebView et l'état de la connexion</caption>
 * const env = new NEnvironment();
 * console.log(env.isMobile);  // true / false
 * console.log(env.isWebView); // true si exécuté dans le conteneur OS natif NLib
 * console.log(env.isOnline);  // true si connecté au réseau
 *
 * @example <caption>Exemple 3 : Utilisation directe via NUtil.env</caption>
 * console.log(NUtil.env.os);
 * console.log(NUtil.env.info);
 */
export class NEnvironment {

    // =========================================================================
    // Getters d'instance — Type d'Environnement (Runtime)
    // =========================================================================

    /**
     * Retourne le type d'environnement d'exécution JavaScript actuel :
     * `'browser'`, `'node'`, `'worker'` ou `'unknown'`.
     *
     * @returns {'browser'|'node'|'worker'|'unknown'} Type d'environnement.
     *
     * @example <caption>Exemple 1 : Lire le type d'environnement</caption>
     * const env = new NEnvironment();
     * console.log(env.type); // 'browser' ou 'node'
     *
     * @example <caption>Exemple 2 : Via NUtil.env</caption>
     * console.log(NUtil.env.type !== 'unknown');
     */
    get type() {
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
     * const env = new NEnvironment();
     * if (env.isBrowser) { console.log('DOM disponible'); }
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof new NEnvironment().isBrowser); // 'boolean'
     */
    get isBrowser() {
        return this.type === 'browser';
    }

    /**
     * Indique si le code s'exécute sous Node.js (`type === 'node'`).
     *
     * @returns {boolean} `true` si exécuté sous Node.js.
     *
     * @example <caption>Exemple 1 : Vérifier si l'environnement est Node.js</caption>
     * const env = new NEnvironment();
     * if (env.isNode) { console.log('Serveur Node.js'); }
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof new NEnvironment().isNode); // 'boolean'
     */
    get isNode() {
        return this.type === 'node';
    }

    /**
     * Indique si le code s'exécute dans un Web Worker ou Service Worker (`type === 'worker'`).
     *
     * @returns {boolean} `true` si exécuté dans un Worker.
     *
     * @example <caption>Exemple 1 : Vérifier si l'environnement est un Worker</caption>
     * const env = new NEnvironment();
     * if (env.isWorker) { console.log('Web Worker actif'); }
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof new NEnvironment().isWorker); // 'boolean'
     */
    get isWorker() {
        return this.type === 'worker';
    }

    // =========================================================================
    // Getters d'instance — Système d'Exploitation (OS)
    // =========================================================================

    /**
     * Détecte le système d'exploitation courant parmi les 6 OS supportés par NLib :
     * `'android'`, `'harmonyos'`, `'ios'`, `'windows'`, `'macos'`, `'linux'` ou `'unknown'`.
     * Fonctionne aussi bien dans le navigateur (`navigator.userAgent`) que sous Node.js (`process.platform`).
     *
     * @returns {'android'|'harmonyos'|'ios'|'windows'|'macos'|'linux'|'unknown'} Nom de l'OS.
     *
     * @example <caption>Exemple 1 : Obtenir le système d'exploitation</caption>
     * const env = new NEnvironment();
     * console.log(env.os); // ex: 'windows', 'android', 'ios', etc.
     *
     * @example <caption>Exemple 2 : Adapter un comportement selon l'OS</caption>
     * const env = new NEnvironment();
     * const isApple = env.os === 'ios' || env.os === 'macos';
     */
    get os() {
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
     * console.log(new NEnvironment().isAndroid);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * const env = new NEnvironment();
     * console.log(env.isAndroid === (env.os === 'android')); // true
     */
    get isAndroid() {
        return this.os === 'android';
    }

    /**
     * Indique si le système d'exploitation est HarmonyOS (OpenHarmony).
     *
     * @returns {boolean} `true` sur HarmonyOS.
     *
     * @example <caption>Exemple 1 : Tester HarmonyOS</caption>
     * console.log(new NEnvironment().isHarmonyOS);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * const env = new NEnvironment();
     * console.log(env.isHarmonyOS === (env.os === 'harmonyos')); // true
     */
    get isHarmonyOS() {
        return this.os === 'harmonyos';
    }

    /**
     * Indique si le système d'exploitation est iOS / iPadOS.
     *
     * @returns {boolean} `true` sur iOS / iPadOS.
     *
     * @example <caption>Exemple 1 : Tester iOS</caption>
     * console.log(new NEnvironment().isIOS);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * const env = new NEnvironment();
     * console.log(env.isIOS === (env.os === 'ios')); // true
     */
    get isIOS() {
        return this.os === 'ios';
    }

    /**
     * Indique si le système d'exploitation est Windows.
     *
     * @returns {boolean} `true` sur Windows.
     *
     * @example <caption>Exemple 1 : Tester Windows</caption>
     * console.log(new NEnvironment().isWindows);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * const env = new NEnvironment();
     * console.log(env.isWindows === (env.os === 'windows')); // true
     */
    get isWindows() {
        return this.os === 'windows';
    }

    /**
     * Indique si le système d'exploitation est macOS.
     *
     * @returns {boolean} `true` sur macOS.
     *
     * @example <caption>Exemple 1 : Tester macOS</caption>
     * console.log(new NEnvironment().isMacOS);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * const env = new NEnvironment();
     * console.log(env.isMacOS === (env.os === 'macos')); // true
     */
    get isMacOS() {
        return this.os === 'macos';
    }

    /**
     * Indique si le système d'exploitation est Linux.
     *
     * @returns {boolean} `true` sur Linux.
     *
     * @example <caption>Exemple 1 : Tester Linux</caption>
     * console.log(new NEnvironment().isLinux);
     *
     * @example <caption>Exemple 2 : Comparaison avec os</caption>
     * const env = new NEnvironment();
     * console.log(env.isLinux === (env.os === 'linux')); // true
     */
    get isLinux() {
        return this.os === 'linux';
    }

    // =========================================================================
    // Getters d'instance — Navigateur, WebView & Type d'Appareil
    // =========================================================================

    /**
     * Détecte le navigateur courant : `'edge'`, `'opera'`, `'firefox'`, `'chrome'`, `'safari'` ou `'unknown'`.
     *
     * @returns {'edge'|'opera'|'firefox'|'chrome'|'safari'|'unknown'} Nom du navigateur.
     *
     * @example <caption>Exemple 1 : Obtenir le nom du navigateur</caption>
     * const env = new NEnvironment();
     * console.log(env.browser); // ex: 'chrome', 'edge', 'firefox', 'safari'
     *
     * @example <caption>Exemple 2 : Sous Node.js retourne 'unknown'</caption>
     * const env = new NEnvironment();
     * if (env.isNode) { console.log(env.browser); } // 'unknown'
     */
    get browser() {
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
     * console.log(new NEnvironment().isMobile); // true ou false
     *
     * @example <caption>Exemple 2 : Adapter l'interface</caption>
     * const layout = new NEnvironment().isMobile ? 'compact' : 'wide';
     */
    get isMobile() {
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
     * console.log(new NEnvironment().isTablet);
     *
     * @example <caption>Exemple 2 : Tester mobile ou tablette</caption>
     * const env = new NEnvironment();
     * const isHandheld = env.isMobile || env.isTablet;
     */
    get isTablet() {
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
     * console.log(new NEnvironment().isDesktop);
     *
     * @example <caption>Exemple 2 : Exclusif avec mobile et tablette</caption>
     * const env = new NEnvironment();
     * console.log(env.isDesktop === (!env.isMobile && !env.isTablet)); // true
     */
    get isDesktop() {
        return !this.isMobile && !this.isTablet;
    }

    /**
     * Indique si l'écran de l'appareil prend en charge les interactions tactiles (`touch`).
     *
     * @returns {boolean} `true` si l'appareil possède un écran tactile.
     *
     * @example <caption>Exemple 1 : Détecter le support tactile</caption>
     * console.log(new NEnvironment().isTouch);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof new NEnvironment().isTouch); // 'boolean'
     */
    get isTouch() {
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
     * console.log(new NEnvironment().isWebView);
     *
     * @example <caption>Exemple 2 : Activer la passerelle native si WebView</caption>
     * const env = new NEnvironment();
     * if (env.isWebView) { console.log('Conteneur natif détecté'); }
     */
    get isWebView() {
        if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
            return false;
        }
        const ua = navigator.userAgent;

        if (typeof window !== 'undefined') {
            if (
                window.NLibNativeBridge ||
                window.chrome?.webview ||
                window.webkit?.messageHandlers
            ) {
                return true;
            }
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
    // Getters d'instance — Connexion Réseau, Sécurité & Préférences Système
    // =========================================================================

    /**
     * Indique si l'appareil dispose actuellement d'une connexion réseau (`navigator.onLine`).
     * Retourne `true` par défaut dans les environnements serveur où `navigator` est absent.
     *
     * @returns {boolean} `true` si en ligne, `false` si hors-ligne.
     *
     * @example <caption>Exemple 1 : Vérifier si l'appareil est en ligne</caption>
     * console.log(new NEnvironment().isOnline); // true
     *
     * @example <caption>Exemple 2 : Basculer entre SQL local et serveur</caption>
     * const target = new NEnvironment().isOnline ? 'remote' : 'local';
     */
    get isOnline() {
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
     * console.log(new NEnvironment().isOffline);
     *
     * @example <caption>Exemple 2 : Opposé de isOnline</caption>
     * const env = new NEnvironment();
     * console.log(env.isOffline === !env.isOnline); // true
     */
    get isOffline() {
        return !this.isOnline;
    }

    /**
     * Indique si le contexte d'exécution est sécurisé (`HTTPS`, `localhost`, `file://` ou `Node.js`).
     *
     * @returns {boolean} `true` si le contexte est sécurisé.
     *
     * @example <caption>Exemple 1 : Vérifier le contexte sécurisé</caption>
     * console.log(new NEnvironment().isSecureContext);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof new NEnvironment().isSecureContext); // 'boolean'
     */
    get isSecureContext() {
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
     * console.log(new NEnvironment().isDarkMode);
     *
     * @example <caption>Exemple 2 : Choisir le thème par défaut</caption>
     * const theme = new NEnvironment().isDarkMode ? 'dark' : 'light';
     */
    get isDarkMode() {
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
     * console.log(new NEnvironment().language); // ex: 'fr-FR'
     *
     * @example <caption>Exemple 2 : Toujours une chaîne non vide</caption>
     * console.log(new NEnvironment().language.length > 0); // true
     */
    get language() {
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
     * console.log(new NEnvironment().timezone); // ex: 'Africa/Ouagadougou'
     *
     * @example <caption>Exemple 2 : Toujours une chaîne non vide</caption>
     * console.log(typeof new NEnvironment().timezone); // 'string'
     */
    get timezone() {
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
     * console.log(typeof new NEnvironment().userAgent); // 'string'
     *
     * @example <caption>Exemple 2 : Vérifier un mot-clé</caption>
     * console.log(new NEnvironment().userAgent.includes('Mozilla'));
     */
    get userAgent() {
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
     * console.log(new NEnvironment().info);
     *
     * @example <caption>Exemple 2 : Sérialiser pour un rapport de diagnostic</caption>
     * console.log(JSON.stringify(new NEnvironment().info));
     */
    get info() {
        return {
            type: this.type,
            os: this.os,
            browser: this.browser,
            isMobile: this.isMobile,
            isTablet: this.isTablet,
            isDesktop: this.isDesktop,
            isTouch: this.isTouch,
            isOnline: this.isOnline,
            isWebView: this.isWebView,
            isSecureContext: this.isSecureContext,
            isDarkMode: this.isDarkMode,
            language: this.language,
            timezone: this.timezone
        };
    }

    /**
     * Exécute une action ou une commande auprès du conteneur applicatif hôte natif (Android, iOS, Windows, etc.)
     * via le pont JavaScript natif (`window.NLibNativeBridge`).
     *
     * - Si appelé depuis le thread principal (`isBrowser`) dans une WebView :
     *   Interroge directement `window.NLibNativeBridge.execute(params)`. Si l'appel est asynchrone (`result.isAsync`),
     *   retourne une promesse écoutant l'événement `window.NLibNativeBridgeEvent` filtré par `result.requestId`.
     * - Si appelé depuis un Web Worker (`isWorker`) :
     *   Transmet automatiquement la requête au thread principal via `NWorker.requestMain('requestApp', params)`
     *   qui l'exécute auprès du pont natif et retourne le résultat dans le Worker.
     *
     * @param {Object} params - Paramètres transmis au pont natif.
     * @returns {Promise<any>} Résultat renvoyé par l'application native.
     *
     * @example <caption>Exemple 1 : Appel depuis le thread principal ou un Web Worker</caption>
     * const res = await NUtil.env.requestApp({ action: 'vibrate', duration: 200 });
     *
     * @example <caption>Exemple 2 : Récupérer des informations matérielles de l'appareil</caption>
     * const deviceInfo = await NUtil.env.requestApp({ action: 'getDeviceInfo' });
     */
    async requestApp(params) {
        if (this.isWorker) {
            const response = await NWorker.requestMain('requestApp', params);
            return response?.result ?? response;
        }

        if (this.isWebView) {
            if (this.isBrowser) {
                if (typeof window !== 'undefined' && window.NLibNativeBridge) {
                    const result = window.NLibNativeBridge.execute(params);
                    if (result) {
                        if (result.isAsync) {
                            if (!window.NLibNativeBridgeEvent) {
                                window.NLibNativeBridgeEvent = new NEvent();
                            }
                            return new Promise((resolve) => {
                                const func = (data) => {
                                    if (data && result.requestId === data.requestId) {
                                        window.NLibNativeBridgeEvent.off('requestapp', func);
                                        resolve(data);
                                    }
                                };
                                window.NLibNativeBridgeEvent.on('requestapp', func);
                            });
                        } else {
                            return result;
                        }
                    } else {
                        return {
                            error: 'NO_RESULT',
                            message: 'Aucun résultat retourné par le pont natif.'
                        };
                    }
                } else {
                    return {
                        error: 'NO_NATIVE_BRIDGE',
                        message: 'Le pont natif window.NLibNativeBridge est introuvable.'
                    };
                }
            } else {
                return {
                    error: 'UNSUPPORTED_CONTEXT',
                    message: "Contexte d'exécution non supporté pour requestApp."
                };
            }
        } else {
            return {
                error: 'NO_APP',
                message: "L'application ne s'exécute pas dans une WebView hôte."
            };
        }
    }
}

export default NEnvironment;
