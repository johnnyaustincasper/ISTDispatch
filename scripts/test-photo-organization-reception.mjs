import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const nav = fs.readFileSync('src/features/admin/adminNavigation.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.match(app, /const\s+PHOTO_TYPE_OPTIONS\s*=\s*\[/, 'photo categories should be defined centrally');
assert.match(app, /normalizePhotoType\(photo\?\.type/, 'old uncategorized photos should be normalized safely');
assert.match(app, /const\s+\[uploadPhotoType,\s*setUploadPhotoType\]\s*=\s*useState\("general"\)/, 'photo uploader should let user choose a category');
assert.match(app, /type:\s*normalizePhotoType\(uploadPhotoType\)/, 'new uploads should persist the selected photo category');
assert.match(app, /PHOTO_TYPE_OPTIONS\.map\(\(option\) => \{[\s\S]*photosForType/, 'photo section should group photos by category');
assert.match(app, /Open Original/, 'photo viewer should include an Open Original action');
assert.match(app, /onTouchStart/, 'photo viewer should support mobile swipe gestures');
assert.match(app, /setLightboxIdx\(\(idx\) => \(idx \+ 1\) % total\)/, 'photo viewer should navigate forward from swipe/next');

assert.match(nav, /reception:\s*"reception"/, 'office nav should include the Reception / Job Intake key');
assert.match(nav, /label:\s*"Intake"/, 'office nav should show an Intake tab');
assert.match(app, /reception:\s*<span[^>]*>🧾<\/span>/, 'office nav should have a receptionist/intake icon');
assert.match(app, /view === "reception"/, 'admin dashboard should render a Reception / Job Intake page');
assert.match(app, /Reception \/ Job Intake/, 'Reception page title should be visible');
assert.match(app, /getJobIntakeStatus\(job\)/, 'Reception page should compute each job intake status');
assert.match(app, /expectedMaterials/, 'Reception workflow should save expected material usage');
assert.match(app, /Expected vs Actual Materials/, 'Reception page should show expected-vs-actual material comparison');
assert.match(app, /laborMode[^\n]+"flat"|"flat"[^\n]+laborMode/, 'labor mode should include flat labor support for receptionist workflow');
assert.ok(pkg.scripts['test:photo-organization-reception'], 'package.json should expose the photo/reception regression test');
assert.ok(pkg.scripts.test.includes('test:photo-organization-reception'), 'aggregate npm test should include the photo/reception regression test');

console.log('photo organization and reception checks passed');
