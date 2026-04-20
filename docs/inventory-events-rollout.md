# Inventory events rollout

## Canonical document shape

Store append-only records in a new `inventoryEvents` collection.

```js
{
  schemaVersion: 1,
  eventType: "job.usage" | "truck.transfer" | "truck.snapshot" | "warehouse.adjustment" | "warehouse.snapshot" | "inventory.reconciliation",
  occurredAt: "2026-04-17T21:00:00.000Z",
  effectiveDate: "2026-04-17", // optional business date
  actor: {
    actorId: null,
    actorName: "West Crew",
    actorRole: "crew",
    source: "crew"
  },
  item: {
    itemId: "oc_b",
    itemName: "Ambit Open Cell B",
    unit: "bbl",
    category: "Foam"
  },
  quantity: {
    delta: -1,
    before: null,
    after: null,
    unit: "bbl"
  },
  location: {
    warehouseId: "main",
    truckId: "truck-123",
    truckName: "West Crew",
    jobId: "job-456",
    jobAddress: "123 Main St"
  },
  refs: {
    legacyCollection: "jobs",
    legacyDocId: "job-456",
    legacyLogType: "dailyMaterialLogs",
    correlationKey: "job-456::2026-04-17::truck-123",
    snapshotKey: null
  },
  notes: null,
  metadata: {},
  legacy: {}
}
```

## Why this shape

- One event format covers warehouse changes, truck moves, job usage, and snapshots.
- `delta` handles operational math, `before/after` supports audits when known.
- `location` avoids spreading truck/job/warehouse context across unrelated collections.
- `refs` keeps staged rollout practical because every event can be traced back to the legacy write.

## Mapping from current flows

### `inventory`
- Keep as current warehouse read model.
- Mirror each warehouse change into `inventoryEvents` as `warehouse.adjustment`.
- Periodic full captures become `warehouse.snapshot`.

### `truckInventory`
- Keep as current truck read model.
- When load, unload, deduct, or delta-adjust happens, emit `truck.transfer` or `truck.snapshot` events.
- Truck document remains the fast current-state cache during rollout.

### `dailyMaterialLogs`
- Treat each material line as a `job.usage` event.
- Use `correlationKey = jobId::date::truckId` so an edited daily log can be replaced/reconciled deterministically.
- Preserve the existing log object on the job document until event-derived job material totals match legacy totals.

## Staged rollout

1. **Dual write only**
   - Do not change UI reads yet.
   - Emit `inventoryEvents` beside the current writes.
   - Start with the handlers already centralizing inventory writes: `handleUpdateInventory`, `handleLoadTruck`, `handleReturnMaterial`, `handleDeltaAdjustTruck`, `handleLogDailyMaterials`.

2. **Derived balances**
   - Add a lightweight projector, either client-side for admin screens or in a Cloud Function, that rolls events into:
     - warehouse balances by item
     - truck balances by truck + item
     - job usage totals by job + item
   - Compare projected totals against `inventory`, `truckInventory`, and `getAllJobMaterials(job)`.

3. **Flip reads screen-by-screen**
   - Start with audit/reporting screens, because they benefit most from event history.
   - Leave operational forms writing both paths until the projector is trusted.

4. **Retire legacy documents**
   - Once reconciliation is consistently clean, stop using `dailyMaterialLogs` and mutable `truckInventory` as sources of truth.
   - Keep them only as derived caches if the UI still wants snapshot reads.

## Highest-value helpers shipped now

- `src/inventoryEvents.js`
  - canonical event constants and schema builder
  - normalization helpers for actor, item, location, refs
  - adapters for current `inventory`, `truckInventory`, and `dailyMaterialLogs`
  - rollout stage definitions for implementation planning

## Practical migration notes

- Backfill snapshots first, then replay line-level legacy logs after the snapshot date.
- Custom truck items under `_custom` should stay legacy-only until they have stable item IDs.
- Older daily logs often lack reliable before/after state, so migrate them as usage deltas, not reversible edits.
- Event IDs should be deterministic where possible for replay safety, for example `jobId::date::truckId::itemId` for daily usage lines.
