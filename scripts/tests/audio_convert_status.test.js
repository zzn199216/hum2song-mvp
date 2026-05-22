#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');

(function testAppConversionStateHelpers(){
  const appSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'app.js'), 'utf8');
  assert(appSrc.includes('audioConvertByClipId'), 'state tracks per-clip conversion');
  assert(appSrc.includes('_isAudioConvertActive'), 'active guard for conversion');
  assert(appSrc.includes('_audioConvertStatusText'), 'safe conversion status text');
  assert(appSrc.includes('conversionClipId'), 'upload pipeline accepts conversionClipId');
  assert(/pollMaxMs = conversionClipId \? 600000 : 180000/.test(appSrc), 'longer poll for audio conversion');
  assert(appSrc.includes("'timed_out'"), 'timeout terminal phase');
  assert(appSrc.includes("errorBucket: 'missing_audio'"), 'missing audio bucket');
  assert(appSrc.includes("'score_fetch_failed'"), 'score fetch bucket');
  assert(appSrc.includes('_syncWaveformConvertStatus'), 'waveform status sync');
  assert(appSrc.includes('convert.fail.scoreFetch'), 'score fetch i18n');
  assert(appSrc.includes('[H2S convert]'), 'safe conversion logging');
  assert(!/\[H2S convert\][^\n]*https?:\/\//.test(appSrc), 'conversion logs must not include URLs');
  console.log('PASS app conversion state helpers');
})();

(function testLibraryConvertButtonDisabled(){
  const libSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'library_view.js'), 'utf8');
  assert(libSrc.includes('audioConvertState'), 'library view accepts convert state');
  assert(/convActive \? ' disabled'/.test(libSrc), 'convert button disabled while active');
  assert(libSrc.includes('clip-convert-status'), 'convert status line on card');
  const ctrlSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'controllers', 'library_controller.js'), 'utf8');
  assert(ctrlSrc.includes('getAudioConvertStateForClip'), 'controller passes convert state');
  assert(ctrlSrc.includes('_isAudioConvertActive'), 'controller blocks duplicate convert');
  console.log('PASS library convert disable + status');
})();

(function testConvertI18nKeys(){
  const zh = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', 'zh.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', 'en.json'), 'utf8'));
  const keys = [
    'convert.phase.timedOut',
    'convert.fail.needImportAudio',
    'convert.fail.scoreFetch',
    'convert.fail.segmentExtract',
    'convert.phase.processing',
    'convert.phase.failed',
  ];
  for (const k of keys){
    assert(typeof zh[k] === 'string' && zh[k], 'zh missing ' + k);
    assert(typeof en[k] === 'string' && en[k], 'en missing ' + k);
  }
  assert(zh['convert.phase.timedOut'].includes('超时'), 'zh timeout message');
  assert(zh['convert.fail.needImportAudio'].includes('导入'), 'zh need import message');
  console.log('PASS convert i18n keys');
})();
