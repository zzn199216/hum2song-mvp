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
  assert.strictEqual(Undo.depth('timeline'), 1);
  assert.strictEqual(Undo.canUndo('editor'), false);

  const scoreV1 = { tracks: [{ id: 't0', notes: [{ id: 'n1', start: 0, duration: 1, pitch: 60 }] }] };
  const scoreV2 = { tracks: [{ id: 't0', notes: [{ id: 'n1', start: 0, duration: 1, pitch: 60 }, { id: 'n2', start: 1, duration: 1, pitch: 62 }] }] };
  const scoreV3 = { tracks: [{ id: 't0', notes: [{ id: 'n2', start: 1, duration: 1, pitch: 62 }] }] };

  Undo.capture('editor', scoreV1, { label: 'insert_note' });
  Undo.capture('editor', scoreV2, { label: 'insert_note' });
  assert.strictEqual(Undo.depth('editor'), 2);

  const u1 = Undo.consume('editor');
  assert.strictEqual(u1.snapshot.tracks[0].notes.length, 2);
  assert.strictEqual(Undo.depth('editor'), 1);

  Undo.capture('editor', scoreV3, { label: 'delete_note' });
  assert.strictEqual(Undo.depth('editor'), 2);

  const u2 = Undo.consume('editor');
  assert.strictEqual(u2.snapshot.tracks[0].notes.length, 1);
  assert.strictEqual(u2.snapshot.tracks[0].notes[0].id, 'n2');
  const u3 = Undo.consume('editor');
  assert.strictEqual(u3.snapshot.tracks[0].notes.length, 1);
  assert.strictEqual(u3.snapshot.tracks[0].notes[0].id, 'n1');
  assert.strictEqual(Undo.canUndo('editor'), false);

  Undo.capture('editor', scoreV1, { label: 'drag_note', mergeKey: 'drag:n1' });
  assert.strictEqual(Undo.capture('editor', scoreV1, { label: 'drag_note', mergeKey: 'drag:n1' }), false);
  assert.strictEqual(Undo.depth('editor'), 1);

  timelineDoc.instances = [];
  const tSlot = Undo.consume('timeline');
  assert.strictEqual(tSlot.snapshot.instances.length, 1);
  assert.strictEqual(Undo.canUndo('timeline'), false);
})();

console.log('project_last_undo.test.js: ok');
