#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, ...rel), 'utf8');
}

(function testSharedFullAudioWorkerHelperExists(){
  const appSrc = read(['static', 'pianoroll', 'app.js']);
  assert(appSrc.includes('_tryWorkerConvertFileToEditable'), 'app should expose a shared file/blob worker conversion helper');
  assert(appSrc.includes('_materializeWorkerFileScoreAsClip'), 'worker full-audio output should materialize through one helper');
  assert(appSrc.includes('H2SAudioWorkerConversionClient'), 'shared helper should reuse the existing worker conversion client');
  assert(appSrc.includes('client.isCloudMode'), 'shared helper should only use worker bridge in Cloud mode');
  assert(appSrc.includes('worker_full_audio'), 'worker-created full audio clips should carry a distinguishable source marker');
  console.log('PASS shared full-audio worker helper exists');
})();

(function testUseLastRecordingIsWorkerFirst(){
  const appSrc = read(['static', 'pianoroll', 'app.js']);
  assert(/async useLastRecording\(\)\{[\s\S]*_tryWorkerConvertFileToEditable\([\s\S]*kind:\s*'recording'/.test(appSrc), 'useLastRecording should attempt worker conversion first for recordings');
  assert(/async useLastRecording\(\)\{[\s\S]*uploadFileAndGenerate\(this\.state\.lastRecordedFile/.test(appSrc), 'useLastRecording should preserve /generate fallback');
  assert(appSrc.includes('convert.phase.workerRecording'), 'recording worker status key should be used');
  console.log('PASS recording use-last worker-first fallback wiring');
})();

(function testTopBarEditableImportIsWorkerFirst(){
  const appSrc = read(['static', 'pianoroll', 'app.js']);
  assert(/async pickWavAndGenerate\(\)\{[\s\S]*_tryWorkerConvertFileToEditable\([\s\S]*kind:\s*'import'/.test(appSrc), 'editable top-bar import should attempt worker conversion first');
  assert(/async pickWavAndGenerate\(\)\{[\s\S]*uploadFileAndGenerate\(f\)/.test(appSrc), 'editable top-bar import should preserve /generate fallback');
  assert(appSrc.includes('convert.phase.workerImport'), 'import worker status key should be used');
  console.log('PASS top-bar editable import worker-first fallback wiring');
})();

(function testCheckboxOffAndCloudMaterialRemainAudioOnly(){
  const appSrc = read(['static', 'pianoroll', 'app.js']);
  assert(/if \(toNotes\) await this\.pickWavAndGenerate\(\);\s*else await this\.importAudioFileAsNativeClip\(\);/.test(appSrc), 'top-bar checkbox off should still import audio-only');
  const cloudSrc = read(['static', 'pianoroll', 'cloud_materials_panel.js']);
  assert(cloudSrc.includes('app._commitNativeAudioFile(file'), 'cloud material import should remain audio-only');
  assert(!cloudSrc.includes('_tryWorkerConvertFileToEditable'), 'cloud material import should not auto-convert through worker');
  console.log('PASS audio-only import paths remain unchanged');
})();

(function testWorkerFlagStillControlsFallback(){
  const clientSrc = read(['static', 'pianoroll', 'core', 'audio_worker_conversion_client.js']);
  assert(clientSrc.includes("params.get('workerConversion')"), 'query workerConversion flag remains supported');
  assert(clientSrc.includes("q === '0' || q === 'false'"), 'workerConversion=0 disables worker');
  assert(clientSrc.includes("localStorage.getItem(FLAG)"), 'localStorage worker flag remains supported');
  console.log('PASS worker flag controls worker-first paths');
})();
