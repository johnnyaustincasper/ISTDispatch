import assert from "node:assert/strict";

import { buildQuoteSummary, selectPrimaryQuoteOption } from "../src/features/takeoff/quoteSummary.js";

const opts = [
  { name: "Empty", items: [], overrideTotal: "" },
  {
    name: "Good Better",
    items: [{ total: 1200 }, { total: 800 }],
    pso: true,
    psoKw: false,
    extraLabor: true,
    extraLaborAmt: "150",
    tripCharge: false,
    energySeal: false,
    dumpster: false,
    customItems: [{ price: "50" }],
    overrideTotal: "",
  },
];

assert.equal(selectPrimaryQuoteOption(opts).name, "Good Better");

const summary = buildQuoteSummary({
  customer: {
    name: "Smith Residence",
    address: "123 Main St",
    jobAddress: "125 Main St",
    phone: "918-555-1212",
    email: "smith@example.com",
  },
  quoteOpts: opts,
  salesman: "Johnny",
  sourceTakeoffJobId: "takeoff-1",
  jobName: "Smith",
  now: () => "2026-05-22T12:00:00.000Z",
});

assert.equal(summary.customerName, "Smith Residence");
assert.equal(summary.address, "123 Main St");
assert.equal(summary.jobAddress, "125 Main St");
assert.equal(summary.salesman, "Johnny");
assert.equal(summary.status, "quoted");
assert.equal(summary.sourceTakeoffJobId, "takeoff-1");
assert.equal(summary.optionName, "Good Better");
assert.equal(summary.totalPrice, 1600); // 2000 - 600 PSO + 150 labor + 50 custom
assert.equal(summary.quoteOptsSummary.length, 2);
assert.equal(summary.createdAt, "2026-05-22T12:00:00.000Z");
assert.equal(summary.updatedAt, "2026-05-22T12:00:00.000Z");

const fallbackSummary = buildQuoteSummary({ customer: {}, quoteOpts: [], jobName: "Fallback Job", now: () => "now" });
assert.equal(fallbackSummary.customerName, "Fallback Job");
assert.equal(fallbackSummary.totalPrice, 0);

console.log("quote storage summary ok");
