/**
 * Split-group metadata for product clip auto-split (not audio stem separation).
 * Placement span prefers splitSourceSpanSec over trimmed note extent.
 */
(function (root) {
  'use strict';

  var SPLIT_CLIP_META_KEYS = [
    'splitGroupId',
    'splitIndex',
    'splitCount',
    'splitSourceStartSec',
    'splitSourceSpanSec',
    'autoSplit',
    'autoSplitSource',
    'autoSplitBarSegment',
    'heuristicPitchSplit',
  ];

  function generateSplitGroupId() {
    return 'sg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function copySplitClipMeta(fromMeta, toMeta) {
    if (!fromMeta) return toMeta || {};
    var out = toMeta || {};
    for (var i = 0; i < SPLIT_CLIP_META_KEYS.length; i++) {
      var k = SPLIT_CLIP_META_KEYS[i];
      if (fromMeta[k] !== undefined && fromMeta[k] !== null) out[k] = fromMeta[k];
    }
    return out;
  }

  function applySplitGroupMeta(clip, opts) {
    if (!clip) return clip;
    if (!clip.meta) clip.meta = {};
    var o = opts || {};
    if (o.splitGroupId) clip.meta.splitGroupId = String(o.splitGroupId);
    if (typeof o.splitIndex === 'number' && isFinite(o.splitIndex)) {
      clip.meta.splitIndex = Math.max(0, Math.floor(o.splitIndex));
    }
    if (typeof o.splitCount === 'number' && isFinite(o.splitCount)) {
      clip.meta.splitCount = Math.max(1, Math.floor(o.splitCount));
    }
    if (typeof o.splitSourceStartSec === 'number' && isFinite(o.splitSourceStartSec)) {
      clip.meta.splitSourceStartSec = o.splitSourceStartSec;
    }
    if (typeof o.splitSourceSpanSec === 'number' && isFinite(o.splitSourceSpanSec)) {
      clip.meta.splitSourceSpanSec = Math.max(0, o.splitSourceSpanSec);
    }
    return clip;
  }

  function getClipSplitGroupMeta(clip) {
    var m = (clip && clip.meta) || {};
    if (!m.splitGroupId) return null;
    return {
      splitGroupId: String(m.splitGroupId),
      splitIndex: typeof m.splitIndex === 'number' ? m.splitIndex : 0,
      splitCount: typeof m.splitCount === 'number' ? m.splitCount : 1,
      splitSourceStartSec: typeof m.splitSourceStartSec === 'number' ? m.splitSourceStartSec : null,
      splitSourceSpanSec: typeof m.splitSourceSpanSec === 'number' ? m.splitSourceSpanSec : null,
    };
  }

  /** Placement duration (seconds): split original span first, not note-only extent. */
  function getClipPlacementSpanSec(clip, H2SProject) {
    var m = (clip && clip.meta) || {};
    if (typeof m.splitSourceSpanSec === 'number' && isFinite(m.splitSourceSpanSec) && m.splitSourceSpanSec > 0) {
      return m.splitSourceSpanSec;
    }
    if (typeof m.segmentDurationSec === 'number' && isFinite(m.segmentDurationSec) && m.segmentDurationSec > 0) {
      return m.segmentDurationSec;
    }
    var P = H2SProject;
    if (P && typeof P.scoreStats === 'function' && clip && clip.score) {
      var st = P.scoreStats(clip.score);
      if (st && typeof st.spanSec === 'number' && isFinite(st.spanSec)) return st.spanSec;
    }
    if (typeof m.spanSec === 'number' && isFinite(m.spanSec)) return m.spanSec;
    return 0;
  }

  function compareClipsForSequence(a, b) {
    var ma = getClipSplitGroupMeta(a);
    var mb = getClipSplitGroupMeta(b);
    if (ma && mb && ma.splitGroupId === mb.splitGroupId) return ma.splitIndex - mb.splitIndex;
    if (ma && !mb) return -1;
    if (!ma && mb) return 1;
    return 0;
  }

  function sortClipsForSequence(clips) {
    return (clips || []).slice().sort(compareClipsForSequence);
  }

  function formatSplitGroupBadge(clip) {
    var m = getClipSplitGroupMeta(clip);
    if (!m || m.splitCount <= 1) return '';
    return ' · ' + (m.splitIndex + 1) + '/' + m.splitCount;
  }

  function clipsShareSplitGroup(clips) {
    if (!Array.isArray(clips) || clips.length === 0) return null;
    var gid = null;
    for (var i = 0; i < clips.length; i++) {
      var m = getClipSplitGroupMeta(clips[i]);
      if (!m) return null;
      if (!gid) gid = m.splitGroupId;
      else if (gid !== m.splitGroupId) return null;
    }
    return gid;
  }

  function findClipsBySplitGroupId(clips, groupId) {
    if (!groupId) return [];
    return (clips || []).filter(function (c) {
      var m = getClipSplitGroupMeta(c);
      return m && m.splitGroupId === String(groupId);
    });
  }

  var API = {
    SPLIT_CLIP_META_KEYS: SPLIT_CLIP_META_KEYS,
    generateSplitGroupId: generateSplitGroupId,
    copySplitClipMeta: copySplitClipMeta,
    applySplitGroupMeta: applySplitGroupMeta,
    getClipSplitGroupMeta: getClipSplitGroupMeta,
    getClipPlacementSpanSec: getClipPlacementSpanSec,
    compareClipsForSequence: compareClipsForSequence,
    sortClipsForSequence: sortClipsForSequence,
    formatSplitGroupBadge: formatSplitGroupBadge,
    clipsShareSplitGroup: clipsShareSplitGroup,
    findClipsBySplitGroupId: findClipsBySplitGroupId,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2SClipSplitGroup = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
