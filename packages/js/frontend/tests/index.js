/**
 * @file tests/index.js
 * @description Point d'entrée principal exécutant les fichiers de test de `@nlib/js-frontend`
 * (organisés dans les mêmes sous-dossiers que `packages/js/frontend/`).
 */

import { runAllTests } from '../../backend/tests/test-helper.js';

// 1. dom/elements/
import './dom/elements/NTag.test.js';
import './dom/elements/NImage.test.js';
import './dom/elements/NMedia.test.js';
import './dom/elements/NVideo.test.js';
import './dom/elements/NAudio.test.js';
import './dom/elements/NButton.test.js';
import './dom/elements/NInput.test.js';

export { runAllTests };

// Exécution automatique hors navigateur (tests.html appelle runAllTests() directement)
if (typeof document === 'undefined') {
    runAllTests();
}
