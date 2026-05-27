#!/usr/bin/env node
/* PR-G1a/G1b/G1c: i18n Core - minimal tests for register, t, setLang, fallback, persistence, loadManifest, zh-covers-en. */
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg){
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// PR-G1c: zh.json must have all keys from en.json
var enPath = path.join(__dirname, '../../static/i18n/locales/en.json');
var zhPath = path.join(__dirname, '../../static/i18n/locales/zh.json');
if (fs.existsSync(enPath) && fs.existsSync(zhPath)){
  var en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  var zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
  var enKeys = Object.keys(en);
  for (var i = 0; i < enKeys.length; i++){
    assert(zh[enKeys[i]] != null, 'zh.json missing key: ' + enKeys[i]);
  }
  [
    'cloudAi.title',
    'cloudAi.managedHint',
    'cloudAi.currentPlan',
    'cloudAi.usedRemainingPeriod',
    'cloudAi.availablePresets',
    'cloudAi.refresh',
    'cloudAi.loading',
    'cloudAi.error',
    'cloudAi.unknownPlan',
    'cloudAi.quotaUnavailable',
    'cloudAi.presetsUnavailable',
    'cloudAi.preset',
    'cloudAi.selectPreset',
    'cloudAi.testCloudAi',
    'cloudAi.testing',
    'cloudAi.testResult',
    'cloudAi.usage',
    'cloudAi.requestId',
    'cloudAi.unavailable',
    'cloudAi.loginRequired',
    'cloudAi.internalOnly',
    'cloudAi.selected',
    'cloudAi.preset.basic',
    'cloudAi.preset.standard',
    'cloudAi.preset.quality',
    'cloudAi.preset.internal',
    'cloudAi.preset.basic.description',
    'cloudAi.preset.standard.description',
    'cloudAi.preset.quality.description',
    'cloudAi.preset.internal.description',
    'cloudAi.tier.fast',
    'cloudAi.tier.standard',
    'cloudAi.tier.quality',
    'cloudAi.tier.internal'
  ].forEach(function(k){
    assert(en[k] != null, 'en.json missing Cloud AI key: ' + k);
    assert(zh[k] != null, 'zh.json missing Cloud AI key: ' + k);
  });
  assert(zh['cloudAi.preset.basic.description'] === '适合基础清理、快速预览和轻量辅助。', 'zh basic preset description should be product-facing');
  assert(zh['cloudAi.preset.standard.description'] === '适合旋律、节奏和轻量编配辅助。', 'zh standard preset description should be product-facing');
  assert(zh['cloudAi.preset.quality.description'] === '适合更高质量的云端 AI 辅助。', 'zh quality preset description should be product-facing');
  assert(zh['cloudAi.preset.internal.description'] === '用于内部验证云端 AI 连接和供应商链路。', 'zh internal preset description should be product-facing');
  assert(zh['cloudAi.tier.fast'] === '快速', 'zh fast tier should be localized');
  assert(zh['cloudAi.tier.standard'] === '标准', 'zh standard tier should be localized');
  assert(zh['cloudAi.tier.quality'] === '高质量', 'zh quality tier should be localized');
  assert(zh['cloudAi.tier.internal'] === '内部', 'zh internal tier should be localized');
  assert(en['cloudAi.tier.fast'] === 'Fast', 'en fast tier should be localized');
  assert(en['cloudAi.tier.standard'] === 'Standard', 'en standard tier should be localized');
  assert(en['cloudAi.tier.quality'] === 'Quality', 'en quality tier should be localized');
  assert(en['cloudAi.tier.internal'] === 'Internal', 'en internal tier should be localized');
  assert(zh['lastOpt.fail.truncated_generation'] === 'AI 输出被截断，未应用到工程。你可以重试，或选择更短片段。', 'zh truncated generation copy should be product-facing');
}

// Studio index: beginner hint bar (first-open guidance)
var indexHtmlPath = path.join(__dirname, '../../static/pianoroll/index.html');
if (fs.existsSync(indexHtmlPath)) {
  var indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(indexHtml.indexOf('id="beginnerHintBar"') !== -1, 'index.html must include beginnerHintBar');
  assert(indexHtml.indexOf('data-copy-cmd') !== -1, 'index.html must include copy-cmd buttons for beginner hint');
  assert(indexHtml.indexOf('data-i18n="beginnerHint.title"') !== -1, 'index.html beginner hint must use i18n keys');
  assert(indexHtml.indexOf('data-i18n-aria-label') !== -1, 'index.html beginner hint must support aria i18n');
  assert(indexHtml.indexOf('id="beginnerHintHelpPanel"') !== -1, 'index.html must include beginner help panel');
  assert(indexHtml.indexOf('id="btnBeginnerHintMoreHelp"') !== -1, 'index.html must include More help button');
  assert(indexHtml.indexOf('id="btnBeginnerHelpEntry"') !== -1, 'index.html must include persistent beginner help entry');
  assert(indexHtml.indexOf('id="btnBeginnerHintRestore"') !== -1, 'index.html must include restore hint strip control');
  assert(indexHtml.indexOf('python scripts/beginner_preflight.py') !== -1, 'index.html must include preflight command');
  assert(indexHtml.indexOf('python scripts/beginner_launch.py') !== -1, 'index.html must include launch command');
  assert(indexHtml.indexOf('id="studioBackendReadiness"') !== -1, 'index.html must include backend readiness strip');
  assert(indexHtml.indexOf('/api/v1/health') !== -1, 'index.html must link health endpoint for readiness');
  assert(indexHtml.indexOf('id="studioLastOptimizeRow"') !== -1, 'index.html must include last optimize summary row');
  assert(indexHtml.indexOf('data-i18n="lastOpt.label"') !== -1, 'index.html last optimize row must use i18n label');
  assert(indexHtml.indexOf('id="btnLastOptimizeDetails"') !== -1, 'index.html must include last optimize details button');
  assert(indexHtml.indexOf('id="studioLastOptimizeDetails"') !== -1, 'index.html must include last optimize details panel');
}

// Last optimize: staleness uses revision + project doc key (see app.js)
var appJsPath = path.join(__dirname, '../../static/pianoroll/app.js');
if (fs.existsSync(appJsPath)) {
  var appJs = fs.readFileSync(appJsPath, 'utf8');
  assert(appJs.indexOf('_isLastOptimizeSnapshotStale') !== -1, 'app.js should detect last-optimize staleness');
  assert(appJs.indexOf('revisionIdAtRun') !== -1, 'app.js should pin last optimize to clip revision');
  assert(appJs.indexOf('docKeyAtRun') !== -1, 'app.js should pin last optimize to project storage key');
  assert(appJs.indexOf('_initLastOptimizeDetails') !== -1, 'app.js should wire last optimize details popover');
  assert(appJs.indexOf('modalSyncGhostFromClipParent') !== -1, 'app.render should refresh clip-editor ghost when modal open');
  assert(/\.topbar\s*\{[\s\S]*?flex-wrap:\s*wrap/.test(appJs) === false, 'responsive topbar CSS should live in index.html, not app.js');
}

// Clip editor ghost: parent revision overlay sync (editor_runtime.js)
var editorRtPath = path.join(__dirname, '../../static/pianoroll/controllers/editor_runtime.js');
if (fs.existsSync(editorRtPath)) {
  var editorRtJs = fs.readFileSync(editorRtPath, 'utf8');
  assert(editorRtJs.indexOf('modalSyncGhostFromClipParent') !== -1, 'editor_runtime must expose modalSyncGhostFromClipParent');
  assert(editorRtJs.indexOf('_ghostScoreFromClipParentRevision') !== -1, 'editor_runtime must resolve ghost from parent revision');
}

const I18N = require('../../static/i18n/i18n.js');

I18N.register('en', { common: { ok: 'OK', cancel: 'Cancel', missing_in_zh: 'From English' } });
I18N.register('zh', { common: { ok: '好的', cancel: '取消' } });

I18N.setLang('zh');
assert(I18N.t('common.ok') === '好的', 'zh: common.ok');
assert(I18N.t('nonexistent.key') === 'nonexistent.key', 'missing key returns key');

I18N.setLang('en');
assert(I18N.t('common.ok') === 'OK', 'en: common.ok');

I18N.setLang('zh');
assert(I18N.t('common.missing_in_zh') === 'From English', 'zh fallback to en when key missing in zh');

var storage = I18N._storage();
I18N.setLang('zh');
assert(storage.getItem('hum2song_studio_lang') === 'zh', 'setLang persists to localStorage/hum2song_studio_lang');

I18N.setLang('en', { persist: false });
assert(I18N.getLang() === 'en', 'non-persistent setLang updates active language');
assert(storage.getItem('hum2song_studio_lang') === 'zh', 'non-persistent setLang does not overwrite hum2song_studio_lang');

I18N.init({ fromStorage: false, useNavigator: false });
assert(I18N.getLang() === 'en', 'init embed mode does not clobber in-memory lang with storage or navigator');

I18N.setLang('zh');
I18N.setLang('en', { persist: false });
I18N.init();
assert(I18N.getLang() === 'zh', 'default init restores stored language over non-persistent in-memory choice');

I18N.setLang('zh');

assert(I18N.getLang() === 'zh', 'getLang returns current');
assert(I18N.availableLanguages().length >= 2, 'availableLanguages returns at least en, zh');

I18N.init();
assert(typeof I18N.getLang() === 'string', 'init sets lang');

// PR-G1b: loadManifest with injectable fetchFn
if (I18N.loadManifest){
  const mockManifest = [{ code: 'xx', label: 'TestLang' }];
  const mockFetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(mockManifest) });
  I18N.loadManifest({ fetchFn: mockFetch }).then(function(){
    try {
      const list = I18N.availableLanguages();
      assert(Array.isArray(list) && list.length >= 1 && list[0].code === 'xx', 'loadManifest updates availableLanguages');
      console.log('PASS i18n register, t, setLang, fallback, persistence, loadManifest');
    } catch (e) { console.error(e); process.exit(1); }
  }).catch(function(e){ console.error(e); process.exit(1); });
} else {
  console.log('PASS i18n register, t, setLang, fallback, persistence');
}
