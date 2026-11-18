import { describe, it, assert } from '../test-helper.js';
import { NDirectory } from '../../index.js';

describe('NDirectory (filesystem/NDirectory.js)', () => {
    const dir = new NDirectory();

    it('normalise et décompose les chemins de répertoires', () => {
        assert.equal(dir.normalizePath('/a/b/c/'), 'a/b/c');
        assert.equal(dir.joinPath('projets', '2026', 'rapports'), 'projets/2026/rapports');
        assert.equal(dir.getName('projets/2026/rapports'), 'rapports');
        assert.equal(dir.getParent('projets/2026/rapports'), 'projets/2026');
        assert.equal(['native', 'fs', 'idb'].includes(dir.driver), true);
        assert.equal(typeof dir.isNativeAvailable, 'boolean');
        assert.equal(typeof dir.isFsApiAvailable, 'boolean');
    });
});
