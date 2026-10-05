import { deriveCanonicalWholePlayHistory, type CanonicalWholePlayHistory, type WholePlayHistoryStep, type WholePlaySourceRef } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

type Prefix = Readonly<{ baseField: DurableBattedWorldFieldAction;
  fields: readonly DurableBattedWorldFieldAction[]; executions: readonly DurableBattedWorldFieldExecution[] }>;

/** Private composition consumes only this operation's successfully validated projection. */
const deriveWholePlayPhysicalHistory = (input: Prefix,
  physical: ReturnType<typeof battedWorldFieldPhysicalPrefix>): CanonicalWholePlayHistory => {
  const world = input.baseField.response.touch.worldContact;
  const flight = world.flight, pitch = flight.physicalPitch, physicalPitchSourceId = flight.source.physicalPitchSourceId;
  const originalTimeline = pitch.result.pitch.resolution.timeline, batter = pitch.frame.batterActor!;
  if (pitch.source.sourceId !== physicalPitchSourceId || pitch.source.gameId !== pitch.frame.gameId
    || originalTimeline.playId !== pitch.frame.match.playId || originalTimeline.lastEventTick !== flight.flight.initialBall.tick) {
    throw new Error('whole-play original pitch and bat-contact scope differs');
  }
  const origin = { moment: { originTick: flight.flight.initialBall.tick, elapsedSeconds: 0, ball: flight.flight.initialBall },
    actors: world.actors, batterRunnerId: batter.binding.playerId,
    defenderIds: batter.defenderBindings.map((binding) => binding.playerId), ticksPerSecond: flight.source.execution.ballFlightParameters.ticksPerSecond };
  let cursor: BattedWorldBallCursor | null = { moment: origin.moment, previousContacts: [] };
  let horizon = origin.moment, basis: WholePlaySourceRef | null = null;
  const steps: WholePlayHistoryStep[] = [];
  for (const value of input.fields) {
    if (!cursor) throw new Error('whole-play field motion lacks its actual original cursor');
    const source: WholePlaySourceRef = { owner: 'field_action', sourceId: value.source.sourceId, revision: value.revision, physicalPitchSourceId };
    steps.push({ source, previousSourceId: value.source.previousFieldSourceId, kind: 'motion', startCursor: cursor, field: value.field });
    cursor = value.field.motion.cursor; horizon = value.field.motion.world.moment; basis = source;
  }
  for (const value of input.executions) {
    const execution = value.execution, source: WholePlaySourceRef = { owner: 'field_execution', sourceId: value.source.sourceId,
      revision: value.revision, physicalPitchSourceId }, previousSourceId = value.source.previousExecutionSourceId;
    if (execution.kind === 'owned_acquisition_plan_v1' || execution.kind === 'owned_throw_plan_v1') {
      if (!basis) throw new Error('whole-play owned plan lacks its physical basis');
      steps.push(execution.kind === 'owned_acquisition_plan_v1'
        ? { source, previousSourceId, kind: execution.kind, basis, horizon, plan: execution.plan }
        : { source, previousSourceId, kind: execution.kind, basis, horizon, plan: execution.plan });
    } else if (execution.kind === 'owned_motion_v2') {
      const op = execution.operation;
      const common = op && { planSourceId: op.planSourceId, previousStepSourceIds: op.previousSteps.map(s => s.sourceId), step: op.step,
        bridge: op.bridge && { legacyPlanSourceId: op.bridge.legacyPlanReference.sourceId,
          previousAdvanceSourceId: op.bridge.previousAdvanceReference?.sourceId ?? null } };
      const operation = op && (op.kind === 'acquisition' ? { ...common!, kind: op.kind, plan: op.plan, progress: op.progress }
        : { ...common!, kind: op.kind, plan: op.plan, progress: op.progress });
      steps.push({ source, previousSourceId, kind: 'owned_motion_v2', startCursor: cursor,
        mode: execution.composition.mode === 'retained' ? 'retained' : 'adopted', field: execution.field, operation });
      if (op?.kind === 'acquisition') { cursor = op.progress.cursor; horizon = op.progress.world.moment; }
      else { cursor = execution.field.motion.cursor; horizon = execution.field.motion.world.moment; }
      basis = source;
    } else if (execution.kind === 'acquisition_plan') {
      if (!basis) throw new Error('whole-play scheduled capture plan lacks its owned physical basis');
      steps.push({ source, previousSourceId, kind: 'acquisition_plan', basis, horizon, plan: execution.plan });
    } else if (execution.kind === 'acquisition_advance') {
      steps.push({ source, previousSourceId, kind: 'acquisition_advance', planSourceId: execution.planSourceId,
        field: execution.field, progress: execution.progress });
      cursor = execution.progress.cursor; horizon = execution.progress.world.moment; basis = source;
    } else if (execution.kind === 'throw_plan') {
      if (!basis) throw new Error('whole-play scheduled plan lacks its owned physical basis');
      steps.push({ source, previousSourceId, kind: 'throw_plan', basis, horizon, plan: execution.plan });
    } else if (execution.kind === 'throw_advance') {
      if (!cursor) throw new Error('whole-play scheduled advance lacks its actual physical cursor');
      steps.push({ source, previousSourceId, kind: 'throw_advance', planSourceId: execution.planSourceId,
        startCursor: cursor, field: execution.field, progress: execution.progress });
      cursor = execution.field.motion.cursor; horizon = execution.field.motion.world.moment; basis = source;
    } else if (execution.kind === 'owned_motion_v1' || execution.kind === 'motion' || execution.kind === 'motion_checkpoint_v1' || execution.kind === 'retained_motion_checkpoint_v1' || execution.kind === 'throw') {
      if (!cursor) throw new Error('whole-play execution lacks its actual physical cursor');
      steps.push(execution.kind !== 'throw' ? { source, previousSourceId, kind: execution.kind === 'retained_motion_checkpoint_v1' || execution.kind === 'owned_motion_v1' && execution.composition.mode === 'retained' ? 'retained_motion_checkpoint_v1' : 'motion', startCursor: cursor, field: execution.field }
        : { source, previousSourceId, kind: 'throw', startCursor: cursor, field: execution.field, throw: execution.throw });
      cursor = execution.field.motion.cursor; horizon = execution.field.motion.world.moment; basis = source;
    } else if (execution.kind === 'acquisition') {
      const acquisition = execution.acquisition;
      steps.push({ source, previousSourceId, kind: 'acquisition', field: execution.field, acquisition });
      horizon = acquisition.kind === 'secured' ? acquisition.moment : acquisition.world.moment;
      cursor = acquisition.kind === 'secured' ? { moment: acquisition.moment,
        previousContacts: [{ kind: 'actor', playerId: acquisition.acquirerPlayerId, role: 'glove' }] } : null;
      basis = source;
    } else if (execution.kind === 'whole_play_history' || execution.kind === 'base_touch_history' || execution.kind === 'first_base_race') {
      if (!basis) throw new Error('whole-play observation lacks an owned physical basis');
      steps.push({ source, previousSourceId, kind: 'observation', observationKind: execution.kind, basis, horizon });
    } else throw new Error('whole-play unsupported execution variant');
  }
  if (json(horizon) !== json(physical.field.evidence.horizon)) throw new Error('whole-play physical prefix horizon differs');
  const history = deriveCanonicalWholePlayHistory({ scope: { gameId: pitch.frame.gameId, playId: pitch.frame.match.playId, physicalPitchSourceId },
    originalTimeline, origin, steps });
  if (json(history.horizon) !== json(horizon) || json(history.cursor) !== json(cursor)
    || json(history.originalTimeline) !== json(originalTimeline)) throw new Error('whole-play composition differs from its owned original history');
  return history;
};

/** Derive both views from one complete original prefix, with no caller-supplied evidence or retained result. */
export const battedWorldPhysicalPrefixAndWholePlayHistory = (input: Prefix) => {
  const physical = battedWorldFieldPhysicalPrefix(input);
  return Object.freeze({ physical, history: deriveWholePlayPhysicalHistory(input, physical) });
};

/** Join only the Native owner's already rederived original pitch and bounded field/execution payloads. */
export const wholePlayPhysicalHistoryFromPrefix = (input: Prefix): CanonicalWholePlayHistory =>
  battedWorldPhysicalPrefixAndWholePlayHistory(input).history;
