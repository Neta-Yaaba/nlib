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

        assert.equal(log.count(), 4);
        assert.equal(log.count('error'), 1);
        assert.equal(log.getLastLog('error').message, 'Error msg');
        assert.equal(log.getLastLog('debug').context.app, 'TestApp');
    });

    it('capture les exceptions, filtre, exporte et importe les journaux', () => {
        const log = new NLog({ consoleEnabled: false });
        log.captureException(new Error('Boom'), 'Crash détecté', { userId: 7 });

        const errors = log.getLogs({ level: 'error', search: 'Crash' });
        assert.equal(errors.length, 1);

        const exported = log.export(false);
        log.clear();
        assert.equal(log.count(), 0);

        const importedCount = log.import(exported);
        assert.equal(importedCount, 1);
        assert.equal(log.count(), 1);

        log.destroy();
        assert.equal(log.count(), 0);
    });
});
