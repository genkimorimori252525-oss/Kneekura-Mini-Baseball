import { describe, expect, it } from 'vitest';
import {
  buildLiveSpeedPlanV84,
  createLiveLocomotionProfileV84,
  liveAccelerationDistanceV84,
  liveAccelerationTimeV84,
  livePropulsionAccelerationV84,
  liveReachableSpeedV84,
  stepLiveDefenderMotionV84,
  type LiveSpeedPlanV84,
} from './LiveLocomotionV84';

const profile = createLiveLocomotionProfileV84({ topSpeedMps: 8, accelerationMps2: 5 });
const checkPlan = (plan: LiveSpeedPlanV84, distance: number, initial: number, final: number) => {
  let time = 0, travelled = 0, speed = initial;
  for (const segment of plan.segments) {
    expect(segment.startElapsedSeconds).toBe(time);
    expect(segment.startDistanceMeters).toBe(travelled);
    expect(segment.startSpeedMps).toBeCloseTo(speed, 11);
    const dt = segment.endElapsedSeconds - segment.startElapsedSeconds;
    expect(dt).toBeGreaterThan(0);
    expect(segment.endDistanceMeters).toBeCloseTo(travelled + speed * dt + .5 * segment.accelerationMps2 * dt * dt, 10);
    speed += segment.accelerationMps2 * dt;
    expect(speed).toBeGreaterThanOrEqual(-1e-10);
    expect(speed).toBeLessThanOrEqual(profile.topSpeedMps + 1e-10);
    time = segment.endElapsedSeconds;
    travelled = segment.endDistanceMeters;
  }
  expect(time).toBe(plan.durationSeconds);
  expect(travelled).toBeCloseTo(distance, 10);
  expect(speed).toBeCloseTo(final, 10);
};

describe('averaged alternating-support live locomotion V84', () => {
  it('retains authored abilities and derives distinct uncalibrated braking and lateral limits', () => {
    expect(profile.topSpeedMps).toBe(8);
    expect(profile.accelerationMps2).toBe(5);
    expect(profile.brakingMps2).toBe(9);
    expect(profile.lateralAccelerationMps2).toBe(5);
    expect(Object.isFrozen(profile)).toBe(true);
    const explicit = createLiveLocomotionProfileV84({ topSpeedMps: 7, accelerationMps2: 4, brakingMps2: 6, lateralAccelerationMps2: 3 });
    expect(explicit.brakingMps2).toBe(6);
    expect(explicit.lateralAccelerationMps2).toBe(3);
    expect([0, 1.99, 2, 5.19, 5.2, 8].map(speed => livePropulsionAccelerationV84(profile, speed))).toEqual([5, 5, 3.5, 3.5, 1.75, 1.75]);
  });

  it('integrates every propulsion speed band analytically and additively', () => {
    expect(liveAccelerationDistanceV84(profile, 0, 8)).toBeCloseTo(.4 + (5.2 ** 2 - 2 ** 2) / 7 + (8 ** 2 - 5.2 ** 2) / 3.5, 12);
    expect(liveAccelerationTimeV84(profile, 0, 8)).toBeCloseTo(.4 + 3.2 / 3.5 + 2.8 / 1.75, 12);
    expect(liveAccelerationDistanceV84(profile, 1, 7)).toBeCloseTo(liveAccelerationDistanceV84(profile, 1, 3) + liveAccelerationDistanceV84(profile, 3, 7), 12);
    expect(liveAccelerationTimeV84(profile, 1, 7)).toBeCloseTo(liveAccelerationTimeV84(profile, 1, 3) + liveAccelerationTimeV84(profile, 3, 7), 12);
    expect(liveAccelerationTimeV84(profile, 5, 5)).toBe(0);
  });

  it('inverts acceleration distance through all bands without exceeding the optional speed limit', () => {
    for (const from of [0, .7, 2, 3.3, 5.2, 7]) for (const to of [from, (from + 8) / 2, 8]) {
      const distance = liveAccelerationDistanceV84(profile, from, to);
      expect(liveReachableSpeedV84(profile, from, distance)).toBeCloseTo(to, 11);
    }
    expect(liveReachableSpeedV84(profile, 0, 100, 4)).toBe(4);
    expect(liveReachableSpeedV84(profile, 3, 0)).toBe(3);
  });

  it.each([[27.432, 0, 0], [1, 0, 0], [.1, 0, 0], [15, 3, 2], [8, 5, 5], [10, 8, 0]])(
    'plans finite continuous acceleration, cruise and braking for distance %s', (distance, initial, final) => {
      const plan = buildLiveSpeedPlanV84({ profile, distanceMeters: distance, initialSpeedMps: initial, finalSpeedMps: final });
      expect(plan).not.toBeNull();
      checkPlan(plan!, distance, initial, final);
      expect(plan!.segments.some(segment => segment.accelerationMps2 < 0)).toBe(true);
    },
  );

  it('uses the same analytic acceleration and stronger stopping time in a top-speed leg', () => {
    const distance = 27.432, stopDistance = 8 ** 2 / (2 * profile.brakingMps2),
      accelerationDistance = liveAccelerationDistanceV84(profile, 0, 8),
      plan = buildLiveSpeedPlanV84({ profile, distanceMeters: distance, initialSpeedMps: 0, finalSpeedMps: 0 })!;
    expect(plan.durationSeconds).toBeCloseTo(liveAccelerationTimeV84(profile, 0, 8)
      + (distance - accelerationDistance - stopDistance) / 8 + 8 / profile.brakingMps2, 12);
    expect(plan.segments.filter(segment => segment.accelerationMps2 > 0).map(segment => segment.accelerationMps2)).toEqual([5, 3.5, 1.75]);
  });

  it('accepts derived reachable and stopping roots at representable distance boundaries', () => {
    for (const distance of [.0001, .03, .2, 1, 1.9, 2.5, 6, 10, 20, 27.432]) {
      const endSpeed = liveReachableSpeedV84(profile, 0, distance),
        accelerating = buildLiveSpeedPlanV84({ profile, distanceMeters: distance, initialSpeedMps: 0, finalSpeedMps: endSpeed });
      expect(accelerating).not.toBeNull();
      checkPlan(accelerating!, distance, 0, endSpeed);
      const startSpeed = Math.min(8, Math.sqrt(2 * profile.brakingMps2 * distance)),
        stopping = buildLiveSpeedPlanV84({ profile, distanceMeters: distance, initialSpeedMps: startSpeed, finalSpeedMps: 0 });
      expect(stopping).not.toBeNull();
      checkPlan(stopping!, distance, startSpeed, 0);
    }
  });

  it('keeps a rounded derived peak above both accepted endpoint speeds', () => {
    const initial = 6.0397837366873, final = 5.809475019311125,
      minimumDistance = (initial - final) * (initial + final) / (2 * profile.brakingMps2);
    const reproduced = buildLiveSpeedPlanV84({ profile, distanceMeters: .15161042144180417,
      initialSpeedMps: initial, finalSpeedMps: final, speedLimitMps: 8 });
    expect(reproduced).not.toBeNull();
    checkPlan(reproduced!, .15161042144180417, initial, final);
    for (let ulps = 0; ulps < 32; ulps++) {
      const distance = minimumDistance * (1 + ulps * Number.EPSILON),
        plan = buildLiveSpeedPlanV84({ profile, distanceMeters: distance, initialSpeedMps: initial, finalSpeedMps: final });
      expect(plan).not.toBeNull();
      checkPlan(plan!, distance, initial, final);
      expect(plan!.segments[0].startSpeedMps).toBe(initial);
    }
  });

  it('retains exact zero-distance states and rejects infeasible stops without clamping inherited speed', () => {
    expect(buildLiveSpeedPlanV84({ profile, distanceMeters: 0, initialSpeedMps: 0, finalSpeedMps: 0 })).toEqual({ durationSeconds: 0, segments: [] });
    expect(buildLiveSpeedPlanV84({ profile, distanceMeters: 1, initialSpeedMps: 8, finalSpeedMps: 0 })).toBeNull();
    expect(buildLiveSpeedPlanV84({ profile, distanceMeters: 20, initialSpeedMps: 6, finalSpeedMps: 0, speedLimitMps: 4 })).toBeNull();
    expect(buildLiveSpeedPlanV84({ profile, distanceMeters: 0, initialSpeedMps: 1, finalSpeedMps: 0 })).toBeNull();
  });

  it('launches with authored acceleration and reduces propulsion at high speed', () => {
    const launch = stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }, { x: 100, z: 0 }, .04, profile);
    expect(launch.phase).toBe('launch');
    expect(launch.acceleration.x).toBeCloseTo(5, 12);
    expect(launch.acceleration.z).toBe(0);
    const running = stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity: { x: 7, z: 0 } }, { x: 100, z: 0 }, .04, profile);
    expect(running.phase).toBe('run');
    expect(running.acceleration.x).toBeCloseTo(1.75, 12);
  });

  it.each([{ x: -100, z: 0 }, { x: 0, z: 100 }])('plants and brakes high-speed motion before turning toward %s', target => {
    const command = stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity: { x: 8, z: 0 } }, target, .04, profile);
    expect(command.phase).toBe('plant');
    expect(command.acceleration).toEqual({ x: -9, z: 0 });
    expect(8 + command.acceleration.x * .04).toBeGreaterThan(0);
  });

  it('ends a small-speed hold at an explicit stopping boundary without reverse velocity', () => {
    const command = stepLiveDefenderMotionV84({ position: { x: 4, z: 3 }, velocity: { x: .001, z: 0 } }, null, .04, profile);
    expect(command.phase).toBe('brake');
    expect(command.stopAfter).toBeCloseTo(.001 / 9, 15);
    expect(.001 + command.acceleration.x * command.stopAfter!).toBeCloseTo(0, 15);
    expect(stepLiveDefenderMotionV84({ position: { x: 4, z: 3 }, velocity: { x: 0, z: 0 } }, null, .04, profile)).toEqual({ acceleration: { x: 0, z: 0 }, phase: 'hold' });
  });

  it('anticipates the target stop and converges continuously without target overshoot or velocity reset', () => {
    let position = { x: 0, z: 0 }, velocity = { x: 8, z: 0 }, observedBrake = false;
    for (let step = 0; step < 300; step++) {
      const command = stepLiveDefenderMotionV84({ position, velocity }, { x: 8, z: 0 }, .04, profile), dt = Math.min(.04, command.stopAfter ?? .04);
      observedBrake ||= command.phase === 'brake';
      position = { x: position.x + velocity.x * dt + .5 * command.acceleration.x * dt * dt,
        z: position.z + velocity.z * dt + .5 * command.acceleration.z * dt * dt };
      velocity = command.stopAfter !== undefined && command.stopAfter <= .04 ? { x: 0, z: 0 }
        : { x: velocity.x + command.acceleration.x * .04, z: velocity.z + command.acceleration.z * .04 };
      expect(position.x).toBeLessThanOrEqual(8 + 1e-10);
      expect(Math.hypot(velocity.x, velocity.z)).toBeLessThanOrEqual(8 + 1e-12);
      if (velocity.x === 0 && Math.abs(position.x - 8) <= .02) break;
    }
    expect(observedBrake).toBe(true);
    expect(Math.abs(position.x - 8)).toBeLessThanOrEqual(.02 + 1e-10);
    expect(velocity).toEqual({ x: 0, z: 0 });
  });

  it('bounds combined turning and longitudinal commands while retaining finite continuous velocity', () => {
    const velocity = { x: 6, z: 2 }, command = stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity }, { x: 60, z: 50 }, .04, profile),
      end = { x: velocity.x + command.acceleration.x * .04, z: velocity.z + command.acceleration.z * .04 }, speed = Math.hypot(velocity.x, velocity.z),
      along = (command.acceleration.x * velocity.x + command.acceleration.z * velocity.z) / speed,
      lateral = (command.acceleration.x * velocity.z - command.acceleration.z * velocity.x) / speed,
      longitudinalLimit = along >= 0 ? livePropulsionAccelerationV84(profile, speed) : profile.brakingMps2;
    expect((along / longitudinalLimit) ** 2 + (lateral / profile.lateralAccelerationMps2) ** 2).toBeLessThanOrEqual(1 + 1e-12);
    expect(Math.hypot(end.x, end.z)).toBeLessThanOrEqual(8 + 1e-12);
    expect(Math.hypot(end.x - velocity.x, end.z - velocity.z)).toBeLessThanOrEqual(profile.brakingMps2 * .04 + 1e-12);
  });

  it('retains a strictly admissible speed at rotated top-speed control boundaries', () => {
    for (let sample = 0; sample < 180; sample++) {
      const angle = sample * Math.PI / 90, raw = { x: 8 * Math.cos(angle), z: 8 * Math.sin(angle) },
        factor = Math.hypot(raw.x, raw.z) > 8 ? 1 - 2 * Number.EPSILON : 1;
      for (const turn of [0, .02, -.1, .4]) {
        const velocity = { x: raw.x * factor, z: raw.z * factor }, target = { x: 1_000 * Math.cos(angle + turn), z: 1_000 * Math.sin(angle + turn) },
          command = stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity }, target, .04, profile),
          end = { x: velocity.x + command.acceleration.x * .04, z: velocity.z + command.acceleration.z * .04 };
        expect(Math.hypot(end.x, end.z), 'top-speed sample ' + sample + ' turn ' + turn).toBeLessThanOrEqual(8);
        expect(() => stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity: end }, target, .04, profile)).not.toThrow();
      }
    }
  });

  it('retains propulsion capacity across tiny continuous event cuts without subtractive speed cancellation', () => {
    for (const dt of [1e-6, 1e-12, 1e-15, 1e-16, 1e-18]) {
      const command = stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity: { x: 3, z: 0 } }, { x: 100, z: 0 }, dt, profile);
      expect(command.acceleration.x).toBeCloseTo(3.5, 12);
      expect(command.acceleration.x).toBeLessThanOrEqual(3.5 + 1e-12);
      expect(command.acceleration.z).toBe(0);
    }
  });

  it('rejects nonfinite, negative and overspeed source values', () => {
    for (const bad of [0, -1, NaN, Infinity]) expect(() => createLiveLocomotionProfileV84({ topSpeedMps: bad, accelerationMps2: 5 })).toThrow();
    expect(() => livePropulsionAccelerationV84(profile, -1)).toThrow();
    expect(() => liveAccelerationTimeV84(profile, 5, 4)).toThrow();
    expect(() => liveAccelerationDistanceV84(profile, 0, 9)).toThrow();
    expect(() => liveReachableSpeedV84(profile, 5, 10, 4)).toThrow();
    expect(() => buildLiveSpeedPlanV84({ profile, distanceMeters: Infinity, initialSpeedMps: 0, finalSpeedMps: 0 })).toThrow();
    expect(() => stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity: { x: 8.1, z: 0 } }, { x: 100, z: 0 }, .04, profile)).toThrow();
    expect(() => stepLiveDefenderMotionV84({ position: { x: 0, z: 0 }, velocity: { x: 0, z: 0 } }, null, 0, profile)).toThrow();
  });
});
