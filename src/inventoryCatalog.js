const slugifyInventoryItemId = (value = "") => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const toOptionalNumber = (value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const cleanString = (value, fallback = "") => String(value ?? fallback).trim();

export const normalizeInventoryCatalogOverride = (raw = {}) => {
  const id = slugifyInventoryItemId(raw.id || raw.itemId || raw.name);
  if (!id) throw new Error("Inventory item needs an id or name.");

  const deleted = !!raw.deleted;
  const normalized = {
    id,
    name: cleanString(raw.name, id),
    unit: cleanString(raw.unit, "units"),
    category: cleanString(raw.category, "Other"),
    deleted,
  };

  const cost = toOptionalNumber(raw.cost);
  if (cost !== undefined) normalized.cost = cost;

  const pcsPerTube = toOptionalNumber(raw.pcsPerTube);
  if (pcsPerTube !== undefined) normalized.pcsPerTube = pcsPerTube;

  const sqftPerTube = toOptionalNumber(raw.sqftPerTube);
  if (sqftPerTube !== undefined) normalized.sqftPerTube = sqftPerTube;

  if (raw.hasPieces !== undefined) normalized.hasPieces = !!raw.hasPieces;
  if (raw.isPieces !== undefined) normalized.isPieces = !!raw.isPieces;
  if (raw.parentId) normalized.parentId = slugifyInventoryItemId(raw.parentId);
  if (raw.source) normalized.source = raw.source;

  return normalized;
};

export const buildInventoryCatalog = (baseItems = [], overrides = []) => {
  const byId = new Map((baseItems || []).map((item) => [item.id, { ...item, source: item.source || "base" }]));

  for (const raw of overrides || []) {
    if (!raw) continue;
    const override = normalizeInventoryCatalogOverride(raw);
    if (override.deleted) {
      byId.delete(override.id);
      continue;
    }
    const existing = byId.get(override.id) || {};
    byId.set(override.id, { ...existing, ...override, source: raw.source || existing.source || "custom" });
  }

  return [...byId.values()];
};

export const buildInventoryCatalogSavePayloads = (raw = {}) => {
  const main = normalizeInventoryCatalogOverride({ ...raw, isPieces: false, deleted: false });
  if (!main.hasPieces) return [main];

  const pieceId = slugifyInventoryItemId(raw.pieceId || `${main.id}_pcs`);
  const pieceCost = main.cost !== undefined && main.pcsPerTube
    ? Math.round((main.cost / main.pcsPerTube) * 100) / 100
    : undefined;
  const piece = normalizeInventoryCatalogOverride({
    id: pieceId,
    name: raw.pieceName || main.name,
    unit: "pcs",
    category: main.category,
    cost: raw.pieceCost ?? pieceCost,
    isPieces: true,
    parentId: main.id,
    deleted: false,
  });

  return [main, piece];
};
