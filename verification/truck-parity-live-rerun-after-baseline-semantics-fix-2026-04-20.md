# Truck parity live rerun after baseline semantics fix

Date: 2026-04-20  
Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Verdict

**Clears.** The prior **5 of 8 red truck** pattern is gone on the current code.

## Live rerun result

Validated with:
- `npm run test:inventory-events` ✅
- `node tmp/live-parity-check.mjs` ✅

Current live parity readout:
- **Truck parity:** 8 of 8 matched, 0 mismatched
- **Warehouse parity:** matched, 0 mismatched items
- **Closed-out job parity:** 113 checked, 0 mismatched

Previously red trucks now read green:
- Blow Truck 1 `QqPu7vll9n4ScTB4wWdU` ✅
- Blow Truck 2 `zkzNXhRTjw2kKhL5wj9p` ✅
- Foam Truck 1 `seW7evSZ2aafka9t1BiR` ✅
- Foam Truck 2 `wmMarb8swAWdeYLuj75Z` ✅
- Foam Truck 3 `0abNb5f253onDbbUjsL2` ✅

## Why it changed

The current `deriveTruckInventoryFromEvents(...)` logic in `src/inventoryEvents.js` now guards baseline truck backfill snapshots so they do **not fake-red by replaying mismatched historical usage** on top of a current-state-style backfill baseline.

The test suite includes this explicitly:
- `truck backfill baseline snapshots do not fake-red by replaying mismatched historical usage` ✅

## Updated deploy implication

**Updated call: truck parity is no longer the blocker.**

If deploy was waiting on the truck baseline semantics fix plus a fresh live parity pass, this rerun supports **go / unblock on the truck parity lane**.

Caveat: this clears the parity verification standard currently encoded by the app and helpers. It does **not** create historical `truck.transfer` history; it means the read model now treats the baseline backfill consistently enough for honest current parity.
