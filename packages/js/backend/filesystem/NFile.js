/**
 * @file NFile.js
 * @package @nlib/js-backend
 * @description Classe utilitaire de gestion des fichiers pour l'écosystème NLib,
 * classe utilitaire statique accessible directement via `NFile` ou `NFile`.
 *
 * Stratégie de stockage adaptative multiplateforme à 3 niveaux :
 * 1. **Conteneur Natif / WebView (`native`)** : si `NEnv.isWebView` est actif, délègue les opérations
 *    au système d'exploitation hôte via `NSys.invokeNative`.
 * 2. **File System Access API / OPFS (`fs`)** : si l'API `navigator.storage.getDirectory` (Origin Private
 *    File System / File System Access API) est disponible, opère sur le système de fichiers local
 *    du navigateur ou Web Worker.
 * 3. **IndexedDB (`idb`)** : s'appuie sur `NIndexedDB.instance` (magasin `ntable`) pour persister les fichiers
 *    (binaires, textes, JSON).
 *
 * Les erreurs sont journalisées via `NLog` avec retours normalisés.
 */

import { NLog } from '../log/NLog.js';
import { NUtil } from '../utils/NUtil.js';
import { NCrypto } from '../utils/NCrypto.js';
import { NIndexedDB } from '../database/NIndexedDB.js';
import { NNum } from '../utils/NNum.js';
import { NSys } from '../system/NSys.js';

/**
 * Structure de réponse standardisée pour les opérations de système de fichiers `NFile`.
 * @typedef {Object} NFileResponse
 * @property {boolean} ok - Indique si l'opération a réussi.
 * @property {any} [data=null] - Données ou métadonnées retournées par l'opération.
 * @property {string|null} [error=null] - Message d'erreur explicite en cas d'échec.
 * @property {string|null} [code=null] - Code d'erreur standardisé.
 */

/**
 * Métadonnées descriptives d'un fichier retournées par `stat()` / `info()`.
 * @typedef {Object} NFileInfo
 * @property {string} path - Chemin complet normalisé du fichier.
 * @property {string} name - Nom du fichier avec extension (ex: `'rapport.pdf'`).
 * @property {string} baseName - Nom du fichier sans extension (ex: `'rapport'`).
 * @property {string} extension - Extension en minuscules sans point (ex: `'pdf'`).
 * @property {string} directory - Chemin du dossier parent (ex: `'docs/2026'`).
 * @property {number} size - Taille du fichier en octets.
 * @property {string} formattedSize - Taille formatée lisible (ex: `'1.5 KB'`).
 * @property {string} mimeType - Type MIME détecté (ex: `'application/pdf'`).
 * @property {number} createdAt - Horodatage de création (ms).
 * @property {number} updatedAt - Horodatage de dernière modification (ms).
 * @property {boolean} isFile - Toujours `true` pour un fichier.
 * @property {boolean} isDirectory - Toujours `false` pour un fichier.
 * @property {'native'|'fs'|'idb'} driver - Moteur de stockage ayant fourni l'information.
 */

/**
 * @class NFile
 * @description Service utilitaire de manipulation et de persistance des fichiers (CRUD, métadonnées,
 * chemins, conversions binaires/texte/Base64/JSON) avec bascule automatique entre Pont Natif (`invokeNative`),
 * File System Access API (`navigator.storage.getDirectory`) et IndexedDB (`NIndexedDB.instance`).
 *
 * @example <caption>Exemple 1 : Écrire et lire un fichier texte et JSON via NFile</caption>
 * await NFile.writeText('configs/welcome.txt', 'Bienvenue sur NLib');
 * const text = await NFile.readText('configs/welcome.txt');
 * console.log(text); // 'Bienvenue sur NLib'
 *
 * await NFile.writeJson('configs/settings.json', { theme: 'dark', version: 1 });
 * const settings = await NFile.readJson('configs/settings.json');
 * console.log(settings.theme); // 'dark'
 *
 * @example <caption>Exemple 2 : Opérations système (exists, stat, copy, move, rename, delete)</caption>
 * await NFile.writeText('rapports/q1.txt', 'Bilan Q1');
 * console.log(await NFile.exists('rapports/q1.txt')); // true
 * const statRes = await NFile.stat('rapports/q1.txt');
 * console.log(statRes.data.size, statRes.data.mimeType);
 *
 * await NFile.copy('rapports/q1.txt', 'rapports/q1_backup.txt');
 * await NFile.rename('rapports/q1_backup.txt', 'q1_archive.txt');
 * await NFile.delete('rapports/q1_archive.txt');
 *
 * @example <caption>Exemple 3 : Manipulation de chemins et d'extensions</caption>
 * console.log(NFile.normalizePath('docs\\2026//facture.PDF')); // 'docs/2026/facture.PDF'
 * console.log(NFile.getExtension('facture.PDF'));              // 'pdf'
 * console.log(NFile.getMimeType('facture.pdf'));               // 'application/pdf'
 */
export class NFile {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Préfixe de clé utilisé pour isoler les entrées de fichiers dans le magasin IndexedDB `ntable`.
     * @type {string}
     * @private
     */
    static #idbKeyPrefix = '__nfile__:';

    /**
     * Nom du magasin IndexedDB utilisé en mode de repli.
     * @type {string}
     * @private
     */
    static #idbStoreName = 'ntable';

    /**
     * Table de correspondance des types MIME courants indexée par extension en minuscules.
     * @type {Object<string, string>}
     * @private
     */
    static #mimeTypes = {
        txt: 'text/plain; charset=utf-8',
        log: 'text/plain; charset=utf-8',
        md: 'text/markdown; charset=utf-8',
        csv: 'text/csv; charset=utf-8',
        tsv: 'text/tab-separated-values; charset=utf-8',
        html: 'text/html; charset=utf-8',
        htm: 'text/html; charset=utf-8',
        css: 'text/css; charset=utf-8',
        js: 'application/javascript; charset=utf-8',
        mjs: 'application/javascript; charset=utf-8',
        json: 'application/json; charset=utf-8',
        xml: 'application/xml; charset=utf-8',
        svg: 'image/svg+xml',
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        ico: 'image/x-icon',
        bmp: 'image/bmp',
        avif: 'image/avif',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        m4a: 'audio/mp4',
        mp4: 'video/mp4',
        webm: 'video/webm',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        pdf: 'application/pdf',
        zip: 'application/zip',
        gz: 'application/gzip',
        tar: 'application/x-tar',
        '7z': 'application/x-7z-compressed',
        rar: 'application/vnd.rar',
        wasm: 'application/wasm',
        sqlite: 'application/vnd.sqlite3',
        db: 'application/vnd.sqlite3',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        bin: 'application/octet-stream'
    };

    // =========================================================================
    // Accesseurs d'instance — Détection du moteur de stockage
    // =========================================================================

    /**
     * Retourne le moteur de stockage actif sélectionné automatiquement selon l'environnement :
     * - `'native'` : Application native / WebView (`NEnv.isWebView`) via `NSys.invokeNative`.
     * - `'fs'` : File System Access API / OPFS (`navigator.storage.getDirectory`).
     * - `'idb'` : Repli universel sur IndexedDB (`NIndexedDB.instance`).
     *
     * @returns {'native'|'fs'|'idb'} Identifiant du moteur de stockage actif.
     *
     * @example <caption>Exemple 1 : Identifier le moteur actif</caption>
     * console.log(NFile.driver); // 'native' | 'fs' | 'idb'
     *
     * @example <caption>Exemple 2 : Vérifier via une nouvelle instance</caption>
     * console.log(['native', 'fs', 'idb'].includes(NFile.driver)); // true
     */
    static get driver() {
        if (NFile.isNativeAvailable) {
            return 'native';
        }
        if (NFile.isFsApiAvailable) {
            return 'fs';
        }
        return 'idb';
    }

    /**
     * Indique si le pont de système de fichiers natif (WebView / conteneur OS) est actif.
     *
     * @returns {boolean} `true` si l'environnement est une application native NLib.
     *
     * @example <caption>Exemple 1 : Tester la disponibilité du mode natif</caption>
     * console.log(NFile.isNativeAvailable);
     *
     * @example <caption>Exemple 2 : Retourne toujours un booléen</caption>
     * console.log(typeof NFile.isNativeAvailable); // 'boolean'
     */
    static get isNativeAvailable() {
        return Boolean(NUtil?.env?.isWebView);
    }

    /**
     * Indique si l'API File System Access / OPFS (`navigator.storage.getDirectory`) est disponible
     * dans l'environnement courant (Navigateur moderne ou Web Worker).
     *
     * @returns {boolean} `true` si `navigator.storage.getDirectory` est disponible.
     *
     * @example <caption>Exemple 1 : Vérifier le support de File System Access API</caption>
     * console.log(NFile.isFsApiAvailable);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NFile.isFsApiAvailable); // 'boolean'
     */
    static get isFsApiAvailable() {
        return (
            typeof navigator !== 'undefined' &&
            navigator.storage !== null &&
            typeof navigator.storage === 'object' &&
            typeof navigator.storage.getDirectory === 'function'
        );
    }

    // =========================================================================
    // Méthodes publiques — Chemins, Noms, Extensions & Types MIME
    // =========================================================================

    /**
     * Normalise un chemin de fichier en convertissant les antislashs Windows (`\`) en slashs (`/`),
     * en résolvant les segments relatifs (`.` et `..`), en éliminant les doublons de slashs
     * et en retirant les slashs de début et de fin superflus.
     *
     * @param {string} path - Chemin brut à normaliser.
     * @returns {string} Chemin normalisé propre (ou `''` si invalide).
     *
     * @example <caption>Exemple 1 : Normaliser un chemin Windows ou mixte</caption>
     * console.log(NFile.normalizePath('dossier\\sous_dossier//fichier.txt'));
     * // 'dossier/sous_dossier/fichier.txt'
     *
     * @example <caption>Exemple 2 : Résoudre les segments relatifs</caption>
     * console.log(NFile.normalizePath('/a/b/../c/./doc.pdf'));
     * // 'a/c/doc.pdf'
     */
    static normalizePath(path) {
        if (typeof path !== 'string') {
            return '';
        }
        const cleaned = path
            .replace(/[\0]/g, '')
            .replace(/\\/g, '/')
            .trim();

        if (!cleaned) {
            return '';
        }

        const parts = cleaned.split('/');
        const resolved = [];

        for (let i = 0; i < parts.length; i++) {
            const segment = parts[i].trim();
            if (!segment || segment === '.') {
                continue;
            }
            if (segment === '..') {
                if (resolved.length > 0) {
                    resolved.pop();
                }
                continue;
            }
            resolved.push(segment);
        }

        return resolved.join('/');
    }

    /**
     * Joint proprement plusieurs segments de chemin en un chemin unique normalisé.
     *
     * @param {...string} segments - Segments de chemin à assembler.
     * @returns {string} Chemin assemblé et normalisé.
     *
     * @example <caption>Exemple 1 : Assembler un dossier et un nom de fichier</caption>
     * console.log(NFile.joinPath('exports', '2026', 'facture.pdf'));
     * // 'exports/2026/facture.pdf'
     *
     * @example <caption>Exemple 2 : Nettoyer automatiquement les barres obliques</caption>
     * console.log(NFile.joinPath('/data/', '/logs/', 'app.log'));
     * // 'data/logs/app.log'
     */
    static joinPath(...segments) {
        const valid = segments
            .filter((s) => typeof s === 'string' && s.trim().length > 0)
            .join('/');
        return NFile.normalizePath(valid);
    }

    /**
     * Décompose un chemin de fichier en ses composants structurels :
     * `{ path, directory, name, baseName, extension }`.
     *
     * @param {string} path - Chemin du fichier à analyser.
     * @returns {{ path: string, directory: string, name: string, baseName: string, extension: string }} Composants du chemin.
     *
     * @example <caption>Exemple 1 : Décomposer un chemin complet</caption>
     * console.log(NFile.splitPath('docs/2026/rapport.final.pdf'));
     * // { path: 'docs/2026/rapport.final.pdf', directory: 'docs/2026', name: 'rapport.final.pdf', baseName: 'rapport.final', extension: 'pdf' }
     *
     * @example <caption>Exemple 2 : Fichier à la racine sans extension</caption>
     * console.log(NFile.splitPath('README'));
     * // { path: 'README', directory: '', name: 'README', baseName: 'README', extension: '' }
     */
    static splitPath(path) {
        const normalized = NFile.normalizePath(path);
        if (!normalized) {
            return { path: '', directory: '', name: '', baseName: '', extension: '' };
        }

        const lastSlash = normalized.lastIndexOf('/');
        const directory = lastSlash === -1 ? '' : normalized.slice(0, lastSlash);
        const name = lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);

        const lastDot = name.lastIndexOf('.');
        const hasExt = lastDot > 0 && lastDot < name.length - 1;
        const baseName = hasExt ? name.slice(0, lastDot) : name;
        const extension = hasExt ? name.slice(lastDot + 1).toLowerCase() : '';

        return {
            path: normalized,
            directory,
            name,
            baseName,
            extension
        };
    }

    /**
     * Extrait le chemin du dossier parent d'un chemin de fichier.
     *
     * @param {string} path - Chemin du fichier.
     * @returns {string} Dossier parent (ou `''` si le fichier est à la racine).
     *
     * @example <caption>Exemple 1 : Obtenir le dossier parent</caption>
     * console.log(NFile.getDirName('images/avatars/user.png')); // 'images/avatars'
     *
     * @example <caption>Exemple 2 : Fichier à la racine</caption>
     * console.log(NFile.getDirName('index.html')); // ''
     */
    static getDirName(path) {
        return NFile.splitPath(path).directory;
    }

    /**
     * Extrait le nom complet du fichier (avec son extension) depuis un chemin.
     *
     * @param {string} path - Chemin du fichier.
     * @returns {string} Nom du fichier avec extension.
     *
     * @example <caption>Exemple 1 : Obtenir le nom du fichier</caption>
     * console.log(NFile.getFileName('images/avatars/user.png')); // 'user.png'
     *
     * @example <caption>Exemple 2 : Chemin Windows</caption>
     * console.log(NFile.getFileName('C:\\temp\\notes.txt')); // 'notes.txt'
     */
    static getFileName(path) {
        return NFile.splitPath(path).name;
    }

    /**
     * Extrait le nom de base du fichier (sans son extension) depuis un chemin.
     *
     * @param {string} path - Chemin du fichier.
     * @returns {string} Nom du fichier sans extension.
     *
     * @example <caption>Exemple 1 : Nom sans extension</caption>
     * console.log(NFile.getBaseName('docs/contrat_2026.pdf')); // 'contrat_2026'
     *
     * @example <caption>Exemple 2 : Nom avec plusieurs points</caption>
     * console.log(NFile.getBaseName('archive.tar.gz')); // 'archive.tar'
     */
    static getBaseName(path) {
        return NFile.splitPath(path).baseName;
    }

    /**
     * Extrait l'extension d'un fichier en minuscules.
     *
     * @param {string} path - Chemin ou nom du fichier.
     * @param {boolean} [includeDot=false] - Si `true`, préfixe l'extension avec un point (ex: `'.pdf'`).
     * @returns {string} Extension en minuscules (ou `''` si aucune extension).
     *
     * @example <caption>Exemple 1 : Extension sans point</caption>
     * console.log(NFile.getExtension('photo.JPEG')); // 'jpeg'
     *
     * @example <caption>Exemple 2 : Extension avec point</caption>
     * console.log(NFile.getExtension('photo.JPEG', true)); // '.jpeg'
     */
    static getExtension(path, includeDot = false) {
        const ext = NFile.splitPath(path).extension;
        if (!ext) {
            return '';
        }
        return includeDot ? `.${ext}` : ext;
    }

    /**
     * Détermine le type MIME correspondant à un chemin de fichier ou à une extension.
     *
     * @param {string} pathOrExt - Chemin complet, nom de fichier ou extension (ex: `'doc.pdf'`, `'pdf'`, `'.pdf'`).
     * @param {string} [fallback='application/octet-stream'] - Type MIME par défaut si l'extension est inconnue.
     * @returns {string} Type MIME correspondant.
     *
     * @example <caption>Exemple 1 : Détecter le type MIME depuis un chemin</caption>
     * console.log(NFile.getMimeType('exports/data.json')); // 'application/json; charset=utf-8'
     *
     * @example <caption>Exemple 2 : Détecter le type MIME depuis une extension brute</caption>
     * console.log(NFile.getMimeType('.png')); // 'image/png'
     */
    static getMimeType(pathOrExt, fallback = 'application/octet-stream') {
        if (typeof pathOrExt !== 'string' || !pathOrExt.trim()) {
            return fallback;
        }
        const trimmed = pathOrExt.trim();
        let ext = '';
        if (trimmed.includes('/') || trimmed.includes('\\') || (trimmed.includes('.') && !trimmed.startsWith('.'))) {
            ext = NFile.getExtension(trimmed);
        } else {
            ext = trimmed.replace(/^\.+/, '').toLowerCase();
        }
        return NFile.#mimeTypes[ext] || fallback;
    }

    // =========================================================================
    // Méthodes publiques — Conversions Binaires, Texte, Base64 & DataURL
    // =========================================================================

    /**
     * Convertit n'importe quelle source de données (`Uint8Array`, `ArrayBuffer`, `string`, `Blob`, `Array`, `Object`)
     * en `Uint8Array`.
     *
     * @param {any} data - Données sources à convertir.
     * @returns {Promise<Uint8Array>} Octets sous forme de `Uint8Array`.
     *
     * @example <caption>Exemple 1 : Convertir une chaîne UTF-8 en Uint8Array</caption>
     * const bytes = await NFile.toUint8Array('Bonjour');
     * console.log(bytes instanceof Uint8Array, bytes.byteLength); // true, 7
     *
     * @example <caption>Exemple 2 : Convertir un objet JSON en Uint8Array</caption>
     * const jsonBytes = await NFile.toUint8Array({ ok: true });
     * console.log(jsonBytes.byteLength > 0); // true
     */
    static async toUint8Array(data) {
        if (data === null || data === undefined) {
            return new Uint8Array(0);
        }
        if (data instanceof Uint8Array) {
            return data;
        }
        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }
        if (ArrayBuffer.isView(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
        if (typeof Blob !== 'undefined' && data instanceof Blob) {
            if (typeof data.arrayBuffer === 'function') {
                const buf = await data.arrayBuffer();
                return new Uint8Array(buf);
            }
        }
        if (Array.isArray(data)) {
            return new Uint8Array(data);
        }
        if (typeof data === 'string') {
            if (typeof TextEncoder !== 'undefined') {
                return new TextEncoder().encode(data);
            }
            const arr = new Uint8Array(data.length);
            for (let i = 0; i < data.length; i++) {
                arr[i] = data.charCodeAt(i) & 0xff;
            }
            return arr;
        }
        if (typeof data === 'object') {
            try {
                const json = JSON.stringify(data);
                return await NFile.toUint8Array(json);
            } catch {
                return new Uint8Array(0);
            }
        }
        return await NFile.toUint8Array(String(data));
    }

    /**
     * Convertit des données binaires (`Uint8Array`, `ArrayBuffer`, `Blob`) ou texte en chaîne de caractères.
     *
     * @param {any} data - Données à décoder en texte.
     * @param {string} [encoding='utf-8'] - Encodage de caractères (`'utf-8'` par défaut).
     * @returns {Promise<string>} Chaîne de caractères décodée.
     *
     * @example <caption>Exemple 1 : Décoder un Uint8Array en texte</caption>
     * const bytes = await NFile.toUint8Array('NLib File');
     * console.log(await NFile.toText(bytes)); // 'NLib File'
     *
     * @example <caption>Exemple 2 : Conserver une chaîne existante</caption>
     * console.log(await NFile.toText('Déjà texte')); // 'Déjà texte'
     */
    static async toText(data, encoding = 'utf-8') {
        if (data === null || data === undefined) {
            return '';
        }
        if (typeof data === 'string') {
            return data;
        }
        const bytes = await NFile.toUint8Array(data);
        if (typeof TextDecoder !== 'undefined') {
            try {
                return new TextDecoder(encoding).decode(bytes);
            } catch {
                return new TextDecoder('utf-8').decode(bytes);
            }
        }
        let out = '';
        for (let i = 0; i < bytes.length; i++) {
            out += String.fromCharCode(bytes[i]);
        }
        return out;
    }

    /**
     * Encode des données (`Uint8Array`, `ArrayBuffer`, `string`, `Blob`) en chaîne Base64.
     *
     * @param {any} data - Données à encoder.
     * @returns {Promise<string>} Chaîne encodée en Base64.
     *
     * @example <caption>Exemple 1 : Encoder un texte en Base64</caption>
     * const b64 = await NFile.toBase64('NLib');
     * console.log(b64); // 'TkxpYg=='
     *
     * @example <caption>Exemple 2 : Encoder un Uint8Array en Base64</caption>
     * console.log(await NFile.toBase64(new Uint8Array([65, 66, 67]))); // 'QUJD'
     */
    static async toBase64(data) {
        const bytes = await NFile.toUint8Array(data);
        if (bytes.byteLength === 0) {
            return '';
        }
        if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
            return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
        }
        if (typeof btoa === 'function') {
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                const sub = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
                binary += String.fromCharCode.apply(null, sub);
            }
            return btoa(binary);
        }
        return '';
    }

    /**
     * Décode une chaîne Base64 ou une Data URL (`data:...;base64,...`) en `Uint8Array`.
     *
     * @param {string} base64OrDataUrl - Chaîne Base64 ou Data URL à décoder.
     * @returns {Uint8Array} Octets décodés.
     *
     * @example <caption>Exemple 1 : Décoder une chaîne Base64</caption>
     * const bytes = NFile.fromBase64('TkxpYg==');
     * console.log(bytes.byteLength); // 4
     *
     * @example <caption>Exemple 2 : Décoder une Data URL</caption>
     * const bytes2 = NFile.fromBase64('data:text/plain;base64,TkxpYg==');
     * console.log(bytes2.byteLength); // 4
     */
    static fromBase64(base64OrDataUrl) {
        if (typeof base64OrDataUrl !== 'string' || !base64OrDataUrl.trim()) {
            return new Uint8Array(0);
        }
        let clean = base64OrDataUrl.trim();
        const commaIdx = clean.indexOf(',');
        if (clean.startsWith('data:') && commaIdx !== -1) {
            clean = clean.slice(commaIdx + 1);
        }
        clean = clean.replace(/\s+/g, '');

        try {
            if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
                const buf = Buffer.from(clean, 'base64');
                return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
            }
            if (typeof atob === 'function') {
                const binary = atob(clean);
                const out = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    out[i] = binary.charCodeAt(i);
                }
                return out;
            }
        } catch (err) {
            NLog.warn('NFile.fromBase64 : Chaîne Base64 invalide.', {
                code: 'ERR_FILE_INVALID_BASE64',
                error: err?.message
            });
        }
        return new Uint8Array(0);
    }

    /**
     * Convertit des données en URL de données (`data:<mimeType>;base64,...`).
     *
     * @param {any} data - Données du fichier.
     * @param {string} [mimeType='application/octet-stream'] - Type MIME ou nom de fichier pour déduire le MIME.
     * @returns {Promise<string>} Chaîne Data URL complète.
     *
     * @example <caption>Exemple 1 : Générer une Data URL texte</caption>
     * const url = await NFile.toDataUrl('Bonjour', 'text/plain');
     * console.log(url.startsWith('data:text/plain;base64,')); // true
     *
     * @example <caption>Exemple 2 : Déduire le type MIME à partir d'un nom de fichier</caption>
     * const pngUrl = await NFile.toDataUrl(new Uint8Array([137, 80, 78, 71]), 'image.png');
     * console.log(pngUrl.startsWith('data:image/png;base64,')); // true
     */
    static async toDataUrl(data, mimeType = 'application/octet-stream') {
        const resolvedMime = mimeType && !mimeType.includes('/')
            ? NFile.getMimeType(mimeType)
            : (mimeType || 'application/octet-stream');
        const cleanMime = resolvedMime.split(';')[0].trim();
        const b64 = await NFile.toBase64(data);
        return `data:${cleanMime};base64,${b64}`;
    }

    /**
     * Convertit des données en instance `Blob` (si `Blob` est supporté par l'environnement).
     *
     * @param {any} data - Données sources.
     * @param {string} [mimeType='application/octet-stream'] - Type MIME du Blob.
     * @returns {Promise<Blob|null>} Instance `Blob` ou `null` si non supporté.
     *
     * @example <caption>Exemple 1 : Créer un Blob JSON</caption>
     * const blob = await NFile.toBlob('{"a":1}', 'application/json');
     * console.log(blob?.size); // 7
     *
     * @example <caption>Exemple 2 : Créer un Blob binaire</caption>
     * const binBlob = await NFile.toBlob(new Uint8Array([1, 2, 3]));
     * console.log(binBlob?.size); // 3
     */
    static async toBlob(data, mimeType = 'application/octet-stream') {
        if (typeof Blob === 'undefined') {
            return null;
        }
        if (data instanceof Blob) {
            return data;
        }
        const bytes = await NFile.toUint8Array(data);
        return new Blob([bytes], { type: mimeType });
    }

    // =========================================================================
    // Méthodes publiques — Opérations CRUD & Système de Fichiers
    // =========================================================================

    /**
     * Vérifie si un fichier existe au chemin spécifié.
     *
     * @param {string} path - Chemin du fichier à vérifier.
     * @param {Object} [options={}] - Options éventuelles (`{ driver: 'auto'|'native'|'fs'|'idb' }`).
     * @returns {Promise<boolean>} `true` si le fichier existe, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier l'existence après écriture</caption>
     * await NFile.writeText('test/hello.txt', 'Salut');
     * console.log(await NFile.exists('test/hello.txt')); // true
     *
     * @example <caption>Exemple 2 : Fichier inexistant</caption>
     * console.log(await NFile.exists('test/introuvable.txt')); // false
     */
    static async exists(path, options = {}) {
        const normPath = NFile.normalizePath(path);
        if (!normPath) {
            return false;
        }

        const activeDriver = NFile.#resolveDriver(options?.driver);

        try {
            if (activeDriver === 'native') {
                const res = await NFile.#invokeNativeFile('exists', { path: normPath });
                if (res && typeof res === 'object') {
                    if (typeof res.exists === 'boolean') return res.exists;
                    if (typeof res.data === 'boolean') return res.data;
                    if (res.data && typeof res.data.exists === 'boolean') return res.data.exists;
                }
                return Boolean(res?.ok && res?.data);
            }

            if (activeDriver === 'fs') {
                const handle = await NFile.#getFsFileHandle(normPath, false);
                return handle !== null;
            }

            // Repli IndexedDB
            const idbRes = await NIndexedDB.instance.get(NFile.#idbStoreName, NFile.#toIdbKey(normPath));
            return Boolean(idbRes?.ok && idbRes?.data && idbRes.data.isFile !== false);
        } catch {
            return false;
        }
    }

    /**
     * Récupère les métadonnées complètes d'un fichier (`size`, `mimeType`, `createdAt`, `updatedAt`, `extension`, etc.).
     *
     * @param {string} path - Chemin du fichier.
     * @param {Object} [options={}] - Options éventuelles (`{ driver }`).
     * @returns {Promise<NFileResponse>} Objet `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Obtenir les informations d'un fichier</caption>
     * await NFile.writeText('notes/idee.txt', 'Nouveau projet NLib');
     * const info = await NFile.stat('notes/idee.txt');
     * console.log(info.ok, info.data.size, info.data.extension); // true, 19, 'txt'
     *
     * @example <caption>Exemple 2 : Fichier inexistant</caption>
     * const missing = await NFile.stat('notes/absent.txt');
     * console.log(missing.ok, missing.code); // false, 'ERR_FILE_NOT_FOUND'
     */
    static async stat(path, options = {}) {
        const normPath = NFile.normalizePath(path);
        if (!normPath) {
            return NFile.#fail('Chemin de fichier invalide ou vide.', 'ERR_FILE_INVALID_PATH');
        }

        const activeDriver = NFile.#resolveDriver(options?.driver);
        const pathParts = NFile.splitPath(normPath);
        const mimeType = NFile.getMimeType(normPath);

        try {
            if (activeDriver === 'native') {
                const res = await NFile.#invokeNativeFile('stat', { path: normPath });
                if (!res || res.ok === false || res.success === false) {
                    return NFile.#fail(
                        res?.error || res?.message || `Fichier introuvable : "${normPath}".`,
                        res?.code || 'ERR_FILE_NOT_FOUND'
                    );
                }
                const raw = res.data || res;
                const size = Number(raw.size) || 0;
                const now = Date.now();
                return NFile.#ok({
                    path: normPath,
                    name: pathParts.name,
                    baseName: pathParts.baseName,
                    extension: pathParts.extension,
                    directory: pathParts.directory,
                    size,
                    formattedSize: NNum.formatBytes(size),
                    mimeType: raw.mimeType || mimeType,
                    createdAt: Number(raw.createdAt) || now,
                    updatedAt: Number(raw.updatedAt || raw.lastModified) || now,
                    isFile: true,
                    isDirectory: false,
                    driver: 'native'
                });
            }

            if (activeDriver === 'fs') {
                const fileHandle = await NFile.#getFsFileHandle(normPath, false);
                if (!fileHandle) {
                    return NFile.#fail(`Fichier introuvable : "${normPath}".`, 'ERR_FILE_NOT_FOUND');
                }
                const fileObj = await fileHandle.getFile();
                const size = Number(fileObj.size) || 0;
                const updatedAt = Number(fileObj.lastModified) || Date.now();
                return NFile.#ok({
                    path: normPath,
                    name: pathParts.name,
                    baseName: pathParts.baseName,
                    extension: pathParts.extension,
                    directory: pathParts.directory,
                    size,
                    formattedSize: NNum.formatBytes(size),
                    mimeType: fileObj.type || mimeType,
                    createdAt: updatedAt,
                    updatedAt,
                    isFile: true,
                    isDirectory: false,
                    driver: 'fs'
                });
            }

            // Repli IndexedDB
            const idbRes = await NIndexedDB.instance.get(NFile.#idbStoreName, NFile.#toIdbKey(normPath));
            if (!idbRes?.ok || !idbRes?.data) {
                return NFile.#fail(`Fichier introuvable : "${normPath}".`, 'ERR_FILE_NOT_FOUND');
            }

            const record = idbRes.data;
            const size = Number(record.size) || 0;
            return NFile.#ok({
                path: normPath,
                name: pathParts.name,
                baseName: pathParts.baseName,
                extension: pathParts.extension,
                directory: pathParts.directory,
                size,
                formattedSize: NNum.formatBytes(size),
                mimeType: record.mimeType || mimeType,
                createdAt: Number(record.createdAt) || Date.now(),
                updatedAt: Number(record.updatedAt) || Date.now(),
                isFile: true,
                isDirectory: false,
                driver: 'idb'
            });
        } catch (err) {
            NLog.error(`NFile.stat : Erreur lors de l'inspection du fichier "${normPath}".`, {
                code: 'ERR_FILE_STAT',
                path: normPath,
                error: err?.message
            });
            return NFile.#fail(err?.message || 'Erreur lors de la lecture des métadonnées.', 'ERR_FILE_STAT');
        }
    }

    /**
     * Alias de `stat(path, options)` retournant les métadonnées descriptives du fichier.
     *
     * @param {string} path - Chemin du fichier.
     * @param {Object} [options={}] - Options éventuelles.
     * @returns {Promise<NFileResponse>} Objet `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Lire les informations d'un fichier</caption>
     * await NFile.writeText('logs/jour.log', 'Ligne 1');
     * const res = await NFile.info('logs/jour.log');
     * console.log(res.data.formattedSize);
     *
     * @example <caption>Exemple 2 : Vérifier le type MIME via info()</caption>
     * const res2 = await NFile.info('logs/jour.log');
     * console.log(res2.data.mimeType); // 'text/plain; charset=utf-8'
     */
    static async info(path, options = {}) {
        return await NFile.stat(path, options);
    }

    /**
     * Écrit ou remplace un fichier au chemin spécifié.
     * Crée automatiquement les dossiers parents nécessaires.
     *
     * @param {string} path - Chemin complet du fichier.
     * @param {string|Uint8Array|ArrayBuffer|Blob|Object} data - Contenu à écrire.
     * @param {Object} [options={}] - Options d'écriture.
     * @param {boolean} [options.overwrite=true] - Si `false`, échoue si le fichier existe déjà.
     * @param {boolean} [options.encrypt=false] - Si `true`, chiffre le contenu via `NCrypto`.
     * @param {string} [options.secretKey=''] - Clé secrète optionnelle si `encrypt: true`.
     * @param {string} [options.mimeType] - Type MIME forcé (déduit automatiquement sinon).
     * @param {'auto'|'native'|'fs'|'idb'} [options.driver='auto'] - Moteur de stockage cible.
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Écrire un fichier binaire ou texte</caption>
     * const res = await NFile.write('documents/note.txt', 'Contenu de la note');
     * console.log(res.ok, res.data.size); // true, 18
     *
     * @example <caption>Exemple 2 : Écrire un fichier chiffré</caption>
     * await NFile.write('secrets/token.dat', 'MonJetonSecret', { encrypt: true });
     * const readRes = await NFile.read('secrets/token.dat', { format: 'text', decrypt: true });
     * console.log(readRes.data); // 'MonJetonSecret'
     */
    static async write(path, data, options = {}) {
        const normPath = NFile.normalizePath(path);
        if (!normPath) {
            return NFile.#fail('Chemin de fichier invalide ou vide.', 'ERR_FILE_INVALID_PATH');
        }

        const overwrite = options?.overwrite !== false;
        const activeDriver = NFile.#resolveDriver(options?.driver);

        try {
            if (!overwrite) {
                const alreadyExists = await NFile.exists(normPath, { driver: activeDriver });
                if (alreadyExists) {
                    return NFile.#fail(`Le fichier "${normPath}" existe déjà.`, 'ERR_FILE_ALREADY_EXISTS');
                }
            }

            let bytes = await NFile.toUint8Array(data);

            // Chiffrement optionnel
            if (options?.encrypt) {
                const plainText = await NFile.toBase64(bytes);
                const cipherText = options?.secretKey
                    ? await NCrypto.encryptSymmetric(plainText, options.secretKey)
                    : await NCrypto.encryptLocal(plainText);
                bytes = await NFile.toUint8Array(cipherText);
            }

            const pathParts = NFile.splitPath(normPath);
            const mimeType = options?.mimeType || NFile.getMimeType(normPath);
            const now = Date.now();

            if (activeDriver === 'native') {
                const base64Data = await NFile.toBase64(bytes);
                const res = await NFile.#invokeNativeFile('write', {
                    path: normPath,
                    data: base64Data,
                    encoding: 'base64',
                    mimeType,
                    overwrite
                });

                if (!res || res.ok === false || res.success === false) {
                    return NFile.#fail(
                        res?.error || res?.message || `Échec de l'écriture native du fichier "${normPath}".`,
                        res?.code || 'ERR_FILE_WRITE_NATIVE'
                    );
                }

                return NFile.#ok({
                    path: normPath,
                    name: pathParts.name,
                    baseName: pathParts.baseName,
                    extension: pathParts.extension,
                    directory: pathParts.directory,
                    size: bytes.byteLength,
                    formattedSize: NNum.formatBytes(bytes.byteLength),
                    mimeType,
                    createdAt: now,
                    updatedAt: now,
                    isFile: true,
                    isDirectory: false,
                    driver: 'native'
                });
            }

            if (activeDriver === 'fs') {
                const fileHandle = await NFile.#getFsFileHandle(normPath, true);
                if (!fileHandle) {
                    return NFile.#fail(`Impossible de créer ou d'accéder au fichier "${normPath}".`, 'ERR_FILE_FS_HANDLE');
                }
                const written = await NFile.#writeFsFileHandle(fileHandle, bytes);
                if (!written) {
                    return NFile.#fail(`Échec de l'écriture dans le système de fichiers pour "${normPath}".`, 'ERR_FILE_FS_WRITE');
                }

                return NFile.#ok({
                    path: normPath,
                    name: pathParts.name,
                    baseName: pathParts.baseName,
                    extension: pathParts.extension,
                    directory: pathParts.directory,
                    size: bytes.byteLength,
                    formattedSize: NNum.formatBytes(bytes.byteLength),
                    mimeType,
                    createdAt: now,
                    updatedAt: now,
                    isFile: true,
                    isDirectory: false,
                    driver: 'fs'
                });
            }

            // Repli IndexedDB
            const idbKey = NFile.#toIdbKey(normPath);
            const existing = await NIndexedDB.instance.get(NFile.#idbStoreName, idbKey);
            const createdAt = existing?.ok && existing?.data?.createdAt ? existing.data.createdAt : now;

            const record = {
                id: idbKey,
                path: normPath,
                name: pathParts.name,
                baseName: pathParts.baseName,
                extension: pathParts.extension,
                directory: pathParts.directory,
                size: bytes.byteLength,
                mimeType,
                data: bytes,
                createdAt,
                updatedAt: now,
                isFile: true,
                isDirectory: false
            };

            const putRes = await NIndexedDB.instance.put(NFile.#idbStoreName, record);
            if (!putRes?.ok) {
                return NFile.#fail(
                    putRes?.error || `Échec de la sauvegarde IndexedDB du fichier "${normPath}".`,
                    putRes?.code || 'ERR_FILE_IDB_WRITE'
                );
            }

            return NFile.#ok({
                path: normPath,
                name: pathParts.name,
                baseName: pathParts.baseName,
                extension: pathParts.extension,
                directory: pathParts.directory,
                size: bytes.byteLength,
                formattedSize: NNum.formatBytes(bytes.byteLength),
                mimeType,
                createdAt,
                updatedAt: now,
                isFile: true,
                isDirectory: false,
                driver: 'idb'
            });
        } catch (err) {
            NLog.error(`NFile.write : Erreur lors de l'écriture du fichier "${normPath}".`, {
                code: 'ERR_FILE_WRITE',
                path: normPath,
                error: err?.message
            });
            return NFile.#fail(err?.message || 'Erreur lors de l\'écriture du fichier.', 'ERR_FILE_WRITE');
        }
    }

    /**
     * Écrit une chaîne de caractères (UTF-8) dans un fichier.
     *
     * @param {string} path - Chemin du fichier.
     * @param {string} text - Texte à écrire.
     * @param {Object} [options={}] - Options d'écriture.
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Écrire un fichier texte</caption>
     * const res = await NFile.writeText('docs/readme.txt', 'Documentation NLib');
     * console.log(res.ok); // true
     *
     * @example <caption>Exemple 2 : Écrire une valeur convertie en chaîne</caption>
     * await NFile.writeText('docs/counter.txt', String(42));
     * console.log(await NFile.readText('docs/counter.txt')); // '42'
     */
    static async writeText(path, text, options = {}) {
        const str = text === null || text === undefined ? '' : String(text);
        return await NFile.write(path, str, options);
    }

    /**
     * Sérialise et écrit une valeur JavaScript (objet, tableau, primitive) au format JSON dans un fichier.
     *
     * @param {string} path - Chemin du fichier JSON.
     * @param {any} value - Valeur à sérialiser en JSON.
     * @param {Object} [options={}] - Options d'écriture (`{ space: 2, encrypt, overwrite, driver }`).
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Sauvegarder un objet de configuration en JSON</caption>
     * await NFile.writeJson('config/app.json', { app: 'NLib', debug: false }, { space: 2 });
     *
     * @example <caption>Exemple 2 : Sauvegarder un tableau d'éléments</caption>
     * await NFile.writeJson('data/items.json', [{ id: 1 }, { id: 2 }]);
     */
    static async writeJson(path, value, options = {}) {
        try {
            const space = typeof options?.space === 'number' ? options.space : 2;
            const jsonString = JSON.stringify(value ?? null, null, space);
            return await NFile.write(path, jsonString, {
                ...options,
                mimeType: options?.mimeType || 'application/json; charset=utf-8'
            });
        } catch (err) {
            NLog.error(`NFile.writeJson : Échec de sérialisation JSON pour "${path}".`, {
                code: 'ERR_FILE_JSON_STRINGIFY',
                path,
                error: err?.message
            });
            return NFile.#fail(err?.message || 'Objet JSON non sérialisable.', 'ERR_FILE_JSON_STRINGIFY');
        }
    }

    /**
     * Écrit des octets binaires (`Uint8Array` ou `ArrayBuffer`) dans un fichier.
     *
     * @param {string} path - Chemin du fichier.
     * @param {Uint8Array|ArrayBuffer|Array<number>} bytes - Données binaires à écrire.
     * @param {Object} [options={}] - Options d'écriture.
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Écrire un Uint8Array</caption>
     * const res = await NFile.writeBytes('bin/header.bin', new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
     * console.log(res.ok, res.data.size); // true, 4
     *
     * @example <caption>Exemple 2 : Relire les octets écrits</caption>
     * const data = await NFile.readBytes('bin/header.bin');
     * console.log(data[0]); // 137 (0x89)
     */
    static async writeBytes(path, bytes, options = {}) {
        const uint8 = await NFile.toUint8Array(bytes);
        return await NFile.write(path, uint8, options);
    }

    /**
     * Décode une chaîne Base64 (ou Data URL) et écrit les octets résultants dans un fichier.
     *
     * @param {string} path - Chemin du fichier cible.
     * @param {string} base64OrDataUrl - Données encodées en Base64 ou Data URL.
     * @param {Object} [options={}] - Options d'écriture.
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Écrire un fichier à partir de Base64</caption>
     * await NFile.writeBase64('docs/b64.txt', 'TkxpYg==');
     * console.log(await NFile.readText('docs/b64.txt')); // 'NLib'
     *
     * @example <caption>Exemple 2 : Écrire un fichier à partir d'une Data URL</caption>
     * await NFile.writeBase64('docs/dataurl.txt', 'data:text/plain;base64,TkxpYg==');
     * console.log(await NFile.readText('docs/dataurl.txt')); // 'NLib'
     */
    static async writeBase64(path, base64OrDataUrl, options = {}) {
        const bytes = NFile.fromBase64(base64OrDataUrl);
        return await NFile.write(path, bytes, options);
    }

    /**
     * Ajoute des données à la fin d'un fichier existant, ou crée le fichier s'il n'existe pas encore.
     *
     * @param {string} path - Chemin du fichier.
     * @param {string|Uint8Array|ArrayBuffer} data - Données à concaténer à la fin du fichier.
     * @param {Object} [options={}] - Options (`{ separator: '', driver }`).
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Ajouter des lignes dans un fichier journal</caption>
     * await NFile.writeText('logs/app.log', 'Démarrage\n');
     * await NFile.append('logs/app.log', 'Connexion utilisateur\n');
     * console.log(await NFile.readText('logs/app.log'));
     * // 'Démarrage\nConnexion utilisateur\n'
     *
     * @example <caption>Exemple 2 : Append sur un fichier inexistant le crée automatiquement</caption>
     * await NFile.append('logs/new.log', 'Première entrée');
     * console.log(await NFile.exists('logs/new.log')); // true
     */
    static async append(path, data, options = {}) {
        const normPath = NFile.normalizePath(path);
        if (!normPath) {
            return NFile.#fail('Chemin de fichier invalide ou vide.', 'ERR_FILE_INVALID_PATH');
        }

        const activeDriver = NFile.#resolveDriver(options?.driver);
        const appendBytes = await NFile.toUint8Array(data);
        const separatorBytes = options?.separator
            ? await NFile.toUint8Array(String(options.separator))
            : new Uint8Array(0);

        const existingRes = await NFile.read(normPath, { format: 'bytes', driver: activeDriver });
        if (!existingRes.ok || !existingRes.data) {
            return await NFile.write(normPath, appendBytes, { ...options, driver: activeDriver });
        }

        const currentBytes = existingRes.data;
        const totalLength = currentBytes.byteLength + separatorBytes.byteLength + appendBytes.byteLength;
        const combined = new Uint8Array(totalLength);
        combined.set(currentBytes, 0);
        if (separatorBytes.byteLength > 0) {
            combined.set(separatorBytes, currentBytes.byteLength);
        }
        combined.set(appendBytes, currentBytes.byteLength + separatorBytes.byteLength);

        return await NFile.write(normPath, combined, { ...options, overwrite: true, driver: activeDriver });
    }

    /**
     * Lit un fichier et retourne son contenu dans le format demandé (`'bytes'`, `'text'`, `'json'`, `'base64'`, `'dataUrl'`, `'blob'`, `'arrayBuffer'`).
     *
     * @param {string} path - Chemin du fichier à lire.
     * @param {Object} [options={}] - Options de lecture.
     * @param {'bytes'|'text'|'json'|'base64'|'dataUrl'|'blob'|'arrayBuffer'} [options.format='bytes'] - Format de sortie souhaité.
     * @param {boolean} [options.decrypt=false] - Si `true`, déchiffre le contenu via `NCrypto`.
     * @param {string} [options.secretKey=''] - Clé secrète optionnelle si `decrypt: true`.
     * @param {string} [options.encoding='utf-8'] - Encodage pour le format `'text'`.
     * @param {'auto'|'native'|'fs'|'idb'} [options.driver='auto'] - Moteur de stockage cible.
     * @returns {Promise<NFileResponse>} Objet `{ ok, data, path, size, mimeType, driver, error, code }`.
     *
     * @example <caption>Exemple 1 : Lire un fichier en texte ou en octets</caption>
     * await NFile.writeText('docs/info.txt', 'Contenu NLib');
     * const res = await NFile.read('docs/info.txt', { format: 'text' });
     * console.log(res.ok, res.data); // true, 'Contenu NLib'
     *
     * @example <caption>Exemple 2 : Lecture d'un fichier introuvable</caption>
     * const missing = await NFile.read('docs/inconnu.txt');
     * console.log(missing.ok, missing.code); // false, 'ERR_FILE_NOT_FOUND'
     */
    static async read(path, options = {}) {
        const normPath = NFile.normalizePath(path);
        if (!normPath) {
            return NFile.#fail('Chemin de fichier invalide ou vide.', 'ERR_FILE_INVALID_PATH');
        }

        const activeDriver = NFile.#resolveDriver(options?.driver);
        const format = options?.format || 'bytes';
        const mimeType = NFile.getMimeType(normPath);

        try {
            let bytes = null;

            if (activeDriver === 'native') {
                const res = await NFile.#invokeNativeFile('read', {
                    path: normPath,
                    encoding: 'base64'
                });
                if (!res || res.ok === false || res.success === false) {
                    return NFile.#fail(
                        res?.error || res?.message || `Fichier introuvable : "${normPath}".`,
                        res?.code || 'ERR_FILE_NOT_FOUND'
                    );
                }
                const payload = res.data !== undefined ? res.data : res.content;
                bytes = typeof payload === 'string'
                    ? NFile.fromBase64(payload)
                    : await NFile.toUint8Array(payload);
            } else if (activeDriver === 'fs') {
                const fileHandle = await NFile.#getFsFileHandle(normPath, false);
                if (!fileHandle) {
                    return NFile.#fail(`Fichier introuvable : "${normPath}".`, 'ERR_FILE_NOT_FOUND');
                }
                const fileObj = await fileHandle.getFile();
                const arrayBuffer = await fileObj.arrayBuffer();
                bytes = new Uint8Array(arrayBuffer);
            } else {
                // Repli IndexedDB
                const idbRes = await NIndexedDB.instance.get(NFile.#idbStoreName, NFile.#toIdbKey(normPath));
                if (!idbRes?.ok || !idbRes?.data) {
                    return NFile.#fail(`Fichier introuvable : "${normPath}".`, 'ERR_FILE_NOT_FOUND');
                }
                bytes = await NFile.toUint8Array(idbRes.data.data);
            }

            // Déchiffrement optionnel
            if (options?.decrypt) {
                const cipherText = await NFile.toText(bytes);
                const decryptedB64 = options?.secretKey
                    ? await NCrypto.decryptSymmetric(cipherText, options.secretKey)
                    : await NCrypto.decryptLocal(cipherText);
                if (!decryptedB64) {
                    return NFile.#fail(`Échec du déchiffrement du fichier "${normPath}".`, 'ERR_FILE_DECRYPT_FAILED');
                }
                bytes = NFile.fromBase64(decryptedB64);
            }

            const formattedData = await NFile.#formatReadOutput(bytes, format, mimeType, options?.encoding);
            if (format === 'json' && formattedData === undefined) {
                return NFile.#fail(`Contenu JSON invalide dans le fichier "${normPath}".`, 'ERR_FILE_INVALID_JSON');
            }

            return {
                ok: true,
                data: formattedData,
                path: normPath,
                size: bytes.byteLength,
                mimeType,
                driver: activeDriver,
                error: null,
                code: null
            };
        } catch (err) {
            NLog.error(`NFile.read : Erreur lors de la lecture du fichier "${normPath}".`, {
                code: 'ERR_FILE_READ',
                path: normPath,
                error: err?.message
            });
            return NFile.#fail(err?.message || 'Erreur lors de la lecture du fichier.', 'ERR_FILE_READ');
        }
    }

    /**
     * Lit un fichier et retourne directement son contenu texte (ou `fallback` si introuvable).
     *
     * @param {string} path - Chemin du fichier.
     * @param {Object} [options={}] - Options de lecture (`{ fallback: null, decrypt, secretKey, encoding, driver }`).
     * @returns {Promise<string|null>} Contenu texte du fichier ou `fallback` (`null` par défaut).
     *
     * @example <caption>Exemple 1 : Lire directement le texte d'un fichier</caption>
     * await NFile.writeText('notes/todo.txt', 'Acheter du café');
     * console.log(await NFile.readText('notes/todo.txt')); // 'Acheter du café'
     *
     * @example <caption>Exemple 2 : Valeur par défaut si le fichier n'existe pas</caption>
     * console.log(await NFile.readText('notes/absent.txt', { fallback: 'Vide' })); // 'Vide'
     */
    static async readText(path, options = {}) {
        const fallback = options?.fallback !== undefined ? options.fallback : null;
        const res = await NFile.read(path, { ...options, format: 'text' });
        return res.ok ? res.data : fallback;
    }

    /**
     * Lit un fichier JSON, le parse et retourne directement la valeur JavaScript (ou `fallback` en cas d'erreur/absence).
     *
     * @param {string} path - Chemin du fichier JSON.
     * @param {Object} [options={}] - Options de lecture (`{ fallback: null, decrypt, secretKey, driver }`).
     * @returns {Promise<any>} Objet/tableau JSON parsé ou `fallback` (`null` par défaut).
     *
     * @example <caption>Exemple 1 : Lire un fichier de configuration JSON</caption>
     * await NFile.writeJson('config/ui.json', { dark: true });
     * const cfg = await NFile.readJson('config/ui.json');
     * console.log(cfg.dark); // true
     *
     * @example <caption>Exemple 2 : Retourner un objet par défaut si absent</caption>
     * const def = await NFile.readJson('config/missing.json', { fallback: { dark: false } });
     * console.log(def.dark); // false
     */
    static async readJson(path, options = {}) {
        const fallback = options?.fallback !== undefined ? options.fallback : null;
        const res = await NFile.read(path, { ...options, format: 'json' });
        return res.ok ? res.data : fallback;
    }

    /**
     * Lit un fichier et retourne directement ses octets sous forme de `Uint8Array` (ou `null` si introuvable).
     *
     * @param {string} path - Chemin du fichier.
     * @param {Object} [options={}] - Options de lecture.
     * @returns {Promise<Uint8Array|null>} Octets du fichier ou `null`.
     *
     * @example <caption>Exemple 1 : Lire les octets d'un fichier</caption>
     * await NFile.writeBytes('bin/sample.bin', new Uint8Array([10, 20, 30]));
     * const bytes = await NFile.readBytes('bin/sample.bin');
     * console.log(bytes.length); // 3
     *
     * @example <caption>Exemple 2 : Fichier inexistant retourne null</caption>
     * console.log(await NFile.readBytes('bin/none.bin')); // null
     */
    static async readBytes(path, options = {}) {
        const res = await NFile.read(path, { ...options, format: 'bytes' });
        return res.ok ? res.data : null;
    }

    /**
     * Lit un fichier et retourne directement son contenu encodé en Base64 (ou `null` si introuvable).
     *
     * @param {string} path - Chemin du fichier.
     * @param {Object} [options={}] - Options de lecture.
     * @returns {Promise<string|null>} Chaîne Base64 ou `null`.
     *
     * @example <caption>Exemple 1 : Lire un fichier en Base64</caption>
     * await NFile.writeText('docs/code.txt', 'NLib');
     * console.log(await NFile.readBase64('docs/code.txt')); // 'TkxpYg=='
     *
     * @example <caption>Exemple 2 : Fichier absent retourne null</caption>
     * console.log(await NFile.readBase64('docs/absent.txt')); // null
     */
    static async readBase64(path, options = {}) {
        const res = await NFile.read(path, { ...options, format: 'base64' });
        return res.ok ? res.data : null;
    }

    /**
     * Lit un fichier et retourne directement son contenu sous forme de Data URL (`data:<mime>;base64,...`).
     *
     * @param {string} path - Chemin du fichier.
     * @param {Object} [options={}] - Options de lecture.
     * @returns {Promise<string|null>} Chaîne Data URL ou `null`.
     *
     * @example <caption>Exemple 1 : Obtenir une Data URL pour affichage ou export</caption>
     * await NFile.writeText('docs/hello.txt', 'Bonjour');
     * const dataUrl = await NFile.readDataUrl('docs/hello.txt');
     * console.log(dataUrl.startsWith('data:text/plain;base64,')); // true
     *
     * @example <caption>Exemple 2 : Fichier absent retourne null</caption>
     * console.log(await NFile.readDataUrl('docs/absent.txt')); // null
     */
    static async readDataUrl(path, options = {}) {
        const res = await NFile.read(path, { ...options, format: 'dataUrl' });
        return res.ok ? res.data : null;
    }

    /**
     * Lit un fichier et retourne directement une instance `Blob` (ou `null` si introuvable).
     *
     * @param {string} path - Chemin du fichier.
     * @param {Object} [options={}] - Options de lecture.
     * @returns {Promise<Blob|null>} Instance `Blob` ou `null`.
     *
     * @example <caption>Exemple 1 : Lire un fichier sous forme de Blob</caption>
     * await NFile.writeText('docs/blob.txt', 'Contenu Blob');
     * const blob = await NFile.readBlob('docs/blob.txt');
     * console.log(blob?.size); // 12
     *
     * @example <caption>Exemple 2 : Fichier absent retourne null</caption>
     * console.log(await NFile.readBlob('docs/absent.txt')); // null
     */
    static async readBlob(path, options = {}) {
        const res = await NFile.read(path, { ...options, format: 'blob' });
        return res.ok ? res.data : null;
    }

    /**
     * Supprime un fichier du stockage.
     *
     * @param {string} path - Chemin du fichier à supprimer.
     * @param {Object} [options={}] - Options (`{ driver }`).
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: { path, deleted }, error, code }`.
     *
     * @example <caption>Exemple 1 : Créer puis supprimer un fichier</caption>
     * await NFile.writeText('temp/cache.txt', 'Temporaire');
     * const delRes = await NFile.delete('temp/cache.txt');
     * console.log(delRes.ok, await NFile.exists('temp/cache.txt')); // true, false
     *
     * @example <caption>Exemple 2 : Supprimer un fichier déjà absent reste sûr</caption>
     * const res2 = await NFile.delete('temp/inexistant.txt');
     * console.log(res2.ok); // true
     */
    static async delete(path, options = {}) {
        const normPath = NFile.normalizePath(path);
        if (!normPath) {
            return NFile.#fail('Chemin de fichier invalide ou vide.', 'ERR_FILE_INVALID_PATH');
        }

        const activeDriver = NFile.#resolveDriver(options?.driver);

        try {
            if (activeDriver === 'native') {
                const res = await NFile.#invokeNativeFile('delete', { path: normPath });
                if (res && (res.ok === false || res.success === false)) {
                    return NFile.#fail(
                        res?.error || res?.message || `Échec de suppression native de "${normPath}".`,
                        res?.code || 'ERR_FILE_DELETE_NATIVE'
                    );
                }
                return NFile.#ok({ path: normPath, deleted: true, driver: 'native' });
            }

            if (activeDriver === 'fs') {
                const removed = await NFile.#removeFsFileEntry(normPath);
                return NFile.#ok({ path: normPath, deleted: removed, driver: 'fs' });
            }

            // Repli IndexedDB
            const delRes = await NIndexedDB.instance.delete(NFile.#idbStoreName, NFile.#toIdbKey(normPath));
            if (!delRes?.ok) {
                return NFile.#fail(
                    delRes?.error || `Échec de suppression IndexedDB de "${normPath}".`,
                    delRes?.code || 'ERR_FILE_IDB_DELETE'
                );
            }
            return NFile.#ok({ path: normPath, deleted: true, driver: 'idb' });
        } catch (err) {
            NLog.error(`NFile.delete : Erreur lors de la suppression de "${normPath}".`, {
                code: 'ERR_FILE_DELETE',
                path: normPath,
                error: err?.message
            });
            return NFile.#fail(err?.message || 'Erreur lors de la suppression du fichier.', 'ERR_FILE_DELETE');
        }
    }

    /**
     * Alias de `delete(path, options)` pour supprimer un fichier.
     *
     * @param {string} path - Chemin du fichier à supprimer.
     * @param {Object} [options={}] - Options éventuelles.
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: { path, deleted }, error, code }`.
     *
     * @example <caption>Exemple 1 : Supprimer un fichier avec remove()</caption>
     * await NFile.writeText('temp/old.txt', 'Ancien');
     * const res = await NFile.remove('temp/old.txt');
     * console.log(res.ok); // true
     *
     * @example <caption>Exemple 2 : Vérifier l'absence après remove()</caption>
     * console.log(await NFile.exists('temp/old.txt')); // false
     */
    static async remove(path, options = {}) {
        return await NFile.delete(path, options);
    }

    /**
     * Copie un fichier d'un chemin source vers un chemin de destination.
     *
     * @param {string} sourcePath - Chemin du fichier source.
     * @param {string} destinationPath - Chemin du fichier de destination.
     * @param {Object} [options={}] - Options (`{ overwrite: true, driver }`).
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Copier un fichier vers un autre dossier</caption>
     * await NFile.writeText('src/original.txt', 'Texte original');
     * const copyRes = await NFile.copy('src/original.txt', 'backup/copie.txt');
     * console.log(copyRes.ok, await NFile.readText('backup/copie.txt')); // true, 'Texte original'
     *
     * @example <caption>Exemple 2 : Empêcher l'écrasement si overwrite est false</caption>
     * const failCopy = await NFile.copy('src/original.txt', 'backup/copie.txt', { overwrite: false });
     * console.log(failCopy.ok, failCopy.code); // false, 'ERR_FILE_ALREADY_EXISTS'
     */
    static async copy(sourcePath, destinationPath, options = {}) {
        const normSrc = NFile.normalizePath(sourcePath);
        const normDest = NFile.normalizePath(destinationPath);

        if (!normSrc || !normDest) {
            return NFile.#fail('Chemin source ou destination invalide.', 'ERR_FILE_INVALID_PATH');
        }

        const overwrite = options?.overwrite !== false;
        const activeDriver = NFile.#resolveDriver(options?.driver);

        if (normSrc === normDest) {
            return await NFile.stat(normSrc, { driver: activeDriver });
        }

        if (!overwrite && (await NFile.exists(normDest, { driver: activeDriver }))) {
            return NFile.#fail(`Le fichier de destination "${normDest}" existe déjà.`, 'ERR_FILE_ALREADY_EXISTS');
        }

        if (activeDriver === 'native') {
            const nativeRes = await NFile.#invokeNativeFile('copy', {
                sourcePath: normSrc,
                destinationPath: normDest,
                overwrite
            });
            if (nativeRes && nativeRes.ok !== false && nativeRes.success !== false) {
                return await NFile.stat(normDest, { driver: 'native' });
            }
            return NFile.#fail(
                nativeRes?.error || nativeRes?.message || `Échec de la copie native de "${normSrc}" vers "${normDest}".`,
                nativeRes?.code || 'ERR_FILE_COPY_NATIVE'
            );
        }

        const readRes = await NFile.read(normSrc, { format: 'bytes', driver: activeDriver });
        if (!readRes.ok) {
            return readRes;
        }

        return await NFile.write(normDest, readRes.data, {
            ...options,
            overwrite,
            driver: activeDriver
        });
    }

    /**
     * Déplace un fichier d'un chemin source vers un chemin de destination.
     *
     * @param {string} sourcePath - Chemin actuel du fichier.
     * @param {string} destinationPath - Nouveau chemin complet du fichier.
     * @param {Object} [options={}] - Options (`{ overwrite: true, driver }`).
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Déplacer un fichier vers un dossier d'archive</caption>
     * await NFile.writeText('inbox/msg.txt', 'Message');
     * const moveRes = await NFile.move('inbox/msg.txt', 'archive/msg.txt');
     * console.log(moveRes.ok, await NFile.exists('inbox/msg.txt')); // true, false
     *
     * @example <caption>Exemple 2 : Vérifier le fichier déplacé</caption>
     * console.log(await NFile.readText('archive/msg.txt')); // 'Message'
     */
    static async move(sourcePath, destinationPath, options = {}) {
        const normSrc = NFile.normalizePath(sourcePath);
        const normDest = NFile.normalizePath(destinationPath);

        if (!normSrc || !normDest) {
            return NFile.#fail('Chemin source ou destination invalide.', 'ERR_FILE_INVALID_PATH');
        }

        const activeDriver = NFile.#resolveDriver(options?.driver);
        if (normSrc === normDest) {
            return await NFile.stat(normSrc, { driver: activeDriver });
        }

        if (activeDriver === 'native') {
            const overwrite = options?.overwrite !== false;
            const nativeRes = await NFile.#invokeNativeFile('move', {
                sourcePath: normSrc,
                destinationPath: normDest,
                overwrite
            });
            if (nativeRes && nativeRes.ok !== false && nativeRes.success !== false) {
                return await NFile.stat(normDest, { driver: 'native' });
            }
            return NFile.#fail(
                nativeRes?.error || nativeRes?.message || `Échec du déplacement natif de "${normSrc}" vers "${normDest}".`,
                nativeRes?.code || 'ERR_FILE_MOVE_NATIVE'
            );
        }

        const copyRes = await NFile.copy(normSrc, normDest, { ...options, driver: activeDriver });
        if (!copyRes.ok) {
            return copyRes;
        }

        await NFile.delete(normSrc, { driver: activeDriver });
        return copyRes;
    }

    /**
     * Renomme un fichier au sein de son même répertoire parent.
     *
     * @param {string} path - Chemin actuel du fichier.
     * @param {string} newFileName - Nouveau nom du fichier (ex: `'nouveau_nom.txt'`).
     * @param {Object} [options={}] - Options (`{ overwrite: true, driver }`).
     * @returns {Promise<NFileResponse>} Résultat `{ ok, data: NFileInfo, error, code }`.
     *
     * @example <caption>Exemple 1 : Renommer un fichier dans son dossier</caption>
     * await NFile.writeText('rapports/brouillon.txt', 'Contenu final');
     * const renRes = await NFile.rename('rapports/brouillon.txt', 'final.txt');
     * console.log(renRes.ok, renRes.data.path); // true, 'rapports/final.txt'
     *
     * @example <caption>Exemple 2 : L'ancien nom n'existe plus</caption>
     * console.log(await NFile.exists('rapports/brouillon.txt')); // false
     */
    static async rename(path, newFileName, options = {}) {
        const normPath = NFile.normalizePath(path);
        const cleanNewName = NFile.getFileName(newFileName);

        if (!normPath || !cleanNewName) {
            return NFile.#fail('Chemin ou nouveau nom de fichier invalide.', 'ERR_FILE_INVALID_NAME');
        }

        const dir = NFile.getDirName(normPath);
        const targetPath = dir ? `${dir}/${cleanNewName}` : cleanNewName;
        return await NFile.move(normPath, targetPath, options);
    }

    /**
     * Calcule l'empreinte cryptographique SHA-256 hexadécimale du contenu d'un fichier.
     *
     * @param {string} path - Chemin du fichier.
     * @param {Object} [options={}] - Options (`{ driver }`).
     * @returns {Promise<string|null>} Empreinte SHA-256 en hexadécimal (64 caractères) ou `null` si introuvable.
     *
     * @example <caption>Exemple 1 : Calculer le hash SHA-256 d'un fichier</caption>
     * await NFile.writeText('docs/contrat.txt', ' Engagement NLib ');
     * const hash = await NFile.checksum('docs/contrat.txt');
     * console.log(typeof hash, hash.length); // 'string', 64
     *
     * @example <caption>Exemple 2 : Fichier inexistant retourne null</caption>
     * console.log(await NFile.checksum('docs/introuvable.txt')); // null
     */
    static async checksum(path, options = {}) {
        const bytes = await NFile.readBytes(path, options);
        if (!bytes) {
            return null;
        }
        return await NCrypto.sha256(bytes);
    }

    // =========================================================================
    // Méthodes privées — Moteurs Native, File System Access API & IndexedDB
    // =========================================================================

    /**
     * Résout le moteur de stockage à utiliser selon l'option passée ou la détection automatique.
     * @private
     * @param {'auto'|'native'|'fs'|'idb'} [requestedDriver='auto'] - Moteur demandé.
     * @returns {'native'|'fs'|'idb'} Moteur effectif.
     */
    static #resolveDriver(requestedDriver = 'auto') {
        if (requestedDriver === 'native' && NFile.isNativeAvailable) {
            return 'native';
        }
        if (requestedDriver === 'fs' && NFile.isFsApiAvailable) {
            return 'fs';
        }
        if (requestedDriver === 'idb') {
            return 'idb';
        }
        return NFile.driver;
    }

    /**
     * Construit la clé IndexedDB interne pour un chemin de fichier normalisé.
     * @private
     * @param {string} normPath - Chemin normalisé.
     * @returns {string} Clé unique pour le store `ntable`.
     */
    static #toIdbKey(normPath) {
        return `${NFile.#idbKeyPrefix}${normPath}`;
    }

    /**
     * Invoque le pont natif OS pour une opération de fichier.
     * @private
     * @param {string} action - Action sur le fichier (`read`, `write`, `delete`, `stat`, `exists`, `copy`, `move`).
     * @param {Object} params - Paramètres de l'action.
     * @returns {Promise<any>}
     */
    static async #invokeNativeFile(action, params = {}) {
        return await NSys.invokeNative({
            type: ['app', 'file', action],
            params
        });
    }

    /**
     * Obtient un `FileSystemFileHandle` via l'API File System Access / OPFS (`navigator.storage.getDirectory`).
     * Parcourt et crée les répertoires parents si `create === true`.
     * @private
     * @param {string} normPath - Chemin normalisé du fichier.
     * @param {boolean} [create=false] - Créer les dossiers parents et le fichier s'ils n'existent pas.
     * @returns {Promise<any|null>} Instance `FileSystemFileHandle` ou `null`.
     */
    static async #getFsFileHandle(normPath, create = false) {
        try {
            if (!NFile.isFsApiAvailable) {
                return null;
            }
            const root = await navigator.storage.getDirectory();
            const parts = normPath.split('/').filter(Boolean);
            if (parts.length === 0) {
                return null;
            }

            let currentDir = root;
            for (let i = 0; i < parts.length - 1; i++) {
                currentDir = await currentDir.getDirectoryHandle(parts[i], { create });
            }

            const fileName = parts[parts.length - 1];
            return await currentDir.getFileHandle(fileName, { create });
        } catch {
            return null;
        }
    }

    /**
     * Écrit un `Uint8Array` dans un `FileSystemFileHandle` via `createWritable()` (ou `createSyncAccessHandle()` en Worker).
     * @private
     * @param {any} fileHandle - Handle du fichier OPFS.
     * @param {Uint8Array} bytes - Octets à écrire.
     * @returns {Promise<boolean>} `true` si l'écriture a réussi.
     */
    static async #writeFsFileHandle(fileHandle, bytes) {
        try {
            if (typeof fileHandle.createWritable === 'function') {
                const writable = await fileHandle.createWritable();
                await writable.write(bytes);
                await writable.close();
                return true;
            }
            if (typeof fileHandle.createSyncAccessHandle === 'function') {
                const syncHandle = await fileHandle.createSyncAccessHandle();
                try {
                    syncHandle.truncate(0);
                    syncHandle.write(bytes, { at: 0 });
                    syncHandle.flush();
                    return true;
                } finally {
                    syncHandle.close();
                }
            }
            return false;
        } catch (err) {
            NLog.error('NFile.#writeFsFileHandle : Échec d\'écriture FileSystemFileHandle.', {
                code: 'ERR_FILE_FS_WRITE_HANDLE',
                error: err?.message
            });
            return false;
        }
    }

    /**
     * Supprime une entrée de fichier via l'API File System Access / OPFS.
     * @private
     * @param {string} normPath - Chemin normalisé du fichier.
     * @returns {Promise<boolean>} `true` si supprimé ou déjà absent.
     */
    static async #removeFsFileEntry(normPath) {
        try {
            if (!NFile.isFsApiAvailable) {
                return false;
            }
            const root = await navigator.storage.getDirectory();
            const parts = normPath.split('/').filter(Boolean);
            if (parts.length === 0) {
                return false;
            }

            let currentDir = root;
            for (let i = 0; i < parts.length - 1; i++) {
                currentDir = await currentDir.getDirectoryHandle(parts[i], { create: false });
            }

            const fileName = parts[parts.length - 1];
            await currentDir.removeEntry(fileName);
            return true;
        } catch {
            return true;
        }
    }

    /**
     * Formate les octets lus selon le format demandé par l'appelant.
     * @private
     * @param {Uint8Array} bytes - Octets bruts.
     * @param {string} format - Format cible (`'bytes'`, `'text'`, `'json'`, `'base64'`, `'dataUrl'`, `'blob'`, `'arrayBuffer'`).
     * @param {string} mimeType - Type MIME du fichier.
     * @param {string} [encoding='utf-8'] - Encodage texte.
     * @returns {Promise<any>} Données converties.
     */
    static async #formatReadOutput(bytes, format, mimeType, encoding = 'utf-8') {
        switch (format) {
            case 'text':
                return await NFile.toText(bytes, encoding);
            case 'json': {
                const text = await NFile.toText(bytes, encoding);
                try {
                    return JSON.parse(text);
                } catch {
                    return undefined;
                }
            }
            case 'base64':
                return await NFile.toBase64(bytes);
            case 'dataUrl':
                return await NFile.toDataUrl(bytes, mimeType);
            case 'blob':
                return await NFile.toBlob(bytes, mimeType);
            case 'arrayBuffer':
                return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
            case 'bytes':
            default:
                return bytes;
        }
    }

    /**
     * Construit une réponse standardisée de succès.
     * @private
     * @param {any} data - Données de retour.
     * @returns {NFileResponse}
     */
    static #ok(data) {
        return {
            ok: true,
            data,
            error: null,
            code: null
        };
    }

    /**
     * Construit une réponse standardisée d'échec.
     * @private
     * @param {string} error - Message d'erreur.
     * @param {string} code - Code d'erreur.
     * @returns {NFileResponse}
     */
    static #fail(error, code = 'ERR_FILE_OPERATION') {
        return {
            ok: false,
            data: null,
            error,
            code
        };
    }
}

export default NFile;
