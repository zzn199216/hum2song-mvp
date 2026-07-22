/* Hum2Song Studio - core/clip_thumbnail_math.js
   Pure clip thumbnail derivation for timeline instance blocks.
   Node-safe UMD; no DOM.
*/
(function(root, factory){
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
  if (root){
    root.H2SClipThumbnailMath = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  const DEFAULT_MAX_NOTES = 144;
  const DEFAULT_MAX_SCAN = 3000;

  function isFiniteNumber(x){
    return typeof x === 'number' && isFinite(x);
  }

  function isPlainObject(v){
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function clipKind(clip){
    if (!isPlainObject(clip)) return 'unsupported';
    return clip.kind === 'audio' ? 'audio' : 'note';
  }

  function padPitchRange(min, max){
    if (min === max) return { pitchMin: min - 1, pitchMax: max + 1 };
    return { pitchMin: min, pitchMax: max };
  }

  function sampleEvenly(items, max){
    if (!items || items.length <= max) return { sampled: items || [], truncated: false };
    const sampled = [];
    const step = items.length / max;
    for (let i = 0; i < max; i++){
      sampled.push(items[Math.floor(i * step)]);
    }
    return { sampled, truncated: true };
  }

  function readMetaNumber(meta, key){
    if (!meta) return null;
    const v = meta[key];
    return isFiniteNumber(v) ? v : null;
  }

  function detectTimeUnit(rawNotes){
    for (const raw of rawNotes){
      if (!isPlainObject(raw)) continue;
      if (raw.startBeat !== undefined || raw.durationBeat !== undefined) return 'beat';
      if (raw.start !== undefined || raw.duration !== undefined) return 'sec';
    }
    return 'beat';
  }

  function collectValidNotes(clip, maxScan){
    const score = clip.score;
    if (!isPlainObject(score)) return { notes: [], scanTruncated: false, hasScore: false, timeUnit: 'beat' };
    const tracks = score.tracks;
    if (!Array.isArray(tracks)) return { notes: [], scanTruncated: false, hasScore: true, timeUnit: 'beat' };

    const rawAll = [];
    for (const track of tracks){
      if (!isPlainObject(track) || !Array.isArray(track.notes)) continue;
      for (const raw of track.notes){
        if (isPlainObject(raw)) rawAll.push(raw);
      }
    }
    const timeUnit = detectTimeUnit(rawAll);

    const notes = [];
    let scanTruncated = false;

    outer: for (const track of tracks){
      if (!isPlainObject(track)) continue;
      const rawNotes = track.notes;
      if (!Array.isArray(rawNotes)) continue;
      for (const raw of rawNotes){
        if (!isPlainObject(raw)) continue;
        const pitch = Number(raw.pitch);
        let startTime;
        let durationTime;
        if (timeUnit === 'beat'){
          startTime = raw.startBeat !== undefined ? Number(raw.startBeat) : Number(raw.start);
          durationTime = raw.durationBeat !== undefined ? Number(raw.durationBeat) : Number(raw.duration);
        } else {
          startTime = raw.start !== undefined ? Number(raw.start) : Number(raw.startBeat);
          durationTime = raw.duration !== undefined ? Number(raw.duration) : Number(raw.durationBeat);
        }
        if (!isFiniteNumber(startTime) || !isFiniteNumber(pitch) || !isFiniteNumber(durationTime) || durationTime <= 0){
          continue;
        }
        const note = { startTime, durationTime, pitch };
        if (isFiniteNumber(raw.velocity)) note.velocity = raw.velocity;
        notes.push(note);
        if (notes.length >= maxScan){
          scanTruncated = true;
          break outer;
        }
      }
    }

    return { notes, scanTruncated, hasScore: true, timeUnit };
  }

  function deriveClipThumbnailPreview(clip, options){
    options = options || {};
    const maxNotes = options.maxNotesPerClip != null ? options.maxNotesPerClip : DEFAULT_MAX_NOTES;
    const maxScan = options.maxScanNotesPerClip != null ? options.maxScanNotesPerClip : DEFAULT_MAX_SCAN;

    if (!isPlainObject(clip)){
      return {
        kind: 'unsupported', notes: [], waveformPeaks: [], spanTime: 1, timeUnit: 'beat',
        pitchMin: null, pitchMax: null, noteCount: 0, truncated: false,
      };
    }

    if (clipKind(clip) === 'audio'){
      const spanBeat = readMetaNumber(clip.meta, 'spanBeat');
      const spanSec = readMetaNumber(clip.meta, 'spanSec')
        || ((clip.audio && isFiniteNumber(clip.audio.durationSec)) ? clip.audio.durationSec : null);
      const spanTime = (spanSec != null && spanSec > 0) ? spanSec : ((spanBeat != null && spanBeat > 0) ? spanBeat : 1);
      return {
        kind: 'audio',
        notes: [],
        // Real PCM peaks are loaded asynchronously from the audio asset store by
        // clip_thumbnail_view. Never fabricate audio content in this pure preview.
        waveformPeaks: [],
        spanTime,
        timeUnit: (spanSec != null && spanSec > 0) ? 'sec' : 'beat',
        pitchMin: null,
        pitchMax: null,
        noteCount: 0,
        truncated: false,
      };
    }

    const meta = isPlainObject(clip.meta) ? clip.meta : null;
    const { notes: scannedNotes, scanTruncated, hasScore, timeUnit } = collectValidNotes(clip, maxScan);

    if (!hasScore){
      return {
        kind: 'unsupported', notes: [], waveformPeaks: [], spanTime: 1, timeUnit: 'beat',
        pitchMin: null, pitchMax: null, noteCount: 0, truncated: false,
      };
    }

    if (scannedNotes.length === 0){
      return {
        kind: 'empty', notes: [], waveformPeaks: [], spanTime: 1, timeUnit,
        pitchMin: null, pitchMax: null, noteCount: 0, truncated: false,
      };
    }

    const metaNoteCount = readMetaNumber(meta, 'notes');
    const noteCount =
      metaNoteCount !== null && metaNoteCount >= scannedNotes.length && !scanTruncated
        ? Math.floor(metaNoteCount)
        : scannedNotes.length;

    let pitchMin = readMetaNumber(meta, 'pitchMin');
    let pitchMax = readMetaNumber(meta, 'pitchMax');
    if (pitchMin === null || pitchMax === null){
      let min = scannedNotes[0].pitch;
      let max = scannedNotes[0].pitch;
      for (const n of scannedNotes){
        if (n.pitch < min) min = n.pitch;
        if (n.pitch > max) max = n.pitch;
      }
      pitchMin = min;
      pitchMax = max;
    }
    const padded = padPitchRange(pitchMin, pitchMax);

    let spanTime = null;
    if (timeUnit === 'sec'){
      spanTime = readMetaNumber(meta, 'spanSec');
      if (options.spanSec != null && isFiniteNumber(options.spanSec) && options.spanSec > 0){
        spanTime = options.spanSec;
      }
    } else {
      spanTime = readMetaNumber(meta, 'spanBeat');
    }
    if (spanTime === null || spanTime <= 0){
      let end = 0;
      for (const n of scannedNotes){
        const noteEnd = n.startTime + n.durationTime;
        if (noteEnd > end) end = noteEnd;
      }
      spanTime = end > 0 ? end : 1;
    }

    const { sampled, truncated: sampleTruncated } = sampleEvenly(scannedNotes, maxNotes);
    const truncated = scanTruncated || sampleTruncated || noteCount > sampled.length;

    return {
      kind: 'notes',
      notes: sampled,
      waveformPeaks: [],
      spanTime,
      timeUnit,
      pitchMin: padded.pitchMin,
      pitchMax: padded.pitchMax,
      noteCount,
      truncated,
    };
  }

  return {
    VERSION: 'clip_thumbnail_math_v3_real_audio',
    clipKind,
    deriveClipThumbnailPreview,
  };
});
