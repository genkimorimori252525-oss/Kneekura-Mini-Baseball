import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { flight } from '../../core/world/psychology/batting/BattingFixtures.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePaLifecycleClaimRows } from './SamePlateAppearanceLifecycleClaimGuard';
import { samePaLifecycleSchema } from './SamePlateAppearanceLifecycleStorage';
import { samePaPhysicalEpisodeSchema, physicalEpisodeTables as physical } from './SamePlateAppearancePhysicalEpisodeStorage';
import { samePaPhysicalEpisodeSourceInput } from './SamePlateAppearancePhysicalEpisode';
import { samePaLifecycleSourceInput } from './SamePlateAppearanceLifecycle';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';

type Ref = Readonly<{ owner: string; sourceId: string; sourceHash: string; snapshotHash: string }>;
type Source = Readonly<{ sourceId: string; sourceVersion: string; [key: string]: unknown }>;
const ref = (owner: string, sourceId = owner): Ref => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash('snapshot:' + sourceId) });
const root = ref('same_pa_enrollments', 'metadata-enrollment');
const sourceVersion = 'explicit-metadata-shape-v131';

/** Primitive closure only, following MetadataCompilation's structural rows and
 * PE01/PE04's explicit Source values. No Actor, mastery, physical result or
 * Native domain admission is claimed. Exact owner schemas and Source parsers,
 * 10 members/32 route refs, full hashes and recursive closure remain enabled. */
function fixture() {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(':memory:');
  for (const ddl of [...Object.values(samePaLifecycleSchema), ...Object.values(samePaPhysicalEpisodeSchema)]) db.exec(ddl);
  const archive = (table: string, source: Source) => {
    const snapshot = { source }, columns = db.prepare(`PRAGMA main.table_info(${table})`).all();
    const values = columns.map(c => {
      const key = String(c.name);
      if (key === 'source_id') return source.sourceId;
      if (key === 'source_version') return source.sourceVersion;
      if (key === 'source_json') return json(source);
      if (key === 'snapshot_json') return json(snapshot);
      if (key === 'source_hash') return hash(source);
      if (key === 'snapshot_hash') return hash(snapshot);
      if (key === 'enrollment_source_id') return root.sourceId;
      if (key === 'pitch_ordinal') return 3;
      if (key === 'play_id') return 7;
      if (key === 'operation_ordinal') return table === physical.commitment ? 1 : 0;
      if (key === 'physical_pitch_source_id') return 'metadata-launch';
      if (key === 'canonical_key') return json([table, source.sourceId]);
      if (key === 'player_id' || key === 'route' || key === 'nominal_parameter_identity') return source.sourceId;
      return 'metadata:' + key;
    });
    db.prepare(`INSERT INTO ${table} VALUES(${values.map(() => '?').join(',')})`).run(...values);
    return { owner: table, sourceId: source.sourceId, sourceHash: hash(source), snapshotHash: hash(snapshot) };
  };
  const older = (table: string, id: string) => {
    db.exec(`CREATE TABLE ${table}(source_id TEXT,enrollment_source_id TEXT,source_json TEXT,snapshot_json TEXT)`);
    const source = { sourceId: id, sourceVersion, enrollmentReference: root };
    db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?)`).run(id, root.sourceId, json(source), json({ source }));
    return { owner: table, sourceId: id, sourceHash: hash(source), snapshotHash: hash({ source }) };
  };
  const anchor = older('pa_continuation_v1_execution_views', 'metadata-anchor');
  const take = older('pa_take_successor_v1_pitch_actions', 'metadata-take');
  const posture = older('batting_observation_v1_postures', 'metadata-posture');
  const input = older('batting_execution_v1_inputs', 'metadata-input');
  const intent = older('batting_execution_v1_intents', 'metadata-intent');
  const prefix = archive('pa_lifecycle_v1_work_prefixes', samePaLifecycleSourceInput({ sourceId: 'metadata-prefix', sourceVersion,
    capability: 'same_pa_lifecycle_prefix_v1', enrollmentReference: root, anchorViewReference: anchor, eventReferences: [take] }));
  const members = Array.from({ length: 10 }, (_, i) => ({ playerId: 'metadata-player-' + i, bindingHash: hash(['binding', i]),
    personHash: hash(['person', i]), baselineSourceId: 'metadata-baseline-' + i, reservedRevision: 0,
    reservedStateHash: hash(['reserved', i]), projectedStateHash: hash(['projected', i]) }));
  const totals = members.map((m, i) => archive('pa_lifecycle_v1_total_assessments', samePaLifecycleSourceInput({
    sourceId: 'metadata-total-' + i, sourceVersion, capability: 'same_pa_lifecycle_cumulative_total_v1', enrollmentReference: root,
    prefixReference: prefix, participantReference: { playerId: m.playerId, bindingHash: m.bindingHash, personHash: m.personHash,
      baselineSourceId: m.baselineSourceId, revision: 0, stateHash: m.reservedStateHash }, effortUnits: 0,
    provenance: { assessmentSourceId: 'metadata-effort-' + i, assessmentVersion: 'shape-v1', calibrationSourceId: 'explicit-zero', calibrationVersion: 'shape-v1' } })));
  const view = archive('pa_lifecycle_v1_execution_views', samePaLifecycleSourceInput({ sourceId: 'metadata-view', sourceVersion,
    capability: 'same_pa_lifecycle_cumulative_view_v1', enrollmentReference: root, prefixReference: prefix,
    participantTotalReferences: members.map((m, i) => ({ playerId: m.playerId, assessmentReference: totals[i] })) }));
  const values = dispatchCalibrationValues();
  const parameters: Record<string, string> = { batter_observation: 'observationCalibration', batter_decision: 'decisionModel', batter_motor: 'capability', batter_swing: 'repertoire' };
  const participantInputs = members.map((member, i) => {
    const routes = i === 0 ? ['batter_observation', 'batter_decision', 'batter_motor', 'batter_swing']
      : i === 1 ? ['pitch_delivery', 'defender_observation', 'defender_decision', 'defender_locomotion'] : ['defender_observation', 'defender_decision', 'defender_locomotion'];
    return { member, calibrationReferences: routes.map(route => {
      const id = 'metadata-calibration-' + i + ':' + route, parameterKey = parameters[route];
      const nominalOwner = parameterKey ? 'world_player_batting_models' : route === 'pitch_delivery' ? 'world_pitch_timing_baselines'
        : route === 'defender_observation' ? 'world_player_observation_models' : route === 'defender_decision' ? 'world_player_decision_models' : 'world_player_locomotion_models';
      const calibration = archive('pa_lifecycle_v1_execution_calibrations', samePaLifecycleSourceInput({ sourceId: id, sourceVersion,
        capability: 'same_pa_lifecycle_execution_calibration_v1', enrollmentReference: root, viewReference: view, firstPhysicalPitchSourceId: take.sourceId,
        member, route, nominalReference: ref(nominalOwner), nominalParameterReference: parameterKey
          ? { parameterKey, sourceId: 'metadata-parameter:' + route, sourceVersion, sourceHash: hash(route) } : null,
        acceptedAtDay: 10, provenance: { assessmentSourceId: id + ':assessment', assessmentVersion: 'shape-v1', calibrationSourceId: id + ':calibration', calibrationVersion: 'shape-v1' },
        response: route === 'pitch_delivery' ? { kind: 'accepted_pitch_response_v1', policyReference: ref('world_pitch_fatigue_policies') }
          : { kind: 'accepted_execution_values_v1', values: values[route as keyof typeof values] } }));
      return { route, calibrationReference: calibration };
    }) };
  });
  const base = { sourceVersion, viewReference: view };
  const action = archive(physical.action, samePaPhysicalEpisodeSourceInput({ ...base, sourceId: 'metadata-action', capability: 'same_pa_physical_action_v1',
    physicalPitchSourceId: 'metadata-launch', timingReference: ref('world_pitch_timing_baselines'), releaseReference: ref('world_player_release_baselines'),
    pitchResponseReference: ref('world_pitch_fatigue_policies'), batterModelReference: ref('world_player_batting_models'), battingMode: 'observer_decision',
    actualFlightParameters: flight().parameters, contactResponse: 'nathan_2012_wood_local_v1',
    nominalPitch: { delivery: { matchSeed: 19, moundReference: { x: 0, y: 0, z: 18 }, outingId: 'outing-1', readyAtUs: 0,
      timingIntent: { deliveryMode: 'NORMAL', cadenceIntent: 'STANDARD' }, physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } } },
      flight: { durationUs: 1_500_000, acceleration: { x: 0, y: 0, z: 0 } }, batter: { action: { kind: 'take' }, plateZ: 0,
        strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.8 }, ballRadiusMeters: 0.0366 } } }));
  const right = archive(physical.right, samePaPhysicalEpisodeSourceInput({ ...base, sourceId: 'metadata-right', capability: 'same_pa_physical_right_v1',
    actionReference: action, postureReference: posture, participantInputs }));
  const launch = archive(physical.launch, samePaPhysicalEpisodeSourceInput({ ...base, sourceId: 'metadata-launch', capability: 'same_pa_physical_launch_v1',
    actionReference: action, rightReference: right }));
  const ordinary = { ...base, sourceId: 'metadata-commitment', capability: 'same_pa_physical_commitment_v1', launchReference: launch,
    previousOperationReference: launch, inputReference: input, intentReference: intent };
  const spin = { ...ordinary, capability: 'same_pa_physical_commitment_v123', spinBindingV123: { kind: 'fixed_native_spin_binding_v123',
    modelReference: ref('world_player_batting_models'), intent: { technique: 'NO_SPIN_TARGET', selectedAtTick: 10 }, qualificationReferences: [] } };
  const read = () => {
    db.exec('BEGIN'); db.exec('PRAGMA query_only=1');
    try { return withSamePaContinuationReadPhase(db, () => readSamePaLifecycleClaimRows(db)); }
    finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
  };
  return { db, ordinary, spin, archive, read };
}

it.each(['v1', 'v123'] as const)('keeps a parser-valid %s commitment in its exact table and closed original enrollment graph', version => {
  const f = fixture();
  try {
    const source = version === 'v1' ? f.ordinary : f.spin;
    expect(samePaPhysicalEpisodeSourceInput(source)).toEqual(source);
    f.archive(physical.commitment, source);
    const claims = f.read();
    expect(claims.filter(c => c.table === physical.commitment)).toHaveLength(1);
    expect(claims.every(c => json(c.enrollmentSourceIds) === json([root.sourceId]))).toBe(true);
    expect(claims.filter(c => c.table === 'pa_lifecycle_v1_execution_calibrations')).toHaveLength(32);
  } finally { f.db.close(); }
});

it.each([physical.cut, physical.resolution, physical.launch])('rejects a v123 commitment Source moved into %s despite correct hashes and closure refs', table => {
  const f = fixture();
  try { f.archive(table, { ...f.spin, sourceId: 'moved-spin-commitment' }); expect(f.read).toThrow(); }
  finally { f.db.close(); }
});

it.each(['unknown version', 'model hash', 'qualification owner'] as const)('retains strict Source parsing for %s', fault => {
  const f = fixture();
  try {
    const source = fault === 'unknown version' ? { ...f.spin, capability: 'same_pa_physical_commitment_v124' }
      : fault === 'model hash' ? { ...f.spin, spinBindingV123: { ...f.spin.spinBindingV123, modelReference: { ...f.spin.spinBindingV123.modelReference, snapshotHash: 'broken' } } }
        : { ...f.spin, spinBindingV123: { ...f.spin.spinBindingV123, qualificationReferences: [ref('world_player_batting_models', 'foreign-qualification')] } };
    expect(() => samePaPhysicalEpisodeSourceInput(source)).toThrow();
    f.archive(physical.commitment, source); expect(f.read).toThrow();
  } finally { f.db.close(); }
});

it('keeps exact namespace and unresolved original-owner rejection around an ordinary commitment control', () => {
  const f = fixture();
  try {
    f.archive(physical.commitment, f.ordinary); expect(f.read).not.toThrow();
    f.db.prepare('DELETE FROM batting_execution_v1_inputs WHERE source_id=?').run('metadata-input');
    expect(f.read).toThrow(/malformed or orphan/);
  } finally { f.db.close(); }
  const shadow = fixture();
  try {
    shadow.archive(physical.commitment, shadow.ordinary);
    shadow.db.exec('CREATE TEMP TABLE pa_physical_v1_commitments(fake TEXT)');
    expect(shadow.read).toThrow(/namespace|malformed/);
  } finally { shadow.db.close(); }
});
