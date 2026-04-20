# Phase 4 backfill runbook

Repo: `/Users/celeste/.openclaw/workspace/ist-dispatch`

## Recommendation

Safest execution order today:

1. Export a point-in-time warehouse inventory JSON snapshot.
2. Dry-run warehouse snapshot backfill.
3. Dry-run truck snapshot backfill.
4. Dry-run job usage backfill.
5. Write warehouse snapshot backfill.
6. Write truck snapshot backfill.
7. Write job usage backfill.
8. Verify event counts and parity.

Reason: the code and rollout doc both assume baseline snapshots first, then replay usage after the baseline date.

## Preconditions

### Required before any writes

- From repo root: `cd /Users/celeste/.openclaw/workspace/ist-dispatch`
- Inventory event tests pass:
  - `npm run test:inventory-events`
- `inventoryEvents` is still empty, or you explicitly want a rerun.
- You have Firebase Admin credentials for the warehouse/truck scripts.
  - These scripts currently fail here without Admin auth/project resolution.
  - Use either:
    - `--service-account /absolute/path/to/service-account.json`, or
    - `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json`
- You have a warehouse inventory export file. The warehouse script does **not** read Firestore directly.

### Confirmed blockers found in repo today

1. `scripts/backfill-truck-inventory-events.mjs` cannot dry-run here without Firebase Admin credentials.
2. `scripts/backfill-warehouse-inventory.mjs` requires `--input <path>` and no export file is checked into the repo.
3. `scripts/backfill-job-usage-history.mjs` uses `--apply`, not `--write`.

## Read-only checks already observed

- `npm run test:inventory-events` passes.
- `inventory` currently has 55 docs.
- `inventoryEvents` currently has 0 `warehouse.snapshot`, 0 `truck.snapshot`, 0 `job.usage` docs.
- Job usage dry-run currently plans 268 events:
  - 157 from legacy daily logs
  - 111 closeout leftovers

## Exact commands

### 0. Optional safety branch

```bash
git checkout -b phase4-backfill-run-$(date +%Y%m%d-%H%M)
```

### 1. Export warehouse inventory snapshot to JSON

This creates the input file the warehouse script needs.

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
mkdir -p tmp
set -a && source .env.local && set +a
node --input-type=module -e 'import fs from "node:fs/promises"; import { initializeApp } from "firebase/app"; import { getFirestore, collection, getDocs } from "firebase/firestore"; const app=initializeApp({apiKey:process.env.VITE_FB_API_KEY,authDomain:process.env.VITE_FB_AUTH_DOMAIN,projectId:process.env.VITE_FB_PROJECT_ID,storageBucket:process.env.VITE_FB_STORAGE_BUCKET,messagingSenderId:process.env.VITE_FB_MESSAGING_ID,appId:process.env.VITE_FB_APP_ID}); const db=getFirestore(app); const snap=await getDocs(collection(db,"inventory")); const rows=snap.docs.map(d=>({id:d.id,...d.data()})); await fs.writeFile("tmp/warehouse-inventory-snapshot.json", JSON.stringify(rows,null,2)); console.log(JSON.stringify({wrote:"tmp/warehouse-inventory-snapshot.json",count:rows.length},null,2));'
```

### 2. Dry-run warehouse snapshot backfill

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-warehouse-inventory.mjs \
  --input tmp/warehouse-inventory-snapshot.json \
  --warehouse main \
  --dry-run \
  --project insulation-services-da91a \
  --service-account /absolute/path/to/service-account.json
```

Expected: summary JSON with `itemCount`, `eventCount`, `snapshotKey`, and sample ids.

### 3. Dry-run truck snapshot backfill

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-truck-inventory-events.mjs \
  --dry-run \
  --sample 3 \
  --project insulation-services-da91a \
  --service-account /absolute/path/to/service-account.json
```

Optional single-truck smoke test first:

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-truck-inventory-events.mjs \
  --dry-run \
  --truck TRUCK_ID \
  --sample 3 \
  --project insulation-services-da91a \
  --service-account /absolute/path/to/service-account.json
```

### 4. Dry-run job usage backfill

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-job-usage-history.mjs --sample=20
```

Optional verbose pass:

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-job-usage-history.mjs --sample=20 --verbose
```

### 5. Write warehouse snapshot backfill

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-warehouse-inventory.mjs \
  --input tmp/warehouse-inventory-snapshot.json \
  --warehouse main \
  --write \
  --project insulation-services-da91a \
  --service-account /absolute/path/to/service-account.json
```

### 6. Write truck snapshot backfill

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-truck-inventory-events.mjs \
  --write \
  --sample 3 \
  --project insulation-services-da91a \
  --service-account /absolute/path/to/service-account.json
```

### 7. Write job usage backfill

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
node scripts/backfill-job-usage-history.mjs --apply --sample=20
```

## Verification

### Event counts by type

```bash
cd /Users/celeste/.openclaw/workspace/ist-dispatch
set -a && source .env.local && set +a
node --input-type=module -e 'import { initializeApp } from "firebase/app"; import { getFirestore, collection, getDocs, query, where } from "firebase/firestore"; const app=initializeApp({apiKey:process.env.VITE_FB_API_KEY,authDomain:process.env.VITE_FB_AUTH_DOMAIN,projectId:process.env.VITE_FB_PROJECT_ID,storageBucket:process.env.VITE_FB_STORAGE_BUCKET,messagingSenderId:process.env.VITE_FB_MESSAGING_ID,appId:process.env.VITE_FB_APP_ID}); const db=getFirestore(app); for (const t of ["warehouse.snapshot","truck.snapshot","job.usage"]) { const snap=await getDocs(query(collection(db,"inventoryEvents"), where("eventType","==",t))); console.log(`${t} ${snap.size}`); }'
```

### Spot-check expected outcomes

- `warehouse.snapshot` count should match warehouse dry-run `eventCount`.
- `truck.snapshot` count should match truck dry-run `eventCount`.
- `job.usage` count should match job dry-run `totalEventsPlanned`.
- Re-running the same scripts should be idempotent because ids are deterministic and writes use merge semantics.

## Rollback / containment

There is no dedicated rollback script in repo.

Safest rollback options:

1. **Stop after any suspicious dry-run**, do not write.
2. If a write is wrong, delete only the docs created by that phase using their deterministic ids from the dry-run output or by filtering on:
   - `writeMeta.source`
   - `metadata.backfill === true`
   - phase-specific `metadata.backfillScope` / `metadata.backfillSource`
3. Preserve `tmp/warehouse-inventory-snapshot.json` and the dry-run console output so the exact affected ids can be reconstructed.

## Final go/no-go

### Go

- Tests pass
- Admin service account path is available
- Warehouse export file exists
- Dry-runs look sane
- `inventoryEvents` is still empty or rerun is intentional

### No-go

- No Admin credential for warehouse/truck scripts
- No warehouse input snapshot file
- Dry-run counts look unexpectedly high/low
- You are not prepared to surgically delete wrong backfill docs if needed
