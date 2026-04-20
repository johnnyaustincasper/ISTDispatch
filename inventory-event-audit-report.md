# Inventory event model audit

## Scope
Audited:
- `src/inventoryEvents.js`
- `src/inventoryEventWrites.js`
- `src/App.jsx`

Goal: determine what is already canonicalized, what is only partial dual-write, where parity gaps remain, and what producers/backfills are still missing.

## Executive summary
The event model is **well-formed as a library**, but **only one producer path is wired in App.jsx**:
- `dailyMaterialLogs` upserts via `handleSaveJobMaterials(...)` -> `adaptLiveDailyMaterialLogUpsertToEvents(...)` -> `writeInventoryEvents(...)`

Everything else still writes only legacy state:
- warehouse inventory (`inventory`)
- truck inventory (`truckInventory`)
- load / unload logs (`loadLog`, `returnLog`)
- job aggregate closeout material usage (`materialsUsed`)

So the current rollout is **stage 1 for one producer family only**, not full dual-write parity.

---

## What is already canonicalized

### 1. Canonical event schema and normalization are in place
`src/inventoryEvents.js` already defines a usable canonical model:
- event types:
  - `warehouse.adjustment`
  - `warehouse.snapshot`
  - `truck.transfer`
  - `truck.snapshot`
  - `job.usage`
  - `inventory.reconciliation`
- item ID canonicalization via `normalizeInventoryItemId(...)`
- actor, item, location, refs normalization
- canonical event ID helpers
- snapshot event builders
- event sorting / replay rules
- derived read models for:
  - warehouse inventory
  - truck inventory
  - job usage

This is the most complete part of the work.

### 2. Deterministic write path exists
`src/inventoryEventWrites.js` is solid for dual-write use:
- writes to `inventoryEvents`
- uses deterministic IDs from `buildCanonicalInventoryEventId(...)`
- uses `set(..., { merge: true })`, so repeated writes are idempotent-ish for the same logical event ID
- attaches `writeMeta.source` and `createdAt`

### 3. Legacy-to-event adapters exist for backfill/migration
These are already implemented in `inventoryEvents.js`:
- `adaptLegacyDailyMaterialLogToEvents(...)`
- `adaptLiveDailyMaterialLogUpsertToEvents(...)`
- `adaptLegacyTruckInventoryToSnapshotEvents(...)`
- `adaptLegacyWarehouseInventoryToSnapshotEvents(...)`

So the codebase already has most of the migration primitives needed for backfill.

---

## What is only partial dual-write today

### Daily material log saves are dual-written
In `App.jsx`, the only live event producer I found is:
- import at lines `32-33`
- use in `handleSaveJobMaterials(...)` around lines `11754-11768`

Flow:
1. transaction updates legacy `jobs.dailyMaterialLogs`
2. transaction also adjusts legacy `truckInventory`
3. after transaction, code builds `job.usage` events with `adaptLiveDailyMaterialLogUpsertToEvents(...)`
4. writes them to `inventoryEvents` with source `daily-material-log-dual-write`

This is real dual-write, but only for **daily material log upserts**.

### Why this is only partial, not full parity
This path covers only one domain slice:
- crew/admin edits to `dailyMaterialLogs`
- resulting truck deduction semantics tied to those logs

It does **not** cover:
- warehouse deductions when loading trucks
- warehouse returns when unloading
- truck inventory snapshots / manual resets
- warehouse inventory direct edits
- closeout-only `materialsUsed` writes when no daily logs exist
- reconciliation / stock correction events

---

## Parity gaps in App.jsx

## 1. No event producer for warehouse inventory changes
Legacy-only writer:
- `handleUpdateInventory(...)` at ~`11474`

This is the core warehouse mutation helper, and it writes only to `inventory` documents.
It is called from multiple operational flows, but emits **no**:
- `warehouse.adjustment`
- `warehouse.snapshot`
- `inventory.reconciliation`

Impact:
- warehouse balance cannot be reconstructed from events for most real activity
- derived warehouse read model cannot reach parity without backfill + new producers

## 2. No event producer for truck load operations
Legacy-only flow:
- `handleLoadTruck(...)` at ~`11786`

What it does:
- deducts from warehouse via `handleUpdateInventory(...)`
- writes truck state to `truckInventory`
- appends `loadLog`

What is missing:
- `truck.transfer` producer for warehouse -> truck movement
- matching warehouse-side canonical event strategy
- optional grouped correlation key per load operation

This is a major parity gap because truck loading is one of the primary inventory movements.

## 3. No event producer for truck unload / return operations
Legacy-only flows:
- `handleReturnMaterial(...)` at ~`11622`
- `handleAdminUnload(...)` at ~`11387`

What they do:
- increment warehouse inventory
- decrement truck inventory
- append `returnLog`

What is missing:
- `truck.transfer` producer for truck -> warehouse movement
- grouped operation IDs / correlation keys
- canonical representation of custom-item unload behavior

## 4. No event producer for admin truck loadout resets / manual adjustments
Legacy-only flow:
- `handleAdminSetLoadout(...)` at ~`11350`

What it does:
- diffs old vs new truck state
- adjusts warehouse inventory accordingly
- writes `loadLog` / `returnLog`
- overwrites `truckInventory`

What is missing:
- either:
  - `truck.snapshot` events for the new authoritative truck state, or
  - grouped `truck.transfer` + `inventory.reconciliation` events, or
  - both

This is especially important because manual adjustments are exactly where event-sourced auditability matters most.

## 5. No event producer for closeout-only aggregate material usage
Legacy-only flow:
- `handleCloseOutJob(...)` at ~`11647`

What it does:
- computes `netNew` materials not already captured in daily logs
- deducts those from `truckInventory`
- writes `jobs.materialsUsed`

What is missing:
- `job.usage` events for that `netNew` closeout delta

This is a real parity bug, not just a future enhancement.
If a job closes with materials that were never logged daily, truck inventory changes but `inventoryEvents` does not reflect that usage.

## 6. Material usage edits outside the dual-write path are not canonicalized
Relevant flow:
- `handleEditJob(...)` at ~`11432`

When `dailyMaterialLogs` or `materialsUsed` are edited through this path:
- truck inventory is recomputed via legacy delta logic
- job document is updated
- no inventory events are written

So any admin edit using `onEditJob(...)` can create divergence between:
- legacy truck/job state
- event stream

## 7. No consumers in App.jsx read from `inventoryEvents`
I found no App.jsx usage of:
- `deriveTruckInventoryFromEvents(...)`
- `deriveWarehouseInventoryFromEvents(...)`
- `deriveJobUsageFromEvents(...)`
- `getInventoryTraceDiagnostics(...)`
- direct reads from `inventoryEvents`

Meaning:
- current UI remains fully legacy-read
- stage 2 read-model parity work has not begun in App.jsx

---

## Missing producer matrix

| Domain action | Legacy path in App.jsx | Canonical event status | Gap |
|---|---|---:|---|
| Daily material log upsert | `handleSaveJobMaterials` | Partial ✅ | Only producer currently wired |
| Daily material log simple append | `handleLogDailyMaterials` | None ❌ | No event write |
| Job closeout net-new materials | `handleCloseOutJob` | None ❌ | Missing `job.usage` producer |
| Warehouse qty direct edit | `handleUpdateInventory` | None ❌ | Missing warehouse event producer |
| Crew load truck | `handleLoadTruck` | None ❌ | Missing `truck.transfer` producer |
| Crew unload / keep split | `handleReturnMaterial` | None ❌ | Missing return transfer producer |
| Admin unload | `handleAdminUnload` | None ❌ | Missing return transfer producer |
| Admin manual truck loadout adjust | `handleAdminSetLoadout` | None ❌ | Missing snapshot/reconciliation producer |
| Admin job material edit | `handleEditJob` | None ❌ | Legacy-only mutation |

---

## Backfills still needed

## 1. Warehouse snapshot backfill
Needed producer/helper already exists:
- `adaptLegacyWarehouseInventoryToSnapshotEvents(...)`

Why needed:
- current event log likely has no authoritative warehouse baseline
- without this, derived warehouse state must keep depending on legacy `inventory`

Recommended backfill:
- emit one `warehouse.snapshot` set from current `inventory`
- use a stable `occurredAt` / migration tag in metadata

## 2. Truck snapshot backfill for every truck
Needed helper already exists:
- `adaptLegacyTruckInventoryToSnapshotEvents(...)`

Why needed:
- current event stream likely has no complete truck baselines
- existing live `job.usage` events alone cannot reconstruct truck state

Recommended backfill:
- snapshot every `truckInventory/{truckId}` document
- exclude / decide policy for `_custom` items, since current snapshot adapter ignores `_custom`

## 3. Historical daily material log backfill
Needed helper already exists:
- `adaptLegacyDailyMaterialLogToEvents(...)`

Why needed:
- historical `dailyMaterialLogs` predate current dual-write
- without backfill, derived job usage and truck history will be incomplete

Recommended backfill:
- walk all jobs
- emit `job.usage` events for every historical log row
- use canonical IDs to avoid duping rows already emitted by live dual-write

## 4. Optional reconciliation/backstop backfill for `materialsUsed`
No dedicated adapter exists.

Why needed:
- some jobs may only have `materialsUsed` aggregate totals, or closeout-only net-new deductions
- current event model can represent these as `job.usage`, but there is no adapter/writer for them

Recommended backfill:
- define a migration rule for jobs with `materialsUsed` but incomplete/no `dailyMaterialLogs`
- emit aggregate `job.usage` with `metadata.aggregateOnly = true`
- align with existing `deriveJobUsageFromEvents(...)` support for `aggregateOnly`

That `aggregateOnly` handling in the read model is a strong signal this backfill was expected, but the producer is still missing.

---

## Concrete findings about model/readiness

## Good signs
- `deriveJobUsageFromEvents(...)` already understands:
  - logical dedupe
  - upsert scope coverage
  - `aggregateOnly` fallback semantics
- `deriveTruckInventoryFromEvents(...)` and `deriveWarehouseInventoryFromEvents(...)` already support:
  - latest snapshot baselines
  - post-snapshot deltas
  - snapshot-group dedupe
- event IDs and refs are mature enough to support repeatable backfills

## Important caveats
- `buildCanonicalInventoryEventId(...)` uses scope fields and fallback index. Good for backfill, but correctness depends on consistent `refs.correlationKey` / `refs.snapshotKey` use by producers.
- `writeInventoryEvents(...)` always uses merge-set with `createdAt: serverTimestamp()`. Rewrites to the same ID will also rewrite `createdAt`, which may not be desired for a historical audit stream.
- `_custom` truck inventory is preserved in legacy projection logic, but current snapshot adapter does not emit canonical events for `_custom` truck items.

---

## Recommended next-step sequencing

## Phase 1, close the most dangerous parity holes
1. **Add producer for closeout-only net-new job usage** in `handleCloseOutJob(...)`.
   - This is the clearest live divergence bug.
2. **Add producers for truck load/unload transfers** in:
   - `handleLoadTruck(...)`
   - `handleReturnMaterial(...)`
   - `handleAdminUnload(...)`
3. **Add producer for admin truck adjustments** in `handleAdminSetLoadout(...)`.
   - Prefer authoritative `truck.snapshot` plus grouped warehouse adjustment/reconciliation metadata.

## Phase 2, establish baselines
4. Backfill **warehouse snapshot** from current `inventory`.
5. Backfill **truck snapshots** from all `truckInventory` docs.
6. Backfill **historical daily material logs** from all jobs.
7. Add/backfill **aggregateOnly job usage** for jobs whose only durable usage is `materialsUsed`.

## Phase 3, start read-model parity validation
8. Build a derived read path using:
   - `deriveWarehouseInventoryFromEvents(...)`
   - `deriveTruckInventoryFromEvents(...)`
   - `deriveJobUsageFromEvents(...)`
9. Compare derived balances to legacy collections and surface diagnostics using `getInventoryTraceDiagnostics(...)`.
10. Only after parity is proven, flip selected UI reads.

---

## Bottom line
`inventoryEvents.js` is already far ahead of `App.jsx` integration.

Today the canonical event layer is **not yet the system of record**, and it is **not even a full dual-write mirror**. It currently mirrors only one producer family: daily material log upserts.

The biggest missing live producers are:
- truck load/unload transfers
- admin truck adjustments/snapshots
- closeout-only job usage deltas
- warehouse inventory adjustments/reconciliations

The biggest missing migration steps are:
- warehouse snapshot backfill
- truck snapshot backfill
- historical daily material log backfill
- aggregate-only job usage backfill for `materialsUsed`
