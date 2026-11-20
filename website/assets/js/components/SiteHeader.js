/**
 * @file SiteHeader.js
 * @package @nlib/website
 * @description Barre de navigation et contrôles globaux (thème/style) réutilisables sur toutes les frames du site.
 */

import { NTag, NButton, NToast } from '../../../packages/js/frontend/index.js';

/**
 * @class SiteHeader
 * @extends NTag
 * @description En-tête collant du site de documentation permettant de naviguer entre les frames et de basculer thème/style.
 *
 * @example <caption>Exemple 1 : Ajouter l'en-tête sur la page d'accueil</caption>
 * this.append(new SiteHeader({ active: '/home' }));
 *
 * @example <caption>Exemple 2 : Ajouter l'en-tête sur l'explorateur</caption>
 * this.append(new SiteHeader({ active: '/explorer' }));
 */
export class SiteHeader extends NTag {

    /**
     * Crée la barre de navigation du site.
     *
     * @param {object} [options={}] - Options de configuration.
     * @param {string} [options.active='/home'] - Route active à mettre en évidence.
     *
     * @example <caption>Exemple 1 : Création avec route active par défaut</caption>
     * const header = new SiteHeader();
     *
     * @example <caption>Exemple 2 : Création pour la route /playground</caption>
     * const header = new SiteHeader({ active: '/playground' });
     */
    constructor(options = {}) {
        super({ tagName: 'header', className: 'docs-header' });
        const active = options.active || '/home';

        const brand = new NTag({
            tagName: 'button',
            className: 'docs-brand',
            attrs: { type: 'button' },
            events: {
                click: () => this.getWindow()?.navigate('/home')
            }
        }).append(
            new NTag({ tagName: 'span', text: 'NLib' }),
            new NTag({ tagName: 'span', className: 'docs-brand__badge', text: 'Interactive Docs' })
        );

        const nav = new NTag({ tagName: 'nav', className: 'docs-nav', attrs: { 'aria-label': 'Navigation principale' } });
        const routes = [
            { label: 'Accueil', link: '/home' },
            { label: 'Guide', link: '/guide' },
            { label: 'Explorateur API', link: '/explorer' },
            { label: 'Atelier', link: '/playground' }
        ];

        for (const r of routes) {
            const btn = new NButton({
                text: r.label,
                classes: active === r.link ? ['docs-nav__btn', 'docs-nav__btn--active'] : ['docs-nav__btn'],
                styleName: active === r.link ? 'solid' : undefined,
                events: {
                    click: () => this.getWindow()?.navigate(r.link)
                }
            });
            nav.append(btn);
        }

        const controls = new NTag({ tagName: 'div', className: 'docs-controls' });
        const currentTheme = NTag.getGlobalTheme() || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        const themeToggle = new NButton({
            text: currentTheme === 'dark' ? '☀️ Clair' : '🌙 Sombre',
            events: {
                click: () => {
                    const activeTheme = NTag.getGlobalTheme() === 'dark' ? 'light' : 'dark';
                    NTag.setGlobalTheme(activeTheme);
                    themeToggle.setText(activeTheme === 'dark' ? '☀️ Clair' : '🌙 Sombre');
                    NToast.show(`Thème : ${activeTheme}`, { duration: 1500 });
                }
            }
        });

        const styleCycle = ['default', 'glass', 'solid'];
        const styleBtn = new NButton({
            text: `Style : ${NTag.getGlobalStyle() || 'default'}`,
            events: {
                click: () => {
                    const current = NTag.getGlobalStyle() || 'default';
                    const next = styleCycle[(styleCycle.indexOf(current) + 1) % styleCycle.length];
                    NTag.setGlobalStyle(next);
                    styleBtn.setText(`Style : ${next}`);
                    NToast.show(`Style global : ${next}`, { duration: 1500 });
                }
            }
        });

        controls.append(themeToggle, styleBtn);
        this.append(brand, nav, controls);
    }
}
