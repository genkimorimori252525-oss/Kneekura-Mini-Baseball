import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BaseTouchRegion } from '../running/BaseTouch';
import type { BallWorldFootBaseContact } from './BallWorldFootBaseContact';
import { findBattedWorldPlayerBaseContact } from './BattedWorldPlayerBaseContact';
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
  const contact = findBattedWorldPlayerBaseContact({ ...input, playerId: motion.carrierPlayerId });
  return contact && (motion.world.kind !== 'boundary' || contact.elapsedSeconds < end.elapsedSeconds) ? contact : null;
};
