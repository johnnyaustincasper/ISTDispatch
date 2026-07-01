import {
  applyPitchFactor,
  calculateRectangleSqft,
  calculateWallCountSqft,
  roundSqft,
} from "../src/features/takeoff/measurementMath.js";

function assertEqual(actual, expected, message) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

assertEqual(calculateWallCountSqft(10, 0), 100, "10 cavities at 8 foot height");
assertEqual(calculateWallCountSqft(8, 2), 100, "8 cavities at 10 foot height");
assertEqual(calculateRectangleSqft(12, 9), 108, "rectangle length times height");
assertEqual(calculateRectangleSqft("", 9), 0, "empty rectangle length is zero");
assertEqual(calculateWallCountSqft("", 0), 0, "empty cavity count is zero");
assertEqual(applyPitchFactor("", "12/12"), 0, "empty pitch sqft is zero");
assertEqual(roundSqft(applyPitchFactor(100, "12/12")), 141, "100 sqft at 12/12 rounds to 141");

console.log("takeoff measurement math ok");
