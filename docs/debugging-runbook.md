# Debugging Runbook

Use this checklist when IST Dispatch behavior differs between local, CI, and production.

## 1. Establish the build under test

- Confirm the branch/commit and run `git status --short` before changing files.
- Install deterministically with `npm ci`.
- Run `npm test` to exercise inventory display/catalog/event migration/projection, material-log helper behavior, diagnostics summaries, and Firestore listener wrappers.
- Run `npm run build` to catch Vite/React compile issues.
- For production incidents, verify the active Vercel alias points to the deployment you are debugging. Do not assume the latest deployment is receiving traffic.

## 2. Check environment and Firebase config

- Local and deployed builds require `VITE_FB_API_KEY`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_PROJECT_ID`, `VITE_FB_STORAGE_BUCKET`, `VITE_FB_MESSAGING_ID`, and `VITE_FB_APP_ID`.
- If data looks missing, first confirm the app is connected to the expected Firebase project.
- Remember that Vite embeds `VITE_*` variables at build time; changing Vercel env vars requires a rebuild/redeploy.

## 3. Inventory issue triage

- Identify the source of truth involved:
  - Warehouse legacy state: `inventory`.
  - Truck legacy state: `truckInventory` and related truck inventory collections.
  - Audit/event stream: `inventoryEvents`.
  - Legacy movement logs: `loadLog` and `returnLog`.
  - Material/job usage: job material logs and `truckDailyLogs`.
- Reproduce with helper tests or add a small pure-function test before editing `App.jsx`.
- Use parity diagnostics from `src/inventoryEvents.js` for warehouse, truck, and job usage mismatches.
- For migration bugs, inspect event IDs, `eventType`, `occurredAt`, `effectiveDate`, location fields, item IDs, quantity deltas, and correlation keys.
- Backfill scripts should be treated as data-changing operations. Run dry/planning checks first and capture before/after parity output.

## 4. Material-log edit triage

- Confirm whether the edit came from office/admin or crew flow.
- Verify the chosen truck ID source in this order: explicit log truck ID, matching crew/date update, then job fallback.
- Ensure editable material lists include active truck inventory items as well as existing logged materials.
- Run `npm run test:material-logs` after changes to truck inference or editable material selection.

## 5. Monolith-safe debugging

- `src/App.jsx` is large and easy to regress. Prefer extracting or testing pure logic in helper modules before touching UI handlers.
- Keep console/debug logging targeted and temporary. For persistent diagnostics, prefer structured fields in events/audit documents.
- When a UI symptom appears, trace: React state source → Firestore subscription → write handler → helper module → collection document.

## 6. Firestore/security caveat

Open Firestore rules are known security debt. While debugging, distinguish between application bugs and permission/modeling gaps. Before exposing new workflows to broader users, verify rules enforce the intended read/write boundaries server-side.
