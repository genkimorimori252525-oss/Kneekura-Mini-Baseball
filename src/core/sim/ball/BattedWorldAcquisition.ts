import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { CatchRetentionParameters, CatchRetentionResolution } from '../fielding/CatchRetention';
import { quantizeEventTick } from '../ExactEventTime';
import { deriveAcceleratedBallWorldMotion, type AcceleratedBallWorldMotion, type BallWorldMoment, type BallWorldMotionActor } from './BallWorldContinuation';
import type { BattedBallContactResponseInput, BallWorldResponseInput } from './BattedBallContactResponse';
import { deriveBattedWorldContinuation, respondToBattedWorldBoundary } from './BattedWorldContinuation';
import type { BattedWorldMotion } from './BattedWorldMotion';

export type BattedWorldCaptureTransport = Readonly<{
  kind: 'glove_constraint'; contactOffset: Vec3; initialEnergyJ: number; remainingEnergyJ: number;
}>;
type Candidate = Readonly<{
  acquirerPlayerId: string; contactMoment: BallWorldMoment; candidateSecureTick: number; archivedCandidateSecureTick: number;
  retention: CatchRetentionResolution; transport: BattedWorldCaptureTransport;
}>;
export type BattedWorldAcquisition = Candidate & (Readonly<{ kind: 'secured'; secureTick: number; moment: BallWorldMoment }>
  | Readonly<{ kind: 'interrupted'; reason: 'contact' | 'same_tick_competition'; world: Extract<AcceleratedBallWorldMotion, { kind: 'boundary' }> }>);

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Actual sole-glove candidates and uninterrupted own World geometry establish acquisition; no retained predicate is accepted. */
export const deriveBattedWorldAcquisition = (raw: Readonly<{
  response: BattedBallContactResponseInput; throughTicks: readonly number[];
}>): BattedWorldAcquisition => {
  const input = cloneInert(raw), trace = deriveBattedWorldContinuation(input), last = trace.steps.at(-1);
  let contactMoment: BallWorldMoment, acquirerPlayerId: string, center: Vec3, velocity: Vec3, retention: CatchRetentionResolution;
  if (!last && trace.original.kind === 'capture_candidate') {
    const candidate = trace.original, geometry = candidate.geometry;
    if (geometry.contact.kind !== 'actor' || geometry.contact.role !== 'glove') throw new Error('invalid original acquisition candidate');
    contactMoment = { originTick: input.response.world.flight.initialBall.tick, elapsedSeconds: geometry.elapsedSeconds, ball: geometry.ball };
    acquirerPlayerId = geometry.contact.playerId; center = geometry.point; velocity = geometry.surfaceVelocity; retention = candidate.retention;
  } else if (last?.response.kind === 'capture_candidate' && last.world.kind === 'boundary' && last.world.contacts.length === 1) {
    const contact = last.world.contacts[0];
    if (contact.kind !== 'actor' || contact.role !== 'glove') throw new Error('invalid later acquisition candidate');
    contactMoment = last.response.moment; acquirerPlayerId = contact.playerId; center = contact.center; velocity = contact.velocity; retention = last.response.retention;
  } else throw new Error('actual batted World glove acquisition candidate is missing');

  return acquire(input.response, input.response.world.actors, contactMoment, acquirerPlayerId, center, velocity, retention);
};

/** The sole candidate belongs to the actual rebased World segment, never to the old bat-flight forecast. */
export const deriveBallWorldGloveAcquisition = (raw: Readonly<{ response: BallWorldResponseInput; motion: BattedWorldMotion }>): BattedWorldAcquisition => {
  const { response, motion } = cloneInert(raw), world = motion.world;
  if (motion.carrierPlayerId !== null || motion.response.kind !== 'capture_candidate' || world.kind !== 'boundary'
    || !('phase' in world) || world.pendingReason || world.contacts.length !== 1) throw new Error('actual later World acquisition candidate is missing');
  const contact = world.contacts[0];
  if (contact.kind !== 'actor' || contact.role !== 'glove') throw new Error('actual later World glove candidate is missing');
  const derived = respondToBattedWorldBoundary(response, { moment: world.moment, previousContacts: [] }, world);
  if (derived.kind !== 'capture_candidate') throw new Error('actual later World retention candidate differs');
  return acquire(response, motion.actors, world.moment, contact.playerId, contact.center, contact.velocity, derived.retention);
};

export const deriveBattedWorldMotionAcquisition = deriveBallWorldGloveAcquisition;

/** The original continuous contact root owns the deadline; the archived
 * retention tick has already quantized that root and must not be reused. */
export const deriveBallWorldGloveCaptureDeadline = (contactMoment: BallWorldMoment, retention: CatchRetentionResolution,
  parameters: CatchRetentionParameters) => {
  const initialEnergyJ = retention.diagnostics.retentionLoadJ, power = parameters.captureDissipationPowerW;
  const settleSeconds = initialEnergyJ / power, secureElapsedSeconds = contactMoment.elapsedSeconds + settleSeconds;
  if (!Number.isFinite(initialEnergyJ) || initialEnergyJ < 0 || !Number.isFinite(secureElapsedSeconds)
    || initialEnergyJ > 0 && (settleSeconds <= 0 || secureElapsedSeconds <= contactMoment.elapsedSeconds)) throw new Error('invalid capture interval precision');
  const candidateSecureTick = quantizeEventTick(contactMoment.originTick, secureElapsedSeconds, parameters.ticksPerSecond);
  return freeze({ initialEnergyJ, power, secureElapsedSeconds, candidateSecureTick });
};

const acquire = (response: BallWorldResponseInput, actors: readonly BallWorldMotionActor[], contactMoment: BallWorldMoment,
  acquirerPlayerId: string, center: Vec3, velocity: Vec3, retention: CatchRetentionResolution): BattedWorldAcquisition => {
  const profile = response.actors.find((actor) => actor.playerId === acquirerPlayerId && actor.profile.role === 'glove')?.profile;
  const primitive = actors.find((actor) => actor.playerId === acquirerPlayerId && actor.primitive.role === 'glove')?.primitive;
  if (!primitive || profile?.role !== 'glove' || retention.outcome.kind !== 'secured') throw new Error('invalid retained acquisition candidate');
  const { initialEnergyJ, power, secureElapsedSeconds, candidateSecureTick } = deriveBallWorldGloveCaptureDeadline(contactMoment, retention, profile.parameters);
  const contactOffset = { x: contactMoment.ball.position.x - center.x, y: contactMoment.ball.position.y - center.y, z: contactMoment.ball.position.z - center.z };
  // Transport state belongs to the effective ball/glove system. The incoming ball
  // motion/spin energy remains explicit here; this is never a released free ball.
  const motion = { ...contactMoment, ball: { ...contactMoment.ball, velocity, spin: { x: 0, y: 0, z: 0 } } };
  const query = (throughElapsedSeconds: number) => deriveAcceleratedBallWorldMotion({ moment: motion, throughElapsedSeconds,
    acceleration: primitive.acceleration, parameters: response.world.parameters, actors,
    surfaces: response.world.surfaces, previousContacts: [{ kind: 'actor', playerId: acquirerPlayerId, role: 'glove' }] });
  const world = query(secureElapsedSeconds);
  const transportAt = (moment: BallWorldMoment): BattedWorldCaptureTransport => ({ kind: 'glove_constraint', contactOffset, initialEnergyJ,
    remainingEnergyJ: Math.max(0, initialEnergyJ - power * (moment.elapsedSeconds - contactMoment.elapsedSeconds)) });
  const candidate = { acquirerPlayerId, contactMoment, candidateSecureTick, archivedCandidateSecureTick: retention.outcome.secureTick, retention };
  if (world.kind === 'boundary') return freeze({ ...candidate, kind: 'interrupted', reason: 'contact', world, transport: transportAt(world.moment) });
  // Canonical adoption must retain every competing fact at the recorded deadline,
  // including another contact just after the physical deadline in that same tick.
  const recordedElapsedSeconds = (candidateSecureTick - contactMoment.originTick) / response.world.parameters.ticksPerSecond;
  const fence = recordedElapsedSeconds > secureElapsedSeconds ? query(recordedElapsedSeconds) : world;
  if (fence.kind === 'boundary') return freeze({ ...candidate, kind: 'interrupted', reason: 'same_tick_competition', world: fence,
    transport: { ...transportAt(fence.moment), remainingEnergyJ: 0 } });
  return freeze({ ...candidate, kind: 'secured', secureTick: candidateSecureTick, moment: world.moment,
    transport: { kind: 'glove_constraint', contactOffset, initialEnergyJ, remainingEnergyJ: 0 } });
};
