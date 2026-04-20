# Inventory runtime smoke checklist, 2026-04-19

Use this in order. Keep it tight. Only verify the flows that can break the inventory mission.

## Current gate assumptions
- `npm run build` and `npm run test:inventory-events` should already be green.
- `job.usage` backfill exists.
- `warehouse.snapshot` and `truck.snapshot` backfill do **not** exist yet.
- Because of that, **job usage parity can be a strict pass/fail gate**, but **warehouse/truck parity is only a render plus touched-delta sanity check** until snapshots are backfilled.

## 0. Pre-deploy gate
1. Run build/test on the exact tree to deploy.
2. Open admin and crew dashboards once each.

### Pass
- Build passes.
- Inventory event test suite passes.
- Both dashboards load without blank screen, auth loop, or console-breaking runtime error.

### Fail
- Build/test fails.
- Inventory tabs or crew materials/closeout screens do not render.

---

## 1. Crew daily materials, create then edit same log
Use one live truck, one live job assigned to that truck, one item with obvious qty.

1. Crew logs into their truck.
2. On a job for today, add a daily materials entry for one item.
3. Save.
4. Re-open the same dated entry.
5. Change the qty upward or downward.
6. Save again.

### Pass
- Save succeeds both times.
- The same dated log is updated, not duplicated.
- Crew truck inventory changes immediately after each save.
- The edited total, not the original total, is what remains on the job.
- No negative truck counts appear.

### Fail
- Second save creates a duplicate dated log.
- Truck inventory does not change, changes twice, or goes negative.
- Materials screen errors on edit or truck reassignment.

---

## 2. Crew closeout on that same job
Use the same job after step 1.

1. Close out the job.
2. Enter `materialsUsed` that is either:
   - exactly equal to daily logs, or
   - slightly higher than daily logs for one item.
3. Save closeout.

### Pass
- Job closes successfully.
- If closeout matches daily logs, truck inventory does **not** deduct again.
- If closeout is higher than daily logs, truck inventory deducts only the leftover difference.
- Closed job stays readable in admin.

### Fail
- Closeout double-deducts material already logged daily.
- Closeout fails when daily logs already exist.
- Closed job loses its material history or shows obviously wrong totals.

---

## 3. Crew load truck
Use one warehouse item with known qty.

1. From crew flow, load a small known qty onto the truck.
2. Confirm truck inventory.
3. Confirm warehouse inventory.

### Pass
- Truck qty increases by the loaded amount.
- Warehouse qty decreases by the same amount.
- No overwrite of other truck items.
- Load completes without error.

### Fail
- Truck qty is overwritten instead of incremented.
- Warehouse does not drop by the same amount.
- Unrelated truck inventory disappears.

---

## 4. Crew return / unload material
Immediately return part or all of what was loaded.

1. Return material from the same truck.
2. Confirm truck inventory.
3. Confirm warehouse inventory.

### Pass
- Warehouse qty increases by returned amount.
- Returned item is removed from truck state for that qty path.
- Return completes without error.
- Return log entry appears.

### Fail
- Warehouse does not increase.
- Truck still shows returned qty.
- Return wipes unrelated truck inventory or errors.

---

## 5. Admin parity / reconciliation check
Do this after the crew flow above.

1. Open admin inventory parity views.
2. Open truck parity for the truck you touched.
3. Open warehouse parity.
4. Open closed-job usage parity / reconciliation for the job you touched.

### Pass
- All parity/reconciliation screens render.
- The touched closed job shows aligned event-derived usage, or any mismatch is explainable from the exact manual action just taken.
- Truck and warehouse parity screens visibly reflect the touched item deltas from load/return activity.
- No runtime crash, empty broken panel, or obviously stale values after refresh.

### Fail
- Any parity screen fails to render.
- The touched closed job shows unexplained usage mismatch after refresh.
- The touched truck/warehouse deltas do not move in the expected direction.

## Ship call
- **Ship** if steps 0 through 5 pass.
- **Do not block ship only because warehouse/truck parity is not globally zero** before snapshot backfill.
- **Block ship** if daily materials edit/upsert, closeout leftover handling, load, return, or admin parity rendering fails.