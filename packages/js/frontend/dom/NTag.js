/**
 * @file NTag.js
 * @package @nlib/js-frontend
 * @description Classe de base universelle pour toutes les balises HTML/DOM créées en JavaScript dans NLib.
 * Hérite de `NObject` pour bénéficier de la gestion d'état (`#state`), du bus d'événements unifié (`on`, `once`, `off`, `emit`, `waitFor`)
 * relié au DOM natif, et du cycle de vie (`destroy()`).
 */

import { NObject } from '../../backend/core/NObject.js';

/**
 * @class NTag
 * @extends NObject
 * @description Représente une balise DOM générique manipulable de façon fluide en JavaScript pur.
 * Sert de classe mère à l'ensemble des composants et balises de `@nlib/js-frontend`.
 *
 * @example <caption>Exemple 1 : Créer une balise div avec classes, style et contenu</caption>
 * const box = new NTag({
 *     tagName: 'div',
 *     id: 'card-1',
 *     classes: ['card', 'shadow'],
 *     style: { padding: '16px', backgroundColor: '#fff' },
 *     text: 'Bonjour NLib'
 * });
 * box.mount(document.body);
 *
 * @example <caption>Exemple 2 : Créer une sous-classe spécialisée</caption>
 * class NButton extends NTag {
 *     constructor(options = {}) {
 *         super({ ...options, tagName: 'button' });
 *     }
 * }
 * const btn = new NButton({ text: 'Valider', attrs: { type: 'submit' } });
 */
export class NTag extends NObject {

    // =========================================================================
    // Propriétés privées
    // =========================================================================

    /**
     * Nom de la balise HTML (en minuscules).
     * @type {string}
     * @private
     */
    #tagName = 'div';

    /**
     * Nœud DOM sous-jacent géré par cette instance (porte `_ntag` pointant vers `this`).
     * @type {Element|null}
     * @private
     */
    #element = null;

    /**
     * Ponts d'écouteurs DOM attachés sur `#element` par nom d'événement pour nettoyage dans `off()` / `destroy()`.
     * Reste à `null` tant qu'aucun écouteur n'est enregistré.
     * @type {Map<string, Function>|null}
     * @private
     */
    #domBridge = null;

    /**
     * Observateur de redimensionnement créé paresseusement lors d'un abonnement à `'resize'`.
     * @type {ResizeObserver|null}
     * @private
     */
    #resizeObserver = null;

    /**
     * État et écouteurs internes du geste `'longclick'` créés paresseusement.
     * @type {{ timer: any, onDown: Function, onCancel: Function }|null}
     * @private
     */
    #longClickState = null;

    /**
     * Délai en millisecondes avant déclenchement de `'longclick'`.
     * @type {number}
     * @private
     */
    #longClickDelay = 500;

    /**
     * Observateur de mutations DOM créé paresseusement pour `'mount'` / `'unmount'`.
     * @type {MutationObserver|null}
     * @private
     */
    #mountObserver = null;

    /**
     * Dernier état connu de rattachement au document (`element.isConnected`).
     * @type {boolean}
     * @private
     */
    #lastConnected = false;

    // =========================================================================
    // Constructeur
    // =========================================================================

    /**
     * Crée une nouvelle instance de `NTag` et initialise son élément DOM si `document` est disponible.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou nom de balise HTML.
     * @param {string} [options.tagName='div'] - Nom de la balise HTML à créer.
     * @param {Element|null} [options.element] - Élément DOM existant à encapsuler.
     * @param {string} [options.id] - Identifiant DOM (`id`).
     * @param {string|string[]} [options.classes] - Classe(s) CSS initiale(s).
     * @param {string} [options.className] - Chaîne de classes CSS initiale.
     * @param {Object<string, any>} [options.attrs] - Attributs HTML initiaux.
     * @param {Object<string, any>} [options.data] - Attributs `data-*` initiaux.
     * @param {Object<string, string>} [options.style] - Styles CSS en ligne initiaux.
     * @param {string} [options.text] - Contenu textuel initial (`textContent`).
     * @param {string} [options.html] - Contenu HTML initial (`innerHTML`).
     * @param {Array<NTag|Node|string>} [options.children] - Enfants initiaux à ajouter.
     * @param {Object<string, Function>} [options.events] - Écouteurs d'événements initiaux.
     * @param {Object<string, any>} [options.state] - État initial transmis à `NObject`.
     *
     * @example <caption>Exemple 1 : Instanciation par objet de configuration</caption>
     * const p = new NTag({ tagName: 'p', text: 'Paragraphe', classes: ['lead'] });
     *
     * @example <caption>Exemple 2 : Instanciation rapide par nom de balise</caption>
     * const span = new NTag('span').setText('Badge');
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { tagName: options }
            : (options && typeof options === 'object' ? options : {});

        super({ state: opts.state });

        if (opts.element && typeof opts.element === 'object' && opts.element.tagName) {
            this.#element = opts.element;
            this.#tagName = String(opts.element.tagName).toLowerCase();
        } else {
            const rawTag = typeof opts.tagName === 'string' && opts.tagName.trim()
                ? opts.tagName.trim().toLowerCase()
                : 'div';
            this.#tagName = rawTag;
            if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
                this.#element = document.createElement(this.#tagName);
            }
        }

        if (this.#element) {
            Object.defineProperty(this.#element, '_ntag', {
                value: this,
                configurable: true,
                writable: true
            });
            this.#lastConnected = Boolean(this.#element.isConnected);
        }

        if (typeof opts.longClickDelay === 'number' && opts.longClickDelay > 0) {
            this.#longClickDelay = Math.trunc(opts.longClickDelay);
        }
        if (typeof opts.id === 'string' && opts.id.trim()) {
            this.id = opts.id.trim();
        }
        if (opts.className) {
            this.addClass(opts.className);
        }
        if (opts.classes) {
            if (Array.isArray(opts.classes)) {
                this.addClass(...opts.classes);
            } else {
                this.addClass(opts.classes);
            }
        }
        if (opts.attrs && typeof opts.attrs === 'object') {
            this.setAttrs(opts.attrs);
        }
        if (opts.data && typeof opts.data === 'object') {
            for (const [k, v] of Object.entries(opts.data)) {
                this.setData(k, v);
            }
        }
        if (opts.style && typeof opts.style === 'object') {
            this.setStyle(opts.style);
        }
        if (opts.text !== undefined) {
            this.setText(opts.text);
        } else if (opts.html !== undefined) {
            this.setHtml(opts.html);
        }
        if (Array.isArray(opts.children) && opts.children.length > 0) {
            this.append(...opts.children);
        }
        if (opts.events && typeof opts.events === 'object') {
            for (const [eventName, handler] of Object.entries(opts.events)) {
                if (typeof handler === 'function') {
                    this.on(eventName, handler);
                }
            }
        }
    }

    // =========================================================================
    // Getters & Setters
    // =========================================================================

    /**
     * Retourne le nom de la balise HTML en minuscules.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire le nom de balise</caption>
     * const tag = new NTag('section');
     * console.log(tag.tagName); // 'section'
     *
     * @example <caption>Exemple 2 : Balise par défaut</caption>
     * console.log(new NTag().tagName); // 'div'
     */
    get tagName() {
        return this.#tagName;
    }

    /**
     * Retourne le nœud DOM sous-jacent (`Element` ou `null`).
     * @returns {Element|null}
     *
     * @example <caption>Exemple 1 : Accéder au nœud DOM natif</caption>
     * const tag = new NTag('div');
     * console.log(tag.element?.nodeName); // 'DIV'
     *
     * @example <caption>Exemple 2 : Insérer dans un conteneur natif</caption>
     * document.body.appendChild(tag.element);
     */
    get element() {
        return this.#element;
    }

    /**
     * Alias court de `element`.
     * @returns {Element|null}
     *
     * @example <caption>Exemple 1 : Accès rapide via el</caption>
     * const tag = new NTag('span');
     * console.log(tag.el === tag.element); // true
     *
     * @example <caption>Exemple 2 : Lecture d'une propriété DOM</caption>
     * console.log(tag.el?.tagName); // 'SPAN'
     */
    get el() {
        return this.#element;
    }

    /**
     * Retourne l'instance `NTag` parente résolue depuis `#element.parentElement._ntag`, ou `null`.
     * @returns {NTag|null}
     *
     * @example <caption>Exemple 1 : Vérifier le parent après append()</caption>
     * const parent = new NTag('ul');
     * const child = new NTag('li');
     * parent.append(child);
     * console.log(child.parent === parent); // true
     *
     * @example <caption>Exemple 2 : Balise racine sans parent</caption>
     * console.log(new NTag().parent); // null
     */
    get parent() {
        return this.#element?.parentElement?._ntag ?? null;
    }

    /**
     * Retourne les instances `NTag` enfants directes résolues depuis `#element.children`.
     * @returns {NTag[]}
     *
     * @example <caption>Exemple 1 : Compter les enfants</caption>
     * const list = new NTag('ul').append(new NTag('li'), new NTag('li'));
     * console.log(list.children.length); // 2
     *
     * @example <caption>Exemple 2 : Parcourir les enfants</caption>
     * list.children.forEach((c) => console.log(c.tagName));
     */
    get children() {
        if (!this.#element || !this.#element.children) {
            return [];
        }
        const list = [];
        for (const el of this.#element.children) {
            if (el && el._ntag) {
                list.push(el._ntag);
            }
        }
        return list;
    }

    /**
     * Retourne l'attribut `id` de la balise.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire l'identifiant</caption>
     * const box = new NTag({ id: 'header' });
     * console.log(box.id); // 'header'
     *
     * @example <caption>Exemple 2 : Balise sans id</caption>
     * console.log(new NTag().id); // ''
     */
    get id() {
        return this.#element?.id || '';
    }

    /**
     * Définit l'attribut `id` de la balise.
     * @param {string} value - Nouvel identifiant.
     *
     * @example <caption>Exemple 1 : Définir l'id</caption>
     * const box = new NTag();
     * box.id = 'main-panel';
     *
     * @example <caption>Exemple 2 : Modifier l'id dynamiquement</caption>
     * box.id = 'panel-2';
     */
    set id(value) {
        if (this.#element && typeof value === 'string') {
            this.#element.id = value.trim();
        }
    }

    /**
     * Retourne le contenu textuel (`textContent`) de la balise.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire le texte</caption>
     * const p = new NTag({ tagName: 'p', text: 'Salut' });
     * console.log(p.text); // 'Salut'
     *
     * @example <caption>Exemple 2 : Texte vide par défaut</caption>
     * console.log(new NTag('p').text); // ''
     */
    get text() {
        return this.#element?.textContent ?? '';
    }

    /**
     * Définit le contenu textuel (`textContent`) de la balise.
     * @param {string} value - Texte à afficher.
     *
     * @example <caption>Exemple 1 : Définir le texte via setter</caption>
     * const p = new NTag('p');
     * p.text = 'Nouveau contenu';
     *
     * @example <caption>Exemple 2 : Effacer le texte</caption>
     * p.text = '';
     */
    set text(value) {
        this.setText(value);
    }

    /**
     * Retourne le contenu HTML interne (`innerHTML`) de la balise.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire le HTML interne</caption>
     * const div = new NTag({ html: '<b>Gras</b>' });
     * console.log(div.html); // '<b>Gras</b>'
     *
     * @example <caption>Exemple 2 : Balise vide</caption>
     * console.log(new NTag().html); // ''
     */
    get html() {
        return this.#element?.innerHTML ?? '';
    }

    /**
     * Définit le contenu HTML interne (`innerHTML`) de la balise.
     * @param {string} value - Chaîne HTML.
     *
     * @example <caption>Exemple 1 : Injecter du HTML</caption>
     * const div = new NTag();
     * div.html = '<span>Texte</span>';
     *
     * @example <caption>Exemple 2 : Vider le HTML</caption>
     * div.html = '';
     */
    set html(value) {
        this.setHtml(value);
    }

    // =========================================================================
    // Attributs & Dataset
    // =========================================================================

    /**
     * Définit un attribut HTML (ou le supprime si `value` est `null` ou `false`).
     *
     * @param {string} name - Nom de l'attribut.
     * @param {string|number|boolean|null} value - Valeur de l'attribut.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir un attribut textuel</caption>
     * const input = new NTag('input').setAttr('type', 'email').setAttr('placeholder', 'Email');
     *
     * @example <caption>Exemple 2 : Gérer un attribut booléen</caption>
     * input.setAttr('disabled', true);
     * input.setAttr('disabled', false); // Supprime l'attribut
     */
    setAttr(name, value) {
        if (!this.#element || typeof name !== 'string' || !name.trim()) {
            return this;
        }
        const attrName = name.trim();
        if (value === null || value === undefined || value === false) {
            this.#element.removeAttribute(attrName);
        } else if (value === true) {
            this.#element.setAttribute(attrName, '');
        } else {
            this.#element.setAttribute(attrName, String(value));
        }
        return this;
    }

    /**
     * Définit plusieurs attributs HTML à partir d'un objet clé-valeur.
     *
     * @param {Object<string, any>} [attrs={}] - Dictionnaire d'attributs.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Appliquer plusieurs attributs sur un lien</caption>
     * const link = new NTag('a').setAttrs({ href: 'https://nlib.dev', target: '_blank', rel: 'noopener' });
     *
     * @example <caption>Exemple 2 : Attributs d'accessibilité ARIA</caption>
     * new NTag('button').setAttrs({ 'aria-label': 'Fermer', role: 'button' });
     */
    setAttrs(attrs = {}) {
        if (!attrs || typeof attrs !== 'object') {
            return this;
        }
        for (const [k, v] of Object.entries(attrs)) {
            this.setAttr(k, v);
        }
        return this;
    }

    /**
     * Retourne la valeur d'un attribut HTML, ou `null` s'il est absent.
     *
     * @param {string} name - Nom de l'attribut.
     * @returns {string|null}
     *
     * @example <caption>Exemple 1 : Lire un attribut existant</caption>
     * const a = new NTag({ tagName: 'a', attrs: { href: '/accueil' } });
     * console.log(a.getAttr('href')); // '/accueil'
     *
     * @example <caption>Exemple 2 : Attribut absent</caption>
     * console.log(a.getAttr('target')); // null
     */
    getAttr(name) {
        if (!this.#element || typeof name !== 'string' || !name.trim()) {
            return null;
        }
        return this.#element.getAttribute(name.trim());
    }

    /**
     * Vérifie si un attribut HTML est présent sur la balise.
     *
     * @param {string} name - Nom de l'attribut.
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Vérifier disabled</caption>
     * const btn = new NTag('button').setAttr('disabled', true);
     * console.log(btn.hasAttr('disabled')); // true
     *
     * @example <caption>Exemple 2 : Vérifier un attribut absent</caption>
     * console.log(btn.hasAttr('hidden')); // false
     */
    hasAttr(name) {
        if (!this.#element || typeof name !== 'string' || !name.trim()) {
            return false;
        }
        return this.#element.hasAttribute(name.trim());
    }

    /**
     * Supprime un attribut HTML de la balise.
     *
     * @param {string} name - Nom de l'attribut à retirer.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Retirer disabled</caption>
     * btn.removeAttr('disabled');
     *
     * @example <caption>Exemple 2 : Retrait chaîné</caption>
     * btn.removeAttr('title').removeAttr('aria-hidden');
     */
    removeAttr(name) {
        if (this.#element && typeof name === 'string' && name.trim()) {
            this.#element.removeAttribute(name.trim());
        }
        return this;
    }

    /**
     * Définit un attribut `data-*` via `dataset`.
     *
     * @param {string} key - Clé camelCase du dataset (ex: `'userId'` -> `data-user-id`).
     * @param {string|number|boolean|null} value - Valeur associée (`null`/`undefined` supprime l'entrée).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Stocker un identifiant métier</caption>
     * const row = new NTag('tr').setData('rowId', 42);
     *
     * @example <caption>Exemple 2 : Supprimer une entrée dataset</caption>
     * row.setData('rowId', null);
     */
    setData(key, value) {
        if (!this.#element || !this.#element.dataset || typeof key !== 'string' || !key.trim()) {
            return this;
        }
        const k = key.trim();
        if (value === null || value === undefined) {
            delete this.#element.dataset[k];
        } else {
            this.#element.dataset[k] = String(value);
        }
        return this;
    }

    /**
     * Lit une valeur depuis `dataset`.
     *
     * @param {string} key - Clé camelCase du dataset.
     * @returns {string|undefined}
     *
     * @example <caption>Exemple 1 : Lire data-row-id</caption>
     * const row = new NTag('tr').setData('rowId', '42');
     * console.log(row.getData('rowId')); // '42'
     *
     * @example <caption>Exemple 2 : Clé absente</caption>
     * console.log(row.getData('inconnue')); // undefined
     */
    getData(key) {
        if (!this.#element || !this.#element.dataset || typeof key !== 'string' || !key.trim()) {
            return undefined;
        }
        return this.#element.dataset[key.trim()];
    }

    // =========================================================================
    // Classes CSS & Styles en ligne
    // =========================================================================

    /**
     * Ajoute une ou plusieurs classes CSS à la balise (accepte aussi les chaînes séparées par des espaces).
     *
     * @param {...string} names - Noms de classes CSS.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter plusieurs classes</caption>
     * const card = new NTag().addClass('card', 'card-primary');
     *
     * @example <caption>Exemple 2 : Ajouter via une chaîne séparée par des espaces</caption>
     * card.addClass('p-4 rounded');
     */
    addClass(...names) {
        if (!this.#element || !this.#element.classList) {
            return this;
        }
        for (const item of names) {
            if (typeof item !== 'string') continue;
            for (const token of item.split(/\s+/).filter(Boolean)) {
                this.#element.classList.add(token);
            }
        }
        return this;
    }

    /**
     * Retire une ou plusieurs classes CSS de la balise.
     *
     * @param {...string} names - Noms de classes CSS à retirer.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Retirer une classe</caption>
     * card.removeClass('hidden');
     *
     * @example <caption>Exemple 2 : Retirer plusieurs classes</caption>
     * card.removeClass('bg-red', 'text-white');
     */
    removeClass(...names) {
        if (!this.#element || !this.#element.classList) {
            return this;
        }
        for (const item of names) {
            if (typeof item !== 'string') continue;
            for (const token of item.split(/\s+/).filter(Boolean)) {
                this.#element.classList.remove(token);
            }
        }
        return this;
    }

    /**
     * Bascule la présence d'une classe CSS sur la balise.
     *
     * @param {string} name - Nom de la classe CSS.
     * @param {boolean} [force] - Si défini, force l'ajout (`true`) ou la suppression (`false`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Basculer la classe active</caption>
     * btn.toggleClass('active');
     *
     * @example <caption>Exemple 2 : Forcer l'état selon une condition</caption>
     * btn.toggleClass('is-loading', isLoading);
     */
    toggleClass(name, force) {
        if (!this.#element || !this.#element.classList || typeof name !== 'string' || !name.trim()) {
            return this;
        }
        if (force === undefined) {
            this.#element.classList.toggle(name.trim());
        } else {
            this.#element.classList.toggle(name.trim(), Boolean(force));
        }
        return this;
    }

    /**
     * Vérifie si la balise possède une classe CSS donnée.
     *
     * @param {string} name - Nom de la classe CSS.
     * @returns {boolean}
     *
     * @example <caption>Exemple 1 : Tester une classe présente</caption>
     * const tag = new NTag({ classes: ['btn'] });
     * console.log(tag.hasClass('btn')); // true
     *
     * @example <caption>Exemple 2 : Tester une classe absente</caption>
     * console.log(tag.hasClass('active')); // false
     */
    hasClass(name) {
        if (!this.#element || !this.#element.classList || typeof name !== 'string' || !name.trim()) {
            return false;
        }
        return this.#element.classList.contains(name.trim());
    }

    /**
     * Applique une ou plusieurs propriétés de style CSS en ligne sur la balise.
     * Accepte un objet `{ propriété: valeur }` ou une paire `(propriété, valeur)`.
     *
     * @param {string|Object<string, string|number>} propOrObj - Nom de propriété CSS ou objet de styles.
     * @param {string|number} [value] - Valeur CSS si le premier argument est un nom de propriété.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Appliquer un objet de styles</caption>
     * box.setStyle({ display: 'flex', gap: '8px', backgroundColor: '#f5f5f5' });
     *
     * @example <caption>Exemple 2 : Appliquer une propriété unique</caption>
     * box.setStyle('color', '#1a1a1a');
     */
    setStyle(propOrObj, value) {
        if (!this.#element || !this.#element.style) {
            return this;
        }
        if (propOrObj && typeof propOrObj === 'object') {
            for (const [prop, val] of Object.entries(propOrObj)) {
                this.setStyle(prop, val);
            }
            return this;
        }
        if (typeof propOrObj === 'string' && propOrObj.trim()) {
            const prop = propOrObj.trim();
            const valStr = (value === null || value === undefined) ? '' : String(value);
            if (prop.includes('-')) {
                this.#element.style.setProperty(prop, valStr);
            } else {
                this.#element.style[prop] = valStr;
            }
        }
        return this;
    }

    /**
     * Lit la valeur d'une propriété de style en ligne sur la balise.
     *
     * @param {string} prop - Nom de la propriété CSS.
     * @returns {string}
     *
     * @example <caption>Exemple 1 : Lire une propriété en camelCase</caption>
     * box.setStyle('color', 'red');
     * console.log(box.getStyle('color')); // 'red'
     *
     * @example <caption>Exemple 2 : Lire une propriété CSS personnalisée</caption>
     * box.setStyle('--accent', '#0066ff');
     * console.log(box.getStyle('--accent')); // '#0066ff'
     */
    getStyle(prop) {
        if (!this.#element || !this.#element.style || typeof prop !== 'string' || !prop.trim()) {
            return '';
        }
        const p = prop.trim();
        return p.includes('-')
            ? this.#element.style.getPropertyValue(p)
            : (this.#element.style[p] || '');
    }

    // =========================================================================
    // Contenu & Visibilité
    // =========================================================================

    /**
     * Définit le contenu textuel (`textContent`) de la balise.
     *
     * @param {string|number} text - Texte à afficher.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir un texte</caption>
     * const title = new NTag('h1').setText('Bienvenue');
     *
     * @example <caption>Exemple 2 : Mettre à jour un compteur</caption>
     * title.setText(42);
     */
    setText(text) {
        if (this.#element) {
            this.#element.textContent = (text === null || text === undefined) ? '' : String(text);
        }
        return this;
    }

    /**
     * Définit le contenu HTML (`innerHTML`) de la balise.
     *
     * @param {string} html - Chaîne HTML.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Définir du HTML</caption>
     * const box = new NTag().setHtml('<strong>Important</strong>');
     *
     * @example <caption>Exemple 2 : Vider le contenu HTML</caption>
     * box.setHtml('');
     */
    setHtml(html) {
        if (this.#element) {
            this.#element.innerHTML = (html === null || html === undefined) ? '' : String(html);
        }
        return this;
    }

    /**
     * Affiche la balise en restaurant sa propriété `display`.
     *
     * @param {string} [display=''] - Valeur CSS `display` optionnelle (`'block'`, `'flex'`, etc.).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Réafficher une balise masquée</caption>
     * panel.show();
     *
     * @example <caption>Exemple 2 : Afficher en mode flex</caption>
     * panel.show('flex');
     */
    show(display = '') {
        return this.setStyle('display', display);
    }

    /**
     * Masque la balise via `display: none`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Masquer un panneau</caption>
     * panel.hide();
     *
     * @example <caption>Exemple 2 : Masquage conditionnel</caption>
     * if (!visible) panel.hide();
     */
    hide() {
        return this.setStyle('display', 'none');
    }

    /**
     * Indique si la balise est visible (propriété CSS `display` différente de `'none'`).
     *
     * @returns {boolean} `true` si affichée, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier après hide() et show()</caption>
     * panel.hide();
     * console.log(panel.isShow()); // false
     * panel.show();
     * console.log(panel.isShow()); // true
     *
     * @example <caption>Exemple 2 : Basculer l'affichage</caption>
     * if (panel.isShow()) panel.hide(); else panel.show();
     */
    isShow() {
        if (!this.#element) {
            return false;
        }
        if (this.#element.style?.display === 'none') {
            return false;
        }
        if (
            this.#element.isConnected &&
            typeof globalThis !== 'undefined' &&
            typeof globalThis.getComputedStyle === 'function'
        ) {
            return globalThis.getComputedStyle(this.#element).display !== 'none';
        }
        return true;
    }

    /**
     * Indique si l'élément DOM de la balise est actuellement rattaché au document (`element.isConnected`).
     *
     * @returns {boolean} `true` si rattaché au DOM, sinon `false`.
     *
     * @example <caption>Exemple 1 : Vérifier avant et après mount()</caption>
     * const box = new NTag('div');
     * console.log(box.isConnected()); // false
     * box.mount(document.body);
     * console.log(box.isConnected()); // true
     *
     * @example <caption>Exemple 2 : Vérifier après unmount()</caption>
     * box.unmount();
     * console.log(box.isConnected()); // false
     */
    isConnected() {
        return Boolean(this.#element?.isConnected);
    }

    /**
     * Donne le focus clavier à l'élément DOM si supporté.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Donner le focus à un champ</caption>
     * input.focus();
     *
     * @example <caption>Exemple 2 : Chaînage après montage</caption>
     * input.mount(form).focus();
     */
    focus() {
        if (this.#element && typeof this.#element.focus === 'function') {
            this.#element.focus();
        }
        return this;
    }

    /**
     * Retire le focus clavier de l'élément DOM si supporté.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Retirer le focus</caption>
     * input.blur();
     *
     * @example <caption>Exemple 2 : Chaînage</caption>
     * input.blur().removeClass('focused');
     */
    blur() {
        if (this.#element && typeof this.#element.blur === 'function') {
            this.#element.blur();
        }
        return this;
    }

    /**
     * Fait défiler la zone visible jusqu'à l'élément DOM avec les options fournies.
     *
     * @param {boolean|ScrollIntoViewOptions} [options={ behavior: 'smooth', block: 'nearest', inline: 'nearest' }] - Options de défilement.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Défilement fluide par défaut</caption>
     * section.scrollIntoView();
     *
     * @example <caption>Exemple 2 : Défilement centré instantané</caption>
     * section.scrollIntoView({ behavior: 'auto', block: 'center' });
     */
    scrollIntoView(options = { behavior: 'smooth', block: 'nearest', inline: 'nearest' }) {
        if (this.#element && typeof this.#element.scrollIntoView === 'function') {
            this.#element.scrollIntoView(options);
        }
        return this;
    }

    /**
     * Planifie l'exécution d'un rappel à la prochaine image d'animation via `requestAnimationFrame`
     * si disponible, ou via `setTimeout(..., 16)` en repli.
     *
     * @param {Function} callback - Fonction appelée avec `(timestamp, tag)`.
     * @returns {number|any|null} Identifiant du frame/timer, ou `null` si invalide/détruit.
     *
     * @example <caption>Exemple 1 : Mettre à jour un style au prochain rafraîchissement</caption>
     * box.requestAnimationFrame((ts, tag) => {
     *     tag.addClass('visible');
     * });
     *
     * @example <caption>Exemple 2 : Mesurer les dimensions après rendu</caption>
     * box.requestAnimationFrame(() => console.log(box.getBounds()));
     */
    requestAnimationFrame(callback) {
        if (this.isDestroyed || typeof callback !== 'function') {
            return null;
        }
        const run = (ts) => {
            if (!this.isDestroyed) {
                callback.call(this, ts, this);
            }
        };
        if (typeof globalThis !== 'undefined' && typeof globalThis.requestAnimationFrame === 'function') {
            return globalThis.requestAnimationFrame(run);
        }
        return setTimeout(() => run(Date.now()), 16);
    }

    // =========================================================================
    // Arborescence DOM & Montage
    // =========================================================================

    /**
     * Retourne l'index de cette balise parmi les éléments enfants de son parent DOM, ou `-1` si sans parent.
     *
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la position d'un enfant dans une liste</caption>
     * const ul = new NTag('ul').append(new NTag('li'), new NTag('li'));
     * console.log(ul.children[1].getIndex()); // 1
     *
     * @example <caption>Exemple 2 : Balise sans parent</caption>
     * console.log(new NTag('div').getIndex()); // -1
     */
    getIndex() {
        const parentEl = this.#element?.parentElement;
        if (!parentEl || !parentEl.children) {
            return -1;
        }
        return Array.prototype.indexOf.call(parentEl.children, this.#element);
    }

    /**
     * Déplace cette balise à un nouvel index parmi les enfants de son parent DOM.
     *
     * @param {number} index - Nouvel index cible (`0`, `1`, ...).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Déplacer un élément en première position</caption>
     * item3.setIndex(0);
     *
     * @example <caption>Exemple 2 : Déplacer vers la fin</caption>
     * item1.setIndex(2);
     */
    setIndex(index) {
        const parentEl = this.#element?.parentElement;
        if (!parentEl || !parentEl.children || typeof index !== 'number' || !Number.isFinite(index)) {
            return this;
        }
        const siblings = Array.from(parentEl.children).filter((el) => el !== this.#element);
        const clamped = Math.max(0, Math.min(Math.trunc(index), siblings.length));
        const refNode = siblings[clamped] || null;
        parentEl.insertBefore(this.#element, refNode);
        return this;
    }

    /**
     * Retourne le nombre d'éléments enfants directs de cette balise.
     *
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Compter les enfants d'une liste</caption>
     * console.log(ul.getChildCount()); // 3
     *
     * @example <caption>Exemple 2 : Balise vide</caption>
     * console.log(new NTag('div').getChildCount()); // 0
     */
    getChildCount() {
        return this.#element?.children?.length ?? 0;
    }

    /**
     * Retourne l'enfant `NTag` situé à l'index donné, ou `null` s'il n'existe pas.
     *
     * @param {number} index - Index de l'enfant recherché.
     * @returns {NTag|null}
     *
     * @example <caption>Exemple 1 : Accéder au premier enfant</caption>
     * const first = ul.getChildAt(0);
     *
     * @example <caption>Exemple 2 : Index hors bornes</caption>
     * console.log(ul.getChildAt(99)); // null
     */
    getChildAt(index) {
        if (!this.#element || !this.#element.children || typeof index !== 'number' || !Number.isFinite(index)) {
            return null;
        }
        const idx = Math.trunc(index);
        if (idx < 0 || idx >= this.#element.children.length) {
            return null;
        }
        return this.#element.children[idx]?._ntag ?? null;
    }

    /**
     * Recherche le premier descendant `NTag` correspondant à un sélecteur CSS (`#id`, `.classe`, etc.).
     *
     * @param {string} selector - Sélecteur CSS (`'#btn-save'`, `'.card'`, `'[data-role="item"]'`).
     * @returns {NTag|null}
     *
     * @example <caption>Exemple 1 : Trouver un enfant par son id</caption>
     * const saveBtn = form.find('#btn-save');
     *
     * @example <caption>Exemple 2 : Trouver un enfant par classe CSS</caption>
     * const activeItem = list.find('.is-active');
     */
    find(selector) {
        if (!this.#element || typeof selector !== 'string' || !selector.trim()) {
            return null;
        }
        return this.#element.querySelector(selector.trim())?._ntag ?? null;
    }

    /**
     * Recherche tous les descendants `NTag` correspondant à un sélecteur CSS (`#id`, `.classe`, etc.).
     *
     * @param {string} selector - Sélecteur CSS.
     * @returns {NTag[]}
     *
     * @example <caption>Exemple 1 : Trouver tous les éléments d'une classe</caption>
     * const cards = container.findAll('.card');
     *
     * @example <caption>Exemple 2 : Trouver toutes les lignes cochées</caption>
     * const items = table.findAll('tr.selected');
     */
    findAll(selector) {
        if (!this.#element || typeof selector !== 'string' || !selector.trim()) {
            return [];
        }
        const list = [];
        for (const el of this.#element.querySelectorAll(selector.trim())) {
            if (el && el._ntag) {
                list.push(el._ntag);
            }
        }
        return list;
    }

    /**
     * Ajoute un ou plusieurs enfants (`NTag`, `Node` DOM ou texte) à une position donnée
     * (index numérique ou balise `NTag` / `Node` de référence avant laquelle insérer).
     *
     * @param {NTag|Node|string|Array<NTag|Node|string>} tags - Enfant ou tableau d'enfants à insérer.
     * @param {number|NTag|Node|null} [position=null] - Index cible (`0`, `1`, ...) ou nœud de référence (`NTag` / `Node`).
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Insérer un ou plusieurs enfants à un index précis</caption>
     * const ul = new NTag('ul').append(new NTag('li').setText('A'), new NTag('li').setText('D'));
     * ul.addTag([new NTag('li').setText('B'), new NTag('li').setText('C')], 1);
     *
     * @example <caption>Exemple 2 : Insérer avant une balise NTag existante</caption>
     * const target = ul.children[1];
     * ul.addTag(new NTag('li').setText('Avant B'), target);
     */
    addTag(tags, position = null) {
        if (!this.#element || tags === null || tags === undefined) {
            return this;
        }

        const list = Array.isArray(tags) ? tags : [tags];
        let refNode = null;

        if (typeof position === 'number' && Number.isFinite(position)) {
            const idx = Math.max(0, Math.trunc(position));
            refNode = this.#element.children[idx] || null;
        } else if (position instanceof NTag) {
            if (position.#element && position.#element.parentNode === this.#element) {
                refNode = position.#element;
            }
        } else if (typeof Node !== 'undefined' && position instanceof Node) {
            if (position.parentNode === this.#element) {
                refNode = position;
            }
        }

        for (const item of list) {
            if (item === null || item === undefined) continue;
            let domNode = null;
            if (item instanceof NTag) {
                domNode = item.#element;
            } else if (typeof Node !== 'undefined' && item instanceof Node) {
                domNode = item;
            } else if (typeof document !== 'undefined' && typeof document.createTextNode === 'function') {
                domNode = document.createTextNode(String(item));
            }
            if (!domNode) continue;

            if (refNode) {
                this.#element.insertBefore(domNode, refNode);
            } else {
                this.#element.appendChild(domNode);
            }
            if (item instanceof NTag) {
                item.#syncSubtreeMountState();
            }
        }
        return this;
    }

    /**
     * Ajoute un ou plusieurs enfants (`NTag`, `Node` DOM ou texte) à la fin de la balise.
     *
     * @param {...(NTag|Node|string)} nodes - Enfants à insérer.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter des balises enfants NTag</caption>
     * const ul = new NTag('ul').append(new NTag({ tagName: 'li', text: 'Item 1' }));
     *
     * @example <caption>Exemple 2 : Mélanger NTag et texte</caption>
     * const p = new NTag('p').append('Total : ', new NTag({ tagName: 'strong', text: '100' }));
     */
    append(...nodes) {
        if (!this.#element) return this;
        for (const node of nodes) {
            if (node === null || node === undefined) continue;
            if (node instanceof NTag) {
                if (node.#element) {
                    this.#element.appendChild(node.#element);
                    node.#syncSubtreeMountState();
                }
            } else if (typeof Node !== 'undefined' && node instanceof Node) {
                this.#element.appendChild(node);
            } else {
                this.#element.append(String(node));
            }
        }
        return this;
    }

    /**
     * Insère un ou plusieurs enfants (`NTag`, `Node` DOM ou texte) au début de la balise.
     *
     * @param {...(NTag|Node|string)} nodes - Enfants à insérer en tête.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Ajouter un élément en tête de liste</caption>
     * list.prepend(new NTag({ tagName: 'li', text: 'Premier' }));
     *
     * @example <caption>Exemple 2 : Insérer du texte en début de paragraphe</caption>
     * p.prepend('Note : ');
     */
    prepend(...nodes) {
        if (!this.#element) return this;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            if (node === null || node === undefined) continue;
            if (node instanceof NTag) {
                if (node.#element) {
                    this.#element.prepend(node.#element);
                    node.#syncSubtreeMountState();
                }
            } else if (typeof Node !== 'undefined' && node instanceof Node) {
                this.#element.prepend(node);
            } else {
                this.#element.prepend(String(node));
            }
        }
        return this;
    }

    /**
     * Retire un enfant (`NTag` ou `Node` DOM) de cette balise.
     *
     * @param {NTag|Node} child - Enfant à retirer.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Retirer une balise enfant</caption>
     * ul.removeChild(li);
     *
     * @example <caption>Exemple 2 : Retirer puis vérifier la liste des enfants</caption>
     * ul.removeChild(li);
     * console.log(ul.children.length);
     */
    removeChild(child) {
        if (!child || !this.#element) return this;
        const targetNode = child instanceof NTag ? child.#element : child;
        if (targetNode && targetNode.parentNode === this.#element) {
            this.#element.removeChild(targetNode);
            if (child instanceof NTag) {
                child.#syncSubtreeMountState();
            }
        }
        return this;
    }

    /**
     * Vide tous les enfants et le contenu de la balise.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Vider une liste</caption>
     * list.empty();
     *
     * @example <caption>Exemple 2 : Vider avant de reremplir</caption>
     * list.empty().append(new NTag('li').setText('Nouveau'));
     */
    empty() {
        const prevChildren = this.children;
        if (this.#element) {
            this.#element.textContent = '';
        }
        for (const child of prevChildren) {
            child.#syncSubtreeMountState();
        }
        return this;
    }

    /**
     * Monte cette balise dans un conteneur cible (`NTag`, `Element` ou sélecteur CSS).
     *
     * @param {NTag|Element|string} target - Conteneur cible.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Monter dans un sélecteur CSS</caption>
     * app.mount('#app');
     *
     * @example <caption>Exemple 2 : Monter dans un autre NTag</caption>
     * child.mount(containerTag);
     */
    mount(target) {
        if (target instanceof NTag) {
            target.append(this);
            return this;
        }
        if (!this.#element) return this;
        let container = null;
        if (typeof target === 'string' && typeof document !== 'undefined') {
            container = document.querySelector(target);
        } else if (target && typeof target.appendChild === 'function') {
            container = target;
        }
        if (container) {
            container.appendChild(this.#element);
            this.#syncSubtreeMountState();
        }
        return this;
    }

    /**
     * Détache cette balise de son parent DOM.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Détacher du DOM</caption>
     * modal.unmount();
     *
     * @example <caption>Exemple 2 : Détacher puis remonter ailleurs</caption>
     * card.unmount().mount('#other-col');
     */
    unmount() {
        if (this.#element && this.#element.parentNode) {
            this.#element.parentNode.removeChild(this.#element);
            this.#syncSubtreeMountState();
        }
        return this;
    }

    /**
     * Retourne le `DOMRect` complet (`getBoundingClientRect()`) de l'élément.
     *
     * @returns {{ x: number, y: number, width: number, height: number, top: number, right: number, bottom: number, left: number }}
     *
     * @example <caption>Exemple 1 : Lire le rectangle englobant complet</caption>
     * const rect = box.getRect();
     * console.log(rect.top, rect.left, rect.width, rect.height);
     *
     * @example <caption>Exemple 2 : Vérifier la largeur depuis le DOMRect</caption>
     * if (box.getRect().width > 300) { console.log('Large'); }
     */
    getRect() {
        if (this.#element && typeof this.#element.getBoundingClientRect === 'function') {
            return this.#element.getBoundingClientRect();
        }
        return { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
    }

    /**
     * Retourne en une seule fois les dimensions et coordonnées `{ x, y, width, height }` de la balise.
     *
     * @returns {{ x: number, y: number, width: number, height: number }}
     *
     * @example <caption>Exemple 1 : Déstructurer position et dimensions</caption>
     * const { x, y, width, height } = box.getBounds();
     *
     * @example <caption>Exemple 2 : Positionner un menu contextuel</caption>
     * const b = trigger.getBounds();
     * menu.setStyle({ left: `${b.x}px`, top: `${b.y + b.height}px` });
     */
    getBounds() {
        const r = this.getRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    }

    /**
     * Retourne la coordonnée horizontale `x` de la balise.
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire x</caption>
     * console.log(box.getX());
     *
     * @example <caption>Exemple 2 : Comparer la position de deux balises</caption>
     * console.log(b.getX() - a.getX());
     */
    getX() {
        return this.getRect().x;
    }

    /**
     * Retourne la coordonnée verticale `y` de la balise.
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire y</caption>
     * console.log(box.getY());
     *
     * @example <caption>Exemple 2 : Calculer un décalage vertical</caption>
     * const offsetY = box.getY() + 10;
     */
    getY() {
        return this.getRect().y;
    }

    /**
     * Retourne la largeur mesurée (`width`) de la balise.
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la largeur</caption>
     * console.log(box.getWidth());
     *
     * @example <caption>Exemple 2 : Adapter un enfant</caption>
     * child.setStyle('width', `${box.getWidth()}px`);
     */
    getWidth() {
        return this.getRect().width;
    }

    /**
     * Retourne la hauteur mesurée (`height`) de la balise.
     * @returns {number}
     *
     * @example <caption>Exemple 1 : Lire la hauteur</caption>
     * console.log(box.getHeight());
     *
     * @example 2 : Aligner deux éléments</caption>
     * target.setStyle('minHeight', `${box.getHeight()}px`);
     */
    getHeight() {
        return this.getRect().height;
    }

    // =========================================================================
    // Événements unifiés (NObject/NEvent + DOM natif)
    // =========================================================================

    /**
     * Enregistre un écouteur sur l'événement donné et attache un pont DOM sur `#element`.
     *
     * @param {string} event - Nom de l'événement (`'click'`, `'input'`, `'stateChange'`, etc.).
     * @param {Function} callback - Fonction appelée lors du déclenchement.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Écouter un clic DOM directement avec on()</caption>
     * btn.on('click', (ev) => console.log('Clic sur', ev.target));
     *
     * @example <caption>Exemple 2 : Écouter un événement personnalisé</caption>
     * btn.on('validated', (data) => console.log(data));
     */
    on(event, callback) {
        super.on(event, callback);
        this.#attachDomBridge(event);
        return this;
    }

    /**
     * Enregistre un écouteur exécuté une seule fois, relié au DOM natif.
     *
     * @param {string} event - Nom de l'événement.
     * @param {Function} callback - Fonction exécutée une seule fois.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Écoute unique sur un clic</caption>
     * btn.once('click', () => console.log('Premier clic'));
     *
     * @example <caption>Exemple 2 : Écoute unique sur un événement applicatif</caption>
     * dialog.once('close', () => console.log('Fermé'));
     */
    once(event, callback) {
        super.once(event, callback);
        this.#attachDomBridge(event);
        return this;
    }

    /**
     * Supprime un ou plusieurs écouteurs et détache le pont DOM lorsque plus aucun écouteur n'est actif.
     *
     * @param {string} [event] - Nom de l'événement (tous si omis).
     * @param {Function} [callback] - Fonction spécifique à retirer.
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Retirer un écouteur de clic</caption>
     * btn.off('click', onClick);
     *
     * @example <caption>Exemple 2 : Retirer tous les écouteurs d'un événement</caption>
     * btn.off('click');
     */
    off(event, callback) {
        super.off(event, callback);
        if (!event) {
            this.#detachAllDomBridges();
        } else if (this.listenerCount(event) === 0) {
            this.#detachDomBridge(event);
        }
        return this;
    }

    /**
     * Attend de manière asynchrone le prochain déclenchement d'un événement (DOM ou applicatif).
     *
     * @param {string} event - Nom de l'événement attendu.
     * @param {number} [timeoutMs=0] - Délai maximal d'attente en millisecondes.
     * @returns {Promise<any>}
     *
     * @example <caption>Exemple 1 : Attendre un clic utilisateur</caption>
     * const ev = await btn.waitFor('click');
     *
     * @example <caption>Exemple 2 : Attendre avec timeout</caption>
     * const ev = await btn.waitFor('click', 1000);
     */
    waitFor(event, timeoutMs = 0) {
        this.#attachDomBridge(event);
        return super.waitFor(event, timeoutMs);
    }

    /**
     * Supprime tous les écouteurs d'événements et détache tous les ponts DOM de `#element`.
     *
     * @returns {this} L'instance courante pour chaînage.
     *
     * @example <caption>Exemple 1 : Nettoyer tous les écouteurs</caption>
     * btn.clearEvents();
     *
     * @example <caption>Exemple 2 : Réinitialiser puis réabonner</caption>
     * btn.clearEvents().on('click', handler);
     */
    clearEvents() {
        super.clearEvents();
        this.#detachAllDomBridges();
        return this;
    }

    // =========================================================================
    // Cycle de vie
    // =========================================================================

    /**
     * Détruit la balise, détache tous les écouteurs DOM, détruit les enfants `NTag`,
     * retire l'élément du DOM et libère les ressources `NObject`.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire une balise et ses enfants</caption>
     * container.destroy();
     * console.log(container.isDestroyed); // true
     *
     * @example <caption>Exemple 2 : Nettoyer avant fermeture</caption>
     * if (!modal.isDestroyed) modal.destroy();
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }

        this.clearEvents();

        for (const child of this.children) {
            child.destroy();
        }

        this.unmount();
        if (this.#element && '_ntag' in this.#element) {
            delete this.#element._ntag;
        }
        this.#element = null;
        super.destroy();
    }

    // =========================================================================
    // Helpers privés
    // =========================================================================

    /**
     * Attache un écouteur DOM unique sur `#element` (ou `ResizeObserver` / geste `longclick`)
     * qui relaie l'événement vers `this.event.emit()`.
     * @private
     */
    #attachDomBridge(eventName) {
        if (!this.#element || typeof eventName !== 'string') return;
        const name = eventName.trim();
        if (!name) return;

        if (name === 'mount' || name === 'unmount') {
            if (
                !this.#mountObserver &&
                typeof MutationObserver === 'function' &&
                typeof document !== 'undefined' &&
                document.documentElement
            ) {
                this.#mountObserver = new MutationObserver(() => {
                    this.#syncMountState();
                });
                this.#mountObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            return;
        }

        if (name === 'resize') {
            if (!this.#resizeObserver && typeof ResizeObserver === 'function') {
                this.#resizeObserver = new ResizeObserver((entries) => {
                    const entry = entries[0] || null;
                    this.event.emit('resize', {
                        entry,
                        rect: this.getRect(),
                        target: this
                    });
                });
                this.#resizeObserver.observe(this.#element);
            }
            return;
        }

        if (name === 'longclick') {
            if (!this.#longClickState) {
                const state = {
                    timer: null,
                    onDown: (ev) => {
                        if (state.timer) clearTimeout(state.timer);
                        state.timer = setTimeout(() => {
                            state.timer = null;
                            this.event.emit('longclick', {
                                originalEvent: ev,
                                target: this
                            });
                        }, this.#longClickDelay);
                    },
                    onCancel: () => {
                        if (state.timer) {
                            clearTimeout(state.timer);
                            state.timer = null;
                        }
                    }
                };
                this.#longClickState = state;
                this.#element.addEventListener('pointerdown', state.onDown);
                this.#element.addEventListener('pointerup', state.onCancel);
                this.#element.addEventListener('pointerleave', state.onCancel);
                this.#element.addEventListener('pointercancel', state.onCancel);
            }
            return;
        }

        if (!this.#domBridge) {
            this.#domBridge = new Map();
        }
        if (this.#domBridge.has(name)) return;

        const bridge = (domEvent) => {
            this.event.emit(name, domEvent);
        };
        this.#domBridge.set(name, bridge);
        this.#element.addEventListener(name, bridge);
    }

    /**
     * Détache le pont DOM (ou `ResizeObserver` / `longclick`) associé à un nom d'événement.
     * @private
     */
    #detachDomBridge(eventName) {
        if (typeof eventName !== 'string') return;
        const name = eventName.trim();

        if (name === 'mount' || name === 'unmount') {
            if (this.#mountObserver && this.listenerCount('mount') === 0 && this.listenerCount('unmount') === 0) {
                this.#mountObserver.disconnect();
                this.#mountObserver = null;
            }
            return;
        }

        if (name === 'resize') {
            if (this.#resizeObserver) {
                this.#resizeObserver.disconnect();
                this.#resizeObserver = null;
            }
            return;
        }

        if (name === 'longclick') {
            if (this.#longClickState) {
                if (this.#longClickState.timer) {
                    clearTimeout(this.#longClickState.timer);
                }
                if (this.#element) {
                    this.#element.removeEventListener('pointerdown', this.#longClickState.onDown);
                    this.#element.removeEventListener('pointerup', this.#longClickState.onCancel);
                    this.#element.removeEventListener('pointerleave', this.#longClickState.onCancel);
                    this.#element.removeEventListener('pointercancel', this.#longClickState.onCancel);
                }
                this.#longClickState = null;
            }
            return;
        }

        if (!this.#domBridge) return;
        const bridge = this.#domBridge.get(name);
        if (bridge && this.#element) {
            this.#element.removeEventListener(name, bridge);
        }
        this.#domBridge.delete(name);
        if (this.#domBridge.size === 0) {
            this.#domBridge = null;
        }
    }

    /**
     * Détache tous les ponts DOM, `ResizeObserver` et `longclick` actifs sur `#element`.
     * @private
     */
    #detachAllDomBridges() {
        if (this.#mountObserver) {
            this.#mountObserver.disconnect();
            this.#mountObserver = null;
        }
        if (this.#resizeObserver) {
            this.#resizeObserver.disconnect();
            this.#resizeObserver = null;
        }
        if (this.#longClickState) {
            this.#detachDomBridge('longclick');
        }
        if (!this.#domBridge) return;
        if (this.#element) {
            for (const [name, bridge] of this.#domBridge.entries()) {
                this.#element.removeEventListener(name, bridge);
            }
        }
        this.#domBridge.clear();
        this.#domBridge = null;
    }

    /**
     * Synchronise l'état `isConnected` et émet `'mount'` ou `'unmount'` lors d'une transition.
     * @private
     */
    #syncMountState() {
        const connected = Boolean(this.#element?.isConnected);
        if (connected === this.#lastConnected) {
            return;
        }
        this.#lastConnected = connected;
        this.emit(connected ? 'mount' : 'unmount', { target: this });
    }

    /**
     * Propage la vérification d'attachement DOM sur cette balise et ses descendants `NTag`.
     * @private
     */
    #syncSubtreeMountState() {
        this.#syncMountState();
        for (const child of this.children) {
            child.#syncSubtreeMountState();
        }
    }
}

export default NTag;
