import assert from "node:assert/strict";
import {
  INVENTORY_EVENT_TYPES,
  buildCanonicalInventoryEventId,
  buildInventoryEvent,
  buildInventorySnapshotEventId,
  buildJobSiteKey,
  buildInventorySnapshotEvents,
  buildWarehouseInventoryBackfillSnapshotKey,
  adaptLiveDailyMaterialLogUpsertToEvents,
  adaptLegacyWarehouseInventoryToSnapshotEvents,
  normalizeLegacyWarehouseInventoryRows,
  planWarehouseInventoryBackfill,
  buildJobUsageBackfillPlan,
  deriveJobUsageFromEvents,
  deriveTruckInventoryFromEvents,
  deriveWarehouseInventoryFromEvents,
  getCloseoutOnlyMaterialsUsedDelta,
  getJobUsageParityReport,
  getWarehouseInventoryParityReport,
  getInventoryTraceDiagnostics,
  normalizeJobSiteAddress,
  planTruckLoadoutTransfer,
} from "../src/inventoryEvents.js";
import { buildInventoryEventWriteEntries } from "../src/inventoryEventWrites.js";
import {
  TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
  TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE,
  TRUCK_INVENTORY_BACKFILL_WRITE_SOURCE,
  buildTruckInventoryBackfillEvents,
  buildTruckInventoryBackfillPlan,
  buildTruckInventoryBackfillSnapshotKey,
  buildTruckInventoryBackfillWriteEntries,
} from "../src/inventoryBackfill.js";

const test = (name, fn) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
};

test("canonical inventory event ids stay stable for the same logical event", () => {
  const event = buildInventoryEvent({
    eventType: INVENTORY_EVENT_TYPES.jobUsage,
    occurredAt: "2026-04-18T12:00:00.000Z",
    effectiveDate: "2026-04-18",
    item: { itemId: "Ambit Open Cell B", unit: "bbl" },
    quantity: { delta: -1 },
    location: { truckId: "truck-7", jobId: "job-42" },
    refs: { correlationKey: "job-42::2026-04-18::truck-7" },
  });

  assert.equal(
    buildCanonicalInventoryEventId(event),
    "job-usage__job-42-2026-04-18-truck-7__oc_b",
  );
  assert.equal(buildCanonicalInventoryEventId(event), buildCanonicalInventoryEventId({ ...event }));
});

test("truck loadout planning tops up to target instead of pulling full target", () => {
  const plan = planTruckLoadoutTransfer({
    currentTruckState: { blown_fg: 15 },
    requestedTruckState: { blown_fg: 50 },
    warehouseInventoryByItemId: { blown_fg: 100 },
  });

  assert.deepEqual(plan.nextTruckState, { blown_fg: 50 });
  assert.deepEqual(plan.changes, [
    {
      itemId: "blown_fg",
      beforeTruckQty: 15,
      targetTruckQty: 50,
      delta: 35,
      transferDirection: "load",
      transferQty: 35,
      beforeWarehouseQty: 100,
      afterWarehouseQty: 65,
    },
  ]);
});

test("truck loadout planning returns unloaded leftovers to warehouse", () => {
  const plan = planTruckLoadoutTransfer({
    currentTruckState: { blown_fg: 15 },
    requestedTruckState: { blown_fg: 0 },
    warehouseInventoryByItemId: { blown_fg: 100 },
  });

  assert.deepEqual(plan.nextTruckState, {});
  assert.deepEqual(plan.changes, [
    {
      itemId: "blown_fg",
      beforeTruckQty: 15,
      targetTruckQty: 0,
      delta: -15,
      transferDirection: "return",
      transferQty: 15,
      beforeWarehouseQty: 100,
      afterWarehouseQty: 115,
    },
  ]);
});

test("warehouse manual adjustment snapshot re-anchors projection to corrected legacy quantity", () => {
  const legacyInventory = [{ id: "row-blown", itemId: "blown_fg", qty: 42 }];
  const historicalTransfer = buildInventoryEvent({
    eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
    occurredAt: "2026-04-18T12:00:00.000Z",
    item: { itemId: "blown_fg", unit: "bags" },
    quantity: { delta: -10 },
    location: { warehouseId: "main" },
    refs: { correlationKey: "truck-load-1" },
  });
  const manualEventGroupId = "manual-adjustment::blown_fg::2026-04-19T12:00:00.000Z";
  const manualAdjustment = buildInventoryEvent({
    eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
    occurredAt: "2026-04-19T12:00:00.000Z",
    item: { itemId: "blown_fg", unit: "bags" },
    quantity: { delta: -8, after: 42 },
    location: { warehouseId: "main" },
    refs: { correlationKey: "manual-adjustment-1" },
    metadata: { eventGroupId: manualEventGroupId },
  });
  const [manualSnapshot] = buildInventorySnapshotEvents({
    eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
    occurredAt: "2026-04-19T12:00:00.000Z",
    item: { itemId: "blown_fg", unit: "bags" },
    location: { warehouseId: "main" },
    items: [{ itemId: "blown_fg", unit: "bags", qty: 42 }],
    refs: { snapshotKey: "warehouse-adjustment::blown_fg::manual-adjustment-1", correlationKey: "manual-adjustment-1" },
    metadata: { eventGroupId: manualEventGroupId },
  });

  const derived = deriveWarehouseInventoryFromEvents(legacyInventory, [historicalTransfer, manualAdjustment, manualSnapshot]);
  assert.equal(derived.find((row) => row.itemId === "blown_fg")?.qty, 42);
});

test("inventory event write entries stamp deterministic ids without live wiring", () => {
  const entries = buildInventoryEventWriteEntries([
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-18T13:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 3 },
      location: { truckId: "truck-1" },
      refs: { correlationKey: "truck-1::load-1" },
    }),
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventId, "truck-transfer__truck-1-load-1__blown_fg");
  assert.equal(entries[0].payload.id, entries[0].eventId);
  assert.equal(entries[0].payload.writeMeta.source, "inventory-dual-write");
});

test("truck inventory backfill snapshot keys are stable and versioned", () => {
  assert.equal(
    buildTruckInventoryBackfillSnapshotKey({ truckId: "truck-7" }),
    "truck-inventory-backfill::v1::truck-7",
  );
  assert.equal(
    buildTruckInventoryBackfillSnapshotKey({ truckId: "truck-7" }),
    buildTruckInventoryBackfillSnapshotKey({ truckId: "truck-7", version: 1 }),
  );
});

test("truck inventory backfill events are deterministic and normalize aliases", () => {
  const events = buildTruckInventoryBackfillEvents({
    truckId: "truck-7",
    truckName: "Truck 7",
    truckInventory: {
      "Ambit Open Cell A-side": 2,
      oc_a: 1,
      blown_fg: 4,
      _custom: [{ name: "Ignore Me", qty: 2 }],
    },
  });

  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((event) => ({
      id: event.id,
      itemId: event.item.itemId,
      after: event.quantity.after,
      occurredAt: event.occurredAt,
      effectiveDate: event.effectiveDate,
      snapshotKey: event.refs.snapshotKey,
      baseline: event.metadata.baseline,
    })),
    [
      {
        id: "truck-snapshot__truck-inventory-backfill-v1-truck-7__blown_fg",
        itemId: "blown_fg",
        after: 4,
        occurredAt: TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
        effectiveDate: TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE,
        snapshotKey: "truck-inventory-backfill::v1::truck-7",
        baseline: true,
      },
      {
        id: "truck-snapshot__truck-inventory-backfill-v1-truck-7__oc_a",
        itemId: "oc_a",
        after: 3,
        occurredAt: TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
        effectiveDate: TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE,
        snapshotKey: "truck-inventory-backfill::v1::truck-7",
        baseline: true,
      },
    ],
  );
  assert.deepEqual(events, buildTruckInventoryBackfillEvents({
    truckId: "truck-7",
    truckName: "Truck 7",
    truckInventory: {
      "Ambit Open Cell A-side": 2,
      oc_a: 1,
      blown_fg: 4,
    },
  }));
});

test("truck inventory backfill plans include zero-item trucks for explicit baseline anchors", () => {
  const plan = buildTruckInventoryBackfillPlan({
    truckInventoryByTruckId: {
      "truck-2": {},
      "truck-1": { blown_fg: 2 },
    },
    trucks: [{ id: "truck-1", name: "Truck 1" }, { id: "truck-2", name: "Truck 2" }],
  });

  assert.equal(plan.truckCount, 2);
  assert.equal(plan.eventCount, 1);
  assert.deepEqual(plan.trucks, [
    {
      truckId: "truck-1",
      truckName: "Truck 1",
      itemCount: 1,
      eventCount: 1,
      snapshotKey: "truck-inventory-backfill::v1::truck-1",
      sampleEventIds: ["truck-snapshot__truck-inventory-backfill-v1-truck-1__blown_fg"],
      includesZeroItemSnapshot: false,
    },
    {
      truckId: "truck-2",
      truckName: "Truck 2",
      itemCount: 0,
      eventCount: 0,
      snapshotKey: "truck-inventory-backfill::v1::truck-2",
      sampleEventIds: [],
      includesZeroItemSnapshot: true,
    },
  ]);
});

test("truck inventory backfill write entries stay idempotent and carry backfill source metadata", () => {
  const plan = buildTruckInventoryBackfillPlan({
    truckInventoryByTruckId: { "truck-1": { blown_fg: 2 } },
  });
  const entries = buildTruckInventoryBackfillWriteEntries(plan, { createdAtValue: "created-at-stub" });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].eventId, "truck-snapshot__truck-inventory-backfill-v1-truck-1__blown_fg");
  assert.equal(entries[0].payload.id, entries[0].eventId);
  assert.equal(entries[0].payload.createdAt, "created-at-stub");
  assert.equal(entries[0].payload.writeMeta.source, TRUCK_INVENTORY_BACKFILL_WRITE_SOURCE);
  assert.equal(entries[0].payload.metadata.backfill, true);
});

test("live daily material log upserts mark current scope and clear omitted prior items", () => {
  const events = adaptLiveDailyMaterialLogUpsertToEvents({
    job: { id: "job-42", address: "123 Main St", truckId: "truck-7" },
    log: {
      date: "2026-04-18",
      truckId: "truck-7",
      loggedBy: "Crew A",
      timestamp: "2026-04-18T13:00:00.000Z",
      materials: { blown_fg: 3 },
    },
    priorLog: {
      date: "2026-04-18",
      truckId: "truck-7",
      materials: { blown_fg: 2, oc_a: 1 },
    },
  });

  assert.equal(events.length, 2);
  const usageEvent = events.find((event) => event.item.itemId === "blown_fg");
  const clearedEvent = events.find((event) => event.item.itemId === "oc_a");
  assert.equal(usageEvent.metadata.upsert, true);
  assert.equal(clearedEvent.metadata.cleared, true);
  assert.equal(clearedEvent.quantity.delta, 0);
  assert.equal(clearedEvent.quantity.after, 0);
});

test("legacy warehouse backfill rows normalize aliases, merge duplicates, and preserve lineage", () => {
  const rows = normalizeLegacyWarehouseInventoryRows([
    { id: "a1", itemId: "Ambit Open Cell B", qty: 1.25, unit: "bbl" },
    { id: "a2", itemId: "oc_b", qty: 0.75, category: "Foam" },
    { id: "a3", itemId: "blown_fg", qty: 4, unit: "bags" },
  ]);

  assert.deepEqual(rows, [
    {
      id: "a3",
      itemId: "blown_fg",
      itemName: null,
      unit: "bags",
      category: null,
      qty: 4,
      legacyRowIds: ["a3"],
      sourceRowCount: 1,
      firstSeenIndex: 2,
    },
    {
      id: "a1",
      itemId: "oc_b",
      itemName: null,
      unit: "bbl",
      category: "Foam",
      qty: 2,
      legacyRowIds: ["a1", "a2"],
      sourceRowCount: 2,
      firstSeenIndex: 0,
    },
  ]);
});

test("warehouse backfill planning emits stable snapshot ids and rerunnable metadata", () => {
  const plan = planWarehouseInventoryBackfill({
    inventory: [
      { id: "inv-1", itemId: "Ambit Open Cell B", qty: 2, unit: "bbl" },
      { id: "inv-2", itemId: "blown_fg", qty: 4, unit: "bags" },
    ],
    warehouseId: "main",
    occurredAt: "2026-04-19T20:00:00.000Z",
    effectiveDate: "2026-04-19",
    baselineTag: "phase4-baseline",
  });

  assert.equal(plan.snapshotKey, buildWarehouseInventoryBackfillSnapshotKey({
    warehouseId: "main",
    baselineTag: "phase4-baseline",
    occurredAt: "2026-04-19T20:00:00.000Z",
    effectiveDate: "2026-04-19",
  }));
  assert.deepEqual(plan.eventIds, [
    "warehouse-snapshot__main-phase4-baseline-2026-04-19__blown_fg",
    "warehouse-snapshot__main-phase4-baseline-2026-04-19__oc_b",
  ]);
  assert.equal(plan.events[0].metadata.backfill, true);
  assert.equal(plan.events[0].refs.legacyDocId, "blown_fg");
  assert.deepEqual(plan.events[1].legacy.sourceRowIds, ["inv-1"]);
});

test("legacy warehouse snapshot adapter keeps zero rows and deterministic lineage", () => {
  const events = adaptLegacyWarehouseInventoryToSnapshotEvents({
    inventory: [
      { id: "inv-1", itemId: "oc_b", qty: 0, unit: "bbl" },
      { id: "inv-2", itemId: "blown_fg", qty: 3, unit: "bags" },
    ],
    warehouseId: "main",
    occurredAt: "2026-04-19T21:00:00.000Z",
    baselineTag: "phase4-baseline",
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].refs.snapshotKey, events[1].refs.snapshotKey);
  assert.equal(events.find((event) => event.item.itemId === "oc_b").quantity.after, 0);
  assert.deepEqual(events.find((event) => event.item.itemId === "oc_b").legacy.sourceRowIds, ["inv-1"]);
});

test("legacy truck state is not double-counted by dual-write delta events without a snapshot", () => {
  const legacyTruckInventory = { "truck-1": { blown_fg: 7 } };
  const events = [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 2, before: 5, after: 7 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T12:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -1 },
      location: { truckId: "truck-1", jobId: "job-1" },
    }),
  ];

  assert.deepEqual(deriveTruckInventoryFromEvents(legacyTruckInventory, events), legacyTruckInventory);
});

test("legacy truck baselines can still advance when later transfer events line up with the current state", () => {
  const rebuilt = deriveTruckInventoryFromEvents({ "truck-1": { blown_fg: 7 } }, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 2, before: 5, after: 7 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T11:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -3, before: 7, after: 4 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T12:00:00.000Z",
      item: { itemId: "oc_b", unit: "bbl" },
      quantity: { delta: 1.5, before: 0, after: 1.5 },
      location: { truckId: "truck-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 4, oc_b: 1.5 } });
});

test("legacy truck aliases are normalized and merged before event replay", () => {
  const rebuilt = deriveTruckInventoryFromEvents({
    "truck-1": {
      "Ambit Open Cell A-side": 2,
      oc_a: 1,
      blown_fg: 4,
      _custom: [{ name: "Widget", qty: "2" }],
    },
  }, []);

  assert.deepEqual(rebuilt, {
    "truck-1": {
      oc_a: 3,
      blown_fg: 4,
      _custom: [{ name: "Widget", qty: 2 }],
    },
  });
});

test("truck balances can be rebuilt from latest snapshot plus later deltas", () => {
  const rebuilt = deriveTruckInventoryFromEvents({}, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 6 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 2 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T11:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -3 },
      location: { truckId: "truck-1", jobId: "job-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 5 } });
});

test("truck projections keep every row from the latest multi-item snapshot group before later deltas", () => {
  const rebuilt = deriveTruckInventoryFromEvents({}, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 6 },
      location: { truckId: "truck-1" },
      refs: { snapshotKey: "truck-1::2026-04-17T09:00:00.000Z" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "oc_b", unit: "bbl" },
      quantity: { after: 2 },
      location: { truckId: "truck-1" },
      refs: { snapshotKey: "truck-1::2026-04-17T09:00:00.000Z" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "r13_15_8_pcs", unit: "pcs" },
      quantity: { after: 5 },
      location: { truckId: "truck-1" },
      refs: { snapshotKey: "truck-1::2026-04-17T09:00:00.000Z" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -1 },
      location: { truckId: "truck-1", jobId: "job-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 5, oc_b: 2, r13_15_8_pcs: 5 } });
});

test("delta-only truck history can seed a new or zeroed truck without requiring a snapshot", () => {
  const rebuilt = deriveTruckInventoryFromEvents({}, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 4 },
      location: { truckId: "truck-9" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T11:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -1 },
      location: { truckId: "truck-9", jobId: "job-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-9": { blown_fg: 3 } });
});

test("truck snapshots win deterministic ordering when timestamp ties with later deltas", () => {
  const rebuilt = deriveTruckInventoryFromEvents({}, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 2 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 6 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -3 },
      location: { truckId: "truck-1", jobId: "job-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 5 } });
});

test("warehouse parity reports aligned state when legacy and event-derived balances match", () => {
  const legacyInventory = [{ itemId: "blown_fg", qty: 4, unit: "bags" }];
  const report = getWarehouseInventoryParityReport({
    legacyInventory,
    events: [
      buildInventoryEvent({
        eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
        occurredAt: "2026-04-17T10:00:00.000Z",
        item: { itemId: "blown_fg", unit: "bags" },
        quantity: { delta: 1, before: 3, after: 4 },
        location: { warehouseId: "main" },
      }),
    ],
  });

  assert.equal(report.matches, true);
  assert.equal(report.mismatchedItemCount, 0);
});

test("warehouse parity reports mismatches without mutating legacy rows", () => {
  const report = getWarehouseInventoryParityReport({
    legacyInventory: [{ itemId: "oc_b", itemName: "Ambit Open Cell B", qty: 2, unit: "bbl" }],
    events: [
      buildInventoryEvent({
        eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
        occurredAt: "2026-04-17T10:00:00.000Z",
        item: { itemId: "oc_b", unit: "bbl" },
        quantity: { after: 1.5 },
        location: { warehouseId: "main" },
        refs: { snapshotKey: "warehouse::2026-04-17T10:00:00.000Z" },
      }),
    ],
  });

  assert.equal(report.matches, false);
  assert.equal(report.mismatchedItemCount, 1);
  assert.deepEqual(report.mismatches[0], {
    itemId: "oc_b",
    itemName: "Ambit Open Cell B",
    unit: "bbl",
    category: null,
    legacyQty: 2,
    eventQty: 1.5,
    delta: -0.5,
  });
});

test("truck reconcile snapshot does not double-apply same-group deltas written after the snapshot", () => {
  const rebuilt = deriveTruckInventoryFromEvents({}, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 6 },
      location: { truckId: "truck-1" },
      refs: { snapshotKey: "truck-1::crew-reconcile" },
      metadata: { eventGroupId: "crew-reconcile-1", eventKind: "crew_reconcile_snapshot" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T10:00:00.500Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 2, before: 4, after: 6 },
      location: { truckId: "truck-1" },
      metadata: { eventGroupId: "crew-reconcile-1", eventKind: "crew_reconcile" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 6 } });
});

test("truck backfill baseline snapshots do not fake-red by replaying mismatched historical usage", () => {
  const rebuilt = deriveTruckInventoryFromEvents({}, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-01-01T00:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 18 },
      location: { truckId: "truck-1" },
      refs: { snapshotKey: "truck-inventory-backfill::v1::truck-1" },
      metadata: {
        baseline: true,
        backfill: true,
        backfillScope: "truck_inventory",
        eventKind: "truck_inventory_backfill_snapshot",
      },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T12:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -5, before: 23, after: 18 },
      location: { truckId: "truck-1", jobId: "job-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 18 } });
});

test("truck backfill baseline snapshots still accept later deltas when before-after lines up", () => {
  const rebuilt = deriveTruckInventoryFromEvents({}, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-01-01T00:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 18 },
      location: { truckId: "truck-1" },
      refs: { snapshotKey: "truck-inventory-backfill::v1::truck-1" },
      metadata: {
        baseline: true,
        backfill: true,
        backfillScope: "truck_inventory",
        eventKind: "truck_inventory_backfill_snapshot",
      },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T13:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 2, before: 18, after: 20 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T14:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -3, before: 20, after: 17 },
      location: { truckId: "truck-1", jobId: "job-2" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 17 } });
});

test("trace diagnostics summarize alignment and coverage gaps for admin audit confidence", () => {
  const diagnostics = getInventoryTraceDiagnostics({
    ledgerEntries: [
      { delta: -2 },
      { delta: 1 },
    ],
    inventoryEvents: [
      {
        delta: -1,
        before: 12,
        after: 11,
        eventGroupId: "grp-1",
        actorName: "Johnny",
      },
      {
        delta: 0,
        before: null,
        after: 11,
      },
    ],
  });

  assert.deepEqual(diagnostics, {
    ledgerDeltaTotal: -1,
    eventDeltaTotal: -1,
    deltaGap: 0,
    isDeltaAligned: true,
    ledgerTouchCount: 2,
    eventTouchCount: 2,
    groupedEventCount: 1,
    beforeAfterEventCount: 1,
    actorNamedEventCount: 1,
    missingGroupCount: 1,
    missingBeforeAfterCount: 1,
    unnamedActorCount: 1,
  });
});

test("legacy warehouse state is not double-counted by dual-write warehouse adjustments without a snapshot", () => {
  const legacyInventory = [{ id: "blown_fg", itemId: "blown_fg", qty: 12, unit: "bags" }];
  const events = [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2, before: 14, after: 12 },
      location: { warehouseId: "main", truckId: "truck-1" },
    }),
  ];

  assert.deepEqual(deriveWarehouseInventoryFromEvents(legacyInventory, events), legacyInventory);
});

test("legacy warehouse baselines can still advance when later admin returns and loads line up with the current state", () => {
  const rebuilt = deriveWarehouseInventoryFromEvents([{ id: "blown_fg", itemId: "blown_fg", qty: 12, unit: "bags" }], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2, before: 14, after: 12 },
      location: { warehouseId: "main", truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T11:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 3, before: 12, after: 15 },
      location: { warehouseId: "main", truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T12:00:00.000Z",
      item: { itemId: "oc_b", unit: "bbl" },
      quantity: { delta: -1, before: 0, after: -1 },
      location: { warehouseId: "main", truckId: "truck-2" },
    }),
  ]);

  assert.deepEqual(rebuilt, [{ id: "blown_fg", itemId: "blown_fg", qty: 15, unit: "bags" }]);
});

test("legacy warehouse duplicates and alias rows are merged before event replay", () => {
  const rebuilt = deriveWarehouseInventoryFromEvents([
    { id: "doc-1", itemId: "blown_fg", qty: 10, unit: "bags" },
    { id: "doc-2", itemId: "blown_fg", qty: 3, unit: "bags" },
    { id: "doc-3", itemId: "Ambit Open Cell A-side", qty: 2, unit: "bbl" },
    { id: "doc-4", itemId: "oc_a", qty: 1, unit: "bbl" },
  ], []);

  assert.deepEqual(rebuilt, [
    { id: "doc-1", itemId: "blown_fg", qty: 13, unit: "bags" },
    { id: "doc-3", itemId: "oc_a", qty: 3, unit: "bbl" },
  ]);
});

test("job site keys normalize common address variants to the same site", () => {
  assert.equal(
    buildJobSiteKey("1234 East 91st Street, Tulsa, OK"),
    buildJobSiteKey("1234 E 91st St Tulsa OK"),
  );
  assert.equal(normalizeJobSiteAddress("8121 South Lewis Avenue #200"), "8121 s lewis ave 200");
});

test("inventory event item normalization collapses separator and A-side/B-side variants", () => {
  const foamEvent = buildInventoryEvent({
    eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
    occurredAt: "2026-04-17T10:00:00.000Z",
    item: { itemId: "Ambit Open Cell A-side", unit: "bbl" },
    quantity: { delta: -1 },
    location: { warehouseId: "main" },
  });
  assert.equal(foamEvent.item.itemId, "oc_a");

  const inventory = deriveWarehouseInventoryFromEvents([
    { id: "oc_a", itemId: "oc_a", qty: 8, unit: "bbl" },
  ], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "oc_a", unit: "bbl" },
      quantity: { after: 8 },
      location: { warehouseId: "main" },
    }),
    foamEvent,
  ]);

  assert.deepEqual(inventory, [{ id: "oc_a", itemId: "oc_a", qty: 7, unit: "bbl" }]);
});

test("warehouse balances can be rebuilt from latest snapshot plus later adjustments", () => {
  const rebuilt = deriveWarehouseInventoryFromEvents([], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 20 },
      location: { warehouseId: "main" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -4 },
      location: { warehouseId: "main", truckId: "truck-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, [{ id: "blown_fg", itemId: "blown_fg", qty: 16 }]);
});

test("warehouse projections keep every row from the latest multi-item snapshot group before later adjustments", () => {
  const rebuilt = deriveWarehouseInventoryFromEvents([], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 20 },
      location: { warehouseId: "main" },
      refs: { snapshotKey: "2026-04-17_opening" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "oc_b", unit: "bbl" },
      quantity: { after: 3 },
      location: { warehouseId: "main" },
      refs: { snapshotKey: "2026-04-17_opening" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -4 },
      location: { warehouseId: "main", truckId: "truck-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, [
    { id: "blown_fg", itemId: "blown_fg", qty: 16 },
    { id: "oc_b", itemId: "oc_b", qty: 3 },
  ]);
});

test("delta-only warehouse history can seed a zero-state warehouse before first snapshot", () => {
  const rebuilt = deriveWarehouseInventoryFromEvents([], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 6 },
      location: { warehouseId: "main" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2 },
      location: { warehouseId: "main", truckId: "truck-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, [{ id: "blown_fg", itemId: "blown_fg", qty: 4 }]);
});

test("warehouse snapshots also win deterministic ordering when timestamp ties with adjustments", () => {
  const rebuilt = deriveWarehouseInventoryFromEvents([], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -4 },
      location: { warehouseId: "main", truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 20 },
      location: { warehouseId: "main" },
    }),
  ]);

  assert.deepEqual(rebuilt, [{ id: "blown_fg", itemId: "blown_fg", qty: 16 }]);
});

test("warehouse snapshot does not double-apply same-group adjustments written after the snapshot", () => {
  const rebuilt = deriveWarehouseInventoryFromEvents([], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 12 },
      location: { warehouseId: "main" },
      refs: { snapshotKey: "main::reconcile" },
      metadata: { eventGroupId: "warehouse-reconcile-1", eventKind: "warehouse_snapshot" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T10:00:00.500Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2, before: 14, after: 12 },
      location: { warehouseId: "main", truckId: "truck-1" },
      metadata: { eventGroupId: "warehouse-reconcile-1", eventKind: "snapshot_adjustment" },
    }),
  ]);

  assert.deepEqual(rebuilt, [{ id: "blown_fg", itemId: "blown_fg", qty: 12 }]);
});

test("snapshot builders keep zero-qty rows and deterministic ids for safe recapture", () => {
  const events = buildInventorySnapshotEvents({
    eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
    occurredAt: "2026-04-17T09:00:00.000Z",
    location: { warehouseId: "main" },
    refs: { snapshotKey: "2026-04-17_opening" },
    items: [
      { itemId: "blown_fg", unit: "bags", qty: 0 },
      { itemId: "oc_b", unit: "bbl", qty: 2 },
    ],
  });

  assert.equal(events.length, 2);
  assert.equal(events[0].quantity.after, 0);
  assert.equal(
    buildInventorySnapshotEventId({
      eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
      snapshotKey: "2026-04-17_opening",
      warehouseId: "main",
      itemId: "blown_fg",
    }),
    "warehouse-snapshot__2026-04-17_opening__blown_fg"
  );
  assert.equal(
    buildInventorySnapshotEventId({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      snapshotKey: "truck-1::evt-123::crew_reconcile",
      truckId: "truck-1",
      itemId: "blown_fg",
    }),
    "truck-snapshot__truck-1-evt-123-crew_reconcile__blown_fg"
  );
});

 test("latest truck snapshot can safely re-anchor balances after missing earlier deltas", () => {
  const rebuilt = deriveTruckInventoryFromEvents({ "truck-1": { blown_fg: 99 } }, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T08:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -4 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { after: 6 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 1 },
      location: { truckId: "truck-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 7 } });
});

test("truck reconciliation events can re-anchor clamped balances before later credits", () => {
  const rebuilt = deriveTruckInventoryFromEvents({ "truck-1": { blown_fg: 2 } }, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.reconciliation,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 0, before: 2, after: 0 },
      location: { truckId: "truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.truckTransfer,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 1, before: 0, after: 1 },
      location: { truckId: "truck-1" },
    }),
  ]);

  assert.deepEqual(rebuilt, { "truck-1": { blown_fg: 1 } });
});

test("warehouse reconciliation events can re-anchor clamped balances before later credits", () => {
  const rebuilt = deriveWarehouseInventoryFromEvents([{ id: "blown_fg", itemId: "blown_fg", qty: 2, unit: "bags" }], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.reconciliation,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 0, before: 2, after: 0 },
      location: { warehouseId: "main" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: 1, before: 0, after: 1 },
      location: { warehouseId: "main" },
    }),
  ]);

  assert.deepEqual(rebuilt, [{ id: "blown_fg", itemId: "blown_fg", qty: 1, unit: "bags" }]);
});

test("job usage projection keeps one effective event per logical item scope", () => {
  const projected = deriveJobUsageFromEvents([], [
    {
      id: "job_usage__job-1__scope-a__blown_fg",
      ...buildInventoryEvent({
        eventType: INVENTORY_EVENT_TYPES.jobUsage,
        occurredAt: "2026-04-17T09:00:00.000Z",
        item: { itemId: "blown_fg", unit: "bags" },
        quantity: { delta: -2 },
        location: { jobId: "job-1", truckId: "truck-1" },
        refs: { correlationKey: "job-1::2026-04-17::truck-1" },
      }),
    },
    {
      id: "job_usage__job-1__scope-a__blown_fg",
      ...buildInventoryEvent({
        eventType: INVENTORY_EVENT_TYPES.jobUsage,
        occurredAt: "2026-04-17T10:00:00.000Z",
        item: { itemId: "blown_fg", unit: "bags" },
        quantity: { delta: -3 },
        location: { jobId: "job-1", truckId: "truck-1" },
        refs: { correlationKey: "job-1::2026-04-17::truck-1" },
      }),
    },
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:05:00.000Z",
      item: { itemId: "oc_a", unit: "bbl" },
      quantity: { delta: -1.5 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 3, oc_a: 1.5 } });
});

test("job usage projection sums effective events across multiple truck scopes for the same job item", () => {
  const projected = deriveJobUsageFromEvents([], [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T09:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T09:30:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -1 },
      location: { jobId: "job-1", truckId: "truck-2" },
      refs: { correlationKey: "job-1::2026-04-17::truck-2" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -4 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 5 } });
});

test("job usage projection replaces legacy daily-log totals once event coverage is complete", () => {
  const legacyJobs = [{
    id: "job-1",
    materialsUsed: { blown_fg: 2 },
    dailyMaterialLogs: [
      { date: "2026-04-17", truckId: "truck-1", materials: { blown_fg: 2 } },
    ],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -5 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 5 } });
});

test("job usage projection does not clear omitted legacy items for a single-scope partial event", () => {
  const legacyJobs = [{
    id: "job-1",
    materialsUsed: { blown_fg: 2, oc_a: 1 },
    dailyMaterialLogs: [
      { date: "2026-04-17", truckId: "truck-1", materials: { blown_fg: 2, oc_a: 1 } },
    ],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -5 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 5, oc_a: 1 } });
});

test("job usage projection keeps legacy totals when event coverage is still partial", () => {
  const legacyJobs = [{
    id: "job-1",
    materialsUsed: { blown_fg: 6, oc_a: 1 },
    dailyMaterialLogs: [
      { date: "2026-04-17", truckId: "truck-1", materials: { blown_fg: 2 } },
      { date: "2026-04-18", truckId: "truck-1", materials: { blown_fg: 4, oc_a: 1 } },
    ],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 6, oc_a: 1 } });
});

test("job usage projection treats legacy blank-truck logs as covered when events use the job truck fallback", () => {
  const legacyJobs = [{
    id: "job-1",
    truckId: "truck-1",
    materialsUsed: { blown_fg: 2 },
    dailyMaterialLogs: [
      { date: "2026-04-17", materials: { blown_fg: 2 } },
    ],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -5 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 5 } });
});

test("job usage projection updates only fully covered items while preserving uncovered legacy items", () => {
  const legacyJobs = [{
    id: "job-1",
    materialsUsed: { blown_fg: 6, oc_a: 1 },
    dailyMaterialLogs: [
      { date: "2026-04-17", truckId: "truck-1", materials: { blown_fg: 2 } },
      { date: "2026-04-18", truckId: "truck-1", materials: { blown_fg: 4, oc_a: 1 } },
    ],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-18T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -5 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-18::truck-1" },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 7, oc_a: 1 } });
});

test("job usage projection clears a legacy item once its full covered scope is edited down to zero", () => {
  const legacyJobs = [{
    id: "job-1",
    materialsUsed: { blown_fg: 2, oc_a: 1 },
    dailyMaterialLogs: [
      { date: "2026-04-17", truckId: "truck-1", materials: { blown_fg: 2, oc_a: 1 } },
    ],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
      metadata: { upsert: true },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 2 } });
});

test("job usage projection can replace aggregate-only legacy totals once event-backed truth exists", () => {
  const legacyJobs = [{
    id: "job-1",
    materialsUsed: { blown_fg: 6, oc_a: 1 },
    dailyMaterialLogs: [],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -4 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:05:00.000Z",
      item: { itemId: "oc_a", unit: "bbl" },
      quantity: { delta: 0, before: -1, after: 0 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
      metadata: { upsert: true, cleared: true },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 4 } });
});

test("job usage projection ignores aggregate closeout summaries when scoped events already cover the same item", () => {
  const legacyJobs = [{
    id: "job-1",
    truckId: "truck-1",
    materialsUsed: { blown_fg: 5 },
    dailyMaterialLogs: [
      { date: "2026-04-17", truckId: "truck-1", materials: { blown_fg: 5 } },
    ],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T12:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -5 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
      metadata: { upsert: true },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T18:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -5 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "aggregate_closeout" },
      metadata: { aggregateOnly: true, upsert: true },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 5 } });
});

test("job usage scope upserts clear omitted legacy items even when only sibling items are emitted", () => {
  const legacyJobs = [{
    id: "job-1",
    truckId: "truck-1",
    materialsUsed: { blown_fg: 2, oc_a: 1 },
    dailyMaterialLogs: [
      { date: "2026-04-17", truckId: "truck-1", materials: { blown_fg: 2, oc_a: 1 } },
    ],
  }];

  const projected = deriveJobUsageFromEvents(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-17T10:00:00.000Z",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2 },
      location: { jobId: "job-1", truckId: "truck-1" },
      refs: { correlationKey: "job-1::2026-04-17::truck-1" },
      metadata: { upsert: true },
    }),
  ]);

  assert.deepEqual(projected, { "job-1": { blown_fg: 2 } });
});

test("job usage parity report compares legacy sources against event-derived totals", () => {
  const legacyJobs = [{
    id: "job-42",
    truckId: "truck-7",
    dailyMaterialLogs: [
      { date: "2026-04-18", truckId: "truck-7", materials: { blown_fg: 2 } },
    ],
    materialsUsed: { blown_fg: 3, oc_b: 1 },
  }];

  const report = getJobUsageParityReport(legacyJobs, [
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-18T13:00:00.000Z",
      effectiveDate: "2026-04-18",
      item: { itemId: "blown_fg", unit: "bags" },
      quantity: { delta: -2 },
      location: { truckId: "truck-7", jobId: "job-42" },
      refs: { correlationKey: "job-42::2026-04-18::truck-7" },
      metadata: { upsert: true },
    }),
    buildInventoryEvent({
      eventType: INVENTORY_EVENT_TYPES.jobUsage,
      occurredAt: "2026-04-18T17:00:00.000Z",
      effectiveDate: "2026-04-18",
      item: { itemId: "oc_b", unit: "bbl" },
      quantity: { delta: -1 },
      location: { truckId: "truck-7", jobId: "job-42" },
      refs: { correlationKey: "job-42::2026-04-18::truck-7::closeout-materials-used" },
      metadata: { closeoutOnly: true },
    }),
  ]);

  assert.equal(report.length, 1);
  assert.deepEqual(report[0].dailyLogTotals, { blown_fg: 2 });
  assert.deepEqual(report[0].closeoutTotals, { blown_fg: 3, oc_b: 1 });
  assert.deepEqual(report[0].eventDerivedTotals, { blown_fg: 2, oc_b: 1 });
  assert.equal(report[0].vsDailyLogs.mismatchCount, 1);
  assert.equal(report[0].vsCloseout.mismatchCount, 1);
  assert.equal(report[0].vsEffectiveLegacy.mismatchCount, 1);
  assert.equal(report[0].isAligned, false);
});

test("closeout-only materials delta subtracts daily logs and never double-counts overlap", () => {
  const leftover = getCloseoutOnlyMaterialsUsedDelta({
    truckId: "truck-7",
    materialsUsed: { blown_fg: 6, oc_a: 1, cc_b: 2 },
    dailyMaterialLogs: [
      { date: "2026-04-18", truckId: "truck-7", materials: { blown_fg: 4, oc_a: 1, cc_b: 3 } },
    ],
  });

  assert.deepEqual(leftover, { blown_fg: 2 });
});

test("job usage backfill plan is deterministic and rerunnable against existing event ids", () => {
  const jobs = [{
    id: "job-42",
    address: "123 Main St",
    truckId: "truck-7",
    closedAt: "2026-04-18T17:00:00.000Z",
    materialsUsed: { blown_fg: 6, oc_b: 1 },
    dailyMaterialLogs: [
      { date: "2026-04-18", truckId: "truck-7", loggedBy: "Crew A", timestamp: "2026-04-18T13:00:00.000Z", materials: { blown_fg: 4 } },
    ],
  }];

  const firstPlan = buildJobUsageBackfillPlan({ jobs });
  assert.equal(firstPlan.summary.totalEventsPlanned, 3);
  assert.deepEqual(
    firstPlan.events.map((event) => event.metadata.backfillSource),
    [
      "legacy_daily_material_logs",
      "closeout_only_materials_used_leftover",
      "closeout_only_materials_used_leftover",
    ],
  );

  const secondPlan = buildJobUsageBackfillPlan({ jobs, existingEvents: firstPlan.events });
  assert.equal(secondPlan.summary.totalEventsPlanned, 0);
  assert.equal(secondPlan.summary.skippedExistingCount, 3);
});

console.log("inventory events tests passed");
