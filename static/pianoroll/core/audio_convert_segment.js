/**
 * Pure helpers for audio-clip segment conversion (UI metadata only; does not trim timeline clips).
 */
(function () {
  'use strict';

  var DEFAULT_SEGMENT_LEN = 30;
  var MIN_SEGMENT_LEN = 1;
  var MAX_SEGMENT_LEN = 60;
  var PRESET_LENGTHS = [15, 30, 60];

  function _num(x, fallback) {
    var n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampSegment(audioDurationSec, startSec, durationSec) {
    var total = Math.max(0, _num(audioDurationSec, 0));
    var start = Math.max(0, _num(startSec, 0));
    if (total > 0 && start >= total) {
      start = Math.max(0, total - MIN_SEGMENT_LEN);
    }
    var dur = Math.max(MIN_SEGMENT_LEN, Math.min(_num(durationSec, DEFAULT_SEGMENT_LEN), MAX_SEGMENT_LEN));
    var remaining = total > 0 ? Math.max(0, total - start) : dur;
    if (total > 0) {
      dur = Math.min(dur, remaining);
    }
    if (dur < MIN_SEGMENT_LEN) {
      return null;
    }
    var end = start + dur;
    return { startSec: start, durationSec: dur, endSec: end };
  }

  /**
   * Default: playhead within clip if possible, else 0; length 30s or remainder.
   */
  function defaultSegmentForAudioClip(opts) {
    opts = opts || {};
    var audioDur = _num(opts.audioDurationSec, 0);
    var playhead = _num(opts.playheadSec, 0);
    var instanceStart = opts.instanceStartSec != null ? _num(opts.instanceStartSec, 0) : null;
    var start = 0;
    if (instanceStart != null && Number.isFinite(playhead) && playhead >= instanceStart) {
      start = Math.max(0, playhead - instanceStart);
    }
    var len = DEFAULT_SEGMENT_LEN;
    if (audioDur > 0) {
      len = Math.min(DEFAULT_SEGMENT_LEN, Math.max(MIN_SEGMENT_LEN, audioDur - start));
    }
    return clampSegment(audioDur, start, len) || { startSec: 0, durationSec: DEFAULT_SEGMENT_LEN, endSec: DEFAULT_SEGMENT_LEN };
  }

  function formatSegmentRange(seg, fmtSec) {
    fmtSec = fmtSec || function (x) { return String(x); };
    if (!seg) return '';
    return fmtSec(seg.startSec) + '–' + fmtSec(seg.endSec) + ' (' + fmtSec(seg.durationSec) + ')';
  }

  var api = {
    DEFAULT_SEGMENT_LEN: DEFAULT_SEGMENT_LEN,
    PRESET_LENGTHS: PRESET_LENGTHS,
    clampSegment: clampSegment,
    defaultSegmentForAudioClip: defaultSegmentForAudioClip,
    formatSegmentRange: formatSegmentRange,
  };

  if (typeof window !== 'undefined') {
    window.H2SAudioConvertSegment = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
