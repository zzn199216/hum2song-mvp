#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const bridge = fs.readFileSync(path.join(root, 'static/pianoroll/cloud_project_bridge.js'), 'utf8');

function createRuntime(configuredOrigins) {
  const posted = [];
  let messageHandler = null;
  const parent = {
    postMessage(payload, origin) {
      posted.push({ payload, origin });
    },
  };
  const window = {
    H2S_CLOUD_PARENT_ORIGINS: configuredOrigins,
    H2S_CLOUD_MODE: false,
    location: { hostname: 'studio.hum2song.cn', search: '' },
    parent,
    addEventListener(type, handler) {
      if (type === 'message') messageHandler = handler;
    },
    removeEventListener() {},
    dispatchEvent() {},
    H2SStartupPerf: { mark() {}, onFirstInteractive() {} },
  };
  const document = {
    referrer: '',
    readyState: 'complete',
    getElementById() { return null; },
    addEventListener() {},
  };
  const context = {
    window,
    document,
    console: { warn() {}, info() {}, debug() {} },
    URL,
    URLSearchParams,
    Set,
    JSON,
    Math,
    Date,
    Error,
    CustomEvent: function CustomEvent(type, init) {
      return { type, detail: init && init.detail };
    },
    setTimeout() { return 0; },
    clearTimeout() {},
  };
  vm.createContext(context);
  vm.runInContext(bridge, context);
  assert(messageHandler, 'bridge should register a message handler');
  return {
    posted,
    send(origin) {
      posted.length = 0;
      messageHandler({
        origin,
        data: { type: 'H2S_CLOUD_PING', requestId: 'ping-1' },
      });
      return posted.slice();
    },
  };
}

const runtime = createRuntime([
  'https://hum2song.cn',
  'https://www.hum2song.cn',
  'https://hum2song.com',
  'https://www.hum2song.com',
]);

for (const origin of [
  'https://hum2song.cn',
  'https://www.hum2song.cn',
  'https://hum2song.com',
  'https://www.hum2song.com',
]) {
  const posts = runtime.send(origin);
  assert(posts.length === 1, origin + ' should be allowed');
  assert(posts[0].origin === origin, origin + ' response should target exact origin');
  assert(posts[0].payload.type === 'H2S_CLOUD_PONG', origin + ' should receive pong');
}

assert(runtime.send('https://evil.com').length === 0, 'evil.com should be rejected');
assert(runtime.send('https://studio.hum2song.com').length === 0, 'studio.hum2song.com should not be trusted as a parent by default');

const productionDefaultRuntime = createRuntime(undefined);
assert(productionDefaultRuntime.send('https://hum2song.cn').length === 1, 'production Studio host should keep hum2song.cn default parent');
assert(productionDefaultRuntime.send('https://www.hum2song.cn').length === 1, 'production Studio host should keep www.hum2song.cn default parent');
assert(productionDefaultRuntime.send('https://hum2song.com').length === 1, 'production Studio host should keep hum2song.com default parent');
assert(productionDefaultRuntime.send('https://www.hum2song.com').length === 1, 'production Studio host should keep www.hum2song.com default parent');

console.log('cloud_parent_origins_runtime.test.js ok');
