#!/usr/bin/env node
/**
 * Live track mute playback regression tests.
 *
 * Uses a fake Tone runtime so callbacks can be inspected without browser audio.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');

function loadH2SProject(){
  const w = {};
  const m = { exports: {} };
  const ctx = vm.createContext({
    window: w,
    globalThis: w,
    console,
    module: m,
    exports: m.exports,
    setTimeout,
    clearTimeout,
    Blob,
    URL,
  });
  vm.runInContext(
    fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'project.js'), 'utf8'),
    ctx,
    { filename: 'project.js' }
  );
  assert.ok(ctx.window.H2SProject, 'H2SProject');
  return ctx.window.H2SProject;
}

function freshAudioController(){
  const modPath = path.join(repoRoot, 'static', 'pianoroll', 'controllers', 'audio_controller.js');
  delete require.cache[require.resolve(modPath)];
  return require(modPath);
}

function makeFakeTone(options){
  options = options || {};
  const scheduled = [];
  const triggered = [];
  const startedPlayers = [];
  const pendingPlayerLoads = [];
  const pendingSamplerLoads = [];
  const createdSynths = [];
  const createdSamplers = [];
  const decodedLoads = [];

  class FakeVolume {
    constructor(){ this.value = 0; }
  }

  class FakeSynth {
    constructor(){ this.volume = new FakeVolume(); this.disposed = false; createdSynths.push(this); }
    toDestination(){ return this; }
    triggerAttackRelease(freq, dur, time, vel){
      triggered.push({ kind: 'note', freq, dur, time, vel, volume: this.volume.value, synth: this });
    }
    dispose(){ this.disposed = true; }
  }

  class FakePlayer {
    constructor(cfg){
      this.url = cfg && cfg.url;
      this.volume = new FakeVolume();
      this.disposed = false;
      pendingPlayerLoads.push(() => {
        if (cfg && typeof cfg.onload === 'function') cfg.onload();
      });
    }
    toDestination(){ return this; }
    start(time, offset, dur){
      startedPlayers.push({ kind: 'audio', time, offset, dur, volume: this.volume.value, player: this });
    }
    dispose(){ this.disposed = true; }
  }

  class FakeSampler extends FakeSynth {
    constructor(cfg){
      super();
      this.urls = cfg && cfg.urls;
      createdSamplers.push(this);
      pendingSamplerLoads.push(() => {
        if (cfg && typeof cfg.onload === 'function') cfg.onload();
      });
    }
  }

  const Tone = {
    Transport: {
      seconds: 0,
      bpm: { value: 120 },
      state: 'stopped',
      stop(){ this.state = 'stopped'; },
      cancel(){ scheduled.length = 0; },
      schedule(fn, at){ scheduled.push({ fn, at }); return scheduled.length; },
      start(){ this.state = 'started'; },
    },
    start(){ return Promise.resolve(); },
    Frequency(value){
      return {
        toNote(){ return 'midi:' + String(value); },
        value,
      };
    },
    PolySynth: FakeSynth,
    Synth: FakeSynth,
    MonoSynth: FakeSynth,
    FMSynth: FakeSynth,
    PluckSynth: FakeSynth,
    MembraneSynth: FakeSynth,
    Sampler: options.samplerClass || FakeSampler,
    Player: FakePlayer,
  };

  if (options.decodedLoader){
    Tone.ToneAudioBuffer = {
      load(url){
        decodedLoads.push(url);
        return Promise.resolve({ decodedUrl: url });
      },
    };
  }

  return {
    Tone,
    scheduled,
    triggered,
    startedPlayers,
    pendingPlayerLoads,
    pendingSamplerLoads,
    createdSynths,
    createdSamplers,
    decodedLoads,
  };
}

function noteClip(P, id, startBeat){
  return P.createClipFromScoreBeat({
    version: 2,
    tempo_bpm: null,
    time_signature: null,
    tracks: [{
      id: 'score_trk',
      name: '',
      notes: [{ id: 'n1', pitch: 60, velocity: 100, startBeat, durationBeat: 1 }],
    }],
  }, { id, name: id });
}

function makeProject(P, opts){
  opts = opts || {};
  const p2 = P.defaultProjectV2();
  p2.bpm = 120;
  p2.tracks = [
    { id: 't1', trackId: 't1', name: 'Track 1', instrument: opts.instrument || 'default', gainDb: 0, muted: !!opts.muted },
  ];
  if (opts.audio){
    p2.clips.ca = {
      id: 'ca',
      kind: 'audio',
      name: 'Audio',
      createdAt: 1,
      audio: { assetRef: opts.assetRef || 'blob:test', durationSec: 1 },
      meta: { notes: 0, pitchMin: null, pitchMax: null, spanBeat: 2, sourceTempoBpm: null },
    };
    p2.clipOrder = ['ca'];
    p2.instances = [{ id: 'ia', clipId: 'ca', trackId: 't1', startBeat: opts.startBeat || 0, transpose: 0 }];
  } else {
    p2.clips.cn = noteClip(P, 'cn', opts.noteStartBeat || 2);
    p2.clipOrder = ['cn'];
    p2.instances = [{ id: 'in', clipId: 'cn', trackId: 't1', startBeat: 0, transpose: 0 }];
  }
  P.normalizeProjectV2(p2);
  return p2;
}

async function tick(n){
  for (let i = 0; i < (n || 1); i++) await Promise.resolve();
}

async function waitForPendingPlayerLoad(fake){
  for (let i = 0; i < 10; i++){
    await tick(4);
    if (fake.pendingPlayerLoads.length) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

async function waitForPendingSamplerLoad(fake){
  for (let i = 0; i < 10; i++){
    await tick(4);
    if (fake.pendingSamplerLoads.length) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

async function makeController(project, fake, projectApi){
  globalThis.Tone = fake.Tone;
  globalThis.H2SProject = projectApi;
  globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || function(){ return 0; };
  globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || function(){};
  const AC = freshAudioController();
  const ctrl = AC.create({
    getProject: () => ({ bpm: project.bpm, ui: { playheadSec: 0 } }),
    getProjectV2: () => project,
    setTransportPlaying: () => {},
    onUpdatePlayhead: () => {},
    onLog: () => {},
    onAlert: (msg) => { throw new Error(msg); },
    onStopped: () => {},
  });
  return ctrl;
}

async function testMutedBeforePlaybackSkipsNotesAndAudio(){
  const P = loadH2SProject();
  let fake = makeFakeTone();
  let p2 = makeProject(P, { muted: true, noteStartBeat: 2 });
  let ctrl = await makeController(p2, fake, P);
  await ctrl.playProject();
  assert.strictEqual(fake.scheduled.length, 0, 'muted note track should schedule no callbacks');

  fake = makeFakeTone();
  p2 = makeProject(P, { muted: true, audio: true, startBeat: 2 });
  ctrl = await makeController(p2, fake, P);
  await ctrl.playProject();
  assert.strictEqual(fake.scheduled.length, 0, 'muted audio track should schedule no callbacks');
}

async function testMuteDuringPlaybackBlocksFutureMidiNote(){
  const P = loadH2SProject();
  const fake = makeFakeTone();
  const p2 = makeProject(P, { muted: false, noteStartBeat: 2 });
  const ctrl = await makeController(p2, fake, P);
  await ctrl.playProject();
  assert.strictEqual(typeof ctrl.setTrackMuted, 'function', 'audio controller exposes setTrackMuted');
  assert.strictEqual(fake.scheduled.length, 1, 'future note scheduled');

  p2.tracks[0].muted = true;
  ctrl.setTrackMuted('t1', true);
  fake.scheduled[0].fn(2);
  assert.strictEqual(fake.triggered.length, 0, 'muted future MIDI note must not sound');

  p2.tracks[0].muted = false;
  ctrl.setTrackMuted('t1', false);
  fake.scheduled[0].fn(3);
  assert.strictEqual(fake.triggered.length, 1, 'unmuted future MIDI note may sound again');
}

async function testMuteDuringPlaybackBlocksFutureAudioClip(){
  const P = loadH2SProject();
  const fake = makeFakeTone();
  const p2 = makeProject(P, { muted: false, audio: true, startBeat: 2 });
  const ctrl = await makeController(p2, fake, P);
  const playPromise = ctrl.playProject();
  await waitForPendingPlayerLoad(fake);
  assert.strictEqual(fake.pendingPlayerLoads.length, 1, 'audio player load pending');
  fake.pendingPlayerLoads.shift()();
  await playPromise;
  assert.strictEqual(fake.scheduled.length, 1, 'future audio segment scheduled');

  p2.tracks[0].muted = true;
  ctrl.setTrackMuted('t1', true);
  fake.scheduled[0].fn(2);
  assert.strictEqual(fake.startedPlayers.length, 0, 'muted future audio clip must not start');
}

async function testMuteDuringAsyncAudioLoadBlocksLaterSound(){
  const P = loadH2SProject();
  const fake = makeFakeTone();
  const p2 = makeProject(P, { muted: false, audio: true, startBeat: 2 });
  const ctrl = await makeController(p2, fake, P);
  const playPromise = ctrl.playProject();
  await waitForPendingPlayerLoad(fake);
  assert.strictEqual(fake.pendingPlayerLoads.length, 1, 'audio player load pending');

  p2.tracks[0].muted = true;
  ctrl.setTrackMuted('t1', true);
  fake.pendingPlayerLoads.shift()();
  await playPromise;
  assert.strictEqual(fake.scheduled.length, 1, 'callback may still be scheduled, but must be guarded');
  fake.scheduled[0].fn(2);
  assert.strictEqual(fake.startedPlayers.length, 0, 'mute during async audio load must prevent later sound');
}

async function testMuteDuringAsyncSamplerLoadBlocksLaterSound(){
  const P = loadH2SProject();
  P.SAMPLER_PACKS.test = {
    label: 'Test',
    baseUrlDefault: '/samples/',
    urls: { C4: 'C4.wav', D4: 'D4.wav' },
    requiredKeys: ['C4', 'D4'],
  };
  P.resolveSamplerUrlsForPack = function(){
    return Promise.resolve({ urls: { C4: 'blob:c4', D4: 'blob:d4' }, objectUrls: [] });
  };
  const fake = makeFakeTone();
  const p2 = makeProject(P, { muted: false, instrument: 'sampler:test', noteStartBeat: 2 });
  const ctrl = await makeController(p2, fake, P);
  const playPromise = ctrl.playProject();
  await waitForPendingSamplerLoad(fake);
  assert.strictEqual(fake.pendingSamplerLoads.length, 1, 'sampler load pending');

  p2.tracks[0].muted = true;
  ctrl.setTrackMuted('t1', true);
  fake.pendingSamplerLoads.shift()();
  await playPromise;
  assert.strictEqual(fake.scheduled.length, 1, 'sampler note callback may still be scheduled, but must be guarded');
  fake.scheduled[0].fn(2);
  assert.strictEqual(fake.triggered.length, 0, 'mute during async sampler load must prevent later sound');
}

async function testSamplerIsReusedAcrossStopAndReplay(){
  const P = loadH2SProject();
  P.SAMPLER_PACKS.test = {
    label: 'Test',
    baseUrlDefault: '/samples/',
    urls: { C4: 'C4.wav', D4: 'D4.wav' },
    requiredKeys: ['C4', 'D4'],
  };
  P.resolveSamplerUrlsForPack = function(){
    return Promise.resolve({ urls: { C4: 'blob:c4', D4: 'blob:d4' }, objectUrls: [] });
  };
  const fake = makeFakeTone();
  const p2 = makeProject(P, { instrument: 'sampler:test' });
  const ctrl = await makeController(p2, fake, P);

  const firstPlay = ctrl.playProject();
  await waitForPendingSamplerLoad(fake);
  fake.pendingSamplerLoads.shift()();
  await firstPlay;
  assert.strictEqual(fake.createdSamplers.length, 1, 'first playback should create one sampler');

  ctrl.stop();
  await ctrl.playProject();
  assert.strictEqual(fake.createdSamplers.length, 1, 'replay should reuse the prepared sampler');
  assert.strictEqual(fake.pendingSamplerLoads.length, 0, 'replay should not start another sampler load');
  ctrl.dispose();
}

async function testConcurrentPrepareDeduplicatesDecodedPack(){
  const P = loadH2SProject();
  P.SAMPLER_PACKS.test = {
    label: 'Test',
    baseUrlDefault: '/samples/',
    urls: { C4: 'C4.wav', D4: 'D4.wav' },
    requiredKeys: ['C4', 'D4'],
  };
  P.resolveSamplerUrlsForPack = function(){
    return Promise.resolve({ urls: { C4: '/samples/C4.wav', D4: '/samples/D4.wav' }, objectUrls: [] });
  };
  const fake = makeFakeTone({ decodedLoader: true });
  const p2 = makeProject(P, { instrument: 'sampler:test' });
  const ctrl = await makeController(p2, fake, P);

  await Promise.all([
    ctrl.prepareTrackInstrument('t1', 'sampler:test'),
    ctrl.prepareTrackInstrument('t2', 'sampler:test'),
  ]);
  assert.strictEqual(fake.createdSamplers.length, 2, 'tracks should keep independent sampler nodes');
  assert.strictEqual(fake.decodedLoads.length, 2, 'the two-note pack should be decoded once across tracks');
  ctrl.dispose();
}

async function testRapidInstrumentChangesDiscardStaleLoads(){
  const P = loadH2SProject();
  P.SAMPLER_PACKS.a = { urls: { C4: 'C4.wav', D4: 'D4.wav' }, requiredKeys: ['C4', 'D4'] };
  P.SAMPLER_PACKS.b = { urls: { C4: 'C4.wav', D4: 'D4.wav' }, requiredKeys: ['C4', 'D4'] };
  P.resolveSamplerUrlsForPack = function(pack, packId){
    return Promise.resolve({ urls: { C4: 'blob:' + packId + ':c4', D4: 'blob:' + packId + ':d4' }, objectUrls: [] });
  };
  const fake = makeFakeTone();
  const p2 = makeProject(P, { instrument: 'sampler:a' });
  const ctrl = await makeController(p2, fake, P);

  const firstA = ctrl.prepareTrackInstrument('t1', 'sampler:a');
  const loadB = ctrl.prepareTrackInstrument('t1', 'sampler:b');
  const finalA = ctrl.prepareTrackInstrument('t1', 'sampler:a');
  await waitForPendingSamplerLoad(fake);
  while (fake.pendingSamplerLoads.length < 3) await tick(2);
  fake.pendingSamplerLoads[2]();
  fake.pendingSamplerLoads[1]();
  fake.pendingSamplerLoads[0]();
  fake.pendingSamplerLoads.length = 0;
  await Promise.all([firstA, loadB, finalA]);

  assert.strictEqual(fake.createdSamplers.length, 3, 'each distinct in-flight generation may construct once');
  assert.strictEqual(fake.createdSamplers[0].disposed, true, 'stale first A load should be disposed');
  assert.strictEqual(fake.createdSamplers[1].disposed, true, 'stale B load should be disposed');
  assert.strictEqual(fake.createdSamplers[2].disposed, false, 'latest A load should remain active');
  await ctrl.prepareTrackInstrument('t1', 'sampler:a');
  assert.strictEqual(fake.createdSamplers.length, 3, 'latest resolved instrument should be reused');
  ctrl.dispose();
}

async function testTrackInstrumentCacheIsBounded(){
  const P = loadH2SProject();
  const fake = makeFakeTone();
  const p2 = makeProject(P, {});
  const ctrl = await makeController(p2, fake, P);
  for (let i = 0; i < 10; i++){
    await ctrl.prepareTrackInstrument('cache-track-' + i, i % 2 ? 'lead' : 'pad');
  }
  assert.strictEqual(
    fake.createdSynths.filter(synth => synth.disposed).length,
    2,
    'only the eight most recently used track instruments should remain cached',
  );
  ctrl.dispose();
}

function testAppSetTrackMutedNotifiesRuntime(){
  const appSrc = fs.readFileSync(path.join(repoRoot, 'static', 'pianoroll', 'app.js'), 'utf8');
  assert.ok(
    /setTrackMuted\(trackId,\s*muted\)[\s\S]*audioCtrl[\s\S]*setTrackMuted/.test(appSrc),
    'app.setTrackMuted should notify audioCtrl.setTrackMuted'
  );
}

async function main(){
  try{
    await testMutedBeforePlaybackSkipsNotesAndAudio();
    await testMuteDuringPlaybackBlocksFutureMidiNote();
    await testMuteDuringPlaybackBlocksFutureAudioClip();
    await testMuteDuringAsyncAudioLoadBlocksLaterSound();
    await testMuteDuringAsyncSamplerLoadBlocksLaterSound();
    await testSamplerIsReusedAcrossStopAndReplay();
    await testConcurrentPrepareDeduplicatesDecodedPack();
    await testRapidInstrumentChangesDiscardStaleLoads();
    await testTrackInstrumentCacheIsBounded();
    testAppSetTrackMutedNotifiesRuntime();
  } finally {
    delete globalThis.Tone;
    delete globalThis.H2SProject;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  }
  console.log('audio_live_mute_playback.test.js: all passed');
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
