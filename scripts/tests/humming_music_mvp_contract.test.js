'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const appSrc = fs.readFileSync(path.join(root, 'static', 'pianoroll', 'app.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(root, 'static', 'pianoroll', 'index.html'), 'utf8');
const bridgeSrc = fs.readFileSync(path.join(root, 'static', 'pianoroll', 'cloud_project_bridge.js'), 'utf8');
const studioSrc = `${htmlSrc}\n${appSrc}`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

assert(studioSrc.includes('id="h2sHummingMusicPanel"'), 'humming music panel should render near transcription UI');
assert(studioSrc.includes('data-h2s-hum-group="instruments"'), 'instrument chips group missing');
assert(studioSrc.includes('data-h2s-hum-group="style"'), 'style chips group missing');
assert(studioSrc.includes('data-h2s-hum-group="mood"'), 'mood chips group missing');
assert(studioSrc.includes('data-h2s-hum-group="arrangement"'), 'arrangement chips group missing');
assert(studioSrc.includes('id="h2sHummingCustomKeywords"'), 'custom keyword input missing');
assert(appSrc.includes('_composeHummingMusicStyleHint'), 'styleHint composer missing');
assert(appSrc.includes('_requestHummingMusicJob'), 'humming job request method missing');
assert(appSrc.includes('this._hummingMusicGenerating'), 'generate button must guard duplicate requests');
assert(appSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_CREATE'), 'Studio must request humming music job through Cloud bridge');
assert(appSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_CREATE_RESPONSE'), 'Studio must handle humming create response');
assert(appSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_STATUS'), 'Studio must poll humming music job through Cloud bridge');
assert(appSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_STATUS_RESPONSE'), 'Studio must handle humming status response');
assert(appSrc.includes('window.H2S_REQUEST_CLOUD_MATERIALS_LIST'), 'completion should refresh Cloud Materials');
assert(studioSrc.includes('完整音乐是生成音频素材'), 'UI must not imply generated audio is MIDI-editable');

const createMessageIndex = appSrc.indexOf('H2S_CLOUD_HUMMING_MUSIC_JOB_CREATE');
const createMessageSlice = appSrc.slice(Math.max(0, createMessageIndex - 1200), createMessageIndex + 2400);
assert(!/bearer|authorization|accessToken|token/i.test(createMessageSlice), 'Studio humming bridge payload must not include tokens');

assert(bridgeSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_CREATE_RESPONSE'), 'cloud bridge should store humming create response');
assert(bridgeSrc.includes('h2s-cloud-humming-music-job-create'), 'cloud bridge should dispatch humming create event');
assert(bridgeSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_STATUS_RESPONSE'), 'cloud bridge should store humming status response');
assert(bridgeSrc.includes('h2s-cloud-humming-music-job-status'), 'cloud bridge should dispatch humming status event');

console.log('PASS humming music MVP Studio contract');
