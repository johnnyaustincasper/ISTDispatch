# Truck parity fixed-enough checklist after baseline semantics fix

Date: 2026-04-20  
Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Purpose
Define the exact stop condition after fixing the truck baseline semantics.

This checklist is tied to the current evidence in:
- `verification/phase4-live-parity-postbackfill-2026-04-19.md`
- `verification/truck-parity-mismatch-root-cause-2026-04-20.md`
- `docs/inventory-workable-state-recommendation-2026-04-20.md`
- current code in `src/inventoryEvents.js`, `src/App.jsx`, and `src/inventoryBackfill.js`

## Current baseline
- Warehouse parity: green, `0` mismatches.
- Closed-out job usage parity: green, `0` mismatches.
- Truck parity: red in `5 of 8` trucks.
- Root cause: truck snapshots were written from present-day `truckInventory` but stamped as `2026-01-01`, then later `job.usage` replay consumed them as if they were historical opening balances.
- Live truck action safety fix already present: `src/App.jsx` `handleReturnMaterial(...)` now subtracts only returned qty from `truckInventory`.

## Fixed-enough = PASS only if all of these are true

### 1. Truck parity lane turns green on the same live readout
- Re-run the same live parity check used for `verification/phase4-live-parity-postbackfill-2026-04-19.md`.
- PASS:
  - matched trucks = all active trucks in scope
  - mismatched trucks = `0`
  - the five currently red trucks no longer collapse leftover stock to zero just because old `job.usage` replay runs after the snapshot
- FAIL:
  - any truck still shows the current pattern `legacy > 0`, `derived = 0` caused by baseline replay semantics

### 2. Truck replay semantics match the intended model
- PASS:
  - `src/inventoryEvents.js` truck derivation uses the latest truck snapshot as the starting point
  - the snapshot/backfill semantics no longer pretend today’s truck leftovers are a Jan 1 opening balance
  - after the fix, post-snapshot replay only applies events that are valid after that reconciliation point
- FAIL:
  - truck parity still depends on replaying historical usage after a synthetic baseline snapshot from current leftovers
  - fixing the data requires inventing missing `truck.transfer` history just to explain the current leftovers

### 3. Admin UI stops presenting truck parity as materially red
- PASS:
  - `TruckReconcileView` in `src/App.jsx` renders without crash
  - for the previously red trucks, the parity warning no longer appears from the baseline bug
  - if any warning remains, it is tied to a real residual mismatch, not the old baseline/time-axis issue
- FAIL:
  - admin still shows the same 5 red trucks after the semantics fix
  - parity chips/deltas still show the old zeroed-derived pattern for those trucks

### 4. Live truck operations still work after the semantics change
Use the same runtime lanes already called out in `docs/inventory-runtime-smoke-checklist-2026-04-19.md`.
- PASS:
  - crew load increases `truckInventory` and decreases warehouse qty
  - partial return removes only returned qty from truck state
  - full return removes the item cleanly when qty reaches zero
  - no unrelated truck items disappear
  - no negative truck counts appear
  - no blank screen or console-breaking runtime error in crew/admin flows
- FAIL:
  - load, return, closeout, or parity screens regress while fixing truck parity

### 5. The other two parity lanes stay green
- PASS:
  - warehouse mismatches remain `0`
  - closed-out job usage mismatches remain `0`
- FAIL:
  - truck parity fix makes warehouse or job-usage parity regress

## Practical stop rule
Stop when:
1. truck mismatches go from `5/8` to `0/N` on the live parity report,
2. the five named trucks from `verification/phase4-live-parity-postbackfill-2026-04-19.md` no longer show `legacy leftover -> derived 0` collapse,
3. admin/crew runtime smoke still passes,
4. warehouse and closed-job parity remain green.

If any of those is false, truck parity is **not fixed enough yet**.

## Not required for this stop condition
- full historical `truck.transfer` backfill, if the chosen semantics are “current reconciliation snapshot” rather than “true historical opening balance”
- solving every weaker legacy mutation path immediately, if truck parity is green and runtime safety remains intact

## Still worth follow-up after stop
- `handleEditJob(...)` paths that can mutate truck state without matching event writes
- whether `closeout_only_materials_used_leftover` creates any residual truck over-consumption after the baseline fix
