import { expect, it } from 'vitest';
import { samePaLifecycleCalibrationInput } from './SamePlateAppearanceLifecycleCalibrationSource';
import { samePaPhysicalFieldActionInput } from './SamePlateAppearancePhysicalFieldAction';
import { samePaDispatchRouteValid } from './SamePlateAppearanceDispatchRoles';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash('snapshot:' + sourceId) });
const member = (playerId: string) => ({ playerId, bindingHash: hash(playerId + ':binding'), personHash: hash(playerId + ':person'), baselineSourceId: playerId + ':baseline',
  reservedRevision: 0, reservedStateHash: hash(playerId + ':reserved'), projectedStateHash: hash(playerId + ':projected') });
const calibrationSource = () => ({ sourceId: 'throw-calibration', sourceVersion: 'author-fixture-only-v1', capability: 'same_pa_lifecycle_execution_calibration_v1',
  enrollmentReference: ref('same_pa_enrollments'), viewReference: ref('pa_lifecycle_v1_execution_views'), firstPhysicalPitchSourceId: 'first-pitch', member: member('carrier'),
  route: 'defender_throw', nominalReference: ref('world_player_fielding_models'), nominalParameterReference: null, acceptedAtDay: 1,
  provenance: { assessmentSourceId: 'explicit-assessment', assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'explicit-response', calibrationVersion: 'fixture-only-v1' },
  response: { kind: 'accepted_execution_values_v1', values: { transferParameters: { minimumTransferDelayTicks: 100_000, maximumTransferDelayTicks: 100_000, fixedGripOffsetTicks: 0 },
    throwCalibration: { minimumReleaseSpeedMps: 5, maximumReleaseSpeedMps: 5, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 } } } });
it('RT01 accepts explicit current-view throw values without extending the historical dispatch route set', () => {
  const source = calibrationSource(); expect(samePaLifecycleCalibrationInput(source)).toEqual(source);
  expect(samePaDispatchRouteValid('defender_throw')).toBe(false);
  for (const changed of [{ ...source, nominalReference: ref('world_player_locomotion_models') }, { ...source, nominalParameterReference: {} },
    { ...source, response: { ...source.response, values: {} } },
    { ...source, response: { ...source.response, values: { ...source.response.values, ratings: {} } } },
    { ...source, response: { ...source.response, values: { ...source.response.values, transferParameters: { ...source.response.values.transferParameters, maximumTransferDelayTicks: -1 } } } },
    { ...source, response: { ...source.response, values: { ...source.response.values, throwCalibration: { ...source.response.values.throwCalibration, minimumReleaseSpeedMps: 0 } } } }]) {
    expect(() => samePaLifecycleCalibrationInput(changed)).toThrow();
  }
});
it('RT02 accepts bounded throw intent and original-plan checkpoints without caller physical results', () => {
  const plan = { kind: 'throw_plan_v1', member: member('carrier'), calibrationReference: ref('pa_lifecycle_v1_execution_calibrations'), receiverPlayerId: 'receiver', coverageThroughTick: 5_000_000 };
  const checkpoint = { kind: 'throw_checkpoint_v1', planReference: ref('pa_physical_v1_field_steps'), throughElapsedSeconds: 0.1 };
  for (const input of [plan, checkpoint]) expect(() => samePaPhysicalFieldActionInput(input as never)).not.toThrow();
  for (const changed of [{ ...plan, receiverPlayerId: 'carrier' }, { ...plan, coverageThroughTick: 0.5 }, { ...plan, launch: {} }, { ...plan, commands: [] },
    { ...checkpoint, planReference: ref('pa_physical_v1_field_roots') }, { ...checkpoint, throughElapsedSeconds: NaN }, { ...checkpoint, cursor: {} }]) {
    expect(() => samePaPhysicalFieldActionInput(changed as never)).toThrow();
  }
});

import { fixture, throwInput } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveBattedWorldFieldMotionAdoption } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveBattedWorldFieldThrow } from '../../core/sim/ball/BattedWorldFieldThrow';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { deriveSamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalFieldCalculation';
import { assertSamePaPhysicalThrowOwnership, deriveSamePaPhysicalThrowPlan, deriveSamePaPhysicalThrowCheckpoint, samePaPhysicalPendingThrow,
  samePaPhysicalHasThrowRelease } from './SamePlateAppearancePhysicalFieldThrow';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaPhysicalAction, SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
// Real Core custody and physics, structural episode records only. This does not
// substitute for Native admission, database replay or genuine fixture coverage.
const carriedField = (input: ReturnType<typeof throwInput>) => deriveBattedWorldFieldMotionAdoption({ response: input.response, geometry: input.geometry, actors: input.actors,
  cursor: input.cursor, carrierPlayerId: input.carrierPlayerId, availableAtTick: input.cursor.moment.ball.tick, coverageThroughTick: input.throughTick, commands: input.commands });
const throwFixture = (delay = 100_000, height = 5, originTick = 0, z = 5, gravityY = 0) => {
  const raw = fixture(originTick, 1, height, z), parameters = { ...raw.response.world.parameters, gravityY };
  const flight = createBattedBallFlightEvidence({ contact: raw.response.world.flight.contact, parameters, searchDurationTicks: 5_000_000 });
  const input = throwInput({ ...raw, response: { ...raw.response, world: { ...raw.response.world, parameters, flight } } }, delay), values = { transferParameters: input.transferParameters, throwCalibration: input.throwCalibration };
  const field = carriedField(input);
  const root = { kind: 'same_pa_physical_field_root_v1', source: { sourceId: 'root', sourceVersion: 'author-fixture-only-v1' }, physicalPitchSourceId: 'pitch',
    operationOrdinal: 0, response: input.response, geometry: input.geometry, field, evaluationTick: field.motion.world.moment.ball.tick,
    timeline: { playId: 1, startedAtTick: 0, lastEventTick: 0, nextSequence: 0, events: [], status: { kind: 'batted_ball_pending', count: { balls: 0, strikes: 0 } } },
    lineage: { playId: 1 } } as unknown as SamePaPhysicalFieldRoot;
  const action = { physicalPitchSourceId: 'pitch', source: { nominalPitch: { delivery: { matchSeed: 42 } } }, actor: { defenderBindings: [{ playerId: 'carrier' }, { playerId: 'receiver' }] } } as unknown as SamePaPhysicalAction;
  const model = { source: { sourceId: 'fielding-model', sourceVersion: 'author-fixture-only-v1', playerId: 'carrier', ratings: input.ratings,
    transferParameters: { ...input.transferParameters, maximumTransferDelayTicks: 500_000 }, throwCalibration: { ...input.throwCalibration, maximumReleaseSpeedMps: 15 } },
    person: { personId: 'carrier-person' } } as unknown as DurablePlayerFieldingModel;
  const prefix: (SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep)[] = [root];
  const fieldRef = (f: typeof prefix[number]) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
  const source = (throughTick: number, action?: SamePaPhysicalFieldStepSource['action']): SamePaPhysicalFieldStepSource => ({
    sourceId: 'step:' + prefix.length, sourceVersion: 'author-fixture-only-v1', capability: 'same_pa_physical_field_step_v1',
    viewReference: ref('pa_lifecycle_v1_execution_views') as SamePaPhysicalFieldStepSource['viewReference'], launchReference: ref('pa_physical_v1_launches') as SamePaPhysicalFieldStepSource['launchReference'],
    previousOperationReference: fieldRef(prefix.at(-1)!), previousFieldReference: fieldRef(prefix.at(-1)!), fieldRootReference: reference('pa_physical_v1_field_roots', root), throughTick, ...(action ? { action } : {}) });
  const save = (s: SamePaPhysicalFieldStepSource, value: ReturnType<typeof deriveSamePaPhysicalThrowPlan> | ReturnType<typeof deriveSamePaPhysicalThrowCheckpoint>) => {
    const previous = prefix.at(-1)!, step = { ...previous, ...value, kind: 'same_pa_physical_field_step_v1', source: s, operationOrdinal: previous.operationOrdinal + 1 } as SamePaPhysicalFieldStep;
    prefix.push(step); return step;
  };
  const planSource = source(root.evaluationTick, { kind: 'throw_plan_v1', member: member('carrier'), calibrationReference: ref('pa_lifecycle_v1_execution_calibrations') as never,
    receiverPlayerId: 'receiver', coverageThroughTick: input.throughTick });
  const plan = () => save(planSource, deriveSamePaPhysicalThrowPlan(planSource, root, root, action, model, values));
  const checkpoint = (plan: SamePaPhysicalFieldStep, elapsed: number) => {
    const s = source(originTick + Math.ceil(elapsed * 1_000_000), { kind: 'throw_checkpoint_v1', planReference: reference('pa_physical_v1_field_steps', plan), throughElapsedSeconds: elapsed });
    return save(s, deriveSamePaPhysicalThrowCheckpoint(s, root, prefix.at(-1)!, prefix));
  };
  return { input, root, action, model, values, prefix, source, save, planSource, plan, checkpoint };
};
it('RT03 retains actual custody during transfer, keeps the accepted effective values, and releases exactly once', () => {
  const h = throwFixture(), plan = h.plan();
  if (plan.actionResult?.kind !== 'throw_plan_v1') throw new Error('plan');
  expect(plan.field).toEqual(h.root.field); expect(plan.evaluationTick).toBe(h.root.evaluationTick);
  expect(plan.actionResult.plan).not.toHaveProperty('launch'); expect(plan.actionResult.plan.transfer.throwReadyTick).toBe(162_500);
  expect(plan.actionResult.plan.input.throwCalibration).toEqual(h.values.throwCalibration);
  expect(plan.actionResult.plan.input.ratings).toEqual(h.model.source.ratings);
  const middle = h.checkpoint(plan, 0.1), completed = h.checkpoint(plan, 0.2);
  expect(middle.field.motion.carrierPlayerId).toBe('carrier'); expect(middle.evaluationTick).toBe(100_000);
  expect(completed.field.motion.carrierPlayerId).toBeNull(); expect(completed.evaluationTick).toBe(162_500);
  if (completed.actionResult?.kind !== 'throw_checkpoint_v1' || completed.actionResult.progress.kind !== 'released') throw new Error('release');
  expect(completed.actionResult.progress.launch.releaseSpeedMps).toBe(5);
  const direct = deriveBattedWorldFieldThrow(plan.actionResult.plan.input);
  if (direct.kind !== 'released') throw new Error('direct');
  expect(completed.actionResult.progress.launch).toEqual(direct.launch);
  expect(() => h.checkpoint(plan, 0.3)).toThrow(/pending transfer/);
  expect(samePaPhysicalHasThrowRelease(h.prefix)).toBe(true);
  const moved = deriveSamePaPhysicalFieldStep(h.source(200_000), h.root, completed, completed.evaluationTick, !samePaPhysicalHasThrowRelease(h.prefix));
  expect(moved.field.motion.carrierPlayerId).toBeNull(); expect(moved.evaluationTick).toBe(200_000);
  expect(moved.timeline).toEqual(h.root.timeline);
});
it('RT04 sensory records cannot hide the pending plan or enable a competing field advance', () => {
  const h = throwFixture(), plan = h.plan(); h.checkpoint(plan, 0.1);
  const previous = h.prefix.at(-1)!;
  // Same-cut sensory output; its data is irrelevant to physical custody.
  h.save(h.source(previous.evaluationTick), { field: previous.field, evaluationTick: previous.evaluationTick, timeline: previous.timeline,
    actionResult: { kind: 'defender_observation_v1' } as never });
  expect(samePaPhysicalPendingThrow(h.prefix)?.step).toEqual(plan);
  for (const source of [h.source(120_000), h.source(100_000, h.planSource.action),
    h.source(100_000, { kind: 'capture_checkpoint_v1', candidateReference: reference('pa_physical_v1_field_roots', h.root), throughElapsedSeconds: 0.1 }),
    h.source(120_000, { kind: 'defender_motion_v1', selections: [] })]) expect(() => assertSamePaPhysicalThrowOwnership(source, h.prefix)).toThrow(/owns field progress/);
  const released = h.checkpoint(plan, 0.1625); expect(released.field.motion.carrierPlayerId).toBeNull();
  expect(samePaPhysicalPendingThrow(h.prefix)).toBeNull();
});
it('RT05 rejects missing possession, foreign receiver, extended command coverage and foreign checkpoints', () => {
  const h = throwFixture(), request = h.planSource.action;
  if (request?.kind !== 'throw_plan_v1') throw new Error('source');
  const derive = (source = h.planSource, root = h.root) => deriveSamePaPhysicalThrowPlan(source, root, root, h.action, h.model, h.values);
  expect(() => derive({ ...h.planSource, throughTick: h.root.evaluationTick + 1 })).toThrow(/carrier cut/);
  expect(() => derive({ ...h.planSource, action: { ...request, receiverPlayerId: 'batter' } })).toThrow(/receiver/);
  expect(() => derive({ ...h.planSource, action: { ...request, coverageThroughTick: 5_000_001 } })).toThrow(/coverage/);
  expect(() => derive(h.planSource, { ...h.root, field: { ...h.root.field, motion: { ...h.root.field.motion, carrierPlayerId: null } } })).toThrow(/carrier cut/);
  const plan = h.plan(), s = h.source(100_001, { kind: 'throw_checkpoint_v1', planReference: reference('pa_physical_v1_field_steps', plan), throughElapsedSeconds: 0.1 });
  expect(() => deriveSamePaPhysicalThrowCheckpoint(s, h.root, plan, h.prefix)).toThrow(/exact horizon/);
  expect(() => assertSamePaPhysicalThrowOwnership({ ...s, action: { ...s.action!, planReference: ref('pa_physical_v1_field_steps', 'foreign') } } as never, h.prefix)).toThrow(/dependency/);
});
it('RT06 an actual transfer collision retains custody and provides no release or continuation cursor', () => {
  const h = throwFixture(2_000_000, 0.5, 0, 0), plan = h.plan();
  const s = h.source(3_000_000, { kind: 'throw_checkpoint_v1', planReference: reference('pa_physical_v1_field_steps', plan), throughElapsedSeconds: 3 });
  const value = deriveSamePaPhysicalThrowCheckpoint(s, h.root, plan, h.prefix);
  expect(value.actionResult).toMatchObject({ kind: 'throw_checkpoint_v1', progress: { kind: 'interrupted' } });
  expect(value.field.motion.carrierPlayerId).toBe('carrier'); expect(value.field.motion.cursor).toBeNull();
  expect(value.field.baseContacts[0].baseId).toBe('first'); expect(value.actionResult).not.toHaveProperty('progress.launch');
});
it('RT07 immediate release preserves large-clock custody without fabricating a transfer interval', () => {
  const h = throwFixture(0, 5, 2 ** 52), plan = h.plan(), released = h.checkpoint(plan, h.root.field.motion.world.moment.elapsedSeconds);
  expect(released.evaluationTick).toBe(h.root.evaluationTick); expect(released.field.motion.carrierPlayerId).toBeNull();
  expect(released.actionResult).toMatchObject({ kind: 'throw_checkpoint_v1', progress: { kind: 'released', checkpointElapsedSeconds: [0.0625] } });
});

it('RT08 throw-flight ground contact remains a physical boundary without becoming bat-flight first ground', () => {
  const h = throwFixture(100_000, 5, 0, 5, -9.81), plan = h.plan(), released = h.checkpoint(plan, 0.2);
  const moved = deriveSamePaPhysicalFieldStep(h.source(2_000_000), h.root, released, released.evaluationTick, !samePaPhysicalHasThrowRelease(h.prefix));
  expect(moved.field.motion.world.kind).toBe('boundary');
  if (moved.field.motion.world.kind !== 'boundary') throw new Error('ground');
  expect(moved.field.motion.world.contacts).toContainEqual(expect.objectContaining({ kind: 'ground' }));
  expect(moved.field.motion.carrierPlayerId).toBeNull(); expect(moved.timeline).toEqual(h.root.timeline);
  expect(moved.timeline.events).toEqual([]);
});
