# Truck snapshot backfill gap audit, 2026-04-20

Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Conclusion
Truck snapshot backfill appears **sufficient as executed for baseline establishment**. The remaining problem is **not** that `job.usage` replay is consuming from a missing or wrong truck-snapshot baseline. The evidence points to a **post-baseline legacy-vs-event divergence** in live `truckInventory`, so the safest next action is **truck-state reconciliation**, not another truck snapshot backfill.

## Exact evidence

1. The intended rollout order explicitly says snapshots must come first, then usage replay:
   - `docs/inventory-events-rollout.md`: “Backfill snapshots first, then replay line-level legacy logs after the snapshot date.”

2. The truck snapshot baseline date is fixed in code:
   - `src/inventoryBackfill.js:13-14`
   - `TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT = "2026-01-01T00:00:00.000Z"`
   - `TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE = "2026-01-01"`

3. Live post-backfill verification says truck snapshots are present, and counts are plausible:
   - `verification/phase4-live-parity-postbackfill-2026-04-19.md`
   - event counts: `warehouse.snapshot: 55`, `truck.snapshot: 9`, `job.usage: 268`

4. That same live verification explicitly says the truck problem is **not** missing snapshots:
   - `verification/phase4-live-parity-postbackfill-2026-04-19.md`
   - “The truck snapshot backfill exists, but the current derived truck balances do not match legacy truck docs, because later `job.usage` events drive those truck balances down while legacy `truckInventory` still shows leftover stock.”
   - “So the truck red is not a missing-snapshot problem. It is a real legacy-vs-event truth mismatch after replay.”

5. Concrete example of replay consuming from an existing truck snapshot baseline:
   - `verification/phase4-live-parity-postbackfill-2026-04-19.md`
   - Blow Truck 2 (`zkzNXhRTjw2kKhL5wj9p`): legacy `blown_fg: 18`, derived from events `0`, delta `-18`
   - cited evidence there: snapshot exists as `truck-snapshot__truck-inventory-backfill-v1-zkzNXhRTjw2kKhL5wj9p__blown_fg`, then later `job.usage` events consume that stock

6. There is known live code that can mutate legacy truck state without matching event truth, which explains divergence after replay:
   - `docs/final-ship-now-readiness-2026-04-19.md`
   - `handleReturnMaterial(...)` deletes the whole SKU on partial return (`delete state[m.itemId];`), causing legacy truck state to lose/shift quantity in a way that can disagree with events
   - same note also calls out a weaker gap in `handleEditJob(...)` where truck inventory can be rewritten without matching event writes

7. Event-class counts also suggest missing historical non-snapshot/non-usage truck mutations are more plausible than missing truck snapshots:
   - `docs/final-ship-now-readiness-2026-04-19.md`
   - `warehouse.adjustment: 0`
   - `truck.transfer: 0`
   - while `truck.snapshot: 9` and `job.usage: 268` are present

## Likely missing event classes, if any
Not likely additional `truck.snapshot`.

More likely missing historical writes are from operational paths that changed legacy state without canonical events, especially:
- `truck.transfer`
- `warehouse.adjustment`
- possibly explicit `inventory.reconciliation` entries for one-time correction

Those are consistent with the known partial-return and job-edit gaps, and with live counts showing zero transfer/adjustment history.

## Safest next action
1. **Do not rerun truck snapshot backfill as the first fix.** That would only reset baseline again and could hide the true divergence.
2. **Freeze on read-only investigation or controlled one-time reconciliation.**
3. For each red truck, compare:
   - latest `truck.snapshot`
   - subsequent `job.usage` events
   - any legacy truck mutations from return/edit flows
   - current legacy `truckInventory`
4. If the event trail is trusted, write a **targeted reconciliation** to align legacy `truckInventory` to derived event state, ideally recorded as `inventory.reconciliation`.
5. Separately patch the known mutation gaps (`handleReturnMaterial`, and likely `handleEditJob`) before any further live reconciliation so drift does not immediately recur.

## Bottom line
Truck snapshot backfill is **not the missing piece**. The remaining issue is **truck-state reconciliation after replay**, likely caused by historical or current truck mutations that were not captured as canonical inventory events.
