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
            url: 'https://app.example.com/home',
            backUrl: 'https://app.example.com/start',
            overlay: true,
            pullToRefresh: true
        });

        await Promise.resolve();

        assert.equal(frame instanceof NTag, true);
        assert.equal(frame.hasClass('n-frame'), true);
        assert.equal(frame.hasClass('n-frame--overlay'), true);
        assert.deepEqual(calls, ['_init', 'applyLanguage']);
        assert.equal(frame.getTitle(), 'Accueil');
        assert.equal(frame.getUrl(), 'https://app.example.com/home');
        assert.equal(frame.matchesUrl('https://app.example.com/home'), true);
        assert.equal(frame.matchesUrl('https://app.example.com/other'), false);
        assert.equal(frame.getBackUrl(), 'https://app.example.com/start');
        assert.equal(frame.canGoBack(), true);
        assert.equal(frame.isOverlay(), true);
        assert.equal(frame.isPullToRefresh(), true);

        frame.setOverlay(false);
        assert.equal(frame.hasClass('n-frame--overlay'), false);

        frame.destroy();
        assert.equal(frame.isDestroyed, true);
    });

    it('gère les zones d\'alerte, les événements de cycle de vie et la fabrique statique', () => {
        const frame = NFrame.create({ title: 'Liste', url: 'https://app.example.com/list' });
        assert.equal(frame instanceof NFrame, true);
        assert.equal(frame.getWindow(), document.body?._nwindow ?? null);

        class ModalTestFrame extends NFrame {
            static overlay = true;
            static route = '/users/:id';
        }
        class DocsTestFrame extends NFrame {
            static route = /^\/docs\/(.+)$/;
        }
        assert.deepEqual(NFrame.canActivate({}), { status: 'allow' });
        assert.deepEqual(ModalTestFrame.matchUrl('https://app.example.com/users/42'), { id: '42' });
        assert.equal(ModalTestFrame.matchUrl('https://app.example.com/posts/42'), false);
        assert.deepEqual(DocsTestFrame.matchUrl('https://app.example.com/docs/guide/intro'), { 0: 'guide/intro' });

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
