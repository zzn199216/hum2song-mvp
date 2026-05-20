#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'static/pianoroll/app.js'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'static/pianoroll/cloud_project_bridge.js'), 'utf8');

const renderStart = app.indexOf('renderAiSettingsPanel(container)');
assert(renderStart >= 0, 'AI Settings drawer renderer should exist');
const renderEnd = app.indexOf('\n    renderInspector()', renderStart);
assert(renderEnd > renderStart, 'AI Settings drawer renderer should be bounded before renderInspector');
const renderBody = app.slice(renderStart, renderEnd);

assert(renderBody.includes('window.H2S_CLOUD_MODE'), 'drawer renderer should branch on Cloud mode');
assert(renderBody.includes('renderCloudAiSettingsPanel'), 'drawer renderer should delegate Cloud mode to Cloud AI panel');
assert(renderBody.indexOf('window.H2S_CLOUD_MODE') < renderBody.indexOf('const DEEPSEEK_URL'), 'Cloud mode branch should run before local provider setup');

const cloudStart = app.indexOf('renderCloudAiSettingsPanel(container)');
assert(cloudStart >= 0, 'Cloud AI drawer panel renderer should exist');
const cloudEnd = app.indexOf('\n    renderAiSettingsPanel(container)', cloudStart);
assert(cloudEnd > cloudStart, 'Cloud AI panel renderer should be immediately before the local drawer renderer');
const cloudBody = app.slice(cloudStart, cloudEnd);

assert(cloudBody.includes("_t('cloudAi.title'"), 'Cloud panel should show a localized Cloud AI title');
assert(cloudBody.includes("_t('cloudAi.managedHint'"), 'Cloud panel should explain localized Hum2Song Cloud management');
assert(/planCode/.test(cloudBody), 'Cloud panel should render planCode when available');
assert(/quota/.test(cloudBody) && /remaining/.test(cloudBody), 'Cloud panel should render quota used/limit/remaining when available');
assert(/presets/.test(cloudBody), 'Cloud panel should render available presets when available');
assert(cloudBody.includes('h2s_cloud_ai_selected_preset_id'), 'Cloud panel should persist selected preset id');
assert(!cloudBody.includes('<select id="inspAi_cloudPreset"'), 'Cloud panel should not use a native select for presets');
assert(!cloudBody.includes('<option'), 'Cloud panel should not render native option popup items');
assert(cloudBody.includes('data-cloud-ai-preset-list'), 'Cloud panel should render a custom preset list');
assert(cloudBody.includes('data-cloud-ai-preset-item'), 'Cloud preset items should be identifiable for safety checks');
assert(cloudBody.includes('cloudAiPresetDisplayName'), 'Cloud preset items should use product-facing preset labels');
assert(cloudBody.includes('preset.available !== false && preset.enabled !== false'), 'Cloud preset items should compute disabled/unavailable state');
assert(cloudBody.includes('querySelectorAll(\'[data-cloud-ai-preset-item]\')'), 'Cloud preset items should be clickable');
assert(cloudBody.includes('presetButton.disabled'), 'disabled/unavailable preset items should not be selectable');
assert(cloudBody.includes('H2S_CLOUD_AI_CHAT_REQUEST'), 'Cloud test action should request chat through the parent bridge');
assert(cloudBody.includes('H2S_CLOUD_AI_CHAT_RESPONSE'), 'Cloud test action should render correlated chat responses');
assert(cloudBody.includes('inspAi_cloudTestPrompt'), 'Cloud panel should render a test prompt textarea');
assert(cloudBody.includes('inspAi_cloudTestButton'), 'Cloud panel should render a Cloud AI test button');
assert(cloudBody.includes("_t('cloudAi.preset'"), 'Cloud preset label should use i18n');
assert(cloudBody.includes("_t('cloudAi.selectPreset'"), 'Cloud preset selector hint should use i18n');
assert(cloudBody.includes("_t('cloudAi.testCloudAi'"), 'Cloud test button should use i18n');
assert(cloudBody.includes('cloudAi.preset.basic'), 'Cloud preset labels should include product-facing Basic copy');
assert(cloudBody.includes('cloudAi.preset.standard'), 'Cloud preset labels should include product-facing Standard copy');
assert(cloudBody.includes('cloudAi.preset.quality'), 'Cloud preset labels should include product-facing Quality copy');
assert(cloudBody.includes('cloudAi.preset.internal'), 'Cloud preset labels should include product-facing Internal copy');
assert(cloudBody.includes('basic_optimize'), 'Cloud preset labels should localize basic_optimize by stable id');
assert(cloudBody.includes('standard_preview'), 'Cloud preset labels should localize standard_preview by stable id');
assert(cloudBody.includes('quality_optimize'), 'Cloud preset labels should localize quality_optimize by stable id');
assert(cloudBody.includes('cloudAiPresetDescription'), 'Cloud preset descriptions should be resolved through i18n for known ids');
assert(cloudBody.includes('cloudAiPresetTierLabel'), 'Cloud preset tiers should be resolved through i18n for known tiers');
assert(cloudBody.includes('cloudAi.preset.basic.description'), 'Cloud preset descriptions should include Basic i18n copy');
assert(cloudBody.includes('cloudAi.preset.standard.description'), 'Cloud preset descriptions should include Standard i18n copy');
assert(cloudBody.includes('cloudAi.preset.quality.description'), 'Cloud preset descriptions should include Quality i18n copy');
assert(cloudBody.includes('cloudAi.preset.internal.description'), 'Cloud preset descriptions should include Internal i18n copy');
assert(cloudBody.includes('cloudAi.tier.fast'), 'Cloud preset tier labels should include Fast i18n copy');
assert(cloudBody.includes('cloudAi.tier.standard'), 'Cloud preset tier labels should include Standard i18n copy');
assert(cloudBody.includes('cloudAi.tier.quality'), 'Cloud preset tier labels should include Quality i18n copy');
assert(cloudBody.includes('cloudAi.tier.internal'), 'Cloud preset tier labels should include Internal i18n copy');
assert(!cloudBody.includes('escapeHtml(selectedPreset.description || \'\')'), 'Selected preset detail should not render raw API descriptions for known presets');
assert(cloudBody.includes('presetId: presetId'), 'Cloud test action should send the stable selected preset id');
assert(!/qwen-|dashscope|apiKey|modelName/i.test(cloudBody), 'Cloud panel source should not expose provider ids, API keys, or raw model names');
assert(/loading/.test(cloudBody), 'Cloud panel should render a loading state while status is requested');
assert(/error/.test(cloudBody), 'Cloud panel should render a safe error state');
assert(/requestCloudAiStatusRefresh/.test(cloudBody), 'Cloud panel should expose refresh/retry action');
assert(cloudBody.includes("_t('cloudAi.title'"), 'Cloud panel title should use i18n');
assert(cloudBody.includes("_t('cloudAi.managedHint'"), 'Cloud panel managed hint should use i18n');
assert(cloudBody.includes("_t('cloudAi.currentPlan'"), 'Cloud panel plan label should use i18n');
assert(cloudBody.includes("_t('cloudAi.usedRemainingPeriod'"), 'Cloud panel quota label should use i18n');
assert(cloudBody.includes("_t('cloudAi.availablePresets'"), 'Cloud panel presets label should use i18n');
assert(cloudBody.includes("_t('cloudAi.refresh'"), 'Cloud panel refresh button should use i18n');
assert(!cloudBody.includes('Requesting Cloud AI status...'), 'Cloud loading copy should not be hardcoded English');
assert(!cloudBody.includes('Cloud AI status is unavailable. Please retry.'), 'Cloud error copy should not be hardcoded English');

for (const forbidden of ['DeepSeek', 'Ollama', 'Base URL', 'Auth Token', 'testConnection', 'inspAi_authToken', 'inspAi_btnTest']) {
  assert(!cloudBody.includes(forbidden), `Cloud panel should not include local provider UI: ${forbidden}`);
}

assert(renderBody.includes('DEEPSEEK_URL'), 'standalone local provider settings should remain in the drawer renderer');
assert(renderBody.includes('inspAi_baseUrl'), 'standalone Base URL field should remain available');
assert(renderBody.includes('inspAi_model'), 'standalone model field should remain available');
assert(renderBody.includes('inspAi_authToken'), 'standalone token field should remain available');

assert(bridge.includes('window.H2S_REQUEST_CLOUD_AI_STATUS'), 'bridge should expose a token-safe Cloud AI status refresh function');
assert(bridge.includes('H2S_CLOUD_AI_STATUS_REQUEST'), 'refresh should use Cloud AI status request message');
assert(bridge.includes('rerenderAiSettingsDrawerIfOpen'), 'bridge should re-render AI Settings drawer when cloud status arrives');

assert(app.includes("addEventListener('h2s-cloud-ai-status'"), 'app should re-render AI Settings drawer on cloud status updates');

function extractMethod(source, name) {
  const start = source.indexOf(name + '(container)');
  assert(start >= 0, 'method should exist: ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('could not extract method: ' + name);
}

function createFakeDom() {
  const elementsById = {};
  const presetButtons = [];
  class FakeElement {
    constructor(attrs, text) {
      this.attrs = attrs || {};
      this.disabled = /\bdisabled\b/.test(this.attrs.__raw || '');
      this.value = text || '';
      this.listeners = {};
    }
    getAttribute(name) {
      return this.attrs[name] || '';
    }
    addEventListener(name, fn) {
      this.listeners[name] = fn;
    }
    click() {
      if (this.listeners.click) this.listeners.click();
    }
  }
  const container = {
    _html: '',
    set innerHTML(value) {
      this._html = String(value || '');
      Object.keys(elementsById).forEach((k) => delete elementsById[k]);
      presetButtons.length = 0;
      const tagRe = /<(button|textarea)\b([^>]*)>([\s\S]*?)<\/\1>/g;
      let match;
      while ((match = tagRe.exec(this._html))) {
        const attrsText = match[2] || '';
        const attrs = { __raw: attrsText };
        attrsText.replace(/([a-zA-Z0-9_-]+)="([^"]*)"/g, function(_, key, val) {
          attrs[key] = val;
          return '';
        });
        const el = new FakeElement(attrs, match[3] || '');
        if (attrs.id) elementsById[attrs.id] = el;
        if (attrs['data-cloud-ai-preset-item']) presetButtons.push(el);
      }
    },
    get innerHTML() {
      return this._html;
    },
    querySelectorAll(selector) {
      return selector === '[data-cloud-ai-preset-item]' ? presetButtons.slice() : [];
    }
  };
  return {
    container,
    document: {
      getElementById(id) {
        return elementsById[id] || null;
      }
    }
  };
}

function createRenderer(lang, status, initialPresetId) {
  const dom = createFakeDom();
  const posted = [];
  const storage = {};
  if (initialPresetId) storage.h2s_cloud_ai_selected_preset_id = initialPresetId;
  const localStorage = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem(k, v) { storage[k] = String(v); },
    removeItem(k) { delete storage[k]; }
  };
  const dicts = {
    en: JSON.parse(fs.readFileSync(path.join(root, 'static/i18n/locales/en.json'), 'utf8')),
    zh: JSON.parse(fs.readFileSync(path.join(root, 'static/i18n/locales/zh.json'), 'utf8'))
  };
  const window = {
    H2S_CLOUD_MODE: true,
    H2S_CLOUD_AI_STATUS: status,
    I18N: { t: (k) => dicts[lang][k] || dicts.en[k] || k },
    parent: { postMessage: (msg) => posted.push(msg) }
  };
  window.parent !== window;
  const escapeHtml = (s) => String(s || '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#39;');
  const methodSource = extractMethod(app, 'renderCloudAiSettingsPanel');
  const factory = new Function('escapeHtml', 'window', 'document', 'localStorage', 'return ({ requestCloudAiStatusRefresh(){}, ' + methodSource + ' });');
  return { renderer: factory(escapeHtml, window, dom.document, localStorage), container: dom.container, document: dom.document, posted, storage };
}

const sampleStatus = {
  ok: true,
  planCode: 'standard',
  quota: { used: 1, limit: 10, remaining: 9, period: 'month' },
  presets: [
    { id: 'basic_optimize', name: 'Basic AI Optimize', description: 'Small cloud AI cleanup and preview assistance.', tier: 'fast', available: true, enabled: true },
    { id: 'standard_preview', name: 'Standard AI Preview', description: 'Melody, rhythm, and lightweight arrangement assistance.', tier: 'standard', available: true, enabled: true },
    { id: 'quality_optimize', name: 'Quality AI Optimize', description: 'Higher quality cloud AI assistance for pro workflows.', tier: 'quality', available: true, enabled: true },
    { id: 'unknown_vendor_safe', name: 'Vendor Safe', description: 'Safe API fallback copy.', tier: 'custom', available: true, enabled: true }
  ]
};

const zhRuntime = createRenderer('zh', sampleStatus, 'standard_preview');
zhRuntime.renderer.renderCloudAiSettingsPanel(zhRuntime.container);
assert(zhRuntime.container.innerHTML.includes('标准 AI 预览'), 'Cloud mode zh should render localized preset label');
assert(zhRuntime.container.innerHTML.includes('适合旋律、节奏和轻量编配辅助。'), 'Cloud mode zh should render localized preset description');
assert(zhRuntime.container.innerHTML.includes('快速'), 'Cloud mode zh should render localized fast tier');
assert(zhRuntime.container.innerHTML.includes('标准'), 'Cloud mode zh should render localized standard tier');
assert(zhRuntime.container.innerHTML.includes('Vendor Safe'), 'Unknown preset id should fall back to API name');
assert(zhRuntime.container.innerHTML.includes('Safe API fallback copy.'), 'Unknown preset id should fall back to API description');
assert(zhRuntime.storage.h2s_cloud_ai_selected_preset_id === 'standard_preview', 'Selected preset should persist by id');
const testButton = zhRuntime.document.getElementById('inspAi_cloudTestButton');
assert(testButton, 'Cloud test button should render');
testButton.click();
assert(zhRuntime.posted.length === 1, 'Cloud test button should post one request');
assert(zhRuntime.posted[0].presetId === 'standard_preview', 'Cloud test button should send selected preset id, not localized text');

const enRuntime = createRenderer('en', sampleStatus, 'quality_optimize');
enRuntime.renderer.renderCloudAiSettingsPanel(enRuntime.container);
assert(enRuntime.container.innerHTML.includes('Quality AI Optimize'), 'Cloud mode en should render localized preset label');
assert(enRuntime.container.innerHTML.includes('Higher quality cloud AI assistance for pro workflows.'), 'Cloud mode en should render localized preset description');
assert(enRuntime.container.innerHTML.includes('Quality'), 'Cloud mode en should render localized quality tier');
assert(!/qwen-|dashscope|apiKey|modelName|baseUrl/i.test(enRuntime.container.innerHTML), 'Rendered Cloud panel should not expose raw provider config');

console.log('cloud_ai_settings_drawer.test.js ok');
