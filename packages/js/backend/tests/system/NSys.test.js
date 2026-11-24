import { describe, it, assert } from '../index.js';
import { NSys } from '../../index.js';

describe('NSys (system/NSys.js)', () => {
    it('expose les métriques matérielles, mesure la durée et génère un snapshot', async () => {
        assert.ok(NSys.cpuCores >= 1);
        assert.equal(typeof NSys.arch, 'string');
        assert.ok(NSys.uptime() >= 0);
        assert.ok(NSys.hrtime() >= 0);
        assert.ok(NSys.screen && typeof NSys.screen.width === 'number');
        assert.ok(NSys.network && typeof NSys.network.online === 'boolean');

        const measured = await NSys.measure('double', async () => 21 * 2);
        assert.equal(measured.result, 42);
        assert.equal(measured.label, 'double');
        assert.ok(measured.durationMs >= 0);

        const battery = await NSys.getBattery();
        if (battery !== null) {
            assert.equal(typeof battery.level, 'number');
        }

        const quota = await NSys.getStorageQuota();
        assert.equal(typeof quota.usage, 'number');
        assert.equal(typeof quota.quota, 'number');

        const snapshot = await NSys.getSnapshot();
        assert.ok(snapshot && typeof snapshot === 'object');
        assert.equal(snapshot.cpuCores, NSys.cpuCores);
    });

    it('gère les cas d erreur de measure, presse-papiers, invokeNative et toJSON', async () => {
        assert.ok(NSys.uptime(true) >= 0);
        assert.equal(typeof NSys.memory.formattedUsed, 'string');
        assert.equal(NSys.deviceMemory === null || typeof NSys.deviceMemory === 'number', true);

        const failed = await NSys.measure('failTask', () => { throw new Error('Erreur test'); });
        assert.equal(failed.success, false);
        assert.equal(failed.code, 'ERR_MEASURE_EXECUTION');

        assert.equal(await NSys.copyToClipboard(''), false);
        assert.equal(typeof await NSys.readFromClipboard(), 'string');

        const invalidNative = await NSys.invokeNative('');
        assert.equal(invalidNative.success, false);
        assert.equal(invalidNative.code, 'INVALID_ACTION');

        const noAppNative = await NSys.invokeNative('ping');
        assert.equal(noAppNative.success, false);

        const json = NSys.toJSON();
        assert.equal(json.cpuCores, NSys.cpuCores);

        NSys.watchNetwork(false);

        assert.equal(typeof NSys.getBrowserUrl(), 'string');
        const prevTitle = typeof document !== 'undefined' ? document.title : '';
        NSys.setBrowserTitle('NLib Test Title');
        if (typeof document !== 'undefined') {
            assert.equal(document.title, 'NLib Test Title');
            NSys.setBrowserTitle(prevTitle);
        }
        assert.equal(typeof await NSys.share({}), 'boolean');
    });
});
