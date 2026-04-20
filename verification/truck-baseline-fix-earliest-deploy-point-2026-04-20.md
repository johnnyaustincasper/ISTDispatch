# Truck baseline fix, earliest honest deploy point

**Call: needs one more pass, not deploy immediately after the baseline fix.**

## Why

- The current blocker is correctly identified as the **truck baseline/time-axis mismatch**, documented in `/Users/celeste/.openclaw/workspace/ist-dispatch/verification/truck-parity-mismatch-root-cause-2026-04-20.md`.
- The earlier partial-return bug is **already fixed** in current code at `/Users/celeste/.openclaw/workspace/ist-dispatch/src/App.jsx` in `handleReturnMaterial(...)`, so there is no evidence that a single small code patch alone will make truck parity honestly green.
- Live evidence still shows **5 of 8 trucks mismatched** after backfill in `/Users/celeste/.openclaw/workspace/ist-dispatch/verification/phase4-live-parity-postbackfill-2026-04-19.md`.
- Because the baseline issue is a **data-model / replay-semantics** problem, the first honest deploy point is **after**:
  1. the truck baseline approach is changed,
  2. the affected truck snapshot/backfill state is regenerated or reinterpreted consistently,
  3. and a fresh live parity readout confirms the truck lane is acceptable for the intended release standard.

## Go / no-go note

- **No-go** for: "deploy immediately after baseline fix"
- **Go** for: "needs one more pass"

That one more pass should be a tight validation pass, not a broad rewrite: rerun the truck baseline/backfill path, then verify live truck parity and spot-check at least the previously red trucks.
