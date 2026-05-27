(function(root, factory){
  if (typeof module === 'object' && module.exports){
    module.exports = factory();
  } else {
    root.H2SAccompanimentDraftV1 = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  var DRUM_PITCH = {
    kick: 36,
    bass_drum: 36,
    snare: 38,
    clap: 39,
    hat: 42,
    hihat: 42,
    closed_hat: 42,
    open_hat: 46,
    ride: 51,
    crash: 49,
    tom: 45,
    perc: 45,
    percussion: 45,
  };

  function isFiniteNumber(x){
    return typeof x === 'number' && isFinite(x);
  }

  function asString(x){
    return x == null ? '' : String(x);
  }

  function safeTrim(x){
    return asString(x).trim();
  }

  function clamp(n, a, b){
    return Math.max(a, Math.min(b, n));
  }

  function compact(n){
    return Math.round(Number(n) * 1000) / 1000;
  }

  function allowedTailOverrunBeat(spanBeat){
    var span = Number(spanBeat);
    if (!isFiniteNumber(span) || span <= 0) return 0.5;
    return Math.min(2.0, Math.max(0.5, span * 0.05));
  }

  function allowedTailBoundaryBeat(spanBeat){
    var span = Number(spanBeat);
    if (!isFiniteNumber(span) || span <= 0) span = 0;
    return span + allowedTailOverrunBeat(span);
  }

  function deepClone(x){
    if (!x) return x;
    try { return JSON.parse(JSON.stringify(x)); } catch (_) { return x; }
  }

  function collectForbiddenDraftFields(x){
    var out = [];
    var seen = new Set();
    function walk(v, path){
      if (!v || typeof v !== 'object') return;
      if (seen.has(v)) return;
      seen.add(v);
      if (Array.isArray(v)){
        for (var i = 0; i < v.length; i++) walk(v[i], path + '[' + i + ']');
        return;
      }
      var keys = Object.keys(v);
      for (var kx = 0; kx < keys.length; kx++){
        var key = keys[kx];
        var lower = key.toLowerCase();
        if (/sec$/.test(lower)){
          out.push('seconds_fields_forbidden:' + path + '.' + key);
        }
        if (key === 'trackId' || key === 'clipId' || key === 'instanceId' || key === 'noteId' || key === 'id'){
          out.push('project_id_field_forbidden:' + path + '.' + key);
        }
        walk(v[key], path + '.' + key);
      }
    }
    walk(x, '$');
    return out;
  }

  function inferIntentFromText(text){
    var s = safeTrim(text).toLowerCase();
    var hasBass = /\bbass\b/.test(s) || /贝斯|低音/.test(s);
    var hasDrums = /\bdrums?\b|\bbeats?\b|\bpercussion\b/.test(s) || /鼓点|加鼓|鼓|打击/.test(s);
    if (hasBass && hasDrums) return 'bass_drums';
    if (hasBass) return 'bass';
    if (hasDrums) return 'drums';
    return 'bass_drums';
  }

  function normalizeIntent(value, context){
    var raw = safeTrim(value).toLowerCase();
    if (raw === 'bass' || raw === 'drums' || raw === 'bass_drums' || raw === 'accompaniment') return raw;
    return inferIntentFromText(context && context.userPrompt);
  }

  function requiredPartTypes(intent, context){
    var inferred = normalizeIntent(intent, context);
    if (inferred === 'bass') return ['bass'];
    if (inferred === 'drums') return ['drums'];
    return ['bass', 'drums'];
  }

  function sanitizeSpan(context){
    var span = Number(context && context.selectedClipSpanBeat);
    if (isFiniteNumber(span) && span > 0) return Math.max(0.25, compact(span));
    var rows = context && Array.isArray(context.melodyNoteRows) ? context.melodyNoteRows : [];
    var end = 0;
    for (var i = 0; i < rows.length; i++){
      var r = rows[i] || {};
      var st = Number(r.startBeat);
      var du = Number(r.durationBeat);
      if (!isFiniteNumber(st)) st = 0;
      if (!isFiniteNumber(du) || du <= 0) du = 0.5;
      end = Math.max(end, st + du);
    }
    return end > 0 ? compact(end) : 4;
  }

  function eventCoverage(events){
    var end = 0;
    for (var i = 0; i < events.length; i++){
      var ev = events[i] || {};
      var st = Number(ev.startBeat);
      var du = Number(ev.durationBeat);
      if (!isFiniteNumber(st) || !isFiniteNumber(du) || du <= 0) continue;
      end = Math.max(end, st + du);
    }
    return end;
  }

  function validateBassNote(note, partIndex, eventIndex, span, errors){
    if (!note || typeof note !== 'object'){
      errors.push('draft.part_event_not_object:' + partIndex + ':' + eventIndex);
      return;
    }
    var startBeat = Number(note.startBeat);
    var durationBeat = Number(note.durationBeat);
    var pitch = Number(note.pitch);
    var velocity = Number(note.velocity);
    if (!isFiniteNumber(startBeat) || startBeat < 0) errors.push('draft.note.startBeat_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(durationBeat) || durationBeat <= 0) errors.push('draft.note.durationBeat_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(pitch) || pitch < 0 || pitch > 127) errors.push('draft.note.pitch_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(velocity) || velocity < 1 || velocity > 127) errors.push('draft.note.velocity_invalid:' + partIndex + ':' + eventIndex);
    if (span > 0 && isFiniteNumber(startBeat) && isFiniteNumber(durationBeat)){
      var boundary = allowedTailBoundaryBeat(span);
      if (startBeat >= boundary - 0.001 || startBeat + durationBeat > boundary + 0.001){
        errors.push('draft.note.outside_selected_span:' + partIndex + ':' + eventIndex);
      }
    }
  }

  function validateDrumHit(hit, partIndex, eventIndex, span, errors){
    if (!hit || typeof hit !== 'object'){
      errors.push('draft.part_event_not_object:' + partIndex + ':' + eventIndex);
      return;
    }
    var startBeat = Number(hit.startBeat);
    var durationBeat = Number(hit.durationBeat);
    var velocity = Number(hit.velocity);
    var drum = safeTrim(hit.drum).toLowerCase();
    if (!isFiniteNumber(startBeat) || startBeat < 0) errors.push('draft.hit.startBeat_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(durationBeat) || durationBeat <= 0) errors.push('draft.hit.durationBeat_invalid:' + partIndex + ':' + eventIndex);
    if (!DRUM_PITCH[drum]) errors.push('draft.hit.drum_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(velocity) || velocity < 1 || velocity > 127) errors.push('draft.hit.velocity_invalid:' + partIndex + ':' + eventIndex);
    if (span > 0 && isFiniteNumber(startBeat) && isFiniteNumber(durationBeat)){
      var boundary = allowedTailBoundaryBeat(span);
      if (startBeat >= boundary - 0.001 || startBeat + durationBeat > boundary + 0.001){
        errors.push('draft.hit.outside_selected_span:' + partIndex + ':' + eventIndex);
      }
    }
  }

  function validateAccompanimentDraftV1(draft, context, opts){
    var cfg = opts && typeof opts === 'object' ? opts : {};
    var span = sanitizeSpan(context || {});
    var errors = [];
    var warnings = [];
    var summary = {
      intent: null,
      partTypes: [],
      bassNoteCount: 0,
      drumHitCount: 0,
      totalEvents: 0,
      coverageByType: {},
    };

    if (!draft || typeof draft !== 'object'){
      errors.push('draft_not_object');
      return { ok: false, errors: errors, warnings: warnings, summary: summary };
    }
    if (draft.version !== 1) errors.push('draft.version_must_be_1');
    errors.push.apply(errors, collectForbiddenDraftFields(draft));

    var intent = normalizeIntent(draft.intent, context);
    summary.intent = intent;
    var required = requiredPartTypes(intent, context);
    var parts = Array.isArray(draft.parts) ? draft.parts : null;
    if (!parts || parts.length < 1) errors.push('draft.parts_not_array_or_empty');
    if (parts && parts.length > 4) errors.push('draft.too_many_parts:' + parts.length);

    var seenTypes = {};
    var maxEvents = isFiniteNumber(Number(cfg.maxEvents)) ? Math.max(1, Number(cfg.maxEvents)) : 256;
    for (var i = 0; i < (parts || []).length; i++){
      var part = parts[i];
      if (!part || typeof part !== 'object'){
        errors.push('draft.part_not_object:' + i);
        continue;
      }
      var type = safeTrim(part.type).toLowerCase();
      if (type === 'drum') type = 'drums';
      if (type !== 'bass' && type !== 'drums'){
        errors.push('draft.part.type_invalid:' + i);
        continue;
      }
      seenTypes[type] = true;
      summary.partTypes.push(type);

      if (type === 'bass'){
        var notes = Array.isArray(part.notes) ? part.notes : null;
        if (!notes || notes.length < 1) errors.push('draft.part.bass.notes_empty:' + i);
        for (var ni = 0; ni < (notes || []).length; ni++) validateBassNote(notes[ni], i, ni, span, errors);
        var bassEnd = eventCoverage(notes || []);
        summary.bassNoteCount += (notes || []).length;
        summary.totalEvents += (notes || []).length;
        summary.coverageByType.bass = Math.max(summary.coverageByType.bass || 0, span > 0 ? bassEnd / span : 0);
      } else if (type === 'drums'){
        var hits = Array.isArray(part.hits) ? part.hits : null;
        if (!hits || hits.length < 1) errors.push('draft.part.drums.hits_empty:' + i);
        for (var hi = 0; hi < (hits || []).length; hi++) validateDrumHit(hits[hi], i, hi, span, errors);
        var drumEnd = eventCoverage(hits || []);
        summary.drumHitCount += (hits || []).length;
        summary.totalEvents += (hits || []).length;
        summary.coverageByType.drums = Math.max(summary.coverageByType.drums || 0, span > 0 ? drumEnd / span : 0);
      }
    }

    for (var ri = 0; ri < required.length; ri++){
      if (!seenTypes[required[ri]]) errors.push('draft.missing_requested_part:' + required[ri]);
    }

    if (summary.totalEvents > maxEvents) errors.push('draft.too_many_events:' + summary.totalEvents);
    if (span >= 6){
      if (seenTypes.bass){
        var minBass = Math.max(2, Math.ceil(span / 2));
        if (summary.bassNoteCount < minBass) errors.push('draft.too_few_bass_notes:' + summary.bassNoteCount + ':min_' + minBass);
        if ((summary.coverageByType.bass || 0) < 0.75) errors.push('draft.short_coverage:bass');
      }
      if (seenTypes.drums){
        var minDrums = Math.max(6, Math.ceil(span * 1.25));
        if (summary.drumHitCount < minDrums) errors.push('draft.too_few_drum_hits:' + summary.drumHitCount + ':min_' + minDrums);
        if ((summary.coverageByType.drums || 0) < 0.75) errors.push('draft.short_coverage:drums');
      }
    } else {
      if (seenTypes.bass && span > 1.5 && summary.bassNoteCount < 2) errors.push('draft.too_few_bass_notes:' + summary.bassNoteCount + ':min_2');
      if (seenTypes.drums && span > 1.5 && summary.drumHitCount < 3) errors.push('draft.too_few_drum_hits:' + summary.drumHitCount + ':min_3');
    }

    if (summary.bassNoteCount > 0 && summary.bassNoteCount <= 2) warnings.push({ code: 'simple_bass_pattern', severity: 'warn' });
    if (summary.drumHitCount > 0 && summary.drumHitCount <= 4) warnings.push({ code: 'simple_drum_pattern', severity: 'warn' });

    return { ok: errors.length === 0, errors: errors, warnings: warnings, summary: summary };
  }

  function melodyRootPitchClass(rows){
    var counts = {};
    var best = null;
    var bestCount = -1;
    for (var i = 0; i < rows.length; i++){
      var p = Number(rows[i] && rows[i].pitch);
      if (!isFiniteNumber(p)) continue;
      var pc = ((Math.round(p) % 12) + 12) % 12;
      counts[pc] = (counts[pc] || 0) + 1;
      if (counts[pc] > bestCount){
        bestCount = counts[pc];
        best = pc;
      }
    }
    return best == null ? 0 : best;
  }

  function bassPitchForPc(rootPc, offset){
    var pc = (rootPc + offset) % 12;
    var pitch = 36 + pc;
    while (pitch > 48) pitch -= 12;
    while (pitch < 34) pitch += 12;
    return clamp(pitch, 28, 52);
  }

  function makeDeterministicBassPart(context, span){
    var rows = context && Array.isArray(context.melodyNoteRows) ? context.melodyNoteRows : [];
    var rootPc = melodyRootPitchClass(rows);
    var step = span > 48 ? 2 : 1;
    var offsets = [0, 0, 7, 0, 5, 7, 0, 7];
    var notes = [];
    var maxNotes = 96;
    var boundary = allowedTailBoundaryBeat(span);
    for (var t = 0; t < span - 0.001 && notes.length < maxNotes; t += step){
      var idx = Math.floor(t / step) % offsets.length;
      var remaining = boundary - t;
      if (remaining <= 0.0625) continue;
      var dur = Math.min(step * 0.88, Math.max(0.25, remaining));
      if (t + dur > boundary + 0.001) dur = boundary - t;
      if (dur < 0.0625) continue;
      notes.push({
        startBeat: compact(t),
        pitch: bassPitchForPc(rootPc, offsets[idx]),
        durationBeat: compact(dur),
        velocity: idx % 2 === 0 ? 70 : 66,
      });
    }
    return { type: 'bass', instrument: 'bass', notes: notes };
  }

  function pushDrumHit(hits, span, startBeat, drum, velocity){
    var boundary = allowedTailBoundaryBeat(span);
    if (startBeat < -0.001 || startBeat >= boundary - 0.001) return;
    var remaining = boundary - startBeat;
    if (remaining <= 0.0625) return;
    var durationBeat = Math.min(0.25, Math.max(0.125, compact(remaining)));
    if (startBeat + durationBeat > boundary + 0.001) durationBeat = compact(boundary - startBeat);
    if (durationBeat < 0.0625) return;
    hits.push({
      startBeat: compact(startBeat),
      drum: drum,
      durationBeat: compact(durationBeat),
      velocity: velocity,
    });
  }

  function makeDeterministicDrumPart(context, span){
    var hits = [];
    var hatStep = span > 48 ? 1 : 0.5;
    for (var t = 0; t < span - 0.001; t += hatStep){
      pushDrumHit(hits, span, t, 'hat', 46);
    }
    for (var b = 0; b < span - 0.001; b += 1){
      var beatInBar = ((Math.floor(b) % 4) + 4) % 4;
      if (beatInBar === 0 || beatInBar === 2) pushDrumHit(hits, span, b, 'kick', beatInBar === 0 ? 78 : 72);
      if (beatInBar === 1 || beatInBar === 3) pushDrumHit(hits, span, b, 'snare', 72);
    }
    if (span >= 8){
      pushDrumHit(hits, span, Math.max(0, span - 0.5), 'snare', 64);
    }
    hits.sort(function(a, b){ return a.startBeat - b.startBeat || safeTrim(a.drum).localeCompare(safeTrim(b.drum)); });
    if (hits.length > 160){
      hits = hits.filter(function(_hit, idx){ return idx % 2 === 0; }).slice(0, 160);
    }
    return { type: 'drums', instrument: 'drums', hits: hits };
  }

  function createDeterministicAccompanimentDraftV1(context){
    var ctx = context && typeof context === 'object' ? context : {};
    var span = sanitizeSpan(ctx);
    var intent = normalizeIntent(ctx.intent, ctx);
    var required = requiredPartTypes(intent, ctx);
    var parts = [];
    if (required.indexOf('bass') >= 0) parts.push(makeDeterministicBassPart(ctx, span));
    if (required.indexOf('drums') >= 0) parts.push(makeDeterministicDrumPart(ctx, span));
    return {
      version: 1,
      intent: intent === 'accompaniment' ? 'bass_drums' : intent,
      style: safeTrim(ctx.style) || 'simple',
      parts: parts,
    };
  }

  function existingIds(projectV2){
    var tracks = new Set();
    var clips = new Set();
    var instances = new Set();
    var p = projectV2 || {};
    var ts = Array.isArray(p.tracks) ? p.tracks : [];
    for (var ti = 0; ti < ts.length; ti++){
      if (ts[ti] && safeTrim(ts[ti].id)) tracks.add(safeTrim(ts[ti].id));
      if (ts[ti] && safeTrim(ts[ti].trackId)) tracks.add(safeTrim(ts[ti].trackId));
    }
    if (p.clips && typeof p.clips === 'object' && !Array.isArray(p.clips)){
      var keys = Object.keys(p.clips);
      for (var ci = 0; ci < keys.length; ci++){
        clips.add(String(keys[ci]));
        if (p.clips[keys[ci]] && safeTrim(p.clips[keys[ci]].id)) clips.add(safeTrim(p.clips[keys[ci]].id));
      }
    }
    var inst = Array.isArray(p.instances) ? p.instances : [];
    for (var ii = 0; ii < inst.length; ii++){
      if (inst[ii] && safeTrim(inst[ii].id)) instances.add(safeTrim(inst[ii].id));
    }
    return { tracks: tracks, clips: clips, instances: instances };
  }

  function nextId(prefix, used){
    var n = 1;
    while (used.has(prefix + n)) n++;
    var id = prefix + n;
    used.add(id);
    return id;
  }

  function normalizedDrumPitch(raw){
    var key = safeTrim(raw).toLowerCase();
    return DRUM_PITCH[key] || DRUM_PITCH.perc;
  }

  function normalizeInstrumentForPart(part){
    var type = safeTrim(part && part.type).toLowerCase();
    var instr = safeTrim(part && part.instrument).toLowerCase();
    if (type === 'drums' || type === 'drum') return 'drum';
    if (type === 'bass') return 'bass';
    return instr || 'default';
  }

  function packPartToOps(projectIds, part, context, partIndex){
    var type = safeTrim(part.type).toLowerCase();
    if (type === 'drum') type = 'drums';
    var trackId = nextId('trk_acc_', projectIds.tracks);
    var clipId = nextId('clip_acc_', projectIds.clips);
    var instanceId = nextId('inst_acc_', projectIds.instances);
    var noteIds = new Set();
    var scoreTrackId = 'score_' + type + '_1';
    var notes = [];
    if (type === 'bass'){
      var bassNotes = Array.isArray(part.notes) ? part.notes.slice() : [];
      bassNotes.sort(function(a, b){ return Number(a.startBeat) - Number(b.startBeat); });
      for (var ni = 0; ni < bassNotes.length; ni++){
        var n = bassNotes[ni] || {};
        notes.push({
          id: nextId('n_acc_', noteIds),
          pitch: clamp(Math.round(Number(n.pitch)), 0, 127),
          velocity: clamp(Math.round(Number(n.velocity)), 1, 127),
          startBeat: compact(Number(n.startBeat)),
          durationBeat: compact(Number(n.durationBeat)),
        });
      }
    } else {
      var hits = Array.isArray(part.hits) ? part.hits.slice() : [];
      hits.sort(function(a, b){ return Number(a.startBeat) - Number(b.startBeat); });
      for (var hi = 0; hi < hits.length; hi++){
        var h = hits[hi] || {};
        notes.push({
          id: nextId('n_acc_', noteIds),
          pitch: normalizedDrumPitch(h.drum),
          velocity: clamp(Math.round(Number(h.velocity)), 1, 127),
          startBeat: compact(Number(h.startBeat)),
          durationBeat: compact(Number(h.durationBeat)),
        });
      }
    }
    var name = type === 'bass' ? 'Bass' : 'Drums';
    var gainDb = type === 'bass' ? -7 : -9;
    return [
      { op: 'createTrack', trackId: trackId, name: name, instrument: normalizeInstrumentForPart(part), gainDb: gainDb },
      {
        op: 'createClip',
        clipId: clipId,
        name: name + ' Accompaniment',
        sourceTaskId: 'arrange:draft_v1',
        scoreBeat: {
          version: 2,
          time_signature: safeTrim(context && context.timeSignature) || '4/4',
          tracks: [{ id: scoreTrackId, name: name, notes: notes }],
        },
      },
      {
        op: 'addInstance',
        instanceId: instanceId,
        clipId: clipId,
        trackId: trackId,
        startBeat: isFiniteNumber(Number(context && context.selectedInstanceStartBeat)) ? Math.max(0, compact(Number(context.selectedInstanceStartBeat))) : 0,
        transpose: 0,
      },
    ];
  }

  function packAccompanimentDraftV1ToArrangementPatchV0(projectV2, draft, context, opts){
    var validation = validateAccompanimentDraftV1(draft, context, opts);
    if (!validation.ok){
      return {
        ok: false,
        reason: 'draft_validation_failed',
        errors: validation.errors.slice(),
        warnings: validation.warnings.slice(),
        draftValidation: validation,
        patch: null,
      };
    }
    var projectIds = existingIds(projectV2);
    var parts = Array.isArray(draft.parts) ? draft.parts : [];
    var ops = [];
    for (var i = 0; i < parts.length; i++){
      var part = parts[i];
      if (!part || typeof part !== 'object') continue;
      ops = ops.concat(packPartToOps(projectIds, part, context || {}, i));
    }
    var patch = {
      kind: 'arrangement_patch_v0',
      version: 1,
      ops: ops,
    };
    return {
      ok: true,
      reason: 'ok',
      errors: [],
      warnings: validation.warnings.slice(),
      draftValidation: validation,
      patch: patch,
    };
  }

  return {
    validateAccompanimentDraftV1: validateAccompanimentDraftV1,
    packAccompanimentDraftV1ToArrangementPatchV0: packAccompanimentDraftV1ToArrangementPatchV0,
    createDeterministicAccompanimentDraftV1: createDeterministicAccompanimentDraftV1,
    inferIntentFromText: inferIntentFromText,
    allowedTailOverrunBeat: allowedTailOverrunBeat,
    drumPitchMap: function(){ return deepClone(DRUM_PITCH); },
  };
});
