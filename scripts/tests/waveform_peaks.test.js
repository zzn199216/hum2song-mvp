#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const peaks = require(path.join(repoRoot, 'static', 'pianoroll', 'core', 'waveform_peaks.js'));

function testRealSignedMinMax() {
  const channel = new Float32Array([0, 0.25, -0.5, 0.75, -1, 0.1, 0, 0.5]);
  const waveform = peaks.computePeakPyramidFromChannels([channel], 8, {
    samplesPerPoint: 4,
    minOverviewPoints: 1,
  });
  assert.equal(waveform.version, 1);
  assert.equal(waveform.levels[0].length, 2);
  assert.ok(waveform.levels[0].min[0] < 0, 'negative samples are retained');
  assert.ok(waveform.levels[0].max[0] > 0, 'positive samples are retained');
  assert.ok(waveform.levels[0].min[1] <= -32767, 'full-scale negative peak is retained');
  assert.ok(waveform.levels[0].max[1] > 0, 'second bucket positive peak is retained');
}

function testStereoEnvelopeAndPyramid() {
  const left = new Float32Array(8192);
  const right = new Float32Array(8192);
  left[100] = 0.8;
  right[101] = -0.7;
  const waveform = peaks.computePeakPyramidFromChannels([left, right], 44100, {
    samplesPerPoint: 128,
    minOverviewPoints: 4,
  });
  assert.equal(waveform.channelCount, 2);
  assert.ok(waveform.levels.length > 1, 'large sources receive multiple overview levels');
  assert.ok(waveform.levels[0].max[0] > 20000);
  assert.ok(waveform.levels[0].min[0] < -20000);
  const selected = peaks.selectLevelForWidth(waveform, 4);
  assert.ok(selected.length < waveform.levels[0].length, 'renderer selects a coarser level for a narrow view');
}

function testNormalizationRejectsFabricatedShape() {
  assert.equal(peaks.normalizePeakPyramid(null), null);
  assert.equal(peaks.normalizePeakPyramid({ version: 999, levels: [] }), null);
}

async function testAsyncMatchesSync() {
  const channel = new Float32Array(2048);
  for (let i = 0; i < channel.length; i++) channel[i] = Math.sin(i / 17) * 0.7;
  const sync = peaks.computePeakPyramidFromChannels([channel], 48000, { samplesPerPoint: 64 });
  const fakeBuffer = {
    numberOfChannels: 1,
    sampleRate: 48000,
    length: channel.length,
    getChannelData: () => channel,
  };
  const asyncWaveform = await peaks.computePeakPyramidFromAudioBufferAsync(fakeBuffer, {
    samplesPerPoint: 64,
    yieldEveryPoints: 256,
  });
  assert.deepEqual(Array.from(asyncWaveform.levels[0].min), Array.from(sync.levels[0].min));
  assert.deepEqual(Array.from(asyncWaveform.levels[0].max), Array.from(sync.levels[0].max));
}

async function main() {
  testRealSignedMinMax();
  testStereoEnvelopeAndPyramid();
  testNormalizationRejectsFabricatedShape();
  await testAsyncMatchesSync();
  console.log('waveform_peaks.test.js: all passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
