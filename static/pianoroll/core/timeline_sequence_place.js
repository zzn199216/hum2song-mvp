/**
 * Timeline sequential clip placement and layout helpers (seconds in v1 view).
 * Canonical storage remains beats in ProjectDoc v2; placement APIs use startSec.
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

  function findClip(project, clipId) {
    if (!project || !clipId) return null;
    var clips = project.clips;
    if (Array.isArray(clips)) {
      for (var i = 0; i < clips.length; i++) {
        if (clips[i] && String(clips[i].id) === String(clipId)) return clips[i];
      }
    } else if (clips && typeof clips === 'object') {
      return clips[clipId] || null;
    }
    return null;
  }

  function getInstanceEndSec(inst, project, H2SProject) {
    if (!inst) return 0;
    var start = typeof inst.startSec === 'number' && isFinite(inst.startSec) ? inst.startSec : 0;
    var clip = findClip(project, inst.clipId);
    var SG = _SG();
    var span = SG && typeof SG.getClipPlacementSpanSec === 'function'
      ? SG.getClipPlacementSpanSec(clip, H2SProject)
      : 0;
    if (!span && H2SProject && clip && typeof H2SProject.scoreStats === 'function') {
      var st = H2SProject.scoreStats(clip.score);
      span = st && st.spanSec ? st.spanSec : 0;
    }
    return start + Math.max(0, span);
  }

  /**
   * @param {'playhead'|'selectionStart'|'selectionEnd'|'timelineStart'} anchor
   */
  function resolvePlacementAnchorSec(anchor, ctx) {
    ctx = ctx || {};
    var project = ctx.project || {};
    var ui = project.ui || {};
    var mode = String(anchor || 'playhead');
    if (mode === 'timelineStart') return 0;
    if (mode === 'playhead') {
      return typeof ui.playheadSec === 'number' && isFinite(ui.playheadSec) ? Math.max(0, ui.playheadSec) : 0;
    }
    var instId = ctx.selectedInstanceId;
    var inst = null;
    if (instId && Array.isArray(project.instances)) {
      for (var i = 0; i < project.instances.length; i++) {
        if (project.instances[i] && String(project.instances[i].id) === String(instId)) {
          inst = project.instances[i];
          break;
        }
      }
    }
    if (!inst) {
      return typeof ui.playheadSec === 'number' && isFinite(ui.playheadSec) ? Math.max(0, ui.playheadSec) : 0;
    }
    if (mode === 'selectionStart') {
      return typeof inst.startSec === 'number' && isFinite(inst.startSec) ? Math.max(0, inst.startSec) : 0;
    }
    if (mode === 'selectionEnd') return getInstanceEndSec(inst, project, ctx.H2SProject);
    return typeof ui.playheadSec === 'number' && isFinite(ui.playheadSec) ? Math.max(0, ui.playheadSec) : 0;
  }

  function resolveClipsForSequence(project, clipIds) {
    var out = [];
    for (var i = 0; i < (clipIds || []).length; i++) {
      var c = findClip(project, clipIds[i]);
      if (c) out.push(c);
    }
    var SG = _SG();
    if (SG && typeof SG.sortClipsForSequence === 'function') return SG.sortClipsForSequence(out);
    return out;
  }

  function generatePlacementBatchId() {
    return 'pb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Pure planning: ordered { clipId, startSec, spanSec } without mutating project.
   */
  function planSequentialPlacements(project, clipIds, opts, H2SProject) {
    opts = opts || {};
    var SG = _SG();
    var clips = resolveClipsForSequence(project, clipIds);
    if (!clips.length) return { ok: false, reason: 'no_clips', placements: [] };
    var anchorSec = typeof opts.anchorSec === 'number' && isFinite(opts.anchorSec)
      ? Math.max(0, opts.anchorSec)
      : resolvePlacementAnchorSec(opts.anchor || 'playhead', {
        project: project,
        selectedInstanceId: opts.selectedInstanceId,
        H2SProject: H2SProject,
      });
    var gapSec = typeof opts.gapSec === 'number' && isFinite(opts.gapSec) ? Math.max(0, opts.gapSec) : 0;
    var cursor = anchorSec;
    var placements = [];
    for (var j = 0; j < clips.length; j++) {
      var clip = clips[j];
      var span = SG && typeof SG.getClipPlacementSpanSec === 'function'
        ? SG.getClipPlacementSpanSec(clip, H2SProject)
        : 0;
      placements.push({ clipId: clip.id, startSec: cursor, spanSec: span });
      cursor += span + gapSec;
    }
    return { ok: true, anchorSec: anchorSec, placements: placements, trackIndex: opts.trackIndex };
  }

  function compactInstancesOnTrack(instances, project, trackIndex, gapSec, H2SProject) {
    gapSec = typeof gapSec === 'number' && isFinite(gapSec) ? Math.max(0, gapSec) : 0;
    var onTrack = (instances || []).filter(function (inst) {
      return inst && Math.floor(Number(inst.trackIndex || 0)) === Math.floor(Number(trackIndex || 0));
    });
    onTrack.sort(function (a, b) {
      return (Number(a.startSec) || 0) - (Number(b.startSec) || 0);
    });
    if (!onTrack.length) return [];
    var cursor = Number(onTrack[0].startSec) || 0;
    var updates = [];
    for (var i = 0; i < onTrack.length; i++) {
      var inst = onTrack[i];
      var clip = findClip(project, inst.clipId);
      var SG = _SG();
      var span = SG && typeof SG.getClipPlacementSpanSec === 'function'
        ? SG.getClipPlacementSpanSec(clip, H2SProject)
        : 0;
      updates.push({ instanceId: inst.id, startSec: cursor });
      inst.startSec = cursor;
      cursor += span + gapSec;
    }
    return updates;
  }

  function repeatPlacementsTemplate(placements, repeatCount, gapSec) {
    if (!Array.isArray(placements) || !placements.length || repeatCount < 1) return [];
    gapSec = typeof gapSec === 'number' && isFinite(gapSec) ? Math.max(0, gapSec) : 0;
    var out = [];
    var templateSpan = 0;
    for (var i = 0; i < placements.length; i++) {
      templateSpan += (Number(placements[i].spanSec) || 0) + gapSec;
    }
    if (templateSpan > 0) templateSpan -= gapSec;
    var lastEnd = placements[placements.length - 1];
    var baseStart = (Number(lastEnd.startSec) || 0) + (Number(lastEnd.spanSec) || 0) + gapSec;
    for (var r = 0; r < repeatCount; r++) {
      var offset = r * templateSpan + (r > 0 ? gapSec * r : 0);
      for (var j = 0; j < placements.length; j++) {
        var p = placements[j];
        out.push({
          clipId: p.clipId,
          startSec: baseStart + offset + ((Number(p.startSec) || 0) - (Number(placements[0].startSec) || 0)),
          spanSec: p.spanSec,
        });
      }
    }
    return out;
  }

  var API = {
    findClip: findClip,
    getInstanceEndSec: getInstanceEndSec,
    resolvePlacementAnchorSec: resolvePlacementAnchorSec,
    resolveClipsForSequence: resolveClipsForSequence,
    planSequentialPlacements: planSequentialPlacements,
    generatePlacementBatchId: generatePlacementBatchId,
    compactInstancesOnTrack: compactInstancesOnTrack,
    repeatPlacementsTemplate: repeatPlacementsTemplate,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2STimelineSequencePlace = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
