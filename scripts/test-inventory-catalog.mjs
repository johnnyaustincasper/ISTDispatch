import assert from 'node:assert/strict';
import {
  buildInventoryCatalog,
  normalizeInventoryCatalogOverride,
  buildInventoryCatalogSavePayloads,
} from '../src/inventoryCatalog.js';

const base = [
  { id: 'r19_t', name: 'R19 Tubes', unit: 'tubes', category: 'R19', hasPieces: true, pcsPerTube: 9, sqftPerTube: 87.19, cost: 33.13 },
  { id: 'r19_pcs', name: 'R19 Pieces', unit: 'pcs', category: 'R19', isPieces: true, parentId: 'r19_t', cost: 3.68 },
  { id: 'blown_fg', name: 'Blown FG', unit: 'bags', category: 'Blown', cost: 32 },
];

function testMergesOverridesAndCustomItems() {
  const catalog = buildInventoryCatalog(base, [
    { id: 'blown_fg', name: 'Blown Fiberglass', unit: 'bags', category: 'Blown', cost: 34 },
    { id: 'custom_roll', name: 'Custom Roll', unit: 'rolls', category: 'Other', cost: 12.5 },
  ]);

  assert.equal(catalog.length, 4);
  assert.equal(catalog.find((item) => item.id === 'blown_fg').name, 'Blown Fiberglass');
  assert.equal(catalog.find((item) => item.id === 'blown_fg').cost, 34);
  assert.equal(catalog.find((item) => item.id === 'custom_roll').unit, 'rolls');
}

function testDeletedOverridesHideBuiltInsAndCustomItems() {
  const catalog = buildInventoryCatalog(base, [
    { id: 'r19_t', deleted: true },
    { id: 'r19_pcs', deleted: true },
    { id: 'custom_roll', name: 'Custom Roll', unit: 'rolls', category: 'Other', deleted: true },
  ]);

  assert.equal(catalog.some((item) => item.id === 'r19_t'), false);
  assert.equal(catalog.some((item) => item.id === 'r19_pcs'), false);
  assert.equal(catalog.some((item) => item.id === 'custom_roll'), false);
  assert.equal(catalog.length, 1);
}

function testNormalizesPayloadTypes() {
  const override = normalizeInventoryCatalogOverride({
    id: '  My New Item! ',
    name: '  My Item  ',
    unit: ' tubes ',
    category: ' Test ',
    cost: '12.345',
    pcsPerTube: '9',
    sqftPerTube: '87.19',
    hasPieces: true,
  });

  assert.equal(override.id, 'my_new_item');
  assert.equal(override.name, 'My Item');
  assert.equal(override.unit, 'tubes');
  assert.equal(override.category, 'Test');
  assert.equal(override.cost, 12.345);
  assert.equal(override.pcsPerTube, 9);
  assert.equal(override.sqftPerTube, 87.19);
  assert.equal(override.hasPieces, true);
}

function testBuildsPiecePayloadWhenRequested() {
  const payloads = buildInventoryCatalogSavePayloads({
    id: 'new_tube',
    name: 'New Tube',
    unit: 'tubes',
    category: 'New R19',
    cost: '36',
    hasPieces: true,
    pcsPerTube: '9',
    sqftPerTube: '90',
  });

  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].id, 'new_tube');
  assert.equal(payloads[0].hasPieces, true);
  assert.equal(payloads[1].id, 'new_tube_pcs');
  assert.equal(payloads[1].unit, 'pcs');
  assert.equal(payloads[1].isPieces, true);
  assert.equal(payloads[1].parentId, 'new_tube');
  assert.equal(payloads[1].cost, 4);
}

testMergesOverridesAndCustomItems();
testDeletedOverridesHideBuiltInsAndCustomItems();
testNormalizesPayloadTypes();
testBuildsPiecePayloadWhenRequested();
console.log('inventory catalog tests passed');
