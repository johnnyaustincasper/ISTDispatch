import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/App.jsx', 'utf8');

assert.match(
  source,
  /maxWidth:\s*"min\(900px,\s*100%\)"/,
  'Lightbox image row should never be wider than the mobile viewport'
);

assert.match(
  source,
  /boxSizing:\s*"border-box"/,
  'Lightbox overlay/row should use border-box sizing so padding does not create horizontal overflow'
);

assert.match(
  source,
  /minWidth:\s*0/,
  'Lightbox image should be allowed to shrink between nav buttons on narrow screens'
);

assert.match(
  source,
  /maxWidth:\s*"calc\(100vw - 120px\)"/,
  'Lightbox image should cap width on phones after accounting for nav buttons and gaps'
);

assert.match(
  source,
  /maxHeight:\s*"calc\(100dvh - 150px\)"/,
  'Lightbox image should fit within the visible mobile viewport height with controls/metadata'
);

console.log('mobile photo lightbox checks passed');
