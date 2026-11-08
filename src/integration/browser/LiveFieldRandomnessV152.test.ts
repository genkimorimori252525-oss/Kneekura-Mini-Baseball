import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { resolveLiveAthleticProfileV115 } from '../../core/sim/LiveAthleticControlsV115';
import { AUTHORED_PLAY_RANDOMNESS_V152, type LiveRandomnessV152 } from '../../core/rng/LiveRandomStreamsV152';
import { LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { buildLiveFieldPlayInputV95, type LiveFieldInputRequestV95 } from './LiveFieldInputV95';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
/** Actual Source/actors with nonzero transfer and angular execution errors. */
const fixture = ():LiveFieldPlayInputV1 => ({
  ball:{ originTick:0, elapsedSeconds:0, ball:{ tick:0, position:v(0, .2, 0), velocity:v(0, -1, 8), spin:v() } },
  physics:{ kind:'aero_ground_v1', air:{ ticksPerSecond:1e6, integrationStepTicks:4000, gravityY:-9.81,
    aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground:{ ticksPerSecond:1e6, gravityMps2:9.81,
    radiusM:.0366, inertiaRatio:.378, restingVerticalSpeedMps:.15,
    material:{ restitution:.4, slidingFriction:.25, rollingDecelerationMps2:1, normalSpinDecayPerSecond:.5 } } },
  field:{ bases:{ home:v(), first:v(19.39, 0, 19.39), second:v(0, 0, 38.78), third:v(-19.39, 0, 19.39) },
    fenceRadiusMeters:110, fenceHeightMeters:2 },
  fielders:[v(0, 1, 10), v(0, 1, -2), v(20, 1, 20), v(-20, 1, 20), v(12, 1, 35), v(-12, 1, 35),
    v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)].map((position, index) => ({ playerId:'defender-' + index, position,
    reactionSeconds:.08, topSpeedMps:7, accelerationMps2:6, gloveSpeedMps:6, gloveReachMeters:1.3, gloveRadiusMeters:.1,
    transferSeconds:.25, transferDelayMaxSecondsV101:.15, throwSpeedMps:32, throwDirectionStdRadians:.04,
    catchRetention:{ ticksPerSecond:1e6, ballMassKg:.145, ballRadiusMeters:.0366, pocketRadiusMeters:.3,
      centerRetentionCapacityJ:150, captureDissipationPowerW:3000, failedContactRestitution:.2,
      failedTangentialDamping:.4, failedSpinDamping:.2 } })),
  runners:[{ runnerId:'batter', initialBase:0, topSpeedMps:8, accelerationMps2:5, reactionSeconds:.1 }],
  outs:0, maxPlaySeconds:8, seed:41,
});
const policy = (overrides?:LiveRandomnessV152['overrides']):LiveRandomnessV152 => ({ ...AUTHORED_PLAY_RANDOMNESS_V152,
  ...(overrides === undefined ? {} : { overrides }) });
const run = (overrides?:LiveRandomnessV152['overrides']) => simulateLiveFieldPlayV1({ ...fixture(), randomnessV152:policy(overrides) });
type Result = ReturnType<typeof simulateLiveFieldPlayV1>;
const seeds = (result:Result, domain:'fielding'|'baserunning') => result.diagnostics.randomnessV152!.streams
  .filter(stream => stream.domain === domain).map(stream => [stream.key, stream.seed] as const);
/** Preserve every numeric distinction, including signed zero and non-finite values. */
function exactDigest(value:unknown):string {
  const hash = createHash('sha256');
  function visit(item:unknown):void {
    if (item === null || typeof item !== 'object') {
      if (['function', 'symbol', 'bigint'].includes(typeof item)) throw Error('non-record test value');
      hash.update(JSON.stringify([typeof item, typeof item === 'number' ? Object.is(item, -0) ? '-0' : String(item) : item]));return;
    }
    hash.update(Array.isArray(item) ? '[' : '{');
    for (const [key, child] of Object.entries(item)) { hash.update(JSON.stringify(key));visit(child); }
    hash.update(Array.isArray(item) ? ']' : '}');
  }
  visit(value);return hash.digest('hex');
}

it('retains the exact whole legacy fixture and omits the new diagnostic when the policy is omitted', () => {
  const source = fixture(), before = JSON.stringify(source), legacy = simulateLiveFieldPlayV1(source);
  expect(exactDigest(legacy)).toBe('8fe07aa81a027740993c72a1dea71b23ea9d37c236b93e5379ad0b8f7f3d5fc0');
  expect(Object.hasOwn(legacy.diagnostics, 'randomnessV152')).toBe(false);
  expect(JSON.stringify(source)).toBe(before);
});

it('reproduces the full actual Source record with an explicit PLAY policy', () => {
  const source = { ...fixture(), randomnessV152:policy() }, before = JSON.stringify(source), first = simulateLiveFieldPlayV1(source);
  expect(simulateLiveFieldPlayV1(source)).toEqual(first);
  expect(first.diagnostics.randomnessV152).toMatchObject({ seedScope:'PLAY', baseSeed:source.seed });
  expect(seeds(first, 'fielding').length).toBeGreaterThan(0); expect(seeds(first, 'baserunning').length).toBeGreaterThan(0);
  expect(first.diagnostics.throwDirectionCommands.length).toBeGreaterThan(0);
  expect(first.diagnostics.transferTimingsV101!.some(row => row.delaySeconds > 0)).toBe(true);
  expect(JSON.stringify(source)).toBe(before);
});

it('changes real defensive motor draws while keeping every allocated runner root independent', () => {
  const first = run(), changed = run({ fielding:123456 });
  expect(seeds(changed, 'baserunning')).toEqual(seeds(first, 'baserunning'));
  const common = seeds(first, 'fielding').filter(([key]) => seeds(changed, 'fielding').some(([other]) => other === key));
  expect(common.length).toBeGreaterThan(0);
  expect(common.every(([key, seed]) => seeds(changed, 'fielding').find(([other]) => other === key)![1] !== seed)).toBe(true);
  expect(first.diagnostics.transferTimingsV101![0].delaySeconds).not.toBe(changed.diagnostics.transferTimingsV101![0].delaySeconds);
  expect(first.diagnostics.throwDirectionCommands[0].actual.velocity).not.toEqual(changed.diagnostics.throwDirectionCommands[0].actual.velocity);
  const releasedAfter = Math.max(first.facts.find(fact => fact.kind === 'throw_release')!.elapsedSeconds,
    changed.facts.find(fact => fact.kind === 'throw_release')!.elapsedSeconds),
    otherFrames = new Map(changed.frames.map(frame => [frame.tick, frame])),
    frame = first.frames.find(frame => frame.elapsedSeconds > releasedAfter && !frame.ball.possessedBy
      && otherFrames.has(frame.tick) && !otherFrames.get(frame.tick)!.ball.possessedBy);
  expect(frame).toBeDefined();expect(frame!.ball.position).not.toEqual(otherFrames.get(frame!.tick)!.ball.position);
});

it('routes the actual stochastic slide choice through baserunning independently of fielding', () => {
  const original = fixture(), athleticProfileV115 = resolveLiveAthleticProfileV115({ heightMeters:1.8, accelerationMps2:6,
    reactionSeconds:.1, gloveSpeedMps:8, controls:{ runHeadSlidePreferenceV115:.5 } }),
    source:LiveFieldPlayInputV1 = { ...original, runners:[...original.runners,
      { runnerId:'lead', initialBase:1, topSpeedMps:9, accelerationMps2:6, reactionSeconds:.1, athleticProfileV115 }] },
    first = simulateLiveFieldPlayV1({ ...source, randomnessV152:policy({ baserunning:0 }) }),
    changed = simulateLiveFieldPlayV1({ ...source, randomnessV152:policy({ baserunning:1 }) }),
    slideSeeds = (result:Result) => seeds(result, 'baserunning').filter(([key]) => key.startsWith('slide:lead:2:')),
    styles = (result:Result) => [...new Set([...result.frames, ...(result.recoveryFramesV115 ?? [])]
      .flatMap(frame => frame.runners.filter(runner => runner.runnerId === 'lead' && runner.athleticV115)
        .map(runner => runner.athleticV115!.kind)))];
  expect(slideSeeds(first).length).toBeGreaterThan(0);expect(slideSeeds(changed)).not.toEqual(slideSeeds(first));
  expect(styles(first).length).toBeGreaterThan(0);expect(styles(changed)).not.toEqual(styles(first));
});

it('changes the runner read root without changing defensive random roots at the same opportunities', () => {
  const first = run(), changed = run({ baserunning:654321 }), common = seeds(first, 'fielding')
    .filter(([key]) => seeds(changed, 'fielding').some(([other]) => other === key));
  expect(common.length).toBeGreaterThan(0);
  expect(common.every(([key, seed]) => seeds(changed, 'fielding').find(([other]) => other === key)![1] === seed)).toBe(true);
  expect(seeds(changed, 'baserunning')).not.toEqual(seeds(first, 'baserunning'));
  expect(changed.diagnostics.throwDirectionCommands[0].actual.seed).toBe(first.diagnostics.throwDirectionCommands[0].actual.seed);
});

it('does not reroll the same throw ordinal merely because its physical release clock changes', () => {
  const source = fixture(), first = run(), shifted = simulateLiveFieldPlayV1({ ...source, randomnessV152:policy(),
    fielders:source.fielders.map(fielder => ({ ...fielder, transferSeconds:fielder.transferSeconds + .05 })) }),
    before = first.diagnostics.throwDirectionCommands[0], after = shifted.diagnostics.throwDirectionCommands[0];
  expect(before.elapsedSeconds).not.toBe(after.elapsedSeconds);
  expect(after.actual.seed).toBe(before.actual.seed);
  expect(after.actual.yawRadians).toBe(before.actual.yawRadians);expect(after.actual.pitchRadians).toBe(before.actual.pitchRadians);
});

it('rejects MATCH and malformed policies at the actual play boundary', () => {
  for (const randomnessV152 of [{ ...policy(), scope:'MATCH' }, { ...policy(), overrides:{ baserunning:-1 } }])
    expect(() => simulateLiveFieldPlayV1({ ...fixture(), randomnessV152 } as LiveFieldPlayInputV1)).toThrow(/random|scope/i);
});

it('forwards a canonical PLAY policy through the V95 shared mapping and preserves the omission shape', () => {
  const source = fixture(), roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const,
    request:LiveFieldInputRequestV95 = { ball:source.ball, physics:source.physics, field:source.field, seed:source.seed,
      outs:source.outs, maxPlaySeconds:source.maxPlaySeconds, defense:Object.fromEntries(roles.map((role, index) => [role, source.fielders[index].playerId])) as LiveFieldInputRequestV95['defense'],
      placements:Object.fromEntries(roles.map((role, index) => [role, source.fielders[index].position])) as LiveFieldInputRequestV95['placements'],
      players:[...source.fielders.map(fielder => ({ playerId:fielder.playerId, physical:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } })),
        { playerId:'batter', physical:{ ...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } }], batterRunnerId:'batter', batterPosition:v(),
      occupiedBases:{ first:null, second:null, third:null }, baserunning:'balanced' },
    projected = buildLiveFieldPlayInputV95({ ...request, randomnessV152:policy({ fielding:87 }) });
  expect(projected.randomnessV152).toEqual(policy({ fielding:87 }));
  expect(Object.hasOwn(buildLiveFieldPlayInputV95(request), 'randomnessV152')).toBe(false);
  expect(() => buildLiveFieldPlayInputV95({ ...request, randomnessV152:{ ...policy(), scope:'MATCH' } })).toThrow(/random|scope/i);
});
