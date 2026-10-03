import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import { findDefenderFootBaseContactSeconds } from '../fielding/DefenderBaseContact';
import type { BaseTouchRegion } from '../running/BaseTouch';
import type { BallWorldMotionActor } from './BallWorldContinuation';

export type BallWorldFootBaseContact = Readonly<{ playerId: string; role: 'left_foot' | 'right_foot'; originTick: number; elapsedSeconds: number; tick: number }>;
export type BallWorldFootBaseContactInput = Readonly<{
  actor: BallWorldMotionActor; originTick: number; searchStartElapsedSeconds: number; searchEndElapsedSeconds: number;
  base: BaseTouchRegion; baseSurfaceHeightMeters: number;
}>;

/** A physical contact only. Own secured possession and actual venue geometry must be established by its Native consumer. */
export const findBallWorldFootBaseContact = (raw: BallWorldFootBaseContactInput): BallWorldFootBaseContact | null => {
  const input = cloneInert(raw), actor = input?.actor, s = actor?.primitive;
  if (!input || !actor || !s || !Number.isSafeInteger(input.originTick) || input.originTick < 0
    || typeof actor.playerId !== 'string' || !actor.playerId.length || actor.playerId !== actor.playerId.trim()
    || s.role !== 'left_foot' && s.role !== 'right_foot'
    || actor.startElapsedSeconds !== undefined && (!Number.isFinite(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0)) {
    throw new Error('invalid actual foot/base actor scope');
  }
  const basis = (s.startTick - input.originTick) / s.ticksPerSecond + (actor.startElapsedSeconds ?? 0);
  const end = (s.endTick - input.originTick) / s.ticksPerSecond;
  const localEnd = (s.endTick - s.startTick) / s.ticksPerSecond - (actor.startElapsedSeconds ?? 0);
  if (![basis, end, localEnd, input.searchStartElapsedSeconds, input.searchEndElapsedSeconds].every(Number.isFinite)
    || localEnd < 0
    || input.searchStartElapsedSeconds < 0 || input.searchStartElapsedSeconds < basis
    || input.searchEndElapsedSeconds < input.searchStartElapsedSeconds || input.searchEndElapsedSeconds > end) {
    throw new Error('actual foot/base query window is outside original coverage');
  }
  // Reconcile equivalent clock calculations only after validating the original coverage.
  const localAt = (elapsed: number) => Math.min(localEnd, Math.max(0, elapsed - basis));
  const local = findDefenderFootBaseContactSeconds(s, input.base, input.baseSurfaceHeightMeters,
    localAt(input.searchStartElapsedSeconds), localAt(input.searchEndElapsedSeconds));
  if (local === null) return null;
  const elapsedSeconds = basis + local;
  return Object.freeze({ playerId: actor.playerId, role: s.role, originTick: input.originTick, elapsedSeconds,
    tick: quantizeEventTick(input.originTick, elapsedSeconds, s.ticksPerSecond) });
};
