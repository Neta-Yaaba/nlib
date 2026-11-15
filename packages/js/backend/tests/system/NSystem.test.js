import { describe, it, assert } from '../test-helper.js';
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
});
