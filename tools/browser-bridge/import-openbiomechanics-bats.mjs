import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (condition, message) => { if (!condition) throw Error(message); };
// CSV quoting is handled without evaluating or executing downloaded source.
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (c === ',' || c === '\n')) { row.push(cell.replace(/\r$/, '')); cell = ''; if (c === '\n') { rows.push(row); row = []; } }
    else cell += c;
  }
  assert(!quoted, 'Unclosed CSV quote');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift(); headers[0] = headers[0].replace(/^\uFEFF/, '');
  return rows.filter(row => row.length > 1).map(row => { assert(row.length === headers.length, 'CSV column count differs'); return Object.fromEntries(headers.map((key, i) => [key, row[i]])); });
}
export function originalTimeTick(text) {
  assert(/^\d+(?:\.\d{1,6})?$/.test(text), 'Source time cannot be represented exactly in microseconds');
  const [seconds, fraction = ''] = text.split('.'), tick = Number(BigInt(seconds) * 1_000_000n + BigInt(fraction.padEnd(6, '0')));
  assert(Number.isSafeInteger(tick), 'Unsafe source clock'); return tick;
}
const coordinateKeys = ['blast_hand_x', 'blast_hand_y', 'blast_hand_z', 'sweet_spot_x', 'sweet_spot_y', 'sweet_spot_z'];
// Right-handed cyclic permutation: source +X mound, +Y right box, +Z up.
export const worldPoint = ([x, y, z]) => ({ x: y, y: z, z: x });

export async function importMeasuredBats(root, output) {
  const csvPath = 'selected/打撃_手元基準点と芯の軌道.csv', metaPath = 'baseball_hitting/data/metadata.csv';
  const [csv, meta, verificationBytes, license, model] = await Promise.all([
    readFile(resolve(root, csvPath)), readFile(resolve(root, metaPath)), readFile(resolve(root, 'selection-verification.json')),
    readFile(resolve(root, 'LICENSE-DATA.md'), 'utf8'), readFile(resolve(root, 'baseball_hitting/code/v3d/model/hitting_v1_model_hybrid.mdh')),
  ]);
  const verification = JSON.parse(verificationBytes), record = verification.selected.find(row => row.discipline === 'hitting');
  assert(verification.sourceCommit === '44b98dae05cceb016f080ab39d105c85b8639084', 'Unexpected pinned data commit');
  assert(record.sha256 === sha(csv), 'Selected CSV integrity differs');
  assert(verification.upstreamGitBlobsVerified.find(row => row.path === metaPath)?.sha256 === sha(meta), 'Metadata integrity differs');
  const modelPath = 'baseball_hitting/code/v3d/model/hitting_v1_model_hybrid.mdh';
  assert(verification.upstreamGitBlobsVerified.find(row => row.path === modelPath)?.sha256 === sha(model), 'Published bat model integrity differs');
  const metadata = new Map(parseCsv(meta.toString('utf8')).map(row => [row.session_swing, row]));
  const trials = new Map();
  for (const row of parseCsv(csv.toString('utf8'))) { if (!trials.has(row.session_swing)) trials.set(row.session_swing, []); trials.get(row.session_swing).push(row); }
  assert(trials.size === 677, 'Unexpected swing census');
  const index = [...trials].map(([id, rows]) => {
    const m = metadata.get(id); assert(m, 'Missing metadata: ' + id);
    const missingRows = rows.filter(row => coordinateKeys.some(key => row[key] === '' || !Number.isFinite(Number(row[key])))).length;
    const contact = originalTimeTick(rows[0].contact_time), lengthM = Number(m.bat_length_in) * .0254;
    const times = rows.map(row => originalTimeTick(row.time));
    assert(times.every((tick, i) => !i || tick > times[i - 1]), 'Nonmonotonic measured time');
    assert(rows.every(row => originalTimeTick(row.contact_time) === contact), 'Inconsistent contact event');
    return { id, side: m.hitter_side, athlete: m.user, speedMph: Number(m.bat_speed_mph_max_x), lengthM, missingRows,
      eligible: missingRows === 0 && ['R', 'L'].includes(m.hitter_side) && m.bat_length_in.trim() !== ''
        && lengthM > .5 && m.bat_speed_mph_max_x.trim() !== '' && Number.isFinite(Number(m.bat_speed_mph_max_x)) };
  });
  // Six quantile positions per recorded side; not an MLB/league population.
  const selected = ['R', 'L'].flatMap(side => { const ordered = index.filter(row => row.eligible && row.side === side).sort((a, b) => a.speedMph - b.speedMph || a.id.localeCompare(b.id));
    assert(ordered.length >= 6, 'Insufficient recorded handedness'); return [0, .2, .4, .6, .8, 1].map(q => ordered[Math.round(q * (ordered.length - 1))]); });
  const bundle = await build({ entryPoints: ['src/integration/browser/MeasuredBatAxisReferenceV1.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
  const { createMeasuredBatAxisReferenceV1 } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const kinBundle = await build({ entryPoints: ['src/core/sim/contact/ReferenceBatKinematicsV1.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
  const { createReferenceBatKinematicsV1 } = await import('data:text/javascript;base64,' + Buffer.from(kinBundle.outputFiles[0].text).toString('base64'));
  const clips = selected.map(entry => {
    const rows = trials.get(entry.id), contactTick = originalTimeTick(rows[0].contact_time);
    const selectedRows = rows.filter(row => { const tick = originalTimeTick(row.time); return tick >= contactTick - 300_000 && tick <= contactTick + 80_000; });
    assert(selectedRows.length >= 100, 'Insufficient contact-window data');
    const measurements = selectedRows.map(row => { const values = coordinateKeys.map(key => Number(row[key])); return { tick: originalTimeTick(row.time),
      handReference: worldPoint(values.slice(0, 3)), sweetSpot: worldPoint(values.slice(3)) }; });
    const id = 'obp-' + entry.id, source = { archive: 'OpenBiomechanics dataset-v1 hitting_landmarks.zip', motion: entry.id,
      model: 'Published two-point bat binding; no body rig', author: 'Driveline Baseball / OpenBiomechanics', sha256: sha(csv),
      repository: 'https://github.com/drivelineresearch/openbiomechanics', commit: verification.sourceCommit,
      metadataSha256: sha(meta), modelSha256: sha(model), originalCsvPath: csvPath, sourceRowsSha256: sha(JSON.stringify(selectedRows)) };
    const adapted = createMeasuredBatAxisReferenceV1({ provenance: { clipId: id, sourceSha256: source.sha256 }, frames: measurements,
      batLengthM: entry.lengthM, sweetSpotFromTipM: .1524, handReferenceFromKnobM: .17145, maximumHandResidualM: .02,
      sourceTicksPerSecond: 1e6, startTick: measurements[0].tick, ticksPerSecond: 1e6, playbackRate: 1,
      transform: { rotation: { w: 1, x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 } });
    const motor = createReferenceBatKinematicsV1(adapted.reference);
    const frames = adapted.reference.frames.map((frame, i) => { const sample = motor.sample(frame.tick), a = measurements[Math.max(0, i - 1)], b = measurements[Math.min(measurements.length - 1, i + 1)], dt = (b.tick - a.tick) / 1e6;
      assert(Math.hypot(...['x', 'y', 'z'].map(axis => sample.sweetSpot[axis] - measurements[i].sweetSpot[axis])) < 1e-10, 'Measured sweet spot drift');
      return { tick: frame.tick, grip: sample.state.pose.grip, tip: sample.state.pose.tip, orientation: sample.orientation,
        sweetSpot: measurements[i].sweetSpot, sweetSpotVelocity: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, (b.sweetSpot[axis] - a.sweetSpot[axis]) / dt])) }; });
    return { id, label: `${entry.side === 'R' ? '右' : '左'}打者 ${entry.id} · 記録 ${entry.speedMph.toFixed(1)}mph`, source,
      timeRange: { start: frames[0].tick / 1e6, end: frames.at(-1).tick / 1e6 }, contactTimeSeconds: contactTick / 1e6,
      normalization: { batLengthM: entry.lengthM, sweetSpotT: adapted.reference.sweetSpotT, positionScale: 1 },
      side: entry.side, measurements, sourceRows: selectedRows, frames,
      binding: { sweetSpotFromTipM: .1524, handReferenceFromKnobM: .17145, maximumHandResidualM: adapted.maximumHandResidualM,
        axialPhase: adapted.axialPhase, knobAndTip: 'DECLARED_RIGID_BINDING_NOT_MEASURED_ENDPOINTS' },
      metrics: { maxSweetSpotSpeedMps: motor.maximumSweetSpotSpeedMps, recordedBatSpeedMph: entry.speedMph },
      assumptions: ['元の小数時刻を正確なmicrosecond tickに変換。360Hz名目値から再時刻化しない。',
        '世界座標 = (元Y, 元Z, 元X)、単位m。平行移動・左右反転・接触合わせは行わない。',
        '芯の標本は実測値。ノブ・先端は公称長と公開オフセットによる剛体推定。軸まわり回転は未測定。',
        '接触前0.30秒～後0.08秒の原標本を保持。欠損試行は補間せず候補から除外。'],
      license: 'CC BY-NC-SA 4.0; professional sports organization / financial analysis firm restrictions apply; see bundled original license',
      nativeAdmission: false, officialResult: null };
  });
  const data = { schemaVersion: 2, authority: 'OPENBIOMECHANICS_MEASURED_BAT_AXIS_RESEARCH', sourceCommit: verification.sourceCommit,
    clock: { ticksPerSecond: 1e6, sourceTime: 'ORIGINAL_DECIMAL_SECONDS', nominalCaptureHz: 360, interpolation: 'LINEAR_GRIP_SHORTEST_SO3_BETWEEN_KEYS_NOT_MEASURED' },
    coordinateRegistration: { worldFromLab: [[0, 1, 0], [0, 0, 1], [1, 0, 0]], determinant: 1, translation: [0, 0, 0], units: 'metres' },
    selection: { sourceTrials: trials.size, includedClips: clips.length, missingCoordinateRows: index.reduce((sum, row) => sum + row.missingRows, 0),
      rule: 'Six speed-ordered quantile trials per recorded side; complete measured contact window, no mirroring', population: 'DATASET_COHORT_NOT_LEAGUE_REFERENCE' },
    defaultClipId: clips[2].id, comparisonClipId: clips[8].id, index, licenseText: license, clips };
  await writeFile(output, JSON.stringify(data) + '\n');
  console.log(JSON.stringify({ output, sha256: sha(await readFile(output)), bytes: (await readFile(output)).length, ...data.selection,
    measuredKeys: clips.reduce((n, clip) => n + clip.frames.length, 0), maximumHandResidualM: Math.max(...clips.map(clip => clip.binding.maximumHandResidualM)) }, null, 2));
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert(process.argv[2], 'Pass the downloaded dataset directory');
  await importMeasuredBats(resolve(process.argv[2]), resolve(process.argv[3] ?? 'docs/demos/measured-bat-motions.json'));
}
