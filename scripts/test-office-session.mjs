import assert from "node:assert/strict";

import {
  OFFICE_SESSION_KEY,
  clearOfficeSession,
  getSavedOfficeSession,
  saveOfficeSession,
} from "../src/features/admin/officeSession.js";

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    has: (key) => data.has(key),
  };
}

const storage = createStorage();
saveOfficeSession("Johnny", { storage, now: () => 1000 });
assert.equal(JSON.parse(storage.getItem(OFFICE_SESSION_KEY)).name, "Johnny");
assert.equal(getSavedOfficeSession({ storage, now: () => 1000 + 60_000 }), "Johnny");

assert.equal(getSavedOfficeSession({ storage, now: () => 1000 + (5 * 60 * 60 * 1000) }), null);
assert.equal(storage.has(OFFICE_SESSION_KEY), false);

saveOfficeSession("Skip", { storage, now: () => 2000 });
clearOfficeSession({ storage });
assert.equal(storage.getItem(OFFICE_SESSION_KEY), null);

console.log("office session helpers ok");
