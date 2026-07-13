/* Hum2Song Studio - selection_view.js
   Pure view helpers (no DOM) for the Inspector selection panel.
   - Browser: window.H2SSelectionView
   - Node tests: module.exports
*/
(function(){
  'use strict';

  function audioSegmentPanelHTML(opts){
    const escapeHtml = opts.escapeHtml || ((s)=>String(s));
    const fmtSec = opts.fmtSec || ((x)=>String(x));
    const audioDur = Number(opts.audioDurationSec || 0);
    const startSec = Number(opts.segmentStartSec || 0);
    const durationSec = Number(opts.segmentDurationSec || 30);
    const endSec = startSec + durationSec;
    const audioDurLabel = (opts.audioDurationLabel != null) ? String(opts.audioDurationLabel) : fmtSec(audioDur);
    const startLabel = (opts.segmentStartLabel != null) ? String(opts.segmentStartLabel) : 'Start';
    const lenLabel = (opts.segmentLengthLabel != null) ? String(opts.segmentLengthLabel) : 'Length';
    const endLabel = (opts.segmentEndLabel != null) ? String(opts.segmentEndLabel) : 'End';
    const atPlayheadLabel = (opts.atPlayheadLabel != null) ? String(opts.atPlayheadLabel) : 'Start at playhead';
    const preset15 = (opts.preset15Label != null) ? String(opts.preset15Label) : '15s';
    const preset30 = (opts.preset30Label != null) ? String(opts.preset30Label) : '30s';
    const preset60 = (opts.preset60Label != null) ? String(opts.preset60Label) : '60s';
    const convertActive = !!opts.convertActive;
    const convertLabel = (opts.convertLabel != null) ? String(opts.convertLabel) : 'Convert selected segment';
    const advancedTitle = (opts.advancedSegmentTitle != null) ? String(opts.advancedSegmentTitle) : 'Advanced segment settings';
    const target = String(opts.transcriptionTarget || 'auto');
    const cleanupStrength = Math.max(0, Math.min(100, Math.round(Number(opts.cleanupStrength == null ? 50 : opts.cleanupStrength))));
    const preserveRawCandidates = !!opts.preserveRawCandidates;
    const targetLabel = String(opts.transcriptionTargetLabel || 'Transcription target');
    const cleanupLabel = String(opts.cleanupStrengthLabel || 'Cleanup strength');
    const cleanupMoreNotes = String(opts.cleanupPreserveLabel || 'Preserve more notes');
    const cleanupBalanced = String(opts.cleanupBalancedLabel || 'Balanced');
    const cleanupCleaner = String(opts.cleanupCleanerLabel || 'Cleaner result');
    const preserveRawLabel = String(opts.preserveRawCandidatesLabel || 'Preserve raw recognition candidates');
    const targetHelp = String(opts.transcriptionTargetHelp || '');
    const targetOptions = Array.isArray(opts.transcriptionTargetOptions) ? opts.transcriptionTargetOptions : [];
    const targetOptionsHtml = targetOptions.map((item) => {
      const value = String(item && item.value || '');
      const label = String(item && item.label || value);
      return `<option value="${escapeHtml(value)}"${value === target ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
    const inner =
        `<div class="kv"><b>${escapeHtml((opts.audioDurationTitle != null) ? opts.audioDurationTitle : 'Audio')}</b><span>${escapeHtml(audioDurLabel)}</span></div>` +
        `<div class="kv"><b>${escapeHtml(startLabel)}</b><span data-role="segStart">${escapeHtml(fmtSec(startSec))}</span></div>` +
        `<div class="kv"><b>${escapeHtml(lenLabel)}</b><span data-role="segLen">${escapeHtml(fmtSec(durationSec))}</span></div>` +
        `<div class="kv"><b>${escapeHtml(endLabel)}</b><span data-role="segEnd">${escapeHtml(fmtSec(endSec))}</span></div>` +
        `<div class="row" style="margin-top:6px;flex-wrap:wrap;gap:4px;">` +
          `<button type="button" class="btn mini" data-act="segAtPlayhead"${convertActive ? ' disabled' : ''}>${escapeHtml(atPlayheadLabel)}</button>` +
          `<button type="button" class="btn mini" data-act="segLen15" data-len="15"${convertActive ? ' disabled' : ''}>${escapeHtml(preset15)}</button>` +
          `<button type="button" class="btn mini" data-act="segLen30" data-len="30"${convertActive ? ' disabled' : ''}>${escapeHtml(preset30)}</button>` +
          `<button type="button" class="btn mini" data-act="segLen60" data-len="60"${convertActive ? ' disabled' : ''}>${escapeHtml(preset60)}</button>` +
        `</div>` +
        `<div class="h2s-transcription-controls" style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);">` +
          `<label style="display:block;">` +
            `<span style="display:block;margin-bottom:4px;color:var(--muted);">${escapeHtml(targetLabel)}</span>` +
            `<select data-field="transcriptionTarget" style="width:100%;"${convertActive ? ' disabled' : ''}>${targetOptionsHtml}</select>` +
          `</label>` +
          (targetHelp ? `<p data-role="transcriptionTargetHelp" style="margin:5px 0 0;color:var(--muted);line-height:1.4;">${escapeHtml(targetHelp)}</p>` : '') +
          `<label style="display:block;margin-top:9px;">` +
            `<span style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;color:var(--muted);">` +
              `<span>${escapeHtml(cleanupLabel)}</span><output data-role="cleanupStrengthValue">${cleanupStrength}</output>` +
            `</span>` +
            `<input type="range" min="0" max="100" step="5" value="${cleanupStrength}" data-field="cleanupStrength" style="width:100%;"${convertActive ? ' disabled' : ''}>` +
            `<span style="display:flex;justify-content:space-between;gap:6px;font-size:10px;color:var(--muted);">` +
              `<span>${escapeHtml(cleanupMoreNotes)}</span><span>${escapeHtml(cleanupBalanced)}</span><span style="text-align:right;">${escapeHtml(cleanupCleaner)}</span>` +
            `</span>` +
          `</label>` +
          `<label style="display:flex;align-items:flex-start;gap:6px;margin-top:9px;cursor:pointer;">` +
            `<input type="checkbox" data-field="preserveRawCandidates"${preserveRawCandidates ? ' checked' : ''}${convertActive ? ' disabled' : ''}>` +
            `<span>${escapeHtml(preserveRawLabel)}</span>` +
          `</label>` +
        `</div>` +
        `<div class="row" style="margin-top:8px;">` +
          `<button id="btnSelConvertAudio" class="btn mini" type="button" data-act="convertAudioEditable" title="${escapeHtml(convertLabel)}"${convertActive ? ' disabled' : ''}>${escapeHtml(convertLabel)}</button>` +
        `</div>`;
    return (
      `<details class="h2s-audio-segment-advanced" style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;">` +
        `<summary style="cursor:pointer;user-select:none;color:var(--muted);font-weight:500;">${escapeHtml(advancedTitle)}</summary>` +
        `<div class="h2s-audio-segment-panel" style="margin-top:8px;">${inner}</div>` +
      `</details>`
    );
  }

  function selectionBoxInnerHTML(opts){
    const clipName = opts.clipName || opts.clipId || '—';
    const startSec = Number(opts.startSec || 0);
    const transpose = Number(opts.transpose || 0);
    const fmtSec = opts.fmtSec || ((x)=>String(x));
    const escapeHtml = opts.escapeHtml || ((s)=>String(s));
    const isAudio = !!opts.isAudio;
    const convertLabel = (opts.convertLabel != null && String(opts.convertLabel)) ? String(opts.convertLabel) : 'Convert selected segment';
    const showAudioSegment = !!opts.showAudioSegment;
    const addBassLabel = (opts.addBassLabel != null && String(opts.addBassLabel)) ? String(opts.addBassLabel) : 'Add Bass';
    const addAccompLabel = (opts.addAccompanimentLabel != null && String(opts.addAccompanimentLabel)) ? String(opts.addAccompanimentLabel) : 'Add accompaniment';
    const addAccompBadge = (opts.addAccompanimentBadgeLabel != null && String(opts.addAccompanimentBadgeLabel)) ? String(opts.addAccompanimentBadgeLabel) : 'Experimental';
    const editBtn = isAudio
      ? ''
      : `<button id="btnSelEdit" class="btn mini" data-act="edit">Edit</button>`;
    const audioConvertBtn = (isAudio && !showAudioSegment)
      ? `<button id="btnSelConvertAudio" class="btn mini" type="button" data-act="convertAudioEditable" title="${escapeHtml(convertLabel)}">${escapeHtml(convertLabel)}</button>`
      : '';
    const audioSegmentBlock = (isAudio && showAudioSegment && typeof audioSegmentPanelHTML === 'function')
      ? audioSegmentPanelHTML({
          escapeHtml,
          fmtSec,
          audioDurationSec: opts.audioDurationSec,
          segmentStartSec: opts.segmentStartSec,
          segmentDurationSec: opts.segmentDurationSec,
          audioDurationTitle: opts.audioDurationTitle,
          audioDurationLabel: opts.audioDurationLabel,
          segmentStartLabel: opts.segmentStartLabel,
          segmentLengthLabel: opts.segmentLengthLabel,
          segmentEndLabel: opts.segmentEndLabel,
          atPlayheadLabel: opts.atPlayheadLabel,
          preset15Label: opts.preset15Label,
          preset30Label: opts.preset30Label,
          preset60Label: opts.preset60Label,
          convertLabel,
          convertActive: opts.convertActive,
          advancedSegmentTitle: opts.advancedSegmentTitle,
          transcriptionTarget: opts.transcriptionTarget,
          cleanupStrength: opts.cleanupStrength,
          preserveRawCandidates: opts.preserveRawCandidates,
          transcriptionTargetLabel: opts.transcriptionTargetLabel,
          cleanupStrengthLabel: opts.cleanupStrengthLabel,
          cleanupPreserveLabel: opts.cleanupPreserveLabel,
          cleanupBalancedLabel: opts.cleanupBalancedLabel,
          cleanupCleanerLabel: opts.cleanupCleanerLabel,
          preserveRawCandidatesLabel: opts.preserveRawCandidatesLabel,
          transcriptionTargetHelp: opts.transcriptionTargetHelp,
          transcriptionTargetOptions: opts.transcriptionTargetOptions,
        })
      : '';
    const addBassBtn = isAudio
      ? ''
      : `<button id="btnSelAddBass" class="btn mini" type="button" data-act="addBass">${escapeHtml(addBassLabel)}</button>`;
    const addAccompBtn = isAudio
      ? ''
      : `<button id="btnSelAddAccompaniment" class="btn mini" type="button" data-act="addAccompaniment">${escapeHtml(addAccompLabel)} <span class="badge" style="font-size:10px;opacity:.9;margin-left:4px;vertical-align:middle;">${escapeHtml(addAccompBadge)}</span></button>`;
    const moreInstrSummary = (opts.addAccompanimentMoreInstructionsLabel != null && String(opts.addAccompanimentMoreInstructionsLabel))
      ? String(opts.addAccompanimentMoreInstructionsLabel)
      : 'More instructions (optional)';
    const addAccompInstrBlock = isAudio
      ? ''
      : `<details class="h2s-add-accomp-hint" style="margin-top:8px;font-size:11px;opacity:.9;">
        <summary style="cursor:pointer;user-select:none;color:var(--muted);font-weight:500;" data-i18n="arrange.addAccompanimentMoreInstructions">${escapeHtml(moreInstrSummary)}</summary>
        <textarea id="txtSelAddAccompInstr" data-field="addAccompUserPrompt" rows="2" data-i18n-placeholder="arrange.addAccompanimentInstructionPlaceholder" placeholder="" style="width:100%;box-sizing:border-box;margin-top:6px;font-size:11px;resize:vertical;min-height:40px;max-height:120px;padding:4px 6px;border-radius:4px;border:1px solid var(--hairline, rgba(128,128,128,.35));background:var(--panel, transparent);color:inherit;"></textarea>
      </details>`;
    const showArrDet = !!opts.showArrangementDetails && !isAudio;
    const arrDetLabel = (opts.arrangementDetailsLabel != null && String(opts.arrangementDetailsLabel)) ? String(opts.arrangementDetailsLabel) : 'Arrangement Details';
    const arrangementDetailsRow = showArrDet
      ? `<div class="row" style="margin-top:8px; flex-wrap:wrap; gap:4px;"><button type="button" id="btnSelArrangementDetails" class="btn mini ghost lastOptDetailsBtn" data-act="arrangementDetails" data-i18n="arrange.detailsShort" style="font-size:10px !important;">${escapeHtml(arrDetLabel)}</button></div>`
      : '';

    return `
      <div class="kv"><b>Clip</b><span>${escapeHtml(clipName)}</span></div>
      <div class="kv"><b>Start</b><span>${fmtSec(startSec)}</span></div>
      <div class="kv"><b>Transpose</b><span>${transpose}</span></div>
      <div class="row" style="margin-top:10px;">
        ${editBtn}
        ${audioConvertBtn}
        ${addBassBtn}
        ${addAccompBtn}
        <button id="btnSelDup" class="btn mini" data-act="duplicate">Duplicate</button>
        <button id="btnSelDel" class="btn mini danger" data-act="remove">Remove</button>
      </div>
      ${addAccompInstrBlock}
      ${arrangementDetailsRow}
      ${audioSegmentBlock}
    `;
  }

  const api = { selectionBoxInnerHTML, audioSegmentPanelHTML };

  // Browser global
  if (typeof window !== 'undefined'){
    window.H2SSelectionView = api;
  }

  // Node export
  if (typeof module !== 'undefined' && module.exports){
    module.exports = api;
  }
})();
