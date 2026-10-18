import { expect, it } from 'vitest';
import { predictLiveDefensiveOpportunityV1, type LiveDefensiveOpportunityInputV1 } from './LiveDefensiveOpportunityV1';
import { createLiveFieldForecastV1 } from './LiveFieldForecastV1';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const actors = () => [v(0, 1, 18), v(0, 1, -2), v(22, 1, 22), v(12, 1, 35), v(-22, 1, 22), v(-12, 1, 35),
  v(-35, 1, 70), v(0, 1, 80), v(35, 1, 70)].map(position => ({ position, velocity: v(), topSpeedMps: 7,
  accelerationMps2: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1 }));
const ballistic = (vertical = 25, forward = 45, lateral = 0): LiveDefensiveOpportunityInputV1 => {
  const ground = (vertical + Math.sqrt(vertical * vertical + 2 * 9.81)) / 9.81;
  return { availableAtTick: 200000, observationTick: 100000, ballRadiusMeters: .0366,
    home: v(), fenceCenter: v(0, 0, 37.5), fenceRadiusMeters: 72.5, fenceHeightMeters: 2,
    fielders: actors(), prediction: { maximumSeconds: 8, firstPredictedGroundSeconds: ground,
      maximumPositionSpeedMps: Math.hypot(forward, lateral, vertical + 1),
      sample: t => ({ position: v(lateral * t, 1 + vertical * t - 4.905 * t * t, forward * t),
        velocity: v(lateral, vertical - 9.81 * t, forward) }) } };
};

it('offers only a tactical cue after excluding every continuous reachable interval of a clearly deep fair fly', () => {
  const result = predictLiveDefensiveOpportunityV1(ballistic());
  expect(result).toMatchObject({ kind: 'none-decisive-over-fence', availableAtTick: 200000, observationTick: 100000,
    captureFeasibility: 'CONSERVATIVE_REACH_ENVELOPE_EXCLUDED', forecastBasis: 'EXPLICIT_SENSOR_PREDICTION_MODEL' });
  expect(result!.predictedCarryMeters).toBeGreaterThan(200);
  expect(result!.carryBeyondFenceMeters).toBeGreaterThan(100);
  expect(result!.fenceClearanceMeters).toBeGreaterThan(20);
  expect(Object.keys(result!)).not.toContain('homeRunConfirmed');
});

it('retains ordinary defense for marginal homers, low wall-clearing liners, short flies, foul flies and unknown high carries', () => {
  expect(predictLiveDefensiveOpportunityV1(ballistic(20, 30))).toBeNull();
  expect(predictLiveDefensiveOpportunityV1(ballistic(8, 100))).toBeNull();
  expect(predictLiveDefensiveOpportunityV1(ballistic(12, 20))).toBeNull();
  expect(predictLiveDefensiveOpportunityV1(ballistic(25, 30, 40))).toBeNull();
  expect(predictLiveDefensiveOpportunityV1(ballistic(50, 50))).toBeNull();
});

it('does not discard an early line-drive interception just because its later carry and fence clearance are large', () => {
  const original = ballistic(9.5, 100), source = { ...original,
    fielders: original.fielders.map((f, i) => i ? f : { ...f, position: v(0, 1, 30) }) }, prediction = source.prediction;
  // Move one defender near this trajectory at a non-grid instant. The same
  // carry and wall clearance cannot erase an earlier line-drive catch chance.
  const p = prediction.sample(.145678).position,
    result = predictLiveDefensiveOpportunityV1({ ...source,
      fielders: source.fielders.map((f, i) => i ? f : { ...f, position: v(0, 1, p.z) }) });
  expect(predictLiveDefensiveOpportunityV1(source)).not.toBeNull();
  expect(result).toBeNull();
});

it('retains superhuman NLB reach and speed without named player, league or IQ outcome shortcuts', () => {
  const source = ballistic();
  expect(predictLiveDefensiveOpportunityV1({ ...source,
    fielders: source.fielders.map((f, i) => i ? f : { ...f, gloveReachMeters: 30 }) })).toBeNull();
  expect(predictLiveDefensiveOpportunityV1({ ...source,
    fielders: source.fielders.map((f, i) => i !== 7 ? f : { ...f, topSpeedMps: 100, accelerationMps2: 500, gloveReachMeters: 40 }) })).toBeNull();
  expect(predictLiveDefensiveOpportunityV1({ ...source, fielders: source.fielders.slice(1) })).toBeNull();
});

it('has no future-result input and revokes when the current observation-rooted prediction becomes catchable', () => {
  const source = ballistic(), poisoned = { ...source,
    get ruleFacts(): never { throw new Error('future rule facts must not be read'); },
    get futureFrames(): never { throw new Error('future frames must not be read'); } };
  expect(predictLiveDefensiveOpportunityV1(poisoned)).toEqual(predictLiveDefensiveOpportunityV1(source));
  expect(predictLiveDefensiveOpportunityV1({ ...source, prediction: ballistic(10, 20).prediction })).toBeNull();
});

function fixture(): LiveFieldPlayInputV1 {
  const tps = 1e6;
  return { ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, 1, 0), velocity: v(0, 32, 58), spin: v() } },
    physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: tps, integrationStepTicks: 4000, gravityY: -9.81,
      aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: tps, gravityMps2: 9.81,
      radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
        slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
    field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
      fenceRadiusMeters: 110, fenceHeightMeters: 2 },
    fielders: actors().map((f, i) => ({ ...f, playerId: 'fielder-' + i, reactionSeconds: .08,
      gloveSpeedMps: 6, transferSeconds: .25, throwSpeedMps: 32, catchRetention: { ticksPerSecond: tps, ballMassKg: .145,
        ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
        failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } })),
    runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
    outs: 0, maxPlaySeconds: 30, frameSeconds: .04 };
}

it('confirms from distinct observations, brakes all nine bodies continuously, and rules only at the actual fence crossing', () => {
  const input = fixture(), result = simulateLiveFieldPlayV1({ ...input,
    fielders: input.fielders.map((f, i) => ({ ...f, velocity: i === 7 ? v(2, 0, 0) : v() })) });
  const cue = result.frames.find(f => f.defensiveOpportunity)!, confirmation = cue?.defensiveOpportunity;
  expect(confirmation).toBeDefined();
  expect(confirmation!.predictedCarryMeters).toBeGreaterThan(150);
  expect(confirmation!.availableAtTick).toBeGreaterThanOrEqual(120000);
  expect(confirmation!.observationTick).toBeLessThanOrEqual(confirmation!.availableAtTick);
  expect(result.ruleFacts.overFence).toMatchObject({ fair: true, untouchedGround: true });
  expect(confirmation!.availableAtTick).toBeLessThan(result.ruleFacts.overFence!.tick);
  expect(result.facts.filter(f => f.kind === 'over_fence')).toHaveLength(1);
  const during = result.frames.filter(f => f.defensiveOpportunity && f.tick < result.ruleFacts.overFence!.tick);
  expect(during.every(f => f.fielders.every(d => d.intent === 'hold' && d.targetBase === null))).toBe(true);
  const first = during[0].fielders[7];
  expect(Math.hypot(first.velocity.x, first.velocity.z)).toBeGreaterThan(0);
  const settled = during.find(f => f.elapsedSeconds > cue.elapsedSeconds + 2)!;
  expect(settled.fielders.every(f => Math.hypot(f.velocity.x, f.velocity.z) < 1e-9)).toBe(true);
  for (let i = 1; i < during.length; i++) for (let d = 0; d < 9; d++) {
    const a = during[i - 1], b = during[i], dt = b.elapsedSeconds - a.elapsedSeconds;
    expect(Math.hypot(b.fielders[d].velocity.x - a.fielders[d].velocity.x,
      b.fielders[d].velocity.z - a.fielders[d].velocity.z)).toBeLessThanOrEqual(input.fielders[d].accelerationMps2 * dt + 1e-8);
  }
  expect(result.end).toMatchObject({ complete: true, reason: 'home_run_completed' });
});

it('keeps sensor prediction and defense independent of frame cadence, future scope, and generic IQ preference', () => {
  const input = fixture(), a = simulateLiveFieldPlayV1({ ...input, maxPlaySeconds: .4 }),
    b = simulateLiveFieldPlayV1({ ...input, maxPlaySeconds: .8, frameSeconds: .08 });
  expect(a.diagnostics.aiTelemetry.defensiveOpportunityTransitions).toEqual(
    b.diagnostics.aiTelemetry.defensiveOpportunityTransitions.filter(f => f.elapsedSeconds <= .4));
  const high = simulateLiveFieldPlayV1({ ...input, maxPlaySeconds: .4,
    fielders: input.fielders.map(f => ({ ...f, fieldingCognition: { decisionSeconds: 0, pursuitCostWeight: 4 } })) });
  expect(high.diagnostics.aiTelemetry.defensiveOpportunityTransitions).toEqual(a.diagnostics.aiTelemetry.defensiveOpportunityTransitions);
  const world = createLiveFieldForecastV1({ observation: input.ball.ball, physics: input.physics });
  expect(world.diagnostics.actualSourceRead).toBe(false);
});
