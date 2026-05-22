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

(function testI18nLocaleCacheBust(){
  const i18nSrc = fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'i18n.js'), 'utf8');
  assert(i18nSrc.includes('H2S_STUDIO_ASSET_VERSION'), 'i18n load appends asset version to locale json');
  console.log('PASS i18n locale cache-bust');
})();

(function testGenerationRouterSegmentParams(){
  const genSrc = fs.readFileSync(path.join(repoRoot, 'routers', 'generation.py'), 'utf8');
  assert(genSrc.includes('segment_start_sec'), 'generate accepts segment_start_sec');
  assert(genSrc.includes('extract_audio_segment'), 'generate extracts segment');
  const pipeSrc = fs.readFileSync(path.join(repoRoot, 'core', 'pipeline.py'), 'utf8');
  assert(pipeSrc.includes('contract_task_id'), 'pipeline accepts contract task id');
  console.log('PASS generation segment API');
})();

(function testIndexCacheBustsSegmentUiScripts(){
  const indexHtml = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'index.html'), 'utf8');
  const ver = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'studio_asset_version.js'), 'utf8').match(
    /H2S_STUDIO_ASSET_VERSION\s*=\s*'([^']+)'/,
  )[1];
  assert(indexHtml.includes('library_view.js?v=' + ver), 'index cache-busts library_view');
  assert(indexHtml.includes('selection_view.js?v=' + ver), 'index cache-busts selection_view');
  assert(indexHtml.includes('selection_controller.js?v=' + ver), 'index cache-busts selection_controller');
  console.log('PASS index segment UI cache-bust');
})();

(function testSegmentI18n(){
  const en = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', 'en.json'), 'utf8'));
  const zh = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', 'zh.json'), 'utf8'));
  assert(en['cliplib.convertSegment'], 'en convertSegment');
  assert(zh['cliplib.convertSegment'].includes('片段'), 'zh convertSegment');
  console.log('PASS segment i18n');
})();
