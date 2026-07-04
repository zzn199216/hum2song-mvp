/**
 * Resizable clip editor modal (.modalCard): drag edges/corners, maximize, persist geometry.
 */
(function (root) {
  'use strict';

  var LS_KEY = 'h2s_editor_modal_geom';
  var MIN_W = 720;
  var MIN_H = 480;
  var MARGIN = 12;
  var DEFAULT_W = 1200;
  var DEFAULT_H = 760;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function viewportMaxSize() {
    var vw = typeof window !== 'undefined' ? window.innerWidth : DEFAULT_W;
    var vh = typeof window !== 'undefined' ? window.innerHeight : DEFAULT_H;
    return { w: Math.max(MIN_W, vw - MARGIN * 2), h: Math.max(MIN_H, vh - MARGIN * 2) };
  }

  function loadGeom() {
    try {
      if (typeof localStorage === 'undefined') return null;
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return null;
      var max = viewportMaxSize();
      return {
        width: clamp(Number(o.width) || DEFAULT_W, MIN_W, max.w),
        height: clamp(Number(o.height) || DEFAULT_H, MIN_H, max.h),
        maximized: !!o.maximized,
      };
    } catch (_e) {
      return null;
    }
  }

  function saveGeom(geom) {
    try {
      if (typeof localStorage === 'undefined' || !geom) return;
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          width: geom.width,
          height: geom.height,
          maximized: !!geom.maximized,
        }),
      );
    } catch (_e) {}
  }

  function applyGeom(card, geom) {
    if (!card || !geom) return;
    card.classList.toggle('modalCard--maximized', !!geom.maximized);
    if (geom.maximized) {
      card.style.width = 'calc(100vw - ' + MARGIN * 2 + 'px)';
      card.style.height = 'calc(100vh - ' + MARGIN * 2 + 'px)';
      card.style.maxWidth = 'none';
      card.style.maxHeight = 'none';
    } else {
      card.style.width = geom.width + 'px';
      card.style.height = geom.height + 'px';
      card.style.maxWidth = 'calc(100vw - ' + MARGIN * 2 + 'px)';
      card.style.maxHeight = 'calc(100vh - ' + MARGIN * 2 + 'px)';
    }
  }

  function readCurrentGeom(card) {
    var maximized = card.classList.contains('modalCard--maximized');
    if (maximized) {
      var g = loadGeom() || { width: DEFAULT_W, height: DEFAULT_H, maximized: true };
      return { width: g.width, height: g.height, maximized: true };
    }
    var rect = card.getBoundingClientRect();
    var max = viewportMaxSize();
    return {
      width: clamp(Math.round(rect.width), MIN_W, max.w),
      height: clamp(Math.round(rect.height), MIN_H, max.h),
      maximized: false,
    };
  }

  function attach(modalEl, onLayoutChange) {
    if (!modalEl) return;
    var card = modalEl.querySelector('.modalCard');
    if (!card) return;

    if (card.__h2sModalResizeAttached) {
      var stored = loadGeom();
      applyGeom(card, stored || { width: DEFAULT_W, height: DEFAULT_H, maximized: false });
      if (typeof onLayoutChange === 'function') onLayoutChange();
      return;
    }
    card.__h2sModalResizeAttached = true;

    var geom = loadGeom() || { width: DEFAULT_W, height: DEFAULT_H, maximized: false };
    applyGeom(card, geom);

    var handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    handles.forEach(function (edge) {
      var el = document.createElement('div');
      el.className = 'modalResizeHandle modalResizeHandle--' + edge;
      el.setAttribute('data-edge', edge);
      el.setAttribute('aria-hidden', 'true');
      card.appendChild(el);
    });

    var header = card.querySelector('.modalHeader');
    if (header && !header.querySelector('#btnModalMaximize')) {
      var maxBtn = document.createElement('button');
      maxBtn.type = 'button';
      maxBtn.id = 'btnModalMaximize';
      maxBtn.className = 'btn icon modalMaximizeBtn';
      maxBtn.title = 'Maximize editor';
      maxBtn.textContent = '⤢';
      var spacer = header.querySelector('.spacer');
      if (spacer && spacer.nextSibling) header.insertBefore(maxBtn, spacer.nextSibling);
      else header.appendChild(maxBtn);

      maxBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var cur = readCurrentGeom(card);
        if (cur.maximized) {
          var prev = loadGeom();
          applyGeom(card, prev && !prev.maximized ? prev : { width: DEFAULT_W, height: DEFAULT_H, maximized: false });
        } else {
          saveGeom(cur);
          applyGeom(card, { width: cur.width, height: cur.height, maximized: true });
        }
        saveGeom(readCurrentGeom(card));
        if (typeof onLayoutChange === 'function') onLayoutChange();
      });

      header.addEventListener('dblclick', function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest('button')) return;
        maxBtn.click();
      });
    }

    var drag = null;

    function onResizePointerDown(ev) {
      var handle = ev.target && ev.target.closest ? ev.target.closest('.modalResizeHandle') : null;
      if (!handle || !card.contains(handle)) return;
      if (card.classList.contains('modalCard--maximized')) return;
      ev.preventDefault();
      var edge = handle.getAttribute('data-edge') || 'se';
      var rect = card.getBoundingClientRect();
      drag = {
        edge: edge,
        startX: ev.clientX,
        startY: ev.clientY,
        origW: rect.width,
        origH: rect.height,
        origLeft: rect.left,
        origTop: rect.top,
      };
      document.addEventListener('pointermove', onResizePointerMove);
      document.addEventListener('pointerup', onResizePointerUp, { once: true });
    }

    function onResizePointerMove(ev) {
      if (!drag) return;
      var max = viewportMaxSize();
      var dx = ev.clientX - drag.startX;
      var dy = ev.clientY - drag.startY;
      var w = drag.origW;
      var h = drag.origH;
      if (drag.edge.indexOf('e') >= 0) w = drag.origW + dx;
      if (drag.edge.indexOf('w') >= 0) w = drag.origW - dx;
      if (drag.edge.indexOf('s') >= 0) h = drag.origH + dy;
      if (drag.edge.indexOf('n') >= 0) h = drag.origH - dy;
      w = clamp(Math.round(w), MIN_W, max.w);
      h = clamp(Math.round(h), MIN_H, max.h);
      card.style.width = w + 'px';
      card.style.height = h + 'px';
      if (typeof onLayoutChange === 'function') onLayoutChange();
    }

    function onResizePointerUp() {
      drag = null;
      document.removeEventListener('pointermove', onResizePointerMove);
      saveGeom(readCurrentGeom(card));
    }

    card.addEventListener('pointerdown', onResizePointerDown);

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', function () {
        if (!modalEl.classList.contains('show')) return;
        if (card.classList.contains('modalCard--maximized')) {
          applyGeom(card, { width: DEFAULT_W, height: DEFAULT_H, maximized: true });
          if (typeof onLayoutChange === 'function') onLayoutChange();
        }
      });
    }
  }

  var API = {
    attach: attach,
    loadGeom: loadGeom,
    saveGeom: saveGeom,
    applyGeom: applyGeom,
    MIN_W: MIN_W,
    MIN_H: MIN_H,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2SEditorModalResize = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
