import type { BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import type { BallWorldMoment, BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import type { BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

/** Metadata-only plans/observers retain the last actual cut. A constrained pending
 * capture has a real sampleable moment but deliberately no continuation/custody. */
export const ownedScheduledMotionActualState = (base: BattedWorldFieldMotion, prefix: readonly DurableBattedWorldFieldExecution[]): Readonly<{
  moment: BallWorldMoment; actors: readonly BallWorldMotionActor[]; cursor: BattedWorldBallCursor | null; carrierPlayerId: string | null;
}> => {
  const physical = [...prefix].reverse().find(v => !['whole_play_history', 'base_touch_history', 'first_base_race',
    'throw_plan', 'acquisition_plan', 'owned_acquisition_plan_v1', 'owned_throw_plan_v1'].includes(v.execution.kind))?.execution;
  if (physical?.kind === 'owned_motion_v2' && physical.operation?.kind === 'acquisition') {
    const p = physical.operation.progress;
    return { moment: p.world.moment, actors: p.activePiece.actors, cursor: p.cursor,
      carrierPlayerId: p.kind === 'secured' ? p.acquisition.acquirerPlayerId : null };
  }
  if (physical?.kind === 'acquisition_advance') {
    const p = physical.progress;
    return { moment: p.world.moment, actors: physical.field.motion.actors, cursor: p.cursor,
      carrierPlayerId: p.kind === 'secured' ? p.acquisition.acquirerPlayerId : null };
  }
  if (physical?.kind === 'acquisition') {
    const a = physical.acquisition;
    if (a.kind === 'secured') return { moment: a.moment, actors: physical.field.motion.actors,
      cursor: { moment: a.moment, previousContacts: [{ kind: 'actor', playerId: a.acquirerPlayerId, role: 'glove' }] }, carrierPlayerId: a.acquirerPlayerId };
    if ('world' in a) return { moment: a.world.moment, actors: physical.field.motion.actors, cursor: null, carrierPlayerId: null };
  }
  const motion = (physical?.field ?? base).motion;
  return { moment: motion.world.moment, actors: motion.actors, cursor: motion.cursor, carrierPlayerId: motion.carrierPlayerId };
};
