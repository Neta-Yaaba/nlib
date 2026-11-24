import { describe, it, assert } from '../../../index.js';
import { NItem, NTag } from '../../../../index.js';

describe('NItem (dom/components/items/NItem.js)', () => {
    it('hérite de NTag, gère itemId, primaryKey, data, updateData et matchesData', () => {
        const displayed = [];
        class ProductItem extends NItem {
            displayData(data) {
                displayed.push(data?.title || '');
                return super.displayData(data);
            }
        }

        const item = new ProductItem({
            tagName: 'li',
            primaryKey: 'ID',
            data: { ID: 129, title: 'Initial', stock: 5 }
        });

        assert.equal(item instanceof NTag, true);
        assert.equal(item.tagName, 'li');
        assert.equal(item.hasClass('n-item'), true);
        assert.equal(item.getItemId(), 129);
        assert.equal(item.getPrimaryKey(), 'ID');
        assert.deepEqual(item.getData(), { ID: 129, title: 'Initial', stock: 5 });

        item.setData('custom', 'meta');
        assert.equal(item.getData('custom'), 'meta');

        item.updateData({ title: 'Modifié' });
        assert.deepEqual(item.getData(), { ID: 129, title: 'Modifié', stock: 5 });
        assert.deepEqual(displayed, ['Initial', 'Modifié']);

        assert.equal(item.matchesData({ ID: 129 }), true);
        assert.equal(item.matchesData({ ID: 999 }), false);

        item.destroy();
    });

    it('gère les états visuels, requestData() et notifyChange()', async () => {
        class AsyncItem extends NItem {
            async fetchData(params) {
                return { id: params.id, name: 'Chargé' };
            }
        }

        const item = new AsyncItem({ autoUpdate: true, syncParams: { table: 'users' } });
        item.mount(document.body);

        const res = await item.requestData({ id: 7 });
        assert.deepEqual(res, { id: 7, name: 'Chargé' });
        assert.equal(item.getItemId(), 7);
        assert.equal(item.isLoading(), false);

        item.setSelected(true).setDisabled(true);
        assert.equal(item.isSelected(), true);
        assert.equal(item.isDisabled(), true);
        assert.equal(item.hasClass('n-item--selected'), true);
        assert.equal(item.hasClass('n-item--disabled'), true);

        const changes = [];
        item.on('change', (e) => changes.push(e.eventId));
        item.notifyChange(42, { table: 'users' });
        assert.equal(item.getLastEventId(), 42);
        assert.deepEqual(changes, [42]);

        item.destroy();
    });
});
