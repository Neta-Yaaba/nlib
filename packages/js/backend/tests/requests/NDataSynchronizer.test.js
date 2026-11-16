import { describe, it, assert } from '../test-helper.js';
import { NDataSynchronizer } from '../../index.js';

/**
 * Simule un stockage applicatif externe (ex: NIndexedDB/NSql géré par l'appelant)
 * connecté à NDataSynchronizer uniquement via les événements ('apply', 'confirmed').
 */
function createAppStore({ failOnPutId = null } = {}) {
    const data = new Map();
    return {
        data,
        attach(sync) {
            sync.on('apply', ({ collection, action, recordId, record, waitUntil, reject }) => {
                waitUntil((async () => {
                    if (failOnPutId && recordId === failOnPutId) {
                        reject();
                        return false;
                    }
                    const key = `${collection}:${recordId}`;
                    if (action === 'delete') {
                        data.delete(key);
                    } else if (record) {
                        data.set(key, structuredClone(record));
                    }
                    return true;
                })());
            });
        }
    };
}

function createMockMetaDb() {
    const stores = new Map();
    const getStore = (name) => {
        if (!stores.has(name)) stores.set(name, new Map());
        return stores.get(name);
    };
    return {
        isAvailable: true,
        async put(storeName, value) {
            const pk = storeName === 'outbox'
                ? value?.operationId
                : (storeName === 'conflicts' ? value?.conflictId : value?.collection);
            getStore(storeName).set(pk, structuredClone(value));
            return { ok: true, data: pk };
        },
        async get(storeName, key) {
            return { ok: true, data: getStore(storeName).get(key) ?? null };
        },
        async getAll(storeName) {
            return { ok: true, data: Array.from(getStore(storeName).values()) };
        },
        async delete(storeName, key) {
            getStore(storeName).delete(key);
            return { ok: true, data: true };
        },
        close() {}
    };
}

describe('NDataSynchronizer (requests/NDataSynchronizer.js)', () => {
    it('1. exécute une synchronisation normale Push + Pull via événements apply/confirmed', async () => {
        const metaDb = createMockMetaDb();
        const appStore = createAppStore();
        const confirmedEvents = [];

        const network = {
            async post(_url, body) {
                return {
                    ok: true,
                    status: 200,
                    data: {
                        confirmed: body.operations.map((o) => ({ operationId: o.operationId, version: 1 })),
                        conflicts: [],
                        failed: []
                    }
                };
            },
            async get() {
                return {
                    ok: true,
                    status: 200,
                    data: {
                        changes: [{ action: 'create', recordId: 'c2', version: 1, data: { id: 'c2', nom: 'Serveur', version: 1 } }],
                        nextCursor: 'cur_1',
                        hasMore: false
                    }
                };
            }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        appStore.attach(sync);
        sync.on('confirmed', (ev) => confirmedEvents.push(ev));

        await sync.trackChange('clients', 'create', { id: 'c1', nom: 'Local', version: 0 });
        const res = await sync.sync('clients');

        assert.equal(res.ok, true);
        assert.equal(res.pushed, 1);
        assert.equal(res.pulled, 1);
        assert.equal(confirmedEvents.length, 1);
        assert.equal(appStore.data.get('clients:c2').nom, 'Serveur');
        assert.equal(sync.getCollectionStatus('clients').cursor, 'cur_1');
        assert.equal(sync.getCollectionStatus('clients').pendingCount, 0);
    });

    it('2. gère une synchronisation sans connexion en conservant les opérations', async () => {
        const metaDb = createMockMetaDb();
        const network = {
            async post() { return { ok: false, status: 0, statusText: 'OFFLINE', data: null }; },
            async get() { return { ok: false, status: 0, statusText: 'OFFLINE', data: null }; }
        };

        const sync = new NDataSynchronizer({ metaDb, network, retry: { maxAttempts: 1, baseDelayMs: 50 } });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });

        await sync.trackChange('clients', 'create', { id: 'c1', nom: 'HorsLigne' });
        const res = await sync.sync('clients');

        assert.equal(res.ok, false);
        assert.equal(sync.getCollectionStatus('clients').pendingCount, 1);
    });

    it('3. conserve les opérations non confirmées lors d\'une interruption pendant le Push', async () => {
        const metaDb = createMockMetaDb();
        let call = 0;

        const network = {
            async post(_url, body) {
                call += 1;
                if (call === 1) {
                    return {
                        ok: true,
                        status: 200,
                        data: { confirmed: [{ operationId: body.operations[0].operationId, version: 1 }], conflicts: [], failed: [] }
                    };
                }
                return { ok: false, status: 503, statusText: 'INTERRUPTED', data: null };
            },
            async get() { return { ok: true, status: 200, data: { changes: [], nextCursor: null, hasMore: false } }; }
        };

        const sync = new NDataSynchronizer({ metaDb, network, retry: { maxAttempts: 1, baseDelayMs: 50 } });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients', batchSize: 1 });

        await sync.trackChange('clients', 'create', { id: 'c1', nom: 'Un' });
        await sync.trackChange('clients', 'create', { id: 'c2', nom: 'Deux' });

        const res = await sync.push('clients');
        assert.equal(res.ok, false);
        assert.equal(res.pushed, 1);
        assert.equal(sync.getCollectionStatus('clients').pendingCount, 1);
    });

    it('4. n\'avance pas le curseur si l\'application locale (apply) échoue pendant le Pull', async () => {
        const metaDb = createMockMetaDb();
        const appStore = createAppStore({ failOnPutId: 'c2' });

        const network = {
            async post() { return { ok: true, status: 200, data: { confirmed: [], conflicts: [], failed: [] } }; },
            async get() {
                return {
                    ok: true,
                    status: 200,
                    data: {
                        changes: [
                            { action: 'create', recordId: 'c1', version: 1, data: { id: 'c1', nom: 'OK' } },
                            { action: 'create', recordId: 'c2', version: 1, data: { id: 'c2', nom: 'Echec' } }
                        ],
                        nextCursor: 'cur_2',
                        hasMore: false
                    }
                };
            }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        appStore.attach(sync);

        const res = await sync.pull('clients');
        assert.equal(res.ok, false);
        assert.equal(sync.getCollectionStatus('clients').cursor, null);
    });

    it('5. reprend les opérations et le curseur après fermeture et réouverture (restart)', async () => {
        const sharedMetaDb = createMockMetaDb();
        const networkOffline = {
            async post() { return { ok: false, status: 0, statusText: 'OFFLINE', data: null }; },
            async get() { return { ok: false, status: 0, statusText: 'OFFLINE', data: null }; }
        };

        const sync1 = new NDataSynchronizer({ metaDb: sharedMetaDb, network: networkOffline, retry: { maxAttempts: 1, baseDelayMs: 50 } });
        sync1.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        await sync1.trackChange('clients', 'create', { id: 'c1', nom: 'Persiste' });
        await sync1.sync('clients');
        sync1.destroy();

        const networkOnline = {
            async post(_url, body) {
                return {
                    ok: true,
                    status: 200,
                    data: { confirmed: body.operations.map((o) => ({ operationId: o.operationId, version: 1 })), conflicts: [], failed: [] }
                };
            },
            async get() { return { ok: true, status: 200, data: { changes: [], nextCursor: 'cur_reprise', hasMore: false } }; }
        };

        const sync2 = new NDataSynchronizer({ metaDb: sharedMetaDb, network: networkOnline });
        sync2.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        const res2 = await sync2.sync('clients');

        assert.equal(res2.ok, true);
        assert.equal(res2.pushed, 1);
        assert.equal(sync2.getCollectionStatus('clients').cursor, 'cur_reprise');
    });

    it('6. fusionne deux synchronisations lancées simultanément sur la même collection', async () => {
        const metaDb = createMockMetaDb();
        let networkCalls = 0;

        const network = {
            async post() { return { ok: true, status: 200, data: { confirmed: [], conflicts: [], failed: [] } }; },
            async get() {
                networkCalls += 1;
                await new Promise((r) => setTimeout(r, 20));
                return { ok: true, status: 200, data: { changes: [], nextCursor: 'c1', hasMore: false } };
            }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });

        const [r1, r2] = await Promise.all([sync.sync('clients'), sync.sync('clients')]);
        assert.equal(networkCalls, 1);
        assert.equal(r1.ok, true);
        assert.equal(r2.ok, true);
    });

    it('7. conserve un operationId unique identique lors des nouvelles tentatives (anti-doublon)', async () => {
        const metaDb = createMockMetaDb();
        const seenOpIds = [];

        const network = {
            async post(_url, body) {
                seenOpIds.push(body.operations[0].operationId);
                if (seenOpIds.length === 1) {
                    return { ok: false, status: 500, statusText: 'RETRY', data: null };
                }
                return {
                    ok: true,
                    status: 200,
                    data: { confirmed: [{ operationId: body.operations[0].operationId, version: 1 }], conflicts: [], failed: [] }
                };
            },
            async get() { return { ok: true, status: 200, data: { changes: [], nextCursor: null, hasMore: false } }; }
        };

        const sync = new NDataSynchronizer({ metaDb, network, retry: { maxAttempts: 2, baseDelayMs: 50 } });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        await sync.trackChange('clients', 'create', { id: 'c1', nom: 'Idempotent' });

        const res = await sync.push('clients');
        assert.equal(res.ok, true);
        assert.equal(seenOpIds.length, 2);
        assert.equal(seenOpIds[0], seenOpIds[1]);
    });

    it('8. détecte et résout un conflit (manual puis serverWins via événement apply)', async () => {
        const metaDb = createMockMetaDb();
        const appStore = createAppStore();
        let capturedConflict = null;

        const network = {
            async post(_url, body) {
                return {
                    ok: true,
                    status: 200,
                    data: {
                        confirmed: [],
                        conflicts: [{
                            operationId: body.operations[0].operationId,
                            recordId: 'c1',
                            clientVersion: 1,
                            serverVersion: 2,
                            serverRecord: { id: 'c1', nom: 'ServeurV2', version: 2 }
                        }],
                        failed: []
                    }
                };
            },
            async get() { return { ok: true, status: 200, data: { changes: [], nextCursor: null, hasMore: false } }; }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients', conflictStrategy: 'manual' });
        appStore.attach(sync);
        sync.on('conflict', (c) => { capturedConflict = c; });

        await sync.trackChange('clients', 'update', { id: 'c1', nom: 'ClientV1', version: 1 });
        await sync.push('clients');

        assert.ok(capturedConflict);
        assert.equal(capturedConflict.resolved, false);
        assert.equal(sync.getCollectionStatus('clients').conflictCount, 1);

        const resolved = await sync.resolveConflict(capturedConflict.conflictId, 'serverWins');
        assert.equal(resolved, true);
        assert.equal(appStore.data.get('clients:c1').nom, 'ServeurV2');
        assert.equal(sync.getCollectionStatus('clients').conflictCount, 0);
    });

    it('9. émet une suppression distante lors du Pull', async () => {
        const metaDb = createMockMetaDb();
        const appStore = createAppStore();
        appStore.data.set('clients:c1', { id: 'c1', nom: 'ASupprimer', version: 1 });

        const network = {
            async post() { return { ok: true, status: 200, data: { confirmed: [], conflicts: [], failed: [] } }; },
            async get() {
                return {
                    ok: true,
                    status: 200,
                    data: { changes: [{ action: 'delete', recordId: 'c1', version: 2 }], nextCursor: 'cur_del', hasMore: false }
                };
            }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        appStore.attach(sync);

        const res = await sync.pull('clients');
        assert.equal(res.ok, true);
        assert.equal(appStore.data.has('clients:c1'), false);
    });

    it('10. signale une erreur lors de l\'application locale et préserve le curseur', async () => {
        const metaDb = createMockMetaDb();
        const appStore = createAppStore({ failOnPutId: 'bad' });
        let errorEvent = null;

        const network = {
            async post() { return { ok: true, status: 200, data: { confirmed: [], conflicts: [], failed: [] } }; },
            async get() {
                return {
                    ok: true,
                    status: 200,
                    data: { changes: [{ action: 'create', recordId: 'bad', data: { id: 'bad' } }], nextCursor: 'cur_err', hasMore: false }
                };
            }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        appStore.attach(sync);
        sync.on('error', (e) => { errorEvent = e; });

        const res = await sync.pull('clients');
        assert.equal(res.ok, false);
        assert.ok(errorEvent);
        assert.equal(sync.getCollectionStatus('clients').cursor, null);
    });

    it('11. synchronise plusieurs collections indépendamment', async () => {
        const metaDb = createMockMetaDb();

        const network = {
            async post(_url, body) {
                return {
                    ok: true,
                    status: 200,
                    data: { confirmed: body.operations.map((o) => ({ operationId: o.operationId, version: 1 })), conflicts: [], failed: [] }
                };
            },
            async get(url) {
                const cursor = url.includes('clients') ? 'cur_c' : 'cur_p';
                return { ok: true, status: 200, data: { changes: [], nextCursor: cursor, hasMore: false } };
            }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        sync.register('produits', { endpoint: 'https://api.nlib.dev/sync/produits' });

        await sync.trackChange('clients', 'create', { id: 'c1', nom: 'A' });
        await sync.trackChange('produits', 'create', { id: 'p1', label: 'Pain' });

        const res = await sync.sync('clients');
        assert.equal(res.pushed, 1);
        assert.equal(sync.getCollectionStatus('clients').pendingCount, 0);
        assert.equal(sync.getCollectionStatus('produits').pendingCount, 1);
    });

    it('12. gère une synchronisation partielle (pagination Pull multi-pages)', async () => {
        const metaDb = createMockMetaDb();
        const appStore = createAppStore();
        let pageCalls = 0;

        const network = {
            async post() { return { ok: true, status: 200, data: { confirmed: [], conflicts: [], failed: [] } }; },
            async get(_url, opts) {
                pageCalls += 1;
                if (!opts?.params?.cursor) {
                    return {
                        ok: true,
                        status: 200,
                        data: {
                            changes: [{ action: 'create', recordId: 'p1', data: { id: 'p1', nom: 'Page1' } }],
                            nextCursor: 'page_2',
                            hasMore: true
                        }
                    };
                }
                return {
                    ok: true,
                    status: 200,
                    data: {
                        changes: [{ action: 'create', recordId: 'p2', data: { id: 'p2', nom: 'Page2' } }],
                        nextCursor: 'page_done',
                        hasMore: false
                    }
                };
            }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('produits', { endpoint: 'https://api.nlib.dev/sync/produits', pullLimit: 1 });
        appStore.attach(sync);

        const res = await sync.pull('produits');
        assert.equal(res.ok, true);
        assert.equal(res.pulled, 2);
        assert.equal(pageCalls, 2);
        assert.equal(appStore.data.get('produits:p1').nom, 'Page1');
        assert.equal(appStore.data.get('produits:p2').nom, 'Page2');
        assert.equal(sync.getCollectionStatus('produits').cursor, 'page_done');
    });

    it('13. valide strictement les confirmations serveur (inconnue, étrangère, dupliquée, malformée, partielle)', async () => {
        const metaDb = createMockMetaDb();
        const network = {
            async post(_url, body) {
                const op1 = body.operations[0].operationId;
                const op2 = body.operations[1].operationId;
                return {
                    ok: true,
                    status: 200,
                    data: {
                        confirmed: [
                            { operationId: op1, version: 1 },
                            { operationId: op1, version: 1 }, // dupliquée
                            { operationId: 'op_inconnue' },   // inconnue
                            { operationId: 'op_autre_col' },  // étrangère
                            null,                             // malformée
                            { operationId: op2, ok: false }   // refusée dans confirmed
                        ],
                        conflicts: [],
                        failed: [{ operationId: op2, error: 'VALIDATION_ERROR' }]
                        // op3 absente de la réponse
                    }
                };
            },
            async get() { return { ok: true, status: 200, data: { changes: [], nextCursor: null, hasMore: false } }; }
        };

        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        sync.register('produits', { endpoint: 'https://api.nlib.dev/sync/produits' });

        await sync.trackChange('produits', 'create', { id: 'p_other', nom: 'Autre' }, { operationId: 'op_autre_col' });
        const op1 = await sync.trackChange('clients', 'create', { id: 'c1', nom: 'A' });
        const op2 = await sync.trackChange('clients', 'create', { id: 'c2', nom: 'B' });
        const op3 = await sync.trackChange('clients', 'create', { id: 'c3', nom: 'C' });

        const res = await sync.push('clients');
        assert.equal(res.ok, false); // op2 rejetée
        assert.equal(res.pushed, 1);  // seule op1 confirmée une fois

        const st = sync.getCollectionStatus('clients');
        assert.equal(st.confirmedCount, 1);
        assert.equal(st.ignoredCount, 5);
        assert.equal(st.pendingCount, 2); // op2 + op3 restent dans outbox

        const outboxAll = (await metaDb.getAll('outbox')).data;
        const idsInOutbox = new Set(outboxAll.map((o) => o.operationId));
        assert.equal(idsInOutbox.has(op1.operationId), false);
        assert.equal(idsInOutbox.has(op2.operationId), true);
        assert.equal(idsInOutbox.has(op3.operationId), true);
        assert.equal(idsInOutbox.has('op_autre_col'), true);

        const persistedOp2 = outboxAll.find((o) => o.operationId === op2.operationId);
        assert.equal(persistedOp2.attempts, 1);
        assert.equal(persistedOp2.lastError, 'VALIDATION_ERROR');
    });

    it('14. gère absence, échec synchrone, exception et échec asynchrone de l\'écouteur apply sans avancer le curseur', async () => {
        const metaDb = createMockMetaDb();
        const network = {
            async post() { return { ok: true, status: 200, data: { confirmed: [], conflicts: [], failed: [] } }; },
            async get() {
                return {
                    ok: true,
                    status: 200,
                    data: {
                        changes: [{ action: 'create', recordId: 'c1', version: 1, data: { id: 'c1', nom: 'Srv' } }],
                        nextCursor: 'cur_applied',
                        hasMore: false
                    }
                };
            }
        };

        // 1. Aucun écouteur apply
        const sync = new NDataSynchronizer({ metaDb, network });
        sync.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        const rNoListener = await sync.pull('clients');
        assert.equal(rNoListener.ok, false);
        assert.equal(sync.getCollectionStatus('clients').cursor, null);

        // 2. Écouteur retourne false
        const returnFalse = () => false;
        sync.on('apply', returnFalse);
        assert.equal((await sync.pull('clients')).ok, false);
        assert.equal(sync.getCollectionStatus('clients').cursor, null);
        sync.off('apply', returnFalse);

        // 3. Écouteur lève une exception synchrone
        const throwSync = () => { throw new Error('boom'); };
        sync.on('apply', throwSync);
        assert.equal((await sync.pull('clients')).ok, false);
        assert.equal(sync.getCollectionStatus('clients').cursor, null);
        sync.off('apply', throwSync);

        // 4. Écouteur async qui échoue sans waitUntil
        const failAsync = async () => { throw new Error('async-boom'); };
        sync.on('apply', failAsync);
        assert.equal((await sync.pull('clients')).ok, false);
        assert.equal(sync.getCollectionStatus('clients').cursor, null);
        sync.off('apply', failAsync);

        // 5. Enregistrement ultérieur d'un écouteur valide : la reprise applique et avance le curseur
        const appStore = createAppStore();
        appStore.attach(sync);
        const rOk = await sync.pull('clients');
        assert.equal(rOk.ok, true);
        assert.equal(rOk.pulled, 1);
        assert.equal(appStore.data.get('clients:c1').nom, 'Srv');
        assert.equal(sync.getCollectionStatus('clients').cursor, 'cur_applied');
    });

    it('15. renforce la gestion des conflits (clientWins, merge valide/invalide, exception, non-répétition)', async () => {
        const metaDb = createMockMetaDb();
        const appStore = createAppStore();
        const network = {
            async post() { return { ok: true, status: 200, data: { confirmed: [], conflicts: [], failed: [] } }; },
            async get() {
                return {
                    ok: true,
                    status: 200,
                    data: {
                        changes: [{ action: 'update', recordId: 'c1', version: 2, data: { id: 'c1', nom: 'Serveur', version: 2 } }],
                        nextCursor: 'cur_c1',
                        hasMore: false
                    }
                };
            }
        };

        // 1. mergeResolver retournant [] (invalide) -> bascule en manual sans supprimer outbox
        const syncInvalidMerge = new NDataSynchronizer({ metaDb, network });
        syncInvalidMerge.register('clients', {
            endpoint: 'https://api.nlib.dev/sync/clients',
            conflictStrategy: 'merge',
            mergeResolver: () => []
        });
        appStore.attach(syncInvalidMerge);
        const op = await syncInvalidMerge.trackChange('clients', 'update', { id: 'c1', nom: 'Local', version: 1 });
        await syncInvalidMerge.pull('clients');

        assert.equal((await metaDb.getAll('conflicts')).data.length, 1);
        assert.ok(await metaDb.get('outbox', op.operationId));

        // Un second pull identique ne duplique pas le conflit en base
        await syncInvalidMerge.pull('clients');
        assert.equal((await metaDb.getAll('conflicts')).data.length, 1);

        // 2. mergeResolver lève une exception -> bascule en manual
        const metaDb2 = createMockMetaDb();
        const syncThrowMerge = new NDataSynchronizer({ metaDb: metaDb2, network });
        syncThrowMerge.register('clients', {
            endpoint: 'https://api.nlib.dev/sync/clients',
            conflictStrategy: 'merge',
            mergeResolver: () => { throw new Error('merge error'); }
        });
        appStore.attach(syncThrowMerge);
        await syncThrowMerge.trackChange('clients', 'update', { id: 'c1', nom: 'Local', version: 1 });
        await syncThrowMerge.pull('clients');
        const cList = (await metaDb2.getAll('conflicts')).data;
        assert.equal(cList.length, 1);
        assert.equal(cList[0].mergeError, 'merge error');

        // 3. merge valide + clientWins sans boucle infinie
        const metaDb3 = createMockMetaDb();
        const syncMergeOk = new NDataSynchronizer({ metaDb: metaDb3, network });
        syncMergeOk.register('clients', {
            endpoint: 'https://api.nlib.dev/sync/clients',
            conflictStrategy: 'merge',
            mergeResolver: ({ clientRecord, serverRecord }) => ({ ...serverRecord, nom: `${clientRecord.nom}+${serverRecord.nom}` })
        });
        appStore.attach(syncMergeOk);
        const origOp = await syncMergeOk.trackChange('clients', 'update', { id: 'c1', nom: 'Local', version: 1 });
        await syncMergeOk.pull('clients');

        assert.equal(appStore.data.get('clients:c1').nom, 'Local+Serveur');
        assert.equal((await metaDb3.get('outbox', origOp.operationId)).data, null);
        const newOutbox = (await metaDb3.getAll('outbox')).data;
        assert.equal(newOutbox.length, 1);
        assert.equal(newOutbox[0].force, true);
        assert.equal(newOutbox[0].baseVersion, 2);

        // Un second pull sur la même version serveur ne génère pas de boucle de conflit
        await syncMergeOk.pull('clients');
        assert.equal((await metaDb3.getAll('conflicts')).data.length, 0);
    });

    it('16. garantit la reprise après échecs répétés et signale le mode mémoire non durable', async () => {
        const syncMem = new NDataSynchronizer({
            metaDb: { isAvailable: false },
            network: { async post() { return { ok: true, data: { confirmed: [] } }; }, async get() { return { ok: true, data: { changes: [], hasMore: false } }; } }
        });
        assert.equal(syncMem.getStatus().isPersistent, false);
        assert.equal(syncMem.getStatus().persistenceMode, 'memory');

        const metaDb = createMockMetaDb();
        let attemptCall = 0;
        const network = {
            async post(_url, body) {
                attemptCall += 1;
                if (attemptCall <= 2) {
                    return { ok: false, status: 500, statusText: 'TEMP_FAIL', data: null };
                }
                return {
                    ok: true,
                    status: 200,
                    data: { confirmed: body.operations.map((o) => ({ operationId: o.operationId, version: 1 })), conflicts: [], failed: [] }
                };
            },
            async get() { return { ok: true, status: 200, data: { changes: [], nextCursor: 'cur_ok', hasMore: false } }; }
        };

        const sync1 = new NDataSynchronizer({ metaDb, network, retry: { maxAttempts: 1, baseDelayMs: 50 } });
        sync1.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        const op = await sync1.trackChange('clients', 'create', { id: 'c1', nom: 'Retry' });

        await sync1.push('clients');
        await sync1.push('clients');
        const persisted = (await metaDb.get('outbox', op.operationId)).data;
        assert.equal(persisted.attempts, 2);
        assert.equal(persisted.lastError, 'TEMP_FAIL');
        sync1.destroy();

        const sync2 = new NDataSynchronizer({ metaDb, network, retry: { maxAttempts: 1, baseDelayMs: 50 } });
        sync2.register('clients', { endpoint: 'https://api.nlib.dev/sync/clients' });
        const res3 = await sync2.sync('clients');
        assert.equal(res3.ok, true);
        assert.equal(res3.pushed, 1);
        assert.equal((await metaDb.get('outbox', op.operationId)).data, null);
    });
});
