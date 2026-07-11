#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

require(path.resolve(__dirname, '../../static/pianoroll/core/clip_split_group.js'));
const Seq = require(path.resolve(__dirname, '../../static/pianoroll/core/timeline_sequence_place.js'));
global.window = global;
require(path.resolve(__dirname, '../../static/pianoroll/project.js'));
const P = global.H2SProject;

(function () {
  const project = {
    bpm: 120,
    ui: { playheadSec: 5 },
    clips: [
      { id: 'c1', meta: { splitGroupId: 'g', splitIndex: 0, splitCount: 2, splitSourceSpanSec: 10 }, score: { tracks: [{ notes: [{ start: 0, duration: 1, pitch: 60 }] }] } },
      { id: 'c2', meta: { splitGroupId: 'g', splitIndex: 1, splitCount: 2, splitSourceSpanSec: 8 }, score: { tracks: [{ notes: [{ start: 0, duration: 1, pitch: 62 }] }] } },
    ],
    instances: [{ id: 'i1', clipId: 'c1', startSec: 16, trackIndex: 0 }],
  };
  const anchorEnd = Seq.resolvePlacementAnchorSec('selectionEnd', {
    project,
    selectedInstanceId: 'i1',
    H2SProject: P,
  });
  assert.strictEqual(anchorEnd, 26);
  const plan = Seq.planSequentialPlacements(project, ['c2', 'c1'], { anchorSec: 16 }, P);
  assert.strictEqual(plan.ok, true);
  assert.strictEqual(plan.placements.length, 2);
  assert.strictEqual(plan.placements[0].clipId, 'c1');
  assert.strictEqual(plan.placements[0].startSec, 16);
  assert.strictEqual(plan.placements[1].startSec, 26);
})();

(function () {
  const project = {
    clips: [{ id: 'c1', meta: { splitSourceSpanSec: 4 }, score: { tracks: [{ notes: [] }] } }],
    instances: [{ id: 'i1', clipId: 'c1', startSec: 0, trackIndex: 0 }, { id: 'i2', clipId: 'c1', startSec: 10, trackIndex: 0 }],
  };
  const updates = Seq.compactInstancesOnTrack(project.instances, project, 0, 0, P);
  assert.strictEqual(updates.length, 2);
  assert.strictEqual(project.instances[0].startSec, 0);
  assert.strictEqual(project.instances[1].startSec, 4);
})();

console.log('timeline_sequence_place.test.js: ok');
