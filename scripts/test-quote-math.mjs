import {
  getCalculatedOptionTotal,
  getFinalOptionTotal,
  getOptionAdjustmentsTotal,
  getOptionLineItemsTotal,
  getPsoCredit,
} from "../src/features/takeoff/quoteMath.js";

function assertEqual(actual, expected, message) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const baseOption = {
  items: [{ total: "1000" }, { total: 250 }, { total: "bad" }],
  pso: true,
  psoKw: true,
  extraLabor: true,
  extraLaborAmt: "100",
  tripCharge: true,
  tripChargeAmt: "75",
  energySeal: true,
  energySealAmt: "50",
  dumpster: true,
  dumpsterAmt: "25",
  customItems: [{ price: "10" }, { price: 15 }, { price: "" }],
  overrideTotal: "",
};

assertEqual(getOptionLineItemsTotal(baseOption), 1250, "line item sum");
assertEqual(getPsoCredit({ pso: true }), 600, "PSO attic credit");
assertEqual(getPsoCredit({ psoKw: true }), 525, "PSO kneewall credit");
assertEqual(getPsoCredit(baseOption), 1125, "combined PSO credits");
assertEqual(getOptionAdjustmentsTotal(baseOption), 275, "adjustment additions");
assertEqual(getCalculatedOptionTotal(baseOption), 400, "calculated total subtracts credits and adds adjustments");
assertEqual(getFinalOptionTotal({ ...baseOption, overrideTotal: "333.33" }), 333.33, "override total wins");
assertEqual(getFinalOptionTotal({ items: [{ total: "" }], customItems: [{ price: "" }], overrideTotal: "" }), 0, "empty strings do not create NaN");
assertEqual(getFinalOptionTotal({ items: [{ total: "100" }], overrideTotal: null }), 100, "null override falls back to calculated total");

console.log("quote math ok");
