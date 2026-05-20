const DEFAULT_STALE_AFTER_MINUTES = 5;
const MINUTE_MS = 60 * 1000;

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const safeIsoString = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toTimestamp = (value) => {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value?.toDate === "function") return toTimestamp(value.toDate());
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
  }
  return null;
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const countCollection = (value) => {
  if (Array.isArray(value)) return { count: value.length, type: "array", loaded: true };
  if (value instanceof Map) return { count: value.size, type: "map", loaded: true };
  if (value instanceof Set) return { count: value.size, type: "set", loaded: true };
  if (isPlainObject(value)) return { count: Object.keys(value).length, type: "object", loaded: true };
  if (typeof value === "number" && Number.isFinite(value)) return { count: value, type: "count", loaded: true };
  return { count: 0, type: value == null ? "missing" : typeof value, loaded: false };
};

const truthyOk = (value) => value === true || value === "ok" || value === "pass" || value === "passed";
const falsyFail = (value) => value === false || value === "error" || value === "fail" || value === "failed" || value === "mismatch";

const valueCount = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.length;
  if (isPlainObject(value)) return Object.keys(value).length;
  return null;
};

const getNumeric = (source, keys) => {
  if (!isPlainObject(source)) return 0;
  for (const key of keys) {
    const count = valueCount(source[key]);
    if (count != null) return count;
  }
  return 0;
};

const getNumericSum = (source, keys) => {
  if (!isPlainObject(source)) return 0;
  return keys.reduce((sum, key) => sum + (valueCount(source[key]) ?? 0), 0);
};

const summarizeParityValue = (value) => {
  if (value == null) return { present: false, ok: null, mismatchCount: 0, errorCount: 0 };
  if (typeof value === "boolean") return { present: true, ok: value, mismatchCount: value ? 0 : 1, errorCount: 0 };
  if (typeof value === "string") {
    const ok = truthyOk(value) ? true : falsyFail(value) ? false : null;
    return { present: true, ok, status: value, mismatchCount: ok === false ? 1 : 0, errorCount: 0 };
  }
  if (!isPlainObject(value)) return { present: true, ok: null, mismatchCount: 0, errorCount: 0 };

  const mismatchCount = valueCount(value.mismatchCount)
    ?? valueCount(value.mismatchedJobCount)
    ?? valueCount(value.mismatchedItemCount)
    ?? getNumericSum(value, ["mismatches", "differences", "diffs", "missing", "extra"]);
  const errorCount = valueCount(value.errorCount) ?? getNumeric(value, ["errors"]);
  const explicitOk = typeof value.ok === "boolean" ? value.ok : typeof value.matches === "boolean" ? value.matches : undefined;
  const statusOk = truthyOk(value.status) ? true : falsyFail(value.status) ? false : undefined;
  const ok = explicitOk ?? statusOk ?? (mismatchCount === 0 && errorCount === 0);

  return {
    present: true,
    ok,
    status: value.status,
    checkedAt: safeIsoString(value.checkedAt || value.updatedAt || value.generatedAt),
    mismatchCount,
    errorCount,
    total: getNumeric(value, ["total", "checked", "count"]),
  };
};

const safeClone = (value, seen = new WeakSet()) => {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return normalizeClientError(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => safeClone(item, seen));
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([key, val]) => [String(key), safeClone(val, seen)]));
  if (value instanceof Set) return [...value].map((item) => safeClone(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [key, typeof val === "function" ? `[Function ${val.name || "anonymous"}]` : safeClone(val, seen)]),
  );
};

export const getBuildMetadata = (envOverride) => {
  const env = envOverride || import.meta?.env || {};
  return {
    mode: env.MODE || env.NODE_ENV || null,
    dev: Boolean(env.DEV),
    prod: Boolean(env.PROD),
    ssr: Boolean(env.SSR),
    baseUrl: env.BASE_URL || null,
    version: env.VITE_APP_VERSION || env.VITE_VERSION || env.npm_package_version || null,
    commit: env.VITE_GIT_SHA || env.VITE_GIT_COMMIT || env.VITE_COMMIT_SHA || null,
    branch: env.VITE_GIT_BRANCH || null,
    builtAt: env.VITE_BUILD_TIME || env.VITE_BUILT_AT || null,
  };
};

export const summarizeCollectionCounts = (collections = {}) => {
  const entries = collections instanceof Map ? [...collections.entries()] : Object.entries(collections || {});
  const byCollection = Object.fromEntries(entries.map(([name, value]) => [name, countCollection(value)]));
  const totalDocuments = Object.values(byCollection).reduce((sum, item) => sum + item.count, 0);
  return {
    totalCollections: Object.keys(byCollection).length,
    loadedCollections: Object.values(byCollection).filter((item) => item.loaded).length,
    totalDocuments,
    collections: byCollection,
  };
};

export const summarizeListenerFreshness = (listeners = {}, options = {}) => {
  const nowMs = toTimestamp(options.now || Date.now()) ?? Date.now();
  const staleAfterMinutes = options.staleAfterMinutes ?? DEFAULT_STALE_AFTER_MINUTES;
  const staleAfterMs = staleAfterMinutes * MINUTE_MS;
  const entries = listeners instanceof Map ? [...listeners.entries()] : Object.entries(listeners || {});
  const summary = { total: entries.length, fresh: 0, stale: 0, never: 0, errors: 0, staleAfterMinutes, listeners: {} };

  for (const [name, listener] of entries) {
    const record = isPlainObject(listener) ? listener : { lastSnapshotAt: listener };
    const error = record.error || record.lastError;
    const timestamp = toTimestamp(
      record.lastSnapshotAt || record.lastUpdatedAt || record.updatedAt || record.receivedAt || record.timestamp || record.at,
    );
    const ageMinutes = timestamp == null ? null : round((nowMs - timestamp) / MINUTE_MS);
    let status = "fresh";
    if (error) status = "error";
    else if (timestamp == null) status = "never";
    else if (nowMs - timestamp > staleAfterMs) status = "stale";

    if (status === "fresh") summary.fresh += 1;
    if (status === "stale") summary.stale += 1;
    if (status === "never") summary.never += 1;
    if (status === "error") summary.errors += 1;

    summary.listeners[name] = {
      status,
      active: record.active ?? record.subscribed ?? null,
      lastSnapshotAt: timestamp == null ? null : new Date(timestamp).toISOString(),
      ageMinutes,
      staleAfterMinutes,
      error: error ? normalizeClientError(error) : null,
    };
  }

  return summary;
};

export const summarizeParity = (source = {}) => {
  const warehouse = summarizeParityValue(source.warehouseInventoryParity);
  const jobUsage = summarizeParityValue(source.jobUsageParitySummary);
  const truckEntries = source.truckInventoryParity instanceof Map
    ? [...source.truckInventoryParity.entries()]
    : Object.entries(source.truckInventoryParity || {});
  const trucks = Object.fromEntries(truckEntries.map(([truckId, value]) => [truckId, summarizeParityValue(value)]));
  const checks = [warehouse, jobUsage, ...Object.values(trucks)].filter((item) => item.present);
  const failed = checks.filter((item) => item.ok === false || item.mismatchCount > 0 || item.errorCount > 0).length;

  return {
    ok: checks.length > 0 ? failed === 0 : null,
    totalChecks: checks.length,
    passed: checks.length - failed,
    failed,
    warehouseInventoryParity: warehouse,
    truckInventoryParity: trucks,
    jobUsageParitySummary: jobUsage,
  };
};

export function normalizeClientError(input) {
  const value = input?.reason ?? input?.error ?? input;
  if (value instanceof Error) {
    return {
      type: "Error",
      name: value.name || "Error",
      message: value.message || "",
      stack: value.stack || null,
      cause: value.cause ? normalizeClientError(value.cause) : null,
    };
  }
  if (typeof value === "string") return { type: "String", name: "Error", message: value, stack: null, cause: null };
  if (value == null) return { type: "Unknown", name: "Unknown", message: "", stack: null, cause: null };
  if (typeof value !== "object") return { type: typeof value, name: "Error", message: String(value), stack: null, cause: null };

  const cloned = safeClone(value);
  return {
    type: value.constructor?.name || "Object",
    name: value.name || value.type || "Error",
    message: value.message || JSON.stringify(cloned),
    stack: value.stack || null,
    cause: value.cause ? normalizeClientError(value.cause) : null,
    details: cloned,
  };
}

export const createDebugSnapshotPayload = (state = {}, options = {}) => {
  const generatedAt = safeIsoString(options.now || new Date()) || new Date().toISOString();
  const errors = Array.isArray(state.errors) ? state.errors : state.error ? [state.error] : [];
  return {
    schemaVersion: 1,
    generatedAt,
    build: getBuildMetadata(options.env),
    collections: summarizeCollectionCounts(state.collections || {}),
    listeners: summarizeListenerFreshness(state.listeners || {}, { now: options.now, staleAfterMinutes: options.staleAfterMinutes }),
    parity: summarizeParity(state),
    errors: errors.map(normalizeClientError),
    context: state.context ? safeClone(state.context) : undefined,
  };
};

export const createDebugSnapshotExportPayload = createDebugSnapshotPayload;
