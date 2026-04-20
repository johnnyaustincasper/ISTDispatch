# Firebase Admin auth discovery for IST Dispatch backfills

Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`
Date: 2026-04-19

## Recommendation

**Safest path today:** use a **service-account JSON file outside the repo** and pass it explicitly to the Admin-based backfill scripts.

Recommended command shape:

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json \
node scripts/backfill-truck-inventory-events.mjs --dry-run --project insulation-services-da91a
```

Or explicitly per script:

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-warehouse-inventory.mjs \
  --input tmp/warehouse-inventory-snapshot.json \
  --warehouse main \
  --dry-run \
  --project insulation-services-da91a \
  --service-account /absolute/path/to/service-account.json
```

## What exists

- Web Firebase config exists in `/Users/celeste/.openclaw/workspace/ist-dispatch/.env.local`
  - Present keys: `VITE_FB_API_KEY`, `VITE_FB_APP_ID`, `VITE_FB_AUTH_DOMAIN`, `VITE_FB_MESSAGING_ID`, `VITE_FB_PROJECT_ID`, `VITE_FB_STORAGE_BUCKET`
- Credential index exists in `/Users/celeste/.openclaw/workspace/CREDS.md`
  - It points only to **web app config** in `ist-dispatch/.env.local`
  - It does **not** point to any Firebase Admin service-account JSON
- Admin SDK dependency exists in `/Users/celeste/.openclaw/workspace/ist-dispatch/functions/package.json`
- Admin-auth runbook already exists in `/Users/celeste/.openclaw/workspace/ist-dispatch/docs/phase4-backfill-runbook.md`

## What is missing

- No service-account JSON was found in the workspace or nearby checked-in repo files
- No ADC file was found at `/Users/celeste/.config/gcloud/application_default_credentials.json`
- No `ist-dispatch/.firebaserc` exists
- Firebase CLI login state exists at `/Users/celeste/.config/configstore/firebase-tools.json`, but that is **not** the same thing as Admin SDK ADC/service-account auth for these Node scripts

## Script-by-script auth shape

### 1) Truck inventory backfill
File: `/Users/celeste/.openclaw/workspace/ist-dispatch/scripts/backfill-truck-inventory-events.mjs`

Auth mechanism:
- Uses `firebase-admin/app`
- Accepts either:
  - `--service-account /absolute/path/to/service-account.json`, or
  - `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`
- Project resolution:
  - `--project <id>` preferred
  - otherwise `VITE_FB_PROJECT_ID` or `GCLOUD_PROJECT`

Exact shape:

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json \
node scripts/backfill-truck-inventory-events.mjs --dry-run --project insulation-services-da91a
```

### 2) Warehouse inventory backfill
File: `/Users/celeste/.openclaw/workspace/ist-dispatch/scripts/backfill-warehouse-inventory.mjs`

Auth mechanism:
- Uses `firebase-admin/app`
- Same Admin auth options as above
- Also requires an input snapshot file

Exact shape:

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json \
node scripts/backfill-warehouse-inventory.mjs \
  --input tmp/warehouse-inventory-snapshot.json \
  --warehouse main \
  --dry-run \
  --project insulation-services-da91a
```

### 3) Job usage backfill
File: `/Users/celeste/.openclaw/workspace/ist-dispatch/scripts/backfill-job-usage-history.mjs`

Auth mechanism:
- Uses the **web Firebase SDK**, not Admin SDK
- Reads from `.env.local` values, with hardcoded fallback config present in the script
- No service-account file required for this script

Exact shape:

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
set -a && source .env.local && set +a
node scripts/backfill-job-usage-history.mjs --sample=20
node scripts/backfill-job-usage-history.mjs --apply --sample=20
```

## Bottom line

For **today's safest execution**, do **not** rely on Firebase CLI login alone. Use a real Firebase Admin service-account JSON kept outside the repo, pass it via `--service-account` or `GOOGLE_APPLICATION_CREDENTIALS`, and keep `--project insulation-services-da91a` explicit on the Admin-based scripts.
