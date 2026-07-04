/**
 * Single-slot undo — frontend only, session memory (cleared on refresh).
 * Scopes: `timeline` (project v2) and `editor` (clip draft score in modal).
 */
(function (root) {
  'use strict';

  var _slots = Object.create(null);

  function deepClone(obj) {
    var P = root && root.H2SProject;
    if (P && typeof P.deepClone === 'function') return P.deepClone(obj);
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeScope(scope) {
    var s = String(scope || 'timeline');
    return s === 'editor' ? 'editor' : 'timeline';
  }

  function capture(scope, snapshot, meta) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    var key = normalizeScope(scope);
    _slots[key] = {
      snapshot: deepClone(snapshot),
      label: (meta && meta.label) ? String(meta.label) : (key === 'editor' ? 'editor_edit' : 'timeline_edit'),
      ui: (meta && meta.ui && typeof meta.ui === 'object') ? deepClone(meta.ui) : null,
      capturedAt: Date.now(),
    };
    return true;
  }

  function canUndo(scope) {
    var key = normalizeScope(scope);
    return !!(_slots[key] && _slots[key].snapshot);
  }

  function peek(scope) {
    var key = normalizeScope(scope);
    var slot = _slots[key];
    if (!slot) return null;
    return {
      label: slot.label,
      ui: slot.ui ? deepClone(slot.ui) : null,
      capturedAt: slot.capturedAt,
    };
  }

  function consume(scope) {
    var key = normalizeScope(scope);
    var slot = _slots[key];
    if (!slot) return null;
    var out = {
      snapshot: slot.snapshot,
      label: slot.label,
      ui: slot.ui,
      capturedAt: slot.capturedAt,
    };
    _slots[key] = null;
    return out;
  }

  function clear(scope) {
    if (scope == null) {
      _slots = Object.create(null);
      return;
    }
    _slots[normalizeScope(scope)] = null;
  }

  var API = {
    capture: capture,
    canUndo: canUndo,
    peek: peek,
    consume: consume,
    clear: clear,
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
