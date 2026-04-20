# Final ship-now readiness, 2026-04-19

Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Recommendation
**NO-GO for immediate deploy.**

### Next best action
**One last patch**

## Why
Build/test/backfill state is mostly good, but there is still a live data-integrity blocker in the current tree:

- `src/App.jsx:12155-12156` in `handleReturnMaterial(...)` still does:
  ```js
  delete state[m.itemId];
  ```
- That removes the full SKU from truck state whenever `stillHave > 0`, even for a **partial** return.
- Result: a truck can lose remaining on-truck quantity in legacy read state while the event log records only the returned amount.
- This creates exactly the kind of legacy/event mismatch that makes a ship-now deploy risky.

## What I verified
### Commands run
```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
git status --short --branch
npm run build
npm run test:inventory-events
```

### Build/test
- `npm run build` ✅ passed
- `npm run test:inventory-events` ✅ passed
- Non-blocking build warnings only:
  - large Vite chunk
  - `jspdf` mixed static/dynamic import warning

### Read-only Firestore state check
Observed current `inventoryEvents` counts:
- `warehouse.snapshot`: **55**
- `truck.snapshot`: **9**
- `job.usage`: **268**
- `warehouse.adjustment`: **0**
- `truck.transfer`: **0**

This is consistent with snapshots/job-usage backfill having landed, but it does not clear the live return-path bug above.

## Extra note
There is also still a weaker integrity gap in `handleEditJob(...)` where truck inventory can be rewritten for material-usage changes without matching event writes. I would treat that as follow-up, but the return-path bug is the immediate blocker.

## Final call
**Recommendation: one last patch**

After patching `handleReturnMaterial(...)` to subtract only the returned quantity from truck state, do a fast smoke test for:
1. partial truck return
2. full truck return
3. daily materials edit/save
4. job closeout with materials

If those pass, this looks ready to deploy.
