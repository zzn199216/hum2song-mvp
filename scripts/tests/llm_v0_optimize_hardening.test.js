#!/usr/bin/env node
'use strict';

/**
 * Bounded llm_v0 hardening: patchSummary.llm.outcome + top-level llmOutcome (not phase1Deterministic).
 */
const path = require('path');

function assert(cond, msg){
  if (!cond) throw new Error(msg || 'assertion failed');
}

/** Contract: llm_v0 optimize results mirror outcome, stay on executionPath llm, and never carry Phase-1 metadata. */
function assertLlmOutcomeContract(res, expectedOutcome, opts){
  const o = opts || {};
  assert(res && typeof res === 'object', 'result object');
  assert(res.executionPath === 'llm', 'executionPath must be llm for llm_v0');
  assert(res.patchSummary && typeof res.patchSummary === 'object', 'patchSummary');
  assert(res.patchSummary.llm && typeof res.patchSummary.llm === 'object', 'patchSummary.llm must exist');
  assert(res.patchSummary.llm.outcome === expectedOutcome, 'patchSummary.llm.outcome');
  assert(res.llmOutcome === res.patchSummary.llm.outcome, 'llmOutcome mirrors patchSummary.llm.outcome');
  if (!o.allowPhase1){
    assert(!res.patchSummary.phase1Deterministic, 'phase1Deterministic must be absent on llm path');
  }
}

/** llm_v0 retry observability: llmDebug + patchSummary.llm share bounded attempt fields. */
function assertLlmRetryMeta(res, expected){
  const d = res.llmDebug;
  assert(d && typeof d === 'object', 'llmDebug');
  assert(d.totalAttempts === expected.totalAttempts, 'llmDebug.totalAttempts');
  assert(d.finalAttemptIndex === expected.finalAttemptIndex, 'llmDebug.finalAttemptIndex');
  assert(d.attemptCount === expected.totalAttempts, 'attemptCount matches totalAttempts');
  assert(Array.isArray(d.attemptSummaries), 'attemptSummaries');
  assert(d.attemptSummaries.length === expected.totalAttempts, 'summaries length');
  assert(res.patchSummary.llm.totalAttempts === expected.totalAttempts, 'patchSummary.llm.totalAttempts');
  assert(res.patchSummary.llm.finalAttemptIndex === expected.finalAttemptIndex, 'patchSummary.llm.finalAttemptIndex');
  assert(Array.isArray(res.patchSummary.llm.attemptSummaries), 'patchSummary.llm.attemptSummaries');
}

/** Pre-request fail (no chat-completions): zero attempts, preRequestExit flag. */
function assertLlmPreRequestMeta(res, expectedOutcome){
  assertLlmOutcomeContract(res, expectedOutcome);
  assert(res.llmDebug && typeof res.llmDebug === 'object', 'llmDebug');
  assert(res.llmDebug.preRequestExit === true, 'preRequestExit');
  assert(res.llmDebug.totalAttempts === 0 && res.llmDebug.attemptCount === 0, 'llmDebug zero counts');
  assert(res.llmDebug.finalAttemptIndex === 0, 'llmDebug finalAttemptIndex 0');
  assert(Array.isArray(res.llmDebug.attemptSummaries) && res.llmDebug.attemptSummaries.length === 0, 'empty attemptSummaries');
  assert(res.patchSummary.llm.preRequestExit === true, 'patchSummary.llm.preRequestExit');
  assert(res.patchSummary.llm.totalAttempts === 0 && res.patchSummary.llm.finalAttemptIndex === 0, 'patchSummary.llm zero attempts');
}

function ensureWindowShim(){
  if (typeof globalThis.window === 'undefined') globalThis.window = {};
}

function loadProject(){
  ensureWindowShim();
  if (globalThis.H2SProject && typeof globalThis.H2SProject.beginNewClipRevision === 'function') return;
  require(path.resolve(__dirname, '../../static/pianoroll/project.js'));
  if (globalThis.window && globalThis.window.H2SProject) globalThis.H2SProject = globalThis.window.H2SProject;
}

function loadAgentPatch(){
  ensureWindowShim();
  if (globalThis.H2SAgentPatch) return;
  require(path.resolve(__dirname, '../../static/pianoroll/core/agent_patch.js'));
  if (globalThis.window && globalThis.window.H2SAgentPatch) globalThis.H2SAgentPatch = globalThis.window.H2SAgentPatch;
}

function loadAgentController(){
  loadAgentPatch();
  loadProject();
  ensureWindowShim();
  require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  if (globalThis.window && globalThis.window.H2SAgentController) globalThis.H2SAgentController = globalThis.window.H2SAgentController;
}

function loadLlmClient(){
  ensureWindowShim();
  require(path.resolve(__dirname, '../../static/pianoroll/llm_client.js'));
}

function makeClip(){
  const H2SProject = globalThis.H2SProject;
  const project = {
    version: 2,
    timebase: 'beat',
    bpm: 120,
    tracks: [{ id: 'trk_0', name: 'Track 1', instrument: 'default', gainDb: 0, muted: false, trackId: 'trk_0' }],
    clips: {},
    clipOrder: [],
    instances: [],
    ui: { pxPerBeat: 120, playheadBeat: 0 },
  };
  const scoreBeat = {
    version: 2,
    tracks: [{
      id: 't0',
      notes: [{ id: 'n0', pitch: 60, velocity: 90, startBeat: 0, durationBeat: 1 }],
    }],
  };
  const clip = H2SProject.createClipFromScoreBeat(scoreBeat, { id: 'llm_h1', name: 'h1' });
  project.clips[clip.id] = clip;
  project.clipOrder.push(clip.id);
  if (H2SProject.normalizeProjectRevisionChains) H2SProject.normalizeProjectRevisionChains(project);
  return { project, clip };
}

function makeClipWithNoteCount(count){
  const H2SProject = globalThis.H2SProject;
  const project = {
    version: 2,
    timebase: 'beat',
    bpm: 120,
    tracks: [{ id: 'trk_0', name: 'Track 1', instrument: 'default', gainDb: 0, muted: false, trackId: 'trk_0' }],
    clips: {},
    clipOrder: [],
    instances: [],
    ui: { pxPerBeat: 120, playheadBeat: 0 },
  };
  const notes = [];
  for (let i = 0; i < count; i++){
    notes.push({
      id: 'editable_note_' + String(i).padStart(2, '0') + '_cloud_smoke',
      pitch: 60 + (i % 12),
      velocity: 80 + (i % 20),
      startBeat: i * 0.5,
      durationBeat: 0.5,
    });
  }
  const clip = H2SProject.createClipFromScoreBeat({
    version: 2,
    tracks: [{ id: 't0', notes }],
  }, { id: 'llm_cloud_24', name: 'cloud 24' });
  project.clips[clip.id] = clip;
  project.clipOrder.push(clip.id);
  if (H2SProject.normalizeProjectRevisionChains) H2SProject.normalizeProjectRevisionChains(project);
  return { project, clip };
}

async function testAppliedOutcome(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 80 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'test' });
  assert(res && res.ok === true && res.ops === 1, 'applied');
  assertLlmOutcomeContract(res, 'applied');
  assertLlmRetryMeta(res, { totalAttempts: 1, finalAttemptIndex: 1 });
  assert(res.llmDebug.attemptSummaries[0].outcome === 'applied', 'single attempt outcome');
}

async function testUserTextPromptDisablesVelocityOnlySafeMode(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', pitch: 62, velocity: 82 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, {
    requestedPresetId: 'llm_v0',
    userPrompt: '优化一下，让这段音乐更好听，这段有一些音不符合乐理',
    _assistantFreeformTextRequest: true,
  });
  assert(res && res.ok === true, 'user text prompt should allow pitch edits even when stored config is velocityOnly');
  assert(res.llmDebug && res.llmDebug.safeModeResolved === false, 'user text prompt resolves normal mode');
  const updated = project.clips[cid].score.tracks[0].notes.find((n) => n.id === 'n0');
  assert(updated && updated.pitch === 62, 'pitch change applied');
}

async function testVagueMakeBetterCanApplyMultiDimensionalPatch(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClipWithNoteCount(4);
  let project = proj;
  const cid = clip.id;
  const beforeRevisionId = clip.revisionId;

  const patch = {
    version: 1,
    clipId: cid,
    ops: [
      { op: 'setNote', noteId: 'editable_note_00_cloud_smoke', pitch: 61, velocity: 86, startBeat: 0.125, durationBeat: 0.375 },
      { op: 'moveNote', noteId: 'editable_note_01_cloud_smoke', deltaBeat: 0.125 },
    ],
  };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: '优化一下，让这段音乐更好听，这段有一些音不符合乐理' });
  assert(res && res.ok === true && res.ops === 2, 'vague make-better prompt can apply pitch/timing/velocity patch');
  assertLlmOutcomeContract(res, 'applied');
  assert(res.patchSummary.hasPitchChange === true, 'patch summary has pitch change');
  assert(res.patchSummary.hasTimingChange === true, 'patch summary has timing change');
  assert(project.clips[cid].revisionId !== beforeRevisionId, 'applied patch creates new revision');
  const updated = project.clips[cid].score.tracks[0].notes.find((n) => n.id === 'editable_note_00_cloud_smoke');
  assert(updated.pitch === 61 && updated.velocity === 86 && updated.startBeat === 0.125 && updated.durationBeat === 0.375, 'multi-dimensional edit applied');
}

async function testCleanUnmusicalNotesCanDeleteSmallOutlierSet(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClipWithNoteCount(10);
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'deleteNote', noteId: 'editable_note_09_cloud_smoke' }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'clean unmusical notes' });
  assert(res && res.ok === true, 'small outlier delete applies');
  assert(project.clips[cid].score.tracks[0].notes.length === 9, 'one note deleted');
}

async function testTooManyDeletesRejectedAndClipUnchanged(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClipWithNoteCount(10);
  let project = proj;
  const cid = clip.id;
  const before = JSON.stringify(project.clips[cid].score);

  const patch = {
    version: 1,
    clipId: cid,
    ops: [0, 1, 2].map((i) => ({ op: 'deleteNote', noteId: 'editable_note_0' + i + '_cloud_smoke' })),
  };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'clean unmusical notes' });
  assert(res && res.ok === false && res.reason === 'too_destructive', 'too many deletes rejected');
  assertLlmOutcomeContract(res, 'rejected_destructive');
  assert(JSON.stringify(project.clips[cid].score) === before, 'rejected delete patch leaves original unchanged');
}

async function testInvalidNoteIdRejectedWithSpecificReason(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;
  const before = JSON.stringify(project.clips[cid].score);

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'missing_note_id', pitch: 62 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'fix wrong note' });
  assert(res && res.ok === false && res.reason === 'invalid_note_reference', 'invalid noteId gets specific reason');
  assertLlmOutcomeContract(res, 'rejected_validation');
  assert(JSON.stringify(project.clips[cid].score) === before, 'invalid noteId leaves original unchanged');
}

async function testSecondsFieldsRejectedWithSpecificReason(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;
  const before = JSON.stringify(project.clips[cid].score);

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', startSec: 0.25, durationSec: 0.5, velocity: 82 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'tighten this note' });
  assert(res && res.ok === false && res.reason === 'invalid_timing', 'seconds fields get timing validation reason');
  assertLlmOutcomeContract(res, 'rejected_validation');
  assert(JSON.stringify(project.clips[cid].score) === before, 'seconds patch leaves original unchanged');
}

async function testUnsupportedAddNoteRejected(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'addNote', trackId: 't0', note: { id: 'new1', pitch: 64, velocity: 80, startBeat: 1, durationBeat: 0.5 } }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'make it better' });
  assert(res && res.ok === false && res.reason === 'unsupported_operation', 'addNote remains disabled for llm_v0');
  assertLlmOutcomeContract(res, 'rejected_validation');
}

async function testCloudSmallClipPromptStaysBounded(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClipWithNoteCount(24);
  let project = proj;
  const cid = clip.id;
  const patch = { version: 1, clipId: cid, ops: [{ op: 'moveNote', noteId: 'editable_note_00_cloud_smoke', deltaBeat: 0.125 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';
  let capturedMessages = null;
  let capturedCfg = null;

  const prevCloudMode = globalThis.H2S_CLOUD_MODE;
  const prevCloudClient = globalThis.H2S_CLOUD_LLM_CLIENT;
  const prevLlmConfig = globalThis.H2S_LLM_CONFIG;
  globalThis.H2S_CLOUD_MODE = true;
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: '', model: '', authToken: 'LOCAL_TOKEN_SHOULD_NOT_BE_USED', modelProfileId: 'minimax_m27_highspeed' }),
  };
  globalThis.H2S_CLOUD_LLM_CLIENT = {
    callChatCompletions: async (cfg, messages) => {
      capturedCfg = cfg;
      capturedMessages = messages;
      return { text: rawText };
    },
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };

  try {
    const ctrl = AgentController.create({
      getProjectV2: () => project,
      setProjectFromV2: (p) => { project = p; },
      persist: () => {},
      render: () => {},
    });

    const res = await ctrl.optimizeClip(cid, {
      requestedPresetId: 'llm_v0',
      userPrompt: 'tighten rhythm gently',
      intent: { fixPitch: false, tightenRhythm: true, reduceOutliers: false },
    });
    assert(res && res.ok === true, 'cloud optimize succeeds');
    assert(capturedCfg && capturedCfg.modelProfileId === 'minimax_m27_highspeed', 'cloud optimize should carry selected modelProfileId');
    assert(Array.isArray(capturedMessages), 'cloud messages captured');
    assert(capturedMessages.length === 2, 'cloud request sends system + user messages only');
    const totalChars = capturedMessages.reduce((sum, m) => sum + String(m.content || '').length, 0);
    assert(totalChars <= 4000, '24-note cloud prompt should fit free_basic maxInputChars');
    const serialized = JSON.stringify(capturedMessages);
    assert(serialized.indexOf('"clips"') < 0 && serialized.indexOf('"instances"') < 0, 'request must not include whole project');
    assert(serialized.indexOf('llmPromptTrace') < 0 && serialized.indexOf('finalSystemPrompt') < 0, 'request must not include prompt trace/debug');
    assert(/musically meaningful/i.test(serialized), 'normal llm prompt encourages musically meaningful edits');
    assert(/expressive but bounded/i.test(serialized), 'normal llm prompt allows expressive bounded changes');
    assert(/do not respond with velocity-only unless explicitly requested/i.test(serialized), 'normal llm prompt should not default to velocity-only');
  } finally {
    globalThis.H2S_CLOUD_MODE = prevCloudMode;
    globalThis.H2S_CLOUD_LLM_CLIENT = prevCloudClient;
    globalThis.H2S_LLM_CONFIG = prevLlmConfig;
  }
}

async function testNoOpOutcome(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === true && res.ops === 0, 'no op');
  assertLlmOutcomeContract(res, 'no_op');
  assert(res.patchSummary.noChanges === true, 'noChanges');
  assertLlmRetryMeta(res, { totalAttempts: 1, finalAttemptIndex: 1 });
  assert(res.llmDebug.attemptSummaries[0].outcome === 'no_op', 'no_op snapshot');
}

async function testPlainJsonObjectWithoutFenceAccepted(){
  loadAgentController();
  loadLlmClient();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;
  const client = globalThis.H2S_LLM_CLIENT;
  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 81 }] };

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: JSON.stringify(patch) }),
    extractJsonObject: client.extractJsonObject,
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'make smoother' });
  assert(res && res.ok === true && res.ops === 1, 'plain JSON object accepted');
  assertLlmRetryMeta(res, { totalAttempts: 1, finalAttemptIndex: 1 });
}

async function testFailedExtract(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: 'no json here' }),
    extractJsonObject: () => null,
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === false && res.reason === 'llm_no_valid_json', 'extract fail');
  assertLlmOutcomeContract(res, 'failed_extract');
  assertLlmRetryMeta(res, { totalAttempts: 2, finalAttemptIndex: 2 });
  assert(res.llmDebug.attemptSummaries[0].outcome === 'failed_extract' && res.llmDebug.attemptSummaries[1].outcome === 'failed_extract', 'both attempts failed_extract');
  assert(res.llmDebug.invalidJsonDiagnostics, 'invalid JSON diagnostics');
  assert(res.llmDebug.invalidJsonDiagnostics.responseChars === 'no json here'.length, 'responseChars');
  assert(res.llmDebug.invalidJsonDiagnostics.containsJsonFence === false, 'containsJsonFence');
  assert(res.llmDebug.invalidJsonDiagnostics.extractionOutcome === 'no_json', 'extractionOutcome');
  assert(res.llmDebug.invalidJsonDiagnostics.retryAttempted === true, 'retryAttempted');
}

async function testLengthFinishWithoutJsonReportsTruncatedGeneration(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({
      text: '<think>reasoning consumed the response budget',
      raw: { choices: [{ finish_reason: 'length' }] },
    }),
    extractJsonObject: () => null,
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === false, 'truncated generation fails safely');
  assert(res.reason === 'truncated_generation', 'specific truncation reason');
  assertLlmOutcomeContract(res, 'truncated_generation');
  assert(res.patchSummary.detail === 'finish_reason_length', 'truncation detail');
}

async function testThinkBlockStrippedBeforeJsonExtraction(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;
  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 80 }] };
  const rawText = '<think>{"version":1,"clipId":"' + cid + '","ops":[{"op":"deleteNote","noteId":"n0"}]}</think>\n' + JSON.stringify(patch);
  let extractedInput = '';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText, raw: { choices: [{ finish_reason: 'stop' }] } }),
    extractJsonObject: (text) => {
      extractedInput = String(text || '');
      const s = extractedInput.trim();
      return s ? JSON.parse(s) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === true, 'JSON after think block applies');
  assert(!/<think/i.test(extractedInput), 'extractor receives text without think block');
  assertLlmOutcomeContract(res, 'applied');
}

/** Second attempt succeeds after first JSON extract failure. */
async function testRetryRecoverFromFailedExtract(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 80 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  let callN = 0;
  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => {
      callN++;
      if (callN === 1) return { text: 'no fenced json' };
      return { text: rawText };
    },
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === true && res.ops === 1, 'applied on retry');
  assertLlmOutcomeContract(res, 'applied');
  assertLlmRetryMeta(res, { totalAttempts: 2, finalAttemptIndex: 2 });
  assert(res.llmDebug.attemptSummaries[0].outcome === 'failed_extract', 'first failed_extract');
  assert(res.llmDebug.attemptSummaries[1].outcome === 'applied', 'second applied');
}

/** Invalid JSON retry is a compact repair call that includes the previous model response. */
async function testFailedExtractRepairRetryUsesPreviousResponse(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const previousModelText = '我会把旋律变得更顺一点，但这里没有JSON。';
  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 82 }] };
  const repairedText = '```json\n' + JSON.stringify(patch) + '\n```';
  const calls = [];
  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async (_cfg, messages) => {
      calls.push(messages);
      return { text: calls.length === 1 ? previousModelText : repairedText };
    },
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'make smoother' });
  assert(res && res.ok === true && res.ops === 1, 'repair retry applied');
  assert(calls.length === 2, 'one repair retry');
  assert(calls[1].length === 2, 'repair retry sends system + user only');
  const repairUser = String(calls[1][1].content || '');
  assert(repairUser.indexOf('Convert this into exactly one valid Hum2Song patch JSON object') >= 0, 'repair instruction');
  assert(repairUser.indexOf(previousModelText) >= 0, 'previous model response included');
  assert(repairUser.indexOf('NOTE TABLE CSV') < 0, 'repair retry should not resend full note table');
  assert(repairUser.length < 1400, 'repair retry stays bounded');
  assert(res.llmDebug.invalidJsonDiagnostics.retryAttempted === true, 'diagnostic retryAttempted');
}

async function testBassRequestIsNotHardRejectedAsUnsupported(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;
  let callN = 0;

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => { callN++; return { text: '{}' }; },
    extractJsonObject: () => null,
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: '给这段加一段bass' });
  assert(res && res.ok === false, 'direct optimize still fails safely with invalid mock output');
  assert(res.reason !== 'unsupported_request', 'bass prompt should not hit old unsupported_request hard reject');
  assert(callN >= 1, 'no pre-request hard reject in llm_v0');
}

async function testFailedConfig(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: '', model: '', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === false && res.reason === 'llm_config_missing', 'config');
  assertLlmPreRequestMeta(res, 'failed_config');
}

async function testFailedClientNotLoaded(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const savedClient = globalThis.H2S_LLM_CLIENT;
  globalThis.H2S_LLM_CLIENT = null;
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  try {
    const ctrl = AgentController.create({
      getProjectV2: () => project,
      setProjectFromV2: (p) => { project = p; },
      persist: () => {},
      render: () => {},
    });

    const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
    assert(res && res.ok === false && res.reason === 'llm_client_not_loaded', 'client');
    assertLlmPreRequestMeta(res, 'failed_client');
  } finally {
    globalThis.H2S_LLM_CLIENT = savedClient;
  }
}

async function testRejectedSafeMode(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', pitch: 61, velocity: 90 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === false, 'reject');
  assertLlmOutcomeContract(res, 'rejected_safe_mode');
}

async function testRejectedValidation(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', pitch: 500, velocity: 90 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x', intent: { fixPitch: true, tightenRhythm: false, reduceOutliers: false } });
  assert(res && res.ok === false && res.reason === 'invalid_pitch_or_velocity', 'validation reject');
  assertLlmOutcomeContract(res, 'rejected_validation');
}

async function testTemplateVelocityOnlyPatchAppliesAsMusicalEdit(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 80 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  let callN = 0;
  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => {
      callN++;
      return { text: rawText };
    },
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, {
    requestedPresetId: 'llm_v0',
    userPrompt: 'x',
    templateId: 'fix_pitch_v1',
    intent: { fixPitch: true, tightenRhythm: false, reduceOutliers: false },
  });
  assert(res && res.ok === true, 'velocity-only patch is no longer rejected by template quality gate');
  assertLlmOutcomeContract(res, 'applied');
  assertLlmRetryMeta(res, { totalAttempts: 1, finalAttemptIndex: 1 });
  assert(callN === 1, 'applied patch should not retry');
}

async function testTemplateFixPitchCanApplyTimingOnlyPatch(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  // Not velocity-only, but still no pitch change.
  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', startBeat: 0.5 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, {
    requestedPresetId: 'llm_v0',
    userPrompt: 'x',
    templateId: 'fix_pitch_v1',
    intent: { fixPitch: true, tightenRhythm: false, reduceOutliers: false },
  });
  assert(res && res.ok === true, 'missing pitch is no longer blanket rejected');
  assertLlmOutcomeContract(res, 'applied');
}

async function testTemplateFixPitchCanApplyBroadPitchPatch(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const H2SProject = globalThis.H2SProject;
  const project = {
    version: 2,
    timebase: 'beat',
    bpm: 120,
    tracks: [{ id: 'trk_0', name: 'Track 1', instrument: 'default', gainDb: 0, muted: false, trackId: 'trk_0' }],
    clips: {},
    clipOrder: [],
    instances: [],
    ui: { pxPerBeat: 120, playheadBeat: 0 },
  };
  const scoreBeat = {
    version: 2,
    tracks: [{
      id: 't0',
      notes: [
        { id: 'n0', pitch: 60, velocity: 90, startBeat: 0, durationBeat: 1 },
        { id: 'n1', pitch: 62, velocity: 90, startBeat: 1, durationBeat: 1 },
        { id: 'n2', pitch: 64, velocity: 90, startBeat: 2, durationBeat: 1 },
        { id: 'n3', pitch: 65, velocity: 90, startBeat: 3, durationBeat: 1 },
      ],
    }],
  };
  const clip = H2SProject.createClipFromScoreBeat(scoreBeat, { id: 'llm_h1_scope', name: 'h1_scope' });
  project.clips[clip.id] = clip;
  project.clipOrder.push(clip.id);
  if (H2SProject.normalizeProjectRevisionChains) H2SProject.normalizeProjectRevisionChains(project);
  const cid = clip.id;

  // 2 / 4 notes changed used to be rejected by an overly narrow scope gate.
  const patch = {
    version: 1,
    clipId: cid,
    ops: [
      { op: 'setNote', noteId: 'n0', pitch: 61 },
      { op: 'setNote', noteId: 'n1', pitch: 63 },
    ],
  };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: () => {},
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, {
    requestedPresetId: 'llm_v0',
    userPrompt: 'x',
    templateId: 'fix_pitch_v1',
    intent: { fixPitch: true, tightenRhythm: false, reduceOutliers: false },
  });
  assert(res && res.ok === true, 'broad but structurally valid pitch patch applies');
  assertLlmOutcomeContract(res, 'applied');
}

async function testTemplateTightenRhythmCanApplyPitchPatch(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  // Not velocity-only, but still no timing change.
  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', pitch: 62 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, {
    requestedPresetId: 'llm_v0',
    userPrompt: 'x',
    templateId: 'tighten_rhythm_v1',
    intent: { fixPitch: false, tightenRhythm: true, reduceOutliers: false },
  });
  assert(res && res.ok === true, 'missing timing is no longer blanket rejected');
  assertLlmOutcomeContract(res, 'applied');
}

async function testRejectedSemantic(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', startBeat: 50, durationBeat: 1, velocity: 90 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: false }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === false && res.reason === 'apply_failed', 'semantic apply fail');
  assertLlmOutcomeContract(res, 'rejected_semantic');
}

async function testFailedApplyStub(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const H2SAgentPatch = globalThis.H2SAgentPatch;
  const origApply = H2SAgentPatch.applyPatchToClip;
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 80 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  H2SAgentPatch.applyPatchToClip = function(){
    return { ok: false, errors: ['apply_engine_error'] };
  };

  try {
    const ctrl = AgentController.create({
      getProjectV2: () => project,
      setProjectFromV2: (p) => { project = p; },
      persist: () => {},
      render: () => {},
    });

    const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
    assert(res && res.ok === false && res.reason === 'apply_failed', 'apply_failed');
    assertLlmOutcomeContract(res, 'failed_apply');
  } finally {
    H2SAgentPatch.applyPatchToClip = origApply;
  }
}

/** Error text contains "semantic" but is not a semantic-gate code → must stay failed_apply (not substring-misclassified). */
async function testFailedApplyMisleadingSubstring(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const H2SAgentPatch = globalThis.H2SAgentPatch;
  const origApply = H2SAgentPatch.applyPatchToClip;
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 80 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  H2SAgentPatch.applyPatchToClip = function(){
    return { ok: false, errors: ['non_semantic_apply_error'] };
  };

  try {
    const ctrl = AgentController.create({
      getProjectV2: () => project,
      setProjectFromV2: (p) => { project = p; },
      persist: () => {},
      render: () => {},
    });

    const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
    assert(res && res.ok === false && res.reason === 'apply_failed', 'apply_failed');
    assertLlmOutcomeContract(res, 'failed_apply');
  } finally {
    H2SAgentPatch.applyPatchToClip = origApply;
  }
}

/** Legacy path: first error uses semantic_* code prefix without semanticReject flag → still rejected_semantic. */
async function testSemanticCodePrefixFallback(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const H2SAgentPatch = globalThis.H2SAgentPatch;
  const origApply = H2SAgentPatch.applyPatchToClip;
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 80 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  H2SAgentPatch.applyPatchToClip = function(){
    return { ok: false, errors: ['semantic_span_growth_excess:99>24'] };
  };

  try {
    const ctrl = AgentController.create({
      getProjectV2: () => project,
      setProjectFromV2: (p) => { project = p; },
      persist: () => {},
      render: () => {},
    });

    const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
    assert(res && res.ok === false && res.reason === 'apply_failed', 'apply_failed');
    assertLlmOutcomeContract(res, 'rejected_semantic');
  } finally {
    H2SAgentPatch.applyPatchToClip = origApply;
  }
}

async function testFailedRequest(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => { throw new Error('network_unreachable'); },
    extractJsonObject: () => null,
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  const ctrl = AgentController.create({
    getProjectV2: () => project,
    setProjectFromV2: (p) => { project = p; },
    persist: () => {},
    render: () => {},
  });

  const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
  assert(res && res.ok === false, 'request fail');
  assertLlmOutcomeContract(res, 'failed_request');
  assertLlmRetryMeta(res, { totalAttempts: 1, finalAttemptIndex: 1 });
  assert(res.patchSummary.llm.preRequestExit !== true, 'post-request failure not preRequest');
}

async function testFailedRevision(){
  loadAgentController();
  const AgentController = require(path.resolve(__dirname, '../../static/pianoroll/controllers/agent_controller.js'));
  const H2SProject = globalThis.H2SProject;
  const origBegin = H2SProject.beginNewClipRevision;
  const { project: proj, clip } = makeClip();
  let project = proj;
  const cid = clip.id;

  const patch = { version: 1, clipId: cid, ops: [{ op: 'setNote', noteId: 'n0', velocity: 80 }] };
  const rawText = '```json\n' + JSON.stringify(patch) + '\n```';

  globalThis.H2S_LLM_CLIENT = {
    callChatCompletions: async () => ({ text: rawText }),
    extractJsonObject: (text) => {
      const m = (text || '').match(/```json\s*([\s\S]*?)\s*```/);
      return m ? JSON.parse(m[1]) : null;
    },
  };
  globalThis.H2S_LLM_CONFIG = {
    loadLlmConfig: () => ({ baseUrl: 'https://test', model: 'm', velocityOnly: true }),
  };

  H2SProject.beginNewClipRevision = function(){ return { ok: false }; };

  try {
    const ctrl = AgentController.create({
      getProjectV2: () => project,
      setProjectFromV2: (p) => { project = p; },
      persist: () => {},
      render: () => {},
    });

    const res = await ctrl.optimizeClip(cid, { requestedPresetId: 'llm_v0', userPrompt: 'x' });
    assert(res && res.ok === false && res.reason === 'beginNewClipRevision_failed', 'revision fail');
    assertLlmOutcomeContract(res, 'failed_revision');
  } finally {
    H2SProject.beginNewClipRevision = origBegin;
  }
}

async function main(){
  await testAppliedOutcome();
  await testUserTextPromptDisablesVelocityOnlySafeMode();
  await testVagueMakeBetterCanApplyMultiDimensionalPatch();
  await testCleanUnmusicalNotesCanDeleteSmallOutlierSet();
  await testTooManyDeletesRejectedAndClipUnchanged();
  await testInvalidNoteIdRejectedWithSpecificReason();
  await testUnsupportedAddNoteRejected();
  await testCloudSmallClipPromptStaysBounded();
  await testNoOpOutcome();
  await testPlainJsonObjectWithoutFenceAccepted();
  await testFailedExtract();
  await testLengthFinishWithoutJsonReportsTruncatedGeneration();
  await testThinkBlockStrippedBeforeJsonExtraction();
  await testRetryRecoverFromFailedExtract();
  await testFailedExtractRepairRetryUsesPreviousResponse();
  await testBassRequestIsNotHardRejectedAsUnsupported();
  await testFailedConfig();
  await testFailedClientNotLoaded();
  await testRejectedSafeMode();
  await testRejectedValidation();
  await testTemplateVelocityOnlyPatchAppliesAsMusicalEdit();
  await testTemplateFixPitchCanApplyTimingOnlyPatch();
  await testTemplateFixPitchCanApplyBroadPitchPatch();
  await testTemplateTightenRhythmCanApplyPitchPatch();
  await testRejectedSemantic();
  await testFailedApplyStub();
  await testFailedApplyMisleadingSubstring();
  await testSemanticCodePrefixFallback();
  await testFailedRequest();
  await testFailedRevision();
  console.log('llm_v0_optimize_hardening.test.js: OK');
}

main().catch(function(e){
  console.error(e);
  process.exit(1);
});
