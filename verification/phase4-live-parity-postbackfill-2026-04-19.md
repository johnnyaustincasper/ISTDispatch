# Phase 4 live parity, post-backfill

Date: 2026-04-19
Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## What I verified

- Live Firestore state via web SDK against `inventory`, `truckInventory`, `jobs`, `trucks`, and `inventoryEvents`
- Current parity helpers in `src/inventoryEvents.js`
- Current UI wiring in `src/App.jsx`
- Validation after one tiny parity-readout fix with:
  - `npm run test:inventory-events` ✅
  - `node tmp/live-parity-check.mjs` ✅

## Tiny safe fix made

File: `src/inventoryEvents.js`

- Adjusted `getJobUsageParityReport(...)` so **closed-out jobs prefer `materialsUsed` over daily logs** when computing the effective legacy baseline.
- Why: one live false red job had a stale daily-log-only item (`jm_r13_15_9_pcs: 5`) while `materialsUsed` and `job.usage` already matched. The UI summary only audits closed-out jobs, so closeout totals are the correct final parity baseline there.
- Result: closed-out job parity is now **113 checked, 0 mismatched**.

## Live state now

### Green

1. **Warehouse parity is green**
   - `warehouse.snapshot` events live: **55**
   - Legacy inventory rows: **55**
   - Warehouse mismatches: **0**
   - Latest warehouse snapshot: `2026-01-01T00:00:00.000Z`

2. **Job-usage parity is now green for the closed-out jobs the UI summarizes**
   - Closed-out jobs checked: **113**
   - Mismatched closed-out jobs: **0**
   - `job.usage` events live: **268**

3. **Backfill presence is confirmed live**
   - `inventoryEvents` total: **332**
   - Event type counts:
     - `warehouse.snapshot`: **55**
     - `truck.snapshot`: **9**
     - `job.usage`: **268**

### Still red

1. **Truck parity is still red in 5 of 8 trucks**
   - Matched trucks: **3**
   - Mismatched trucks: **5**

   Top live mismatches:

   - `zkzNXhRTjw2kKhL5wj9p` (Blow Truck 2)
     - legacy `blown_fg: 18`
     - derived from events: `0`
     - delta: `-18`
     - evidence: snapshot exists as `truck-snapshot__truck-inventory-backfill-v1-zkzNXhRTjw2kKhL5wj9p__blown_fg`, then later `job.usage` events consume that stock

   - `QqPu7vll9n4ScTB4wWdU` (Blow Truck 1)
     - `r11_15_8_pcs: 4 -> 0`
     - `r30_24_pcs: 2 -> 0`

   - `wmMarb8swAWdeYLuj75Z` (Foam Truck 2)
     - `oc_a: 2.33 -> 0`
     - `oc_b: 1.58 -> 0`

   - `0abNb5f253onDbbUjsL2` (Foam Truck 3)
     - `env_cc_a: 1.84 -> 0`
     - `env_oc_b: 1.81 -> 0`

   - `seW7evSZ2aafka9t1BiR` (Foam Truck 1)
     - `oc_a: 0.59 -> 0`
     - `oc_b: 0.49 -> 0`

## Interpretation

- The **warehouse snapshot backfill is good**.
- The **job-usage backfill is good**, and the closed-out job parity readout is now correctly green.
- The **truck snapshot backfill exists**, but the current derived truck balances do **not** match legacy truck docs, because later `job.usage` events drive those truck balances down while legacy `truckInventory` still shows leftover stock.
- So the truck red is **not a missing-snapshot problem**. It is a **real legacy-vs-event truth mismatch after replay**.

## Remaining blockers before deploy

1. **Do not treat truck parity as deploy-green yet**
   - Admin UI will still show 5 red trucks.
   - If rollout requires all parity lanes green, this is the blocker.

2. **Need a decision on truck source of truth**
   - Either reconcile legacy `truckInventory` to the replayed event state,
   - or identify and correct the specific `job.usage` event over-consumption / legacy leftovers causing those five truck mismatches.

3. **No additional code fix looks required for parity readout right now**
   - After the closed-out-job baseline fix, the remaining red is data-state red, not display math red.

## Bottom line

- **Green now:** warehouse parity, closed-out job-usage parity, snapshot/event presence
- **Red now:** truck parity in 5 trucks
- **Deploy blocker if parity must be all-green:** truck reconciliation is still outstanding
