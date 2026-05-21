import assert from 'node:assert/strict';

import {
  buildCrewJobActionModel,
  getCrewJobStatusMeta,
} from '../src/features/crew/jobCardPresentation.js';

const notStarted = buildCrewJobActionModel({ status: 'not_started', hasTodayMaterials: false });
assert.equal(notStarted.primary.key, 'start');
assert.equal(notStarted.primary.status, 'in_progress');
assert.equal(notStarted.primary.label, 'Start Job');
assert.deepEqual(notStarted.secondary.map((action) => action.key), ['materials', 'issue']);

const inProgress = buildCrewJobActionModel({ status: 'in_progress', hasTodayMaterials: true });
assert.equal(inProgress.primary.key, 'complete');
assert.equal(inProgress.primary.label, 'Finish Job');
assert.equal(inProgress.primary.status, 'completed');
assert.deepEqual(inProgress.secondary.map((action) => action.key), ['materials', 'update', 'issue']);
assert.equal(inProgress.secondary[0].label, 'Edit Materials');
assert.match(inProgress.prompt, /Finish when the work is done/);

const needsHelp = buildCrewJobActionModel({ status: 'issue', hasTodayMaterials: false });
assert.equal(needsHelp.primary.key, 'complete');
assert.deepEqual(needsHelp.secondary.map((action) => action.key), ['materials', 'update']);

const completed = buildCrewJobActionModel({ status: 'completed', hasTodayMaterials: true });
assert.equal(completed.primary.key, 'reopen');
assert.equal(completed.primary.status, 'in_progress');
assert.deepEqual(completed.secondary.map((action) => action.key), ['materials', 'details']);

assert.equal(getCrewJobStatusMeta('issue').label, 'Needs Help');
assert.equal(getCrewJobStatusMeta('unknown').label, 'Not Started');

console.log('crew job presentation tests passed');
