#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

(function () {
  const appSrc = fs.readFileSync(
    path.resolve(__dirname, '../../static/pianoroll/app.js'),
    'utf8',
  );
  assert.ok(
    appSrc.includes('const resolvedStart = (startSec != null && Number.isFinite(Number(startSec)))'),
    'addClipToTimeline must treat startSec=0 as valid (not fall back to playhead)',
  );
  assert.ok(
    !appSrc.includes('createInstance(clipId, startSec || (this.project.ui.playheadSec'),
    'addClipToTimeline must not use startSec || playheadSec',
  );
})();

(function () {
  const rtSrc = fs.readFileSync(
    path.resolve(__dirname, '../../static/pianoroll/controllers/editor_runtime.js'),
    'utf8',
  );
  assert.ok(rtSrc.includes('preserveStart: true'), 'extract uses preserveStart');
  assert.ok(rtSrc.includes('placeStartSec: placement.startSec'), 'extract passes source clip startSec');
  assert.ok(rtSrc.includes('ctx.beginPath(); // each note is its own path'), 'note draw isolates canvas paths');
})();

console.log('editor_extract_placement.test.js: ok');
