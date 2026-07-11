#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

global.H2SScoreHeuristicSplit = require(path.resolve(__dirname, '../../static/pianoroll/core/score_heuristic_split.js'));
require(path.resolve(__dirname, '../../static/pianoroll/core/clip_split_group.js'));
global.window = global;
require(path.resolve(__dirname, '../../static/pianoroll/project.js'));
const AutoSplit = require(path.resolve(__dirname, '../../static/pianoroll/core/clip_auto_split.js'));
const P = global.H2SProject;

(function () {
  const prefs = AutoSplit.loadPrefs();
  assert.strictEqual(prefs.splitByPhrase, true);
  assert.strictEqual(prefs.splitByPitchRange, false);
  assert.ok(prefs.minGapSec >= 0.8 && prefs.minGapSec <= 1.0, 'default gap in 0.8–1.0s');
  assert.ok(prefs.maxDurationSec >= 12 && prefs.maxDurationSec <= 16, 'default max duration 12–16s');
})();

(function () {
  const score = {
    tracks: [{
      id: 'trk_1',
      notes: [
        { id: 'n1', pitch: 60, start: 0, duration: 0.5, velocity: 80 },
        { id: 'n2', pitch: 62, start: 15, duration: 0.5, velocity: 80 },
      ],
    }],
  };
  const plan = AutoSplit.planClipSegments(score, { splitByPhrase: true, minGapSec: 0.9, maxDurationSec: 14, splitByPitchRange: false, splitByBar: false });
  assert.ok(Array.isArray(plan) && plan.length >= 2, 'long gap should yield multiple clip segments');
})();

(function () {
  const score = {
    tracks: [{ id: 't1', notes: [{ id: 'n1', pitch: 60, start: 0, duration: 20, velocity: 80 }] }],
  };
  const plan = AutoSplit.planClipSegments(score, {
    splitByPhrase: false,
    splitByPitchRange: false,
    splitByBar: false,
    minGapSec: 0.9,
    maxDurationSec: 14,
  });
  assert.strictEqual(plan.length, 1);
})();

(function () {
  const score = {
    tracks: [{
      id: 'trk_1',
      notes: [
        { id: 'n1', pitch: 60, start: 0, duration: 0.5, velocity: 80 },
        { id: 'n2', pitch: 62, start: 15, duration: 0.5, velocity: 80 },
      ],
    }],
  };
  const added = [];
  const ctx = {
    project: { clips: [], instances: [], tracks: [{ id: 'trk_1', name: 'Track 1' }] },
    H2SProject: P,
    persist: () => {},
    render: () => {},
    addClipToTimeline: (clipId) => { added.push(clipId); },
    playheadSec: 0,
  };
  const plan = AutoSplit.planClipSegments(score, { splitByPhrase: true, minGapSec: 0.9, maxDurationSec: 14, splitByPitchRange: false, splitByBar: false });
  const res = AutoSplit.materializePlannedClips(ctx, plan, { baseName: 'Test' });
  assert.ok(res.ok && res.clipCount >= 2);
  const groupIds = ctx.project.clips.map((c) => c.meta && c.meta.splitGroupId).filter(Boolean);
  assert.strictEqual(new Set(groupIds).size, 1, 'all clips share one splitGroupId');
  const first = ctx.project.clips.find((c) => c.meta && c.meta.splitIndex === 0);
  assert.ok(first && first.meta.splitSourceSpanSec > 0, 'splitSourceSpanSec preserved');
})();

console.log('clip_auto_split.test.js: ok');
