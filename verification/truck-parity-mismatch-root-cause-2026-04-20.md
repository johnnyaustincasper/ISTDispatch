# Truck parity mismatch root cause after Phase 4

Date: 2026-04-20  
Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Bottom line

The 5 red trucks are **not primarily a parity-helper bug**. The main problem is a **baseline/time-axis mismatch in the truck backfill**:

1. Phase 4 created `truck.snapshot` events from the **current legacy `truckInventory` docs**.
2. Those snapshots were stamped with a synthetic baseline time (`2026-01-01T00:00:00.000Z`).
3. The read model then replays **historical `job.usage` events after that snapshot**.
4. But there are **no balancing `truck.transfer` load/restock events** in `inventoryEvents` to put material back on the trucks.

Result: the event replay subtracts March-April usage from a snapshot that already looks like the post-usage leftover state, so derived truck balances collapse to zero and stay red.

Evidence: live event counts show `inventoryEvents = 332`, broken down as:
- `warehouse.snapshot`: 55
- `truck.snapshot`: 9
- `job.usage`: 268
- `truck.transfer`: **0**

## Why the current code produces this

In `src/inventoryEvents.js`, `deriveTruckInventoryFromEvents(...)` does the right thing for the data it is given:
- it starts each truck from the latest `truck.snapshot`
- then applies later `job.usage` deltas

So if the snapshot is actually a "current leftover" snapshot, and then older usage is replayed after it, the function will correctly drive inventory down too far.

The bad state comes from the backfill model, not the replay math.

## Top mismatch patterns

### 1. Snapshot already equals current leftover, then historical usage is subtracted again
This is the dominant pattern for all 5 red trucks.

#### Blow Truck 2 (`zkzNXhRTjw2kKhL5wj9p`)
- Snapshot: `truck-snapshot__truck-inventory-backfill-v1-zkzNXhRTjw2kKhL5wj9p__blown_fg`
- Snapshot `after`: `blown_fg = 18`
- Current derived: `0`
- Delta: `-18`

Interpretation:
- the truck snapshot captured the truck already having 18 bags left
- later `job.usage` events consume that stock in replay
- with no `truck.transfer` replenishment events, derived balance goes to zero

#### Blow Truck 1 (`QqPu7vll9n4ScTB4wWdU`)
- Legacy leftovers still present:
  - `r11_15_8_pcs: 4`
  - `r30_24_pcs: 2`
- Derived from events: both `0`

Same pattern: snapshot preserved leftover pieces, replayed usage removed them again.

### 2. Foam trucks are over-consumed from a synthetic opening snapshot
This is the same root issue, just easier to see on liquid foam quantities.

#### Foam Truck 2 (`wmMarb8swAWdeYLuj75Z`)
- Legacy: `oc_a: 2.33`, `oc_b: 1.58`
- Derived: both `0`
- The truck has a Phase 4 snapshot, then many later `job.usage` events for `oc_a` / `oc_b`
- There are also closeout-leftover backfill events mixed in
- No matching `truck.transfer` loads exist to offset those decrements

#### Foam Truck 3 (`0abNb5f253onDbbUjsL2`)
- Legacy: `env_cc_a: 1.84`, `env_oc_b: 1.81`
- Derived: both `0`
- Example replay chain seen live:
  - snapshot at `2026-01-01` with `env_oc_b = 1.81`
  - then repeated `job.usage` events on 2026-04-08, 04-09, 04-10, 04-13, 04-15, 04-16
- Replay deletes the keys once totals go <= 0

#### Foam Truck 1 (`seW7evSZ2aafka9t1BiR`)
- Legacy: `oc_a: 0.59`, `oc_b: 0.49`
- Derived: both `0`
- Same shape: tiny leftover snapshot, then many later `job.usage` decrements, no reload events

### 3. Closeout-only backfill events amplify the same mismatch, but are not the first-order cause
Several red trucks contain `closeout_only_materials_used_leftover` events in addition to daily log events.
That adds more decrements after the synthetic truck snapshot.

This likely makes the red deeper on some trucks, but even without it the lack of truck load/restock history means the replay cannot land on current legacy leftovers.

## Exact root cause statement

**Truck parity is red because Phase 4 used present-day `truckInventory` as a fake historical snapshot baseline, then replayed historical usage on top of it, without any truck load/restock event history.**

That means the event-derived truck state is effectively:

`current leftover snapshot - historical usage since Jan 1 - closeout leftovers`

when it should have been one of these instead:
- a true historical opening balance plus full transfer/load history plus usage, or
- a current-state reconciliation snapshot with no earlier usage replay applied after it

## Recommended fix order

1. **Fix the truck baseline model first**
   - Do not treat the current `truckInventory` backfill snapshot as a Jan 1 opening balance.
   - Best immediate option: treat the truck snapshot as a **current reconciliation snapshot** at backfill time, not an old baseline.

2. **Decide whether truck parity should require transfer history**
   - If yes, backfill `truck.transfer` load/return history before trusting truck parity.
   - If no, then truck parity should compare against a current reconciliation point, not replay all prior usage.

3. **Then re-check closeout leftover events**
   - After the baseline issue is fixed, verify whether `closeout_only_materials_used_leftover` still causes any incremental over-consumption on specific trucks.

4. **Only after that, investigate edge-path code risks**
   - `handleReturnMaterial(...)` partial-return behavior
   - legacy edit paths that mutate truck inventory without event writes

Those are real risks, but they do **not** explain the current 5-of-8 red pattern nearly as well as the baseline/time-axis mismatch.

## Confidence

High. The live data shape is consistent across all 5 red trucks:
- one synthetic truck snapshot per truck
- many later `job.usage` decrements
- zero `truck.transfer` events
- derived truck values collapsing to zero while legacy docs still show leftovers
