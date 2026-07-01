import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/App.jsx', 'utf8');

assert.match(source, /JOB_UPDATE_TOAST_SEEN_STORAGE_KEY/, 'Job update toasts should persist seen update ids across app reloads');
assert.match(source, /mountedAtRef\s*=\s*useRef\(Date\.now\(\)\)/, 'Job update toast hook should remember app load time');
assert.match(source, /updateMillis\s*<\s*mountedAtRef\.current/, 'Existing Firestore updates from before app load should not toast when snapshots arrive');
assert.match(source, /localStorage\.setItem\(JOB_UPDATE_TOAST_SEEN_STORAGE_KEY/, 'Seen job updates should be saved after processing/dismissal');
assert.match(source, /onDismissAll/, 'Toast container should support clearing all job update popups at once');
assert.match(source, /Clear all/, 'Job update popup stack should expose an easy Clear all action');
assert.match(source, /setToasts\(\[\]\)/, 'Dismiss all should remove every active toast');

console.log('job update toast checks passed');
