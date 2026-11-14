/**
 * @file tests/test-helper.js
 * @description Micro-framework de test universel (Navigateur, WebView, Worker et Node.js)
 * sans aucune dépendance externe.
 */

const suites = [];
let currentSuite = null;

export function describe(name, fn) {
    const suite = { name, tests: [] };
    suites.push(suite);
    const prev = currentSuite;
    currentSuite = suite;
    try {
        fn();
    } finally {
        currentSuite = prev;
    }
}

export function it(name, fn) {
    if (!currentSuite) {
        describe('Global', () => {
            currentSuite.tests.push({ name, fn });
        });
        return;
    }
    currentSuite.tests.push({ name, fn });
}

function isDeepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!isDeepEqual(a[key], b[key])) return false;
    }
    return true;
}

export const assert = {
    ok(value, message = 'Assertion assert.ok échouée') {
        if (!value) {
            throw new Error(`${message} (reçu: ${ JSON.stringify(value) })`);
        }
    },
    equal(actual, expected, message = 'Assertion assert.equal échouée') {
        if (actual !== expected) {
            throw new Error(`${message} — attendu: ${JSON.stringify(expected)}, reçu: ${JSON.stringify(actual)}`);
        }
    },
    notEqual(actual, expected, message = 'Assertion assert.notEqual échouée') {
        if (actual === expected) {
            throw new Error(`${message} — valeur non souhaitée: ${JSON.stringify(actual)}`);
        }
    },
    deepEqual(actual, expected, message = 'Assertion assert.deepEqual échouée') {
        if (!isDeepEqual(actual, expected)) {
            throw new Error(`${message} — attendu: ${JSON.stringify(expected)}, reçu: ${JSON.stringify(actual)}`);
        }
    }
};

export async function runAllTests(options = {}) {
    const { log = true } = options;
    let passed = 0;
    let failed = 0;
    const failures = [];
    const resultsBySuite = [];

    for (const suite of suites) {
        const suiteResult = { name: suite.name, passed: 0, failed: 0, tests: [] };
        if (log) console.log(`\n=== ${suite.name} ===`);

        for (const test of suite.tests) {
            const start = Date.now();
            try {
                await test.fn();
                const duration = Date.now() - start;
                passed += 1;
                suiteResult.passed += 1;
                suiteResult.tests.push({ name: test.name, ok: true, duration });
                if (log) console.log(`  [OK] ${test.name} (${duration}ms)`);
            } catch (err) {
                const duration = Date.now() - start;
                failed += 1;
                suiteResult.failed += 1;
                const errorMessage = err instanceof Error ? err.message : String(err);
                suiteResult.tests.push({ name: test.name, ok: false, duration, error: errorMessage });
                failures.push({ suite: suite.name, test: test.name, error: errorMessage });
                if (log) console.error(`  [FAIL] ${test.name} -> ${errorMessage}`);
            }
        }
        resultsBySuite.push(suiteResult);
    }

    if (log) {
        console.log(`\n----------------------------------------`);
        console.log(`Total : ${passed + failed} tests | Réussis : ${passed} | Échoués : ${failed}`);
        console.log(`----------------------------------------`);
    }

    return {
        ok: failed === 0,
        total: passed + failed,
        passed,
        failed,
        failures,
        suites: resultsBySuite
    };
}
