import { deriveCanonicalWholePlayHistory, type CanonicalWholePlayHistory, type WholePlayHistoryStep, type WholePlaySourceRef } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

/** Join only the Native owner's already rederived original pitch and bounded field/execution payloads. */
export const wholePlayPhysicalHistoryFromPrefix = (input: Readonly<{ baseField: DurableBattedWorldFieldAction;
  fields: readonly DurableBattedWorldFieldAction[]; executions: readonly DurableBattedWorldFieldExecution[] }>): CanonicalWholePlayHistory => {
  const physical = battedWorldFieldPhysicalPrefix(input), world = input.baseField.response.touch.worldContact;
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
    if (execution.kind === 'acquisition_plan') {
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
    } else if (execution.kind === 'motion' || execution.kind === 'throw') {
      if (!cursor) throw new Error('whole-play execution lacks its actual physical cursor');
      steps.push(execution.kind === 'motion' ? { source, previousSourceId, kind: 'motion', startCursor: cursor, field: execution.field }
        : { source, previousSourceId, kind: 'throw', startCursor: cursor, field: execution.field, throw: execution.throw });
      cursor = execution.field.motion.cursor; horizon = execution.field.motion.world.moment; basis = source;
    } else if (execution.kind === 'acquisition') {
      const acquisition = execution.acquisition;
      steps.push({ source, previousSourceId, kind: 'acquisition', field: execution.field, acquisition });
      horizon = acquisition.kind === 'secured' ? acquisition.moment : acquisition.world.moment;
      cursor = acquisition.kind === 'secured' ? { moment: acquisition.moment,
        previousContacts: [{ kind: 'actor', playerId: acquisition.acquirerPlayerId, role: 'glove' }] } : null;
      basis = source;
    } else {
      if (!basis) throw new Error('whole-play observation lacks an owned physical basis');
      steps.push({ source, previousSourceId, kind: 'observation', observationKind: execution.kind, basis, horizon });
    }
  }
  if (json(horizon) !== json(physical.field.evidence.horizon)) throw new Error('whole-play physical prefix horizon differs');
  const history = deriveCanonicalWholePlayHistory({ scope: { gameId: pitch.frame.gameId, playId: pitch.frame.match.playId, physicalPitchSourceId },
    originalTimeline, origin, steps });
  if (json(history.horizon) !== json(horizon) || json(history.cursor) !== json(cursor)
    || json(history.originalTimeline) !== json(originalTimeline)) throw new Error('whole-play composition differs from its owned original history');
  return history;
};
