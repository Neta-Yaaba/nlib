/**
 * Test de fumée multi-environnements (Node.js / sans DOM) :
 * Vérifie que toutes les classes publiques de NLib s'importent, s'instancient
 * et se détruisent sans erreur lorsqu'aucune API DOM navigateur n'est présente.
 */
import * as nlib from '../index.js';

const exportedClasses = [
    'NObject', 'NEvent', 'NLog', 'NUtil', 'NString', 'NNumber', 'NDateTime',
    'NAmount', 'NEmail', 'NPhoneNumber', 'NCryptography', 'NUrl', 'NJson',
    'NPassword', 'NArray', 'NConfig', 'NSystem', 'NEnvironment', 'NWorker',
    'NWorkerManager', 'NServiceWorker', 'NNetwork', 'NTableRequest',
    'NRequestManager', 'NService', 'NDataSynchronizer', 'NDatabase',
    'NIndexedDB', 'NSql', 'NStorage', 'NFile', 'NDirectory', 'NCache'
];

export async function runNodeSmokeTests() {
    for (const name of exportedClasses) {
        if (typeof nlib[name] !== 'function') {
            throw new Error(`Export manquant ou invalide : ${name}`);
        }
    }

    const instances = [
        new nlib.NObject({ state: { ok: true } }),
        new nlib.NEvent(),
        new nlib.NLog({ consoleEnabled: false }),
        new nlib.NConfig({ env: 'node' }),
        new nlib.NEnvironment(),
        new nlib.NSystem(),
        new nlib.NString(),
        new nlib.NNumber(),
        new nlib.NDateTime(),
        new nlib.NAmount(),
        new nlib.NEmail(),
        new nlib.NPhoneNumber(),
        new nlib.NCryptography(),
        new nlib.NUrl(),
        new nlib.NJson(),
        new nlib.NPassword(),
        new nlib.NArray(),
        new nlib.NDatabase(),
        new nlib.NIndexedDB(),
        new nlib.NSql(),
        new nlib.NStorage(),
        new nlib.NFile(),
        new nlib.NDirectory(),
        new nlib.NCache(),
        new nlib.NNetwork(),
        new nlib.NTableRequest({ table: 'smoke' }),
        new nlib.NRequestManager(),
        new nlib.NService({ persistLastId: false }),
        new nlib.NDataSynchronizer({ metaDb: { isAvailable: false } }),
        new nlib.NWorker(),
        new nlib.NWorkerManager(),
        new nlib.NServiceWorker()
    ];

    for (const inst of instances) {
        if (typeof inst.destroy === 'function') {
            inst.destroy();
        }
    }

    return { ok: true, checkedClasses: exportedClasses.length };
}
