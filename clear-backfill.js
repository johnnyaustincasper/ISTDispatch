// Script to clear crewMemberIds from backfilled jobs
// These jobs were updated at ~2026-03-25T22:07:49 by the backfill script
// They are OLD jobs (March 4-5) that predated the crewMemberIds feature

const BACKFILLED_JOBS = [
  '4t0sUqv1hmimVTnFuYg4',  // March 5
  '8JQRSUIxWJ1ya49MPErl',  // March 4
  'InOew5wmDdSfSpAi9CT7',  // March 4
  'S9JKwhx3w6jIISifv2Kh',  // March 5
  'ZbPLAM71wzzK3toizZ0U',  // March 5
  'hlIPvtvK20D824zqFN23',  // March 4
  'oTlvNTaNUZq6imU8sziW',  // March 4
  'pLuTlmE4lIt5EH4E5Dz4',  // March 5
];

const PROJECT = 'insulation-services-da91a';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/jobs`;

async function clearCrewMemberIds(jobId) {
  const url = `${BASE_URL}/${jobId}?updateMask.fieldPaths=crewMemberIds`;
  const body = {
    fields: {
      crewMemberIds: {
        arrayValue: { values: [] }
      }
    }
  };
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (res.ok) {
    console.log(`✓ Cleared crewMemberIds for ${jobId}`);
  } else {
    const err = await res.text();
    console.error(`✗ Failed for ${jobId}: ${err}`);
  }
}

async function main() {
  for (const jobId of BACKFILLED_JOBS) {
    await clearCrewMemberIds(jobId);
  }
  console.log('Done');
}

main();
