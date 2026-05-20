# Firestore Collections

This is a practical field guide to the collections currently referenced by IST Dispatch. Verify exact document shapes in production before writing migrations.

## Core dispatch

- `jobs`: Scheduled/active jobs. Referenced by updates, PM updates, material logs, and status workflows.
- `updates`: Crew job updates for dispatch timeline and material-log truck inference.
- `jobUpdates`: Additional job update/checklist records.
- `tickets`: Issue/help tickets.
- `pmUpdates`: Project-manager updates tied to jobs.
- `activityLog`: Office/admin audit messages such as sign-ins and actions.
- `crewMembers`: Crew roster, truck assignments, and login/session identity.
- `trucks`: Truck records used for dispatch and inventory location state.

## Inventory and migration

- `inventory`: Legacy warehouse inventory rows. Usually keyed by Firestore document ID with `itemId`, `qty`, and update timestamps.
- `inventoryItems`: Catalog overrides/custom inventory items layered over built-in catalog data.
- `inventoryEvents`: Event-sourced inventory audit stream. Used for warehouse/truck/job projections and parity checks.
- `truckInventory`: Legacy primary truck inventory snapshots by truck/document.
- `truckSecondaryInventory`: Secondary truck inventory snapshots.
- `truckToolInventory`: Truck tool inventory snapshots.
- `loadLog`: Legacy/audit log for material loaded to trucks.
- `returnLog`: Legacy/audit log for material returned from trucks.
- `truckDailyLogs`: Daily truck/crew checklist and material log data.

## Tools, consumables, and supplies

- `tools`: Tool catalog/status records.
- `toolCheckouts`: Tool checkout and return audit records.
- `consumables`: Consumable supply records.
- `foamGunParts`: Foam parts inventory.
- `projectToolsInventory`: Project tool inventory.
- `suppliesCheckouts`: Checkout audit trail for foam parts/project tools.
- `builders`: Builder/customer records used by supply/project flows.

## Sales/takeoff

- `quotes`: Recent quote documents.
- `takeoffJobs`: Saved takeoff jobs keyed by job name and saved-by user.

## Security note

Firestore rules are an open security debt item. Until rules are hardened, assume client-side checks are convenience only and do not store secrets or privileged-only data in broadly readable collections.
