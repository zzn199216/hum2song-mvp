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
assert(cloudBody.includes('inspAi_cloudPreset'), 'Cloud panel should render a preset selector');
assert(cloudBody.includes('data-cloud-ai-preset-option'), 'Cloud preset options should be identifiable for safety checks');
assert(cloudBody.includes('H2S_CLOUD_AI_CHAT_REQUEST'), 'Cloud test action should request chat through the parent bridge');
assert(cloudBody.includes('H2S_CLOUD_AI_CHAT_RESPONSE'), 'Cloud test action should render correlated chat responses');
assert(cloudBody.includes('inspAi_cloudTestPrompt'), 'Cloud panel should render a test prompt textarea');
assert(cloudBody.includes('inspAi_cloudTestButton'), 'Cloud panel should render a Cloud AI test button');
assert(cloudBody.includes("_t('cloudAi.preset'"), 'Cloud preset label should use i18n');
assert(cloudBody.includes("_t('cloudAi.testCloudAi'"), 'Cloud test button should use i18n');
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

console.log('cloud_ai_settings_drawer.test.js ok');
