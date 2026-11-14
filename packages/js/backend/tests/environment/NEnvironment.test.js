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
    });
});
