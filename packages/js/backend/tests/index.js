/**
 * @file tests/index.js
 * @description Point d'entrée principal exécutant les 30 fichiers de test de `@nlib/js-backend`
 * (organisés dans les mêmes sous-dossiers que `packages/js/backend/`).
 */

import { runAllTests } from './test-helper.js';

// 1. core/
import './core/NObject.test.js';
import './core/NEvent.test.js';

// 2. log/
import './log/NLog.test.js';

// 3. config/
import './config/NConfig.test.js';

// 4. environment/
import './environment/NEnvironment.test.js';

// 5. system/
import './system/NSystem.test.js';

// 6. utils/
import './utils/NUtil.test.js';
import './utils/NCryptography.test.js';
import './utils/NString.test.js';
import './utils/NNumber.test.js';
import './utils/NDateTime.test.js';
import './utils/NAmount.test.js';
import './utils/NEmail.test.js';
import './utils/NPhoneNumber.test.js';
import './utils/NUrl.test.js';
import './utils/NJson.test.js';
import './utils/NPassword.test.js';
import './utils/NArray.test.js';

// 7. database/
import './database/NDatabase.test.js';
import './database/NSql.test.js';
import './database/NIndexedDB.test.js';
import './database/NStorage.test.js';

// 8. filesystem/
import './filesystem/NFile.test.js';
import './filesystem/NDirectory.test.js';

// 9. cache/
import './cache/NCache.test.js';

// 10. requests/
import './requests/NNetwork.test.js';
import './requests/NTableRequest.test.js';
import './requests/NRequestManager.test.js';
import './requests/NService.test.js';
import './requests/NDataSynchronizer.test.js';

// 11. worker/
import './worker/NWorker.test.js';
import './worker/NWorkerManager.test.js';
import './worker/NServiceWorker.test.js';

export { runAllTests };

// Exécution automatique hors navigateur (tests.html appelle runAllTests() directement)
if (typeof document === 'undefined') {
    runAllTests();
}
