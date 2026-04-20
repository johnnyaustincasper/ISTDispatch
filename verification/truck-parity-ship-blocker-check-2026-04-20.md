# Truck parity ship-blocker check

**Recommendation: BLOCK deploy for truck-parity-governed rollout.**

## Why

Current live evidence says truck parity is still materially red, and it does not look like a remaining UI math bug:

- `verification/phase4-live-parity-postbackfill-2026-04-19.md` reports **5 of 8 trucks mismatched** after backfill.
- Same report says warehouse parity is green, closed-out job parity is green, and truck snapshots exist (`truck.snapshot: 9`), so the truck lane is the only unresolved parity lane.
- Top live mismatches are non-trivial, for example:
  - **Blow Truck 2** `zkzNXhRTjw2kKhL5wj9p`: `blown_fg` legacy **18** vs derived **0**
  - **Blow Truck 1** `QqPu7vll9n4ScTB4wWdU`: `r11_15_8_pcs` **4 -> 0**, `r30_24_pcs` **2 -> 0**
  - **Foam Truck 2** `wmMarb8swAWdeYLuj75Z`: `oc_a` **2.33 -> 0**, `oc_b` **1.58 -> 0**

## Code read

The earlier partial-return concern is **already fixed** in current code:

- `src/App.jsx:12155-12162` now subtracts only the returned quantity from `truckInventory`, instead of deleting the whole SKU.

That matters because it weakens the case for “allow after one targeted fix.” The strongest current evidence points to a **live legacy-vs-event state mismatch**, not one last obvious truck parity code bug.

## Bottom line

If release requires truck parity to be ship-green, **do not deploy yet**.

The next needed work is **data reconciliation for the 5 mismatched trucks** (or an explicit product decision that legacy `truckInventory` is no longer the comparison truth). Until that is resolved, truck parity remains a real ship blocker.
