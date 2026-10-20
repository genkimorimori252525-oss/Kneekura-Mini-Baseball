import { describe, expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createLiveRunnerMotionV1 } from '../running/LiveRunnerMotionV1';
import { sampleRunnerRoute } from '../running/RunnerRoute';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const runnerId = 'second-runner';
function fixture(): LiveFieldPlayInputV1 {
  const tps = 1e6;
  return {
    ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, .5, 0), velocity: v(0, 26, 30), spin: v(-150, 0, 0) } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
      v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, i) => ({ playerId: `fielder-${i}`, position,
      reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 4, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId, initialBase: 2, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 0, maxPlaySeconds: 30, frameSeconds: .02,
  };
}
const base = (input: LiveFieldPlayInputV1, n: number) => input.field.bases[(['home', 'first', 'second', 'third', 'home'] as const)[n]];
type Result = ReturnType<typeof simulateLiveFieldPlayV1>;
type RecordedMotion = Result['diagnostics']['aiTelemetry']['runnerMotions'][number];
function rebuild(input: LiveFieldPlayInputV1, recorded: RecordedMotion) {
  const runner = input.runners.find(r => r.runnerId === recorded.runnerId)!;
  const result = createLiveRunnerMotionV1({ position: recorded.position, velocity: recorded.velocity,
    bases: recorded.throughBases.map(n => ({ base: n, position: base(input, n) })),
    topSpeedMps: runner.topSpeedMps, accelerationMps2: runner.accelerationMps2,
    roundingRadiusMeters: recorded.throughBases.length > 1 ? runner.roundingRadiusMeters : undefined,
    lateralAccelerationMps2: recorded.throughBases.length > 1 ? runner.lateralAccelerationMps2 : undefined,
    baseTouchRadiusMeters: input.field.baseTouchRadiusMeters });
  expect(result).not.toBeNull();
  expect(result!.route).toEqual(recorded.route);
  expect(result!.durationSeconds).toBe(recorded.durationSeconds);
  return result!;
}
function verifyActualRoute(input: LiveFieldPlayInputV1, result: Result, id: string) {
  const plans = result.diagnostics.aiTelemetry.runnerMotions.filter(p => p.runnerId === id);
  expect(plans.length).toBeGreaterThan(0);
  const rebuilt = plans.map(p => ({ record: p, motion: rebuild(input, p) }));
  for (let i = 1; i < rebuilt.length; i++) {
    const previous = rebuilt[i - 1], current = rebuilt[i];
    const before = previous.motion.sampleAtElapsedSeconds(current.record.elapsedSeconds - previous.record.elapsedSeconds);
    expect(distance(before.position, current.record.position)).toBeLessThan(1e-8);
    expect(distance(before.velocity, current.record.velocity)).toBeLessThan(1e-8);
    const after = current.motion.sampleAtElapsedSeconds(1e-7);
    expect(distance(after.position, before.position)).toBeLessThan(1e-6);
    expect(distance(after.velocity, before.velocity)).toBeLessThan(1e-5);
    const positionDerivative = { x: (after.position.x - current.record.position.x) / 1e-7,
      z: (after.position.z - current.record.position.z) / 1e-7 };
    expect(distance(positionDerivative, current.record.velocity)).toBeLessThan(1e-5);
  }
  for (const frame of result.frames) {
    const runner = frame.runners.find(r => r.runnerId === id)!;
    if (runner.retired) continue;
    const active = rebuilt.filter(p => p.record.elapsedSeconds <= frame.elapsedSeconds).at(-1);
    if (!active) continue;
    const sampled = active.motion.sampleAtElapsedSeconds(frame.elapsedSeconds - active.record.elapsedSeconds);
    expect(distance(sampled.position, runner.position)).toBeLessThan(1e-8);
    expect(distance(sampled.velocity, runner.velocity)).toBeLessThan(1e-8);
    const route = sampleRunnerRoute(active.motion.route, sampled.distanceMeters);
    const part = active.motion.route.segments[route.segmentIndex];
    if (part.kind === 'arc') expect(sampled.speedMps ** 2 / part.radiusMeters)
      .toBeLessThanOrEqual((input.runners.find(r => r.runnerId === id)!.lateralAccelerationMps2 ?? 7.5) + 1e-8);
  }
  for (const touch of result.facts.filter(f => f.kind === 'runner_base_touch' && f.runnerId === id)) {
    expect(distance(touch.position!, base(input, touch.base!))).toBeCloseTo(input.field.baseTouchRadiusMeters ?? .28, 8);
    const active = rebuilt.filter(p => p.record.elapsedSeconds <= touch.elapsedSeconds && p.record.throughBases.includes(touch.base!)).at(-1)!;
    const sampled = active.motion.sampleAtElapsedSeconds(touch.elapsedSeconds - active.record.elapsedSeconds);
    expect(distance(sampled.position, touch.position!)).toBeLessThan(1e-8);
    const contact = active.motion.touches.find(t => t.base === touch.base)!;
    expect(touch.elapsedSeconds - active.record.elapsedSeconds).toBeCloseTo(contact.elapsedSeconds, 10);
    expect(contact.centerElapsedSeconds).toBeGreaterThan(contact.elapsedSeconds);
    const before = active.motion.sampleAtElapsedSeconds(contact.elapsedSeconds - 1e-7);
    expect(distance(before.position, base(input, touch.base!))).toBeGreaterThan(input.field.baseTouchRadiusMeters ?? .28);
    if (touch.base !== active.record.throughBases.at(-1)) expect(sampled.speedMps).toBeGreaterThan(.1);
  }
  return rebuilt;
}
function homeRunFixture(): LiveFieldPlayInputV1 {
  const raw = fixture();
  return { ...raw, field: { ...raw.field, fenceRadiusMeters: 60 },
    fielders: raw.fielders.map(f => ({ ...f, position: v(f.position.x / 2, f.position.y, f.position.z / 2) })),
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, 2, 0), velocity: v(0, 25, 45), spin: v() } },
    runners: [raw.runners[0]] };
}

describe('actual live runner rounding', () => {
  it('commits a safe ordinary extra base and physically runs through third without stopping', () => {
    const input = fixture(), result = simulateLiveFieldPlayV1(input);
    expect(result.end.complete).toBe(true);
    expect(result.ruleFacts.overFence).toBeNull();
    expect(result.ruleFacts.runnerTouches.filter(t => t.runnerId === runnerId).map(t => t.base)).toEqual([3, 4]);
    const plans = verifyActualRoute(input, result, runnerId);
    const through = plans.find(p => p.record.throughBases.join(',') === '3,4')!;
    expect(through).toBeDefined();
    const third = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === runnerId && f.base === 3)!;
    expect(through.record.elapsedSeconds).toBeLessThan(third.elapsedSeconds);
    expect(through.motion.sampleAtElapsedSeconds(third.elapsedSeconds - through.record.elapsedSeconds).speedMps).toBeGreaterThan(.1);
    const final = result.finalRunners.find(r => r.runnerId === runnerId)!;
    expect(final).toMatchObject({ scored: true, retired: false });
    // The piecewise clock/route sum can leave an ULP-scale endpoint residual.
    expect(distance(final.position, input.field.bases.home)).toBeLessThan(1e-12);
    expect(final.position.y).toBeCloseTo(input.field.bases.home.y, 12);
    expect(result.frames.at(-1)!.runners.find(r => r.runnerId === runnerId)!.velocity).toEqual(v());
  });

  it('runs a home run through all four actual bags in order and stops at home', () => {
    const input = homeRunFixture(), result = simulateLiveFieldPlayV1(input);
    expect(result.end).toMatchObject({ complete: true, reason: 'home_run_completed' });
    expect(result.ruleFacts.runnerTouches.map(t => t.base)).toEqual([1, 2, 3, 4]);
    const plans = verifyActualRoute(input, result, 'batter');
    expect(plans.some(p => p.record.throughBases.join(',') === '1,2,3,4')).toBe(true);
    const events = result.facts.filter(f => f.kind === 'runner_base_touch');
    for (let i = 1; i < events.length; i++) expect(events[i].elapsedSeconds).toBeGreaterThan(events[i - 1].elapsedSeconds);
    const final = result.frames.at(-1)!.runners[0];
    // Summing the piecewise speed-plan clock may leave a sub-femtometre
    // route-sampling residual at the final frame; the runner still stops home.
    expect(final.position.x).toBeCloseTo(input.field.bases.home.x, 12);
    expect(final.position.y).toBeCloseTo(input.field.bases.home.y, 12);
    expect(final.position.z).toBeCloseTo(input.field.bases.home.z, 12);
    expect(final.velocity).toEqual(v());
  });

  it('records each through-bag departure exactly once at the physical bag-disk exit', () => {
    const input = homeRunFixture(), result = simulateLiveFieldPlayV1(input);
    expect(result.end).toMatchObject({ complete: true, reason: 'home_run_completed' });
    const plans = verifyActualRoute(input, result, 'batter');
    const departures = result.facts.filter(f => f.kind === 'runner_base_departure' && f.runnerId === 'batter');
    expect(departures.map(f => f.base)).toEqual([1, 2, 3]);
    expect(result.ruleFacts.runnerDepartures.filter(f => f.runnerId === 'batter').map(f => f.base)).toEqual([1, 2, 3]);
    const ordered = result.facts.filter(f => f.runnerId === 'batter'
      && (f.kind === 'runner_base_touch' || f.kind === 'runner_base_departure'));
    expect(ordered.map(f => [f.kind, f.base])).toEqual([
      ['runner_base_touch', 1], ['runner_base_departure', 1],
      ['runner_base_touch', 2], ['runner_base_departure', 2],
      ['runner_base_touch', 3], ['runner_base_departure', 3], ['runner_base_touch', 4],
    ]);
    for (const departure of departures) {
      const touch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === 'batter' && f.base === departure.base)!;
      expect(departure.elapsedSeconds).toBeGreaterThan(touch.elapsedSeconds);
      expect(departure.tick).toBeGreaterThan(touch.tick);
      const active = plans.filter(p => p.record.elapsedSeconds <= departure.elapsedSeconds && p.record.throughBases.includes(departure.base!)).at(-1)!;
      const local = departure.elapsedSeconds - active.record.elapsedSeconds;
      const at = active.motion.sampleAtElapsedSeconds(local), before = active.motion.sampleAtElapsedSeconds(local - 1e-7),
        after = active.motion.sampleAtElapsedSeconds(local + 1e-7);
      expect(distance(at.position, base(input, departure.base!))).toBeGreaterThanOrEqual((input.field.baseTouchRadiusMeters ?? .28) - 1e-10);
      expect(distance(at.position, base(input, departure.base!))).toBeCloseTo(input.field.baseTouchRadiusMeters ?? .28, 8);
      expect(distance(before.velocity, after.velocity)).toBeLessThan(2e-5);
      expect(at.speedMps).toBeGreaterThan(.1);
      expect(distance(before.position, base(input, departure.base!))).toBeLessThan(input.field.baseTouchRadiusMeters ?? .28);
      expect(distance(after.position, base(input, departure.base!))).toBeGreaterThan(input.field.baseTouchRadiusMeters ?? .28);
    }
    expect(result.facts.filter(f => f.kind === 'runner_base_departure' && f.runnerId === 'batter' && f.base === 4)).toEqual([]);
  });

  it('keeps a runner stopped at third when the following advance is unsafe', () => {
    const raw = fixture(), input = { ...raw, fielders: raw.fielders.map(f => ({ ...f, throwSpeedMps: 8 })) };
    const result = simulateLiveFieldPlayV1(input);
    expect(result.end.complete).toBe(true);
    expect(result.ruleFacts.runnerTouches.filter(t => t.runnerId === runnerId).map(t => t.base)).toEqual([3]);
    const plans = verifyActualRoute(input, result, runnerId);
    expect(plans.every(p => p.record.throughBases.length === 1)).toBe(true);
    const finalRunner = result.finalRunners.find(r => r.runnerId === runnerId)!;
    expect(finalRunner).toMatchObject({ base: 3, retired: false, scored: false });
    expect(distance(finalRunner.position, input.field.bases.third)).toBeLessThan(1e-10);
    expect(result.frames.at(-1)!.runners.find(r => r.runnerId === runnerId)!.velocity).toEqual(v());
    expect(result.ruleFacts.runnerDepartures.filter(f => f.runnerId === runnerId && f.base === 3)).toEqual([]);
  });

  it('changes actual turning path and speed when the hidden radius and lateral ability change', () => {
    const raw = homeRunFixture();
    const run = (roundingRadiusMeters: number, lateralAccelerationMps2: number) => {
      const input = { ...raw, runners: raw.runners.map(r => ({ ...r, roundingRadiusMeters, lateralAccelerationMps2 })) };
      const result = simulateLiveFieldPlayV1(input);
      expect(result.end.complete).toBe(true);
      return { result, plans: verifyActualRoute(input, result, 'batter') };
    };
    const tight = run(1, 2), wide = run(4, 2), strong = run(4, 8);
    const a = tight.plans.find(p => p.record.throughBases.length === 4)!;
    const b = wide.plans.find(p => p.record.throughBases.length === 4)!;
    const c = strong.plans.find(p => p.record.throughBases.length === 4)!;
    expect(a.record.route).not.toEqual(b.record.route);
    expect(a.record.lengthMeters).not.toBeCloseTo(b.record.lengthMeters, 5);
    expect(a.motion.sampleAtElapsedSeconds(a.motion.touches[0].centerElapsedSeconds).speedMps)
      .toBeLessThan(b.motion.sampleAtElapsedSeconds(b.motion.touches[0].centerElapsedSeconds).speedMps);
    expect(b.motion.sampleAtElapsedSeconds(b.motion.touches[0].centerElapsedSeconds).speedMps)
      .toBeLessThan(c.motion.sampleAtElapsedSeconds(c.motion.touches[0].centerElapsedSeconds).speedMps);
    expect(tight.result.ruleFacts.runnerTouches.map(t => t.base)).toEqual(wide.result.ruleFacts.runnerTouches.map(t => t.base));
    expect(wide.result.ruleFacts.runnerTouches.map(t => t.base)).toEqual(strong.result.ruleFacts.runnerTouches.map(t => t.base));
  });

  it('keeps all occupied-base runners physically separated during a home-run award', () => {
    const raw = homeRunFixture(), input: LiveFieldPlayInputV1 = { ...raw,
      runners: [raw.runners[0], ...([1, 2, 3] as const).map(initialBase => ({ ...raw.runners[0], runnerId: `runner-${initialBase}`, initialBase }))] };
    const result = simulateLiveFieldPlayV1(input);
    expect(result.end).toMatchObject({ complete: true, reason: 'home_run_completed' });
    for (const runner of input.runners) {
      expect(result.ruleFacts.runnerTouches.filter(t => t.runnerId === runner.runnerId).map(t => t.base))
        .toEqual(Array.from({ length: 4 - runner.initialBase }, (_, i) => runner.initialBase + i + 1));
      verifyActualRoute(input, result, runner.runnerId);
    }
    for (const frame of result.frames) {
      const active = frame.runners.filter(r => !r.retired && !r.scored);
      for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++)
        // The additional full-interval travel bound also excludes an overlap
        // hidden between these read-only frames at the authored top speeds.
        expect(distance(active[i].position, active[j].position)).toBeGreaterThan(.48 + 2 * 8 * input.frameSeconds!);
    }
  });
});
