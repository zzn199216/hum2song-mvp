#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'static/pianoroll/app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'static/pianoroll/index.html'), 'utf8');
const sel = fs.readFileSync(path.join(root, 'static/pianoroll/controllers/selection_controller.js'), 'utf8');
const timeline = fs.readFileSync(path.join(root, 'static/pianoroll/timeline_controller.js'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'static/pianoroll/internal_action_registry.js'), 'utf8');

assert(app.includes('captureTimelineUndo(label)'), 'app.js should expose captureTimelineUndo');
assert(app.includes('undoLastTimelineEdit()'), 'app.js should expose undoLastTimelineEdit');
assert(app.includes('H2SProjectLastUndo'), 'app.js should use H2SProjectLastUndo');
assert(/deleteInstance\(instId\)[\s\S]*?captureTimelineUndo\('remove_instance'\)/.test(app), 'deleteInstance should capture undo');
assert(/addClipToTimeline\([\s\S]*?captureTimelineUndo\('add_clip_to_timeline'\)/.test(app), 'addClipToTimeline should capture undo');
assert(index.includes('project_last_undo.js'), 'index.html should load project_last_undo.js');
assert(sel.includes('onUndoTimeline'), 'selection_controller should wire onUndoTimeline');
assert(/ctrlKey \|\| ev\.metaKey/.test(sel) && sel.includes("ev.key === 'z'"), 'selection_controller should bind Ctrl/Cmd+Z');
assert(timeline.includes('onBeginInstanceDrag'), 'timeline_controller should call onBeginInstanceDrag at drag start');
assert(registry.includes("captureTimelineUndo('move_instance')"), 'move_instance should capture undo before mutate');

console.log('timeline_undo.test.js: ok');
