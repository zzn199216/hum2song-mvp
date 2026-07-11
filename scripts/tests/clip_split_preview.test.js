#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');

const Preview = require(path.resolve(__dirname, '../../static/pianoroll/core/clip_split_preview.js'));

(function () {
  const plan = [
    { tMinAbs: 0, sourceSpanSec: 12 },
    { tMinAbs: 12, sourceSpanSec: 8 },
  ];
  const summary = Preview.summarizePlan(plan, null);
  assert.strictEqual(summary.count, 2);
  assert.strictEqual(summary.totalSpanSec, 20);
  const text = Preview.formatPlanSummaryText(summary);
  assert.ok(text.includes('Total span'));
})();

console.log('clip_split_preview.test.js: ok');
