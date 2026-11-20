import { describe, it, assert } from '../index.js';
import { NLanguage, NObject, NUtil } from '../../index.js';

describe('NLanguage (language/NLanguage.js)', () => {
    it('hérite de NObject, est exposé via NUtil.lang/language et gère les dictionnaires', async () => {
        const lang = new NLanguage();
        assert.equal(lang instanceof NObject, true);
        assert.equal(NUtil.lang instanceof NLanguage, true);
        assert.equal(NUtil.language, NUtil.lang);
        await lang.init({
            language: 'fr-FR',
            fallback: 'en',
            languages: {
                'fr-FR': {
                    save: 'Enregistrer',
                    empty_val: '',
                    user: { create: 'Créer un utilisateur' }
                },
                en: {
                    save: 'Save',
                    only_en: 'Only English',
                    empty_val: 'Fallback'
                }
            }
        });

        assert.equal(lang.getLanguage(), 'fr-FR');
        assert.equal(lang.getFallbackLanguage(), 'en');
        assert.equal(lang.get('save'), 'Enregistrer');
        assert.equal(lang.get('user.create'), 'Créer un utilisateur');
        // Une chaîne vide existante ne déclenche pas le fallback
        assert.equal(lang.get('empty_val'), '');
        // Clé absente de fr-FR -> fallback en
        assert.equal(lang.get('only_en'), 'Only English');
        // Clé inconnue partout -> missingBehavior: 'key'
        assert.equal(lang.get('inconnue.cle'), 'inconnue.cle');

        const missing = lang.getMissing();
        assert.equal(missing.length, 2);
        lang.clearMissing();
        assert.equal(lang.getMissing().length, 0);
    });

    it('interpole les paramètres dynamiques sans récursion ni évaluation et signale les paramètres manquants', async () => {
        const lang = new NLanguage();
        const missingParams = [];
        lang.on('missingParameter', (p) => missingParams.push(p));

        await lang.init({
            language: 'fr',
            fallback: null,
            languages: {
                fr: {
                    welcome: 'Bonjour {name}',
                    info: '{name} possède {count} messages (actif: {active})'
                }
            }
        });

        // Non-récursif : {count} dans name ne doit pas être interprété
        assert.equal(lang.get('welcome', { name: '{count}', count: 9 }), 'Bonjour {count}');
        assert.equal(lang.get('info', { name: 'Madi', count: 5, active: true }), 'Madi possède 5 messages (actif: true)');
        assert.equal(lang.get('welcome', {}), 'Bonjour {name}');
        assert.equal(missingParams.length, 1);
        assert.equal(missingParams[0].parameter, 'name');
    });

    it('gère la pluralisation CLDR avec Intl.PluralRules et fallback', async () => {
        const lang = new NLanguage();
        await lang.init({
            language: 'fr',
            fallback: 'en',
            languages: {
                fr: {
                    messages: {
                        one: '{count} message',
                        other: '{count} messages'
                    }
                },
                en: {
                    alerts: {
                        one: '{count} alert',
                        other: '{count} alerts'
                    }
                }
            }
        });

        assert.equal(lang.plural('messages', { count: 1 }), '1 message');
        assert.equal(lang.plural('messages', { count: 5 }), '5 messages');
        assert.equal(lang.plural('alerts', { count: 2 }), '2 alerts');
    });

    it('gère le chargement différé, la déduplication concurrente, les erreurs, les événements et checkTranslations()', async () => {
        let loaderCalls = 0;
        const events = [];

        const lang = new NLanguage({
            loader: async (code) => {
                loaderCalls += 1;
                await new Promise((r) => setTimeout(r, 15));
                if (code === 'mos') {
                    return JSON.stringify({ save: 'Bĩngi', user: { create: 'Naan' } });
                }
                if (code === 'es') {
                    throw new Error('HTTP 404');
                }
                return { save: code === 'fr' ? 'Enregistrer' : 'Save' };
            }
        });

        lang.on('languageLoaded', (e) => events.push(`loaded:${e.language}`))
            .on('languageChanged', (e) => events.push(`changed:${e.previousLanguage}->${e.language}`));

        await lang.init({ language: 'fr', fallback: 'en' });

        // Chargements simultanés dédupliqués
        await Promise.all([lang.loadLanguage('mos'), lang.loadLanguage('mos')]);
        assert.equal(loaderCalls, 3); // fr + en + 1 seul appel pour mos

        await lang.setLanguage('mos');
        assert.equal(lang.get('save'), 'Bĩngi');
        // Pas d'événement si même langue
        await lang.setLanguage('mos');
        assert.equal(events.filter((e) => e.startsWith('changed:')).length, 1);

        // Erreur de chargement : la langue active reste 'mos'
        let failed = false;
        try {
            await lang.setLanguage('es');
        } catch {
            failed = true;
        }
        assert.equal(failed, true);
        assert.equal(lang.getLanguage(), 'mos');

        // Audit des traductions
        const report = lang.checkTranslations(['save', 'user.create', 'missing.everywhere']);
        assert.equal(report.ok, false);
        assert.equal(report.missingEverywhere.includes('missing.everywhere'), true);
        assert.equal(report.missingByLanguage.fr.includes('user.create'), true);
    });

    it('rejette les objets non simples, bloque la pollution de prototype et détecte les collisions de clés', async () => {
        const lang = new NLanguage();
        await lang.init({ language: 'fr', fallback: 'en' });

        // Rejet d'objets non simples (Date, Map, instance de classe)
        class CustomDict { constructor() { this.hello = 'Bonjour'; } }
        for (const invalid of [new Date(), new Map(), new CustomDict()]) {
            let threw = false;
            try {
                lang.addLanguage('fr', invalid);
            } catch {
                threw = true;
            }
            assert.equal(threw, true);
        }

        // Support des objets sans prototype (Object.create(null))
        const nullProtoDict = Object.assign(Object.create(null), { hello: 'Bonjour' });
        lang.addLanguage('fr', nullProtoDict);
        assert.equal(lang.get('hello'), 'Bonjour');

        // Protection contre la pollution de prototype via JSON externe
        const malicious = JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},"safe":"OK"}');
        lang.addLanguage('fr', malicious, { merge: true });
        assert.equal(({}).polluted, undefined);
        assert.equal(lang.get('safe'), 'OK');

        // Détection des collisions de clés pointées
        let collisionErr = null;
        try {
            lang.addLanguage('en', {
                user: { name: 'Madi' },
                'user.name': 'Autre'
            });
        } catch (err) {
            collisionErr = err;
        }
        assert.equal(Boolean(collisionErr && /user\.name/.test(collisionErr.message)), true);
    });

    it('ignore un chargement asynchrone terminé après unloadLanguage() ou destroy()', async () => {
        let resolveMos;
        let resolveEs;
        const lang = new NLanguage();
        let loadedEvents = 0;
        lang.on('languageLoaded', () => {
            loadedEvents += 1;
        });

        await lang.init({
            language: 'fr',
            fallback: 'en',
            languages: { fr: { save: 'Enregistrer' }, en: { save: 'Save' } },
            loader: (code) => new Promise((resolve) => {
                if (code === 'mos') resolveMos = resolve;
                else if (code === 'es') resolveEs = resolve;
                else resolve({});
            })
        });

        // 1) unloadLanguage() pendant un chargement en vol
        const mosPromise = lang.loadLanguage('mos');
        lang.unloadLanguage('mos');
        resolveMos({ save: 'Bĩngi' });
        const mosResult = await mosPromise;
        assert.equal(mosResult, false);
        assert.equal(lang.hasLanguage('mos'), false);
        assert.equal(lang.get('save', {}, { language: 'mos', fallback: false }), 'save');
        assert.equal(loadedEvents, 0);

        // 2) destroy() pendant un chargement en vol
        const esPromise = lang.loadLanguage('es');
        lang.destroy();
        resolveEs({ save: 'Guardar' });
        const esResult = await esPromise;
        assert.equal(esResult, false);
        assert.equal(loadedEvents, 0);
        assert.equal(await lang.loadLanguage('es'), false);
    });
});
