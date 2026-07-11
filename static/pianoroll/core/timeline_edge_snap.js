/**
 * Snap dragged instance start to adjacent instance edges (seconds, v1 view).
 */
(function (root) {
  'use strict';

  function _Seq() {
    return (
      (typeof globalThis !== 'undefined' && globalThis.H2STimelineSequencePlace) ||
      (typeof root !== 'undefined' && root.H2STimelineSequencePlace) ||
      null
    );
  }

  function snapStartSecToInstanceEdges(startSec, dragInstId, project, opts) {
    opts = opts || {};
    startSec = typeof startSec === 'number' && isFinite(startSec) ? startSec : 0;
    var pxPerSec = typeof opts.pxPerSec === 'number' && opts.pxPerSec > 0 ? opts.pxPerSec : 160;
    var thresholdSec = (typeof opts.thresholdPx === 'number' ? opts.thresholdPx : 8) / pxPerSec;
    var trackIndex = typeof opts.trackIndex === 'number' ? Math.floor(opts.trackIndex) : null;
    var Seq = _Seq();
    var instances = (project && Array.isArray(project.instances)) ? project.instances : [];
    var best = startSec;
    var bestDist = thresholdSec;
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (!inst || String(inst.id) === String(dragInstId)) continue;
      if (trackIndex != null && Math.floor(Number(inst.trackIndex || 0)) !== trackIndex) continue;
      var start = typeof inst.startSec === 'number' ? inst.startSec : 0;
      var end = Seq && typeof Seq.getInstanceEndSec === 'function'
        ? Seq.getInstanceEndSec(inst, project, opts.H2SProject)
        : start;
      var edges = [start, end];
      for (var e = 0; e < edges.length; e++) {
        var d = Math.abs(startSec - edges[e]);
        if (d <= bestDist) {
          bestDist = d;
          best = edges[e];
        }
      }
    }
    return best;
  }

  var API = { snapStartSecToInstanceEdges: snapStartSecToInstanceEdges };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2STimelineEdgeSnap = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
