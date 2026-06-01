#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const bridge = fs.readFileSync(path.join(root, 'static/pianoroll/cloud_project_bridge.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'static/pianoroll/app.js'), 'utf8');

assert(bridge.includes('H2S_HOST_RESET_STUDIO_STATE'), 'bridge must handle explicit host reset messages');
assert(bridge.includes('resetForCloudHostSessionChange'), 'bridge reset should delegate to the Studio app');
assert(bridge.includes('H2S_CLOUD_AI_STATUS = null'), 'bridge reset should clear cached Cloud AI status');
assert(bridge.includes('H2S_CLOUD_MATERIALS_LIST_RESULT = null'), 'bridge reset should clear cached material list state');

assert(app.includes('LS_KEY_CLOUD_HOST_SESSION'), 'app should track Cloud host session boundary');
assert(app.includes('_resetProjectStorageIfCloudHostSessionChanged'), 'app should clear persisted project state on host session changes');
assert(app.includes('_clearStoredProjectDocumentsForCloudHostReset'), 'app should target Studio project storage keys');
assert(app.includes('resetForCloudHostSessionChange'), 'app should expose runtime reset for bridge messages');
assert(app.includes('H2SProject.defaultProject()'), 'reset should return the visible project to a blank default');

console.log('cloud_project_state_reset.test.js ok');
