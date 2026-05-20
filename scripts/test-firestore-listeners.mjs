import assert from "node:assert/strict";

import {
  buildListenerErrorStatus,
  buildListenerStatus,
  createInitialListenerDiagnostics,
  mapSnapshotToArray,
  mapSnapshotToObjectById,
} from "../src/firestoreListeners.js";

const fakeDoc = (id, data) => ({ id, data: () => data });
const snap = { size: 2, docs: [fakeDoc("a", { qty: 1 }), fakeDoc("b", { qty: 2 })] };

assert.deepEqual(mapSnapshotToArray(snap), [
  { id: "a", qty: 1 },
  { id: "b", qty: 2 },
]);

assert.deepEqual(mapSnapshotToObjectById(snap), {
  a: { qty: 1 },
  b: { qty: 2 },
});

const initial = createInitialListenerDiagnostics(["jobs", "tickets"]);
assert.equal(initial.jobs.status, "never");
assert.equal(initial.tickets.active, false);
assert.equal(initial.jobs.snapshotCount, 0);
assert.equal(initial.jobs.totalDocsReceived, 0);
assert.equal(initial.jobs.subscribedAt, null);

const status = buildListenerStatus("jobs", snap, { source: "test" });
assert.equal(status.name, "jobs");
assert.equal(status.docCount, 2);
assert.equal(status.status, "fresh");
assert.equal(status.source, "test");
assert.match(status.lastSnapshotAt, /^\d{4}-\d{2}-\d{2}T/);

const err = buildListenerErrorStatus("jobs", Object.assign(new Error("no index"), { code: "failed-precondition" }));
assert.equal(err.status, "error");
assert.equal(err.lastError.message, "no index");
assert.equal(err.lastError.code, "failed-precondition");

console.log("firestore listener tests passed");
