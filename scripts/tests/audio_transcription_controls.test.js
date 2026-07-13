#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

(function testControlMarkup(){
  const view = require(path.join(repoRoot, 'static', 'pianoroll', 'ui', 'selection_view.js'));
  const html = view.audioSegmentPanelHTML({
    escapeHtml: (value) => String(value),
    transcriptionTarget: 'ai_full_mix',
    cleanupStrength: 25,
    preserveRawCandidates: true,
    transcriptionTargetOptions: [
      { value: 'auto', label: 'Auto' },
      { value: 'ai_full_mix', label: 'AI music / full song' },
      { value: 'melody', label: 'Extract melody' },
      { value: 'chords', label: 'Chord / polyphonic outline' },
      { value: 'vocal_humming', label: 'Vocal / humming' },
      { value: 'piano_guitar', label: 'Piano / guitar' },
      { value: 'electronic_melody', label: 'Electronic melody' },
      { value: 'pad_chords', label: 'Pad / sustained chords' },
    ],
  });
  assert(html.includes('data-field="transcriptionTarget"'));
  assert(html.includes('value="ai_full_mix" selected'));
  assert(html.includes('data-field="cleanupStrength"'));
  assert(html.includes('value="25"'));
  assert(html.includes('data-field="preserveRawCandidates" checked'));
  const chordHtml = view.audioSegmentPanelHTML({
    escapeHtml: (value) => String(value),
    transcriptionTarget: 'chords',
    transcriptionTargetHelp: 'Best for accompaniment and pads.',
    transcriptionTargetOptions: [{ value: 'chords', label: 'Chord / polyphonic outline' }],
  });
  assert(chordHtml.includes('Chord / polyphonic outline'));
  assert(chordHtml.includes('data-role="transcriptionTargetHelp"'));
  assert(chordHtml.includes('Best for accompaniment and pads.'));
  console.log('PASS audio transcription controls markup');
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
  console.log('PASS audio transcription controls request propagation');
})();

(function testControllerBindingsAndLocales(){
  const controller = read('static', 'pianoroll', 'controllers', 'selection_controller.js');
  assert(controller.includes('onTranscriptionTarget'));
  assert(controller.includes('onCleanupStrength'));
  assert(controller.includes('onPreserveRawCandidates'));
  const en = JSON.parse(read('static', 'i18n', 'locales', 'en.json'));
  const zh = JSON.parse(read('static', 'i18n', 'locales', 'zh.json'));
  assert.equal(en['transcription.target.aiFullMix'], 'AI music / full song');
  assert.equal(zh['transcription.target.aiFullMix'], 'AI音乐/完整歌曲');
  assert.equal(en['transcription.target.chords'], 'Chord / polyphonic outline');
  assert.equal(zh['transcription.target.chords'], '和弦/复音轮廓');
  assert(en['transcription.target.chordsHelp'].includes('cleanup strength'));
  assert(zh['transcription.target.chordsHelp'].includes('清理强度'));
  assert.equal(zh['transcription.preserveRawCandidates'], '尽量保留原始识别结果');
  console.log('PASS audio transcription controls bindings and locales');
})();
