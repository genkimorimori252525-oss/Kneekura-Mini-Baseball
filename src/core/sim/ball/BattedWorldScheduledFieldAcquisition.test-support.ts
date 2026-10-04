import { fixture } from './BattedWorldScheduledFieldThrow.test-support';
import { deriveInitialBattedWorldFieldMotion } from './BattedWorldFieldMotion';
import type { BattedWorldFieldAcquisitionInput } from './BattedWorldFieldAcquisition';
import { respondToBattedWorldBoundary } from './BattedWorldContinuation';
import { quantizeEventTick } from '../ExactEventTime';

export const acquisitionInput = (input = fixture()): BattedWorldFieldAcquisitionInput => ({
  response: input.response, geometry: input.geometry, field: deriveInitialBattedWorldFieldMotion(input),
});
/** Explicit already-adopted sole-glove contact, with its response rederived on the exact clock. */
export const withContactAt = (input: BattedWorldFieldAcquisitionInput, elapsedSeconds: number,
  zeroLoad = false): BattedWorldFieldAcquisitionInput => {
  const motion = input.field.motion, world = motion.world;
  if (world.kind !== 'boundary' || !('phase' in world) || world.contacts[0].kind !== 'actor') throw new Error('sole glove fixture');
  const old = world.contacts[0], p = input.response.world.parameters;
  const position = { ...world.moment.ball.position, x: world.moment.ball.position.x + elapsedSeconds };
  const moment = { ...world.moment, elapsedSeconds, ball: { ...world.moment.ball, position,
    velocity: zeroLoad ? old.velocity : world.moment.ball.velocity,
    tick: quantizeEventTick(world.moment.originTick, elapsedSeconds, p.ticksPerSecond) } };
  const contact = { ...old, moment, center: { ...old.center, x: old.center.x + elapsedSeconds } };
  const changed = { ...world, moment, contacts: [contact] };
  return { ...input, field: { ...input.field, motion: { ...motion, world: changed,
    response: respondToBattedWorldBoundary(input.response, { moment, previousContacts: [] }, changed) } } };
};
