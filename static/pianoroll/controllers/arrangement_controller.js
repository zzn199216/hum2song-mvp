(function(ROOT){
  'use strict';

  if (typeof require === 'function'){
    if (!ROOT.H2SArrangementPatchV0){
      try {
        const mod = require('../core/arrangement_patch_v0.js');
        if (mod && !ROOT.H2SArrangementPatchV0) ROOT.H2SArrangementPatchV0 = mod;
      } catch (_) {}
    }
    if (!ROOT.H2SArrangementQualityV0){
      try {
        const qmod = require('../core/arrangement_quality_v0.js');
        if (qmod && !ROOT.H2SArrangementQualityV0) ROOT.H2SArrangementQualityV0 = qmod;
      } catch (_) {}
    }
    if (!ROOT.H2SAccompanimentDraftV1){
      try {
        const dmod = require('../core/accompaniment_draft_v1.js');
        if (dmod && !ROOT.H2SAccompanimentDraftV1) ROOT.H2SAccompanimentDraftV1 = dmod;
      } catch (_) {}
    }
  }

  function isFiniteNumber(x){
    return typeof x === 'number' && isFinite(x);
  }

  function asString(x){
    return (x == null) ? '' : String(x);
  }

  function safeTrim(x){
    return asString(x).trim();
  }

  function clipKind(projectApi, clip){
    if (projectApi && typeof projectApi.clipKind === 'function'){
      return projectApi.clipKind(clip);
    }
    return (clip && clip.kind === 'audio') ? 'audio' : 'note';
  }

  function getClipMap(project){
    if (!project || !project.clips || typeof project.clips !== 'object' || Array.isArray(project.clips)) return {};
    return project.clips;
  }

  function melodyVelocityStats(scoreBeat){
    let maxV = 0;
    let n = 0;
    let sum = 0;
    const tracks = (scoreBeat && Array.isArray(scoreBeat.tracks)) ? scoreBeat.tracks : [];
    for (const tr of tracks){
      const notes = (tr && Array.isArray(tr.notes)) ? tr.notes : [];
      for (const note of notes){
        const v = Number(note && note.velocity);
        if (!isFiniteNumber(v)) continue;
        n++;
        sum += v;
        if (v > maxV) maxV = v;
      }
    }
    return { maxVelocity: maxV, avgVelocity: n ? (sum / n) : 0, noteCount: n };
  }

  function countNotes(scoreBeat){
    let n = 0;
    const tracks = (scoreBeat && Array.isArray(scoreBeat.tracks)) ? scoreBeat.tracks : [];
    for (const tr of tracks){
      const notes = (tr && Array.isArray(tr.notes)) ? tr.notes : [];
      n += notes.length;
    }
    return n;
  }

  function messageDiagnostics(messages, noteRowsTotal, noteRowsSent, promptMode){
    const arr = Array.isArray(messages) ? messages : [];
    let totalChars = 0;
    let maxMessageChars = 0;
    for (let i = 0; i < arr.length; i++){
      const msg = arr[i] || {};
      const len = typeof msg.content === 'string' ? msg.content.length : 0;
      totalChars += len;
      if (len > maxMessageChars) maxMessageChars = len;
    }
    return {
      messagesCount: arr.length,
      totalChars: totalChars,
      maxMessageChars: maxMessageChars,
      noteRowsTotal: isFiniteNumber(Number(noteRowsTotal)) ? Number(noteRowsTotal) : null,
      noteRowsSent: isFiniteNumber(Number(noteRowsSent)) ? Number(noteRowsSent) : null,
      promptMode: safeTrim(promptMode) || null,
    };
  }

  function compactNumber(value, fallback){
    const n = Number(value);
    if (!isFiniteNumber(n)) return fallback;
    return Math.round(n * 1000) / 1000;
  }

  function boundedText(value, maxChars){
    const s = asString(value);
    const n = isFiniteNumber(Number(maxChars)) ? Math.max(0, Math.floor(Number(maxChars))) : 0;
    if (!n || s.length <= n) return s;
    return s.slice(0, n - 3) + '...';
  }

  function buildMelodyNoteTable(scoreBeat, maxRows){
    const rows = [];
    const tracks = (scoreBeat && Array.isArray(scoreBeat.tracks)) ? scoreBeat.tracks : [];
    for (let ti = 0; ti < tracks.length; ti++){
      const tr = tracks[ti] || {};
      const trackId = safeTrim(tr.id || tr.trackId) || ('track_' + ti);
      const notes = Array.isArray(tr.notes) ? tr.notes.slice() : [];
      notes.sort(function(a, b){
        const sa = Number(a && a.startBeat);
        const sb = Number(b && b.startBeat);
        if (sa !== sb) return sa - sb;
        const ia = asString(a && a.id);
        const ib = asString(b && b.id);
        if (ia < ib) return -1;
        if (ia > ib) return 1;
        return 0;
      });
      for (const note of notes){
        if (rows.length >= maxRows) return rows;
        rows.push({
          noteId: asString(note && note.id),
          pitch: Number(note && note.pitch),
          velocity: Number(note && note.velocity),
          startBeat: Number(note && note.startBeat),
          durationBeat: Number(note && note.durationBeat),
        });
      }
    }
    return rows;
  }

  function melodyPitchStats(noteTable){
    let minPitch = null;
    let maxPitch = null;
    for (let i = 0; i < noteTable.length; i++){
      const p = Number(noteTable[i] && noteTable[i].pitch);
      if (!isFiniteNumber(p)) continue;
      if (minPitch === null || p < minPitch) minPitch = p;
      if (maxPitch === null || p > maxPitch) maxPitch = p;
    }
    return { minPitch: minPitch, maxPitch: maxPitch };
  }

  function formatMelodyNoteRowsCsv(noteTable){
    const lines = ['row,pitch,vel,start,dur'];
    for (let i = 0; i < noteTable.length; i++){
      const r = noteTable[i] || {};
      lines.push([
        String(i + 1),
        String(Math.max(0, Math.min(127, Math.round(Number(r.pitch) || 0)))),
        String(Math.max(1, Math.min(127, Math.round(Number(r.velocity) || 1)))),
        String(compactNumber(r.startBeat, 0)),
        String(compactNumber(r.durationBeat, 0)),
      ].join(','));
    }
    return lines.join('\n');
  }

  function summarizeTracks(project, maxItems){
    const out = [];
    const tracks = (project && Array.isArray(project.tracks)) ? project.tracks : [];
    for (let i = 0; i < tracks.length && out.length < maxItems; i++){
      const t = tracks[i] || {};
      out.push({
        id: safeTrim(t.id || t.trackId) || ('track_' + i),
        name: safeTrim(t.name) || '',
        instrument: safeTrim(t.instrument) || 'default',
      });
    }
    return out;
  }

  function summarizeInstances(project, maxItems){
    const out = [];
    const instances = (project && Array.isArray(project.instances)) ? project.instances : [];
    for (let i = 0; i < instances.length && out.length < maxItems; i++){
      const inst = instances[i] || {};
      out.push({
        id: safeTrim(inst.id),
        clip: safeTrim(inst.clipId),
        track: safeTrim(inst.trackId),
        start: compactNumber(inst.startBeat, 0),
        transpose: compactNumber(inst.transpose || 0, 0),
      });
    }
    return out;
  }

  function uniqueGeneratedId(projectApi, prefix, used){
    const seen = used && typeof used.has === 'function' ? used : new Set();
    for (let i = 0; i < 20; i++){
      const raw = (projectApi && typeof projectApi.uid === 'function')
        ? projectApi.uid(prefix)
        : (prefix + Math.random().toString(16).slice(2, 10));
      const id = safeTrim(raw);
      if (id && !seen.has(id)){
        seen.add(id);
        return id;
      }
    }
    let n = 1;
    while (seen.has(prefix + n)) n++;
    const fallback = prefix + n;
    seen.add(fallback);
    return fallback;
  }

  function normalizeGeneratedArrangementIds(projectV2, patch, projectApi){
    if (!patch || typeof patch !== 'object' || !Array.isArray(patch.ops)) return patch;
    const out = JSON.parse(JSON.stringify(patch));
    const ops = Array.isArray(out.ops) ? out.ops : [];
    const existingTracks = new Set((projectV2 && Array.isArray(projectV2.tracks) ? projectV2.tracks : []).map(function(t){
      return safeTrim((t && (t.id || t.trackId)) || '');
    }).filter(Boolean));
    const existingClips = new Set(Object.keys(getClipMap(projectV2)).map(safeTrim).filter(Boolean));
    const existingInstances = new Set((projectV2 && Array.isArray(projectV2.instances) ? projectV2.instances : []).map(function(inst){
      return safeTrim(inst && inst.id);
    }).filter(Boolean));

    const usedTracks = new Set(existingTracks);
    const usedClips = new Set(existingClips);
    const usedInstances = new Set(existingInstances);
    const trackMap = {};
    const clipMap = {};

    for (let i = 0; i < ops.length; i++){
      const op = ops[i];
      if (!op || typeof op !== 'object') continue;
      if (String(op.op || '') === 'createTrack'){
        const oldId = safeTrim(op.trackId);
        if (!oldId || usedTracks.has(oldId)){
          const nextId = uniqueGeneratedId(projectApi, 'trk_acc_', usedTracks);
          if (oldId) trackMap[oldId] = nextId;
          op.trackId = nextId;
        } else {
          usedTracks.add(oldId);
        }
      } else if (String(op.op || '') === 'createClip'){
        const oldId = safeTrim(op.clipId);
        if (!oldId || usedClips.has(oldId)){
          const nextId = uniqueGeneratedId(projectApi, 'clip_acc_', usedClips);
          if (oldId) clipMap[oldId] = nextId;
          op.clipId = nextId;
        } else {
          usedClips.add(oldId);
        }
        const tracks = (op.scoreBeat && Array.isArray(op.scoreBeat.tracks)) ? op.scoreBeat.tracks : [];
        const usedNoteIds = new Set();
        for (let ti = 0; ti < tracks.length; ti++){
          const tr = tracks[ti] || {};
          if (!safeTrim(tr.id)) tr.id = uniqueGeneratedId(projectApi, 'score_trk_', new Set());
          const notes = Array.isArray(tr.notes) ? tr.notes : [];
          for (let ni = 0; ni < notes.length; ni++){
            const note = notes[ni];
            if (!note || typeof note !== 'object') continue;
            const oldNoteId = safeTrim(note.id);
            if (!oldNoteId || usedNoteIds.has(oldNoteId)){
              note.id = uniqueGeneratedId(projectApi, 'n_acc_', usedNoteIds);
            } else {
              usedNoteIds.add(oldNoteId);
            }
          }
        }
      }
    }

    for (let i = 0; i < ops.length; i++){
      const op = ops[i];
      if (!op || typeof op !== 'object') continue;
      const kind = String(op.op || '');
      if (kind === 'addInstance'){
        const oldInstId = safeTrim(op.instanceId);
        if (!oldInstId || usedInstances.has(oldInstId)){
          op.instanceId = uniqueGeneratedId(projectApi, 'inst_acc_', usedInstances);
        } else {
          usedInstances.add(oldInstId);
        }
        const cid = safeTrim(op.clipId);
        const tid = safeTrim(op.trackId);
        if (cid && clipMap[cid]) op.clipId = clipMap[cid];
        if (tid && trackMap[tid]) op.trackId = trackMap[tid];
      } else if (kind === 'setTrackInstrument'){
        const tid = safeTrim(op.trackId);
        if (tid && trackMap[tid]) op.trackId = trackMap[tid];
      }
    }
    return out;
  }

  /** Explicit default accompaniment draft strategy (prompt-only; project structure is generated by code). */
  function buildAddAccompanimentV0StrategyBlock(){
    return [
      'Strategy for add_accompaniment_v0:',
      '- Default strategy: create a musically useful accompaniment, not only a minimal placeholder.',
      '- Parts: if the user asks for bass plus drums/percussion, include both bass and drums parts. Use one part only when the user asks for one part or the musical idea clearly needs one.',
      '- Duration coverage: use Context JSON selectedClip.spanBeat as the target accompaniment length (beats).',
      '- Generated accompaniment should usually cover most or all of the selected melody clip.',
      '- Do not end accompaniment much earlier than the melody unless the user explicitly asks for a short fill.',
      '- Avoid leaving a large silent tail; ending slightly before or after the melody is OK.',
      '- For bass, drum, and rhythm patterns, repeat or continue the pattern until near selectedClip.spanBeat.',
      '- If creating both bass and drums, both should roughly cover the selected clip unless one is explicitly a short fill.',
      '- Draft part types are bass and drums. Use drums for the draft part type, not project instrument IDs.',
      '- Bass: use low-register notes with a clear repeating groove. Follow strong melody beats and imply root movement; avoid only whole-clip sustained notes.',
      '- Drums: use a recognizable kick/snare/hat or percussion pattern when drum is requested. Add small variations or fills every 4-8 bars when the clip is long enough.',
      '- Use short-to-medium rhythmic notes and enough activity to feel like an accompaniment, while leaving space for the melody.',
      '- Avoid pad-only / block-chord-only output as the default.',
      '- Preserve melody as the main focus.',
      '- If adding chords/pad, keep them secondary and light.',
      '- Velocity (MIDI 1-127) for draft events: bass often 50-72; kick/snare/main hits often 50-78; hi-hat/auxiliary hits often 35-62.',
      '- Keep accompaniment velocities generally below the melody’s strongest notes (see melody note rows).',
      '- Avoid over-constraining musical choices: prefer coherent groove and variation over extreme sparsity.',
      '- Do not overpower the melody.',
      '- Do not modify/delete existing melody material.',
    ].join('\n');
  }

  function buildArrangementOutputFormatContractBlock(){
    return [
      'Output format contract:',
      '- Return exactly one ```json fenced block and nothing else before or after it.',
      '- The JSON inside the fence must be one object, not an array and not prose.',
      '- The JSON object MUST be AccompanimentDraft v1 musical content only.',
      '- Top-level fields must include version, intent, style, and parts.',
      '',
      'Draft object formats:',
      '- version: exactly 1.',
      '- intent: "bass", "drums", "bass_drums", or "accompaniment".',
      '- style: short string such as "simple", "pop", "sad", or "energetic".',
      '- parts: array of one or two part objects.',
      '- bass part: type "bass", instrument "bass", notes with startBeat, pitch, durationBeat, velocity.',
      '- drums part: type "drums", instrument "drums", hits with startBeat, drum, durationBeat, velocity.',
      '',
      '- Do not output Arrangement Patch v0. Code will generate the final patch.',
      '- Draft must not contain trackId, clipId, instanceId, noteId, or id.',
      '- Use beat timing fields only; never use startSec, durationSec, spanSec, or any seconds field.',
      '- Music remains creative: choose rhythm, pitch, density, contour, velocity, instruments, and variation from the melody/context.',
      '- Derive musical content from Context compact JSON and melodyNoteRowsBeatCSV, especially selectedClip.spanBeat.',
      '- Do not copy placeholder values; this prompt intentionally gives no concrete musical notes.',
    ].join('\n');
  }

  function buildPromptContext(input){
    const noteTable = buildMelodyNoteTable(input.selectedClip.score, 512);
    const pitchStats = melodyPitchStats(noteTable);
    const projectContext = {
      bpm: compactNumber(input.bpm, 120),
      timeSignature: input.timeSignature || null,
      selectedClip: {
        clipId: input.selectedClipId,
        name: safeTrim(input.selectedClip.name) || '',
        spanBeat: compactNumber(input.selectedClipSpanBeat, 0),
        instanceStartBeat: compactNumber(input.selectedInstanceStartBeat, 0),
      },
      melodySummary: {
        noteCount: noteTable.length,
        minPitch: pitchStats.minPitch,
        maxPitch: pitchStats.maxPitch,
      },
      existingTracks: summarizeTracks(input.projectV2, 24),
      existingTimelineInstances: summarizeInstances(input.projectV2, 48),
    };

    const systemPrompt = [
      'You are an accompaniment draft generator for Hum2Song.',
      'Output exactly ONE JSON object in a single ```json code block with no other text.',
      'The JSON object MUST follow AccompanimentDraft v1 for additive accompaniment only.',
      'Do not output Arrangement Patch v0; project structure and IDs are generated by code.',
      '',
      'Hard constraints:',
      '- version must be 1.',
      '- intent must be bass, drums, bass_drums, or accompaniment.',
      '- parts may contain bass notes and/or drum hits only.',
      '- beats-only: never output seconds fields (no startSec/durationSec/spanSec or any *sec field).',
      '- do not output trackId, clipId, instanceId, noteId, or id.',
      '- never modify or delete existing melody material.',
      '- keep accompaniment supportive, balanced, and musically coherent; do not default to extremely sparse placeholder parts.',
      '- generated caps: max 2 parts and max 256 draft events total.',
      '',
      'Return only the JSON code block.',
    ].join('\n');

    const goalStr = safeTrim(input.goal || '');
    const userPromptParts = [
      'Generate AccompanimentDraft v1 for goal: add_accompaniment_v0.',
      (input.userPrompt ? ('User instruction: ' + input.userPrompt) : 'User instruction: (none)'),
    ];
    if (goalStr === 'add_accompaniment_v0'){
      userPromptParts.push('', buildAddAccompanimentV0StrategyBlock());
    }
    userPromptParts.push(
      '',
      buildArrangementOutputFormatContractBlock(),
      '',
      'Context compact JSON:',
      JSON.stringify(projectContext),
      '',
      'melodyNoteRowsBeatCSV:',
      formatMelodyNoteRowsCsv(noteTable),
      '',
      'Return shape:',
      '- {"version":1,"intent":"bass_drums","style":"simple","parts":[...]}',
      '- Bass events use notes with startBeat, pitch 0..127, durationBeat > 0, velocity 1..127.',
      '- Drum events use hits with startBeat, drum kick/snare/hat/open_hat/tom/crash/ride/clap, durationBeat > 0, velocity 1..127.',
      '- Keep all event timing within selectedClip.spanBeat.',
      '- Do not include seconds fields or project ID fields. Do not modify or delete existing melody.',
    );
    const userPrompt = userPromptParts.join('\n');

    return { systemPrompt: systemPrompt, userPrompt: userPrompt, promptMode: 'compact', noteRowsSent: noteTable.length, noteTable: noteTable };
  }

  function buildArrangementRepairMessages(reason, detail, previousText){
    const repairSystem = [
      'You repair AccompanimentDraft v1 JSON for Hum2Song.',
      'Output exactly ONE JSON object in a single ```json code block with no other text.',
      'No <think>, no hidden reasoning, no explanation, no prose before or after.',
    ].join('\n');
    const repairUser = [
      'Repair the previous AccompanimentDraft v1 response.',
      'Previous failure: ' + (safeTrim(reason) || 'invalid_output') + (safeTrim(detail) ? (': ' + boundedText(detail, 300)) : ''),
      '',
      'Return exactly this shape:',
      '{"version":1,"intent":"bass_drums","style":"simple","parts":[...]}',
      '',
      'Allowed part types: bass and drums.',
      'Bass part uses notes with startBeat, pitch, durationBeat, velocity.',
      'Drums part uses hits with startBeat, drum, durationBeat, velocity.',
      'Do not output trackId, clipId, instanceId, noteId, id, or any project structure.',
      'Do not modify or delete existing melody material.',
      'Use beats-only fields; do not output seconds fields.',
      '',
      'Previous model response, bounded:',
      boundedText(previousText, 800),
    ].join('\n');
    return [
      { role: 'system', content: repairSystem },
      { role: 'user', content: repairUser },
    ];
  }

  function finishReasonFromResponse(res){
    if (!res || typeof res !== 'object') return '';
    if (typeof res.finishReason === 'string') return res.finishReason;
    const raw = res.raw && typeof res.raw === 'object' ? res.raw : null;
    if (raw && typeof raw.finish_reason === 'string') return raw.finish_reason;
    const choices = raw && Array.isArray(raw.choices) ? raw.choices : null;
    const first = choices && choices[0] && typeof choices[0] === 'object' ? choices[0] : null;
    if (first && typeof first.finish_reason === 'string') return first.finish_reason;
    return '';
  }

  function invalidJsonDetail(finishReason){
    return String(finishReason || '').toLowerCase() === 'length' ? 'finish_reason_length' : 'no_json_object_extracted';
  }

  function llmDebugBlock(cfg, callCount, rawText, requestDiagnostics, finishReason){
    const out = {
      callCount: callCount,
      model: safeTrim(cfg && cfg.model),
      baseUrl: safeTrim(cfg && cfg.baseUrl),
      outputChars: asString(rawText).length,
      request: requestDiagnostics,
    };
    if (safeTrim(finishReason)) out.finishReason = safeTrim(finishReason);
    return out;
  }

  function blockingQualityWarnings(report){
    const out = [];
    const warnings = report && Array.isArray(report.warnings) ? report.warnings : [];
    const blocking = new Set(['empty_clip', 'orphan_clip', 'short_coverage', 'sparse_notes', 'overly_dense']);
    for (let i = 0; i < warnings.length; i++){
      const code = safeTrim(warnings[i] && warnings[i].code);
      if (blocking.has(code)) out.push(code);
    }
    return out;
  }

  function compactErrors(errors){
    return Array.isArray(errors) ? errors.slice(0, 10).join('; ') : '';
  }

  function validateHooks(hooks){
    const req = ['getProjectV2', 'setProjectFromV2', 'getSelectedClipId', 'getSelectedInstanceId'];
    for (const k of req){
      if (!hooks || typeof hooks[k] !== 'function') throw new Error('missing_hook:' + k);
    }
  }

  function create(hooks){
    validateHooks(hooks);
    const H2SProject = hooks.H2SProject || ROOT.H2SProject;
    const ArrangementPatch = ROOT.H2SArrangementPatchV0;
    const ArrangementQuality = ROOT.H2SArrangementQualityV0;
    const AccompanimentDraft = ROOT.H2SAccompanimentDraftV1;

    function statusLog(msg, extra){
      if (typeof hooks.log === 'function'){
        try { hooks.log(msg, extra || null); } catch (_) {}
      }
    }

    async function runArrangementV0(options){
      const opts = (options && typeof options === 'object') ? options : {};
      const goal = safeTrim(opts.goal || 'add_accompaniment_v0');
      const userPrompt = (opts.userPrompt != null) ? asString(opts.userPrompt).trim() : '';
      const resultBase = {
        ok: false,
        reason: '',
        detail: '',
        arrangementOutcome: null,
        summary: null,
        llmDebug: null,
        promptTrace: null,
        rawDraft: null,
        rawPatch: null,
        qualityReport: null,
        draftDebug: null,
      };

      if (goal !== 'add_accompaniment_v0'){
        return Object.assign({}, resultBase, {
          reason: 'unsupported_goal',
          detail: 'supported goal: add_accompaniment_v0',
        });
      }

      const projectV2 = hooks.getProjectV2();
      if (!projectV2 || typeof projectV2 !== 'object'){
        return Object.assign({}, resultBase, { reason: 'project_missing' });
      }

      const selectedClipId = safeTrim(hooks.getSelectedClipId());
      if (!selectedClipId){
        return Object.assign({}, resultBase, { reason: 'selected_clip_missing' });
      }
      const selectedInstanceId = safeTrim(hooks.getSelectedInstanceId());
      if (!selectedInstanceId){
        return Object.assign({}, resultBase, { reason: 'selected_instance_missing' });
      }

      const clips = getClipMap(projectV2);
      const selectedClip = clips[selectedClipId] || null;
      if (!selectedClip){
        return Object.assign({}, resultBase, { reason: 'selected_clip_not_found', detail: selectedClipId });
      }
      if (clipKind(H2SProject, selectedClip) === 'audio'){
        return Object.assign({}, resultBase, { reason: 'audio_clip_not_supported' });
      }
      const selectedScore = selectedClip.score || {};
      if (!Array.isArray(selectedScore.tracks) || countNotes(selectedScore) < 1){
        return Object.assign({}, resultBase, { reason: 'selected_clip_not_editable_note_clip' });
      }

      const selectedInstance = (Array.isArray(projectV2.instances) ? projectV2.instances : []).find(function(inst){
        return inst && safeTrim(inst.id) === selectedInstanceId;
      }) || null;
      if (!selectedInstance){
        return Object.assign({}, resultBase, { reason: 'selected_instance_not_found', detail: selectedInstanceId });
      }

      if (!ArrangementPatch || typeof ArrangementPatch.validateArrangementPatchV0 !== 'function' || typeof ArrangementPatch.applyArrangementPatchV0ToProject !== 'function'){
        return Object.assign({}, resultBase, { reason: 'arrangement_patch_module_missing' });
      }
      if (!AccompanimentDraft
        || typeof AccompanimentDraft.validateAccompanimentDraftV1 !== 'function'
        || typeof AccompanimentDraft.packAccompanimentDraftV1ToArrangementPatchV0 !== 'function'
        || typeof AccompanimentDraft.createDeterministicAccompanimentDraftV1 !== 'function'){
        return Object.assign({}, resultBase, { reason: 'accompaniment_draft_module_missing' });
      }

      const bpm = isFiniteNumber(Number(projectV2.bpm)) ? Number(projectV2.bpm) : 120;
      const selectedClipSpanBeat = (selectedClip.meta && isFiniteNumber(Number(selectedClip.meta.spanBeat)))
        ? Number(selectedClip.meta.spanBeat)
        : 0;
      const timeSignature = safeTrim(selectedScore.time_signature || null) || null;
      const promptBuilt = buildPromptContext({
        goal: goal,
        userPrompt: userPrompt,
        projectV2: projectV2,
        selectedClipId: selectedClipId,
        selectedClip: selectedClip,
        selectedClipSpanBeat: selectedClipSpanBeat,
        selectedInstanceStartBeat: Number(selectedInstance.startBeat || 0),
        timeSignature: timeSignature,
        bpm: bpm,
      });
      const messages = [
        { role: 'system', content: promptBuilt.systemPrompt },
        { role: 'user', content: promptBuilt.userPrompt },
      ];
      const noteRowsTotal = countNotes(selectedScore);
      const noteRowsSent = promptBuilt.noteRowsSent;
      const requestDiagnostics = messageDiagnostics(messages, noteRowsTotal, noteRowsSent, promptBuilt.promptMode);
      const promptTrace = {
        systemPrompt: promptBuilt.systemPrompt,
        userPrompt: promptBuilt.userPrompt,
      };

      const draftContext = {
        goal: goal,
        userPrompt: userPrompt,
        projectV2: projectV2,
        selectedClipId: selectedClipId,
        selectedClipSpanBeat: selectedClipSpanBeat,
        selectedInstanceStartBeat: Number(selectedInstance.startBeat || 0),
        timeSignature: timeSignature,
        bpm: bpm,
        melodyNoteRows: Array.isArray(promptBuilt.noteTable) ? promptBuilt.noteTable : [],
      };

      function analyzeQualityForPatch(patch){
        if (!ArrangementQuality || typeof ArrangementQuality.analyzeArrangementQualityV0 !== 'function') return null;
        const melStats = melodyVelocityStats(selectedScore);
        return ArrangementQuality.analyzeArrangementQualityV0(
          projectV2,
          patch,
          {
            selectedClipSpanBeat: selectedClipSpanBeat,
            melodyMaxVelocity: melStats.maxVelocity > 0 ? melStats.maxVelocity : null,
          },
          { H2SProject: H2SProject }
        );
      }

      function packValidateAndGate(draft){
        const packed = AccompanimentDraft.packAccompanimentDraftV1ToArrangementPatchV0(projectV2, draft, draftContext, { H2SProject: H2SProject });
        if (!packed || !packed.ok || !packed.patch){
          return {
            ok: false,
            reason: 'draft_validation_failed',
            detail: compactErrors(packed && packed.errors),
            patch: packed && packed.patch ? packed.patch : null,
            draftValidation: packed && packed.draftValidation ? packed.draftValidation : null,
            qualityReport: null,
            validation: null,
            qualityBlockers: [],
          };
        }
        const patch = packed.patch;
        const validation = ArrangementPatch.validateArrangementPatchV0(projectV2, patch, { H2SProject: H2SProject });
        if (!validation || !validation.ok){
          return {
            ok: false,
            reason: 'patch_validation_failed',
            detail: compactErrors(validation && validation.errors) || 'validation_failed',
            patch: patch,
            draftValidation: packed.draftValidation || null,
            qualityReport: null,
            validation: validation || null,
            qualityBlockers: [],
          };
        }
        const qualityReport = analyzeQualityForPatch(patch);
        const blockers = blockingQualityWarnings(qualityReport);
        if (blockers.length){
          return {
            ok: false,
            reason: 'quality_gate_failed',
            detail: blockers.join('; '),
            patch: patch,
            draftValidation: packed.draftValidation || null,
            qualityReport: qualityReport,
            validation: validation,
            qualityBlockers: blockers,
          };
        }
        return {
          ok: true,
          reason: 'ok',
          detail: '',
          patch: patch,
          draftValidation: packed.draftValidation || null,
          qualityReport: qualityReport,
          validation: validation,
          qualityBlockers: [],
        };
      }

      const cloudClient = (ROOT.H2S_CLOUD_MODE && ROOT.H2S_CLOUD_LLM_CLIENT && typeof ROOT.H2S_CLOUD_LLM_CLIENT.callChatCompletions === 'function')
        ? ROOT.H2S_CLOUD_LLM_CLIENT
        : null;
      const cloudStoredCfg = (cloudClient && ROOT.H2S_LLM_CONFIG && typeof ROOT.H2S_LLM_CONFIG.loadLlmConfig === 'function')
        ? ROOT.H2S_LLM_CONFIG.loadLlmConfig()
        : null;
      const cfg = cloudClient
        ? { baseUrl: 'cloud-ai-bridge', model: 'cloud-ai', authToken: '', modelProfileId: (cloudStoredCfg && typeof cloudStoredCfg.modelProfileId === 'string' && cloudStoredCfg.modelProfileId.trim()) ? cloudStoredCfg.modelProfileId.trim() : 'auto' }
        : ((ROOT.H2S_LLM_CONFIG && typeof ROOT.H2S_LLM_CONFIG.loadLlmConfig === 'function') ? ROOT.H2S_LLM_CONFIG.loadLlmConfig() : null);
      const llmClient = cloudClient || ROOT.H2S_LLM_CLIENT;
      const llmReady = !!(cfg && safeTrim(cfg.baseUrl) && safeTrim(cfg.model)
        && llmClient && typeof llmClient.callChatCompletions === 'function' && typeof llmClient.extractJsonObject === 'function');

      let rawText = '';
      let parsedDraft = null;
      let callCount = 0;
      let finishReason = '';
      let draft = null;
      let draftSource = 'fallback';
      let fallbackReason = '';
      let draftValidation = null;

      function acceptDraftCandidate(candidate, source){
        if (!candidate || typeof candidate !== 'object') return false;
        const v = AccompanimentDraft.validateAccompanimentDraftV1(candidate, draftContext);
        draftValidation = v;
        if (v && v.ok){
          draft = candidate;
          draftSource = source;
          return true;
        }
        fallbackReason = compactErrors(v && v.errors) || 'draft_validation_failed';
        return false;
      }

      if (llmReady){
        callCount = 1;
        statusLog('arrangement_v0: llm_request_started', Object.assign({ goal: goal, output: 'accompaniment_draft_v1' }, requestDiagnostics));
        try {
          const llmRes = await llmClient.callChatCompletions(cfg, messages, { temperature: 0.2, timeoutMs: 180000 });
          rawText = (llmRes && typeof llmRes.text === 'string') ? llmRes.text : '';
          finishReason = finishReasonFromResponse(llmRes);
          parsedDraft = llmClient.extractJsonObject(rawText);
        } catch (err){
          fallbackReason = 'llm_request_failed';
        }

        if (!parsedDraft || typeof parsedDraft !== 'object'){
          fallbackReason = invalidJsonDetail(finishReason);
          const firstRawText = rawText;
          const repairMessages = buildArrangementRepairMessages('llm_no_valid_json', 'no_json_object_extracted', firstRawText);
          callCount = 2;
          statusLog('arrangement_v0: llm_repair_retry_started', { reason: 'llm_no_valid_json', output: 'accompaniment_draft_v1' });
          try {
            const retryRes = await llmClient.callChatCompletions(cfg, repairMessages, { temperature: 0.1, timeoutMs: 180000 });
            rawText = (retryRes && typeof retryRes.text === 'string') ? retryRes.text : '';
            finishReason = finishReasonFromResponse(retryRes);
            parsedDraft = llmClient.extractJsonObject(rawText);
          } catch (err){
            fallbackReason = 'llm_request_failed';
          }
          if (!acceptDraftCandidate(parsedDraft, 'llm_repair') && !fallbackReason){
            fallbackReason = invalidJsonDetail(finishReason);
          }
        } else if (!acceptDraftCandidate(parsedDraft, 'llm')){
          if (callCount < 2){
            const repairMessages = buildArrangementRepairMessages('draft_validation_failed', fallbackReason, rawText);
            callCount = 2;
            statusLog('arrangement_v0: llm_repair_retry_started', { reason: 'draft_validation_failed', output: 'accompaniment_draft_v1' });
            try {
              const retryRes = await llmClient.callChatCompletions(cfg, repairMessages, { temperature: 0.1, timeoutMs: 180000 });
              rawText = (retryRes && typeof retryRes.text === 'string') ? retryRes.text : '';
              finishReason = finishReasonFromResponse(retryRes);
              parsedDraft = llmClient.extractJsonObject(rawText);
              acceptDraftCandidate(parsedDraft, 'llm_repair');
            } catch (err){
              fallbackReason = 'llm_request_failed';
            }
          }
        }
      } else {
        fallbackReason = (!cfg || !safeTrim(cfg.baseUrl) || !safeTrim(cfg.model)) ? 'llm_config_missing' : 'llm_client_not_loaded';
      }

      if (!draft){
        draft = AccompanimentDraft.createDeterministicAccompanimentDraftV1(draftContext);
        draftSource = 'fallback';
        draftValidation = AccompanimentDraft.validateAccompanimentDraftV1(draft, draftContext);
      }

      let packedOutcome = packValidateAndGate(draft);
      if ((!packedOutcome || !packedOutcome.ok) && draftSource !== 'fallback'){
        fallbackReason = packedOutcome && safeTrim(packedOutcome.detail) ? packedOutcome.detail : (packedOutcome && packedOutcome.reason) || fallbackReason || 'packed_draft_rejected';
        draft = AccompanimentDraft.createDeterministicAccompanimentDraftV1(draftContext);
        draftSource = 'fallback';
        draftValidation = AccompanimentDraft.validateAccompanimentDraftV1(draft, draftContext);
        packedOutcome = packValidateAndGate(draft);
      }

      const patch = packedOutcome && packedOutcome.patch ? packedOutcome.patch : null;
      const validation = packedOutcome && packedOutcome.validation ? packedOutcome.validation : null;
      const qualityReport = packedOutcome && packedOutcome.qualityReport ? packedOutcome.qualityReport : null;
      const draftDebug = {
        source: draftSource,
        fallbackReason: draftSource === 'fallback' ? (fallbackReason || 'deterministic_fallback') : '',
        draftValidation: packedOutcome && packedOutcome.draftValidation ? packedOutcome.draftValidation : draftValidation,
        qualityBlockers: packedOutcome && Array.isArray(packedOutcome.qualityBlockers) ? packedOutcome.qualityBlockers.slice() : [],
      };

      if (!packedOutcome || !packedOutcome.ok){
        const reason = packedOutcome && packedOutcome.reason ? packedOutcome.reason : 'patch_validation_failed';
        return Object.assign({}, resultBase, {
          reason: reason,
          detail: packedOutcome && safeTrim(packedOutcome.detail) ? packedOutcome.detail : reason,
          arrangementOutcome: validation || null,
          llmDebug: llmDebugBlock(cfg || {}, callCount, rawText, requestDiagnostics, finishReason),
          promptTrace: promptTrace,
          rawPatch: patch,
          qualityReport: qualityReport,
          rawDraft: draft,
          draftDebug: draftDebug,
        });
      }

      const applied = ArrangementPatch.applyArrangementPatchV0ToProject(projectV2, patch, { H2SProject: H2SProject });
      if (!applied || !applied.ok || !applied.project){
        return Object.assign({}, resultBase, {
          reason: 'patch_apply_failed',
          detail: (applied && Array.isArray(applied.errors)) ? applied.errors.slice(0, 10).join('; ') : 'apply_failed',
          arrangementOutcome: applied || null,
          llmDebug: llmDebugBlock(cfg || {}, callCount, rawText, requestDiagnostics, finishReason),
          promptTrace: promptTrace,
          rawPatch: patch,
          qualityReport: qualityReport,
          rawDraft: draft,
          draftDebug: draftDebug,
        });
      }

      hooks.setProjectFromV2(applied.project);
      const s = applied.summary || {};
      const summary = {
        createdTrackIds: Array.isArray(s.createdTrackIds) ? s.createdTrackIds.slice() : [],
        createdClipIds: Array.isArray(s.createdClipIds) ? s.createdClipIds.slice() : [],
        createdInstanceIds: Array.isArray(s.createdInstanceIds) ? s.createdInstanceIds.slice() : [],
        totalNotes: Number(s.totalNotes || 0),
      };
      statusLog('arrangement_v0: applied', summary);
      return {
        ok: true,
        reason: 'ok',
        detail: '',
        arrangementOutcome: applied,
        summary: summary,
        llmDebug: {
          callCount: callCount,
          model: safeTrim(cfg && cfg.model),
          baseUrl: safeTrim(cfg && cfg.baseUrl),
          outputChars: rawText.length,
          request: requestDiagnostics,
          finishReason: safeTrim(finishReason) || undefined,
        },
        promptTrace: promptTrace,
        rawDraft: draft,
        rawPatch: patch,
        qualityReport: qualityReport,
        draftDebug: draftDebug,
      };
    }

    return {
      runArrangementV0: runArrangementV0,
    };
  }

  const API = { create: create };
  ROOT.H2SArrangementController = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : window);
