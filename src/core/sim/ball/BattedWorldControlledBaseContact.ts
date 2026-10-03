import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../ExactEventTime';
import type { BaseTouchRegion } from '../running/BaseTouch';
import { findBallWorldFootBaseContact, type BallWorldFootBaseContact } from './BallWorldFootBaseContact';
import type { BattedWorldMotion } from './BattedWorldMotion';

/** Consumes an actual carried segment. Its Native owner must establish acquisition and the accepted fixture geometry. */
export const findBattedWorldControlledBaseContact = (raw: Readonly<{ motion: BattedWorldMotion; base: BaseTouchRegion;
  baseSurfaceHeightMeters: number }>): BallWorldFootBaseContact | null => {
  const input = cloneInert(raw), motion = input?.motion, end = motion?.world?.moment;
  if (!motion || !end || typeof motion.carrierPlayerId !== 'string' || !motion.carrierPlayerId.length
    || motion.carrierPlayerId !== motion.carrierPlayerId.trim() || !Array.isArray(motion.actors)
    || (motion.world.kind === 'boundary' ? motion.response.kind !== 'unresolved' || motion.response.reason !== 'carried_contact'
      : motion.world.kind !== 'moving' || motion.response.kind !== 'carried')) {
    throw new Error('actual secured carried base-contact segment is missing');
  }
  const feet = motion.actors.filter((actor) => actor.playerId === motion.carrierPlayerId
    && (actor.primitive.role === 'left_foot' || actor.primitive.role === 'right_foot'));
  if (feet.length !== 2 || new Set(feet.map((actor) => actor.primitive.role)).size !== 2) throw new Error('actual carrier feet are incomplete');
  const tps = feet[0].primitive.ticksPerSecond;
  const basis = (actor: typeof feet[number]) => (actor.primitive.startTick - end.originTick) / tps + (actor.startElapsedSeconds ?? 0);
  const start = basis(feet[0]);
  if (!Number.isFinite(start) || start < 0 || feet.some((actor) => actor.primitive.ticksPerSecond !== tps || basis(actor) !== start)
    || quantizeEventTick(end.originTick, end.elapsedSeconds, tps) !== end.ball.tick) throw new Error('actual carried foot/base clock differs');
  const contacts = feet.map((actor) => findBallWorldFootBaseContact({ actor, originTick: end.originTick,
    searchStartElapsedSeconds: start, searchEndElapsedSeconds: end.elapsedSeconds, base: input.base, baseSurfaceHeightMeters: input.baseSurfaceHeightMeters }))
    .filter((contact): contact is BallWorldFootBaseContact => contact !== null
      && (motion.world.kind !== 'boundary' || contact.elapsedSeconds < end.elapsedSeconds));
  return contacts.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds || (a.role < b.role ? -1 : 1))[0] ?? null;
};
