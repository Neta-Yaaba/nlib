import { describe, it, assert } from '../../../index.js';
import { NFrame, NTag } from '../../../../index.js';

describe('NFrame (dom/components/frames/NFrame.js)', () => {
    it('hérite de NTag, configure titre, lien, mode flottant et appelle _init() + applyLanguage()', async () => {
        const calls = [];
        class CustomFrame extends NFrame {
            _init() {
                calls.push('_init');
                this.setTitle('Accueil');
            }
            applyLanguage() {
                calls.push('applyLanguage');
                return this;
            }
        }

        const frame = new CustomFrame({
            link: '/home',
            backLink: '/start',
            floating: true,
            pullToRefresh: true
        });

        await Promise.resolve();

        assert.equal(frame instanceof NTag, true);
        assert.equal(frame.hasClass('n-frame'), true);
        assert.equal(frame.hasClass('n-frame--floating'), true);
        assert.deepEqual(calls, ['applyLanguage', '_init']);
        assert.equal(frame.getTitle(), 'Accueil');
        assert.equal(frame.getLink(), '/home');
        assert.equal(frame.isLink('/home'), true);
        assert.equal(frame.isLink('/other'), false);
        assert.equal(frame.getBackLink(), '/start');
        assert.equal(frame.canGoBack(), true);
        assert.equal(frame.isFloating(), true);
        assert.equal(frame.isPullToRefresh(), true);

        frame.setFloating(false);
        assert.equal(frame.hasClass('n-frame--floating'), false);

        frame.destroy();
        assert.equal(frame.isDestroyed, true);
    });

    it('gère les zones d\'alerte, les événements de cycle de vie et la fabrique statique', () => {
        const mockWindow = {
            getCurrentFrame: () => null
        };
        const created = NFrame.createFrame(mockWindow, { title: 'Liste', link: '/list' });
        assert.equal(created.window, mockWindow);
        assert.equal(created.isNew, true);
        assert.equal(created.frame instanceof NFrame, true);
        assert.equal(created.frame.getWindow(), document.body?._nwindow ?? null);

        const frame = created.frame;
        assert.equal(NFrame.validateLink(mockWindow, {}), true);
        assert.equal(NFrame.isFloating(mockWindow, {}), false);

        assert.equal(frame.verifyAlert([]), true);
        assert.equal(frame.verifyAlert([{ id: 1 }]), false);
        assert.equal(frame.verifyAlert({ error: 'ERR', message: 'Accès refusé' }), true);
        frame.hideAlert();

        const events = [];
        frame.on('activate', () => events.push('activate'));
        frame.on('deactivate', () => events.push('deactivate'));
        frame.on('pullToRefresh', () => events.push('ptr'));

        assert.equal(frame.onActivate().onDeactivate().onResume().onPause().onFocus().onBlur().onPullToRefresh(), frame);
        assert.deepEqual(events, ['activate', 'deactivate', 'ptr']);

        frame.destroy();
    });
});
