import { prepareBattedWorldPiecewiseFieldAcquisition, bridgeBattedWorldPiecewiseFieldAcquisitionPlan,
  deriveBattedWorldPiecewiseFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldAcquisition';
import { prepareBattedWorldPiecewiseFieldThrow, bridgeBattedWorldPiecewiseFieldThrowPlan,
  deriveBattedWorldPiecewiseFieldThrowProgress } from '../../core/sim/ball/BattedWorldPiecewiseFieldThrow';
import { advanceBattedWorldFieldMotionCheckpoint, deriveBattedWorldFieldMotionCheckpoint,
  deriveBattedWorldFieldMotionAdoption, advanceBattedWorldFieldMotionExactCheckpointV1 } from '../../core/sim/ball/BattedWorldFieldMotion';
import { deriveBattedWorldMotionActorsAtExactCoverage } from '../../core/sim/ball/BattedWorldMotion';
import type { PiecewiseFieldMotionStep } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { battedWorldMotionPrimitiveCommands } from './SqliteBattedWorldMotionStore';
import type { AcceptedBattedWorldFieldExecution, DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurablePlayerFieldingModel } from './SqlitePlayerFieldingModelStore';
import type { DurableActualLocomotion } from './SqliteActualLocomotionStore';
import type { DurableActualDefensiveDecision } from './SqliteActualDefensiveDecisionStore';
import type { OwnedScheduledMotionAction, OwnedScheduledMotionExecution, OwnedScheduledMotionOperation,
  OwnedScheduledMotionReference, OwnedScheduledMotionAdoption } from './OwnedScheduledBattedWorldMotion';
import { deriveOwnedScheduledMotionComposition, createOwnedScheduledMotionCompositionReplay } from './OwnedScheduledMotionComposition';
import { ownedScheduledMotionActualState } from './OwnedScheduledMotionState';
import { ownedScheduledMotionLiveWork } from './OwnedScheduledMotionLiveWork';

const planKinds = ['acquisition_plan', 'throw_plan', 'owned_acquisition_plan_v1', 'owned_throw_plan_v1'];
export const pendingOwnedScheduledPlan = (prefix: readonly DurableBattedWorldFieldExecution[]) => {
  const plan = [...prefix].reverse().find(v => planKinds.includes(v.execution.kind));
  if (!plan) return null;
  const progress = [...prefix].reverse().find(v => v.execution.kind === 'owned_motion_v2'
    && v.execution.operation?.planSourceId === plan.source.sourceId
    || (v.execution.kind === 'acquisition_advance' || v.execution.kind === 'throw_advance') && v.execution.planSourceId === plan.source.sourceId)?.execution;
  const phase = progress?.kind === 'owned_motion_v2' ? progress.operation?.progress.kind
    : progress?.kind === 'acquisition_advance' || progress?.kind === 'throw_advance' ? progress.progress.kind : null;
  return phase === 'secured' || phase === 'released' || phase === 'interrupted' ? null : plan;
};

/** Called only by the physical writer after same-connection rank/dependency validation. */
const deriveExecution = (compositionReplay: Readonly<{ derive: typeof deriveOwnedScheduledMotionComposition;
  reference(value: DurableBattedWorldFieldExecution): OwnedScheduledMotionReference }>, source: AcceptedBattedWorldFieldExecution & { action: OwnedScheduledMotionAction },
  prefix: Readonly<{ baseField: DurableBattedWorldFieldAction; fields: readonly DurableBattedWorldFieldAction[];
    executions: readonly DurableBattedWorldFieldExecution[] }>, motors: readonly DurableActualLocomotion[],
  decisions: readonly DurableActualDefensiveDecision[], model: DurablePlayerFieldingModel | null): OwnedScheduledMotionExecution => {
  const { reference } = compositionReplay;
  const { baseField, executions } = prefix, action = source.action;
  const original = executions.at(-1)?.execution.field ?? baseField.field;
  const response = battedWorldResponseInput(baseField.response), geometry = baseField.geometry.geometry;
  const state = ownedScheduledMotionActualState(baseField.field, executions), pending = pendingOwnedScheduledPlan(executions);
  const frame = baseField.response.touch.worldContact.flight.physicalPitch.frame;
  const ids = [frame.batterActor!.binding.playerId, ...frame.batterActor!.defenderBindings.map(b => b.playerId)];
  if (action.knownWork.some(w => !ids.includes(w.playerId))) throw new Error('owned scheduled original Player scope differs');
  if (action.kind !== 'owned_motion_v2') {
    if (pending) throw new Error('owned scheduled pending operation already owns physical execution');
    if (action.kind === 'owned_acquisition_plan_v1') {
      const lastPhysical = [...executions].reverse().find(v => !['whole_play_history', 'base_touch_history', 'first_base_race',
        ...planKinds].includes(v.execution.kind))?.execution;
      if (state.cursor || state.carrierPlayerId || json(state.moment) !== json(original.motion.world.moment)
        || json(state.actors) !== json(original.motion.actors) || lastPhysical?.kind === 'acquisition'
        || lastPhysical?.kind === 'acquisition_advance' || lastPhysical?.kind === 'owned_motion_v2' && lastPhysical.operation?.kind === 'acquisition') {
        throw new Error('owned acquisition requires a current unresolved candidate, not an already resolved operation');
      }
      const plan = prepareBattedWorldPiecewiseFieldAcquisition({ response, geometry, field: original });
      if (!frame.batterActor!.defenderBindings.some(b => b.playerId === plan.acquirerPlayerId)) throw new Error('owned acquisition requires an original active defender');
      return freeze({ kind: action.kind, field: original, plan });
    }
    const previousMotorIds = executions.flatMap(v => v.execution.kind === 'owned_motion_v1' || v.execution.kind === 'owned_motion_v2'
      ? v.execution.adoption.contributors.flatMap(c => c.motorSourceId === null ? [] : [c.motorSourceId]) : []);
    if (action.knownWork.some(w => w.motorSourceId !== null && !previousMotorIds.includes(w.motorSourceId))) {
      throw new Error('owned throw admission requires original-cut motor adoption first');
    }
    const world = baseField.response.touch.worldContact, actor = world.modelActorEvidence.find(v => v.binding.playerId === state.carrierPlayerId);
    if (!state.cursor || !state.carrierPlayerId || !actor || !model || model.source.sourceId !== action.modelSourceId
      || !frame.batterActor!.defenderBindings.some(b => b.playerId === state.carrierPlayerId)
      || !frame.batterActor!.defenderBindings.some(b => b.playerId === action.receiverPlayerId)
      || model.source.playerId !== state.carrierPlayerId || model.source.careerId !== actor.binding.careerId
      || model.source.personLinkSourceId !== actor.binding.personLinkSourceId || json(model.person) !== json(actor.person)
      || model.source.acceptedAtDay > actor.binding.gameDay) throw new Error('owned field throw Player model or active receiver scope differs');
    const plan = prepareBattedWorldPiecewiseFieldThrow({ response, geometry, actors: state.actors, cursor: state.cursor,
      carrierPlayerId: state.carrierPlayerId, receiverPlayerId: action.receiverPlayerId, ratings: model.source.ratings,
      transferParameters: model.source.transferParameters, throwCalibration: model.source.throwCalibration,
      seed: { matchSeed: frame.matchSeed, playId: frame.match.playId, streamKey: json(['batted_world_field_throw', source.sourceId, state.carrierPlayerId]) } });
    return freeze({ kind: action.kind, field: original, model, plan });
  }
  const composition = compositionReplay.derive({ ...source, action }, prefix, motors, decisions);
  const zero = composition.checkpointThroughElapsedSeconds === state.moment.elapsedSeconds;
  let operation: OwnedScheduledMotionOperation | null = null, field = original;
  if (action.checkpoint.kind !== 'operation') {
    if (pending) throw new Error('owned scheduled operation owns pending physical execution');
    if (!state.cursor) throw new Error('owned motion unresolved physical contact');
    const basis = { response, geometry, actors: state.actors, cursor: state.cursor, carrierPlayerId: state.carrierPlayerId };
    if (action.checkpoint.kind === 'retained_quantizer_bucket_v1') {
      if (composition.mode !== 'retained' || zero) throw new Error('retained quantizer checkpoint requires covered positive retained progress');
      field = advanceBattedWorldFieldMotionExactCheckpointV1({ ...basis,
        checkpointThroughElapsedSeconds: composition.checkpointThroughElapsedSeconds });
    } else {
      // Keep the original integer authorities. Multiplying a valid elapsed quotient
      // back into ticks can introduce a fraction and reject a legitimate request.
      const checkpointThroughTick = Math.min(action.checkpoint.throughTick, composition.coverageThroughTick,
        ...composition.knownWork.flatMap(w => w.dueTick === null ? [] : [Math.max(state.moment.ball.tick, w.dueTick)]));
      if ((checkpointThroughTick - state.moment.originTick) / composition.ticksPerSecond !== composition.checkpointThroughElapsedSeconds) {
        throw new Error('owned ordinary checkpoint exact bound differs');
      }
      if (composition.mode === 'retained') {
        if (zero) throw new Error('owned repeated zero-time retained checkpoint makes no progress');
        field = advanceBattedWorldFieldMotionCheckpoint({ ...basis, checkpointThroughTick });
      } else {
        const adopted = { ...basis, availableAtTick: motors[0].receipt.segment.startTick, coverageThroughTick: composition.coverageThroughTick,
          commands: battedWorldMotionPrimitiveCommands(baseField.response, composition.commands) };
        field = zero ? deriveBattedWorldFieldMotionAdoption(adopted)
          : deriveBattedWorldFieldMotionCheckpoint({ ...adopted, checkpointThroughTick });
      }
    }
  } else {
    if (!pending || pending.source.sourceId !== action.checkpoint.planSourceId) throw new Error('owned scheduled plan is missing, superseded or terminal');
    const priorSteps = executions.filter(v => v.execution.kind === 'owned_motion_v2'
      && v.execution.operation?.planSourceId === pending.source.sourceId);
    const previous = priorSteps.at(-1)?.execution;
    const previousOperation = previous?.kind === 'owned_motion_v2' ? previous.operation : null;
    if (!previousOperation && pending.execution.kind === 'owned_acquisition_plan_v1' && !zero) {
      throw new Error('owned acquisition requires original zero-time initialization');
    }
    const legacy = pending.execution.kind === 'acquisition_plan' || pending.execution.kind === 'throw_plan';
    const priorAdvance = legacy ? [...executions].reverse().find(v => (v.execution.kind === 'acquisition_advance' || v.execution.kind === 'throw_advance')
      && v.execution.planSourceId === pending.source.sourceId) : undefined;
    const bridge = previousOperation?.bridge ?? (legacy ? { legacyPlanReference: reference(pending), previousAdvanceReference: priorAdvance ? reference(priorAdvance) : null } : null);
    const actors: PiecewiseFieldMotionStep['actors'] = composition.mode === 'retained' ? { kind: 'retained' } : { kind: 'adopted', actors:
      deriveBattedWorldMotionActorsAtExactCoverage({ response, cursor: { moment: state.moment, previousContacts: [] }, actors: state.actors, carrierPlayerId: state.carrierPlayerId,
        availableAtTick: motors[0].receipt.segment.startTick, throughTick: composition.coverageThroughTick,
        commands: battedWorldMotionPrimitiveCommands(baseField.response, composition.commands) }) };
    const step: PiecewiseFieldMotionStep = { throughElapsedSeconds: composition.checkpointThroughElapsedSeconds, actors };
    const steps = [...priorSteps.map(v => { if (v.execution.kind !== 'owned_motion_v2' || !v.execution.operation) throw new Error('owned operation step missing'); return v.execution.operation.step; }), step];
    const common = { planSourceId: pending.source.sourceId, planReference: reference(pending), previousSteps: priorSteps.map(reference), step, bridge };
    if (pending.execution.kind === 'owned_acquisition_plan_v1' || pending.execution.kind === 'acquisition_plan') {
      const plan = previousOperation?.kind === 'acquisition' ? previousOperation.plan : pending.execution.kind === 'owned_acquisition_plan_v1'
        ? pending.execution.plan : bridgeBattedWorldPiecewiseFieldAcquisitionPlan({ plan: pending.execution.plan,
          progress: priorAdvance?.execution.kind === 'acquisition_advance' ? priorAdvance.execution.progress : null });
      const progress = deriveBattedWorldPiecewiseFieldAcquisitionProgress({ plan, steps });
      operation = { ...common, kind: 'acquisition', plan, progress }; field = pending.execution.field;
    } else if (pending.execution.kind === 'owned_throw_plan_v1' || pending.execution.kind === 'throw_plan') {
      const plan = previousOperation?.kind === 'throw' ? previousOperation.plan : pending.execution.kind === 'owned_throw_plan_v1'
        ? pending.execution.plan : bridgeBattedWorldPiecewiseFieldThrowPlan({ plan: pending.execution.plan,
          progress: priorAdvance?.execution.kind === 'throw_advance' ? priorAdvance.execution.progress : null });
      const progress = deriveBattedWorldPiecewiseFieldThrowProgress({ plan, steps });
      operation = { ...common, kind: 'throw', plan, progress }; field = progress.field;
    } else throw new Error('owned operation original plan kind differs');
  }
  const end = operation?.kind === 'acquisition' ? operation.progress.world.moment : field.motion.world.moment;
  const cursor = operation?.kind === 'acquisition' ? operation.progress.cursor : field.motion.cursor;
  const boundary = operation?.kind === 'acquisition' ? operation.progress.world.kind === 'boundary' : field.motion.world.kind === 'boundary';
  const executedThrough = { originTick: end.originTick, elapsedSeconds: end.elapsedSeconds, tick: end.ball.tick };
  const adoption: OwnedScheduledMotionAdoption = { version: 'owned_motion_adoption_v2', physicalPitchSourceId: composition.physicalPitchSourceId,
    executionSourceId: source.sourceId, executionRevision: executions.length + 1,
    predecessor: { baseFieldSourceId: source.baseFieldSourceId, executionSourceId: source.previousExecutionSourceId },
    compositionHash: hash(composition), adoptedAt: composition.at, executedThrough, requestedCheckpoint: action.checkpoint,
    acceptedCoverageThroughTick: composition.coverageThroughTick, checkpointThroughElapsedSeconds: composition.checkpointThroughElapsedSeconds,
    status: boundary ? 'physical_boundary' : end.elapsedSeconds === (composition.coverageThroughTick - end.originTick) / composition.ticksPerSecond
      ? 'coverage_exhausted' : action.checkpoint.kind === 'retained_quantizer_bucket_v1'
        && composition.knownWork.some(w => w.dueTick !== null && end.elapsedSeconds === (w.dueTick - end.originTick) / composition.ticksPerSecond)
        ? 'decision_boundary' : operation && (end.elapsedSeconds < composition.checkpointThroughElapsedSeconds || operation.progress.kind === 'secured' || operation.progress.kind === 'released')
        ? 'operation_milestone' : 'checkpoint_reached',
    physicalBoundary: boundary ? { responseKind: operation?.kind === 'acquisition' ? 'unresolved' : field.motion.response.kind, cursorAvailable: cursor !== null } : null,
    contributors: composition.contributors.map(c => ({ playerId: c.playerId, motorSourceId: c.motorSourceId,
      motorAdoptionEventId: c.motorSourceId === null ? null : json(['owned_motion_adoption_v2', composition.physicalPitchSourceId,
        c.playerId, 'actual_locomotion_receipts', c.motorSourceId, 'batted_world_field_executions', source.sourceId]), executedThrough })) };
  return freeze({ kind: action.kind, field, composition, adoption, operation, liveWork: ownedScheduledMotionLiveWork(composition, adoption, operation) });
};

type ExecutionArguments = Parameters<typeof deriveExecution> extends [unknown, ...infer Arguments] ? Arguments : never;

/** Internal parameterless factory. One original owner operation owns this service. */
export const createOwnedScheduledMotionExecutionReplay = () => {
  const composition = createOwnedScheduledMotionCompositionReplay();
  return Object.freeze({
    derive: (...args: ExecutionArguments) => deriveExecution(composition, ...args),
    snapshotIdentity: composition.snapshotIdentity,
  });
};

/** Existing public derivation cannot accept caller-supplied evidence or encoders. */
export const deriveOwnedScheduledMotionExecution = (...args: ExecutionArguments): OwnedScheduledMotionExecution => {
  const composition = createOwnedScheduledMotionCompositionReplay();
  return deriveExecution({ derive: deriveOwnedScheduledMotionComposition, reference: composition.reference }, ...args);
};
