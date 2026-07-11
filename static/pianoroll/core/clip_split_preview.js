/**
 * Auto-split preview summary (plan only, no DOM).
 */
(function (root) {
  'use strict';

  function _SG() {
    return (
      (typeof globalThis !== 'undefined' && globalThis.H2SClipSplitGroup) ||
      (typeof root !== 'undefined' && root.H2SClipSplitGroup) ||
      null
    );
  }

  function segmentSpanSec(item) {
    if (!item) return 0;
    if (typeof item.sourceSpanSec === 'number' && isFinite(item.sourceSpanSec) && item.sourceSpanSec > 0) {
      return item.sourceSpanSec;
    }
    return 0;
  }

  function summarizePlan(plan, H2SProject) {
    plan = Array.isArray(plan) ? plan : [];
    if (!plan.length) return { count: 0, totalSpanSec: 0, lines: [] };
    var lines = [];
    var total = 0;
    for (var i = 0; i < plan.length; i++) {
      var item = plan[i];
      var span = segmentSpanSec(item);
      if (!span && H2SProject && item && item.score && typeof H2SProject.scoreStats === 'function') {
        var st = H2SProject.scoreStats(item.score);
        span = st && st.spanSec ? st.spanSec : 0;
      }
      total += span;
      lines.push({
        index: i + 1,
        startSec: typeof item.tMinAbs === 'number' ? item.tMinAbs : 0,
        spanSec: span,
      });
    }
    return { count: plan.length, totalSpanSec: total, lines: lines };
  }

  function formatPlanSummaryText(summary) {
    summary = summary || {};
    var lines = summary.lines || [];
    if (!lines.length) return 'No segments.';
    var parts = ['Segments: ' + (summary.count || lines.length)];
    for (var i = 0; i < lines.length && i < 12; i++) {
      var ln = lines[i];
      parts.push('#' + ln.index + ': ' + (ln.spanSec || 0).toFixed(2) + 's');
    }
    if (lines.length > 12) parts.push('…+' + (lines.length - 12) + ' more');
    parts.push('Total span ~' + (summary.totalSpanSec || 0).toFixed(2) + 's');
    return parts.join('\n');
  }

  var API = {
    summarizePlan: summarizePlan,
    formatPlanSummaryText: formatPlanSummaryText,
    segmentSpanSec: segmentSpanSec,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2SClipSplitPreview = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
