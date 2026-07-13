#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

(function testSharedSettingsTriggers(){
  const view = require(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'selection_view.js'));
  const html = view.audioSegmentPanelHTML({
    escapeHtml: (value) => String(value),
    transcriptionSettingsLabel: 'Transcription settings',
  });
  assert(html.includes('data-act="transcriptionSettings"'));
  assert(html.includes('Transcription settings'));
  assert(!html.includes('data-field="transcriptionTarget"'));
  assert(!html.includes('data-field="preserveRawCandidates"'));

  const libraryView = require(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'library_view.js'));
  const card = libraryView.clipCardInnerHTML(
    { id: 'audio-1', name: 'Original', kind: 'audio', audio: { durationSec: 12 } },
    { count: 0, spanSec: 12 },
    (value) => String(value),
    (value) => String(value)
  );
  assert(card.includes('data-act="convertToEditable"'));
  assert(card.includes('data-act="transcriptionSettings"'));
  assert(card.includes('transcriptionSettingsIconBtn'));
  console.log('PASS shared transcription settings triggers');
})();

(function testTranscriptionSettingsModalMarkup(){
  const indexHtml = read('static', 'pianoroll', 'index.html');
  assert(indexHtml.includes('id="topbarTranscriptionGroup"'));
  assert(indexHtml.includes('class="transcriptionImportToggle"'));
  assert(indexHtml.includes('data-transcription-mode-on'));
  assert(indexHtml.includes('data-transcription-mode-off'));
  assert(indexHtml.includes('id="btnTopImportTranscriptionSettings"'));
  assert(indexHtml.includes('id="transcriptionSettingsModal"'));
  assert(indexHtml.includes('id="transcriptionSettingsTarget"'));
  assert(indexHtml.includes('id="transcriptionSettingsCleanup"'));
  assert(indexHtml.includes('id="transcriptionSettingsCleanupValue"'));
  assert(indexHtml.includes('id="transcriptionSettingsPreserveRaw"'));
  assert(indexHtml.includes('data-transcription-settings-close'));
  for (const target of ['auto', 'ai_full_mix', 'melody', 'chords', 'vocal_humming', 'piano_guitar', 'electronic_melody', 'pad_chords']) {
    assert(indexHtml.includes(`option value="${target}"`), `settings modal should include ${target}`);
  }
  console.log('PASS transcription settings modal markup');
})();

(function testLibrarySettingsButtonOpensSharedModal(){
  const previousWindow = global.window;
  const listeners = {};
  const rootEl = {
    addEventListener: (name, handler, capture) => { if (name === 'click' && capture === true) listeners.click = handler; },
    removeEventListener: () => {},
  };
  let opened = null;
  const app = {
    openTranscriptionSettings: (options) => { opened = options; },
  };
  global.window = {};
  const controllerPath = path.join(repoRoot, 'static', 'pianoroll', 'controllers', 'library_controller.js');
  delete require.cache[require.resolve(controllerPath)];
  const controller = require(controllerPath);
  controller.create({ rootEl, app });
  const button = {
    getAttribute: (name) => ({ 'data-act': 'transcriptionSettings', 'data-id': 'audio-1' }[name] || ''),
  };
  let prevented = false;
  let stopped = false;
  listeners.click({
    target: {
      closest: (selector) => selector === '[data-act]' ? button : null,
    },
    preventDefault: () => { prevented = true; },
    stopPropagation: () => { stopped = true; },
  });
  assert(opened, 'library settings button should open the shared modal');
  assert.equal(opened.clipId, 'audio-1');
  assert.strictEqual(opened.trigger, button);
  assert(prevented && stopped, 'settings button should not select the clip card or timeline');
  delete require.cache[require.resolve(controllerPath)];
  if (previousWindow === undefined) delete global.window;
  else global.window = previousWindow;
  console.log('PASS library transcription settings button behavior');
})();

(function testWorkerPayloadAndFallbackQuery(){
  const client = require(path.join(repoRoot, 'static', 'pianoroll', 'core', 'audio_worker_conversion_client.js'));
  assert.deepStrictEqual(client._normalizeTranscriptionControls({}), {
    transcriptionTarget: 'auto',
    cleanupStrength: 50,
    preserveRawCandidates: false,
  });
  assert.deepStrictEqual(client._normalizeTranscriptionControls({
    transcriptionTarget: 'melody', cleanupStrength: 75, preserveRawCandidates: true,
  }), {
    transcriptionTarget: 'melody',
    cleanupStrength: 75,
    preserveRawCandidates: true,
  });
  const clientSource = read('static', 'pianoroll', 'core', 'audio_worker_conversion_client.js');
  const appSource = read('static', 'pianoroll', 'app.js');
  assert(clientSource.includes('transcriptionTarget: controls.transcriptionTarget'));
  assert(clientSource.includes('cleanupStrength: controls.cleanupStrength'));
  assert(clientSource.includes('preserveRawCandidates: controls.preserveRawCandidates'));
  assert(appSource.includes("q.set('transcription_target'"));
  assert(appSource.includes("q.set('cleanup_strength'"));
  assert(appSource.includes("q.set('preserve_raw_candidates'"));
  assert(appSource.includes("ai_full_mix: 25"));
  assert(appSource.includes("melody: 70"));
  assert(appSource.includes("chords: 40"));
  assert(appSource.includes('this.pickWavAndGenerate(this.getTopBarImportTranscriptionControls())'));
  assert(appSource.includes("this._tryWorkerConvertFileToEditable(f, Object.assign({ kind: 'import' }, controls))"));
  assert(appSource.includes('this.uploadFileAndGenerate(f, controls)'));
  assert(appSource.includes('trigger.hidden = !enabled'));
  assert(appSource.includes("group.setAttribute('data-enabled', enabled ? 'true' : 'false')"));
  assert(appSource.includes("checkbox.addEventListener('change'"));
  assert(appSource.includes('openTranscriptionSettings(opts)'));
  assert(appSource.includes('this.setAudioTranscriptionControls(context.clipId, controls)'));
  assert(appSource.includes('this.setTopBarImportTranscriptionControls(controls)'));
  assert(appSource.includes("['pointerdown', 'mousedown', 'click', 'dblclick']"));
  console.log('PASS audio transcription controls request propagation');
})();

(function testControllerBindingsAndLocales(){
  const selectionController = read('static', 'pianoroll', 'controllers', 'selection_controller.js');
  const libraryController = read('static', 'pianoroll', 'controllers', 'library_controller.js');
  assert(selectionController.includes('onOpenTranscriptionSettings'));
  assert(libraryController.includes("act === 'transcriptionSettings'"));
  const settingsActionIndex = libraryController.indexOf("act === 'transcriptionSettings'");
  const selectionAfterSettingsIndex = libraryController.indexOf("if (typeof opts.onSelectClip === 'function')", settingsActionIndex);
  assert(settingsActionIndex < selectionAfterSettingsIndex);
  const en = JSON.parse(read('static', 'i18n', 'locales', 'en.json'));
  const zh = JSON.parse(read('static', 'i18n', 'locales', 'zh.json'));
  const ja = JSON.parse(read('static', 'i18n', 'locales', 'ja.json'));
  assert.equal(en['transcription.settings'], 'Transcription settings');
  assert.equal(zh['transcription.settings'], '转写设置');
  assert.equal(ja['transcription.settings'], '採譜設定');
  assert.equal(en['transcription.target.aiFullMix'], 'AI music / full song');
  assert.equal(zh['transcription.target.aiFullMix'], 'AI音乐/完整歌曲');
  assert.equal(en['transcription.target.chords'], 'Chord / polyphonic outline');
  assert.equal(zh['transcription.target.chords'], '和弦/复音轮廓');
  assert(en['transcription.target.chordsHelp'].includes('cleanup strength'));
  assert(zh['transcription.target.chordsHelp'].includes('清理强度'));
  assert.equal(zh['transcription.preserveRawCandidates'], '尽量保留原始识别结果');
  assert(en['top.importAudioModeHint'].includes('Transcription settings'));
  assert.equal(zh['top.importAudioModeOffHint'], '已关闭：仅导入原始音频片段');
  console.log('PASS audio transcription controls bindings and locales');
})();
