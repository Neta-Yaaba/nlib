/**
 * @file NDir.js
 * @package @nlib/js-backend
 * @description Classe utilitaire de gestion des répertoires (dossiers) pour l'écosystème NLib,
 * classe utilitaire statique accessible directement via `NDir` ou `NDir` (`NDir`).
 *
 * Stratégie de stockage adaptative multiplateforme à 3 niveaux (coordonnée avec `NFile`) :
 * 1. **Conteneur Natif / WebView (`native`)** : si `NEnv.isWebView` est actif, délègue les opérations
 *    au système d'exploitation hôte via `NSys.invokeNative`.
 * 2. **File System Access API / OPFS (`fs`)** : si l'API `navigator.storage.getDirectory` est disponible,
 *    manipule les `FileSystemDirectoryHandle`.
 * 3. **IndexedDB (`idb`)** : s'appuie sur `NIndexedDB.instance` (magasin `ntable`) en synchronisation avec
 *    les fichiers enregistrés par `NFile` (`__nfile__:`) et les dossiers (`__ndir__:`).
 *
 * Les erreurs sont journalisées via `NLog` avec retours normalisés.
 */

import { NLog } from '../log/NLog.js';
import { NUtil } from '../utils/NUtil.js';
import { NIndexedDB } from '../database/NIndexedDB.js';
import { NFile } from './NFile.js';
import { NNum } from '../utils/NNum.js';
import { NSys } from '../system/NSys.js';

/**
 * Structure de réponse standardisée pour les opérations de répertoire `NDir`.
 * @typedef {Object} NDirectoryResponse
 * @property {boolean} ok - Indique si l'opération a réussi.
 * @property {any} [data=null] - Données ou métadonnées retournées par l'opération.
 * @property {string|null} [error=null] - Message d'erreur explicite en cas d'échec.
 * @property {string|null} [code=null] - Code d'erreur standardisé.
 */

/**
 * Métadonnées descriptives d'un répertoire ou d'une entrée listée.
 * @typedef {Object} NDirectoryEntry
 * @property {string} path - Chemin complet normalisé.
 * @property {string} name - Nom de l'entrée (dossier ou fichier).
 * @property {string} parent - Chemin du dossier parent.
 * @property {boolean} isFile - `true` s'il s'agit d'un fichier.
 * @property {boolean} isDirectory - `true` s'il s'agit d'un répertoire.
 * @property {number} [size=0] - Taille en octets (0 pour un dossier ou taille calculée).
 * @property {string} [formattedSize='0 B'] - Taille formatée lisible.
 * @property {string} [extension=''] - Extension si fichier.
 * @property {string} [mimeType=''] - Type MIME si fichier.
 * @property {number} [createdAt] - Horodatage de création (ms).
 * @property {number} [updatedAt] - Horodatage de modification (ms).
 * @property {'native'|'fs'|'idb'} driver - Moteur de stockage utilisé.
 */

/**
 * @class NDir
 * @description Service utilitaire de manipulation des répertoires (création, suppression, listage, arborescence,
 * recherche, copie, déplacement, renommage, vidage et calcul de taille) avec bascule automatique entre
 * Pont Natif (`invokeNative`), File System Access API (`navigator.storage.getDirectory`) et IndexedDB (`NIndexedDB.instance`).
 *
 * @example <caption>Exemple 1 : Créer un dossier, y écrire des fichiers et lister son contenu</caption>
 * await NDir.create('projets/2026/rapports');
 * await NFile.writeText('projets/2026/rapports/bilan.txt', 'Bilan annuel');
 * const listRes = await NDir.list('projets/2026/rapports');
 * console.log(listRes.ok, listRes.data.length); // true, 1
 *
 * @example <caption>Exemple 2 : Explorer l'arborescence, copier, renommer et vider un dossier</caption>
 * const tree = await NDir.tree('projets');
 * console.log(tree.data);
 * await NDir.copy('projets/2026', 'projets/archive_2026');
 * await NDir.clear('projets/2026/rapports');
 *
 * @example <caption>Exemple 3 : Rechercher des fichiers et calculer la taille totale d'un répertoire</caption>
 * const found = await NDir.find('projets', { extension: 'txt' });
 * const totalBytes = await NDir.size('projets');
 * console.log(found.length, NNum.formatBytes(totalBytes));
 */
export class NDir {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Préfixe de clé utilisé pour les dossiers explicites dans le magasin IndexedDB `ntable`.
     * @type {string}
     * @private
     */
    static #idbDirPrefix = '__ndir__:';

    /**
     * Préfixe de clé utilisé par `NFile` pour les fichiers dans le magasin IndexedDB `ntable`.
     * @type {string}
     * @private
     */
    static #idbFilePrefix = '__nfile__:';

    /**
     * Nom du magasin IndexedDB utilisé en mode de repli.
     * @type {string}
     * @private
     */
    static #idbStoreName = 'ntable';

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
     * @example <caption>Exemple 1 : Lire le moteur de répertoire actif</caption>
     * console.log(NDir.driver); // 'native' | 'fs' | 'idb'
     *
     * @example <caption>Exemple 2 : Cohérence avec NFile.driver</caption>
     * console.log(NDir.driver === NFile.driver); // true
     */
    static get driver() {
        if (NDir.isNativeAvailable) {
            return 'native';
        }
        if (NDir.isFsApiAvailable) {
            return 'fs';
        }
        return 'idb';
    }

    /**
     * Indique si le pont natif OS (WebView / conteneur) est disponible.
     *
     * @returns {boolean} `true` si exécuté dans une application native NLib.
     *
     * @example <caption>Exemple 1 : Vérifier la disponibilité du pont natif</caption>
     * console.log(NDir.isNativeAvailable);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NDir.isNativeAvailable); // 'boolean'
     */
    static get isNativeAvailable() {
        return Boolean(NUtil?.env?.isWebView);
    }

    /**
     * Indique si l'API File System Access / OPFS (`navigator.storage.getDirectory`) est disponible.
     *
     * @returns {boolean} `true` si `navigator.storage.getDirectory` est disponible.
     *
     * @example <caption>Exemple 1 : Vérifier le support File System Access API</caption>
     * console.log(NDir.isFsApiAvailable);
     *
     * @example <caption>Exemple 2 : Retourne un booléen</caption>
     * console.log(typeof NDir.isFsApiAvailable); // 'boolean'
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
    // Méthodes publiques — Chemins de Répertoires
    // =========================================================================

    /**
     * Normalise un chemin de répertoire (convertit `\` en `/`, résout `.` et `..`, retire les slashs superflus).
     * Un chemin racine (`''`, `'/'` ou `'.'`) est normalisé en `''`.
     *
     * @param {string} [path=''] - Chemin du répertoire à normaliser.
     * @returns {string} Chemin normalisé.
     *
     * @example <caption>Exemple 1 : Normaliser un chemin Windows ou mixte</caption>
     * console.log(NDir.normalizePath('exports\\2026//factures/')); // 'exports/2026/factures'
     *
     * @example <caption>Exemple 2 : Normaliser la racine</caption>
     * console.log(NDir.normalizePath('/')); // ''
     */
    static normalizePath(path = '') {
        if (typeof path !== 'string') {
            return '';
        }
        return NFile.normalizePath(path);
    }

    /**
     * Joint plusieurs segments de chemin en un chemin normalisé.
     *
     * @param {...string} segments - Segments à joindre.
     * @returns {string} Chemin assemblé et normalisé.
     *
     * @example <caption>Exemple 1 : Joindre des sous-dossiers</caption>
     * console.log(NDir.joinPath('storage', 'images', 'avatars')); // 'storage/images/avatars'
     *
     * @example <caption>Exemple 2 : Ignorer les segments vides</caption>
     * console.log(NDir.joinPath('', 'logs', '/2026/')); // 'logs/2026'
     */
    static joinPath(...segments) {
        return NFile.joinPath(...segments);
    }

    /**
     * Retourne le nom propre du répertoire (dernier segment du chemin).
     *
     * @param {string} path - Chemin du répertoire.
     * @returns {string} Nom du répertoire (ou `''` pour la racine).
     *
     * @example <caption>Exemple 1 : Obtenir le nom du dossier</caption>
     * console.log(NDir.getName('projets/2026/rapports')); // 'rapports'
     *
     * @example <caption>Exemple 2 : Dossier racine</caption>
     * console.log(NDir.getName('/')); // ''
     */
    static getName(path) {
        const norm = NDir.normalizePath(path);
        if (!norm) {
            return '';
        }
        const idx = norm.lastIndexOf('/');
        return idx === -1 ? norm : norm.slice(idx + 1);
    }

    /**
     * Retourne le chemin du répertoire parent.
     *
     * @param {string} path - Chemin du répertoire.
     * @returns {string} Chemin du dossier parent (ou `''` si déjà à la racine).
     *
     * @example <caption>Exemple 1 : Obtenir le dossier parent</caption>
     * console.log(NDir.getParent('projets/2026/rapports')); // 'projets/2026'
     *
     * @example <caption>Exemple 2 : Dossier de premier niveau</caption>
     * console.log(NDir.getParent('projets')); // ''
     */
    static getParent(path) {
        const norm = NDir.normalizePath(path);
        if (!norm) {
            return '';
        }
        const idx = norm.lastIndexOf('/');
        return idx === -1 ? '' : norm.slice(0, idx);
    }

    // =========================================================================
    // Méthodes publiques — Opérations CRUD & Système sur les Répertoires
    // =========================================================================

    /**
     * Vérifie si un répertoire existe au chemin spécifié.
     * La racine (`''` ou `'/'`) existe toujours (`true`).
     *
     * @param {string} [path=''] - Chemin du répertoire à tester.
     * @param {Object} [options={}] - Options (`{ driver: 'auto'|'native'|'fs'|'idb' }`).
     * @returns {Promise<boolean>} `true` si le répertoire existe, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier l'existence d'un dossier créé</caption>
     * await NDir.create('archives/2026');
     * console.log(await NDir.exists('archives/2026')); // true
     *
     * @example <caption>Exemple 2 : Vérifier un dossier inexistant</caption>
     * console.log(await NDir.exists('archives/introuvable')); // false
     */
    static async exists(path = '', options = {}) {
        const normPath = NDir.normalizePath(path);
        if (normPath === '') {
            return true;
        }

        const activeDriver = NDir.#resolveDriver(options?.driver);

        try {
            if (activeDriver === 'native') {
                const res = await NDir.#invokeNativeDir('exists', { path: normPath });
                if (res && typeof res === 'object') {
                    if (typeof res.exists === 'boolean') return res.exists;
                    if (typeof res.data === 'boolean') return res.data;
                    if (res.data && typeof res.data.exists === 'boolean') return res.data.exists;
                }
                return Boolean(res?.ok && res?.data);
            }

            if (activeDriver === 'fs') {
                const dirHandle = await NDir.#getFsDirectoryHandle(normPath, false);
                return dirHandle !== null;
            }

            // Repli IndexedDB : vérifie soit une entrée explicite __ndir__, soit un fichier/sous-dossier préfixé
            const directRes = await NIndexedDB.instance.get(NDir.#idbStoreName, NDir.#toIdbDirKey(normPath));
            if (directRes?.ok && directRes?.data) {
                return true;
            }

            const allRecords = await NDir.#getAllIdbRecords();
            const prefix = `${normPath}/`;
            return allRecords.some((rec) => typeof rec.path === 'string' && rec.path.startsWith(prefix));
        } catch {
            return false;
        }
    }

    /**
     * Crée un répertoire (ainsi que tous ses répertoires parents si `recursive !== false`).
     *
     * @param {string} path - Chemin du répertoire à créer.
     * @param {Object} [options={}] - Options (`{ recursive: true, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: NDirectoryEntry, error, code }`.
     *
     * @example <caption>Exemple 1 : Créer une arborescence de dossiers</caption>
     * const res = await NDir.create('data/exports/pdf');
     * console.log(res.ok, res.data.path); // true, 'data/exports/pdf'
     *
     * @example <caption>Exemple 2 : Créer un dossier simple</caption>
     * const res2 = await NDir.create('logs');
     * console.log(res2.data.isDirectory); // true
     */
    static async create(path, options = {}) {
        const normPath = NDir.normalizePath(path);
        const activeDriver = NDir.#resolveDriver(options?.driver);
        const recursive = options?.recursive !== false;
        const now = Date.now();

        if (!normPath) {
            return NDir.#ok(NDir.#buildDirInfo('', activeDriver, now, now));
        }

        try {
            if (!recursive) {
                const parent = NDir.getParent(normPath);
                if (parent && !(await NDir.exists(parent, { driver: activeDriver }))) {
                    return NDir.#fail(`Le dossier parent "${parent}" n'existe pas.`, 'ERR_DIR_PARENT_NOT_FOUND');
                }
            }

            if (activeDriver === 'native') {
                const res = await NDir.#invokeNativeDir('create', { path: normPath, recursive });
                if (!res || res.ok === false || res.success === false) {
                    return NDir.#fail(
                        res?.error || res?.message || `Échec de création native du dossier "${normPath}".`,
                        res?.code || 'ERR_DIR_CREATE_NATIVE'
                    );
                }
                return NDir.#ok(NDir.#buildDirInfo(normPath, 'native', now, now));
            }

            if (activeDriver === 'fs') {
                const handle = await NDir.#getFsDirectoryHandle(normPath, true);
                if (!handle) {
                    return NDir.#fail(`Impossible de créer le dossier "${normPath}" via File System API.`, 'ERR_DIR_FS_CREATE');
                }
                return NDir.#ok(NDir.#buildDirInfo(normPath, 'fs', now, now));
            }

            // Repli IndexedDB : enregistre chaque segment de dossier parent + le dossier cible
            const parts = normPath.split('/');
            let current = '';
            for (let i = 0; i < parts.length; i++) {
                current = current ? `${current}/${parts[i]}` : parts[i];
                const dirKey = NDir.#toIdbDirKey(current);
                const existing = await NIndexedDB.instance.get(NDir.#idbStoreName, dirKey);
                if (!existing?.ok || !existing?.data) {
                    await NIndexedDB.instance.put(NDir.#idbStoreName, {
                        id: dirKey,
                        path: current,
                        name: NDir.getName(current),
                        parent: NDir.getParent(current),
                        createdAt: now,
                        updatedAt: now,
                        isFile: false,
                        isDirectory: true
                    });
                }
            }

            return NDir.#ok(NDir.#buildDirInfo(normPath, 'idb', now, now));
        } catch (err) {
            NLog.error(`NDir.create : Erreur lors de la création du dossier "${normPath}".`, {
                code: 'ERR_DIR_CREATE',
                path: normPath,
                error: err?.message
            });
            return NDir.#fail(err?.message || 'Erreur lors de la création du répertoire.', 'ERR_DIR_CREATE');
        }
    }

    /**
     * Alias de `create(path, options)` pour créer un répertoire.
     *
     * @param {string} path - Chemin du répertoire à créer.
     * @param {Object} [options={}] - Options (`{ recursive: true, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: NDirectoryEntry, error, code }`.
     *
     * @example <caption>Exemple 1 : Créer un répertoire avec mkdir()</caption>
     * const res = await NDir.mkdir('backups/sql');
     * console.log(res.ok); // true
     *
     * @example <caption>Exemple 2 : Vérifier l'existence après mkdir()</caption>
     * console.log(await NDir.exists('backups/sql')); // true
     */
    static async mkdir(path, options = {}) {
        return await NDir.create(path, options);
    }

    /**
     * S'assure qu'un répertoire existe (le crée s'il n'existe pas encore).
     *
     * @param {string} path - Chemin du répertoire.
     * @param {Object} [options={}] - Options (`{ driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: NDirectoryEntry, error, code }`.
     *
     * @example <caption>Exemple 1 : Garantir l'existence d'un dossier de cache</caption>
     * const res = await NDir.ensure('cache/thumbnails');
     * console.log(res.ok); // true
     *
     * @example <caption>Exemple 2 : Appel idempotent sur un dossier existant</caption>
     * const res2 = await NDir.ensure('cache/thumbnails');
     * console.log(res2.ok); // true
     */
    static async ensure(path, options = {}) {
        return await NDir.create(path, { ...options, recursive: true });
    }

    /**
     * Récupère les métadonnées descriptives d'un répertoire (`path`, `name`, `parent`, `filesCount`, `directoriesCount`, `size`, etc.).
     *
     * @param {string} [path=''] - Chemin du répertoire.
     * @param {Object} [options={}] - Options (`{ computeSize: false, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data, error, code }`.
     *
     * @example <caption>Exemple 1 : Obtenir les statistiques d'un répertoire</caption>
     * await NFile.writeText('stats_dir/a.txt', 'Bonjour');
     * const stat = await NDir.stat('stats_dir', { computeSize: true });
     * console.log(stat.ok, stat.data.filesCount, stat.data.size); // true, 1, 7
     *
     * @example <caption>Exemple 2 : Répertoire inexistant</caption>
     * const missing = await NDir.stat('dossier_absent');
     * console.log(missing.ok, missing.code); // false, 'ERR_DIR_NOT_FOUND'
     */
    static async stat(path = '', options = {}) {
        const normPath = NDir.normalizePath(path);
        const activeDriver = NDir.#resolveDriver(options?.driver);

        try {
            const exists = await NDir.exists(normPath, { driver: activeDriver });
            if (!exists) {
                return NDir.#fail(`Répertoire introuvable : "${normPath}".`, 'ERR_DIR_NOT_FOUND');
            }

            const entriesRes = await NDir.list(normPath, {
                recursive: Boolean(options?.computeSize),
                driver: activeDriver
            });
            const entries = entriesRes.ok && Array.isArray(entriesRes.data) ? entriesRes.data : [];

            let filesCount = 0;
            let directoriesCount = 0;
            let totalSize = 0;

            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                if (entry.isDirectory) {
                    directoriesCount++;
                } else {
                    filesCount++;
                    totalSize += Number(entry.size) || 0;
                }
            }

            const now = Date.now();
            return NDir.#ok({
                ...NDir.#buildDirInfo(normPath, activeDriver, now, now),
                filesCount,
                directoriesCount,
                entriesCount: filesCount + directoriesCount,
                size: totalSize,
                formattedSize: NNum.formatBytes(totalSize)
            });
        } catch (err) {
            NLog.error(`NDir.stat : Erreur lors de l'inspection du répertoire "${normPath}".`, {
                code: 'ERR_DIR_STAT',
                path: normPath,
                error: err?.message
            });
            return NDir.#fail(err?.message || 'Erreur lors de l\'inspection du répertoire.', 'ERR_DIR_STAT');
        }
    }

    /**
     * Alias de `stat(path, options)` retournant les informations descriptives du répertoire.
     *
     * @param {string} [path=''] - Chemin du répertoire.
     * @param {Object} [options={}] - Options (`{ computeSize: false, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data, error, code }`.
     *
     * @example <caption>Exemple 1 : Lire les informations d'un dossier via info()</caption>
     * await NDir.create('medialib');
     * const res = await NDir.info('medialib');
     * console.log(res.ok, res.data.name); // true, 'medialib'
     *
     * @example <caption>Exemple 2 : Calculer la taille via info()</caption>
     * const res2 = await NDir.info('medialib', { computeSize: true });
     * console.log(res2.data.formattedSize); // '0 B'
     */
    static async info(path = '', options = {}) {
        return await NDir.stat(path, options);
    }

    /**
     * Liste les entrées (fichiers et sous-répertoires) contenues dans un répertoire.
     *
     * @param {string} [path=''] - Chemin du répertoire à lister (`''` ou `'/'` pour la racine).
     * @param {Object} [options={}] - Options de listage.
     * @param {boolean} [options.recursive=false] - Si `true`, parcourt récursivement tous les sous-répertoires.
     * @param {'all'|'files'|'directories'} [options.type='all'] - Filtrer par type d'entrée.
     * @param {string|Array<string>} [options.extension] - Filtrer les fichiers par extension(s) (ex: `'pdf'` ou `['jpg', 'png']`).
     * @param {Function} [options.filter] - Prédicat personnalisé `(entry) => boolean`.
     * @param {'auto'|'native'|'fs'|'idb'} [options.driver='auto'] - Moteur de stockage cible.
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: Array<NDirectoryEntry>, error, code }`.
     *
     * @example <caption>Exemple 1 : Lister les entrées directes d'un dossier</caption>
     * await NFile.writeText('docs/a.txt', 'A');
     * await NFile.writeText('docs/sub/b.txt', 'B');
     * const res = await NDir.list('docs');
     * console.log(res.ok, res.data.map((e) => e.name)); // true, ['sub', 'a.txt']
     *
     * @example <caption>Exemple 2 : Lister récursivement tous les fichiers</caption>
     * const all = await NDir.list('docs', { recursive: true, type: 'files' });
     * console.log(all.data.map((e) => e.path)); // ['docs/a.txt', 'docs/sub/b.txt']
     */
    static async list(path = '', options = {}) {
        const normPath = NDir.normalizePath(path);
        const activeDriver = NDir.#resolveDriver(options?.driver);
        const recursive = Boolean(options?.recursive);
        const filterType = options?.type || 'all';

        try {
            let entries = [];

            if (activeDriver === 'native') {
                const res = await NDir.#invokeNativeDir('list', { path: normPath, recursive });
                if (!res || res.ok === false || res.success === false) {
                    return NDir.#fail(
                        res?.error || res?.message || `Impossible de lister le répertoire natif "${normPath}".`,
                        res?.code || 'ERR_DIR_LIST_NATIVE'
                    );
                }
                const rawList = Array.isArray(res.data) ? res.data : (Array.isArray(res.entries) ? res.entries : []);
                entries = rawList.map((item) => NDir.#normalizeRawEntry(item, normPath, 'native'));
            } else if (activeDriver === 'fs') {
                const dirHandle = await NDir.#getFsDirectoryHandle(normPath, false);
                if (!dirHandle) {
                    return NDir.#fail(`Répertoire introuvable : "${normPath}".`, 'ERR_DIR_NOT_FOUND');
                }
                entries = await NDir.#listFsDirectory(dirHandle, normPath, recursive);
            } else {
                // Repli IndexedDB
                const exists = await NDir.exists(normPath, { driver: 'idb' });
                if (!exists) {
                    return NDir.#fail(`Répertoire introuvable : "${normPath}".`, 'ERR_DIR_NOT_FOUND');
                }
                entries = await NDir.#listIdbDirectory(normPath, recursive);
            }

            // Filtrage par type ('all' | 'files' | 'directories')
            if (filterType === 'files') {
                entries = entries.filter((e) => e.isFile);
            } else if (filterType === 'directories') {
                entries = entries.filter((e) => e.isDirectory);
            }

            // Filtrage par extension(s)
            if (options?.extension) {
                const exts = (Array.isArray(options.extension) ? options.extension : [options.extension])
                    .map((x) => String(x).replace(/^\.+/, '').toLowerCase())
                    .filter(Boolean);
                if (exts.length > 0) {
                    entries = entries.filter((e) => e.isFile && exts.includes(e.extension));
                }
            }

            // Prédicat personnalisé
            if (typeof options?.filter === 'function') {
                entries = entries.filter((e) => {
                    try {
                        return Boolean(options.filter(e));
                    } catch {
                        return false;
                    }
                });
            }

            // Tri standard : répertoires d'abord, puis ordre alphabétique par chemin
            entries.sort((a, b) => {
                if (a.isDirectory !== b.isDirectory) {
                    return a.isDirectory ? -1 : 1;
                }
                return a.path.localeCompare(b.path);
            });

            return NDir.#ok(entries);
        } catch (err) {
            NLog.error(`NDir.list : Erreur lors du listage du répertoire "${normPath}".`, {
                code: 'ERR_DIR_LIST',
                path: normPath,
                error: err?.message
            });
            return NDir.#fail(err?.message || 'Erreur lors du listage du répertoire.', 'ERR_DIR_LIST');
        }
    }

    /**
     * Retourne directement la liste des fichiers contenus dans un répertoire.
     *
     * @param {string} [path=''] - Chemin du répertoire.
     * @param {Object} [options={}] - Options (`{ recursive: false, extension, filter, driver }`).
     * @returns {Promise<Array<NDirectoryEntry>>} Tableau des entrées de fichiers (`[]` si vide ou introuvable).
     *
     * @example <caption>Exemple 1 : Obtenir uniquement les fichiers d'un dossier</caption>
     * await NFile.writeText('exports/f1.csv', 'a,b');
     * const files = await NDir.listFiles('exports');
     * console.log(files.length, files[0].name); // 1, 'f1.csv'
     *
     * @example <caption>Exemple 2 : Dossier inexistant retourne un tableau vide</caption>
     * console.log(await NDir.listFiles('introuvable')); // []
     */
    static async listFiles(path = '', options = {}) {
        const res = await NDir.list(path, { ...options, type: 'files' });
        return res.ok && Array.isArray(res.data) ? res.data : [];
    }

    /**
     * Retourne directement la liste des sous-répertoires contenus dans un répertoire.
     *
     * @param {string} [path=''] - Chemin du répertoire.
     * @param {Object} [options={}] - Options (`{ recursive: false, filter, driver }`).
     * @returns {Promise<Array<NDirectoryEntry>>} Tableau des sous-répertoires (`[]` si vide ou introuvable).
     *
     * @example <caption>Exemple 1 : Obtenir les sous-dossiers directs</caption>
     * await NDir.create('racine/enfants_1');
     * await NDir.create('racine/enfants_2');
     * const dirs = await NDir.listDirectories('racine');
     * console.log(dirs.map((d) => d.name)); // ['enfants_1', 'enfants_2']
     *
     * @example <caption>Exemple 2 : Dossier sans sous-dossier retourne []</caption>
     * console.log(await NDir.listDirectories('racine/enfants_1')); // []
     */
    static async listDirectories(path = '', options = {}) {
        const res = await NDir.list(path, { ...options, type: 'directories' });
        return res.ok && Array.isArray(res.data) ? res.data : [];
    }

    /**
     * Construit une représentation hiérarchique (arbre) d'un répertoire et de ses sous-dossiers/fichiers.
     *
     * @param {string} [path=''] - Chemin du répertoire racine de l'arbre.
     * @param {Object} [options={}] - Options (`{ maxDepth: Infinity, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: Object, error, code }` avec `children` imbriqués.
     *
     * @example <caption>Exemple 1 : Générer l'arbre complet d'un dossier</caption>
     * await NFile.writeText('app/src/index.js', '// code');
     * const treeRes = await NDir.tree('app');
     * console.log(treeRes.ok, treeRes.data.children.length); // true, 1
     *
     * @example <caption>Exemple 2 : Limiter la profondeur de l'arbre</caption>
     * const shallow = await NDir.tree('app', { maxDepth: 1 });
     * console.log(shallow.ok); // true
     */
    static async tree(path = '', options = {}) {
        const normPath = NDir.normalizePath(path);
        const activeDriver = NDir.#resolveDriver(options?.driver);
        const maxDepth = typeof options?.maxDepth === 'number' && options.maxDepth >= 0
            ? options.maxDepth
            : Infinity;

        const exists = await NDir.exists(normPath, { driver: activeDriver });
        if (!exists) {
            return NDir.#fail(`Répertoire introuvable : "${normPath}".`, 'ERR_DIR_NOT_FOUND');
        }

        const buildNode = async (currentPath, depth) => {
            const now = Date.now();
            const node = {
                ...NDir.#buildDirInfo(currentPath, activeDriver, now, now),
                children: []
            };
            if (depth >= maxDepth) {
                return node;
            }
            const listRes = await NDir.list(currentPath, { recursive: false, driver: activeDriver });
            if (!listRes.ok || !Array.isArray(listRes.data)) {
                return node;
            }
            for (let i = 0; i < listRes.data.length; i++) {
                const entry = listRes.data[i];
                if (entry.isDirectory) {
                    const childTree = await buildNode(entry.path, depth + 1);
                    node.children.push(childTree);
                } else {
                    node.children.push(entry);
                }
            }
            return node;
        };

        const rootNode = await buildNode(normPath, 0);
        return NDir.#ok(rootNode);
    }

    /**
     * Recherche récursivement des fichiers ou dossiers correspondant aux critères fournis.
     *
     * @param {string} [path=''] - Répertoire de départ de la recherche.
     * @param {Object} [criteria={}] - Critères de recherche.
     * @param {string|RegExp} [criteria.query] - Sous-chaîne (insensible à la casse) ou RegExp sur le nom.
     * @param {string|Array<string>} [criteria.extension] - Extension(s) recherchée(s).
     * @param {'all'|'files'|'directories'} [criteria.type='all'] - Type d'entrée recherché.
     * @param {Function} [criteria.filter] - Fonction de filtrage personnalisée `(entry) => boolean`.
     * @param {'auto'|'native'|'fs'|'idb'} [criteria.driver='auto'] - Moteur de stockage cible.
     * @returns {Promise<Array<NDirectoryEntry>>} Liste des entrées trouvées.
     *
     * @example <caption>Exemple 1 : Rechercher des fichiers par nom ou sous-chaîne</caption>
     * await NFile.writeText('docs/facture_janvier.pdf', 'PDF 1');
     * await NFile.writeText('docs/2026/facture_fevrier.pdf', 'PDF 2');
     * const results = await NDir.find('docs', { query: 'facture', extension: 'pdf' });
     * console.log(results.length); // 2
     *
     * @example <caption>Exemple 2 : Recherche avec expression régulière</caption>
     * const jan = await NDir.find('docs', { query: /janvier/i });
     * console.log(jan.length); // 1
     */
    static async find(path = '', criteria = {}) {
        const listRes = await NDir.list(path, {
            recursive: true,
            type: criteria?.type || 'all',
            extension: criteria?.extension,
            driver: criteria?.driver
        });

        if (!listRes.ok || !Array.isArray(listRes.data)) {
            return [];
        }

        let results = listRes.data;
        const query = criteria?.query;

        if (query) {
            if (query instanceof RegExp) {
                results = results.filter((entry) => query.test(entry.name) || query.test(entry.path));
            } else if (typeof query === 'string' && query.trim()) {
                const needle = query.trim().toLowerCase();
                results = results.filter(
                    (entry) =>
                        entry.name.toLowerCase().includes(needle) ||
                        entry.path.toLowerCase().includes(needle)
                );
            }
        }

        if (typeof criteria?.filter === 'function') {
            results = results.filter((entry) => {
                try {
                    return Boolean(criteria.filter(entry));
                } catch {
                    return false;
                }
            });
        }

        return results;
    }

    /**
     * Calcule la taille totale en octets de tous les fichiers contenus récursivement dans un répertoire.
     *
     * @param {string} [path=''] - Chemin du répertoire.
     * @param {Object} [options={}] - Options (`{ driver }`).
     * @returns {Promise<number>} Taille totale en octets (`0` si vide ou introuvable).
     *
     * @example <caption>Exemple 1 : Calculer la taille totale d'un dossier</caption>
     * await NFile.writeText('rapport_dir/p1.txt', '12345');
     * await NFile.writeText('rapport_dir/p2.txt', '67890');
     * console.log(await NDir.size('rapport_dir')); // 10
     *
     * @example <caption>Exemple 2 : Dossier inexistant retourne 0</caption>
     * console.log(await NDir.size('dossier_vide_ou_absent')); // 0
     */
    static async size(path = '', options = {}) {
        const files = await NDir.listFiles(path, { recursive: true, driver: options?.driver });
        let total = 0;
        for (let i = 0; i < files.length; i++) {
            total += Number(files[i].size) || 0;
        }
        return total;
    }

    /**
     * Vide intégralement le contenu d'un répertoire tout en conservant le répertoire lui-même.
     *
     * @param {string} path - Chemin du répertoire à vider.
     * @param {Object} [options={}] - Options (`{ driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: { path, cleared }, error, code }`.
     *
     * @example <caption>Exemple 1 : Vider un répertoire de fichiers temporaires</caption>
     * await NFile.writeText('tmp/a.tmp', '1');
     * await NFile.writeText('tmp/b.tmp', '2');
     * await NDir.clear('tmp');
     * console.log((await NDir.listFiles('tmp')).length); // 0
     *
     * @example <caption>Exemple 2 : Le dossier lui-même existe toujours après clear()</caption>
     * console.log(await NDir.exists('tmp')); // true
     */
    static async clear(path, options = {}) {
        const normPath = NDir.normalizePath(path);
        const activeDriver = NDir.#resolveDriver(options?.driver);

        try {
            if (activeDriver === 'native') {
                const res = await NDir.#invokeNativeDir('clear', { path: normPath });
                if (res && (res.ok === false || res.success === false)) {
                    return NDir.#fail(
                        res?.error || res?.message || `Échec du vidage natif du répertoire "${normPath}".`,
                        res?.code || 'ERR_DIR_CLEAR_NATIVE'
                    );
                }
                return NDir.#ok({ path: normPath, cleared: true, driver: 'native' });
            }

            if (activeDriver === 'fs') {
                const dirHandle = await NDir.#getFsDirectoryHandle(normPath, false);
                if (!dirHandle) {
                    await NDir.create(normPath, { driver: 'fs' });
                    return NDir.#ok({ path: normPath, cleared: true, driver: 'fs' });
                }
                for await (const [entryName] of dirHandle.entries()) {
                    await dirHandle.removeEntry(entryName, { recursive: true });
                }
                return NDir.#ok({ path: normPath, cleared: true, driver: 'fs' });
            }

            // Repli IndexedDB
            const allRecords = await NDir.#getAllIdbRecords();
            const prefix = normPath ? `${normPath}/` : '';
            for (let i = 0; i < allRecords.length; i++) {
                const rec = allRecords[i];
                if (!normPath || (typeof rec.path === 'string' && rec.path.startsWith(prefix))) {
                    await NIndexedDB.instance.delete(NDir.#idbStoreName, rec.id);
                }
            }
            if (normPath) {
                await NDir.create(normPath, { driver: 'idb' });
            }
            return NDir.#ok({ path: normPath, cleared: true, driver: 'idb' });
        } catch (err) {
            NLog.error(`NDir.clear : Erreur lors du vidage du répertoire "${normPath}".`, {
                code: 'ERR_DIR_CLEAR',
                path: normPath,
                error: err?.message
            });
            return NDir.#fail(err?.message || 'Erreur lors du vidage du répertoire.', 'ERR_DIR_CLEAR');
        }
    }

    /**
     * Supprime un répertoire et, par défaut, tout son contenu (`recursive: true`).
     *
     * @param {string} path - Chemin du répertoire à supprimer.
     * @param {Object} [options={}] - Options (`{ recursive: true, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: { path, deleted }, error, code }`.
     *
     * @example <caption>Exemple 1 : Supprimer un répertoire avec tout son contenu</caption>
     * await NFile.writeText('old_dir/sub/file.txt', 'data');
     * const delRes = await NDir.delete('old_dir');
     * console.log(delRes.ok, await NDir.exists('old_dir')); // true, false
     *
     * @example <caption>Exemple 2 : Refuser la suppression d'un dossier non vide si recursive est false</caption>
     * await NFile.writeText('non_empty/file.txt', 'data');
     * const failRes = await NDir.delete('non_empty', { recursive: false });
     * console.log(failRes.ok, failRes.code); // false, 'ERR_DIR_NOT_EMPTY'
     */
    static async delete(path, options = {}) {
        const normPath = NDir.normalizePath(path);
        if (!normPath) {
            return NDir.#fail('Impossible de supprimer le répertoire racine. Utilisez clear("") pour le vider.', 'ERR_DIR_ROOT_DELETE');
        }

        const activeDriver = NDir.#resolveDriver(options?.driver);
        const recursive = options?.recursive !== false;

        try {
            if (!recursive) {
                const listRes = await NDir.list(normPath, { recursive: false, driver: activeDriver });
                if (listRes.ok && Array.isArray(listRes.data) && listRes.data.length > 0) {
                    return NDir.#fail(`Le répertoire "${normPath}" n'est pas vide.`, 'ERR_DIR_NOT_EMPTY');
                }
            }

            if (activeDriver === 'native') {
                const res = await NDir.#invokeNativeDir('delete', { path: normPath, recursive });
                if (res && (res.ok === false || res.success === false)) {
                    return NDir.#fail(
                        res?.error || res?.message || `Échec de suppression native du dossier "${normPath}".`,
                        res?.code || 'ERR_DIR_DELETE_NATIVE'
                    );
                }
                return NDir.#ok({ path: normPath, deleted: true, driver: 'native' });
            }

            if (activeDriver === 'fs') {
                const removed = await NDir.#removeFsDirectoryEntry(normPath, recursive);
                return NDir.#ok({ path: normPath, deleted: removed, driver: 'fs' });
            }

            // Repli IndexedDB
            await NIndexedDB.instance.delete(NDir.#idbStoreName, NDir.#toIdbDirKey(normPath));
            const allRecords = await NDir.#getAllIdbRecords();
            const prefix = `${normPath}/`;
            for (let i = 0; i < allRecords.length; i++) {
                const rec = allRecords[i];
                if (rec.path === normPath || (typeof rec.path === 'string' && rec.path.startsWith(prefix))) {
                    await NIndexedDB.instance.delete(NDir.#idbStoreName, rec.id);
                }
            }

            return NDir.#ok({ path: normPath, deleted: true, driver: 'idb' });
        } catch (err) {
            NLog.error(`NDir.delete : Erreur lors de la suppression du dossier "${normPath}".`, {
                code: 'ERR_DIR_DELETE',
                path: normPath,
                error: err?.message
            });
            return NDir.#fail(err?.message || 'Erreur lors de la suppression du répertoire.', 'ERR_DIR_DELETE');
        }
    }

    /**
     * Alias de `delete(path, options)` pour supprimer un répertoire.
     *
     * @param {string} path - Chemin du répertoire à supprimer.
     * @param {Object} [options={}] - Options (`{ recursive: true, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: { path, deleted }, error, code }`.
     *
     * @example <caption>Exemple 1 : Supprimer un répertoire avec rmdir()</caption>
     * await NDir.create('temp_logs');
     * const res = await NDir.rmdir('temp_logs');
     * console.log(res.ok); // true
     *
     * @example <caption>Exemple 2 : Vérifier l'absence après rmdir()</caption>
     * console.log(await NDir.exists('temp_logs')); // false
     */
    static async rmdir(path, options = {}) {
        return await NDir.delete(path, options);
    }

    /**
     * Copie récursivement un répertoire et tout son contenu vers un nouveau chemin de destination.
     *
     * @param {string} sourcePath - Chemin du répertoire source.
     * @param {string} destinationPath - Chemin du répertoire de destination.
     * @param {Object} [options={}] - Options (`{ overwrite: true, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: NDirectoryEntry, error, code }`.
     *
     * @example <caption>Exemple 1 : Copier un dossier complet</caption>
     * await NFile.writeText('src_dir/sub/doc.txt', 'Contenu');
     * const copyRes = await NDir.copy('src_dir', 'dest_dir');
     * console.log(copyRes.ok, await NFile.readText('dest_dir/sub/doc.txt')); // true, 'Contenu'
     *
     * @example <caption>Exemple 2 : Empêcher l'écrasement si overwrite est false</caption>
     * const failRes = await NDir.copy('src_dir', 'dest_dir', { overwrite: false });
     * console.log(failRes.ok, failRes.code); // false, 'ERR_DIR_ALREADY_EXISTS'
     */
    static async copy(sourcePath, destinationPath, options = {}) {
        const normSrc = NDir.normalizePath(sourcePath);
        const normDest = NDir.normalizePath(destinationPath);

        if (!normSrc || !normDest) {
            return NDir.#fail('Chemin source ou destination de répertoire invalide.', 'ERR_DIR_INVALID_PATH');
        }
        if (normDest === normSrc || normDest.startsWith(`${normSrc}/`)) {
            return NDir.#fail('Impossible de copier un répertoire à l\'intérieur de lui-même.', 'ERR_DIR_SELF_COPY');
        }

        const overwrite = options?.overwrite !== false;
        const activeDriver = NDir.#resolveDriver(options?.driver);

        if (!(await NDir.exists(normSrc, { driver: activeDriver }))) {
            return NDir.#fail(`Le répertoire source "${normSrc}" est introuvable.`, 'ERR_DIR_NOT_FOUND');
        }

        if (!overwrite && (await NDir.exists(normDest, { driver: activeDriver }))) {
            return NDir.#fail(`Le répertoire de destination "${normDest}" existe déjà.`, 'ERR_DIR_ALREADY_EXISTS');
        }

        if (activeDriver === 'native') {
            const nativeRes = await NDir.#invokeNativeDir('copy', {
                sourcePath: normSrc,
                destinationPath: normDest,
                overwrite
            });
            if (nativeRes && nativeRes.ok !== false && nativeRes.success !== false) {
                return await NDir.stat(normDest, { driver: 'native' });
            }
            return NDir.#fail(
                nativeRes?.error || nativeRes?.message || `Échec de la copie native de "${normSrc}" vers "${normDest}".`,
                nativeRes?.code || 'ERR_DIR_COPY_NATIVE'
            );
        }

        // Création du dossier de destination et copie récursive des sous-dossiers et fichiers
        await NDir.create(normDest, { driver: activeDriver });
        const entriesRes = await NDir.list(normSrc, { recursive: true, driver: activeDriver });
        const entries = entriesRes.ok && Array.isArray(entriesRes.data) ? entriesRes.data : [];

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const relative = entry.path.slice(normSrc.length + 1);
            const targetPath = `${normDest}/${relative}`;

            if (entry.isDirectory) {
                await NDir.create(targetPath, { driver: activeDriver });
            } else {
                await NFile.copy(entry.path, targetPath, { overwrite, driver: activeDriver });
            }
        }

        return await NDir.stat(normDest, { driver: activeDriver });
    }

    /**
     * Déplace un répertoire et tout son contenu vers un nouveau chemin de destination.
     *
     * @param {string} sourcePath - Chemin actuel du répertoire.
     * @param {string} destinationPath - Nouveau chemin du répertoire.
     * @param {Object} [options={}] - Options (`{ overwrite: true, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: NDirectoryEntry, error, code }`.
     *
     * @example <caption>Exemple 1 : Déplacer un dossier</caption>
     * await NFile.writeText('drafts/2026/note.txt', 'Note');
     * const moveRes = await NDir.move('drafts/2026', 'published/2026');
     * console.log(moveRes.ok, await NDir.exists('drafts/2026')); // true, false
     *
     * @example <caption>Exemple 2 : Les fichiers sont accessibles au nouvel emplacement</caption>
     * console.log(await NFile.readText('published/2026/note.txt')); // 'Note'
     */
    static async move(sourcePath, destinationPath, options = {}) {
        const normSrc = NDir.normalizePath(sourcePath);
        const normDest = NDir.normalizePath(destinationPath);

        if (!normSrc || !normDest) {
            return NDir.#fail('Chemin source ou destination de répertoire invalide.', 'ERR_DIR_INVALID_PATH');
        }
        if (normSrc === normDest) {
            return await NDir.stat(normSrc, { driver: options?.driver });
        }

        const activeDriver = NDir.#resolveDriver(options?.driver);

        if (activeDriver === 'native') {
            const overwrite = options?.overwrite !== false;
            const nativeRes = await NDir.#invokeNativeDir('move', {
                sourcePath: normSrc,
                destinationPath: normDest,
                overwrite
            });
            if (nativeRes && nativeRes.ok !== false && nativeRes.success !== false) {
                return await NDir.stat(normDest, { driver: 'native' });
            }
            return NDir.#fail(
                nativeRes?.error || nativeRes?.message || `Échec du déplacement natif de "${normSrc}" vers "${normDest}".`,
                nativeRes?.code || 'ERR_DIR_MOVE_NATIVE'
            );
        }

        const copyRes = await NDir.copy(normSrc, normDest, { ...options, driver: activeDriver });
        if (!copyRes.ok) {
            return copyRes;
        }

        await NDir.delete(normSrc, { recursive: true, driver: activeDriver });
        return copyRes;
    }

    /**
     * Renomme un répertoire au sein de son même dossier parent.
     *
     * @param {string} path - Chemin actuel du répertoire.
     * @param {string} newDirectoryName - Nouveau nom du répertoire (sans slash).
     * @param {Object} [options={}] - Options (`{ overwrite: true, driver }`).
     * @returns {Promise<NDirectoryResponse>} Résultat `{ ok, data: NDirectoryEntry, error, code }`.
     *
     * @example <caption>Exemple 1 : Renommer un dossier</caption>
     * await NFile.writeText('projets/v1/readme.md', '# V1');
     * const renRes = await NDir.rename('projets/v1', 'v2');
     * console.log(renRes.ok, renRes.data.path); // true, 'projets/v2'
     *
     * @example <caption>Exemple 2 : Vérifier le fichier dans le dossier renommé</caption>
     * console.log(await NFile.readText('projets/v2/readme.md')); // '# V1'
     */
    static async rename(path, newDirectoryName, options = {}) {
        const normPath = NDir.normalizePath(path);
        const cleanNewName = NDir.getName(newDirectoryName);

        if (!normPath || !cleanNewName) {
            return NDir.#fail('Chemin ou nouveau nom de répertoire invalide.', 'ERR_DIR_INVALID_NAME');
        }

        const parent = NDir.getParent(normPath);
        const targetPath = parent ? `${parent}/${cleanNewName}` : cleanNewName;
        return await NDir.move(normPath, targetPath, options);
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
        if (requestedDriver === 'native' && NDir.isNativeAvailable) {
            return 'native';
        }
        if (requestedDriver === 'fs' && NDir.isFsApiAvailable) {
            return 'fs';
        }
        if (requestedDriver === 'idb') {
            return 'idb';
        }
        return NDir.driver;
    }

    /**
     * Construit la clé IndexedDB pour un répertoire explicite.
     * @private
     * @param {string} normPath - Chemin normalisé.
     * @returns {string} Clé unique pour `ntable`.
     */
    static #toIdbDirKey(normPath) {
        return `${NDir.#idbDirPrefix}${normPath}`;
    }

    /**
     * Invoque le pont natif OS pour une opération sur un répertoire.
     * @private
     * @param {string} action - Action (`create`, `delete`, `list`, `exists`, `clear`, `copy`, `move`).
     * @param {Object} params - Paramètres de l'action.
     * @returns {Promise<any>}
     */
    static async #invokeNativeDir(action, params = {}) {
        return await NSys.invokeNative({
            type: ['app', 'directory', action],
            params
        });
    }

    /**
     * Obtient un `FileSystemDirectoryHandle` via `navigator.storage.getDirectory()`.
     * @private
     * @param {string} normPath - Chemin normalisé du répertoire (`''` pour la racine).
     * @param {boolean} [create=false] - Créer les répertoires intermédiaires s'ils n'existent pas.
     * @returns {Promise<any|null>} Instance `FileSystemDirectoryHandle` ou `null`.
     */
    static async #getFsDirectoryHandle(normPath, create = false) {
        try {
            if (!NDir.isFsApiAvailable) {
                return null;
            }
            let currentDir = await navigator.storage.getDirectory();
            if (!normPath) {
                return currentDir;
            }
            const parts = normPath.split('/').filter(Boolean);
            for (let i = 0; i < parts.length; i++) {
                currentDir = await currentDir.getDirectoryHandle(parts[i], { create });
            }
            return currentDir;
        } catch {
            return null;
        }
    }

    /**
     * Liste récursivement ou directement un `FileSystemDirectoryHandle` (OPFS).
     * @private
     * @param {any} dirHandle - Handle du répertoire.
     * @param {string} basePath - Chemin de base normalisé.
     * @param {boolean} recursive - Parcourir récursivement.
     * @returns {Promise<Array<NDirectoryEntry>>}
     */
    static async #listFsDirectory(dirHandle, basePath, recursive) {
        const results = [];
        const now = Date.now();

        for await (const [entryName, handle] of dirHandle.entries()) {
            const entryPath = basePath ? `${basePath}/${entryName}` : entryName;
            if (handle.kind === 'directory') {
                results.push(NDir.#buildDirInfo(entryPath, 'fs', now, now));
                if (recursive) {
                    const subEntries = await NDir.#listFsDirectory(handle, entryPath, true);
                    results.push(...subEntries);
                }
            } else {
                let size = 0;
                let updatedAt = now;
                let mimeType = NFile.getMimeType(entryPath);
                try {
                    const fileObj = await handle.getFile();
                    size = Number(fileObj.size) || 0;
                    updatedAt = Number(fileObj.lastModified) || now;
                    if (fileObj.type) mimeType = fileObj.type;
                } catch {
                    // Ignore
                }
                const parts = NFile.splitPath(entryPath);
                results.push({
                    path: entryPath,
                    name: parts.name,
                    baseName: parts.baseName,
                    extension: parts.extension,
                    parent: basePath,
                    directory: basePath,
                    size,
                    formattedSize: NNum.formatBytes(size),
                    mimeType,
                    createdAt: updatedAt,
                    updatedAt,
                    isFile: true,
                    isDirectory: false,
                    driver: 'fs'
                });
            }
        }

        return results;
    }

    /**
     * Supprime un répertoire dans l'API File System Access / OPFS.
     * @private
     * @param {string} normPath - Chemin normalisé.
     * @param {boolean} recursive - Suppression récursive.
     * @returns {Promise<boolean>}
     */
    static async #removeFsDirectoryEntry(normPath, recursive = true) {
        try {
            if (!NDir.isFsApiAvailable || !normPath) {
                return false;
            }
            const parentPath = NDir.getParent(normPath);
            const dirName = NDir.getName(normPath);
            const parentHandle = await NDir.#getFsDirectoryHandle(parentPath, false);
            if (!parentHandle) {
                return true;
            }
            await parentHandle.removeEntry(dirName, { recursive });
            return true;
        } catch {
            return true;
        }
    }

    /**
     * Récupère tous les enregistrements de fichiers (`__nfile__:`) et de dossiers (`__ndir__:`) dans IndexedDB.
     * @private
     * @returns {Promise<Array<Object>>}
     */
    static async #getAllIdbRecords() {
        const res = await NIndexedDB.instance.getAll(NDir.#idbStoreName);
        if (!res?.ok || !Array.isArray(res.data)) {
            return [];
        }
        return res.data.filter(
            (item) =>
                item &&
                typeof item.id === 'string' &&
                (item.id.startsWith(NDir.#idbFilePrefix) || item.id.startsWith(NDir.#idbDirPrefix))
        );
    }

    /**
     * Reconstruit la liste des entrées d'un répertoire à partir des enregistrements IndexedDB (`__nfile__:` et `__ndir__:`).
     * @private
     * @param {string} basePath - Chemin normalisé du répertoire (`''` pour la racine).
     * @param {boolean} recursive - Si `true`, inclut toute la descendance.
     * @returns {Promise<Array<NDirectoryEntry>>}
     */
    static async #listIdbDirectory(basePath, recursive) {
        const allRecords = await NDir.#getAllIdbRecords();
        const prefix = basePath ? `${basePath}/` : '';
        const entriesMap = new Map();
        const now = Date.now();

        for (let i = 0; i < allRecords.length; i++) {
            const rec = allRecords[i];
            const recPath = typeof rec.path === 'string' ? rec.path : '';
            if (!recPath) continue;

            if (basePath && !recPath.startsWith(prefix)) {
                continue;
            }

            const relative = basePath ? recPath.slice(prefix.length) : recPath;
            if (!relative) {
                continue;
            }

            const slashIdx = relative.indexOf('/');

            if (slashIdx === -1) {
                // Entrée directe
                if (rec.isDirectory || rec.id.startsWith(NDir.#idbDirPrefix)) {
                    if (!entriesMap.has(recPath)) {
                        entriesMap.set(
                            recPath,
                            NDir.#buildDirInfo(recPath, 'idb', rec.createdAt || now, rec.updatedAt || now)
                        );
                    }
                } else {
                    const size = Number(rec.size) || 0;
                    const parts = NFile.splitPath(recPath);
                    entriesMap.set(recPath, {
                        path: recPath,
                        name: parts.name,
                        baseName: parts.baseName,
                        extension: parts.extension,
                        parent: basePath,
                        directory: basePath,
                        size,
                        formattedSize: NNum.formatBytes(size),
                        mimeType: rec.mimeType || NFile.getMimeType(recPath),
                        createdAt: Number(rec.createdAt) || now,
                        updatedAt: Number(rec.updatedAt) || now,
                        isFile: true,
                        isDirectory: false,
                        driver: 'idb'
                    });
                }
            } else {
                // Entrée dans un sous-dossier : synthétiser les sous-dossiers intermédiaires
                const subParts = relative.split('/');
                const limit = recursive ? subParts.length - 1 : 1;
                let accum = basePath;

                for (let d = 0; d < limit; d++) {
                    accum = accum ? `${accum}/${subParts[d]}` : subParts[d];
                    if (!entriesMap.has(accum)) {
                        entriesMap.set(accum, NDir.#buildDirInfo(accum, 'idb', now, now));
                    }
                }

                if (recursive) {
                    if (rec.isDirectory || rec.id.startsWith(NDir.#idbDirPrefix)) {
                        if (!entriesMap.has(recPath)) {
                            entriesMap.set(
                                recPath,
                                NDir.#buildDirInfo(recPath, 'idb', rec.createdAt || now, rec.updatedAt || now)
                            );
                        }
                    } else {
                        const size = Number(rec.size) || 0;
                        const parts = NFile.splitPath(recPath);
                        entriesMap.set(recPath, {
                            path: recPath,
                            name: parts.name,
                            baseName: parts.baseName,
                            extension: parts.extension,
                            parent: parts.directory,
                            directory: parts.directory,
                            size,
                            formattedSize: NNum.formatBytes(size),
                            mimeType: rec.mimeType || NFile.getMimeType(recPath),
                            createdAt: Number(rec.createdAt) || now,
                            updatedAt: Number(rec.updatedAt) || now,
                            isFile: true,
                            isDirectory: false,
                            driver: 'idb'
                        });
                    }
                }
            }
        }

        return Array.from(entriesMap.values());
    }

    /**
     * Normalise une entrée brute retournée par le pont natif en `NDirectoryEntry`.
     * @private
     * @param {Object|string} item - Entrée brute.
     * @param {string} parentPath - Dossier parent.
     * @param {'native'|'fs'|'idb'} driver - Moteur actif.
     * @returns {NDirectoryEntry}
     */
    static #normalizeRawEntry(item, parentPath, driver) {
        const now = Date.now();
        if (typeof item === 'string') {
            const fullPath = parentPath ? `${parentPath}/${item}` : item;
            const parts = NFile.splitPath(fullPath);
            const isDir = !parts.extension;
            return isDir
                ? NDir.#buildDirInfo(fullPath, driver, now, now)
                : {
                    path: fullPath,
                    name: parts.name,
                    baseName: parts.baseName,
                    extension: parts.extension,
                    parent: parentPath,
                    directory: parentPath,
                    size: 0,
                    formattedSize: '0 B',
                    mimeType: NFile.getMimeType(fullPath),
                    createdAt: now,
                    updatedAt: now,
                    isFile: true,
                    isDirectory: false,
                    driver
                };
        }

        const entryPath = NDir.normalizePath(item.path || (parentPath ? `${parentPath}/${item.name}` : item.name));
        const isDir = Boolean(item.isDirectory || item.kind === 'directory' || item.type === 'directory');
        if (isDir) {
            return NDir.#buildDirInfo(
                entryPath,
                driver,
                Number(item.createdAt) || now,
                Number(item.updatedAt) || now
            );
        }

        const size = Number(item.size) || 0;
        const parts = NFile.splitPath(entryPath);
        return {
            path: entryPath,
            name: parts.name,
            baseName: parts.baseName,
            extension: parts.extension,
            parent: parts.directory,
            directory: parts.directory,
            size,
            formattedSize: NNum.formatBytes(size),
            mimeType: item.mimeType || NFile.getMimeType(entryPath),
            createdAt: Number(item.createdAt) || now,
            updatedAt: Number(item.updatedAt) || now,
            isFile: true,
            isDirectory: false,
            driver
        };
    }

    /**
     * Construit l'objet descripteur standardisé d'un répertoire.
     * @private
     * @param {string} normPath - Chemin normalisé.
     * @param {'native'|'fs'|'idb'} driver - Moteur utilisé.
     * @param {number} createdAt - Timestamp de création.
     * @param {number} updatedAt - Timestamp de modification.
     * @returns {NDirectoryEntry}
     */
    static #buildDirInfo(normPath, driver, createdAt, updatedAt) {
        return {
            path: normPath,
            name: NDir.getName(normPath),
            baseName: NDir.getName(normPath),
            extension: '',
            parent: NDir.getParent(normPath),
            directory: NDir.getParent(normPath),
            size: 0,
            formattedSize: '0 B',
            mimeType: 'inode/directory',
            createdAt,
            updatedAt,
            isFile: false,
            isDirectory: true,
            driver
        };
    }

    /**
     * Construit une réponse standardisée de succès.
     * @private
     * @param {any} data - Données de retour.
     * @returns {NDirectoryResponse}
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
     * @returns {NDirectoryResponse}
     */
    static #fail(error, code = 'ERR_DIR_OPERATION') {
        return {
            ok: false,
            data: null,
            error,
            code
        };
    }
}

export default NDir;
