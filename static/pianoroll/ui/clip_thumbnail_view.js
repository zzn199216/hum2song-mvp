/* Hum2Song Studio - ui/clip_thumbnail_view.js
   Timeline clip block thumbnail SVG (notes + pseudo-waveform).
*/
(function(root, factory){
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
  if (root){
    root.H2SClipThumbnailView = api;
  }
})(typeof window !== 'undefined' ? window : null, function(){
  'use strict';

  let MathApi = null;
  try {
    MathApi = require('../core/clip_thumbnail_math.js');
  } catch (e) { /* browser bundle */ }
  if (!MathApi && typeof window !== 'undefined' && window.H2SClipThumbnailMath){
    MathApi = window.H2SClipThumbnailMath;
  }

  const NOTE_FILL = 'rgba(255,255,255,0.92)';
  const AUDIO_FILL = 'rgba(167,243,208,0.88)';
  const PLACEHOLDER_STROKE = 'rgba(255,255,255,0.35)';

  function clamp(n, min, max){
    return Math.min(max, Math.max(min, n));
  }

  function thumbnailSvgHTML(preview, width, height){
    const w = Math.max(1, Math.round(Number(width) || 80));
    const h = Math.max(1, Math.round(Number(height) || 60));
    const kind = preview && preview.kind ? preview.kind : 'unsupported';

    if (kind === 'audio'){
      const peaks = Array.isArray(preview.waveformPeaks) ? preview.waveformPeaks : [];
      const mid = h / 2;
      const barW = Math.max(1, w / Math.max(1, peaks.length));
      let bars = '';
      for (let i = 0; i < peaks.length; i++){
        const peak = clamp(Number(peaks[i]) || 0.1, 0.05, 1);
        const bh = Math.max(2, peak * (h * 0.78));
        const x = i * barW;
        const y = mid - bh / 2;
        bars += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(1, barW - 0.5).toFixed(2)}" height="${bh.toFixed(2)}" rx="0.5" fill="${AUDIO_FILL}"/>`;
      }
      return `<svg class="instThumbSvg" width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
    }

    if (kind === 'empty' || kind === 'unsupported'){
      const y = h / 2;
      return `<svg class="instThumbSvg" width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="${y}" x2="${w - 4}" y2="${y}" stroke="${PLACEHOLDER_STROKE}" stroke-width="1" stroke-dasharray="3 3"/></svg>`;
    }

    const notes = Array.isArray(preview.notes) ? preview.notes : [];
    const spanTime = preview.spanTime > 0 ? preview.spanTime : 1;
    const pMin = preview.pitchMin != null ? preview.pitchMin : 0;
    const pMax = preview.pitchMax != null ? preview.pitchMax : 1;
    const pitchSpan = Math.max(1, pMax - pMin);
    const noteH = Math.max(3, Math.min(5, h * 0.12));
    const padY = 4;

    let rects = '';
    for (let i = 0; i < notes.length; i++){
      const note = notes[i];
      const x = clamp((note.startTime / spanTime) * w, 0, w - 1);
      const rw = Math.max(2, clamp((note.durationTime / spanTime) * w, 2, w - x));
      const y = clamp(padY + ((pMax - note.pitch) / pitchSpan) * (h - padY * 2 - noteH), padY, h - padY - noteH);
      rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rw.toFixed(2)}" height="${noteH.toFixed(2)}" rx="0.5" fill="${NOTE_FILL}"/>`;
    }
    return `<svg class="instThumbSvg" width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  }

  function instThumbHTML(clip, width, height, options){
    if (!MathApi || typeof MathApi.deriveClipThumbnailPreview !== 'function'){
      return '';
    }
    let preview;
    try {
      preview = MathApi.deriveClipThumbnailPreview(clip, options);
    } catch (e) {
      preview = { kind: 'unsupported', notes: [], waveformPeaks: [] };
    }
    const svg = thumbnailSvgHTML(preview, width, height);
    if (!svg) return '';
    return `<div class="instThumb" data-role="inst-thumb" aria-hidden="true">${svg}</div>`;
  }

  return {
    VERSION: 'clip_thumbnail_view_v2',
    thumbnailSvgHTML,
    instThumbHTML,
  };
});
