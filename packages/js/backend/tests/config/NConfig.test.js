import { describe, it, assert } from '../test-helper.js';
import { NConfig } from '../../index.js';

describe('NConfig (config/NConfig.js)', () => {
    it('lit et écrit des valeurs typées avec chemins hiérarchiques et valeurs par défaut', () => {
        const cfg = new NConfig(
            { api: { host: 'localhost', port: '8080' }, debug: 'true', list: 'a,b,c' },
            { api: { timeout: 5000 }, retries: 3 }
        );

        assert.equal(cfg.has('api.host'), true);
        assert.equal(cfg.getString('api.host'), 'localhost');
        assert.equal(cfg.getInt('api.port'), 8080);
        assert.equal(cfg.getNumber('api.timeout'), 5000);
        assert.equal(cfg.getBoolean('debug'), true);
        assert.deepEqual(cfg.getArray('list'), ['a', 'b', 'c']);

        cfg.set(['api', 'port'], 9090);
        assert.equal(cfg.getInt('api.port'), 9090);
    });

    it('parse .env, vérifie require et verrouille avec freeze', () => {
        const cfg = new NConfig();
        cfg.loadFromDotEnv(`
            APP_NAME="NLib Backend"
            PORT=3000
            ENABLED=yes
        `);

        assert.equal(cfg.getString('APP_NAME'), 'NLib Backend');
        assert.equal(cfg.getInt('PORT'), 3000);
        assert.equal(cfg.getBoolean('ENABLED'), true);

        const reqOk = cfg.require(['APP_NAME', 'PORT']);
        assert.equal(reqOk.valid, true);
        assert.deepEqual(reqOk.missing, []);

        const reqMissing = cfg.require(['APP_NAME', 'SECRET_KEY']);
        assert.equal(reqMissing.valid, false);
        assert.deepEqual(reqMissing.missing, ['SECRET_KEY']);

        cfg.freeze();
        assert.equal(cfg.isFrozen, true);
        cfg.set('PORT', 4000);
        assert.equal(cfg.getInt('PORT'), 3000);
    });
});
