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
const Draft = require(path.resolve(__dirname, '../../static/pianoroll/core/accompaniment_draft_v1.js'));

assert(H2SProject, 'H2SProject loaded');
assert(ArrangementPatch && ArrangementPatch.validateArrangementPatchV0, 'arrangement patch loaded');
assert(Draft && typeof Draft.packAccompanimentDraftV1ToArrangementPatchV0 === 'function', 'draft module loaded');

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

async function main(){
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
    const res = pack(p2, draft);
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
    const res = pack(p2, draft);
    assert(res.ok === true, 'deterministic generic accompaniment packs');
    assertPatchValid(p2, res.patch);
    assert(res.patch.ops.filter((op) => op.op === 'createTrack').length === 2, 'generic fallback creates bass and drums');
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
    const res = pack(p2, draft);
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

  console.log('PASS accompaniment_draft_v1.test.js');
}

main().catch(function(err){
  console.error(err);
  process.exit(1);
});
