/**
 * Frontend undo — session memory only (cleared on refresh).
 * - timeline: single-step (one snapshot)
 * - editor: multi-step stack (clip draft score in modal)
 */
(function (root) {
  'use strict';

  var EDITOR_STACK_MAX = 50;
  var _timelineSlot = null;
  var _editorStack = [];

  function deepClone(obj) {
    var P = root && root.H2SProject;
    if (P && typeof P.deepClone === 'function') return P.deepClone(obj);
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeScope(scope) {
    var s = String(scope || 'timeline');
    return s === 'editor' ? 'editor' : 'timeline';
  }

  function makeEntry(snapshot, meta, defaultLabel) {
    return {
      snapshot: deepClone(snapshot),
      label: (meta && meta.label) ? String(meta.label) : defaultLabel,
      ui: (meta && meta.ui && typeof meta.ui === 'object') ? deepClone(meta.ui) : null,
      mergeKey: (meta && meta.mergeKey != null) ? String(meta.mergeKey) : null,
      capturedAt: Date.now(),
    };
  }

  function snapshotsEqual(a, b) {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (_e) {
      return false;
    }
  }

  function capture(scope, snapshot, meta) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    var key = normalizeScope(scope);
    var entry = makeEntry(snapshot, meta, key === 'editor' ? 'editor_edit' : 'timeline_edit');

    if (key === 'editor') {
      if (_editorStack.length > 0) {
        var top = _editorStack[_editorStack.length - 1];
        if (meta && meta.mergeKey != null && top.mergeKey === String(meta.mergeKey)) {
          return false;
        }
        if (snapshotsEqual(top.snapshot, entry.snapshot)) {
          return false;
        }
      }
      _editorStack.push(entry);
      while (_editorStack.length > EDITOR_STACK_MAX) _editorStack.shift();
      return true;
    }

    _timelineSlot = entry;
    return true;
  }

  function canUndo(scope) {
    return depth(scope) > 0;
  }

  function depth(scope) {
    var key = normalizeScope(scope);
    if (key === 'editor') return _editorStack.length;
    return _timelineSlot && _timelineSlot.snapshot ? 1 : 0;
  }

  function peek(scope) {
    var key = normalizeScope(scope);
    if (key === 'editor') {
      if (!_editorStack.length) return null;
      var eTop = _editorStack[_editorStack.length - 1];
      return {
        label: eTop.label,
        ui: eTop.ui ? deepClone(eTop.ui) : null,
        capturedAt: eTop.capturedAt,
      };
    }
    if (!_timelineSlot) return null;
    return {
      label: _timelineSlot.label,
      ui: _timelineSlot.ui ? deepClone(_timelineSlot.ui) : null,
      capturedAt: _timelineSlot.capturedAt,
    };
  }

  function consume(scope) {
    var key = normalizeScope(scope);
    if (key === 'editor') {
      if (!_editorStack.length) return null;
      return _editorStack.pop();
    }
    if (!_timelineSlot) return null;
    var out = _timelineSlot;
    _timelineSlot = null;
    return out;
  }

  function clear(scope) {
    if (scope == null) {
      _timelineSlot = null;
      _editorStack = [];
      return;
    }
    if (normalizeScope(scope) === 'editor') {
      _editorStack = [];
      return;
    }
    _timelineSlot = null;
  }

  var API = {
    capture: capture,
    canUndo: canUndo,
    depth: depth,
    peek: peek,
    consume: consume,
    clear: clear,
    EDITOR_STACK_MAX: EDITOR_STACK_MAX,
    SCOPES: { timeline: 'timeline', editor: 'editor' },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2SProjectLastUndo = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
