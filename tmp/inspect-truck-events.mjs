import fs from 'node:fs/promises';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const raw = await fs.readFile(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(raw.split(/\r?\n/).map((line) => {
  const m = line.match(/^([^=]+)=(.*)$/);
  return m ? [m[1], m[2].replace(/^"|"$/g, '')] : null;
}).filter(Boolean));

const app = initializeApp({
  apiKey: env.VITE_FB_API_KEY,
  authDomain: env.VITE_FB_AUTH_DOMAIN,
  projectId: env.VITE_FB_PROJECT_ID,
  storageBucket: env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FB_MESSAGING_ID,
  appId: env.VITE_FB_APP_ID,
});
const db = getFirestore(app);
const ids = process.argv.slice(2);
const snap = await getDocs(collection(db, 'inventoryEvents'));
const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
for (const truckId of ids) {
  console.log(`\n=== ${truckId} ===`);
  rows
    .filter((r) => r.location?.truckId === truckId)
    .sort((a, b) => String(a.occurredAt || '').localeCompare(String(b.occurredAt || '')) || String(a.id).localeCompare(String(b.id)))
    .forEach((r) => {
      console.log(JSON.stringify({
        id: r.id,
        eventType: r.eventType,
        occurredAt: r.occurredAt,
        itemId: r.item?.itemId,
        delta: r.quantity?.delta,
        after: r.quantity?.after,
        jobId: r.location?.jobId,
        correlationKey: r.refs?.correlationKey,
        snapshotKey: r.refs?.snapshotKey,
        legacyLogType: r.refs?.legacyLogType,
        meta: r.metadata?.backfillSource || r.metadata?.eventKind || null,
      }));
    });
}
