# Phase 3 parity live readout

Date: 2026-04-19
Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`
Report path: `/Users/celeste/.openclaw/workspace/ist-dispatch/verification/phase3-parity-live-readout-2026-04-19.md`

## What I checked

- Parity helpers in `src/inventoryEvents.js`
- Phase 3 parity UI in `src/App.jsx`
- Current dual-write paths in `src/App.jsx`
- Read-safe verification scripts:
  - `npm run test:inventory-events`
  - `node scripts/backfill-job-usage-history.mjs`
  - `node scripts/material-log-scope-check.mjs`

## What the Phase 3 UI would report right now, with current code/data assumptions

### Green

1. **Helpers themselves look sound in code/tests**
   - `npm run test:inventory-events` passed cleanly.
   - Warehouse parity, truck replay/parity, and job-usage parity helpers all have explicit regression coverage.

2. **Job-usage backfill coverage looks materially complete**
   - `node scripts/backfill-job-usage-history.mjs` reported:
     - `totalJobsScanned: 160`
     - `totalEventsPlanned: 0`
     - `skippedExistingCount: 268`
   - Strong implication: the backfill script sees the expected job-usage event IDs already present, so Phase 3 job-usage parity has enough event history to compare against in many/most existing jobs.

3. **Parity UI is wired live, not stubbed**
   - App subscribes to `inventoryEvents`, `inventory`, `truckInventory`, and `jobs` live.
   - UI computes:
     - truck parity from `deriveTruckInventoryFromEvents(...)`
     - warehouse parity from `getWarehouseInventoryParityReport(...)`
     - job usage parity from `getJobUsageParityReport(...)`

### Red or amber

1. **A green parity screen would still be only partially trustworthy**
   - Event writes are still best-effort in several paths, via `writeInventoryEventsBestEffort(...)` with swallowed failures (`console.warn`).
   - So “green” means “aligned for events that exist”, not “all real mutations definitely reached the event log”.

2. **`handleLogDailyMaterials` is still a live bypass**
   - It updates `jobs.dailyMaterialLogs` only.
   - It does **not** write `inventoryEvents` and does **not** adjust truck state.
   - Implication: job usage parity can go red, or worse, look incomplete/blind if this path is used.

3. **`handleEditJob` still mutates truck inventory from legacy job fields without writing events**
   - If `dailyMaterialLogs` or `materialsUsed` are edited through this broad path, truck balances can change with no matching `inventoryEvents` write.
   - Implication: truck parity is still vulnerable to false red after admin/job edits, and green is not full proof of canonical integrity.

4. **Fallback `handleSaveJobMaterials(jobId, payload)` legacy branch still writes `materialsUsed` directly**
   - When `payload` is not a daily-log object, it updates `materialsUsed` only.
   - No event write there.
   - Implication: job usage parity can still drift if callers hit that branch.

5. **Crew return path likely over-removes from truck state on partial returns**
   - `handleReturnMaterial(...)` deletes `state[m.itemId]` whenever `stillHave > 0`.
   - That is fine for full returns, but suspicious for partial returns because it does not subtract remainder, it removes the whole SKU key.
   - Implication: truck parity is a likely red zone if crews can return only part of an item quantity.

6. **Warehouse/truck backfill verification was not fully runnable from this environment**
   - `backfill-warehouse-inventory.mjs` requires `--input <path>`.
   - `backfill-truck-inventory-events.mjs` failed here due missing Google project/auth environment.
   - So I could not produce a true live warehouse/truck mismatch count from Firestore in this session.

## Net trust readout

### Likely green enough to trust for signal
- **Job usage parity**: strongest of the three right now, because existing event coverage appears backfilled (`0` planned, `268` existing/skipped) and helper logic is well tested.
- **Warehouse parity helper/UI logic**: code looks solid.

### Likely still red or at least fragile for operational trust
- **Truck parity**: most likely to produce real red or misleading red because of:
  - partial-return handling risk in `handleReturnMaterial`
  - legacy `handleEditJob` truck rewrites without event writes
- **Global trust in “all green”**: still not enough to retire legacy truth, because some mutation paths bypass or best-effort the event stream.

## Bottom line

If the Phase 3 parity UI were opened right now:
- I would treat **job usage parity** as the most credible signal.
- I would treat **warehouse parity** as useful but still dependent on dual-write completeness.
- I would treat **truck parity** as the most likely area to show red, and the least trustworthy if it shows green after mixed legacy/admin flows.

So the current trust level is: **helpful reconciliation signal, not yet authoritative source of truth**.
