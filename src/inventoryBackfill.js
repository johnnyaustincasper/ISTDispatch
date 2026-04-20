import {
  INVENTORY_EVENT_TYPES,
  adaptLegacyTruckInventoryToSnapshotEvents,
  adaptLegacyWarehouseInventoryToSnapshotEvents,
  buildCanonicalInventoryEventId,
  buildWarehouseInventoryBackfillSnapshotKey,
  normalizeInventoryItemId,
  normalizeLegacyWarehouseInventoryRows,
} from "./inventoryEvents.js";
import { buildInventoryEventWriteEntries, INVENTORY_EVENTS_COLLECTION } from "./inventoryEventWrites.js";

export const TRUCK_INVENTORY_BACKFILL_VERSION = 1;
export const TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT = "2026-01-01T00:00:00.000Z";
export const TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE = "2026-01-01";
export const TRUCK_INVENTORY_BACKFILL_WRITE_SOURCE = `truck-inventory-backfill-v${TRUCK_INVENTORY_BACKFILL_VERSION}`;

const asNullableString = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = `${value}`.trim();
  return trimmed || null;
};

const normalizeLegacyTruckInventoryState = (truckInventory = {}) => {
  if (!truckInventory || typeof truckInventory !== "object" || Array.isArray(truckInventory)) return {};

  const normalized = {};
  Object.entries(truckInventory).forEach(([itemId, qty]) => {
    if (itemId === "_custom") return;
    const normalizedItemId = normalizeInventoryItemId(itemId) || itemId;
    const normalizedQty = Math.round((parseFloat(qty) || 0) * 1000) / 1000;
    if (!normalizedItemId) return;
    normalized[normalizedItemId] = Math.round(((normalized[normalizedItemId] || 0) + normalizedQty) * 1000) / 1000;
  });

  return Object.fromEntries(
    Object.entries(normalized).sort(([left], [right]) => `${left}`.localeCompare(`${right}`))
  );
};

export const buildTruckInventoryBackfillSnapshotKey = ({ truckId, version = TRUCK_INVENTORY_BACKFILL_VERSION } = {}) => (
  ["truck-inventory-backfill", `v${version}`, asNullableString(truckId) || "truck"].join("::")
);

export const buildTruckInventoryBackfillEvents = ({
  truckId,
  truckName = null,
  truckInventory = {},
  occurredAt = TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
  effectiveDate = TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE,
  actor = {},
  legacyDocId = null,
  version = TRUCK_INVENTORY_BACKFILL_VERSION,
} = {}) => {
  const normalizedTruckId = asNullableString(truckId);
  if (!normalizedTruckId) throw new Error("buildTruckInventoryBackfillEvents requires truckId");

  const snapshotKey = buildTruckInventoryBackfillSnapshotKey({ truckId: normalizedTruckId, version });
  const normalizedInventory = normalizeLegacyTruckInventoryState(truckInventory);
  const events = adaptLegacyTruckInventoryToSnapshotEvents({
    truckId: normalizedTruckId,
    truckName,
    truckInventory: normalizedInventory,
    occurredAt,
    actor: {
      actorId: "phase4-truck-backfill",
      actorName: "Phase 4 truck inventory backfill",
      actorRole: "system",
      source: "migration",
      ...actor,
    },
    legacyDocId: legacyDocId || normalizedTruckId,
  }).map((event) => ({
    ...event,
    effectiveDate,
    refs: {
      ...(event.refs || {}),
      snapshotKey,
      correlationKey: snapshotKey,
    },
    metadata: {
      ...(event.metadata || {}),
      baseline: true,
      backfill: true,
      backfillVersion: version,
      backfillScope: "truck_inventory",
      baselineConvention: "fixed_phase4_backfill_anchor",
      eventKind: "truck_inventory_backfill_snapshot",
    },
    legacy: {
      ...(event.legacy || {}),
      canonicalTruckInventory: normalizedInventory,
    },
  }));

  return events.map((event, index) => ({
    ...event,
    id: buildCanonicalInventoryEventId(event, index),
  }));
};

export const buildTruckInventoryBackfillPlan = ({
  truckInventoryByTruckId = {},
  trucks = [],
  selectedTruckId = null,
  occurredAt = TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
  effectiveDate = TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE,
  version = TRUCK_INVENTORY_BACKFILL_VERSION,
} = {}) => {
  const truckNameById = new Map(
    (Array.isArray(trucks) ? trucks : [])
      .filter((truck) => truck?.id)
      .map((truck) => [truck.id, truck.name || truck.label || truck.id])
  );

  const candidateTruckIds = (selectedTruckId ? [selectedTruckId] : Object.keys(truckInventoryByTruckId || {}))
    .filter(Boolean)
    .sort((a, b) => `${a}`.localeCompare(`${b}`));

  const trucksProcessed = [];
  const skipped = [];
  const events = [];

  candidateTruckIds.forEach((truckId) => {
    const state = truckInventoryByTruckId?.[truckId];
    if (!state || typeof state !== "object") {
      skipped.push({ truckId, reason: "missing_truck_inventory" });
      return;
    }

    const normalizedState = normalizeLegacyTruckInventoryState(state);
    const itemCount = Object.keys(normalizedState).length;
    const truckEvents = buildTruckInventoryBackfillEvents({
      truckId,
      truckName: truckNameById.get(truckId) || null,
      truckInventory: normalizedState,
      occurredAt,
      effectiveDate,
      version,
    });

    trucksProcessed.push({
      truckId,
      truckName: truckNameById.get(truckId) || null,
      itemCount,
      eventCount: truckEvents.length,
      snapshotKey: buildTruckInventoryBackfillSnapshotKey({ truckId, version }),
      sampleEventIds: truckEvents.slice(0, 3).map((event) => event.id),
      includesZeroItemSnapshot: itemCount === 0,
    });
    events.push(...truckEvents);
  });

  return {
    version,
    occurredAt,
    effectiveDate,
    collectionName: INVENTORY_EVENTS_COLLECTION,
    writeSource: TRUCK_INVENTORY_BACKFILL_WRITE_SOURCE,
    selectedTruckId: selectedTruckId || null,
    truckCount: trucksProcessed.length,
    eventCount: events.length,
    skippedCount: skipped.length,
    trucks: trucksProcessed,
    skipped,
    events,
  };
};

export const buildTruckInventoryBackfillWriteEntries = (plan = {}, options = {}) => buildInventoryEventWriteEntries(plan.events || [], {
  collectionName: options.collectionName || plan.collectionName || INVENTORY_EVENTS_COLLECTION,
  writeSource: options.writeSource || plan.writeSource || TRUCK_INVENTORY_BACKFILL_WRITE_SOURCE,
  idFactory: (event, index) => event?.id || buildCanonicalInventoryEventId(event, index),
  createdAtValue: options.createdAtValue,
});

export const WAREHOUSE_INVENTORY_BACKFILL_VERSION = 1;
export const WAREHOUSE_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT = "2026-01-01T00:00:00.000Z";
export const WAREHOUSE_INVENTORY_BACKFILL_EFFECTIVE_DATE = "2026-01-01";
export const WAREHOUSE_INVENTORY_BACKFILL_WRITE_SOURCE = `warehouse-inventory-backfill-v${WAREHOUSE_INVENTORY_BACKFILL_VERSION}`;

export const buildWarehouseInventoryBackfillEvents = ({
  inventory = [],
  warehouseId = "main",
  occurredAt = WAREHOUSE_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
  effectiveDate = WAREHOUSE_INVENTORY_BACKFILL_EFFECTIVE_DATE,
  actor = {},
  version = WAREHOUSE_INVENTORY_BACKFILL_VERSION,
} = {}) => {
  const normalizedWarehouseId = asNullableString(warehouseId) || "main";
  const snapshotKey = buildWarehouseInventoryBackfillSnapshotKey({
    warehouseId: normalizedWarehouseId,
    baselineTag: `phase4-v${version}`,
    occurredAt,
    effectiveDate,
  });
  const normalizedInventory = normalizeLegacyWarehouseInventoryRows(inventory);
  const events = adaptLegacyWarehouseInventoryToSnapshotEvents({
    inventory: normalizedInventory,
    warehouseId: normalizedWarehouseId,
    occurredAt,
    effectiveDate,
    baselineTag: `phase4-v${version}`,
    snapshotKey,
    actor: {
      actorId: "phase4-warehouse-backfill",
      actorName: "Phase 4 warehouse inventory backfill",
      actorRole: "system",
      source: "migration",
      ...actor,
    },
    metadata: {
      baseline: true,
      backfill: true,
      backfillVersion: version,
      backfillScope: "warehouse_inventory",
      baselineConvention: "fixed_phase4_backfill_anchor",
      eventKind: "warehouse_inventory_backfill_snapshot",
    },
    legacy: {
      canonicalInventory: normalizedInventory,
    },
  });

  return events.map((event, index) => ({
    ...event,
    id: buildCanonicalInventoryEventId(event, index),
  }));
};

export const buildWarehouseInventoryBackfillPlan = ({
  inventory = [],
  warehouseId = "main",
  occurredAt = WAREHOUSE_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
  effectiveDate = WAREHOUSE_INVENTORY_BACKFILL_EFFECTIVE_DATE,
  version = WAREHOUSE_INVENTORY_BACKFILL_VERSION,
} = {}) => {
  const events = buildWarehouseInventoryBackfillEvents({
    inventory,
    warehouseId,
    occurredAt,
    effectiveDate,
    version,
  });
  const normalizedInventory = normalizeLegacyWarehouseInventoryRows(inventory);

  return {
    version,
    occurredAt,
    effectiveDate,
    warehouseId,
    collectionName: INVENTORY_EVENTS_COLLECTION,
    writeSource: WAREHOUSE_INVENTORY_BACKFILL_WRITE_SOURCE,
    itemCount: normalizedInventory.length,
    eventCount: events.length,
    snapshotKey: buildWarehouseInventoryBackfillSnapshotKey({
      warehouseId,
      baselineTag: `phase4-v${version}`,
      occurredAt,
      effectiveDate,
    }),
    sampleEventIds: events.slice(0, 5).map((event) => event.id),
    includesZeroItemSnapshot: normalizedInventory.length === 0,
    events,
  };
};

export const buildWarehouseInventoryBackfillWriteEntries = (plan = {}, options = {}) => buildInventoryEventWriteEntries(plan.events || [], {
  collectionName: options.collectionName || plan.collectionName || INVENTORY_EVENTS_COLLECTION,
  writeSource: options.writeSource || plan.writeSource || WAREHOUSE_INVENTORY_BACKFILL_WRITE_SOURCE,
  idFactory: (event, index) => event?.id || buildCanonicalInventoryEventId(event, index),
  createdAtValue: options.createdAtValue,
});
