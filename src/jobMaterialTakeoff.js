export const DEFAULT_JOB_TAKEOFF_AREAS = [
  { key: 'exteriorWalls', label: 'Exterior walls' },
  { key: 'roofline', label: 'Roofline' },
  { key: 'attic', label: 'Attic' },
  { key: 'garage', label: 'Garage' },
  { key: 'other', label: 'Other' },
];

export const DEFAULT_OPEN_CELL_YIELD_PER_SET = 20000;
export const DEFAULT_CLOSED_CELL_YIELD_PER_SET = 3200;

const roundQty = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.ceil(((Number.isFinite(value) ? value : 0) * factor) - 1e-9) / factor;
};

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const makeAreaId = (key, idx) => `${key || 'area'}-${idx + 1}`;

export function buildDefaultMaterialTakeoffAreas() {
  return DEFAULT_JOB_TAKEOFF_AREAS.map((area, idx) => ({
    id: makeAreaId(area.key, idx),
    key: area.key,
    label: area.label,
    materialType: 'fiberglass',
    materialItemId: '',
    sqft: '',
    installedInches: '',
    oversprayInches: '1',
    foamType: 'openCell',
  }));
}

export function normalizeMaterialTakeoffAreas(areas = []) {
  const source = Array.isArray(areas) && areas.length ? areas : buildDefaultMaterialTakeoffAreas();
  return source.map((area, idx) => ({
    id: area.id || makeAreaId(area.key, idx),
    key: area.key || `custom-${idx + 1}`,
    label: area.label || `Area ${idx + 1}`,
    materialType: area.materialType === 'foam' ? 'foam' : 'fiberglass',
    materialItemId: area.materialItemId || '',
    sqft: area.sqft ?? '',
    installedInches: area.installedInches ?? '',
    oversprayInches: area.oversprayInches ?? '1',
    foamType: area.foamType === 'closedCell' ? 'closedCell' : 'openCell',
  }));
}

export function calculateFiberglassAreaUsage(area = {}, inventoryItems = []) {
  const sqft = num(area.sqft);
  const item = (inventoryItems || []).find((entry) => entry?.id === area.materialItemId);
  const coverageSqft = num(item?.sqftPerTube || item?.coverageSqft || item?.sqftPerUnit);
  if (!(sqft > 0) || !item || !(coverageSqft > 0)) return null;
  const qty = roundQty(sqft / coverageSqft, 2);
  return {
    areaId: area.id,
    areaLabel: area.label || 'Area',
    itemId: item.id,
    itemName: item.name || item.id,
    materialType: 'fiberglass',
    sqft,
    coverageSqft,
    qty,
    unit: item.unit || 'units',
  };
}

export function calculateFoamAreaUsage(area = {}, options = {}) {
  const sqft = num(area.sqft);
  const installedInches = num(area.installedInches);
  const oversprayInches = num(area.oversprayInches);
  const effectiveInches = installedInches + oversprayInches;
  const foamType = area.foamType === 'closedCell' ? 'closedCell' : 'openCell';
  const yieldPerSet = num(foamType === 'closedCell' ? options.closedCellYield : options.openCellYield) || (foamType === 'closedCell' ? DEFAULT_CLOSED_CELL_YIELD_PER_SET : DEFAULT_OPEN_CELL_YIELD_PER_SET);
  if (!(sqft > 0) || !(effectiveInches > 0) || !(yieldPerSet > 0) || !area.materialItemId) return null;
  const boardFeet = sqft * effectiveInches;
  const sets = boardFeet / yieldPerSet;
  const qty = roundQty(sets, 2);
  return {
    areaId: area.id,
    areaLabel: area.label || 'Area',
    itemId: area.materialItemId,
    itemName: area.materialItemName || area.materialItemId,
    materialType: 'foam',
    foamType,
    sqft,
    installedInches,
    oversprayInches,
    effectiveInches,
    yieldPerSet,
    boardFeet,
    sets,
    qty,
    unit: 'sets',
  };
}

export function calculateExpectedMaterialsFromTakeoffAreas(areas = [], inventoryItems = [], options = {}) {
  const expectedMaterials = {};
  const areaResults = [];
  const warnings = [];

  normalizeMaterialTakeoffAreas(areas).forEach((area) => {
    const sqft = num(area.sqft);
    if (!(sqft > 0)) return;

    const usage = area.materialType === 'foam'
      ? calculateFoamAreaUsage(area, options)
      : calculateFiberglassAreaUsage(area, inventoryItems);

    if (!usage) {
      if (area.materialType === 'foam') warnings.push(`${area.label} needs foam material, sqft, and installed inches.`);
      else warnings.push(`${area.label} needs a fiberglass material with sqft/tube coverage.`);
      return;
    }

    expectedMaterials[usage.itemId] = roundQty((expectedMaterials[usage.itemId] || 0) + usage.qty, 2);
    areaResults.push(usage);
  });

  return {
    expectedMaterials,
    areaResults,
    warnings,
    totalSqft: areaResults.reduce((sum, row) => sum + (row.sqft || 0), 0),
    totalBoardFeet: areaResults.reduce((sum, row) => sum + (row.boardFeet || 0), 0),
  };
}
