import { describe, it, assert } from '../index.js';
import { NTableRequest, NRequestManager, NDataSynchronizer } from '../../index.js';

describe('NTableRequest (requests/NTableRequest.js)', () => {
    it('initialise la table avec sa clé primaire et sync désactivé par défaut', () => {
        const tableReq = new NTableRequest({ table: 'clients', primaryKey: 'client_id' });
        assert.equal(tableReq.table, 'clients');
        assert.equal(tableReq.primaryKey, 'client_id');
        assert.equal(tableReq.syncEnabled, false);
        tableReq.destroy();
    });

    it('exécute la synchronisation via NDataSynchronizer lorsque sync est activé', async () => {
        const rows = new Map();
        const mockSql = {
            async insert(table, data) {
                const id = data.id ?? rows.size + 1;
                rows.set(id, { ...data, id });
                return id;
            },
            async update(table, data, where, params) {
                const id = params?.id;
                if (!rows.has(id)) return 0;
                rows.set(id, { ...rows.get(id), ...data });
                return 1;
            },
            async delete(table, where, params) {
                const id = params?.id;
                return rows.delete(id) ? 1 : 0;
            },
            async selectOne(sql, params) {
                return rows.get(params?.id) || null;
            },
            async select(sql, params) {
                if (params?.id !== undefined) {
                    return rows.has(params.id) ? [rows.get(params.id)] : [];
                }
                return Array.from(rows.values());
            }
        };

        const mockNetwork = {
            isOnline: true,
            async post(url, body) {
                const confirmed = (body.operations || []).map((op) => ({
                    operationId: op.operationId,
                    recordId: op.recordId,
                    version: 1
                }));
                return { ok: true, data: { confirmed } };
            },
            async get() {
                return {
                    ok: true,
                    data: {
                        changes: [
                            { action: 'create', record: { id: 99, nom: 'Serveur', version: 1 }, version: 1 }
                        ],
                        cursor: 'cur-1',
                        hasMore: false
                    }
                };
            }
        };

        const synchronizer = new NDataSynchronizer({ network: mockNetwork });
        const manager = new NRequestManager({ synchronizer });
        const tr = new NTableRequest({
            request: manager,
            table: 'clients',
            primaryKey: 'id',
            db: { sql: mockSql },
            sync: { endpoint: 'https://api.test.local/sync/clients' }
        });

        assert.equal(tr.syncEnabled, true);
        assert.equal(tr.synchronizer, synchronizer);

        await tr.insert({ data: { id: 1, nom: 'Alice' }, isLocalOnly: true });
        assert.equal(rows.get(1).n_local, 2);

        await tr.update({ data: { nom: 'Alice Mod' }, where: 'id = :id', params: { id: 1 }, isLocalOnly: true });
        assert.equal(rows.get(1).n_local, 3);

        const synced = await tr.syncDatas();
        assert.equal(synced, true);
        assert.equal(rows.get(1).n_local, 1);
        assert.equal(rows.get(99).nom, 'Serveur');
        assert.equal(rows.get(99).n_local, 1);

        await tr.delete({ where: 'id = :id', params: { id: 1 }, isLocalOnly: true });
        assert.equal(rows.has(1), false);
        assert.equal(synchronizer.getCollectionStatus('clients').pendingCount, 1);

        tr.disableSync();
        assert.equal(tr.syncEnabled, false);

        tr.destroy();
        manager.destroy();
        synchronizer.destroy();
    });
});
