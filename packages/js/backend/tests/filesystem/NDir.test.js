import { describe, it, assert } from '../index.js';
import { NDir } from '../../index.js';

describe('NDir (filesystem/NDir.js)', () => {
    it('normalise et décompose les chemins de répertoires', () => {
        assert.equal(NDir.normalizePath('/a/b/c/'), 'a/b/c');
        assert.equal(NDir.joinPath('projets', '2026', 'rapports'), 'projets/2026/rapports');
        assert.equal(NDir.getName('projets/2026/rapports'), 'rapports');
        assert.equal(NDir.getParent('projets/2026/rapports'), 'projets/2026');
        assert.equal(['native', 'fs', 'idb'].includes(NDir.driver), true);
        assert.equal(typeof NDir.isNativeAvailable, 'boolean');
        assert.equal(typeof NDir.isFsApiAvailable, 'boolean');
    });
});
