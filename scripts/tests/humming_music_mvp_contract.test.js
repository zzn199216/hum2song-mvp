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

assert(studioSrc.includes('id="h2sHummingMusicPanel"'), 'humming music panel should render in the Clip editor');
const leftPanelStart = htmlSrc.indexOf('<div class="panelHeader">');
const leftPanelEnd = htmlSrc.indexOf('<label class="row"', leftPanelStart);
const leftRecordingPanel = htmlSrc.slice(leftPanelStart, leftPanelEnd);
assert(!leftRecordingPanel.includes('id="h2sHummingMusicPanel"'), 'left recording/import panel must not expose the primary humming music action');
const modalStart = htmlSrc.indexOf('<div id="modal" class="modal"');
const hummingPanelIndex = htmlSrc.indexOf('id="h2sHummingMusicPanel"');
const quickOptimizeIndex = htmlSrc.indexOf('id="editorQuickOptimizePreset"');
assert(hummingPanelIndex > modalStart && hummingPanelIndex > quickOptimizeIndex, 'humming music action should live inside the Clip editor action area');

assert(studioSrc.includes('data-h2s-hum-group="instruments"'), 'instrument chips group missing');
assert(studioSrc.includes('data-h2s-hum-group="style"'), 'style chips group missing');
assert(studioSrc.includes('data-h2s-hum-group="mood"'), 'mood chips group missing');
assert(studioSrc.includes('data-h2s-hum-group="arrangement"'), 'arrangement chips group missing');
assert(studioSrc.includes('id="h2sHummingCustomKeywords"'), 'custom keyword input missing');
assert(appSrc.includes('_composeHummingMusicStyleHint'), 'styleHint composer missing');
assert(appSrc.includes('_requestHummingMusicJob'), 'humming job request method missing');
assert(appSrc.includes('_resolveHummingMusicSourceClip'), 'humming source resolver missing');
assert(appSrc.includes('this.editorRt.state.modal.draftScore'), 'humming generation should read the currently opened Clip editor draft score');
const resolverStart = appSrc.indexOf('_resolveHummingMusicSourceClip(opts)');
const resolverEnd = appSrc.indexOf('_postHummingMusicBridgeRequest', resolverStart);
const resolverSrc = appSrc.slice(resolverStart, resolverEnd);
assert(!resolverSrc.includes('_lastHummingScoreDoc'), 'humming generation must not fall back to the last recording/conversion score');
assert(appSrc.includes('this._hummingMusicGenerating'), 'generate button must guard duplicate requests');
assert(appSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_CREATE'), 'Studio must request humming music job through Cloud bridge');
assert(appSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_CREATE_RESPONSE'), 'Studio must handle humming create response');
assert(appSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_STATUS'), 'Studio must poll humming music job through Cloud bridge');
assert(appSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_STATUS_RESPONSE'), 'Studio must handle humming status response');
assert(appSrc.includes('window.H2S_REQUEST_CLOUD_MATERIALS_LIST'), 'completion should refresh Cloud Materials');
assert(studioSrc.includes('完整音乐是生成音频素材') || studioSrc.includes('瀹屾暣闊充箰鏄'), 'UI must not imply generated audio is MIDI-editable');
assert(appSrc.includes('请选择一个可编辑旋律片段。') || appSrc.includes('请先选择一个可编辑旋律片段。') || appSrc.includes('璇峰厛閫夋嫨涓€涓彲缂栬緫鏃嬪緥鐗囨'), 'no-source state should ask the user to select an editable clip');
assert(appSrc.includes('_assistantIsHummingFullMusicIntent'), 'assistant should recognize full-music-from-current-clip requests');
assert(appSrc.includes('_assistantDispatchHummingMusicFlow'), 'assistant should route full-music requests through the same Studio bridge flow');

const createMessageIndex = appSrc.indexOf('H2S_CLOUD_HUMMING_MUSIC_JOB_CREATE');
const createMessageSlice = appSrc.slice(Math.max(0, createMessageIndex - 1200), createMessageIndex + 2400);
assert(!/bearer|authorization|accessToken|token/i.test(createMessageSlice), 'Studio humming bridge payload must not include tokens');

assert(bridgeSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_CREATE_RESPONSE'), 'cloud bridge should store humming create response');
assert(bridgeSrc.includes('h2s-cloud-humming-music-job-create'), 'cloud bridge should dispatch humming create event');
assert(bridgeSrc.includes('H2S_CLOUD_HUMMING_MUSIC_JOB_STATUS_RESPONSE'), 'cloud bridge should store humming status response');
assert(bridgeSrc.includes('h2s-cloud-humming-music-job-status'), 'cloud bridge should dispatch humming status event');

console.log('PASS humming music MVP Studio contract');
