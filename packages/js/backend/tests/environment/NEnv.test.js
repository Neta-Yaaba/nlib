import { describe, it, assert } from '../index.js';
import { NEnv } from '../../index.js';

describe('NEnv (environment/NEnv.js)', () => {
    it('détecte correctement le contexte, le système et retourne un objet info complet', () => {
        assert.equal(typeof NEnv.type, 'string');
        assert.equal(typeof NEnv.os, 'string');
        assert.equal(typeof NEnv.browser, 'string');
        assert.equal(typeof NEnv.isNode, 'boolean');
        assert.equal(typeof NEnv.isBrowser, 'boolean');
        assert.equal(typeof NEnv.isWorker, 'boolean');
        assert.equal(typeof NEnv.isOnline, 'boolean');
        assert.equal(typeof NEnv.isOffline, 'boolean');
        assert.notEqual(NEnv.isOnline, NEnv.isOffline);
        assert.equal(typeof NEnv.language, 'string');
        assert.equal(typeof NEnv.timezone, 'string');

        const info = NEnv.info;
        assert.ok(info && typeof info === 'object');
        assert.equal(info.type, NEnv.type);
        assert.equal(info.os, NEnv.os);
        assert.equal(info.browser, NEnv.browser);
        assert.equal(info.isDesktop, !NEnv.isMobile && !NEnv.isTablet);
        assert.equal(typeof NEnv.isAndroid, 'boolean');
        assert.equal(typeof NEnv.isHarmonyOS, 'boolean');
        assert.equal(typeof NEnv.isIOS, 'boolean');
        assert.equal(typeof NEnv.isWindows, 'boolean');
        assert.equal(typeof NEnv.isMacOS, 'boolean');
        assert.equal(typeof NEnv.isLinux, 'boolean');
        assert.equal(typeof NEnv.isTouch, 'boolean');
        assert.equal(typeof NEnv.isWebView, 'boolean');
        assert.equal(typeof NEnv.isSecureContext, 'boolean');
        assert.equal(typeof NEnv.isDarkMode, 'boolean');
        assert.equal(typeof NEnv.userAgent, 'string');
    });
});
