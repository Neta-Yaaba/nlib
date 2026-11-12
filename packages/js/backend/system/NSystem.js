/**
 * @file NSystem.js
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
 * Ne dépend pas de `NObject` et est exposée sous forme d'instance partagée à initialisation paresseuse
 * via `NUtil.sys` (et son alias `NUtil.system`).
 */

import { NUtil } from '../utils/NUtil.js';

/**
 * @class NSystem
 * @description Gestionnaire et inspecteur des ressources matérielles et système (Navigateur, WebView OS et Node.js).
 *
 * @example <caption>Exemple 1 : Inspecter le matériel (CPU, mémoire, écran, réseau) via NUtil.sys</caption>
 * console.log(NUtil.sys.cpuCores); // ex: 8
 * console.log(NUtil.sys.memory);   // { used: ..., total: ..., formattedUsed: '...', formattedTotal: '...' }
 * console.log(NUtil.sys.screen);   // { width: 1920, height: 1080, pixelRatio: 1, orientation: 'landscape' }
 *
 * @example <caption>Exemple 2 : Surveiller la connexion réseau et mesurer une performance</caption>
 * NUtil.sys.watchNetwork(true, {
 *     onOffline: () => console.log('Passage en mode hors-ligne SQLite'),
 *     onOnline: () => console.log('Connexion rétablie')
 * });
 * const report = await NUtil.sys.measure('Calcul', async () => NUtil.sleep(50));
 * console.log(report.durationMs); // ~50
 *
 * @example <caption>Exemple 3 : Quota de stockage, batterie et rapport complet</caption>
 * const storage = await NUtil.sys.getStorageQuota();
 * const snapshot = await NUtil.sys.getSnapshot();
 * console.log(snapshot);
 */
export class NSystem {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Timestamp (`Date.now()`) du démarrage de l'instance système.
     * @type {number}
     * @private
     */
    #startedAt = Date.now();

    /**
     * Références internes aux écouteurs `online` / `offline` du navigateur (allouées uniquement si `watchNetwork` est actif).
     * @type {{ onOnline: Function, onOffline: Function }|null}
     * @private
     */
    #networkHandlers = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NSystem`.
     *
     * @param {Object} [options={}] - Options de configuration.
     * @param {boolean} [options.watchNetwork=false] - Si `true` (en navigateur), écoute `window` `online` et `offline`.
     * @param {Function} [options.onOnline] - Fonction appelée lors du retour en ligne.
     * @param {Function} [options.onOffline] - Fonction appelée lors de la perte de connexion.
     *
     * @example <caption>Exemple 1 : Création standard</caption>
     * const sys = new NSystem();
     * console.log(sys.cpuCores >= 1); // true
     *
     * @example <caption>Exemple 2 : Création avec surveillance automatique du réseau</caption>
     * const sys = new NSystem({
     *     watchNetwork: true,
     *     onOnline: () => console.log('Réseau rétabli')
     * });
     */
    constructor(options = {}) {
        if (options?.watchNetwork === true) {
            this.watchNetwork(true, {
                onOnline: options.onOnline,
                onOffline: options.onOffline
            });
        }
    }

    // =========================================================================
    // Getters matériels — CPU, Architecture, Mémoire, Écran & Réseau
    // =========================================================================

    /**
     * Retourne le nombre de cœurs logiques du processeur (`navigator.hardwareConcurrency` ou `1` par défaut).
     *
     * @returns {number} Nombre de cœurs logiques CPU.
     *
     * @example <caption>Exemple 1 : Lire le nombre de cœurs CPU</caption>
     * console.log(NUtil.sys.cpuCores); // ex: 8
     *
     * @example <caption>Exemple 2 : Toujours supérieur ou égal à 1</caption>
     * console.log(NUtil.sys.cpuCores >= 1); // true
     */
    get cpuCores() {
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
     * console.log(NUtil.sys.arch); // ex: 'x64' ou 'arm64'
     *
     * @example <caption>Exemple 2 : Toujours une chaîne non vide</caption>
     * console.log(typeof NUtil.sys.arch); // 'string'
     */
    get arch() {
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
     * console.log(NUtil.sys.deviceMemory); // ex: 8 ou null
     *
     * @example <caption>Exemple 2 : Adapter le cache selon la RAM</caption>
     * const maxCache = (NUtil.sys.deviceMemory ?? 4) >= 8 ? 500 : 100;
     */
    get deviceMemory() {
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
     * console.log(NUtil.sys.memory.formattedUsed); // ex: '14.52 MB'
     *
     * @example <caption>Exemple 2 : Vérifier le pourcentage d'utilisation</caption>
     * console.log(NUtil.sys.memory.usagePercent >= 0); // true
     */
    get memory() {
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
        const usagePercent = base > 0 ? NUtil.num.percentage(used, base, 2) : 0;

        return {
            used,
            total,
            limit,
            usagePercent,
            formattedUsed: NUtil.num.formatBytes(used),
            formattedTotal: NUtil.num.formatBytes(total)
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
     * console.log(NUtil.sys.screen.orientation); // 'landscape' ou 'portrait'
     *
     * @example <caption>Exemple 2 : Vérifier la densité de pixels (Retina / HiDPI)</caption>
     * console.log(NUtil.sys.screen.pixelRatio >= 1); // true
     */
    get screen() {
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
     * console.log(NUtil.sys.network.online, NUtil.sys.network.effectiveType);
     *
     * @example <caption>Exemple 2 : Adapter le chargement si le mode économie de données est actif</caption>
     * if (NUtil.sys.network.saveData) { console.log('Mode économie de données'); }
     */
    get network() {
        const online = NUtil.env.isOnline;
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
     * console.log(NUtil.sys.uptime() >= 0); // true
     *
     * @example <caption>Exemple 2 : Uptime en secondes</caption>
     * console.log(NUtil.sys.uptime(true) >= 0); // true
     */
    uptime(inSeconds = false) {
        let elapsedMs = Date.now() - this.#startedAt;
        if (typeof process !== 'undefined' && typeof process.uptime === 'function') {
            elapsedMs = process.uptime() * 1000;
        } else if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            elapsedMs = performance.now();
        }
        return inSeconds ? NUtil.num.round(elapsedMs / 1000, 2) : Math.trunc(elapsedMs);
    }

    /**
     * Retourne un timestamp haute précision en millisecondes avec décimales microsecondes (`performance.now()`).
     *
     * @returns {number} Temps haute résolution en millisecondes.
     *
     * @example <caption>Exemple 1 : Obtenir le temps haute résolution</caption>
     * const t0 = NUtil.sys.hrtime();
     * console.log(typeof t0); // 'number'
     *
     * @example <caption>Exemple 2 : Calculer un delta très précis</caption>
     * const start = NUtil.sys.hrtime();
     * const delta = NUtil.sys.hrtime() - start;
     * console.log(delta >= 0); // true
     */
    hrtime() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    /**
     * Exécute une fonction (synchrone ou asynchrone) et mesure précisément son temps d'exécution.
     *
     * @param {string} label - Nom de l'opération mesurée.
     * @param {Function} fn - Fonction à exécuter et chronométrer.
     * @returns {Promise<{ label: string, durationMs: number, result: any }>} Rapport d'exécution.
     *
     * @example <caption>Exemple 1 : Mesurer une tâche asynchrone</caption>
     * const report = await NUtil.sys.measure('RequeteSQL', async () => 42);
     * console.log(report.label, report.result, report.durationMs >= 0); // 'RequeteSQL' 42 true
     *
     * @example <caption>Exemple 2 : Mesurer une boucle synchrone</caption>
     * const { durationMs } = await NUtil.sys.measure('Boucle', () => NUtil.arr.range(1, 1000));
     * console.log(durationMs >= 0); // true
     */
    async measure(label, fn) {
        const start = this.hrtime();
        const result = await fn();
        const durationMs = NUtil.num.round(this.hrtime() - start, 3);
        return {
            label: String(label || 'task'),
            durationMs,
            result
        };
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
     * const bat = await NUtil.sys.getBattery();
     * if (bat) { console.log(`${bat.level}%`); }
     *
     * @example <caption>Exemple 2 : Retourne null sous Node.js</caption>
     * const bat = await NUtil.sys.getBattery();
     * console.log(bat === null || typeof bat.level === 'number'); // true
     */
    async getBattery() {
        if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
            try {
                const battery = await navigator.getBattery();
                return {
                    level: NUtil.num.round((battery.level ?? 1) * 100, 0),
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
     * const storage = await NUtil.sys.getStorageQuota();
     * console.log(storage.formattedUsage, storage.formattedQuota);
     *
     * @example <caption>Exemple 2 : Pourcentage d'espace utilisé</caption>
     * const storage = await NUtil.sys.getStorageQuota();
     * console.log(storage.usagePercent >= 0); // true
     */
    async getStorageQuota() {
        if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
            try {
                const estimate = await navigator.storage.estimate();
                const usage = estimate.usage || 0;
                const quota = estimate.quota || 0;
                return {
                    usage,
                    quota,
                    usagePercent: quota > 0 ? NUtil.num.percentage(usage, quota, 2) : 0,
                    formattedUsage: NUtil.num.formatBytes(usage),
                    formattedQuota: NUtil.num.formatBytes(quota)
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
     * const ok = await NUtil.sys.copyToClipboard('Texte copié');
     *
     * @example <caption>Exemple 2 : Texte vide retourne false</caption>
     * console.log(await NUtil.sys.copyToClipboard('')); // false
     */
    async copyToClipboard(text) {
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
     * const content = await NUtil.sys.readFromClipboard();
     * console.log(typeof content); // 'string'
     *
     * @example <caption>Exemple 2 : Sans permission retourne une chaîne vide</caption>
     * console.log(await NUtil.sys.readFromClipboard());
     */
    async readFromClipboard() {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
            try {
                return await navigator.clipboard.readText();
            } catch {
                return '';
            }
        }
        return '';
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
     * NUtil.sys.watchNetwork(true, {
     *     onOffline: (net) => console.log('Connexion perdue', net),
     *     onOnline: (net) => console.log('Connexion rétablie', net)
     * });
     *
     * @example <caption>Exemple 2 : Désactiver la surveillance réseau</caption>
     * NUtil.sys.watchNetwork(false);
     */
    watchNetwork(enable = true, callbacks = {}) {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
            return this;
        }

        if (this.#networkHandlers) {
            window.removeEventListener('online', this.#networkHandlers.onOnline);
            window.removeEventListener('offline', this.#networkHandlers.onOffline);
            this.#networkHandlers = null;
        }

        if (!enable) {
            return this;
        }

        const onOnline = () => {
            if (typeof callbacks?.onOnline === 'function') {
                callbacks.onOnline(this.network);
            }
        };
        const onOffline = () => {
            if (typeof callbacks?.onOffline === 'function') {
                callbacks.onOffline(this.network);
            }
        };

        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        this.#networkHandlers = { onOnline, onOffline };

        return this;
    }

    /**
     * Envoie une commande système à l'hôte OS natif (`Android`, `iOS`, `Windows`, `macOS`, `Linux`, `HarmonyOS`)
     * lorsque l'application tourne dans une WebView NLib.
     *
     * @param {string} action - Nom de l'action système native (ex: `'vibrate'`, `'exitApp'`, `'openSettings'`).
     * @param {Object} [payload={}] - Paramètres associés à l'action.
     * @returns {Promise<any>} Réponse du conteneur natif ou `null` si aucun pont natif n'est connecté.
     *
     * @example <caption>Exemple 1 : Demander une action système au conteneur OS</caption>
     * const res = await NUtil.sys.invokeNative('getDeviceInfo', {});
     *
     * @example <caption>Exemple 2 : Hors WebView retourne null sans erreur</caption>
     * console.log(await NUtil.sys.invokeNative('vibrate', { duration: 100 })); // null (si navigateur standard)
     */
    async invokeNative(action, payload = {}) {
        if (typeof action !== 'string' || action.trim().length === 0) {
            return null;
        }
        const message = { action: action.trim(), payload, timestamp: Date.now() };

        if (typeof window !== 'undefined') {
            // 1. Pont standard unifié NLib
            if (window.NLibNativeBridge && typeof window.NLibNativeBridge.invoke === 'function') {
                return await window.NLibNativeBridge.invoke(message.action, message.payload);
            }
            // 2. Windows WebView2
            if (window.chrome?.webview && typeof window.chrome.webview.postMessage === 'function') {
                window.chrome.webview.postMessage(JSON.stringify(message));
                return true;
            }
            // 3. iOS / macOS WKWebView
            if (window.webkit?.messageHandlers?.nlib && typeof window.webkit.messageHandlers.nlib.postMessage === 'function') {
                window.webkit.messageHandlers.nlib.postMessage(message);
                return true;
            }
        }
        return null;
    }

    /**
     * Génère un rapport complet et instantané de l'état du système (environnement, CPU, mémoire,
     * écran, réseau, stockage et batterie).
     *
     * @returns {Promise<Object>} Photographie complète de l'état système.
     *
     * @example <caption>Exemple 1 : Obtenir un diagnostic complet</caption>
     * const snap = await NUtil.sys.getSnapshot();
     * console.log(snap.cpuCores, snap.environment.os);
     *
     * @example <caption>Exemple 2 : Exporter en JSON</caption>
     * console.log(typeof JSON.stringify(await NUtil.sys.getSnapshot())); // 'string'
     */
    async getSnapshot() {
        const [battery, storage] = await Promise.all([
            this.getBattery(),
            this.getStorageQuota()
        ]);

        return {
            uptimeSeconds: this.uptime(true),
            cpuCores: this.cpuCores,
            arch: this.arch,
            deviceMemoryGb: this.deviceMemory,
            environment: NUtil.env.info,
            memory: this.memory,
            screen: this.screen,
            network: this.network,
            storage,
            battery
        };
    }

    /**
     * Sérialise l'état synchrone de `NSystem` en objet JSON.
     *
     * @returns {Object} Représentation JSON du système.
     *
     * @example <caption>Exemple 1 : Convertir en JSON</caption>
     * console.log(NUtil.sys.toJSON().cpuCores >= 1); // true
     *
     * @example <caption>Exemple 2 : Inclut l'environnement et la mémoire</caption>
     * console.log(typeof NUtil.sys.toJSON().memory); // 'object'
     */
    toJSON() {
        return {
            uptimeSeconds: this.uptime(true),
            cpuCores: this.cpuCores,
            arch: this.arch,
            deviceMemoryGb: this.deviceMemory,
            environment: NUtil.env.info,
            memory: this.memory,
            screen: this.screen,
            network: this.network
        };
    }
}

export default NSystem;
