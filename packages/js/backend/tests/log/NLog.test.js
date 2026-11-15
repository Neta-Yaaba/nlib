import { describe, it, assert } from '../test-helper.js';
import { NLog } from '../../index.js';

describe('NLog (log/NLog.js)', () => {
    it('enregistre les niveaux debug, info, warn, error et gère le contexte', () => {
        const log = new NLog({ consoleEnabled: false, maxLogs: 10, context: { app: 'TestApp' } });
        assert.equal(log.isConsoleEnabled, false);
        assert.equal(log.maxLogs, 10);
        assert.deepEqual(log.context, { app: 'TestApp' });

        log.debug('Debug msg', { step: 1 });
        log.info('Info msg');
        log.warn('Warn msg');
        log.error('Error msg', { code: 500 });

        assert.equal(log.getLogs().length, 4);
        assert.equal(log.getLogs({ level: 'error' }).length, 1);
        const lastErr = log.getLogs({ level: 'error' }).at(-1);
        assert.equal(lastErr.message, 'Error msg');
        assert.equal(log.getLogs({ level: 'debug' })[0].context.app, 'TestApp');
    });

    it('capture les exceptions, filtre, exporte et importe les journaux', () => {
        const log = new NLog({ consoleEnabled: false });
        log.captureException(new Error('Boom détecté'), { userId: 7 });

        const errors = log.getLogs({ level: 'error', search: 'Boom' });
        assert.equal(errors.length, 1);

        const exported = log.export('json');
        log.clear();
        assert.equal(log.getLogs().length, 0);

        const importedRes = log.import(exported);
        assert.equal(importedRes.success, true);
        assert.equal(importedRes.count, 1);
        assert.equal(log.getLogs().length, 1);

        log.destroy();
        assert.equal(log.getLogs().length, 0);
    });
});
