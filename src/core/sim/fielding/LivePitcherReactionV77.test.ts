import { expect, it } from 'vitest';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { LIVE_MATCH_PHYSICS_V1, LIVE_MATCH_BASES_V1 } from '../../../integration/browser/LiveBaseballMatchV1';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const fixture = (): LiveFieldPlayInputV1 => ({
  ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: v(4, .3, 9), velocity: v(-1, -1, 6), spin: v() } },
  physics: LIVE_MATCH_PHYSICS_V1,
  field: { bases: LIVE_MATCH_BASES_V1, fenceRadiusMeters: 110, fenceHeightMeters: 2 },
  fielders: [{ playerId: 'P', defensivePosition: 'P', position: v(0, 1, 18.44), reactionSeconds: .4,
    topSpeedMps: 7, accelerationMps2: 6, gloveSpeedMps: 6, gloveReachMeters: 1.3, gloveRadiusMeters: .1,
    transferSeconds: .25, throwSpeedMps: 32, catchRetention: { ticksPerSecond: 1e6, ballMassKg: .145,
      ballRadiusMeters: .0366, pocketRadiusMeters: .3, centerRetentionCapacityJ: 150, captureDissipationPowerW: 3000,
      failedContactRestitution: .2, failedTangentialDamping: .4, failedSpinDamping: .2 } }].flatMap(spec =>
    [v(0, 1, 18.44), v(0, 1, -2), v(20, 1, 20), v(12, 1, 35), v(-20, 1, 20), v(-12, 1, 35), v(-35, 1, 65), v(0, 1, 75), v(35, 1, 65)]
      .map((position, i) => ({ ...spec, playerId: ['P','C','1B','2B','3B','SS','LF','CF','RF'][i],
        defensivePosition: ['P','C','1B','2B','3B','SS','LF','CF','RF'][i] as 'P'|'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF', position }))),
  runners: [{ runnerId: 'batter', initialBase: 0, topSpeedMps: 5, accelerationMps2: 5, reactionSeconds: .1 }], outs: 0, maxPlaySeconds: 4
});

it('shortens only pitcher batted-ball recognition and changes real movement without increasing motor bounds', () => {
  const input = fixture(), before = structuredClone(input), old = simulateLiveFieldPlayV1(input),
    changed = simulateLiveFieldPlayV1({ ...input, fielders: input.fielders.map(f => ({ ...f, technicalSkills: { pitcher_field_reaction: 2 } })) });
  expect(changed.diagnostics.pitcherReactionTechnique).toEqual([{ playerId: 'P', baselineReactionSeconds: .4,
    effectiveReactionSeconds: .4 / 2.2, scope: 'INITIAL_BATTED_BALL_BEFORE_FIRST_THROW' }]);
  const at = changed.frames.find(f => f.elapsedSeconds > .25 && f.elapsedSeconds < .4)!;
  expect(Math.hypot(at.fielders[0].velocity.x, at.fielders[0].velocity.y, at.fielders[0].velocity.z)).toBeGreaterThan(0);
  expect(old.frames.find(f => f.elapsedSeconds === at.elapsedSeconds)!.fielders[0].velocity).toEqual(v());
  for (const frame of changed.frames) expect(Math.hypot(frame.fielders[0].velocity.x, frame.fielders[0].velocity.y, frame.fielders[0].velocity.z)).toBeLessThanOrEqual(7 + 1e-8);
  expect(input).toEqual(before);
});

it('leaves nonpitchers and zero controls exactly on the previous execution', () => {
  for (const defensivePosition of ['P', 'SS'] as const) {
    const input = { ...fixture(), fielders: fixture().fielders.map((f, i) => i === 0 ? { ...f, defensivePosition } : f) }, old = simulateLiveFieldPlayV1(input),
      changed = simulateLiveFieldPlayV1({ ...input, fielders: input.fielders.map(f => ({ ...f, technicalSkills: { pitcher_field_reaction: defensivePosition === 'P' ? 0 : 2 } })) });
    expect(changed).toEqual(old);
  }
});
