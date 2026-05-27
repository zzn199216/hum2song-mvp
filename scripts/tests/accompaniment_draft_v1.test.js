#!/usr/bin/env node
'use strict';

const path = require('path');

function assert(cond, msg){
  if (!cond) throw new Error(msg || 'assertion failed');
}

if (typeof globalThis.window === 'undefined') globalThis.window = {};

require(path.resolve(__dirname, '../../static/pianoroll/project.js'));
const H2SProject = globalThis.window.H2SProject;
const ArrangementPatch = require(path.resolve(__dirname, '../../static/pianoroll/core/arrangement_patch_v0.js'));
const ArrangementQuality = require(path.resolve(__dirname, '../../static/pianoroll/core/arrangement_quality_v0.js'));
const InstrumentManifest = require(path.resolve(__dirname, '../../static/pianoroll/core/instrument_manifest.js'));
const Draft = require(path.resolve(__dirname, '../../static/pianoroll/core/accompaniment_draft_v1.js'));

assert(H2SProject, 'H2SProject loaded');
assert(ArrangementPatch && ArrangementPatch.validateArrangementPatchV0, 'arrangement patch loaded');
assert(InstrumentManifest && InstrumentManifest.getSelectableInstrumentOptions, 'instrument manifest loaded');
assert(Draft && typeof Draft.packAccompanimentDraftV1ToArrangementPatchV0 === 'function', 'draft module loaded');

const BUILTIN_INSTRUMENT_OPTIONS = InstrumentManifest.getSelectableInstrumentOptions();

function makeProjectWithMelody(){
  const p2 = H2SProject.defaultProjectV2();
  const melodyScore = {
    version: 2,
    time_signature: '4/4',
    tracks: [{
      id: 'mel_t0',
      name: 'Melody',
      notes: [
        { id: 'm0', pitch: 64, velocity: 90, startBeat: 0, durationBeat: 1 },
        { id: 'm1', pitch: 67, velocity: 86, startBeat: 1, durationBeat: 0.75 },
        { id: 'm2', pitch: 69, velocity: 84, startBeat: 2, durationBeat: 1 },
        { id: 'm3', pitch: 72, velocity: 88, startBeat: 3, durationBeat: 1 },
        { id: 'm4', pitch: 71, velocity: 83, startBeat: 4, durationBeat: 1 },
        { id: 'm5', pitch: 67, velocity: 82, startBeat: 5, durationBeat: 1 },
        { id: 'm6', pitch: 64, velocity: 86, startBeat: 6, durationBeat: 1 },
        { id: 'm7', pitch: 62, velocity: 80, startBeat: 7, durationBeat: 1 },
      ],
    }],
  };
  const melodyClip = H2SProject.createClipFromScoreBeat(melodyScore, { id: 'clip_melody', name: 'Melody' });
  p2.clips[melodyClip.id] = melodyClip;
  p2.clipOrder.push(melodyClip.id);
  const melodyInst = H2SProject.createInstanceV2(melodyClip.id, 8, p2.tracks[0].id);
  p2.instances.push(melodyInst);
  H2SProject.normalizeProjectV2(p2);
  return { p2, melodyClip, melodyInst };
}

function pack(project, draft, extra){
  const ctx = Object.assign({
    userPrompt: 'add accompaniment',
    selectedClipSpanBeat: 8,
    selectedInstanceStartBeat: 8,
    melodyNoteRows: [
      { pitch: 64, startBeat: 0, durationBeat: 1 },
      { pitch: 67, startBeat: 1, durationBeat: 1 },
      { pitch: 69, startBeat: 2, durationBeat: 1 },
    ],
  }, extra || {});
  return Draft.packAccompanimentDraftV1ToArrangementPatchV0(project, draft, ctx, { H2SProject });
}

function flattenPatchNotes(patch){
  const notes = [];
  for (const op of patch.ops || []){
    if (!op || op.op !== 'createClip') continue;
    const tracks = op.scoreBeat && Array.isArray(op.scoreBeat.tracks) ? op.scoreBeat.tracks : [];
    for (const tr of tracks){
      for (const note of (tr.notes || [])) notes.push(note);
    }
  }
  return notes;
}

function assertPatchValid(project, patch){
  const validation = ArrangementPatch.validateArrangementPatchV0(project, patch, { H2SProject });
  assert(validation && validation.ok, 'packed patch must validate: ' + ((validation && validation.errors || []).join('; ')));
}

function createTrackOps(patch){
  return (patch && Array.isArray(patch.ops) ? patch.ops : []).filter((op) => op && op.op === 'createTrack');
}

function createClipOps(patch){
  return (patch && Array.isArray(patch.ops) ? patch.ops : []).filter((op) => op && op.op === 'createClip');
}

function instrumentsFromPatch(patch){
  return createTrackOps(patch).map((op) => String(op.instrument || ''));
}

function hasErrorPrefix(validation, prefix){
  return !!(validation && validation.errors || []).some((err) => String(err).indexOf(prefix) === 0);
}

function validateDraft(draft, spanBeat, userPrompt){
  return Draft.validateAccompanimentDraftV1(draft, {
    userPrompt: userPrompt || 'add accompaniment',
    selectedClipSpanBeat: spanBeat,
  });
}

function makeBassDraftEndingAt(spanBeat, endBeat){
  const notes = [];
  for (let t = 0; t < spanBeat - 0.001; t += 2){
    notes.push({
      startBeat: Number(t.toFixed(3)),
      pitch: 40 + ((Math.floor(t / 2) % 4) * 2),
      durationBeat: 1,
      velocity: 68,
    });
  }
  const tailStart = Math.max(0, Math.min(spanBeat - 0.001, endBeat - 0.25));
  notes.push({
    startBeat: Number(tailStart.toFixed(3)),
    pitch: 36,
    durationBeat: Number((endBeat - tailStart).toFixed(3)),
    velocity: 70,
  });
  return {
    version: 1,
    intent: 'bass',
    style: 'test',
    parts: [{ type: 'bass', instrument: 'bass', notes }],
  };
}

function makeDrumDraftEndingAt(spanBeat, endBeat){
  const hits = [];
  const step = spanBeat >= 6 ? 0.5 : 1;
  for (let t = 0; t < spanBeat - 0.001; t += step){
    hits.push({
      startBeat: Number(t.toFixed(3)),
      drum: 'hat',
      durationBeat: 0.125,
      velocity: 46,
    });
  }
  const tailStart = Math.max(0, Math.min(spanBeat - 0.001, endBeat - 0.25));
  hits.push({
    startBeat: Number(tailStart.toFixed(3)),
    drum: 'crash',
    durationBeat: Number((endBeat - tailStart).toFixed(3)),
    velocity: 70,
  });
  return {
    version: 1,
    intent: 'drums',
    style: 'test',
    parts: [{ type: 'drums', instrument: 'drums', hits }],
  };
}

async function main(){
  {
    assert(typeof Draft.createAccompanimentRolePlan === 'function', 'role planner exported');
    assert(typeof Draft.resolveAccompanimentInstrument === 'function', 'instrument resolver exported');

    const guitarPlan = Draft.createAccompanimentRolePlan({ userPrompt: '\u751f\u6210\u4e00\u6bb5\u5409\u4ed6\u4f34\u594f' });
    assert(guitarPlan.requestedRoles.includes('guitar'), 'Chinese guitar prompt maps to guitar role');
    assert(guitarPlan.requestedPartCount === 1, 'guitar prompt asks for one part');
    assert(guitarPlan.patternRole === 'riff', 'guitar prompt uses riff/chord-style pattern role');
    const guitarInst = Draft.resolveAccompanimentInstrument(guitarPlan, { instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(guitarInst.usedInstrument === 'sampler:tonejs:guitar-acoustic', 'guitar maps to sampled acoustic guitar');

    const electricPlan = Draft.createAccompanimentRolePlan({ userPrompt: '\u52a0\u7535\u5409\u4ed6\u4f34\u594f' });
    const electricInst = Draft.resolveAccompanimentInstrument(electricPlan, { instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(electricInst.usedInstrument === 'sampler:tonejs:guitar-electric', 'electric guitar maps to sampled electric guitar');

    const pianoPlan = Draft.createAccompanimentRolePlan({ userPrompt: '\u52a0\u94a2\u7434\u4f34\u594f' });
    const pianoInst = Draft.resolveAccompanimentInstrument(pianoPlan, { instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(pianoPlan.requestedRoles.includes('piano'), 'Chinese piano prompt maps to piano role');
    assert(pianoInst.usedInstrument === 'default' || pianoInst.usedInstrument === 'sampler:tonejs:piano', 'piano maps to available piano/default');

    const arpeggioPlan = Draft.createAccompanimentRolePlan({ userPrompt: '\u52a0\u5206\u89e3\u548c\u5f26' });
    const arpeggioInst = Draft.resolveAccompanimentInstrument(arpeggioPlan, { instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(arpeggioPlan.requestedRoles.includes('arpeggio'), 'arpeggio prompt maps to arpeggio role');
    assert(arpeggioPlan.patternRole === 'arpeggio', 'arpeggio prompt keeps arpeggio pattern role');
    assert(arpeggioInst.usedInstrument === 'default' || arpeggioInst.usedInstrument === 'sampler:tonejs:piano', 'arpeggio maps to piano/default');

    const stringsPlan = Draft.createAccompanimentRolePlan({ userPrompt: '\u52a0\u5f26\u4e50\u4f34\u594f' });
    const stringsInst = Draft.resolveAccompanimentInstrument(stringsPlan, { instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(stringsPlan.requestedRoles.includes('strings'), 'strings prompt maps to strings role');
    assert(stringsInst.usedInstrument === 'sampler:tonejs:strings', 'strings maps to sampled strings');

    const noGuitarOptions = BUILTIN_INSTRUMENT_OPTIONS.filter((opt) => String(opt.value).indexOf('guitar') < 0);
    const noGuitar = Draft.resolveAccompanimentInstrument(guitarPlan, { instrumentOptions: noGuitarOptions });
    assert(noGuitar.usedInstrument === 'default', 'unavailable guitar falls back to default');
    assert(noGuitar.fallbackReason, 'unavailable guitar records fallbackReason');

    const rhythmPlan = Draft.createAccompanimentRolePlan({ userPrompt: '\u52a0 bass \u548c\u9f13\u70b9' });
    assert(rhythmPlan.requestedRoles.includes('bass') && rhythmPlan.requestedRoles.includes('drums'), 'bass plus drums prompt keeps both roles');
    assert(rhythmPlan.requestedPartCount === 2, 'bass plus drums asks for two parts');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const draft = {
      version: 1,
      intent: 'bass',
      style: 'simple',
      parts: [{
        type: 'bass',
        instrument: 'bass',
        notes: [
          { startBeat: 0, pitch: 40, durationBeat: 1, velocity: 72 },
          { startBeat: 1, pitch: 43, durationBeat: 1, velocity: 70 },
          { startBeat: 2, pitch: 45, durationBeat: 1, velocity: 68 },
          { startBeat: 3, pitch: 43, durationBeat: 1, velocity: 68 },
          { startBeat: 4, pitch: 40, durationBeat: 1, velocity: 72 },
          { startBeat: 5, pitch: 43, durationBeat: 1, velocity: 70 },
          { startBeat: 6, pitch: 45, durationBeat: 1, velocity: 68 },
          { startBeat: 7, pitch: 43, durationBeat: 1, velocity: 68 },
        ],
      }],
    };
    const res = pack(p2, draft, { userPrompt: 'add bass' });
    assert(res.ok === true, 'valid bass draft packs');
    assertPatchValid(p2, res.patch);
    assert(res.patch.ops.filter((op) => op.op === 'createTrack').length === 1, 'bass creates one track');
    assert(flattenPatchNotes(res.patch).every((note) => note.id), 'generated bass notes all have ids');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const draft = {
      version: 1,
      intent: 'drums',
      style: 'pop',
      parts: [{
        type: 'drums',
        instrument: 'drums',
        hits: [
          { startBeat: 0, drum: 'kick', durationBeat: 0.25, velocity: 80 },
          { startBeat: 0.5, drum: 'hat', durationBeat: 0.25, velocity: 48 },
          { startBeat: 1, drum: 'snare', durationBeat: 0.25, velocity: 74 },
          { startBeat: 1.5, drum: 'hat', durationBeat: 0.25, velocity: 48 },
          { startBeat: 2, drum: 'kick', durationBeat: 0.25, velocity: 78 },
          { startBeat: 2.5, drum: 'hat', durationBeat: 0.25, velocity: 46 },
          { startBeat: 3, drum: 'snare', durationBeat: 0.25, velocity: 74 },
          { startBeat: 3.5, drum: 'hat', durationBeat: 0.25, velocity: 46 },
          { startBeat: 4, drum: 'kick', durationBeat: 0.25, velocity: 80 },
          { startBeat: 4.5, drum: 'hat', durationBeat: 0.25, velocity: 48 },
          { startBeat: 5, drum: 'snare', durationBeat: 0.25, velocity: 74 },
          { startBeat: 5.5, drum: 'hat', durationBeat: 0.25, velocity: 48 },
          { startBeat: 6, drum: 'kick', durationBeat: 0.25, velocity: 78 },
          { startBeat: 6.5, drum: 'hat', durationBeat: 0.25, velocity: 46 },
          { startBeat: 7, drum: 'snare', durationBeat: 0.25, velocity: 74 },
          { startBeat: 7.5, drum: 'hat', durationBeat: 0.25, velocity: 46 },
        ],
      }],
    };
    const res = pack(p2, draft, { userPrompt: 'add drums' });
    assert(res.ok === true, 'valid drums draft packs');
    assertPatchValid(p2, res.patch);
    const notes = flattenPatchNotes(res.patch);
    assert(notes.some((note) => note.pitch === 36), 'kick mapped to stable pitch');
    assert(notes.some((note) => note.pitch === 38), 'snare mapped to stable pitch');
    assert(notes.some((note) => note.pitch === 42), 'hat mapped to stable pitch');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: 'add accompaniment',
      selectedClipSpanBeat: 8,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }, { pitch: 69 }],
    });
    const res = pack(p2, draft, { userPrompt: 'add accompaniment' });
    assert(res.ok === true, 'deterministic generic accompaniment packs');
    assertPatchValid(p2, res.patch);
    assert(createTrackOps(res.patch).length === 1, 'generic fallback creates one accompaniment track');
    assert(instrumentsFromPatch(res.patch).every((instr) => instr !== 'bass' && instr !== 'drum'), 'generic fallback does not silently create bass/drums');
    assert(flattenPatchNotes(res.patch).every((note) => note.id), 'generated generic notes all have ids');
    const trackIds = new Set();
    const clipIds = new Set();
    const instanceIds = new Set();
    for (const op of res.patch.ops || []){
      if (op.op === 'createTrack'){
        assert(!trackIds.has(op.trackId), 'track id unique');
        trackIds.add(op.trackId);
      }
      if (op.op === 'createClip'){
        assert(!clipIds.has(op.clipId), 'clip id unique');
        clipIds.add(op.clipId);
      }
      if (op.op === 'addInstance'){
        assert(!instanceIds.has(op.instanceId), 'instance id unique');
        instanceIds.add(op.instanceId);
      }
    }
    const createdClipIds = new Set(res.patch.ops.filter((op) => op.op === 'createClip').map((op) => op.clipId));
    for (const op of res.patch.ops.filter((op) => op.op === 'addInstance')){
      assert(createdClipIds.has(op.clipId), 'addInstance.clipId is not dangling');
    }
  }

  {
    const { p2 } = makeProjectWithMelody();
    p2.clips.clip_acc_1 = { id: 'clip_acc_1', name: 'Existing' };
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: 'add bass',
      selectedClipSpanBeat: 8,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }],
    });
    const res = pack(p2, draft, { userPrompt: 'add bass' });
    assert(res.ok === true, 'existing clip id collision avoided');
    const clipIds = res.patch.ops.filter((op) => op.op === 'createClip').map((op) => op.clipId);
    assert(!clipIds.includes('clip_acc_1'), 'packer does not collide with existing clip id');
  }

  {
    const badSeconds = {
      version: 1,
      intent: 'bass',
      parts: [{ type: 'bass', notes: [{ startBeat: 0, startSec: 0, pitch: 40, durationBeat: 1, velocity: 70 }] }],
    };
    const validation = Draft.validateAccompanimentDraftV1(badSeconds, { userPrompt: 'add bass', selectedClipSpanBeat: 8 });
    assert(validation.ok === false, 'seconds fields rejected');
    assert(validation.errors.some((e) => e.indexOf('seconds_fields_forbidden') >= 0), 'seconds error code');

    const badPitch = {
      version: 1,
      intent: 'bass',
      parts: [{ type: 'bass', notes: [{ startBeat: 0, pitch: 150, durationBeat: 1, velocity: 70 }] }],
    };
    const invalidPitch = Draft.validateAccompanimentDraftV1(badPitch, { userPrompt: 'add bass', selectedClipSpanBeat: 8 });
    assert(invalidPitch.ok === false, 'invalid pitch rejected');
  }

  {
    const sparse = {
      version: 1,
      intent: 'bass',
      parts: [{ type: 'bass', notes: [{ startBeat: 0, pitch: 40, durationBeat: 1, velocity: 70 }] }],
    };
    const validation = Draft.validateAccompanimentDraftV1(sparse, { userPrompt: 'add bass', selectedClipSpanBeat: 16 });
    assert(validation.ok === false, 'one-note long bass draft rejected');
    assert(validation.errors.some((e) => e.indexOf('too_few_bass_notes') >= 0 || e.indexOf('short_coverage') >= 0), 'sparse draft quality code');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: '\u751f\u6210\u4e00\u6bb5\u5409\u4ed6\u4f34\u594f',
      selectedClipSpanBeat: 8,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }, { pitch: 69 }],
      instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS,
    });
    const validation = validateDraft(draft, 8, '\u751f\u6210\u4e00\u6bb5\u5409\u4ed6\u4f34\u594f');
    assert(validation.ok === true, 'deterministic guitar draft validates');
    assert(draft.parts.length === 1 && draft.parts[0].type === 'harmonic', 'guitar draft is a harmonic part');
    assert(draft.parts[0].role === 'guitar', 'guitar draft keeps guitar role');
    const res = pack(p2, draft, { userPrompt: '\u751f\u6210\u4e00\u6bb5\u5409\u4ed6\u4f34\u594f', instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(res.ok === true, 'deterministic guitar accompaniment packs');
    assertPatchValid(p2, res.patch);
    assert(createTrackOps(res.patch).length === 1, 'guitar prompt creates one track');
    assert(instrumentsFromPatch(res.patch)[0] === 'sampler:tonejs:guitar-acoustic', 'guitar prompt uses sampled acoustic guitar');
    assert(createTrackOps(res.patch)[0].name.indexOf('Guitar') >= 0, 'guitar track name reflects guitar intent');
    assert(!instrumentsFromPatch(res.patch).includes('bass') && !instrumentsFromPatch(res.patch).includes('drum'), 'guitar prompt does not produce Bass + Drums');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: '\u52a0\u94a2\u7434\u4f34\u594f',
      selectedClipSpanBeat: 8,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }, { pitch: 69 }],
      instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS,
    });
    const res = pack(p2, draft, { userPrompt: '\u52a0\u94a2\u7434\u4f34\u594f', instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(res.ok === true, 'piano accompaniment packs');
    assertPatchValid(p2, res.patch);
    assert(instrumentsFromPatch(res.patch)[0] === 'default' || instrumentsFromPatch(res.patch)[0] === 'sampler:tonejs:piano', 'piano prompt uses piano/default');
    assert(createTrackOps(res.patch)[0].name.indexOf('Piano') >= 0 || createTrackOps(res.patch)[0].name.indexOf('Chord') >= 0, 'piano track name reflects piano/chord intent');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: '\u52a0\u5206\u89e3\u548c\u5f26',
      selectedClipSpanBeat: 8,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }, { pitch: 69 }],
      instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS,
    });
    const res = pack(p2, draft, { userPrompt: '\u52a0\u5206\u89e3\u548c\u5f26', instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(res.ok === true, 'arpeggio accompaniment packs');
    assertPatchValid(p2, res.patch);
    assert(draft.parts[0].role === 'arpeggio', 'arpeggio draft keeps arpeggio role');
    assert(createTrackOps(res.patch)[0].name.indexOf('Arpeggio') >= 0, 'arpeggio track name reflects arpeggio intent');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: '\u52a0\u5f26\u4e50\u4f34\u594f',
      selectedClipSpanBeat: 8,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }, { pitch: 69 }],
      instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS,
    });
    const res = pack(p2, draft, { userPrompt: '\u52a0\u5f26\u4e50\u4f34\u594f', instrumentOptions: BUILTIN_INSTRUMENT_OPTIONS });
    assert(res.ok === true, 'strings accompaniment packs');
    assertPatchValid(p2, res.patch);
    assert(instrumentsFromPatch(res.patch)[0] === 'sampler:tonejs:strings', 'strings prompt uses sampled strings');
    assert(createTrackOps(res.patch)[0].name.indexOf('Strings') >= 0, 'strings track name reflects strings intent');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const noGuitarOptions = BUILTIN_INSTRUMENT_OPTIONS.filter((opt) => String(opt.value).indexOf('guitar') < 0);
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: '\u751f\u6210\u4e00\u6bb5\u5409\u4ed6\u4f34\u594f',
      selectedClipSpanBeat: 8,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }, { pitch: 69 }],
      instrumentOptions: noGuitarOptions,
    });
    const res = pack(p2, draft, {
      userPrompt: '\u751f\u6210\u4e00\u6bb5\u5409\u4ed6\u4f34\u594f',
      instrumentOptions: noGuitarOptions,
    });
    assert(res.ok === true, 'unavailable guitar fallback packs');
    assertPatchValid(p2, res.patch);
    assert(instrumentsFromPatch(res.patch)[0] === 'default', 'unavailable guitar emits only supported default instrument');
    assert(createTrackOps(res.patch)[0].name.indexOf('Guitar-style') >= 0, 'fallback track still reflects guitar-style intent');
    assert(res.draftValidation && res.draftValidation.summary && res.draftValidation.summary.fallbackReason, 'fallback reason recorded in validation summary');
  }

  {
    assert(typeof Draft.allowedTailOverrunBeat === 'function', 'tail overrun helper exported');
    assert(Draft.allowedTailOverrunBeat(4) === 0.5, '4 beat clip allows 0.5 beat tail');
    assert(Math.abs(Draft.allowedTailOverrunBeat(36.545) - 1.82725) < 0.000001, '36.545 beat clip allows 5% tail');
    assert(Draft.allowedTailOverrunBeat(80) === 2, '80 beat clip caps tail at 2 beats');
  }

  {
    const valid = validateDraft(makeBassDraftEndingAt(4, 4.4), 4, 'add bass');
    assert(valid.ok === true, 'span 4 bass ending at 4.4 passes');

    const invalid = validateDraft(makeBassDraftEndingAt(4, 4.7), 4, 'add bass');
    assert(invalid.ok === false, 'span 4 bass ending at 4.7 fails');
    assert(hasErrorPrefix(invalid, 'draft.note.outside_selected_span'), 'excessive bass tail reports outside span');
  }

  {
    const valid = validateDraft(makeDrumDraftEndingAt(36.545, 37.5), 36.545, 'add drums');
    assert(valid.ok === true, 'span 36.545 drum ending at 37.5 passes');

    const invalid = validateDraft(makeDrumDraftEndingAt(36.545, 39.0), 36.545, 'add drums');
    assert(invalid.ok === false, 'span 36.545 drum ending at 39.0 fails');
    assert(hasErrorPrefix(invalid, 'draft.hit.outside_selected_span'), 'excessive drum tail reports outside span');
  }

  {
    const valid = validateDraft(makeBassDraftEndingAt(80, 81.9), 80, 'add bass');
    assert(valid.ok === true, 'span 80 bass ending at 81.9 passes');

    const invalid = validateDraft(makeBassDraftEndingAt(80, 82.5), 80, 'add bass');
    assert(invalid.ok === false, 'span 80 bass ending at 82.5 fails');
    assert(hasErrorPrefix(invalid, 'draft.note.outside_selected_span'), 'over capped tail reports outside span');
  }

  {
    const draft = {
      version: 1,
      intent: 'bass',
      style: 'test',
      parts: [{
        type: 'bass',
        instrument: 'bass',
        notes: [
          { startBeat: 0, pitch: 40, durationBeat: 1, velocity: 68 },
          { startBeat: 2, pitch: 43, durationBeat: 1, velocity: 68 },
          { startBeat: 4.6, pitch: 36, durationBeat: 0.1, velocity: 68 },
        ],
      }],
    };
    const validation = validateDraft(draft, 4, 'add bass');
    assert(validation.ok === false, 'event starting after allowed tail boundary fails');
    assert(hasErrorPrefix(validation, 'draft.note.outside_selected_span'), 'late event reports outside span');
  }

  {
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: 'add drums',
      intent: 'drums',
      selectedClipSpanBeat: 36.545,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }, { pitch: 69 }],
    });
    const validation = validateDraft(draft, 36.545, 'add drums');
    assert(validation.ok === true, 'fallback drums near 36.545 beat phrase end validate');
  }

  {
    const { p2 } = makeProjectWithMelody();
    const draft = Draft.createDeterministicAccompanimentDraftV1({
      userPrompt: 'add accompaniment',
      intent: 'accompaniment',
      selectedClipSpanBeat: 36.545,
      melodyNoteRows: [{ pitch: 64 }, { pitch: 67 }, { pitch: 69 }],
    });
    const res = pack(p2, draft, { selectedClipSpanBeat: 36.545, userPrompt: 'add accompaniment' });
    assert(res.ok === true, 'fallback generic harmonic accompaniment packs for 36.545 span: ' + (res.errors || []).join('; '));
    assertPatchValid(p2, res.patch);
    assert(createTrackOps(res.patch).length === 1, '36.545 generic fallback creates one track');
    assert(createClipOps(res.patch).length === 1, '36.545 generic fallback creates one clip');

    const quality = ArrangementQuality.analyzeArrangementQualityV0(p2, res.patch, {
      selectedClipSpanBeat: 36.545,
      userPrompt: 'add accompaniment',
    });
    const hardCodes = new Set(['empty_clip', 'orphan_clip', 'short_coverage', 'sparse_notes', 'overly_dense']);
    const hardWarnings = (quality.warnings || []).filter((warning) => hardCodes.has(warning && warning.code));
    assert(hardWarnings.length === 0, 'fallback generic harmonic accompaniment passes quality gates: ' + JSON.stringify(hardWarnings));
  }

  console.log('PASS accompaniment_draft_v1.test.js');
}

main().catch(function(err){
  console.error(err);
  process.exit(1);
});
