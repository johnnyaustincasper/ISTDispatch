# Truck snapshot baseline semantics decision, 2026-04-20

Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Decision

**Preferred path for today: re-anchor truck snapshot backfill to a present-state reconciliation point, then rerun only the truck snapshot backfill.**

Concretely:
- stop stamping truck backfill snapshots as `2026-01-01`
- stamp them with the real backfill execution time/date
- treat truck parity as **current-state parity since latest reconciliation snapshot**, not full historical truck reconstruction
- keep warehouse/job-usage semantics unchanged

This is the **fastest correct** fix because it matches what the data actually means today: current `truckInventory` docs are a present leftover state, not a trustworthy Jan 1 opening balance.

## Why this is the safest concrete fix

Current live shape is:
- `truck.snapshot`: present leftover state from legacy docs
- `job.usage`: historical March-April consumption
- `truck.transfer`: `0`

So the current replay subtracts real usage from a fake historical opening snapshot and drives trucks to zero. Re-anchoring the snapshot to "now" fixes the semantic lie instead of patching around it.

## Options compared

### Option A, re-anchor truck snapshots to present-state parity only **(recommended)**

Implementation:
- change truck backfill `occurredAt` / `effectiveDate` defaults in `src/inventoryBackfill.js` from fixed Jan 1 to the actual run time
- rerun `scripts/backfill-truck-inventory-events.mjs`
- leave `deriveTruckInventoryFromEvents(...)` semantics alone

Pros:
- smallest code/data change
- aligns with existing derive logic and tests that latest snapshot re-anchors balances
- no invented transfer history
- easiest thing to explain operationally

Cons:
- truck parity becomes a **forward-from-latest-snapshot** audit, not full historical replay
- pre-snapshot truck usage is intentionally not part of parity truth

### Option B, exclude pre-baseline `job.usage` from truck parity

Implementation:
- special-case truck derivation to ignore `job.usage` judged older than the truck baseline
- likely requires new metadata or custom filtering rules

Pros:
- could avoid rerunning some data

Cons:
- brittle and harder to reason about
- mixes lane-specific semantics into shared event replay
- easy to get wrong because current bad snapshots are stamped with the wrong time already
- hides the real issue instead of fixing the bad baseline meaning

### Option C, require synthetic replenish / `truck.transfer` events

Implementation:
- infer or fabricate truck loads/returns so Jan 1 snapshot + replay lands on today’s leftovers

Pros:
- closest to full historical reconstruction in theory

Cons:
- slowest and riskiest
- source data does not appear to exist
- synthetic transfer history is hard to audit and easy to falsify
- not a same-day safe fix

## Recommendation

Ship **Option A** today.

If later the product truly needs historical truck replay, do that as a separate project with real transfer/load history or explicit reconciliation events. Do **not** block today’s fix on reconstructing a history the system never captured.

## Preferred implementation details

1. Update `TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT` / `TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE` usage so truck backfill defaults to actual execution time, not Jan 1.
2. Regenerate truck snapshot events with those timestamps.
3. Re-run truck parity verification on the previously red trucks.
4. Label truck parity semantics in docs/UI as "since latest truck reconciliation snapshot" until full transfer history exists.
