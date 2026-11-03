import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from '../../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION } from '../../../src/host/world/SamePlateAppearanceBallPhysics';
import type { SamePaPhysicalOperationReference } from '../../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { BattedWorldFieldMotionAdoptionInput } from '../../../src/core/sim/ball/BattedWorldFieldMotion';
import { deriveSourceBattedFieldMotionV3 } from '../../../src/core/sim/ball/SourceBattedFieldMotionV3';
import { advanceSourceFieldToIntegerBoundaryV1 } from '../../../src/core/sim/ball/SourceFieldIntegerBoundaryV1';
import { deriveSourceBattedFieldMotorMotionV1, type SourceBattedFieldMotorActionV1 } from '../../../src/core/sim/ball/SourceBattedFieldMotorMotionV1';
import { createSourceFreeBallKernel } from '../../../src/core/sim/ball/SourceFreeBallKernel';

/** Read a declared CLOSED snapshot only. This helper does not copy, admit,
 * publish Sources, open a writable owner store or grant Native motor credit. */
const [closedManifestArgument, originalManifestArgument, outputArgument] = process.argv.slice(2);
assert.ok(closedManifestArgument && originalManifestArgument && outputArgument, 'closed manifest, original reference manifest and new output JSON required');
const closed = JSON.parse(readFileSync(resolve(closedManifestArgument), 'utf8')) as {
  databasePath: string; sourceMapPath: string; databaseHash: string; sourceMapHash: string; allRowsAndSchemaEqual: boolean };
const refs = JSON.parse(readFileSync(resolve(originalManifestArgument), 'utf8')) as {
  rootReference: SamePaPhysicalOperationReference; stepReference: SamePaPhysicalOperationReference };
assert.equal(closed.allRowsAndSchemaEqual, true, 'a closed checkpoint manifest is required');
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const assertFiles = () => { assert.equal(sha(closed.databasePath), closed.databaseHash); assert.equal(sha(closed.sourceMapPath), closed.sourceMapHash); };
assertFiles();
const db = new DatabaseSync(closed.databasePath, { readOnly: true });
const rows = () => {
  const schema = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return hash({ schema, tables: schema.map(row => {
    const name = String(row.name); assert.match(name, /^[A-Za-z_][A-Za-z_0-9]*$/);
    return { name, rows: db.prepare('SELECT rowid AS proof_rowid,* FROM main.' + name + ' ORDER BY rowid').all() };
  }) });
};
const before = rows(), started = Date.now();
try {
  assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
  const original = withSqliteReadTransaction(db, () => ({
    root: readSamePaPhysicalOperationFromSqlite(db, refs.rootReference).record,
    step: readSamePaPhysicalOperationFromSqlite(db, refs.stepReference).record }));
  const { root, step } = original;
  if (root.kind !== 'same_pa_physical_field_root_v1' || step.kind !== 'same_pa_physical_field_step_v1') throw new Error('original field root/step kinds required');
  assert.equal(root.source.sourceVersion, SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION);
  assert.equal(step.source.action, undefined);
  const curve = root.response.world.sourceCurve; assert.ok(curve);
  const initial: BattedWorldFieldMotionAdoptionInput = { response: root.response, geometry: root.geometry, actors: root.response.world.actors,
    carrierPlayerId: null, cursor: { moment: curve.initial, sourceCurve: curve, sourceSide: 'incoming', previousContacts: [] },
    availableAtTick: curve.initial.ball.tick, coverageThroughTick: Math.min(...root.response.world.actors.map(a => a.primitive.endTick)),
    commands: root.source.commands.flatMap(c => c.primitiveMotions.map(p => ({ playerId: c.playerId, role: p.role,
      acceleration: { x: c.bodyAcceleration.x + p.offsetAcceleration.x, y: c.bodyAcceleration.y + p.offsetAcceleration.y,
        z: c.bodyAcceleration.z + p.offsetAcceleration.z } }))) };
  const throughTicks = [...(root.source.throughTick > curve.initial.ball.tick ? [root.source.throughTick] : []), step.source.throughTick];
  const originalTrace = deriveSourceBattedFieldMotionV3({ initial, throughTicks });
  assert.deepEqual(originalTrace.field, step.field);
  assert.deepEqual(root.field, root.source.throughTick > curve.initial.ball.tick ? originalTrace.steps[0].field : originalTrace.initial);
  const waited = advanceSourceFieldToIntegerBoundaryV1({ initial, throughTicks });
  assert.equal(waited.kind, 'reached_integer_boundary'); assert.ok(waited.boundary.waitSeconds > 0);
  const atInteger = waited.trace.field.motion.cursor; assert.ok(atInteger?.sourceCurve);
  const selected = initial.commands.find(c => c.role === 'body'); assert.ok(selected);
  // Explicit operator fixture, separate from all authenticated original values.
  // There is no ability/model/team/motor Source admission for this acceleration.
  const operator = { playerId: selected.playerId, role: selected.role, acceleration: { x: 0.25, y: 0, z: 0 } };
  const commands = initial.commands.map(c => c.playerId === operator.playerId && c.role === operator.role ? operator : c);
  const targetTick = waited.boundary.boundaryTick + 1000;
  assert.ok(targetTick <= initial.coverageThroughTick, 'do not renew original actor coverage');
  const actions: SourceBattedFieldMotorActionV1[] = [...throughTicks.map(throughTick => ({ kind: 'advance' as const, throughTick })),
    { kind: 'advance', throughTick: waited.boundary.boundaryTick },
    { kind: 'adopt', availableAtTick: waited.boundary.boundaryTick, coverageThroughTick: initial.coverageThroughTick, commands },
    { kind: 'advance', throughTick: targetTick }];
  const motor = deriveSourceBattedFieldMotorMotionV1({ initial, actions });
  assert.deepEqual(motor.steps[throughTicks.length].field, waited.trace.field);
  assert.deepEqual(motor.steps[throughTicks.length + 1].field.motion.cursor, atInteger);
  const final = motor.field.motion.cursor; assert.ok(final?.sourceCurve); assert.equal(motor.field.motion.world.kind, 'moving');
  assert.deepEqual(final.sourceCurve.initial, atInteger.sourceCurve.initial); assert.deepEqual(final.sourceCurve.profile, curve.profile);
  assert.deepEqual(final.moment, createSourceFreeBallKernel(final.sourceCurve).evaluateAt(final.moment.elapsedSeconds, final.sourceSide).moment);
  assert.equal(final.moment.ball.tick, targetTick);
  const actor = motor.field.motion.actors.find(a => a.playerId === operator.playerId && a.primitive.role === operator.role); assert.ok(actor);
  assert.deepEqual(actor.primitive.acceleration, operator.acceleration);
  assert.equal(actor.startElapsedSeconds, waited.boundary.boundaryElapsedSeconds);
  assert.equal(rows(), before); assertFiles();
  const proof = { status: 'PASS_CLOSED_NATIVE_SOURCE_READ_AND_PURE_INTEGER_MOTOR_REPLAY', authority: 'CORE_REPLAY_NOT_NATIVE_MOTOR_ADMISSION',
    databaseHash: closed.databaseHash, sourceMapHash: closed.sourceMapHash, schemaAndAllRowsHash: before, databaseAndMapUnchanged: true,
    originalOwnerAuthentication: true, sourceMapAuthorityUsed: false, rootReference: refs.rootReference, stepReference: refs.stepReference,
    originalFieldHash: hash(step.field), originalSolverEvidenceHash: hash(step.ballSolverEvidence), originalInputHash: hash(initial),
    originalGroundCursor: step.field.motion.cursor, integerBoundary: waited.boundary, integerCursor: atInteger,
    operatorSyntheticMotorFixture: operator, operatorFixtureIsCalibratedAbility: false, commandSource: 'DECLARED_OPERATOR_FIXTURE_NOT_ACCEPTED_SOURCE',
    allActorPrimitiveCount: motor.field.motion.actors.length, finalCursor: final, finalActorPrimitive: actor,
    nativeAdmission: false, bodyExecution: false, teamExecutionCredit: 0, official: null,
    elapsedMilliseconds: Date.now() - started, pid: process.pid };
  db.close(); assertFiles();
  writeFileSync(resolve(outputArgument), JSON.stringify(proof, null, 2), { flag: 'wx' });
  process.stdout.write(JSON.stringify({ status: proof.status, elapsedMilliseconds: proof.elapsedMilliseconds, output: resolve(outputArgument) }) + '\n');
} catch (error) { try { db.close(); } catch { /* already closed */ } throw error; }
