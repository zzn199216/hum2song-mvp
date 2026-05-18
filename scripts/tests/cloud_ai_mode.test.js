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
const editorRuntime = fs.readFileSync(path.join(root, 'static/pianoroll/controllers/editor_runtime.js'), 'utf8');

assert(indexHtml.includes('id="editorLocalLlmSettings"'), 'standalone local LLM settings wrapper should exist');
assert(indexHtml.includes('id="editorCloudAiPanel"'), 'Cloud AI panel should exist');
assert(indexHtml.includes('id="editorLlmBaseUrl"'), 'standalone Base URL field must remain in the DOM');
assert(indexHtml.includes('id="editorLlmModel"'), 'standalone model field must remain in the DOM');
assert(indexHtml.includes('id="editorLlmAuthToken"'), 'standalone token field must remain in the DOM');

assert(bridge.includes("params.get('cloudMode') === '1'"), 'Cloud mode should require explicit cloudMode query flag');
assert(bridge.includes('H2S_CLOUD_AI_STATUS_REQUEST'), 'Studio should request Cloud AI status from parent');
assert(bridge.includes('H2S_CLOUD_AI_STATUS_RESPONSE'), 'Studio should handle Cloud AI status response');
assert(bridge.includes('H2S_CLOUD_AI_STATUS_REQUEST_ID'), 'Cloud AI status responses should be correlated by requestId');
assert(bridge.includes('data.requestId !== window.H2S_CLOUD_AI_STATUS_REQUEST_ID'), 'Mismatched Cloud AI status responses should be ignored');
assert(bridge.includes("local.style.display = 'none'"), 'Cloud mode should hide local provider settings');
assert(!/H2S_LLM_CLIENT|callChatCompletions|listModels/.test(bridge), 'Cloud AI status must not call browser-side provider clients');

assert(editorRuntime.includes('shouldBlockCloudLlmOptimize'), 'Cloud mode should block llm_v0 optimize clicks for now');
assert(editorRuntime.includes('云端 AI 优化即将接入；当前可先使用本地确定性优化功能。'), 'Cloud mode should show pending server-side AI message');

console.log('cloud_ai_mode.test.js ok');
