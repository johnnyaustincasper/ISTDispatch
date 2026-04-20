# Inventory UI source-truth audit for `src/App.jsx`

## Scope
Audit of inventory-related UI flows in `src/App.jsx`, focused on source-record selection risk, truck-scoped vs job-scoped confusion, `dailyMaterialLogs` vs `materialsUsed`, and audit-truth gaps.

## Executive summary
The file is trying to support a simple mental model, "materials came off this truck for this job on this day", but several UI flows still operate on broader job-level aggregates or on date-only checks. That creates real risk that the UI shows the wrong source record, edits the wrong truck's usage, or presents audit views that look correct while silently mixing incompatible sources.

## Findings

### 1. Missing-material warnings are date-only in parts of the UI, but closeout logic is truck-aware
**Severity:** High

**Code:** `src/App.jsx:1877-1881`, `1887-1889`, `2124-2129`, `2147-2151`

- `getMissingMaterialDays()` and closeout gating use `findDailyMaterialLog(job.dailyMaterialLogs, date, job.truckId)`, which is truck-aware.
- But the consolidated warning banner and per-job missing-days warning build `logged` as `new Set((job.dailyMaterialLogs || []).map(l => l.date))`, which ignores `truckId`.

**Why this betrays the truck model**
- If a job has a log for the same date from a different truck, the warnings can say the day is covered even though the current truck has no matching log.
- The user can see a clean job card, then later hit a closeout block because the stricter truck-aware path disagrees.

**Impact**
- False sense that materials are fully logged.
- UI state and transaction logic can disagree on whether a truck/day is complete.

---

### 2. The main job-card materials display hides truck identity, so same-day/same-job logs can look interchangeable
**Severity:** High

**Code:** `src/App.jsx:2214-2228`, `2927-2949`, `8668-8723`

- Crew job cards list each log by date and materials, but not by `truckId` or truck name.
- Closeout review also shows prior logs without identifying which truck each log came from.
- Admin calendar editing shows the log date and `loggedBy`, but again not the truck source.

**Why this betrays the truck model**
- Once a job can accumulate multiple logs for the same date from different trucks, the UI does not make the source record visually distinct.
- A crew lead or admin can easily edit the right date but the wrong truck-scoped record, because the screen does not surface the differentiator that `findDailyMaterialLog()` depends on.

**Impact**
- Wrong-record edits are plausible in shared or reassigned jobs.
- Audit review becomes "trust the hidden truckId" instead of visible operational truth.

---

### 3. Crew "Edit Materials" rewrites today under `editMaterialsJob.truckId`, not the source log being edited
**Severity:** High

**Code:** `src/App.jsx:3066-3138`, especially `3138`

- This modal aggregates `materialsUsed` plus all `dailyMaterialLogs` into one `existing` map.
- On save it calls:
  - `onSaveJobMaterials(editMaterialsJob.id, { date: today, truckId: editMaterialsJob.truckId || truck?.id || null, ... }, truck?.id || null)`
- There is no `sourceTruckId`, no preserved per-log truck identity, and no selection of which daily log is being changed.

**Why this betrays the truck model**
- The modal is job-level, not log-level.
- If the job has multiple daily logs, it collapses them into one total, then writes a single today log for the job's truck/current crew truck.
- That can move usage from the original source truck onto the current truck, or overwrite the wrong record entirely.

**Impact**
- Strongest wrong-source-record risk in the crew UI.
- Can silently reshape the job history from per-truck daily truth into a synthetic aggregate.

---

### 4. Crew daily log modal validates against the current truck inventory even when editing a historical log from another truck
**Severity:** High

**Code:** `src/App.jsx:2781`, `2803-2826`, `2866-2899`, `2902`

- The modal correctly tries to target a specific log via `_logTruckId` and `findDailyMaterialLog(...)`.
- But all availability messaging and validation use the current dashboard `truckInventory`, not the inventory state of the log's source truck.
- Save passes payload truckId from `_logTruckId`, but the transaction truck context comes from `truck?.id` (`onSaveJobMaterials(..., truck?.id || null)`).

**Why this betrays the truck model**
- The screen can say "on truck" based on the current crew truck while actually editing a record belonging to another truck.
- Validation can approve or reject edits against the wrong truck state.
- The save path partly identifies the target log by `_logTruckId`, but partly identifies the inventory adjustment truck by the current session truck.

**Impact**
- Confusing and unsafe when jobs move between trucks or when historical logs belong to an earlier truck assignment.
- Easy for UI text to imply one source record while transaction logic mutates another truck inventory.

---

### 5. Closeout writes `materialsUsed` as a job-level field but only deducts the net-new amount from the current truck
**Severity:** High

**Code:** `src/App.jsx:1921-1932`, `3024-3028`, `11647-11708`

- Closeout confirmation sums all historical daily logs plus today's closeout entry for display.
- `handleCloseOutJob()` stores `materialsUsed` as a top-level job field and subtracts only `materialsUsed - sum(dailyMaterialLogs)` from the passed truck.

**Why this betrays the truck model**
- `materialsUsed` is a job-level aggregate with no per-truck source info.
- The deduction path assumes any "net new" amount belongs to the truck passed into closeout right now.
- If the job has switched trucks over time, the remaining closeout-only materials get attributed to the current truck even though the field itself is not truck-scoped.

**Impact**
- `materialsUsed` becomes a catch-all bucket that is operationally convenient but weaker than `dailyMaterialLogs` as audit truth.
- Truck accountability for late-entered or closeout-only materials is lossy.

---

### 6. Audit and reconciliation views still fall back to `job.truckId` or job membership, which can misattribute mixed-source jobs
**Severity:** Medium-High

**Code:** `src/App.jsx:4386-4400`, `4459-4488`, `8168-8190`

- Daily reconciliation counts completed jobs where `j.truckId === truck.id`, then sums today's `dailyMaterialLogs`, else falls back to `materialsUsed`.
- Truck history builds `truckJobs` from crew membership or `j.truckId === hTruck.id`, then adds every `dailyMaterialLog` under that truck's calendar view.
- `aggregateJobMaterialsByTruck()` is more source-aware, but these UI summaries do not consistently use that stricter mapping.

**Why this betrays the truck model**
- A job can carry logs from multiple trucks, but these views often start from the job's assigned truck rather than the log's source truck.
- `materialsUsed` fallback has no truck granularity at all, so it inherits the job's truck by implication.

**Impact**
- Reconciliation and truck history can look complete while attributing usage to the wrong truck.
- Audit consumers may trust summaries that are already source-mixed before display.

---

### 7. Cost and reporting paths prefer `dailyMaterialLogs`, otherwise `materialsUsed`, creating two incompatible truth modes
**Severity:** Medium

**Code:** `src/App.jsx:143-149`

- `calcJobMaterialCost()` totals all `dailyMaterialLogs` if any exist, otherwise it totals `materialsUsed`.

**Why this betrays the truck model**
- The job flips between two data models:
  - per-day/per-truck logs when present,
  - a single job-level aggregate when not.
- Partial adoption of daily logs means some reports reason from detailed truth while others reason from a coarse fallback.

**Impact**
- Reports can be internally consistent but semantically different across jobs.
- Hard to guarantee that downstream totals mean the same thing from one job to the next.

## Overall risk pattern
The codebase has started moving toward truck-aware daily logs, but several UI surfaces still think in terms of:
- one job, one current truck,
- one day means one material record,
- one aggregate `materialsUsed` bucket is good enough for reporting.

That mismatch is exactly where the UI can betray the simple truck model.

## Most concrete hotspots to fix first
1. Replace all date-only `dailyMaterialLogs` completeness checks with truck-aware checks.
2. Surface truck identity anywhere a daily material log is displayed or edited.
3. Retire or sharply constrain the crew-level aggregate `Edit Materials` modal, because it is the clearest wrong-record writer.
4. Stop using current-session `truckInventory` to validate/edit logs whose source truck may differ.
5. Treat `materialsUsed` as legacy/fallback only, or attach explicit truck attribution before using it in reconciliation/audit views.

## Report file
`/Users/celeste/.openclaw/workspace/ist-dispatch/inventory-ui-source-truth-audit.md`
