#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'static/pianoroll/app.js'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'static/pianoroll/internal_action_registry.js'), 'utf8');
const en = JSON.parse(fs.readFileSync(path.join(root, 'static/i18n/locales/en.json'), 'utf8'));
const zh = JSON.parse(fs.readFileSync(path.join(root, 'static/i18n/locales/zh.json'), 'utf8'));

[
  'confirm.clearLocalProject',
  'confirm.deleteClipWithInstances',
  'confirm.deleteClipOnly',
  'confirm.deleteInstance',
  'confirm.removeTrack',
  'confirm.newLocalProject',
  'confirm.importLocalProject',
  'confirm.switchLocalProject'
].forEach((key) => {
  assert(en[key], 'en missing ' + key);
  assert(zh[key], 'zh missing ' + key);
});

assert(/clearProject\(opts\)[\s\S]*?confirm\(_t\('confirm\.clearLocalProject'/.test(app), 'clear local project should confirm with scoped i18n copy');
assert(/deleteClip\(clipId\)[\s\S]*?confirm\(msg\)/.test(app), 'delete clip should confirm before removing local library/timeline data');
assert(app.indexOf("confirm.deleteClipWithInstances") !== -1, 'delete clip confirmation should mention timeline instances');
assert(/deleteInstance\(instId,\s*opts\)[\s\S]*?confirm\(_t\('confirm\.deleteInstance'/.test(app), 'delete timeline instance should confirm');
assert(registry.includes("app.deleteInstance(instanceId, { skipConfirm: true })"), 'assistant remove-instance path should keep its existing single confirmation');
assert(/removeActiveTrack\(\)[\s\S]*?confirm\(_t\('confirm\.removeTrack'/.test(app), 'remove track should confirm and mention instances');
assert(/createNewLocalProject\(\)[\s\S]*?confirm\(_t\('confirm\.newLocalProject'/.test(app), 'new local project should confirm before switching away from current local work');
assert(/importProjectJsonFromFile\(opts\)[\s\S]*?confirm\(_t\('confirm\.importLocalProject'/.test(app), 'import project JSON should confirm local-only replacement/switch');
assert(/_switchToLocalProjectId\(projectId\)[\s\S]*?confirm\(_t\('confirm\.switchLocalProject'/.test(app), 'switch local project should confirm before replacing current local view');

assert(en['confirm.clearLocalProject'].toLowerCase().includes('local') && en['confirm.clearLocalProject'].toLowerCase().includes('cloud'), 'en clear copy should state local/cloud scope');
assert(zh['confirm.clearLocalProject'].includes('本地') && zh['confirm.clearLocalProject'].includes('云端'), 'zh clear copy should state local/cloud scope');
assert(en['confirm.deleteInstance'].includes('timeline instance'), 'en delete instance copy should name timeline instance');
assert(zh['confirm.deleteInstance'].includes('时间线实例'), 'zh delete instance copy should name timeline instance');

console.log('destructive_confirmations.test.js ok');
