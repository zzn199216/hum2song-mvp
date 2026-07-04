#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const Undo = require(path.resolve(__dirname, '../../static/pianoroll/core/project_last_undo.js'));

(function () {
  Undo.clear();
  assert.strictEqual(Undo.canUndo('timeline'), false);
  assert.strictEqual(Undo.canUndo('editor'), false);

  const timelineDoc = { version: 2, instances: [{ id: 'inst_a' }] };
  Undo.capture('timeline', timelineDoc, { label: 'remove_instance' });
  assert.strictEqual(Undo.canUndo('timeline'), true);
  assert.strictEqual(Undo.canUndo('editor'), false);

  const editorScore = { tracks: [{ id: 't0', notes: [{ id: 'n1', start: 0, duration: 1, pitch: 60 }] }] };
  Undo.capture('editor', editorScore, { label: 'delete_notes', ui: { selectedNoteId: 'n1' } });
  assert.strictEqual(Undo.canUndo('timeline'), true);
  assert.strictEqual(Undo.canUndo('editor'), true);

  timelineDoc.instances = [];
  const tSlot = Undo.consume('timeline');
  assert.strictEqual(tSlot.snapshot.instances.length, 1);
  assert.strictEqual(Undo.canUndo('timeline'), false);
  assert.strictEqual(Undo.canUndo('editor'), true);

  editorScore.tracks[0].notes = [];
  const eSlot = Undo.consume('editor');
  assert.strictEqual(eSlot.snapshot.tracks[0].notes.length, 1);
  assert.strictEqual(eSlot.ui.selectedNoteId, 'n1');
  assert.strictEqual(Undo.canUndo('editor'), false);
})();

console.log('project_last_undo.test.js: ok');
