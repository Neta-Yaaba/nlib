import { describe, it, assert } from '../index.js';
import { NSystem } from '../../index.js';

describe('NSystem (system/NSystem.js)', () => {
    it('expose les métriques matérielles, mesure la durée et génère un snapshot', async () => {
        const sys = new NSystem();
        assert.ok(sys.cpuCores >= 1);
        assert.equal(typeof sys.arch, 'string');
        assert.ok(sys.uptime() >= 0);
        assert.ok(sys.hrtime() >= 0);
        assert.ok(sys.screen && typeof sys.screen.width === 'number');
        assert.ok(sys.network && typeof sys.network.online === 'boolean');

        const measured = await sys.measure('double', async () => 21 * 2);
        assert.equal(measured.result, 42);
        assert.equal(measured.label, 'double');
        assert.ok(measured.durationMs >= 0);

        const battery = await sys.getBattery();
        if (battery !== null) {
            assert.equal(typeof battery.level, 'number');
        }

        const quota = await sys.getStorageQuota();
        assert.equal(typeof quota.usage, 'number');
        assert.equal(typeof quota.quota, 'number');

        const snapshot = await sys.getSnapshot();
        assert.ok(snapshot && typeof snapshot === 'object');
        assert.equal(snapshot.cpuCores, sys.cpuCores);
    });

    it('gère les cas d erreur de measure, presse-papiers, invokeNative, toJSON et destroy', async () => {
        const sys = new NSystem();
        assert.ok(sys.uptime(true) >= 0);
        assert.equal(typeof sys.memory.formattedUsed, 'string');
        assert.equal(sys.deviceMemory === null || typeof sys.deviceMemory === 'number', true);

        const failed = await sys.measure('failTask', () => { throw new Error('Erreur test'); });
        assert.equal(failed.success, false);
        assert.equal(failed.code, 'ERR_MEASURE_EXECUTION');

        assert.equal(await sys.copyToClipboard(''), false);
        assert.equal(typeof await sys.readFromClipboard(), 'string');

        const invalidNative = await sys.invokeNative('');
        assert.equal(invalidNative.success, false);
        assert.equal(invalidNative.code, 'INVALID_ACTION');

        const noAppNative = await sys.invokeNative('ping');
        assert.equal(noAppNative.success, false);

        const json = sys.toJSON();
        assert.equal(json.cpuCores, sys.cpuCores);

        sys.watchNetwork(false);

        assert.equal(typeof sys.getBrowserUrl(), 'string');
        const prevTitle = typeof document !== 'undefined' ? document.title : '';
        sys.setBrowserTitle('NLib Test Title');
        if (typeof document !== 'undefined') {
            assert.equal(document.title, 'NLib Test Title');
            sys.setBrowserTitle(prevTitle);
        }
        assert.equal(typeof await sys.share({}), 'boolean');

        sys.destroy();
        assert.equal(sys.isDestroyed, true);
    });
});
