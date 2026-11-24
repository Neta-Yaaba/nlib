import { NTag } from '../../elements/NTag.js';

/**
 * @class NItem
 * @extends NTag
 * @description Composant d'élément de liste (`.n-item`) gérant l'identifiant métier, les données, les états visuels et la synchronisation de visibilité.
 *
 * @example <caption>Exemple 1 : Créer un élément de liste avec données</caption>
 * const item = new NItem({ primaryKey: 'id', data: { id: 129, name: 'Produit A' } });
 *
 * @example <caption>Exemple 2 : Mettre à jour partiellement les données</caption>
 * const item = new NItem({ data: { id: 1, title: 'Initial' } });
 * item.updateData({ title: 'Modifié' });
 */
export class NItem extends NTag {

    /**
     * Identifiant métier de l'élément.
     * @type {string|number|null}
     * @private
     */
    #itemId = null;

    /**
     * Clé primaire utilisée pour extraire l'identifiant depuis les données.
     * @type {string}
     * @private
     */
    #primaryKey = 'id';

    /**
     * Données métier associées à l'élément.
     * @type {Object|null}
     * @private
     */
    #itemData = null;

    /**
     * Indique si l'élément participe aux mises à jour automatiques.
     * @type {boolean}
     * @private
     */
    #autoUpdate = false;

    /**
     * Dernier identifiant d'événement traité par l'élément.
     * @type {string|number|null}
     * @private
     */
    #lastEventId = null;

    /**
     * Paramètres de synchronisation associés à l'élément.
     * @type {Object|string|null}
     * @private
     */
    #syncParams = null;

    /**
     * Écouteur de visibilité en attente pour les notifications différées.
     * @type {Function|null}
     * @private
     */
    #pendingVisibilityHandler = null;

    /**
     * Indique si l'application initiale de langue a déjà eu lieu.
     * @type {boolean}
     * @private
     */
    #hasInitializedLanguage = false;

    /**
     * Crée une nouvelle instance `NItem`.
     *
     * @constructor
     * @param {Object|string} [options={}] - Options de configuration ou nom de balise HTML (`'div'`, `'li'`, `'tr'`, etc.).
     * @param {string} [options.tagName='div'] - Balise HTML racine.
     * @param {string|number|null} [options.itemId] - Identifiant métier initial.
     * @param {string} [options.primaryKey='id'] - Nom de la clé primaire dans les données.
     * @param {Object|null} [options.data] - Données métier initiales.
     * @param {boolean} [options.autoUpdate=false] - Active les mises à jour automatiques.
     * @param {boolean} [options.loading=false] - Active l'état de chargement initial.
     * @param {boolean} [options.selected=false] - Marque l'élément comme sélectionné.
     * @param {boolean} [options.disabled=false] - Désactive l'élément.
     * @param {Object|string|null} [options.syncParams] - Paramètres de synchronisation.
     *
     * @example <caption>Exemple 1 : Élément de liste HTML `li`</caption>
     * const li = new NItem({ tagName: 'li', data: { id: 10, label: 'Accueil' } });
     *
     * @example <caption>Exemple 2 : Élément sélectionnable</caption>
     * const card = new NItem({ selected: true, autoUpdate: true });
     */
    constructor(options = {}) {
        const opts = typeof options === 'string'
            ? { tagName: options }
            : (options && typeof options === 'object' ? options : {});

        const {
            tagName = 'div',
            itemId,
            primaryKey = 'id',
            data,
            autoUpdate = false,
            loading = false,
            selected = false,
            disabled = false,
            syncParams = null,
            ...tagOpts
        } = opts;

        super({ ...tagOpts, tagName });

        this.addClass('n-item');
        this.setPrimaryKey(primaryKey);
        this.setAutoUpdate(Boolean(autoUpdate));

        if (syncParams !== null && syncParams !== undefined) {
            this.setSyncParams(syncParams);
        }
        if (itemId !== undefined && itemId !== null) {
            this.setItemId(itemId);
        }
        if (loading) {
            this.setLoading(true);
        }
        if (selected) {
            this.setSelected(true);
        }
        if (disabled) {
            this.setDisabled(true);
        }
        if (data !== undefined) {
            this.setData(data);
        }
    }

    /**
     * Identifiant métier de l'élément.
     * @type {string|number|null}
     *
     * @example <caption>Exemple 1 : Lire l'identifiant métier</caption>
     * console.log(item.itemId);
     *
     * @example <caption>Exemple 2 : Modifier l'identifiant métier</caption>
     * item.itemId = 42;
     */
    get itemId() {
        return this.getItemId();
    }

    set itemId(value) {
        this.setItemId(value);
    }

    /**
     * Clé primaire utilisée pour identifier les données.
     * @type {string}
     *
     * @example <caption>Exemple 1 : Lire la clé primaire</caption>
     * console.log(item.primaryKey);
     *
     * @example <caption>Exemple 2 : Définir la clé primaire</caption>
     * item.primaryKey = 'ID';
     */
    get primaryKey() {
        return this.getPrimaryKey();
    }

    set primaryKey(key) {
        this.setPrimaryKey(key);
    }

    /**
     * Définit l'identifiant métier de l'élément.
     *
     * @param {string|number|null} id - Nouvel identifiant.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir un identifiant numérique</caption>
     * item.setItemId(129);
     *
     * @example <caption>Exemple 2 : Réinitialiser l'identifiant</caption>
     * item.setItemId(null);
     */
    setItemId(id) {
        this.#itemId = (id === undefined || id === null || id === '') ? null : id;
        return this;
    }

    /**
     * Retourne l'identifiant métier de l'élément.
     *
     * @returns {string|number|null} Identifiant métier ou `null`.
     *
     * @example <caption>Exemple 1 : Lire l'identifiant</caption>
     * const id = item.getItemId();
     *
     * @example <caption>Exemple 2 : Vérifier la présence d'un identifiant</caption>
     * if (item.getItemId() !== null) console.log('Identifié');
     */
    getItemId() {
        return this.#itemId;
    }

    /**
     * Définit le nom de la clé primaire utilisée dans les objets de données.
     *
     * @param {string} key - Nom de la clé primaire (ex. `'id'`, `'ID'`, `'uuid'`).
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Utiliser une clé primaire personnalisée</caption>
     * item.setPrimaryKey('uuid');
     *
     * @example <caption>Exemple 2 : Revenir à la clé par défaut</caption>
     * item.setPrimaryKey('id');
     */
    setPrimaryKey(key) {
        if (typeof key === 'string' && key.trim()) {
            this.#primaryKey = key.trim();
        }
        return this;
    }

    /**
     * Retourne le nom de la clé primaire configurée.
     *
     * @returns {string} Nom de la clé primaire.
     *
     * @example <caption>Exemple 1 : Consulter la clé primaire</caption>
     * console.log(item.getPrimaryKey()); // 'id'
     *
     * @example <caption>Exemple 2 : Lire après modification</caption>
     * item.setPrimaryKey('code');
     * console.log(item.getPrimaryKey()); // 'code'
     */
    getPrimaryKey() {
        return this.#primaryKey;
    }

    /**
     * Indique si l'élément peut être mis à jour automatiquement.
     *
     * @param {boolean} [autoUpdate=true] - `true` pour activer la mise à jour automatique.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Activer les mises à jour</caption>
     * item.setAutoUpdate(true);
     *
     * @example <caption>Exemple 2 : Désactiver les mises à jour</caption>
     * item.setAutoUpdate(false);
     */
    setAutoUpdate(autoUpdate = true) {
        this.#autoUpdate = Boolean(autoUpdate);
        return this;
    }

    /**
     * Indique si l'élément est configuré pour se mettre à jour automatiquement.
     *
     * @returns {boolean} `true` si activé.
     *
     * @example <caption>Exemple 1 : Lire l'état</caption>
     * console.log(item.isAutoUpdate());
     *
     * @example <caption>Exemple 2 : Vérifier après activation</caption>
     * item.setAutoUpdate(true);
     * console.log(item.isAutoUpdate()); // true
     */
    isAutoUpdate() {
        return this.#autoUpdate;
    }

    /**
     * Associe les données métier à l'élément (1 argument objet) ou un attribut `data-*` (2 arguments).
     *
     * @param {Object|string|null} dataOrKey - Objet de données métier ou clé `data-*`.
     * @param {*} [value] - Valeur associée à `dataOrKey` lorsqu'il s'agit d'une clé `data-*`.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir les données métier de l'élément</caption>
     * item.setData({ id: 1, title: 'Article' });
     *
     * @example <caption>Exemple 2 : Définir un attribut data-* hérité de NTag</caption>
     * item.setData('index', 3);
     */
    setData(dataOrKey, value = undefined) {
        if (value === undefined && (dataOrKey === null || typeof dataOrKey === 'object')) {
            this.#itemData = dataOrKey ? { ...dataOrKey } : null;
            if (this.#itemData) {
                const extractedId = this.#extractId(this.#itemData);
                if (extractedId !== null) {
                    this.setItemId(extractedId);
                }
            }
            this.displayData(this.#itemData);
            return this;
        }
        return super.setData(dataOrKey, value);
    }

    /**
     * Retourne les données métier de l'élément (sans argument) ou un attribut `data-*` (avec `key`).
     *
     * @param {string} [key] - Clé `data-*` optionnelle.
     * @returns {Object|string|null|undefined} Données métier ou valeur de l'attribut `data-*`.
     *
     * @example <caption>Exemple 1 : Lire les données métier</caption>
     * const data = item.getData();
     *
     * @example <caption>Exemple 2 : Lire un attribut data-*</caption>
     * const idx = item.getData('index');
     */
    getData(key = undefined) {
        if (key === undefined) {
            return this.#itemData;
        }
        return super.getData(key);
    }

    /**
     * Fusionne de nouvelles propriétés dans les données existantes puis rafraîchit l'affichage.
     *
     * @param {Object} partial - Propriétés à fusionner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Mettre à jour un champ</caption>
     * item.updateData({ title: 'Nouveau titre' });
     *
     * @example <caption>Exemple 2 : Mettre à jour plusieurs champs</caption>
     * item.updateData({ price: 25, stock: 12 });
     */
    updateData(partial) {
        if (!partial || typeof partial !== 'object') {
            return this;
        }
        if (!this.#itemData) {
            return this.setData(partial);
        }
        this.#itemData = { ...this.#itemData, ...partial };
        const extractedId = this.#extractId(partial);
        if (extractedId !== null) {
            this.setItemId(extractedId);
        }
        this.displayData(this.#itemData);
        return this;
    }

    /**
     * Charge des données via `fetchData(params)` ou applique directement des données locales, puis appelle `displayData()`.
     *
     * @async
     * @param {Object|Array} [params=null] - Paramètres de chargement ou données locales.
     * @returns {Promise<Object|null>} Données appliquées ou `null`.
     *
     * @example <caption>Exemple 1 : Appliquer des données locales</caption>
     * await item.requestData({ id: 5, name: 'Test' });
     *
     * @example <caption>Exemple 2 : Surcharger fetchData pour charger depuis une API</caption>
     * class UserItem extends NItem {
     *     async fetchData(params) { return { id: params.id, name: 'Alice' }; }
     * }
     */
    async requestData(params = null) {
        this.setLoading(true);
        try {
            let resolved = null;
            if (typeof this.fetchData === 'function') {
                resolved = await this.fetchData(params);
            } else if (params && typeof params === 'object' && !Array.isArray(params)) {
                resolved = params;
            }

            if (resolved && typeof resolved === 'object') {
                this.setData(resolved);
                return resolved;
            }
            this.setData(null);
            return null;
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Vérifie si l'objet fourni correspond à cet élément (par clé primaire/identifiant ou correspondance des propriétés).
     *
     * @param {Object} data - Données à comparer.
     * @returns {boolean} `true` si les données correspondent à cet élément.
     *
     * @example <caption>Exemple 1 : Comparaison par identifiant</caption>
     * item.setData({ id: 42, name: 'A' });
     * console.log(item.matchesData({ id: 42 })); // true
     *
     * @example <caption>Exemple 2 : Comparaison par propriétés</caption>
     * console.log(item.matchesData({ id: 42, name: 'A' })); // true
     */
    matchesData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        const incomingId = this.#extractId(data);
        if (this.#itemId !== null && incomingId !== null) {
            return this.#itemId === incomingId;
        }
        if (!this.#itemData) {
            return false;
        }
        const entries = Object.entries(data);
        if (entries.length === 0) {
            return false;
        }
        return entries.every(([k, v]) => this.#itemData[k] === v);
    }

    /**
     * Met à jour le rendu DOM à partir des données fournies et émet l'événement `'displaydata'`.
     *
     * @param {Object|null} [data=this.#itemData] - Données à afficher.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Rafraîchir l'affichage</caption>
     * item.displayData();
     *
     * @example <caption>Exemple 2 : Surcharger dans une sous-classe</caption>
     * class CardItem extends NItem {
     *     displayData(data) {
     *         this.setText(data?.title || '');
     *         return super.displayData(data);
     *     }
     * }
     */
    displayData(data = this.#itemData) {
        this.setLoading(false);
        this.emit('displaydata', { item: this, data });
        return this;
    }

    /**
     * Réapplique les traductions de `NTag` et rafraîchit `displayData()` si des données sont déjà présentes.
     *
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Réappliquer la langue</caption>
     * item.applyLanguage();
     *
     * @example <caption>Exemple 2 : Changement dynamique de langue</caption>
     * item.setLanguage('en');
     */
    applyLanguage() {
        super.applyLanguage();
        if (this.#hasInitializedLanguage && this.#itemData) {
            this.displayData(this.#itemData);
        }
        this.#hasInitializedLanguage = true;
        return this;
    }

    /**
     * Active ou désactive l'état visuel de chargement (`.n-item--loading`).
     *
     * @param {boolean} [loading=true] - `true` pour activer l'état de chargement.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Afficher le chargement</caption>
     * item.setLoading(true);
     *
     * @example <caption>Exemple 2 : Masquer le chargement</caption>
     * item.setLoading(false);
     */
    setLoading(loading = true) {
        const flag = Boolean(loading);
        this.toggleClass('n-item--loading', flag);
        return flag ? this.setAttr('aria-busy', 'true') : this.removeAttr('aria-busy');
    }

    /**
     * Indique si l'élément est en état de chargement.
     *
     * @returns {boolean} `true` si en chargement.
     *
     * @example <caption>Exemple 1 : Vérifier l'état de chargement</caption>
     * console.log(item.isLoading());
     *
     * @example <caption>Exemple 2 : Après setLoading</caption>
     * item.setLoading(true);
     * console.log(item.isLoading()); // true
     */
    isLoading() {
        return this.hasClass('n-item--loading');
    }

    /**
     * Active ou désactive l'état sélectionné (`.n-item--selected`).
     *
     * @param {boolean} [selected=true] - `true` pour sélectionner.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Sélectionner l'élément</caption>
     * item.setSelected(true);
     *
     * @example <caption>Exemple 2 : Désélectionner l'élément</caption>
     * item.setSelected(false);
     */
    setSelected(selected = true) {
        const flag = Boolean(selected);
        this.toggleClass('n-item--selected', flag);
        return this.setAttr('aria-selected', String(flag));
    }

    /**
     * Indique si l'élément est sélectionné.
     *
     * @returns {boolean} `true` si sélectionné.
     *
     * @example <caption>Exemple 1 : Tester la sélection</caption>
     * console.log(item.isSelected());
     *
     * @example <caption>Exemple 2 : Après setSelected</caption>
     * item.setSelected(true);
     * console.log(item.isSelected()); // true
     */
    isSelected() {
        return this.hasClass('n-item--selected');
    }

    /**
     * Active ou désactive l'état désactivé de l'élément (`.n-item--disabled`).
     *
     * @param {boolean} [disabled=true] - `true` pour désactiver.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Désactiver l'élément</caption>
     * item.setDisabled(true);
     *
     * @example <caption>Exemple 2 : Réactiver l'élément</caption>
     * item.setDisabled(false);
     */
    setDisabled(disabled = true) {
        const flag = Boolean(disabled);
        this.toggleClass('n-item--disabled', flag);
        return flag ? this.setAttr('aria-disabled', 'true') : this.removeAttr('aria-disabled');
    }

    /**
     * Indique si l'élément est désactivé.
     *
     * @returns {boolean} `true` si désactivé.
     *
     * @example <caption>Exemple 1 : Vérifier l'état</caption>
     * console.log(item.isDisabled());
     *
     * @example <caption>Exemple 2 : Après setDisabled</caption>
     * item.setDisabled(true);
     * console.log(item.isDisabled()); // true
     */
    isDisabled() {
        return this.hasClass('n-item--disabled');
    }

    /**
     * Définit les paramètres de synchronisation associés à l'élément.
     *
     * @param {Object|string|null} params - Paramètres de synchronisation (ex. `{ table: 'users', recordId: 1 }`).
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Définir des paramètres structurés</caption>
     * item.setSyncParams({ table: 'users', recordId: 1 });
     *
     * @example <caption>Exemple 2 : Définir un nom de table</caption>
     * item.setSyncParams('products');
     */
    setSyncParams(params) {
        this.#syncParams = params ?? null;
        return this;
    }

    /**
     * Retourne les paramètres de synchronisation configurés.
     *
     * @returns {Object|string|null} Paramètres de synchronisation.
     *
     * @example <caption>Exemple 1 : Lire les paramètres</caption>
     * console.log(item.getSyncParams());
     *
     * @example <caption>Exemple 2 : Vérifier si configuré</caption>
     * if (item.getSyncParams()) console.log('Synchronisable');
     */
    getSyncParams() {
        return this.#syncParams;
    }

    /**
     * Retourne le dernier identifiant d'événement reçu via `notifyChange()`.
     *
     * @returns {string|number|null} Dernier identifiant d'événement.
     *
     * @example <caption>Exemple 1 : Lire le dernier ID d'événement</caption>
     * console.log(item.getLastEventId());
     *
     * @example <caption>Exemple 2 : Après une notification</caption>
     * item.notifyChange(7, { action: 'update' });
     * console.log(item.getLastEventId()); // 7
     */
    getLastEventId() {
        return this.#lastEventId;
    }

    /**
     * Notifie l'élément d'un changement externe ; diffère le traitement à la prochaine visibilité si l'élément est masqué.
     *
     * @param {string|number} eventId - Identifiant de l'événement.
     * @param {*} [payload=null] - Données associées à l'événement.
     * @returns {this} L'instance courante.
     *
     * @example <caption>Exemple 1 : Notifier une mise à jour</caption>
     * item.notifyChange(12, { table: 'orders' });
     *
     * @example <caption>Exemple 2 : Écouter l'événement émis</caption>
     * item.on('change', ({ eventId, data }) => console.log(eventId, data));
     */
    notifyChange(eventId, payload = null) {
        if (this.isDestroyed) {
            return this;
        }

        if (this.isVisible() && this.isVisibleInScreen()) {
            this.#lastEventId = eventId;
            if (this.isAutoUpdate() && typeof this.onSyncCheck === 'function') {
                this.onSyncCheck(eventId, payload);
            }
            this.emit('change', { item: this, eventId, data: payload });
            return this;
        }

        if (this.#lastEventId !== eventId) {
            this.#clearPendingVisibilityHandler();
            this.#pendingVisibilityHandler = (e) => {
                if (e?.isVisible && this.isVisible()) {
                    this.#clearPendingVisibilityHandler();
                    this.notifyChange(eventId, payload);
                }
            };
            this.on('visibility', this.#pendingVisibilityHandler);
        }
        return this;
    }

    /**
     * Libère les ressources et nettoie les données de l'élément.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Détruire l'élément</caption>
     * item.destroy();
     *
     * @example <caption>Exemple 2 : Destruction conditionnelle</caption>
     * if (!item.isDestroyed) item.destroy();
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }
        this.#clearPendingVisibilityHandler();
        this.#itemData = null;
        this.#syncParams = null;
        this.#itemId = null;
        super.destroy();
    }

    // =========================================================================
    // Méthodes privées
    // =========================================================================

    /**
     * Extrait l'identifiant métier depuis un objet de données selon `#primaryKey`.
     *
     * @private
     * @param {Object} data - Objet de données.
     * @returns {string|number|null} Identifiant extrait ou `null`.
     *
     * @example <caption>Exemple 1 : Extraction par clé primaire</caption>
     * this.#extractId({ id: 5, name: 'A' }); // 5
     *
     * @example <caption>Exemple 2 : Fallback sur ID majuscule</caption>
     * this.#extractId({ ID: 9 }); // 9
     */
    #extractId(data) {
        if (!data || typeof data !== 'object') {
            return null;
        }
        const val = data[this.#primaryKey] ?? data.id ?? data.ID;
        return (val === undefined || val === null || val === '') ? null : val;
    }

    /**
     * Détache l'écouteur de visibilité différée s'il est actif.
     *
     * @private
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Nettoyage interne</caption>
     * this.#clearPendingVisibilityHandler();
     *
     * @example <caption>Exemple 2 : Avant réattachement</caption>
     * this.#clearPendingVisibilityHandler();
     */
    #clearPendingVisibilityHandler() {
        if (this.#pendingVisibilityHandler) {
            this.off('visibility', this.#pendingVisibilityHandler);
            this.#pendingVisibilityHandler = null;
        }
    }
}

export default NItem;
