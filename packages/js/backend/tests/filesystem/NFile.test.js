import { describe, it, assert } from '../index.js';
import { NFile } from '../../index.js';

describe('NFile (filesystem/NFile.js)', () => {
    it('manipule les chemins, extensions, types MIME et conversions binaires', async () => {
        assert.equal(NFile.normalizePath('a//b/./c/../doc.txt'), 'a/b/doc.txt');
        assert.equal(NFile.joinPath('folder', 'sub', 'image.png'), 'folder/sub/image.png');
        assert.equal(NFile.getFileName('folder/sub/image.png'), 'image.png');
        assert.equal(NFile.getBaseName('folder/sub/image.png'), 'image');
        assert.equal(NFile.getExtension('folder/sub/image.png'), 'png');
        assert.equal(NFile.getMimeType('report.pdf'), 'application/pdf');

        const bytes = await NFile.toUint8Array('Bonjour');
        assert.equal(bytes instanceof Uint8Array, true);
        const text = await NFile.toText(bytes);
        assert.equal(text, 'Bonjour');

        const b64 = await NFile.toBase64('NLib');
        const decoded = await NFile.toText(NFile.fromBase64(b64));
        assert.equal(decoded, 'NLib');

        const parts = NFile.splitPath('docs/2026/rapport.pdf');
        assert.equal(parts.path, 'docs/2026/rapport.pdf');
        assert.equal(parts.directory, 'docs/2026');
        assert.equal(parts.name, 'rapport.pdf');
        assert.equal(parts.baseName, 'rapport');
        assert.equal(parts.extension, 'pdf');
        assert.equal(NFile.getDirName('docs/2026/rapport.pdf'), 'docs/2026');
        assert.equal(NFile.getExtension('rapport.pdf', true), '.pdf');
        assert.equal(['native', 'fs', 'idb'].includes(NFile.driver), true);
        assert.equal(typeof NFile.isNativeAvailable, 'boolean');
        assert.equal(typeof NFile.isFsApiAvailable, 'boolean');

        const dataUrl = await NFile.toDataUrl('Hello', 'text/plain');
        assert.ok(dataUrl.startsWith('data:text/plain;base64,'));
    });
});
