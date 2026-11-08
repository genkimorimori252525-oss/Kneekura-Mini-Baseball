import { describe, expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { LIVE_RUNNER_TURN_POLICY_V1, validateLiveRunnerTurnPolicyV1 } from './LiveFieldRangeV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createLiveRunnerMotionV1 } from '../running/LiveRunnerMotionV1';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const runnerId = 'second-runner';
/** The rounding test's fly to center that falls in, with a runner on second. */
function fixture(throwSpeedMps = 4): LiveFieldPlayInputV1 {
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
      transferSeconds: .25, throwSpeedMps, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 },
      { runnerId, initialBase: 2, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 0, maxPlaySeconds: 30, frameSeconds: .02,
  };
}
const turned = (input: LiveFieldPlayInputV1): LiveFieldPlayInputV1 => ({ ...input, runnerTurnPolicyV1: LIVE_RUNNER_TURN_POLICY_V1 });
const base = (input: LiveFieldPlayInputV1, n: number) => input.field.bases[(['home', 'first', 'second', 'third', 'home'] as const)[n]];
type Result = ReturnType<typeof simulateLiveFieldPlayV1>;
/** Every recorded plan rebuilds from its own start state and joins the one before it without a jump. */
function plansOf(input: LiveFieldPlayInputV1, result: Result) {
  const runner = input.runners.find(r => r.runnerId === runnerId)!;
  const plans = result.diagnostics.aiTelemetry.runnerMotions.filter(p => p.runnerId === runnerId).map(record => {
    const motion = createLiveRunnerMotionV1({ position: record.position, velocity: record.velocity,
      bases: record.throughBases.map(n => ({ base: n, position: base(input, n) })), topSpeedMps: runner.topSpeedMps,
      accelerationMps2: runner.accelerationMps2, baseTouchRadiusMeters: input.field.baseTouchRadiusMeters });
    expect(motion).not.toBeNull();
    expect(motion!.route).toEqual(record.route);
    return { record, motion: motion! };
  });
  for (let i = 1; i < plans.length; i++) {
    const before = plans[i - 1].motion.sampleAtElapsedSeconds(plans[i].record.elapsedSeconds - plans[i - 1].record.elapsedSeconds);
    expect(distance(before.position, plans[i].record.position)).toBeLessThan(1e-8);
    expect(distance(before.velocity, plans[i].record.velocity)).toBeLessThan(1e-8);
  }
  return plans;
}
describe('runner turn V1', () => {
  it('accepts only the exact policy', () => {
    expect(validateLiveRunnerTurnPolicyV1(LIVE_RUNNER_TURN_POLICY_V1)).toBe(LIVE_RUNNER_TURN_POLICY_V1);
    expect(() => validateLiveRunnerTurnPolicyV1({ ...LIVE_RUNNER_TURN_POLICY_V1, extra: 1 } as never)).toThrow();
    expect(() => validateLiveRunnerTurnPolicyV1({ version: 'live_runner_turn_policy_v0', sourceId: 'x' } as never)).toThrow();
    expect(() => simulateLiveFieldPlayV1({ ...fixture(), runnerTurnPolicyV1: { version: 'x' } as never })).toThrow();
  });

  it('keeps a play whose extra base was already planned before the ball left the infield', () => {
    const a = simulateLiveFieldPlayV1(fixture()), b = simulateLiveFieldPlayV1(turned(fixture()));
    expect(b.diagnostics.aiTelemetry.runnerMotions).toEqual(a.diagnostics.aiTelemetry.runnerMotions);
    expect(b.ruleFacts).toEqual(a.ruleFacts);
  });

  it('bends toward home at speed once the grounder is through, then pulls up onto third at rest when home is unsafe', () => {
    const raw = fixture(30), input = turned({ ...raw,
      fielders: raw.fielders.map((f, i) => ({ ...f, topSpeedMps: 8, position: i >= 6 ? v(f.position.x, 1, 70) : f.position })),
      ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, .8, 0), velocity: v(5, -3, 33), spin: v() } } });
    const result = simulateLiveFieldPlayV1(input);
    expect(result.end.complete).toBe(true);
    const plans = plansOf(input, result), turn = plans.findIndex(p => p.record.throughBases.join(',') === '3,4');
    expect(turn).toBeGreaterThan(0);
    const pullUp = plans[turn + 1];
    expect(pullUp.record.throughBases).toEqual([3]);
    // He was running, not standing, when he pulled up, and the brake still lands him on the bag.
    expect(Math.hypot(pullUp.record.velocity.x, pullUp.record.velocity.z)).toBeGreaterThan(5);
    const third = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === runnerId && f.base === 3)!;
    expect(third.elapsedSeconds).toBeGreaterThan(pullUp.record.elapsedSeconds);
    const rest = pullUp.motion.sampleAtElapsedSeconds(pullUp.motion.durationSeconds);
    expect(rest.speedMps).toBe(0);
    expect(distance(rest.position, input.field.bases.third)).toBeLessThan(1e-9);
    // The turn plan never touched third: the only third-base touch is the pull-up's.
    expect(result.facts.filter(f => f.kind === 'runner_base_touch' && f.runnerId === runnerId && f.base === 3)).toHaveLength(1);
    expect(result.finalRunners.find(r => r.runnerId === runnerId)!.retired).toBe(false);
  });

  it('changes nothing while the ball is still in the infield', () => {
    const raw = fixture(), slow = { ...raw, ball: { ...raw.ball, ball: { ...raw.ball.ball, velocity: v(0, -2, 12), spin: v() } } };
    const a = simulateLiveFieldPlayV1(slow), b = simulateLiveFieldPlayV1(turned(slow));
    expect(b.diagnostics.aiTelemetry.runnerMotions).toEqual(a.diagnostics.aiTelemetry.runnerMotions);
    expect(b.ruleFacts).toEqual(a.ruleFacts);
  });
});
