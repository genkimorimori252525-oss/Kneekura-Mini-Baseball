import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import { createFairFoulBaseGateGeometry, type FairFoulBaseGateGeometry } from '../sim/ball/FairFoulBaseGateGeometry';
import { quantizeEventTick } from '../sim/ExactEventTime';

export type BallWorldGroundGatePassageInput = Readonly<{ moment: BallWorldMoment; throughElapsedSeconds: number;
  rollingDecelerationMps2: number; gravityY?: number; ballRadiusMeters: number; ticksPerSecond: number; bases: FairFoulBaseGateGeometry }>;
const fields = (v: unknown, names: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const vector = (v: BallWorldMoment['ball']['position']) => fields(v, ['x', 'y', 'z']) && Object.values(v).every(Number.isFinite);

/** Observe a bounded adopted rolling segment. An exact arrival without outward continuation is not a passage. */
export const findBallWorldGroundGatePassage = (raw: BallWorldGroundGatePassageInput) => {
  const input = cloneInert(raw), m = input?.moment, ball = m?.ball;
  const airborne = input?.gravityY !== undefined;
  if (!fields(input, ['moment', 'throughElapsedSeconds', 'rollingDecelerationMps2', ...(airborne ? ['gravityY'] : []), 'ballRadiusMeters', 'ticksPerSecond', 'bases'])
    || !fields(m, ['originTick', 'elapsedSeconds', 'ball']) || !fields(ball, ['tick', 'position', 'velocity', 'spin'])
    || ![ball.position, ball.velocity, ball.spin].every(vector) || !Number.isFinite(m.elapsedSeconds) || m.elapsedSeconds < 0
    || !Number.isFinite(input.throughElapsedSeconds) || input.throughElapsedSeconds < m.elapsedSeconds
    || !Number.isFinite(input.ballRadiusMeters) || input.ballRadiusMeters <= 0
    || (airborne ? !Number.isFinite(input.gravityY) || input.rollingDecelerationMps2 !== 0 || ball.position.y < input.ballRadiusMeters
      : ball.position.y !== input.ballRadiusMeters || ball.velocity.y !== 0)
    || !Number.isFinite(input.rollingDecelerationMps2) || input.rollingDecelerationMps2 < 0
    || ball.tick !== quantizeEventTick(m.originTick, m.elapsedSeconds, input.ticksPerSecond)) throw new Error('invalid adopted ground gate segment');
  quantizeEventTick(m.originTick, input.throughElapsedSeconds, input.ticksPerSecond);
  const bases = createFairFoulBaseGateGeometry(input.bases);
  const speed = Math.hypot(ball.velocity.x, ball.velocity.z), deceleration = input.rollingDecelerationMps2;
  const stopDuration = speed > 0 && deceleration > 0 ? speed / deceleration : null;
  if (!Number.isFinite(speed) || stopDuration !== null && input.throughElapsedSeconds > m.elapsedSeconds + stopDuration) throw new Error('ground gate segment exceeds actual rolling stop');
  // Physics stores start + stopDuration. Subtraction can round that exact
  // deadline beyond stopDuration; retain the already adopted closed endpoint.
  const duration = Math.min(input.throughElapsedSeconds - m.elapsedSeconds, stopDuration ?? Infinity);
  const ratio = speed === 0 ? 0 : deceleration / speed;
  const sample = (seconds: number): BallWorldMoment => {
    const travel = seconds * (1 - 0.5 * ratio * seconds), elapsedSeconds = m.elapsedSeconds + seconds;
    const position = { x: ball.position.x + ball.velocity.x * travel,
      y: ball.position.y + ball.velocity.y * seconds + 0.5 * (input.gravityY ?? 0) * seconds * seconds,
      z: ball.position.z + ball.velocity.z * travel };
    const velocity = { x: ball.velocity.x * (1 - ratio * seconds), y: ball.velocity.y + (input.gravityY ?? 0) * seconds,
      z: ball.velocity.z * (1 - ratio * seconds) };
    if (!vector(position) || !vector(velocity)) throw new Error('ground gate motion arithmetic overflow');
    return { originTick: m.originTick, elapsedSeconds, ball: { tick: quantizeEventTick(m.originTick, elapsedSeconds, input.ticksPerSecond), position, velocity, spin: ball.spin } };
  };
  const end = sample(duration), crossings: { seconds: number; base: 'firstBase' | 'thirdBase' }[] = [];
  for (const base of ['firstBase', 'thirdBase'] as const) {
    const start = bases[base], finish = bases.secondBase, dx = finish.x - start.x, dz = finish.z - start.z;
    const side = (x: number, z: number) => dx * (z - start.z) - dz * (x - start.x);
    const homeSide = side(bases.homePlate.x, bases.homePlate.z), orientation = Math.sign(homeSide);
    const initialSide = side(ball.position.x, ball.position.z) * orientation, finalSide = side(end.ball.position.x, end.ball.position.z) * orientation;
    const rate = (dx * ball.velocity.z - dz * ball.velocity.x) * orientation;
    if (![dx, dz, homeSide, initialSide, finalSide, rate].every(Number.isFinite)) throw new Error('ground gate geometry arithmetic overflow');
    if (initialSide < 0) { crossings.push({ seconds: 0, base }); continue; }
    if (finalSide >= 0 || rate >= 0) continue;
    const travelSeconds = -initialSide / rate, discriminant = 1 - 2 * ratio * travelSeconds;
    if (!Number.isFinite(travelSeconds) || !Number.isFinite(discriminant) || discriminant < 0) throw new Error('ground gate root arithmetic differs');
    const seconds = 2 * travelSeconds / (1 + Math.sqrt(discriminant));
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > duration) throw new Error('ground gate crossing exceeds actual segment');
    crossings.push({ seconds, base });
  }
  crossings.sort((a, b) => a.seconds - b.seconds);
  const first = crossings[0];
  if (!first) return null;
  return { moment: sample(first.seconds), beyond: {
    firstBase: crossings.some((c) => c.base === 'firstBase' && c.seconds === first.seconds),
    thirdBase: crossings.some((c) => c.base === 'thirdBase' && c.seconds === first.seconds) } };
};
