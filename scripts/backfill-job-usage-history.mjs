import process from "node:process";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, query, where } from "firebase/firestore";
import {
  buildCanonicalInventoryEventId,
  buildJobUsageBackfillPlan,
} from "../src/inventoryEvents.js";
import { writeInventoryEvents } from "../src/inventoryEventWrites.js";

const firebaseConfig = {
  apiKey: process.env.VITE_FB_API_KEY || "AIzaSyBvL6M_2kPGt8XrcgpPHfL-bwU9BAH57Qk",
  authDomain: process.env.VITE_FB_AUTH_DOMAIN || "insulation-services-da91a.firebaseapp.com",
  projectId: process.env.VITE_FB_PROJECT_ID || "insulation-services-da91a",
  storageBucket: process.env.VITE_FB_STORAGE_BUCKET || "insulation-services-da91a.firebasestorage.app",
  messagingSenderId: process.env.VITE_FB_MESSAGING_ID || "761459419108",
  appId: process.env.VITE_FB_APP_ID || "1:761459419108:web:25235ad8b067eddb96c9f1",
};

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const getFlagValue = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};

const showHelp = hasFlag("--help") || hasFlag("-h");
if (showHelp) {
  console.log(`Usage: node scripts/backfill-job-usage-history.mjs [options]

Options:
  --apply              Persist planned inventoryEvents writes
  --write              Alias for --apply
  --dry-run            Preview only (default)
  --verbose            Print skipped existing events sample
  --sample <n>         Number of planned/skipped events to print (default: 20)
  --help               Show this help

Notes:
- Reads jobs and existing job.usage inventoryEvents from Firestore using the web SDK config.
- Writes use deterministic ids, so reruns are idempotent.
`);
  process.exit(0);
}

const apply = hasFlag("--apply") || hasFlag("--write");
const dryRun = !apply || hasFlag("--dry-run");
const verbose = hasFlag("--verbose");
const sampleArg = getFlagValue("--sample") || args.find((arg) => arg.startsWith("--sample="))?.split("=")[1] || "20";
const sampleSize = Math.max(0, Number.parseInt(sampleArg, 10) || 20);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getAllDocs = async (ref) => (await getDocs(ref)).docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

const jobs = await getAllDocs(collection(db, "jobs"));
const existingJobUsageEvents = await getAllDocs(query(collection(db, "inventoryEvents"), where("eventType", "==", "job.usage")));

const plan = buildJobUsageBackfillPlan({
  jobs,
  existingEvents: existingJobUsageEvents,
  actor: { actorName: "Phase 4 backfill", actorRole: "system", source: "script" },
});

console.log("Job usage backfill plan summary:");
console.log(JSON.stringify(plan.summary, null, 2));

const sample = plan.events.slice(0, Math.max(0, sampleSize)).map((event) => ({
  eventId: buildCanonicalInventoryEventId(event),
  eventType: event.eventType,
  occurredAt: event.occurredAt,
  effectiveDate: event.effectiveDate,
  itemId: event.item?.itemId,
  truckId: event.location?.truckId,
  jobId: event.location?.jobId,
  correlationKey: event.refs?.correlationKey,
  backfillSource: event.metadata?.backfillSource,
  delta: event.quantity?.delta,
}));

console.log(`\nSample planned events (${sample.length}/${plan.events.length}):`);
console.log(JSON.stringify(sample, null, 2));

if (verbose && plan.skippedExisting.length > 0) {
  console.log(`\nSkipped existing events (${plan.skippedExisting.length}):`);
  console.log(JSON.stringify(plan.skippedExisting.slice(0, sampleSize), null, 2));
}

if (dryRun) {
  console.log("\nDry run only. Re-run with --apply (or --write) to write planned events.");
  process.exit(0);
}

if (plan.events.length === 0) {
  console.log("\nNothing to write.");
  process.exit(0);
}

const writtenIds = await writeInventoryEvents(db, plan.events, {
  writeSource: "phase4-job-usage-backfill",
});

console.log(`\nWrote ${writtenIds.length} inventoryEvents.`);
