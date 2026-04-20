import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { initializeApp as initializeWebApp } from "firebase/app";
import { getFirestore as getWebFirestore, collection as webCollection, doc as webDoc, serverTimestamp, writeBatch } from "firebase/firestore";

const adminRequire = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, applicationDefault, cert } = adminRequire("firebase-admin/app");
const { FieldValue, getFirestore } = adminRequire("firebase-admin/firestore");
import {
  WAREHOUSE_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
  WAREHOUSE_INVENTORY_BACKFILL_EFFECTIVE_DATE,
  buildWarehouseInventoryBackfillPlan,
  buildWarehouseInventoryBackfillWriteEntries,
} from "../src/inventoryBackfill.js";

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getFlagValue = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

const showHelp = hasFlag("--help") || hasFlag("-h");
if (showHelp) {
  console.log(`Usage: node scripts/backfill-warehouse-inventory.mjs [options]

Options:
  --input <path>       JSON file containing legacy inventory rows (array or { inventory: [] })
  --warehouse <id>     Warehouse id to tag in snapshot events (default: main)
  --write              Persist merge-safe writes to inventoryEvents
  --dry-run            Preview only (default)
  --sample <n>         Number of event ids to print (default: 5)
  --project <id>       Firebase project id override
  --service-account <path>  Service account JSON path (optional)
  --web-sdk            Use the Firebase web SDK instead of Admin credentials
  --help               Show this help

Notes:
- Baseline occurredAt defaults to ${WAREHOUSE_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT}
- effectiveDate defaults to ${WAREHOUSE_INVENTORY_BACKFILL_EFFECTIVE_DATE}
- Writes use deterministic ids and merge semantics, so reruns are idempotent.
`);
  process.exit(0);
}

const inputPath = getFlagValue("--input");
if (!inputPath) {
  console.error("Missing required --input <path>");
  process.exit(1);
}

const dryRun = !hasFlag("--write") || hasFlag("--dry-run");
const useWebSdk = hasFlag("--web-sdk");
const sampleSize = Math.max(1, parseInt(getFlagValue("--sample") || "5", 10) || 5);
const warehouseId = getFlagValue("--warehouse") || "main";
const projectId = getFlagValue("--project") || process.env.VITE_FB_PROJECT_ID || process.env.GCLOUD_PROJECT || undefined;
const serviceAccountPath = getFlagValue("--service-account") || null;

const loadCredential = async () => {
  if (!serviceAccountPath) return applicationDefault();
  const resolvedPath = path.resolve(process.cwd(), serviceAccountPath);
  const serviceAccount = JSON.parse(await fs.readFile(resolvedPath, "utf8"));
  return cert(serviceAccount);
};

const loadWebEnv = async () => {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const raw = await fs.readFile(envPath, "utf8");
  const env = {};
  raw.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (!match) return;
    env[match[1]] = match[2].replace(/^"|"$/g, "");
  });
  return env;
};

const resolvedInputPath = path.resolve(process.cwd(), inputPath);
const rawInput = JSON.parse(await fs.readFile(resolvedInputPath, "utf8"));
const inventory = Array.isArray(rawInput) ? rawInput : rawInput?.inventory;
if (!Array.isArray(inventory)) {
  throw new Error("Input file must contain a JSON array or an object with an inventory array");
}

const plan = buildWarehouseInventoryBackfillPlan({
  inventory,
  warehouseId,
});

console.log(JSON.stringify({
  mode: dryRun ? "dry-run" : "write",
  warehouseId: plan.warehouseId,
  itemCount: plan.itemCount,
  eventCount: plan.eventCount,
  occurredAt: plan.occurredAt,
  effectiveDate: plan.effectiveDate,
  snapshotKey: plan.snapshotKey,
  inputPath: resolvedInputPath,
  sampleEventIds: plan.sampleEventIds.slice(0, sampleSize),
  includesZeroItemSnapshot: plan.includesZeroItemSnapshot,
}, null, 2));

if (dryRun || plan.eventCount === 0) {
  process.exit(0);
}

let batchCount = 0;
const maxBatchSize = 400;
let entries = [];

if (useWebSdk) {
  const env = await loadWebEnv();
  const app = initializeWebApp({
    apiKey: process.env.VITE_FB_API_KEY || env.VITE_FB_API_KEY,
    authDomain: process.env.VITE_FB_AUTH_DOMAIN || env.VITE_FB_AUTH_DOMAIN,
    projectId: projectId || env.VITE_FB_PROJECT_ID,
    storageBucket: process.env.VITE_FB_STORAGE_BUCKET || env.VITE_FB_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FB_MESSAGING_ID || env.VITE_FB_MESSAGING_ID,
    appId: process.env.VITE_FB_APP_ID || env.VITE_FB_APP_ID,
  });
  const db = getWebFirestore(app);
  entries = buildWarehouseInventoryBackfillWriteEntries(plan, {
    createdAtValue: serverTimestamp(),
  });

  let batch = writeBatch(db);
  let writesInBatch = 0;
  for (const entry of entries) {
    const ref = webDoc(webCollection(db, entry.collectionName), entry.eventId);
    batch.set(ref, entry.payload, { merge: true });
    writesInBatch += 1;
    if (writesInBatch === maxBatchSize) {
      await batch.commit();
      batchCount += 1;
      batch = writeBatch(db);
      writesInBatch = 0;
    }
  }
  if (writesInBatch > 0) {
    await batch.commit();
    batchCount += 1;
  }
} else {
  const app = initializeApp({
    credential: await loadCredential(),
    ...(projectId ? { projectId } : {}),
  });
  const db = getFirestore(app);
  entries = buildWarehouseInventoryBackfillWriteEntries(plan, {
    createdAtValue: FieldValue.serverTimestamp(),
  });

  let batch = db.batch();
  let writesInBatch = 0;
  for (const entry of entries) {
    const ref = db.collection(entry.collectionName).doc(entry.eventId);
    batch.set(ref, entry.payload, { merge: true });
    writesInBatch += 1;
    if (writesInBatch === maxBatchSize) {
      await batch.commit();
      batchCount += 1;
      batch = db.batch();
      writesInBatch = 0;
    }
  }
  if (writesInBatch > 0) {
    await batch.commit();
    batchCount += 1;
  }
}

console.log(JSON.stringify({
  wrote: entries.length,
  batchesCommitted: batchCount,
  collectionName: plan.collectionName,
  merge: true,
}, null, 2));
