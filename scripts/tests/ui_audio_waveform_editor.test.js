#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');

(function testWaveformModulePure(){
  const W = require(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'audio_waveform_editor.js'));
  const seg = W.clampSelection(120, 10, 45);
  assert.strictEqual(seg.startSec, 10);
  assert.strictEqual(seg.endSec, 45);
  assert.strictEqual(seg.durationSec, 35);
  const peaks = W.computePeaksFromChannel(new Float32Array([0, 0.5, -1, 0.25]), 4);
  assert.strictEqual(peaks.length, 4);
  assert.ok(peaks[2] >= peaks[0]);
  console.log('PASS waveform editor pure helpers');
})();

(function testAppRoutesAudioToWaveform(){
  const appSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'app.js'), 'utf8');
  assert(appSrc.includes('openAudioWaveformEditor'), 'app defines openAudioWaveformEditor');
  assert(appSrc.includes('_clipIsAudioForEditor'), 'app detects audio clips');
  assert(/openClipEditor\(clipId\)\{[\s\S]*openAudioWaveformEditor/.test(appSrc), 'openClipEditor routes audio to waveform');
  assert(appSrc.includes('extractAudioClipSegmentAsNewClip'), 'app extracts non-destructive segment clip');
  assert(appSrc.includes('audio.waveform.missingFile'), 'friendly missing-audio message');
  assert(!appSrc.includes('msg.audioClipNoEditor'), 'app must not surface raw audioClipNoEditor');
  console.log('PASS app audio open routing');
})();

(function testEditorRuntimeNoAlert(){
  const edSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'controllers', 'editor_runtime.js'), 'utf8');
  assert(!edSrc.includes('msg.audioClipNoEditor'), 'editor runtime must not alert audioClipNoEditor');
  assert(/if \(audioGuard\)\{[\s\S]*return;/.test(edSrc), 'audio guard returns silently');
  console.log('PASS editor_runtime audio guard');
})();

(function testIndexLoadsWaveformScript(){
  const indexHtml = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'index.html'), 'utf8');
  const ver = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'studio_asset_version.js'), 'utf8').match(
    /H2S_STUDIO_ASSET_VERSION\s*=\s*'([^']+)'/,
  )[1];
  assert(indexHtml.includes('audio_waveform_editor.js?v=' + ver), 'index loads waveform editor');
  assert(indexHtml.includes('app.js?v=' + ver), 'index cache-busts app.js');
  console.log('PASS index waveform script');
})();

(function testSelectionAdvancedPanel(){
  const viewSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'selection_view.js'), 'utf8');
  assert(viewSrc.includes('h2s-audio-segment-advanced'), 'advanced segment collapsible');
  assert(viewSrc.includes('advancedSegmentTitle'), 'advanced title option');
  assert(!viewSrc.includes('btn mini primary" type="button" data-act="convertAudioEditable"'), 'inspector convert not primary');
  console.log('PASS selection advanced panel');
})();

(function testWaveformI18n(){
  const en = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', 'en.json'), 'utf8'));
  const zh = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', 'zh.json'), 'utf8'));
  assert(en['audio.waveform.title'] === 'Audio segment editor');
  assert(zh['audio.waveform.title'] === '音频片段编辑');
  assert(zh['audio.waveform.missingFile'].includes('重新导入'));
  assert(zh['convert.fail.scoreFetch'].includes('结果读取失败'));
  console.log('PASS waveform i18n');
})();

(function testWaveformConvertStatusUi(){
  const wfSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'audio_waveform_editor.js'), 'utf8');
  assert(wfSrc.includes('setConvertStatus'), 'waveform editor exposes convert status');
  assert(wfSrc.includes('data-act="waveRetry"'), 'retry button in modal');
  assert(wfSrc.includes('retryConvert'), 'retry hook');
  const appSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'app.js'), 'utf8');
  assert(appSrc.includes('getConvertState'), 'app provides convert state to waveform');
  console.log('PASS waveform convert status UI');
})();
