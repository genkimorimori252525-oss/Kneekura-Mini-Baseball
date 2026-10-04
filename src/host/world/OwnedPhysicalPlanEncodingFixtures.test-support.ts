import { fixture, throwInput } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory.test-support';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldPiecewiseFieldAcquisition, deriveBattedWorldPiecewiseFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import { prepareBattedWorldPiecewiseFieldThrow, deriveBattedWorldPiecewiseFieldThrowProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';
import type { PiecewiseFieldMotionStep } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { actorHash, actorFreeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';

/** Real Core plan/progress in tiny synthetic projection envelopes, never Native admission evidence. */
export const ownedPhysicalPlanEncodingFixture = (count = 4, mode: 'deep' | 'distinct' | 'mutable' | 'shallow' = 'deep', secure = false) => {
  const f = fixture(), field = deriveInitialBattedWorldFieldMotion(f);
  const bindings = ['batter', 'carrier', 'receiver'].map(playerId => ({ playerId, careerId: 'career', personLinkSourceId: `person-link-${playerId}`, gameDay: 1 }));
  const flight = { source: { sourceId: 'flight', physicalPitchSourceId: 'pitch', searchDurationTicks: 0,
    execution: { ballFlightParameters: f.response.world.parameters } }, flight: f.response.world.flight,
    physicalPitch: { frame: { batterActor: { binding: bindings[0], defenderBindings: bindings.slice(1) } } } };
  const airborne = { kind: 'airborne', throughTick: f.availableAtTick, ball: f.response.world.flight.initialBall };
  const response = { source: { sourceId: 'response' }, result: airborne,
    touch: { worldContact: { flight, source: { previousContactSourceId: null }, result: airborne,
      actors: f.response.world.actors, modelActorEvidence: bindings.map(binding => ({ binding, person: { personId: `person-${binding.playerId}` } })) } }, model: { gameId: 'game' } };
  const geometry = { source: { sourceId: 'geometry', baseGeometrySourceId: 'bases', baseModels: f.geometry.baseModels }, geometry: f.geometry,
    baseGeometry: { source: { sourceId: 'bases', flightSourceId: 'flight' }, flight, geometry: f.geometry.baseGeometry, fixture: { game_id: 'game' } } };
  const source = { sourceId: 'field', sourceVersion: 'pure-v1', previousFieldSourceId: null,
    responseSourceId: 'response', geometrySourceId: 'geometry' };
  const baseField = { source, revision: 1, history: [source], response, geometry, field } as unknown as DurableBattedWorldFieldAction;
  const plan = structuredClone(prepareBattedWorldPiecewiseFieldAcquisition({ response: f.response, geometry: f.geometry, field }));
  if (mode === 'shallow') Object.freeze(plan);
  const planSource: AcceptedBattedWorldFieldExecution = { sourceId: 'plan', sourceVersion: 'pure-v1', baseFieldSourceId: 'field',
    previousExecutionSourceId: null, action: { kind: 'owned_acquisition_plan_v1', knownWork: [] } };
  const executions: DurableBattedWorldFieldExecution[] = [{ source: planSource, revision: 1, history: [planSource], baseField,
    execution: { kind: 'owned_acquisition_plan_v1', field, plan } }];
  const reference = (value: DurableBattedWorldFieldExecution) => ({ sourceId: value.source.sourceId,
    sourceHash: actorHash(value.source), snapshotHash: ownedScheduledMotionArchiveHash(value) });
  const steps: PiecewiseFieldMotionStep[] = [];
  for (let i = 0; i < count; i++) {
    const step: PiecewiseFieldMotionStep = { actors: { kind: 'retained' },
      throughElapsedSeconds: plan.contactMoment.elapsedSeconds + (plan.secureElapsedSeconds - plan.contactMoment.elapsedSeconds) * i / (secure ? Math.max(1, count - 1) : count + 1) };
    steps.push(step);
    const body = mode === 'distinct' ? structuredClone(plan) : plan;
    const progress = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan: body, steps });
    const source: AcceptedBattedWorldFieldExecution = { sourceId: `step-${i}`, sourceVersion: 'pure-v1', baseFieldSourceId: 'field',
      previousExecutionSourceId: executions.at(-1)!.source.sourceId, action: { kind: 'owned_motion_v2',
        checkpoint: { kind: 'operation', planSourceId: planSource.sourceId, throughElapsedSeconds: step.throughElapsedSeconds }, knownWork: [], contributions: [] } };
    executions.push({ source, revision: executions.length + 1, history: [...executions.at(-1)!.history, source], baseField,
      execution: { kind: 'owned_motion_v2', field, composition: { mode: 'retained' }, operation: { kind: 'acquisition',
        planSourceId: planSource.sourceId, planReference: reference(executions[0]), previousSteps: executions.slice(1).map(reference),
        plan: body, step, progress, bridge: null } } } as unknown as DurableBattedWorldFieldExecution);
  }
  const prefix = { baseField, fields: [baseField], executions };
  if (mode === 'deep' || mode === 'distinct') actorFreeze(prefix);
  return { prefix, plan, count, plans: [plan, ...executions.slice(1).map(value => {
    if (value.execution.kind !== 'owned_motion_v2' || !value.execution.operation) throw new Error('fixture');
    return value.execution.operation.plan;
  })] };
};

/** The same pure fixture continues a secured capture through real Core transfer steps. */
export const ownedPhysicalThrowEncodingFixture = (count = 4) => {
  const x = ownedPhysicalPlanEncodingFixture(2, 'mutable', true), { prefix } = x;
  const captured = prefix.executions.at(-1)!.execution;
  if (captured.kind !== 'owned_motion_v2' || captured.operation?.kind !== 'acquisition' || captured.operation.progress.kind !== 'secured') throw new Error('secured fixture');
  const { availableAtTick: _a, throughTick: _t, commands: _c, ...input } = throwInput(fixture(), 100_000);
  const plan = prepareBattedWorldPiecewiseFieldThrow({ ...input, cursor: captured.operation.progress.cursor, actors: captured.operation.progress.activePiece.actors });
  const actor = prefix.baseField.response.touch.worldContact.modelActorEvidence.find(a => a.binding.playerId === plan.input.carrierPlayerId)!;
  const model = { source: { sourceId: 'throw-model', playerId: actor.binding.playerId, careerId: actor.binding.careerId,
    personLinkSourceId: actor.binding.personLinkSourceId }, person: actor.person };
  const source: AcceptedBattedWorldFieldExecution = { sourceId: 'throw-plan', sourceVersion: 'pure-v1', baseFieldSourceId: 'field',
    previousExecutionSourceId: prefix.executions.at(-1)!.source.sourceId, action: { kind: 'owned_throw_plan_v1', knownWork: [],
      modelSourceId: model.source.sourceId, receiverPlayerId: plan.input.receiverPlayerId } };
  const planned = { source, revision: prefix.executions.length + 1, history: [...prefix.executions.at(-1)!.history, source], baseField: prefix.baseField,
    execution: { kind: 'owned_throw_plan_v1', field: captured.field, model, plan } } as unknown as DurableBattedWorldFieldExecution;
  prefix.executions.push(planned);
  const reference = (value: DurableBattedWorldFieldExecution) => ({ sourceId: value.source.sourceId,
    sourceHash: actorHash(value.source), snapshotHash: ownedScheduledMotionArchiveHash(value) });
  const steps: PiecewiseFieldMotionStep[] = [], earlier: DurableBattedWorldFieldExecution[] = [];
  for (let i = 0; i < count; i++) {
    const step: PiecewiseFieldMotionStep = { actors: { kind: 'retained' }, throughElapsedSeconds: plan.input.cursor.moment.elapsedSeconds
      + (plan.releaseElapsedSeconds - plan.input.cursor.moment.elapsedSeconds) * (i + 1) / (count + 1) };
    steps.push(step); const progress = deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps });
    const source: AcceptedBattedWorldFieldExecution = { sourceId: `throw-step-${i}`, sourceVersion: 'pure-v1', baseFieldSourceId: 'field',
      previousExecutionSourceId: prefix.executions.at(-1)!.source.sourceId, action: { kind: 'owned_motion_v2', knownWork: [], contributions: [],
        checkpoint: { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: step.throughElapsedSeconds } } };
    const value = { source, revision: prefix.executions.length + 1, history: [...prefix.executions.at(-1)!.history, source], baseField: prefix.baseField,
      execution: { kind: 'owned_motion_v2', field: progress.field, composition: { mode: 'retained' }, operation: { kind: 'throw',
        planSourceId: planned.source.sourceId, planReference: reference(planned), previousSteps: earlier.map(reference),
        plan, step, progress, bridge: null } } } as unknown as DurableBattedWorldFieldExecution;
    prefix.executions.push(value); earlier.push(value);
  }
  return { prefix: actorFreeze(prefix), plan, count };
};
