import { describe, it, assert } from '../index.js';
import { NUrl } from '../../index.js';

describe('NUrl (utils/NUrl.js)', () => {
    it('valide, analyse, construit et manipule les paramètres dune URL', () => {
        const built = NUrl.build({
            base: 'https://api.nlib.dev',
            path: ['v1', 'items'],
            query: { page: 2, active: true }
        });
        assert.equal(built, 'https://api.nlib.dev/v1/items?page=2&active=true');
        assert.equal(NUrl.isValid(built, { requireHttps: true }), true);
        assert.equal(NUrl.getDomain(built), 'api.nlib.dev');
        assert.deepEqual(NUrl.getPathSegments(built), ['v1', 'items']);
        assert.equal(NUrl.getQueryParam(built, 'page'), '2');

        const updated = NUrl.removeQueryParams(built, 'active');
        assert.equal(updated, 'https://api.nlib.dev/v1/items?page=2');
    });

    it('encode et décode des identifiants signés (encodeId / decodeId)', () => {
        const token = NUrl.encodeId(12345, 'mon-sel');
        assert.equal(typeof token, 'string');
        assert.equal(NUrl.decodeId(token, 'mon-sel', true), 12345);
        assert.equal(NUrl.decodeId(token, 'mauvais-sel', true), null);
    });

    it('gère isHttps, isAbsolute/isRelative, isSameOrigin, equals, setQueryParams, join et normalize', () => {
        assert.equal(NUrl.isHttps('https://nlib.dev'), true);
        assert.equal(NUrl.isAbsolute('https://nlib.dev/a'), true);
        assert.equal(NUrl.isRelative('/api/users'), true);
        assert.equal(NUrl.isSameOrigin('https://nlib.dev/a', 'https://nlib.dev/b'), true);
        assert.equal(NUrl.equals('https://nlib.dev/a?b=2&a=1', 'https://nlib.dev/a/?a=1&b=2', { sortQuery: true, stripTrailingSlash: true }), true);
        assert.equal(NUrl.setQueryParams('https://nlib.dev?a=1', { b: 2 }), 'https://nlib.dev/?a=1&b=2');
        assert.equal(NUrl.join('https://nlib.dev/', '/v1/', '/items'), 'https://nlib.dev/v1/items');
        assert.equal(NUrl.getProtocol('https://nlib.dev'), 'https');
        assert.equal(NUrl.getHash('https://nlib.dev/#top'), 'top');
        const b64u = NUrl.encodeBase64Url('NLib+Test/1');
        assert.equal(NUrl.decodeBase64Url(b64u), 'NLib+Test/1');
    });
});
