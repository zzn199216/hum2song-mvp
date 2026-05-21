(function(root, factory){
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.H2SInstrumentManifest = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';

  var VERSION = 'instrument_manifest_v0';

  var BUILT_IN_INSTRUMENTS = [
    {
      id: 'builtin.piano',
      legacyKey: 'default',
      engineType: 'builtin_synth',
      category: 'keyboard',
      i18nNameKey: 'instrument.name.piano',
      i18nDescriptionKey: 'instrument.description.piano',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.bass',
      legacyKey: 'bass',
      engineType: 'builtin_synth',
      category: 'bass',
      i18nNameKey: 'instrument.name.bass',
      i18nDescriptionKey: 'instrument.description.bass',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.lead',
      legacyKey: 'lead',
      engineType: 'builtin_synth',
      category: 'synth',
      i18nNameKey: 'instrument.name.lead',
      i18nDescriptionKey: 'instrument.description.lead',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.pad',
      legacyKey: 'pad',
      engineType: 'builtin_synth',
      category: 'synth',
      i18nNameKey: 'instrument.name.pad',
      i18nDescriptionKey: 'instrument.description.pad',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.pluck',
      legacyKey: 'pluck',
      engineType: 'builtin_synth',
      category: 'pluck',
      i18nNameKey: 'instrument.name.pluck',
      i18nDescriptionKey: 'instrument.description.pluck',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.drums',
      legacyKey: 'drum',
      engineType: 'drum',
      category: 'drums',
      i18nNameKey: 'instrument.name.drums',
      i18nDescriptionKey: 'instrument.description.drums',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.sampled_piano',
      legacyKey: 'sampler:tonejs:piano',
      engineType: 'sampler',
      category: 'sampled',
      i18nNameKey: 'instrument.name.sampledPiano',
      i18nDescriptionKey: 'instrument.description.sampledPiano',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.sampled_strings',
      legacyKey: 'sampler:tonejs:strings',
      engineType: 'sampler',
      category: 'sampled',
      i18nNameKey: 'instrument.name.sampledStrings',
      i18nDescriptionKey: 'instrument.description.sampledStrings',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.sampled_bass',
      legacyKey: 'sampler:tonejs:bass',
      engineType: 'sampler',
      category: 'sampled',
      i18nNameKey: 'instrument.name.sampledBass',
      i18nDescriptionKey: 'instrument.description.sampledBass',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.sampled_guitar_acoustic',
      legacyKey: 'sampler:tonejs:guitar-acoustic',
      engineType: 'sampler',
      category: 'sampled',
      i18nNameKey: 'instrument.name.sampledGuitarAcoustic',
      i18nDescriptionKey: 'instrument.description.sampledGuitarAcoustic',
      enabledByDefault: true,
      selectableByDefault: true,
    },
    {
      id: 'builtin.sampled_guitar_electric',
      legacyKey: 'sampler:tonejs:guitar-electric',
      engineType: 'sampler',
      category: 'sampled',
      i18nNameKey: 'instrument.name.sampledGuitarElectric',
      i18nDescriptionKey: 'instrument.description.sampledGuitarElectric',
      enabledByDefault: true,
      selectableByDefault: true,
    },
  ];

  function cloneInstrument(item){
    return Object.assign({}, item);
  }

  function getBuiltInInstrumentManifest(){
    return BUILT_IN_INSTRUMENTS.map(cloneInstrument);
  }

  function normalizeInstrumentValue(value){
    return (typeof value === 'string' && value.trim()) ? value.trim() : 'default';
  }

  function resolveInstrument(value){
    var normalized = normalizeInstrumentValue(value);
    for (var i = 0; i < BUILT_IN_INSTRUMENTS.length; i++){
      var item = BUILT_IN_INSTRUMENTS[i];
      if (item.legacyKey === normalized || item.id === normalized){
        return cloneInstrument(item);
      }
    }
    return {
      id: 'unknown',
      legacyKey: normalized,
      engineType: 'unknown',
      category: 'unknown',
      i18nNameKey: null,
      i18nDescriptionKey: null,
      enabledByDefault: false,
      selectableByDefault: false,
      missing: true,
    };
  }

  function getSelectableInstrumentOptions(){
    return BUILT_IN_INSTRUMENTS
      .filter(function(item){ return item.enabledByDefault !== false && item.selectableByDefault !== false; })
      .map(function(item){
        return {
          value: item.legacyKey,
          labelKey: item.i18nNameKey,
          manifestId: item.id,
          category: item.category,
          engineType: item.engineType,
        };
      });
  }

  function isKnownBuiltInInstrument(value){
    return !resolveInstrument(value).missing;
  }

  return {
    VERSION: VERSION,
    getBuiltInInstrumentManifest: getBuiltInInstrumentManifest,
    getSelectableInstrumentOptions: getSelectableInstrumentOptions,
    isKnownBuiltInInstrument: isKnownBuiltInInstrument,
    resolveInstrument: resolveInstrument,
  };
});
