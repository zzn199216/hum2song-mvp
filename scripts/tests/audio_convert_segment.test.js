#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');

(function testSegmentModule(){
  const segSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'core', 'audio_convert_segment.js'), 'utf8');
  assert(segSrc.includes('defaultSegmentForAudioClip'), 'segment helpers exported');
  assert(segSrc.includes('clampSegment'), 'clamp helper');
  console.log('PASS audio_convert_segment module');
})();

(function testAppWiresSegmentToGenerate(){
  const appSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'app.js'), 'utf8');
  assert(appSrc.includes('segment_start_sec'), 'API.generate sends segment_start_sec');
  assert(appSrc.includes('segment_duration_sec'), 'API.generate sends segment_duration_sec');
  assert(appSrc.includes('getAudioConvertSegment'), 'app tracks segment per clip');
  assert(appSrc.includes('cliplib.convertSegment'), 'convert uses segment label');
  console.log('PASS app segment generate wiring');
})();

(function testSelectionViewSegmentPanel(){
  const viewSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'selection_view.js'), 'utf8');
  assert(viewSrc.includes('audioSegmentPanelHTML'), 'selection view segment panel');
  assert(viewSrc.includes('segAtPlayhead'), 'playhead preset control');
  assert(viewSrc.includes('segLen30'), '30s preset');
  console.log('PASS selection segment panel');
})();

(function testGenerationRouterSegmentParams(){
  const genSrc = fs.readFileSync(path.join(repoRoot, 'routers', 'generation.py'), 'utf8');
  assert(genSrc.includes('segment_start_sec'), 'generate accepts segment_start_sec');
  assert(genSrc.includes('extract_audio_segment'), 'generate extracts segment');
  console.log('PASS generation segment API');
})();

(function testSegmentI18n(){
  const en = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', 'en.json'), 'utf8'));
  const zh = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', 'zh.json'), 'utf8'));
  assert(en['cliplib.convertSegment'], 'en convertSegment');
  assert(zh['cliplib.convertSegment'].includes('片段'), 'zh convertSegment');
  console.log('PASS segment i18n');
})();
