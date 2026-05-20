import assert from 'node:assert/strict';
import { shortInventoryItemName } from '../src/inventoryDisplay.js';

assert.equal(
  shortInventoryItemName({
    name: 'Owens Corning R19 x 23" x 93" (8ft)',
    category: 'Owens Corning R19',
    unit: 'tubes',
  }),
  'OC R19 23"×93"',
  'compact names should show the exact catalog length, not rounded 8ft text',
);

assert.equal(
  shortInventoryItemName({
    name: 'Owens Corning R19 x 15" x 93"',
    category: 'Owens Corning R19',
    unit: 'tubes',
  }),
  'OC R19 15"×93"',
);

assert.equal(
  shortInventoryItemName({
    name: 'R19 x 19.25" x 48"',
    category: 'Certainteed R19',
    unit: 'tubes',
  }),
  'CT R19 19.25"×48"',
);

console.log('inventory display tests passed');
