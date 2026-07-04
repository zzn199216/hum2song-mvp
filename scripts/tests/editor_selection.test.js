#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

const Sel = require(path.resolve(__dirname, '../../static/pianoroll/core/editor_selection.js'));
const Coords = require(path.resolve(__dirname, '../../static/pianoroll/core/editor_coords.js'));

(function () {
  const score = {
    tracks: [
      { id: 't1', notes: [{ id: 'a', pitch: 60, start: 0, duration: 1, velocity: 90 }] },
      { id: 't2', notes: [{ id: 'b', pitch: 72, start: 2, duration: 1, velocity: 90 }] },
    ],
  };
  const refs = Sel.collectAllNoteRefs(score);
  assert.strictEqual(refs.length, 2);
  assert.strictEqual(refs[0].trackId, 't1');
})();

(function () {
  const score = {
    tracks: [{ id: 't1', notes: [{ id: 'a', pitch: 60, start: 1, duration: 1, velocity: 90 }] }],
  };
  const modal = { pxPerSec: 180, timeZoom: 1, padL: 60, padT: 20, pitchZoom: 1.25, pitchViewRows: 36, pitchCenter: 60 };
  const pitchWin = Coords.resolvePitchWindow(modal, { minPitch: 60, maxPitch: 60 });
  const rect = { x0: 200, y0: 0, x1: 400, y1: 200 };
  const hits = Sel.notesInRect(score, rect, Coords, modal, pitchWin);
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].noteId, 'a');
  assert.strictEqual(hits[0].trackId, 't1');
  assert.strictEqual(hits[0].noteIndex, 0);
})();

(function () {
  const Sel = require(path.resolve(__dirname, '../../static/pianoroll/core/editor_selection.js'));
  const score = {
    tracks: [{
      id: 't1',
      notes: [
        { id: 'dup', pitch: 60, start: 0, duration: 1, velocity: 90 },
        { id: 'dup', pitch: 62, start: 1, duration: 1, velocity: 90 },
        { id: 'other', pitch: 64, start: 2, duration: 1, velocity: 90 },
      ],
    }],
  };
  const selection = { noteRefs: [{ trackId: 't1', noteId: 'dup', noteIndex: 0 }], tool: 'pointer' };
  assert.strictEqual(Sel.noteRefKey(selection.noteRefs[0]), 't1\0i:0');
  assert.strictEqual(Sel.noteRefKey({ trackId: 't1', noteId: 'dup', noteIndex: 1 }), 't1\0i:1');
  const res = Sel.deleteSelectedNotes(JSON.parse(JSON.stringify(score)), selection);
  assert.strictEqual(res.deleted, 1);
  assert.strictEqual(res.score.tracks[0].notes.length, 2);
  assert.strictEqual(res.score.tracks[0].notes[0].id, 'dup');
  assert.strictEqual(res.score.tracks[0].notes[0].pitch, 62);
})();

(function () {
  const score = {
    tracks: [{
      id: 't1',
      notes: [
        { id: 'dup', pitch: 60, start: 0, duration: 1, velocity: 90 },
        { id: 'dup', pitch: 62, start: 1, duration: 1, velocity: 90 },
        { id: 'dup', pitch: 64, start: 2, duration: 1, velocity: 90 },
      ],
    }],
  };
  const refs = [{ trackId: 't1', noteId: 'dup', noteIndex: 1 }];
  const keys = Sel.buildSelectionHighlightSet(refs);
  assert.strictEqual(keys.size, 1);
  assert.strictEqual(keys.has(Sel.selectionHighlightKey('t1', 1)), true);
  assert.strictEqual(keys.has(Sel.selectionHighlightKey('t1', 0)), false);
  assert.strictEqual(keys.has(Sel.selectionHighlightKey('t1', 2)), false);
  assert.strictEqual(Sel.scoreHasDuplicateNoteIds(score), true);
})();

(function () {
  const score = {
    tracks: [{
      id: 't1',
      notes: [
        { id: 'a', pitch: 60, start: 0, duration: 1, velocity: 90 },
        { id: 'b', pitch: 62, start: 1, duration: 1, velocity: 90 },
      ],
    }],
  };
  const selection = { noteRefs: [{ trackId: 't1', noteId: 'a' }], tool: 'pointer' };
  const res = Sel.deleteSelectedNotes(JSON.parse(JSON.stringify(score)), selection);
  assert.strictEqual(res.deleted, 1);
  assert.strictEqual(res.score.tracks[0].notes.length, 1);
  assert.strictEqual(res.score.tracks[0].notes[0].id, 'b');
  const extracted = Sel.extractNotesToScore(JSON.parse(JSON.stringify(score)), selection);
  assert.ok(extracted && extracted.score);
  assert.strictEqual(extracted.score.tracks[0].notes[0].start, 0);
})();

(function () {
  // Shared note object in track array: highlight must use noteIndex, not object identity / noteId.
  const shared = { id: 'dup', pitch: 60, start: 0, duration: 1, velocity: 90 };
  const refs = [{ trackId: 't1', noteId: 'dup', noteIndex: 1 }];
  const keys = Sel.buildSelectionHighlightSet(refs);
  assert.strictEqual(keys.size, 1);
  assert.strictEqual(keys.has(Sel.selectionHighlightKey('t1', 1)), true);
  assert.strictEqual(keys.has(Sel.selectionHighlightKey('t1', 0)), false);
  assert.strictEqual(keys.has(Sel.selectionHighlightKey('t1', 2)), false);
})();

(function () {
  const extracted = Sel.extractNotesToScore(JSON.parse(JSON.stringify({
    tracks: [{
      id: 't1',
      notes: [
        { id: 'a', pitch: 60, start: 2.5, duration: 1, velocity: 90 },
        { id: 'b', pitch: 62, start: 5, duration: 1, velocity: 90 },
      ],
    }],
  })), { noteRefs: [{ trackId: 't1', noteId: 'b', noteIndex: 1 }], tool: 'pointer' }, { preserveStart: true });
  assert.strictEqual(extracted.score.tracks[0].notes[0].start, 5);
})();

(function () {
  const score = {
    tracks: [
      { id: 't1', name: 'A', notes: [{ id: 'a', pitch: 60, start: 1, duration: 1, velocity: 90 }] },
      { id: 't2', name: 'B', notes: [{ id: 'b', pitch: 72, start: 3, duration: 1, velocity: 90 }] },
    ],
  };
  const selection = {
    noteRefs: [
      { trackId: 't1', noteId: 'a', noteIndex: 0 },
      { trackId: 't2', noteId: 'b', noteIndex: 0 },
    ],
    tool: 'pointer',
  };
  const extracted = Sel.extractNotesToScore(JSON.parse(JSON.stringify(score)), selection, { preserveStart: true, singleTrack: true });
  assert.strictEqual(extracted.score.tracks.length, 1);
  assert.strictEqual(extracted.score.tracks[0].notes.length, 2);
  assert.strictEqual(extracted.score.tracks[0].notes[0].start, 1);
  assert.strictEqual(extracted.score.tracks[0].notes[1].start, 3);
})();

console.log('editor_selection.test.js: ok');
