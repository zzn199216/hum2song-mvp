(function(root, factory){
  if (typeof module === 'object' && module.exports){
    module.exports = factory();
  } else {
    root.H2SAccompanimentDraftV1 = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  var DRUM_PITCH = {
    kick: 36,
    bass_drum: 36,
    snare: 38,
    clap: 39,
    hat: 42,
    hihat: 42,
    closed_hat: 42,
    open_hat: 46,
    ride: 51,
    crash: 49,
    tom: 45,
    perc: 45,
    percussion: 45,
  };

  var FALLBACK_INSTRUMENT_OPTIONS = [
    { value: 'default', label: 'Piano', labelKey: 'instrument.name.piano', category: 'keyboard' },
    { value: 'bass', label: 'Bass', labelKey: 'instrument.name.bass', category: 'bass' },
    { value: 'lead', label: 'Lead', labelKey: 'instrument.name.lead', category: 'synth' },
    { value: 'pad', label: 'Pad', labelKey: 'instrument.name.pad', category: 'synth' },
    { value: 'pluck', label: 'Pluck', labelKey: 'instrument.name.pluck', category: 'pluck' },
    { value: 'drum', label: 'Drums', labelKey: 'instrument.name.drums', category: 'drums' },
    { value: 'sampler:tonejs:piano', label: 'Sampled Piano', labelKey: 'instrument.name.sampledPiano', category: 'sampled' },
    { value: 'sampler:tonejs:strings', label: 'Sampled Strings', labelKey: 'instrument.name.sampledStrings', category: 'sampled' },
    { value: 'sampler:tonejs:bass', label: 'Sampled Bass', labelKey: 'instrument.name.sampledBass', category: 'sampled' },
    { value: 'sampler:tonejs:guitar-acoustic', label: 'Sampled Acoustic Guitar', labelKey: 'instrument.name.sampledGuitarAcoustic', category: 'sampled' },
    { value: 'sampler:tonejs:guitar-electric', label: 'Sampled Electric Guitar', labelKey: 'instrument.name.sampledGuitarElectric', category: 'sampled' },
  ];

  var LABEL_FALLBACKS = {
    'instrument.name.piano': 'Piano',
    'instrument.name.bass': 'Bass',
    'instrument.name.lead': 'Lead',
    'instrument.name.pad': 'Pad',
    'instrument.name.pluck': 'Pluck',
    'instrument.name.drums': 'Drums',
    'instrument.name.sampledPiano': 'Sampled Piano',
    'instrument.name.sampledStrings': 'Sampled Strings',
    'instrument.name.sampledBass': 'Sampled Bass',
    'instrument.name.sampledGuitarAcoustic': 'Sampled Acoustic Guitar',
    'instrument.name.sampledGuitarElectric': 'Sampled Electric Guitar',
  };

  function isFiniteNumber(x){
    return typeof x === 'number' && isFinite(x);
  }

  function asString(x){
    return x == null ? '' : String(x);
  }

  function safeTrim(x){
    return asString(x).trim();
  }

  function clamp(n, a, b){
    return Math.max(a, Math.min(b, n));
  }

  function compact(n){
    return Math.round(Number(n) * 1000) / 1000;
  }

  function allowedTailOverrunBeat(spanBeat){
    var span = Number(spanBeat);
    if (!isFiniteNumber(span) || span <= 0) return 0.5;
    return Math.min(2.0, Math.max(0.5, span * 0.05));
  }

  function allowedTailBoundaryBeat(spanBeat){
    var span = Number(spanBeat);
    if (!isFiniteNumber(span) || span <= 0) span = 0;
    return span + allowedTailOverrunBeat(span);
  }

  function deepClone(x){
    if (!x) return x;
    try { return JSON.parse(JSON.stringify(x)); } catch (_) { return x; }
  }

  function runtimeRoot(){
    if (typeof window !== 'undefined') return window;
    if (typeof globalThis !== 'undefined') return globalThis;
    return {};
  }

  function labelFromKey(labelKey){
    var key = safeTrim(labelKey);
    if (!key) return '';
    var root = runtimeRoot();
    var i18n = root && root.I18N;
    if (i18n && typeof i18n.t === 'function'){
      try {
        var localized = safeTrim(i18n.t(key));
        if (localized && localized !== key) return localized;
      } catch (_) {}
    }
    return LABEL_FALLBACKS[key] || key;
  }

  function normalizeInstrumentOption(option){
    var raw = option && typeof option === 'object' ? option : {};
    var value = safeTrim(raw.value || raw.legacyKey || raw.v || raw.id);
    if (!value) return null;
    var labelKey = safeTrim(raw.labelKey || raw.i18nNameKey || raw.l);
    var label = safeTrim(raw.label || raw.name || raw.displayName) || labelFromKey(labelKey) || value;
    return {
      value: value,
      label: label,
      labelKey: labelKey || null,
      manifestId: safeTrim(raw.manifestId || raw.id) || null,
      category: safeTrim(raw.category) || null,
      engineType: safeTrim(raw.engineType) || null,
    };
  }

  function getSelectableInstrumentOptions(opts){
    var cfg = opts && typeof opts === 'object' ? opts : {};
    var rawOptions = null;
    if (Array.isArray(cfg.instrumentOptions)){
      rawOptions = cfg.instrumentOptions;
    } else {
      var root = runtimeRoot();
      var manifestApi = cfg.instrumentManifest || (root && root.H2SInstrumentManifest);
      if (manifestApi && typeof manifestApi.getSelectableInstrumentOptions === 'function'){
        try { rawOptions = manifestApi.getSelectableInstrumentOptions(); } catch (_) { rawOptions = null; }
      }
    }
    if (!Array.isArray(rawOptions) || rawOptions.length < 1) rawOptions = FALLBACK_INSTRUMENT_OPTIONS;

    var out = [];
    var seen = {};
    for (var i = 0; i < rawOptions.length; i++){
      var opt = normalizeInstrumentOption(rawOptions[i]);
      if (!opt || seen[opt.value]) continue;
      seen[opt.value] = true;
      out.push(opt);
    }

    if (!Array.isArray(cfg.instrumentOptions)){
      var rootObj = runtimeRoot();
      var custom = rootObj && Array.isArray(rootObj.__h2s_custom_instruments) ? rootObj.__h2s_custom_instruments : [];
      for (var ci = 0; ci < custom.length; ci++){
        var c = custom[ci] || {};
        var packId = safeTrim(c.packId || c.value);
        if (!packId) continue;
        var val = safeTrim(c.value) || ((safeTrim(c.kind).toLowerCase() === 'oneshot') ? ('oneshot:' + packId) : ('sampler:' + packId));
        if (!val || seen[val]) continue;
        seen[val] = true;
        out.push({
          value: val,
          label: safeTrim(c.displayName || c.name || packId) || val,
          labelKey: null,
          manifestId: null,
          category: 'custom',
          engineType: safeTrim(c.kind) || null,
        });
      }
    }
    return out;
  }

  function optionSearchText(option){
    if (!option) return '';
    return [
      option.value,
      option.label,
      option.labelKey,
      option.manifestId,
      option.category,
      option.engineType,
    ].map(safeTrim).join(' ').toLowerCase();
  }

  function uniquePush(arr, value){
    var v = safeTrim(value);
    if (v && arr.indexOf(v) < 0) arr.push(v);
  }

  function rolePlanFromObject(raw){
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.requestedRoles) && !safeTrim(raw.patternRole)) return null;
    var roles = [];
    var src = Array.isArray(raw.requestedRoles) ? raw.requestedRoles : [];
    for (var i = 0; i < src.length; i++) uniquePush(roles, safeTrim(src[i]).toLowerCase());
    var patternRole = normalizePatternRole(raw.patternRole || (roles[0] || 'chords'));
    var plan = {
      requestedRoles: roles,
      requestedPartCount: Math.max(1, Math.floor(Number(raw.requestedPartCount) || roles.length || 1)),
      requestedInstrument: safeTrim(raw.requestedInstrument) || null,
      patternRole: patternRole,
      isGenericAccompaniment: !!raw.isGenericAccompaniment,
      partTypes: Array.isArray(raw.partTypes) ? raw.partTypes.map(function(x){ return safeTrim(x).toLowerCase(); }).filter(Boolean) : null,
    };
    if (!plan.partTypes || !plan.partTypes.length) plan.partTypes = partTypesForRoles(plan.requestedRoles, plan.isGenericAccompaniment);
    return plan;
  }

  function normalizePatternRole(value){
    var raw = safeTrim(value).toLowerCase();
    if (raw === 'drum') return 'drums';
    if (raw === 'chord' || raw === 'piano_chords' || raw === 'piano') return 'chords';
    if (raw === 'guitar' || raw === 'guitar_style' || raw === 'electric_guitar' || raw === 'acoustic_guitar') return 'riff';
    if (raw === 'strings' || raw === 'string') return 'pad';
    if (raw === 'arpeggiated') return 'arpeggio';
    if (raw === 'bass' || raw === 'drums' || raw === 'chords' || raw === 'arpeggio' || raw === 'riff' || raw === 'pad') return raw;
    return 'chords';
  }

  function normalizeHarmonicRole(value, patternRole){
    var raw = safeTrim(value).toLowerCase();
    if (raw === 'chord' || raw === 'piano_chords') return 'chords';
    if (raw === 'electric_guitar' || raw === 'acoustic_guitar' || raw === 'guitar_style' || raw === 'riff') return 'guitar';
    if (raw === 'string') return 'strings';
    if (raw === 'arpeggiated') return 'arpeggio';
    if (raw === 'piano' || raw === 'chords' || raw === 'arpeggio' || raw === 'guitar' || raw === 'strings' || raw === 'pad') return raw;
    var pr = normalizePatternRole(patternRole);
    if (pr === 'riff') return 'guitar';
    if (pr === 'pad') return 'pad';
    if (pr === 'arpeggio') return 'arpeggio';
    return 'chords';
  }

  function partTypesForRoles(roles, isGeneric){
    var out = [];
    var hasHarmonic = !!isGeneric;
    var list = Array.isArray(roles) ? roles : [];
    for (var i = 0; i < list.length; i++){
      var r = safeTrim(list[i]).toLowerCase();
      if (r === 'bass') uniquePush(out, 'bass');
      else if (r === 'drums' || r === 'drum') uniquePush(out, 'drums');
      else if (r) hasHarmonic = true;
    }
    if (hasHarmonic || out.length < 1) uniquePush(out, 'harmonic');
    return out;
  }

  function createAccompanimentRolePlan(input){
    var ctx = input && typeof input === 'object' && typeof input !== 'string' ? input : { userPrompt: input };
    var existing = rolePlanFromObject(ctx && ctx.rolePlan);
    if (existing) return existing;

    var text = safeTrim(ctx && (ctx.userPrompt || ctx.prompt || ctx.text));
    var low = text.toLowerCase();
    var roles = [];
    var requestedInstrument = null;

    var hasElectricGuitar = /\belectric\s+guitar\b/.test(low) || /电吉他/.test(text);
    var hasAcousticGuitar = /\bacoustic\s+guitar\b/.test(low) || /原声吉他|木吉他/.test(text);
    var hasGuitar = hasElectricGuitar || hasAcousticGuitar || /\bguitars?\b/.test(low) || /吉他/.test(text);
    var hasPiano = /\bpianos?\b/.test(low) || /钢琴|鋼琴/.test(text);
    var hasArpeggio = /\barpeggios?\b|\barpeggiated\b/.test(low) || /分解和弦/.test(text);
    var hasChords = /\bchords?\b/.test(low) || /和弦/.test(text);
    var hasStrings = /\bstrings?\b|\bstring\s+section\b/.test(low) || /弦乐|弦樂/.test(text);
    var hasPad = /\bpads?\b|\batmospheric\b|\bambient\b/.test(low) || /氛围|氛圍/.test(text);
    var hasBass = /\bbass\b|\bbassline\b|\bbass line\b/.test(low) || /贝斯|貝斯|低音/.test(text);
    var hasDrums = /\bdrums?\b|\bbeats?\b|\bpercussion\b|\bdrum\s+hits?\b/.test(low) || /鼓点|鼓點|鼓|打击|打擊/.test(text);
    var hasAccompaniment = /\baccompaniment\b|\bbacking\s+track\b|\barrangement\b/.test(low) || /伴奏|编曲|編曲/.test(text);

    if (hasGuitar){
      uniquePush(roles, 'guitar');
      requestedInstrument = hasElectricGuitar ? 'electric guitar' : (hasAcousticGuitar ? 'acoustic guitar' : 'guitar');
    }
    if (hasPiano){
      uniquePush(roles, 'piano');
      if (!requestedInstrument) requestedInstrument = 'piano';
    }
    if (hasArpeggio) uniquePush(roles, 'arpeggio');
    if (hasChords) uniquePush(roles, 'chords');
    if (hasStrings){
      uniquePush(roles, 'strings');
      if (!requestedInstrument) requestedInstrument = 'strings';
    }
    if (hasPad){
      uniquePush(roles, 'pad');
      if (!requestedInstrument) requestedInstrument = 'pad';
    }
    if (hasBass){
      uniquePush(roles, 'bass');
      if (!requestedInstrument && !hasDrums) requestedInstrument = 'bass';
    }
    if (hasDrums){
      uniquePush(roles, 'drums');
      if (!requestedInstrument && !hasBass) requestedInstrument = 'drums';
    }

    var isGeneric = roles.length < 1 && (hasAccompaniment || !text);
    if (isGeneric) uniquePush(roles, 'chords');

    if (roles.length < 1) uniquePush(roles, 'chords');

    var patternRole = 'chords';
    if (hasDrums && !hasBass && roles.length === 1) patternRole = 'drums';
    else if (hasBass && !hasDrums && roles.length === 1) patternRole = 'bass';
    else if (hasArpeggio) patternRole = 'arpeggio';
    else if (hasGuitar) patternRole = 'riff';
    else if (hasStrings || hasPad) patternRole = 'pad';
    else patternRole = 'chords';

    var partTypes = partTypesForRoles(roles, isGeneric);
    return {
      requestedRoles: roles,
      requestedPartCount: partTypes.length,
      requestedInstrument: requestedInstrument,
      patternRole: patternRole,
      isGenericAccompaniment: isGeneric,
      partTypes: partTypes,
    };
  }

  function desiredInstrumentForPlan(plan){
    var p = plan || {};
    var requested = safeTrim(p.requestedInstrument).toLowerCase();
    var roles = Array.isArray(p.requestedRoles) ? p.requestedRoles.map(function(x){ return safeTrim(x).toLowerCase(); }) : [];
    if (requested.indexOf('electric') >= 0 || roles.indexOf('electric_guitar') >= 0) return 'electric_guitar';
    if (requested.indexOf('guitar') >= 0 || roles.indexOf('guitar') >= 0) return 'guitar';
    if (requested.indexOf('string') >= 0 || roles.indexOf('strings') >= 0) return 'strings';
    if (requested.indexOf('pad') >= 0 || roles.indexOf('pad') >= 0) return 'pad';
    if (requested.indexOf('bass') >= 0 || roles.indexOf('bass') >= 0) return 'bass';
    if (requested.indexOf('drum') >= 0 || roles.indexOf('drums') >= 0) return 'drums';
    if (requested.indexOf('piano') >= 0 || roles.indexOf('piano') >= 0 || roles.indexOf('chords') >= 0 || roles.indexOf('arpeggio') >= 0) return 'piano';
    return 'piano';
  }

  function findInstrumentOption(options, preferredValues, searchTerms){
    var list = Array.isArray(options) ? options : [];
    for (var vi = 0; vi < preferredValues.length; vi++){
      var pref = safeTrim(preferredValues[vi]);
      if (!pref) continue;
      for (var oi = 0; oi < list.length; oi++){
        if (list[oi] && list[oi].value === pref) return list[oi];
      }
    }
    for (var ti = 0; ti < searchTerms.length; ti++){
      var term = safeTrim(searchTerms[ti]).toLowerCase();
      if (!term) continue;
      for (var ii = 0; ii < list.length; ii++){
        if (optionSearchText(list[ii]).indexOf(term) >= 0) return list[ii];
      }
    }
    return null;
  }

  function resolveAccompanimentInstrument(planOrInput, opts){
    var cfg = opts && typeof opts === 'object' ? opts : {};
    var plan = rolePlanFromObject(planOrInput) || createAccompanimentRolePlan(planOrInput);
    var options = getSelectableInstrumentOptions(cfg);
    var desired = desiredInstrumentForPlan(plan);
    var requested = safeTrim(plan.requestedInstrument) || null;
    var search = [];
    var preferred = [];
    if (desired === 'electric_guitar'){
      preferred = ['sampler:tonejs:guitar-electric'];
      search = ['electric guitar', 'electric', '电吉他', 'guitar'];
    } else if (desired === 'guitar'){
      preferred = ['sampler:tonejs:guitar-acoustic'];
      search = ['acoustic guitar', 'guitar', '吉他'];
    } else if (desired === 'strings'){
      preferred = ['sampler:tonejs:strings'];
      search = ['strings', 'string', '弦乐', '弦樂'];
    } else if (desired === 'pad'){
      preferred = ['pad'];
      search = ['pad', 'ambient', '氛围', '氛圍'];
    } else if (desired === 'bass'){
      preferred = ['bass', 'sampler:tonejs:bass'];
      search = ['bass', '贝斯', '貝斯', '低音'];
    } else if (desired === 'drums'){
      preferred = ['drum'];
      search = ['drum', 'drums', '鼓'];
    } else {
      preferred = ['default', 'sampler:tonejs:piano'];
      search = ['piano', 'keyboard', '钢琴', '鋼琴'];
    }
    var match = findInstrumentOption(options, preferred, search);
    var fallbackReason = '';
    if (!match){
      match = findInstrumentOption(options, ['default'], ['piano']) || options[0] || normalizeInstrumentOption({ value: 'default', label: 'Piano' });
      if (requested){
        fallbackReason = 'Requested ' + requested + '; used ' + (match && match.label ? match.label : safeTrim(match && match.value) || 'default') + ' because the requested instrument is not available. You can change the track instrument.';
      } else if (!findInstrumentOption(options, ['default'], [])){
        fallbackReason = 'Used the first available instrument because default piano is not available.';
      }
    }
    if (!match) match = normalizeInstrumentOption({ value: 'default', label: 'Piano' });
    return {
      requestedInstrument: requested,
      usedInstrument: match.value,
      usedInstrumentLabel: match.label || match.value,
      fallbackReason: fallbackReason,
    };
  }

  function collectForbiddenDraftFields(x){
    var out = [];
    var seen = new Set();
    function walk(v, path){
      if (!v || typeof v !== 'object') return;
      if (seen.has(v)) return;
      seen.add(v);
      if (Array.isArray(v)){
        for (var i = 0; i < v.length; i++) walk(v[i], path + '[' + i + ']');
        return;
      }
      var keys = Object.keys(v);
      for (var kx = 0; kx < keys.length; kx++){
        var key = keys[kx];
        var lower = key.toLowerCase();
        if (/sec$/.test(lower)){
          out.push('seconds_fields_forbidden:' + path + '.' + key);
        }
        if (key === 'trackId' || key === 'clipId' || key === 'instanceId' || key === 'noteId' || key === 'id'){
          out.push('project_id_field_forbidden:' + path + '.' + key);
        }
        walk(v[key], path + '.' + key);
      }
    }
    walk(x, '$');
    return out;
  }

  function inferIntentFromTextLegacy(text){
    var s = safeTrim(text).toLowerCase();
    var hasBass = /\bbass\b/.test(s) || /贝斯|低音/.test(s);
    var hasDrums = /\bdrums?\b|\bbeats?\b|\bpercussion\b/.test(s) || /鼓点|加鼓|鼓|打击/.test(s);
    if (hasBass && hasDrums) return 'bass_drums';
    if (hasBass) return 'bass';
    if (hasDrums) return 'drums';
    return 'bass_drums';
  }

  function normalizeIntent(value, context){
    var raw = safeTrim(value).toLowerCase();
    if (raw === 'bass' || raw === 'drums' || raw === 'bass_drums' || raw === 'accompaniment') return raw;
    return inferIntentFromText(context && context.userPrompt);
  }

  function requiredPartTypesLegacy(intent, context){
    var inferred = normalizeIntent(intent, context);
    if (inferred === 'bass') return ['bass'];
    if (inferred === 'drums') return ['drums'];
    return ['bass', 'drums'];
  }

  function inferIntentFromText(text){
    var plan = createAccompanimentRolePlan({ userPrompt: text });
    var parts = Array.isArray(plan.partTypes) ? plan.partTypes : [];
    if (parts.indexOf('bass') >= 0 && parts.indexOf('drums') >= 0 && parts.length === 2) return 'bass_drums';
    if (parts.length === 1 && parts[0] === 'bass') return 'bass';
    if (parts.length === 1 && parts[0] === 'drums') return 'drums';
    return 'accompaniment';
  }

  function requiredPartTypes(intent, context){
    var plan = createAccompanimentRolePlan(context || {});
    if (plan && Array.isArray(plan.partTypes) && plan.partTypes.length) return plan.partTypes.slice();
    var inferred = normalizeIntent(intent, context);
    if (inferred === 'bass') return ['bass'];
    if (inferred === 'drums') return ['drums'];
    if (inferred === 'bass_drums') return ['bass', 'drums'];
    return ['harmonic'];
  }

  function sanitizeSpan(context){
    var span = Number(context && context.selectedClipSpanBeat);
    if (isFiniteNumber(span) && span > 0) return Math.max(0.25, compact(span));
    var rows = context && Array.isArray(context.melodyNoteRows) ? context.melodyNoteRows : [];
    var end = 0;
    for (var i = 0; i < rows.length; i++){
      var r = rows[i] || {};
      var st = Number(r.startBeat);
      var du = Number(r.durationBeat);
      if (!isFiniteNumber(st)) st = 0;
      if (!isFiniteNumber(du) || du <= 0) du = 0.5;
      end = Math.max(end, st + du);
    }
    return end > 0 ? compact(end) : 4;
  }

  function eventCoverage(events){
    var end = 0;
    for (var i = 0; i < events.length; i++){
      var ev = events[i] || {};
      var st = Number(ev.startBeat);
      var du = Number(ev.durationBeat);
      if (!isFiniteNumber(st) || !isFiniteNumber(du) || du <= 0) continue;
      end = Math.max(end, st + du);
    }
    return end;
  }

  function normalizeDraftPartType(value){
    var type = safeTrim(value).toLowerCase();
    if (type === 'drum') return 'drums';
    if (type === 'notes' || type === 'note' || type === 'accompaniment' || type === 'chord' || type === 'chords') return 'harmonic';
    if (type === 'guitar' || type === 'piano' || type === 'strings' || type === 'pad' || type === 'arpeggio') return 'harmonic';
    return type;
  }

  function expectedHarmonicRoles(plan){
    var roles = Array.isArray(plan && plan.requestedRoles) ? plan.requestedRoles : [];
    var out = [];
    for (var i = 0; i < roles.length; i++){
      var r = safeTrim(roles[i]).toLowerCase();
      if (r && r !== 'bass' && r !== 'drums' && r !== 'drum') uniquePush(out, r);
    }
    if (!out.length && plan && plan.isGenericAccompaniment) uniquePush(out, 'chords');
    return out;
  }

  function harmonicRoleMatchesExpected(actual, expected){
    var a = normalizeHarmonicRole(actual);
    var e = safeTrim(expected).toLowerCase();
    if (!e) return true;
    if (e === 'guitar') return a === 'guitar';
    if (e === 'piano') return a === 'piano' || a === 'chords';
    if (e === 'chords') return a === 'chords' || a === 'piano';
    if (e === 'arpeggio') return a === 'arpeggio';
    if (e === 'strings') return a === 'strings' || a === 'pad';
    if (e === 'pad') return a === 'pad' || a === 'strings';
    return a === e;
  }

  function validateBassNote(note, partIndex, eventIndex, span, errors){
    if (!note || typeof note !== 'object'){
      errors.push('draft.part_event_not_object:' + partIndex + ':' + eventIndex);
      return;
    }
    var startBeat = Number(note.startBeat);
    var durationBeat = Number(note.durationBeat);
    var pitch = Number(note.pitch);
    var velocity = Number(note.velocity);
    if (!isFiniteNumber(startBeat) || startBeat < 0) errors.push('draft.note.startBeat_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(durationBeat) || durationBeat <= 0) errors.push('draft.note.durationBeat_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(pitch) || pitch < 0 || pitch > 127) errors.push('draft.note.pitch_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(velocity) || velocity < 1 || velocity > 127) errors.push('draft.note.velocity_invalid:' + partIndex + ':' + eventIndex);
    if (span > 0 && isFiniteNumber(startBeat) && isFiniteNumber(durationBeat)){
      var boundary = allowedTailBoundaryBeat(span);
      if (startBeat >= boundary - 0.001 || startBeat + durationBeat > boundary + 0.001){
        errors.push('draft.note.outside_selected_span:' + partIndex + ':' + eventIndex);
      }
    }
  }

  function validateDrumHit(hit, partIndex, eventIndex, span, errors){
    if (!hit || typeof hit !== 'object'){
      errors.push('draft.part_event_not_object:' + partIndex + ':' + eventIndex);
      return;
    }
    var startBeat = Number(hit.startBeat);
    var durationBeat = Number(hit.durationBeat);
    var velocity = Number(hit.velocity);
    var drum = safeTrim(hit.drum).toLowerCase();
    if (!isFiniteNumber(startBeat) || startBeat < 0) errors.push('draft.hit.startBeat_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(durationBeat) || durationBeat <= 0) errors.push('draft.hit.durationBeat_invalid:' + partIndex + ':' + eventIndex);
    if (!DRUM_PITCH[drum]) errors.push('draft.hit.drum_invalid:' + partIndex + ':' + eventIndex);
    if (!isFiniteNumber(velocity) || velocity < 1 || velocity > 127) errors.push('draft.hit.velocity_invalid:' + partIndex + ':' + eventIndex);
    if (span > 0 && isFiniteNumber(startBeat) && isFiniteNumber(durationBeat)){
      var boundary = allowedTailBoundaryBeat(span);
      if (startBeat >= boundary - 0.001 || startBeat + durationBeat > boundary + 0.001){
        errors.push('draft.hit.outside_selected_span:' + partIndex + ':' + eventIndex);
      }
    }
  }

  function validateAccompanimentDraftV1(draft, context, opts){
    var cfg = opts && typeof opts === 'object' ? opts : {};
    var span = sanitizeSpan(context || {});
    var plan = createAccompanimentRolePlan(context || {});
    var instrumentSelection = (context && context.instrumentSelection && typeof context.instrumentSelection === 'object')
      ? context.instrumentSelection
      : resolveAccompanimentInstrument(plan, { instrumentOptions: context && context.instrumentOptions });
    var errors = [];
    var warnings = [];
    var summary = {
      intent: null,
      partTypes: [],
      requestedRoles: plan.requestedRoles.slice(),
      requestedInstrument: instrumentSelection.requestedInstrument || null,
      usedInstrument: instrumentSelection.usedInstrument || null,
      usedInstrumentLabel: instrumentSelection.usedInstrumentLabel || null,
      fallbackReason: instrumentSelection.fallbackReason || '',
      patternRole: plan.patternRole || 'chords',
      bassNoteCount: 0,
      drumHitCount: 0,
      harmonicNoteCount: 0,
      totalEvents: 0,
      coverageByType: {},
    };

    if (!draft || typeof draft !== 'object'){
      errors.push('draft_not_object');
      return { ok: false, errors: errors, warnings: warnings, summary: summary };
    }
    if (draft.version !== 1) errors.push('draft.version_must_be_1');
    errors.push.apply(errors, collectForbiddenDraftFields(draft));

    var intent = normalizeIntent(draft.intent, context);
    summary.intent = intent;
    var required = requiredPartTypes(intent, context);
    var parts = Array.isArray(draft.parts) ? draft.parts : null;
    if (!parts || parts.length < 1) errors.push('draft.parts_not_array_or_empty');
    if (parts && parts.length > 4) errors.push('draft.too_many_parts:' + parts.length);

    var seenTypes = {};
    var maxEvents = isFiniteNumber(Number(cfg.maxEvents)) ? Math.max(1, Number(cfg.maxEvents)) : 256;
    for (var i = 0; i < (parts || []).length; i++){
      var part = parts[i];
      if (!part || typeof part !== 'object'){
        errors.push('draft.part_not_object:' + i);
        continue;
      }
      var type = normalizeDraftPartType(part.type);
      if (type !== 'bass' && type !== 'drums' && type !== 'harmonic'){
        errors.push('draft.part.type_invalid:' + i);
        continue;
      }
      seenTypes[type] = true;
      summary.partTypes.push(type);

      if (type === 'bass'){
        var notes = Array.isArray(part.notes) ? part.notes : null;
        if (!notes || notes.length < 1) errors.push('draft.part.bass.notes_empty:' + i);
        for (var ni = 0; ni < (notes || []).length; ni++) validateBassNote(notes[ni], i, ni, span, errors);
        var bassEnd = eventCoverage(notes || []);
        summary.bassNoteCount += (notes || []).length;
        summary.totalEvents += (notes || []).length;
        summary.coverageByType.bass = Math.max(summary.coverageByType.bass || 0, span > 0 ? bassEnd / span : 0);
      } else if (type === 'drums'){
        var hits = Array.isArray(part.hits) ? part.hits : null;
        if (!hits || hits.length < 1) errors.push('draft.part.drums.hits_empty:' + i);
        for (var hi = 0; hi < (hits || []).length; hi++) validateDrumHit(hits[hi], i, hi, span, errors);
        var drumEnd = eventCoverage(hits || []);
        summary.drumHitCount += (hits || []).length;
        summary.totalEvents += (hits || []).length;
        summary.coverageByType.drums = Math.max(summary.coverageByType.drums || 0, span > 0 ? drumEnd / span : 0);
      } else if (type === 'harmonic'){
        var hnotes = Array.isArray(part.notes) ? part.notes : null;
        if (!hnotes || hnotes.length < 1) errors.push('draft.part.harmonic.notes_empty:' + i);
        var hrole = normalizeHarmonicRole(part.role || part.patternRole, plan.patternRole);
        var expectedRoles = expectedHarmonicRoles(plan);
        var matchedExpected = expectedRoles.length < 1;
        for (var eri = 0; eri < expectedRoles.length; eri++){
          if (harmonicRoleMatchesExpected(hrole, expectedRoles[eri])){
            matchedExpected = true;
            break;
          }
        }
        if (!matchedExpected) errors.push('draft.missing_requested_role:' + expectedRoles.join('|'));
        for (var hn = 0; hn < (hnotes || []).length; hn++) validateBassNote(hnotes[hn], i, hn, span, errors);
        var hEnd = eventCoverage(hnotes || []);
        summary.harmonicNoteCount += (hnotes || []).length;
        summary.totalEvents += (hnotes || []).length;
        summary.coverageByType.harmonic = Math.max(summary.coverageByType.harmonic || 0, span > 0 ? hEnd / span : 0);
      }
    }

    for (var ri = 0; ri < required.length; ri++){
      if (!seenTypes[required[ri]]) errors.push('draft.missing_requested_part:' + required[ri]);
    }

    if (summary.totalEvents > maxEvents) errors.push('draft.too_many_events:' + summary.totalEvents);
    if (span >= 6){
      if (seenTypes.bass){
        var minBass = Math.max(2, Math.ceil(span / 2));
        if (summary.bassNoteCount < minBass) errors.push('draft.too_few_bass_notes:' + summary.bassNoteCount + ':min_' + minBass);
        if ((summary.coverageByType.bass || 0) < 0.75) errors.push('draft.short_coverage:bass');
      }
      if (seenTypes.drums){
        var minDrums = Math.max(6, Math.ceil(span * 1.25));
        if (summary.drumHitCount < minDrums) errors.push('draft.too_few_drum_hits:' + summary.drumHitCount + ':min_' + minDrums);
        if ((summary.coverageByType.drums || 0) < 0.75) errors.push('draft.short_coverage:drums');
      }
      if (seenTypes.harmonic){
        var minHarmonic = Math.max(6, Math.ceil(span / 2));
        if (summary.harmonicNoteCount < minHarmonic) errors.push('draft.too_few_harmonic_notes:' + summary.harmonicNoteCount + ':min_' + minHarmonic);
        if ((summary.coverageByType.harmonic || 0) < 0.75) errors.push('draft.short_coverage:harmonic');
      }
    } else {
      if (seenTypes.bass && span > 1.5 && summary.bassNoteCount < 2) errors.push('draft.too_few_bass_notes:' + summary.bassNoteCount + ':min_2');
      if (seenTypes.drums && span > 1.5 && summary.drumHitCount < 3) errors.push('draft.too_few_drum_hits:' + summary.drumHitCount + ':min_3');
      if (seenTypes.harmonic && span > 1.5 && summary.harmonicNoteCount < 3) errors.push('draft.too_few_harmonic_notes:' + summary.harmonicNoteCount + ':min_3');
    }

    if (summary.bassNoteCount > 0 && summary.bassNoteCount <= 2) warnings.push({ code: 'simple_bass_pattern', severity: 'warn' });
    if (summary.drumHitCount > 0 && summary.drumHitCount <= 4) warnings.push({ code: 'simple_drum_pattern', severity: 'warn' });
    if (summary.harmonicNoteCount > 0 && summary.harmonicNoteCount <= 4) warnings.push({ code: 'simple_harmonic_pattern', severity: 'warn' });

    return { ok: errors.length === 0, errors: errors, warnings: warnings, summary: summary };
  }

  function melodyRootPitchClass(rows){
    var counts = {};
    var best = null;
    var bestCount = -1;
    for (var i = 0; i < rows.length; i++){
      var p = Number(rows[i] && rows[i].pitch);
      if (!isFiniteNumber(p)) continue;
      var pc = ((Math.round(p) % 12) + 12) % 12;
      counts[pc] = (counts[pc] || 0) + 1;
      if (counts[pc] > bestCount){
        bestCount = counts[pc];
        best = pc;
      }
    }
    return best == null ? 0 : best;
  }

  function bassPitchForPc(rootPc, offset){
    var pc = (rootPc + offset) % 12;
    var pitch = 36 + pc;
    while (pitch > 48) pitch -= 12;
    while (pitch < 34) pitch += 12;
    return clamp(pitch, 28, 52);
  }

  function makeDeterministicBassPart(context, span){
    var rows = context && Array.isArray(context.melodyNoteRows) ? context.melodyNoteRows : [];
    var rootPc = melodyRootPitchClass(rows);
    var step = span > 48 ? 2 : 1;
    var offsets = [0, 0, 7, 0, 5, 7, 0, 7];
    var notes = [];
    var maxNotes = 96;
    var boundary = allowedTailBoundaryBeat(span);
    for (var t = 0; t < span - 0.001 && notes.length < maxNotes; t += step){
      var idx = Math.floor(t / step) % offsets.length;
      var remaining = boundary - t;
      if (remaining <= 0.0625) continue;
      var dur = Math.min(step * 0.88, Math.max(0.25, remaining));
      if (t + dur > boundary + 0.001) dur = boundary - t;
      if (dur < 0.0625) continue;
      notes.push({
        startBeat: compact(t),
        pitch: bassPitchForPc(rootPc, offsets[idx]),
        durationBeat: compact(dur),
        velocity: idx % 2 === 0 ? 70 : 66,
      });
    }
    return { type: 'bass', instrument: 'bass', notes: notes };
  }

  function pushDrumHit(hits, span, startBeat, drum, velocity){
    var boundary = allowedTailBoundaryBeat(span);
    if (startBeat < -0.001 || startBeat >= boundary - 0.001) return;
    var remaining = boundary - startBeat;
    if (remaining <= 0.0625) return;
    var durationBeat = Math.min(0.25, Math.max(0.125, compact(remaining)));
    if (startBeat + durationBeat > boundary + 0.001) durationBeat = compact(boundary - startBeat);
    if (durationBeat < 0.0625) return;
    hits.push({
      startBeat: compact(startBeat),
      drum: drum,
      durationBeat: compact(durationBeat),
      velocity: velocity,
    });
  }

  function makeDeterministicDrumPart(context, span){
    var hits = [];
    var hatStep = span > 48 ? 1 : 0.5;
    for (var t = 0; t < span - 0.001; t += hatStep){
      pushDrumHit(hits, span, t, 'hat', 46);
    }
    for (var b = 0; b < span - 0.001; b += 1){
      var beatInBar = ((Math.floor(b) % 4) + 4) % 4;
      if (beatInBar === 0 || beatInBar === 2) pushDrumHit(hits, span, b, 'kick', beatInBar === 0 ? 78 : 72);
      if (beatInBar === 1 || beatInBar === 3) pushDrumHit(hits, span, b, 'snare', 72);
    }
    if (span >= 8){
      pushDrumHit(hits, span, Math.max(0, span - 0.5), 'snare', 64);
    }
    hits.sort(function(a, b){ return a.startBeat - b.startBeat || safeTrim(a.drum).localeCompare(safeTrim(b.drum)); });
    if (hits.length > 160){
      hits = hits.filter(function(_hit, idx){ return idx % 2 === 0; }).slice(0, 160);
    }
    return { type: 'drums', instrument: 'drums', hits: hits };
  }

  function pitchForPcInRange(pc, low, high){
    var p = low + (((pc - low) % 12) + 12) % 12;
    while (p < low) p += 12;
    while (p > high) p -= 12;
    return clamp(p, low, high);
  }

  function chordPitches(rootPc, role, offset){
    var basePc = (rootPc + offset) % 12;
    var low = role === 'guitar' ? 52 : 55;
    var high = role === 'strings' || role === 'pad' ? 76 : 74;
    var root = pitchForPcInRange(basePc, low, high - 12);
    var third = root + 4;
    var fifth = root + 7;
    if (third > high) third -= 12;
    if (fifth > high) fifth -= 12;
    if (role === 'strings' || role === 'pad') return [root, fifth, root + 12 <= high ? root + 12 : root];
    return [root, third, fifth];
  }

  function addHarmonicNote(notes, span, startBeat, pitch, durationBeat, velocity){
    var boundary = allowedTailBoundaryBeat(span);
    if (startBeat < -0.001 || startBeat >= boundary - 0.001) return;
    var remaining = boundary - startBeat;
    if (remaining <= 0.0625) return;
    var dur = Math.min(durationBeat, remaining);
    if (dur < 0.0625) return;
    notes.push({
      startBeat: compact(startBeat),
      pitch: clamp(Math.round(pitch), 0, 127),
      durationBeat: compact(dur),
      velocity: clamp(Math.round(velocity), 1, 127),
    });
  }

  function harmonicRoleFromPlan(plan){
    var roles = Array.isArray(plan && plan.requestedRoles) ? plan.requestedRoles : [];
    for (var i = 0; i < roles.length; i++){
      var r = safeTrim(roles[i]).toLowerCase();
      if (r && r !== 'bass' && r !== 'drums' && r !== 'drum') return normalizeHarmonicRole(r, plan && plan.patternRole);
    }
    return normalizeHarmonicRole(null, plan && plan.patternRole);
  }

  function makeDeterministicHarmonicPart(context, span, rolePlan, instrumentSelection){
    var plan = rolePlanFromObject(rolePlan) || createAccompanimentRolePlan(context || {});
    var selection = instrumentSelection || resolveAccompanimentInstrument(plan, { instrumentOptions: context && context.instrumentOptions });
    var rows = context && Array.isArray(context.melodyNoteRows) ? context.melodyNoteRows : [];
    var rootPc = melodyRootPitchClass(rows);
    var role = harmonicRoleFromPlan(plan);
    var pattern = normalizePatternRole(plan.patternRole);
    var notes = [];
    var offsets = [0, 5, 7, 0, 9, 5, 7, 0];
    var maxNotes = 160;

    if (role === 'arpeggio' || pattern === 'arpeggio' || role === 'guitar' || pattern === 'riff'){
      var step = span > 64 ? 1 : 0.5;
      for (var t = 0; t < span - 0.001 && notes.length < maxNotes; t += step){
        var off = offsets[Math.floor(t / 2) % offsets.length];
        var chord = chordPitches(rootPc, role === 'guitar' ? 'guitar' : role, off);
        var idx = Math.floor(t / step) % chord.length;
        var octaveLift = (role === 'guitar' && idx === 0 && Math.floor(t / 2) % 2 === 1) ? 12 : 0;
        addHarmonicNote(notes, span, t, chord[idx] + octaveLift, step * 0.82, role === 'guitar' ? 58 : 54);
      }
    } else {
      var block = (role === 'strings' || role === 'pad' || pattern === 'pad') ? 4 : 2;
      for (var b = 0; b < span - 0.001 && notes.length < maxNotes; b += block){
        var off2 = offsets[Math.floor(b / block) % offsets.length];
        var chord2 = chordPitches(rootPc, role, off2);
        var dur = Math.min(block * 0.88, Math.max(0.5, allowedTailBoundaryBeat(span) - b));
        for (var ci = 0; ci < chord2.length && notes.length < maxNotes; ci++){
          addHarmonicNote(notes, span, b, chord2[ci], dur, (role === 'strings' || role === 'pad') ? 48 : 52);
        }
      }
    }

    return {
      type: 'harmonic',
      role: role,
      patternRole: pattern,
      instrument: selection.usedInstrument || 'default',
      requestedInstrument: selection.requestedInstrument || null,
      instrumentSelection: selection,
      notes: notes,
    };
  }

  function createDeterministicAccompanimentDraftV1(context){
    var ctx = context && typeof context === 'object' ? context : {};
    var span = sanitizeSpan(ctx);
    var rolePlan = createAccompanimentRolePlan(ctx);
    var instrumentSelection = resolveAccompanimentInstrument(rolePlan, { instrumentOptions: ctx.instrumentOptions });
    var intent = normalizeIntent(ctx.intent, ctx);
    var required = requiredPartTypes(intent, Object.assign({}, ctx, { rolePlan: rolePlan }));
    var parts = [];
    if (required.indexOf('bass') >= 0) parts.push(makeDeterministicBassPart(ctx, span));
    if (required.indexOf('drums') >= 0) parts.push(makeDeterministicDrumPart(ctx, span));
    if (required.indexOf('harmonic') >= 0) parts.push(makeDeterministicHarmonicPart(ctx, span, rolePlan, instrumentSelection));
    return {
      version: 1,
      intent: (required.indexOf('bass') >= 0 && required.indexOf('drums') >= 0 && required.length === 2) ? 'bass_drums' : intent,
      style: safeTrim(ctx.style) || 'simple',
      requestedRoles: rolePlan.requestedRoles.slice(),
      requestedInstrument: instrumentSelection.requestedInstrument || null,
      usedInstrument: instrumentSelection.usedInstrument || null,
      usedInstrumentLabel: instrumentSelection.usedInstrumentLabel || null,
      fallbackReason: instrumentSelection.fallbackReason || '',
      patternRole: rolePlan.patternRole,
      parts: parts,
    };
  }

  function existingIds(projectV2){
    var tracks = new Set();
    var clips = new Set();
    var instances = new Set();
    var p = projectV2 || {};
    var ts = Array.isArray(p.tracks) ? p.tracks : [];
    for (var ti = 0; ti < ts.length; ti++){
      if (ts[ti] && safeTrim(ts[ti].id)) tracks.add(safeTrim(ts[ti].id));
      if (ts[ti] && safeTrim(ts[ti].trackId)) tracks.add(safeTrim(ts[ti].trackId));
    }
    if (p.clips && typeof p.clips === 'object' && !Array.isArray(p.clips)){
      var keys = Object.keys(p.clips);
      for (var ci = 0; ci < keys.length; ci++){
        clips.add(String(keys[ci]));
        if (p.clips[keys[ci]] && safeTrim(p.clips[keys[ci]].id)) clips.add(safeTrim(p.clips[keys[ci]].id));
      }
    }
    var inst = Array.isArray(p.instances) ? p.instances : [];
    for (var ii = 0; ii < inst.length; ii++){
      if (inst[ii] && safeTrim(inst[ii].id)) instances.add(safeTrim(inst[ii].id));
    }
    return { tracks: tracks, clips: clips, instances: instances };
  }

  function nextId(prefix, used){
    var n = 1;
    while (used.has(prefix + n)) n++;
    var id = prefix + n;
    used.add(id);
    return id;
  }

  function normalizedDrumPitch(raw){
    var key = safeTrim(raw).toLowerCase();
    return DRUM_PITCH[key] || DRUM_PITCH.perc;
  }

  function normalizeInstrumentForPart(part, context){
    var type = normalizeDraftPartType(part && part.type);
    var instr = safeTrim(part && part.instrument);
    if (type === 'drums' || type === 'drum') return 'drum';
    if (type === 'bass') return 'bass';
    if (type === 'harmonic'){
      var selection = (part && part.instrumentSelection && typeof part.instrumentSelection === 'object')
        ? part.instrumentSelection
        : ((context && context.instrumentSelection && typeof context.instrumentSelection === 'object')
          ? context.instrumentSelection
          : resolveAccompanimentInstrument(context && context.rolePlan ? context.rolePlan : createAccompanimentRolePlan(context || {}), { instrumentOptions: context && context.instrumentOptions }));
      return safeTrim(selection && selection.usedInstrument) || 'default';
    }
    return instr || 'default';
  }

  function harmonicTrackBaseName(part, context){
    var role = normalizeHarmonicRole(part && part.role, part && part.patternRole);
    var requested = safeTrim((part && part.requestedInstrument) || (context && context.instrumentSelection && context.instrumentSelection.requestedInstrument));
    var selection = (part && part.instrumentSelection && typeof part.instrumentSelection === 'object')
      ? part.instrumentSelection
      : ((context && context.instrumentSelection && typeof context.instrumentSelection === 'object') ? context.instrumentSelection : null);
    var fallback = !!(selection && safeTrim(selection.fallbackReason));
    var reqLow = requested.toLowerCase();
    if ((role === 'guitar' || reqLow.indexOf('guitar') >= 0) && fallback) return 'Guitar-style Accompaniment';
    if (role === 'guitar' || reqLow.indexOf('guitar') >= 0) return reqLow.indexOf('electric') >= 0 ? 'Electric Guitar Accompaniment' : 'Guitar Accompaniment';
    if (role === 'arpeggio') return 'Arpeggio Accompaniment';
    if (role === 'strings') return 'Strings Accompaniment';
    if (role === 'pad') return 'Pad Accompaniment';
    if (role === 'piano') return 'Piano Accompaniment';
    if (role === 'chords') return requested ? (requested.charAt(0).toUpperCase() + requested.slice(1) + ' Accompaniment') : 'Chord Accompaniment';
    return 'Accompaniment';
  }

  function packPartToOps(projectIds, part, context, partIndex){
    var type = normalizeDraftPartType(part.type);
    var trackId = nextId('trk_acc_', projectIds.tracks);
    var clipId = nextId('clip_acc_', projectIds.clips);
    var instanceId = nextId('inst_acc_', projectIds.instances);
    var noteIds = new Set();
    var scoreTrackId = 'score_' + type + '_1';
    var notes = [];
    if (type === 'bass'){
      var bassNotes = Array.isArray(part.notes) ? part.notes.slice() : [];
      bassNotes.sort(function(a, b){ return Number(a.startBeat) - Number(b.startBeat); });
      for (var ni = 0; ni < bassNotes.length; ni++){
        var n = bassNotes[ni] || {};
        notes.push({
          id: nextId('n_acc_', noteIds),
          pitch: clamp(Math.round(Number(n.pitch)), 0, 127),
          velocity: clamp(Math.round(Number(n.velocity)), 1, 127),
          startBeat: compact(Number(n.startBeat)),
          durationBeat: compact(Number(n.durationBeat)),
        });
      }
    } else if (type === 'drums') {
      var hits = Array.isArray(part.hits) ? part.hits.slice() : [];
      hits.sort(function(a, b){ return Number(a.startBeat) - Number(b.startBeat); });
      for (var hi = 0; hi < hits.length; hi++){
        var h = hits[hi] || {};
        notes.push({
          id: nextId('n_acc_', noteIds),
          pitch: normalizedDrumPitch(h.drum),
          velocity: clamp(Math.round(Number(h.velocity)), 1, 127),
          startBeat: compact(Number(h.startBeat)),
          durationBeat: compact(Number(h.durationBeat)),
        });
      }
    } else {
      var harmonicNotes = Array.isArray(part.notes) ? part.notes.slice() : [];
      harmonicNotes.sort(function(a, b){ return Number(a.startBeat) - Number(b.startBeat); });
      for (var hn = 0; hn < harmonicNotes.length; hn++){
        var nt = harmonicNotes[hn] || {};
        notes.push({
          id: nextId('n_acc_', noteIds),
          pitch: clamp(Math.round(Number(nt.pitch)), 0, 127),
          velocity: clamp(Math.round(Number(nt.velocity)), 1, 127),
          startBeat: compact(Number(nt.startBeat)),
          durationBeat: compact(Number(nt.durationBeat)),
        });
      }
    }
    var name = type === 'bass' ? 'Bass' : (type === 'drums' ? 'Drums' : harmonicTrackBaseName(part, context));
    var gainDb = type === 'bass' ? -7 : (type === 'drums' ? -9 : -8);
    var clipName = (type === 'bass' || type === 'drums') ? (name + ' Accompaniment') : name;
    return [
      { op: 'createTrack', trackId: trackId, name: name, instrument: normalizeInstrumentForPart(part, context), gainDb: gainDb },
      {
        op: 'createClip',
        clipId: clipId,
        name: clipName,
        sourceTaskId: 'arrange:draft_v1',
        scoreBeat: {
          version: 2,
          time_signature: safeTrim(context && context.timeSignature) || '4/4',
          tracks: [{ id: scoreTrackId, name: name, notes: notes }],
        },
      },
      {
        op: 'addInstance',
        instanceId: instanceId,
        clipId: clipId,
        trackId: trackId,
        startBeat: isFiniteNumber(Number(context && context.selectedInstanceStartBeat)) ? Math.max(0, compact(Number(context.selectedInstanceStartBeat))) : 0,
        transpose: 0,
      },
    ];
  }

  function packAccompanimentDraftV1ToArrangementPatchV0(projectV2, draft, context, opts){
    var validation = validateAccompanimentDraftV1(draft, context, opts);
    if (!validation.ok){
      return {
        ok: false,
        reason: 'draft_validation_failed',
        errors: validation.errors.slice(),
        warnings: validation.warnings.slice(),
        draftValidation: validation,
        metadata: validation.summary || null,
        patch: null,
      };
    }
    var projectIds = existingIds(projectV2);
    var parts = Array.isArray(draft.parts) ? draft.parts : [];
    var ops = [];
    for (var i = 0; i < parts.length; i++){
      var part = parts[i];
      if (!part || typeof part !== 'object') continue;
      ops = ops.concat(packPartToOps(projectIds, part, context || {}, i));
    }
    var patch = {
      kind: 'arrangement_patch_v0',
      version: 1,
      ops: ops,
    };
    return {
      ok: true,
      reason: 'ok',
      errors: [],
      warnings: validation.warnings.slice(),
      draftValidation: validation,
      metadata: validation.summary || null,
      patch: patch,
    };
  }

  return {
    validateAccompanimentDraftV1: validateAccompanimentDraftV1,
    packAccompanimentDraftV1ToArrangementPatchV0: packAccompanimentDraftV1ToArrangementPatchV0,
    createDeterministicAccompanimentDraftV1: createDeterministicAccompanimentDraftV1,
    createAccompanimentRolePlan: createAccompanimentRolePlan,
    resolveAccompanimentInstrument: resolveAccompanimentInstrument,
    getSelectableInstrumentOptions: getSelectableInstrumentOptions,
    inferIntentFromText: inferIntentFromText,
    allowedTailOverrunBeat: allowedTailOverrunBeat,
    drumPitchMap: function(){ return deepClone(DRUM_PITCH); },
  };
});
