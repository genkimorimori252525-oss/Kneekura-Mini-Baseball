import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual, strictEqual, throws } from 'node:assert';
import { actorJson as json } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { cloneInert } from '../../../src/core/adjudication/OfficialWindowPolicy';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { initialJointRecoveryExecutionTable } from '../../../src/host/world/SqliteInitialJointRecoveryExecutionStore';
import { initialJointRecoveryWorkloadTable, readInitialJointRecoveryWorkloadBasisFromSqlite,
  openSqliteInitialJointRecoveryWorkloadStore, readInitialJointRecoveryWorkloadFromSqlite } from '../../../src/host/world/SqliteInitialJointRecoveryWorkloadStore';
import { initialJointRecoveryWorkloadViewInput } from '../../../src/host/world/InitialJointRecoveryWorkloadProjection';
import { openSqliteJointFieldSuccessorExecutionStore, readJointFieldSuccessorExecutionFromSqlite, jointFieldSuccessorExecutionTable } from '../../../src/host/world/SqliteJointFieldSuccessorExecutionStore';
import { jointFieldSuccessorCommandInput, type AcceptedJointFieldSuccessorCommand } from '../../../src/host/world/JointFieldSuccessorCommand';
import type { BattedActorResponseProfile } from '../../../src/core/sim/ball/BattedBallContactResponse';

const [mode, inputArg, outputArg] = process.argv.slice(2);
if (!['prepare', 'workload', 'motion', 'guards', 'readback'].includes(mode) || !inputArg || !outputArg) throw new Error('requires prepare|workload|motion|guards|readback, recovery directory, successor directory');
const input = resolve(inputArg), output = resolve(outputArg), original = resolve(input, 'match.sqlite'), path = resolve(output, 'match.sqlite');
const Native = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const durable = (file: string) => ({ main: sha(file), wal: existsSync(file + '-wal') && readFileSync(file + '-wal').length ? sha(file + '-wal') : null });
const originalDurable = durable(original);
deepStrictEqual(originalDurable, JSON.parse(readFileSync(resolve(input, 'independent-readback.json'), 'utf8')).beforeDurableContent);
const census = (db: InstanceType<typeof Native.DatabaseSync>) => ({ schema: db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all().map(r => ({ ...r })),
  rows: db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => [r.name,
    createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM main."' + String(r.name).replaceAll('"', '""') + '"').all().map(v => JSON.stringify(v)).sort())).digest('hex')]) });
const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const load = (name: string) => JSON.parse(readFileSync(resolve(output, name), 'utf8'));
const originalRecovery = JSON.parse(readFileSync(resolve(input, 'execution.json'), 'utf8'));

if (mode === 'prepare') {
  strictEqual(originalDurable.wal, null); mkdirSync(output); copyFileSync(original, path); deepStrictEqual(durable(path), originalDurable);
  const db = new Native.DatabaseSync(path, { readOnly: true });
  try {
    const before = census(db); strictEqual(before.rows.length, 78); db.exec('PRAGMA query_only=1; BEGIN');
    process.stdout.write('READ_COMPLETE_ORIGINAL_AND_RECOVERY_WORK_COVERAGE\n');
    const b = withBattedWorldPhysicalReadTraversal(db, () => withSamePaLifecycleReadPhase(db,
      () => readInitialJointRecoveryWorkloadBasisFromSqlite(db, reference(initialJointRecoveryExecutionTable, originalRecovery))));
    const source = { sourceId: 'authored-joint:recovery-cumulative-workload', sourceVersion: 'v1',
      capability: 'initial_joint_recovery_cumulative_workload_view_v1', recoveryReference: b.recoveryReference, coverageHash: b.coverageHash,
      assessment: { basis: 'EXPLICIT_SYNTHETIC_PREFIX_ASSESSMENT_V1', availableAtDay: b.gameDay,
        assessmentSourceId: 'explicit-synthetic-total-through-recovery-not-physiology', assessmentVersion: 'v1',
        calibrationSourceId: 'explicit-synthetic-match-effort-unit-test', calibrationVersion: 'v1' },
      participantTotals: b.previousWorkload.participants.map(p => ({ participantReference: p.participantReference,
        effortUnits: p.effortUnits + (b.advancedPlayerIds.includes(p.playerId) ? .05 : 0) })) };
    initialJointRecoveryWorkloadViewInput(source); save('workload-source.json', source); save('workload-basis.json', b); save('before-census.json', before);
    deepStrictEqual(census(db), before); db.exec('COMMIT'); deepStrictEqual(durable(original), originalDurable);
    save('prepare-report.json', { status: 'PREPARED_EXPLICIT_SYNTHETIC_RECOVERY_TOTAL_NOT_ADOPTED', motionIssued: false, original78RowsAndSchemasUnchanged: true });
  } finally { db.close(); }
} else if (mode === 'workload') {
  const source = load('workload-source.json'), before = load('before-census.json');
  const owner = openSqliteInitialJointRecoveryWorkloadStore(path, { readAcceptedAssessment: id => id === source.sourceId ? source : null });
  try {
    process.stdout.write('ADOPT_COMPLETE_CUMULATIVE_RECOVERY_TOTAL\n'); const view = owner.accept(source.sourceId);
    if (view.kind === 'pending') throw new Error('explicit cumulative work pending');
    const b = load('workload-basis.json'), batterId = b.recovery.input.control.world.batterPlayerId;
    const batter = view.participants.find(p => p.playerId === batterId)!;
    strictEqual(batter.effortUnits > b.previousWorkload.participants.find((p: { playerId: string }) => p.playerId === batterId).effortUnits, true);
    strictEqual(batter.projectedState.revision, batter.reservedState.revision + 1); strictEqual(view.globalWorkloadCommitted, false); strictEqual(view.nextMotionAllowed, false);
    const db = new Native.DatabaseSync(path, { readOnly: true }); try {
      const after = census(db); strictEqual(after.rows.length, 79);
      deepStrictEqual(after.rows.filter(r => r[0] !== initialJointRecoveryWorkloadTable), before.rows);
      deepStrictEqual(after.schema.filter(r => r.tbl_name !== initialJointRecoveryWorkloadTable), before.schema);
      save('workload-view.json', view); save('after-workload-census.json', after);
    } finally { db.close(); }
    save('workload-report.json', { status: 'PASS_NATIVE_RECOVERY_CUMULATIVE_WORKLOAD', ownerMocks: false, allOriginal78TablesUnchanged: true,
      batterEffortUnits: batter.effortUnits, originalReservedFatigue: batter.reservedState.fatigue,
      projectedFatigue: batter.projectedState.fatigue, projectedRevision: batter.projectedState.revision,
      assessmentBasis: source.assessment.basis, measuredPhysiology: false, globalWorkloadCommitted: false, motionIssued: false });
    // This is a candidate command. The execution owner independently replays
    // every original dependency; these JSON files grant no actuation authority.
    const w = b.recovery.input.control.world, identities = [...w.pitch.otherActors.map((a: { playerId: string; primitive: { role: string } }) => ({ playerId: a.playerId, role: a.primitive.role })),
      { playerId: w.pitch.pitcherPlayerId, role: 'tag_hand' }];
    const actorProfiles = identities.map(a => ({ playerId: a.playerId, profile: a.role === 'glove'
      ? { role: 'glove' as const, pocketCenterOffset: { x: 0, y: 0, z: 0 }, bodyStability: 1, parameters: { ticksPerSecond: 1e6, ballMassKg: w.ball.massKg,
        ballRadiusMeters: w.ball.radiusM, pocketRadiusMeters: .1, centerRetentionCapacityJ: 20, captureDissipationPowerW: 1000,
        failedContactRestitution: .1, failedTangentialDamping: .3, failedSpinDamping: .1 } }
      : { role: a.role, material: { restitution: .3, tangentialDamping: .2, spinDamping: .1 } } as BattedActorResponseProfile }));
    const ball = b.recovery.executedThroughMoment.ball.position;
    const pitcher = w.pitch.otherActors.find((a: { playerId: string; primitive: { role: string } }) => a.playerId === w.pitch.pitcherPlayerId && a.primitive.role === 'body').primitive.startCenter;
    const dx = ball.x - pitcher.x, dz = ball.z - pitcher.z, distance = Math.hypot(dx, dz);
    const acceleration = { x: .5 * dx / distance, y: 0, z: .5 * dz / distance };
    const command: AcceptedJointFieldSuccessorCommand = { sourceId: 'authored-joint:finite-field-successor', sourceVersion: 'v1', capability: 'owned_joint_field_successor_execution_v1',
      workloadViewReference: reference(initialJointRecoveryWorkloadTable, view), recoveryReference: source.recoveryReference,
      throughTick: b.recovery.executedThroughMoment.ball.tick + 1000000, equipmentId: 'retained-original-bat', actorProfiles, surfaces: [], surfaceProfiles: [], baseGeometry: null,
      modelCalibration: { basis: 'EXPLICIT_SYNTHETIC_FINITE_FIELD_CONTROL_V1', modelId: 'rigid_actor_spheres_horizontal_acceleration_v1',
        feedback: 'ZERO_DELAY_SNAPSHOT_TEST_CONTROL', availableAtDay: b.gameDay, assessmentSourceId: 'explicit-finite-pitcher-approach-test-not-general-nine-AI', assessmentVersion: 'v1',
        footGroundSupport: { kind: 'compliant_stationary_sole_v1', maximumCompressionMeters: .002 } },
      participantResponses: view.participants.map(p => ({ playerId: p.playerId, personHash: p.participantReference.personHash, projectedStateHash: p.projectedStateHash,
        calibrationSourceId: 'explicit-synthetic-fatigue-SI-response-test', calibrationVersion: 'v1', availableAtDay: b.gameDay,
        fatigueSamples: [{ fatigue: 0, maximumBodySpeedMps: 5, maximumGloveSpeedMps: 5, maximumAccelerationMps2: 1 },
          { fatigue: 1, maximumBodySpeedMps: 4, maximumGloveSpeedMps: 4, maximumAccelerationMps2: .8 }] })),
      commands: identities.map(a => ({ playerId: a.playerId, role: a.role, acceleration: a.playerId === w.pitch.pitcherPlayerId ? acceleration : { x: 0, y: 0, z: 0 } })) };
    jointFieldSuccessorCommandInput(command); save('motion-source.json', command);
  } finally { owner.close(); }
} else if (mode === 'motion') {
  const source = load('motion-source.json'), before = load('after-workload-census.json');
  const owner = openSqliteJointFieldSuccessorExecutionStore(path, { readAcceptedCommand: id => id === source.sourceId ? source : null });
  try {
    process.stdout.write('EXECUTE_FINITE_FIELD_SUCCESSOR_FROM_REASSESSED_STATE\n'); const v = owner.accept(source.sourceId);
    if (v.kind === 'pending') throw new Error('finite command pending');
    strictEqual(v.physicalExecutionAdmitted, true); strictEqual(v.motionIssued, true); strictEqual(v.executedThroughMoment.ball.tick, source.throughTick);
    strictEqual(v.terminalState.stopped, false); strictEqual(v.officialResult, null); strictEqual(v.nextMotionAllowed, false);
    const pitcherId = v.root.response.world.actors.find(a => a.primitive.role === 'body' && v.source.commands.some(c => c.playerId === a.playerId && c.acceleration.z !== 0))!.playerId;
    const moving = v.terminalState.actors.find(a => a.playerId === pitcherId && a.primitive.role === 'body')!;
    strictEqual(Math.hypot(moving.primitive.acceleration.x, moving.primitive.acceleration.z) > 0, true);
    const db = new Native.DatabaseSync(path, { readOnly: true }); try {
      const after = census(db); strictEqual(after.rows.length, 80);
      deepStrictEqual(after.rows.filter(r => r[0] !== jointFieldSuccessorExecutionTable), before.rows);
      deepStrictEqual(after.schema.filter(r => r.tbl_name !== jointFieldSuccessorExecutionTable), before.schema);
      save('execution.json', v); save('after-motion-census.json', after);
    } finally { db.close(); }
    save('motion-report.json', { status: 'PASS_NATIVE_OWNED_FIELD_SUCCESSOR_EXECUTION', ownerMocks: false, tableCount: 80, original79SchemasAndRowsUnchanged: true,
      physicalExecutionAdmitted: true, motionIssued: true, fromElapsedSeconds: v.issuedAtMoment.elapsedSeconds, throughElapsedSeconds: v.executedThroughMoment.elapsedSeconds,
      stepCount: v.steps.length, bodyPrimitiveCount: v.terminalState.actors.length, heldBatCount: v.terminalState.heldBats.length,
      fatigueAdjustedSIResponsesApplied: true, movingPitcherId: pitcherId, modelBasis: v.modelBasis, generalNineAIComplete: false, officialResult: null,
      nextMotionAllowed: false, requiresCumulativeWorkloadReassessment: true, fullMatchVerified: false });
  } finally { owner.close(); }
} else if (mode === 'guards') {
  const value = load('execution.json'), source = load('motion-source.json'), before = load('after-motion-census.json');
  const db = new Native.DatabaseSync(path), owner = openSqliteJointFieldSuccessorExecutionStore(path, { readAcceptedCommand: id => ['duplicate-successor', 'duplicate-hidden'].includes(id) ? { ...source, sourceId: id } : null });
  try {
    throws(() => owner.accept('duplicate-successor'), /already consumed/);
    const row = db.prepare('SELECT * FROM ' + jointFieldSuccessorExecutionTable + ' WHERE source_id=?').get(value.source.sourceId)!;
    db.prepare('UPDATE ' + jointFieldSuccessorExecutionTable + ' SET snapshot_hash=? WHERE source_id=?').run('0'.repeat(64), value.source.sourceId);
    try { throws(() => owner.read(value.source.sourceId), /hash differs/); }
    finally { db.prepare('UPDATE ' + jointFieldSuccessorExecutionTable + ' SET snapshot_hash=? WHERE source_id=?').run(String(row.snapshot_hash), value.source.sourceId); }
    const moved = { ...source, recoveryReference: { ...source.recoveryReference, sourceId: 'moved-recovery' },
      workloadViewReference: { ...source.workloadViewReference, sourceId: 'moved-workload' } };
    const hidden = JSON.stringify(moved).replace('"recoveryReference":' + JSON.stringify(moved.recoveryReference),
      '"recoveryReference":' + JSON.stringify(moved.recoveryReference) + ',"recoveryReference":' + JSON.stringify(source.recoveryReference))
      .replace('"workloadViewReference":' + JSON.stringify(moved.workloadViewReference),
        '"workloadViewReference":' + JSON.stringify(moved.workloadViewReference) + ',"workloadViewReference":' + JSON.stringify(source.workloadViewReference));
    db.prepare('UPDATE ' + jointFieldSuccessorExecutionTable + ' SET recovery_source_id=?,workload_view_source_id=?,source_json=?,snapshot_json=? WHERE source_id=?')
      .run('moved-recovery', 'moved-workload', hidden, '{}', value.source.sourceId);
    try { throws(() => owner.accept('duplicate-hidden'), /already consumed|descendant/); }
    finally { db.prepare('UPDATE ' + jointFieldSuccessorExecutionTable + ' SET recovery_source_id=?,workload_view_source_id=?,source_json=?,snapshot_json=? WHERE source_id=?')
      .run(String(row.recovery_source_id), String(row.workload_view_source_id), String(row.source_json), String(row.snapshot_json), value.source.sourceId); }
    for (const [table, id] of [[initialJointRecoveryWorkloadTable, value.workloadViewReference.sourceId], [initialJointRecoveryExecutionTable, value.recoveryReference.sourceId]]) {
      const parent = db.prepare('SELECT * FROM ' + table + ' WHERE source_id=?').get(id)!; db.prepare('DELETE FROM ' + table + ' WHERE source_id=?').run(id);
      try {
        if (table === initialJointRecoveryWorkloadTable) { const p = openSqliteInitialJointRecoveryWorkloadStore(path); try { throws(() => p.read(id), /surviving/); } finally { p.close(); } }
        else throws(() => owner.read(value.source.sourceId), /surviving|original recovery missing/);
      } finally { db.prepare('INSERT INTO ' + table + '(' + Object.keys(parent).join(',') + ') VALUES(' + Object.keys(parent).map(() => '?').join(',') + ')').run(...Object.values(parent)); }
    }
    deepStrictEqual(census(db), before); save('guards-report.json', { status: 'PASS_DUPLICATE_TAMPER_AND_MISSING_PARENT_GUARDS', duplicateParentAndViewRefused: true,
      snapshotHashTamperRefused: true, missingRecoveryAndWorkloadNotRepaired: true, exactLogicalRowsRestored: true });
  } finally { owner.close(); db.close(); }
} else {
  const value = load('execution.json'), expectedView = load('workload-view.json'), db = new Native.DatabaseSync(path, { readOnly: true });
  const before = census(db), beforeDurableContent = durable(path);
  try {
    db.exec('PRAGMA query_only=1; BEGIN'); process.stdout.write('COLD_RECONSTRUCT_NEW_TOTAL_AND_FIELD_EXECUTION_WITH_NORMAL_OWNERS\n');
    const actual = withBattedWorldPhysicalReadTraversal(db, () => withSamePaLifecycleReadPhase(db, () => {
      const view = readInitialJointRecoveryWorkloadFromSqlite(db, reference(initialJointRecoveryWorkloadTable, expectedView));
      strictEqual(json(cloneInert(view)), json(expectedView));
      return readJointFieldSuccessorExecutionFromSqlite(db, reference(jointFieldSuccessorExecutionTable, value));
    }));
    strictEqual(json(cloneInert(actual)), json(value)); deepStrictEqual(census(db), before); db.exec('COMMIT');
    deepStrictEqual(durable(path), beforeDurableContent); deepStrictEqual(durable(original), originalDurable);
    save(existsSync(resolve(output, 'independent-readback.json')) ? 'independent-readback-current-source.json' : 'independent-readback.json',
      { status: 'PASS_COLD_OS_READONLY_WORKLOAD_AND_EXECUTION', ownerMocks: false, authorCallbacks: false,
      tableCount: 80, allSchemasAndRowsUnchanged: true, durableContentUnchanged: true, originalInputUnchanged: true, beforeDurableContent,
      physicalExecutionAdmitted: true, motionIssued: true, nextMotionAllowed: false, fullMatchVerified: false });
  } finally { db.close(); }
}
