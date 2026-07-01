import assert from 'node:assert/strict';
import {
  DEFAULT_JOB_TAKEOFF_AREAS,
  buildDefaultMaterialTakeoffAreas,
  calculateExpectedMaterialsFromTakeoffAreas,
  calculateFoamAreaUsage,
  calculateFiberglassAreaUsage,
} from '../src/jobMaterialTakeoff.js';

const inventoryItems = [
  { id: 'r13_15_8_t', name: 'R13 x 15" x 93" (8ft)', unit: 'tubes', category: 'Certainteed R13', sqftPerTube: 125.94 },
  { id: 'oc_b', name: 'Ambit Open Cell B', unit: 'bbl', category: 'Foam' },
  { id: 'oc_a', name: 'Ambit A', unit: 'bbl', category: 'Foam' },
];

assert.deepEqual(DEFAULT_JOB_TAKEOFF_AREAS.map(a => a.key), ['exteriorWalls', 'roofline', 'attic', 'garage', 'other']);

const areas = buildDefaultMaterialTakeoffAreas();
assert.equal(areas.length, 5);
assert.equal(areas[0].label, 'Exterior walls');
assert.equal(areas[1].label, 'Roofline');
assert.notEqual(areas[0].id, areas[1].id, 'default rows should have stable unique ids');

const fiberglass = calculateFiberglassAreaUsage({ sqft: 500, materialItemId: 'r13_15_8_t' }, inventoryItems);
assert.equal(fiberglass.itemId, 'r13_15_8_t');
assert.equal(fiberglass.unit, 'tubes');
assert.equal(fiberglass.coverageSqft, 125.94);
assert.equal(fiberglass.qty, Math.ceil((500 / 125.94) * 100) / 100);

const foam = calculateFoamAreaUsage({ sqft: 4000, installedInches: 4, oversprayInches: 1, materialItemId: 'oc_b' });
assert.equal(foam.boardFeet, 20000);
assert.equal(foam.effectiveInches, 5);
assert.equal(foam.sets, 1);
assert.equal(foam.qty, 1);
assert.equal(foam.unit, 'sets');

const result = calculateExpectedMaterialsFromTakeoffAreas([
  { label: 'Exterior walls', materialType: 'fiberglass', materialItemId: 'r13_15_8_t', sqft: 500 },
  { label: 'Roofline', materialType: 'foam', materialItemId: 'oc_b', sqft: 4000, installedInches: 4, oversprayInches: 1 },
  { label: 'Empty', materialType: 'fiberglass', materialItemId: 'r13_15_8_t', sqft: '' },
], inventoryItems);

assert.equal(result.expectedMaterials.r13_15_8_t, Math.ceil((500 / 125.94) * 100) / 100);
assert.equal(result.expectedMaterials.oc_b, 1);
assert.equal(result.areaResults.length, 2);
assert.equal(result.totalSqft, 4500);
assert.equal(result.totalBoardFeet, 20000);
assert.equal(result.warnings.length, 0);

const missingCoverage = calculateExpectedMaterialsFromTakeoffAreas([
  { label: 'Walls', materialType: 'fiberglass', materialItemId: 'missing', sqft: 100 },
], inventoryItems);
assert.deepEqual(missingCoverage.expectedMaterials, {});
assert.equal(missingCoverage.warnings[0], 'Walls needs a fiberglass material with sqft/tube coverage.');

console.log('job material takeoff checks passed');
