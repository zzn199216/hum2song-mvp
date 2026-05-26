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
  const noteCount = Number.isFinite(Number(opts.noteCount)) ? Math.max(1, Math.floor(Number(opts.noteCount))) : 2;
  const p2 = H2SProject.defaultProjectV2();
  let notes = [
    { id: 'm0', pitch: 64, velocity: 90, startBeat: 0, durationBeat: 1 },
    { id: 'm1', pitch: 67, velocity: 90, startBeat: 1, durationBeat: 1 },
  ];
  if (noteCount !== 2){
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

async function testValidPatchOneCommit(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const patch = {
    kind: 'arrangement_patch_v0',
    version: 1,
    ops: [
      { op: 'createTrack', trackId: 'trk_acc_1', name: 'Accompaniment', instrument: 'bass' },
      {
        op: 'createClip',
        clipId: 'clip_acc_1',
        name: 'Accompaniment Clip',
        scoreBeat: {
          version: 2,
          time_signature: '4/4',
          tracks: [{ id: 'acc_t0', notes: [{ id: 'a0', pitch: 52, velocity: 72, startBeat: 0, durationBeat: 1 }] }],
        },
      },
      { op: 'addInstance', instanceId: 'inst_acc_1', clipId: 'clip_acc_1', trackId: 'trk_acc_1', startBeat: 8 },
    ],
  };
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: '```json\n' + JSON.stringify(patch) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });

  const beforeMelody = JSON.stringify(p2.clips[melodyClip.id].score);
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add soft pad' });
  assert(res.ok === true, 'valid patch should succeed');
  assert(harness.getCommitCount() === 1, 'should commit once');
  assert(llmCalls === 1, 'one llm call by default');
  assert(Array.isArray(res.summary.createdTrackIds) && res.summary.createdTrackIds[0] === 'trk_acc_1', 'summary track ids');
  assert(res.qualityReport && res.qualityReport.ok === true, 'quality report present on success');
  assert(Array.isArray(res.qualityReport.warnings) && res.qualityReport.warnings.length === 0, 'baseline patch has no quality warnings');
  assert(JSON.stringify(harness.getProject().clips[melodyClip.id].score) === beforeMelody, 'melody clip remains unchanged');
}

async function testInvalidPatchNoCommit(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const invalidPatch = { kind: 'arrangement_patch_v0', version: 1, ops: [{ op: 'deleteClip', clipId: melodyClip.id }] };
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      return { text: '```json\n' + JSON.stringify(invalidPatch) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0' });
  assert(res.ok === false && res.reason === 'patch_validation_failed', 'invalid patch rejected');
  assert(harness.getCommitCount() === 0, 'no commit on invalid patch');
  assert(llmCalls === 2, 'invalid patch should get one bounded repair retry');
  assert(res.llmDebug && res.llmDebug.callCount === 2, 'debug call count includes validation retry');
}

async function testMalformedNoJsonNoCommit(){
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
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0' });
  assert(res.ok === false && res.reason === 'llm_no_valid_json', 'no json rejected');
  assert(harness.getCommitCount() === 0, 'no commit when malformed');
  assert(llmCalls === 2, 'malformed output should get one bounded repair retry');
  assert(res.llmDebug && res.llmDebug.callCount === 2, 'debug call count includes repair retry');
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
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0' });
  assert(res.ok === false && res.reason === 'llm_no_valid_json', 'length-truncated malformed output rejected');
  assert(res.detail === 'finish_reason_length', 'length finish reason should be surfaced as actionable detail');
  assert(res.llmDebug && res.llmDebug.finishReason === 'length', 'llmDebug includes finishReason');
  assert(llmCalls === 2, 'length-truncated malformed output still gets one repair retry');
}

async function testMalformedNoJsonRepairRetryCanCommit(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const patch = makeValidAccompanimentPatch();
  const calls = [];
  setMockLlm({
    callChatCompletions: async (_cfg, messages) => {
      llmCalls += 1;
      calls.push(messages);
      if (llmCalls === 1) return { text: 'I can add a bass line, but here is a prose answer instead.' };
      return { text: '```json\n' + JSON.stringify(patch) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'repair retry should apply valid arrangement patch');
  assert(harness.getCommitCount() === 1, 'repair retry commits once');
  assert(llmCalls === 2, 'one repair retry');
  assert(res.llmDebug && res.llmDebug.callCount === 2, 'debug call count includes both attempts');
  assert(Array.isArray(calls[1]) && calls[1].length === 2, 'repair retry sends system + user only');
  assert(String(calls[1][1].content || '').indexOf('Repair the previous Arrangement Patch v0 response') >= 0, 'repair instruction included');
  assert(String(calls[1][1].content || '').length < 1800, 'repair prompt stays bounded');
}

async function testInvalidPatchRepairRetryCanCommit(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const invalidPatch = { kind: 'arrangement_patch_v0', version: 1, ops: [{ op: 'deleteClip', clipId: melodyClip.id }] };
  const patch = makeValidAccompanimentPatch();
  setMockLlm({
    callChatCompletions: async () => {
      llmCalls += 1;
      const body = llmCalls === 1 ? invalidPatch : patch;
      return { text: '```json\n' + JSON.stringify(body) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'invalid first patch can be repaired');
  assert(harness.getCommitCount() === 1, 'validation repair commits once');
  assert(llmCalls === 2, 'one validation repair retry');
  assert(res.llmDebug && res.llmDebug.callCount === 2, 'debug call count includes validation retry');
}

async function testAddInstanceValidationRetryPromptNamesInstanceId(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  let llmCalls = 0;
  const invalidPatch = {
    kind: 'arrangement_patch_v0',
    version: 1,
    ops: [
      { op: 'createTrack', trackId: 'trk_bad_inst', name: 'Bad', instrument: 'bass' },
      {
        op: 'createClip',
        clipId: 'clip_bad_inst',
        name: 'Bad Clip',
        scoreBeat: { version: 2, tracks: [{ id: 'tb', notes: [{ id: 'b0', pitch: 48, velocity: 64, startBeat: 0, durationBeat: 1 }] }] },
      },
      { op: 'addInstance', id: 'wrong_key', clipId: 'clip_bad_inst', trackId: 'trk_bad_inst', startBeat: 8 },
    ],
  };
  const patch = makeValidAccompanimentPatch();
  const calls = [];
  setMockLlm({
    callChatCompletions: async (_cfg, messages) => {
      llmCalls += 1;
      calls.push(messages);
      const body = llmCalls === 1 ? invalidPatch : patch;
      return { text: '```json\n' + JSON.stringify(body) + '\n```' };
    },
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'add bass' });
  assert(res.ok === true, 'missing instanceId first patch can be repaired');
  assert(llmCalls === 2, 'one validation retry');
  const repairUser = String(calls[1] && calls[1][1] && calls[1][1].content || '');
  assert(repairUser.indexOf('"op":"addInstance","instanceId"') >= 0, 'repair prompt shows exact addInstance instanceId key');
  assert(/Do not use "id" for addInstance/i.test(repairUser), 'repair prompt forbids id alias for addInstance');
  assert(/unique instanceId/i.test(repairUser), 'repair prompt requires unique instanceId');
}

async function testBeatsOnlyInvariantRejectsSeconds(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  const patchWithSeconds = {
    kind: 'arrangement_patch_v0',
    version: 1,
    ops: [
      { op: 'createTrack', trackId: 'trk_acc_s', name: 'Acc', instrument: 'piano' },
      {
        op: 'createClip',
        clipId: 'clip_acc_s',
        name: 'Acc',
        scoreBeat: {
          version: 2,
          tracks: [{ id: 't0', notes: [{ id: 'n0', pitch: 50, velocity: 70, startBeat: 0, durationBeat: 1, startSec: 0.1 }] }],
        },
      },
      { op: 'addInstance', instanceId: 'inst_acc_s', clipId: 'clip_acc_s', trackId: 'trk_acc_s', startBeat: 8 },
    ],
  };
  setMockLlm({
    callChatCompletions: async () => ({ text: '```json\n' + JSON.stringify(patchWithSeconds) + '\n```' }),
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0' });
  assert(res.ok === false && res.reason === 'patch_validation_failed', 'seconds field should fail validation');
  assert(String(res.detail).indexOf('seconds_fields_forbidden') >= 0, 'seconds rejection detail');
  assert(harness.getCommitCount() === 0, 'no commit on seconds fields');
}

async function testPromptIncludesRequiredContext(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody();
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  const patch = { kind: 'arrangement_patch_v0', version: 1, ops: [] };
  setMockLlm({
    callChatCompletions: async () => ({ text: '```json\n' + JSON.stringify(patch) + '\n```' }),
    extractJsonObject: (txt) => {
      const m = String(txt || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  });
  const res = await harness.ctrl.runArrangementV0({ goal: 'add_accompaniment_v0', userPrompt: 'simple chords' });
  assert(res.promptTrace && typeof res.promptTrace.userPrompt === 'string', 'prompt trace exists');
  const up = res.promptTrace.userPrompt;
  assert(up.indexOf('Allowed operations:') >= 0, 'compact operation summary included');
  assert(up.indexOf('Allowed schema JSON') < 0, 'full expanded schema omitted');
  assert(up.indexOf('Output format contract:') >= 0, 'format contract block included');
  assert(up.indexOf('Minimal valid example') < 0, 'prompt must not include concrete musical examples');
  assert(up.indexOf('"pitch":48') < 0, 'prompt must not anchor bass pitch to C2');
  assert(up.indexOf('"durationBeat":1') < 0, 'prompt must not anchor generated duration to example');
  assert(up.indexOf('"velocity":64') < 0, 'prompt must not anchor generated velocity to example');
  assert(up.indexOf('Operation object formats:') >= 0, 'format contract includes operation object formats');
  assert(up.indexOf('createTrack: requires trackId, name, instrument') >= 0, 'format contract names createTrack fields');
  assert(up.indexOf('createClip: requires clipId, name, scoreBeat') >= 0, 'format contract names createClip fields');
  assert(up.indexOf('addInstance: requires instanceId, clipId, trackId, startBeat') >= 0, 'format contract names addInstance fields');
  assert(/addInstance object must use the exact key instanceId/i.test(up), 'format contract names addInstance instanceId key');
  assert(/Do not use "id" for addInstance/i.test(up), 'format contract forbids addInstance id alias');
  assert(/instanceId.*unique/i.test(up), 'format contract requires unique instance IDs');
  assert(/one ```json fenced block/i.test(up), 'format contract requires one json fence');
  assert(/Music remains creative/i.test(up), 'format contract preserves creative freedom');
  assert(up.indexOf('exactly one note') < 0, 'prompt must not constrain note count to example');
  assert(up.indexOf('melodyNoteRowsBeatCSV') >= 0, 'compact note rows included');
  assert(up.indexOf('melodyNoteTableBeat') < 0, 'verbose note table omitted');
  assert(/scoreBeat\.tracks\[\][^\n]*must include[^\n]*id/i.test(up), 'scoreBeat track id requirement explicit');
  assert(up.indexOf('bpm') >= 0, 'bpm included');
  assert(up.indexOf('instanceStartBeat') >= 0, 'instance start beat included');
  const sp = res.promptTrace.systemPrompt;
  assert(sp.indexOf('beats-only') >= 0, 'beats-only constraint included');
  assert(sp.indexOf('no startSec/durationSec/spanSec') >= 0, 'no seconds constraint included');
  assert(sp.indexOf('additive-only') >= 0, 'additive-only constraint included');

  assert(up.indexOf('createTrack') >= 0 && up.indexOf('gainDb') >= 0, 'schema includes createTrack and gainDb');

  assert(up.indexOf('Strategy for add_accompaniment_v0:') >= 0, 'add_accompaniment_v0 strategy block header');
  assert(/musically useful accompaniment/i.test(up), 'musically useful accompaniment guidance');
  assert(up.indexOf('Avoid pad-only') >= 0 || up.indexOf('block-chord-only') >= 0, 'discourages pad/block sustained default');
  assert(/clear repeating groove/i.test(up), 'requests clear groove');
  assert(/variation|fill/i.test(up), 'allows variation/fills');
  assert(/kick\/snare\/hat/i.test(up), 'drum part guidance');
  assert(/avoid over-constraining/i.test(up), 'explicitly avoids over-constraining musical choices');
  assert(up.indexOf('keep accompaniment sparse, supportive, and musically simple') < 0, 'system prompt no longer over-constrains sparse/simple');
  assert(up.indexOf('gainDb optional -30..0') >= 0, 'schema documents optional gainDb range');
  assert(up.indexOf('gainDb') >= 0, 'gainDb mentioned in prompt');
  assert(/below the melody/i.test(up), 'accompaniment balanced below melody');
  assert(/-5\b/.test(up) && /-9\b/.test(up), 'suggested bass/dB ranges in strategy');
  assert(up.indexOf('above 0 dB') >= 0, 'do not exceed 0 dB for accompaniment');

  assert(/\b(bass|drum|lead|pad|pluck|default)\b/.test(up), 'canonical built-in instrument ids mentioned');
  assert(up.indexOf('pluck') >= 0 && up.indexOf('Built-in instrument') >= 0, 'built-in instrument guidance block');
  assert(/not drums/i.test(up) && /\bdrum\b/.test(up), 'prefer drum id, discourage drums');
  assert(/50[^\n]*72/.test(up) && /bass often 50/i.test(up), 'bass velocity range 50-72');
  assert(/hi-hat|auxiliary/i.test(up) && /35[^\n]*62/.test(up), 'aux/hat velocity range 35-62');
  assert(/pad\/chords/i.test(up) && /40[^\n]*65/.test(up), 'pad/chords velocity range 40-65');
  assert(/kick\/snare|main hit/i.test(up) && /50[^\n]*78/.test(up), 'main drum hit velocity band');
  assert(/strongest notes/i.test(up) && /melody note rows/i.test(up), 'velocities below melody reference');
  assert(/Do not rely on gainDb alone/i.test(up), 'gainDb and velocity both required for balance');
  assert(/use two new tracks/i.test(up), 'explicit bass plus drums should use two tracks');
  assert(/asks for one part/i.test(up), 'single track only when requested');
  assert(/bass plus drums\/percussion/i.test(up) && /use two new tracks/i.test(up), 'two-track pairing guidance');

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
  assert(res.llmDebug.request.noteRowsTotal === 2, 'diagnostics noteRowsTotal');
  assert(res.llmDebug.request.noteRowsSent === 2, 'diagnostics noteRowsSent');
  assert(res.llmDebug.request.promptMode === 'compact', 'diagnostics promptMode');
  const safeDiag = JSON.stringify(res.llmDebug.request);
  assert(safeDiag.indexOf('simple chords') < 0, 'diagnostics do not include user prompt text');
  assert(safeDiag.indexOf('melodyNoteRowsBeatCSV') < 0, 'diagnostics do not include prompt/schema text');
  assert(res.llmDebug.request.totalChars < 50_000, 'typical arrangement prompt fits free_basic input cap');
}

async function testLargeSelectedClipPromptIsCompact(){
  const { p2, melodyClip, melodyInst } = makeProjectWithMelody({ noteCount: 220 });
  const harness = makeControllerHarness({ project: p2, selectedClipId: melodyClip.id, selectedInstanceId: melodyInst.id });
  const patch = { kind: 'arrangement_patch_v0', version: 1, ops: [] };
  setMockCloudLlm({
    callChatCompletions: async (_cfg, _messages) => ({ text: '```json\n' + JSON.stringify(patch) + '\n```' }),
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
  setMockLlm({
    authToken: 'TOP_SECRET',
    callChatCompletions: async () => ({ text: '```json\n{"kind":"arrangement_patch_v0","version":1,"ops":[]}\n```' }),
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
  const patch = { kind: 'arrangement_patch_v0', version: 1, ops: [] };
  setMockCloudLlm({
    callChatCompletions: async (cfg, _messages, opts) => {
      cloudCalls += 1;
      assert(cfg && cfg.baseUrl === 'cloud-ai-bridge', 'cloud bridge cfg baseUrl');
      assert(cfg && cfg.model === 'cloud-ai', 'cloud bridge cfg model');
      assert(cfg && cfg.modelProfileId === 'qwen36_plus', 'cloud bridge cfg should carry selected modelProfileId');
      assert(opts && opts.timeoutMs >= 180000, 'arrangement cloud LLM timeout should allow long patch generation');
      return { text: '```json\n' + JSON.stringify(patch) + '\n```' };
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
  await testValidPatchOneCommit();
  await testInvalidPatchNoCommit();
  await testMalformedNoJsonNoCommit();
  await testMalformedLengthFinishReasonIsDiagnostic();
  await testMalformedNoJsonRepairRetryCanCommit();
  await testInvalidPatchRepairRetryCanCommit();
  await testAddInstanceValidationRetryPromptNamesInstanceId();
  await testBeatsOnlyInvariantRejectsSeconds();
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
