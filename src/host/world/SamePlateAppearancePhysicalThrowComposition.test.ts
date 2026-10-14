import type { DatabaseSync } from 'node:sqlite';
import { beforeEach, expect, it, vi } from 'vitest';
import { fixture, material, throwInput } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveBattedWorldFieldMotionAdoption } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveSamePaPhysicalFieldAction } from './SamePlateAppearancePhysicalFieldActionFromSqlite';
import { deriveSamePaLifecycleCalibration } from './SamePlateAppearanceLifecycleCalibration';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaPhysicalAction, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { AcceptedSamePaLifecycleThrowCalibration } from './SamePlateAppearanceLifecycleCalibrationSource';
const reads = vi.hoisted(() => ({ calibration: null as unknown, model: null as unknown, currentModel: null as unknown, posture: null as unknown }));
vi.mock('./SamePlateAppearanceLifecycleFromSqlite', () => ({ readSamePaLifecycleCalibrationFromSqlite: () => reads.calibration, readCurrentSamePaLifecycleCalibrationFromSqlite: () => reads.calibration }));
vi.mock('./SqlitePlayerFieldingModelStore', () => ({ playerFieldingModelEvidenceFromSqlite: () => ({ read: () => reads.model, selectAtDay: () => reads.currentModel }) }));
vi.mock('./SqliteBattingPerceptionStore', () => ({ readBattingPerceptionFromSqlite: () => reads.posture }));
const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash('snapshot:' + sourceId) });
const member = (playerId: string) => ({ playerId, bindingHash: hash(playerId + ':binding'), personHash: hash(playerId + ':person'), baselineSourceId: playerId + ':baseline',
  reservedRevision: 0, reservedStateHash: hash(playerId + ':reserved'), projectedStateHash: hash(playerId + ':projected') });
/** This tests the Native composition calculation with explicit mocked model
 * reads. It is not SQLite ownership, replay or genuine fixture qualification. */
const setup = () => {
  const input = throwInput(fixture(0, 1, 5, 5)), roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
  const ids = ['batter', 'carrier', 'receiver', ...Array.from({ length: 7 }, (_, i) => 'other' + i)];
  const bodies = ids.map((playerId, index) => ({ source: { playerId }, actor: { playerId, personId: playerId + ':person',
    heightMeters: 2, bodyOriginHeightMeters: 5, primitives: roles.map((role, j) => ({ role, radius: 0.125,
      offset: { x: 0, y: role === 'glove' ? 0 : j + 1, z: 0 } })) }, index }));
  const actors = bodies.flatMap(body => body.actor.primitives.map(shape => {
    const original = input.actors.find(a => a.playerId === body.source.playerId)?.primitive;
    return { playerId: body.source.playerId, primitive: { role: shape.role, radius: shape.radius, startTick: 0, endTick: 5_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x: original?.startCenter.x ?? 30 + body.index * 3, y: 5 + shape.offset.y, z: 5 },
      startVelocity: original?.startVelocity ?? { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } };
  }));
  const response = { ...input.response, world: { ...input.response.world, actors }, actors: actors.map(a => ({ playerId: a.playerId,
    profile: a.primitive.role === 'glove' ? input.response.actors[0].profile : { role: a.primitive.role, material } })) };
  const field = deriveBattedWorldFieldMotionAdoption({ response, geometry: input.geometry, actors, cursor: input.cursor, carrierPlayerId: 'carrier',
    availableAtTick: input.cursor.moment.ball.tick, coverageThroughTick: 5_000_000, commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: a.primitive.acceleration })) });
  const root = { kind: 'same_pa_physical_field_root_v1', source: { sourceId: 'root', sourceVersion: 'author-fixture-only-v1', postureReference: ref('batting_observation_v1_postures') },
    physicalPitchSourceId: 'pitch', operationOrdinal: 0, response, geometry: input.geometry, field, evaluationTick: field.motion.world.moment.ball.tick,
    timeline: { playId: 1, startedAtTick: 0, lastEventTick: 0, nextSequence: 0, events: [], status: { kind: 'batted_ball_pending', count: { balls: 0, strikes: 0 } } },
    lineage: { playId: 1, firstPhysicalPitchSourceId: 'first-pitch', enrollmentReference: ref('same_pa_enrollments') } } as unknown as SamePaPhysicalFieldRoot;
  const bindings = ids.map(playerId => ({ playerId, personId: playerId + ':person', personLinkSourceId: playerId + ':link', careerId: 'career', gameDay: 1 }));
  const persons = ids.map(playerId => ({ sourceId: playerId + ':link', personId: playerId + ':person', playerId, careerId: 'career' }));
  const action = { physicalPitchSourceId: 'pitch', source: { nominalPitch: { delivery: { matchSeed: 42 } } }, actor: { binding: bindings[0], person: persons[0],
    defenderBindings: bindings.slice(1), defenderPersons: persons.slice(1) } } as unknown as SamePaPhysicalAction;
  const view = { source: { sourceId: 'view', sourceVersion: 'author-fixture-only-v1' }, cut: { evaluationTick: root.evaluationTick }, lineage: root.lineage } as unknown as SamePaLifecycleViewBasis['view'];
  const basis = { actor: action.actor, view, members: ids.map(member) } as SamePaLifecycleViewBasis;
  const model = { source: { sourceId: 'normal-fielding', sourceVersion: 'author-fixture-only-v1', careerId: 'career', playerId: 'carrier', personLinkSourceId: 'carrier:link', acceptedAtDay: 1,
    ratings: input.ratings, transferParameters: input.transferParameters, throwCalibration: input.throwCalibration }, person: persons[1] };
  const calibration: AcceptedSamePaLifecycleThrowCalibration = { sourceId: 'current-throw', sourceVersion: 'author-fixture-only-v1', capability: 'same_pa_lifecycle_execution_calibration_v1',
    enrollmentReference: root.lineage.enrollmentReference, firstPhysicalPitchSourceId: 'first-pitch', viewReference: reference('pa_lifecycle_v1_execution_views', view), member: member('carrier'),
    route: 'defender_throw', nominalReference: reference('world_player_fielding_models', model), nominalParameterReference: null, acceptedAtDay: 1,
    provenance: { assessmentSourceId: 'explicit-throw-response', assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'explicit-throw-values', calibrationVersion: 'fixture-only-v1' },
    response: { kind: 'accepted_execution_values_v1', values: { transferParameters: { ...input.transferParameters, minimumTransferDelayTicks: 200_000, maximumTransferDelayTicks: 200_000 },
      throwCalibration: { ...input.throwCalibration, minimumReleaseSpeedMps: 7, maximumReleaseSpeedMps: 7 } } } };
  reads.model = model; reads.currentModel = model; reads.calibration = { source: calibration, lineage: root.lineage };
  reads.posture = { kind: 'batting_invocation_posture', sceneBodies: bodies.slice(1) };
  const source: SamePaPhysicalFieldStepSource = { sourceId: 'throw-plan', sourceVersion: 'author-fixture-only-v1', capability: 'same_pa_physical_field_step_v1',
    viewReference: calibration.viewReference, launchReference: ref('pa_physical_v1_launches') as never,
    previousOperationReference: reference('pa_physical_v1_field_roots', root), previousFieldReference: reference('pa_physical_v1_field_roots', root), fieldRootReference: reference('pa_physical_v1_field_roots', root),
    throughTick: root.evaluationTick, action: { kind: 'throw_plan_v1', member: member('carrier'), calibrationReference: ref('pa_lifecycle_v1_execution_calibrations') as never,
      receiverPlayerId: 'receiver', coverageThroughTick: 5_000_000 } };
  const run = (s = source) => deriveSamePaPhysicalFieldAction({} as DatabaseSync, s, root, root, action, basis, [root], true);
  return { root, source, action, basis, calibration, model, run };
};
beforeEach(() => { reads.calibration = null; reads.model = null; reads.currentModel = null; reads.posture = null; });
it('RTC01 composes all ten bodies from owned curves and releases with the current effective throw values', () => {
  const h = setup(), value = h.run();
  expect(value.actionResult.kind).toBe('throw_plan_v1');
  if (value.actionResult.kind !== 'throw_plan_v1') throw new Error('plan');
  expect(value.actionResult.plan.actors).toHaveLength(50); expect(new Set(value.actionResult.plan.actors.map(a => a.playerId)).size).toBe(10);
  expect(value.actionResult.plan.transfer.throwReadyTick).toBe(262_500); expect(value.actionResult.fieldingModelHash).toBe(hash(h.model));
  const step = { ...h.root, ...value, kind: 'same_pa_physical_field_step_v1', source: h.source, operationOrdinal: 1 } as SamePaPhysicalFieldStep;
  const stepReference = reference('pa_physical_v1_field_steps', step);
  const source = { ...h.source, sourceId: 'throw-release', previousOperationReference: stepReference, previousFieldReference: stepReference, throughTick: 262_500,
    action: { kind: 'throw_checkpoint_v1' as const, planReference: stepReference, throughElapsedSeconds: 0.2625 } };
  const released = deriveSamePaPhysicalFieldAction({} as DatabaseSync, source, h.root, step, h.action, h.basis, [h.root, step], true);
  if (released.actionResult.kind !== 'throw_checkpoint_v1' || released.actionResult.progress.kind !== 'released') throw new Error('release');
  expect(released.actionResult.progress.launch.releaseSpeedMps).toBe(7); expect(released.field.motion.carrierPlayerId).toBeNull();
  expect(released.field.motion.actors).toHaveLength(50);
});
it('RTC02 rejects stale member/view values and a receiver body from another Person', () => {
  const h = setup(), action = h.source.action;
  if (action?.kind !== 'throw_plan_v1') throw new Error('request');
  expect(() => h.run({ ...h.source, action: { ...action, member: { ...action.member, projectedStateHash: hash('stale') } } })).toThrow(/dependency/);
  reads.calibration = { source: { ...h.calibration, viewReference: ref('pa_lifecycle_v1_execution_views', 'old-view') }, lineage: h.root.lineage };
  expect(() => h.run()).toThrow(/dependency/);
  reads.calibration = { source: h.calibration, lineage: h.root.lineage };
  const posture = reads.posture as { sceneBodies: { source: { playerId: string }; actor: { personId: string } }[] };
  posture.sceneBodies.find(b => b.source.playerId === 'receiver')!.actor.personId = 'foreign';
  expect(() => h.run()).toThrow(/identity/);
});
it('RTC03 reauthenticates the normal fielding model Person and current selection while historical values remain reconstructible', () => {
  const h = setup(), db = {} as DatabaseSync;
  const accepted = deriveSamePaLifecycleCalibration(db, h.calibration, h.basis, true);
  expect(accepted.nominalInputHash).toBe(hash(h.model)); expect(accepted.effectiveResponseHash).toBe(hash(h.calibration.response));
  reads.currentModel = { ...h.model, source: { ...h.model.source, sourceId: 'new-model' } };
  expect(() => deriveSamePaLifecycleCalibration(db, h.calibration, h.basis, true)).toThrow(/nominal\/member/);
  expect(deriveSamePaLifecycleCalibration(db, h.calibration, h.basis, false)).toEqual(accepted);
  reads.model = { ...h.model, person: { ...h.model.person, personId: 'foreign' } };
  expect(() => deriveSamePaLifecycleCalibration(db, h.calibration, h.basis, false)).toThrow(/nominal\/member/);
});
