#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');

(function testWorkerConversionClientSource(){
  const clientSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'core', 'audio_worker_conversion_client.js'), 'utf8');
  assert(clientSrc.includes('H2S_STUDIO_WORKER_CONVERSION_ENABLED'), 'feature flag is checked');
  assert(clientSrc.includes("params.get('workerConversion')"), 'worker conversion can be enabled by iframe query param');
  assert(clientSrc.includes('H2S_CLOUD_AUDIO_TO_MIDI_JOB_CREATE'), 'create bridge request');
  assert(clientSrc.includes('H2S_CLOUD_AUDIO_TO_MIDI_JOB_STATUS'), 'status bridge request');
  assert(clientSrc.includes('H2S_CLOUD_AUDIO_TO_MIDI_JOB_RESULT'), 'result bridge request');
  assert(clientSrc.includes('postMessage'), 'uses postMessage bridge');
  assert(!/Bearer|Authorization|accessToken|token/i.test(clientSrc), 'client must not mention raw auth tokens');
  console.log('PASS worker conversion client source');
})();

(function testAppWorkerFallbackWiring(){
  const appSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'app.js'), 'utf8');
  assert(appSrc.includes('_tryWorkerConvertAudioClipToEditable'), 'app has worker conversion attempt');
  assert(appSrc.includes('worker_unavailable'), 'app tracks worker unavailable fallback');
  assert(/await this\._tryWorkerConvertAudioClipToEditable\(clipId, file, seg, opts\)/.test(appSrc), 'convert tries worker before local upload');
  assert(/await this\.uploadFileAndGenerate\(file, uploadOpts\)/.test(appSrc), 'local fallback path remains');
  assert(appSrc.includes('workerJobId'), 'worker job id is preserved in status/meta');
  console.log('PASS app worker conversion fallback wiring');
})();

(function testIndexLoadsWorkerClientBeforeApp(){
  const indexHtml = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'index.html'), 'utf8');
  assert(indexHtml.includes('core/audio_worker_conversion_client.js'), 'index loads worker conversion client');
  assert(indexHtml.includes('worker-conversion-v0'), 'index cache-busts worker conversion release');
  assert(indexHtml.indexOf('core/audio_worker_conversion_client.js') < indexHtml.indexOf('app.js?v='), 'worker client loads before app');
  console.log('PASS index worker conversion client load order');
})();
