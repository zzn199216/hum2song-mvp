#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const html = read('static', 'pianoroll', 'index.html');
const app = read('static', 'pianoroll', 'app.js');
const worker = read('static', 'pianoroll', 'core', 'audio_worker_conversion_client.js');
const versionSource = read('static', 'pianoroll', 'studio_asset_version.js');

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert(match, `missing CSS rule: ${selector}`);
  return match[1].replace(/\s+/g, ' ');
}

(function freezeStableDesktopLayout() {
  const topbar = cssRule('.topbar');
  const topbarRow = cssRule('.topbar .row');
  const importOptions = cssRule('.transcriptionImportOptions');
  const layout = cssRule('.layout');
  assert.match(topbar, /display:flex/);
  assert.match(topbar, /flex-wrap:wrap/);
  assert.match(topbarRow, /flex:1 1 360px/);
  assert.match(importOptions, /display:inline-grid/);
  assert.doesNotMatch(importOptions, /flex\s*:\s*1/);
  assert.match(layout, /display:grid/);
  assert.match(layout, /grid-template-columns:\s*280px 1fr 320px/);
  console.log('PASS Cloud embed desktop layout freeze');
})();

(function freezeOneCacheVersion() {
  const declared = versionSource.match(/H2S_STUDIO_ASSET_VERSION\s*=\s*'([^']+)'/);
  assert(declared, 'Studio asset version must be declared');
  for (const asset of [
    'studio_asset_version.js',
    'h2s_startup_perf.js',
    'i18n.js',
    'audio_worker_conversion_client.js',
    'audio_worker_separation_client.js',
    'app.js',
    'cloud_project_bridge.js',
    'cloud_materials_panel.js',
  ]) {
    assert(html.includes(`${asset}?v=${declared[1]}`), `${asset} must use the release cache version`);
  }
  console.log('PASS Cloud-critical Studio cache version');
})();

(function freezeDualDomainBridgeOrigins() {
  for (const origin of [
    'https://hum2song.cn',
    'https://www.hum2song.cn',
    'https://hum2song.com',
    'https://www.hum2song.com',
  ]) {
    assert(html.includes(`origins.push('${origin}')`), `iframe parent allowlist missing ${origin}`);
    assert(worker.includes(`'${origin}': true`), `worker response allowlist missing ${origin}`);
  }
  assert(!worker.includes("'*': true"), 'wildcard parent origins are forbidden');
  console.log('PASS CN/global exact-origin bridge freeze');
})();

(function freezeAnonymousServerGate() {
  const authAssignment = html.indexOf('window.H2S_CLOUD_AUTHENTICATED = /^user-');
  const earlyReturn = html.indexOf('if (window.H2S_CLOUD_MODE === true) return', authAssignment);
  assert(authAssignment >= 0 && earlyReturn > authAssignment, 'auth state must be set before the Cloud-mode early return');
  assert(app.includes('checkbox.disabled = !serverAllowed'));
  assert(app.includes('if (!serverAllowed) checkbox.checked = false'));
  for (const method of [
    '_runAudioSeparationForClip',
    'pickWavAndGenerate',
    '_postHummingMusicBridgeRequest',
    'uploadFileAndGenerate',
    'convertAudioClipToEditable',
  ]) {
    const definition = new RegExp(`\\n\\s*(?:async\\s+)?${method}\\([^\\n]*\\)\\s*\\{`).exec(app);
    assert(definition, `missing guarded server method ${method}`);
    const start = definition.index;
    const bodyPrefix = app.slice(start, start + 900);
    assert(
      bodyPrefix.includes('_requireCloudServerFeatureAuth') || bodyPrefix.includes('!this._cloudServerFeaturesAllowed()'),
      `${method} must fail before server interaction`,
    );
  }
  console.log('PASS anonymous Cloud server gate freeze');
})();
