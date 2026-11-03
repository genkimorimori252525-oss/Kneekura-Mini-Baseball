import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import type { LiveFieldDefensivePositionV1 } from './LiveFieldRoleAssignmentV1';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const placements: readonly [LiveFieldDefensivePositionV1, ReturnType<typeof v>][] = [
  ['P', v(0, .9, 18.44)], ['C', v(0, .85, -1.5)], ['1B', v(23, .9, 25)], ['2B', v(13, .9, 36)],
  ['3B', v(-23, .9, 25)], ['SS', v(-13, .9, 36)], ['LF', v(-46, .9, 76)], ['CF', v(0, .9, 91)], ['RF', v(46, .9, 76)],
];
/** Explicit SI fixture with the normal Host position layout. This is a
 * responsibility/motion regression, not measured player calibration. */
const fixture = (): LiveFieldPlayInputV1 => ({
  ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(0, .2, 10), velocity: v(1, -1, 8), spin: v() } },
  physics: { kind: 'aero_ground_v1', air: { ticksPerSecond: 1e6, integrationStepTicks: 4000, gravityY: -9.81,
    aerodynamics: REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS }, ground: { ticksPerSecond: 1e6, gravityMps2: 9.81,
    radiusM: .0366, inertiaRatio: .378, restingVerticalSpeedMps: .15, material: { restitution: .4,
      slidingFriction: .25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: .5 } } },
  field: { bases: { home: v(), first: v(19.39, 0, 19.39), second: v(0, 0, 38.78), third: v(-19.39, 0, 19.39) },
    fenceRadiusMeters: 110, fenceHeightMeters: 2 },
  fielders: placements.map(([defensivePosition, position]) => ({ playerId: 'position-' + defensivePosition, defensivePosition, position,
    reactionSeconds: .08, topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3,
    gloveRadiusMeters: .1, transferSeconds: .25, throwSpeedMps: 32,
    catchRetention: { ticksPerSecond: 1e6, ballMassKg: .145, ballRadiusMeters: .0366, pocketRadiusMeters: .3,
      centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000, failedContactRestitution: .2,
      failedTangentialDamping: .4, failedSpinDamping: .2 } })),
  runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .1 }],
  outs: 0, maxPlaySeconds: 20,
});
const gap = (a: ReturnType<typeof v>, b: ReturnType<typeof v>) => Math.hypot(a.x - b.x, a.z - b.z);

it('keeps the normal first baseman covering an infield throw while the catcher retains home responsibility', () => {
  const input = fixture(), result = simulateLiveFieldPlayV1(input),
    release = result.facts.find(f => f.kind === 'throw_release' && f.base === 1);
  expect(result.end.complete).toBe(true);
  expect(release).toMatchObject({ receiverPlayerId: 'position-1B' });
  expect(result.ruleFacts.controlledBaseContacts.some(f => f.base === 1 && f.defenderId === 'position-1B')).toBe(true);
  const catcherHome = input.fielders.find(f => f.defensivePosition === 'C')!.position;
  for (const frame of result.frames) {
    const catcher = frame.fielders.find(f => f.playerId === 'position-C')!;
    expect(catcher.intent).toBe('hold');
    expect(gap(catcher.position, catcherHome)).toBeLessThan(1e-8);
  }
});

it('retains a catcher at home during a deep left-field catch and avoids a three-defender pileup at the catch point', () => {
  const input = fixture(), result = simulateLiveFieldPlayV1({ ...input,
    ball: { ...input.ball, ball: { ...input.ball.ball, position: v(0, 1, 0), velocity: v(-16, 18, 25) } } }),
    secured = result.facts.find(f => f.kind === 'catch_secured');
  expect(secured).toMatchObject({ playerId: 'position-LF' });
  const catcherHome = input.fielders.find(f => f.defensivePosition === 'C')!.position;
  for (const frame of result.frames) {
    const catcher = frame.fielders.find(f => f.playerId === 'position-C')!;
    expect(catcher.intent).toBe('hold');
    expect(gap(catcher.position, catcherHome)).toBeLessThan(1e-8);
  }
  const catchFrame = result.frames.find(f => f.elapsedSeconds >= secured!.elapsedSeconds)!;
  expect(catchFrame.fielders.filter(f => gap(f.position, secured!.position!) < 4).length).toBeLessThanOrEqual(2);
  // The deep intercept belongs to the reachable outfielder; the shortstop can
  // participate in cutoff/coverage rather than being forced to chase it.
  expect(result.diagnostics.aiTelemetry.roleTransitions.some(r => r.handlerId === 'position-LF')).toBe(true);
  if (process.env.FIELDING_RESPONSIBILITY_REPORT === '1') console.info(JSON.stringify({
    fixture: 'deep-left-with-explicit-positions', firstCatch: secured,
    handlers: result.diagnostics.aiTelemetry.roleTransitions.map(r => ({ elapsedSeconds: r.elapsedSeconds, handlerId: r.handlerId, source: r.source })),
    maximumShortstopZ: Math.max(...result.frames.map(f => f.fielders.find(a => a.playerId === 'position-SS')!.position.z)),
    maximumCatcherTravelMeters: Math.max(...result.frames.map(f => gap(f.fielders.find(a => a.playerId === 'position-C')!.position, catcherHome))),
    bodiesWithinFourMetersAtCatch: catchFrame.fielders.filter(f => gap(f.position, secured!.position!) < 4).map(f => f.playerId),
  }));
});
