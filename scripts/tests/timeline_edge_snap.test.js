#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

require(path.resolve(__dirname, '../../static/pianoroll/core/clip_split_group.js'));
require(path.resolve(__dirname, '../../static/pianoroll/core/timeline_sequence_place.js'));
const EdgeSnap = require(path.resolve(__dirname, '../../static/pianoroll/core/timeline_edge_snap.js'));
global.window = global;
require(path.resolve(__dirname, '../../static/pianoroll/project.js'));
const P = global.H2SProject;

(function () {
  const project = {
    clips: [{ id: 'c1', meta: { splitSourceSpanSec: 10 }, score: { tracks: [{ notes: [] }] } }],
    instances: [
      { id: 'a', clipId: 'c1', startSec: 0, trackIndex: 0 },
      { id: 'b', clipId: 'c1', startSec: 10, trackIndex: 0 },
    ],
  };
  const snapped = EdgeSnap.snapStartSecToInstanceEdges(10.02, 'b', project, {
    pxPerSec: 160,
    thresholdPx: 8,
    trackIndex: 0,
    H2SProject: P,
  });
  assert.strictEqual(snapped, 10);
})();

console.log('timeline_edge_snap.test.js: ok');
