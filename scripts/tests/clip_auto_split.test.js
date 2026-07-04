#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

global.H2SScoreHeuristicSplit = require(path.resolve(__dirname, '../../static/pianoroll/core/score_heuristic_split.js'));
const AutoSplit = require(path.resolve(__dirname, '../../static/pianoroll/core/clip_auto_split.js'));

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

console.log('clip_auto_split.test.js: ok');
