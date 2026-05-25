#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg){
  if (!cond) throw new Error(msg || 'assertion failed');
}

const repoRoot = path.resolve(__dirname, '../..');
const editorRuntime = fs.readFileSync(path.join(repoRoot, 'static/pianoroll/controllers/editor_runtime.js'), 'utf8');
const libraryController = fs.readFileSync(path.join(repoRoot, 'static/pianoroll/controllers/library_controller.js'), 'utf8');

assert(
  !/res\s*&&\s*res\.ok\s*&&\s*typeof\s+app\.playClip\s*===\s*['"]function['"][\s\S]{0,120}app\.playClip\s*\(\s*clipId\s*\)/.test(editorRuntime),
  'editor optimize success must not auto-play the optimized clip',
);

assert(
  /act\s*===\s*['"]play['"][\s\S]{0,180}opts\.onPlay\s*\(\s*clipId\s*\)/.test(libraryController),
  'explicit library Play action must still call onPlay(clipId)',
);

console.log('PASS editor optimize does not auto-play clips');
