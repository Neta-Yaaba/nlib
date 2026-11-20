/**
 * @file GuideFrame.js
 * @package @nlib/website
 * @description Guide interactif pas-à-pas pour comprendre l'architecture et les concepts de NLib.
 */

import { NFrame, NTag, NButton, NToast, NObject } from '../../../packages/js/frontend/index.js';
import { SiteHeader } from '../components/SiteHeader.js';

/**
 * @class GuideFrame
 * @extends NFrame
 * @description Parcours pédagogique interactif expliquant `NObject`, `NWindow`/`NFrame`, `NTag` et les styles CSS.
 *
 * @example <caption>Exemple 1 : Enregistrer le guide dans AppWindow</caption>
 * win.registerFrame('guide', GuideFrame);
 *
 * @example <caption>Exemple 2 : Naviguer vers le guide</caption>
 * win.navigate('/guide');
 */
export class GuideFrame extends NFrame {

    /**
     * Construit les 4 étapes interactives du guide NLib.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Initialisation automatique</caption>
     * const guide = new GuideFrame();
     *
     * @example <caption>Exemple 2 : Reconstruire le guide</caption>
     * guide.empty().init();
     */
    init() {
        this.setTitle('Guide NLib — Comprendre en 5 minutes');
        this.setLink('/guide');
        this.setBackLink('/home');
        this.addClass('docs-shell');

        const main = new NTag({ tagName: 'main', className: 'docs-main' });

        main.append(
            new NTag({ tagName: 'section', className: 'docs-section-head' }).append(
                new NTag({ tagName: 'h1', className: 'docs-hero__title', text: 'Comprendre NLib étape par étape' }),
                new NTag({
                    tagName: 'p',
                    className: 'docs-hero__subtitle',
                    text: 'Chaque étape ci-dessous inclut une démonstration exécutable directement dans votre navigateur.'
                })
            ),
            this.#buildStep1State(),
            this.#buildStep2Routing(),
            this.#buildStep3Styles(),
            this.#buildStep4Next()
        );

        this.append(
            new SiteHeader({ active: '/guide' }),
            main,
            new NTag({ tagName: 'footer', className: 'docs-footer', text: 'Guide interactif NLib' })
        );
    }

    /**
     * Étape 1 : Démonstration interactive de `NObject` et de l'état réactif.
     *
     * @returns {NTag} Carte de l'étape 1.
     *
     * @example <caption>Exemple 1 : Ajouter l'étape 1</caption>
     * main.append(this.#buildStep1State());
     *
     * @example <caption>Exemple 2 : Récupérer le bloc</caption>
     * const step = this.#buildStep1State();
     */
    #buildStep1State() {
        const model = new NObject({ state: { count: 0 } });
        const counterBadge = new NTag({ tagName: 'span', className: 'docs-pill', text: 'count = 0' });
        const logLine = new NTag({ tagName: 'span', className: 'docs-card__desc', text: 'Cliquez pour déclencher state:count' });

        model.event.on('state:count', ({ value, oldValue }) => {
            counterBadge.setText(`count = ${value}`);
            logLine.setText(`Événement reçu : state:count (${oldValue} → ${value})`);
        });

        return new NTag({ tagName: 'section', className: 'docs-card' }).append(
            new NTag({ tagName: 'span', className: 'docs-hero__eyebrow', text: 'Étape 1 • @nlib/js-backend' }),
            new NTag({ tagName: 'h2', className: 'docs-card__title', text: 'NObject : État réactif et événements sans framework' }),
            new NTag({
                tagName: 'p',
                className: 'docs-card__desc',
                text: 'Toutes les classes NLib héritent de NObject. Modifier une variable via setState() émet automatiquement un événement state:<clé>.'
            }),
            new NTag({
                tagName: 'pre',
                className: 'docs-code',
                text: `const model = new NObject({ state: { count: 0 } });
model.event.on('state:count', ({ value, oldValue }) => { /* ... */ });
model.setState('count', model.getState('count') + 1);`
            }),
            new NTag({ tagName: 'div', className: 'docs-playground' }).append(
                new NButton({
                    text: '+1 (setState)',
                    styleName: 'solid',
                    events: {
                        click: () => model.setState('count', model.getState('count') + 1)
                    }
                }),
                new NButton({
                    text: 'Réinitialiser',
                    events: {
                        click: () => model.setState('count', 0)
                    }
                }),
                counterBadge,
                logLine
            )
        );
    }

    /**
     * Étape 2 : Explication du couple `NWindow` + `NFrame`.
     *
     * @returns {NTag} Carte de l'étape 2.
     *
     * @example <caption>Exemple 1 : Ajouter l'étape 2</caption>
     * main.append(this.#buildStep2Routing());
     *
     * @example <caption>Exemple 2 : Récupérer le bloc</caption>
     * const step = this.#buildStep2Routing();
     */
    #buildStep2Routing() {
        return new NTag({ tagName: 'section', className: 'docs-card' }).append(
            new NTag({ tagName: 'span', className: 'docs-hero__eyebrow', text: 'Étape 2 • Architecture SPA' }),
            new NTag({ tagName: 'h2', className: 'docs-card__title', text: 'NWindow et NFrame : Navigation multipage fluide' }),
            new NTag({
                tagName: 'p',
                className: 'docs-card__desc',
                text: 'Une instance unique NWindow gère le registre de routes, l\'historique et les transitions. Chaque page hérite de NFrame (avec titre, scroll mémorisé et mode flottant).'
            }),
            new NTag({ tagName: 'div', className: 'docs-flow' }).append(
                new NTag({ tagName: 'span', className: 'docs-pill', text: 'NWindow (document.body)' }),
                new NTag({ tagName: 'span', className: 'docs-card__desc', text: '→' }),
                new NTag({ tagName: 'span', className: 'docs-pill', text: 'navigate("/explorer")' }),
                new NTag({ tagName: 'span', className: 'docs-card__desc', text: '→' }),
                new NTag({ tagName: 'span', className: 'docs-pill', text: 'NFrame.onActivate()' })
            ),
            new NTag({ tagName: 'div', className: 'docs-hero__actions' }).append(
                new NButton({
                    text: 'Tester back() vers Accueil',
                    events: {
                        click: () => this.getWindow()?.back('/home')
                    }
                }),
                new NButton({
                    text: 'Ouvrir une Frame flottante (démo)',
                    styleName: 'solid',
                    events: {
                        click: () => {
                            const modal = new NFrame({ floating: true, title: 'Modale NFrame' });
                            modal.addClass('docs-modal-demo').append(
                                new NTag({ tagName: 'div', className: 'docs-card docs-modal-demo__box' }).append(
                                    new NTag({ tagName: 'h3', className: 'docs-card__title', text: 'Ceci est une NFrame flottante' }),
                                    new NTag({
                                        tagName: 'p',
                                        className: 'docs-card__desc',
                                        text: 'Elle se superpose à la page courante grâce à setFloating(true) sans perdre votre position de défilement.'
                                    }),
                                    new NButton({
                                        text: 'Fermer (win.back())',
                                        styleName: 'solid',
                                        events: {
                                            click: () => this.getWindow()?.back()
                                        }
                                    })
                                )
                            );
                            this.getWindow()?.registerFrame('demo-modal', NFrame);
                            this.getWindow()?.bringToFront(modal, { link: '/demo-modal' });
                        }
                    }
                })
            )
        );
    }

    /**
     * Étape 3 : Démonstration des styles isolés par élément vs global.
     *
     * @returns {NTag} Carte de l'étape 3.
     *
     * @example <caption>Exemple 1 : Ajouter l'étape 3</caption>
     * main.append(this.#buildStep3Styles());
     *
     * @example <caption>Exemple 2 : Récupérer le bloc</caption>
     * const step = this.#buildStep3Styles();
     */
    #buildStep3Styles() {
        const targetBtn = new NButton({
            text: 'Bouton stylé localement',
            styleName: 'glass',
            events: {
                click: () => NToast.show(`Style local : ${targetBtn.getStyleName() || 'hérité'}`)
            }
        });

        return new NTag({ tagName: 'section', className: 'docs-card' }).append(
            new NTag({ tagName: 'span', className: 'docs-hero__eyebrow', text: 'Étape 3 • CSS & Thèmes' }),
            new NTag({ tagName: 'h2', className: 'docs-card__title', text: 'Thèmes et styles combinables sans conflit' }),
            new NTag({
                tagName: 'p',
                className: 'docs-card__desc',
                text: 'Les couches @layer nlib.core, nlib.base, nlib.style et les sélecteurs :where([data-n-style="..."]) gardent une spécificité nulle (0,0,0) et permettent de styler un composant individuellement.'
            }),
            new NTag({ tagName: 'div', className: 'docs-playground' }).append(
                targetBtn,
                new NButton({ text: 'Passer en Glass', events: { click: () => targetBtn.setStyleName('glass') } }),
                new NButton({ text: 'Passer en Solid', events: { click: () => targetBtn.setStyleName('solid') } }),
                new NButton({ text: 'Hériter du global', events: { click: () => targetBtn.setStyleName(null) } })
            )
        );
    }

    /**
     * Étape 4 : Liens vers l'explorateur et l'atelier.
     *
     * @returns {NTag} Carte de navigation suivante.
     *
     * @example <caption>Exemple 1 : Ajouter l'étape 4</caption>
     * main.append(this.#buildStep4Next());
     *
     * @example <caption>Exemple 2 : Récupérer le bloc</caption>
     * const next = this.#buildStep4Next();
     */
    #buildStep4Next() {
        return new NTag({ tagName: 'section', className: 'docs-card' }).append(
            new NTag({ tagName: 'h2', className: 'docs-card__title', text: 'Aller plus loin' }),
            new NTag({
                tagName: 'p',
                className: 'docs-card__desc',
                text: 'Parcourez chaque classe et méthode dans l\'Explorateur API ou expérimentez librement dans l\'Atelier interactif.'
            }),
            new NTag({ tagName: 'div', className: 'docs-hero__actions' }).append(
                new NButton({
                    text: 'Ouvrir l\'Explorateur API',
                    styleName: 'solid',
                    events: { click: () => this.getWindow()?.navigate('/explorer') }
                }),
                new NButton({
                    text: 'Ouvrir l\'Atelier',
                    events: { click: () => this.getWindow()?.navigate('/playground') }
                })
            )
        );
    }
}
