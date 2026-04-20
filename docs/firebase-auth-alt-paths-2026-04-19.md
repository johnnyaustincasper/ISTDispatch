# Firebase auth alternative paths, 2026-04-19

**Executable path found:** Yes

## Exact findings

1. **No local service-account JSON found** in the workspace, and no ADC file exists at `~/.config/gcloud/application_default_credentials.json`.
2. **Firebase CLI login is present** at `~/.config/configstore/firebase-tools.json` for `johnnyaustincasper@gmail.com`, with active project `insulation-services-da91a` and valid Google access/refresh tokens.
3. **Firestore rules are fully open** in `firestore.rules`:
   - `allow read, write: if true;`
4. Because of that, **the Firebase web SDK can legitimately read and write Firestore from Node today** using the existing `.env.local` web config, without a new service-account file.
5. Existing proof in repo: `scripts/backfill-job-usage-history.mjs` already uses the web SDK successfully.
6. I added the same safe option to the two Admin-only snapshot scripts:
   - `scripts/backfill-truck-inventory-events.mjs`
   - `scripts/backfill-warehouse-inventory.mjs`

## Code changes made

Added `--web-sdk` support to:

- `/Users/celeste/.openclaw/workspace/ist-dispatch/scripts/backfill-truck-inventory-events.mjs`
- `/Users/celeste/.openclaw/workspace/ist-dispatch/scripts/backfill-warehouse-inventory.mjs`

Behavior:
- Default behavior is unchanged, Admin auth still works.
- With `--web-sdk`, the scripts load `.env.local`, use the modular Firebase web SDK, and perform the same merge-safe writes to `inventoryEvents`.

## Verified today

### Truck snapshot dry-run
```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-truck-inventory-events.mjs --web-sdk --dry-run --sample 2
```
Result:
- `truckCount: 6`
- `eventCount: 9`

### Warehouse snapshot dry-run
```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-warehouse-inventory.mjs \
  --web-sdk \
  --dry-run \
  --input tmp/warehouse-inventory-snapshot.json \
  --warehouse main \
  --sample 2
```
Result:
- `itemCount: 55`
- `eventCount: 55`

### Existing event state
- `warehouse.snapshot: 0`
- `truck.snapshot: 0`
- `job.usage: 268`

## Safest executable path today

Use the new `--web-sdk` mode, because it matches the repo's current Firestore security posture and avoids inventing token hacks.

### Warehouse write
```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-warehouse-inventory.mjs \
  --web-sdk \
  --write \
  --input tmp/warehouse-inventory-snapshot.json \
  --warehouse main
```

### Truck write
```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-truck-inventory-events.mjs \
  --web-sdk \
  --write \
  --sample 3
```

## What I am **not** recommending

- Do **not** try to coerce `firebase-tools.json` directly into Admin SDK auth.
- Do **not** invent undocumented token plumbing around Admin SDK.
- Do **not** rely on a missing service-account path.

## Bottom line

A legitimate path exists **today without a newly supplied service-account file**: use the existing open Firestore rules plus the existing web Firebase config, via `--web-sdk`, for the warehouse and truck snapshot backfills.
