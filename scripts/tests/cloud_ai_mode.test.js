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
const agentController = fs.readFileSync(path.join(root, 'static/pianoroll/controllers/agent_controller.js'), 'utf8');
const zhLocale = fs.readFileSync(path.join(root, 'static/i18n/locales/zh.json'), 'utf8');

assert(indexHtml.includes('id="editorLocalLlmSettings"'), 'standalone local LLM settings wrapper should exist');
assert(indexHtml.includes('id="editorCloudAiPanel"'), 'Cloud AI panel should exist');
assert(indexHtml.includes('id="editorLlmBaseUrl"'), 'standalone Base URL field must remain in the DOM');
assert(indexHtml.includes('id="editorLlmModel"'), 'standalone model field must remain in the DOM');
assert(indexHtml.includes('id="editorLlmAuthToken"'), 'standalone token field must remain in the DOM');

assert(bridge.includes("params.get('cloudMode') === '1'"), 'Cloud mode should require explicit cloudMode query flag');
assert(bridge.includes('H2S_CLOUD_AI_STATUS_REQUEST'), 'Studio should request Cloud AI status from parent');
assert(bridge.includes('H2S_CLOUD_AI_STATUS_RESPONSE'), 'Studio should handle Cloud AI status response');
assert(bridge.includes('H2S_CLOUD_LLM_CLIENT'), 'Cloud mode should expose a server-side LLM bridge adapter');
assert(bridge.includes('callCloudChatCompletions'), 'Cloud LLM adapter should present chat-completions-like API');
assert(bridge.includes('extractCloudJsonObject'), 'Cloud LLM adapter should preserve JSON patch extraction');
assert(bridge.includes('chatMessageStats'), 'Cloud LLM adapter should report safe request size diagnostics');
assert(bridge.includes(': 600000'), 'Cloud LLM adapter default timeout should be capped at 10 minutes');
assert(agentController.includes('timeoutMs: 600000'), 'optimize_clip Cloud LLM timeout should be capped at 10 minutes');
assert(zhLocale.includes('可能需要 1-3 分钟'), 'optimize progress copy should set long-running AI expectation');
assert(bridge.includes('AI arrangement request is too large for the current plan limit'), 'Cloud LLM adapter should map oversized requests to a clear arrangement-size message');
assert(!bridge.includes('clearing assistant history'), 'oversized arrangement message should not mention history when history is not included');
assert(bridge.includes('H2S_CLOUD_AI_STATUS_REQUEST_ID'), 'Cloud AI status responses should be correlated by requestId');
assert(bridge.includes('data.requestId !== window.H2S_CLOUD_AI_STATUS_REQUEST_ID'), 'Mismatched Cloud AI status responses should be ignored');
assert(bridge.includes("p.id === 'auto'"), 'interactive Cloud AI should prefer auto model profile');
assert(bridge.includes("modelProfileId: modelProfileId"), 'Cloud AI chat requests should send selected modelProfileId');
assert(bridge.includes("requestedMaxOutputTokens: requestedMaxOutputTokens"), 'Cloud AI chat requests should send requested output token budget');
assert(bridge.includes("noteCount: noteCount"), 'Cloud AI chat requests should send note count metadata');
assert(bridge.includes("task: task"), 'Cloud AI chat requests should send task metadata');
assert(bridge.includes("effectiveMaxOutputTokens"), 'Cloud AI chat responses should preserve effective output token budget');
assert(!bridge.includes("p.id === 'pro_quality' || p.id === 'preview_standard' || p.id === 'free_basic'"), 'interactive Cloud AI must not default internal/pro users to slow pro_quality');
assert(bridge.includes("if (typeof data.requestId !== 'string' || !data.requestId) return;"), 'Cloud AI chat responses should dispatch by requestId instead of one global current id');
assert(!bridge.includes("data.requestId !== window.H2S_CLOUD_AI_CHAT_REQUEST_ID"), 'Cloud AI chat responses must not drop late valid responses because a newer request changed the global id');
assert(bridge.includes("local.style.display = 'none'"), 'Cloud mode should hide local provider settings');
assert(!bridge.includes('ROOT.H2S_LLM_CLIENT') && !bridge.includes('window.H2S_LLM_CLIENT') && !bridge.includes('listModels'), 'Cloud AI status must not call browser-side provider clients');

assert(!editorRuntime.includes('shouldBlockCloudLlmOptimize'), 'Cloud mode should not block llm_v0 optimize clicks after bridge wiring');
assert(!editorRuntime.includes('showCloudLlmPendingMessage'), 'Cloud mode pending server-side AI message should be removed');

console.log('cloud_ai_mode.test.js ok');
