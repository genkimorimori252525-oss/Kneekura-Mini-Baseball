import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { parseCsv, originalTimeTick, worldPoint } from './import-openbiomechanics-bats.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (condition, message) => { if (!condition) throw Error('Measured bat library: ' + message); };
const pinnedCommit = '44b98dae05cceb016f080ab39d105c85b8639084';
const coordinateKeys = ['blast_hand_x', 'blast_hand_y', 'blast_hand_z', 'sweet_spot_x', 'sweet_spot_y', 'sweet_spot_z'];
const expectedExcluded = ['203_3', '342_1', '342_2', '67_2'];
export const libraryColumns = ['tick', 'gripX', 'gripY', 'gripZ', 'tipX', 'tipY', 'tipZ', 'qw', 'qx', 'qy', 'qz',
  'sweetX', 'sweetY', 'sweetZ', 'sweetVelocityX', 'sweetVelocityY', 'sweetVelocityZ', 'handX', 'handY', 'handZ'];
const flatten = vector => [vector.x, vector.y, vector.z];

/** Complete eligible measured windows. Existing 12-clip data is an immutable
 * compatibility witness, never a substitute for validating the other trials. */
export async function importMeasuredBatLibrary(root, output, manifestPath) {
  const csvPath = 'selected/打撃_手元基準点と芯の軌道.csv', metaPath = 'baseball_hitting/data/metadata.csv',
    modelPath = 'baseball_hitting/code/v3d/model/hitting_v1_model_hybrid.mdh';
  const [csv, meta, verificationBytes, license, model, legacyBytes, importerBytes, decoderBytes] = await Promise.all([
    readFile(resolve(root, csvPath)), readFile(resolve(root, metaPath)), readFile(resolve(root, 'selection-verification.json')),
    readFile(resolve(root, 'LICENSE-DATA.md'), 'utf8'), readFile(resolve(root, modelPath)),
    readFile('docs/demos/measured-bat-motions.json'), readFile('tools/browser-bridge/import-openbiomechanics-bats.mjs'),
    readFile('tools/browser-bridge/measured-bat-library-v1.js'),
  ]);
  const verification = JSON.parse(verificationBytes), legacy = JSON.parse(legacyBytes), csvSha256 = sha(csv);
  assert(verification.sourceCommit === pinnedCommit && legacy.sourceCommit === pinnedCommit, 'pinned source commit differs');
  assert(verification.selected.find(row => row.discipline === 'hitting')?.sha256 === csvSha256, 'selected CSV SHA differs');
  assert(verification.upstreamGitBlobsVerified.find(row => row.path === metaPath)?.sha256 === sha(meta), 'metadata SHA differs');
  assert(verification.upstreamGitBlobsVerified.find(row => row.path === modelPath)?.sha256 === sha(model), 'published model SHA differs');
  assert(legacy.clips.length === 12 && legacy.index.length === 677, 'legacy witness census differs');
  const legacyIds = new Set(legacy.clips.map(clip => clip.id));
  const metadata = new Map(parseCsv(meta.toString('utf8')).map(row => [row.session_swing, row]));
  const originalRows = parseCsv(csv.toString('utf8')), trials = new Map();
  for (const [i, row] of originalRows.entries()) {
    if (!trials.has(row.session_swing)) trials.set(row.session_swing, []);
    trials.get(row.session_swing).push({ row, csvLine: i + 2 });
  }
  assert(trials.size === 677 && originalRows.length === 469377, 'raw trial census differs');
  const index = [...trials].map(([id, records]) => {
    const m = metadata.get(id), rows = records.map(record => record.row); assert(m, 'missing metadata ' + id);
    const missingRows = rows.filter(row => coordinateKeys.some(key => row[key] === '' || !Number.isFinite(Number(row[key])))).length;
    const contactTick = originalTimeTick(rows[0].contact_time), lengthM = Number(m.bat_length_in) * .0254,
      times = rows.map(row => originalTimeTick(row.time));
    assert(times.every((tick, i) => !i || tick > times[i - 1]), 'nonmonotonic source time ' + id);
    assert(rows.every(row => originalTimeTick(row.contact_time) === contactTick), 'inconsistent source contact ' + id);
    return { id, side: m.hitter_side, athlete: m.user, speedMph: Number(m.bat_speed_mph_max_x), lengthM, missingRows,
      eligible: missingRows === 0 && ['R', 'L'].includes(m.hitter_side) && m.bat_length_in.trim() !== '' && lengthM > .5
        && m.bat_speed_mph_max_x.trim() !== '' && Number.isFinite(Number(m.bat_speed_mph_max_x)) };
  });
  assert(JSON.stringify(index) === JSON.stringify(legacy.index), 'raw index no longer agrees with retained legacy witness');
  assert(JSON.stringify(index.filter(row => !row.eligible).map(row => row.id).sort()) === JSON.stringify(expectedExcluded), 'excluded trials differ');
  // Keep the legacy 12 in their original quantile order. Automatic random clip
  // selection consumes this order; adding opt-in trials must not reorder it.
  const defaultOrder = legacy.clips.map(clip => clip.id.slice(4));
  const selected = [...defaultOrder.map(id => index.find(row => row.id === id)),
    ...index.filter(row => row.eligible && !defaultOrder.includes(row.id))];
  assert(selected.length === 673, 'eligible census differs');
  // Existing physics binding executes in memory; no dist or configuration write.
  const bundled = await build({ entryPoints: ['src/core/sim/contact/MeasuredBatAxisReferenceV1.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false });
  const kinematics = await build({ entryPoints: ['src/core/sim/contact/ReferenceBatKinematicsV1.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false });
  const { createMeasuredBatAxisReferenceV1 } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const { createReferenceBatKinematicsV1 } = await import('data:text/javascript;base64,' + Buffer.from(kinematics.outputFiles[0].text).toString('base64'));
  const runtimeClips = [], compactClips = [], perClip = [];
  for (const entry of selected) {
    const records = trials.get(entry.id), contactTick = originalTimeTick(records[0].row.contact_time),
      selectedRecords = records.filter(({ row }) => { const tick = originalTimeTick(row.time); return tick >= contactTick - 300000 && tick <= contactTick + 80000; }),
      sourceRows = selectedRecords.map(({ row }) => row);
    assert(sourceRows.length === 137, 'expected 137 original window samples: ' + entry.id);
    assert(selectedRecords.every((record, i) => !i || record.csvLine === selectedRecords[i - 1].csvLine + 1), 'noncontiguous raw row provenance');
    const measurements = sourceRows.map(row => ({ tick: originalTimeTick(row.time),
      handReference: worldPoint(coordinateKeys.slice(0, 3).map(key => Number(row[key]))),
      sweetSpot: worldPoint(coordinateKeys.slice(3).map(key => Number(row[key]))) }));
    const id = 'obp-' + entry.id, source = { archive: 'OpenBiomechanics dataset-v1 hitting_landmarks.zip', motion: entry.id,
      model: 'Published two-point bat binding; no body rig', author: 'Driveline Baseball / OpenBiomechanics', sha256: csvSha256,
      repository: 'https://github.com/drivelineresearch/openbiomechanics', commit: pinnedCommit, metadataSha256: sha(meta),
      modelSha256: sha(model), originalCsvPath: csvPath, sourceRowsSha256: sha(JSON.stringify(sourceRows)) };
    const adapted = createMeasuredBatAxisReferenceV1({ provenance: { clipId: id, sourceSha256: csvSha256 }, frames: measurements,
      batLengthM: entry.lengthM, sweetSpotFromTipM: .1524, handReferenceFromKnobM: .17145, maximumHandResidualM: .02,
      sourceTicksPerSecond: 1e6, startTick: measurements[0].tick, ticksPerSecond: 1e6, playbackRate: 1,
      transform: { rotation: { w: 1, x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 } });
    const motor = createReferenceBatKinematicsV1(adapted.reference);
    const frames = adapted.reference.frames.map((frame, i) => {
      const sample = motor.sample(frame.tick), a = measurements[Math.max(0, i - 1)], b = measurements[Math.min(measurements.length - 1, i + 1)],
        dt = (b.tick - a.tick) / 1e6;
      assert(Math.hypot(...['x', 'y', 'z'].map(axis => sample.sweetSpot[axis] - measurements[i].sweetSpot[axis])) < 1e-10, 'measured sweet point drift ' + id);
      return { tick: frame.tick, grip: sample.state.pose.grip, tip: sample.state.pose.tip, orientation: sample.orientation,
        sweetSpot: measurements[i].sweetSpot, sweetSpotVelocity: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, (b.sweetSpot[axis] - a.sweetSpot[axis]) / dt])) };
    });
    const clip = { id, label: `${entry.side === 'R' ? '右' : '左'}打者 ${entry.id} · 記録 ${entry.speedMph.toFixed(1)}mph`, source,
      timeRange: { start: frames[0].tick / 1e6, end: frames.at(-1).tick / 1e6 }, contactTimeSeconds: contactTick / 1e6,
      normalization: { batLengthM: entry.lengthM, sweetSpotT: adapted.reference.sweetSpotT, positionScale: 1 }, side: entry.side, measurements, frames,
      binding: { sweetSpotFromTipM: .1524, handReferenceFromKnobM: .17145, maximumHandResidualM: adapted.maximumHandResidualM,
        axialPhase: adapted.axialPhase, knobAndTip: 'DECLARED_RIGID_BINDING_NOT_MEASURED_ENDPOINTS' },
      metrics: { maxSweetSpotSpeedMps: motor.maximumSweetSpotSpeedMps, recordedBatSpeedMph: entry.speedMph },
      assumptions: [...legacy.clips[0].assumptions], license: legacy.clips[0].license, nativeAdmission: false, officialResult: null };
    if (legacyIds.has(id)) {
      const old = legacy.clips.find(item => item.id === id), { sourceRows: ignored, ...oldRuntime } = old;
      assert(JSON.stringify(clip) === JSON.stringify(oldRuntime), 'legacy runtime geometry or metadata changed: ' + id);
    }
    const { frames: ignoredFrames, measurements: ignoredMeasurements, ...clipMetadata } = clip;
    const rows = frames.map((frame, i) => [frame.tick, ...flatten(frame.grip), ...flatten(frame.tip),
      frame.orientation.w, frame.orientation.x, frame.orientation.y, frame.orientation.z,
      ...flatten(frame.sweetSpot), ...flatten(frame.sweetSpotVelocity), ...flatten(measurements[i].handReference)]);
    const sourceRowRange = { firstCsvLine: selectedRecords[0].csvLine, lastCsvLine: selectedRecords.at(-1).csvLine, count: rows.length,
      interpretation: 'ONE_BASED_CSV_RECORD_LINES_INCLUDING_HEADER' };
    const compact = { ...clipMetadata, defaultSelection: legacyIds.has(id), sourceRowRange, rows };
    compactClips.push(compact); runtimeClips.push({ ...clip, defaultSelection: legacyIds.has(id), sourceRowRange });
    perClip.push({ id, side: entry.side, defaultSelection: legacyIds.has(id), samples: rows.length, sourceRowsSha256: source.sourceRowsSha256,
      frameSha256: sha(JSON.stringify(frames)), measurementSha256: sha(JSON.stringify(measurements)), maximumHandResidualM: adapted.maximumHandResidualM,
      contactTick, firstTick: frames[0].tick, lastTick: frames.at(-1).tick, sourceRowRange });
  }
  const data = { schemaVersion: 1, authority: 'OPENBIOMECHANICS_COMPACT_MEASURED_BAT_LIBRARY', sourceCommit: pinnedCommit,
    clock: legacy.clock, coordinateRegistration: legacy.coordinateRegistration,
    selection: { sourceTrials: 677, includedClips: 673, defaultSelectionClips: 12, missingCoordinateRows: 5,
      rule: 'All complete eligible recorded trials; original contact window -0.30s to +0.08s, no gap fill or mirroring',
      population: 'DATASET_COHORT_NOT_LEAGUE_REFERENCE' },
    defaultClipId: legacy.defaultClipId, comparisonClipId: legacy.comparisonClipId, index, licenseText: license,
    provenance: { csvPath, csvSha256, metadataPath: metaPath, metadataSha256: sha(meta), modelPath, modelSha256: sha(model),
      verificationSha256: sha(verificationBytes), legacyWitnessSha256: sha(legacyBytes),
      legacyImporterSha256: sha(importerBytes), decoderSha256: sha(decoderBytes),
      beforeContactTicks: 300000, afterContactTicks: 80000, rawCsvRows: originalRows.length,
      endpointAuthority: 'DECLARED_RIGID_BINDING_NOT_MEASURED_ENDPOINTS', sourceRows: 'EXTERNAL_PINNED_CSV_PLUS_PER_CLIP_ROW_RANGE_AND_SHA256' },
    columns: libraryColumns, clips: compactClips };
  const bytes = Buffer.from(JSON.stringify(data) + '\n');
  assert(bytes.length < 30 * 1024 * 1024, 'compact library exceeds 30MiB target');
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  const manifest = { version: 'measured_bat_library_build_v1', sourceCommit: pinnedCommit, output, sha256: sha(bytes), bytes: bytes.length,
    sourceCsvSha256: csvSha256, metadataSha256: sha(meta), modelSha256: sha(model), verificationSha256: sha(verificationBytes),
    legacyWitnessSha256: sha(legacyBytes), legacyImporterSha256: sha(importerBytes), decoderSha256: sha(decoderBytes),
    importerSha256: sha(await readFile('tools/browser-bridge/import-openbiomechanics-library.mjs')),
    sourceTrials: 677, includedClips: 673, excluded: index.filter(row => !row.eligible),
    defaultSelectionClipIds: legacy.clips.map(clip => clip.id), measuredKeys: runtimeClips.reduce((sum, clip) => sum + clip.frames.length, 0),
    maximumHandResidualM: Math.max(...perClip.map(clip => clip.maximumHandResidualM)),
    role: 'BAT_AXIS_CONTACT_WINDOW_RESEARCH_NOT_BODY_FORMS_OR_673_DISTINCT_PLAYERS', perClip };
  await mkdir(dirname(manifestPath), { recursive: true }); await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ output, manifestPath, sha256: manifest.sha256, bytes: bytes.length,
    sourceTrials: 677, includedClips: 673, defaultSelectionClips: 12, measuredKeys: manifest.measuredKeys, maximumHandResidualM: manifest.maximumHandResidualM }));
  return { data, manifest };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2], 'Pass the pinned downloaded dataset directory');
  await importMeasuredBatLibrary(resolve(process.argv[2]), resolve(process.argv[3] ?? 'docs/demos/measured-bat-library-v1.json'),
    resolve(process.argv[4] ?? 'docs/verification/releases/v68/measured-library/build-manifest.json'));
}
