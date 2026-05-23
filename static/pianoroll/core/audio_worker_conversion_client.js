/* Worker-backed audio segment conversion client for Cloud-embedded Studio. */
(function () {
  'use strict';

  var FLAG = 'H2S_STUDIO_WORKER_CONVERSION_ENABLED';
  var POLL_MS = 2750;
  var MAX_WAIT_MS = 600000;
  var ALLOWED_HOSTS = {
    'https://hum2song.cn': true,
    'http://localhost:3000': true,
    'http://127.0.0.1:3000': true,
    'http://localhost:3010': true,
    'http://127.0.0.1:3010': true,
    'http://localhost:3012': true,
    'http://127.0.0.1:3012': true,
  };

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function isEnabled() {
    try {
      if (window.location && window.location.search) {
        var params = new URLSearchParams(window.location.search);
        var q = params.get(FLAG) || params.get('workerConversion');
        if (q === '0' || q === 'false') return false;
        if (q === '1' || q === 'true') return true;
      }
      var g = window[FLAG];
      if (g === false || g === '0' || g === 0 || g === 'false') return false;
      if (g === true || g === '1' || g === 1 || g === 'true') return true;
      if (typeof localStorage !== 'undefined') {
        var v = localStorage.getItem(FLAG);
        if (v === '0' || v === 'false') return false;
        return v === '1' || v === 'true';
      }
    } catch (_e) {}
    return isCloudMode();
  }

  function isCloudMode() {
    try {
      return window.H2S_CLOUD_MODE === true && window.parent && window.parent !== window;
    } catch (_e) {
      return false;
    }
  }

  function reqId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  function requestHost(type, payload, transfer) {
    return new Promise(function (resolve, reject) {
      if (!isCloudMode()) {
        reject(new Error('worker_unavailable'));
        return;
      }
      var id = reqId('audio-midi');
      var responseType = type + '_RESPONSE';
      var timeout = setTimeout(function () {
        window.removeEventListener('message', onMsg);
        reject(new Error('worker_timeout'));
      }, 30000);
      function onMsg(ev) {
        if (!ALLOWED_HOSTS[String(ev.origin || '')]) return;
        var data = ev && ev.data;
        if (!data || typeof data !== 'object') return;
        if (data.type !== responseType || data.requestId !== id) return;
        clearTimeout(timeout);
        window.removeEventListener('message', onMsg);
        if (data.ok === true) resolve(data);
        else reject(new Error(typeof data.error === 'string' ? data.error : 'worker_failed'));
      }
      window.addEventListener('message', onMsg);
      var msg = Object.assign({ type: type, requestId: id }, payload || {});
      try {
        if (transfer && transfer.length) window.parent.postMessage(msg, '*', transfer);
        else window.parent.postMessage(msg, '*');
      } catch (err) {
        clearTimeout(timeout);
        window.removeEventListener('message', onMsg);
        reject(err);
      }
    });
  }

  function encodeWav(buffer, startSec, durationSec) {
    if (!buffer) return null;
    var sampleRate = buffer.sampleRate || 44100;
    var startSample = Math.max(0, Math.floor(Number(startSec || 0) * sampleRate));
    var endSample = Math.min(buffer.length, Math.ceil((Number(startSec || 0) + Number(durationSec || 0)) * sampleRate));
    if (endSample <= startSample) return null;
    var channels = Math.max(1, buffer.numberOfChannels || 1);
    var frames = endSample - startSample;
    var bytesPerSample = 2;
    var blockAlign = channels * bytesPerSample;
    var dataSize = frames * blockAlign;
    var ab = new ArrayBuffer(44 + dataSize);
    var view = new DataView(ab);
    function str(off, s) {
      for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    }
    str(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    str(36, 'data');
    view.setUint32(40, dataSize, true);
    var off = 44;
    for (var f = 0; f < frames; f++) {
      for (var c = 0; c < channels; c++) {
        var channel = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
        var sample = Math.max(-1, Math.min(1, channel[startSample + f] || 0));
        view.setInt16(off, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        off += 2;
      }
    }
    return ab;
  }

  async function segmentToWavArrayBuffer(file, segment) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('worker_unavailable');
    var ac = new AC();
    try {
      var input = await file.arrayBuffer();
      var decoded = await ac.decodeAudioData(input.slice(0));
      var wav = encodeWav(decoded, segment.startSec, segment.durationSec);
      if (!wav) throw new Error('segment_extract_failed');
      return wav;
    } finally {
      try { await ac.close(); } catch (_e) {}
    }
  }

  async function convert(options) {
    options = options || {};
    if (!isEnabled() || !isCloudMode()) return { ok: false, reason: 'worker_unavailable' };
    var file = options.file;
    var segment = options.segment;
    if (!file || !segment) return { ok: false, reason: 'bad_args' };
    var audioBuffer = await segmentToWavArrayBuffer(file, segment);
    var created = await requestHost('H2S_CLOUD_AUDIO_TO_MIDI_JOB_CREATE', {
      filename: 'studio-selected-segment.wav',
      mimeType: 'audio/wav',
      segmentStartSec: Number(segment.startSec || 0),
      segmentDurationSec: Number(segment.durationSec || 0),
      audioBuffer: audioBuffer,
    }, [audioBuffer]);
    var job = created.job || {};
    var jobId = typeof job.id === 'string' ? job.id : '';
    if (!jobId) throw new Error('worker_failed');
    var started = nowMs();
    for (;;) {
      if (nowMs() - started > MAX_WAIT_MS) throw new Error('worker_timeout');
      var st = await requestHost('H2S_CLOUD_AUDIO_TO_MIDI_JOB_STATUS', { jobId: jobId });
      var sj = st.job || {};
      if (sj.status === 'failed' || sj.status === 'cancelled') throw new Error('task_failed');
      if (sj.status === 'succeeded') break;
      await new Promise(function (r) { setTimeout(r, POLL_MS); });
    }
    var result = await requestHost('H2S_CLOUD_AUDIO_TO_MIDI_JOB_RESULT', { jobId: jobId });
    if (!result.scoreDoc) throw new Error('score_fetch_failed');
    return { ok: true, workerJobId: jobId, scoreDoc: result.scoreDoc };
  }

  var api = {
    isEnabled: isEnabled,
    isCloudMode: isCloudMode,
    convert: convert,
    _encodeWav: encodeWav,
  };

  if (typeof window !== 'undefined') {
    window.H2SAudioWorkerConversionClient = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
