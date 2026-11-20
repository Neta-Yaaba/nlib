/**
 * @file ExplorerFrame.js
 * @package @nlib/website
 * @description Explorateur interactif des classes, méthodes et exemples de `@nlib/js-backend` et `@nlib/js-frontend`.
 */

import { NFrame, NTag, NButton, NInput, NToast } from '../../../packages/js/frontend/index.js';
import { NUtil } from '../../../packages/js/backend/index.js';
import { NLIB_CATALOG } from '../../../api-data/catalog.js';
import { SiteHeader } from '../components/SiteHeader.js';

/**
 * @class ExplorerFrame
 * @extends NFrame
 * @description Interface de recherche et consultation détaillée de l'API NLib.
 *
 * @example <caption>Exemple 1 : Enregistrer l'explorateur dans AppWindow</caption>
 * win.registerFrame('explorer', ExplorerFrame);
 *
 * @example <caption>Exemple 2 : Ouvrir l'explorateur</caption>
 * win.navigate('/explorer');
 */
export class ExplorerFrame extends NFrame {

    /**
     * Filtre package actif (`'all'`, `'@nlib/js-backend'`, `'@nlib/js-frontend'`).
     * @type {string}
     */
    #pkgFilter = 'all';

    /**
     * Terme de recherche saisi par l'utilisateur.
     * @type {string}
     */
    #searchTerm = '';

    /**
     * Classe actuellement sélectionnée dans la liste.
     * @type {object}
     */
    #selected = NLIB_CATALOG[0];

    /**
     * Conteneur de la liste des classes filtrées.
     * @type {NTag|null}
     */
    #listContainer = null;

    /**
     * Conteneur de la fiche détaillée.
     * @type {NTag|null}
     */
    #detailContainer = null;

    /**
     * Construit l'explorateur interactif avec barre de recherche, filtres, liste et fiche API.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Initialisation automatique</caption>
     * const explorer = new ExplorerFrame();
     *
     * @example <caption>Exemple 2 : Reconstruire l'explorateur</caption>
     * explorer.empty().init();
     */
    init() {
        this.setTitle('Explorateur API — NLib');
        this.setLink('/explorer');
        this.setBackLink('/home');
        this.addClass('docs-shell');

        const main = new NTag({ tagName: 'main', className: 'docs-main' });

        const searchInput = new NInput({
            placeholder: 'Rechercher une classe ou une méthode (ex: navigate, NObject, setState)...',
            events: {
                input: () => {
                    this.#searchTerm = searchInput.value.trim().toLowerCase();
                    this.#renderList();
                }
            }
        });

        const filterBar = new NTag({ tagName: 'div', className: 'docs-playground' }).append(
            searchInput,
            this.#buildFilterButton('Tous', 'all'),
            this.#buildFilterButton('Backend', '@nlib/js-backend'),
            this.#buildFilterButton('Frontend', '@nlib/js-frontend')
        );

        this.#listContainer = new NTag({ tagName: 'aside', className: 'docs-explorer__sidebar' });
        this.#detailContainer = new NTag({ tagName: 'section', className: 'docs-explorer__detail' });

        const layout = new NTag({ tagName: 'div', className: 'docs-explorer' }).append(
            this.#listContainer,
            this.#detailContainer
        );

        main.append(
            new NTag({ tagName: 'section', className: 'docs-section-head' }).append(
                new NTag({ tagName: 'h1', className: 'docs-hero__title', text: 'Explorateur API' }),
                new NTag({
                    tagName: 'p',
                    className: 'docs-hero__subtitle',
                    text: 'Filtrez par package ou recherchez une méthode pour consulter sa signature et copier son exemple.'
                })
            ),
            filterBar,
            layout
        );

        this.append(
            new SiteHeader({ active: '/explorer' }),
            main,
            new NTag({ tagName: 'footer', className: 'docs-footer', text: 'Explorateur API NLib' })
        );

        this.#renderList();
        this.#renderDetail();
    }

    /**
     * Crée un bouton de filtre par package.
     *
     * @param {string} label - Libellé du bouton.
     * @param {string} value - Valeur du filtre (`all` ou nom de package).
     * @returns {NButton} Bouton configuré.
     *
     * @example <caption>Exemple 1 : Bouton filtre Backend</caption>
     * this.#buildFilterButton('Backend', '@nlib/js-backend');
     *
     * @example <caption>Exemple 2 : Bouton tous les packages</caption>
     * this.#buildFilterButton('Tous', 'all');
     */
    #buildFilterButton(label, value) {
        return new NButton({
            text: label,
            events: {
                click: () => {
                    this.#pkgFilter = value;
                    this.#renderList();
                }
            }
        });
    }

    /**
     * Met à jour la liste latérale des classes selon le filtre et le terme de recherche.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Rafraîchir la liste</caption>
     * this.#renderList();
     *
     * @example <caption>Exemple 2 : Rafraîchir après saisie</caption>
     * this.#searchTerm = 'window'; this.#renderList();
     */
    #renderList() {
        if (!this.#listContainer) return;
        this.#listContainer.empty();

        const filtered = NLIB_CATALOG.filter((item) => {
            if (this.#pkgFilter !== 'all' && item.pkg !== this.#pkgFilter) {
                return false;
            }
            if (!this.#searchTerm) {
                return true;
            }
            const haystack = [
                item.name,
                item.summary,
                ...item.methods.map((m) => `${m.sig} ${m.desc}`)
            ].join(' ').toLowerCase();
            return haystack.includes(this.#searchTerm);
        });

        if (filtered.length === 0) {
            this.#listContainer.append(
                new NTag({ tagName: 'p', className: 'docs-card__desc', text: 'Aucune classe correspondante.' })
            );
            return;
        }

        if (!filtered.includes(this.#selected)) {
            this.#selected = filtered[0];
            this.#renderDetail();
        }

        for (const item of filtered) {
            const isSelected = item === this.#selected;
            this.#listContainer.append(
                new NButton({
                    text: item.name,
                    classes: ['docs-explorer__item'],
                    styleName: isSelected ? 'solid' : undefined,
                    events: {
                        click: () => {
                            this.#selected = item;
                            this.#renderList();
                            this.#renderDetail();
                        }
                    }
                })
            );
        }
    }

    /**
     * Affiche la fiche complète de la classe sélectionnée (résumé, méthodes et exemple copiable).
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Afficher la fiche sélectionnée</caption>
     * this.#renderDetail();
     *
     * @example <caption>Exemple 2 : Changer de classe puis afficher</caption>
     * this.#selected = NLIB_CATALOG[1]; this.#renderDetail();
     */
    #renderDetail() {
        if (!this.#detailContainer || !this.#selected) return;
        this.#detailContainer.empty();

        const item = this.#selected;
        const methodsList = new NTag({ tagName: 'div', className: 'docs-methods' });

        for (const m of item.methods) {
            methodsList.append(
                new NTag({ tagName: 'div', className: 'docs-method' }).append(
                    new NTag({ tagName: 'code', className: 'docs-method__sig', text: m.sig }),
                    new NTag({ tagName: 'p', className: 'docs-card__desc', text: m.desc })
                )
            );
        }

        this.#detailContainer.append(
            new NTag({ tagName: 'div', className: 'docs-card' }).append(
                new NTag({ tagName: 'span', className: 'docs-hero__eyebrow', text: `${item.pkg} • ${item.category}/` }),
                new NTag({ tagName: 'h2', className: 'docs-hero__title', text: item.name }),
                new NTag({ tagName: 'p', className: 'docs-card__desc', text: item.summary }),
                new NTag({ tagName: 'h3', className: 'docs-card__title', text: 'Exemple d\'utilisation' }),
                new NTag({ tagName: 'pre', className: 'docs-code', text: item.example }),
                new NTag({ tagName: 'div', className: 'docs-hero__actions' }).append(
                    new NButton({
                        text: 'Copier l\'exemple',
                        styleName: 'solid',
                        events: {
                            click: async () => {
                                const ok = await NUtil.sys.copyToClipboard(item.example);
                                NToast.show(ok ? 'Exemple copié !' : 'Copie indisponible', { type: ok ? 'success' : 'warning' });
                            }
                        }
                    })
                ),
                new NTag({ tagName: 'h3', className: 'docs-card__title', text: 'Méthodes principales' }),
                methodsList
            )
        );
    }
}
