/**
 * @file HomeFrame.js
 * @package @nlib/website
 * @description Page d'accueil interactive du site de documentation NLib.
 */

import { NFrame, NTag, NButton } from '../../../packages/js/frontend/index.js';
import { SiteHeader } from '../components/SiteHeader.js';

/**
 * @class HomeFrame
 * @extends NFrame
 * @description Page d'accueil présentant la philosophie NLib et orientant vers le Guide, l'Explorateur API et l'Atelier.
 *
 * @example <caption>Exemple 1 : Enregistrer la page d'accueil dans AppWindow</caption>
 * win.registerFrame('home', HomeFrame);
 *
 * @example <caption>Exemple 2 : Naviguer vers la page d'accueil</caption>
 * win.navigate('/home');
 */
export class HomeFrame extends NFrame {

    /**
     * Construit la page d'accueil interactive.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Initialisation automatique</caption>
     * const home = new HomeFrame();
     *
     * @example <caption>Exemple 2 : Reconstruire la vue</caption>
     * home.empty().init();
     */
    init() {
        this.setTitle('NLib — Documentation interactive');
        this.setLink('/home');
        this.addClass('docs-shell');

        const main = new NTag({ tagName: 'main', className: 'docs-main' });

        // Hero principal
        const hero = new NTag({ tagName: 'section', className: 'docs-hero' }).append(
            new NTag({ tagName: 'span', className: 'docs-hero__eyebrow', text: '100 % JavaScript ES Modules • Zéro dépendance' }),
            new NTag({ tagName: 'h1', className: 'docs-hero__title', text: 'Apprenez et testez NLib en direct dans votre navigateur.' }),
            new NTag({
                tagName: 'p',
                className: 'docs-hero__subtitle',
                text: 'NLib réunit une fondation logique headless (@nlib/js-backend) et un moteur d\'interface DOM modulaire (@nlib/js-frontend) pour créer des applications Web, PWA et WebView natives.'
            }),
            new NTag({ tagName: 'div', className: 'docs-hero__actions' }).append(
                new NButton({
                    text: 'Commencer le Guide interactif →',
                    styleName: 'solid',
                    events: { click: () => this.getWindow()?.navigate('/guide') }
                }),
                new NButton({
                    text: 'Explorer l\'API',
                    events: { click: () => this.getWindow()?.navigate('/explorer') }
                }),
                new NButton({
                    text: 'Ouvrir l\'Atelier en direct',
                    events: { click: () => this.getWindow()?.navigate('/playground') }
                })
            )
        );

        // 3 parcours pour comprendre NLib
        const pillars = new NTag({ tagName: 'section', className: 'docs-grid' }).append(
            this.#buildActionCard(
                '1. Guide pas-à-pas',
                'Découvrez comment NObject, NWindow, NFrame et les thèmes CSS s\'articulent grâce à des démos exécutables.',
                'Ouvrir le Guide',
                '/guide'
            ),
            this.#buildActionCard(
                '2. Explorateur API',
                'Recherchez n\'importe quelle classe ou méthode, consultez ses signatures et copiez des exemples prêts à l\'emploi.',
                'Parcourir l\'API',
                '/explorer'
            ),
            this.#buildActionCard(
                '3. Atelier en direct',
                'Configurez visuellement les composants (NButton, NToast, NProgress, styles) et récupérez le code JS généré.',
                'Tester dans l\'Atelier',
                '/playground'
            )
        );

        // Schéma d'architecture simple
        const arch = new NTag({ tagName: 'section', className: 'docs-card' }).append(
            new NTag({ tagName: 'h2', className: 'docs-card__title', text: 'Comment fonctionne NLib ?' }),
            new NTag({
                tagName: 'p',
                className: 'docs-card__desc',
                text: 'Le backend reste 100 % indépendant du DOM (exécutable en Worker, Node.js ou navigateur), tandis que le frontend orchestre les vues et le style :'
            }),
            new NTag({ tagName: 'div', className: 'docs-flow' }).append(
                new NTag({ tagName: 'span', className: 'docs-pill', text: '@nlib/js-backend (NObject, NUtil, NSystem, NNetwork)' }),
                new NTag({ tagName: 'span', className: 'docs-card__desc', text: '→ alimente →' }),
                new NTag({ tagName: 'span', className: 'docs-pill', text: '@nlib/js-frontend (NWindow → NFrame → NTag)' }),
                new NTag({ tagName: 'span', className: 'docs-card__desc', text: '→ stylé par →' }),
                new NTag({ tagName: 'span', className: 'docs-pill', text: 'styles/ (@layer core, base, style)' })
            )
        );

        main.append(hero, pillars, arch);

        this.append(
            new SiteHeader({ active: '/home' }),
            main,
            new NTag({
                tagName: 'footer',
                className: 'docs-footer',
                text: 'NLib Documentation interactive — Propulsé par NWindow et NFrame.'
            })
        );
    }

    /**
     * Construit une carte d'orientation avec bouton de navigation.
     *
     * @param {string} title - Titre de la carte.
     * @param {string} description - Description pédagogique.
     * @param {string} cta - Texte du bouton.
     * @param {string} link - Route cible.
     * @returns {NTag} Carte formatée.
     *
     * @example <caption>Exemple 1 : Carte vers le guide</caption>
     * this.#buildActionCard('Guide', 'Apprendre NLib', 'Ouvrir', '/guide');
     *
     * @example <caption>Exemple 2 : Carte vers l'atelier</caption>
     * this.#buildActionCard('Atelier', 'Tester NLib', 'Tester', '/playground');
     */
    #buildActionCard(title, description, cta, link) {
        return new NTag({ tagName: 'article', className: 'docs-card' }).append(
            new NTag({ tagName: 'h2', className: 'docs-card__title', text: title }),
            new NTag({ tagName: 'p', className: 'docs-card__desc', text: description }),
            new NTag({ tagName: 'div', className: 'docs-card__list' }).append(
                new NButton({
                    text: cta,
                    events: { click: () => this.getWindow()?.navigate(link) }
                })
            )
        );
    }
}
