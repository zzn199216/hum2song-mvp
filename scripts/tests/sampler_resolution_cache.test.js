#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
let samplerBaseUrl = null;
let fetchCalls = [];

global.window = global;
global.localStorage = {
  getItem(key){
    if (key === 'hum2song_studio_sampler_baseurl') return samplerBaseUrl;
    return null;
  },
  setItem(){},
  removeItem(){},
};
global.fetch = async function(url, options){
  fetchCalls.push({ url: String(url), method: options && options.method });
  return { ok: true };
};

require(path.join(repoRoot, 'static', 'pianoroll', 'project.js'));

async function main(){
  const P = global.H2SProject;
  const pack = P.SAMPLER_PACKS['tonejs:piano'];

  const bundled = await P.resolveSamplerUrlsForPack(pack, 'tonejs:piano');
  assert.strictEqual(fetchCalls.length, 0, 'bundled packs should trust the shipped manifest instead of probing with HEAD');
  assert.strictEqual(Object.keys(bundled.urls).length, pack.requiredKeys.length);
  assert.strictEqual(
    bundled.urls.A4,
    '/static/pianoroll/vendor/tonejs-instruments/samples/piano/A4.mp3',
  );

  samplerBaseUrl = 'https://samples.example.test/root';
  fetchCalls = [];
  const external = await P.resolveSamplerUrlsForPack(pack, 'tonejs:piano');
  assert.strictEqual(fetchCalls.length, pack.requiredKeys.length, 'external legacy packs should retain extension probing');
  assert.ok(fetchCalls.every(call => call.method === 'HEAD'));
  assert.strictEqual(Object.keys(external.urls).length, pack.requiredKeys.length);

  console.log('sampler_resolution_cache.test.js: all passed');
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
