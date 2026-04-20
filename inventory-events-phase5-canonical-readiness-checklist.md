# inventoryEvents canonical readiness checklist

## P0, close legacy-only write gaps before trusting canonical balances

- [ ] **Add canonical event writes for direct truck usage mutations**
  - `src/App.jsx:12009` `handleDeductFromTruck`
  - `src/App.jsx:12025` `handleDeltaAdjustTruck`
  - Risk: these mutate `truckInventory` with no matching `inventoryEvents`, so replayed truck balances can drift silently.
  - Safest next change: funnel both through one helper that emits `job.usage` or `inventory.reconciliation` events with stable `correlationKey`, actor, and before/after context.

- [ ] **Either remove or dual-write the legacy-only daily log path**
  - `src/App.jsx:12275` `handleLogDailyMaterials`
  - Risk: it updates `jobs.dailyMaterialLogs` only. If still reachable, it bypasses canonical writes.
  - Safest next change: make it call the same path as `handleSaveJobMaterials(...payload.date...)`, or delete it if dead.

- [ ] **Stop accepting raw `materialsUsed` writes without events**
  - `src/App.jsx:12273` fallback branch in `handleSaveJobMaterials`
  - Risk: direct `jobs.materialsUsed` edits stay legacy-only and can desync closeout parity.
  - Safest next change: route all non-daily usage edits through event adapters, or explicitly block this branch once migration is complete.

## P1, flip practical reads from legacy-first to event-first

- [ ] **Truck operational UI is still legacy-backed**
  - Read subscriptions remain on `truckInventory` at `src/App.jsx:11558`
  - Crew view receives legacy truck state at `src/App.jsx:12430`
  - Current event-derived truck state exists, but parity is mostly warning UI, not the live source.
  - Safest next change: behind a feature flag, feed crew/admin truck counts from `derivedTruckInventory`, while still showing legacy deltas for audit.

- [ ] **Warehouse operational UI is still legacy-backed**
  - Read subscription remains on `inventory` at `src/App.jsx:11556`
  - Parity tab exists, but materials workflows still use legacy inventory rows.
  - Safest next change: build an event-derived warehouse inventory selector/model and swap read paths in the inventory tab first.

- [ ] **Job usage remains legacy-first outside parity/reporting**
  - Event-derived job usage exists via `getJobUsageParityReport`, but job workflows still persist and inspect `dailyMaterialLogs` / `materialsUsed` directly.
  - Safest next change: expose an event-derived per-job usage view and use it in closeout/history displays before retiring legacy fields.

## P2, parity UI already in place and worth keeping during the flip

- [x] **Warehouse parity tab exists**
  - `src/App.jsx:7808`
  - Good for rollout guardrails, but currently read-only.

- [x] **Truck parity warnings exist in ops UI**
  - `src/App.jsx:4530`
  - `src/App.jsx:8077`
  - Good for surfacing mismatches per truck.

- [x] **Closed-job usage parity exists**
  - `src/App.jsx:7004`
  - Good checkpoint for daily-log and closeout migration quality.

## P3, cleanup and hardening after the read flip

- [ ] **Centralize event writes behind one mutation layer**
  - Right now dual-write logic is scattered across several handlers in `src/App.jsx`.
  - Safest next change: introduce one inventory mutation service so new UI paths cannot accidentally skip canonical writes.

- [ ] **Define retirement criteria for legacy docs before Phase 4 exit**
  - `src/inventoryEvents.js` rollout stages say Stage 4 stops dual writes only after reconciliation is stable.
  - Safest next change: codify thresholds, for example zero legacy-only writers, warehouse parity clean, truck parity clean, and closed-job usage parity clean for a fixed window.

- [ ] **Decide how legacy mirrors will be maintained during the interim**
  - Today the system is still effectively legacy-primary with event mirrors.
  - Safest next change: once reads flip, keep legacy docs as compatibility mirrors written from canonical mutations only, never as independent sources.

## Recommendation, safest next code sequence after Phase 4

1. Patch `handleDeductFromTruck`, `handleDeltaAdjustTruck`, and `handleLogDailyMaterials` / raw `materialsUsed` fallback so no legacy-only writes remain.
2. Feature-flag truck reads to `derivedTruckInventory` first, because parity support is already strongest there.
3. Flip warehouse reads to event-derived inventory next, using the existing parity tab as the release gate.
4. Move job usage displays to event-derived totals, then freeze or remove direct writes to `dailyMaterialLogs` and `materialsUsed`.
5. Only then treat `inventoryEvents` as the practical canonical truth and demote legacy collections to mirrors.
