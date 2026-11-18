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

    it('gère NLog.LEVEL, NLog.create(), setConsoleEnabled, setTraceEnabled, setContext et setMaxLogs', () => {
        const log = NLog.create({ traceEnabled: false, maxLogs: 5 });
        assert.equal(log.isTraceEnabled, false);
        assert.equal(NLog.LEVEL.ERROR, 3);

        log.setConsoleEnabled(true).setConsoleEnabled(false);
        assert.equal(log.isConsoleEnabled, false);

        log.setTraceEnabled(true);
        assert.equal(log.isTraceEnabled, true);

        log.setContext('AuthService');
        assert.equal(log.context, 'AuthService');

        let maxReachedCount = 0;
        log.event.on('maxLogs', () => { maxReachedCount += 1; });

        for (let i = 0; i < 6; i++) {
            log.write(NLog.LEVEL.INFO, `Opération ${i}`);
        }
        assert.equal(log.getLogs().length, 5);
        assert.ok(maxReachedCount >= 1);

        log.setMaxLogs(2);
        assert.equal(log.getLogs().length, 2);
        assert.equal(log.getLogs(null).length, 2);
    });

    it('gère export(text/raw), import(merge: false), filtrage par contexte/limite et événements', () => {
        const log = new NLog({ traceEnabled: false });
        const events = [];
        log.event.on('log', (e) => events.push(`log:${e.level}`));
        log.event.on('exception', () => events.push('exception'));
        log.event.on('import', ({ count }) => events.push(`import:${count}`));
        log.event.on('clear', () => events.push('clear'));
        log.event.on('beforeDestroy', () => events.push('beforeDestroy'));

        log.info('Msg 1', null, 'SQL');
        log.warn('Msg 2', null, 'Network');
        const err = new Error('Accès refusé');
        err.code = 403;
        const cap = log.captureException(err, { module: 'Auth' });
        assert.equal(cap.success, false);
        assert.equal(cap.code, 403);

        assert.equal(log.getLogs({ context: 'sql' }).length, 1);
        assert.equal(log.getLogs({ limit: 2 }).length, 2);

        const textOut = log.export('text');
        assert.equal(typeof textOut, 'string');
        assert.ok(textOut.includes('[INFO]'));

        const rawOut = log.export('raw');
        assert.equal(Array.isArray(rawOut), true);
        assert.equal(rawOut.length, 3);

        const replaceRes = log.import([{ message: 'Seul', level: 'WARN' }], { merge: false });
        assert.equal(replaceRes.success, true);
        assert.equal(log.getLogs().length, 1);

        const badImport = log.import('invalid-json');
        assert.equal(badImport.success, false);
        assert.equal(badImport.count, 0);

        log.clear();
        log.destroy();
        assert.ok(events.includes('exception'));
        assert.ok(events.includes('import:1'));
        assert.ok(events.includes('clear'));
        assert.ok(events.includes('beforeDestroy'));
    });
});
