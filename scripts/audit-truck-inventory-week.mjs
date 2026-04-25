import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FB_API_KEY,
  authDomain: process.env.VITE_FB_AUTH_DOMAIN,
  projectId: process.env.VITE_FB_PROJECT_ID,
  storageBucket: process.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FB_MESSAGING_ID,
  appId: process.env.VITE_FB_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const ts = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const toDateKey = (d) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  if (!x || Number.isNaN(x.getTime())) return null;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const startOfWeek = (base = new Date()) => {
  const d = new Date(base);
  d.setHours(0,0,0,0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};
const itemName = (id) => id;

const [inventorySnap, loadLogSnap, returnLogSnap, truckInvSnap, jobsSnap, trucksSnap] = await Promise.all([
  getDocs(collection(db, 'inventory')),
  getDocs(collection(db, 'loadLog')),
  getDocs(collection(db, 'returnLog')),
  getDocs(collection(db, 'truckInventory')),
  getDocs(collection(db, 'jobs')),
  getDocs(collection(db, 'trucks')),
]);

const inventory = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() }));
const loadLog = loadLogSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const returnLog = returnLogSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const truckInventory = Object.fromEntries(truckInvSnap.docs.map(d => [d.id, d.data()]));
const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const trucks = Object.fromEntries(trucksSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));

const weekStart = startOfWeek(new Date());
const weekStartKey = toDateKey(weekStart);

const sumItems = (rows) => {
  const totals = {};
  for (const row of rows) {
    for (const [id, qty] of Object.entries(row.items || {})) {
      totals[id] = round((totals[id] || 0) + (parseFloat(qty) || 0));
    }
  }
  return totals;
};

const weekLoads = loadLog.filter(r => {
  const d = ts(r.timestamp);
  return d && d >= weekStart;
});
const weekReturns = returnLog.filter(r => {
  const d = ts(r.timestamp);
  return d && d >= weekStart;
});

const usageByTruck = {};
for (const job of jobs) {
  const logs = Array.isArray(job.dailyMaterialLogs) ? job.dailyMaterialLogs : [];
  for (const log of logs) {
    if (!log?.date || log.date < weekStartKey) continue;
    const truckId = log.truckId || job.truckId || 'unassigned';
    usageByTruck[truckId] ||= {};
    for (const [id, qty] of Object.entries(log.materials || {})) {
      usageByTruck[truckId][id] = round((usageByTruck[truckId][id] || 0) + (parseFloat(qty) || 0));
    }
  }
}

const currentWarehouse = Object.fromEntries(inventory.map(r => [r.itemId, round(r.qty || 0)]));

const byTruckLoads = {};
for (const row of weekLoads) {
  byTruckLoads[row.truckId || 'unassigned'] ||= [];
  byTruckLoads[row.truckId || 'unassigned'].push(row);
}
const byTruckReturns = {};
for (const row of weekReturns) {
  byTruckReturns[row.truckId || 'unassigned'] ||= [];
  byTruckReturns[row.truckId || 'unassigned'].push(row);
}

const truckIds = [...new Set([...Object.keys(byTruckLoads), ...Object.keys(byTruckReturns), ...Object.keys(usageByTruck), ...Object.keys(truckInventory)])];

const perTruck = truckIds.map(truckId => {
  const loaded = sumItems(byTruckLoads[truckId] || []);
  const returned = sumItems(byTruckReturns[truckId] || []);
  const used = usageByTruck[truckId] || {};
  const current = truckInventory[truckId] || {};
  const allItems = [...new Set([...Object.keys(loaded), ...Object.keys(returned), ...Object.keys(used), ...Object.keys(current)])];
  const deltas = allItems.map(id => ({
    itemId: id,
    loaded: round(loaded[id] || 0),
    returned: round(returned[id] || 0),
    used: round(used[id] || 0),
    expectedRemainingFromWeekFlow: round((loaded[id] || 0) - (returned[id] || 0) - (used[id] || 0)),
    currentTruckQty: round(current[id] || 0),
    variance: round((current[id] || 0) - ((loaded[id] || 0) - (returned[id] || 0) - (used[id] || 0))),
  })).filter(r => r.loaded || r.returned || r.used || r.currentTruckQty);
  return {
    truckId,
    truckName: trucks[truckId]?.name || trucks[truckId]?.vehicleName || trucks[truckId]?.members || truckId,
    rows: deltas,
  };
});

const startedWithEstimate = {};
for (const [id, qty] of Object.entries(currentWarehouse)) startedWithEstimate[id] = round(qty);
for (const row of weekLoads) for (const [id, qty] of Object.entries(row.items || {})) startedWithEstimate[id] = round((startedWithEstimate[id] || 0) + (parseFloat(qty) || 0));
for (const row of weekReturns) for (const [id, qty] of Object.entries(row.items || {})) startedWithEstimate[id] = round((startedWithEstimate[id] || 0) - (parseFloat(qty) || 0));

const weekTaken = sumItems(weekLoads);
const weekPutBack = sumItems(weekReturns);

console.log(JSON.stringify({
  weekStart: weekStartKey,
  warehouse: {
    startedWithEstimate,
    current: currentWarehouse,
    takenThisWeek: weekTaken,
    putBackThisWeek: weekPutBack,
  },
  perTruck,
}, null, 2));
