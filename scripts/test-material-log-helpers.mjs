import assert from "node:assert/strict";
import {
  resolveMaterialLogTruckIdForEdit,
  buildEditableMaterialItems,
} from "../src/materialLogHelpers.js";

const test = (name, fn) => {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
};

test("office material-log edits infer the crew truck from the matching logger/date update", () => {
  const truckId = resolveMaterialLogTruckIdForEdit({
    log: { date: "2026-05-19", loggedBy: "Harold Sr.", materials: { accufoam_a: 0.1 } },
    job: { id: "job-1", truckId: "fallback-truck" },
    updates: [
      { jobId: "job-1", crewName: "Dallas", truckId: "dallas-truck", timestamp: "2026-05-19T14:00:00.000Z" },
      { jobId: "job-1", crewName: "Harold Sr.", truckId: "harold-truck", timestamp: "2026-05-19T15:00:00.000Z" },
    ],
  });

  assert.equal(truckId, "harold-truck");
});

test("office material-log edits keep an explicit log truck id ahead of inferred fallbacks", () => {
  const truckId = resolveMaterialLogTruckIdForEdit({
    log: { date: "2026-05-19", loggedBy: "Harold Sr.", truckId: "logged-truck", materials: { accufoam_a: 0.1 } },
    job: { id: "job-1", truckId: "fallback-truck" },
    updates: [
      { jobId: "job-1", crewName: "Harold Sr.", truckId: "harold-truck", timestamp: "2026-05-19T15:00:00.000Z" },
    ],
  });

  assert.equal(truckId, "logged-truck");
});

test("office material-log editor includes active truck inventory items so material can be added to a log", () => {
  const items = [
    { id: "accufoam_a", name: "Accufoam A" },
    { id: "accufoam_b", name: "Accufoam B" },
    { id: "blown_fg", name: "Blown Fiberglass" },
  ];

  const editable = buildEditableMaterialItems({
    inventoryItems: items,
    existingMaterials: { accufoam_a: 0.1 },
    truckInventory: { accufoam_b: 2, blown_fg: 0 },
  }).map((item) => item.id);

  assert.deepEqual(editable, ["accufoam_a", "accufoam_b"]);
});
