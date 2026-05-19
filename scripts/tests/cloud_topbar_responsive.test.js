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

console.log('cloud_topbar_responsive.test.js ok');
