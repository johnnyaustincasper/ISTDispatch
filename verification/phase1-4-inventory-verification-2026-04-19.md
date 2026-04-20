# Inventory migration verification, Phases 1-4

Date: 2026-04-19
Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Commands run

```bash
node scripts/test-inventory-events.mjs
ls -1 scripts && printf '\n---\n' && find src -maxdepth 2 -type f \( -name '*inventory*' -o -name '*backfill*' \) | sort
grep -n "buildJobUsageBackfillPlan\|getJobUsageParityReport\|deriveJobUsageFromEvents\|adaptLegacyTruckInventoryToSnapshotEvents\|adaptLegacyWarehouseInventoryToSnapshotEvents" src/inventoryEvents.js
node scripts/backfill-truck-inventory-events.mjs --help
node scripts/backfill-warehouse-inventory.mjs --help
node scripts/backfill-job-usage-history.mjs --help
node scripts/backfill-job-usage-history.mjs > /tmp/job_usage_backfill_run1.txt && node scripts/backfill-job-usage-history.mjs > /tmp/job_usage_backfill_run2.txt && diff -u /tmp/job_usage_backfill_run1.txt /tmp/job_usage_backfill_run2.txt
```

## Surface verified

- `scripts/test-inventory-events.mjs`
- `package.json` scripts:
  - `test:inventory-events`
  - `backfill:warehouse-inventory`
  - `backfill:truck-inventory-events`
  - `backfill:job-usage-history`
- Backfill CLIs:
  - `scripts/backfill-warehouse-inventory.mjs`
  - `scripts/backfill-truck-inventory-events.mjs`
  - `scripts/backfill-job-usage-history.mjs`
- Parity/backfill helpers:
  - `src/inventoryEvents.js`
  - `src/inventoryBackfill.js`
  - `src/inventoryEventWrites.js`

## Findings

### Test status

- `node scripts/test-inventory-events.mjs` passed cleanly.
- The current test surface covers deterministic IDs, snapshot/backfill planning, truck and warehouse replay/parity, and job-usage projection/parity.
- The specific regression guard for job usage backfill determinism is present and passed:
  - `job usage backfill plan is deterministic and rerunnable against existing event ids`

### Determinism / flake check

- Re-ran `scripts/backfill-job-usage-history.mjs` twice and diffed the full dry-run output.
- `diff -u` returned no output, so the current dry-run output was byte-stable across the two runs.
- Based on this check, the previously mentioned unrelated failure around job usage backfill determinism does **not** reproduce in the current tree.

### CLI behavior notes

- Truck and warehouse backfill CLIs expose proper `--help` usage text.
- `scripts/backfill-job-usage-history.mjs` does **not** currently implement `--help`; passing `--help` still executes the live dry run.
- That is a CLI ergonomics/safety gap, but it is **not** the determinism failure and does **not** block today’s push by itself.

### Live dry-run observation

- The current job-usage dry run completed successfully and reported:
  - `totalJobsScanned: 160`
  - `totalEventsPlanned: 268`
  - `dailyLogEventCount: 157`
  - `closeoutLeftoverEventCount: 111`
- No assertion failures or flaky ordering showed up during that run.

## Push assessment

- **Not blocked** by the previously reported job-usage backfill determinism issue.
- I did not find any failing assertions in the Phase 1-4 inventory verification surface.
- The only notable follow-up is adding a real `--help` / no-side-effect flag path to `backfill-job-usage-history.mjs`, but that can be handled separately from today’s push.
