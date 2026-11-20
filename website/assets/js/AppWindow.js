/**
 * @file AppWindow.js
 * @package @nlib/website
 * @description Fenêtre applicative principale du site de documentation interactive NLib (`NWindow`).
 */

import { NWindow } from '../../../packages/js/frontend/index.js';
import { HomeFrame } from './frames/HomeFrame.js';
import { GuideFrame } from './frames/GuideFrame.js';
import { ExplorerFrame } from './frames/ExplorerFrame.js';
import { PlaygroundFrame } from './frames/PlaygroundFrame.js';

/**
 * @class AppWindow
 * @extends NWindow
 * @description Contrôleur principal du site de documentation enregistrant toutes les pages interactives.
 *
 * @example <caption>Exemple 1 : Démarrer l'application de documentation</caption>
 * const app = new AppWindow({ theme: 'auto' });
 *
 * @example <caption>Exemple 2 : Naviguer vers l'explorateur API</caption>
 * app.navigate('/explorer');
 */
export class AppWindow extends NWindow {

    /**
     * Retourne la route d'accueil du site de documentation.
     *
     * @returns {string} Lien de la page d'accueil.
     *
     * @example <caption>Exemple 1 : Résoudre la route racine</caption>
     * console.log(app.getHomeLink()); // '/home'
     *
     * @example <caption>Exemple 2 : Naviguer vers l'accueil</caption>
     * app.navigate(app.getHomeLink());
     */
    getHomeLink() {
        return '/home';
    }

    /**
     * Enregistre toutes les frames du site lors de l'initialisation.
     *
     * @returns {void}
     *
     * @example <caption>Exemple 1 : Appel automatique au constructeur</caption>
     * const app = new AppWindow();
     *
     * @example <caption>Exemple 2 : Vérifier l'enregistrement de explorer</caption>
     * console.log(app.getFrameClass('explorer') === ExplorerFrame); // true
     */
    init() {
        this.registerFrame('home', HomeFrame)
            .registerFrame('guide', GuideFrame)
            .registerFrame('explorer', ExplorerFrame)
            .registerFrame('playground', PlaygroundFrame);
    }
}
