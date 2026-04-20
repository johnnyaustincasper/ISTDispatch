# Truck transfer-history requirement check

Date: 2026-04-20  
Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Answer

**For an honest operational state today: historical `truck.transfer` backfill is not strictly required.**

**For honest full historical truck parity, it is required, unless the product changes the parity definition to start from a current reconciliation point instead of replaying prior usage.**

## Recommendation

1. **Do not gate today’s rollout on all-green truck parity.**
   - Treat truck parity as **advisory historical reconciliation**, not a live operational blocker.
2. **Keep using live `truckInventory` for field operations today.**
   - Current code now dual-writes new load/return events for fresh activity, so today-forward behavior is getting better.
3. **If you want truck parity to mean “event replay matches legacy truck state across prior months,” then yes, do the transfer-history backfill.**
   - Without historical load/return events, replay is missing the positive movements that put stock onto trucks.
4. **If you do not want to backfill transfer history, redefine truck parity.**
   - Compare from a current reconciliation snapshot forward, not from a fake Jan 1 baseline plus later historical usage replay.

## Evidence

### 1. Live reports show truck parity is still red after backfill
From `verification/phase4-live-parity-postbackfill-2026-04-19.md`:
- warehouse parity: green
- closed-out job usage parity: green
- truck parity: **5 of 8 trucks mismatched**

That means the unresolved lane is specifically truck replay/parity, not the rest of inventory.

### 2. The missing historical movement is explicit in live event counts
From `verification/truck-parity-mismatch-root-cause-2026-04-20.md`:
- `truck.snapshot`: 9
- `job.usage`: 268
- `truck.transfer`: **0**

So replay has decrements (`job.usage`) but no historical replenishment/load events.

### 3. The backfill anchored today’s leftover truck state at a fake historical baseline
From `src/inventoryBackfill.js`:
- `TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT = "2026-01-01T00:00:00.000Z"`

From `src/inventoryEvents.js`, `deriveTruckInventoryFromEvents(...)`:
- it starts from the latest `truck.snapshot`
- then applies later truck delta events, including later `job.usage`

So current leftover truck state was backfilled as if it were a Jan 1 baseline, then later historical usage was replayed on top of it.

### 4. Current app code does write new truck transfer events now
From `src/App.jsx`:
- `handleLoadTruck(...)` writes `adaptTruckTransferToEvents(... direction: "load")`
- `handleReturnMaterial(...)` writes `adaptTruckTransferToEvents(... direction: "return")`

So today-forward operations can improve, but that does **not** repair missing older transfer history.

## Concrete conclusion

- **Can truck parity be made honest enough today without historical transfer backfill? Yes, but only if truck parity is presented as unresolved historical reconciliation/advisory rather than a strict truth claim or ship gate.**
- **Is transfer-history backfill truly required? Yes, if the goal is honest full replay-based truck parity against historical legacy truck state.**

## Best call

**Ship only if the product stance is:**

> Safe to run today, with truck parity clearly labeled as unresolved historical reconciliation.

**Do not ship if the promise is:**

> Truck parity is now historically reconciled end-to-end.
