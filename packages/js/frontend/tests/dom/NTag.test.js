import { describe, it, assert } from '../../../backend/tests/test-helper.js';
import { NTag } from '../../index.js';
import { NObject } from '../../../backend/index.js';

describe('NTag (dom/NTag.js)', () => {
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
        box.on('longclick', () => { longClicked = true; });
        box.element.dispatchEvent(new Event('pointerdown'));
        await new Promise((r) => setTimeout(r, 70));
        assert.equal(longClicked, true);

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
});
