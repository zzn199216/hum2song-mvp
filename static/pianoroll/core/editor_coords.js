/**
 * Clip editor coordinate mapping — single source for time/pitch ↔ canvas pixels.
 * Used by draw, hit-test, velocity lane, playhead, marquee selection, and time zoom.
 */
(function (root) {
  'use strict';

  var BASE_PX_PER_SEC = 180;
  var TIME_ZOOM_MIN = 0.25;
  var TIME_ZOOM_MAX = 4;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function clampTimeZoom(z) {
    var n = Number(z);
    if (!isFinite(n) || n <= 0) return 1;
    return clamp(n, TIME_ZOOM_MIN, TIME_ZOOM_MAX);
  }

  function effectivePxPerSec(modal) {
    var m = modal || {};
    var base = m.pxPerSec != null && isFinite(Number(m.pxPerSec)) ? Number(m.pxPerSec) : BASE_PX_PER_SEC;
    var tz = clampTimeZoom(m.timeZoom != null ? m.timeZoom : 1);
    return base * tz;
  }

  function padL(modal) {
    return modal && modal.padL != null ? Number(modal.padL) : 60;
  }

  function padT(modal) {
    return modal && modal.padT != null ? Number(modal.padT) : 20;
  }

  function rowH(modal) {
    var pz = modal && modal.pitchZoom != null ? Number(modal.pitchZoom) : 1.25;
    if (!isFinite(pz) || pz <= 0) pz = 1.25;
    return Math.max(12, Math.round(16 * pz));
  }

  function timeToX(sec, modal) {
    return padL(modal) + Number(sec) * effectivePxPerSec(modal);
  }

  function xToTime(px, modal) {
    var pps = effectivePxPerSec(modal);
    if (!pps) return 0;
    return Math.max(0, (Number(px) - padL(modal)) / pps);
  }

  /**
   * Resolve visible pitch range for the piano roll (matches editor_runtime policy).
   * @param {object} modal
   * @param {{ minPitch: number, maxPitch: number }} scoreStats from H2SProject.scoreStats
   * @returns {{ pitchMin: number, pitchMax: number, useVScroll: boolean }}
   */
  function resolvePitchWindow(modal, scoreStats) {
    var st = scoreStats || { minPitch: 60, maxPitch: 60 };
    var useVScroll = !!(modal && modal.usePitchVScroll);
    if (useVScroll) return { pitchMin: 0, pitchMax: 127, useVScroll: true };
    var rows = modal && modal.pitchViewRows != null ? Number(modal.pitchViewRows) : 36;
    var range = st.maxPitch - st.minPitch + 1;
    var pitchMin;
    var pitchMax;
    if (range <= rows) {
      var pad = 2;
      pitchMin = Math.max(0, st.minPitch - pad);
      pitchMax = Math.min(127, st.maxPitch + pad);
    } else {
      var half = Math.floor(rows / 2);
      var c = modal && modal.pitchCenter != null ? Number(modal.pitchCenter) : 60;
      pitchMin = clamp(c - half, 0, 127 - rows);
      pitchMax = pitchMin + rows;
    }
    return { pitchMin: pitchMin, pitchMax: pitchMax, useVScroll: false };
  }

  function pitchToY(pitch, modal, pitchMin, pitchMax) {
    return padT(modal) + (pitchMax - Number(pitch)) * rowH(modal) + 1;
  }

  function yToPitch(py, modal, pitchMin, pitchMax) {
    var rh = rowH(modal);
    if (!rh) return pitchMin;
    var row = Math.floor((Number(py) - padT(modal)) / rh);
    return clamp(pitchMax - row, 0, 127);
  }

  /** Map pointer event to canvas bitmap coordinates. Uses canvas getBoundingClientRect (scroll-safe). */
  function eventToCanvasPx(ev, canvasEl, gridWrapEl) {
    if (!canvasEl || !ev) return { px: 0, py: 0 };
    var rect = canvasEl.getBoundingClientRect();
    var cssW = canvasEl.clientWidth || rect.width || 1;
    var cssH = canvasEl.clientHeight || rect.height || 1;
    var scaleX = cssW ? canvasEl.width / cssW : 1;
    var scaleY = cssH ? canvasEl.height / cssH : 1;
    return {
      px: (Number(ev.clientX) - rect.left) * scaleX,
      py: (Number(ev.clientY) - rect.top) * scaleY,
    };
  }

  /** Scroll anchor: keep time at anchorX stable when timeZoom changes. */
  function scrollLeftForZoomAnchor(gridWrap, modal, anchorClientX, canvasEl, nextTimeZoom) {
    if (!gridWrap || !canvasEl) return gridWrap ? gridWrap.scrollLeft : 0;
    var rect = canvasEl.getBoundingClientRect();
    var scaleX = rect.width ? canvasEl.width / rect.width : 1;
    var px = (anchorClientX - rect.left) * scaleX;
    var timeAtAnchor = xToTime(px, modal);
    var nextModal = Object.assign({}, modal, { timeZoom: clampTimeZoom(nextTimeZoom) });
    var newPx = timeToX(timeAtAnchor, nextModal);
    return Math.max(0, newPx - (px - padL(nextModal)));
  }

  function contentWidthForSpan(spanSec, modal) {
    var span = Math.max(4, Number(spanSec) || 4);
    return Math.max(1200, Math.ceil(span * effectivePxPerSec(modal)) + 140);
  }

  function timeZoomForFitSpan(spanSec, visibleWidthPx, modal) {
    var m = modal || {};
    var base = m.pxPerSec != null ? Number(m.pxPerSec) : BASE_PX_PER_SEC;
    var inner = Math.max(200, Number(visibleWidthPx) - padL(m) - 80);
    var span = Math.max(0.25, Number(spanSec) || 4);
    var needed = inner / (base * span);
    return clampTimeZoom(needed);
  }

  var API = {
    BASE_PX_PER_SEC: BASE_PX_PER_SEC,
    TIME_ZOOM_MIN: TIME_ZOOM_MIN,
    TIME_ZOOM_MAX: TIME_ZOOM_MAX,
    clampTimeZoom: clampTimeZoom,
    effectivePxPerSec: effectivePxPerSec,
    timeToX: timeToX,
    xToTime: xToTime,
    pitchToY: pitchToY,
    yToPitch: yToPitch,
    resolvePitchWindow: resolvePitchWindow,
    rowH: rowH,
    padL: padL,
    padT: padT,
    eventToCanvasPx: eventToCanvasPx,
    scrollLeftForZoomAnchor: scrollLeftForZoomAnchor,
    contentWidthForSpan: contentWidthForSpan,
    timeZoomForFitSpan: timeZoomForFitSpan,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2SEditorCoords = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
