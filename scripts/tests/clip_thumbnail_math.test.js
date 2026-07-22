#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const math = require(path.join(repoRoot, 'static', 'pianoroll', 'core', 'clip_thumbnail_math.js'));
const thumbView = require(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'clip_thumbnail_view.js'));

function noteClip(id, notes, meta) {
  return {
    id,
    name: id,
    kind: 'note',
    score: { tracks: [{ notes }] },
    ...(meta ? { meta } : {}),
  };
}

function testNoteExtraction() {
  const clip = noteClip('c1', [
    { startBeat: 0, durationBeat: 1, pitch: 60 },
    { startBeat: 2, durationBeat: 0.5, pitch: 64, velocity: 90 },
  ]);
  const p = math.deriveClipThumbnailPreview(clip);
  assert.equal(p.kind, 'notes');
  assert.equal(p.notes.length, 2);
  assert.equal(p.notes[0].pitch, 60);
  assert.equal(p.notes[1].velocity, 90);
  assert.ok(p.notes[0].startTime === 0);
}

function testV1SecScoreClip() {
  const notes = [];
  for (let i = 0; i < 10; i++) {
    notes.push({ start: i * 0.2, duration: 0.15, pitch: 60 + (i % 5) });
  }
  const clip = {
    id: 'test-mid',
    name: 'test — Mid',
    score: { tracks: [{ notes }] },
    meta: { notes: 10, pitchMin: 58, pitchMax: 66, spanSec: 2.5 },
  };
  const p = math.deriveClipThumbnailPreview(clip, { spanSec: 2.5 });
  assert.equal(p.kind, 'notes');
  assert.equal(p.timeUnit, 'sec');
  assert.equal(p.spanTime, 2.5);
  assert.equal(p.notes.length, 10);
  const html = thumbView.instThumbHTML(clip, 240, 60, { spanSec: 2.5 });
  assert.match(html, /instThumb/);
  assert.match(html, /instThumbCanvas/);
}

function testAudioSkipsScore() {
  const clip = {
    id: 'a1',
    kind: 'audio',
    audio: { durationSec: 3 },
    meta: { spanBeat: 6 },
    score: { tracks: [{ notes: [{ startBeat: 0, durationBeat: 1, pitch: 60 }] }] },
  };
  const p = math.deriveClipThumbnailPreview(clip);
  assert.equal(p.kind, 'audio');
  assert.equal(p.notes.length, 0);
  assert.equal(p.waveformPeaks.length, 0, 'audio preview never fabricates waveform peaks');
}

function testTruncation() {
  const notes = [];
  for (let i = 0; i < 300; i++) {
    notes.push({ startBeat: i * 0.25, durationBeat: 0.2, pitch: 60 + (i % 12) });
  }
  const p = math.deriveClipThumbnailPreview(noteClip('big', notes), { maxNotesPerClip: 20 });
  assert.equal(p.notes.length, 20);
  assert.equal(p.truncated, true);
}

function testCanvasRasterUsesEveryNote() {
  const notes = [];
  for (let i = 0; i < 1200; i++) {
    notes.push({ startBeat: i * 0.05, durationBeat: 0.03, pitch: 48 + (i % 36), velocity: 40 + (i % 80) });
  }
  const clip = noteClip('dense', notes, { spanBeat: 60 });
  const preview = math.deriveClipThumbnailPreview(clip, {
    maxNotesPerClip: Number.MAX_SAFE_INTEGER,
    maxScanNotesPerClip: Number.MAX_SAFE_INTEGER,
  });
  const raster = thumbView.buildMidiDrawCommands(preview, 800, 60);
  assert.equal(preview.notes.length, notes.length, 'canvas preview keeps every valid MIDI note');
  assert.equal(raster.commands.length, notes.length, 'every in-range MIDI note contributes a draw command');
  assert.ok(raster.commands.every((command) => command.width > 0 && command.height > 0));
}

function testEmptyClip() {
  const p = math.deriveClipThumbnailPreview(noteClip('empty', []));
  assert.equal(p.kind, 'empty');
}

function testInvalidNotesIgnored() {
  const clip = noteClip('x', [
    { startBeat: 'bad', durationBeat: 1, pitch: 60 },
    { startBeat: 0, durationBeat: 0, pitch: 60 },
    { startBeat: 1, durationBeat: 1, pitch: 64 },
  ]);
  const p = math.deriveClipThumbnailPreview(clip);
  assert.equal(p.kind, 'notes');
  assert.equal(p.notes.length, 1);
  assert.equal(p.notes[0].pitch, 64);
}

function testPitchRangePadding() {
  const p = math.deriveClipThumbnailPreview(
    noteClip('one', [{ startBeat: 0, durationBeat: 1, pitch: 72 }], { pitchMin: 72, pitchMax: 72, spanBeat: 4 }),
  );
  assert.equal(p.pitchMin, 71);
  assert.equal(p.pitchMax, 73);
}

function testMalformedClipSafe() {
  assert.doesNotThrow(() => {
    const p = math.deriveClipThumbnailPreview(null);
    assert.equal(p.kind, 'unsupported');
  });
}

function testSvgRendering() {
  const clip = noteClip('c1', [{ startBeat: 0, durationBeat: 2, pitch: 60 }]);
  const html = thumbView.instThumbHTML(clip, 160, 60);
  assert.match(html, /instThumb/);
  assert.match(html, /instThumbCanvas/);
  const audioHtml = thumbView.instThumbHTML({
    id: 'a1',
    kind: 'audio',
    audio: { durationSec: 2 },
    meta: { spanBeat: 4 },
  }, 120, 60);
  assert.match(audioHtml, /instThumbCanvas/);

  const legacySvg = thumbView.thumbnailSvgHTML(
    math.deriveClipThumbnailPreview(noteClip('legacy', [{ startBeat: 0, durationBeat: 1, pitch: 60 }])),
    120,
    60,
  );
  assert.match(legacySvg, /instThumbSvg/);
  assert.match(legacySvg, /<rect/);
}

function testTimelineViewIntegration() {
  const tv = require(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'timeline_view.js'));
  const clip = noteClip('melody', [
    { startBeat: 0, durationBeat: 1, pitch: 60 },
    { startBeat: 1, durationBeat: 1, pitch: 64 },
  ]);
  const html = tv.instanceInnerHTML({
    clip,
    clipName: 'melody',
    startSec: 0,
    noteCount: 2,
    thumbWidth: 140,
    thumbHeight: 60,
    fmtSec: (x) => String(x) + 's',
    escapeHtml: (s) => String(s),
  });
  assert.match(html, /data-role="inst-thumb"/);
  assert.match(html, /class="instBody/);
  assert.match(html, /data-act="remove"/);
}

function main() {
  testNoteExtraction();
  testV1SecScoreClip();
  testAudioSkipsScore();
  testTruncation();
  testCanvasRasterUsesEveryNote();
  testEmptyClip();
  testInvalidNotesIgnored();
  testPitchRangePadding();
  testMalformedClipSafe();
  testSvgRendering();
  testTimelineViewIntegration();
  console.log('clip_thumbnail_math.test.js: all passed');
}

main();
