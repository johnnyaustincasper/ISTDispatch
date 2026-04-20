import fs from 'node:fs/promises';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { deriveTruckInventoryFromEvents, getWarehouseInventoryParityReport, getJobUsageParityReport } from '../src/inventoryEvents.js';

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
const [inventorySnap, truckInventorySnap, jobsSnap, inventoryEventsSnap, trucksSnap, truckSnapshotSnap] = await Promise.all([
  getDocs(collection(db, 'inventory')),
  getDocs(collection(db, 'truckInventory')),
  getDocs(collection(db, 'jobs')),
  getDocs(collection(db, 'inventoryEvents')),
  getDocs(collection(db, 'trucks')).catch(() => ({ docs: [] })),
  getDocs(query(collection(db, 'inventoryEvents'), where('eventType', '==', 'truck.snapshot'))),
]);
const inventory = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() }));
const truckInventory = Object.fromEntries(truckInventorySnap.docs.map(d => [d.id, d.data()]));
const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const inventoryEvents = inventoryEventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const trucks = trucksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const truckSnapshotEvents = truckSnapshotSnap.docs.map(d => ({ id: d.id, ...d.data() }));

const derivedTruckInventory = deriveTruckInventoryFromEvents(truckInventory, inventoryEvents);
const warehouseParity = getWarehouseInventoryParityReport({ legacyInventory: inventory, events: inventoryEvents, warehouseId: 'main' });
const jobUsageParity = getJobUsageParityReport(jobs, inventoryEvents);

const truckRows = [...new Set([...Object.keys(truckInventory), ...Object.keys(derivedTruckInventory), ...trucks.map(t => t.id).filter(Boolean)])].map((truckId) => {
  const legacy = truckInventory[truckId] || {};
  const derived = derivedTruckInventory[truckId] || {};
  const itemIds = [...new Set([...Object.keys(legacy), ...Object.keys(derived)])];
  const mismatches = itemIds.map((itemId) => {
    const legacyQty = Math.round((parseFloat(legacy[itemId]) || 0) * 1000) / 1000;
    const eventQty = Math.round((parseFloat(derived[itemId]) || 0) * 1000) / 1000;
    const delta = Math.round((eventQty - legacyQty) * 1000) / 1000;
    if (Math.abs(delta) <= 0.001) return null;
    return { itemId, legacyQty, eventQty, delta };
  }).filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const relatedSnapshots = truckSnapshotEvents.filter((e) => e.location?.truckId === truckId).map((e) => ({ id: e.id, itemId: e.item?.itemId, after: e.quantity?.after, snapshotKey: e.refs?.snapshotKey }));
  return {
    truckId,
    truckName: trucks.find(t => t.id === truckId)?.vehicleName || trucks.find(t => t.id === truckId)?.members || trucks.find(t => t.id === truckId)?.name || truckId,
    matches: mismatches.length === 0,
    mismatchCount: mismatches.length,
    totalAbsDelta: Math.round(mismatches.reduce((s, m) => s + Math.abs(m.delta), 0) * 1000) / 1000,
    topMismatches: mismatches.slice(0, 10),
    snapshotEvents: relatedSnapshots,
  };
}).sort((a, b) => b.mismatchCount - a.mismatchCount || b.totalAbsDelta - a.totalAbsDelta || a.truckName.localeCompare(b.truckName));

const closedOutJobs = jobs.filter((j) => j.closedOut);
const mismatchedClosedOutJobs = jobUsageParity.filter((row) => {
  const job = closedOutJobs.find((j) => j.id === row.jobId);
  return job && !row.isAligned;
}).sort((a, b) => b.vsEffectiveLegacy.totalDelta - a.vsEffectiveLegacy.totalDelta);

console.log(JSON.stringify({
  counts: {
    inventoryRows: inventory.length,
    truckDocs: Object.keys(truckInventory).length,
    trucks: trucks.length,
    jobs: jobs.length,
    closedOutJobs: closedOutJobs.length,
    inventoryEvents: inventoryEvents.length,
    truckSnapshotEvents: truckSnapshotEvents.length,
  },
  warehouseParity: {
    matches: warehouseParity.matches,
    mismatchedItemCount: warehouseParity.mismatchedItemCount,
    warehouseSnapshotCount: warehouseParity.warehouseSnapshotCount,
    latestWarehouseSnapshotAt: warehouseParity.latestWarehouseSnapshotAt,
    topMismatches: warehouseParity.mismatches.slice(0, 10),
  },
  truckParity: truckRows,
  jobUsageParitySummary: {
    checkedClosedOutCount: closedOutJobs.length,
    mismatchedClosedOutCount: mismatchedClosedOutJobs.length,
    top: mismatchedClosedOutJobs.slice(0, 10).map((row) => ({
      jobId: row.jobId,
      mismatchCount: row.vsEffectiveLegacy.mismatchCount,
      totalDelta: row.vsEffectiveLegacy.totalDelta,
      mismatches: row.vsEffectiveLegacy.mismatches.slice(0, 5),
    })),
  },
  truckSnapshotEvents: truckSnapshotEvents.map((e) => ({ id: e.id, truckId: e.location?.truckId, itemId: e.item?.itemId, after: e.quantity?.after, snapshotKey: e.refs?.snapshotKey })).sort((a, b) => (a.truckId || '').localeCompare(b.truckId || '') || (a.itemId || '').localeCompare(b.itemId || '')),
}, null, 2));
