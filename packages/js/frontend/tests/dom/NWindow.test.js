import { describe, it, assert } from '../index.js';
import { NWindow, NFrame, NTag } from '../../index.js';

describe('NWindow (dom/NWindow.js)', () => {
    it('hérite de NTag, s\'attache en singleton à document.body et lit config.baseUrl', () => {
        const win1 = new NWindow({
            config: { baseUrl: 'https://app.example.com' }
        });
        const win2 = new NWindow();

        assert.equal(win1 instanceof NTag, true);
        assert.equal(win1.hasClass('n-window'), true);
        assert.equal(win1, win2);
        assert.equal(NWindow.instance(), win1);
        assert.equal(win1.getWindow(), win1);
        assert.equal(win1.getBaseUrl(), 'https://app.example.com');
        assert.equal(win1.getHomeUrl(), null);
        assert.equal(win1.getWelcomeUrl(), null);
        assert.equal(typeof win1.getInitialUrl(), 'string');
        assert.equal(win1.setInitialUrl('https://app.example.com/start'), win1);
        assert.equal(win1.getInitialUrl(), 'https://app.example.com/start');

        win1.config.remove('baseUrl');
        win1.destroy();
        assert.equal(NWindow.instance(), null);
    });

    it('analyse les liens, enregistre les frames et gère navigation + retour arrière', () => {
        const win = new NWindow();
        const lifecycle = [];

        class HomeFrame extends NFrame {
            _init() {
                this.setTitle('Accueil');
            }
            onActivate(params) {
                lifecycle.push(`home:activate:${params.tab || ''}`);
                return super.onActivate(params);
            }
            onDeactivate(params) {
                lifecycle.push('home:deactivate');
                return super.onDeactivate(params);
            }
        }

        class ProfileFrame extends NFrame {
            _init() {
                this.setTitle('Profil');
            }
            onActivate(params) {
                lifecycle.push(`profile:activate:${params.id || ''}`);
                return super.onActivate(params);
            }
        }

        class ProductFrame extends NFrame {}

        const base = win.getBaseUrl();
        win.registerFrame([`${base}/home?tab=feed`, `${base}/accueil`], HomeFrame)
            .registerFrame(`${base}/profile?id=42`, ProfileFrame)
            .registerFrame([`${base}/produit/`, `${base}/?produit=`], ProductFrame, { includes: true });

        const parsed = win.linkToParams(`${base}/profile?id=42`);
        assert.equal(parsed.path, '/profile');
        assert.equal(parsed.id, '42');
        assert.equal(parsed.link, `${base}/profile?id=42`);

        const resolved = win.resolveFrame(`${base}/profile?id=42`);
        assert.equal(resolved.FrameClass, ProfileFrame);
        assert.equal(win.resolveFrame(`${base}/accueil`).FrameClass, HomeFrame);
        assert.equal(win.resolveFrame(`${base}/produit/99`).FrameClass, ProductFrame);
        assert.equal(win.resolveFrame(`${base}/?produit=99`).FrameClass, ProductFrame);

        const home = win.navigate(`${base}/home?tab=feed`);
        assert.equal(win.getCurrentFrame(), home);
        assert.equal(home.getWindow(), win);
        assert.deepEqual(win.getHistory(), [`${base}/home?tab=feed`]);

        const profile = win.navigate(`${base}/profile?id=42`);
        assert.equal(win.getCurrentFrame(), profile);
        assert.deepEqual(win.getHistory(), [`${base}/home?tab=feed`, `${base}/profile?id=42`]);
        assert.equal(home.isVisible(), false);
        assert.equal(profile.isVisible(), true);

        assert.equal(win.back(), true);
        assert.equal(win.getCurrentFrame(), home);
        assert.equal(home.isVisible(), true);
        assert.equal(profile.isVisible(), false);
        assert.deepEqual(win.getHistory(), [`${base}/home?tab=feed`]);

        assert.deepEqual(lifecycle, [
            'home:activate:feed',
            'home:deactivate',
            'profile:activate:42',
            'home:activate:feed'
        ]);

        const initial = win.openInitialLink(`${base}/accueil`);
        assert.equal(initial instanceof NFrame, true);

        win.destroy();
    });

    it('gère les frames flottantes avec z-index croissant sans masquer la frame de fond', () => {
        const win = new NWindow();

        class BaseFrame extends NFrame {}
        class ModalFrame extends NFrame {}

        const base = win.getBaseUrl();
        win.registerFrame(`${base}/base`, BaseFrame, false)
            .registerFrame(`${base}/modal`, ModalFrame, true);

        const baseFrame = win.navigate(`${base}/base`);
        const modal = win.navigate(`${base}/modal`);

        assert.equal(win.getCurrentFrame(), modal);
        assert.equal(baseFrame.isVisible(), true);
        assert.equal(modal.isVisible(), true);
        assert.equal(Number(modal.getStyle('z-index')) > 1000, true);

        assert.equal(win.back(), true);
        assert.equal(win.getCurrentFrame(), baseFrame);

        win.destroy();
    });

    it('relaye et émet resume, pause, focus, blur et gère les ponts globaux scroll/resize', () => {
        const win = new NWindow();
        const events = [];

        class LifeFrame extends NFrame {
            onResume() { events.push('frame:resume'); return super.onResume(); }
            onPause() { events.push('frame:pause'); return super.onPause(); }
            onFocus() { events.push('frame:focus'); return super.onFocus(); }
            onBlur() { events.push('frame:blur'); return super.onBlur(); }
        }

        const base = win.getBaseUrl();
        win.registerFrame(`${base}/life`, LifeFrame);
        win.navigate(`${base}/life`);

        win.on('resume', () => events.push('win:resume'));
        win.on('pause', () => events.push('win:pause'));
        win.on('focus', () => events.push('win:focus'));
        win.on('blur', () => events.push('win:blur'));

        win.onResume().onFocus().onBlur().onPause();
        assert.deepEqual(events, [
            'frame:resume', 'win:resume',
            'frame:focus', 'win:focus',
            'frame:blur', 'win:blur',
            'frame:pause', 'win:pause'
        ]);

        let resizeCount = 0;
        const onResize = () => { resizeCount += 1; };
        assert.equal(win.on('resize', onResize), win);
        window.dispatchEvent(new Event('resize'));
        assert.equal(resizeCount >= 1, true);
        win.off('resize', onResize);

        assert.equal(win.scrollTo(0, 0), win);
        assert.equal(win.scrollTo({ top: 100, behavior: 'auto' }), win);

        win.destroy();
    });

    it('gère les décisions canActivate (allow, deny, redirect)', () => {
        const win = new NWindow();
        const events = [];

        const base = win.getBaseUrl();
        class LoginFrame extends NFrame {}
        class SecretFrame extends NFrame {
            static canActivate(params) {
                if (!params.isAuthenticated) {
                    return { status: 'redirect', url: `${base}/login` };
                }
                return params.isAdmin
                    ? { status: 'allow' }
                    : { status: 'deny', reason: 'forbidden' };
            }
        }

        win.registerFrame(`${base}/login`, LoginFrame)
            .registerFrame(`${base}/secret`, SecretFrame);
        win.on('navigation:redirect', (e) => events.push(`redirect:${e.url}`));
        win.on('navigation:denied', (e) => events.push(`denied:${e.reason}`));

        const redirected = win.navigate(`${base}/secret`);
        assert.equal(redirected instanceof LoginFrame, true);
        assert.equal(win.getCurrentFrame(), redirected);

        const denied = win.navigate({ link: `${base}/secret`, isAuthenticated: true, isAdmin: false });
        assert.equal(denied, null);

        const allowed = win.navigate({ link: `${base}/secret`, isAuthenticated: true, isAdmin: true });
        assert.equal(allowed instanceof SecretFrame, true);

        assert.deepEqual(events, [`redirect:${base}/login`, 'denied:forbidden']);

        win.destroy();
    });

    it('appelle async initWorker(null) puis initLanguage(null, workerIsInit) de manière synchrone', async () => {
        const flushMicrotasks = async (ticks = 6) => {
            for (let i = 0; i < ticks; i++) await Promise.resolve();
        };
        const calls = [];
        class WorkerAppWindow extends NWindow {
            async initWorker(options = null) {
                calls.push(['worker', options]);
                return await super.initWorker(options);
            }
            initLanguage(options = null, workerIsInit = false) {
                calls.push(['lang', options, workerIsInit]);
                return super.initLanguage({
                    language: 'fr',
                    fallback: null,
                    persist: false,
                    languages: { fr: { hello: 'Bonjour' } }
                }, workerIsInit);
            }
        }

        const win1 = new WorkerAppWindow({ withWorker: false });
        try {
            await flushMicrotasks();
            assert.deepEqual(calls, [['lang', null, false]]);
        } finally {
            win1.destroy();
        }

        calls.length = 0;
        const win2 = new WorkerAppWindow({ withWorker: true });
        try {
            await flushMicrotasks();
            assert.deepEqual(calls, [['worker', null], ['lang', null, true]]);
            assert.equal(win2.lang.get('hello'), 'Bonjour');
        } finally {
            win2.destroy();
        }
    });

    it('appelle async initDatabase(null, workerIsInit) dans le constructeur', async () => {
        const flushMicrotasks = async (ticks = 6) => {
            for (let i = 0; i < ticks; i++) await Promise.resolve();
        };
        const dbCalls = [];
        class DbAppWindow extends NWindow {
            async initWorker(options = null) {
                return true;
            }
            async initDatabase(options = null, workerIsInit = false) {
                dbCalls.push([options, workerIsInit]);
                return await super.initDatabase(options, workerIsInit);
            }
        }

        const win1 = new DbAppWindow();
        try {
            await flushMicrotasks();
            assert.deepEqual(dbCalls, [[null, false]]);
            assert.equal(await win1.initDatabase(null, false), true);
        } finally {
            win1.destroy();
        }

        dbCalls.length = 0;
        const win2 = new DbAppWindow({ withWorker: true });
        try {
            await flushMicrotasks();
            assert.deepEqual(dbCalls, [[null, true]]);
        } finally {
            win2.destroy();
        }
    });

    it('appelle async initService(null) lorsque withService vaut true et expose getService()', async () => {
        const flushMicrotasks = async (ticks = 6) => {
            for (let i = 0; i < ticks; i++) await Promise.resolve();
        };
        const svcCalls = [];
        class ServiceAppWindow extends NWindow {
            async initService(options = null) {
                svcCalls.push(options);
                return await super.initService({ id: 'test_svc', persistLastId: false });
            }
        }

        const win1 = new ServiceAppWindow({ withService: false });
        try {
            await flushMicrotasks();
            assert.deepEqual(svcCalls, []);
            assert.equal(win1.getService(), null);
        } finally {
            win1.destroy();
        }

        const win2 = new ServiceAppWindow({ withService: true });
        try {
            await flushMicrotasks();
            assert.deepEqual(svcCalls, [null]);
            assert.notEqual(win2.getService(), null);
            assert.equal(win2.getService().serviceId, 'test_svc');
        } finally {
            win2.destroy();
        }
    });

    it('appelle async initServiceWorker(null) dans le constructeur et expose getServiceWorker()', async () => {
        const flushMicrotasks = async (ticks = 6) => {
            for (let i = 0; i < ticks; i++) await Promise.resolve();
        };
        const swCalls = [];
        class SwAppWindow extends NWindow {
            async initServiceWorker(options = null) {
                swCalls.push(options);
                return await super.initServiceWorker({ entryPoint: '/index.html', cacheName: 'test-sw-v1' });
            }
        }

        const win = new SwAppWindow();
        try {
            await flushMicrotasks();
            assert.equal(swCalls.length >= 1, true);
            assert.equal(swCalls[0], null);
            assert.notEqual(win.getServiceWorker(), null);
        } finally {
            win.destroy();
        }
    });
});
