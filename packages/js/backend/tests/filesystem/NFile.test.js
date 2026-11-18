import { describe, it, assert } from '../test-helper.js';
import { NFile } from '../../index.js';

describe('NFile (filesystem/NFile.js)', () => {
    const file = new NFile();

    it('manipule les chemins, extensions, types MIME et conversions binaires', async () => {
        assert.equal(file.normalizePath('a//b/./c/../doc.txt'), 'a/b/doc.txt');
        assert.equal(file.joinPath('folder', 'sub', 'image.png'), 'folder/sub/image.png');
        assert.equal(file.getFileName('folder/sub/image.png'), 'image.png');
        assert.equal(file.getBaseName('folder/sub/image.png'), 'image');
        assert.equal(file.getExtension('folder/sub/image.png'), 'png');
        assert.equal(file.getMimeType('report.pdf'), 'application/pdf');

        const bytes = await file.toUint8Array('Bonjour');
        assert.equal(bytes instanceof Uint8Array, true);
        const text = await file.toText(bytes);
        assert.equal(text, 'Bonjour');

        const b64 = await file.toBase64('NLib');
        const decoded = await file.toText(file.fromBase64(b64));
        assert.equal(decoded, 'NLib');

        const parts = file.splitPath('docs/2026/rapport.pdf');
        assert.equal(parts.path, 'docs/2026/rapport.pdf');
        assert.equal(parts.directory, 'docs/2026');
        assert.equal(parts.name, 'rapport.pdf');
        assert.equal(parts.baseName, 'rapport');
        assert.equal(parts.extension, 'pdf');
        assert.equal(file.getDirName('docs/2026/rapport.pdf'), 'docs/2026');
        assert.equal(file.getExtension('rapport.pdf', true), '.pdf');
        assert.equal(['native', 'fs', 'idb'].includes(file.driver), true);
        assert.equal(typeof file.isNativeAvailable, 'boolean');
        assert.equal(typeof file.isFsApiAvailable, 'boolean');

        const dataUrl = await file.toDataUrl('Hello', 'text/plain');
        assert.ok(dataUrl.startsWith('data:text/plain;base64,'));
    });
});
