import { describe, it, assert } from '../test-helper.js';
import { NConfig } from '../../index.js';

describe('NConfig (config/NConfig.js)', () => {
    it('lit et écrit des valeurs typées avec chemins hiérarchiques et valeurs par défaut', () => {
        const cfg = new NConfig({
            data: { api: { host: 'localhost', port: '8080' }, debug: 'true', list: ['a', 'b', 'c'] },
            defaults: { api: { timeout: 5000 }, retries: 3 }
        });

        assert.equal(cfg.has(['api', 'host']), true);
        assert.equal(cfg.getString(['api', 'host']), 'localhost');
        assert.equal(cfg.getInt(['api', 'port']), 8080);
        assert.equal(cfg.getNumber(['api', 'timeout']), 5000);
        assert.equal(cfg.getBoolean('debug'), true);
        assert.deepEqual(cfg.getArray('list'), ['a', 'b', 'c']);

        cfg.set(['api', 'port'], 9090);
        assert.equal(cfg.getInt(['api', 'port']), 9090);
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

        assert.equal(cfg.require(['APP_NAME', 'PORT']), true);
        assert.equal(cfg.require(['APP_NAME', 'SECRET_KEY']), false);

        cfg.freeze();
        assert.equal(cfg.isFrozen, true);
        cfg.set('PORT', 4000);
        assert.equal(cfg.getInt('PORT'), 3000);
    });

    it('gère getFloat, getObject, setDefaults, merge, remove, reset, clear, all, toJSON et destroy', () => {
        const cfg = new NConfig({
            dotEnv: 'HOST=localhost\n# commentaire\nBASE_URL=http://${HOST}:8080 # inline'
        });
        assert.equal(cfg.getString('BASE_URL'), 'http://localhost:8080');

        cfg.setDefaults({ db: { host: '127.0.0.1', port: 3306 }, ratio: '1,75' });
        cfg.merge({ db: { port: 5432, name: 'nlib' } });

        assert.equal(cfg.getFloat('ratio'), 1.75);
        assert.deepEqual(cfg.getObject('db'), { host: '127.0.0.1', port: 5432, name: 'nlib' });
        assert.deepEqual(cfg.all('db'), { host: '127.0.0.1', port: 5432, name: 'nlib' });

        assert.equal(cfg.remove(['db', 'name']), true);
        assert.equal(cfg.has(['db', 'name']), false);
        assert.equal(cfg.remove('inexistant'), false);

        cfg.reset();
        assert.equal(cfg.getInt(['db', 'port']), 3306);

        const json = cfg.toJSON();
        assert.equal(json.frozen, false);
        assert.equal(json.data.db.port, 3306);

        cfg.freeze().clear();
        assert.equal(cfg.isFrozen, false);
        assert.equal(cfg.isEmpty, true);

        cfg.set('tmp', 1);
        cfg.destroy();
        assert.equal(cfg.isDestroyed, true);
        assert.equal(cfg.isEmpty, true);
    });
});
