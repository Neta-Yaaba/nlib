import { describe, it, assert } from '../index.js';
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

    it('gère isHttps, isAbsolute/isRelative, isSameOrigin, equals, setQueryParams, join et normalize', () => {
        assert.equal(url.isHttps('https://nlib.dev'), true);
        assert.equal(url.isAbsolute('https://nlib.dev/a'), true);
        assert.equal(url.isRelative('/api/users'), true);
        assert.equal(url.isSameOrigin('https://nlib.dev/a', 'https://nlib.dev/b'), true);
        assert.equal(url.equals('https://nlib.dev/a?b=2&a=1', 'https://nlib.dev/a/?a=1&b=2', { sortQuery: true, stripTrailingSlash: true }), true);
        assert.equal(url.setQueryParams('https://nlib.dev?a=1', { b: 2 }), 'https://nlib.dev/?a=1&b=2');
        assert.equal(url.join('https://nlib.dev/', '/v1/', '/items'), 'https://nlib.dev/v1/items');
        assert.equal(url.getProtocol('https://nlib.dev'), 'https');
        assert.equal(url.getHash('https://nlib.dev/#top'), 'top');
        const b64u = url.encodeBase64Url('NLib+Test/1');
        assert.equal(url.decodeBase64Url(b64u), 'NLib+Test/1');
    });
});
