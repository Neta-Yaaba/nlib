import { describe, it, assert } from '../test-helper.js';
import { NEnvironment } from '../../index.js';

describe('NEnvironment (environment/NEnvironment.js)', () => {
    it('détecte correctement le contexte, le système et retourne un objet info complet', () => {
        const env = new NEnvironment();
        assert.equal(typeof env.type, 'string');
        assert.equal(typeof env.os, 'string');
        assert.equal(typeof env.browser, 'string');
        assert.equal(typeof env.isNode, 'boolean');
        assert.equal(typeof env.isBrowser, 'boolean');
        assert.equal(typeof env.isWorker, 'boolean');
        assert.equal(typeof env.isOnline, 'boolean');
        assert.equal(typeof env.isOffline, 'boolean');
        assert.notEqual(env.isOnline, env.isOffline);
        assert.equal(typeof env.language, 'string');
        assert.equal(typeof env.timezone, 'string');

        const info = env.info;
        assert.ok(info && typeof info === 'object');
        assert.equal(info.type, env.type);
        assert.equal(info.os, env.os);
        assert.equal(info.browser, env.browser);
        assert.equal(info.isDesktop, !env.isMobile && !env.isTablet);
        assert.equal(typeof env.isAndroid, 'boolean');
        assert.equal(typeof env.isHarmonyOS, 'boolean');
        assert.equal(typeof env.isIOS, 'boolean');
        assert.equal(typeof env.isWindows, 'boolean');
        assert.equal(typeof env.isMacOS, 'boolean');
        assert.equal(typeof env.isLinux, 'boolean');
        assert.equal(typeof env.isTouch, 'boolean');
        assert.equal(typeof env.isWebView, 'boolean');
        assert.equal(typeof env.isSecureContext, 'boolean');
        assert.equal(typeof env.isDarkMode, 'boolean');
        assert.equal(typeof env.userAgent, 'string');
    });
});
