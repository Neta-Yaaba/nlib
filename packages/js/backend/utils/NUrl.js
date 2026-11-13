/**
 * @file NUrl.js
 * @package @nlib/js-backend
 * @description Classe utilitaire pure pour la validation, la décomposition, la construction,
 * la normalisation, la manipulation des paramètres de requête (Query String), des chemins (paths)
 * et des ancres (hash) d'URL dans l'écosystème NLib.
 *
 * Règles architecturales des utilitaires NLib :
 * - N'hérite pas de `NObject`.
 * - Ne contient aucune variable / propriété d'état (empreinte mémoire nulle).
 * - Ne contient aucune méthode statique : chaque méthode d'instance reçoit ses paramètres,
 *   effectue le traitement et retourne directement le résultat.
 */

import { NUtil } from './NUtil.js';

/**
 * @class NUrl
 * @description Utilitaire de gestion et traitement des URLs et paramètres de requête sans état interne.
 *
 * @example <caption>Exemple 1 : Validation, analyse et normalisation d'URL</caption>
 * const urlUtil = new NUrl();
 * console.log(urlUtil.isValid('https://api.nlib.dev/v1/users?page=2')); // true
 * console.log(urlUtil.isHttps('https://api.nlib.dev'));                 // true
 * console.log(urlUtil.getDomain('https://api.nlib.dev:8080/v1'));       // 'api.nlib.dev'
 *
 * @example <caption>Exemple 2 : Manipulation des paramètres de requête (Query String)</caption>
 * const urlUtil = new NUrl();
 * const url = urlUtil.setQueryParams('https://nlib.dev/search', { q: 'sqlite', page: 1 });
 * console.log(url); // 'https://nlib.dev/search?q=sqlite&page=1'
 * console.log(urlUtil.getQueryParam(url, 'q')); // 'sqlite'
 *
 * @example <caption>Exemple 3 : Jointure de segments de chemin et construction complète</caption>
 * const urlUtil = new NUrl();
 * console.log(urlUtil.join('https://api.nlib.dev/', '/v1/', '/users/42/'));
 * // 'https://api.nlib.dev/v1/users/42'
 */
export class NUrl {

    // =========================================================================
    // Méthodes privées internes (Résolution sécurisée sans état)
    // =========================================================================

    /**
     * Tente d'instancier un objet `URL` natif (avec base factice si l'URL est relative).
     *
     * @param {string} url - Chaîne URL à analyser.
     * @param {string} [base=''] - URL de base optionnelle.
     * @returns {{ instance: URL, isRelative: boolean }|null} Objet contenant l'instance `URL` ou `null`.
     *
     * @example <caption>Exemple 1 : URL absolue</caption>
     * // Interne : #toUrlInstance('https://nlib.dev/api') -> { instance: URL, isRelative: false }
     *
     * @example <caption>Exemple 2 : URL relative</caption>
     * // Interne : #toUrlInstance('/api/users?id=1') -> { instance: URL, isRelative: true }
     */
    #toUrlInstance(url, base = '') {
        if (typeof url !== 'string') {
            return null;
        }
        const trimmed = url.trim();
        if (trimmed.length === 0) {
            return null;
        }
        try {
            if (base) {
                return { instance: new URL(trimmed, base), isRelative: false };
            }
            return { instance: new URL(trimmed), isRelative: false };
        } catch {
            if (trimmed.startsWith('/') || trimmed.startsWith('?') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
                try {
                    return {
                        instance: new URL(trimmed, 'http://nlib.local'),
                        isRelative: true
                    };
                } catch {
                    return null;
                }
            }
            return null;
        }
    }

    /**
     * Formate l'instance `URL` en chaîne finale en tenant compte du caractère relatif ou absolu.
     *
     * @param {URL} instance - Instance `URL` modifiée.
     * @param {boolean} isRelative - Indique si l'URL d'origine était relative.
     * @returns {string} Chaîne URL reconstruite.
     *
     * @example <caption>Exemple 1 : Reconstruction absolue</caption>
     * // Interne : #formatUrlInstance(urlObj, false) -> 'https://nlib.dev/path?a=1'
     *
     * @example <caption>Exemple 2 : Reconstruction relative</caption>
     * // Interne : #formatUrlInstance(urlObj, true) -> '/path?a=1'
     */
    #formatUrlInstance(instance, isRelative) {
        if (!isRelative) {
            return instance.toString();
        }
        return `${instance.pathname}${instance.search}${instance.hash}`;
    }

    // =========================================================================
    // Méthodes publiques — Validation & Vérifications
    // =========================================================================

    /**
     * Vérifie si la chaîne fournie est une URL valide.
     *
     * @param {any} url - Valeur à tester.
     * @param {Object} [options={}] - Options de validation.
     * @param {string[]} [options.allowedProtocols=['http:', 'https:']] - Protocoles autorisés (ex: `['http:', 'https:', 'ws:', 'wss:']`).
     * @param {boolean} [options.allowRelative=false] - Si `true`, accepte également les chemins relatifs (`/api/v1`).
     * @param {boolean} [options.requireTld=true] - Si `true`, exige un TLD (ou `'localhost'` / adresse IP) sur le nom d'hôte.
     * @returns {boolean} `true` si l'URL est valide selon les critères, sinon `false`.
     *
     * @example <caption>Exemple 1 : URLs HTTP/HTTPS valides</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isValid('https://nlib.dev/docs'));      // true
     * console.log(urlUtil.isValid('http://localhost:3000/api'));  // true
     *
     * @example <caption>Exemple 2 : URLs relatives ou protocole non autorisé</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isValid('/api/users'));                               // false
     * console.log(urlUtil.isValid('/api/users', { allowRelative: true }));      // true
     */
    isValid(url, options = {}) {
        if (typeof url !== 'string' || url.trim().length === 0) {
            return false;
        }
        const allowRelative = options?.allowRelative ?? false;
        const resolved = this.#toUrlInstance(url);
        if (!resolved) {
            return false;
        }
        if (resolved.isRelative) {
            return allowRelative;
        }

        const allowedProtocols = Array.isArray(options?.allowedProtocols)
            ? options.allowedProtocols.map((p) => (p.endsWith(':') ? p.toLowerCase() : `${p.toLowerCase()}:`))
            : ['http:', 'https:'];

        if (allowedProtocols.length > 0 && !allowedProtocols.includes(resolved.instance.protocol.toLowerCase())) {
            return false;
        }

        const requireTld = options?.requireTld ?? true;
        if (requireTld) {
            const host = resolved.instance.hostname.toLowerCase();
            const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
            const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
            const hasTld = host.includes('.') && !host.startsWith('.') && !host.endsWith('.');
            if (!isLocal && !isIpv4 && !hasTld) {
                return false;
            }
        }

        return true;
    }

    /**
     * Vérifie si une URL utilise le protocole sécurisé `https:` (ou `wss:`).
     *
     * @param {string} url - URL à tester.
     * @returns {boolean} `true` si le protocole est `https:` ou `wss:`, sinon `false`.
     *
     * @example <caption>Exemple 1 : URL HTTPS sécurisée</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isHttps('https://nlib.dev')); // true
     *
     * @example <caption>Exemple 2 : URL HTTP non chiffrée</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isHttps('http://nlib.dev'));  // false
     */
    isHttps(url) {
        const resolved = this.#toUrlInstance(url);
        if (!resolved || resolved.isRelative) {
            return false;
        }
        const proto = resolved.instance.protocol.toLowerCase();
        return proto === 'https:' || proto === 'wss:';
    }

    /**
     * Vérifie si l'URL est absolue (commence par un schéma comme `https://`, `http://`, `file://`, etc.).
     *
     * @param {string} url - URL à tester.
     * @returns {boolean} `true` si l'URL est absolue, sinon `false`.
     *
     * @example <caption>Exemple 1 : URL absolue</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isAbsolute('https://nlib.dev/v1')); // true
     *
     * @example <caption>Exemple 2 : Chemin relatif</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isAbsolute('/v1/users'));           // false
     */
    isAbsolute(url) {
        if (typeof url !== 'string') {
            return false;
        }
        return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url.trim());
    }

    /**
     * Vérifie si l'URL est relative (ne contient pas de schéma/protocole).
     *
     * @param {string} url - URL à tester.
     * @returns {boolean} `true` si l'URL est relative, sinon `false`.
     *
     * @example <caption>Exemple 1 : URL relative</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isRelative('/dashboard/settings')); // true
     *
     * @example <caption>Exemple 2 : URL absolue</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isRelative('https://nlib.dev'));    // false
     */
    isRelative(url) {
        if (typeof url !== 'string' || url.trim().length === 0) {
            return false;
        }
        return !this.isAbsolute(url);
    }

    /**
     * Vérifie si deux URLs partagent exactement la même origine (`protocol + hostname + port`).
     *
     * @param {string} urlA - Première URL.
     * @param {string} urlB - Seconde URL.
     * @returns {boolean} `true` si les deux URLs ont la même origine, sinon `false`.
     *
     * @example <caption>Exemple 1 : Même origine</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isSameOrigin('https://nlib.dev/a', 'https://nlib.dev/b?x=1')); // true
     *
     * @example <caption>Exemple 2 : Origines différentes (sous-domaine ou port différent)</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.isSameOrigin('https://nlib.dev', 'https://api.nlib.dev')); // false
     */
    isSameOrigin(urlA, urlB) {
        const resA = this.#toUrlInstance(urlA);
        const resB = this.#toUrlInstance(urlB);
        if (!resA || !resB || resA.isRelative || resB.isRelative) {
            return false;
        }
        return resA.instance.origin === resB.instance.origin;
    }

    /**
     * Compare deux URLs après normalisation (tri alphabétique des paramètres de requête,
     * suppression optionnelle du slash final et de l'ancre `#hash`).
     *
     * @param {string} urlA - Première URL.
     * @param {string} urlB - Seconde URL.
     * @param {Object} [options={}] - Options de normalisation (`stripHash`, `stripTrailingSlash`, `sortQuery`).
     * @returns {boolean} `true` si les deux URLs sont équivalentes, sinon `false`.
     *
     * @example <caption>Exemple 1 : Paramètres de requête dans un ordre différent</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.equals(
     *     'https://nlib.dev/items?b=2&a=1',
     *     'https://nlib.dev/items/?a=1&b=2'
     * )); // true
     *
     * @example <caption>Exemple 2 : Ignorer l'ancre #hash</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.equals(
     *     'https://nlib.dev/docs#intro',
     *     'https://nlib.dev/docs',
     *     { stripHash: true }
     * )); // true
     */
    equals(urlA, urlB, options = {}) {
        const normA = this.normalize(urlA, options);
        const normB = this.normalize(urlB, options);
        if (!normA || !normB) {
            return false;
        }
        return normA === normB;
    }

    // =========================================================================
    // Méthodes publiques — Décomposition & Extraction de Composants (Parsing)
    // =========================================================================

    /**
     * Décompose une URL en un objet structuré contenant tous ses composants,
     * ou retourne `null` si l'URL est invalide.
     *
     * @param {string} url - URL à analyser.
     * @returns {{
     *   href: string,
     *   protocol: string,
     *   origin: string,
     *   host: string,
     *   hostname: string,
     *   port: string,
     *   pathname: string,
     *   search: string,
     *   query: Object<string, string|string[]>,
     *   hash: string,
     *   username: string,
     *   password: string,
     *   isRelative: boolean
     * }|null} Objet détaillant les parties de l'URL, ou `null`.
     *
     * @example <caption>Exemple 1 : Décomposer une URL complète</caption>
     * const urlUtil = new NUrl();
     * const info = urlUtil.parse('https://api.nlib.dev:8443/v1/users?role=admin#top');
     * console.log(info.protocol); // 'https'
     * console.log(info.hostname); // 'api.nlib.dev'
     * console.log(info.port);     // '8443'
     * console.log(info.pathname); // '/v1/users'
     * console.log(info.query);    // { role: 'admin' }
     * console.log(info.hash);     // 'top'
     *
     * @example <caption>Exemple 2 : Décomposer une URL relative</caption>
     * const urlUtil = new NUrl();
     * const rel = urlUtil.parse('/articles?page=3');
     * console.log(rel.isRelative, rel.pathname, rel.query); // true '/articles' { page: '3' }
     */
    parse(url) {
        const resolved = this.#toUrlInstance(url);
        if (!resolved) {
            return null;
        }
        const { instance, isRelative } = resolved;
        return {
            href: this.#formatUrlInstance(instance, isRelative),
            protocol: isRelative ? '' : instance.protocol.replace(/:$/, '').toLowerCase(),
            origin: isRelative ? '' : instance.origin,
            host: isRelative ? '' : instance.host,
            hostname: isRelative ? '' : instance.hostname,
            port: isRelative ? '' : instance.port,
            pathname: instance.pathname,
            search: instance.search,
            query: this.parseQueryString(instance.search),
            hash: instance.hash.replace(/^#/, ''),
            username: isRelative ? '' : instance.username,
            password: isRelative ? '' : instance.password,
            isRelative
        };
    }

    /**
     * Extrait le protocole sans les deux-points (ex: `'https'`, `'http'`), ou `''` si relatif/invalide.
     *
     * @param {string} url - URL cible.
     * @returns {string} Protocole en minuscules ou `''`.
     *
     * @example <caption>Exemple 1 : Extraire le protocole</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getProtocol('https://nlib.dev')); // 'https'
     *
     * @example <caption>Exemple 2 : Chemin relatif</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getProtocol('/chemin/local'));    // ''
     */
    getProtocol(url) {
        return this.parse(url)?.protocol ?? '';
    }

    /**
     * Extrait le nom de domaine (`hostname`, sans le port) d'une URL.
     *
     * @param {string} url - URL cible.
     * @param {boolean} [stripWww=false] - Si `true`, retire le préfixe `'www.'`.
     * @returns {string} Nom de domaine ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Extraire le domaine</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getDomain('https://www.nlib.dev:8080/docs')); // 'www.nlib.dev'
     *
     * @example <caption>Exemple 2 : Sans le préfixe www.</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getDomain('https://www.nlib.dev/docs', true)); // 'nlib.dev'
     */
    getDomain(url, stripWww = false) {
        const hostname = this.parse(url)?.hostname ?? '';
        if (!hostname) {
            return '';
        }
        return stripWww ? hostname.replace(/^www\./i, '') : hostname;
    }

    /**
     * Extrait le chemin (`pathname`) d'une URL (ex: `'/v1/users'`).
     *
     * @param {string} url - URL cible.
     * @returns {string} Chemin de l'URL ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Extraire le chemin</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getPath('https://nlib.dev/v1/users?id=10')); // '/v1/users'
     *
     * @example <caption>Exemple 2 : URL racine</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getPath('https://nlib.dev')); // '/'
     */
    getPath(url) {
        return this.parse(url)?.pathname ?? '';
    }

    /**
     * Découpe le chemin (`pathname`) d'une URL en un tableau de segments propres (sans slashs vides).
     *
     * @param {string} url - URL ou chemin à découper.
     * @returns {string[]} Tableau des segments du chemin.
     *
     * @example <caption>Exemple 1 : Extraire les segments</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getPathSegments('https://nlib.dev/api/v1/users/42/'));
     * // ['api', 'v1', 'users', '42']
     *
     * @example <caption>Exemple 2 : URL racine retourne un tableau vide</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getPathSegments('https://nlib.dev/')); // []
     */
    getPathSegments(url) {
        const pathname = this.getPath(url);
        if (!pathname) {
            return [];
        }
        return pathname
            .split('/')
            .filter((seg) => seg.length > 0)
            .map((seg) => decodeURIComponent(seg));
    }

    /**
     * Extrait l'ancre (`hash` sans le `'#'`) d'une URL.
     *
     * @param {string} url - URL cible.
     * @returns {string} Valeur du hash ou `''`.
     *
     * @example <caption>Exemple 1 : Extraire l'ancre</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getHash('https://nlib.dev/guide#installation')); // 'installation'
     *
     * @example <caption>Exemple 2 : URL sans ancre</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getHash('https://nlib.dev/guide')); // ''
     */
    getHash(url) {
        return this.parse(url)?.hash ?? '';
    }

    // =========================================================================
    // Méthodes publiques — Gestion des Paramètres de Requête (Query String)
    // =========================================================================

    /**
     * Convertit une chaîne de requête (`'?a=1&b=2'` ou une URL complète) en un objet clé-valeur.
     * Si une même clé apparaît plusieurs fois (`'?tag=js&tag=php'`), sa valeur devient un tableau `['js', 'php']`.
     *
     * @param {string} queryOrUrl - Chaîne de requête ou URL complète.
     * @returns {Object<string, string|string[]>} Objet contenant les paramètres décodés.
     *
     * @example <caption>Exemple 1 : Analyser les paramètres d'une URL</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.parseQueryString('https://nlib.dev/search?q=nlib&lang=fr'));
     * // { q: 'nlib', lang: 'fr' }
     *
     * @example <caption>Exemple 2 : Paramètres multiples avec la même clé</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.parseQueryString('?tag=js&tag=php'));
     * // { tag: ['js', 'php'] }
     */
    parseQueryString(queryOrUrl) {
        if (typeof queryOrUrl !== 'string' || queryOrUrl.trim().length === 0) {
            return {};
        }
        let searchPart = queryOrUrl.trim();
        const hashIdx = searchPart.indexOf('#');
        if (hashIdx !== -1) {
            searchPart = searchPart.slice(0, hashIdx);
        }
        const qIdx = searchPart.indexOf('?');
        if (qIdx !== -1) {
            searchPart = searchPart.slice(qIdx + 1);
        } else if (searchPart.includes('://') || searchPart.startsWith('/')) {
            return {};
        }

        const params = new URLSearchParams(searchPart);
        const result = {};
        for (const [key, value] of params.entries()) {
            if (Object.prototype.hasOwnProperty.call(result, key)) {
                if (Array.isArray(result[key])) {
                    result[key].push(value);
                } else {
                    result[key] = [result[key], value];
                }
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    /**
     * Sérialise un objet de paramètres en une chaîne de requête URL encodée (sans `'?'` initial par défaut).
     * Ignore les valeurs `undefined` et `null`. Supporte les tableaux de valeurs.
     *
     * @param {Object<string, any>} params - Objet contenant les paramètres.
     * @param {boolean} [prefixQuestionMark=false] - Si `true`, préfixe la chaîne non vide par `'?'`.
     * @returns {string} Chaîne de requête encodée.
     *
     * @example <caption>Exemple 1 : Sérialiser un objet en Query String</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.stringifyQueryParams({ q: 'nlib framework', page: 2 }));
     * // 'q=nlib+framework&page=2'
     *
     * @example <caption>Exemple 2 : Avec le préfixe '?'</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.stringifyQueryParams({ active: true }, true));
     * // '?active=true'
     */
    stringifyQueryParams(params, prefixQuestionMark = false) {
        if (!params || typeof params !== 'object') {
            return '';
        }
        const searchParams = new URLSearchParams();
        const keys = Object.keys(params);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = params[key];
            if (val === undefined || val === null) {
                continue;
            }
            if (Array.isArray(val)) {
                for (let j = 0; j < val.length; j++) {
                    if (val[j] !== undefined && val[j] !== null) {
                        searchParams.append(key, String(val[j]));
                    }
                }
            } else {
                searchParams.append(key, String(val));
            }
        }
        const str = searchParams.toString();
        if (!str) {
            return '';
        }
        return prefixQuestionMark ? `?${str}` : str;
    }

    /**
     * Récupère la valeur d'un paramètre de requête spécifique dans une URL.
     *
     * @param {string} url - URL cible.
     * @param {string} paramName - Nom du paramètre à récupérer.
     * @param {any} [fallback=null] - Valeur retournée si le paramètre est absent.
     * @returns {string|string[]|any} Valeur du paramètre ou `fallback`.
     *
     * @example <caption>Exemple 1 : Lire un paramètre existant</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getQueryParam('https://nlib.dev/items?id=42', 'id')); // '42'
     *
     * @example <caption>Exemple 2 : Paramètre absent avec valeur par défaut</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.getQueryParam('https://nlib.dev/items', 'page', '1')); // '1'
     */
    getQueryParam(url, paramName, fallback = null) {
        if (typeof paramName !== 'string' || paramName.length === 0) {
            return fallback;
        }
        const query = this.parseQueryString(url);
        return Object.prototype.hasOwnProperty.call(query, paramName) ? query[paramName] : fallback;
    }

    /**
     * Ajoute ou met à jour un ou plusieurs paramètres de requête dans une URL.
     * Si une valeur vaut `null` ou `undefined`, le paramètre correspondant est supprimé.
     *
     * @param {string} url - URL initiale (absolue ou relative).
     * @param {Object<string, any>} params - Dictionnaire des paramètres à définir.
     * @returns {string} Nouvelle URL avec les paramètres mis à jour.
     *
     * @example <caption>Exemple 1 : Ajouter et modifier des paramètres</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.setQueryParams('https://nlib.dev/users?page=1', { page: 2, limit: 20 }));
     * // 'https://nlib.dev/users?page=2&limit=20'
     *
     * @example <caption>Exemple 2 : Sur une URL relative</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.setQueryParams('/api/items', { sort: 'asc' }));
     * // '/api/items?sort=asc'
     */
    setQueryParams(url, params) {
        const resolved = this.#toUrlInstance(url);
        if (!resolved || !params || typeof params !== 'object') {
            return typeof url === 'string' ? url : '';
        }
        const { instance, isRelative } = resolved;
        const keys = Object.keys(params);

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = params[key];
            instance.searchParams.delete(key);
            if (val === undefined || val === null) {
                continue;
            }
            if (Array.isArray(val)) {
                for (let j = 0; j < val.length; j++) {
                    if (val[j] !== undefined && val[j] !== null) {
                        instance.searchParams.append(key, String(val[j]));
                    }
                }
            } else {
                instance.searchParams.set(key, String(val));
            }
        }

        return this.#formatUrlInstance(instance, isRelative);
    }

    /**
     * Supprime un ou plusieurs paramètres de requête d'une URL.
     *
     * @param {string} url - URL initiale.
     * @param {string|string[]} paramNames - Nom du paramètre (ou tableau de noms) à supprimer.
     * @returns {string} URL nettoyée des paramètres indiqués.
     *
     * @example <caption>Exemple 1 : Supprimer un paramètre unique</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.removeQueryParams('https://nlib.dev/page?token=secret&id=5', 'token'));
     * // 'https://nlib.dev/page?id=5'
     *
     * @example <caption>Exemple 2 : Supprimer plusieurs paramètres</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.removeQueryParams('https://nlib.dev/page?utm_source=x&utm_medium=y&id=1', ['utm_source', 'utm_medium']));
     * // 'https://nlib.dev/page?id=1'
     */
    removeQueryParams(url, paramNames) {
        const resolved = this.#toUrlInstance(url);
        if (!resolved) {
            return '';
        }
        const { instance, isRelative } = resolved;
        const names = Array.isArray(paramNames) ? paramNames : [paramNames];
        for (let i = 0; i < names.length; i++) {
            if (typeof names[i] === 'string') {
                instance.searchParams.delete(names[i]);
            }
        }
        return this.#formatUrlInstance(instance, isRelative);
    }

    // =========================================================================
    // Méthodes publiques — Construction, Jointure & Normalisation
    // =========================================================================

    /**
     * Assemble proprement une URL de base et plusieurs segments de chemin en évitant les doubles
     * barres obliques (`//`) ou les barres manquantes.
     *
     * @param {...string} segments - Base URL et segments de chemin à joindre.
     * @returns {string} URL ou chemin joint proprement.
     *
     * @example <caption>Exemple 1 : Joindre une base et plusieurs segments</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.join('https://api.nlib.dev/', '/v1/', '/users/', 'profile'));
     * // 'https://api.nlib.dev/v1/users/profile'
     *
     * @example <caption>Exemple 2 : Joindre des chemins relatifs</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.join('/assets/', '/images/', 'logo.png'));
     * // '/assets/images/logo.png'
     */
    join(...segments) {
        const valid = segments
            .filter((s) => typeof s === 'string' && s.trim().length > 0)
            .map((s) => s.trim());

        if (valid.length === 0) {
            return '';
        }

        const first = valid[0];
        const hasLeadingSlash = first.startsWith('/');
        const protocolMatch = /^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/)(.*)$/.exec(first);

        let prefix = '';
        const cleanedParts = [];

        if (protocolMatch) {
            prefix = protocolMatch[1];
            const restFirst = protocolMatch[2].replace(/^\/+|\/+$/g, '');
            if (restFirst) {
                cleanedParts.push(restFirst);
            }
        } else {
            const cleanedFirst = first.replace(/^\/+|\/+$/g, '');
            if (cleanedFirst) {
                cleanedParts.push(cleanedFirst);
            }
        }

        for (let i = 1; i < valid.length; i++) {
            const part = valid[i].replace(/^\/+|\/+$/g, '');
            if (part) {
                cleanedParts.push(part);
            }
        }

        const joined = cleanedParts.join('/');
        if (prefix) {
            return `${prefix}${joined}`;
        }
        return hasLeadingSlash ? `/${joined}` : joined;
    }

    /**
     * Construit une URL complète à partir d'un objet de configuration.
     *
     * @param {Object} parts - Composants de l'URL à construire.
     * @param {string} [parts.base] - URL de base (ex: `'https://api.nlib.dev'`).
     * @param {string} [parts.protocol='https'] - Protocole si `base` n'est pas fourni.
     * @param {string} [parts.hostname=''] - Nom d'hôte si `base` n'est pas fourni.
     * @param {number|string} [parts.port=''] - Port éventuel.
     * @param {string|string[]} [parts.path=''] - Chemin ou tableau de segments de chemin.
     * @param {Object<string, any>} [parts.query={}] - Paramètres de requête.
     * @param {string} [parts.hash=''] - Ancre (`#hash`).
     * @returns {string} URL complète construite.
     *
     * @example <caption>Exemple 1 : Construire à partir d'une base, d'un chemin et d'une query</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.build({
     *     base: 'https://api.nlib.dev',
     *     path: ['v1', 'products'],
     *     query: { category: 'books', limit: 10 },
     *     hash: 'results'
     * }));
     * // 'https://api.nlib.dev/v1/products?category=books&limit=10#results'
     *
     * @example <caption>Exemple 2 : Construire à partir de protocol, hostname et port</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.build({
     *     protocol: 'http',
     *     hostname: 'localhost',
     *     port: 8080,
     *     path: '/health'
     * }));
     * // 'http://localhost:8080/health'
     */
    build(parts = {}) {
        if (!parts || typeof parts !== 'object') {
            return '';
        }

        let baseStr = '';
        if (typeof parts.base === 'string' && parts.base.trim().length > 0) {
            baseStr = parts.base.trim();
        } else if (typeof parts.hostname === 'string' && parts.hostname.trim().length > 0) {
            const proto = (parts.protocol || 'https').replace(/:\/?\/?$/, '');
            const host = parts.hostname.trim();
            const port = parts.port ? `:${parts.port}` : '';
            baseStr = `${proto}://${host}${port}`;
        }

        const pathSegments = Array.isArray(parts.path) ? parts.path : [parts.path || ''];
        let fullUrl = baseStr ? this.join(baseStr, ...pathSegments) : this.join(...pathSegments);

        if (!fullUrl) {
            return '';
        }

        if (parts.query && typeof parts.query === 'object') {
            fullUrl = this.setQueryParams(fullUrl, parts.query);
        }

        if (typeof parts.hash === 'string' && parts.hash.trim().length > 0) {
            const cleanHash = parts.hash.trim().replace(/^#/, '');
            fullUrl = `${fullUrl.split('#')[0]}#${cleanHash}`;
        }

        return fullUrl;
    }

    /**
     * Normalise une URL (domaine en minuscules, suppression du slash final superflu,
     * tri alphabétique des paramètres de requête et suppression optionnelle du hash ou des paramètres).
     *
     * @param {string} url - URL à normaliser.
     * @param {Object} [options={}] - Options de normalisation.
     * @param {boolean} [options.stripTrailingSlash=true] - Si `true`, retire le `'/'` final du chemin (hors racine `'/'`).
     * @param {boolean} [options.stripHash=false] - Si `true`, retire l'ancre `#...`.
     * @param {boolean} [options.stripQuery=false] - Si `true`, retire tous les paramètres `?a=1...`.
     * @param {boolean} [options.sortQuery=true] - Si `true`, trie les paramètres de requête par ordre alphabétique.
     * @returns {string} URL normalisée, ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Normaliser le slash final et trier la Query String</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.normalize('HTTPS://NLib.DEV/api/users/?z=2&a=1'));
     * // 'https://nlib.dev/api/users?a=1&z=2'
     *
     * @example <caption>Exemple 2 : Retirer la Query String et le Hash</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.normalize('https://nlib.dev/page/?ref=mail#top', {
     *     stripQuery: true,
     *     stripHash: true
     * }));
     * // 'https://nlib.dev/page'
     */
    normalize(url, options = {}) {
        const resolved = this.#toUrlInstance(url);
        if (!resolved) {
            return '';
        }
        const { instance, isRelative } = resolved;
        const stripTrailingSlash = options?.stripTrailingSlash ?? true;
        const stripHash = options?.stripHash ?? false;
        const stripQuery = options?.stripQuery ?? false;
        const sortQuery = options?.sortQuery ?? true;

        if (stripTrailingSlash && instance.pathname.length > 1) {
            instance.pathname = instance.pathname.replace(/\/+$/, '');
        }
        if (stripQuery) {
            instance.search = '';
        } else if (sortQuery) {
            instance.searchParams.sort();
        }
        if (stripHash) {
            instance.hash = '';
        }

        return this.#formatUrlInstance(instance, isRelative);
    }

    // =========================================================================
    // Méthodes publiques — Encodage, Décodage & Obfuscation d'ID / Texte pour URL
    // =========================================================================

    /**
     * Encode une chaîne de caractères (ou composant d'URL) au format RFC 3986
     * (`encodeURIComponent` renforcé qui encode également `!`, `'`, `(`, `)`, `*`).
     *
     * @param {string|number} value - Texte ou valeur à encoder pour l'URL.
     * @returns {string} Chaîne encodée sûre pour une URL.
     *
     * @example <caption>Exemple 1 : Encoder un paramètre contenant des caractères spéciaux</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.encode('a&b=c?d/e')); // 'a%26b%3Dc%3Fd%2Fe'
     *
     * @example <caption>Exemple 2 : Encoder des parenthèses et apostrophes (RFC 3986)</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.encode("l'été (2026)")); // 'l%27%C3%A9t%C3%A9%20%282026%29'
     */
    encode(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return encodeURIComponent(String(value)).replace(
            /[!'()*]/g,
            (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
        );
    }

    /**
     * Décode une chaîne encodée pour l'URL (gère aussi les `'+'` issus des formulaires `application/x-www-form-urlencoded`).
     *
     * @param {string} encodedValue - Chaîne encodée à décoder.
     * @returns {string} Chaîne décodée en clair.
     *
     * @example <caption>Exemple 1 : Décoder un composant d'URL</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.decode('a%26b%3Dc%3Fd%2Fe')); // 'a&b=c?d/e'
     *
     * @example <caption>Exemple 2 : Décoder une chaîne contenant des '+'</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.decode('Bonjour+le+monde')); // 'Bonjour le monde'
     */
    decode(encodedValue) {
        if (typeof encodedValue !== 'string' || encodedValue.length === 0) {
            return '';
        }
        try {
            return decodeURIComponent(encodedValue.replace(/\+/g, '%20'));
        } catch (error) {
            NUtil.log.warn('NUrl.decode: Échec du décodage URI', { error, encodedValue });
            return encodedValue;
        }
    }

    /**
     * Encode une chaîne de texte en Base64URL (RFC 4648 §5 : remplace `'+'` par `'-'`, `'/'` par `'_'`
     * et supprime le remplissage `'='`) afin qu'elle puisse être passée directement dans un chemin
     * ou paramètre d'URL sans caractères spéciaux.
     *
     * @param {string|number} text - Texte ou valeur à encoder en Base64URL.
     * @returns {string} Jeton Base64URL sûr pour les URLs.
     *
     * @example <caption>Exemple 1 : Encoder un texte ou JSON pour une URL</caption>
     * const urlUtil = new NUrl();
     * const token = urlUtil.encodeBase64Url('user:42|role:admin');
     * console.log(token); // 'dXNlcjo0Mnxyb2xlOmFkbWlu'
     *
     * @example <caption>Exemple 2 : Décoder ensuite avec decodeBase64Url</caption>
     * const urlUtil = new NUrl();
     * const token = urlUtil.encodeBase64Url('https://nlib.dev/?a=1&b=2');
     * console.log(urlUtil.decodeBase64Url(token)); // 'https://nlib.dev/?a=1&b=2'
     */
    encodeBase64Url(text) {
        if (text === null || text === undefined || text === '') {
            return '';
        }
        const bytes = new TextEncoder().encode(String(text));
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Décode une chaîne Base64URL (RFC 4648 §5) en texte UTF-8 clair.
     *
     * @param {string} base64Url - Jeton Base64URL à décoder.
     * @returns {string} Texte décodé, ou `''` si le jeton est invalide.
     *
     * @example <caption>Exemple 1 : Décoder un jeton Base64URL</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.decodeBase64Url('dXNlcjo0Mnxyb2xlOmFkbWlu')); // 'user:42|role:admin'
     *
     * @example <caption>Exemple 2 : Jeton invalide retourne une chaîne vide</caption>
     * const urlUtil = new NUrl();
     * console.log(urlUtil.decodeBase64Url('***invalide***')); // ''
     */
    decodeBase64Url(base64Url) {
        if (typeof base64Url !== 'string' || base64Url.trim().length === 0) {
            return '';
        }
        try {
            let b64 = base64Url.trim().replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4 !== 0) {
                b64 += '=';
            }
            const binary = atob(b64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return new TextDecoder().decode(bytes);
        } catch (error) {
            NUtil.log.warn('NUrl.decodeBase64Url: Format Base64URL invalide', { error, base64Url });
            return '';
        }
    }

    /**
     * Masque / obfusque un identifiant de table (ex: `1`, `42`, `'cmd_99'`) ou un texte court
     * sous forme de jeton alphanumérique Base64URL signé et mélangé par une clé (`salt`),
     * afin que les IDs séquentiels de base de données ne soient pas visibles ni devinables dans les URLs.
     *
     * @param {number|string} idOrValue - Identifiant de table (ex: `42`) ou texte à masquer.
     * @param {string} [salt='nlib-url-key'] - Clé secrète de mélange (doit être la même au décodage).
     * @returns {string} Jeton obfusqué sûr pour les URLs (sans `'+'`, `'/'` ni `'='`), ou `''` si invalide.
     *
     * @example <caption>Exemple 1 : Masquer un ID de table SQLite/SQL pour une route URL</caption>
     * const urlUtil = new NUrl();
     * const maskedId = urlUtil.encodeId(42, 'mon-secret');
     * console.log(maskedId); // ex: 'E1x9fG0=' -> 'E1x9fG0' (aucun chiffre '42' visible)
     *
     * @example <caption>Exemple 2 : Masquer une clé composite</caption>
     * const urlUtil = new NUrl();
     * const token = urlUtil.encodeId('facture:2026:105', 'mon-secret');
     * console.log(urlUtil.decodeId(token, 'mon-secret')); // 'facture:2026:105'
     */
    encodeId(idOrValue, salt = 'nlib-url-key') {
        if (idOrValue === null || idOrValue === undefined || idOrValue === '') {
            return '';
        }
        const rawStr = String(idOrValue);
        const keyStr = typeof salt === 'string' && salt.length > 0 ? salt : 'nlib-url-key';
        const keyBytes = new TextEncoder().encode(keyStr);

        // Calcul d'une somme de contrôle 16-bit (checksum) liée au sel et à la valeur
        let checksum = 0x5a3c;
        for (let i = 0; i < keyBytes.length; i++) {
            checksum = ((checksum << 5) - checksum + keyBytes[i]) & 0xffff;
        }
        const payloadBytes = new TextEncoder().encode(rawStr);
        for (let i = 0; i < payloadBytes.length; i++) {
            checksum = ((checksum << 5) - checksum + payloadBytes[i]) & 0xffff;
        }

        // Construction : [checksumHigh, checksumLow, ...payloadBytes]
        const combined = new Uint8Array(2 + payloadBytes.length);
        combined[0] = (checksum >>> 8) & 0xff;
        combined[1] = checksum & 0xff;
        combined.set(payloadBytes, 2);

        // Mélange XOR déterministe avec les octets de la clé et la position
        for (let i = 0; i < combined.length; i++) {
            const k = keyBytes[i % keyBytes.length] ^ ((i * 31 + 17) & 0xff);
            combined[i] = combined[i] ^ k;
        }

        let binary = '';
        for (let i = 0; i < combined.length; i++) {
            binary += String.fromCharCode(combined[i]);
        }
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Décode et vérifie l'intégrité d'un identifiant ou texte préalablement obfusqué avec `encodeId()`.
     * Si le jeton a été altéré dans l'URL ou si le `salt` ne correspond pas, retourne `null`.
     *
     * @param {string} token - Jeton obfusqué extrait de l'URL.
     * @param {string} [salt='nlib-url-key'] - Clé secrète utilisée lors de l'appel à `encodeId()`.
     * @param {boolean} [asNumber=false] - Si `true`, convertit le résultat en `number` s'il est numérique.
     * @returns {string|number|null} Valeur originale décodée, ou `null` si le jeton est invalide/falsifié.
     *
     * @example <caption>Exemple 1 : Décoder un ID numérique en nombre</caption>
     * const urlUtil = new NUrl();
     * const token = urlUtil.encodeId(42, 'mon-secret');
     * console.log(urlUtil.decodeId(token, 'mon-secret', true)); // 42
     *
     * @example <caption>Exemple 2 : Jeton modifié ou mauvais secret retourne null</caption>
     * const urlUtil = new NUrl();
     * const token = urlUtil.encodeId(42, 'mon-secret');
     * console.log(urlUtil.decodeId(token, 'autre-secret')); // null
     */
    decodeId(token, salt = 'nlib-url-key', asNumber = false) {
        if (typeof token !== 'string' || token.trim().length === 0) {
            return null;
        }
        try {
            let b64 = token.trim().replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4 !== 0) {
                b64 += '=';
            }
            const binary = atob(b64);
            if (binary.length < 3) {
                return null;
            }

            const combined = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                combined[i] = binary.charCodeAt(i);
            }

            const keyStr = typeof salt === 'string' && salt.length > 0 ? salt : 'nlib-url-key';
            const keyBytes = new TextEncoder().encode(keyStr);

            // Inversion du mélange XOR
            for (let i = 0; i < combined.length; i++) {
                const k = keyBytes[i % keyBytes.length] ^ ((i * 31 + 17) & 0xff);
                combined[i] = combined[i] ^ k;
            }

            const extractedChecksum = (combined[0] << 8) | combined[1];
            const payloadBytes = combined.slice(2);

            // Vérification de la somme de contrôle (intégrité)
            let expectedChecksum = 0x5a3c;
            for (let i = 0; i < keyBytes.length; i++) {
                expectedChecksum = ((expectedChecksum << 5) - expectedChecksum + keyBytes[i]) & 0xffff;
            }
            for (let i = 0; i < payloadBytes.length; i++) {
                expectedChecksum = ((expectedChecksum << 5) - expectedChecksum + payloadBytes[i]) & 0xffff;
            }

            if (extractedChecksum !== expectedChecksum) {
                return null;
            }

            const decodedStr = new TextDecoder().decode(payloadBytes);
            if (asNumber) {
                const num = Number(decodedStr);
                return Number.isFinite(num) ? num : null;
            }
            return decodedStr;
        } catch (error) {
            NUtil.log.warn('NUrl.unmaskId: Échec du démasquage ou format invalide', { error, token });
            return null;
        }
    }
}

export default NUrl;

