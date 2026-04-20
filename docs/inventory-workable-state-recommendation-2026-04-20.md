# Inventory workable state recommendation, 2026-04-20

## Call
**Best honest within-an-hour state: ship inventory in a guarded, truck-operations-safe mode, not as full truck-parity truth.**

Johnny can use the app safely today **if we treat warehouse counts and live truck actions as operationally valid, and treat truck parity as caution-only audit output.**

## What must be true for safe use today
1. **Load and return flows must be correct now**
   - `handleReturnMaterial(...)` must subtract only the returned qty from `truckInventory`, not delete the full SKU on partial return.
   - Load flow must still increment truck qty and decrement warehouse qty symmetrically.

2. **Crew should operate from the live truck read model, not parity status**
   - The app must keep showing current truck counts from `truckInventory` for actual field decisions.
   - Red parity must **not** block load, unload, daily materials, or closeout.

3. **Warehouse remains trusted**
   - Warehouse parity is green, so warehouse inventory can stay the primary trusted count for yard/shop decisions.

4. **Truck parity warning must read as advisory, not failure**
   - Johnny needs clear wording that parity red means historical mismatch, not necessarily a broken action taken today.

## What should be clearly treated as caution
- **Do not claim truck inventory is fully reconciled.** Five trucks are still red after replay.
- **Do not use truck parity as a release gate today.** It is a data-reconciliation lane, not an operational safety lane.
- **Do not mass-correct legacy truck docs blindly** within the hour. That risks freezing in bad event assumptions.
- Any truck with obvious count drift should be handled as **manual recount / office-confirm** before making large planning decisions from it.

## Fastest tiny changes that get us there
### Code
1. **Keep the current return fix** in `src/App.jsx`.
   - This is the biggest same-day safety fix.

2. **Soften crew/admin parity language**
   - Change warning copy from mismatch-as-problem to mismatch-as-audit-warning.
   - Suggested meaning: "Event replay does not match older truck records yet. Keep working from current truck count, and flag office if today’s count looks wrong."

3. **If not already present, avoid blocking actions from parity-red state**
   - No disabled buttons, no hard stop on unload/load/closeout because parity is red.

### Data / ops
1. **Pick 1-2 highest-risk red trucks and do manual spot recounts**
   - Especially trucks with large non-zero legacy leftovers versus event-derived zero.
   - Update only if Johnny confirms physical count.

2. **Use a temporary ops note today**
   - Warehouse = trusted.
   - Truck action results after today’s loads/returns/logged usage = trusted.
   - Historical truck parity panel = caution.

## Recommended one-hour target
**Operational green, audit amber.**

That means:
- crew can load, use, close out, and unload safely,
- warehouse counts stay trustworthy,
- truck parity stays visibly cautionary,
- no promise that all truck reconciliation is finished.

## Bottom line
If full truck parity cannot be green in the next hour, the nearest honest workable state is:
**"Safe to run today, with truck parity explicitly marked as unresolved historical reconciliation, not live operational failure."**
