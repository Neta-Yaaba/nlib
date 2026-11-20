/**
 * @file app.js
 * @package @nlib/website
 * @description Point d'entrée JavaScript du site de documentation NLib.
 */

import { AppWindow } from './AppWindow.js';

new AppWindow({
    theme: 'auto',
    styleName: 'default'
});
