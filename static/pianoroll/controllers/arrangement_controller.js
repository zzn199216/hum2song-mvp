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

  /** Explicit default arrangement strategy (prompt-only; schema unchanged). */
  function buildAddAccompanimentV0StrategyBlock(){
    return [
      'Strategy for add_accompaniment_v0:',
      '- Default strategy: create a musically useful accompaniment, not only a minimal placeholder.',
      '- Tracks: if the user asks for bass plus drums/percussion, use two new tracks. Use one new track only when the user asks for one part or the musical idea clearly needs one.',
      '- Duration coverage: use Context JSON selectedClip.spanBeat as the target accompaniment length (beats).',
      '- Generated accompaniment should usually cover most or all of the selected melody clip.',
      '- Do not end accompaniment much earlier than the melody unless the user explicitly asks for a short fill.',
      '- Avoid leaving a large silent tail; ending slightly before or after the melody is OK.',
      '- For bass, drum, and rhythm patterns, repeat or continue the pattern until near selectedClip.spanBeat.',
      '- If creating two tracks, both should roughly cover the selected clip unless one is explicitly a short fill.',
      '- Built-in instrument ids (use these exact strings; do not invent plural ids): bass, drum, lead, pad, pluck, default. For drums/percussion use drum, not drums.',
      '- Bass: use low-register notes with a clear repeating groove. Follow strong melody beats and imply root movement; avoid only whole-clip sustained notes.',
      '- Drums: use a recognizable kick/snare/hat or percussion pattern when drum is requested. Add small variations or fills every 4-8 bars when the clip is long enough.',
      '- Use short-to-medium rhythmic notes and enough activity to feel like an accompaniment, while leaving space for the melody.',
      '- Avoid pad-only / block-chord-only output as the default.',
      '- Preserve melody as the main focus.',
      '- If adding chords/pad, keep them secondary and light.',
      '- Velocity (MIDI 1–127) for new accompaniment notes: bass often 50–72; kick/snare/main hits often 50–78; hi-hat/auxiliary hits often 35–62; pad/chords often 40–65.',
      '- Keep accompaniment velocities generally below the melody’s strongest notes (see melody note rows).',
      '- Do not rely on gainDb alone; combine moderate gainDb with sensible velocities so accompaniment stays behind the melody.',
      '- Avoid over-constraining musical choices: prefer coherent groove and variation over extreme sparsity.',
      '- Do not overpower the melody.',
      '- Do not modify/delete existing melody material.',
      '- Set createTrack gainDb so accompaniment is balanced below the melody (usually below 0 dB).',
      '- Typical gainDb: bass about -5 to -9; drums/percussion about -6 to -11; pad/chords about -8 to -14.',
      '- Do not set accompaniment gainDb above 0 dB.',
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
      'You are an arrangement generator for Hum2Song.',
      'Output exactly ONE JSON object in a single ```json code block with no other text.',
      'The JSON object MUST follow Arrangement Patch v0 for additive accompaniment only.',
      '',
      'Hard constraints:',
      '- kind must be "arrangement_patch_v0".',
      '- beats-only: never output seconds fields (no startSec/durationSec/spanSec or any *sec field).',
      '- additive-only: use only createTrack/createClip/setTrackInstrument/addInstance.',
      '- never modify or delete existing melody material.',
      '- do not reference non-existent clip/track IDs.',
      '- prefer 1-2 new tracks maximum.',
      '- keep accompaniment supportive, balanced, and musically coherent; do not default to extremely sparse placeholder parts.',
      '- generated caps: max 2 new tracks, max 4 new clips, max 8 new instances, max 256 notes total.',
      '',
      'Return only the JSON code block.',
    ].join('\n');

    const goalStr = safeTrim(input.goal || '');
    const userPromptParts = [
      'Generate Arrangement Patch v0 for goal: add_accompaniment_v0.',
      (input.userPrompt ? ('User instruction: ' + input.userPrompt) : 'User instruction: (none)'),
    ];
    if (goalStr === 'add_accompaniment_v0'){
      userPromptParts.push('', buildAddAccompanimentV0StrategyBlock());
    }
    userPromptParts.push(
      '',
      'Context compact JSON:',
      JSON.stringify(projectContext),
      '',
      'melodyNoteRowsBeatCSV:',
      formatMelodyNoteRowsCsv(noteTable),
      '',
      'Allowed operations:',
      '- Return {"kind":"arrangement_patch_v0","version":1,"ops":[...]} in one json code block.',
      '- createTrack(trackId,name,instrument,gainDb optional -30..0).',
      '- createClip(clipId,name,scoreBeat:{version:2,tracks:[{id,notes:[{id,pitch,velocity,startBeat,durationBeat}]}]}).',
      '- scoreBeat.tracks[] objects must include non-empty id; note objects must include id,pitch 0..127,velocity 1..127,startBeat >=0,durationBeat >0.',
      '- setTrackInstrument(trackId,instrument) only for newly created tracks if needed.',
      '- addInstance(instanceId,clipId,trackId,startBeat,transpose optional -48..48).',
      '- Use only new unique ids for created tracks/clips/instances/notes; avoid ids listed in compact context.',
      '- Do not include seconds fields. Do not modify or delete existing melody.',
    );
    const userPrompt = userPromptParts.join('\n');

    return { systemPrompt: systemPrompt, userPrompt: userPrompt, promptMode: 'compact', noteRowsSent: noteTable.length };
  }

  function buildArrangementRepairMessages(reason, detail, previousText){
    const repairSystem = [
      'You repair Arrangement Patch v0 JSON for Hum2Song.',
      'Output exactly ONE JSON object in a single ```json code block with no other text.',
      'No <think>, no hidden reasoning, no explanation, no prose before or after.',
    ].join('\n');
    const repairUser = [
      'Repair the previous Arrangement Patch v0 response.',
      'Previous failure: ' + (safeTrim(reason) || 'invalid_output') + (safeTrim(detail) ? (': ' + boundedText(detail, 300)) : ''),
      '',
      'Return exactly this shape:',
      '{"kind":"arrangement_patch_v0","version":1,"ops":[...]}',
      '',
      'Allowed ops only: createTrack, createClip, setTrackInstrument, addInstance.',
      'Do not modify or delete existing melody material.',
      'Use beats-only fields; do not output seconds fields.',
      'Use only valid built-in instruments such as bass, drum, lead, pad, pluck, default.',
      '',
      'Previous model response, bounded:',
      boundedText(previousText, 800),
    ].join('\n');
    return [
      { role: 'system', content: repairSystem },
      { role: 'user', content: repairUser },
    ];
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
        rawPatch: null,
        qualityReport: null,
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

      const cloudClient = (ROOT.H2S_CLOUD_MODE && ROOT.H2S_CLOUD_LLM_CLIENT && typeof ROOT.H2S_CLOUD_LLM_CLIENT.callChatCompletions === 'function')
        ? ROOT.H2S_CLOUD_LLM_CLIENT
        : null;
      const cloudStoredCfg = (cloudClient && ROOT.H2S_LLM_CONFIG && typeof ROOT.H2S_LLM_CONFIG.loadLlmConfig === 'function')
        ? ROOT.H2S_LLM_CONFIG.loadLlmConfig()
        : null;
      const cfg = cloudClient
        ? { baseUrl: 'cloud-ai-bridge', model: 'cloud-ai', authToken: '', modelProfileId: (cloudStoredCfg && typeof cloudStoredCfg.modelProfileId === 'string' && cloudStoredCfg.modelProfileId.trim()) ? cloudStoredCfg.modelProfileId.trim() : 'auto' }
        : ((ROOT.H2S_LLM_CONFIG && typeof ROOT.H2S_LLM_CONFIG.loadLlmConfig === 'function') ? ROOT.H2S_LLM_CONFIG.loadLlmConfig() : null);
      if (!cfg || !safeTrim(cfg.baseUrl) || !safeTrim(cfg.model)){
        return Object.assign({}, resultBase, { reason: 'llm_config_missing' });
      }
      const llmClient = cloudClient || ROOT.H2S_LLM_CLIENT;
      if (!llmClient || typeof llmClient.callChatCompletions !== 'function' || typeof llmClient.extractJsonObject !== 'function'){
        return Object.assign({}, resultBase, { reason: 'llm_client_not_loaded' });
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

      let rawText = '';
      let parsedPatch = null;
      let callCount = 1;
      statusLog('arrangement_v0: llm_request_started', Object.assign({ goal: goal }, requestDiagnostics));
      try {
        const llmRes = await llmClient.callChatCompletions(cfg, messages, { temperature: 0.2, timeoutMs: 180000 });
        rawText = (llmRes && typeof llmRes.text === 'string') ? llmRes.text : '';
        parsedPatch = llmClient.extractJsonObject(rawText);
      } catch (err){
        return Object.assign({}, resultBase, {
          reason: 'llm_request_failed',
          detail: (err && err.message) ? String(err.message) : 'llm_request_failed',
          llmDebug: {
            callCount: callCount,
            model: safeTrim(cfg.model),
            baseUrl: safeTrim(cfg.baseUrl),
            request: requestDiagnostics,
          },
          promptTrace: promptTrace,
        });
      }

      if (!parsedPatch || typeof parsedPatch !== 'object'){
        const firstRawText = rawText;
        const repairMessages = buildArrangementRepairMessages('llm_no_valid_json', 'no_json_object_extracted', firstRawText);
        callCount = 2;
        statusLog('arrangement_v0: llm_repair_retry_started', { reason: 'llm_no_valid_json' });
        try {
          const retryRes = await llmClient.callChatCompletions(cfg, repairMessages, { temperature: 0.1, timeoutMs: 180000 });
          rawText = (retryRes && typeof retryRes.text === 'string') ? retryRes.text : '';
          parsedPatch = llmClient.extractJsonObject(rawText);
        } catch (err){
          return Object.assign({}, resultBase, {
            reason: 'llm_request_failed',
            detail: (err && err.message) ? String(err.message) : 'llm_request_failed',
            llmDebug: {
              callCount: callCount,
              model: safeTrim(cfg.model),
              baseUrl: safeTrim(cfg.baseUrl),
              request: requestDiagnostics,
            },
            promptTrace: promptTrace,
          });
        }
        if (!parsedPatch || typeof parsedPatch !== 'object'){
          return Object.assign({}, resultBase, {
            reason: 'llm_no_valid_json',
            detail: 'no_json_object_extracted',
            llmDebug: { callCount: callCount, model: safeTrim(cfg.model), baseUrl: safeTrim(cfg.baseUrl), outputChars: rawText.length, request: requestDiagnostics },
            promptTrace: promptTrace,
          });
        }
      }

      let patch = parsedPatch;
      let validation = ArrangementPatch.validateArrangementPatchV0(projectV2, patch, { H2SProject: H2SProject });

      let qualityReport = null;
      if (validation && validation.ok && ArrangementQuality && typeof ArrangementQuality.analyzeArrangementQualityV0 === 'function'){
        const melStats = melodyVelocityStats(selectedScore);
        qualityReport = ArrangementQuality.analyzeArrangementQualityV0(
          projectV2,
          patch,
          {
            selectedClipSpanBeat: selectedClipSpanBeat,
            melodyMaxVelocity: melStats.maxVelocity > 0 ? melStats.maxVelocity : null,
          },
          { H2SProject: H2SProject }
        );
      }

      if (!validation || !validation.ok){
        if (callCount < 2){
          const detail = (validation && Array.isArray(validation.errors)) ? validation.errors.slice(0, 10).join('; ') : 'validation_failed';
          const repairMessages = buildArrangementRepairMessages('patch_validation_failed', detail, rawText);
          callCount = 2;
          statusLog('arrangement_v0: llm_repair_retry_started', { reason: 'patch_validation_failed' });
          try {
            const retryRes = await llmClient.callChatCompletions(cfg, repairMessages, { temperature: 0.1, timeoutMs: 180000 });
            rawText = (retryRes && typeof retryRes.text === 'string') ? retryRes.text : '';
            parsedPatch = llmClient.extractJsonObject(rawText);
          } catch (err){
            return Object.assign({}, resultBase, {
              reason: 'llm_request_failed',
              detail: (err && err.message) ? String(err.message) : 'llm_request_failed',
              llmDebug: {
                callCount: callCount,
                model: safeTrim(cfg.model),
                baseUrl: safeTrim(cfg.baseUrl),
                request: requestDiagnostics,
              },
              promptTrace: promptTrace,
            });
          }
          if (!parsedPatch || typeof parsedPatch !== 'object'){
            return Object.assign({}, resultBase, {
              reason: 'llm_no_valid_json',
              detail: 'no_json_object_extracted',
              llmDebug: { callCount: callCount, model: safeTrim(cfg.model), baseUrl: safeTrim(cfg.baseUrl), outputChars: rawText.length, request: requestDiagnostics },
              promptTrace: promptTrace,
            });
          }
          patch = parsedPatch;
          validation = ArrangementPatch.validateArrangementPatchV0(projectV2, patch, { H2SProject: H2SProject });
          qualityReport = null;
          if (validation && validation.ok && ArrangementQuality && typeof ArrangementQuality.analyzeArrangementQualityV0 === 'function'){
            const melStats = melodyVelocityStats(selectedScore);
            qualityReport = ArrangementQuality.analyzeArrangementQualityV0(
              projectV2,
              patch,
              {
                selectedClipSpanBeat: selectedClipSpanBeat,
                melodyMaxVelocity: melStats.maxVelocity > 0 ? melStats.maxVelocity : null,
              },
              { H2SProject: H2SProject }
            );
          }
        }
      }

      if (!validation || !validation.ok){
        return Object.assign({}, resultBase, {
          reason: 'patch_validation_failed',
          detail: (validation && Array.isArray(validation.errors)) ? validation.errors.slice(0, 10).join('; ') : 'validation_failed',
          arrangementOutcome: validation || null,
          llmDebug: { callCount: callCount, model: safeTrim(cfg.model), baseUrl: safeTrim(cfg.baseUrl), outputChars: rawText.length, request: requestDiagnostics },
          promptTrace: promptTrace,
          rawPatch: patch,
          qualityReport: qualityReport,
        });
      }

      const applied = ArrangementPatch.applyArrangementPatchV0ToProject(projectV2, patch, { H2SProject: H2SProject });
      if (!applied || !applied.ok || !applied.project){
        return Object.assign({}, resultBase, {
          reason: 'patch_apply_failed',
          detail: (applied && Array.isArray(applied.errors)) ? applied.errors.slice(0, 10).join('; ') : 'apply_failed',
          arrangementOutcome: applied || null,
          llmDebug: { callCount: callCount, model: safeTrim(cfg.model), baseUrl: safeTrim(cfg.baseUrl), outputChars: rawText.length, request: requestDiagnostics },
          promptTrace: promptTrace,
          rawPatch: patch,
          qualityReport: qualityReport,
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
          model: safeTrim(cfg.model),
          baseUrl: safeTrim(cfg.baseUrl),
          outputChars: rawText.length,
          request: requestDiagnostics,
        },
        promptTrace: promptTrace,
        rawPatch: patch,
        qualityReport: qualityReport,
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
