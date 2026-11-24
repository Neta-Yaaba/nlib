import { describe, it, assert } from '../index.js';
import { NLog } from '../../index.js';

describe('NLog (log/NLog.js)', () => {
    it('enregistre les niveaux debug, info, warn, error et gère le contexte par entrée', () => {
        NLog.destroy();
        NLog.configure({ consoleEnabled: false, maxLogs: 10 });
        assert.equal(NLog.isConsoleEnabled, false);
        assert.equal(NLog.maxLogs, 10);

        NLog.debug('Debug msg', { step: 1 }, { app: 'TestApp' });
        NLog.info('Info msg');
        NLog.warn('Warn msg');
        NLog.error('Error msg', { code: 500 });

        assert.equal(NLog.getLogs().length, 4);
        assert.equal(NLog.getLogs({ level: 'error' }).length, 1);
        const lastErr = NLog.getLogs({ level: 'error' }).at(-1);
        assert.equal(lastErr.message, 'Error msg');
        assert.equal(NLog.getLogs({ level: 'debug' })[0].context.app, 'TestApp');
        NLog.destroy();
    });

    it('capture les exceptions, filtre, exporte et importe les journaux', () => {
        NLog.destroy();
        NLog.configure({ consoleEnabled: false, maxLogs: 1000 });
        NLog.captureException(new Error('Boom détecté'), { userId: 7 });

        const errors = NLog.getLogs({ level: 'error', search: 'Boom' });
        assert.equal(errors.length, 1);

        const exported = NLog.export('json');
        NLog.clear();
        assert.equal(NLog.getLogs().length, 0);

        const importedRes = NLog.import(exported);
        assert.equal(importedRes.success, true);
        assert.equal(importedRes.count, 1);
        assert.equal(NLog.getLogs().length, 1);

        NLog.destroy();
        assert.equal(NLog.getLogs().length, 0);
    });

    it('gère NLog.LEVEL, NLog.configure(), setConsoleEnabled, setTraceEnabled et setMaxLogs', () => {
        NLog.destroy();
        NLog.configure({ traceEnabled: false, maxLogs: 5 });
        assert.equal(NLog.isTraceEnabled, false);
        assert.equal(NLog.LEVEL.ERROR, 3);

        NLog.setConsoleEnabled(true).setConsoleEnabled(false);
        assert.equal(NLog.isConsoleEnabled, false);

        NLog.setTraceEnabled(true);
        assert.equal(NLog.isTraceEnabled, true);

        let maxReachedCount = 0;
        NLog.event.on('maxLogs', () => { maxReachedCount += 1; });

        for (let i = 0; i < 6; i++) {
            NLog.write(NLog.LEVEL.INFO, `Opération ${i}`);
        }
        assert.equal(NLog.getLogs().length, 5);
        assert.ok(maxReachedCount >= 1);

        NLog.setMaxLogs(2);
        assert.equal(NLog.getLogs().length, 2);
        assert.equal(NLog.getLogs(null).length, 2);
        NLog.destroy();
    });

    it('gère export(text/raw), import(merge: false), filtrage par contexte/limite et événements', () => {
        NLog.destroy();
        NLog.configure({ traceEnabled: false, maxLogs: 1000 });
        const events = [];
        NLog.event.on('log', (e) => events.push(`log:${e.level}`));
        NLog.event.on('exception', () => events.push('exception'));
        NLog.event.on('import', ({ count }) => events.push(`import:${count}`));
        NLog.event.on('clear', () => events.push('clear'));
        NLog.event.on('beforeDestroy', () => events.push('beforeDestroy'));

        NLog.info('Msg 1', null, 'SQL');
        NLog.warn('Msg 2', null, 'Network');
        const err = new Error('Accès refusé');
        err.code = 403;
        const cap = NLog.captureException(err, { module: 'Auth' });
        assert.equal(cap.success, false);
        assert.equal(cap.code, 403);

        assert.equal(NLog.getLogs({ context: 'sql' }).length, 1);
        assert.equal(NLog.getLogs({ limit: 2 }).length, 2);

        const textOut = NLog.export('text');
        assert.equal(typeof textOut, 'string');
        assert.ok(textOut.includes('[INFO]'));

        const rawOut = NLog.export('raw');
        assert.equal(Array.isArray(rawOut), true);
        assert.equal(rawOut.length, 3);

        const replaceRes = NLog.import([{ message: 'Seul', level: 'WARN' }], { merge: false });
        assert.equal(replaceRes.success, true);
        assert.equal(NLog.getLogs().length, 1);

        const badImport = NLog.import('invalid-json');
        assert.equal(badImport.success, false);
        assert.equal(badImport.count, 0);

        NLog.clear();
        NLog.destroy();
        assert.ok(events.includes('exception'));
        assert.ok(events.includes('import:1'));
        assert.ok(events.includes('clear'));
        assert.ok(events.includes('beforeDestroy'));
    });
});
