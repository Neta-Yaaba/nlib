import { describe, it, assert } from '../index.js';
import { NLang, NObject, NIndexedDB } from '../../index.js';

describe('NLang (language/NLang.js)', () => {
    it('hérite de NObject, expose instance() et gère les dictionnaires', async () => {
        NLang.destroy();
        const obj = new NObject();
        assert.equal(obj.lang, NLang);
        await NLang.init({
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

        assert.equal(NLang.getLanguage(), 'fr-FR');
        assert.equal(NLang.getFallbackLanguage(), 'en');
        assert.equal(NLang.get('save'), 'Enregistrer');
        assert.equal(NLang.get('user.create'), 'Créer un utilisateur');
        // Une chaîne vide existante ne déclenche pas le fallback
        assert.equal(NLang.get('empty_val'), '');
        // Clé absente de fr-FR -> fallback en
        assert.equal(NLang.get('only_en'), 'Only English');
        // Clé inconnue partout -> missingBehavior: 'key'
        assert.equal(NLang.get('inconnue.cle'), 'inconnue.cle');

        const missing = NLang.getMissing();
        assert.equal(missing.length, 2);
        NLang.clearMissing();
        assert.equal(NLang.getMissing().length, 0);
    });

    it('interpole les paramètres dynamiques sans récursion ni évaluation et signale les paramètres manquants', async () => {
        NLang.destroy();
        const missingParams = [];
        NLang.on('missingParameter', (p) => missingParams.push(p));

        await NLang.init({
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
        assert.equal(NLang.get('welcome', { name: '{count}', count: 9 }), 'Bonjour {count}');
        assert.equal(NLang.get('info', { name: 'Madi', count: 5, active: true }), 'Madi possède 5 messages (actif: true)');
        assert.equal(NLang.get('welcome', {}), 'Bonjour {name}');
        assert.equal(missingParams.length, 1);
        assert.equal(missingParams[0].parameter, 'name');
    });

    it('gère la pluralisation CLDR avec Intl.PluralRules et fallback', async () => {
        NLang.destroy();
        await NLang.init({
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

        assert.equal(NLang.plural('messages', { count: 1 }), '1 message');
        assert.equal(NLang.plural('messages', { count: 5 }), '5 messages');
        assert.equal(NLang.plural('alerts', { count: 2 }), '2 alerts');
    });

    it('gère le chargement différé, la déduplication concurrente, les erreurs, les événements et checkTranslations()', async () => {
        let loaderCalls = 0;
        const events = [];

        NLang.destroy();
        await NLang.init({
            persist: false,
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

        NLang.on('languageLoaded', (e) => events.push(`loaded:${e.language}`))
            .on('languageChanged', (e) => events.push(`changed:${e.previousLanguage}->${e.language}`));

        await NLang.init({ language: 'fr', fallback: 'en' });

        // Chargements simultanés dédupliqués
        await Promise.all([NLang.loadLanguage('mos'), NLang.loadLanguage('mos')]);
        assert.equal(loaderCalls, 3); // fr + en + 1 seul appel pour mos

        await NLang.setLanguage('mos');
        assert.equal(NLang.get('save'), 'Bĩngi');
        // Pas d'événement si même langue
        await NLang.setLanguage('mos');
        assert.equal(events.filter((e) => e.startsWith('changed:')).length, 1);

        // Erreur de chargement sans throw : l'événement 'error' est émis et la langue active reste 'mos'
        const errors = [];
        NLang.on('error', (e) => errors.push(e.code));
        await NLang.setLanguage('es');
        assert.equal(errors.includes('LOAD_ERROR'), true);
        assert.equal(NLang.getLanguage(), 'mos');

        // Audit des traductions
        const report = NLang.checkTranslations(['save', 'user.create', 'missing.everywhere']);
        assert.equal(report.ok, false);
        assert.equal(report.missingEverywhere.includes('missing.everywhere'), true);
        assert.equal(report.missingByLanguage.fr.includes('user.create'), true);
    });

    it('rejette les objets non simples sans throw, bloque la pollution de prototype et détecte les collisions de clés', async () => {
        NLang.destroy();
        const errors = [];
        NLang.on('error', (e) => errors.push(e));
        await NLang.init({ language: 'fr', fallback: 'en' });

        // Rejet d'objets non simples (Date, Map, instance de classe) sans lever d'exception
        class CustomDict { constructor() { this.hello = 'Bonjour'; } }
        for (const invalid of [new Date(), new Map(), new CustomDict()]) {
            NLang.addLanguage('fr', invalid);
        }
        assert.equal(errors.filter((e) => e.code === 'INVALID_DICTIONARY').length, 3);

        // Support des objets sans prototype (Object.create(null))
        const nullProtoDict = Object.assign(Object.create(null), { hello: 'Bonjour' });
        NLang.addLanguage('fr', nullProtoDict);
        assert.equal(NLang.get('hello'), 'Bonjour');

        // Protection contre la pollution de prototype via JSON externe
        const malicious = JSON.parse('{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}},"safe":"OK"}');
        NLang.addLanguage('fr', malicious, { merge: true });
        assert.equal(({}).polluted, undefined);
        assert.equal(NLang.get('safe'), 'OK');

        // Détection des collisions de clés pointées via événement 'error'
        NLang.addLanguage('en', {
            user: { name: 'Madi' },
            'user.name': 'Autre'
        });
        assert.equal(errors.some((e) => e.code === 'KEY_COLLISION' && /user\.name/.test(e.key)), true);
    });

    it('persiste les dictionnaires chargés dans NIndexedDB et les restaure hors-ligne', async () => {
        let loaderCount = 0;
        NLang.destroy();
        await NLang.init({
            language: 'fr',
            fallback: null,
            persist: true,
            loader: async (code) => {
                loaderCount += 1;
                return { greeting: code === 'es' ? 'Hola' : 'Bonjour' };
            }
        });
        await NLang.loadLanguage('es', { force: true });
        assert.equal(NLang.get('greeting', {}, { language: 'es' }), 'Hola');

        if (NIndexedDB.instance?.isAvailable) {
            const countBefore = loaderCount;
            NLang.destroy();
            await NLang.init({
                language: 'fr',
                fallback: null,
                persist: true,
                loader: async () => {
                    loaderCount += 1;
                    return { greeting: 'Fallback' };
                }
            });
            const ok = await NLang.loadLanguage('es');
            assert.equal(ok, true);
            assert.equal(NLang.get('greeting', {}, { language: 'es' }), 'Hola');
            assert.equal(loaderCount, countBefore);
        }
        NLang.destroy();
    });

    it('ignore un chargement asynchrone terminé après unloadLanguage() ou destroy()', async () => {
        let resolveMos;
        let resolveEs;
        NLang.destroy();
        let loadedEvents = 0;
        NLang.on('languageLoaded', () => {
            loadedEvents += 1;
        });

        await NLang.init({
            language: 'fr',
            fallback: 'en',
            persist: false,
            languages: { fr: { save: 'Enregistrer' }, en: { save: 'Save' } },
            loader: (code) => new Promise((resolve) => {
                if (code === 'mos') resolveMos = resolve;
                else if (code === 'es') resolveEs = resolve;
                else resolve({});
            })
        });

        // 1) unloadLanguage() pendant un chargement en vol
        const mosPromise = NLang.loadLanguage('mos');
        NLang.unloadLanguage('mos');
        resolveMos({ save: 'Bĩngi' });
        const mosResult = await mosPromise;
        assert.equal(mosResult, false);
        assert.equal(NLang.hasLanguage('mos'), false);
        assert.equal(NLang.get('save', {}, { language: 'mos', fallback: false }), 'save');
        assert.equal(loadedEvents, 0);

        // 2) destroy() pendant un chargement en vol
        const esPromise = NLang.loadLanguage('es');
        NLang.destroy();
        resolveEs({ save: 'Guardar' });
        const esResult = await esPromise;
        assert.equal(esResult, false);
        assert.equal(loadedEvents, 0);
        assert.equal(await NLang.loadLanguage('es'), false);
    });

    it('enregistre la classe statique NLang sur NObject via registerLang', async () => {
        NLang.destroy();
        await NLang.init({ language: 'fr', fallback: 'en', persist: false });
        assert.equal(NLang.getLanguage(), 'fr');

        const obj = new NObject();
        assert.equal(obj.lang, NLang);

        NLang.destroy();
        await NLang.init({ language: 'en', persist: false });
        assert.equal(obj.lang.getLanguage(), 'en');
        NLang.destroy();
    });
});
