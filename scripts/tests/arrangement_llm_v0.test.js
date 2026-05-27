#!/usr/bin/env node
'use strict';

const path = require('path');

function assert(cond, msg){
  if (!cond) throw new Error(msg || 'assertion failed');
}

if (typeof globalThis.window === 'undefined') globalThis.window = {};

require(path.resolve(__dirname, '../../static/pianoroll/project.js'));
const H2SProject = globalThis.window.H2SProject;
require(path.resolve(__dirname, '../../static/pianoroll/core/arrangement_patch_v0.js'));
const ArrangementPatch = require(path.resolve(__dirname, '../../static/pianoroll/core/arrangement_patch_v0.js'));
const ArrangementController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/arrangement_controller.js'));

assert(H2SProject, 'H2SProject loaded');
assert(ArrangementPatch && ArrangementPatch.applyArrangementPatchV0ToProject, 'arrangement patch loaded');
assert(ArrangementController && ArrangementController.create, 'arrangement controller loaded');

function makeProjectWithMelody(options){
  const opts = options && typeof options === 'object' ? options : {};
  const hasExplicitNoteCount = Object.prototype.hasOwnProperty.call(opts, 'noteCount');
  const noteCount = hasExplicitNoteCount && Number.isFinite(Number(opts.noteCount)) ? Math.max(1, Math.floor(Number(opts.noteCount))) : 8;
  const p2 = H2SProject.defaultProjectV2();
  let notes = [];
  if (!hasExplicitNoteCount){
    const pitches = [64, 67, 69, 72, 71, 67, 64, 62];
    for (let i = 0; i < pitches.length; i++){
      notes.push({ id: 'm' + i, pitch: pitches[i], velocity: 82 + (i % 4), startBeat: i, durationBeat: 1 });
    }
  } else {
    notes = [];
    for (let i = 0; i < noteCount; i++){
      notes.push({
        id: 'm' + i,
        pitch: 60 + (i % 12),
        velocity: 68 + (i % 24),
        startBeat: Math.round(i * 0.25 * 1000) / 1000,
        durationBeat: (i % 4 === 0) ? 0.5 : 0.25,
      });
    }
  }
  const melodyScore = {
    version: 2,
    time_signature: '4/4',
    tracks: [{
      id: 'mel_t0',
      name: 'Melody',
      notes: notes,
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

function makeControllerHarness(seed){
  let project = seed.project;
  let commitCount = 0;
  let selectedClipId = seed.selectedClipId;
  let selectedInstanceId = seed.selectedInstanceId;
  const logs = [];
  const ctrl = ArrangementController.create({
    getProjectV2: () => project,
    setProjectFromV2: (next) => { commitCount += 1; project = next; },
    getSelectedClipId: () => selectedClipId,
    getSelectedInstanceId: () => selectedInstanceId,
    log: (m, d) => logs.push({ m, d }),
    H2SProject,
  });
  return {
    ctrl,
    getProject: () => project,
    getCommitCount: () => commitCount,
    setSelectedClipId: (v) => { selectedClipId = v; },
    setSelectedInstanceId: (v) => { selectedInstanceId = v; },
    logs,
  };
}

function setMockLlm(mock){
  globalThis.H2S_CLOUD_MODE = false;
  globalThis.H2S_CLOUD_LLM_CLIENT = null;
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({
      baseUrl: mock.baseUrl || 'https://unit.test/v1',
      model: mock.model || 'unit-model',
      authToken: mock.authToken || 'secret-token',
    }),
  };
  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: mock.callChatCompletions,
    extractJsonObject: mock.extractJsonObject,
  };
}

function setMockCloudLlm(mock){
  globalThis.H2S_CLOUD_MODE = true;
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({
      baseUrl: '',
      model: '',
      authToken: 'LOCAL_TOKEN_SHOULD_NOT_BE_USED',
      modelProfileId: mock.modelProfileId || 'qwen36_plus',
    }),
  };
  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => { throw new Error('local_llm_should_not_be_used'); },
    extractJsonObject: () => null,
  };
  globalThis.H2S_CLOUD_LLM_CLIENT = {
    callChatCompletions: mock.callChatCompletions,
    extractJsonObject: mock.extractJsonObject,
  };
}

function makeValidAccompanimentPatch(){
  return {
    kind: 'arrangement_patch_v0',
    version: 1,
    ops: [
      { op: 'createTrack', trackId: 'trk_acc_retry', name: 'Accompaniment', instrument: 'bass' },
      {
        op: 'createClip',
        clipId: 'clip_acc_retry',
        name: 'Accompaniment Clip',
        scoreBeat: {
          version: 2,
          time_signature: '4/4',
          tracks: [{ id: 'acc_retry_t0', notes: [{ id: 'r0', pitch: 48, velocity: 64, startBeat: 0, durationBeat: 1 }] }],
        },
      },
      { op: 'addInstance', instanceId: 'inst_acc_retry', clipId: 'clip_acc_retry', trackId: 'trk_acc_retry', startBeat: 8 },
    ],
  };
}

function makeBassDraft(spanBeat){
  const span = Number.isFinite(Number(spanBeat)) ? Number(spanBeat) : 8;
  const notes = [];
  for (let beat = 0; beat < span; beat += 1){
    notes.push({
      startBeat: beat,
      pitch: 40 + ((beat % 4 === 2) ? 7 : 0),
      durationBeat: Math.min(0.9, span - beat),
      velocity: 68,
    });
  }
  return {
    version: 1,
    intent: 'bass',
    style: 'simple',
    parts: [{ type: 'bass', instrument: 'bass', notes }],
  };
}

function makeBassDrumsDraft(spanBeat){
  const span = Number.isFinite(Number(spanBeat)) ? Number(spanBeat) : 8;
  const bass = makeBassDraft(span).parts[0];
  const hits = [];
  for (let beat = 0; beat < span; beat += 0.5){
    hits.push({ startBeat: beat, drum: 'hat', durationBeat: 0.25, velocity: 46 });
  }
  for (let beat = 0; beat < span; beat += 1){
    const mod = beat % 4;
    if (mod === 0 || mod === 2) hits.push({ startBeat: beat, drum: 'kick', durationBeat: 0.25, velocity: 76 });
    if (mod === 1 || mod === 3) hits.push({ startBeat: beat, drum: 'snare', durationBeat: 0.25, velocity: 72 });
  }
  return {
    version: 1,
    intent: 'bass_drums',
    style: 'simple',
    parts: [bass, { type: 'drums', instrument: 'drums', hits }],
  };
}

function createdInstruments(patch){
  return (patch && Array.isArray(patch.ops) ? patch.ops : [])
    .filter((op) => op && op.op === 'createTrack')
    .map((op) => String(op.instrument || ''));
}

function createdNotes(patch){
  const out = [];
  for (const op of (patch && patch.ops) || []){
    if (!op || op.op !== 'createClip') continue;
    const tracks = op.scoreBeat && Array.isArray(op.scoreBeat.tracks) ? op.scoreBeat.tracks : [];
    for (const tr of tracks){
      for (const note of (tr.notes || [])) out.push(note);
    }
  }
  return out;
}

async function testValidDraftOneCommit(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const draft = makeBassDraft(8);
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: '```json\n' + JSON.stringify(draft) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });

  const beforeMelody = JSON.stringify(p2.clips[melodyClip.id].score);
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add soft pad' });
  assert(res.ok === true, 'valid draft should succeed');
  assert(harness.getCommitCount() === 1, 'should commit once');
  assert(llmCalls === 1, 'one llm call by default');
  assert(Array.isArray(res.summary.createdTrackIds) && res.summary.createdTrackIds.length === 1, 'summary track ids');
  assert(res.rawDraft && res.rawDraft.version === 1, 'raw draft returned');
  assert(res.rawPatch && res.rawPatch.kind === 'arrangement_patch_v0', 'draft packed into arrangement patch');
  assert(createdNotes(res.rawPatch).every((note) => note.id), 'packer generated note ids');
  assert(res.qualityReport && res.qualityReport.ok === true, 'quality report present on success');
  assert(Array.isArray(res.qualityReport.warnings) && res.qualityReport.warnings.length === 0, 'baseline patch has no quality warnings');
  assert(JSON.stringify(harness.getProject().clips[melodyClip.id].score) === beforeMelody, 'melody clip remains unchanged');
}

async function testInvalidDraftFallsBackAndCommits(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const invalidDraft = { version: 1, intent: 'bass', parts: [{ type: 'bass', notes: [{ startBeat: 0, pitch: 40, durationBeat: 1, velocity: 70, trackId: 'bad' }] }] };
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: '```json\n' + JSON.stringify(invalidDraft) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'invalid draft falls back instead of failing');
  assert(harness.getCommitCount() === 1, 'fallback commits once');
  assert(llmCalls === 2, 'invalid draft gets one bounded repair retry before fallback');
  assert(res.draftDebug && res.draftDebug.source === 'fallback', 'fallback source reported');
  assert(createdNotes(res.rawPatch).length >= 4, 'fallback has enough bass notes');
}

async function testMalformedNoJsonFallsBackAndCommits(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: 'nonsense output' };
    },
    extractJsonObject: () => null,
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add accompaniment' });
  assert(res.ok === true, 'no json falls back instead of failing');
  assert(harness.getCommitCount() === 1, 'fallback commits when malformed');
  assert(llmCalls === 2, 'malformed output should get one bounded repair retry');
  assert(res.llmDebug && res.llmDebug.callCount === 2, 'debug call count includes repair retry');
  assert(res.draftDebug && res.draftDebug.source === 'fallback', 'fallback source reported');
  assert(createdInstruments(res.rawPatch).includes('bass'), 'generic fallback includes bass');
  assert(createdInstruments(res.rawPatch).includes('drum'), 'generic fallback includes drums');
}

async function testFallbackDrumsAllowsBoundedTailAtConvertedSpan(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody({ noteCount: 252 });
  p2.clips[melodyClip.id].meta = Object.assign({}, p2.clips[melodyClip.id].meta || {}, { spanBeat: 36.545 });
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: 'prose without a json draft' };
    },
    extractJsonObject: () => null,
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add drums' });
  assert(res.ok === true, '36.545 beat fallback drums should apply with bounded musical tails');
  assert(harness.getCommitCount() === 1, 'fallback commits once for 36.545 span');
  assert(llmCalls === 2, 'malformed output still gets one repair retry');
  assert(res.draftDebug && res.draftDebug.source === 'fallback', 'fallback source reported for 36.545 span');
  assert(JSON.stringify(res).indexOf('outside_selected_span') < 0, 'bounded fallback tail must not report outside_selected_span');
  const maxEnd = createdNotes(res.rawPatch).reduce((acc, note) => {
    const start = Number(note && note.startBeat);
    const dur = Number(note && note.durationBeat);
    if (!Number.isFinite(start) || !Number.isFinite(dur)) return acc;
    return Math.max(acc, start + dur);
  }, 0);
  assert(maxEnd <= 36.545 + 1.82725 + 0.001, 'fallback notes stay inside allowed tail boundary');
}

async function testMalformedLengthFinishReasonIsDiagnostic(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: '<think>reasoning consumed the response budget', raw: { choices: [{ finish_reason: 'length' }] } };
    },
    extractJsonObject: () => null,
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add drums' });
  assert(res.ok === true, 'length-truncated malformed output falls back');
  assert(res.reason === 'ok', 'fallback success is not a hard no_json failure');
  assert(res.llmDebug && res.llmDebug.finishReason === 'length', 'llmDebug includes finishReason');
  assert(llmCalls === 2, 'length-truncated malformed output still gets one repair retry');
  assert(res.draftDebug && res.draftDebug.fallbackReason === 'finish_reason_length', 'fallback reason keeps length diagnostic');
}

async function testMalformedNoJsonRepairRetryCanCommit(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const draft = makeBassDraft(8);
  const calls = [];
  setMockLlm({
    callChatCompletions: async (_cfg, messages) => {
      llmCalls += 1;
      calls.push(messages);
      if (llmCalls === 1) return { text: 'I can add a bass line, but here is a prose answer instead.' };
      return { text: '```json\n' + JSON.stringify(draft) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'repair retry should apply valid accompaniment draft');
  assert(harness.getCommitCount() === 1, 'repair retry commits once');
  assert(llmCalls === 2, 'one repair retry');
  assert(res.llmDebug && res.llmDebug.callCount === 2, 'debug call count includes both attempts');
  assert(Array.isArray(calls[1]) && calls[1].length === 2, 'repair retry sends system + user only');
  assert(String(calls[1][1].content || '').indexOf('Repair the previous AccompanimentDraft v1 response') >= 0, 'draft repair instruction included');
  assert(String(calls[1][1].content || '').length < 1800, 'repair prompt stays bounded');
}

async function testInvalidDraftRepairRetryCanCommit(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const invalidDraft = { version: 1, intent: 'bass', parts: [{ type: 'bass', notes: [{ startBeat: 0, pitch: 40, durationBeat: 1, velocity: 70, clipId: 'bad' }] }] };
  const draft = makeBassDraft(8);
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      const body = llmCalls === 1 ? invalidDraft : draft;
      return { text: '```json\n' + JSON.stringify(body) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'invalid first draft can be repaired');
  assert(harness.getCommitCount() === 1, 'validation repair commits once');
  assert(llmCalls === 2, 'one validation repair retry');
  assert(res.llmDebug && res.llmDebug.callCount === 2, 'debug call count includes validation retry');
  assert(res.draftDebug && res.draftDebug.source === 'llm_repair', 'valid repair draft source reported');
}

async function testProjectIdsInDraftFallBackToGeneratedPatchIds(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const invalidDraft = {
    version: 1,
    intent: 'bass',
    parts: [{ type: 'bass', notes: [{ id: 'bad_note_id', startBeat: 0, pitch: 40, durationBeat: 1, velocity: 70 }] }],
  };
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: '```json\n' + JSON.stringify(invalidDraft) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'project IDs in draft fall back safely');
  assert(llmCalls === 2, 'invalid ID-bearing draft gets one repair retry before fallback');
  assert(res.draftDebug && res.draftDebug.source === 'fallback', 'fallback source after forbidden draft id');
  const addInstance = res.rawPatch.ops.find((op) => op && op.op === 'addInstance');
  assert(addInstance && addInstance.instanceId, 'packer generated instanceId');
  assert(createdNotes(res.rawPatch).every((note) => note.id && note.id !== 'bad_note_id'), 'packer owns note ids');
}

async function testPackedIdsAvoidExistingCollisionsWithoutChangingMusic(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const existingClip = H2SProject.createClipFromScoreBeat({
    version: 2,
    tracks: [{ id: 'existing_t', notes: [{ id: 'existing_n', pitch: 60, velocity: 70, startBeat: 0, durationBeat: 1 }] }],
  }, { id: 'clip_bass_01', name: 'Existing Bass' });
  p2.clips[existingClip.id] = existingClip;
  p2.clipOrder.push(existingClip.id);
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const modelDraft = {
    version: 1,
    intent: 'bass',
    parts: [{
      type: 'bass',
      instrument: 'bass',
      notes: [
        { pitch: 43, velocity: 68, startBeat: 0, durationBeat: 1 },
        { pitch: 47, velocity: 66, startBeat: 1, durationBeat: 1 },
        { pitch: 43, velocity: 68, startBeat: 2, durationBeat: 1 },
        { pitch: 47, velocity: 66, startBeat: 3, durationBeat: 1 },
        { pitch: 43, velocity: 68, startBeat: 4, durationBeat: 1 },
        { pitch: 47, velocity: 66, startBeat: 5, durationBeat: 1 },
        { pitch: 43, velocity: 68, startBeat: 6, durationBeat: 1 },
        { pitch: 47, velocity: 66, startBeat: 7, durationBeat: 1 },
      ],
    }],
  };
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: '```json\n' + JSON.stringify(modelDraft) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'packer should make model draft apply');
  assert(llmCalls === 1, 'valid draft should not require repair');
  const createClip = res.rawPatch.ops.find((op) => op && op.op === 'createClip');
  const addInstance = res.rawPatch.ops.find((op) => op && op.op === 'addInstance');
  assert(createClip.clipId !== 'clip_bass_01', 'createClip id should be rewritten when it collides with existing clip');
  assert(addInstance.clipId === createClip.clipId, 'addInstance clipId should follow rewritten createClip id');
  const notes = createClip.scoreBeat.tracks[0].notes;
  assert(notes[0].id && notes[1].id && notes[0].id !== notes[1].id, 'missing note ids should be filled uniquely');
  assert(notes[0].pitch === 43 && notes[1].pitch === 47, 'normalizer must not change musical pitches');
  assert(notes[0].startBeat === 0 && notes[1].startBeat === 1, 'normalizer must not change note timing');
}

async function testSecondsDraftFallsBackToBeatsOnlyPatch(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  const draftWithSeconds = {
    version: 1,
    intent: 'bass',
    parts: [{ type: 'bass', notes: [{ pitch: 50, velocity: 70, startBeat: 0, durationBeat: 1, startSec: 0.1 }] }],
  };
  setMockLlm({
    callChatCompletions: async () => ({ text: '```json\n' + JSON.stringify(draftWithSeconds) + '\n```' }),
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'seconds draft falls back instead of hard failing');
  assert(harness.getCommitCount() === 1, 'fallback commits on seconds fields');
  assert(JSON.stringify(res.rawPatch).indexOf('startSec') < 0, 'packed fallback patch is beats-only');
  assert(res.draftDebug && res.draftDebug.source === 'fallback', 'fallback source after seconds field');
}

async function testPromptIncludesRequiredContext(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  const draft = makeBassDrumsDraft(8);
  setMockLlm({
    callChatCompletions: async () => ({ text: '```json\n' + JSON.stringify(draft) + '\n```' }),
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'simple chords' });
  assert(res.promptTrace && typeof res.promptTrace.userPrompt === 'string', 'prompt trace exists');
  const up = res.promptTrace.userPrompt;
  assert(up.indexOf('AccompanimentDraft v1') >= 0, 'draft schema named');
  assert(up.indexOf('Allowed schema JSON') < 0, 'full expanded schema omitted');
  assert(up.indexOf('Output format contract:') >= 0, 'format contract block included');
  assert(up.indexOf('Minimal valid example') < 0, 'prompt must not include concrete musical examples');
  assert(up.indexOf('"pitch":48') < 0, 'prompt must not anchor bass pitch to C2');
  assert(up.indexOf('"durationBeat":1') < 0, 'prompt must not anchor generated duration to example');
  assert(up.indexOf('"velocity":64') < 0, 'prompt must not anchor generated velocity to example');
  assert(up.indexOf('Draft object formats:') >= 0, 'format contract includes draft object formats');
  assert(up.indexOf('parts') >= 0 && up.indexOf('type') >= 0, 'draft parts documented');
  assert(up.indexOf('notes') >= 0 && up.indexOf('hits') >= 0, 'bass notes and drum hits documented');
  assert(/must not contain trackId, clipId, instanceId, noteId, or id/i.test(up), 'draft forbids project ids');
  assert(up.indexOf('Arrangement Patch v0') < 0 || up.indexOf('Do not output Arrangement Patch v0') >= 0, 'prompt does not ask model for final patch ids');
  assert(/one ```json fenced block/i.test(up), 'format contract requires one json fence');
  assert(/Music remains creative/i.test(up), 'format contract preserves creative freedom');
  assert(up.indexOf('exactly one note') < 0, 'prompt must not constrain note count to example');
  assert(up.indexOf('melodyNoteRowsBeatCSV') >= 0, 'compact note rows included');
  assert(up.indexOf('melodyNoteTableBeat') < 0, 'verbose note table omitted');
  assert(up.indexOf('bpm') >= 0, 'bpm included');
  assert(up.indexOf('instanceStartBeat') >= 0, 'instance start beat included');
  const sp = res.promptTrace.systemPrompt;
  assert(sp.indexOf('beats-only') >= 0, 'beats-only constraint included');
  assert(sp.indexOf('no startSec/durationSec/spanSec') >= 0, 'no seconds constraint included');
  assert(sp.indexOf('Do not output Arrangement Patch v0') >= 0, 'system prompt forbids direct patch output');

  assert(up.indexOf('createTrack') < 0, 'draft prompt does not ask for createTrack');
  assert(up.indexOf('gainDb') < 0, 'draft prompt does not ask model for gainDb');

  assert(up.indexOf('Strategy for add_accompaniment_v0:') >= 0, 'add_accompaniment_v0 strategy block header');
  assert(/musically useful accompaniment/i.test(up), 'musically useful accompaniment guidance');
  assert(up.indexOf('Avoid pad-only') >= 0 || up.indexOf('block-chord-only') >= 0, 'discourages pad/block sustained default');
  assert(/clear repeating groove/i.test(up), 'requests clear groove');
  assert(/variation|fill/i.test(up), 'allows variation/fills');
  assert(/kick\/snare\/hat/i.test(up), 'drum part guidance');
  assert(/avoid over-constraining/i.test(up), 'explicitly avoids over-constraining musical choices');
  assert(up.indexOf('keep accompaniment sparse, supportive, and musically simple') < 0, 'system prompt no longer over-constrains sparse/simple');
  assert(/below the melody/i.test(up), 'accompaniment balanced below melody');

  assert(/\b(bass|drums)\b/.test(up), 'draft part ids mentioned');
  assert(/50[^\n]*72/.test(up) && /bass often 50/i.test(up), 'bass velocity range 50-72');
  assert(/hi-hat|auxiliary/i.test(up) && /35[^\n]*62/.test(up), 'aux/hat velocity range 35-62');
  assert(/kick\/snare|main hit/i.test(up) && /50[^\n]*78/.test(up), 'main drum hit velocity band');
  assert(/strongest notes/i.test(up) && /melody note rows/i.test(up), 'velocities below melody reference');
  assert(/bass plus drums/i.test(up), 'explicit bass plus drums guidance');
  assert(/asks for one part/i.test(up), 'single track only when requested');

  assert(/selectedClip\.spanBeat.*target accompaniment length|target accompaniment length.*selectedClip\.spanBeat/i.test(up), 'spanBeat as target accompaniment length');
  assert(/cover most or all of the selected melody clip/i.test(up), 'cover most/all of melody clip');
  assert(/much earlier than the melody/i.test(up), 'do not end much earlier than melody');
  assert(/large silent tail/i.test(up), 'avoid large silent tail');
  assert(/repeat or continue the pattern until near selectedClip\.spanBeat/i.test(up), 'repeat/continue pattern near spanBeat');
  assert(/both should roughly cover the selected clip unless one is explicitly a short fill/i.test(up), 'two-track rough coverage unless short fill');

  assert(res.llmDebug && res.llmDebug.request, 'safe request diagnostics included');
  assert(res.llmDebug.request.messagesCount === 2, 'diagnostics messagesCount');
  assert(res.llmDebug.request.totalChars > 0, 'diagnostics totalChars');
  assert(res.llmDebug.request.maxMessageChars > 0, 'diagnostics maxMessageChars');
  assert(res.llmDebug.request.noteRowsTotal === 8, 'diagnostics noteRowsTotal');
  assert(res.llmDebug.request.noteRowsSent === 8, 'diagnostics noteRowsSent');
  assert(res.llmDebug.request.promptMode === 'compact', 'diagnostics promptMode');
  const safeDiag = JSON.stringify(res.llmDebug.request);
  assert(safeDiag.indexOf('simple chords') < 0, 'diagnostics do not include user prompt text');
  assert(safeDiag.indexOf('melodyNoteRowsBeatCSV') < 0, 'diagnostics do not include prompt/schema text');
  assert(res.llmDebug.request.totalChars < 50_000, 'typical arrangement prompt fits free_basic input cap');
}

async function testLargeSelectedClipPromptIsCompact(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody({ noteCount: 220 });
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  const draft = makeBassDrumsDraft(55);
  setMockCloudLlm({
    callChatCompletions: async (_cfg, _messages) => ({ text: '```json\n' + JSON.stringify(draft) + '\n```' }),
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  try {
    const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add drums and bass' });
    assert(res.ok === true, 'large clip still routes to cloud LLM');
    assert(res.llmDebug && res.llmDebug.request, 'safe request diagnostics included');
    assert(res.llmDebug.request.noteRowsTotal === 220, 'diagnostics noteRowsTotal for large clip');
    assert(res.llmDebug.request.noteRowsSent === 220, 'diagnostics noteRowsSent for large clip');
    assert(res.llmDebug.request.promptMode === 'compact', 'diagnostics promptMode for large clip');
    assert(res.llmDebug.request.totalChars < 30_000, '220-note arrangement prompt stays below compact target budget');
    const up = res.promptTrace.userPrompt;
    assert(up.indexOf('melodyNoteRowsBeatCSV') >= 0, 'compact CSV note rows included');
    assert(!/\{\s*"trackId"\s*:/.test(up), 'prompt does not include verbose per-note JSON objects');
    assert(up.indexOf('Allowed schema JSON') < 0, 'prompt does not include full expanded schema');
    assert(up.indexOf('AccompanimentDraft v1') >= 0, 'large prompt still asks for draft schema');
  } finally {
    globalThis.H2S_CLOUD_MODE = false;
    globalThis.H2S_CLOUD_LLM_CLIENT = null;
  }
}

async function testRejectsMissingOrAudioSelection(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: null, selectedInstanceId: melodyInst.id });
  setMockLlm({
    callChatCompletions: async () => ({ text: '' }),
    extractJsonObject: () => null,
  });
  const missingClip = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0' });
  assert(missingClip.ok === false && missingClip.reason === 'selected_clip_missing', 'missing clip rejected');

  const audioClip = H2SProject.createClipFromAudio({
    id: 'clip_audio_1',
    name: 'Audio',
    assetRef: 'asset://a.wav',
    durationSec: 2.0,
    bpm: 120,
  });
  p2.clips[audioClip.id] = audioClip;
  p2.clipOrder.push(audioClip.id);
  const audioInst = H2SProject.createInstanceV2(audioClip.id, 4, p2.tracks[0].id);
  p2.instances.push(audioInst);
  H2SProject.normalizeProjectV2(p2);
  harness.setSelectedClipId(audioClip.id);
  harness.setSelectedInstanceId(audioInst.id);
  const audioRes = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0' });
  assert(audioRes.ok === false && audioRes.reason === 'audio_clip_not_supported', 'audio clip rejected');
}

async function testPromptTraceSanitized(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  const draft = makeBassDraft(8);
  setMockLlm({
    authToken: 'TOP_SECRET',
    callChatCompletions: async () => ({ text: '```json\n' + JSON.stringify(draft) + '\n```' }),
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0' });
  assert(res.promptTrace, 'prompt trace returned');
  const allTrace = JSON.stringify(res.promptTrace);
  assert(allTrace.indexOf('TOP_SECRET') < 0, 'prompt trace must not include token');
  assert(res.llmDebug && res.llmDebug.baseUrl, 'safe llm debug fields present');
}

async function testCloudModeUsesCloudLlmBridge(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let cloudCalls = 0;
  const draft = makeBassDraft(8);
  setMockCloudLlm({
    callChatCompletions: async (cfg, _messages, opts) => {
      cloudCalls += 1;
      assert(cfg && cfg.baseUrl === 'cloud-ai-bridge', 'cloud bridge cfg baseUrl');
      assert(cfg && cfg.model === 'cloud-ai', 'cloud bridge cfg model');
      assert(cfg && cfg.modelProfileId === 'qwen36_plus', 'cloud bridge cfg should carry selected modelProfileId');
      assert(opts && opts.timeoutMs >= 180000, 'arrangement cloud LLM timeout should allow long patch generation');
      return { text: '```json\n' + JSON.stringify(draft) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  try {
    const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add chords' });
    assert(res.ok === true, 'cloud bridge arrangement succeeds');
    assert(cloudCalls === 1, 'cloud LLM bridge called once');
    assert(res.llmDebug && res.llmDebug.baseUrl === 'cloud-ai-bridge', 'safe cloud debug baseUrl');
  } finally {
    globalThis.H2S_CLOUD_MODE = false;
    globalThis.H2S_CLOUD_LLM_CLIENT = null;
  }
}

async function main(){
  await testValidDraftOneCommit();
  await testInvalidDraftFallsBackAndCommits();
  await testMalformedNoJsonFallsBackAndCommits();
  await testFallbackDrumsAllowsBoundedTailAtConvertedSpan();
  await testMalformedLengthFinishReasonIsDiagnostic();
  await testMalformedNoJsonRepairRetryCanCommit();
  await testInvalidDraftRepairRetryCanCommit();
  await testProjectIdsInDraftFallBackToGeneratedPatchIds();
  await testPackedIdsAvoidExistingCollisionsWithoutChangingMusic();
  await testSecondsDraftFallsBackToBeatsOnlyPatch();
  await testPromptIncludesRequiredContext();
  await testLargeSelectedClipPromptIsCompact();
  await testRejectsMissingOrAudioSelection();
  await testPromptTraceSanitized();
  await testCloudModeUsesCloudLlmBridge();
  console.log('PASS arrangement_llm_v0.test.js');
}

main().catch(function(err){
  console.error(err);
  process.exit(1);
});
