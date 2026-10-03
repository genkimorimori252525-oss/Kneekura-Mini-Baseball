import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import type { BaseTouchRegion } from '../running/BaseTouch';
import { findBallWorldFootBaseContact, type BallWorldFootBaseContact } from './BallWorldFootBaseContact';
import type { BattedWorldMotion } from './BattedWorldMotion';

/** Actual feet over the executed segment only. Its Native owner establishes the active Player and fixture geometry. */
export const findBattedWorldPlayerBaseContact = (raw: Readonly<{ motion: BattedWorldMotion; playerId: string;
  base: BaseTouchRegion; baseSurfaceHeightMeters: number }>): BallWorldFootBaseContact | null => {
  const input = cloneInert(raw), motion = input?.motion, end = motion?.world?.moment;
  if (!motion || !end || typeof input.playerId !== 'string' || !input.playerId.length || input.playerId !== input.playerId.trim()
    || !Array.isArray(motion.actors)) throw new Error('actual player foot/base segment is missing');
  const feet = motion.actors.filter((actor) => actor.playerId === input.playerId
    && (actor.primitive.role === 'left_foot' || actor.primitive.role === 'right_foot'));
  if (feet.length !== 2 || new Set(feet.map((actor) => actor.primitive.role)).size !== 2) throw new Error('actual player feet are incomplete');
  const tps = feet[0].primitive.ticksPerSecond;
  const basis = (actor: typeof feet[number]) => (actor.primitive.startTick - end.originTick) / tps + (actor.startElapsedSeconds ?? 0);
  const start = basis(feet[0]);
  if (!Number.isFinite(start) || start < 0 || feet.some((actor) => actor.primitive.ticksPerSecond !== tps || basis(actor) !== start)
    || quantizeEventTick(end.originTick, end.elapsedSeconds, tps) !== end.ball.tick) throw new Error('actual player foot/base clock differs');
  const contacts = feet.map((actor) => findBallWorldFootBaseContact({ actor, originTick: end.originTick,
    searchStartElapsedSeconds: start, searchEndElapsedSeconds: end.elapsedSeconds, base: input.base, baseSurfaceHeightMeters: input.baseSurfaceHeightMeters }))
    .filter((contact): contact is BallWorldFootBaseContact => contact !== null);
  return contacts.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds || (a.role < b.role ? -1 : 1))[0] ?? null;
};
