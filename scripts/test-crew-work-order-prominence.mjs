import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/App.jsx', 'utf8');

assert.match(
  source,
  /function\s+getJobWorkOrderPhoto\s*\(job\)/,
  'Crew job cards should use a dedicated helper to identify scanned work-order photos'
);

assert.match(
  source,
  /const\s+workOrderPhoto\s*=\s*getJobWorkOrderPhoto\(job\)/,
  'Crew job card render should find the work-order photo for each job'
);

const workOrderButtonIndex = source.indexOf('📋 Work Order');
const addressLinkIndex = source.indexOf('<a href={mapsUrl(job.address)}');
assert.ok(workOrderButtonIndex !== -1, 'Crew job card should render a prominent Work Order button');
assert.ok(addressLinkIndex !== -1, 'Crew job card should still render the address link');
assert.ok(
  workOrderButtonIndex < addressLinkIndex,
  'Work Order access should appear before the address/details so it is the first job-card action crews see'
);

assert.match(
  source,
  /boxShadow:\s*"0 0 0 1px rgba\(251,191,36,0\.5\), 0 0 24px rgba\(245,158,11,0\.35\)"/,
  'Work Order button should be visually glowing/prominent'
);

assert.match(
  source,
  /window\.open\(workOrderPhoto\.url,\s*"_blank",\s*"noopener,noreferrer"\)/,
  'Work Order button should open the attached scan/photo immediately'
);

console.log('crew work-order prominence checks passed');
