#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

const Coords = require(path.resolve(__dirname, '../../static/pianoroll/core/editor_coords.js'));

(function () {
  const modal = { pxPerSec: 180, timeZoom: 2, padL: 60, padT: 20, pitchZoom: 1.25 };
  assert.strictEqual(Coords.effectivePxPerSec(modal), 360);
  assert.strictEqual(Coords.timeToX(1, modal), 60 + 360);
  assert.strictEqual(Coords.xToTime(420, modal), 1);
})();

(function () {
  const modal = { pxPerSec: 180, timeZoom: 1, padL: 60 };
  const tz = Coords.timeZoomForFitSpan(10, 1000, modal);
  assert.ok(tz > 0 && tz <= Coords.TIME_ZOOM_MAX);
})();

console.log('editor_coords.test.js: ok');
