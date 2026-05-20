import assert from 'node:assert/strict';

import {
  createDebugSnapshotExportPayload,
  createDebugSnapshotPayload,
  getBuildMetadata,
  normalizeClientError,
  summarizeConfigHealth,
  summarizeCollectionCounts,
  summarizeListenerFreshness,
  summarizeParity,
} from '../src/diagnostics.js';

const fixedNow = '2026-05-20T12:00:00.000Z';

const build = getBuildMetadata({
  MODE: 'test',
  DEV: true,
  BASE_URL: '/dispatch/',
  VITE_APP_VERSION: '1.2.3',
  VITE_GIT_SHA: 'abc123',
  VITE_BUILD_TIME: fixedNow,
});
assert.deepEqual(build, {
  mode: 'test',
  dev: true,
  prod: false,
  ssr: false,
  baseUrl: '/dispatch/',
  version: '1.2.3',
  commit: 'abc123',
  branch: null,
  builtAt: fixedNow,
});
assert.equal(getBuildMetadata().mode, null, 'build metadata should be safe without import.meta.env');

const configHealth = summarizeConfigHealth({
  MODE: 'test',
  VITE_FB_API_KEY: 'secret-api-key',
  VITE_FB_AUTH_DOMAIN: 'example.firebaseapp.com',
});
assert.equal(configHealth.ok, false);
assert.deepEqual(configHealth.firebase.present, ['VITE_FB_API_KEY', 'VITE_FB_AUTH_DOMAIN']);
assert.deepEqual(configHealth.firebase.missing, [
  'VITE_FB_PROJECT_ID',
  'VITE_FB_STORAGE_BUCKET',
  'VITE_FB_MESSAGING_ID',
  'VITE_FB_APP_ID',
]);
assert.equal(JSON.stringify(configHealth).includes('secret-api-key'), false);

const collectionCounts = summarizeCollectionCounts({
  jobs: [{ id: 'j1' }, { id: 'j2' }],
  customersById: { c1: {}, c2: {}, c3: {} },
  trucks: new Map([['t1', {}]]),
  unloaded: null,
  explicitCount: 7,
});
assert.equal(collectionCounts.totalCollections, 5);
assert.equal(collectionCounts.loadedCollections, 4);
assert.equal(collectionCounts.totalDocuments, 13);
assert.deepEqual(collectionCounts.collections.jobs, { count: 2, type: 'array', loaded: true });
assert.deepEqual(collectionCounts.collections.customersById, { count: 3, type: 'object', loaded: true });
assert.deepEqual(collectionCounts.collections.unloaded, { count: 0, type: 'missing', loaded: false });

const freshness = summarizeListenerFreshness(
  {
    jobs: { lastSnapshotAt: '2026-05-20T11:58:00.000Z', active: true, docCount: 12, snapshotCount: 3, totalDocsReceived: 32, averageDocsPerSnapshot: 10.67, subscribedAt: '2026-05-20T11:50:00.000Z' },
    customers: { lastSnapshotAt: '2026-05-20T11:40:00.000Z' },
    inventory: {},
    jobsUsage: { lastSnapshotAt: '2026-05-20T11:59:00.000Z', error: new Error('permission denied') },
  },
  { now: fixedNow, staleAfterMinutes: 10 },
);
assert.equal(freshness.total, 4);
assert.equal(freshness.fresh, 1);
assert.equal(freshness.stale, 1);
assert.equal(freshness.never, 1);
assert.equal(freshness.errors, 1);
assert.equal(freshness.listeners.jobs.status, 'fresh');
assert.equal(freshness.listeners.jobs.ageMinutes, 2);
assert.equal(freshness.listeners.jobs.docCount, 12);
assert.equal(freshness.listeners.jobs.snapshotCount, 3);
assert.equal(freshness.listeners.jobs.totalDocsReceived, 32);
assert.equal(freshness.listeners.jobs.averageDocsPerSnapshot, 10.67);
assert.equal(freshness.listeners.jobs.subscribedAt, '2026-05-20T11:50:00.000Z');
assert.equal(freshness.listeners.customers.status, 'stale');
assert.equal(freshness.listeners.inventory.status, 'never');
assert.equal(freshness.listeners.jobsUsage.status, 'error');
assert.equal(freshness.listeners.jobsUsage.error.message, 'permission denied');

const parity = summarizeParity({
  warehouseInventoryParity: { ok: true, checked: 12 },
  truckInventoryParity: {
    truck1: { status: 'ok', total: 4 },
    truck2: { mismatches: [{ sku: 'A' }, { sku: 'B' }] },
  },
  jobUsageParitySummary: false,
});
assert.equal(parity.ok, false);
assert.equal(parity.totalChecks, 4);
assert.equal(parity.passed, 2);
assert.equal(parity.failed, 2);
assert.equal(parity.warehouseInventoryParity.ok, true);
assert.equal(parity.truckInventoryParity.truck2.mismatchCount, 2);
assert.equal(parity.jobUsageParitySummary.mismatchCount, 1);

const jobMismatchParity = summarizeParity({
  jobUsageParitySummary: { checkedJobCount: 5, mismatchedJobCount: 2 },
});
assert.equal(jobMismatchParity.ok, false);
assert.equal(jobMismatchParity.failed, 1);
assert.equal(jobMismatchParity.jobUsageParitySummary.mismatchCount, 2);

const cause = new Error('root cause');
const error = new TypeError('outer failure', { cause });
const normalizedError = normalizeClientError({ reason: error });
assert.equal(normalizedError.type, 'Error');
assert.equal(normalizedError.name, 'TypeError');
assert.equal(normalizedError.message, 'outer failure');
assert.equal(normalizedError.cause.message, 'root cause');
assert.equal(typeof normalizedError.stack, 'string');

const circular = { message: 'plain rejection' };
circular.self = circular;
const normalizedPlainObject = normalizeClientError({ reason: circular });
assert.equal(normalizedPlainObject.message, 'plain rejection');
assert.equal(normalizedPlainObject.details.self, '[Circular]');
assert.deepEqual(normalizeClientError('string rejection'), {
  type: 'String',
  name: 'Error',
  message: 'string rejection',
  stack: null,
  cause: null,
});

const snapshot = createDebugSnapshotPayload(
  {
    collections: { jobs: [{ id: 'j1' }] },
    listeners: { jobs: { lastSnapshotAt: fixedNow } },
    warehouseInventoryParity: true,
    truckInventoryParity: new Map([['truck1', true]]),
    jobUsageParitySummary: { ok: true },
    errors: [new Error('snap error')],
    context: { selectedJobId: 'j1' },
  },
  { now: fixedNow, env: { MODE: 'test', VITE_GIT_BRANCH: 'feature/diagnostics' }, staleAfterMinutes: 3 },
);
assert.equal(snapshot.schemaVersion, 1);
assert.equal(snapshot.generatedAt, fixedNow);
assert.equal(snapshot.build.branch, 'feature/diagnostics');
assert.equal(snapshot.config.firebase.missingCount, 6);
assert.equal(snapshot.collections.collections.jobs.count, 1);
assert.equal(snapshot.listeners.listeners.jobs.status, 'fresh');
assert.equal(snapshot.parity.ok, true);
assert.equal(snapshot.errors[0].message, 'snap error');
assert.equal(snapshot.context.selectedJobId, 'j1');
assert.equal(createDebugSnapshotExportPayload, createDebugSnapshotPayload);

JSON.stringify(snapshot);

console.log('diagnostics tests passed');
