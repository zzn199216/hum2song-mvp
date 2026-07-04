#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const editor = fs.readFileSync(path.join(root, 'static/pianoroll/controllers/editor_runtime.js'), 'utf8');
const en = JSON.parse(fs.readFileSync(path.join(root, 'static/i18n/locales/en.json'), 'utf8'));

assert(editor.includes('modalCaptureEditorUndo'), 'editor_runtime should expose modalCaptureEditorUndo');
assert(editor.includes('modalUndoLastEdit'), 'editor_runtime should expose modalUndoLastEdit');
assert(editor.includes("Undo.capture('editor'"), 'editor should capture editor-scoped undo');
assert(editor.includes("Undo.consume('editor')"), 'editor should consume editor-scoped undo');
assert(/modalDeleteSelectedNotes[\s\S]*?modalCaptureEditorUndo\('delete_notes'\)/.test(editor), 'delete notes should capture undo');
assert(/modalInsertNote[\s\S]*?modalCaptureEditorUndo\('insert_note'\)/.test(editor), 'insert note should capture undo');
assert(/modalPasteNotes[\s\S]*?modalCaptureEditorUndo\('paste_notes'\)/.test(editor), 'paste should capture undo');
assert(editor.includes("'resize_note' : 'drag_note'"), 'drag/resize note should capture undo');
assert(editor.includes("modalCaptureEditorUndo('edit_velocity')"), 'velocity edit should capture undo');
assert(/ctrlKey \|\| ev\.metaKey[\s\S]*?modalUndoLastEdit/.test(editor), 'editor should bind Ctrl/Cmd+Z');
assert(editor.includes("H2SProjectLastUndo.clear('editor')"), 'editor should clear undo slot on open/close');
assert(en['editor.undoDone'], 'en locale should define editor.undoDone');

console.log('editor_undo.test.js: ok');
