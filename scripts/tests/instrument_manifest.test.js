#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const manifest = require(path.join(root, 'static/pianoroll/core/instrument_manifest.js'));

const builtIns = manifest.getBuiltInInstrumentManifest();
assert(Array.isArray(builtIns), 'manifest should export an array of built-in instruments');
assert(builtIns.length >= 7, 'manifest should include synth and sampled built-ins');

const legacyKeys = builtIns.map((item) => item.legacyKey);
for (const key of ['default', 'bass', 'lead', 'pad', 'pluck', 'drum', 'sampler:tonejs:piano', 'sampler:tonejs:strings', 'sampler:tonejs:guitar-acoustic', 'sampler:tonejs:guitar-electric']) {
  assert(legacyKeys.includes(key), `manifest should include legacy key ${key}`);
}

assert.strictEqual(manifest.resolveInstrument('default').id, 'builtin.piano');
assert.strictEqual(manifest.resolveInstrument('bass').engineType, 'builtin_synth');
assert.strictEqual(manifest.resolveInstrument('drum').engineType, 'drum');
assert.strictEqual(manifest.resolveInstrument('sampler:tonejs:piano').engineType, 'sampler');

const missing = manifest.resolveInstrument('legacy:missing');
assert.strictEqual(missing.missing, true, 'unknown instruments should return a missing fallback');
assert.strictEqual(missing.legacyKey, 'legacy:missing');
assert.doesNotThrow(() => manifest.resolveInstrument(null));

const options = manifest.getSelectableInstrumentOptions();
assert(options.some((option) => option.value === 'default'), 'dropdown options should keep legacy stored values');
assert(options.some((option) => option.value === 'sampler:tonejs:piano'), 'dropdown options should include sampled piano');
assert(options.some((option) => option.value === 'sampler:tonejs:strings'), 'dropdown options should include sampled strings');
assert(options.some((option) => option.value === 'sampler:tonejs:guitar-acoustic'), 'dropdown options should include sampled acoustic guitar');
assert(options.some((option) => option.value === 'sampler:tonejs:guitar-electric'), 'dropdown options should include sampled electric guitar');
assert(!options.some((option) => option.value === 'builtin.piano'), 'v0 should not store new manifest ids in tracks');

const timelineController = fs.readFileSync(path.join(root, 'static/pianoroll/timeline_controller.js'), 'utf8');
assert(timelineController.includes('H2SInstrumentManifest'), 'timeline dropdown should use the manifest when available');
assert(timelineController.includes('getSelectableInstrumentOptions'), 'timeline dropdown should derive built-ins from manifest');
assert(timelineController.includes('instrument.missing'), 'timeline dropdown should show unknown stored instruments safely');

const indexHtml = fs.readFileSync(path.join(root, 'static/pianoroll/index.html'), 'utf8');
const manifestScriptIndex = indexHtml.indexOf('core/instrument_manifest.js');
const timelineScriptIndex = indexHtml.indexOf('timeline_controller.js');
assert(manifestScriptIndex >= 0, 'index should load the instrument manifest');
assert(timelineScriptIndex >= 0, 'index should load the timeline controller');
assert(manifestScriptIndex < timelineScriptIndex, 'manifest should load before timeline controller');

const en = JSON.parse(fs.readFileSync(path.join(root, 'static/i18n/locales/en.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(root, 'static/i18n/locales/zh.json'), 'utf8'));
for (const key of [
  'instrument.name.piano',
  'instrument.name.bass',
  'instrument.name.lead',
  'instrument.name.pad',
  'instrument.name.pluck',
  'instrument.name.drums',
  'instrument.name.sampledPiano',
  'instrument.name.sampledStrings',
  'instrument.name.sampledGuitarAcoustic',
  'instrument.name.sampledGuitarElectric',
  'instrument.category.keyboard',
  'instrument.category.bass',
  'instrument.category.synth',
  'instrument.category.drums',
  'instrument.category.sampled',
  'instrument.missing',
]) {
  assert(en[key], `English locale should include ${key}`);
  assert(zh[key], `Chinese locale should include ${key}`);
}

const projectJs = fs.readFileSync(path.join(root, 'static/pianoroll/project.js'), 'utf8');
assert(projectJs.includes("DEFAULT_INSTRUMENT: 'default'"), 'default stored instrument should remain legacy default');

const audioController = fs.readFileSync(path.join(root, 'static/pianoroll/controllers/audio_controller.js'), 'utf8');
const exportController = fs.readFileSync(path.join(root, 'static/pianoroll/controllers/export_wav_controller.js'), 'utf8');
for (const key of ["case 'bass'", "case 'lead'", "case 'pad'", "case 'pluck'", "case 'drum'"]) {
  assert(audioController.includes(key), `audio synth mapping should still include ${key}`);
  assert(exportController.includes(key), `export synth mapping should still include ${key}`);
}

console.log('instrument manifest tests passed');
