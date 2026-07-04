/**
 * Product clip auto-split (phrase / optional pitch-range / bar).
 * Not audio stem separation — copy must never imply Demucs / instrument stems.
 */
(function (root) {
  'use strict';

  var LS_PREFS = 'h2s_clip_auto_split_prefs';

  var DEFAULT_PREFS = {
    /** Master: split long transcription into shorter clips by pauses + max length */
    splitByPhrase: true,
    minGapSec: 0.9,
    maxDurationSec: 14,
    /** Advanced: pitch-range note grouping — NOT instrument stems */
    splitByPitchRange: false,
    splitByBar: false,
    maxBarsPerSegment: 4,
    suppressWeakFragments: true,
  };

  function _num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function loadPrefs() {
    try {
      if (typeof localStorage === 'undefined') return Object.assign({}, DEFAULT_PREFS);
      var raw = localStorage.getItem(LS_PREFS);
      if (!raw) return Object.assign({}, DEFAULT_PREFS);
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return Object.assign({}, DEFAULT_PREFS);
      return {
        splitByPhrase: o.splitByPhrase !== false,
        minGapSec: clamp(_num(o.minGapSec, DEFAULT_PREFS.minGapSec), 0.3, 5),
        maxDurationSec: clamp(_num(o.maxDurationSec, DEFAULT_PREFS.maxDurationSec), 4, 120),
        splitByPitchRange: !!o.splitByPitchRange,
        splitByBar: !!o.splitByBar,
        maxBarsPerSegment: clamp(_num(o.maxBarsPerSegment, DEFAULT_PREFS.maxBarsPerSegment), 1, 32),
        suppressWeakFragments: o.suppressWeakFragments !== false,
      };
    } catch (_e) {
      return Object.assign({}, DEFAULT_PREFS);
    }
  }

  function savePrefs(prefs) {
    try {
      if (typeof localStorage === 'undefined' || !prefs) return;
      localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
    } catch (_e) {}
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function getSplitApi() {
    return (
      (typeof globalThis !== 'undefined' && globalThis.H2SScoreHeuristicSplit) ||
      (typeof root !== 'undefined' && root.H2SScoreHeuristicSplit) ||
      null
    );
  }

  /**
   * Apply optional pitch-range split (advanced). Returns { score, pitchSplitApplied }.
   */
  function applyPitchRangeSplit(score, prefs) {
    if (!prefs || !prefs.splitByPitchRange) return { score: score, pitchSplitApplied: false };
    var S = getSplitApi();
    if (!S || typeof S.splitScoreDocByPitchBuckets !== 'function') {
      return { score: score, pitchSplitApplied: false };
    }
    try {
      return { score: S.splitScoreDocByPitchBuckets(score), pitchSplitApplied: true };
    } catch (_e) {
      return { score: score, pitchSplitApplied: false };
    }
  }

  /**
   * Build timeline clip placements from a score. Pure planning (no DOM).
   * @returns {Array<{ score: object, tMinAbs: number, trackName?: string, splitIndex?: number, segmentIndex?: number, segmentCount?: number }>}
   */
  function planClipSegments(score, prefs) {
    prefs = prefs || loadPrefs();
    var S = getSplitApi();
    if (!S) return [{ score: score, tMinAbs: 0 }];

    var pitchRes = applyPitchRangeSplit(score, prefs);
    var scoreForClip = pitchRes.score;
    var explodeWeakGuardOpts = pitchRes.pitchSplitApplied
      ? { suppressWeakFragments: !!prefs.suppressWeakFragments }
      : null;

    var segments = [];
    if (prefs.splitByBar && typeof S.segmentScoreDocByBarBoundaries === 'function') {
      try {
        segments = S.segmentScoreDocByBarBoundaries(scoreForClip, {
          maxBars: prefs.maxBarsPerSegment,
        });
      } catch (_e) {
        segments = [];
      }
    } else if (prefs.splitByPhrase !== false) {
      if (typeof S.segmentScoreDocByGapAndMaxDuration === 'function') {
        try {
          segments = S.segmentScoreDocByGapAndMaxDuration(scoreForClip, {
            minGapSec: prefs.minGapSec,
            maxDurationSec: prefs.maxDurationSec,
          });
        } catch (_e2) {
          segments = [{ score: scoreForClip, tMin: 0, tMax: 0 }];
        }
      } else {
        segments = [{ score: scoreForClip, tMin: 0, tMax: 0 }];
      }
    } else {
      segments = [{ score: scoreForClip, tMin: 0, tMax: 0 }];
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      segments = [{ score: scoreForClip, tMin: 0, tMax: 0 }];
    }

    var out = [];
    for (var bi = 0; bi < segments.length; bi++) {
      var barSeg = segments[bi];
      var segScore = barSeg && barSeg.score;
      var segTMinAbs = barSeg && typeof barSeg.tMin === 'number' && isFinite(barSeg.tMin) ? barSeg.tMin : 0;
      if (!segScore) continue;

      var explodeParts = null;
      if (pitchRes.pitchSplitApplied && typeof S.explodeNonEmptyTracksToSingleTrackScores === 'function') {
        explodeParts = S.explodeNonEmptyTracksToSingleTrackScores(segScore, explodeWeakGuardOpts || undefined);
      }
      if (Array.isArray(explodeParts) && explodeParts.length >= 2) {
        for (var k = 0; k < explodeParts.length; k++) {
          var part = explodeParts[k];
          var scoreForPart = part.score;
          var tMinForPart = 0;
          if (typeof S.trimScoreDocToNoteExtent === 'function') {
            var trimmed = S.trimScoreDocToNoteExtent(part.score);
            scoreForPart = trimmed.score;
            tMinForPart = typeof trimmed.tMin === 'number' && isFinite(trimmed.tMin) ? trimmed.tMin : 0;
          }
          out.push({
            score: scoreForPart,
            tMinAbs: segTMinAbs + tMinForPart,
            trackName: part.trackName,
            splitIndex: part.splitIndex,
            pitchSplitApplied: true,
            barSegmentIndex: segments.length > 1 ? bi : undefined,
          });
        }
      } else {
        var singleScore = segScore;
        var tMinSingle = 0;
        if (typeof S.trimScoreDocToNoteExtent === 'function') {
          var tr = S.trimScoreDocToNoteExtent(segScore);
          singleScore = tr.score;
          tMinSingle = typeof tr.tMin === 'number' && isFinite(tr.tMin) ? tr.tMin : 0;
        }
        out.push({
          score: singleScore,
          tMinAbs: segTMinAbs + tMinSingle,
          pitchSplitApplied: pitchRes.pitchSplitApplied,
          barSegmentIndex: segments.length > 1 ? bi : undefined,
        });
      }
    }

    if (out.length === 0) out.push({ score: scoreForClip, tMinAbs: 0 });
    return out;
  }

  /**
   * Materialize planned segments onto the project timeline.
   * @param {object} ctx — { project, H2SProject, persist, render, addClipToTimeline, playheadSec }
   */
  function materializePlannedClips(ctx, plan, opts) {
    opts = opts || {};
    var P = ctx.H2SProject;
    if (!P || typeof P.createClipFromScore !== 'function') return { ok: false, clipCount: 0, clipIds: [] };

    var importBaseName = opts.baseName || 'Clip';
    var playheadSec = ctx.playheadSec != null ? ctx.playheadSec : 0;
    var sourceTaskId = opts.sourceTaskId || null;
    var clipIds = [];

    var maxTrackParts = 0;
    for (var i = 0; i < plan.length; i++) {
      if (plan[i].splitIndex != null && plan[i].splitIndex + 1 > maxTrackParts) {
        maxTrackParts = plan[i].splitIndex + 1;
      }
    }
    if (maxTrackParts > 1 && ctx.project) {
      if (!ctx.project.tracks) ctx.project.tracks = [];
      while (ctx.project.tracks.length < maxTrackParts) {
        var n = ctx.project.tracks.length + 1;
        ctx.project.tracks.push({ id: P.uid('trk_'), name: 'Track ' + n });
      }
    }

    for (var j = plan.length - 1; j >= 0; j--) {
      var item = plan[j];
      var label = importBaseName;
      if (plan.length > 1) label += ' · ' + (j + 1);
      if (item.trackName) label += ' — ' + item.trackName;
      var clip = P.createClipFromScore(item.score, {
        name: label,
        sourceTaskId: sourceTaskId || undefined,
      });
      if (!clip.meta) clip.meta = {};
      if (opts.workerJobId) clip.meta.workerJobId = opts.workerJobId;
      if (opts.workerConversionSource) clip.meta.workerConversionSource = opts.workerConversionSource;
      if (opts.workerConversionKind) clip.meta.workerConversionKind = opts.workerConversionKind;
      if (opts.segmentStartSec != null) clip.meta.segmentStartSec = opts.segmentStartSec;
      if (opts.segmentDurationSec != null) clip.meta.segmentDurationSec = opts.segmentDurationSec;
      if (item.pitchSplitApplied) clip.meta.heuristicPitchSplit = true;
      clip.meta.autoSplit = true;
      clip.meta.autoSplitSource = 'phrase';
      if (item.barSegmentIndex != null) clip.meta.autoSplitBarSegment = item.barSegmentIndex;

      var trackIndex = item.splitIndex != null ? item.splitIndex : 0;
      var instanceStartSec = playheadSec + (item.tMinAbs || 0);
      ctx.project.clips.unshift(clip);
      if (typeof ctx.addClipToTimeline === 'function') {
        ctx.addClipToTimeline(clip.id, instanceStartSec, trackIndex, { skipPersistRender: true });
      }
      clipIds.push(clip.id);
    }

    if (typeof ctx.persist === 'function') ctx.persist();
    if (typeof ctx.render === 'function') ctx.render();

    return { ok: true, clipCount: clipIds.length, clipIds: clipIds };
  }

  function materializeScoreAsTimelineClips(ctx, score, opts) {
    opts = opts || {};
    var prefs = opts.prefs || loadPrefs();
    if (opts.forceSingleClip) {
      return materializePlannedClips(ctx, [{ score: score, tMinAbs: 0 }], opts);
    }
    if (!prefs.splitByPhrase && !prefs.splitByPitchRange && !prefs.splitByBar) {
      return materializePlannedClips(ctx, [{ score: score, tMinAbs: 0 }], opts);
    }
    var plan = planClipSegments(score, prefs);
    if (plan.length <= 1 && !prefs.splitByPitchRange) {
      return materializePlannedClips(ctx, [{ score: plan[0] ? plan[0].score : score, tMinAbs: 0 }], opts);
    }
    return materializePlannedClips(ctx, plan, opts);
  }

  var API = {
    DEFAULT_PREFS: DEFAULT_PREFS,
    LS_PREFS: LS_PREFS,
    loadPrefs: loadPrefs,
    savePrefs: savePrefs,
    planClipSegments: planClipSegments,
    materializePlannedClips: materializePlannedClips,
    materializeScoreAsTimelineClips: materializeScoreAsTimelineClips,
    applyPitchRangeSplit: applyPitchRangeSplit,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2SClipAutoSplit = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
