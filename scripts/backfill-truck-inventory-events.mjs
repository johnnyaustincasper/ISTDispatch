import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { initializeApp as initializeWebApp } from "firebase/app";
import { getFirestore as getWebFirestore, collection as webCollection, getDocs, serverTimestamp, writeBatch, doc as webDoc } from "firebase/firestore";

const adminRequire = createRequire(new URL("../functions/package.json", import.meta.url));
const { initializeApp, applicationDefault, cert } = adminRequire("firebase-admin/app");
const { FieldValue, getFirestore } = adminRequire("firebase-admin/firestore");
import {
  TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT,
  TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE,
  buildTruckInventoryBackfillPlan,
  buildTruckInventoryBackfillWriteEntries,
} from "../src/inventoryBackfill.js";

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getFlagValue = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

const showHelp = hasFlag("--help") || hasFlag("-h");
if (showHelp) {
  console.log(`Usage: node scripts/backfill-truck-inventory-events.mjs [options]

Options:
  --truck <id>         Only backfill one truck
  --write              Persist merge-safe writes to inventoryEvents
  --dry-run            Preview only (default)
  --sample <n>         Number of event ids to print per truck (default: 3)
  --project <id>       Firebase project id override
  --service-account <path>  Service account JSON path (optional)
  --web-sdk            Use the Firebase web SDK instead of Admin credentials
  --help               Show this help

Notes:
- Baseline occurredAt defaults to ${TRUCK_INVENTORY_BACKFILL_BASELINE_OCCURRED_AT}
- effectiveDate defaults to ${TRUCK_INVENTORY_BACKFILL_EFFECTIVE_DATE}
- Writes use deterministic ids and merge semantics, so reruns are idempotent.
`);
  process.exit(0);
}

const dryRun = !hasFlag("--write") || hasFlag("--dry-run");
const useWebSdk = hasFlag("--web-sdk");
const selectedTruckId = getFlagValue("--truck");
const sampleSize = Math.max(1, parseInt(getFlagValue("--sample") || "3", 10) || 3);
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

let truckInventoryByTruckId = {};
let trucks = [];
let adminDb = null;
let webDb = null;

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
  webDb = getWebFirestore(app);
  const [truckInventorySnap, trucksSnap] = await Promise.all([
    getDocs(webCollection(webDb, "truckInventory")),
    getDocs(webCollection(webDb, "trucks")).catch(() => ({ docs: [] })),
  ]);
  truckInventorySnap.forEach((docSnap) => {
    truckInventoryByTruckId[docSnap.id] = docSnap.data() || {};
  });
  trucks = (trucksSnap.docs || []).map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
} else {
  const app = initializeApp({
    credential: await loadCredential(),
    ...(projectId ? { projectId } : {}),
  });
  adminDb = getFirestore(app);

  const [truckInventorySnap, trucksSnap] = await Promise.all([
    adminDb.collection("truckInventory").get(),
    adminDb.collection("trucks").get().catch(() => ({ docs: [] })),
  ]);

  truckInventorySnap.forEach((doc) => {
    truckInventoryByTruckId[doc.id] = doc.data() || {};
  });
  trucks = (trucksSnap.docs || []).map((doc) => ({ id: doc.id, ...doc.data() }));
}

const plan = buildTruckInventoryBackfillPlan({
  truckInventoryByTruckId,
  trucks,
  selectedTruckId,
});

const summary = {
  mode: dryRun ? "dry-run" : "write",
  truckCount: plan.truckCount,
  eventCount: plan.eventCount,
  skippedCount: plan.skippedCount,
  occurredAt: plan.occurredAt,
  effectiveDate: plan.effectiveDate,
  selectedTruckId: plan.selectedTruckId,
};

console.log(JSON.stringify(summary, null, 2));
plan.trucks.forEach((truck) => {
  console.log(JSON.stringify({
    truckId: truck.truckId,
    truckName: truck.truckName,
    itemCount: truck.itemCount,
    eventCount: truck.eventCount,
    snapshotKey: truck.snapshotKey,
    sampleEventIds: truck.sampleEventIds.slice(0, sampleSize),
    includesZeroItemSnapshot: truck.includesZeroItemSnapshot,
  }, null, 2));
});
if (plan.skipped.length > 0) {
  console.log(JSON.stringify({ skipped: plan.skipped }, null, 2));
}

if (dryRun || plan.eventCount === 0) {
  process.exit(0);
}

let batchCount = 0;
const maxBatchSize = 400;
let entries = [];

if (useWebSdk) {
  entries = buildTruckInventoryBackfillWriteEntries(plan, {
    createdAtValue: serverTimestamp(),
  });

  let batch = writeBatch(webDb);
  let writesInBatch = 0;
  for (const entry of entries) {
    const ref = webDoc(webCollection(webDb, entry.collectionName), entry.eventId);
    batch.set(ref, entry.payload, { merge: true });
    writesInBatch += 1;
    if (writesInBatch === maxBatchSize) {
      await batch.commit();
      batchCount += 1;
      batch = writeBatch(webDb);
      writesInBatch = 0;
    }
  }
  if (writesInBatch > 0) {
    await batch.commit();
    batchCount += 1;
  }
} else {
  entries = buildTruckInventoryBackfillWriteEntries(plan, {
    createdAtValue: FieldValue.serverTimestamp(),
  });

  let batch = adminDb.batch();
  let writesInBatch = 0;
  for (const entry of entries) {
    const ref = adminDb.collection(entry.collectionName).doc(entry.eventId);
    batch.set(ref, entry.payload, { merge: true });
    writesInBatch += 1;
    if (writesInBatch === maxBatchSize) {
      await batch.commit();
      batchCount += 1;
      batch = adminDb.batch();
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
