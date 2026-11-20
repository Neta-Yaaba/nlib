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
        assert.equal(win1.getHomeLink(), null);
        assert.equal(win1.getWelcomeLink(), null);
        assert.equal(typeof win1.getInitialLink(), 'string');

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

        win.registerFrame('home', HomeFrame)
            .registerFrame('profile', ProfileFrame);

        const parsed = win.linkToParams('/profile?id=42');
        assert.equal(parsed.frameName, 'profile');
        assert.equal(parsed.id, '42');

        const home = win.navigate('/home?tab=feed');
        assert.equal(win.getCurrentFrame(), home);
        assert.equal(home.getWindow(), win);
        assert.deepEqual(win.getHistory(), ['/home?tab=feed']);

        const profile = win.navigate('/profile?id=42');
        assert.equal(win.getCurrentFrame(), profile);
        assert.deepEqual(win.getHistory(), ['/home?tab=feed', '/profile?id=42']);
        assert.equal(home.isVisible(), false);
        assert.equal(profile.isVisible(), true);

        assert.equal(win.back(), true);
        assert.equal(win.getCurrentFrame(), home);
        assert.equal(home.isVisible(), true);
        assert.equal(profile.isVisible(), false);
        assert.deepEqual(win.getHistory(), ['/home?tab=feed']);

        assert.deepEqual(lifecycle, [
            'home:activate:feed',
            'home:deactivate',
            'profile:activate:42',
            'home:activate:feed'
        ]);

        const initial = win.openInitialLink('/home');
        assert.equal(initial instanceof NFrame, true);

        win.destroy();
    });

    it('gère les frames flottantes avec z-index croissant sans masquer la frame de fond', () => {
        const win = new NWindow();

        class BaseFrame extends NFrame {}
        class ModalFrame extends NFrame {
            constructor(opts = {}) {
                super({ ...opts, floating: true });
            }
        }

        win.registerFrame('base', BaseFrame)
            .registerFrame('modal', ModalFrame);

        const base = win.navigate('/base');
        const modal = win.navigate('/modal');

        assert.equal(win.getCurrentFrame(), modal);
        assert.equal(base.isVisible(), true);
        assert.equal(modal.isVisible(), true);
        assert.equal(Number(modal.getStyle('z-index')) > 1000, true);

        assert.equal(win.back(), true);
        assert.equal(win.getCurrentFrame(), base);

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

        win.registerFrame('life', LifeFrame);
        win.navigate('/life');

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
});
