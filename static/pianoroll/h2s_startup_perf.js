/**
 * Studio startup performance marks (opt-in, no sensitive data).
 * Enable: ?perf=1 or localStorage.h2s_perf = "1"
 */
(function () {
  'use strict';

  var G = typeof window !== 'undefined' ? window : {};
  var marks = {};
  var _firstInteractiveDone = false;
  var _firstInteractiveCbs = [];
  var _summaryLogged = false;

  function isEnabled() {
    try {
      if (typeof location !== 'undefined') {
        var params = new URLSearchParams(location.search || '');
        if (params.get('perf') === '1') return true;
      }
      if (typeof localStorage !== 'undefined' && String(localStorage.getItem('h2s_perf') || '') === '1') {
        return true;
      }
    } catch (_e) {}
    return false;
  }

  var enabled = isEnabled();

  function nowMs() {
    try {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
      }
    } catch (_e2) {}
    return Date.now();
  }

  function mark(name) {
    if (!enabled || !name) return;
    try {
      marks[name] = nowMs();
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark('h2s:' + name);
      }
    } catch (_e3) {}
  }

  function measure(name, startMark, endMark) {
    if (!enabled || !name) return;
    try {
      if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
        performance.measure('h2s:' + name, 'h2s:' + startMark, 'h2s:' + endMark);
      }
    } catch (_e4) {}
  }

  function delta(fromName, toName) {
    if (marks[fromName] == null || marks[toName] == null) return null;
    return marks[toName] - marks[fromName];
  }

  function logSummary(extra) {
    if (!enabled || _summaryLogged) return;
    _summaryLogged = true;
    try {
      var out = { phase: 'studio_startup' };
      var keys = Object.keys(marks).sort();
      for (var i = 0; i < keys.length; i++) {
        out[keys[i] + 'Ms'] = +marks[keys[i]].toFixed(2);
      }
      var d0 = marks.studio_html_loaded;
      if (d0 != null) {
        if (marks.studio_scripts_loaded != null) {
          out.scriptsAfterHtmlMs = +(marks.studio_scripts_loaded - d0).toFixed(2);
        }
        if (marks.studio_runtime_ready != null) {
          out.runtimeReadyAfterHtmlMs = +(marks.studio_runtime_ready - d0).toFixed(2);
        }
        if (marks.studio_first_interactive != null) {
          out.firstInteractiveAfterHtmlMs = +(marks.studio_first_interactive - d0).toFixed(2);
        }
      }
      if (marks.studio_runtime_init_start != null && marks.studio_runtime_ready != null) {
        out.runtimeInitMs = +(marks.studio_runtime_ready - marks.studio_runtime_init_start).toFixed(2);
      }
      if (marks.studio_project_load_start != null && marks.studio_project_load_done != null) {
        out.projectLoadMs = +(marks.studio_project_load_done - marks.studio_project_load_start).toFixed(2);
      }
      if (extra && typeof extra === 'object') {
        for (var k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
        }
      }
      console.log('[H2S perf]', out);
    } catch (_e5) {}
  }

  function onFirstInteractive(cb) {
    if (typeof cb !== 'function') return;
    if (_firstInteractiveDone) {
      try {
        cb();
      } catch (_e6) {}
      return;
    }
    _firstInteractiveCbs.push(cb);
  }

  function runFirstInteractive() {
    if (_firstInteractiveDone) return;
    _firstInteractiveDone = true;
    mark('studio_first_interactive');
    var cbs = _firstInteractiveCbs.slice();
    _firstInteractiveCbs.length = 0;
    for (var i = 0; i < cbs.length; i++) {
      try {
        cbs[i]();
      } catch (_e7) {}
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        logSummary();
      });
    } else {
      setTimeout(logSummary, 0);
    }
  }

  function scheduleFirstInteractive() {
    if (_firstInteractiveDone) return;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        requestAnimationFrame(runFirstInteractive);
      });
    } else {
      setTimeout(runFirstInteractive, 32);
    }
  }

  G.H2SStartupPerf = {
    enabled: function () {
      return enabled;
    },
    mark: mark,
    measure: measure,
    delta: delta,
    logSummary: logSummary,
    onFirstInteractive: onFirstInteractive,
    scheduleFirstInteractive: scheduleFirstInteractive,
  };

  mark('studio_html_loaded');
})();
