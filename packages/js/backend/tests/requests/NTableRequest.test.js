import { describe, it, assert } from '../test-helper.js';
import { NTableRequest } from '../../index.js';

describe('NTableRequest (requests/NTableRequest.js)', () => {
    it('initialise la table et génère les clauses SQL de recherche et de pagination', () => {
        const tableReq = new NTableRequest({ table: 'clients', primaryKey: 'client_id' });
        assert.equal(tableReq.table, 'clients');
        assert.equal(tableReq.primaryKey, 'client_id');

        const sqlSearch = tableReq.generateSqlSearch('alice paris', ['nom', 'ville']);
        assert.equal(sqlSearch.where.includes('LIKE'), true);

        const paramSearch = tableReq.generateSqlSearchParams('alice paris', ['nom', 'ville']);
        assert.equal(paramSearch.where.includes('LIKE'), true);
        assert.equal(Object.keys(paramSearch.params).length, 4);

        const limited = tableReq.generateSqlLimited(25, 50);
        assert.equal(limited.trim(), 'LIMIT 50, 25');
    });
});
