const normalizeMaterialLogTruckId = (truckId) => truckId || null;

const tsToCST = (ts) => {
  try {
    return new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  } catch {
    return null;
  }
};

const normalizeName = (value) => String(value || "").trim().toLowerCase();

export const resolveMaterialLogTruckIdForEdit = ({
  log = {},
  job = {},
  updates = [],
  fallbackTruckId = null,
} = {}) => {
  const explicitLogTruckId = normalizeMaterialLogTruckId(log?.truckId ?? log?.sourceTruckId ?? null);
  if (explicitLogTruckId) return explicitLogTruckId;

  const loggedBy = normalizeName(log?.loggedBy || log?.crewName || log?.submittedBy);
  const logDate = log?.date || null;
  const jobId = job?.id || log?.jobId || null;

  const matchingUpdate = (updates || [])
    .filter((update) => {
      if (jobId && update?.jobId && update.jobId !== jobId) return false;
      if (logDate && update?.timestamp && tsToCST(update.timestamp) !== logDate) return false;
      if (loggedBy) {
        const updateNames = [update?.crewName, update?.submittedBy, update?.loggedBy].map(normalizeName);
        if (!updateNames.includes(loggedBy)) return false;
      }
      return normalizeMaterialLogTruckId(update?.truckId ?? null);
    })
    .sort((a, b) => String(b?.timestamp || "").localeCompare(String(a?.timestamp || "")))[0];

  return normalizeMaterialLogTruckId(
    matchingUpdate?.truckId
      ?? fallbackTruckId
      ?? job?.truckId
      ?? null,
  );
};

export const buildEditableMaterialItems = ({
  inventoryItems = [],
  existingMaterials = {},
  truckInventory = {},
} = {}) => inventoryItems.filter((item) => {
  if (item?.isPieces) return false;
  if ((existingMaterials?.[item.id] || 0) > 0) return true;
  if ((truckInventory?.[item.id] || 0) > 0) return true;
  if (!item?.hasPieces) return false;
  const piecesItem = inventoryItems.find((candidate) => candidate?.parentId === item.id);
  return (existingMaterials?.[piecesItem?.id] || 0) > 0
    || (truckInventory?.[piecesItem?.id] || 0) > 0;
});
