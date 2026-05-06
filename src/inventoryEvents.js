export const INVENTORY_EVENT_SCHEMA_VERSION = 1;

export const INVENTORY_EVENT_TYPES = {
  warehouseAdjustment: "warehouse.adjustment",
  warehouseSnapshot: "warehouse.snapshot",
  truckTransfer: "truck.transfer",
  truckSnapshot: "truck.snapshot",
  jobUsage: "job.usage",
  reconciliation: "inventory.reconciliation",
};

const roundQty = (value) => Math.round((parseFloat(value) || 0) * 1000) / 1000;
const STREET_ABBREVIATION_ALIASES = {
  street: "st",
  avenue: "ave",
  road: "rd",
  drive: "dr",
  lane: "ln",
  court: "ct",
  circle: "cir",
  boulevard: "blvd",
  place: "pl",
  terrace: "ter",
  parkway: "pkwy",
  highway: "hwy",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
  apartment: "apt",
  unit: "unit",
  suite: "ste",
};
const canonicalizeInventoryItemKey = (itemId) => {
  if (itemId === undefined || itemId === null) return null;
  return `${itemId}`
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_") || null;
};
const INVENTORY_ITEM_ID_ALIASES = {
  ambit_oc_a: "oc_a",
  ambit_oc_b: "oc_b",
  ambit_cc_a: "cc_a",
  ambit_cc_b: "cc_b",
  ambit_open_cell_a: "oc_a",
  ambit_open_cell_b: "oc_b",
  ambit_open_cell_a_side: "oc_a",
  ambit_open_cell_b_side: "oc_b",
  ambit_closed_cell_a: "cc_a",
  ambit_closed_cell_b: "cc_b",
  ambit_closed_cell_a_side: "cc_a",
  ambit_closed_cell_b_side: "cc_b",
  enverge_oc_a: "env_oc_a",
  enverge_oc_b: "env_oc_b",
  enverge_cc_a: "env_cc_a",
  enverge_cc_b: "env_cc_b",
  enverge_open_cell_a: "env_oc_a",
  enverge_open_cell_b: "env_oc_b",
  enverge_open_cell_a_side: "env_oc_a",
  enverge_open_cell_b_side: "env_oc_b",
  enverge_closed_cell_a: "env_cc_a",
  enverge_closed_cell_b: "env_cc_b",
  enverge_closed_cell_a_side: "env_cc_a",
  enverge_closed_cell_b_side: "env_cc_b",
};
export const normalizeInventoryItemId = (itemId) => {
  const normalized = canonicalizeInventoryItemKey(itemId);
  return INVENTORY_ITEM_ID_ALIASES[normalized] || normalized || null;
};

export const planTruckLoadoutTransfer = ({
  currentTruckState = {},
  requestedTruckState = {},
  warehouseInventoryByItemId = {},
} = {}) => {
  const normalizedCurrent = currentTruckState && typeof currentTruckState === "object" ? currentTruckState : {};
  const normalizedRequested = requestedTruckState && typeof requestedTruckState === "object" ? requestedTruckState : {};
  const warehouseLookup = warehouseInventoryByItemId && typeof warehouseInventoryByItemId === "object" ? warehouseInventoryByItemId : {};
  const itemIds = new Set([
    ...Object.keys(normalizedCurrent).filter((key) => key !== "_custom"),
    ...Object.keys(normalizedRequested).filter((key) => key !== "_custom"),
  ]);
  const nextTruckState = {};
  const changes = [];

  itemIds.forEach((rawItemId) => {
    const itemId = normalizeInventoryItemId(rawItemId);
    if (!itemId) return;
    const beforeTruckQty = roundQty(normalizedCurrent[rawItemId] ?? normalizedCurrent[itemId]);
    const targetTruckQty = roundQty(normalizedRequested[rawItemId] ?? normalizedRequested[itemId]);
    const delta = roundQty(targetTruckQty - beforeTruckQty);
    if (targetTruckQty > 0) nextTruckState[itemId] = targetTruckQty;
    if (delta === 0) return;

    const warehouseQty = roundQty(warehouseLookup[rawItemId] ?? warehouseLookup[itemId]);
    changes.push({
      itemId,
      beforeTruckQty,
      targetTruckQty,
      delta,
      transferDirection: delta > 0 ? "load" : "return",
      transferQty: Math.abs(delta),
      beforeWarehouseQty: warehouseQty,
      afterWarehouseQty: delta > 0
        ? Math.max(0, roundQty(warehouseQty - delta))
        : roundQty(warehouseQty + Math.abs(delta)),
    });
  });

  return { nextTruckState, changes };
};
const asNullableString = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = `${value}`.trim();
  return trimmed ? trimmed : null;
};
const getLegacyMaterialLogTruckAttribution = (logs = []) => {
  const truckIds = new Set();
  let hasTrucklessLogs = false;

  (Array.isArray(logs) ? logs : []).forEach((log) => {
    const hasMaterials = Object.values(log?.materials || {}).some((qty) => roundQty(qty) > 0);
    if (!hasMaterials) return;
    const truckId = asNullableString(log?.truckId);
    if (truckId) truckIds.add(truckId);
    else hasTrucklessLogs = true;
  });

  return {
    truckIds: [...truckIds],
    hasTrucklessLogs,
    isAmbiguous: hasTrucklessLogs || truckIds.size > 1,
  };
};
const resolveLegacyJobTruckId = (job = {}, fallbackTruckId = null) => {
  const explicitTruckId = asNullableString(fallbackTruckId)
    || asNullableString(job?.closeoutTruckId)
    || asNullableString(job?.truckId);
  if (explicitTruckId) return explicitTruckId;

  const attribution = getLegacyMaterialLogTruckAttribution(job?.dailyMaterialLogs || []);
  if (!attribution.isAmbiguous && attribution.truckIds.length === 1) return attribution.truckIds[0];

  return null;
};
const compactObject = (value) => Object.fromEntries(
  Object.entries(value || {}).filter(([, item]) => item !== undefined)
);
export const sanitizeInventoryEventIdPart = (value, fallback = "na") => {
  const trimmed = `${value ?? ""}`.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
};

export const normalizeInventoryEventItem = (item = {}) => ({
  itemId: normalizeInventoryItemId(item.itemId || item.id),
  itemName: asNullableString(item.itemName || item.name),
  unit: asNullableString(item.unit),
  category: asNullableString(item.category),
});

export const normalizeInventoryEventActor = (actor = {}) => ({
  actorId: asNullableString(actor.actorId),
  actorName: asNullableString(actor.actorName || actor.name),
  actorRole: asNullableString(actor.actorRole || actor.role),
  source: asNullableString(actor.source) || "system",
});

export const normalizeInventoryEventLocation = (location = {}) => ({
  warehouseId: asNullableString(location.warehouseId),
  truckId: asNullableString(location.truckId),
  truckName: asNullableString(location.truckName),
  jobId: asNullableString(location.jobId),
  jobAddress: asNullableString(location.jobAddress),
});

export const normalizeInventoryEventRefs = (refs = {}) => ({
  legacyCollection: asNullableString(refs.legacyCollection),
  legacyDocId: asNullableString(refs.legacyDocId),
  legacyLogType: asNullableString(refs.legacyLogType),
  correlationKey: asNullableString(refs.correlationKey),
  snapshotKey: asNullableString(refs.snapshotKey),
  siteKey: asNullableString(refs.siteKey),
});

export const normalizeJobSiteAddress = (value) => {
  const base = asNullableString(value);
  if (!base) return null;
  const normalized = base
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/#/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => STREET_ABBREVIATION_ALIASES[part] || part)
    .join(" ")
    .trim();
  return normalized || null;
};

export const buildJobSiteKey = (value) => {
  const normalized = normalizeJobSiteAddress(value);
  return normalized ? normalized.replace(/\s+/g, "-") : null;
};

export const createInventoryEvent = ({
  eventType,
  occurredAt,
  effectiveDate = null,
  actor = {},
  item = {},
  quantity = {},
  location = {},
  refs = {},
  notes = null,
  metadata = {},
  legacy = {},
} = {}) => {
  const normalizedItem = normalizeInventoryEventItem(item);
  if (!eventType) throw new Error("inventory event requires eventType");
  if (!normalizedItem.itemId && eventType !== INVENTORY_EVENT_TYPES.warehouseSnapshot && eventType !== INVENTORY_EVENT_TYPES.truckSnapshot) {
    throw new Error("inventory event requires item.itemId for non-snapshot events");
  }

  const quantityDelta = roundQty(quantity.delta);
  const quantityBefore = quantity.before === null || quantity.before === undefined ? null : roundQty(quantity.before);
  const quantityAfter = quantity.after === null || quantity.after === undefined ? null : roundQty(quantity.after);

  return compactObject({
    schemaVersion: INVENTORY_EVENT_SCHEMA_VERSION,
    eventType,
    occurredAt: occurredAt || new Date().toISOString(),
    effectiveDate: asNullableString(effectiveDate),
    actor: normalizeInventoryEventActor(actor),
    item: normalizedItem,
    quantity: compactObject({
      delta: quantityDelta,
      before: quantityBefore,
      after: quantityAfter,
      unit: normalizedItem.unit,
    }),
    location: normalizeInventoryEventLocation(location),
    refs: normalizeInventoryEventRefs(refs),
    notes: asNullableString(notes),
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    legacy: legacy && typeof legacy === "object" ? legacy : {},
  });
};

export const getInventoryBalanceKey = (event = {}) => {
  const { item = {}, location = {} } = event;
  return [
    item.itemId || "__unknown__",
    location.warehouseId || "warehouse",
    location.truckId || "no-truck",
    location.jobId || "no-job",
  ].join("::");
};

export const buildInventorySnapshotEventId = ({
  eventType,
  snapshotKey = null,
  truckId = null,
  warehouseId = null,
  itemId = null,
} = {}) => [
  sanitizeInventoryEventIdPart(eventType, "snapshot"),
  sanitizeInventoryEventIdPart(snapshotKey, truckId || warehouseId || "snapshot"),
  sanitizeInventoryEventIdPart(itemId, "item"),
].join("__");

export const buildCanonicalInventoryEventId = (event = {}, fallbackIndex = null) => {
  const eventType = sanitizeInventoryEventIdPart(event?.eventType, "inventory-event");
  const itemId = sanitizeInventoryEventIdPart(event?.item?.itemId, "item");
  const correlationKey = asNullableString(event?.refs?.correlationKey);
  const snapshotKey = asNullableString(event?.refs?.snapshotKey);
  const warehouseId = asNullableString(event?.location?.warehouseId);
  const truckId = asNullableString(event?.location?.truckId);
  const jobId = asNullableString(event?.location?.jobId);
  const effectiveDate = asNullableString(event?.effectiveDate);
  const occurredAt = asNullableString(event?.occurredAt);
  const fallbackScope = [warehouseId || null, truckId || null, jobId || null, effectiveDate || null, occurredAt || null]
    .filter(Boolean)
    .join("::");
  const scopeKey = snapshotKey || correlationKey || fallbackScope || (fallbackIndex === null || fallbackIndex === undefined ? null : `row-${fallbackIndex}`);

  return [
    eventType,
    sanitizeInventoryEventIdPart(scopeKey, "scope"),
    itemId,
  ].join("__");
};

export const buildInventorySnapshotEvents = ({
  eventType,
  occurredAt,
  actor,
  location,
  items = [],
  refs = {},
  metadata = {},
  legacy = {},
} = {}) => (
  items
    .map((item) => {
      const qty = roundQty(item.qty);
      return createInventoryEvent({
        eventType,
        occurredAt,
        actor,
        item,
        quantity: { after: qty },
        location,
        refs,
        metadata,
        legacy,
      });
    })
    .filter(Boolean)
);

export const adaptLegacyDailyMaterialLogToEvents = ({
  job = {},
  log = {},
  actor = {},
  legacyDocId = null,
} = {}) => {
  const occurredAt = log?.audit?.capturedAt || log?.timestamp || new Date().toISOString();
  const truckId = asNullableString(log?.truckId);
  const materials = Object.entries(log?.materials || {});

  return materials
    .map(([itemId, qty]) => {
      const delta = roundQty(qty);
      if (delta <= 0) return null;
      return createInventoryEvent({
        eventType: INVENTORY_EVENT_TYPES.jobUsage,
        occurredAt,
        effectiveDate: asNullableString(log?.date),
        actor: {
          actorName: log?.loggedBy,
          actorRole: log?.audit?.actorRole,
          source: log?.audit?.source || actor?.source || "system",
          ...actor,
        },
        item: { itemId },
        quantity: { delta: -Math.abs(delta) },
        location: {
          truckId,
          jobId: asNullableString(job?.id),
          jobAddress: asNullableString(job?.address),
        },
        refs: {
          legacyCollection: "jobs",
          legacyDocId: legacyDocId || asNullableString(job?.id),
          legacyLogType: "dailyMaterialLogs",
          correlationKey: [job?.id || "job", log?.date || "date", truckId || "legacy-truck"].join("::"),
          siteKey: buildJobSiteKey(job?.address),
        },
        metadata: {
          noMaterialUsed: !!log?.noMaterialUsed,
          audit: log?.audit || null,
          jobSiteKey: buildJobSiteKey(job?.address),
        },
        legacy: {
          materials: log?.materials || {},
          logDate: log?.date || null,
        },
      });
    })
    .filter(Boolean);
};

export const adaptLiveDailyMaterialLogUpsertToEvents = ({
  job = {},
  log = {},
  priorLog = {},
  actor = {},
  legacyDocId = null,
} = {}) => {
  const baseEvents = adaptLegacyDailyMaterialLogToEvents({
    job,
    log,
    actor,
    legacyDocId,
  }).map((event) => ({
    ...event,
    metadata: {
      ...(event.metadata || {}),
      upsert: true,
      eventKind: "daily_material_log_upsert",
    },
  }));

  const priorMaterials = priorLog?.materials || {};
  const nextMaterials = log?.materials || {};
  const occurredAt = log?.audit?.capturedAt || log?.timestamp || new Date().toISOString();
  const truckId = asNullableString(log?.truckId);
  const priorTruckId = asNullableString(priorLog?.truckId);
  const clearTruckId = priorTruckId && priorTruckId !== truckId ? priorTruckId : truckId;
  const clearedItemIds = Array.from(new Set([
    ...Object.keys(priorMaterials).filter((itemId) => roundQty(nextMaterials?.[itemId]) <= 0),
    ...(priorTruckId && priorTruckId !== truckId ? Object.keys(priorMaterials) : []),
  ]));

  const clearedEvents = clearedItemIds
    .map((itemId) => {
      const priorQty = roundQty(priorMaterials?.[itemId]);
      if (priorQty <= 0) return null;
      return createInventoryEvent({
        eventType: INVENTORY_EVENT_TYPES.jobUsage,
        occurredAt,
        effectiveDate: asNullableString(log?.date),
        actor: {
          actorName: log?.loggedBy,
          actorRole: log?.audit?.actorRole,
          source: log?.audit?.source || actor?.source || "system",
          ...actor,
        },
        item: { itemId },
        quantity: { delta: 0, before: -Math.abs(priorQty), after: 0 },
        location: {
          truckId: clearTruckId,
          jobId: asNullableString(job?.id),
          jobAddress: asNullableString(job?.address),
        },
        refs: {
          legacyCollection: "jobs",
          legacyDocId: legacyDocId || asNullableString(job?.id),
          legacyLogType: "dailyMaterialLogs",
          correlationKey: [job?.id || "job", log?.date || "date", clearTruckId || "legacy-truck"].join("::"),
          siteKey: buildJobSiteKey(job?.address),
        },
        metadata: {
          upsert: true,
          cleared: true,
          movedTruck: !!(priorTruckId && priorTruckId !== truckId),
          eventKind: "daily_material_log_upsert",
          jobSiteKey: buildJobSiteKey(job?.address),
        },
        legacy: {
          materials: log?.materials || {},
          priorMaterials,
          logDate: log?.date || null,
        },
      });
    })
    .filter(Boolean);

  return [...baseEvents, ...clearedEvents];
};

export const adaptCloseoutMaterialsUsedDeltaToEvents = ({
  job = {},
  materialsUsed = {},
  actor = {},
  legacyDocId = null,
  truckId = null,
  occurredAt = null,
  effectiveDate = null,
} = {}) => {
  const resolvedOccurredAt = occurredAt || new Date().toISOString();
  const resolvedTruckId = resolveLegacyJobTruckId(job, truckId);
  const resolvedEffectiveDate = asNullableString(effectiveDate)
    || asNullableString(job?.closedAt)
    || asNullableString(job?.date);
  const correlationKeyBase = [
    job?.id || "job",
    resolvedEffectiveDate || "date",
    resolvedTruckId || "legacy-truck",
    "closeout-materials-used",
  ].join("::");

  return Object.entries(materialsUsed || {})
    .map(([itemId, qty]) => {
      const delta = roundQty(qty);
      if (delta <= 0) return null;
      return createInventoryEvent({
        eventType: INVENTORY_EVENT_TYPES.jobUsage,
        occurredAt: resolvedOccurredAt,
        effectiveDate: resolvedEffectiveDate,
        actor,
        item: { itemId },
        quantity: { delta: -Math.abs(delta) },
        location: {
          truckId: resolvedTruckId,
          jobId: asNullableString(job?.id),
          jobAddress: asNullableString(job?.address),
        },
        refs: {
          legacyCollection: "jobs",
          legacyDocId: legacyDocId || asNullableString(job?.id),
          legacyLogType: "materialsUsed",
          correlationKey: correlationKeyBase,
          siteKey: buildJobSiteKey(job?.address),
        },
        metadata: {
          eventKind: "closeout_materials_used_delta",
          closeoutOnly: true,
          bestEffort: true,
          jobSiteKey: buildJobSiteKey(job?.address),
        },
        legacy: {
          materialsUsed,
          closeoutOnlyDelta: true,
        },
      });
    })
    .filter(Boolean);
};

const getLegacyDailyLogTotals = (job = {}) => {
  const totals = {};
  (job?.dailyMaterialLogs || []).forEach((log) => {
    Object.entries(log?.materials || {}).forEach(([itemId, qty]) => {
      const normalizedItemId = normalizeInventoryItemId(itemId) || itemId;
      if (!normalizedItemId) return;
      const nextQty = roundQty((totals[normalizedItemId] || 0) + (parseFloat(qty) || 0));
      if (nextQty > 0) totals[normalizedItemId] = nextQty;
      else delete totals[normalizedItemId];
    });
  });
  return totals;
};

export const getCloseoutOnlyMaterialsUsedDelta = (job = {}) => {
  const dailyLogTotals = getLegacyDailyLogTotals(job);
  const leftovers = {};

  Object.entries(job?.materialsUsed || {}).forEach(([itemId, qty]) => {
    const normalizedItemId = normalizeInventoryItemId(itemId) || itemId;
    if (!normalizedItemId) return;
    const closeoutQty = roundQty(qty);
    const loggedQty = roundQty(dailyLogTotals[normalizedItemId] || 0);
    const leftoverQty = roundQty(closeoutQty - loggedQty);
    if (leftoverQty > 0) leftovers[normalizedItemId] = leftoverQty;
  });

  return leftovers;
};

export const buildJobUsageBackfillPlan = ({
  jobs = [],
  existingEvents = [],
  actor = {},
  batchKey = "phase4-job-usage-backfill-v1",
  includeExisting = false,
} = {}) => {
  const existingById = new Map(
    (Array.isArray(existingEvents) ? existingEvents : []).map((event) => [buildCanonicalInventoryEventId(event), event])
  );
  const plannedEvents = [];
  const skippedExisting = [];

  (Array.isArray(jobs) ? jobs : []).forEach((job) => {
    if (!job?.id) return;

    (job?.dailyMaterialLogs || []).forEach((log) => {
      const events = adaptLegacyDailyMaterialLogToEvents({
        job,
        log,
        actor: {
          source: "backfill",
          actorRole: "system",
          actorName: actor?.actorName || "Phase 4 backfill",
          ...actor,
        },
        legacyDocId: job.id,
      }).map((event) => ({
        ...event,
        metadata: {
          ...(event.metadata || {}),
          backfill: true,
          backfillBatchKey: batchKey,
          backfillSource: "legacy_daily_material_logs",
        },
      }));

      events.forEach((event) => {
        const eventId = buildCanonicalInventoryEventId(event);
        if (!includeExisting && existingById.has(eventId)) {
          skippedExisting.push({ eventId, reason: "existing", event });
          return;
        }
        plannedEvents.push(event);
      });
    });

    const closeoutOnlyMaterialsUsed = getCloseoutOnlyMaterialsUsedDelta(job);
    if (Object.keys(closeoutOnlyMaterialsUsed).length === 0) return;

    const closeoutEvents = adaptCloseoutMaterialsUsedDeltaToEvents({
      job,
      materialsUsed: closeoutOnlyMaterialsUsed,
      actor: {
        source: "backfill",
        actorRole: "system",
        actorName: actor?.actorName || "Phase 4 backfill",
        ...actor,
      },
      legacyDocId: job.id,
      truckId: getLegacyJobTruckFallbackId(job),
      occurredAt: job?.closedAt || job?.updatedAt || job?.date || null,
      effectiveDate: job?.closedAt || job?.date || null,
    }).map((event) => ({
      ...event,
      metadata: {
        ...(event.metadata || {}),
        backfill: true,
        backfillBatchKey: batchKey,
        backfillSource: "closeout_only_materials_used_leftover",
      },
      legacy: {
        ...(event.legacy || {}),
        dailyLogTotals: getLegacyDailyLogTotals(job),
      },
    }));

    closeoutEvents.forEach((event) => {
      const eventId = buildCanonicalInventoryEventId(event);
      if (!includeExisting && existingById.has(eventId)) {
        skippedExisting.push({ eventId, reason: "existing", event });
        return;
      }
      plannedEvents.push(event);
    });
  });

  const events = plannedEvents.sort((a, b) => {
    const dateCmp = `${a?.occurredAt || ""}`.localeCompare(`${b?.occurredAt || ""}`);
    if (dateCmp !== 0) return dateCmp;
    return buildCanonicalInventoryEventId(a).localeCompare(buildCanonicalInventoryEventId(b));
  });

  return {
    batchKey,
    events,
    eventIds: events.map((event) => buildCanonicalInventoryEventId(event)),
    skippedExisting,
    summary: {
      totalJobsScanned: (Array.isArray(jobs) ? jobs : []).length,
      totalEventsPlanned: events.length,
      skippedExistingCount: skippedExisting.length,
      dailyLogEventCount: events.filter((event) => event?.metadata?.backfillSource === "legacy_daily_material_logs").length,
      closeoutLeftoverEventCount: events.filter((event) => event?.metadata?.backfillSource === "closeout_only_materials_used_leftover").length,
    },
  };
};

export const adaptLegacyTruckInventoryToSnapshotEvents = ({
  truckId,
  truckName = null,
  truckInventory = {},
  occurredAt,
  actor = {},
  legacyDocId = null,
} = {}) => {
  const items = Object.entries(truckInventory || {})
    .filter(([key]) => key !== "_custom")
    .map(([itemId, qty]) => ({ itemId, qty }));

  return buildInventorySnapshotEvents({
    eventType: INVENTORY_EVENT_TYPES.truckSnapshot,
    occurredAt,
    actor,
    location: { truckId, truckName },
    items,
    refs: {
      legacyCollection: "truckInventory",
      legacyDocId: legacyDocId || asNullableString(truckId),
      snapshotKey: [truckId || "truck", occurredAt || "snapshot"].join("::"),
    },
    metadata: { source: "truckInventory" },
    legacy: { truckInventory },
  });
};

export const adaptTruckTransferToEvents = ({
  items = [],
  truckId,
  truckName = null,
  warehouseId = "main",
  direction = "load",
  occurredAt = null,
  effectiveDate = null,
  actor = {},
  refs = {},
  metadata = {},
  legacy = {},
} = {}) => {
  const normalizedDirection = direction === "return" ? "return" : "load";
  const deltaMultiplier = normalizedDirection === "return" ? -1 : 1;
  const resolvedOccurredAt = occurredAt || new Date().toISOString();
  const normalizedRefs = {
    ...refs,
    correlationKey: refs?.correlationKey || [truckId || "truck", normalizedDirection, resolvedOccurredAt].join("::"),
  };

  return (Array.isArray(items) ? items : [])
    .flatMap((item) => {
      const itemId = normalizeInventoryItemId(item?.itemId || item?.id);
      const qty = roundQty(item?.qty ?? item?.stillHave);
      if (!itemId || qty <= 0) return [];

      const itemDetails = {
        itemId,
        itemName: item?.itemName || item?.name,
        unit: item?.unit,
        category: item?.category,
      };
      const perItemLegacy = legacy && typeof legacy === "object"
        ? { ...legacy, itemId, qty }
        : { itemId, qty };
      const perItemMetadata = {
        ...(metadata && typeof metadata === "object" ? metadata : {}),
        transferDirection: normalizedDirection,
      };

      return [
        createInventoryEvent({
          eventType: INVENTORY_EVENT_TYPES.warehouseAdjustment,
          occurredAt: resolvedOccurredAt,
          effectiveDate: asNullableString(effectiveDate),
          actor,
          item: itemDetails,
          quantity: { delta: -deltaMultiplier * Math.abs(qty) },
          location: { warehouseId },
          refs: normalizedRefs,
          metadata: {
            ...perItemMetadata,
            eventKind: "truck_transfer_warehouse_adjustment",
          },
          legacy: perItemLegacy,
        }),
        createInventoryEvent({
          eventType: INVENTORY_EVENT_TYPES.truckTransfer,
          occurredAt: resolvedOccurredAt,
          effectiveDate: asNullableString(effectiveDate),
          actor,
          item: itemDetails,
          quantity: { delta: deltaMultiplier * Math.abs(qty) },
          location: { warehouseId, truckId: asNullableString(truckId), truckName: asNullableString(truckName) },
          refs: normalizedRefs,
          metadata: {
            ...perItemMetadata,
            eventKind: "truck_transfer",
          },
          legacy: perItemLegacy,
        }),
      ];
    })
    .filter(Boolean);
};

export const normalizeLegacyWarehouseInventoryRows = (inventory = []) => {
  const rowByItemId = new Map();

  (Array.isArray(inventory) ? inventory : []).forEach((row, index) => {
    const itemId = normalizeInventoryItemId(row?.itemId || row?.id);
    if (!itemId) return;

    const existing = rowByItemId.get(itemId) || {
      itemId,
      itemName: null,
      unit: null,
      category: null,
      qty: 0,
      legacyRowIds: [],
      sourceRowCount: 0,
      firstSeenIndex: index,
    };

    const nextQty = roundQty(existing.qty + (parseFloat(row?.qty) || 0));
    rowByItemId.set(itemId, {
      ...existing,
      id: existing.id || row?.id || itemId,
      itemName: existing.itemName || asNullableString(row?.itemName || row?.name),
      unit: existing.unit || asNullableString(row?.unit),
      category: existing.category || asNullableString(row?.category),
      qty: nextQty,
      legacyRowIds: row?.id ? [...existing.legacyRowIds, row.id] : existing.legacyRowIds,
      sourceRowCount: existing.sourceRowCount + 1,
    });
  });

  return [...rowByItemId.values()]
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((row) => ({
      ...row,
      legacyRowIds: [...new Set(row.legacyRowIds)],
      qty: roundQty(row.qty),
    }));
};

export const buildWarehouseInventoryBackfillSnapshotKey = ({
  warehouseId = "main",
  baselineTag = "legacy-baseline",
  occurredAt,
  effectiveDate = null,
} = {}) => [
  sanitizeInventoryEventIdPart(warehouseId, "main"),
  sanitizeInventoryEventIdPart(baselineTag, "legacy-baseline"),
  sanitizeInventoryEventIdPart(effectiveDate || occurredAt || "snapshot", "snapshot"),
].join("::");

export const adaptLegacyWarehouseInventoryToSnapshotEvents = ({
  inventory = [],
  occurredAt,
  effectiveDate = null,
  warehouseId = "main",
  actor = {},
  baselineTag = "legacy-baseline",
  snapshotKey = null,
  metadata = {},
  legacy = {},
  notes = null,
} = {}) => {
  const normalizedInventory = normalizeLegacyWarehouseInventoryRows(inventory);
  const resolvedSnapshotKey = snapshotKey || buildWarehouseInventoryBackfillSnapshotKey({
    warehouseId,
    baselineTag,
    occurredAt,
    effectiveDate,
  });

  return buildInventorySnapshotEvents({
    eventType: INVENTORY_EVENT_TYPES.warehouseSnapshot,
    occurredAt,
    actor: {
      actorRole: "system",
      source: "inventory-backfill",
      ...actor,
    },
    location: { warehouseId },
    items: normalizedInventory.map((row) => ({
      itemId: row.itemId,
      itemName: row.itemName,
      unit: row.unit,
      category: row.category,
      qty: row.qty,
    })),
    refs: {
      legacyCollection: "inventory",
      snapshotKey: resolvedSnapshotKey,
    },
    metadata: {
      source: "inventory",
      backfill: true,
      baselineTag,
      ...metadata,
    },
    legacy: {
      inventoryCount: normalizedInventory.length,
      sourceRowCount: Array.isArray(inventory) ? inventory.length : 0,
      ...legacy,
    },
    notes,
  }).map((event) => ({
    ...event,
    effectiveDate: asNullableString(effectiveDate) || event.effectiveDate,
    refs: {
      ...event.refs,
      legacyDocId: event.item?.itemId || null,
    },
    legacy: {
      ...event.legacy,
      sourceRowIds: normalizedInventory.find((row) => row.itemId === event.item?.itemId)?.legacyRowIds || [],
    },
  }));
};

export const planWarehouseInventoryBackfill = ({
  inventory = [],
  occurredAt,
  effectiveDate = null,
  warehouseId = "main",
  actor = {},
  baselineTag = "legacy-baseline",
  snapshotKey = null,
  metadata = {},
  legacy = {},
  notes = null,
} = {}) => {
  const events = adaptLegacyWarehouseInventoryToSnapshotEvents({
    inventory,
    occurredAt,
    effectiveDate,
    warehouseId,
    actor,
    baselineTag,
    snapshotKey,
    metadata,
    legacy,
    notes,
  });

  const eventIds = events.map((event, index) => buildCanonicalInventoryEventId(event, index));
  return {
    warehouseId,
    occurredAt: occurredAt || null,
    effectiveDate: asNullableString(effectiveDate),
    baselineTag,
    snapshotKey: events[0]?.refs?.snapshotKey || snapshotKey || null,
    itemCount: events.length,
    eventIds,
    events,
  };
};

export const buildInventoryEvent = createInventoryEvent;

const isAuthoritativeBalanceEvent = (event = {}) => (
  (
    event?.eventType === INVENTORY_EVENT_TYPES.truckSnapshot
    || event?.eventType === INVENTORY_EVENT_TYPES.warehouseSnapshot
    || event?.eventType === INVENTORY_EVENT_TYPES.reconciliation
  )
  && event?.quantity?.after !== null
  && event?.quantity?.after !== undefined
);

const applyInventoryEventToState = (state = {}, event = {}) => {
  const itemId = event?.item?.itemId;
  if (!itemId) return state;
  if (isAuthoritativeBalanceEvent(event)) {
    const after = roundQty(event.quantity.after);
    if (after > 0) state[itemId] = after;
    else delete state[itemId];
    return state;
  }
  const nextQty = roundQty((state[itemId] || 0) + (event?.quantity?.delta || 0));
  if (nextQty > 0) state[itemId] = nextQty;
  else delete state[itemId];
  return state;
};

const getStateQtyForEventItem = (state = {}, event = {}) => roundQty(state[event?.item?.itemId] || 0);
const getEventQtyBefore = (event = {}) => (
  event?.quantity?.before === null || event?.quantity?.before === undefined ? null : roundQty(event.quantity.before)
);
const getEventQtyAfter = (event = {}) => (
  event?.quantity?.after === null || event?.quantity?.after === undefined ? null : roundQty(event.quantity.after)
);

const replayDeltaEventsAgainstBaseline = (state = {}, events = [], allowedTypes = new Set()) => {
  (events || []).forEach((event) => {
    if (!allowedTypes.has(event?.eventType)) return;
    const currentQty = getStateQtyForEventItem(state, event);
    const qtyBefore = getEventQtyBefore(event);
    const qtyAfter = getEventQtyAfter(event);

    if (qtyAfter !== null && qtyAfter === currentQty) return;
    if (qtyBefore !== null && qtyBefore !== currentQty) return;
    if (qtyBefore === null && qtyAfter === null) return;

    applyInventoryEventToState(state, event);
  });
  return state;
};

const TRUCK_SNAPSHOT_EVENT_TYPES = new Set([
  INVENTORY_EVENT_TYPES.truckSnapshot,
]);

const TRUCK_DELTA_EVENT_TYPES = new Set([
  INVENTORY_EVENT_TYPES.truckTransfer,
  INVENTORY_EVENT_TYPES.jobUsage,
  INVENTORY_EVENT_TYPES.reconciliation,
]);

const WAREHOUSE_SNAPSHOT_EVENT_TYPES = new Set([
  INVENTORY_EVENT_TYPES.warehouseSnapshot,
]);

const WAREHOUSE_DELTA_EVENT_TYPES = new Set([
  INVENTORY_EVENT_TYPES.warehouseAdjustment,
  INVENTORY_EVENT_TYPES.reconciliation,
]);

const JOB_USAGE_EVENT_TYPES = new Set([
  INVENTORY_EVENT_TYPES.jobUsage,
]);

const getLegacyJobTruckFallbackId = (job = {}) => resolveLegacyJobTruckId(job);
const getLegacyDailyLogScopeTruckId = (job = {}, log = {}) => (
  asNullableString(log?.truckId) || getLegacyJobTruckFallbackId(job)
);

const getOccurredAtValue = (event = {}) => {
  const occurredAt = Date.parse(event?.occurredAt || "");
  return Number.isFinite(occurredAt) ? occurredAt : Number.NEGATIVE_INFINITY;
};

const EVENT_TYPE_ORDER = {
  [INVENTORY_EVENT_TYPES.warehouseSnapshot]: 0,
  [INVENTORY_EVENT_TYPES.truckSnapshot]: 0,
  [INVENTORY_EVENT_TYPES.warehouseAdjustment]: 1,
  [INVENTORY_EVENT_TYPES.truckTransfer]: 1,
  [INVENTORY_EVENT_TYPES.jobUsage]: 1,
  [INVENTORY_EVENT_TYPES.reconciliation]: 2,
};

const compareInventoryEvents = (a = {}, b = {}) => {
  const occurredAtDelta = getOccurredAtValue(a) - getOccurredAtValue(b);
  if (occurredAtDelta !== 0) return occurredAtDelta;

  const typeDelta = (EVENT_TYPE_ORDER[a?.eventType] ?? 99) - (EVENT_TYPE_ORDER[b?.eventType] ?? 99);
  if (typeDelta !== 0) return typeDelta;

  const effectiveDateDelta = `${a?.effectiveDate || ""}`.localeCompare(`${b?.effectiveDate || ""}`);
  if (effectiveDateDelta !== 0) return effectiveDateDelta;

  return `${a?.id || a?.refs?.correlationKey || ""}`.localeCompare(`${b?.id || b?.refs?.correlationKey || ""}`);
};

const getSnapshotGroupKey = (event = {}, fallbackScope = "snapshot") => {
  if (!event) return null;
  const snapshotKey = asNullableString(event?.refs?.snapshotKey);
  if (snapshotKey) return snapshotKey;
  const warehouseId = asNullableString(event?.location?.warehouseId) || "warehouse";
  const truckId = asNullableString(event?.location?.truckId) || "truck";
  const scope = warehouseId !== "warehouse" || event?.location?.warehouseId ? `warehouse:${warehouseId}` : `truck:${truckId}`;
  return [scope || fallbackScope, asNullableString(event?.occurredAt) || "snapshot"].join("::");
};

const isDeltaAlreadyCapturedBySnapshot = (event = {}, snapshotEvent = null) => {
  if (!event || !snapshotEvent) return false;
  const eventGroupId = asNullableString(event?.metadata?.eventGroupId);
  const snapshotEventGroupId = asNullableString(snapshotEvent?.metadata?.eventGroupId);
  if (!eventGroupId || !snapshotEventGroupId) return false;
  return eventGroupId === snapshotEventGroupId;
};

const isBaselineBackfillSnapshotEvent = (event = {}) => (
  event?.eventType === INVENTORY_EVENT_TYPES.truckSnapshot
  && event?.metadata?.baseline === true
  && event?.metadata?.backfill === true
  && event?.metadata?.backfillScope === "truck_inventory"
);

const normalizeTruckInventoryProjectionState = (state = {}) => {
  if (!state || typeof state !== "object" || Array.isArray(state)) return {};
  const normalized = {};
  Object.entries(state).forEach(([key, value]) => {
    if (key === "_custom") {
      normalized._custom = Array.isArray(value)
        ? value
            .filter((item) => item && typeof item === "object" && item.name)
            .map((item) => ({
              ...item,
              qty: roundQty(item.qty),
            }))
            .filter((item) => item.qty > 0)
        : [];
      return;
    }
    const normalizedKey = normalizeInventoryItemId(key) || key;
    const qty = roundQty(value);
    if (!normalizedKey || qty <= 0) return;
    normalized[normalizedKey] = roundQty((normalized[normalizedKey] || 0) + qty);
  });
  return normalized;
};

export const deriveTruckInventoryFromEvents = (legacyTruckInventory = {}, events = []) => {
  const nextTruckInventory = Object.fromEntries(
    Object.entries(legacyTruckInventory || {}).map(([truckId, state]) => [truckId, normalizeTruckInventoryProjectionState(state)])
  );

  const getLegacyCustomState = (state = {}) => (
    Array.isArray(state?._custom)
      ? state._custom
          .filter((item) => item && typeof item === "object" && item.name)
          .map((item) => ({ ...item }))
      : []
  );

  const eventsByTruckId = new Map();
  (events || []).forEach((event) => {
    const truckId = event?.location?.truckId || null;
    if (!truckId) return;
    const bucket = eventsByTruckId.get(truckId) || [];
    bucket.push(event);
    eventsByTruckId.set(truckId, bucket);
  });

  eventsByTruckId.forEach((truckEvents, truckId) => {
    const sortedEvents = [...truckEvents].sort(compareInventoryEvents);
    const latestSnapshotEvent = [...sortedEvents]
      .filter((event) => TRUCK_SNAPSHOT_EVENT_TYPES.has(event?.eventType))
      .at(-1);
    const latestSnapshotGroupKey = latestSnapshotEvent ? getSnapshotGroupKey(latestSnapshotEvent, `truck:${truckId}`) : null;

    const legacyTruckState = nextTruckInventory[truckId] || {};
    const hasLegacyBaseline = Object.keys(legacyTruckState).length > 0;

    const state = !latestSnapshotGroupKey && hasLegacyBaseline
      ? { ...legacyTruckState }
      : {};
    const relevantEvents = !latestSnapshotGroupKey
      ? sortedEvents
      : sortedEvents.filter((event) => {
          if (TRUCK_SNAPSHOT_EVENT_TYPES.has(event?.eventType)) {
            return getSnapshotGroupKey(event, `truck:${truckId}`) === latestSnapshotGroupKey;
          }
          if (isDeltaAlreadyCapturedBySnapshot(event, latestSnapshotEvent)) return false;
          return compareInventoryEvents(event, latestSnapshotEvent) >= 0;
        });

    if (!latestSnapshotGroupKey && hasLegacyBaseline) {
      replayDeltaEventsAgainstBaseline(state, relevantEvents, TRUCK_DELTA_EVENT_TYPES);
    } else {
      const useGuardedDeltaReplay = isBaselineBackfillSnapshotEvent(latestSnapshotEvent);
      relevantEvents.forEach((event) => {
        if (latestSnapshotGroupKey && TRUCK_SNAPSHOT_EVENT_TYPES.has(event?.eventType)) {
          applyInventoryEventToState(state, event);
          return;
        }
        if (!TRUCK_DELTA_EVENT_TYPES.has(event?.eventType)) return;
        if (useGuardedDeltaReplay) {
          replayDeltaEventsAgainstBaseline(state, [event], TRUCK_DELTA_EVENT_TYPES);
          return;
        }
        applyInventoryEventToState(state, event);
      });
    }

    const legacyCustomState = getLegacyCustomState(legacyTruckState);
    if (legacyCustomState.length > 0) state._custom = legacyCustomState;

    nextTruckInventory[truckId] = state;
  });

  return nextTruckInventory;
};

export const compareTruckInventoryStates = (legacyState = {}, derivedState = {}) => {
  const normalizedLegacy = normalizeTruckInventoryProjectionState(legacyState);
  const normalizedDerived = normalizeTruckInventoryProjectionState(derivedState);
  const itemIds = new Set([
    ...Object.keys(normalizedLegacy).filter((key) => key !== "_custom"),
    ...Object.keys(normalizedDerived).filter((key) => key !== "_custom"),
  ]);

  const mismatches = [...itemIds]
    .map((itemId) => {
      const legacyQty = roundQty(normalizedLegacy[itemId] || 0);
      const derivedQty = roundQty(normalizedDerived[itemId] || 0);
      const delta = roundQty(derivedQty - legacyQty);
      if (Math.abs(delta) <= 0.001) return null;
      return {
        itemId,
        legacyQty,
        derivedQty,
        delta,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.itemId.localeCompare(b.itemId));

  return {
    legacy: normalizedLegacy,
    derived: normalizedDerived,
    mismatches,
    mismatchCount: mismatches.length,
    totalAbsoluteDelta: roundQty(mismatches.reduce((sum, item) => sum + Math.abs(item.delta), 0)),
    hasMismatch: mismatches.length > 0,
  };
};

export const deriveWarehouseInventoryFromEvents = (legacyInventory = [], events = [], warehouseId = "main") => {
  const inventoryRows = Array.isArray(legacyInventory) ? legacyInventory : [];
  const rowByItemId = new Map();
  const legacyState = {};

  inventoryRows.forEach((row) => {
    const itemId = normalizeInventoryItemId(row?.itemId || row?.id);
    if (!itemId) return;

    const existingRow = rowByItemId.get(itemId) || {};
    const existingQty = legacyState[itemId] || 0;
    const nextQty = roundQty(existingQty + (row?.qty || 0));

    rowByItemId.set(itemId, {
      ...existingRow,
      ...row,
      id: existingRow.id || row?.id || itemId,
      itemId,
      qty: nextQty,
    });

    if (nextQty > 0) legacyState[itemId] = nextQty;
    else delete legacyState[itemId];
  });

  const warehouseEvents = (events || [])
    .filter((event) => (event?.location?.warehouseId || "main") === warehouseId)
    .sort(compareInventoryEvents);

  const latestSnapshotEvent = [...warehouseEvents]
    .filter((event) => WAREHOUSE_SNAPSHOT_EVENT_TYPES.has(event?.eventType))
    .at(-1);
  const latestSnapshotGroupKey = latestSnapshotEvent ? getSnapshotGroupKey(latestSnapshotEvent, `warehouse:${warehouseId}`) : null;
  const latestSnapshotEvents = latestSnapshotGroupKey
    ? warehouseEvents.filter((event) => (
        WAREHOUSE_SNAPSHOT_EVENT_TYPES.has(event?.eventType)
        && getSnapshotGroupKey(event, `warehouse:${warehouseId}`) === latestSnapshotGroupKey
      ))
    : [];
  const latestSnapshotItemIds = new Set(
    latestSnapshotEvents.map((event) => normalizeInventoryItemId(event?.item?.itemId)).filter(Boolean)
  );
  const postSnapshotDeltaItemIds = new Set(
    latestSnapshotEvent
      ? warehouseEvents
          .filter((event) => compareInventoryEvents(event, latestSnapshotEvent) >= 0)
          .filter((event) => !isDeltaAlreadyCapturedBySnapshot(event, latestSnapshotEvent))
          .filter((event) => WAREHOUSE_DELTA_EVENT_TYPES.has(event?.eventType))
          .map((event) => normalizeInventoryItemId(event?.item?.itemId))
          .filter(Boolean)
      : []
  );

  const hasLegacyBaseline = Object.keys(legacyState).length > 0;
  const state = !latestSnapshotGroupKey
    ? (hasLegacyBaseline ? { ...legacyState } : {})
    : {};

  warehouseEvents.forEach((event) => {
    if (!latestSnapshotGroupKey) {
      if (!hasLegacyBaseline && WAREHOUSE_DELTA_EVENT_TYPES.has(event?.eventType)) {
        applyInventoryEventToState(state, event);
      }
      return;
    }
    if (WAREHOUSE_SNAPSHOT_EVENT_TYPES.has(event?.eventType)) {
      if (getSnapshotGroupKey(event, `warehouse:${warehouseId}`) !== latestSnapshotGroupKey) return;
      applyInventoryEventToState(state, event);
      return;
    }
    if (isDeltaAlreadyCapturedBySnapshot(event, latestSnapshotEvent)) return;
    if (compareInventoryEvents(event, latestSnapshotEvent) < 0) return;
    if (!WAREHOUSE_DELTA_EVENT_TYPES.has(event?.eventType)) return;
    applyInventoryEventToState(state, event);
  });

  if (!latestSnapshotGroupKey && hasLegacyBaseline) {
    replayDeltaEventsAgainstBaseline(state, warehouseEvents, WAREHOUSE_DELTA_EVENT_TYPES);
  }

  if (latestSnapshotGroupKey) {
    Object.entries(legacyState).forEach(([itemId, qty]) => {
      if (state[itemId] !== undefined) return;
      if (latestSnapshotItemIds.has(itemId)) return;
      if (postSnapshotDeltaItemIds.has(itemId)) return;
      if (qty > 0) state[itemId] = qty;
    });
  }

  return Object.entries(state).map(([itemId, qty]) => {
    const legacyRow = rowByItemId.get(itemId) || {};
    return {
      ...legacyRow,
      id: legacyRow.id || itemId,
      itemId,
      qty,
    };
  });
};

export const getWarehouseInventoryParityReport = ({
  legacyInventory = [],
  events = [],
  warehouseId = "main",
} = {}) => {
  const derivedInventory = deriveWarehouseInventoryFromEvents(legacyInventory, events, warehouseId);
  const legacyByItemId = new Map();
  const derivedByItemId = new Map();
  const itemMetaById = new Map();

  (legacyInventory || []).forEach((row) => {
    const itemId = normalizeInventoryItemId(row?.itemId || row?.id);
    if (!itemId) return;
    legacyByItemId.set(itemId, roundQty((legacyByItemId.get(itemId) || 0) + (parseFloat(row?.qty) || 0)));
    itemMetaById.set(itemId, {
      itemId,
      itemName: row?.itemName || itemMetaById.get(itemId)?.itemName || itemId,
      unit: row?.unit || itemMetaById.get(itemId)?.unit || null,
      category: row?.category || itemMetaById.get(itemId)?.category || null,
    });
  });

  (derivedInventory || []).forEach((row) => {
    const itemId = normalizeInventoryItemId(row?.itemId || row?.id);
    if (!itemId) return;
    derivedByItemId.set(itemId, roundQty((derivedByItemId.get(itemId) || 0) + (parseFloat(row?.qty) || 0)));
    itemMetaById.set(itemId, {
      itemId,
      itemName: row?.itemName || itemMetaById.get(itemId)?.itemName || itemId,
      unit: row?.unit || itemMetaById.get(itemId)?.unit || null,
      category: row?.category || itemMetaById.get(itemId)?.category || null,
    });
  });

  const mismatches = [...new Set([...legacyByItemId.keys(), ...derivedByItemId.keys()])]
    .map((itemId) => {
      const legacyQty = roundQty(legacyByItemId.get(itemId) || 0);
      const eventQty = roundQty(derivedByItemId.get(itemId) || 0);
      const delta = roundQty(eventQty - legacyQty);
      if (Math.abs(delta) <= 0.001) return null;
      return {
        ...(itemMetaById.get(itemId) || { itemId, itemName: itemId, unit: null, category: null }),
        legacyQty,
        eventQty,
        delta,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || `${a.itemName || a.itemId}`.localeCompare(`${b.itemName || b.itemId}`));

  const warehouseEvents = (events || []).filter((event) => (event?.location?.warehouseId || "main") === warehouseId);
  const snapshotEvents = warehouseEvents.filter((event) => event?.eventType === INVENTORY_EVENT_TYPES.warehouseSnapshot);
  const deltaEvents = warehouseEvents.filter((event) => event?.eventType === INVENTORY_EVENT_TYPES.warehouseAdjustment || event?.eventType === INVENTORY_EVENT_TYPES.reconciliation);

  return {
    warehouseId,
    derivedInventory,
    mismatches,
    mismatchedItemCount: mismatches.length,
    totalComparedItemCount: new Set([...legacyByItemId.keys(), ...derivedByItemId.keys()]).size,
    matches: mismatches.length === 0,
    warehouseEventCount: warehouseEvents.length,
    warehouseSnapshotCount: snapshotEvents.length,
    warehouseDeltaEventCount: deltaEvents.length,
    latestWarehouseEventAt: warehouseEvents.map((event) => event?.occurredAt).filter(Boolean).sort().at(-1) || null,
    latestWarehouseSnapshotAt: snapshotEvents.map((event) => event?.occurredAt).filter(Boolean).sort().at(-1) || null,
  };
};

export const getInventoryTraceDiagnostics = ({ ledgerEntries = [], inventoryEvents = [] } = {}) => {
  const ledgerDeltaTotal = roundQty((ledgerEntries || []).reduce((sum, entry) => sum + (parseFloat(entry?.delta) || 0), 0));
  const eventDeltaTotal = roundQty((inventoryEvents || []).reduce((sum, entry) => sum + (parseFloat(entry?.delta ?? entry?.quantity?.delta) || 0), 0));
  const groupedEventCount = (inventoryEvents || []).filter((entry) => (
    asNullableString(entry?.eventGroupId)
    || asNullableString(entry?.metadata?.eventGroupId)
    || asNullableString(entry?.correlationKey)
    || asNullableString(entry?.refs?.correlationKey)
    || asNullableString(entry?.snapshotKey)
    || asNullableString(entry?.refs?.snapshotKey)
  )).length;
  const beforeAfterEventCount = (inventoryEvents || []).filter((entry) => {
    const before = entry?.before ?? entry?.quantity?.before;
    const after = entry?.after ?? entry?.quantity?.after;
    return before !== null && before !== undefined && after !== null && after !== undefined;
  }).length;
  const actorNamedEventCount = (inventoryEvents || []).filter((entry) => asNullableString(entry?.actorName || entry?.actor?.actorName)).length;
  const deltaGap = roundQty(eventDeltaTotal - ledgerDeltaTotal);
  return {
    ledgerDeltaTotal,
    eventDeltaTotal,
    deltaGap,
    isDeltaAligned: Math.abs(deltaGap) <= 0.001,
    ledgerTouchCount: (ledgerEntries || []).length,
    eventTouchCount: (inventoryEvents || []).length,
    groupedEventCount,
    beforeAfterEventCount,
    actorNamedEventCount,
    missingGroupCount: Math.max(0, (inventoryEvents || []).length - groupedEventCount),
    missingBeforeAfterCount: Math.max(0, (inventoryEvents || []).length - beforeAfterEventCount),
    unnamedActorCount: Math.max(0, (inventoryEvents || []).length - actorNamedEventCount),
  };
};

export const deriveJobUsageFromEvents = (legacyJobs = [], events = []) => {
  const jobs = Array.isArray(legacyJobs) ? legacyJobs : [];
  const jobStateById = new Map();
  const expectedLegacyEventKeysByJobId = new Map();
  const expectedLegacyScopeKeysByJobId = new Map();

  const buildJobUsageLogicalKey = (event = {}) => event?.id || [
    event?.location?.jobId || "job",
    event?.refs?.correlationKey || "correlation",
    event?.item?.itemId || "item",
  ].join("::");

  const buildLegacyJobUsageLogicalKey = ({ jobId, log = {}, itemId, fallbackTruckId = null }) => [
    jobId || "job",
    [jobId || "job", log?.date || "date", asNullableString(log?.truckId) || asNullableString(fallbackTruckId) || "legacy-truck"].join("::"),
    normalizeInventoryItemId(itemId) || itemId || "item",
  ].join("::");

  jobs.forEach((job) => {
    if (!job?.id) return;

    const normalizedLegacyState = {};
    Object.entries(job?.materialsUsed || {}).forEach(([itemId, qty]) => {
      const normalizedItemId = normalizeInventoryItemId(itemId) || itemId;
      if (!normalizedItemId) return;
      const nextQty = roundQty((normalizedLegacyState[normalizedItemId] || 0) + (parseFloat(qty) || 0));
      if (nextQty > 0) normalizedLegacyState[normalizedItemId] = nextQty;
      else delete normalizedLegacyState[normalizedItemId];
    });
    jobStateById.set(job.id, normalizedLegacyState);

    const expectedKeysByItemId = new Map();
    const expectedScopeKeysByItemId = new Map();
    (job?.dailyMaterialLogs || []).forEach((log) => {
      const fallbackTruckId = getLegacyJobTruckFallbackId(job);
      const scopeTruckId = getLegacyDailyLogScopeTruckId(job, log);
      const scopeKey = [job.id || "job", log?.date || "date", scopeTruckId || "legacy-truck"].join("::");
      Object.entries(log?.materials || {}).forEach(([itemId, qty]) => {
        if (roundQty(qty) <= 0) return;
        const normalizedItemId = normalizeInventoryItemId(itemId) || itemId;
        if (!normalizedItemId) return;
        const itemKeys = expectedKeysByItemId.get(normalizedItemId) || new Set();
        itemKeys.add(buildLegacyJobUsageLogicalKey({ jobId: job.id, log, itemId: normalizedItemId, fallbackTruckId }));
        expectedKeysByItemId.set(normalizedItemId, itemKeys);
        const itemScopeKeys = expectedScopeKeysByItemId.get(normalizedItemId) || new Set();
        itemScopeKeys.add(scopeKey);
        expectedScopeKeysByItemId.set(normalizedItemId, itemScopeKeys);
      });
    });
    expectedLegacyEventKeysByJobId.set(job.id, expectedKeysByItemId);
    expectedLegacyScopeKeysByJobId.set(job.id, expectedScopeKeysByItemId);
  });

  const usageEvents = (events || [])
    .filter((event) => JOB_USAGE_EVENT_TYPES.has(event?.eventType))
    .sort(compareInventoryEvents);

  const latestEventByLogicalKey = new Map();
  usageEvents.forEach((event) => {
    const logicalKey = buildJobUsageLogicalKey(event);
    latestEventByLogicalKey.set(logicalKey, event);
  });

  const effectiveEvents = usageEvents.filter((event) => {
    const logicalKey = buildJobUsageLogicalKey(event);
    return latestEventByLogicalKey.get(logicalKey) === event;
  });

  const projectedJobStateById = new Map();
  const effectiveLogicalKeysByJobId = new Map();
  const effectiveScopeKeysByJobId = new Map();
  const effectiveUpsertScopeKeysByJobId = new Map();
  const hasScopedEffectiveEventsByJobItem = new Set();

  effectiveEvents.forEach((event) => {
    const jobId = event?.location?.jobId;
    const itemId = event?.item?.itemId;
    if (!jobId || !itemId) return;
    if (!event?.metadata?.aggregateOnly) {
      hasScopedEffectiveEventsByJobItem.add(`${jobId}::${itemId}`);
    }
  });

  effectiveEvents.forEach((event) => {
    const jobId = event?.location?.jobId;
    const itemId = event?.item?.itemId;
    if (!jobId || !itemId) return;
    if (event?.metadata?.aggregateOnly && hasScopedEffectiveEventsByJobItem.has(`${jobId}::${itemId}`)) return;
    const jobState = { ...(projectedJobStateById.get(jobId) || {}) };

    const effectiveKeysByItemId = effectiveLogicalKeysByJobId.get(jobId) || new Map();
    const logicalKeys = effectiveKeysByItemId.get(itemId) || new Set();
    logicalKeys.add(buildJobUsageLogicalKey(event));
    effectiveKeysByItemId.set(itemId, logicalKeys);
    effectiveLogicalKeysByJobId.set(jobId, effectiveKeysByItemId);

    const scopeKey = event?.refs?.correlationKey || [jobId, event?.effectiveDate || "date", asNullableString(event?.location?.truckId) || "legacy-truck"].join("::");
    const effectiveScopeKeys = effectiveScopeKeysByJobId.get(jobId) || new Set();
    effectiveScopeKeys.add(scopeKey);
    effectiveScopeKeysByJobId.set(jobId, effectiveScopeKeys);

    if (event?.metadata?.upsert) {
      const effectiveUpsertScopeKeys = effectiveUpsertScopeKeysByJobId.get(jobId) || new Set();
      effectiveUpsertScopeKeys.add(scopeKey);
      effectiveUpsertScopeKeysByJobId.set(jobId, effectiveUpsertScopeKeys);
    }

    const usageDelta = Math.abs(roundQty(event?.quantity?.delta || 0));
    if (usageDelta <= 0) return;
    const existingQty = roundQty(jobState[itemId] || 0);
    jobState[itemId] = roundQty(existingQty + usageDelta);
    projectedJobStateById.set(jobId, jobState);
  });

  jobs.forEach((job) => {
    if (!job?.id) return;
    const jobId = job.id;
    const expectedKeysByItemId = expectedLegacyEventKeysByJobId.get(jobId) || new Map();
    const expectedScopeKeysByItemId = expectedLegacyScopeKeysByJobId.get(jobId) || new Map();
    const effectiveKeysByItemId = effectiveLogicalKeysByJobId.get(jobId) || new Map();
    const effectiveScopeKeys = effectiveScopeKeysByJobId.get(jobId) || new Set();
    const effectiveUpsertScopeKeys = effectiveUpsertScopeKeysByJobId.get(jobId) || new Set();
    const projectedState = projectedJobStateById.get(jobId) || null;
    const nextState = { ...(jobStateById.get(jobId) || {}) };
    const hasLegacyBaseline = Object.keys(nextState).length > 0;
    if (!hasLegacyBaseline && projectedState) {
      jobStateById.set(jobId, { ...projectedState });
      return;
    }

    const candidateItemIds = new Set([
      ...Object.keys(nextState),
      ...Object.keys(projectedState || {}),
      ...expectedKeysByItemId.keys(),
      ...effectiveKeysByItemId.keys(),
    ]);

    candidateItemIds.forEach((itemId) => {
      const expectedKeys = expectedKeysByItemId.get(itemId) || new Set();
      const expectedScopeKeys = expectedScopeKeysByItemId.get(itemId) || new Set();
      const effectiveKeys = effectiveKeysByItemId.get(itemId) || new Set();
      const hasCompleteLegacyCoverage = expectedKeys.size > 0 && [...expectedKeys].every((key) => effectiveKeys.has(key));
      const hasCompleteLegacyScopeCoverage = expectedScopeKeys.size > 0 && [...expectedScopeKeys].every((key) => effectiveUpsertScopeKeys.has(key));
      const hasScopedLegacyExpectations = expectedKeys.size > 0 || expectedScopeKeys.size > 0;
      const canReplaceAggregateLegacyOnlyState = !hasScopedLegacyExpectations && (effectiveKeys.size > 0 || effectiveUpsertScopeKeys.size > 0);
      if (!hasCompleteLegacyCoverage && !hasCompleteLegacyScopeCoverage && !canReplaceAggregateLegacyOnlyState) return;
      const qty = roundQty(projectedState?.[itemId] || 0);
      if (qty > 0) nextState[itemId] = qty;
      else delete nextState[itemId];
    });

    jobStateById.set(jobId, nextState);
  });

  projectedJobStateById.forEach((projectedState, jobId) => {
    if (!jobStateById.has(jobId)) {
      jobStateById.set(jobId, { ...(projectedState || {}) });
    }
  });

  return Object.fromEntries(jobStateById.entries());
};

const diffUsageMaps = (baseline = {}, comparison = {}) => {
  const itemIds = new Set([
    ...Object.keys(baseline || {}),
    ...Object.keys(comparison || {}),
  ]);

  const mismatches = [];
  itemIds.forEach((itemId) => {
    const baselineQty = roundQty(baseline?.[itemId] || 0);
    const comparisonQty = roundQty(comparison?.[itemId] || 0);
    const delta = roundQty(comparisonQty - baselineQty);
    if (Math.abs(delta) <= 0.001) return;
    mismatches.push({ itemId, baselineQty, comparisonQty, delta });
  });

  mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || `${a.itemId}`.localeCompare(`${b.itemId}`));

  return {
    mismatchCount: mismatches.length,
    totalDelta: roundQty(mismatches.reduce((sum, row) => sum + row.delta, 0)),
    mismatches,
  };
};

export const getJobUsageParityReport = (legacyJobs = [], events = []) => {
  const jobs = Array.isArray(legacyJobs) ? legacyJobs : [];
  const eventDerivedUsageByJobId = deriveJobUsageFromEvents(jobs, events);

  return jobs.map((job) => {
    const dailyLogTotals = {};
    const legacyTruckFallbackDates = [];
    (job?.dailyMaterialLogs || []).forEach((log) => {
      if (!asNullableString(log?.truckId) && getLegacyJobTruckFallbackId(job)) {
        legacyTruckFallbackDates.push(log?.date || null);
      }
      Object.entries(log?.materials || {}).forEach(([itemId, qty]) => {
        const normalizedItemId = normalizeInventoryItemId(itemId) || itemId;
        if (!normalizedItemId) return;
        const nextQty = roundQty((dailyLogTotals[normalizedItemId] || 0) + (parseFloat(qty) || 0));
        if (nextQty > 0) dailyLogTotals[normalizedItemId] = nextQty;
        else delete dailyLogTotals[normalizedItemId];
      });
    });

    const closeoutTotals = {};
    Object.entries(job?.materialsUsed || {}).forEach(([itemId, qty]) => {
      const normalizedItemId = normalizeInventoryItemId(itemId) || itemId;
      if (!normalizedItemId) return;
      const nextQty = roundQty((closeoutTotals[normalizedItemId] || 0) + (parseFloat(qty) || 0));
      if (nextQty > 0) closeoutTotals[normalizedItemId] = nextQty;
      else delete closeoutTotals[normalizedItemId];
    });

    const hasDailyLogs = Object.keys(dailyLogTotals).length > 0;
    const hasCloseoutUsage = Object.keys(closeoutTotals).length > 0;
    const effectiveLegacyTotals = job?.closedOut && hasCloseoutUsage
      ? closeoutTotals
      : hasDailyLogs
        ? dailyLogTotals
        : closeoutTotals;
    const eventDerivedTotals = eventDerivedUsageByJobId[job?.id] || {};
    const vsDailyLogs = diffUsageMaps(dailyLogTotals, eventDerivedTotals);
    const vsCloseout = diffUsageMaps(closeoutTotals, eventDerivedTotals);
    const vsEffectiveLegacy = diffUsageMaps(effectiveLegacyTotals, eventDerivedTotals);

    return {
      jobId: job?.id || null,
      hasDailyLogs,
      hasCloseoutUsage,
      dailyLogTotals,
      closeoutTotals,
      effectiveLegacyTotals,
      eventDerivedTotals,
      vsDailyLogs,
      vsCloseout,
      vsEffectiveLegacy,
      legacyTruckFallback: {
        used: legacyTruckFallbackDates.length > 0,
        fallbackTruckId: getLegacyJobTruckFallbackId(job),
        fallbackDateCount: legacyTruckFallbackDates.length,
        fallbackDates: legacyTruckFallbackDates.filter(Boolean),
      },
      isAligned: vsEffectiveLegacy.mismatchCount === 0,
    };
  });
};

export const INVENTORY_EVENT_ROLLOUT_STAGES = [
  {
    stage: 1,
    name: "Dual write adapters",
    goal: "Write canonical inventoryEvents alongside existing inventory, truckInventory, and dailyMaterialLogs documents.",
  },
  {
    stage: 2,
    name: "Read model backfill",
    goal: "Build warehouse/truck/job balances from inventoryEvents in a derived read model, without changing UI inputs yet.",
  },
  {
    stage: 3,
    name: "UI flip",
    goal: "Move operational screens to read from balances/events, while preserving legacy documents as compatibility mirrors.",
  },
  {
    stage: 4,
    name: "Legacy retirement",
    goal: "Stop dual writes once reconciliation reports show event-sourced balances are stable.",
  },
];
