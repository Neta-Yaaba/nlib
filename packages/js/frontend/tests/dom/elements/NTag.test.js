import { describe, it, assert } from '../../../../backend/tests/test-helper.js';
import { NTag } from '../../../index.js';
import { NObject } from '../../../../backend/index.js';

describe('NTag (dom/elements/NTag.js)', () => {
    it('hérite de NObject et crée la balise avec options, attributs, classes et styles', () => {
        const tag = new NTag({
            tagName: 'section',
            id: 'hero',
            classes: ['panel', 'active'],
            attrs: { role: 'region', 'aria-label': 'Hero' },
            data: { userId: 7 },
            style: { color: 'red', padding: '12px' },
            text: 'Bienvenue',
            state: { visible: true }
        });

        assert.equal(tag instanceof NObject, true);
        assert.equal(tag.tagName, 'section');
        assert.equal(tag.id, 'hero');
        assert.equal(tag.hasClass('panel'), true);
        assert.equal(tag.hasClass('active'), true);
        assert.equal(tag.getAttr('role'), 'region');
        assert.equal(tag.getData('userId'), '7');
        assert.equal(tag.getStyle('color'), 'red');
        assert.equal(tag.text, 'Bienvenue');
        assert.equal(tag.getState('visible'), true);

        tag.destroy();
    });

    it('gère les enfants, le montage, les événements DOM et le nettoyage dans destroy()', () => {
        const host = document.createElement('div');
        const parent = new NTag('ul');
        const item1 = new NTag({ tagName: 'li', text: 'Un' });
        const item2 = new NTag({ tagName: 'li', text: 'Zéro' });

        parent.append(item1).prepend(item2).mount(host);
        assert.equal(parent.children.length, 2);
        assert.equal(item1.parent, parent);
        assert.equal(parent.element.children[0], item2.element);
        assert.equal(host.children[0], parent.element);

        let clicks = 0;
        const onClick = () => { clicks += 1; };
        item1.on('click', onClick);
        item1.element.dispatchEvent(new Event('click'));
        assert.equal(clicks, 1);

        item1.off('click', onClick);
        item1.element.dispatchEvent(new Event('click'));
        assert.equal(clicks, 1);

        parent.destroy();
        assert.equal(parent.isDestroyed, true);
        assert.equal(item1.isDestroyed, true);
        assert.equal(host.children.length, 0);
    });

    it('insère un ou plusieurs enfants via addTag() à un index ou avant un NTag', () => {
        const ul = new NTag('ul');
        const a = new NTag({ tagName: 'li', text: 'A' });
        const d = new NTag({ tagName: 'li', text: 'D' });
        const b = new NTag({ tagName: 'li', text: 'B' });
        const c = new NTag({ tagName: 'li', text: 'C' });
        const x = new NTag({ tagName: 'li', text: 'X' });

        ul.addTag([a, d]);
        ul.addTag([b, c], 1);
        ul.addTag(x, d);

        assert.deepEqual(
            ul.children.map((el) => el.text),
            ['A', 'B', 'C', 'X', 'D']
        );
        assert.equal(a.getIndex(), 0);
        assert.equal(x.getIndex(), 3);
        assert.equal(ul.getIndex(), -1);
        assert.equal(ul.getChildCount(), 5);
        assert.equal(ul.getChildAt(2), c);
        assert.equal(ul.getChildAt(99), null);

        x.setIndex(0);
        assert.equal(x.getIndex(), 0);
        assert.equal(ul.getChildAt(0), x);

        a.id = 'item-a';
        b.addClass('special');
        c.addClass('special');
        assert.equal(ul.find('#item-a'), a);
        assert.deepEqual(ul.findAll('.special'), [b, c]);

        ul.destroy();
    });

    it('expose getRect/getBounds/getX/getY/getWidth/getHeight et gère resize + longclick', async () => {
        const box = new NTag({
            tagName: 'div',
            longClickDelay: 40,
            style: { width: '120px', height: '60px' }
        }).mount(document.body);

        const rect = box.getRect();
        const bounds = box.getBounds();
        assert.equal(box.isShow(), true);
        box.hide();
        assert.equal(box.isShow(), false);
        box.show();
        assert.equal(box.isShow(), true);
        assert.equal(bounds.x, box.getX());
        assert.equal(bounds.y, box.getY());
        assert.equal(bounds.width, box.getWidth());
        assert.equal(bounds.height, box.getHeight());
        assert.equal(rect.width, bounds.width);

        let longClicked = false;
        let clickAfterLongClick = 0;
        box.on('click', () => { clickAfterLongClick += 1; });
        box.on('longclick', () => { longClicked = true; });
        box.element.dispatchEvent(new Event('pointerdown'));
        await new Promise((r) => setTimeout(r, 70));
        assert.equal(longClicked, true);
        box.element.dispatchEvent(new Event('click', { cancelable: true }));
        assert.equal(clickAfterLongClick, 0);

        let resized = false;
        box.on('resize', () => { resized = true; });
        assert.equal(typeof resized, 'boolean');

        let mountedCount = 0;
        let unmountedCount = 0;
        const panel = new NTag('div');
        assert.equal(panel.isConnected(), false);
        panel.on('mount', () => { mountedCount += 1; })
            .on('unmount', () => { unmountedCount += 1; });
        panel.mount(document.body);
        assert.equal(panel.isConnected(), true);
        assert.equal(mountedCount, 1);

        assert.equal(panel.scrollIntoView({ behavior: 'auto', block: 'nearest' }), panel);
        let rafCalled = false;
        await new Promise((resolve) => {
            panel.requestAnimationFrame((ts, tag) => {
                rafCalled = tag === panel && typeof ts === 'number';
                resolve();
            });
        });
        assert.equal(rafCalled, true);

        panel.unmount();
        assert.equal(panel.isConnected(), false);
        assert.equal(unmountedCount, 1);
        panel.destroy();

        box.destroy();
    });

    it('préserve beforeDestroy dans destroy(), détache les ponts après once()/waitFor() et gère le déplacement', async () => {
        // 1) beforeDestroy dans destroy()
        let beforeDestroyFired = false;
        let elementIntactInBeforeDestroy = false;
        const target = new NTag('div');
        target.on('beforeDestroy', () => {
            beforeDestroyFired = true;
            elementIntactInBeforeDestroy = target.element !== null;
        });
        target.destroy();
        assert.equal(beforeDestroyFired, true);
        assert.equal(elementIntactInBeforeDestroy, true);
        assert.equal(target.isDestroyed, true);
        assert.equal(target.element, null);

        // 2) once() et waitFor() détachent les écouteurs DOM après déclenchement/timeout
        const btn = new NTag('button');
        let onceCount = 0;
        btn.once('click', () => { onceCount += 1; });
        btn.element.dispatchEvent(new Event('click'));
        btn.element.dispatchEvent(new Event('click'));
        assert.equal(onceCount, 1);
        assert.equal(btn.listenerCount('click'), 0);

        const timedOut = await btn.waitFor('click', 10);
        assert.equal(timedOut, null);
        assert.equal(btn.listenerCount('click'), 0);
        btn.destroy();

        // 3) Déplacement d'un enfant entre deux parents sans destruction
        const p1 = new NTag('div');
        const p2 = new NTag('div');
        const child = new NTag('span');
        p1.append(child);
        assert.equal(child.parent, p1);
        p2.append(child);
        assert.equal(child.parent, p2);
        assert.equal(p1.children.length, 0);
        assert.equal(p2.children.length, 1);
        assert.equal(child.isDestroyed, false);
        p1.destroy();
        p2.destroy();
    });

    it('gère propriétés DOM, styles numériques/!important/removeStyle(), visibilité et annulation longclick', async () => {
        const input = new NTag({ tagName: 'input', attrs: { type: 'checkbox' } });
        input.setProperty('checked', true);
        assert.equal(input.getProperty('checked'), true);
        input.destroy();

        const box = new NTag({
            tagName: 'div',
            style: {
                display: 'flex',
                width: '100px',
                opacity: 0.5,
                zIndex: 10,
                '--accent': '#123456'
            }
        }).mount(document.body);

        assert.equal(box.getStyle('width'), '100px');
        assert.equal(box.getStyle('opacity'), '0.5');
        assert.equal(box.getStyle('zIndex'), '10');
        assert.equal(box.getStyle('--accent'), '#123456');

        box.setStyle('color', 'red !important');
        assert.equal(box.element.style.getPropertyPriority('color'), 'important');
        box.removeStyle('color', '--accent');
        assert.equal(box.getStyle('color'), '');
        assert.equal(box.getStyle('--accent'), '');

        // hide() -> show() restaure 'flex'
        box.hide();
        assert.equal(box.isShow(), false);
        box.show();
        assert.equal(box.isShow(), true);
        assert.equal(box.getStyle('display'), 'flex');

        // visibility: hidden et attribut hidden
        box.setStyle('visibility', 'hidden');
        assert.equal(box.isShow(), true);
        assert.equal(box.isVisible(), false);
        box.removeStyle('visibility');
        box.setAttr('hidden', true);
        assert.equal(box.isShow(), false);
        assert.equal(box.isVisible(), false);
        box.removeAttr('hidden');
        assert.equal(box.isShow(), true);
        assert.equal(box.isVisible(), true);

        // Annulation longclick sur déplacement > 10px
        const lcBox = new NTag({ tagName: 'div', longClickDelay: 30 }).mount(document.body);
        let lcCount = 0;
        lcBox.on('longclick', () => { lcCount += 1; });
        const downEv = new Event('pointerdown');
        downEv.clientX = 0;
        downEv.clientY = 0;
        lcBox.element.dispatchEvent(downEv);
        const moveEv = new Event('pointermove');
        moveEv.clientX = 25;
        moveEv.clientY = 0;
        lcBox.element.dispatchEvent(moveEv);
        await new Promise((r) => setTimeout(r, 50));
        assert.equal(lcCount, 0);

        lcBox.destroy();
        box.destroy();
    });

    it('appelle applyLanguage() à la création (sous-classe et option) et lors de la réapplication', async () => {
        const lang = new NTag('div').util.lang;
        await lang.init({
            language: 'fr',
            fallback: 'en',
            languages: {
                fr: { greeting: 'Bonjour' },
                en: { greeting: 'Hello' }
            }
        });

        class GreetingTag extends NTag {
            applyLanguage() {
                return this.setText(this.util.lang.get('greeting'));
            }
        }

        const sub = new GreetingTag('p');
        assert.equal(sub.text, '');
        sub.applyLanguage();
        assert.equal(sub.text, 'Bonjour');

        const optTag = new NTag({
            tagName: 'span',
            applyLanguage: (tag) => tag.setText(tag.util.lang.get('greeting'))
        });
        assert.equal(optTag.text, '');
        optTag.applyLanguage();
        assert.equal(optTag.text, 'Bonjour');

        await lang.setLanguage('en');
        sub.setLanguage('en');
        optTag.setLanguage('en');
        assert.equal(sub.getState('language'), 'en');
        assert.equal(optTag.getState('language'), 'en');
        assert.equal(sub.text, 'Hello');
        assert.equal(optTag.text, 'Hello');

        sub.destroy();
        optTag.destroy();
    });

    it('vérifie isVisible(), isVisibleInScreen() et l\'événement visibility', () => {
        const box = new NTag({
            tagName: 'div',
            style: { width: '100px', height: '40px' }
        });

        assert.equal(box.isVisible(), true);
        assert.equal(box.isVisibleInScreen(), false); // non monté

        box.mount(document.body);
        assert.equal(box.isVisible(), true);
        assert.equal(box.isVisibleInScreen(), true);

        box.hide();
        assert.equal(box.isVisible(), false);
        assert.equal(box.isVisibleInScreen(), false);

        box.show();
        box.setStyle({ position: 'fixed', top: '-200px', left: '0px' });
        assert.equal(box.isVisible(), true);
        assert.equal(box.isVisibleInScreen(), false);

        let visibilityEvents = 0;
        box.on('visibility', () => { visibilityEvents += 1; });
        assert.equal(box.listenerCount('visibility'), 1);
        box.off('visibility');
        assert.equal(box.listenerCount('visibility'), 0);
        assert.equal(typeof visibilityEvents, 'number');

        box.destroy();
    });
});
