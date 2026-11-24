/**
 * @file index.js
 * @package @nlib/js-backend
 * @description Point d'entrée public du package `@nlib/js-backend` : ré-exporte toutes les classes
 * de la fondation logique headless de NLib (core, utils, config, system, environment, worker, requests, database).
 */

// Core
export { NObject } from './core/NObject.js';
export { NEvent } from './core/NEvent.js';

// Log & Journalisation
export { NLog } from './log/NLog.js';

// Utils
export { NUtil } from './utils/NUtil.js';
export { NStr } from './utils/NStr.js';
export { NNum } from './utils/NNum.js';
export { NDate } from './utils/NDate.js';
export { NAmount } from './utils/NAmount.js';
export { NEmail } from './utils/NEmail.js';
export { NPhone } from './utils/NPhone.js';
export { NCrypto } from './utils/NCrypto.js';
export { NUrl } from './utils/NUrl.js';
export { NJson } from './utils/NJson.js';
export { NPass } from './utils/NPass.js';
export { NArr } from './utils/NArr.js';

// Config, système & environnement
export { NConfig } from './config/NConfig.js';
export { NSys } from './system/NSys.js';
export { NEnv } from './environment/NEnv.js';

// Workers
export { NWorker } from './worker/NWorker.js';
export { NWorkMgr } from './worker/NWorkMgr.js';
export { NServiceWorker } from './worker/NServiceWorker.js';

// Requêtes réseau & tables
export { NNet } from './requests/NNet.js';
export { NTableRequest } from './requests/NTableRequest.js';
export { NRequestManager } from './requests/NRequestManager.js';
export { NService } from './requests/NService.js';
export { NDataSynchronizer } from './requests/NDataSynchronizer.js';

// Stockage & bases de données
export { NIndexedDB } from './database/NIndexedDB.js';
export { NSql } from './database/NSql.js';
export { NStorage } from './database/NStorage.js';

// Système de fichiers
export { NFile } from './filesystem/NFile.js';
export { NDir } from './filesystem/NDir.js';

// Cache multi-niveaux
export { NCache } from './cache/NCache.js';

// Internationalisation
export { NLang } from './language/NLang.js';




