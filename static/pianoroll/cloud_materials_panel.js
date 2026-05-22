/**
 * Cloud Materials picker (Studio Cloud embed v0).
 * Loaded after cloud_project_bridge.js; uses parent postMessage for list/content.
 */
(function () {
  'use strict';

  function t(key, fallback) {
    try {
      if (window.I18N && typeof window.I18N.t === 'function') return window.I18N.t(key) || fallback || key;
    } catch (_e) {}
    return fallback || key;
  }

  function isCloudEmbed() {
    if (window.H2S_CLOUD_MODE === true) return true;
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (params.get('cloudMode') === '1') return true;
      if (window.parent && window.parent !== window) {
        var ref = document.referrer || '';
        if (/https:\/\/hum2song\.cn\//i.test(ref)) return true;
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(ref)) return true;
      }
    } catch (_e2) {}
    return false;
  }

  function getApp() {
    return window.H2SApp || window.APP || window.app || null;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDurationMs(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    var totalSec = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m > 0 ? m + ':' + String(s).padStart(2, '0') : totalSec + 's';
  }

  function kindLabel(kind) {
    var map = {
      generated_music: t('cloudMaterials.kindGenerated', 'Generated music'),
      uploaded_audio: t('cloudMaterials.kindUploaded', 'Uploaded audio'),
      recording: t('cloudMaterials.kindRecording', 'Recording'),
      exported_audio: t('cloudMaterials.kindExported', 'Exported audio'),
    };
    return map[kind] || kind || t('cloudMaterials.kindOther', 'Audio');
  }

  function sourceLabel(channel) {
    var map = {
      linggan_go: t('cloudMaterials.sourceLinggan', 'Linggan Go'),
      hum2song_web: t('cloudMaterials.sourceWeb', 'Hum2Song Web'),
      hum2song_studio: t('cloudMaterials.sourceStudio', 'Hum2Song Studio'),
      hum2song: t('cloudMaterials.sourceHum2song', 'Hum2Song'),
    };
    return map[channel] || t('cloudMaterials.sourceUnknown', 'Unknown');
  }

  function setStatus(text, isError) {
    var el = document.getElementById('cloudMaterialsStatus');
    if (!el) return;
    el.textContent = text || '';
    el.style.color = isError ? '#fca5a5' : '';
  }

  function renderList(materials) {
    var list = document.getElementById('cloudMaterialsList');
    if (!list) return;
    list.innerHTML = '';
    if (!materials || !materials.length) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.style.fontSize = '12px';
      empty.textContent = t('cloudMaterials.empty', 'No cloud audio materials yet.');
      list.appendChild(empty);
      return;
    }
    materials.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'cloudMaterialsRow';
      row.style.cssText =
        'border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:8px;margin-bottom:8px;background:rgba(0,0,0,.15);';
      var title = escapeHtml(item.title || item.id);
      var meta =
        escapeHtml(kindLabel(item.materialKind)) +
        ' · ' +
        escapeHtml(formatDurationMs(item.durationMs)) +
        ' · ' +
        escapeHtml(sourceLabel(item.sourceChannel));
      var prompt =
        item.promptText && String(item.promptText).trim()
          ? '<div class="muted" style="font-size:11px;margin-top:4px;">' + escapeHtml(item.promptText) + '</div>'
          : '';
      var importDisabled = !item.playable;
      row.innerHTML =
        '<div style="font-weight:700;font-size:13px;">' +
        title +
        '</div>' +
        '<div class="muted" style="font-size:11px;margin-top:2px;">' +
        meta +
        '</div>' +
        prompt +
        '<div style="margin-top:8px;">' +
        '<button type="button" class="btn mini cloudMaterialsImportBtn" data-asset-id="' +
        escapeHtml(item.id) +
        '" data-title="' +
        escapeHtml(item.title || item.id) +
        '"' +
        (importDisabled ? ' disabled' : '') +
        '>' +
        escapeHtml(t('cloudMaterials.import', 'Import')) +
        '</button>' +
        (importDisabled
          ? '<span class="muted" style="font-size:11px;margin-left:8px;">' +
            escapeHtml(t('cloudMaterials.notPlayable', 'Not playable')) +
            '</span>'
          : '') +
        '</div>';
      list.appendChild(row);
    });
    list.querySelectorAll('.cloudMaterialsImportBtn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var assetId = btn.getAttribute('data-asset-id');
        var title = btn.getAttribute('data-title') || assetId;
        void importMaterial(assetId, title, btn);
      });
    });
  }

  async function importMaterial(assetId, title, btn) {
    if (!assetId) return;
    if (typeof window.H2S_REQUEST_CLOUD_MATERIAL_CONTENT !== 'function') {
      setStatus(t('cloudMaterials.bridgeMissing', 'Cloud bridge unavailable.'), true);
      return;
    }
    if (btn) btn.disabled = true;
    setStatus(t('cloudMaterials.importing', 'Importing from cloud…'), false);
    window.H2S_REQUEST_CLOUD_MATERIAL_CONTENT(assetId, title);
    var detail = await waitForContentResponse();
    if (btn) btn.disabled = false;
    if (!detail || !detail.ok || !(detail.audioBuffer instanceof ArrayBuffer)) {
      setStatus(mapContentError(detail && detail.error), true);
      return;
    }
    var app = getApp();
    if (!app || typeof app._commitNativeAudioFile !== 'function') {
      setStatus(t('cloudMaterials.importUnavailable', 'Audio import is unavailable in Studio.'), true);
      return;
    }
    var mime = detail.mimeType || 'audio/mpeg';
    var blob = new Blob([detail.audioBuffer], { type: mime });
    var ext =
      mime.indexOf('wav') >= 0 ? '.wav' : mime.indexOf('ogg') >= 0 ? '.ogg' : mime.indexOf('mpeg') >= 0 || mime.indexOf('mp3') >= 0 ? '.mp3' : '.audio';
    try {
      var file = new File([blob], (detail.title || title || 'cloud-material') + ext, { type: mime });
      var res = await app._commitNativeAudioFile(file, {
        baseName: detail.title || title || 'Cloud material',
        statusDoneKey: 'cloudMaterials.importDone',
      });
      if (!res || res.ok !== true) {
        setStatus(t('cloudMaterials.importFailed', 'Import failed.'), true);
        return;
      }
      setStatus(t('cloudMaterials.importDone', 'Imported to clip library.'), false);
    } catch (e) {
      console.warn('[cloud_materials_panel] import failed', e);
      setStatus(t('cloudMaterials.importFailed', 'Import failed.'), true);
    }
  }

  function mapContentError(code) {
    var key = typeof code === 'string' ? code : '';
    if (key === 'auth_required' || key === 'materials_inspiration_login_required')
      return t('cloudMaterials.authRequired', 'Sign in to Hum2Song Cloud to import materials.');
    if (key === 'materials_no_playable_audio') return t('cloudMaterials.noPlayable', 'This material has no playable audio.');
    if (key === 'materials_audio_load_failed') return t('cloudMaterials.loadFailed', 'Could not load material audio.');
    if (key === 'bad_request') return t('cloudMaterials.badRequest', 'Invalid material request.');
    return t('cloudMaterials.importFailed', 'Import failed.');
  }

  function mapListError(code) {
    var key = typeof code === 'string' ? code : '';
    if (key === 'auth_required') return t('cloudMaterials.authRequired', 'Sign in to Hum2Song Cloud to import materials.');
    if (key === 'list_failed') return t('cloudMaterials.listFailed', 'Could not load cloud materials.');
    return t('cloudMaterials.listFailed', 'Could not load cloud materials.');
  }

  function waitForListResponse() {
    return new Promise(function (resolve) {
      var done = false;
      var onEvt = function (ev) {
        if (done) return;
        done = true;
        window.removeEventListener('h2s-cloud-materials-list', onEvt);
        resolve(ev && ev.detail ? ev.detail : null);
      };
      window.addEventListener('h2s-cloud-materials-list', onEvt);
      setTimeout(function () {
        if (done) return;
        done = true;
        window.removeEventListener('h2s-cloud-materials-list', onEvt);
        resolve({ ok: false, error: 'timeout' });
      }, 30000);
    });
  }

  function waitForContentResponse() {
    return new Promise(function (resolve) {
      var done = false;
      var onEvt = function (ev) {
        if (done) return;
        done = true;
        window.removeEventListener('h2s-cloud-material-content', onEvt);
        resolve(ev && ev.detail ? ev.detail : null);
      };
      window.addEventListener('h2s-cloud-material-content', onEvt);
      setTimeout(function () {
        if (done) return;
        done = true;
        window.removeEventListener('h2s-cloud-material-content', onEvt);
        resolve({ ok: false, error: 'timeout' });
      }, 60000);
    });
  }

  async function refreshList() {
    if (typeof window.H2S_REQUEST_CLOUD_MATERIALS_LIST !== 'function') {
      setStatus(t('cloudMaterials.bridgeMissing', 'Cloud bridge unavailable.'), true);
      return;
    }
    setStatus(t('cloudMaterials.loading', 'Loading cloud materials…'), false);
    window.H2S_REQUEST_CLOUD_MATERIALS_LIST();
    var detail = await waitForListResponse();
    if (!detail || detail.ok !== true) {
      setStatus(mapListError(detail && detail.error), true);
      renderList([]);
      return;
    }
    setStatus('', false);
    renderList(detail.materials || []);
  }

  function applyCloudModeUi() {
    var section = document.getElementById('cloudMaterialsSection');
    var standalone = document.getElementById('cloudMaterialsStandalone');
    var refresh = document.getElementById('btnCloudMaterialsRefresh');
    if (!section) return;
    if (isCloudEmbed()) {
      window.H2S_CLOUD_MODE = true;
      section.style.display = 'block';
      if (standalone) standalone.style.display = 'none';
      if (refresh) refresh.style.display = 'inline-block';
    } else {
      section.style.display = 'block';
      if (standalone) standalone.style.display = 'block';
      if (refresh) refresh.style.display = 'none';
      var panel = document.getElementById('cloudMaterialsPanel');
      if (panel) panel.style.display = 'none';
    }
  }

  function bindUi() {
    var toggle = document.getElementById('btnCloudMaterials');
    var panel = document.getElementById('cloudMaterialsPanel');
    var refresh = document.getElementById('btnCloudMaterialsRefresh');
    if (toggle && panel) {
      toggle.addEventListener('click', function () {
        var open = panel.style.display !== 'none';
        panel.style.display = open ? 'none' : 'block';
        if (!open && isCloudEmbed()) void refreshList();
      });
    }
    if (refresh) {
      refresh.addEventListener('click', function () {
        void refreshList();
      });
    }
  }

  function boot() {
    applyCloudModeUi();
    bindUi();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
