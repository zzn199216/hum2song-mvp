#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const perfSrc = fs.readFileSync(path.join(root, 'static/pianoroll/h2s_startup_perf.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'static/pianoroll/index.html'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'static/pianoroll/cloud_project_bridge.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'static/pianoroll/app.js'), 'utf8');
const ver = fs.readFileSync(path.join(root, 'static/pianoroll/studio_asset_version.js'), 'utf8').match(
  /H2S_STUDIO_ASSET_VERSION\s*=\s*'([^']+)'/,
)[1];

assert(index.includes('h2s_startup_perf.js?v=' + ver), 'index should load h2s_startup_perf.js');
assert(index.includes("studio_scripts_loaded"), 'index should mark studio_scripts_loaded');
assert(!index.includes('audio_waveform_editor.js'), 'index should not eagerly load waveform editor');
assert(appJs.includes('loadAudioWaveformEditorScript'), 'app should lazy-load waveform editor');
assert(appJs.includes('bootAppWhenDomReady'), 'app should boot as soon as the DOM is ready');
assert(!appJs.includes("window.addEventListener('load', () => app.init())"), 'app should not wait for window.load to initialize');
assert(bridge.includes('H2S_SCHEDULE_CLOUD_AI_STATUS'), 'bridge should defer cloud AI status');
assert(!/onCloudBoot[\s\S]*requestCloudAiStatus\(\)/.test(bridge), 'cloud boot should not eagerly request AI status');

(function testPerfDisabledNoThrow() {
  const logs = [];
  const ctx = {
    window: {},
    console: { log: function () { logs.push(Array.from(arguments)); } },
    localStorage: { getItem: function () { return ''; } },
    location: { search: '' },
    performance: { now: function () { return 1; }, mark: function () {} },
    requestAnimationFrame: function (cb) { cb(); },
    Date: Date,
  };
  ctx.window = ctx;
  vm.runInNewContext(perfSrc, ctx);
  assert(typeof ctx.window.H2SStartupPerf.mark === 'function', 'perf API exists');
  ctx.window.H2SStartupPerf.mark('studio_runtime_ready');
  ctx.window.H2SStartupPerf.logSummary();
  assert(logs.length === 0, 'disabled perf should not log');
  console.log('PASS perf disabled');
})();

(function testPerfEnabledSafeLog() {
  const logs = [];
  const ctx = {
    console: { log: function () { logs.push(Array.from(arguments)); } },
    localStorage: { getItem: function (k) { return k === 'h2s_perf' ? '1' : ''; } },
    location: { search: '?perf=1' },
    performance: { now: function () { return 10; }, mark: function () {} },
    requestAnimationFrame: function (cb) { cb(); },
    Date: Date,
    URLSearchParams: URLSearchParams,
  };
  ctx.window = ctx;
  vm.runInNewContext(perfSrc, ctx);
  const perf = ctx.H2SStartupPerf || ctx.window.H2SStartupPerf;
  assert(perf && perf.enabled && perf.enabled(), 'perf should be enabled via ?perf=1');
  perf.mark('studio_runtime_ready');
  perf.logSummary({ smoke: true });
  assert(logs.length === 1, 'enabled perf should log once');
  const payload = logs[0][1];
  assert(payload && payload.phase === 'studio_startup', 'log should include phase');
  assert(payload.studio_runtime_readyMs != null, 'log should include mark timings');
  assert(!JSON.stringify(payload).match(/Bearer|token|password|projectDoc/i), 'log must not include secrets');
  console.log('PASS perf enabled safe log');
})();

console.log('studio_startup_perf.test.js ok');
