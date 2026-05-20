# IST Dispatch Architecture

IST Dispatch is a Vite + React + Firebase app for office dispatch, crew workflows, inventory, material logs, job updates, tickets, tools, quotes, takeoffs, and supply checkouts.

## Current shape

- **UI/application shell:** `src/App.jsx` is currently the central monolith. It owns most React state, Firestore subscriptions, role/session flows, and write handlers.
- **Firebase wiring:** `src/firebase.js` initializes the Firebase app, Firestore, and Storage from `VITE_FB_*` environment variables.
- **Extracted domain helpers:** Inventory and material-log logic has started moving out of `App.jsx` into focused modules:
  - `src/inventoryCatalog.js` — built-in catalog, item overrides, save payload normalization.
  - `src/inventoryDisplay.js` — compact display labels for inventory items.
  - `src/inventoryEvents.js` — canonical inventory event model, projections, parity reports, transfer planning, migration adapters.
  - `src/inventoryEventWrites.js` — Firestore write-entry construction/writes for inventory events.
  - `src/inventoryBackfill.js` — backfill planning and event generation for historical inventory state.
  - `src/materialLogHelpers.js` — material-log edit inference and editable item selection.
- **Tests:** Node assertion scripts in `scripts/test-*.mjs` cover the extracted helper modules. `npm test` runs inventory display/catalog/events/material-log helpers plus diagnostics and Firestore listener tests.

## Inventory migration model

Inventory is in a legacy-plus-events transition:

- Legacy state collections such as `inventory`, `truckInventory`, `loadLog`, `returnLog`, and job/material-log fields are still read or written by parts of the app.
- `inventoryEvents` is the canonical audit/event stream used to derive warehouse, truck, and job-usage projections.
- Backfill scripts create baseline/snapshot events so event-derived projections can be compared to legacy state.
- During migration, use parity reports before changing writes: warehouse parity, truck parity, and job usage parity should identify whether the legacy and event models agree.

## Deployment/runtime

- The app is built with Vite (`npm run build`).
- Production hosting is expected on Vercel. After deploys, verify the active Vercel alias points at the intended build before debugging data regressions.
- Runtime behavior depends on Firebase project environment variables. A successful local build does not prove the deployed alias has the intended Firebase config.

## Codebase hygiene direction

- Keep extracting pure business logic from `App.jsx` into modules with small Node tests.
- Avoid expanding the monolith for new inventory/material-log behavior when a helper module can own the logic.
- Prefer deterministic event IDs and explicit correlation keys for data repair/migration work.
- Treat open Firestore rules as security debt: document assumptions, avoid placing secrets in Firestore, and plan rules hardening before broader external use.
