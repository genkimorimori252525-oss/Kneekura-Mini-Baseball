import { deriveBallWorldPlayerBaseContactHistory, type BallWorldPlayerBaseContactHistory,
  type BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import type { BaseTouchRegion } from '../../core/sim/running/BaseTouch';
import type { BattedWorldMotion } from '../../core/sim/ball/BattedWorldMotion';
import { findBallWorldControlledBaseContacts, type BallWorldBaseControlWindow,
  type BallWorldControlledBaseContact } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import type { DurableBattedWorldMotion } from './SqliteBattedWorldMotionStore';
import type { DurableBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

/** Only the SQLite owner's already rederived complete prefixes may supply these windows. */
export const battedWorldBaseTouchHistoryFromPrefix = (input: Readonly<{
  baseMotion: DurableBattedWorldMotion; motions: readonly DurableBattedWorldMotion[];
  executions: readonly DurableBattedWorldExecution[]; playerId: string; base: BaseTouchRegion; baseSurfaceHeightMeters: number;
}>): Readonly<{ history: BallWorldPlayerBaseContactHistory; controlledContacts: readonly BallWorldControlledBaseContact[] }> => {
  const world = input.baseMotion.response.touch.worldContact, originTick = world.flight.flight.initialBall.tick;
  const ticksPerSecond = world.flight.source.execution.ballFlightParameters.ticksPerSecond;
  const motions = input.motions.filter((value) => value.revision <= input.baseMotion.revision);
  if (motions.length !== input.baseMotion.revision || motions.at(-1)?.source.sourceId !== input.baseMotion.source.sourceId) {
    throw new Error('actual base history complete own motion prefix differs');
  }
  const segments: BallWorldPlayerBaseContactSegment[] = [];
  const controlWindows: BallWorldBaseControlWindow[] = [];
  const control = (playerId: string | null, startElapsedSeconds: number, endElapsedSeconds: number, endInclusive: boolean) => {
    if (playerId === input.playerId) controlWindows.push({ startElapsedSeconds, endElapsedSeconds, endInclusive });
  };
  const motionStart = (motion: BattedWorldMotion) => {
    const bases = motion.actors.map((a) => (a.primitive.startTick - originTick) / ticksPerSecond + (a.startElapsedSeconds ?? 0));
    if (!bases.length || !bases.every((at) => Number.isFinite(at) && at === bases[0])
      || motion.world.moment.originTick !== originTick) throw new Error('actual base history actor clock differs');
    return bases[0];
  };
  const originalEnd = motionStart(motions[0].motion);
  segments.push({ originTick, startElapsedSeconds: 0, endElapsedSeconds: originalEnd, actors: world.actors });
  const originalAcquisition = input.baseMotion.acquisition?.result;
  if (originalAcquisition?.kind === 'secured') {
    control(originalAcquisition.acquirerPlayerId, originalAcquisition.moment.elapsedSeconds, originalEnd, true);
  }
  const appendMotion = (motion: BattedWorldMotion) => {
    const startElapsedSeconds = segments.at(-1)!.endElapsedSeconds;
    if (motionStart(motion) !== startElapsedSeconds) throw new Error('actual base history motion does not continue the complete prefix');
    segments.push({ originTick, startElapsedSeconds, endElapsedSeconds: motion.world.moment.elapsedSeconds, actors: motion.actors });
    control(motion.carrierPlayerId, startElapsedSeconds, motion.world.moment.elapsedSeconds, motion.world.kind !== 'boundary');
  };
  motions.forEach((value) => appendMotion(value.motion));
  for (const value of input.executions) {
    const execution = value.execution;
    if (execution.kind === 'motion' || execution.kind === 'throw') {
      const start = segments.at(-1)!.endElapsedSeconds;
      appendMotion(execution.motion);
      if (execution.kind === 'throw' && execution.throw.kind === 'released') {
        control(execution.model.source.playerId, start, execution.throw.releaseCursor.moment.elapsedSeconds, false);
      }
    }
    else if (execution.kind === 'acquisition') {
      const acquisition = execution.acquisition, moment = acquisition.kind === 'secured' ? acquisition.moment : acquisition.world.moment;
      if (acquisition.contactMoment.originTick !== originTick || moment.originTick !== originTick
        || acquisition.contactMoment.elapsedSeconds !== segments.at(-1)!.endElapsedSeconds) {
        throw new Error('actual base history capture does not continue the complete prefix');
      }
      segments.push({ originTick, startElapsedSeconds: acquisition.contactMoment.elapsedSeconds,
        endElapsedSeconds: moment.elapsedSeconds, actors: execution.motion.actors });
      if (acquisition.kind === 'secured') control(acquisition.acquirerPlayerId, moment.elapsedSeconds, moment.elapsedSeconds, true);
    }
    // Observation Sources do not execute another motion or reset the actual horizon.
  }
  const history = deriveBallWorldPlayerBaseContactHistory({ segments, playerId: input.playerId, base: input.base,
    baseSurfaceHeightMeters: input.baseSurfaceHeightMeters });
  return { history, controlledContacts: findBallWorldControlledBaseContacts({ history, controlWindows }) };
};
