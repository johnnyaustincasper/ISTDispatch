# Phase 4 backfill execution log, 2026-04-19

Status: partial, dry-run only, writes blocked / not safe to continue

Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Summary
- Inventory event tests passed.
- Warehouse snapshot input export succeeded, 55 rows written to `tmp/warehouse-inventory-snapshot.json`.
- Warehouse snapshot dry-run succeeded, planning 55 `warehouse.snapshot` events.
- Truck snapshot dry-run is hard-blocked here because Firebase Admin default credentials are not available.
- Job usage dry-run succeeded and planned 268 `job.usage` events.
- Read-only verification shows `job.usage` events already exist in Firestore, so a real job-usage write was not safe/necessary.
- No write commands were executed.

## Auth / input checks
Command:
```bash
printf 'GOOGLE_APPLICATION_CREDENTIALS=%s\nGCLOUD_PROJECT=%s\n' "$GOOGLE_APPLICATION_CREDENTIALS" "$GCLOUD_PROJECT"; command -v gcloud >/dev/null && gcloud auth application-default print-access-token >/dev/null 2>&1 && echo ADC_OK || echo ADC_MISSING; find .. -maxdepth 3 \( -name '*service-account*.json' -o -name '*firebase*admin*.json' -o -name '*gcp*.json' \) -type f 2>/dev/null | sed 's#^#FOUND_CRED_FILE #'
```
Outcome:
```text
GOOGLE_APPLICATION_CREDENTIALS=
GCLOUD_PROJECT=
ADC_MISSING
```

## Commands run and outcomes

### 1) Tests
Command:
```bash
npm run test:inventory-events
```
Outcome: passed.

### 2) Warehouse snapshot export
Command:
```bash
mkdir -p tmp && set -a && source .env.local && set +a && node --input-type=module -e 'import fs from "node:fs/promises"; import { initializeApp } from "firebase/app"; import { getFirestore, collection, getDocs } from "firebase/firestore"; const app=initializeApp({apiKey:process.env.VITE_FB_API_KEY,authDomain:process.env.VITE_FB_AUTH_DOMAIN,projectId:process.env.VITE_FB_PROJECT_ID,storageBucket:process.env.VITE_FB_STORAGE_BUCKET,messagingSenderId:process.env.VITE_FB_MESSAGING_ID,appId:process.env.VITE_FB_APP_ID}); const db=getFirestore(app); const snap=await getDocs(collection(db,"inventory")); const rows=snap.docs.map(d=>({id:d.id,...d.data()})); await fs.writeFile("tmp/warehouse-inventory-snapshot.json", JSON.stringify(rows,null,2)); console.log(JSON.stringify({wrote:"tmp/warehouse-inventory-snapshot.json",count:rows.length},null,2));'
```
Outcome:
```json
{
  "wrote": "tmp/warehouse-inventory-snapshot.json",
  "count": 55
}
```

### 3) Warehouse snapshot dry-run
Command:
```bash
node scripts/backfill-warehouse-inventory.mjs --input tmp/warehouse-inventory-snapshot.json --warehouse main --dry-run --project insulation-services-da91a
```
Outcome:
```json
{
  "mode": "dry-run",
  "warehouseId": "main",
  "itemCount": 55,
  "eventCount": 55,
  "occurredAt": "2026-01-01T00:00:00.000Z",
  "effectiveDate": "2026-01-01",
  "snapshotKey": "main::phase4-v1::2026-01-01",
  "inputPath": "/Users/celeste/.openclaw/workspace/ist-dispatch/tmp/warehouse-inventory-snapshot.json",
  "includesZeroItemSnapshot": false
}
```

### 4) Truck snapshot dry-run attempt
Command:
```bash
node scripts/backfill-truck-inventory-events.mjs --dry-run --sample 3 --project insulation-services-da91a
```
Outcome: failed before planning due to missing Firebase Admin ADC.
Hard blocker excerpt:
```text
Error: Could not load the default credentials.
```

### 5) Job usage dry-run
Command:
```bash
node scripts/backfill-job-usage-history.mjs --sample=20
```
Outcome summary:
```json
{
  "totalJobsScanned": 160,
  "totalEventsPlanned": 268,
  "skippedExistingCount": 0,
  "dailyLogEventCount": 157,
  "closeoutLeftoverEventCount": 111
}
```

### 6) Read-only verification of existing event counts
Command:
```bash
set -a && source .env.local && set +a && node --input-type=module -e 'import { initializeApp } from "firebase/app"; import { getFirestore, collection, getDocs, query, where } from "firebase/firestore"; const app=initializeApp({apiKey:process.env.VITE_FB_API_KEY,authDomain:process.env.VITE_FB_AUTH_DOMAIN,projectId:process.env.VITE_FB_PROJECT_ID,storageBucket:process.env.VITE_FB_STORAGE_BUCKET,messagingSenderId:process.env.VITE_FB_MESSAGING_ID,appId:process.env.VITE_FB_APP_ID}); const db=getFirestore(app); for (const t of ["warehouse.snapshot","truck.snapshot","job.usage"]) { const snap=await getDocs(query(collection(db,"inventoryEvents"), where("eventType","==",t))); console.log(`${t} ${snap.size}`); }'
```
Outcome:
```text
warehouse.snapshot 0
truck.snapshot 0
job.usage 268
```

## Event counts observed
- Warehouse snapshot export rows: 55
- Warehouse snapshot dry-run planned: 55
- Truck snapshot dry-run planned: blocked before count
- Job usage dry-run planned: 268
- Existing Firestore event counts: `warehouse.snapshot=0`, `truck.snapshot=0`, `job.usage=268`

## Hard blockers
1. No Admin credential available via `GOOGLE_APPLICATION_CREDENTIALS` or ADC, so truck snapshot backfill cannot run here.
2. Same missing Admin credential blocks any real warehouse snapshot write.
3. Job usage already appears written in Firestore (`job.usage=268`), so applying again was not the safest next step.

## Final action taken
- Stopped at dry-runs / read-only verification.
- Performed no write-phase backfill.
