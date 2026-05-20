#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const index = fs.readFileSync(path.join(root, 'static/pianoroll/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'static/pianoroll/app.js'), 'utf8');
const timelineController = fs.readFileSync(path.join(root, 'static/pianoroll/timeline_controller.js'), 'utf8');
const libraryView = fs.readFileSync(path.join(root, 'static/pianoroll/ui/library_view.js'), 'utf8');
const timelineView = fs.readFileSync(path.join(root, 'static/pianoroll/ui/timeline_view.js'), 'utf8');

assert(/select\s*\{[^}]*background:\s*rgba\(0,0,0,\.[^)]+\)/s.test(index), 'native select controls should have a global dark background');
assert(/select\s+option[^{}]*\{[^}]*background:\s*#111827/s.test(index), 'native select options should use a dark option background where supported');
assert(/select:focus-visible/.test(index), 'native selects should have a visible focus ring');
assert(/textarea::placeholder/.test(index), 'textarea placeholders should remain readable in dark panels');
assert(!/#editorLlmModelSelect option\s*\{[^}]*background:\s*#fff/s.test(index), 'editor model dropdown should not force white option popups');
assert(!/#editorOptimizePreset option[^}]*background:\s*#fff/s.test(index), 'editor preset dropdowns should not force white option popups');

const htmlSelectIds = [
  'selLang',
  'selSamplerPack',
  'selClipFromProject',
  'selSnap',
  'editorOptimizePreset',
  'editorQuickOptimizePreset',
  'editorLlmGatewayPreset',
  'editorLlmModelSelect',
];
htmlSelectIds.forEach(function(id){
  assert(index.includes('id="' + id + '"'), 'expected native select in index.html: ' + id);
});

assert(!app.includes('<select id="inspAi_cloudPreset"'), 'Cloud AI preset selector should remain custom, not native');
assert(app.includes('data-cloud-ai-preset-list'), 'Cloud AI preset selector should render custom preset list');
assert(app.includes('data-cloud-ai-preset-item'), 'Cloud AI preset selector should render custom preset items');

assert(app.includes('data-act="inspOptimizePreset"'), 'inspector optimize preset select should remain present');
assert(libraryView.includes('data-act="inspRevSelect"'), 'inspector revision select should remain present');
assert(timelineController.includes('trackInstrumentSelect'), 'track instrument select should remain present');
assert(timelineView.includes('selTimelineSnap') || timelineController.includes('selTimelineSnap'), 'timeline snap select should remain present');

console.log('dark_select_styling.test.js ok');
