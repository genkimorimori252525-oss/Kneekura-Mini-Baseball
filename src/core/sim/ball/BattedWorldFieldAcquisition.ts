import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import { deriveAcceleratedBallWorldFieldMotion, type BallWorldMoment } from './BallWorldContinuation';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import type { BallWorldBaseBoundaryContact } from './BallWorldBaseBoundary';
import type { BattedWorldAcquisition, BattedWorldCaptureTransport } from './BattedWorldAcquisition';
import { respondToBattedWorldBoundary } from './BattedWorldContinuation';
import type { BattedWorldFieldGeometry, BattedWorldFieldMotion } from './BattedWorldFieldMotion';
import { assertBattedWorldFieldExecutionScope, battedWorldFieldExecutionBoundary, freezeBattedWorldField,
  hasBattedWorldFieldFields } from './BattedWorldFieldExecution';

export type BattedWorldFieldAcquisition = BattedWorldAcquisition & Readonly<{ baseContacts: readonly BallWorldBaseBoundaryContact[] }>;
export type BattedWorldFieldAcquisitionInput = Readonly<{
  response: BattedBallContactResponseInput; geometry: BattedWorldFieldGeometry; field: BattedWorldFieldMotion;
}>;
const sameVector = (a: Vec3, b: Vec3): boolean => !!a && !!b && (['x', 'y', 'z'] as const).every((axis) =>
  Number.isFinite(a[axis]) && Math.abs(a[axis] - b[axis]) <= Number.EPSILON * Math.max(1, Math.abs(a[axis]), Math.abs(b[axis])) * 32);

/** Only the adopted sole-glove field candidate can begin securing; every securing/fence query includes the bags. */
export const deriveBattedWorldFieldAcquisition = (raw: BattedWorldFieldAcquisitionInput): BattedWorldFieldAcquisition => {
  const input = cloneInert(raw);
  if (!hasBattedWorldFieldFields(input, ['response', 'geometry', 'field']) || !hasBattedWorldFieldFields(input.field, ['motion', 'baseContacts'])) {
    throw new Error('invalid actual field acquisition scope');
  }
  const { response, geometry, field } = input, { motion } = field, world = motion.world;
  assertBattedWorldFieldExecutionScope(response, geometry);
  if (!hasBattedWorldFieldFields(motion, ['actors', 'carrierPlayerId', 'world', 'response', 'cursor'])
    || motion.carrierPlayerId !== null || motion.cursor !== null || motion.response.kind !== 'capture_candidate' || world.kind !== 'boundary'
    || !('phase' in world) || world.pendingReason || world.contacts.length !== 1 || !Array.isArray(field.baseContacts) || field.baseContacts.length !== 0) {
    throw new Error('actual field sole glove acquisition candidate is missing');
  }
  const contact = world.contacts[0], contactMoment = world.moment;
  if (contact.kind !== 'actor' || contact.role !== 'glove' || contact.continuing || !contact.normal
    || JSON.stringify(contact.moment) !== JSON.stringify(contactMoment)) throw new Error('actual field glove contact candidate differs');
  const acquirerPlayerId = contact.playerId;
  const primitive = motion.actors.find((actor) => actor.playerId === acquirerPlayerId && actor.primitive.role === 'glove');
  const profile = response.actors.find((actor) => actor.playerId === acquirerPlayerId && actor.profile.role === 'glove')?.profile;
  if (!primitive || profile?.role !== 'glove' || motion.actors.length !== response.actors.length
    || motion.actors.some((actor) => !response.actors.some((model) => model.playerId === actor.playerId && model.profile.role === actor.primitive.role))) {
    throw new Error('actual field acquisition actor coverage differs');
  }
  const p = response.world.parameters, s = primitive.primitive;
  const dt = (contactMoment.originTick - s.startTick) / p.ticksPerSecond + contactMoment.elapsedSeconds - (primitive.startElapsedSeconds ?? 0);
  const center = (axis: keyof Vec3) => s.startCenter[axis] + s.startVelocity[axis] * dt + 0.5 * s.acceleration[axis] * dt * dt;
  const velocity = (axis: keyof Vec3) => s.startVelocity[axis] + s.acceleration[axis] * dt;
  const offset = { x: contactMoment.ball.position.x - contact.center.x, y: contactMoment.ball.position.y - contact.center.y,
    z: contactMoment.ball.position.z - contact.center.z }, length = Math.hypot(offset.x, offset.y, offset.z), radius = p.ballRadius + s.radius;
  if (!sameVector(contact.center, { x: center('x'), y: center('y'), z: center('z') })
    || !sameVector(contact.velocity, { x: velocity('x'), y: velocity('y'), z: velocity('z') }) || !Number.isFinite(length) || length === 0
    || length > radius + Number.EPSILON * Math.max(1, radius, ...Object.values(contact.center).map(Math.abs)) * 32
    || !sameVector(contact.normal, { x: offset.x / length, y: offset.y / length, z: offset.z / length })) {
    throw new Error('actual field acquisition contact geometry differs');
  }
  const candidate = respondToBattedWorldBoundary(response, { moment: contactMoment, previousContacts: [] }, world);
  if (candidate.kind !== 'capture_candidate' || JSON.stringify(candidate) !== JSON.stringify(motion.response)) {
    throw new Error('actual field acquisition retention candidate differs');
  }
  const retention = candidate.retention;
  if (retention.outcome.kind !== 'secured') throw new Error('actual field retention candidate is missing');
  const initialEnergyJ = retention.diagnostics.retentionLoadJ, power = profile.parameters.captureDissipationPowerW;
  const settleSeconds = initialEnergyJ / power, secureElapsedSeconds = contactMoment.elapsedSeconds + settleSeconds;
  if (!Number.isFinite(initialEnergyJ) || initialEnergyJ < 0 || !Number.isFinite(secureElapsedSeconds)
    || initialEnergyJ > 0 && (settleSeconds <= 0 || secureElapsedSeconds <= contactMoment.elapsedSeconds)) throw new Error('invalid capture interval precision');
  const candidateSecureTick = quantizeEventTick(contactMoment.originTick, secureElapsedSeconds, p.ticksPerSecond);
  // Keep incoming energy and relative contact offset explicit in the effective
  // glove constraint. This is neither a free rebound nor a ball teleport.
  const carried = { ...contactMoment, ball: { ...contactMoment.ball, velocity: contact.velocity, spin: { x: 0, y: 0, z: 0 } } };
  const query = (throughElapsedSeconds: number) => deriveAcceleratedBallWorldFieldMotion({ moment: carried, throughElapsedSeconds,
    acceleration: s.acceleration, parameters: p, actors: motion.actors, surfaces: response.world.surfaces,
    previousContacts: [{ kind: 'actor', playerId: acquirerPlayerId, role: 'glove' }], bases: geometry.bases, previousBaseContacts: [] });
  const transportAt = (moment: BallWorldMoment): BattedWorldCaptureTransport => ({ kind: 'glove_constraint', contactOffset: offset, initialEnergyJ,
    remainingEnergyJ: Math.max(0, initialEnergyJ - power * (moment.elapsedSeconds - contactMoment.elapsedSeconds)) });
  const basis = { acquirerPlayerId, contactMoment, candidateSecureTick, archivedCandidateSecureTick: retention.outcome.secureTick, retention };
  const securing = battedWorldFieldExecutionBoundary(query(secureElapsedSeconds));
  if (securing.world.kind === 'boundary') return freezeBattedWorldField({ ...basis, kind: 'interrupted', reason: 'contact', world: securing.world, baseContacts: securing.baseContacts,
    transport: transportAt(securing.world.moment) });
  const recordedElapsedSeconds = (candidateSecureTick - contactMoment.originTick) / p.ticksPerSecond;
  const fence = recordedElapsedSeconds > secureElapsedSeconds ? battedWorldFieldExecutionBoundary(query(recordedElapsedSeconds)) : securing;
  if (fence.world.kind === 'boundary') return freezeBattedWorldField({ ...basis, kind: 'interrupted', reason: 'same_tick_competition', world: fence.world, baseContacts: fence.baseContacts,
    transport: { ...transportAt(fence.world.moment), remainingEnergyJ: 0 } });
  return freezeBattedWorldField({ ...basis, kind: 'secured', secureTick: candidateSecureTick, moment: securing.world.moment,
    transport: { ...transportAt(securing.world.moment), remainingEnergyJ: 0 }, baseContacts: [] });
};
