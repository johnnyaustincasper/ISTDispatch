# Inventory deploy readiness, 2026-04-19

## Verdict
**GO with one short smoke check before deploy.**

There are **no unresolved merge markers** in `src/App.jsx` or `src/`.

## Verified commands
```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
npm run build
npm run test:inventory-events
```

## Results
- `npm run build` ✅ passed
- `npm run test:inventory-events` ✅ passed
- Build warning only, not a blocker:
  - large Vite chunk
  - `jspdf` is both dynamically and statically imported

## Merge hotspots in `src/App.jsx`
1. **Crew inventory flow wiring**
   - `src/App.jsx:1834-2348`
   - `CrewDashboard` now mixes legacy truck inventory props with derived/parity props and truck-aware daily material log helpers.
   - Highest-risk area for today because it affects crew closeout, daily materials, and missing-log detection.

2. **Dual-write inventory mutations**
   - `src/App.jsx:11629-12363`
   - New inventory event writes were threaded through admin load/unload, crew load/return, daily material logging, and closeout.
   - Logic looks merged cleanly, but this is the highest-risk data path.

3. **Top-level prop plumbing into dashboards**
   - `src/App.jsx:12430-12466`
   - `CrewDashboard` and `AdminDashboard` now receive `derivedTruckInventory`, `truckInventoryParity`, `warehouseInventoryParity`, and job usage parity.
   - Good compile state, but worth smoke testing because this is where lane merges often break runtime wiring.

4. **Truck naming inconsistency still present**
   - Example: `src/App.jsx:12038`, `12290` use `truck?.name`
   - Other newer sections use `vehicleName || members || name`
   - Not a compile blocker, but could produce weaker event metadata / labels for some trucks.

## Current readiness call
**Ready to ship today after a fast manual smoke test.** I do **not** see unresolved code conflicts.

## Recommended next action
Run this, then ship if it looks clean:
```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
npm run build && npm run test:inventory-events
```
Then manually verify in the app:
1. Crew login for a truck
2. Add/edit daily materials on a job
3. Close out a job with materials
4. Load truck and return material
5. Admin inventory parity/reconciliation views render

## Note
This branch is still dirty and ahead of origin, so deploy should only happen from the exact current tree after that smoke test:
- branch: `main`
- status: `ahead 20`, with local modifications including `src/App.jsx`, `package.json`, `index.html`, `functions/index.js`
