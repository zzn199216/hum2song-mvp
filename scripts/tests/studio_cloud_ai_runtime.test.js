#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const index = fs.readFileSync(path.join(root, 'static/pianoroll/index.html'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'static/pianoroll/cloud_project_bridge.js'), 'utf8');
const version = fs.readFileSync(path.join(root, 'static/pianoroll/studio_asset_version.js'), 'utf8');

const verMatch = version.match(/H2S_STUDIO_ASSET_VERSION\s*=\s*'([^']+)'/);
assert(verMatch, 'studio_asset_version.js should define H2S_STUDIO_ASSET_VERSION');
const ver = verMatch[1];

assert(index.includes('studio_asset_version.js?v=' + ver), 'index.html should cache-bust studio_asset_version.js');
assert(index.includes('app.js?v=' + ver), 'index.html should cache-bust app.js');
assert(index.includes('cloud_project_bridge.js?v=' + ver), 'index.html should cache-bust cloud_project_bridge.js');
assert(index.includes('cloud_materials_panel.js?v=' + ver), 'index.html should cache-bust cloud_materials_panel.js');
assert(index.includes('library_view.js?v=' + ver), 'index.html should cache-bust library_view.js');
assert(index.includes('selection_view.js?v=' + ver), 'index.html should cache-bust selection_view.js');
assert(index.includes('selection_controller.js?v=' + ver), 'index.html should cache-bust selection_controller.js');
assert(index.indexOf('studio_asset_version.js') < index.indexOf('i18n.js'), 'asset version should load before i18n.js');
assert(index.indexOf('studio_asset_version.js') < index.indexOf('app.js?v=' + ver), 'asset version should load before app.js');
assert(index.includes('params.get(\'cloudMode\') === \'1\''), 'index.html should bootstrap cloudMode before app.js');
assert(index.includes('hum2song\\.cn'), 'index.html bootstrap should detect Hum2Song Cloud embed referrer');

assert(bridge.includes('function isCloudModeRequested'), 'bridge should centralize cloud mode detection');
assert(bridge.includes('document.referrer'), 'bridge should detect Cloud embed via referrer');
assert(bridge.includes('rerenderAiSettingsDrawerIfOpen'), 'bridge should refresh open AI Settings drawer on cloud boot');

console.log('studio_cloud_ai_runtime.test.js ok');
