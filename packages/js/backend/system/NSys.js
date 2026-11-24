/**
 * @file NSys.js
 * @package @nlib/js-backend
 * @description Classe autonome d'inspection et de gestion des ressources système et matérielles
 * dans l'écosystème NLib :
 * - Matériel : Nombre de cœurs CPU (`cpuCores`), architecture (`arch`), mémoire RAM / Heap (`memory`, `deviceMemory`),
 *   écran et densité de pixels (`screen`), état de la batterie (`getBattery`).
 * - Réseau & Connectivité : Qualité de connexion (`network`), écoute des changements en ligne / hors-ligne (`watchNetwork`).
 * - Stockage & Presse-papiers : Quota disque/navigateur (`getStorageQuota`), presse-papiers (`copyToClipboard`, `readFromClipboard`).
 * - Performance & Temps d'activité : Temps d'exécution (`uptime`), horloge haute résolution (`hrtime`), mesure d'exécution (`measure`).
 * - Pont OS Natif : Envoi de commandes système à l'hôte natif (`invokeNative`) lorsqu'exécuté dans une WebView NLib.
 *
 * Exposée sous forme d'instance partagée à initialisation paresseuse via `NSys` (et son alias `NSys`).
 */

import { NLog } from '../log/NLog.js';
import { NUtil } from '../utils/NUtil.js';
import { NEnv } from '../environment/NEnv.js';
import { NNum } from '../utils/NNum.js';
import { NEvent } from '../core/NEvent.js';
import { NWorker } from '../worker/NWorker.js';

/**
 * @class NSys
 * @description Gestionnaire et inspecteur des ressources matérielles et système (Navigateur, WebView OS et Node.js).
 *
 * @example <caption>Exemple 1 : Inspecter le matériel (CPU, mémoire, écran, réseau) via NSys</caption>
 * console.log(NSys.cpuCores); // ex: 8
 * console.log(NSys.memory);   // { used: ..., total: ..., formattedUsed: '...', formattedTotal: '...' }
 * console.log(NSys.screen);   // { width: 1920, height: 1080, pixelRatio: 1, orientation: 'landscape' }
 *
 * @example <caption>Exemple 2 : Surveiller la connexion réseau et mesurer une performance</caption>
 * NSys.watchNetwork(true, {
 *     onOffline: () => console.log('Passage en mode hors-ligne SQLite'),
 *     onOnline: () => console.log('Connexion rétablie')
 * });
 * const report = await NSys.measure('Calcul', async () => NUtil.sleep(50));
 * console.log(report.durationMs); // ~50
 *
 * @example <caption>Exemple 3 : Quota de stockage, batterie et rapport complet</caption>
 * const storage = await NSys.getStorageQuota();
 * const snapshot = await NSys.getSnapshot();
 * console.log(snapshot);
 */
export class NSys {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Timestamp (`Date.now()`) du démarrage de l'instance système.
     * @type {number}
     * @private
     */
    static #startedAt = Date.now();

    /**
     * Références internes aux écouteurs `online` / `offline` du navigateur (allouées uniquement si `watchNetwork` est actif).
     * @type {{ onOnline: Function, onOffline: Function }|null}
     * @private
     */
    static #networkHandlers = null;

    // =========================================================================
    // Getters matériels — CPU, Architecture, Mémoire, Écran & Réseau
    // =========================================================================

    /**
     * Retourne le nombre de cœurs logiques du processeur (`navigator.hardwareConcurrency` ou `1` par défaut).
     *
     * @returns {number} Nombre de cœurs logiques CPU.
     *
     * @example <caption>Exemple 1 : Lire le nombre de cœurs CPU</caption>
     * console.log(NSys.cpuCores); // ex: 8
     *
     * @example <caption>Exemple 2 : Toujours supérieur ou égal à 1</caption>
     * console.log(NSys.cpuCores >= 1); // true
     */
    static get cpuCores() {
        if (typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)) {
            return Math.max(1, navigator.hardwareConcurrency);
        }
        return 1;
    }

    /**
     * Retourne l'architecture matérielle du processeur (`'x64'`, `'arm64'`, `'ia32'`, `'arm'`, ou `'unknown'`).
     *
     * @returns {string} Architecture du processeur.
     *
     * @example <caption>Exemple 1 : Obtenir l'architecture</caption>
     * console.log(NSys.arch); // ex: 'x64' ou 'arm64'
     *
     * @example <caption>Exemple 2 : Toujours une chaîne non vide</caption>
     * console.log(typeof NSys.arch); // 'string'
     */
    static get arch() {
        if (typeof process !== 'undefined' && typeof process.arch === 'string') {
            return process.arch;
        }
        if (typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string') {
            const ua = navigator.userAgent.toLowerCase();
            if (ua.includes('arm64') || ua.includes('aarch64')) return 'arm64';
            if (ua.includes('arm')) return 'arm';
            if (ua.includes('x86_64') || ua.includes('win64') || ua.includes('wow64') || ua.includes('amd64')) return 'x64';
            if (ua.includes('i686') || ua.includes('i386')) return 'ia32';
        }
        return 'unknown';
    }

    /**
     * Retourne la mémoire RAM approximative de l'appareil en gigaoctets (`navigator.deviceMemory`),
     * ou `null` si l'information n'est pas exposée par l'environnement.
     *
     * @returns {number|null} Mémoire RAM en Go (ex: `4`, `8`) ou `null`.
     *
     * @example <caption>Exemple 1 : Lire la RAM de l'appareil</caption>
     * console.log(NSys.deviceMemory); // ex: 8 ou null
     *
     * @example <caption>Exemple 2 : Adapter le cache selon la RAM</caption>
     * const maxCache = (NSys.deviceMemory ?? 4) >= 8 ? 500 : 100;
     */
    static get deviceMemory() {
        if (typeof navigator !== 'undefined' && Number.isFinite(navigator.deviceMemory)) {
            return navigator.deviceMemory;
        }
        return null;
    }

    /**
     * Retourne l'état actuel de la mémoire du processus JavaScript (Heap JS sous Node.js ou Chrome)
     * avec les valeurs brutes en octets et formatées en `MB` / `GB`.
     *
     * @returns {{
     *   used: number,
     *   total: number,
     *   limit: number,
     *   usagePercent: number,
     *   formattedUsed: string,
     *   formattedTotal: string
     * }} Statistiques d'utilisation mémoire.
     *
     * @example <caption>Exemple 1 : Inspecter la mémoire utilisée</caption>
     * console.log(NSys.memory.formattedUsed); // ex: '14.52 MB'
     *
     * @example <caption>Exemple 2 : Vérifier le pourcentage d'utilisation</caption>
     * console.log(NSys.memory.usagePercent >= 0); // true
     */
    static get memory() {
        let used = 0;
        let total = 0;
        let limit = 0;

        if (typeof process !== 'undefined' && typeof process.memoryUsage === 'function') {
            const mem = process.memoryUsage();
            used = mem.heapUsed || 0;
            total = mem.heapTotal || 0;
            limit = mem.rss || total;
        } else if (typeof performance !== 'undefined' && performance.memory) {
            used = performance.memory.usedJSHeapSize || 0;
            total = performance.memory.totalJSHeapSize || 0;
            limit = performance.memory.jsHeapSizeLimit || total;
        }

        const base = limit > 0 ? limit : total;
        const usagePercent = base > 0 ? NNum.percentage(used, base, 2) : 0;

        return {
            used,
            total,
            limit,
            usagePercent,
            formattedUsed: NNum.formatBytes(used),
            formattedTotal: NNum.formatBytes(total)
        };
    }

    /**
     * Retourne les dimensions de l'écran, de la fenêtre d'affichage (`viewport`), le ratio de pixels
     * (`devicePixelRatio`) et l'orientation (`'landscape'` ou `'portrait'`).
     *
     * @returns {{
     *   width: number,
     *   height: number,
     *   viewportWidth: number,
     *   viewportHeight: number,
     *   pixelRatio: number,
     *   colorDepth: number,
     *   orientation: 'landscape'|'portrait'
     * }} Informations sur l'affichage.
     *
     * @example <caption>Exemple 1 : Obtenir la résolution et l'orientation</caption>
     * console.log(NSys.screen.orientation); // 'landscape' ou 'portrait'
     *
     * @example <caption>Exemple 2 : Vérifier la densité de pixels (Retina / HiDPI)</caption>
     * console.log(NSys.screen.pixelRatio >= 1); // true
     */
    static get screen() {
        if (typeof window === 'undefined') {
            return {
                width: 0,
                height: 0,
                viewportWidth: 0,
                viewportHeight: 0,
                pixelRatio: 1,
                colorDepth: 24,
                orientation: 'landscape'
            };
        }

        const width = window.screen?.width ?? window.innerWidth ?? 0;
        const height = window.screen?.height ?? window.innerHeight ?? 0;
        const viewportWidth = window.innerWidth ?? width;
        const viewportHeight = window.innerHeight ?? height;
        const pixelRatio = window.devicePixelRatio || 1;
        const colorDepth = window.screen?.colorDepth ?? 24;
        const orientation = viewportWidth >= viewportHeight ? 'landscape' : 'portrait';

        return {
            width,
            height,
            viewportWidth,
            viewportHeight,
            pixelRatio,
            colorDepth,
            orientation
        };
    }

    /**
     * Retourne les informations sur l'état et la qualité de la connexion réseau actuelle
     * (`online`, `effectiveType` : `'4g'`/`'3g'`/`'2g'`/`'slow-2g'`, `downlinkMbps`, `rttMs`, `saveData`).
     *
     * @returns {{
     *   online: boolean,
     *   effectiveType: string,
     *   downlinkMbps: number|null,
     *   rttMs: number|null,
     *   saveData: boolean
     * }} État détaillé du réseau.
     *
     * @example <caption>Exemple 1 : Vérifier l'état et le type de réseau</caption>
     * console.log(NSys.network.online, NSys.network.effectiveType);
     *
     * @example <caption>Exemple 2 : Adapter le chargement si le mode économie de données est actif</caption>
     * if (NSys.network.saveData) { console.log('Mode économie de données'); }
     */
    static get network() {
        const online = NEnv.isOnline;
        const conn = typeof navigator !== 'undefined'
            ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection)
            : null;

        return {
            online,
            effectiveType: conn?.effectiveType ?? (online ? 'unknown' : 'offline'),
            downlinkMbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
            rttMs: typeof conn?.rtt === 'number' ? conn.rtt : null,
            saveData: Boolean(conn?.saveData)
        };
    }

    // =========================================================================
    // Méthodes publiques — Temps d'Activité (Uptime), Horloge & Benchmark
    // =========================================================================

    /**
     * Retourne le temps écoulé depuis l'initialisation (ou le démarrage du processus) en millisecondes
     * (ou en secondes si `inSeconds = true`).
     *
     * @param {boolean} [inSeconds=false] - Si `true`, retourne la durée en secondes.
     * @returns {number} Temps d'activité.
     *
     * @example <caption>Exemple 1 : Uptime en millisecondes</caption>
     * console.log(NSys.uptime() >= 0); // true
     *
     * @example <caption>Exemple 2 : Uptime en secondes</caption>
     * console.log(NSys.uptime(true) >= 0); // true
     */
    static uptime(inSeconds = false) {
        let elapsedMs = Date.now() - NSys.#startedAt;
        if (typeof process !== 'undefined' && typeof process.uptime === 'function') {
            elapsedMs = process.uptime() * 1000;
        } else if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            elapsedMs = performance.now();
        }
        return inSeconds ? NNum.round(elapsedMs / 1000, 2) : Math.trunc(elapsedMs);
    }

    /**
     * Retourne un timestamp haute précision en millisecondes avec décimales microsecondes (`performance.now()`).
     *
     * @returns {number} Temps haute résolution en millisecondes.
     *
     * @example <caption>Exemple 1 : Obtenir le temps haute résolution</caption>
     * const t0 = NSys.hrtime();
     * console.log(typeof t0); // 'number'
     *
     * @example <caption>Exemple 2 : Calculer un delta très précis</caption>
     * const start = NSys.hrtime();
     * const delta = NSys.hrtime() - start;
     * console.log(delta >= 0); // true
     */
    static hrtime() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    /**
     * Exécute une fonction (synchrone ou asynchrone) et mesure précisément son temps d'exécution.
     * En cas d'erreur dans `fn`, capture l'exception, la consigne
     * dans `NLog` et retourne un rapport d'échec.
     *
     * @param {string} label - Nom de l'opération mesurée.
     * @param {Function} fn - Fonction à exécuter et chronométrer.
     * @returns {Promise<{ label: string, durationMs: number, result: any, success: boolean, error?: string }>} Rapport d'exécution.
     *
     * @example <caption>Exemple 1 : Mesurer une tâche asynchrone avec succès</caption>
     * const report = await NSys.measure('RequeteSQL', async () => 42);
     * console.log(report.label, report.result, report.durationMs >= 0); // 'RequeteSQL' 42 true
     *
     * @example <caption>Exemple 2 : Mesurer une opération en échec</caption>
     * const errReport = await NSys.measure('TacheErronee', () => { throw new Error('Oups'); });
     * console.log(errReport.success); // false
     */
    static async measure(label, fn) {
        const start = NSys.hrtime();
        try {
            const result = await fn();
            const durationMs = NNum.round(NSys.hrtime() - start, 3);
            return {
                success: true,
                label: String(label || 'task'),
                durationMs,
                result
            };
        } catch (error) {
            const durationMs = NNum.round(NSys.hrtime() - start, 3);
            NLog.error(`NSys: Échec lors de la mesure de "${label}".`, {
                code: 'ERR_MEASURE_EXECUTION',
                label,
                cause: error
            });
            return {
                success: false,
                code: 'ERR_MEASURE_EXECUTION',
                error: error?.message || 'Erreur lors de la mesure',
                label: String(label || 'task'),
                durationMs,
                result: null
            };
        }
    }

    // =========================================================================
    // Méthodes publiques — Batterie, Quota de Stockage & Presse-papiers
    // =========================================================================

    /**
     * Récupère l'état de la batterie de l'appareil (`level` de `0` à `100`, `charging` booléen),
     * ou `null` si l'API Battery Status n'est pas supportée.
     *
     * @returns {Promise<{ level: number, charging: boolean, chargingTime: number, dischargingTime: number }|null>} État de la batterie ou `null`.
     *
     * @example <caption>Exemple 1 : Lire le niveau de batterie</caption>
     * const bat = await NSys.getBattery();
     * if (bat) { console.log(`${bat.level}%`); }
     *
     * @example <caption>Exemple 2 : Retourne null sous Node.js</caption>
     * const bat = await NSys.getBattery();
     * console.log(bat === null || typeof bat.level === 'number'); // true
     */
    static async getBattery() {
        if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
            try {
                const battery = await navigator.getBattery();
                return {
                    level: NNum.round((battery.level ?? 1) * 100, 0),
                    charging: Boolean(battery.charging),
                    chargingTime: battery.chargingTime ?? 0,
                    dischargingTime: battery.dischargingTime ?? 0
                };
            } catch {
                return null;
            }
        }
        return null;
    }

    /**
     * Interroge le quota de stockage disponible pour l'application hors-ligne (IndexedDB / SQLite / Cache API).
     *
     * @returns {Promise<{
     *   usage: number,
     *   quota: number,
     *   usagePercent: number,
     *   formattedUsage: string,
     *   formattedQuota: string
     * }>} Informations sur l'espace de stockage.
     *
     * @example <caption>Exemple 1 : Vérifier l'espace libre pour la base SQLite locale</caption>
     * const storage = await NSys.getStorageQuota();
     * console.log(storage.formattedUsage, storage.formattedQuota);
     *
     * @example <caption>Exemple 2 : Pourcentage d'espace utilisé</caption>
     * const storage = await NSys.getStorageQuota();
     * console.log(storage.usagePercent >= 0); // true
     */
    static async getStorageQuota() {
        if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
            try {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || 0;
                return {
                    usage,
                    quota,
                    usagePercent: quota > 0 ? NNum.percentage(usage, quota, 2) : 0,
                    formattedUsage: NNum.formatBytes(usage),
                    formattedQuota: NNum.formatBytes(quota)
                };
            } catch {
                // Repli ci-dessous
            }
        }
        return {
            usage: 0,
            quota: 0,
            usagePercent: 0,
            formattedUsage: '0 B',
            formattedQuota: '0 B'
        };
    }

    /**
     * Copie une chaîne de caractères dans le presse-papiers du système (navigateur ou WebView).
     *
     * @param {string} text - Texte à copier.
     * @returns {Promise<boolean>} `true` si la copie a réussi, sinon `false`.
     *
     * @example <caption>Exemple 1 : Copier un texte dans le presse-papiers</caption>
     * const ok = await NSys.copyToClipboard('Texte copié');
     *
     * @example <caption>Exemple 2 : Texte vide retourne false</caption>
     * console.log(await NSys.copyToClipboard('')); // false
     */
    static async copyToClipboard(text) {
        if (typeof text !== 'string' || text.length === 0) {
            return false;
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }

    /**
     * Lit le contenu texte actuel du presse-papiers système.
     *
     * @returns {Promise<string>} Texte lu depuis le presse-papiers, ou `''` si indisponible/refusé.
     *
     * @example <caption>Exemple 1 : Lire le presse-papiers</caption>
     * const content = await NSys.readFromClipboard();
     * console.log(typeof content); // 'string'
     *
     * @example <caption>Exemple 2 : Sans permission retourne une chaîne vide</caption>
     * console.log(await NSys.readFromClipboard());
     */
    static async readFromClipboard() {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
            try {
                return await navigator.clipboard.readText();
            } catch {
                return '';
            }
        }
        return '';
    }

    /**
     * Retourne l'URL courante du navigateur ou une chaîne vide hors navigateur.
     *
     * @returns {string} URL complète courante.
     *
     * @example <caption>Exemple 1 : Lire l'URL courante</caption>
     * const url = NSys.getBrowserUrl();
     *
     * @example <caption>Exemple 2 : Vérifier un paramètre d'URL</caption>
     * const hasToken = NSys.getBrowserUrl().includes('token=');
     */
    static getBrowserUrl() {
        return typeof window !== 'undefined' && window.location ? window.location.href : '';
    }

    /**
     * Met à jour le titre de la fenêtre ou du document (et notifie l'OS natif en WebView).
     *
     * @param {string} title - Nouveau titre à appliquer.
     * @returns {Promise<any>|void} Promesse de l'appel natif en WebView, sinon `undefined`.
     *
     * @example <caption>Exemple 1 : Définir le titre applicatif</caption>
     * NSys.setBrowserTitle('Tableau de bord');
     *
     * @example <caption>Exemple 2 : Effacer le titre</caption>
     * NSys.setBrowserTitle('');
     */
    static setBrowserTitle(title) {
        const nextTitle = title ? String(title) : '';
        if (typeof document !== 'undefined') {
            document.title = nextTitle;
        }
        if (NEnv.isWebView) {
            return NSys.invokeNative('setBrowserTitle', { title: nextTitle });
        }
    }

    /**
     * Remplace l'entrée courante de l'historique navigateur (ou notifie l'OS natif en WebView).
     *
     * @param {string} url - Nouvelle URL à appliquer.
     * @param {*} [state=null] - État associé à l'entrée d'historique.
     * @returns {Promise<any>|void} Promesse de l'appel natif en WebView, sinon `undefined`.
     *
     * @example <caption>Exemple 1 : Remplacer l'URL courante</caption>
     * NSys.setBrowserUrl('/profile?tab=info');
     *
     * @example <caption>Exemple 2 : Remplacer l'URL avec un état personnalisé</caption>
     * NSys.setBrowserUrl('/items/42', { itemId: 42 });
     */
    static setBrowserUrl(url, state = null) {
        if (typeof window !== 'undefined' && window.history?.replaceState) {
            try {
                window.history.replaceState(state, '', url);
            } catch {
                // Ignore cross-origin SecurityError
            }
        }
        if (NEnv.isWebView) {
            return NSys.invokeNative('setBrowserUrl', { url, state });
        }
    }

    /**
     * Empile une nouvelle entrée dans l'historique navigateur (ou notifie l'OS natif en WebView).
     *
     * @param {string} url - URL à empiler.
     * @param {*} [state=null] - État associé à l'entrée d'historique.
     * @returns {Promise<any>|void} Promesse de l'appel natif en WebView, sinon `undefined`.
     *
     * @example <caption>Exemple 1 : Empiler une nouvelle route</caption>
     * NSys.pushBrowserUrl('/orders/108');
     *
     * @example <caption>Exemple 2 : Empiler une route avec état</caption>
     * NSys.pushBrowserUrl('/search?q=nlib', { query: 'nlib' });
     */
    static pushBrowserUrl(url, state = null) {
        if (typeof window !== 'undefined' && window.history?.pushState) {
            try {
                window.history.pushState(state, '', url);
            } catch {
                // Ignore cross-origin SecurityError
            }
        }
        if (NEnv.isWebView) {
            return NSys.invokeNative('pushBrowserUrl', { url, state });
        }
    }

    /**
     * Effectue un retour navigateur (`window.history.back()`) ou demande à l'OS natif de fermer l'application/vue (`invokeNative('finishApp')`) en WebView.
     *
     * @returns {Promise<any>|void} Promesse de l'appel natif en WebView, sinon `undefined`.
     *
     * @example <caption>Exemple 1 : Revenir à la page précédente du navigateur ou quitter en WebView</caption>
     * NSys.browserBack();
     *
     * @example <caption>Exemple 2 : Repli lorsque l'historique interne de NWindow est vide</caption>
     * if (!win.back()) {
     *     NSys.browserBack();
     * }
     */
    static browserBack() {
        if (NEnv.isWebView) {
            return NSys.invokeNative('finishApp');
        }
        if (typeof window !== 'undefined' && window.history?.back) {
            window.history.back();
        }
    }

    /**
     * Ouvre une URL dans le navigateur système (via `invokeNative` en WebView ou `window.open` en navigateur).
     *
     * @param {string} url - URL à ouvrir.
     * @param {string} [target='_blank'] - Cible de navigation (`_blank`, `_self`, etc.).
     * @returns {Promise<any>|Window|null} Réponse native, référence `Window` ou `null`.
     *
     * @example <caption>Exemple 1 : Ouvrir un lien externe</caption>
     * NSys.openUrl('https://example.com');
     *
     * @example <caption>Exemple 2 : Ouvrir dans le même onglet</caption>
     * NSys.openUrl('/docs', '_self');
     */
    static openUrl(url, target = '_blank') {
        if (NEnv.isWebView) {
            return NSys.invokeNative('openUrl', { url, target });
        }
        if (typeof window !== 'undefined' && window.open) {
            return window.open(url, target);
        }
        return null;
    }

    /**
     * Charge une URL dans la vue courante (via `invokeNative` en WebView ou `window.location.assign` en navigateur).
     *
     * @param {string} url - URL de destination.
     * @returns {Promise<any>|void} Promesse de l'appel natif en WebView, sinon `undefined`.
     *
     * @example <caption>Exemple 1 : Rediriger vers la page de connexion</caption>
     * NSys.loadUrl('/login');
     *
     * @example <caption>Exemple 2 : Rediriger vers une page externe</caption>
     * NSys.loadUrl('https://example.com/auth');
     */
    static loadUrl(url) {
        if (NEnv.isWebView) {
            return NSys.invokeNative('loadUrl', { url });
        }
        if (typeof window !== 'undefined' && window.location?.assign) {
            window.location.assign(url);
        }
    }

    /**
     * Partage des données via l'OS natif (`invokeNative` en WebView), Web Share API, ou copie de repli dans le presse-papiers.
     *
     * @param {Object} [data={}] - Données de partage (`title`, `text`, `url`).
     * @returns {Promise<boolean>} `true` si le partage ou la copie de repli a réussi.
     *
     * @example <caption>Exemple 1 : Partager une page</caption>
     * await NSys.share({ title: 'NLib', url: 'https://example.com' });
     *
     * @example <caption>Exemple 2 : Partager un texte</caption>
     * await NSys.share({ title: 'Note', text: 'Contenu partagé' });
     */
    static async share(data = {}) {
        if (NEnv.isWebView) {
            const res = await NSys.invokeNative('share', data);
            return Boolean(res && res.success !== false);
        }
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share(data);
                return true;
            } catch {
                return false;
            }
        }
        const fallback = data.url || data.text || '';
        if (!fallback) {
            return false;
        }
        return NSys.copyToClipboard(fallback);
    }

    // =========================================================================
    // Méthodes publiques — Surveillance Réseau & Communication Hôte OS Natif
    // =========================================================================

    /**
     * Active ou désactive l'écoute des événements réseau (`online` / `offline`) sur `window`.
     *
     * @param {boolean} [enable=true] - `true` pour activer la surveillance, `false` pour l'arrêter.
     * @param {Object} [callbacks={}] - Fonctions de rappel optionnelles.
     * @param {Function} [callbacks.onOnline] - Fonction appelée lorsque la connexion revient (`(networkInfo) => void`).
     * @param {Function} [callbacks.onOffline] - Fonction appelée lorsque la connexion est perdue (`(networkInfo) => void`).
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Activer la surveillance réseau</caption>
     * NSys.watchNetwork(true, {
     *     onOffline: (net) => console.log('Connexion perdue', net),
     *     onOnline: (net) => console.log('Connexion rétablie', net)
     * });
     *
     * @example <caption>Exemple 2 : Désactiver la surveillance réseau</caption>
     * NSys.watchNetwork(false);
     */
    static watchNetwork(enable = true, callbacks = {}) {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
            return NSys;
        }

        if (NSys.#networkHandlers) {
            window.removeEventListener('online', NSys.#networkHandlers.onOnline);
            window.removeEventListener('offline', NSys.#networkHandlers.onOffline);
            NSys.#networkHandlers = null;
        }

        if (!enable) {
            return NSys;
        }

        const onOnline = () => {
            if (typeof callbacks?.onOnline === 'function') {
                callbacks.onOnline(NSys.network);
            }
        };
        const onOffline = () => {
            if (typeof callbacks?.onOffline === 'function') {
                callbacks.onOffline(NSys.network);
            }
        };

        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        NSys.#networkHandlers = { onOnline, onOffline };

        return NSys;
    }

    /**
     * Envoie une commande système à l'hôte OS natif (Android, iOS, Windows, macOS, Linux, HarmonyOS)
     * via le pont unique `window.NLibNativeBridge.invoke(action, payload)`.
     *
     * - Accepte soit un nom d'action avec son payload (`invokeNative('vibrate', { duration: 200 })`),
     *   soit un objet de paramètres complet (`invokeNative({ action: 'sql.query', payload: { ... } })`).
     * - Si appelé depuis un Web Worker (`isWorker`), relaie automatiquement la commande au thread principal
     *   via `NWorker.requestMain('invokeNative', { action, payload })`.
     * - Si l'appel est asynchrone (`result.isAsync`), attend l'événement de retour filtré par `result.requestId`
     *   avec protection automatique par temporisation (timeout configurable via `payload.timeout`, 30s par défaut).
     * - En cas d'absence de conteneur natif ou d'erreur,
     *   consigne l'anomalie dans `NLog` et retourne un objet résultat standardisé `{ success: false, code, error, message }`.
     *
     * @param {string|Object} actionOrParams - Nom de l'action native ou objet contenant l'action et son payload.
     * @param {Object} [payloadOrOptions={}] - Paramètres transmis à l'action native.
     * @returns {Promise<any>} Réponse renvoyée par le conteneur natif ou objet résultat standardisé.
     *
     * @example <caption>Exemple 1 : Demander une action système avec paramètres</caption>
     * const res = await NSys.invokeNative('vibrate', { duration: 150 });
     * console.log(res);
     *
     * @example <caption>Exemple 2 : Requête native structurée avec gestion de délai</caption>
     * const info = await NSys.invokeNative('getDeviceInfo', { timeout: 5000 });
     * console.log(info);
     */
    static async invokeNative(actionOrParams, payloadOrOptions = {}) {
        try {
            let action;
            let payload;

            if (typeof actionOrParams === 'string') {
                action = actionOrParams.trim();
                payload = payloadOrOptions;
            } else if (actionOrParams && typeof actionOrParams === 'object') {
                action = actionOrParams.action || (Array.isArray(actionOrParams.type) ? actionOrParams.type.join('.') : (actionOrParams.type || 'default'));
                payload = actionOrParams.payload !== undefined ? actionOrParams.payload : actionOrParams;
            } else {
                NLog.warn("invokeNative: Paramètres d'appel invalides.", { actionOrParams });
                return {
                    success: false,
                    code: 'INVALID_PARAMS',
                    error: 'INVALID_PARAMS',
                    message: "Paramètres invalides fournis à invokeNative."
                };
            }

            if (!action) {
                NLog.warn("invokeNative: Le nom de l'action ne peut pas être vide.");
                return {
                    success: false,
                    code: 'INVALID_ACTION',
                    error: 'INVALID_ACTION',
                    message: "Le nom de l'action native ne peut pas être vide."
                };
            }

            // 1. Relai automatique si exécuté au sein d'un Web Worker
            if (NEnv.isWorker) {
                const response = await NWorker.requestMain('invokeNative', { action, payload });
                return response?.result ?? response;
            }

            // 2. Vérification de l'environnement WebView / Conteneur hôte
            if (!NEnv.isWebView) {
                NLog.warn("invokeNative: L'application ne s'exécute pas dans un conteneur WebView hôte.", {
                    action,
                    payload
                });
                return {
                    success: false,
                    code: 'NO_APP',
                    error: 'NO_APP',
                    message: "L'application ne s'exécute pas dans une WebView hôte."
                };
            }

            if (typeof window === 'undefined' || !window.NLibNativeBridge || typeof window.NLibNativeBridge.invoke !== 'function') {
                NLog.warn('invokeNative: Le pont natif window.NLibNativeBridge.invoke est introuvable.', {
                    action,
                    payload
                });
                return {
                    success: false,
                    code: 'NO_NATIVE_BRIDGE',
                    error: 'NO_NATIVE_BRIDGE',
                    message: 'Le pont natif window.NLibNativeBridge.invoke est introuvable.'
                };
            }

            // 3. Exécution exclusive auprès de window.NLibNativeBridge.invoke
            const result = await window.NLibNativeBridge.invoke(action, payload);
            if (result === undefined || result === null) {
                NLog.warn('invokeNative: Aucun résultat retourné par window.NLibNativeBridge.invoke.', {
                    action,
                    payload
                });
                return {
                    success: false,
                    code: 'NO_RESULT',
                    error: 'NO_RESULT',
                    message: 'Aucun résultat retourné par le pont natif.'
                };
            }

            // 4. Gestion des réponses asynchrones avec temporisation et nettoyage d'écouteur
            if (result && result.isAsync && result.requestId) {
                if (!window.NLibNativeBridgeEvent) {
                    window.NLibNativeBridgeEvent = new NEvent();
                }

                const timeoutMs = (payload && typeof payload.timeout === 'number' && payload.timeout > 0)
                    ? payload.timeout
                    : 30000;

                return new Promise((resolve) => {
                    let timer = null;

                    const func = (data) => {
                        if (data && result.requestId === data.requestId) {
                            if (timer) {
                                clearTimeout(timer);
                                timer = null;
                            }
                            window.NLibNativeBridgeEvent.off('invokenative', func);
                            window.NLibNativeBridgeEvent.off('requestapp', func);
                            resolve(data);
                        }
                    };

                    timer = setTimeout(() => {
                        window.NLibNativeBridgeEvent.off('invokenative', func);
                        window.NLibNativeBridgeEvent.off('requestapp', func);
                        NLog.warn(`invokeNative: Délai d'attente dépassé (${timeoutMs}ms) pour la requête id: ${result.requestId}.`, {
                            requestId: result.requestId,
                            action,
                            payload
                        });
                        resolve({
                            success: false,
                            code: 'ERR_TIMEOUT',
                            error: 'TIMEOUT',
                            message: `Délai d'attente dépassé (${timeoutMs}ms) pour la requête native id: ${result.requestId}.`
                        });
                    }, timeoutMs);

                    window.NLibNativeBridgeEvent.on('invokenative', func);
                    window.NLibNativeBridgeEvent.on('requestapp', func);
                });
            }

            return result;
        } catch (error) {
            NLog.error("invokeNative: Erreur inattendue lors de l'exécution de la commande native.", {
                code: 'ERR_NATIVE_INVOKE',
                params: actionOrParams,
                cause: error
            });
            return {
                success: false,
                code: 'ERR_NATIVE_INVOKE',
                error: 'ERR_NATIVE_INVOKE',
                message: error?.message || 'Erreur inattendue lors de la communication avec le pont natif.',
                details: { cause: error }
            };
        }
    }

    /**
     * Génère un rapport complet et instantané de l'état du système (environnement, CPU, mémoire,
     * écran, réseau, stockage et batterie).
     *
     * @returns {Promise<Object>} Photographie complète de l'état système.
     *
     * @example <caption>Exemple 1 : Obtenir un diagnostic complet</caption>
     * const snap = await NSys.getSnapshot();
     * console.log(snap.cpuCores, snap.environment.os);
     *
     * @example <caption>Exemple 2 : Exporter en JSON</caption>
     * console.log(typeof JSON.stringify(await NSys.getSnapshot())); // 'string'
     */
    static async getSnapshot() {
        const [battery, storage] = await Promise.all([
            NSys.getBattery(),
            NSys.getStorageQuota()
        ]);

        return {
            uptimeSeconds: NSys.uptime(true),
            cpuCores: NSys.cpuCores,
            arch: NSys.arch,
            deviceMemoryGb: NSys.deviceMemory,
            environment: NEnv.info,
            memory: NSys.memory,
            screen: NSys.screen,
            network: NSys.network,
            storage,
            battery
        };
    }

    /**
     * Sérialise l'état synchrone de `NSys` en objet JSON.
     *
     * @returns {Object} Représentation JSON du système.
     *
     * @example <caption>Exemple 1 : Convertir en JSON</caption>
     * console.log(NSys.toJSON().cpuCores >= 1); // true
     *
     * @example <caption>Exemple 2 : Inclut l'environnement et la mémoire</caption>
     * console.log(typeof NSys.toJSON().memory); // 'object'
     */
    static toJSON() {
        return {
            uptimeSeconds: NSys.uptime(true),
            cpuCores: NSys.cpuCores,
            arch: NSys.arch,
            deviceMemoryGb: NSys.deviceMemory,
            environment: NEnv.info,
            memory: NSys.memory,
            screen: NSys.screen,
            network: NSys.network
        };
    }

}

export default NSys;
