#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const app = fs.readFileSync(path.join(root, 'static/pianoroll/app.js'), 'utf8');
const locales = ['en', 'zh', 'ja'].map((locale) => JSON.parse(
  fs.readFileSync(path.join(root, `static/i18n/locales/${locale}.json`), 'utf8'),
));

for (const dictionary of locales) {
  assert(dictionary['cloudAi.quotaExceeded'], 'Cloud AI quota guidance should be localized');
  assert(dictionary['convert.fail.quotaExceeded'], 'audio conversion quota guidance should be localized');
}

assert(app.includes("status === 429"), 'Cloud AI should recognize HTTP 429 quota responses');
assert(app.includes("_t('cloudAi.quotaExceeded')"), 'Cloud AI should show purchase guidance');
assert(app.includes("e.errorBucket === 'quota_exceeded'"), 'audio conversion should preserve quota failures');
assert(app.includes("reason === 'quota_exceeded' || reason === 'insufficient_credits'"), 'worker bridge should preserve insufficient-credit errors');
assert((app.match(/\/quota_exceeded\|insufficient_credits\//g) || []).length >= 2, 'import and recording flows should stop fallback on quota errors');

console.log('quota purchase guidance tests passed');
