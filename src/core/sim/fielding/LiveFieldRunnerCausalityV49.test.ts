import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { quantizeEventTick } from '../ExactEventTime';
import { reducePlayableMatchV1 } from '../../../integration/browser/PlayableMatchRulesV1';
import { asRuleProfileId } from '../../model/RuleProfileRef';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const liveFieldFixture = (): LiveFieldPlayInputV1 => {
  const tps = 1e6, originTick = 100000, elapsedSeconds = .123456789;
  return { ball: { originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, tps),
    position: v(0, 2, 8), velocity: v(0, 1, 5), spin: v() } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: [v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
      v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, i) => ({ playerId: `fielder-${i}`, position,
      reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
      transferSeconds: .25, throwSpeedMps: 32, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 2, maxPlaySeconds: 30 };
};

/** A slow authored transfer creates a real close play: the runner enters the
 * same bag contact disk used by the defense before the throw is controlled. */
it('satisfies first-base force on the same physical bag-contact geometry as the defense', () => {
  const raw = liveFieldFixture(), input = { ...raw, outs: 0,
    fielders: raw.fielders.map(f => ({ ...f, transferSeconds: 2 })),
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, .2, 0), velocity: v(1, -1, 5) } } },
    result = simulateLiveFieldPlayV1(input), radius = input.field.baseTouchRadiusMeters ?? .28,
    touch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === 'batter' && f.base === 1);
  expect(result.end.complete).toBe(true);
  expect(result.finalRunners[0].retired).toBe(false);
  expect(touch).toBeDefined();
  const gap = Math.hypot(touch!.position!.x - input.field.bases.first.x, touch!.position!.z - input.field.bases.first.z);
  expect(gap).toBeLessThanOrEqual(radius + 1e-8);
  expect(gap).toBeGreaterThan(radius - 1e-8);
  // Foot contact satisfies the rule; the motor still physically brakes to the
  // center rather than freezing at the first overlap witness.
  expect(result.finalRunners[0].position).toEqual(input.field.bases.first);
  expect(result.frames.some(frame => frame.tick > touch!.tick && frame.runners[0].currentBase === 1
    && Math.hypot(frame.runners[0].velocity.x, frame.runners[0].velocity.z) > 0)).toBe(true);
  expect(result.end.tick).toBeGreaterThan(touch!.tick);
  const baseControl = result.facts.find(f => f.kind === 'controlled_base_contact' && f.base === 1);
  if (baseControl) expect(touch!.tick).toBeLessThan(baseControl.tick);
});

it('still retires a runner when actual controlled first-base contact wins the physical race', () => {
  const raw = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...raw, outs: 0,
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, .2, 0), velocity: v(1, -1, 5) } } });
  expect(result.end.complete).toBe(true);
  expect(result.finalRunners[0].retired).toBe(true);
  expect(result.ruleFacts.controlledBaseContacts.some(c => c.base === 1)).toBe(true);
  expect(result.ruleFacts.runnerTouches.some(t => t.runnerId === 'batter' && t.base === 1)).toBe(false);
  const last = result.finalRunners[0].position;
  expect(Math.hypot(last.x - raw.field.bases.first.x, last.z - raw.field.bases.first.z)).toBeGreaterThan(.28);
});

it('keeps physical runner retirements equal to rule-interpreted outs in both race orders', () => {
  for (const transferSeconds of [.25, 2]) {
    const raw = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...raw, outs: 0,
      fielders: raw.fielders.map(f => ({ ...f, transferSeconds })),
      ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(0, .2, 0), velocity: v(1, -1, 5) } } }),
      rules = reducePlayableMatchV1({ match: { ruleProfileId: asRuleProfileId('offline-causality'), inning: 1, half: 'top',
        outs: 0, balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 0 },
        batterRunnerId: 'batter', event: { kind: 'field_play', facts: result.ruleFacts } });
    expect(rules.kind).toBe('applied');
    if (rules.kind !== 'applied') throw new Error(rules.reason);
    expect(result.finalRunners.filter(r => r.retired).map(r => r.runnerId).sort()).toEqual(rules.outcomes.map(o => o.runnerId).sort());
    if (transferSeconds === 2) expect(rules.match).toMatchObject({ outs: 0, bases: { first: 'batter' } });
    else expect(rules.outcomes.map(o => [o.runnerId, o.cause])).toEqual([['batter', 'base_control']]);
  }
});

it('reconsiders a newly vacated advance reservation after a live retirement before closing the play', () => {
  const raw = liveFieldFixture(), result = simulateLiveFieldPlayV1({ ...raw, outs: 0, maxPlaySeconds: 20,
    ball: { ...raw.ball, ball: { ...raw.ball.ball, position: v(-9.7, .2, 29.08), velocity: v(0, -1, .01) } },
    fielders: raw.fielders.map((f, i) => ({ ...f, topSpeedMps: 2, accelerationMps2: 1, throwSpeedMps: .5,
      position: i === 5 ? v(-9.7, 1, 29.08) : f.position })),
    runners: [raw.runners[0], { ...raw.runners[0], runnerId: 'r1', initialBase: 1 },
      { ...raw.runners[0], runnerId: 'r2', initialBase: 2, topSpeedMps: .6 }],
  }), control = result.facts.find(f => f.kind === 'controlled_base_contact' && f.base === 3)!;
  expect(result.end).toMatchObject({ complete: true, reason: 'live_action_complete' });
  expect(control).toBeDefined();
  expect(result.finalRunners.find(r => r.runnerId === 'r2')!.retired).toBe(true);
  const decisions = result.diagnostics.aiTelemetry.runnerDecisions.filter(d => d.runnerId === 'r1' && d.targetBase === 3);
  expect(decisions.some(d => d.elapsedSeconds < control.elapsedSeconds && d.reason === 'target_occupied')).toBe(true);
  // The runner need not advance into a defended bag. The requirement is that
  // its old occupancy decision cannot settle the new post-retirement world.
  expect(decisions.some(d => d.elapsedSeconds >= control.elapsedSeconds && d.reason !== 'target_occupied')).toBe(true);
  expect(result.end.elapsedSeconds).toBeGreaterThan(control.elapsedSeconds);
  expect(result.diagnostics.playClosure).toMatchObject({ runnerDecisionPending: false, activeRunnerIds: [], pendingCatchBy: null });
  expect(result.diagnostics.playClosure.lastRunnerEvaluationSeconds).toBeGreaterThanOrEqual(control.elapsedSeconds);
  expect(result.diagnostics.playClosure.possessedBy).not.toBeNull();
});

it('keeps the recorded normal-game runner protected when V84 movement makes a further advance unsafe', () => {
  const input = JSON.parse(readFileSync(new URL('./__fixtures__/live-runner-base-exit-tag-v49.json', import.meta.url), 'utf8')) as LiveFieldPlayInputV1,
    result = simulateLiveFieldPlayV1(input), runnerId = '1-b0',
    touch = result.ruleFacts.runnerTouches.find(f => f.runnerId === runnerId && f.base === 3)!;
  expect(result.end.complete).toBe(true);
  // This recorded V49 input produced a through-base tag with the old motor.
  // V84 changes observed departure timing and the race forecast: the runner
  // now holds third. A historical outcome cannot invent a departure or tag.
  expect(touch).toBeDefined();
  expect(result.finalRunners.find(r => r.runnerId === runnerId)).toMatchObject({ base: 3, retired: false, scored: false });
  expect(result.diagnostics.aiTelemetry.runnerDecisions.some(d => d.runnerId === runnerId && d.targetBase === 4
    && d.reason === 'insufficient_safety_margin')).toBe(true);
  expect(result.ruleFacts.runnerDepartures.filter(f => f.runnerId === runnerId && f.base === 3)).toEqual([]);
  expect(result.ruleFacts.controlledRunnerTags.filter(f => f.runnerId === runnerId)).toEqual([]);
});

it('retains actual through-base departure and rule causality with a weaker authored throwing arm', () => {
  const raw = JSON.parse(readFileSync(new URL('./__fixtures__/live-runner-base-exit-tag-v49.json', import.meta.url), 'utf8')) as LiveFieldPlayInputV1,
    // A weaker arm creates a real safe race under the new movement profile;
    // only the input ability changes, never the resulting route or rule facts.
    input = { ...raw, fielders: raw.fielders.map(f => ({ ...f, throwSpeedMps: .6 * f.throwSpeedMps })) },
    result = simulateLiveFieldPlayV1(input), runnerId = '1-b0',
    departure = result.ruleFacts.runnerDepartures.find(f => f.runnerId === runnerId && f.base === 3)!,
    touch = result.ruleFacts.runnerTouches.find(f => f.runnerId === runnerId && f.base === 3)!;
  expect(result.end.complete).toBe(true);
  expect(result.diagnostics.aiTelemetry.runnerMotions.some(m => m.runnerId === runnerId && m.throughBases.join(',') === '3,4')).toBe(true);
  expect(touch.tick).toBeLessThan(departure.tick);
  const actualDeparture = result.facts.find(f => f.kind === 'runner_base_departure' && f.runnerId === runnerId && f.base === 3)!,
    actualTouch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === runnerId && f.base === 3)!;
  expect(actualDeparture.tick).toBe(departure.tick);
  expect(actualTouch.elapsedSeconds).toBeLessThan(actualDeparture.elapsedSeconds);
  expect(result.facts.indexOf(actualTouch)).toBeLessThan(result.facts.indexOf(actualDeparture));
  expect(result.finalRunners.find(r => r.runnerId === runnerId)).toMatchObject({ scored: true, retired: false });
  const batter = input.runners.find(r => r.initialBase === 0)!, at = (n: number) => input.runners.find(r => r.initialBase === n)?.runnerId ?? null,
    rules = reducePlayableMatchV1({ match: { ruleProfileId: asRuleProfileId('offline-causal-exit'), inning: 1, half: 'top',
      outs: input.outs, balls: 0, strikes: 0, bases: { first: at(1), second: at(2), third: at(3) }, score: { away: 0, home: 0 }, playId: 0 },
      batterRunnerId: batter.runnerId, event: { kind: 'field_play', facts: result.ruleFacts } });
  expect(rules.kind).toBe('applied');
  if (rules.kind !== 'applied') throw new Error(rules.reason);
  expect(result.finalRunners.filter(r => r.retired).map(r => r.runnerId).sort()).toEqual(rules.outcomes.map(o => o.runnerId).sort());
});
