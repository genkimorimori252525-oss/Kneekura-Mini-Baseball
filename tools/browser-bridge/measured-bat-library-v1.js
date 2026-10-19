(function (root) {
  'use strict';
  const AUTHORITY = 'OPENBIOMECHANICS_COMPACT_MEASURED_BAT_LIBRARY';
  const COMMIT = '44b98dae05cceb016f080ab39d105c85b8639084';
  const COLUMNS = ['tick', 'gripX', 'gripY', 'gripZ', 'tipX', 'tipY', 'tipZ', 'qw', 'qx', 'qy', 'qz',
    'sweetX', 'sweetY', 'sweetZ', 'sweetVelocityX', 'sweetVelocityY', 'sweetVelocityZ', 'handX', 'handY', 'handZ'];
  const DEFAULT_IDS = ['obp-123_6', 'obp-190_7', 'obp-103_5', 'obp-185_5', 'obp-254_3', 'obp-42_5',
    'obp-51_3', 'obp-313_7', 'obp-353_2', 'obp-273_4', 'obp-56_1', 'obp-358_7'];
  const fail = message => { throw Error('Measured bat library: ' + message); };
  const assert = (condition, message) => { if (!condition) fail(message); };
  const fields = (value, names) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...names].sort().join('|');
  // Do not invoke getters, toJSON or inherited data. A caller may pass JSON text
  // or a same-realm plain object; output is a detached, deeply frozen tree.
  function inert(value, depth = 0, budget = { remaining: 2200000 }) {
    assert(--budget.remaining >= 0 && depth <= 24, 'input tree exceeds limits');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') { assert(Number.isFinite(value), 'nonfinite number'); return value; }
    assert(value && typeof value === 'object', 'plain JSON data required');
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    assert(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'plain JSON object required');
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    assert(keys.every(key => typeof key === 'string'), 'symbol fields are not supported');
    if (array) {
      assert(Number.isSafeInteger(value.length) && value.length <= 10000, 'array size exceeds limits');
      assert(keys.length === value.length + 1 && keys.every(key => key === 'length' || /^(?:0|[1-9]\d*)$/.test(key)
        && Number(key) < value.length), 'sparse or decorated array');
      return Array.from({ length: value.length }, (_, i) => { const descriptor = descriptors[i];
        assert(descriptor && 'value' in descriptor && descriptor.enumerable, 'array accessor or hidden item');
        return inert(descriptor.value, depth + 1, budget); });
    }
    const copy = {};
    for (const key of keys) { const descriptor = descriptors[key];
      assert(!['__proto__', 'constructor', 'prototype'].includes(key) && 'value' in descriptor && descriptor.enumerable, 'unsafe data field');
      copy[key] = inert(descriptor.value, depth + 1, budget); }
    return copy;
  }
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const vector = (row, offset) => ({ x: row[offset], y: row[offset + 1], z: row[offset + 2] });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const shaText = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  function decode(input) {
    if (typeof input === 'string') { assert(input.length <= 32 * 1024 * 1024, 'JSON text exceeds limits'); input = JSON.parse(input); }
    const data = inert(input);
    assert(fields(data, ['schemaVersion', 'authority', 'sourceCommit', 'clock', 'coordinateRegistration', 'selection',
      'defaultClipId', 'comparisonClipId', 'index', 'licenseText', 'provenance', 'columns', 'clips']), 'unexpected library fields');
    assert(data.schemaVersion === 1 && data.authority === AUTHORITY && data.sourceCommit === COMMIT, 'unsupported library or source revision');
    assert(JSON.stringify(data.columns) === JSON.stringify(COLUMNS), 'runtime sample columns differ');
    assert(data.clock.ticksPerSecond === 1000000 && data.clock.sourceTime === 'ORIGINAL_DECIMAL_SECONDS'
      && data.clock.interpolation === 'LINEAR_GRIP_SHORTEST_SO3_BETWEEN_KEYS_NOT_MEASURED', 'source clock differs');
    assert(data.coordinateRegistration.determinant === 1 && data.coordinateRegistration.units === 'metres'
      && JSON.stringify(data.coordinateRegistration.worldFromLab) === '[[0,1,0],[0,0,1],[1,0,0]]'
      && JSON.stringify(data.coordinateRegistration.translation) === '[0,0,0]', 'coordinate registration differs');
    assert(data.selection.sourceTrials === 677 && data.selection.includedClips === 673 && data.selection.defaultSelectionClips === 12
      && data.selection.missingCoordinateRows === 5 && data.index.length === 677 && data.clips.length === 673, 'trial census differs');
    assert(typeof data.licenseText === 'string' && data.licenseText.includes('CC BY-NC-SA') && data.licenseText.length > 100, 'bundled data license required');
    const p = data.provenance;
    assert(['csvSha256', 'metadataSha256', 'modelSha256', 'verificationSha256', 'legacyWitnessSha256', 'legacyImporterSha256', 'decoderSha256']
      .every(key => shaText(p[key])) && p.beforeContactTicks === 300000 && p.afterContactTicks === 80000 && p.rawCsvRows === 469377, 'raw source provenance differs');
    const byTrial = new Map();
    for (const entry of data.index) {
      assert(fields(entry, ['id', 'side', 'athlete', 'speedMph', 'lengthM', 'missingRows', 'eligible'])
        && /^\d+_\d+$/.test(entry.id) && !byTrial.has(entry.id) && ['R', 'L'].includes(entry.side)
        && Number.isFinite(entry.speedMph) && entry.speedMph > 0 && entry.lengthM > .5 && entry.lengthM <= 2
        && Number.isSafeInteger(entry.missingRows) && entry.missingRows >= 0 && typeof entry.eligible === 'boolean', 'invalid trial index');
      byTrial.set(entry.id, entry);
    }
    const excluded = data.index.filter(entry => !entry.eligible).map(entry => entry.id).sort();
    assert(JSON.stringify(excluded) === '["203_3","342_1","342_2","67_2"]'
      && data.index.filter(entry => !entry.eligible).reduce((sum, entry) => sum + entry.missingRows, 0) === 5, 'missing-coordinate exclusions differ');
    const clipIds = new Set(), defaultIds = [];
    const clips = data.clips.map(clip => {
      assert(fields(clip, ['id', 'label', 'source', 'timeRange', 'contactTimeSeconds', 'normalization', 'side', 'binding', 'metrics',
        'assumptions', 'license', 'nativeAdmission', 'officialResult', 'defaultSelection', 'sourceRowRange', 'rows']), 'unexpected clip fields');
      assert(/^obp-\d+_\d+$/.test(clip.id) && !clipIds.has(clip.id), 'duplicate or invalid clip identity'); clipIds.add(clip.id);
      const trial = byTrial.get(clip.id.slice(4)), source = clip.source, binding = clip.binding, normal = clip.normalization,
        contactTick = Math.round(clip.contactTimeSeconds * 1e6), range = clip.sourceRowRange;
      assert(trial?.eligible && trial.side === clip.side && source.motion === trial.id && source.commit === COMMIT
        && source.sha256 === p.csvSha256 && source.metadataSha256 === p.metadataSha256 && source.modelSha256 === p.modelSha256
        && source.originalCsvPath === p.csvPath && shaText(source.sourceRowsSha256), 'clip raw provenance differs');
      assert(clip.nativeAdmission === false && clip.officialResult === null && typeof clip.defaultSelection === 'boolean', 'ungranted authority');
      assert(clip.defaultSelection === DEFAULT_IDS.includes(clip.id), 'automatic selection may use only retained legacy trials');
      if (clip.defaultSelection) defaultIds.push(clip.id);
      assert(normal.batLengthM === trial.lengthM && normal.positionScale === 1 && normal.sweetSpotT >= .65 && normal.sweetSpotT <= .9
        && Math.abs(normal.sweetSpotT - (normal.batLengthM - .1524) / normal.batLengthM) < 1e-14, 'declared rigid length differs');
      assert(binding.sweetSpotFromTipM === .1524 && binding.handReferenceFromKnobM === .17145 && binding.maximumHandResidualM >= 0
        && binding.maximumHandResidualM <= .02 && binding.axialPhase === 'DECLARED_MINIMUM_ROTATION_TRANSPORT'
        && binding.knobAndTip === 'DECLARED_RIGID_BINDING_NOT_MEASURED_ENDPOINTS', 'declared binding differs');
      assert(Number.isSafeInteger(contactTick) && contactTick >= 0 && clip.rows.length === 137 && range.count === 137
        && Number.isSafeInteger(range.firstCsvLine) && range.firstCsvLine >= 2 && range.lastCsvLine === range.firstCsvLine + 136
        && range.lastCsvLine <= p.rawCsvRows + 1 && range.interpretation === 'ONE_BASED_CSV_RECORD_LINES_INCLUDING_HEADER', 'original sample row range differs');
      const frames = [], measurements = []; let maxResidual = 0;
      for (const [i, row] of clip.rows.entries()) {
        assert(Array.isArray(row) && row.length === 20 && row.every(value => Number.isFinite(value) && Math.abs(value) <= 10000000)
          && Number.isSafeInteger(row[0]) && row[0] >= contactTick - 300000 && row[0] <= contactTick + 80000
          && (!i || row[0] > clip.rows[i - 1][0]), 'invalid original sample or clock');
        const grip = vector(row, 1), tip = vector(row, 4), orientation = { w: row[7], x: row[8], y: row[9], z: row[10] },
          sweetSpot = vector(row, 11), sweetSpotVelocity = vector(row, 14), handReference = vector(row, 17);
        assert(Math.abs(Math.hypot(row[7], row[8], row[9], row[10]) - 1) < 1e-12, 'nonunit sample orientation');
        assert(Math.abs(distance(grip, tip) - normal.batLengthM) < 1e-10, 'nonrigid sample length');
        const [w, x, y, z] = row.slice(7, 11), orientationAxis = { x: 2 * (x * y - w * z),
          y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) },
          rigidAxis = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, (tip[axis] - grip[axis]) / normal.batLengthM]));
        assert(distance(orientationAxis, rigidAxis) < 1e-10, 'orientation does not describe the rigid sample axis');
        const sweet = {}, hand = {};
        for (const axis of ['x', 'y', 'z']) { sweet[axis] = grip[axis] + (tip[axis] - grip[axis]) * normal.sweetSpotT;
          hand[axis] = grip[axis] + (tip[axis] - grip[axis]) / normal.batLengthM * .17145; }
        assert(distance(sweet, sweetSpot) < 1e-10, 'sample sweet point differs');
        const residual = distance(hand, handReference); assert(residual <= .0200000001, 'sample hand residual exceeds bound'); maxResidual = Math.max(maxResidual, residual);
        frames.push({ tick: row[0], grip, tip, orientation, sweetSpot, sweetSpotVelocity });
        measurements.push({ tick: row[0], handReference, sweetSpot });
      }
      assert(Math.abs(maxResidual - binding.maximumHandResidualM) < 1e-10 && frames[0].tick / 1e6 === clip.timeRange.start
        && frames.at(-1).tick / 1e6 === clip.timeRange.end && frames[0].tick < contactTick && frames.at(-1).tick > contactTick, 'clip window differs');
      const { rows, ...metadata } = clip;
      return { ...metadata, measurements, frames };
    });
    assert(JSON.stringify(defaultIds) === JSON.stringify(DEFAULT_IDS) && data.defaultClipId === 'obp-103_5'
      && data.comparisonClipId === 'obp-353_2', 'legacy automatic selection order differs');
    return freeze({ schemaVersion: 2, authority: 'OPENBIOMECHANICS_MEASURED_BAT_AXIS_RESEARCH', sourceCommit: COMMIT,
      clock: data.clock, coordinateRegistration: data.coordinateRegistration, selection: data.selection, defaultClipId: data.defaultClipId,
      comparisonClipId: data.comparisonClipId, index: data.index, licenseText: data.licenseText, clips,
      libraryProvenance: { ...p, compactAuthority: AUTHORITY, compactSchemaVersion: 1, defaultSelectionClipIds: defaultIds } });
  }
  root.KneekuraMeasuredBatLibrary = Object.freeze({ version: 1, decode });
})(globalThis);
