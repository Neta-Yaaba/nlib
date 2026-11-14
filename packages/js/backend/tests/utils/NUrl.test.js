import { describe, it, assert } from '../test-helper.js';
import { NUrl } from '../../index.js';

describe('NUrl (utils/NUrl.js)', () => {
    const url = new NUrl();

    it('valide, analyse, construit et manipule les paramètres dune URL', () => {
        const built = url.build({
            base: 'https://api.nlib.dev',
            path: ['v1', 'items'],
            query: { page: 2, active: true }
        });
        assert.equal(built, 'https://api.nlib.dev/v1/items?page=2&active=true');
        assert.equal(url.isValid(built, { requireHttps: true }), true);
        assert.equal(url.getDomain(built), 'api.nlib.dev');
        assert.deepEqual(url.getPathSegments(built), ['v1', 'items']);
        assert.equal(url.getQueryParam(built, 'page'), '2');

        const updated = url.removeQueryParams(built, 'active');
        assert.equal(updated, 'https://api.nlib.dev/v1/items?page=2');
    });

    it('encode et décode des identifiants signés (encodeId / decodeId)', () => {
        const token = url.encodeId(12345, 'mon-sel');
        assert.equal(typeof token, 'string');
        assert.equal(url.decodeId(token, 'mon-sel', true), 12345);
        assert.equal(url.decodeId(token, 'mauvais-sel', true), null);
    });
});
