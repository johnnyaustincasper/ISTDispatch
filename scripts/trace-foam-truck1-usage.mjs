import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBvL6M_2kPGt8XrcgpPHfL-bwU9BAH57Qk',
  authDomain: 'insulation-services-da91a.firebaseapp.com',
  projectId: 'insulation-services-da91a',
  storageBucket: 'insulation-services-da91a.firebasestorage.app',
  messagingSenderId: '761459419108',
  appId: '1:761459419108:web:25235ad8b067eddb96c9f1',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const truckId = 'seW7evSZ2aafka9t1BiR';
const now = new Date('2026-04-22T14:20:00-05:00');
const start = new Date(now);
start.setDate(start.getDate() - 29);

const cstDate = (value) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const today = cstDate(now);
const startStr = cstDate(start);
const normalizeTruckId = (value) => value || null;
const materialLogMatchesTruck = (log, targetTruckId) => normalizeTruckId(log?.truckId) === normalizeTruckId(targetTruckId);
const getLegacyJobTruckFallbackId = (job = {}) => normalizeTruckId(job?.truckId ?? null);
const getLegacyMaterialLogTruckId = (log = {}, job = {}) => normalizeTruckId(log?.truckId ?? null) || getLegacyJobTruckFallbackId(job);
const findDailyMaterialLog = (logs, date, targetTruckId, job = null) => {
  const entries = (logs || []).filter((log) => log.date === date);
  return entries.find((log) => materialLogMatchesTruck(log, targetTruckId))
    || (entries.length === 1
      && !entries[0]?.truckId
      && materialLogMatchesTruck({ truckId: getLegacyMaterialLogTruckId(entries[0], job || {}) }, targetTruckId)
      ? entries[0]
      : null);
};
const getTruckAwareDailyMaterialLogs = (logs, targetTruckId) => {
  const dates = [...new Set((logs || []).map((log) => log.date))].sort();
  return dates.map((date) => findDailyMaterialLog(logs, date, targetTruckId)).filter(Boolean);
};
const getMaterialLogTruckAttribution = (logs = []) => {
  const truckIds = new Set();
  let hasTrucklessLogs = false;
  (logs || []).forEach((log) => {
    const hasMaterials = Object.values(log?.materials || {}).some((qty) => (parseFloat(qty) || 0) > 0);
    if (!hasMaterials) return;
    const normalizedTruckId = normalizeTruckId(log?.truckId);
    if (normalizedTruckId) truckIds.add(normalizedTruckId);
    else hasTrucklessLogs = true;
  });
  return {
    truckIds: [...truckIds],
    hasTrucklessLogs,
    isMixedTruck: truckIds.size > 1,
    isAmbiguous: hasTrucklessLogs || truckIds.size > 1,
  };
};
const getCloseoutAttributionTruckId = (jobLike = {}, fallbackTruckId = null) => {
  const explicitCloseoutTruckId = normalizeTruckId(jobLike?.closeoutTruckId ?? null);
  if (explicitCloseoutTruckId) return explicitCloseoutTruckId;
  const attribution = getMaterialLogTruckAttribution(jobLike?.dailyMaterialLogs || []);
  if (attribution.isAmbiguous) return null;
  if (attribution.truckIds.length === 1) return attribution.truckIds[0];
  return normalizeTruckId(fallbackTruckId ?? null);
};

const snap = await getDocs(collection(db, 'jobs'));
const results = [];
const totals = {};

snap.forEach((docSnap) => {
  const job = { id: docSnap.id, ...docSnap.data() };
  const dailyLogs = getTruckAwareDailyMaterialLogs(job?.dailyMaterialLogs || [], truckId);
  dailyLogs.forEach((log) => {
    if (log?.date < startStr || log?.date > today) return;
    Object.entries(log?.materials || {}).forEach(([itemId, qty]) => {
      totals[itemId] = (totals[itemId] || 0) + (parseFloat(qty) || 0);
    });
    results.push({
      type: 'daily',
      jobId: job.id,
      name: job.customerName || job.name || job.address || 'Unknown',
      date: log.date,
      truckId: log.truckId || null,
      materials: log.materials || {},
    });
  });

  const closeoutTruckId = getCloseoutAttributionTruckId(job, job?.truckId ?? null);
  if (job?.closedOut && job?.materialsUsed && closeoutTruckId === truckId && job?.closedAt) {
    const dailyLoggedTotals = {};
    (job.dailyMaterialLogs || []).forEach((log) => {
      Object.entries(log?.materials || {}).forEach(([itemId, qty]) => {
        dailyLoggedTotals[itemId] = (dailyLoggedTotals[itemId] || 0) + (parseFloat(qty) || 0);
      });
    });
    const residualMaterials = {};
    Object.entries(job.materialsUsed || {}).forEach(([itemId, qty]) => {
      const residualQty = Math.max(0, (parseFloat(qty) || 0) - (dailyLoggedTotals[itemId] || 0));
      if (residualQty > 0) residualMaterials[itemId] = residualQty;
    });
    const date = cstDate(job.closedAt);
    if (date >= startStr && date <= today && Object.keys(residualMaterials).length) {
      Object.entries(residualMaterials).forEach(([itemId, qty]) => {
        totals[itemId] = (totals[itemId] || 0) + (parseFloat(qty) || 0);
      });
      results.push({
        type: 'closeoutResidual',
        jobId: job.id,
        name: job.customerName || job.name || job.address || 'Unknown',
        date,
        truckId: closeoutTruckId,
        materials: residualMaterials,
      });
    }
  }
});

results.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.name).localeCompare(String(b.name))));
console.log(JSON.stringify({ startStr, today, totals, count: results.length, results }, null, 2));
