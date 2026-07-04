/**
 * Clip editor note selection — stable note id + track id refs (never array index).
 */
(function (root) {
  'use strict';

  function emptySelection() {
    return { noteRefs: [], tool: 'pointer' };
  }

  function noteRefKey(ref) {
    if (ref && ref.trackId != null && ref.noteIndex != null && ref.noteIndex !== '') {
      return String(ref.trackId) + '\0i:' + String(ref.noteIndex);
    }
    return String(ref.trackId) + '\0n:' + String(ref.noteId);
  }

  function findNoteInScore(score, trackId, noteId, noteIndex) {
    if (!score || !Array.isArray(score.tracks)) return null;
    for (var ti = 0; ti < score.tracks.length; ti++) {
      var tr = score.tracks[ti];
      if (!tr || String(tr.id) !== String(trackId)) continue;
      var notes = Array.isArray(tr.notes) ? tr.notes : [];
      if (noteIndex != null && noteIndex !== '') {
        var ni = Number(noteIndex);
        if (ni >= 0 && ni < notes.length) {
          var at = notes[ni];
          if (at && String(at.id) === String(noteId)) {
            return { track: tr, trackIndex: ti, note: at, noteIndex: ni };
          }
        }
      }
      for (var nj = 0; nj < notes.length; nj++) {
        var n = notes[nj];
        if (n && String(n.id) === String(noteId)) {
          return { track: tr, trackIndex: ti, note: n, noteIndex: nj };
        }
      }
    }
    return null;
  }

  function noteRefMatchesTrackNote(ref, tr, n, ni) {
    if (!ref || !tr || !n) return false;
    if (String(tr.id) !== String(ref.trackId)) return false;
    if (ref.noteIndex != null && ref.noteIndex !== '') {
      return Number(ref.noteIndex) === Number(ni);
    }
    return String(n.id) === String(ref.noteId);
  }

  function collectAllNoteRefs(score) {
    var out = [];
    if (!score || !Array.isArray(score.tracks)) return out;
    for (var ti = 0; ti < score.tracks.length; ti++) {
      var tr = score.tracks[ti];
      if (!tr || !tr.id) continue;
      var notes = Array.isArray(tr.notes) ? tr.notes : [];
      for (var ni = 0; ni < notes.length; ni++) {
        var n = notes[ni];
        if (n && n.id) out.push({ trackId: String(tr.id), noteId: String(n.id), noteIndex: ni });
      }
    }
    return out;
  }

  /** Axis-aligned rect in canvas pixel space (content coords). */
  function noteIntersectsRect(note, rect, coords, modal, pitchWin) {
    if (!note || !coords || !pitchWin) return false;
    var x = coords.timeToX(note.start, modal);
    var w = Math.max(6, Number(note.duration) * coords.effectivePxPerSec(modal));
    var y = coords.pitchToY(note.pitch, modal, pitchWin.pitchMin, pitchWin.pitchMax);
    var h = coords.rowH(modal) - 2;
    var nx2 = x + w;
    var ny2 = y + h;
    return !(nx2 < rect.x0 || x > rect.x1 || ny2 < rect.y0 || y > rect.y1);
  }

  function notesInRect(score, rect, coords, modal, pitchWin) {
    var hits = [];
    if (!score || !Array.isArray(score.tracks)) return hits;
    for (var ti = 0; ti < score.tracks.length; ti++) {
      var tr = score.tracks[ti];
      if (!tr || !tr.id) continue;
      var notes = Array.isArray(tr.notes) ? tr.notes : [];
      for (var ni = 0; ni < notes.length; ni++) {
        var n = notes[ni];
        if (!n || !n.id) continue;
        if (noteIntersectsRect(n, rect, coords, modal, pitchWin)) {
          hits.push({ trackId: String(tr.id), noteId: String(n.id), noteIndex: ni });
        }
      }
    }
    return hits;
  }

  function mergeNoteRefs(base, add, replace) {
    if (replace) return add.slice();
    var map = {};
    base.forEach(function (r) {
      map[noteRefKey(r)] = r;
    });
    add.forEach(function (r) {
      map[noteRefKey(r)] = r;
    });
    return Object.keys(map).map(function (k) {
      return map[k];
    });
  }

  function toggleNoteRef(list, ref) {
    var key = noteRefKey(ref);
    var out = [];
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (noteRefKey(list[i]) === key) found = true;
      else out.push(list[i]);
    }
    if (!found) out.push(ref);
    return out;
  }

  function selectionNoteIds(selection) {
    if (!selection || !Array.isArray(selection.noteRefs)) return [];
    return selection.noteRefs.map(function (r) {
      return String(r.noteId);
    });
  }

  function deleteSelectedNotes(score, selection) {
    if (!score || !selection || !selection.noteRefs.length) return { score: score, deleted: 0 };
    var refs = selection.noteRefs;
    var deleted = 0;
    for (var ti = 0; ti < (score.tracks || []).length; ti++) {
      var tr = score.tracks[ti];
      if (!tr || !tr.id || !Array.isArray(tr.notes)) continue;
      tr.notes = tr.notes.filter(function (n, ni) {
        if (!n || !n.id) return true;
        for (var ri = 0; ri < refs.length; ri++) {
          if (noteRefMatchesTrackNote(refs[ri], tr, n, ni)) {
            deleted += 1;
            return false;
          }
        }
        return true;
      });
    }
    return { score: score, deleted: deleted };
  }

  function extractNotesToScore(score, selection, opts) {
    opts = opts || {};
    var refs = selection && selection.noteRefs ? selection.noteRefs : [];
    if (!refs.length) return null;
    var preserveStart = !!opts.preserveStart;
    var singleTrack = !!opts.singleTrack;
    var tMin = Infinity;
    var extractedTracks = {};
    refs.forEach(function (ref) {
      var found = findNoteInScore(score, ref.trackId, ref.noteId, ref.noteIndex);
      if (!found) return;
      var n = found.note;
      tMin = Math.min(tMin, Number(n.start));
      if (!extractedTracks[ref.trackId]) {
        extractedTracks[ref.trackId] = {
          id: ref.trackId,
          name: found.track.name,
          notes: [],
        };
      }
      extractedTracks[ref.trackId].notes.push({
        id: n.id,
        pitch: n.pitch,
        start: n.start,
        duration: n.duration,
        velocity: n.velocity,
      });
    });
    if (!isFinite(tMin)) return null;
    var outTracks = Object.keys(extractedTracks).map(function (k) {
      var tr = extractedTracks[k];
      tr.notes = tr.notes
        .map(function (n) {
          var st = Number(n.start);
          return Object.assign({}, n, { start: preserveStart ? st : st - tMin });
        })
        .sort(function (a, b) {
          return a.start - b.start || a.pitch - b.pitch;
        });
      return tr;
    });
    if (singleTrack) {
      var merged = [];
      for (var ti = 0; ti < outTracks.length; ti++) {
        var notes = outTracks[ti].notes || [];
        for (var nj = 0; nj < notes.length; nj++) merged.push(Object.assign({}, notes[nj]));
      }
      merged.sort(function (a, b) {
        return a.start - b.start || a.pitch - b.pitch;
      });
      outTracks = [{ id: 'trk_extract', name: 'Extract', notes: merged }];
    }
    return {
      score: {
        version: score.version || 1,
        tempo_bpm: score.tempo_bpm || score.bpm || 120,
        time_signature: score.time_signature || '4/4',
        tracks: outTracks,
      },
      tMinAbs: tMin,
    };
  }

  function selectionHighlightKey(trackId, noteIndex) {
    return String(trackId != null ? trackId : '') + '\0i:' + String(noteIndex);
  }

  function normalizeNoteRefs(score, refs) {
    if (!refs || !refs.length) return [];
    var out = [];
    for (var i = 0; i < refs.length; i++) {
      var r = refs[i];
      if (!r) continue;
      var tid = String(r.trackId != null ? r.trackId : '');
      if (r.noteIndex != null && r.noteIndex !== '') {
        var tr = null;
        for (var ti = 0; ti < (score && score.tracks ? score.tracks.length : 0); ti++) {
          var t0 = score.tracks[ti];
          if (t0 && String(t0.id) === tid) { tr = t0; break; }
        }
        if (tr && Array.isArray(tr.notes)) {
          var ni = Number(r.noteIndex);
          var at = tr.notes[ni];
          if (at && String(at.id) === String(r.noteId)) {
            out.push({ trackId: tid, noteId: String(at.id), noteIndex: ni });
            continue;
          }
        }
      }
      var found = findNoteInScore(score, tid, r.noteId, r.noteIndex);
      if (found) {
        out.push({
          trackId: tid,
          noteId: String(found.note.id),
          noteIndex: found.noteIndex,
        });
      }
    }
    return out;
  }

  function buildSelectionHighlightSet(refs) {
    var set = new Set();
    if (!refs || !refs.length) return set;
    for (var i = 0; i < refs.length; i++) {
      var r = refs[i];
      if (!r || r.noteIndex == null || r.noteIndex === '') continue;
      set.add(selectionHighlightKey(r.trackId, r.noteIndex));
    }
    return set;
  }

  function scoreHasDuplicateNoteIds(score) {
    if (!score || !Array.isArray(score.tracks)) return false;
    var seen = new Set();
    for (var ti = 0; ti < score.tracks.length; ti++) {
      var tr = score.tracks[ti];
      var notes = tr && Array.isArray(tr.notes) ? tr.notes : [];
      for (var ni = 0; ni < notes.length; ni++) {
        var n = notes[ni];
        if (!n || n.id == null || n.id === '') continue;
        var id = String(n.id);
        if (seen.has(id)) return true;
        seen.add(id);
      }
    }
    return false;
  }

  function removeSelectedNotesFromScore(score, selection) {
    return deleteSelectedNotes(score, selection).score;
  }

  var API = {
    emptySelection: emptySelection,
    noteRefKey: noteRefKey,
    findNoteInScore: findNoteInScore,
    collectAllNoteRefs: collectAllNoteRefs,
    notesInRect: notesInRect,
    mergeNoteRefs: mergeNoteRefs,
    toggleNoteRef: toggleNoteRef,
    selectionNoteIds: selectionNoteIds,
    deleteSelectedNotes: deleteSelectedNotes,
    extractNotesToScore: extractNotesToScore,
    removeSelectedNotesFromScore: removeSelectedNotesFromScore,
    selectionHighlightKey: selectionHighlightKey,
    normalizeNoteRefs: normalizeNoteRefs,
    buildSelectionHighlightSet: buildSelectionHighlightSet,
    scoreHasDuplicateNoteIds: scoreHasDuplicateNoteIds,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof root !== 'undefined') root.H2SEditorSelection = API;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : this,
);
