# Inventory write-model audit

Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`
Primary file: `src/App.jsx`

## Executive answer

### 1) Why the code betrays the simple truck model

The app no longer has one inventory truth. It has at least **four competing write surfaces**:

1. `inventory` collection, warehouse balance (`handleUpdateInventory`, `handleLoadTruck`, `handleAdminSetLoadout`, `handleAdminUnload`, `handleReturnMaterial`)
2. `truckInventory` collection, per-truck balance (`handleLoadTruck`, `handleAdminSetLoadout`, `handleAdminUnload`, `handleSaveJobMaterials`, `handleEditJob`, `handleCloseOutJob`, `handleReturnMaterial`)
3. `jobs.dailyMaterialLogs`, scoped daily usage history (`handleSaveJobMaterials`, `handleLogDailyMaterials`, admin calendar edits)
4. `jobs.materialsUsed`, legacy aggregate closeout usage (`handleCloseOutJob`, `handleSaveJobMaterials`, `handleEditJob`)

There is also a **fifth emerging model**, `inventoryEvents`, but it is only dual-written from one path: `handleSaveJobMaterials` via `adaptLiveDailyMaterialLogUpsertToEvents` and `writeInventoryEvents`. The rest of the inventory mutations do not write canonical events.

The result is that the system is not a simple model of:

`warehouse -> truck -> installed/returned`

It is a patchwork of balance rewrites, log appends, and legacy aggregates that can drift independently.

### 2) Exact structural fix

Make **`inventoryEvents` the only canonical write model** for all inventory-changing actions.

Then derive and persist read models from events:

- `warehouseBalances/{itemId}` or derived warehouse map
- `truckBalances/{truckId}`
- `jobUsage/{jobId}` and optionally `jobUsageByDate/{jobId,date,truckId}`
- compatibility mirrors for legacy UI only, generated from events, not hand-maintained

In practice:

1. Replace every inventory-changing function with event writes only.
2. Stop directly mutating `inventory`, `truckInventory`, `jobs.dailyMaterialLogs`, and `jobs.materialsUsed` as business logic.
3. Build one inventory service with typed commands:
   - `loadTruck`
   - `returnToWarehouse`
   - `recordJobUsageDay`
   - `editJobUsageDay`
   - `closeOutJob`
   - `adminSetTruckSnapshot`
   - `adminUnloadTruck`
   - `reassignJobTruck` / `moveUsageBetweenTrucks`
4. Derive truck and warehouse balances from events, and treat legacy docs as read-only mirrors until retired.

That is the only fix that gets back to a trustworthy model.

---

## Where the current write model breaks

## Canonical business model the code *should* express

For a trucked material:

1. warehouse stock decreases when loaded to truck
2. truck stock decreases when consumed on a job
3. truck stock increases and warehouse stock increases when unused material is returned
4. job usage is a ledger of what was installed, not an alternate balance system

Instead, current code mixes:

- warehouse balance writes
- truck balance writes
- job usage snapshots/aggregates
- load/return history logs used for reconciliation views
- partial event sourcing

Those layers are not guaranteed to agree.

## Specific write paths and problems

### `handleUpdateInventory` (`src/App.jsx:11474`)
Legacy source of truth for warehouse quantity.

Problem:
- blindly overwrites `inventory.qty`
- no transaction with truck updates
- no event written
- depends on in-memory `inventory` snapshot, which can be stale during multi-step loops

This makes warehouse balance a mutable cache, not a ledger.

### `handleLoadTruck` (`src/App.jsx:11790`)
Writes:
- warehouse via `handleUpdateInventory`
- truck via `setDoc(truckInventory)`
- `loadLog`

Problems:
- three writes, no single transaction across warehouse + truck + log
- uses current React `inventory` state as warehouse source
- no canonical event written
- `loadLog` is history, but not authoritative

So one user action mutates three models, none authoritative.

### `handleReturnMaterial` (`src/App.jsx:11622`)
Writes:
- warehouse via `handleUpdateInventory`
- truck via `setDoc(truckInventory, state)`
- `returnLog`

Problems:
- deletes returned items from truck state instead of expressing a return event
- assumes return means removing entire item key from truck state for that SKU path
- not transactional with warehouse update
- no event written

This is another direct balance rewrite path.

### `handleAdminSetLoadout` (`src/App.jsx:11350`)
Writes:
- diffs old vs new truck state
- applies warehouse deltas through `handleUpdateInventory`
- overwrites full `truckInventory` doc with `setDoc`
- appends `loadLog` and `returnLog`

Problems:
- admin snapshot-edit directly rewrites truck state
- warehouse is reconciled by diffing two snapshots, not by replaying authoritative movements
- uses client-side `inventory` snapshot for warehouse qty
- custom inventory (`_custom`) is excluded from the diff set and handled inconsistently elsewhere
- no event written

This is the biggest betrayal of the simple model: truck inventory is editable as a document snapshot, not as movements.

### `handleAdminUnload` (`src/App.jsx:11387`)
Writes:
- mutates truck snapshot
- mutates warehouse via `handleUpdateInventory`
- appends `returnLog`

Problems:
- special-case custom items as `custom_${name}` in warehouse, creating ad hoc item IDs
- direct snapshot rewrite again
- no event written

### `handleSaveJobMaterials` (`src/App.jsx:11711`)
This is the **best** current path. It:
- transactionally updates job daily log and truck inventory
- handles moving usage from prior truck to new truck on edit
- dual-writes `inventoryEvents`

But it still preserves legacy job docs as active truth.

Problems:
- still updates `jobs.dailyMaterialLogs` and `truckInventory` directly as business state
- event write is best-effort, outside transaction, and failure is swallowed with `console.warn`
- only this path writes `inventoryEvents`, so event stream is incomplete
- fallback branch `await updateDoc(... { materialsUsed: payload || null })` still writes legacy aggregate directly

This means the most modern path is still not authoritative.

### `handleLogDailyMaterials` (`src/App.jsx:11778`)
Writes only `jobs.dailyMaterialLogs`.

Problems:
- no truck inventory adjustment
- no warehouse change
- no event write
- bypasses the more correct `handleSaveJobMaterials`

Even if lightly used now, it is a live bypass around the inventory model.

### `handleCloseOutJob` (`src/App.jsx:11647`)
Writes:
- marks job closed
- writes `materialsUsed`
- deducts only the net new amount from truck after subtracting prior `dailyMaterialLogs`

Problems:
- keeps `materialsUsed` alive as a second job-usage truth
- closeout can record usage outside daily logs
- daily logs and closeout aggregate are reconciled by ad hoc subtraction logic
- no event written

This preserves the old aggregate model instead of retiring it.

### `handleEditJob` (`src/App.jsx:11432`)
If payload touches `dailyMaterialLogs` or `materialsUsed`, it:
- aggregates prior usage by truck from both legacy fields
- aggregates next usage by truck from both legacy fields
- rewrites affected truck balances with `applyTruckUsageDelta`

Problems:
- job edits can mutate truck inventory indirectly
- truck inventory is recomputed from legacy job fields, not from inventory movements
- `materialsUsed` and `dailyMaterialLogs` are both treated as live usage truth
- no event write

This is a major hidden coupling: editing a job document rewrites truck balances.

## Admin history/calendar bypass paths

### Calendar job date / hold / PM edits
Examples near `src/App.jsx:8759`, `8765`, `6310+`, `pmJob` flow.

These call `onEditJob` with broad job payloads like:
- `{ ...calViewJob, date: e.target.value }`
- `{ ...calViewJob, onHold: true }`
- PM check fields

Why risky:
- broad job object writes keep passing large legacy job shapes back through `handleEditJob`
- today these specific edits usually do not trigger material reconciliation unless `dailyMaterialLogs` or `materialsUsed` are present in the payload, but the pattern is fragile because whole-job objects are being round-tripped
- the codebase encourages job document mutation as a catch-all write API

### Admin calendar material edit
At `src/App.jsx:8716`, admin edits daily materials through `onSaveJobMaterials(...)`.

This is one of the few safer paths because it goes through the transactional daily-log logic, but it still lands back in legacy docs plus best-effort dual-write.

## Legacy sources of truth that should no longer be sources of truth

1. `jobs.materialsUsed`
   - legacy closeout aggregate
   - still used by reports, reconcile screens, calendars, and closeout logic

2. `jobs.dailyMaterialLogs`
   - better than `materialsUsed`, but still stored as mutable embedded state
   - edits overwrite history rather than append authoritative events

3. `truckInventory` documents
   - used as active writable balances
   - overwritten by admin snapshot actions and job edits

4. `inventory` documents
   - writable warehouse balance, not derived balance

5. `loadLog` / `returnLog`
   - treated as operational history and reconcile data, but not authoritative enough to rebuild truth reliably

## Read-model evidence of split truth

Many screens explicitly merge legacy fields:

- `calcJobMaterialCost` prefers `dailyMaterialLogs`, else `materialsUsed` (`src/App.jsx:142`)
- reports fall back from daily logs to `materialsUsed` (`src/App.jsx:7646-7651`)
- truck reconciliation computes `loaded - returned - materialsUsed`, with fallback logic (`src/App.jsx:4386-4405`)
- calendar/history views show both daily logs and closeout aggregate (`src/App.jsx:8671+`)
- `aggregateJobMaterialsByTruck` sums both `dailyMaterialLogs` and `materialsUsed` (`src/App.jsx:11577+`)

That fallback behavior is the clearest sign the app does not trust one model.

---

## The exact structural fix

## Make one append-only ledger canonical

Use `inventoryEvents` as the only business write target.

Every inventory mutation should emit events like:

- `warehouse_to_truck`
- `truck_to_job`
- `job_usage_corrected`
- `truck_to_warehouse`
- `truck_snapshot_set` (admin-only, rare, explicit reconciliation event)
- `warehouse_snapshot_set` (admin-only, rare)
- `job_closed`

A command should write events, not balances.

## Derive balances from events

Build one projection layer that produces:

- warehouse item balances
- truck item balances
- job usage totals
- job usage by date and truck
- operational timeline for load/return/history views

Then the current collections become either:

- derived projection collections, or
- temporary compatibility mirrors generated from the event ledger

## Retire the two legacy job usage fields as writers

### `jobs.dailyMaterialLogs`
Keep temporarily only as a mirrored read shape for the UI.
Do not hand-edit it as truth.

### `jobs.materialsUsed`
Freeze it. Do not write new business state here.
If the UI still needs a total, derive it from events or from projected daily usage.

## Remove direct balance editing from App.jsx

Move all inventory writes out of `App.jsx` into a dedicated module/service, for example:

- `inventoryCommands.loadTruck(...)`
- `inventoryCommands.returnMaterial(...)`
- `inventoryCommands.recordDailyUsage(...)`
- `inventoryCommands.editDailyUsage(...)`
- `inventoryCommands.closeOutJob(...)`
- `inventoryCommands.adminSetTruckSnapshot(...)`

Each command should:

1. validate
2. emit canonical events
3. update projections/mirrors in one controlled place

`App.jsx` should stop knowing how to reconcile balances.

## Replace snapshot rewrites with explicit reconciliation events

For admin loadout tools:

- do **not** overwrite `truckInventory` as truth
- if admin sets a truck to an absolute state, record a `truck_snapshot_set` or `truck_reconciled` event with reason, actor, before/after, and note
- project the new balance from that event

That makes “admin correction” an auditable exception, not silent balance surgery.

## Use one transaction boundary per command

If legacy mirrors remain during rollout:

- write canonical event(s)
- update projections/mirrors in same backend-controlled transaction or function
- never do best-effort event writes after legacy writes on the client

Right now `handleSaveJobMaterials` writes events after the transaction and tolerates failure. That must invert: event write first/canonical, projection second.

---

## Recommended migration path

Good news: the repo already hints at this plan.

`src/inventoryEvents.js` defines rollout stages:
- dual write adapters
- read model backfill
- UI flip
- legacy retirement

That is the right plan. It just is not finished.

### Practical migration sequence

1. **Complete event coverage**
   - add event writes for `handleLoadTruck`
   - `handleReturnMaterial`
   - `handleAdminSetLoadout`
   - `handleAdminUnload`
   - `handleCloseOutJob`
   - any material-affecting `handleEditJob`
   - remove `handleLogDailyMaterials` or route it through the same command path

2. **Build projections from events**
   - truck balances
   - warehouse balances
   - per-job usage
   - daily job usage

3. **Flip reads**
   - reconciliation screen
   - calendar/history
   - reports
   - truck detail modal
   - closeout summaries

4. **Freeze legacy writers**
   - stop writing `materialsUsed` except as derived mirror
   - stop editing embedded `dailyMaterialLogs` directly
   - stop direct `inventory` and `truckInventory` balance writes from the UI

5. **Retire fallback logic**
   - remove “if daily logs else materialsUsed” branches
   - remove job edit side effects that recompute truck balances from job docs

---

## Bottom line

The code betrays the simple truck model because it still treats **balances, logs, and job aggregates as co-equal writable truths**.

The exact fix is to make **one canonical append-only inventory ledger** (`inventoryEvents`) the sole write model, then derive truck, warehouse, and job views from it. Until that happens, every new feature will keep adding another bypass around trustworthy inventory.
