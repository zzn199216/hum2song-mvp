#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const indexHtml = fs.readFileSync(path.join(root, 'static/pianoroll/index.html'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'static/pianoroll/cloud_project_bridge.js'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'static/pianoroll/cloud_materials_panel.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'static/pianoroll/app.js'), 'utf8');
const ver = fs.readFileSync(path.join(root, 'static/pianoroll/studio_asset_version.js'), 'utf8').match(
  /H2S_STUDIO_ASSET_VERSION\s*=\s*'([^']+)'/,
)[1];

assert(indexHtml.includes('id="cloudMaterialsSection"'), 'index should include cloud materials section');
assert(indexHtml.includes('id="btnCloudMaterials"'), 'index should include cloud materials button');
assert(indexHtml.includes('id="cloudMaterialsModal"'), 'index should include cloud materials modal');
assert(indexHtml.includes('cloudMaterialsModalList'), 'modal should host materials list');
assert(!indexHtml.includes('id="cloudMaterialsPanel"'), 'cramped sidebar panel removed');
assert(indexHtml.includes('cloud_materials_panel.js?v=' + ver), 'index should cache-bust cloud_materials_panel.js');
assert(indexHtml.includes('word-break: break-word') || indexHtml.includes('cloudMaterialsCardTitle'), 'modal styles allow long titles to wrap');

assert(bridge.includes('H2S_CLOUD_MATERIALS_LIST_REQUEST'), 'bridge should define list request helper');
assert(bridge.includes('H2S_CLOUD_MATERIAL_CONTENT_REQUEST'), 'bridge should define content request helper');
assert(bridge.includes('H2S_CLOUD_MATERIALS_LIST_RESPONSE'), 'bridge should handle list response');
assert(bridge.includes('H2S_CLOUD_MATERIAL_CONTENT_RESPONSE'), 'bridge should handle content response');
assert(!/Bearer|accessToken|audioUrl|storageKey/.test(bridge), 'bridge must not handle tokens or provider URLs');

assert(panel.includes('H2S_REQUEST_CLOUD_MATERIALS_LIST'), 'panel should request materials list via bridge');
assert(panel.includes('H2S_REQUEST_CLOUD_MATERIAL_CONTENT'), 'panel should request material content via bridge');
assert(panel.includes('_commitNativeAudioFile'), 'panel should import via native audio commit path');
assert(panel.includes('openModal'), 'panel opens modal overlay');
assert(panel.includes('listLoading'), 'tracks list loading state');
assert(panel.includes('setRefreshDisabled'), 'refresh disabled while loading');
assert(panel.includes('importingAssetId'), 'tracks per-item import');
assert(panel.includes('cloudMaterialsCardTitle'), 'card layout for readable titles');
assert(panel.includes('importToTimeline') || panel.includes('cloudMaterials.importToTimeline'), 'import to timeline action');
assert(
  panel.includes('cloudMaterials.importDone') || /importDone|timeline/.test(panel),
  'panel should surface import success including timeline placement via commit helper',
);
assert(
  panel.includes('cloudMaterials.standaloneHint') || indexHtml.includes('data-i18n="cloudMaterials.standaloneHint"'),
  'standalone mode should show disabled copy',
);
assert(panel.includes('toggle.disabled = true'), 'standalone disables cloud materials button');
assert(!/addToTimeline|createInstanceV2/.test(panel), 'v0 should not add directly to timeline beyond commit helper');

assert(appJs.includes('_commitNativeAudioFile'), 'app should expose native audio import helper');

console.log('cloud_materials_panel.test.js ok');
