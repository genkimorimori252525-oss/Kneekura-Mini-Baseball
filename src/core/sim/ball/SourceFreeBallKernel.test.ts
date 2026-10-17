import { expect, it } from 'vitest';
import { advanceAerodynamicPitchState, sampleAerodynamicPitchStateAtElapsedSeconds } from '../pitching/AerodynamicPitchTrajectory';
import { quantizeEventTick } from '../ExactEventTime';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';
import { advanceBaseballGroundMotion, sampleBaseballGroundMotionAtElapsedSeconds } from './BaseballGroundDynamics';
import { createFreeBaseballTrajectory } from './FreeBaseballTrajectory';
import { createSourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from './SourceFreeBallKernel';

const descriptor = (): SourceFreeBallDescriptorV2 => ({ kind: 'aero_ground_continuous_source_kernel_v2',
  initial: { originTick: 123_456, elapsedSeconds: 0, ball: { tick: 123_456, position: { x: 0, y: 1, z: 0 },
    velocity: { x: 12, y: 3, z: 6 }, spin: { x: 0, y: 12, z: -50 } } }, throughElapsedSeconds: 3,
  profile: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS },
  ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378,
    restingVerticalSpeedMps: 0.15, material: { restitution: 0.4, slidingFriction: 0.25,
      rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } } });

it('keeps both original integer-tick kernels exactly equal at declared source-clock quotients', () => {
  const d = descriptor(), ball = d.initial.ball, p = d.profile;
  const floor = { ...ball, position: { ...ball.position, y: p.ground.radiusM },
    velocity: { x: 6, y: 0, z: 0 }, spin: { x: 0, y: 12, z: 0 } };
  for (const delta of [0, 1, 997, 4_000, 6_001, 1_000_000, 3_000_000]) {
    expect(sampleAerodynamicPitchStateAtElapsedSeconds(ball, delta / p.air.ticksPerSecond, p.air))
      .toEqual(advanceAerodynamicPitchState(ball, delta, p.air));
    expect(sampleBaseballGroundMotionAtElapsedSeconds(floor, delta / p.ground.ticksPerSecond, p.ground))
      .toEqual(advanceBaseballGroundMotion(floor, delta, p.ground));
  }
  expect(() => sampleAerodynamicPitchStateAtElapsedSeconds(ball, -0.1, p.air)).toThrow();
  expect(() => sampleBaseballGroundMotionAtElapsedSeconds(floor, NaN, p.ground)).toThrow();
});

it('keeps distinct fractional physical instants within one integer clock bucket', () => {
  const d = descriptor(), kernel = createSourceFreeBallKernel({ ...d, throughElapsedSeconds: 0.01 });
  const a = kernel.evaluateAt(0.0000002), b = kernel.evaluateAt(0.0000007);
  expect(a.moment.ball.tick).toBe(d.initial.originTick + 1);
  expect(b.moment.ball.tick).toBe(a.moment.ball.tick);
  expect(a.moment.ball.position).not.toEqual(b.moment.ball.position);
  expect(a.moment.ball.velocity).not.toEqual(b.moment.ball.velocity);
  expect(a.moment.ball).toEqual(sampleAerodynamicPitchStateAtElapsedSeconds(d.initial.ball, 0.0000002, d.profile.air));
});

it('owns the continuous floor instant and incoming/outgoing states before the old integer ground impulse', () => {
  const d = descriptor();
  const nearFloor = { ...d, throughElapsedSeconds: 0.000008, initial: { ...d.initial,
    ball: { ...d.initial.ball, position: { x: 0, y: d.profile.ground.radiusM + 1e-7, z: 0 },
      velocity: { x: 0, y: -1, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  const kernel = createSourceFreeBallKernel(nearFloor), first = kernel.boundaries.find(b => b.kind === 'ground')!;
  expect(first.elapsedSeconds).toBeGreaterThan(0);
  expect(first.elapsedSeconds).toBeLessThan(0.000001);
  const before = kernel.evaluateAt(first.elapsedSeconds / 2), incoming = kernel.evaluateAt(first.elapsedSeconds, 'incoming');
  const outgoing = kernel.evaluateAt(first.elapsedSeconds, 'outgoing');
  expect(before.moment.ball.position.y).toBeGreaterThan(d.profile.ground.radiusM);
  expect(incoming.moment.ball.position.y).toBe(d.profile.ground.radiusM);
  expect(outgoing.moment.ball.position).toEqual(incoming.moment.ball.position);
  expect(incoming.moment.ball.velocity.y).toBeLessThan(0);
  expect(outgoing.moment.ball.velocity.y).toBeGreaterThan(0);
  expect(outgoing.moment.ball.tick).toBe(incoming.moment.ball.tick);
  expect(outgoing.orientation).toEqual(incoming.orientation);
  for (let i = 0; i <= 100; i++) expect(kernel.evaluateAt(nearFloor.throughElapsedSeconds * i / 100).moment.ball.position.y)
    .toBeGreaterThanOrEqual(d.profile.ground.radiusM);
  const old = createFreeBaseballTrajectory({ initialBall: nearFloor.initial.ball,
    throughTick: nearFloor.initial.ball.tick + 8, aerodynamics: d.profile.air, ground: d.profile.ground });
  expect(incoming.moment.ball.velocity).not.toEqual(old.groundContacts[0].incoming.velocity);
});

it('replays the same Source cells across partial horizons, including identical physical ground boundaries', () => {
  const d = descriptor(), shorter = createSourceFreeBallKernel({ ...d, throughElapsedSeconds: 2.123456 });
  const longer = createSourceFreeBallKernel({ ...d, throughElapsedSeconds: 3.546789 });
  const times = [0, 0.0033333, 0.5555555, 1.3333337, 2.123456];
  expect(times.map(t => shorter.evaluateAt(t))).toEqual(times.map(t => longer.evaluateAt(t)));
  expect(shorter.boundaries).toEqual(longer.boundaries.filter(b => b.elapsedSeconds <= 2.123456));
  const floor = { ...d, initial: { ...d.initial, ball: { ...d.initial.ball,
    position: { x: 0, y: d.profile.ground.radiusM + 1e-7, z: 0 }, velocity: { x: 0, y: -1, z: 0 }, spin: { x: 0, y: 0, z: 0 } } } };
  expect(createSourceFreeBallKernel({ ...floor, throughElapsedSeconds: 0.000001 }).boundaries)
    .toEqual(createSourceFreeBallKernel({ ...floor, throughElapsedSeconds: 0.000008 }).boundaries);
});

it('retains exact physical offsets after a fractional actual impulse instead of rebasing to its ceil tick', () => {
  const d = descriptor(), start = 0.00000035;
  const kernel = createSourceFreeBallKernel({ ...d, initial: { ...d.initial, elapsedSeconds: start,
    ball: { ...d.initial.ball, tick: quantizeEventTick(d.initial.originTick, start, d.profile.air.ticksPerSecond) } },
    throughElapsedSeconds: start + 0.01 });
  const at = kernel.evaluateAt(start + 0.0000004);
  expect(at.moment.elapsedSeconds).toBe(start + 0.0000004);
  expect(at.moment.ball.tick).toBe(d.initial.originTick + 1);
  expect(at.moment.ball.position.x).toBeCloseTo(12 * 0.0000004, 11);
});

it('reconstructs from a plain inert descriptor and uses coupled ground phases without exposing game outcomes', () => {
  const d = descriptor(), p = d.profile;
  const input = { ...d, initial: { ...d.initial, ball: { ...d.initial.ball, position: { x: 0, y: p.ground.radiusM, z: 0 },
    velocity: { x: 6, y: 0, z: 0 }, spin: { x: 0, y: 12, z: 0 } } }, throughElapsedSeconds: 6 };
  const one = createSourceFreeBallKernel(input), two = createSourceFreeBallKernel(JSON.parse(JSON.stringify(input)));
  const times = [0, 0.0000003, 1, 2.0000007, 6];
  expect(times.map(t => one.evaluateAt(t))).toEqual(times.map(t => two.evaluateAt(t)));
  expect(one.evaluateAt(0).phase).toBe('sliding');
  expect(one.boundaries.some(b => b.kind === 'rolling_started')).toBe(true);
  expect(one.boundaries.some(b => b.kind === 'rolling_stop')).toBe(true);
  expect(one.evaluateAt(6).phase).toBe('resting');
  expect(one).not.toHaveProperty('officialResult');
  expect(() => one.evaluateAt(6.1)).toThrow();
  expect(() => createSourceFreeBallKernel({ ...d, kind: 'unknown' } as unknown as SourceFreeBallDescriptorV2)).toThrow();
});
