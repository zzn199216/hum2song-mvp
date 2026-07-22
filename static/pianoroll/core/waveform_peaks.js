/* Hum2Song Studio - core/waveform_peaks.js
 * Pure, versioned min/max waveform peak generation for timeline thumbnails.
 * Node-safe UMD; no DOM and no audio playback dependencies.
 */
(function(root, factory){
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.H2SWaveformPeaks = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  var VERSION = 1;
  var DEFAULT_SAMPLES_PER_POINT = 128;
  var DEFAULT_MIN_OVERVIEW_POINTS = 256;
  var MAX_LEVELS = 20;

  function isFiniteNumber(value){
    return typeof value === 'number' && isFinite(value);
  }

  function quantizeSample(value){
    var n = isFiniteNumber(value) ? value : 0;
    n = Math.max(-1, Math.min(1, n));
    return Math.max(-32768, Math.min(32767, Math.round(n * 32767)));
  }

  function typedInt16(value){
    if (value instanceof Int16Array) return value;
    if (Array.isArray(value)) return Int16Array.from(value);
    if (value && value.buffer instanceof ArrayBuffer){
      try { return new Int16Array(value.buffer, value.byteOffset || 0, value.length); } catch (_e) {}
    }
    return null;
  }

  function validChannels(channels){
    if (!Array.isArray(channels)) return [];
    return channels.filter(function(channel){
      return channel && typeof channel.length === 'number' && channel.length > 0;
    });
  }

  function computeBaseLevel(channels, samplesPerPoint){
    var sourceChannels = validChannels(channels);
    if (!sourceChannels.length) return null;
    var frameCount = sourceChannels.reduce(function(max, channel){
      return Math.max(max, channel.length || 0);
    }, 0);
    if (!frameCount) return null;

    var spp = Math.max(1, Math.floor(Number(samplesPerPoint) || DEFAULT_SAMPLES_PER_POINT));
    var pointCount = Math.max(1, Math.ceil(frameCount / spp));
    var mins = new Int16Array(pointCount);
    var maxs = new Int16Array(pointCount);

    for (var point = 0; point < pointCount; point++){
      var from = point * spp;
      var to = Math.min(frameCount, from + spp);
      var minSample = 1;
      var maxSample = -1;
      var found = false;
      for (var channelIndex = 0; channelIndex < sourceChannels.length; channelIndex++){
        var channel = sourceChannels[channelIndex];
        var channelTo = Math.min(to, channel.length || 0);
        for (var sampleIndex = from; sampleIndex < channelTo; sampleIndex++){
          var sample = Number(channel[sampleIndex]);
          if (!isFinite(sample)) continue;
          found = true;
          if (sample < minSample) minSample = sample;
          if (sample > maxSample) maxSample = sample;
        }
      }
      if (!found){
        minSample = 0;
        maxSample = 0;
      }
      mins[point] = quantizeSample(minSample);
      maxs[point] = quantizeSample(maxSample);
    }

    return {
      samplesPerPoint: spp,
      length: pointCount,
      min: mins,
      max: maxs,
    };
  }

  function yieldToMainThread(){
    return new Promise(function(resolve){
      if (typeof setTimeout === 'function') setTimeout(resolve, 0);
      else resolve();
    });
  }

  async function computeBaseLevelAsync(channels, samplesPerPoint, options){
    options = options || {};
    var sourceChannels = validChannels(channels);
    if (!sourceChannels.length) return null;
    var frameCount = sourceChannels.reduce(function(max, channel){
      return Math.max(max, channel.length || 0);
    }, 0);
    if (!frameCount) return null;
    var spp = Math.max(1, Math.floor(Number(samplesPerPoint) || DEFAULT_SAMPLES_PER_POINT));
    var pointCount = Math.max(1, Math.ceil(frameCount / spp));
    var mins = new Int16Array(pointCount);
    var maxs = new Int16Array(pointCount);
    var yieldEvery = Math.max(256, Math.floor(Number(options.yieldEveryPoints) || 4096));

    for (var point = 0; point < pointCount; point++){
      var from = point * spp;
      var to = Math.min(frameCount, from + spp);
      var minSample = 1;
      var maxSample = -1;
      var found = false;
      for (var channelIndex = 0; channelIndex < sourceChannels.length; channelIndex++){
        var channel = sourceChannels[channelIndex];
        var channelTo = Math.min(to, channel.length || 0);
        for (var sampleIndex = from; sampleIndex < channelTo; sampleIndex++){
          var sample = Number(channel[sampleIndex]);
          if (!isFinite(sample)) continue;
          found = true;
          if (sample < minSample) minSample = sample;
          if (sample > maxSample) maxSample = sample;
        }
      }
      mins[point] = quantizeSample(found ? minSample : 0);
      maxs[point] = quantizeSample(found ? maxSample : 0);
      if (point > 0 && point % yieldEvery === 0) await yieldToMainThread();
    }
    return { samplesPerPoint: spp, length: pointCount, min: mins, max: maxs };
  }

  function combineLevel(previous){
    if (!previous || previous.length <= 1) return null;
    var prevMin = typedInt16(previous.min);
    var prevMax = typedInt16(previous.max);
    if (!prevMin || !prevMax) return null;
    var length = Math.ceil(previous.length / 2);
    var mins = new Int16Array(length);
    var maxs = new Int16Array(length);
    for (var i = 0; i < length; i++){
      var a = i * 2;
      var b = Math.min(previous.length - 1, a + 1);
      mins[i] = Math.min(prevMin[a], prevMin[b]);
      maxs[i] = Math.max(prevMax[a], prevMax[b]);
    }
    return {
      samplesPerPoint: Math.max(1, Number(previous.samplesPerPoint) || 1) * 2,
      length: length,
      min: mins,
      max: maxs,
    };
  }

  function computePeakPyramidFromChannels(channels, sampleRate, options){
    options = options || {};
    var sourceChannels = validChannels(channels);
    if (!sourceChannels.length) return null;
    var frameCount = sourceChannels.reduce(function(max, channel){
      return Math.max(max, channel.length || 0);
    }, 0);
    var rate = isFiniteNumber(sampleRate) && sampleRate > 0 ? sampleRate : 44100;
    var base = computeBaseLevel(sourceChannels, options.samplesPerPoint);
    if (!base) return null;
    var levels = [base];
    var minOverviewPoints = Math.max(32, Math.floor(Number(options.minOverviewPoints) || DEFAULT_MIN_OVERVIEW_POINTS));
    while (levels.length < MAX_LEVELS && levels[levels.length - 1].length > minOverviewPoints){
      var next = combineLevel(levels[levels.length - 1]);
      if (!next) break;
      levels.push(next);
    }
    return {
      version: VERSION,
      sampleRate: rate,
      channelCount: sourceChannels.length,
      frameCount: frameCount,
      durationSec: frameCount / rate,
      levels: levels,
    };
  }

  function computePeakPyramidFromAudioBuffer(audioBuffer, options){
    if (!audioBuffer || !audioBuffer.numberOfChannels || typeof audioBuffer.getChannelData !== 'function') return null;
    var channels = [];
    for (var i = 0; i < audioBuffer.numberOfChannels; i++){
      channels.push(audioBuffer.getChannelData(i));
    }
    return computePeakPyramidFromChannels(channels, audioBuffer.sampleRate, options);
  }

  async function computePeakPyramidFromAudioBufferAsync(audioBuffer, options){
    options = options || {};
    if (!audioBuffer || !audioBuffer.numberOfChannels || typeof audioBuffer.getChannelData !== 'function') return null;
    var channels = [];
    for (var i = 0; i < audioBuffer.numberOfChannels; i++) channels.push(audioBuffer.getChannelData(i));
    var base = await computeBaseLevelAsync(channels, options.samplesPerPoint, options);
    if (!base) return null;
    var levels = [base];
    var minOverviewPoints = Math.max(32, Math.floor(Number(options.minOverviewPoints) || DEFAULT_MIN_OVERVIEW_POINTS));
    while (levels.length < MAX_LEVELS && levels[levels.length - 1].length > minOverviewPoints){
      var next = combineLevel(levels[levels.length - 1]);
      if (!next) break;
      levels.push(next);
    }
    var frameCount = Number(audioBuffer.length) || channels[0].length || 0;
    var rate = Number(audioBuffer.sampleRate) || 44100;
    return {
      version: VERSION,
      sampleRate: rate,
      channelCount: channels.length,
      frameCount: frameCount,
      durationSec: frameCount / rate,
      levels: levels,
    };
  }

  function normalizePeakPyramid(waveform){
    if (!waveform || Number(waveform.version) !== VERSION || !Array.isArray(waveform.levels)) return null;
    var levels = [];
    for (var i = 0; i < waveform.levels.length; i++){
      var level = waveform.levels[i];
      if (!level) continue;
      var mins = typedInt16(level.min);
      var maxs = typedInt16(level.max);
      var length = Math.min(
        Math.max(0, Math.floor(Number(level.length) || 0)),
        mins ? mins.length : 0,
        maxs ? maxs.length : 0
      );
      if (!mins || !maxs || length < 1) continue;
      levels.push({
        samplesPerPoint: Math.max(1, Math.floor(Number(level.samplesPerPoint) || 1)),
        length: length,
        min: mins,
        max: maxs,
      });
    }
    if (!levels.length) return null;
    return {
      version: VERSION,
      sampleRate: Math.max(1, Number(waveform.sampleRate) || 44100),
      channelCount: Math.max(1, Math.floor(Number(waveform.channelCount) || 1)),
      frameCount: Math.max(1, Math.floor(Number(waveform.frameCount) || (levels[0].length * levels[0].samplesPerPoint))),
      durationSec: Math.max(0, Number(waveform.durationSec) || 0),
      levels: levels,
    };
  }

  function selectLevelForWidth(waveform, pixelWidth){
    var normalized = normalizePeakPyramid(waveform);
    if (!normalized) return null;
    var target = Math.max(1, Math.ceil(Number(pixelWidth) || 1));
    var selected = normalized.levels[0];
    for (var i = 0; i < normalized.levels.length; i++){
      var level = normalized.levels[i];
      selected = level;
      if (level.length <= target * 2) break;
    }
    return selected;
  }

  return {
    VERSION: 'waveform_peaks_v1',
    DATA_VERSION: VERSION,
    DEFAULT_SAMPLES_PER_POINT: DEFAULT_SAMPLES_PER_POINT,
    quantizeSample: quantizeSample,
    computeBaseLevel: computeBaseLevel,
    computeBaseLevelAsync: computeBaseLevelAsync,
    combineLevel: combineLevel,
    computePeakPyramidFromChannels: computePeakPyramidFromChannels,
    computePeakPyramidFromAudioBuffer: computePeakPyramidFromAudioBuffer,
    computePeakPyramidFromAudioBufferAsync: computePeakPyramidFromAudioBufferAsync,
    normalizePeakPyramid: normalizePeakPyramid,
    selectLevelForWidth: selectLevelForWidth,
  };
});
