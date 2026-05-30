#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const root = path.resolve(__dirname, '../..');
const index = fs.readFileSync(path.join(root, 'static/pianoroll/index.html'), 'utf8');
const topbarMatch = index.match(/\.topbar\s*\{([\s\S]*?)\n\s*\}/);
assert(topbarMatch, 'index.html should define .topbar CSS');
const topbarCss = topbarMatch[1];

assert(/flex-wrap:\s*wrap/.test(topbarCss), 'topbar should wrap controls at narrow widths');
assert(/min-height:\s*54px/.test(topbarCss), 'topbar should preserve the desktop baseline height');
assert(!/(^|[;\s])height:\s*54px/.test(topbarCss), 'topbar should not use fixed height that clips or overlaps wrapped controls');
assert(/\.topbar\s+\.row\s*\{[\s\S]*?min-width:\s*0/.test(index), 'topbar transport row should be allowed to shrink');
assert(/@media\s*\(max-width:\s*900px\)[\s\S]*?\.topbar/.test(index), 'topbar should have narrow-width responsive handling');
assert(!/\.topbar[\s\S]{0,220}position:\s*fixed/.test(index), 'topbar should not be fixed over transport controls');
assert(!/\.topbar[\s\S]{0,220}z-index/.test(index), 'topbar should not create a z-index overlay over record/play buttons');
assert(index.indexOf('id="studioMobileWarning"') !== -1, 'index.html should include a non-blocking mobile Studio warning');
assert(index.indexOf('data-i18n="studio.mobileWarning"') !== -1, 'mobile warning should use i18n copy');
assert(/\.studioMobileWarning\s*\{[\s\S]*?display:\s*none/.test(index), 'mobile warning should be hidden on wide screens');
assert(/@media\s*\(max-width:\s*640px\)[\s\S]*?\.studioMobileWarning\s*\{[\s\S]*?display:\s*block/.test(index), 'mobile warning should show on narrow screens');
assert(/\.studioMobileWarning\s*\{[\s\S]*?overflow-wrap:\s*anywhere/.test(index), 'mobile warning copy should wrap without horizontal overflow');
assert(!/\.studioMobileWarning\s*\{[\s\S]*?width:\s*100vw/.test(index), 'mobile warning should not use 100vw');

console.log('cloud_topbar_responsive.test.js ok');
