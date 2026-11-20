/**
 * @file PlaygroundFrame.js
 * @package @nlib/website
 * @description Atelier interactif en direct pour configurer et tester les composants UI de NLib.
 */

import { NFrame, NTag, NButton, NInput, NToast, NProgress } from '../../../packages/js/frontend/index.js';
import { NUtil } from '../../../packages/js/backend/index.js';
import { SiteHeader } from '../components/SiteHeader.js';

/**
 * @class PlaygroundFrame
 * @extends NFrame
 * @description Bac à sable visuel permettant de manipuler `NButton`, `NInput`, `NToast` et `NProgress` avec code généré.
 *
 * @example <caption>Exemple 1 : Enregistrer l'atelier dans AppWindow</caption>
 * win.registerFrame('playground', PlaygroundFrame);
 *
 * @example <caption>Exemple 2 : Naviguer vers l'atelier</caption>
 * win.navigate('/playground');
 */
export class PlaygroundFrame extends NFrame {

    /**
     * Construit l'atelier interactif et relie les contrôles à l'aperçu en direct.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Initialisation automatique</caption>
     * const playground = new PlaygroundFrame();
     *
     * @example <caption>Exemple 2 : Reconstruire l'atelier</caption>
     * playground.empty().init();
     */
    init() {
        this.setTitle('Atelier interactif — NLib');
        this.setLink('/playground');
        this.setBackLink('/home');
        this.addClass('docs-shell');

        const main = new NTag({ tagName: 'main', className: 'docs-main' });

        // 1. Configurateur de NButton en direct
        const previewBtn = new NButton({
            text: 'Action principale',
            styleName: 'solid',
            icon: { type: 'emoji', value: '✨' },
            events: {
                click: () => NToast.show('Clic détecté sur NButton !', { type: 'success' })
            }
        });
        const codePreview = new NTag({ tagName: 'pre', className: 'docs-code' });

        const state = {
            text: 'Action principale',
            styleName: 'solid',
            loading: false,
            disabled: false,
            icon: true
        };

        const syncCode = () => {
            const lines = [
                'const btn = new NButton({',
                `    text: '${state.text}',`,
                state.styleName ? `    styleName: '${state.styleName}',` : null,
                state.icon ? "    icon: { type: 'emoji', value: '✨' }," : null,
                state.loading ? '    loading: true,' : null,
                state.disabled ? '    disabled: true,' : null,
                "    events: { click: () => NToast.show('Clic !') }",
                '});'
            ].filter(Boolean);
            codePreview.setText(lines.join('\n'));
        };

        const labelInput = new NInput({
            value: state.text,
            placeholder: 'Texte du bouton...',
            events: {
                input: () => {
                    state.text = labelInput.value || 'Bouton';
                    previewBtn.setText(state.text);
                    syncCode();
                }
            }
        });

        const buttonWorkshop = new NTag({ tagName: 'section', className: 'docs-card' }).append(
            new NTag({ tagName: 'h2', className: 'docs-card__title', text: '1. Configurateur NButton en direct' }),
            new NTag({ tagName: 'div', className: 'docs-playground' }).append(
                labelInput,
                new NButton({
                    text: 'Style: Solid',
                    events: {
                        click: () => {
                            state.styleName = 'solid';
                            previewBtn.setStyleName('solid');
                            syncCode();
                        }
                    }
                }),
                new NButton({
                    text: 'Style: Glass',
                    events: {
                        click: () => {
                            state.styleName = 'glass';
                            previewBtn.setStyleName('glass');
                            syncCode();
                        }
                    }
                }),
                new NButton({
                    text: 'Style: Default',
                    events: {
                        click: () => {
                            state.styleName = null;
                            previewBtn.setStyleName(null);
                            syncCode();
                        }
                    }
                }),
                new NButton({
                    text: 'Basculer Loading',
                    events: {
                        click: () => {
                            state.loading = !state.loading;
                            previewBtn.setLoading(state.loading);
                            syncCode();
                        }
                    }
                }),
                new NButton({
                    text: 'Basculer Disabled',
                    events: {
                        click: () => {
                            state.disabled = !state.disabled;
                            previewBtn.setDisabled(state.disabled);
                            syncCode();
                        }
                    }
                }),
                new NButton({
                    text: 'Basculer Icône',
                    events: {
                        click: () => {
                            state.icon = !state.icon;
                            previewBtn.setIcon(state.icon ? { type: 'emoji', value: '✨' } : null);
                            syncCode();
                        }
                    }
                })
            ),
            new NTag({ tagName: 'div', className: 'docs-preview-box' }).append(previewBtn),
            codePreview,
            new NTag({ tagName: 'div', className: 'docs-hero__actions' }).append(
                new NButton({
                    text: 'Copier ce code',
                    styleName: 'solid',
                    events: {
                        click: async () => {
                            await NUtil.sys.copyToClipboard(codePreview.text);
                            NToast.show('Code copié !', { type: 'success' });
                        }
                    }
                })
            )
        );
        syncCode();

        // 2. Démo NProgress local vs global + NToast variantes
        const localBox = new NTag({ tagName: 'section', className: 'docs-card docs-local-box' });
        const localProgress = new NProgress();
        localBox.append(
            new NTag({ tagName: 'h2', className: 'docs-card__title', text: '2. NProgress local (bloque uniquement cette carte) & NToast' }),
            new NTag({
                tagName: 'p',
                className: 'docs-card__desc',
                text: 'Un NProgress monté dans un conteneur bloque uniquement ce bloc, tandis que NProgress.show() recouvre toute la page.'
            }),
            new NTag({ tagName: 'div', className: 'docs-playground' }).append(
                new NButton({
                    text: 'Lancer NProgress local (1.5s)',
                    styleName: 'solid',
                    events: {
                        click: () => {
                            localProgress.showProgress('Traitement de cette carte...', 30);
                            setTimeout(() => localProgress.setProgress(85, 'Presque fini...'), 600);
                            setTimeout(() => localProgress.hideProgress(), 1400);
                        }
                    }
                }),
                new NButton({
                    text: 'Toast Succès',
                    events: { click: () => NToast.show('Opération réussie !', { type: 'success' }) }
                }),
                new NButton({
                    text: 'Toast Avertissement',
                    events: { click: () => NToast.show('Attention requise', { type: 'warning' }) }
                }),
                new NButton({
                    text: 'Toast Erreur',
                    events: { click: () => NToast.show('Erreur simulée', { type: 'error' }) }
                })
            ),
            localProgress
        );

        main.append(
            new NTag({ tagName: 'section', className: 'docs-section-head' }).append(
                new NTag({ tagName: 'h1', className: 'docs-hero__title', text: 'Atelier interactif' }),
                new NTag({
                    tagName: 'p',
                    className: 'docs-hero__subtitle',
                    text: 'Modifiez les propriétés en temps réel, testez les états et récupérez le code prêt à l\'emploi.'
                })
            ),
            buttonWorkshop,
            localBox
        );

        this.append(
            new SiteHeader({ active: '/playground' }),
            main,
            new NTag({ tagName: 'footer', className: 'docs-footer', text: 'Atelier interactif NLib' })
        );
    }
}
