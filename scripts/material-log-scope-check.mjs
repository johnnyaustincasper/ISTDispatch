const findDailyMaterialLogForTruck = (job, date, truckId = null) => {
  const logs = job?.dailyMaterialLogs || [];
  if (!date) return null;
  if (truckId) {
    const exactMatch = logs.find((log) => log.date === date && log.truckId === truckId);
    if (exactMatch) return exactMatch;
    const assignedTruckId = job?.truckId || null;
    if (assignedTruckId && assignedTruckId === truckId) {
      return logs.find((log) => log.date === date && !log.truckId) || null;
    }
    return null;
  }
  return logs.find((log) => log.date === date) || null;
};

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const job = {
  truckId: 'truck-a',
  dailyMaterialLogs: [
    { date: '2026-04-16', materials: { r13_15_8_t: 5 }, loggedBy: 'Truck A legacy' },
    { date: '2026-04-15', truckId: 'truck-b', materials: { r13_15_8_t: 2 }, loggedBy: 'Truck B' },
  ],
};

assert(findDailyMaterialLogForTruck(job, '2026-04-16', 'truck-a')?.loggedBy === 'Truck A legacy', 'assigned truck should still see its legacy same-day log');
assert(findDailyMaterialLogForTruck(job, '2026-04-16', 'truck-b') === null, 'other truck must not inherit legacy same-day log');
assert(findDailyMaterialLogForTruck(job, '2026-04-15', 'truck-b')?.loggedBy === 'Truck B', 'exact truck match should still work');

console.log('material log scope checks passed');
