/**
 * @file tests/index.js
 * @description Point d'entrée principal exécutant les fichiers de test de `@nlib/js-frontend`
 * (organisés dans les mêmes sous-dossiers que `packages/js/frontend/`).
 */

import { runAllTests } from '../../backend/tests/test-helper.js';

// 1. dom/
import './dom/NTag.test.js';

export { runAllTests };

// Exécution automatique hors navigateur (tests.html appelle runAllTests() directement)
if (typeof document === 'undefined') {
    runAllTests();
}
