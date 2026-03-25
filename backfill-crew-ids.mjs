// Backfill crewMemberIds for old jobs that are missing them
// Uses truck assignment to determine which crew members to add
// Run: node backfill-crew-ids.mjs

const PROJECT_ID = "insulation-services-da91a";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function get(path) {
  const res = await fetch(`${BASE}/${path}?pageSize=200`);
  return res.json();
}

async function patch(path, fields) {
  const body = { fields };
  const updateMask = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join("&");
  const res = await fetch(`${BASE}/${path}?${updateMask}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function parseStringVal(f) { return f?.stringValue ?? null; }
function parseArray(f) {
  if (!f?.arrayValue?.values) return [];
  return f.arrayValue.values.map(v => v.stringValue ?? null);
}

(async () => {
  // Load crew members (id -> truckId)
  const membersSnap = await get("crewMembers");
  const members = (membersSnap.documents || []).map(d => ({
    id: d.name.split("/").pop(),
    name: d.fields.name?.stringValue,
    truckId: d.fields.truckId?.stringValue ?? null,
  }));

  // Build truckId -> [memberId, ...] map
  const truckToMembers = {};
  for (const m of members) {
    if (m.truckId) {
      if (!truckToMembers[m.truckId]) truckToMembers[m.truckId] = [];
      truckToMembers[m.truckId].push(m.id);
    }
  }

  console.log("Truck → Members:");
  for (const [t, ids] of Object.entries(truckToMembers)) {
    const names = ids.map(id => members.find(m => m.id === id)?.name).join(", ");
    console.log(`  ${t} → ${names}`);
  }

  // Load all jobs
  const jobsSnap = await get("jobs");
  const jobs = (jobsSnap.documents || []).map(d => ({
    docId: d.name.split("/").pop(),
    builder: d.fields.builder?.stringValue,
    date: d.fields.date?.stringValue,
    truckId: d.fields.truckId?.stringValue ?? null,
    crewMemberIds: parseArray(d.fields.crewMemberIds),
  }));

  let updated = 0, skipped = 0;

  for (const job of jobs) {
    const hasCrewIds = job.crewMemberIds.some(id => id && id.trim());
    if (hasCrewIds) { skipped++; continue; }

    const truckId = job.truckId;
    if (!truckId) { console.log(`Skip (no truck): ${job.docId} - ${job.builder}`); skipped++; continue; }

    const crewIds = truckToMembers[truckId] || [];
    if (!crewIds.length) { console.log(`Skip (no crew for truck ${truckId}): ${job.docId} - ${job.builder}`); skipped++; continue; }

    // Build 4-slot array
    const slots = [crewIds[0]||null, crewIds[1]||null, crewIds[2]||null, crewIds[3]||null];
    const crewMemberIdsField = {
      arrayValue: {
        values: slots.map(id => id ? { stringValue: id } : { nullValue: null }),
      },
    };

    console.log(`Backfill: ${job.date} ${job.builder} → crew: ${slots.filter(Boolean).map(id => members.find(m => m.id === id)?.name).join(", ")}`);
    const result = await patch(`jobs/${job.docId}`, { crewMemberIds: crewMemberIdsField });
    if (result.error) {
      console.error("  ERROR:", result.error.message);
    } else {
      updated++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
})();
