import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/features/takeoff/takeoffStorage.js", import.meta.url), "utf8");

function assertIncludes(text, expected, message) {
  if (!text.includes(expected)) {
    throw new Error(`${message}: missing ${expected}`);
  }
}

for (const name of [
  "saveTakeoffJob",
  "loadTakeoffJobs",
  "loadAllTakeoffJobs",
  "deleteTakeoffJob",
  "saveTakeoffAutosave",
  "loadTakeoffAutosave",
]) {
  assertIncludes(source, name, `takeoff storage exports ${name}`);
}

assertIncludes(source, "function createTakeoffStorageHelpers", "takeoff storage exposes injectable helper factory");
assertIncludes(source, "for (const member of teamMembers)", "loadAllTakeoffJobs takes explicit teamMembers input");
assertIncludes(source, "takeoffJobs", "takeoff job collection is preserved");
assertIncludes(source, "takeoffAutosave", "takeoff autosave collection is preserved");

console.log("takeoff storage surface ok");
