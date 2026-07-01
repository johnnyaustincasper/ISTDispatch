import {
  LOCATIONS,
  GROUP_ORDER,
  PITCH_FACTORS,
  WALL_HEIGHTS,
  SALESMAN_INFO,
} from "../src/features/takeoff/constants.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(LOCATIONS.some((l) => l.id === "ext_walls_house" && l.type === "wall"), "missing exterior wall location");
assert(GROUP_ORDER.includes("Walls"), "missing Walls group");
assert(PITCH_FACTORS["12/12"] === 1.414, "12/12 pitch factor changed");
assert(WALL_HEIGHTS.find((h) => h.label.includes("8'") && h.sqftPer === 10), "8 foot wall factor changed");
assert(WALL_HEIGHTS.find((h) => h.label.includes("9'") && h.sqftPer === 11.25), "9 foot wall factor changed");
assert(WALL_HEIGHTS.find((h) => h.label.includes("10'") && h.sqftPer === 12.5), "10 foot wall factor changed");
assert(WALL_HEIGHTS.find((h) => h.label.includes("11'") && h.sqftPer === 13.75), "11 foot wall factor changed");
assert(WALL_HEIGHTS.find((h) => h.label.includes("12'") && h.sqftPer === 15), "12 foot wall factor changed");
assert(SALESMAN_INFO.Johnny?.email === "Johnny@istulsa.com", "Johnny salesman contact changed");

console.log("takeoff constants ok");
