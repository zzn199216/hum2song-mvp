#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const view = require(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'library_view.js'));

function testAudioOnlyButton(){
  const fmtSec = (value) => String(value) + 's';
  const escapeHtml = (value) => String(value);
  const audioHtml = view.clipCardInnerHTML({ id: 'audio_1', name: 'Voice', kind: 'audio' }, { count: 0, spanSec: 2 }, fmtSec, escapeHtml);
  const noteHtml = view.clipCardInnerHTML({ id: 'note_1', name: 'Notes', kind: 'note' }, { count: 1, spanSec: 2 }, fmtSec, escapeHtml);
  assert(audioHtml.includes('data-act="downloadAudio"'), 'audio clip should expose the local source download action');
  assert(!noteHtml.includes('data-act="downloadAudio"'), 'note clip should not expose an audio download action');
}

async function testControllerRoutesDownload(){
  const handlers = {};
  const rootEl = {
    addEventListener(type, handler, capture){
      if (type === 'click' && capture === true) handlers.click = handler;
    },
    removeEventListener(){},
  };
  const project = {
    version: 2,
    clips: { audio_1: { id: 'audio_1', kind: 'audio', audio: { assetRef: 'localidb:asset_1' } } },
    clipOrder: ['audio_1'],
  };
  let downloadedClipId = '';
  global.window = {
    H2SLibraryView: view,
    H2SProject: {
      isProjectV2(value){ return value === project; },
      clipKind(clip){ return clip && clip.kind; },
    },
  };
  const controllerPath = path.join(repoRoot, 'static', 'pianoroll', 'controllers', 'library_controller.js');
  delete require.cache[require.resolve(controllerPath)];
  const controller = require(controllerPath);
  controller.create({
    rootEl,
    getProjectV2(){ return project; },
    app: {
      downloadNativeAudioClip(clipId){
        downloadedClipId = clipId;
        return Promise.resolve({ ok: true });
      },
    },
  });
  assert.strictEqual(typeof handlers.click, 'function', 'library click handler should be bound');
  const button = {
    disabled: false,
    getAttribute(name){
      if (name === 'data-act') return 'downloadAudio';
      if (name === 'data-id') return 'audio_1';
      return null;
    },
  };
  let prevented = false;
  let stopped = false;
  handlers.click({
    target: { closest(selector){ return selector === '[data-act]' ? button : null; } },
    preventDefault(){ prevented = true; },
    stopPropagation(){ stopped = true; },
  });
  assert.strictEqual(button.disabled, true, 'download button should be disabled while the action is pending');
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(downloadedClipId, 'audio_1');
  assert.strictEqual(prevented, true);
  assert.strictEqual(stopped, true);
  assert.strictEqual(button.disabled, false, 'download button should be restored after completion');
  delete global.window;
}

function testAppUsesOnlyBrowserLocalFile(){
  const appSource = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'app.js'), 'utf8');
  const start = appSource.indexOf('async downloadNativeAudioClip(clipId)');
  const end = appSource.indexOf('\n    _ensureAudioWaveformEditor()', start);
  assert(start >= 0 && end > start, 'app should define downloadNativeAudioClip');
  const method = appSource.slice(start, end);
  assert(method.includes('this._resolveLocalAudioFileForClip(clipId)'), 'download should reuse the IndexedDB-backed local file');
  assert(method.includes('createObjectURL(file)'), 'download should use a browser blob URL');
  assert(method.includes('link.download'), 'download should use the browser download attribute');
  assert(method.includes('file.slice(0, 16).arrayBuffer()'), 'download should inspect ambiguous local files without re-downloading them');
  assert(method.includes('LAS.normalizeAudioDownloadFilename'), 'download should repair .bin names from MIME or audio signatures');
  assert(method.includes('revokeObjectURL'), 'download should release the temporary blob URL');
  assert(!/\bfetch\s*\(/.test(method), 'download must not fetch the source from the network');
  assert(!/XMLHttpRequest/.test(method), 'download must not issue an XHR');
  assert(appSource.includes('downloadOriginal(clipId)'), 'waveform editor should receive an original-audio download hook');
  assert(appSource.includes('return self.downloadNativeAudioClip(clipId)'), 'waveform hook should reuse the same browser-local download method');

  const waveformSource = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'audio_waveform_editor.js'), 'utf8');
  assert(waveformSource.includes('data-act="waveDownloadOriginal"'), 'audio segment editor should expose the original download button');
  assert(waveformSource.includes('hooks.downloadOriginal(openCtx.clipId)'), 'audio segment editor should download its current source clip');
}

function testLocales(){
  for (const locale of ['en', 'zh', 'ja']){
    const messages = JSON.parse(fs.readFileSync(path.join(repoRoot, 'static', 'i18n', 'locales', locale + '.json'), 'utf8'));
    for (const key of ['cliplib.downloadOriginal', 'cliplib.downloadOriginalTitle', 'cliplib.downloadMissing', 'cliplib.downloadFailed', 'audio.waveform.download', 'audio.waveform.downloadTitle']){
      assert.strictEqual(typeof messages[key], 'string', locale + ' missing ' + key);
      assert(messages[key].trim(), locale + ' has empty ' + key);
    }
  }
}

async function main(){
  testAudioOnlyButton();
  await testControllerRoutesDownload();
  testAppUsesOnlyBrowserLocalFile();
  testLocales();
  console.log('PASS browser-local original audio download');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
