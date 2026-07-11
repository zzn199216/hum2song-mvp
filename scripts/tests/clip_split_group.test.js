#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

global.window = global;
require(path.resolve(__dirname, '../../static/pianoroll/project.js'));
const SG = require(path.resolve(__dirname, '../../static/pianoroll/core/clip_split_group.js'));
const P = global.H2SProject;

(function () {
  const id = SG.generateSplitGroupId();
  assert.ok(String(id).startsWith('sg_'));
})();

(function () {
  const clip = { id: 'c1', meta: {}, score: { tracks: [{ notes: [{ start: 0, duration: 2, pitch: 60 }] }] } };
  SG.applySplitGroupMeta(clip, {
    splitGroupId: 'sg_test',
    splitIndex: 2,
    splitCount: 5,
    splitSourceStartSec: 16,
    splitSourceSpanSec: 14,
  });
  assert.strictEqual(clip.meta.splitGroupId, 'sg_test');
  assert.strictEqual(clip.meta.splitIndex, 2);
  assert.strictEqual(clip.meta.splitCount, 5);
  assert.strictEqual(clip.meta.splitSourceSpanSec, 14);
  const noteSpan = P.scoreStats(clip.score).spanSec;
  assert.ok(noteSpan < 14, 'note span should be shorter than split span');
  assert.strictEqual(SG.getClipPlacementSpanSec(clip, P), 14);
})();

(function () {
  const a = { id: 'a', meta: { splitGroupId: 'g', splitIndex: 1, splitCount: 3 } };
  const b = { id: 'b', meta: { splitGroupId: 'g', splitIndex: 0, splitCount: 3 } };
  const sorted = SG.sortClipsForSequence([a, b]);
  assert.strictEqual(sorted[0].id, 'b');
  assert.strictEqual(SG.formatSplitGroupBadge(a), ' · 2/3');
})();

console.log('clip_split_group.test.js: ok');
