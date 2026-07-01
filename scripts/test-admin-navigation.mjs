import assert from "node:assert/strict";

import {
  buildOfficeNavItems,
  OFFICE_NAV_KEYS,
  shouldClearTruckFilterForNav,
} from "../src/features/admin/adminNavigation.js";

const items = buildOfficeNavItems({ openChecklistShortageCount: 3, openTicketCount: 2 });

assert.deepEqual(items.map((item) => item.key), [
  "schedule",
  "calendar",
  "reception",
  "inventory",
  "foamPricing",
  "tickets",
  "trucks",
  "roster",
]);
assert.equal(items.find((item) => item.key === OFFICE_NAV_KEYS.inventory).badge, 3);
assert.equal(items.find((item) => item.key === OFFICE_NAV_KEYS.tickets).badge, 2);
assert.equal(items.find((item) => item.key === OFFICE_NAV_KEYS.schedule).badge, 0);
assert.equal(shouldClearTruckFilterForNav("schedule"), true);
assert.equal(shouldClearTruckFilterForNav("tickets"), true);
assert.equal(shouldClearTruckFilterForNav("inventory"), false);

console.log("admin navigation tests passed");
