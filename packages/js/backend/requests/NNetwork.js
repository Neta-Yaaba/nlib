/**
 * @file NNetwork.js
 * @package @nlib/js-backend
 * @description Module réseau universel pour l'écosystème NLib. Prend en charge les requêtes HTTP/HTTPS
 * avec sélection de moteur (`fetch` ou `XMLHttpRequest`), la récupération de métadonnées de fichiers (HEAD),
 * le téléchargement unitaire ou multiple (direct ou par tranches/chunks de 1 Mo max avec suivi de progression),
 * et le téléversement (upload) unitaire ou multiple (direct ou par chunks de 1 Mo max en FormData ou binaire avec headers).
 *
 * Conforme aux standards NLib : classe autonome sans héritage NObject, initialisation paresseuse,
 * et intégration via `NUtil.network`.
 */

import { NException } from '../core/NException.js';
import { NUtil } from '../utils/NUtil.js';

/**
 * @class NNetwork
 * @description Gestionnaire universel de requêtes réseau, transferts et flux de fichiers (upload/download)
 * découpés automatiquement en tranches de 1 Mo maximum.
 *
 * @example <caption>Exemple 1 : Requête HTTP simple via fetch ou XHR</caption>
 * const net = new NNetwork({ driver: 'fetch', timeout: 10000 });
 * const res = await net.get('https://api.example.com/data', { responseType: 'json' });
 * console.log(res.status, res.data);
 *
 * @example <caption>Exemple 2 : Téléchargement d'un fichier avec découpage par chunks de 1 Mo</caption>
 * const fileResult = await NUtil.network.downloadFile('https://example.com/large-archive.zip', {
 *     onProgress: ({ percent, chunkIndex, totalChunks, loaded, total }) => {
 *         console.log(`Téléchargement : ${percent.toFixed(1)}% (chunk ${chunkIndex + 1}/${totalChunks})`);
 *     }
 * });
 * console.log('Nom déduit :', fileResult.name, 'Taille :', fileResult.size, 'Blob :', fileResult.blob);
 *
 * @example <caption>Exemple 3 : Téléversement (upload) de plusieurs fichiers par chunks</caption>
 * const files = [myFile1, myFile2]; // Objets File du navigateur ou Blobs
 * const results = await NUtil.network.uploadFiles('https://api.example.com/upload-chunk', files, {
 *     chunkMode: 'formData', // ou 'binary'
 *     onFileProgress: ({ fileIndex, totalFiles, percent, currentFile }) => {
 *         console.log(`Fichier ${fileIndex + 1}/${totalFiles} (${currentFile.name}) : ${percent}%`);
 *     }
 * });
 */
export class NNetwork {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Taille maximale standard d'un chunk (1 Mo = 1 048 576 octets).
     * Tout fichier de taille supérieure à ce seuil est automatiquement segmenté.
     * @type {number}
     */
    static DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 Mo

    /**
     * Pilote réseau par défaut ('auto', 'fetch', 'xhr').
     * @type {'auto'|'fetch'|'xhr'}
     * @private
     */
    #driver = 'auto';

    /**
     * Délai d'attente maximum par défaut en millisecondes (0 = infini).
     * @type {number}
     * @private
     */
    #defaultTimeout = 0;

    /**
     * En-têtes HTTP envoyés par défaut avec chaque requête.
     * @type {Object<string, string>|null}
     * @private
     */
    #defaultHeaders = null;

    /**
     * URL de base optionnelle préfixant les requêtes relatives.
     * @type {string|null}
     * @private
     */
    #baseUrl = null;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de NNetwork.
     *
     * @constructor
     * @param {Object} [options={}] - Options de configuration du réseau.
     * @param {'auto'|'fetch'|'xhr'} [options.driver='auto'] - Moteur de communication à utiliser.
     * @param {string} [options.baseUrl] - URL de base optionnelle.
     * @param {number} [options.timeout=0] - Délai maximum en millisecondes.
     * @param {Object<string, string>} [options.headers={}] - En-têtes HTTP par défaut.
     *
     * @example <caption>Exemple 1 : Instanciation avec options par défaut</caption>
     * const net = new NNetwork();
     *
     * @example <caption>Exemple 2 : Instanciation avec driver forcé en XMLHttpRequest et timeout</caption>
     * const netXhr = new NNetwork({ driver: 'xhr', timeout: 15000, baseUrl: 'https://api.example.com' });
     */
    constructor(options = {}) {
        if (options && typeof options === 'object') {
            if (options.driver === 'fetch' || options.driver === 'xhr' || options.driver === 'auto') {
                this.#driver = options.driver;
            }
            if (typeof options.timeout === 'number' && options.timeout >= 0) {
                this.#defaultTimeout = options.timeout;
            }
            if (typeof options.baseUrl === 'string' && options.baseUrl.trim()) {
                this.#baseUrl = options.baseUrl.trim().replace(/\/+$/, '');
            }
            if (options.headers && typeof options.headers === 'object') {
                this.#defaultHeaders = { ...options.headers };
            }
        }
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    /**
     * Retourne le pilote réseau actif.
     * @type {'auto'|'fetch'|'xhr'}
     *
     * @example <caption>Exemple 1 : Consulter le pilote actif</caption>
     * console.log(net.driver); // 'auto'
     *
     * @example <caption>Exemple 2 : Vérification conditionnelle</caption>
     * if (net.driver === 'xhr') { console.log('Mode XHR actif'); }
     */
    get driver() {
        return this.#driver;
    }

    /**
     * Définit le pilote réseau actif ('auto', 'fetch' ou 'xhr').
     * @param {'auto'|'fetch'|'xhr'} value - Nouveau pilote.
     *
     * @example <caption>Exemple 1 : Forcer l'utilisation de fetch</caption>
     * net.driver = 'fetch';
     *
     * @example <caption>Exemple 2 : Repasser en mode automatique</caption>
     * net.driver = 'auto';
     */
    set driver(value) {
        if (value === 'auto' || value === 'fetch' || value === 'xhr') {
            this.#driver = value;
        }
    }

    /**
     * Retourne l'URL de base configurée.
     * @type {string|null}
     *
     * @example <caption>Exemple 1 : Consulter l'URL de base</caption>
     * console.log(net.baseUrl);
     *
     * @example <caption>Exemple 2 : Vérifier la présence d'une URL de base</caption>
     * if (net.baseUrl) { console.log('Préfixe :', net.baseUrl); }
     */
    get baseUrl() {
        return this.#baseUrl;
    }

    /**
     * Définit l'URL de base.
     * @param {string|null} value - URL de base.
     *
     * @example <caption>Exemple 1 : Assigner une URL de base</caption>
     * net.baseUrl = 'https://api.monapp.com/v1';
     *
     * @example <caption>Exemple 2 : Réinitialiser l'URL de base</caption>
     * net.baseUrl = null;
     */
    set baseUrl(value) {
        this.#baseUrl = typeof value === 'string' && value.trim() ? value.trim().replace(/\/+$/, '') : null;
    }

    /**
     * Constante standard de taille de chunk (1 Mo).
     * @static
     * @type {number}
     *
     * @example <caption>Exemple 1 : Lire la taille standard de chunk</caption>
     * console.log(NNetwork.CHUNK_SIZE); // 1048576 (1 Mo)
     *
     * @example <caption>Exemple 2 : Calculer le nombre de chunks</caption>
     * const chunks = Math.ceil(fileSize / NNetwork.CHUNK_SIZE);
     */
    static get CHUNK_SIZE() {
        return this.DEFAULT_CHUNK_SIZE;
    }

    // =========================================================================
    // Méthodes de Requêtes HTTP Générales
    // =========================================================================

    /**
     * Exécute une requête HTTP avec options complètes.
     *
     * @async
     * @method request
     * @param {string} url - URL cible.
     * @param {Object} [options={}] - Options de la requête.
     * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'|'HEAD'|'OPTIONS'} [options.method='GET'] - Méthode HTTP.
     * @param {Object<string, string>} [options.headers={}] - En-têtes HTTP.
     * @param {any} [options.body] - Corps de la requête.
     * @param {Object} [options.params] - Paramètres d'URL (Query strings).
     * @param {'auto'|'fetch'|'xhr'} [options.driver] - Moteur spécifique à cette requête.
     * @param {'json'|'text'|'blob'|'arrayBuffer'|'raw'} [options.responseType='json'] - Format de réponse attendu.
     * @param {number} [options.timeout] - Timeout en millisecondes pour cette requête.
     * @param {AbortSignal} [options.signal] - Signal d'annulation standard.
     * @param {Function} [options.onUploadProgress] - Callback de progression d'upload `{ loaded, total, percent }`.
     * @param {Function} [options.onDownloadProgress] - Callback de progression de download `{ loaded, total, percent }`.
     * @returns {Promise<{ status: number, statusText: string, headers: Object<string, string>, data: any, ok: boolean }>}
     *
     * @example <caption>Exemple 1 : Requête POST avec corps JSON</caption>
     * const res = await NUtil.network.request('https://api.example.com/users', {
     *     method: 'POST',
     *     body: { username: 'alice', role: 'admin' },
     *     responseType: 'json'
     * });
     * console.log(res.status, res.data);
     *
     * @example <caption>Exemple 2 : Requête GET avec paramètres d'URL et suivi d'avancement</caption>
     * const res = await NUtil.network.request('/items', {
     *     params: { page: 1, limit: 20 },
     *     driver: 'xhr',
     *     onDownloadProgress: ({ percent }) => console.log(`Reçu : ${percent}%`)
     * });
     */
    async request(url, options = {}) {
        const fullUrl = this.#buildUrl(url, options.params);
        const method = (options.method || 'GET').toUpperCase();
        const chosenDriver = this.#resolveDriver(options.driver, options);
        const headers = { ...(this.#defaultHeaders || {}), ...(options.headers || {}) };
        const timeout = typeof options.timeout === 'number' ? options.timeout : this.#defaultTimeout;
        const responseType = options.responseType || 'json';

        if (chosenDriver === 'xhr') {
            return this.#requestWithXhr(fullUrl, {
                method,
                headers,
                body: options.body,
                responseType,
                timeout,
                signal: options.signal,
                onUploadProgress: options.onUploadProgress,
                onDownloadProgress: options.onDownloadProgress
            });
        }

        return this.#requestWithFetch(fullUrl, {
            method,
            headers,
            body: options.body,
            responseType,
            timeout,
            signal: options.signal,
            onDownloadProgress: options.onDownloadProgress
        });
    }

    /**
     * Effectue une requête HTTP GET.
     *
     * @async
     * @method get
     * @param {string} url - URL cible.
     * @param {Object} [options={}] - Options complémentaires (headers, responseType, params, timeout, etc.).
     * @returns {Promise<{ status: number, statusText: string, headers: Object<string, string>, data: any, ok: boolean }>}
     *
     * @example <caption>Exemple 1 : Requête GET basique</caption>
     * const res = await NUtil.network.get('https://jsonplaceholder.typicode.com/todos/1');
     * console.log(res.data.title);
     *
     * @example <caption>Exemple 2 : Requête GET avec format de réponse texte</caption>
     * const res = await NUtil.network.get('/status.txt', { responseType: 'text' });
     * console.log('Statut :', res.data);
     */
    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    /**
     * Effectue une requête HTTP POST.
     *
     * @async
     * @method post
     * @param {string} url - URL cible.
     * @param {any} [body] - Données à envoyer dans le corps.
     * @param {Object} [options={}] - Options complémentaires.
     * @returns {Promise<{ status: number, statusText: string, headers: Object<string, string>, data: any, ok: boolean }>}
     *
     * @example <caption>Exemple 1 : Requête POST avec objet JSON</caption>
     * const res = await NUtil.network.post('/api/auth/login', { email: 'user@test.com', pass: 'secret' });
     *
     * @example <caption>Exemple 2 : Requête POST avec FormData</caption>
     * const fd = new FormData();
     * fd.append('message', 'Bonjour');
     * const res = await NUtil.network.post('/api/messages', fd);
     */
    async post(url, body, options = {}) {
        return this.request(url, { ...options, method: 'POST', body });
    }

    /**
     * Effectue une requête HTTP PUT.
     *
     * @async
     * @method put
     * @param {string} url - URL cible.
     * @param {any} [body] - Données de remplacement.
     * @param {Object} [options={}] - Options complémentaires.
     * @returns {Promise<{ status: number, statusText: string, headers: Object<string, string>, data: any, ok: boolean }>}
     *
     * @example <caption>Exemple 1 : Mettre à jour une ressource complète</caption>
     * const res = await NUtil.network.put('/api/products/42', { name: 'Nouveau Produit', price: 99 });
     *
     * @example <caption>Exemple 2 : Requête PUT avec driver forcé</caption>
     * const res = await NUtil.network.put('/api/config', { active: true }, { driver: 'fetch' });
     */
    async put(url, body, options = {}) {
        return this.request(url, { ...options, method: 'PUT', body });
    }

    /**
     * Effectue une requête HTTP PATCH.
     *
     * @async
     * @method patch
     * @param {string} url - URL cible.
     * @param {any} [body] - Données partielles de mise à jour.
     * @param {Object} [options={}] - Options complémentaires.
     * @returns {Promise<{ status: number, statusText: string, headers: Object<string, string>, data: any, ok: boolean }>}
     *
     * @example <caption>Exemple 1 : Modifier un seul champ d'un utilisateur</caption>
     * const res = await NUtil.network.patch('/api/users/12', { status: 'verified' });
     *
     * @example <caption>Exemple 2 : Requête PATCH avec timeout</caption>
     * const res = await NUtil.network.patch('/api/items/1', { qty: 5 }, { timeout: 5000 });
     */
    async patch(url, body, options = {}) {
        return this.request(url, { ...options, method: 'PATCH', body });
    }

    /**
     * Effectue une requête HTTP DELETE.
     *
     * @async
     * @method delete
     * @param {string} url - URL cible.
     * @param {Object} [options={}] - Options complémentaires.
     * @returns {Promise<{ status: number, statusText: string, headers: Object<string, string>, data: any, ok: boolean }>}
     *
     * @example <caption>Exemple 1 : Supprimer une entité</caption>
     * const res = await NUtil.network.delete('/api/users/99');
     * console.log(res.ok ? 'Supprimé' : 'Erreur');
     *
     * @example <caption>Exemple 2 : Requête DELETE avec headers personnalisés</caption>
     * const res = await NUtil.network.delete('/api/cache', { headers: { 'X-Purge-All': 'true' } });
     */
    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    /**
     * Effectue une requête HTTP HEAD pour obtenir les en-têtes sans charger le corps.
     *
     * @async
     * @method head
     * @param {string} url - URL cible.
     * @param {Object} [options={}] - Options complémentaires.
     * @returns {Promise<{ status: number, statusText: string, headers: Object<string, string>, ok: boolean }>}
     *
     * @example <caption>Exemple 1 : Vérifier l'existence d'une ressource</caption>
     * const res = await NUtil.network.head('https://example.com/asset.png');
     * console.log('Existe :', res.ok, 'Type :', res.headers['content-type']);
     *
     * @example <caption>Exemple 2 : Lire la date de dernière modification</caption>
     * const res = await NUtil.network.head('/api/feed');
     * console.log('Modifié le :', res.headers['last-modified']);
     */
    async head(url, options = {}) {
        const res = await this.request(url, { ...options, method: 'HEAD', responseType: 'raw' });
        return {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
            ok: res.ok
        };
    }

    // =========================================================================
    // Métadonnées de Fichiers (Informations)
    // =========================================================================

    /**
     * Récupère les métadonnées détaillées d'un fichier distant via une requête HEAD
     * (taille en octets, type MIME, nom déduit, support de Range, date de modification, ETag).
     *
     * @async
     * @method getFileInfo
     * @param {string} url - URL du fichier distant.
     * @param {Object} [options={}] - Options de requête optionnelles (headers, timeout, etc.).
     * @returns {Promise<{ url: string, name: string, size: number, type: string, acceptsRanges: boolean, lastModified: string|null, etag: string|null, headers: Object<string, string> }>}
     *
     * @example <caption>Exemple 1 : Obtenir les informations d'une archive distante</caption>
     * const info = await NUtil.network.getFileInfo('https://example.com/downloads/setup.exe');
     * console.log(`Nom: ${info.name}, Taille: ${info.size} octets, Support Range: ${info.acceptsRanges}`);
     *
     * @example <caption>Exemple 2 : Déterminer si un fichier dépasse le seuil de 1 Mo</caption>
     * const info = await NUtil.network.getFileInfo('https://example.com/data.csv');
     * const isLarge = info.size > NNetwork.CHUNK_SIZE;
     * console.log('Découpage par chunk requis :', isLarge);
     */
    async getFileInfo(url, options = {}) {
        const headRes = await this.head(url, options);
        const headers = headRes.headers || {};

        const contentLengthHeader = headers['content-length'];
        const size = contentLengthHeader ? parseInt(contentLengthHeader, 10) : -1;
        const type = headers['content-type'] || 'application/octet-stream';
        const acceptsRanges = (headers['accept-ranges'] || '').toLowerCase().includes('bytes');
        const lastModified = headers['last-modified'] || null;
        const etag = headers['etag'] || null;

        // Déduction du nom du fichier
        let name = this.#extractFilenameFromHeaders(headers);
        if (!name) {
            name = this.#extractFilenameFromUrl(url);
        }

        return {
            url: this.#buildUrl(url),
            name: name || 'file.bin',
            size: Number.isNaN(size) ? -1 : size,
            type,
            acceptsRanges,
            lastModified,
            etag,
            headers
        };
    }

    /**
     * Récupère les métadonnées de plusieurs fichiers distants en parallèle ou en série.
     *
     * @async
     * @method getFilesInfo
     * @param {string[]} urls - Liste des URLs des fichiers.
     * @param {Object} [options={}] - Options de configuration.
     * @param {number} [options.concurrency=4] - Nombre maximal de requêtes HEAD simultanées.
     * @returns {Promise<Array<{ url: string, name: string, size: number, type: string, acceptsRanges: boolean, lastModified: string|null, etag: string|null, headers: Object<string, string>, error?: string }>>}
     *
     * @example <caption>Exemple 1 : Consulter les métadonnées de plusieurs fichiers</caption>
     * const list = ['https://site.com/doc1.pdf', 'https://site.com/doc2.pdf'];
     * const infos = await NUtil.network.getFilesInfo(list);
     * infos.forEach(i => console.log(i.name, i.size));
     *
     * @example <caption>Exemple 2 : Avec limitation de concurrence à 2 requêtes simultanées</caption>
     * const infos = await NUtil.network.getFilesInfo(urls, { concurrency: 2 });
     */
    async getFilesInfo(urls, options = {}) {
        if (!Array.isArray(urls)) {
            throw new NException('NNetwork.getFilesInfo : le paramètre urls doit être un tableau.', {
                code: 'INVALID_PARAMETER',
                context: { urls }
            });
        }

        const concurrency = Math.max(1, typeof options.concurrency === 'number' ? options.concurrency : 4);
        const results = new Array(urls.length);
        let currentIndex = 0;

        const worker = async () => {
            while (currentIndex < urls.length) {
                const index = currentIndex++;
                const fileUrl = urls[index];
                try {
                    results[index] = await this.getFileInfo(fileUrl, options);
                } catch (err) {
                    results[index] = {
                        url: fileUrl,
                        name: this.#extractFilenameFromUrl(fileUrl) || 'unknown',
                        size: -1,
                        type: 'unknown',
                        acceptsRanges: false,
                        lastModified: null,
                        etag: null,
                        headers: {},
                        error: err?.message || String(err)
                    };
                }
            }
        };

        const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
        await Promise.all(workers);

        return results;
    }

    // =========================================================================
    // Téléchargement de Fichiers (Download)
    // =========================================================================

    /**
     * Télécharge un fichier distant. Si la taille dépasse 1 Mo (1 048 576 octets) et que le serveur
     * supporte les en-têtes Range, le téléchargement s'effectue automatiquement par tranches
     * de 1 Mo max assemblées au final en Blob. Dans le cas contraire ou si le serveur ne supporte pas Range,
     * il se télécharge en un flux unique avec progression.
     *
     * @async
     * @method downloadFile
     * @param {string} url - URL du fichier à télécharger.
     * @param {Object} [options={}] - Options de téléchargement.
     * @param {number} [options.chunkSize=1048576] - Taille max par tranche (1 Mo par défaut).
     * @param {boolean} [options.forceChunks=false] - Forcer la segmentation même si < 1 Mo.
     * @param {Function} [options.onProgress] - Callback de progression unifiée.
     *   Reçoit : `{ loaded, total, percent, chunkIndex, totalChunks, isChunked, currentChunkLoaded, currentChunkSize }`
     * @param {AbortSignal} [options.signal] - Signal d'interruption.
     * @param {Object<string, string>} [options.headers={}] - En-têtes additionnels.
     * @returns {Promise<{ blob: Blob, arrayBuffer: ArrayBuffer, name: string, size: number, type: string, isChunked: boolean, chunksCount: number }>}
     *
     * @example <caption>Exemple 1 : Téléchargement simple avec suivi d'avancement</caption>
     * const res = await NUtil.network.downloadFile('https://example.com/app.zip', {
     *     onProgress: ({ percent, loaded, total }) => {
     *         console.log(`Progression : ${percent.toFixed(2)}% (${loaded}/${total} octets)`);
     *     }
     * });
     * console.log('Téléchargé avec succès :', res.name, res.blob.size);
     *
     * @example <caption>Exemple 2 : Téléchargement forcé par tranches de 512 Ko</caption>
     * const res = await NUtil.network.downloadFile('https://example.com/data.bin', {
     *     chunkSize: 512 * 1024,
     *     forceChunks: true,
     *     onProgress: ({ chunkIndex, totalChunks }) => console.log(`Tranche ${chunkIndex + 1} sur ${totalChunks}`)
     * });
     */
    async downloadFile(url, options = {}) {
        const chunkSize = typeof options.chunkSize === 'number' && options.chunkSize > 0
            ? Math.min(options.chunkSize, NNetwork.DEFAULT_CHUNK_SIZE)
            : NNetwork.DEFAULT_CHUNK_SIZE;

        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
        const signal = options.signal || null;

        // 1. Récupérer les informations de la ressource distante
        let info = null;
        try {
            info = await this.getFileInfo(url, { headers: options.headers, signal });
        } catch {
            // Si la requête HEAD échoue (ex: CORS strict), on bascule sur téléchargement direct
            info = {
                url,
                name: this.#extractFilenameFromUrl(url) || 'downloaded_file.bin',
                size: -1,
                type: 'application/octet-stream',
                acceptsRanges: false
            };
        }

        const totalSize = info.size;
        const mustChunk = (totalSize > chunkSize || options.forceChunks === true) && info.acceptsRanges && totalSize > 0;

        // Cas A : Téléchargement par Chunks (Fichier > 1 Mo avec support Range)
        if (mustChunk) {
            return this.#downloadByChunks(url, info, chunkSize, options, onProgress, signal);
        }

        // Cas B : Téléchargement Direct Monobloc (< 1 Mo ou serveur sans Range)
        return this.#downloadMonobloc(url, info, options, onProgress, signal);
    }

    /**
     * Télécharge une liste de fichiers un par un ou en parallèle, avec progression globale et par fichier.
     *
     * @async
     * @method downloadFiles
     * @param {string[]} urls - Liste des URLs à télécharger.
     * @param {Object} [options={}] - Options de téléchargement.
     * @param {number} [options.concurrency=2] - Nombre de téléchargements de fichiers en parallèle.
     * @param {Function} [options.onFileProgress] - Callback par fichier `{ fileIndex, totalFiles, currentUrl, percent, loaded, total }`.
     * @param {Function} [options.onTotalProgress] - Callback global `{ loadedFiles, totalFiles, overallPercent }`.
     * @param {AbortSignal} [options.signal] - Signal d'annulation global.
     * @returns {Promise<Array<{ url: string, blob: Blob, name: string, size: number, type: string, error?: string }>>}
     *
     * @example <caption>Exemple 1 : Télécharger deux fichiers séquentiellement</caption>
     * const files = await NUtil.network.downloadFiles(['https://site.com/f1.pdf', 'https://site.com/f2.pdf'], {
     *     concurrency: 1,
     *     onFileProgress: ({ fileIndex, percent }) => console.log(`Fichier ${fileIndex + 1} : ${percent}%`)
     * });
     *
     * @example <caption>Exemple 2 : Téléchargement avec progression totale</caption>
     * const files = await NUtil.network.downloadFiles(urls, {
     *     onTotalProgress: ({ loadedFiles, totalFiles, overallPercent }) => {
     *         console.log(`Global : ${loadedFiles}/${totalFiles} (${overallPercent}%)`);
     *     }
     * });
     */
    async downloadFiles(urls, options = {}) {
        if (!Array.isArray(urls)) {
            throw new NException('NNetwork.downloadFiles : urls doit être un tableau.', {
                code: 'INVALID_PARAMETER',
                context: { urls }
            });
        }

        const concurrency = Math.max(1, typeof options.concurrency === 'number' ? options.concurrency : 2);
        const onFileProgress = typeof options.onFileProgress === 'function' ? options.onFileProgress : null;
        const onTotalProgress = typeof options.onTotalProgress === 'function' ? options.onTotalProgress : null;

        const results = new Array(urls.length);
        let completedCount = 0;
        let nextIndex = 0;

        const downloadWorker = async () => {
            while (nextIndex < urls.length) {
                const index = nextIndex++;
                const fileUrl = urls[index];

                try {
                    const downloadRes = await this.downloadFile(fileUrl, {
                        ...options,
                        onProgress: (p) => {
                            if (onFileProgress) {
                                onFileProgress({
                                    fileIndex: index,
                                    totalFiles: urls.length,
                                    currentUrl: fileUrl,
                                    ...p
                                });
                            }
                        }
                    });

                    results[index] = {
                        url: fileUrl,
                        blob: downloadRes.blob,
                        arrayBuffer: downloadRes.arrayBuffer,
                        name: downloadRes.name,
                        size: downloadRes.size,
                        type: downloadRes.type
                    };
                } catch (err) {
                    results[index] = {
                        url: fileUrl,
                        blob: null,
                        arrayBuffer: null,
                        name: this.#extractFilenameFromUrl(fileUrl) || 'unknown',
                        size: 0,
                        type: 'unknown',
                        error: err?.message || String(err)
                    };
                } finally {
                    completedCount++;
                    if (onTotalProgress) {
                        onTotalProgress({
                            loadedFiles: completedCount,
                            totalFiles: urls.length,
                            overallPercent: Math.round((completedCount / urls.length) * 100)
                        });
                    }
                }
            }
        };

        const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => downloadWorker());
        await Promise.all(workers);

        return results;
    }

    // =========================================================================
    // Téléversement de Fichiers (Upload)
    // =========================================================================

    /**
     * Téléverse un fichier (File ou Blob) vers une URL de destination.
     * Si la taille du fichier est supérieure à 1 Mo (1 048 576 octets), il est automatiquement
     * découpé et envoyé par chunks successifs selon le mode choisi (`formData` ou `binary`).
     *
     * Format des chunks :
     * - Mode `'formData'` : Envoie un FormData contenant `file` (le blob découpé), `chunkIndex`,
     *   `totalChunks`, `fileName`, `fileSize`, `uploadId`.
     * - Mode `'binary'` : Envoie le blob découpé dans le corps brut avec les en-têtes HTTP
     *   `Content-Range: bytes start-end/total`, `X-Chunk-Index`, `X-Total-Chunks`, `X-File-Name`, `X-Upload-Id`.
     *
     * @async
     * @method uploadFile
     * @param {string} url - URL du serveur recevant l'upload.
     * @param {Blob|File} file - Fichier ou Blob à téléverser.
     * @param {Object} [options={}] - Options de téléversement.
     * @param {'formData'|'binary'} [options.chunkMode='formData'] - Format d'envoi des chunks ('formData' ou 'binary').
     * @param {string} [options.fieldName='file'] - Nom du champ pour FormData.
     * @param {string} [options.fileName] - Nom personnalisé du fichier.
     * @param {number} [options.chunkSize=1048576] - Taille max par tranche (1 Mo max).
     * @param {boolean} [options.forceChunks=false] - Forcer le chunking même si le fichier fait moins de 1 Mo.
     * @param {string} [options.uploadId] - Identifiant de session d'upload (généré automatiquement si omis).
     * @param {Object} [options.extraData={}] - Données additionnelles transmises avec les requêtes.
     * @param {Object<string, string>} [options.headers={}] - En-têtes HTTP supplémentaires.
     * @param {Function} [options.onProgress] - Suivi de progression `{ loaded, total, percent, chunkIndex, totalChunks, isChunked }`.
     * @param {AbortSignal} [options.signal] - Signal d'annulation.
     * @returns {Promise<{ ok: boolean, status: number, data: any, uploadId: string, isChunked: boolean, totalChunks: number }>}
     *
     * @example <caption>Exemple 1 : Téléversement d'un fichier en mode FormData (par défaut)</caption>
     * const fileInput = document.querySelector('input[type="file"]');
     * const file = fileInput.files[0];
     * const res = await NUtil.network.uploadFile('https://api.example.com/upload', file, {
     *     onProgress: ({ percent, chunkIndex, totalChunks }) => {
     *         console.log(`Upload : ${percent}% (tranche ${chunkIndex + 1}/${totalChunks})`);
     *     }
     * });
     *
     * @example <caption>Exemple 2 : Téléversement en mode binaire brut avec headers Content-Range</caption>
     * const res = await NUtil.network.uploadFile('/api/upload-stream', file, {
     *     chunkMode: 'binary',
     *     headers: { 'Authorization': 'Bearer my_token' }
     * });
     */
    async uploadFile(url, file, options = {}) {
        if (!file || typeof file.size !== 'number') {
            throw new NException('NNetwork.uploadFile : le paramètre file doit être un Blob ou un File valide.', {
                code: 'INVALID_FILE',
                context: { file }
            });
        }

        const fileSize = file.size;
        const chunkSize = typeof options.chunkSize === 'number' && options.chunkSize > 0
            ? Math.min(options.chunkSize, NNetwork.DEFAULT_CHUNK_SIZE)
            : NNetwork.DEFAULT_CHUNK_SIZE;

        const mustChunk = fileSize > chunkSize || options.forceChunks === true;
        const fileName = options.fileName || file.name || 'uploaded_file.bin';
        const uploadId = options.uploadId || NUtil.uid('upl_');
        const chunkMode = options.chunkMode === 'binary' ? 'binary' : 'formData';
        const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

        // Cas A : Upload par chunks de 1 Mo max
        if (mustChunk) {
            return this.#uploadByChunks(url, file, {
                ...options,
                fileName,
                uploadId,
                chunkSize,
                chunkMode,
                onProgress
            });
        }

        // Cas B : Upload direct monobloc (< 1 Mo)
        return this.#uploadMonobloc(url, file, {
            ...options,
            fileName,
            uploadId,
            onProgress
        });
    }

    /**
     * Téléverse une collection de fichiers vers une URL cible.
     *
     * @async
     * @method uploadFiles
     * @param {string} url - URL du serveur récepteur.
     * @param {Array<Blob|File>} files - Liste des fichiers à envoyer.
     * @param {Object} [options={}] - Options d'upload.
     * @param {number} [options.concurrency=1] - Nombre de fichiers uploadés simultanément.
     * @param {Function} [options.onFileProgress] - Callback par fichier `{ fileIndex, totalFiles, currentFile, percent, loaded, total }`.
     * @param {Function} [options.onTotalProgress] - Callback global `{ uploadedFiles, totalFiles, overallPercent }`.
     * @param {AbortSignal} [options.signal] - Signal d'interruption global.
     * @returns {Promise<Array<{ ok: boolean, fileName: string, uploadId: string, status: number, data: any, error?: string }>>}
     *
     * @example <caption>Exemple 1 : Téléversement de plusieurs images par formulaire</caption>
     * const files = Array.from(input.files);
     * const results = await NUtil.network.uploadFiles('/api/gallery', files, {
     *     onFileProgress: ({ fileIndex, percent, currentFile }) => {
     *         console.log(`[${fileIndex + 1}/${files.length}] ${currentFile.name} : ${percent}%`);
     *     }
     * });
     *
     * @example <caption>Exemple 2 : Téléversement avec barre de progression globale</caption>
     * const results = await NUtil.network.uploadFiles('/api/uploads', files, {
     *     concurrency: 2,
     *     onTotalProgress: ({ uploadedFiles, totalFiles, overallPercent }) => {
     *         console.log(`Avancement général : ${uploadedFiles}/${totalFiles} (${overallPercent}%)`);
     *     }
     * });
     */
    async uploadFiles(url, files, options = {}) {
        if (!Array.isArray(files)) {
            throw new NException('NNetwork.uploadFiles : le paramètre files doit être un tableau.', {
                code: 'INVALID_PARAMETER',
                context: { files }
            });
        }

        const concurrency = Math.max(1, typeof options.concurrency === 'number' ? options.concurrency : 1);
        const onFileProgress = typeof options.onFileProgress === 'function' ? options.onFileProgress : null;
        const onTotalProgress = typeof options.onTotalProgress === 'function' ? options.onTotalProgress : null;

        const results = new Array(files.length);
        let completedCount = 0;
        let nextIndex = 0;

        const uploadWorker = async () => {
            while (nextIndex < files.length) {
                const index = nextIndex++;
                const currentFile = files[index];

                try {
                    const uploadRes = await this.uploadFile(url, currentFile, {
                        ...options,
                        onProgress: (p) => {
                            if (onFileProgress) {
                                onFileProgress({
                                    fileIndex: index,
                                    totalFiles: files.length,
                                    currentFile,
                                    ...p
                                });
                            }
                        }
                    });

                    results[index] = {
                        ok: uploadRes.ok,
                        fileName: currentFile.name || `file_${index}`,
                        uploadId: uploadRes.uploadId,
                        status: uploadRes.status,
                        data: uploadRes.data
                    };
                } catch (err) {
                    results[index] = {
                        ok: false,
                        fileName: currentFile?.name || `file_${index}`,
                        uploadId: null,
                        status: 0,
                        data: null,
                        error: err?.message || String(err)
                    };
                } finally {
                    completedCount++;
                    if (onTotalProgress) {
                        onTotalProgress({
                            uploadedFiles: completedCount,
                            totalFiles: files.length,
                            overallPercent: Math.round((completedCount / files.length) * 100)
                        });
                    }
                }
            }
        };

        const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => uploadWorker());
        await Promise.all(workers);

        return results;
    }

    // =========================================================================
    // Méthodes Privées : Implémentations Fetch & XHR
    // =========================================================================

    /**
     * Résout le moteur de requête effectif en tenant compte du mode 'auto'.
     * @private
     */
    #resolveDriver(driverOption, options) {
        const candidate = driverOption || this.#driver;
        if (candidate === 'fetch' || candidate === 'xhr') {
            return candidate;
        }

        // Si progression d'upload demandée et XHR disponible, privilégier XHR
        if (typeof options.onUploadProgress === 'function' && typeof XMLHttpRequest !== 'undefined') {
            return 'xhr';
        }

        if (typeof fetch === 'function') {
            return 'fetch';
        }

        if (typeof XMLHttpRequest !== 'undefined') {
            return 'xhr';
        }

        throw new NException('NNetwork : aucun moteur de requête HTTP (fetch ou XMLHttpRequest) disponible.', {
            code: 'NO_HTTP_DRIVER'
        });
    }

    /**
     * Exécute une requête avec l'API Fetch.
     * @private
     */
    async #requestWithFetch(url, options) {
        const { method, headers, body, responseType, timeout, signal, onDownloadProgress } = options;

        let abortController = null;
        let activeSignal = signal;

        // Gestion du timeout
        let timer = null;
        if (timeout > 0) {
            abortController = new AbortController();
            if (signal) {
                signal.addEventListener('abort', () => abortController.abort());
            }
            activeSignal = abortController.signal;
            timer = setTimeout(() => {
                abortController.abort(new Error(`Timeout de ${timeout}ms dépassé.`));
            }, timeout);
        }

        const fetchInit = {
            method,
            headers: { ...headers },
            signal: activeSignal
        };

        // Formatage du corps de la requête
        if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
            if (this.#isRawBody(body)) {
                fetchInit.body = body;
            } else if (typeof body === 'object') {
                if (!fetchInit.headers['Content-Type'] && !fetchInit.headers['content-type']) {
                    fetchInit.headers['Content-Type'] = 'application/json';
                }
                fetchInit.body = JSON.stringify(body);
            } else {
                fetchInit.body = String(body);
            }
        }

        try {
            const response = await fetch(url, fetchInit);
            if (timer) clearTimeout(timer);

            const parsedHeaders = this.#parseFetchHeaders(response.headers);
            const status = response.status;
            const statusText = response.statusText;
            const ok = response.ok;

            if (responseType === 'raw' || method === 'HEAD') {
                return { status, statusText, headers: parsedHeaders, data: null, ok };
            }

            // Suivi de progression du téléchargement si demandé et body en stream
            let data = null;
            if (typeof onDownloadProgress === 'function' && response.body && typeof ReadableStream !== 'undefined') {
                data = await this.#readFetchStreamWithProgress(response, parsedHeaders, responseType, onDownloadProgress);
            } else {
                data = await this.#parseFetchResponseData(response, responseType);
            }

            return { status, statusText, headers: parsedHeaders, data, ok };
        } catch (err) {
            if (timer) clearTimeout(timer);
            throw new NException(`NNetwork (fetch) : échec de la requête vers "${url}".`, {
                code: 'REQUEST_FAILED',
                context: { url, method, error: err?.message || String(err) }
            });
        }
    }

    /**
     * Exécute une requête avec XMLHttpRequest.
     * @private
     */
    #requestWithXhr(url, options) {
        return new Promise((resolve, reject) => {
            const { method, headers, body, responseType, timeout, signal, onUploadProgress, onDownloadProgress } = options;

            const xhr = new XMLHttpRequest();
            xhr.open(method, url, true);

            if (timeout > 0) {
                xhr.timeout = timeout;
            }

            // Type de réponse pour XHR
            if (responseType === 'blob') {
                xhr.responseType = 'blob';
            } else if (responseType === 'arrayBuffer') {
                xhr.responseType = 'arraybuffer';
            } else if (responseType === 'text') {
                xhr.responseType = 'text';
            } else if (responseType === 'json') {
                xhr.responseType = 'text'; // On parse manuellement pour tolérer les réponses vides
            }

            // En-têtes
            let isJsonBody = false;
            let formattedBody = body;

            if (body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD') {
                if (this.#isRawBody(body)) {
                    formattedBody = body;
                } else if (typeof body === 'object') {
                    isJsonBody = true;
                    formattedBody = JSON.stringify(body);
                } else {
                    formattedBody = String(body);
                }
            }

            for (const [key, val] of Object.entries(headers || {})) {
                xhr.setRequestHeader(key, String(val));
            }

            if (isJsonBody && !headers['Content-Type'] && !headers['content-type']) {
                xhr.setRequestHeader('Content-Type', 'application/json');
            }

            // Suivi de progression Upload
            if (xhr.upload && typeof onUploadProgress === 'function') {
                xhr.upload.onprogress = (evt) => {
                    const loaded = evt.loaded;
                    const total = evt.lengthComputable ? evt.total : loaded;
                    const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
                    onUploadProgress({ loaded, total, percent });
                };
            }

            // Suivi de progression Download
            if (typeof onDownloadProgress === 'function') {
                xhr.onprogress = (evt) => {
                    const loaded = evt.loaded;
                    const total = evt.lengthComputable ? evt.total : loaded;
                    const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
                    onDownloadProgress({ loaded, total, percent });
                };
            }

            // Annulation via AbortSignal
            if (signal) {
                if (signal.aborted) {
                    xhr.abort();
                    return reject(new NException('Requête annulée avant envoi.', { code: 'REQUEST_ABORTED' }));
                }
                signal.addEventListener('abort', () => xhr.abort());
            }

            xhr.onload = () => {
                const headersObj = this.#parseXhrHeaders(xhr.getAllResponseHeaders());
                const status = xhr.status;
                const statusText = xhr.statusText;
                const ok = status >= 200 && status < 300;

                let data = null;
                if (responseType !== 'raw' && method !== 'HEAD') {
                    if (responseType === 'json') {
                        try {
                            data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
                        } catch {
                            data = xhr.responseText;
                        }
                    } else if (responseType === 'text') {
                        data = xhr.responseText;
                    } else {
                        data = xhr.response;
                    }
                }

                resolve({ status, statusText, headers: headersObj, data, ok });
            };

            xhr.onerror = () => {
                reject(new NException(`NNetwork (xhr) : échec réseau sur "${url}".`, {
                    code: 'XHR_NETWORK_ERROR',
                    context: { url, method }
                }));
            };

            xhr.ontimeout = () => {
                reject(new NException(`NNetwork (xhr) : timeout de ${timeout}ms dépassé pour "${url}".`, {
                    code: 'XHR_TIMEOUT',
                    context: { url, timeout }
                }));
            };

            xhr.onabort = () => {
                reject(new NException(`NNetwork (xhr) : requête annulée pour "${url}".`, {
                    code: 'XHR_ABORTED',
                    context: { url }
                }));
            };

            xhr.send(formattedBody);
        });
    }

    // =========================================================================
    // Méthodes Privées : Gestion des Chunks Téléchargement
    // =========================================================================

    /**
     * Télécharge un fichier segmenté en blocs de taille max chunkSize (1 Mo) via Range: bytes=start-end.
     * @private
     */
    async #downloadByChunks(url, info, chunkSize, options, onProgress, signal) {
        const totalSize = info.size;
        const totalChunks = Math.ceil(totalSize / chunkSize);
        const chunkBlobs = [];
        let totalLoaded = 0;

        for (let i = 0; i < totalChunks; i++) {
            if (signal?.aborted) {
                throw new NException('Téléchargement par chunks interrompu.', { code: 'DOWNLOAD_ABORTED' });
            }

            const start = i * chunkSize;
            const end = Math.min(start + chunkSize - 1, totalSize - 1);
            const currentChunkExpected = (end - start) + 1;

            const chunkHeaders = {
                ...(options.headers || {}),
                'Range': `bytes=${start}-${end}`
            };

            const chunkRes = await this.request(url, {
                ...options,
                method: 'GET',
                headers: chunkHeaders,
                responseType: 'blob',
                signal,
                onDownloadProgress: (prog) => {
                    if (onProgress) {
                        const currentLoaded = totalLoaded + prog.loaded;
                        const percent = totalSize > 0 ? Math.min(100, (currentLoaded / totalSize) * 100) : 0;
                        onProgress({
                            loaded: currentLoaded,
                            total: totalSize,
                            percent,
                            chunkIndex: i,
                            totalChunks,
                            isChunked: true,
                            currentChunkLoaded: prog.loaded,
                            currentChunkSize: currentChunkExpected
                        });
                    }
                }
            });

            const blobPart = chunkRes.data;
            chunkBlobs.push(blobPart);
            totalLoaded += currentChunkExpected;

            if (onProgress) {
                const percent = Math.min(100, (totalLoaded / totalSize) * 100);
                onProgress({
                    loaded: totalLoaded,
                    total: totalSize,
                    percent,
                    chunkIndex: i,
                    totalChunks,
                    isChunked: true,
                    currentChunkLoaded: currentChunkExpected,
                    currentChunkSize: currentChunkExpected
                });
            }
        }

        const finalBlob = new Blob(chunkBlobs, { type: info.type });
        const arrayBuffer = await finalBlob.arrayBuffer();

        return {
            blob: finalBlob,
            arrayBuffer,
            name: info.name,
            size: finalBlob.size,
            type: info.type,
            isChunked: true,
            chunksCount: totalChunks
        };
    }

    /**
     * Télécharge un fichier en un seul flux avec notification de progression.
     * @private
     */
    async #downloadMonobloc(url, info, options, onProgress, signal) {
        const res = await this.request(url, {
            ...options,
            method: 'GET',
            responseType: 'blob',
            signal,
            onDownloadProgress: (prog) => {
                if (onProgress) {
                    onProgress({
                        loaded: prog.loaded,
                        total: prog.total > 0 ? prog.total : info.size,
                        percent: prog.percent,
                        chunkIndex: 0,
                        totalChunks: 1,
                        isChunked: false,
                        currentChunkLoaded: prog.loaded,
                        currentChunkSize: prog.total
                    });
                }
            }
        });

        const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: info.type });
        const arrayBuffer = await blob.arrayBuffer();

        return {
            blob,
            arrayBuffer,
            name: info.name,
            size: blob.size,
            type: info.type,
            isChunked: false,
            chunksCount: 1
        };
    }

    // =========================================================================
    // Méthodes Privées : Gestion des Chunks Téléversement (Upload)
    // =========================================================================

    /**
     * Découpe et téléverse un fichier par blocs de 1 Mo max.
     * Supporte les modes 'formData' et 'binary'.
     * @private
     */
    async #uploadByChunks(url, file, options) {
        const { fileName, uploadId, chunkSize, chunkMode, onProgress, signal, fieldName = 'file', extraData = {} } = options;
        const totalSize = file.size;
        const totalChunks = Math.ceil(totalSize / chunkSize);

        let totalUploadedBytes = 0;
        let lastServerResponse = null;

        for (let i = 0; i < totalChunks; i++) {
            if (signal?.aborted) {
                throw new NException('Téléversement par chunks interrompu.', { code: 'UPLOAD_ABORTED' });
            }

            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, totalSize);
            const chunkSlice = file.slice(start, end, file.type);
            const currentChunkSize = end - start;

            let requestBody = null;
            let chunkHeaders = { ...(options.headers || {}) };

            if (chunkMode === 'formData') {
                const formData = new FormData();
                formData.append(fieldName, chunkSlice, fileName);
                formData.append('uploadId', uploadId);
                formData.append('chunkIndex', String(i));
                formData.append('totalChunks', String(totalChunks));
                formData.append('fileName', fileName);
                formData.append('fileSize', String(totalSize));
                formData.append('startByte', String(start));
                formData.append('endByte', String(end - 1));

                for (const [k, v] of Object.entries(extraData)) {
                    formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
                }

                requestBody = formData;
            } else {
                // Mode binary : flux brut avec en-têtes standard Range et métadonnées
                chunkHeaders['Content-Range'] = `bytes ${start}-${end - 1}/${totalSize}`;
                chunkHeaders['Content-Type'] = file.type || 'application/octet-stream';
                chunkHeaders['X-Upload-Id'] = uploadId;
                chunkHeaders['X-Chunk-Index'] = String(i);
                chunkHeaders['X-Total-Chunks'] = String(totalChunks);
                chunkHeaders['X-File-Name'] = encodeURIComponent(fileName);
                chunkHeaders['X-File-Size'] = String(totalSize);

                for (const [k, v] of Object.entries(extraData)) {
                    chunkHeaders[`X-Meta-${k}`] = encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : String(v));
                }

                requestBody = chunkSlice;
            }

            const res = await this.request(url, {
                ...options,
                method: 'POST',
                headers: chunkHeaders,
                body: requestBody,
                signal,
                onUploadProgress: (prog) => {
                    if (onProgress) {
                        const currentTotal = totalUploadedBytes + prog.loaded;
                        const percent = totalSize > 0 ? Math.min(100, Math.round((currentTotal / totalSize) * 100)) : 0;
                        onProgress({
                            loaded: currentTotal,
                            total: totalSize,
                            percent,
                            chunkIndex: i,
                            totalChunks,
                            isChunked: true,
                            currentChunkLoaded: prog.loaded,
                            currentChunkSize
                        });
                    }
                }
            });

            lastServerResponse = res;
            totalUploadedBytes += currentChunkSize;

            if (onProgress) {
                const percent = Math.min(100, Math.round((totalUploadedBytes / totalSize) * 100));
                onProgress({
                    loaded: totalUploadedBytes,
                    total: totalSize,
                    percent,
                    chunkIndex: i,
                    totalChunks,
                    isChunked: true,
                    currentChunkLoaded: currentChunkSize,
                    currentChunkSize
                });
            }
        }

        return {
            ok: lastServerResponse?.ok ?? true,
            status: lastServerResponse?.status ?? 200,
            data: lastServerResponse?.data ?? null,
            uploadId,
            isChunked: true,
            totalChunks
        };
    }

    /**
     * Téléversement monobloc direct pour fichiers < 1 Mo.
     * @private
     */
    async #uploadMonobloc(url, file, options) {
        const { fileName, uploadId, onProgress, signal, fieldName = 'file', extraData = {}, chunkMode = 'formData' } = options;
        const totalSize = file.size;

        let requestBody = null;
        let headers = { ...(options.headers || {}) };

        if (chunkMode === 'formData') {
            const formData = new FormData();
            formData.append(fieldName, file, fileName);
            formData.append('uploadId', uploadId);
            formData.append('fileName', fileName);
            formData.append('fileSize', String(totalSize));

            for (const [k, v] of Object.entries(extraData)) {
                formData.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
            }
            requestBody = formData;
        } else {
            headers['Content-Type'] = file.type || 'application/octet-stream';
            headers['X-Upload-Id'] = uploadId;
            headers['X-File-Name'] = encodeURIComponent(fileName);
            headers['X-File-Size'] = String(totalSize);
            requestBody = file;
        }

        const res = await this.request(url, {
            ...options,
            method: 'POST',
            headers,
            body: requestBody,
            signal,
            onUploadProgress: (prog) => {
                if (onProgress) {
                    onProgress({
                        loaded: prog.loaded,
                        total: totalSize,
                        percent: prog.percent,
                        chunkIndex: 0,
                        totalChunks: 1,
                        isChunked: false,
                        currentChunkLoaded: prog.loaded,
                        currentChunkSize: totalSize
                    });
                }
            }
        });

        return {
            ok: res.ok,
            status: res.status,
            data: res.data,
            uploadId,
            isChunked: false,
            totalChunks: 1
        };
    }

    // =========================================================================
    // Méthodes Utilitaires Privées
    // =========================================================================

    /**
     * Construit l'URL complète avec concaténation de baseUrl et query parameters.
     * @private
     */
    #buildUrl(endpoint, params) {
        let finalUrl = endpoint || '';
        if (this.#baseUrl && !finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('//')) {
            finalUrl = `${this.#baseUrl}/${finalUrl.replace(/^\/+/, '')}`;
        }

        if (params && typeof params === 'object') {
            const queryParts = [];
            for (const [key, val] of Object.entries(params)) {
                if (val !== undefined && val !== null) {
                    queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
                }
            }
            if (queryParts.length > 0) {
                const separator = finalUrl.includes('?') ? '&' : '?';
                finalUrl += separator + queryParts.join('&');
            }
        }

        return finalUrl;
    }

    /**
     * Vérifie si le corps est un objet binaire natif ne nécessitant pas de JSON.stringify.
     * @private
     */
    #isRawBody(body) {
        if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
        if (typeof Blob !== 'undefined' && body instanceof Blob) return true;
        if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) return true;
        if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true;
        if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return true;
        return typeof body === 'string';
    }

    /**
     * Convertit les en-têtes d'un objet Response Fetch en dictionnaire clé/valeur minuscule.
     * @private
     */
    #parseFetchHeaders(fetchHeaders) {
        const result = {};
        if (fetchHeaders && typeof fetchHeaders.forEach === 'function') {
            fetchHeaders.forEach((val, key) => {
                result[key.toLowerCase()] = val;
            });
        }
        return result;
    }

    /**
     * Parse la chaîne d'en-têtes bruts renvoyée par XMLHttpRequest.
     * @private
     */
    #parseXhrHeaders(rawHeaders) {
        const result = {};
        if (!rawHeaders || typeof rawHeaders !== 'string') return result;

        const lines = rawHeaders.trim().split(/[\r\n]+/);
        for (const line of lines) {
            const parts = line.split(': ');
            const key = parts.shift()?.trim().toLowerCase();
            const val = parts.join(': ')?.trim();
            if (key) {
                result[key] = val;
            }
        }
        return result;
    }

    /**
     * Extrait le corps d'une réponse Fetch selon le type souhaité.
     * @private
     */
    async #parseFetchResponseData(response, responseType) {
        switch (responseType) {
            case 'json': {
                const text = await response.text();
                try {
                    return text ? JSON.parse(text) : null;
                } catch {
                    return text;
                }
            }
            case 'text':
                return response.text();
            case 'blob':
                return response.blob();
            case 'arrayBuffer':
                return response.arrayBuffer();
            default:
                return response.text();
        }
    }

    /**
     * Lit un ReadableStream Fetch tout en émettant la progression de téléchargement.
     * @private
     */
    async #readFetchStreamWithProgress(response, headers, responseType, onProgress) {
        const contentLength = headers['content-length'];
        const total = contentLength ? parseInt(contentLength, 10) : -1;
        const reader = response.body.getReader();
        const chunks = [];
        let loaded = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            loaded += value.length;

            const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
            onProgress({ loaded, total: total > 0 ? total : loaded, percent });
        }

        // Assemblage des Uint8Array reçus
        const combined = new Uint8Array(loaded);
        let offset = 0;
        for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
        }

        if (responseType === 'arrayBuffer') {
            return combined.buffer;
        }

        const mime = headers['content-type'] || 'application/octet-stream';
        const blob = new Blob([combined], { type: mime });

        if (responseType === 'blob') {
            return blob;
        }

        const text = new TextDecoder().decode(combined);
        if (responseType === 'json') {
            try {
                return text ? JSON.parse(text) : null;
            } catch {
                return text;
            }
        }

        return text;
    }

    /**
     * Déduit le nom de fichier à partir du header Content-Disposition.
     * @private
     */
    #extractFilenameFromHeaders(headers) {
        const disposition = headers['content-disposition'];
        if (!disposition) return null;

        // filename*=UTF-8''my%20file.pdf ou filename="file.pdf"
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match && utf8Match[1]) {
            try {
                return decodeURIComponent(utf8Match[1]);
            } catch {
                return utf8Match[1];
            }
        }

        const standardMatch = disposition.match(/filename="?([^";]+)"?/i);
        if (standardMatch && standardMatch[1]) {
            return standardMatch[1].trim();
        }

        return null;
    }

    /**
     * Déduit le nom de fichier à partir du chemin de l'URL.
     * @private
     */
    #extractFilenameFromUrl(url) {
        if (!url || typeof url !== 'string') return null;
        try {
            const cleanPath = url.split('?')[0].split('#')[0];
            const segments = cleanPath.split('/');
            const last = segments.pop() || segments.pop();
            return last ? decodeURIComponent(last) : null;
        } catch {
            return null;
        }
    }
}

export default NNetwork;