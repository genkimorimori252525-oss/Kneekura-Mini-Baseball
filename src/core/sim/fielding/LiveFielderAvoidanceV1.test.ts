import { describe, expect, it } from 'vitest';
import { coordinateLiveFielderMotionV1, type LiveFielderAvoidanceActorV1 } from './LiveFielderAvoidanceV1';
import { buildDefenderMotionTrajectory } from './DefenderMotion';
import { createLiveLocomotionProfileV84 } from '../locomotion/LiveLocomotionV84';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const actor = (playerId: string, x: number, z: number, vx = 0, vz = 0,
  extra: Partial<LiveFielderAvoidanceActorV1> = {}): LiveFielderAvoidanceActorV1 => ({
  playerId, position: v(x, 1, z), velocity: v(vx, 0, vz), accelerationMps2: 6, topSpeedMps: 7,
  bodyRadiusMeters: .24, priority: 0, canSteer: true, preferred: { acceleration: v() }, accepts: () => true, ...extra,
});
const coordinate = (actors: readonly LiveFielderAvoidanceActorV1[], fromSeconds = 0, dt = .04) =>
  coordinateLiveFielderMotionV1({ fromSeconds, throughSeconds: fromSeconds + dt, actors });

it('accepts live planting strength independently of propulsion and retains continuous stopping reserve', () => {
  const locomotionProfile = createLiveLocomotionProfileV84({ accelerationMps2: 6, topSpeedMps: 7 }),
    a = actor('plant', -10, 0, 3, 0, { locomotionProfile, preferred: { acceleration: v(-10.8) } }),
    result = coordinate([a]);
  expect(result.safe).toBe(true);
  expect(result.commands[0].motion.acceleration.x).toBe(-10.8);
  expect(() => coordinate([{ ...a, preferred: { acceleration: v(10.8) } }])).toThrow(/preferred motor/);
  expect(() => coordinate([{ ...a, preferred: { acceleration: v(-10, 0, 5) } }])).toThrow(/preferred motor/);
});
const step = (actors: readonly LiveFielderAvoidanceActorV1[]) => {
  const result = coordinate(actors);
  return { result, actors: actors.map(a => {
    const command = result.commands.find(c => c.playerId === a.playerId)!.motion,
      dt = Math.min(.04, command.stopAfter ?? .04), acceleration = command.acceleration;
    return { ...a, position: v(a.position.x + a.velocity.x * dt + acceleration.x * dt * dt / 2, 1,
      a.position.z + a.velocity.z * dt + acceleration.z * dt * dt / 2),
    velocity: v(command.stopAfter !== undefined && command.stopAfter <= .04 ? 0 : a.velocity.x + acceleration.x * dt, 0,
      command.stopAfter !== undefined && command.stopAfter <= .04 ? 0 : a.velocity.z + acceleration.z * dt) };
  }) };
};

describe('continuous, acceleration-limited local fielder coordination', () => {
  it('preserves exact preferred commands and stationary holds when teammates do not threaten each other', () => {
    let fenceChecks = 0;
    const accepts = () => { fenceChecks++; return true; },
      actors = [actor('hold', -20, 0, 0, 0, { accepts }), actor('run', 20, 0, 0, 2, { preferred: { acceleration: v(0, 0, 3) }, accepts })],
      before = JSON.stringify(actors), result = coordinate(actors);
    expect(result.safe).toBe(true);
    expect(result.commands.map(c => c.motion)).toEqual(actors.map(a => a.preferred));
    expect(result.commands.every(c => c.reason === 'preferred')).toBe(true);
    expect(JSON.stringify(actors)).toBe(before);
    expect(fenceChecks).toBe(actors.length);
    expect(result.diagnostics.candidateEvaluations).toBe(1);
  });

  it.each([
    ['head-on', [actor('first', -2, 0, 3), actor('second', 2, 0, -3)]],
    ['crossing', [actor('first', -2, 0, 3), actor('second', 0, -2, 0, 3)]],
    ['stationary receiver', [actor('receiver', 0, 0, 0, 0, { priority: 10 }), actor('backup', -1.5, 0, 3)]],
    ['three converging players', [actor('one', -2, 0, 3), actor('two', 2, 0, -3), actor('three', 0, -2, 0, 3)]],
  ] as const)('keeps a safe stopping reserve for %s', (_name, actors) => {
    const result = coordinate(actors);
    expect(result.safe).toBe(true);
    expect(result.diagnostics.stepSafe).toBe(true);
    expect(result.diagnostics.stoppingReserveSafe).toBe(true);
    expect(result.diagnostics.minimumStoppingGapMeters).toBeGreaterThanOrEqual(.02 - 1e-8);
  });

  it('checks between sample endpoints instead of missing a fast crossing inside the step', () => {
    const result = coordinate([actor('one', -.3, 0, 7), actor('two', .3, 0, -7)], 0, .1);
    expect(result.safe).toBe(false);
    expect(result.diagnostics.stepSafe).toBe(false);
    expect(result.diagnostics.initialOverlapPairs).toHaveLength(0);
    expect(result.diagnostics.failure).toBe('candidate_search_exhausted');
  });

  it('distinguishes unresolved initial overlap from finite-candidate search failure', () => {
    const result = coordinate([actor('one', 0, 0), actor('two', .3, 0)]);
    expect(result.safe).toBe(false);
    expect(result.diagnostics.initialOverlapPairs).toEqual([{ firstPlayerId: 'one', secondPlayerId: 'two', gapMeters: expect.closeTo(-.18, 10) }]);
    expect(result.diagnostics.failure).toBe('initial_body_overlap');
  });

  it('preserves an unreactive player command while an active teammate yields', () => {
    const actors = [actor('receiver', 0, 0, 0, 0, { canSteer: false, priority: 10 }), actor('backup', -1.5, 0, 3)],
      result = coordinate(actors);
    expect(result.safe).toBe(true);
    expect(result.commands.find(c => c.playerId === 'receiver')!.motion).toEqual(actors[0].preferred);
  });

  it('honours the caller fence predicate on every returned command', () => {
    const accepts = (motion: { acceleration: { x: number; z: number } }) => motion.acceleration.z <= 0,
      actors = [actor('receiver', 0, 0, 0, 0, { priority: 10, accepts }), actor('backup', -1.5, 0, 3, 0, { accepts })],
      result = coordinate(actors);
    expect(result.safe).toBe(true);
    expect(result.commands.every(c => accepts(c.motion))).toBe(true);
  });

  it('keeps same-priority decisions invariant under input permutation and player rename', () => {
    const actors = [actor('a', -1.5, 0, 3), actor('b', 1.5, 0, -3), actor('c', 0, -1.5, 0, 3)],
      original = coordinate(actors), reversed = coordinate([...actors].reverse()), renamed = coordinate(actors.map((a, i) => ({ ...a, playerId: 'name-' + i })));
    for (const [i, a] of actors.entries()) {
      expect(reversed.commands.find(c => c.playerId === a.playerId)!.motion).toEqual(original.commands.find(c => c.playerId === a.playerId)!.motion);
      expect(renamed.commands[i].motion).toEqual(original.commands[i].motion);
    }
  });

  it('gives a preferred transit opportunity to higher priority without immobilizing both players', () => {
    const actors = [actor('handler', -.6, 0, 2, 0, { priority: 10, preferred: { acceleration: v(2) } }),
      actor('backup', .6, 0, -2, 0, { preferred: { acceleration: v(-2) } })], result = coordinate(actors);
    expect(result.safe).toBe(true);
    const handler = result.commands.find(c => c.playerId === 'handler')!.motion,
      backup = result.commands.find(c => c.playerId === 'backup')!.motion;
    expect(result.commands.some(c => c.reason !== 'preferred')).toBe(true);
    expect(Math.hypot(handler.acceleration.x - 2, handler.acceleration.z))
      .toBeLessThan(Math.hypot(backup.acceleration.x + 2, backup.acceleration.z));
  });

  it('respects each motor speed and acceleration bound across repeated replans', () => {
    let actors = [actor('a', -2, 0, 3, 0, { priority: 10, topSpeedMps: 3 }), actor('b', 2, 0, -3, 0, { topSpeedMps: 3 })];
    for (let k = 0; k < 90; k++) {
      const before = actors, next = step(actors);
      expect(next.result.safe).toBe(true);
      for (const [i, a] of next.actors.entries()) {
        expect(Math.hypot(a.velocity.x, a.velocity.z)).toBeLessThanOrEqual(a.topSpeedMps + 1e-8);
        expect(Math.hypot(a.velocity.x - before[i].velocity.x, a.velocity.z - before[i].velocity.z)).toBeLessThanOrEqual(a.accelerationMps2 * .04 + 1e-8);
      }
      actors = next.actors;
    }
  });

  it('allows two purposeful opposing routes to pass each other instead of retaining a braking deadlock', () => {
    let actors = [actor('handler', -2, 0, 0, 0, { priority: 10 }), actor('backup', 2, 0)], maximumSideStep = 0;
    const closestTarget = [Infinity, Infinity];
    const targets = [{ x: 4, z: 0 }, { x: -4, z: 0 }];
    for (let k = 0; k < 300; k++) {
      actors = actors.map((a, i) => {
        const motor = buildDefenderMotionTrajectory({ tick: 0, position: { x: a.position.x, z: a.position.z },
          velocity: { x: a.velocity.x, z: a.velocity.z } }, targets[i], 40000, { ticksPerSecond: 1e6,
          maxIntegrationStepTicks: 40000, accelerationMps2: a.accelerationMps2, brakingMps2: a.accelerationMps2,
          topSpeedMps: a.topSpeedMps, arrivalRadiusMeters: .02 })[0];
        return { ...a, preferred: { acceleration: v(motor.acceleration.x, 0, motor.acceleration.z) } };
      });
      const next = step(actors);
      expect(next.result.safe).toBe(true);
      actors = next.actors;
      maximumSideStep = Math.max(maximumSideStep, ...actors.map(a => Math.abs(a.position.z)));
      actors.forEach((a, i) => { closestTarget[i] = Math.min(closestTarget[i], Math.hypot(a.position.x - targets[i].x, a.position.z)); });
    }
    expect(maximumSideStep).toBeGreaterThan(.15);
    if (process.env.FIELDING_AVOIDANCE_REPORT === '1') console.log(JSON.stringify({ closestTarget, maximumSideStep, actors }));
    // Point-target settling belongs to DefenderMotion. The avoidance contract
    // establishes that both actors pass the obstruction and regain their route.
    expect(closestTarget.every(distance => distance <= .1)).toBe(true);
  });

  it('can search beyond an unsafe all-brake continuation at a sub-event replan', () => {
    const actors = [actor('one', -1, 0, 2, 0, { accelerationMps2: 2, priority: 10 }),
      actor('two', .47, -1, 0, 2, { accelerationMps2: 2 })], result = coordinate(actors);
    expect(result.safe).toBe(true);
    expect(result.commands.some(c => Math.abs(c.motion.acceleration.x * c.motion.acceleration.z) > 1e-5
      || c.playerId === 'one' && Math.abs(c.motion.acceleration.z) > 1e-5
      || c.playerId === 'two' && Math.abs(c.motion.acceleration.x) > 1e-5)).toBe(true);
  });

  it('reports step safety separately when this search cannot recover a stopping reserve', () => {
    const result = coordinate([actor('one', -1, 0, 2, 0, { accelerationMps2: 2 }),
      actor('two', 0, -1, 0, 2, { accelerationMps2: 2 })]);
    expect(result.safe).toBe(false);
    expect(result.diagnostics.stepSafe).toBe(true);
    expect(result.diagnostics.stoppingReserveSafe).toBe(false);
    expect(result.diagnostics.failure).toBe('candidate_search_exhausted');
    expect(result.diagnostics.finiteCandidateFailureProvesUnavoidableImpact).toBe(false);
  });

  it('does not extend a sub-ULP stationary braking phase into a fictitious long acceleration', () => {
    // Captured low-slow-roller P/1B motor state: 1B retains ~8e-17m/s.
    // Its stop duration is positive, but .04 + duration rounds back to .04.
    // The former sampler selected that vanished braking phase at the next
    // interval boundary and falsely accelerated the receiver out of the way.
    const acceleration = v(-1.6884795069511669, 0, -4.386232660792851),
      result = coordinate([
        actor('pitcher', 17.814509783385624, 19.247650238265184, 7.017278222517201, -1.0324759567664454,
          { accelerationMps2: 4.7, topSpeedMps: 7.3, preferred: { acceleration },
            accepts: m => m.acceleration.x === acceleration.x && m.acceleration.z === acceleration.z && m.stopAfter === undefined }),
        actor('receiver', 19.40294484867332, 19.406049025967285, -4.1633363423443364e-17, -6.938893903907228e-17,
          { accelerationMps2: 4.7, topSpeedMps: 7.3, canSteer: false }),
      ]);
    expect(result.safe).toBe(false);
    expect(result.diagnostics.stepSafe).toBe(true);
    expect(result.diagnostics.minimumStoppingGapMeters).toBeLessThan(-.05);
  });

  it.each([0, 1e-18, 1e-17, 1e-16, 1e-15, 1e-14])('keeps stopping-phase classification stable across residual speed %s', residual => {
    const result = coordinate([
      actor('pitcher', 17.814509783385624, 19.247650238265184, 7.017278222517201, -1.0324759567664454,
        { accelerationMps2: 4.7, topSpeedMps: 7.3, canSteer: false,
          preferred: { acceleration: v(-1.6884795069511669, 0, -4.386232660792851) } }),
      actor('receiver', 19.40294484867332, 19.406049025967285, -residual, -residual,
        { accelerationMps2: 4.7, topSpeedMps: 7.3, canSteer: false }),
    ]);
    expect(result.safe).toBe(false);
    expect(result.diagnostics.minimumStoppingGapMeters).toBeCloseTo(-.055623508015, 8);
  });

  it('rejects malformed inputs without manufacturing a motor command', () => {
    const actors = [actor('a', 0, 0)];
    expect(() => coordinate([{ ...actors[0], bodyRadiusMeters: -1 }])).toThrow();
    expect(() => coordinate([{ ...actors[0], preferred: { acceleration: v(7) } }])).toThrow();
    expect(() => coordinate([{ ...actors[0], velocity: v(8) }])).toThrow();
    expect(() => coordinate([{ ...actors[0], preferred: { acceleration: v(-1), stopAfter: .01 } }])).toThrow();
    expect(() => coordinate([...actors, ...actors])).toThrow();
  });
});
