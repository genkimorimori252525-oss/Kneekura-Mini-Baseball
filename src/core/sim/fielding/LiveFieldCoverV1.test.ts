import { describe, expect, it } from 'vitest';
import { LIVE_FIELD_COVER_CALIBRATION_V1, LIVE_FIELD_COVER_POLICY_V1, LIVE_FIELD_RUN_VALUE_CALIBRATION_V1, validateLiveFieldCoverPolicyV1 } from './LiveFieldRangeV1';
import { assignLiveFieldCoverV1 } from './LiveFieldRoleAssignmentV1';
import { liveRaceWinProbabilityV1 } from './LiveRunValueV1';

const B = { 1: { x: 19.4, y: 0, z: 19.4 }, 2: { x: 0, y: 0, z: 38.8 }, 3: { x: -19.4, y: 0, z: 19.4 }, 4: { x: 0, y: 0, z: 0 } } as const;
/** playerId, his chance at the ball with when and where he takes it, and his time to each bag. Exchange .7 s, arm 35 m/s. */
const c = (playerId: string, ballChance: number, take: readonly [number, number, number] | null, baseSeconds: Partial<Record<1 | 2 | 3 | 4, number>>) =>
  ({ playerId, ballChance, fieldSeconds: take ? take[0] : null, fieldPoint: take ? { x: take[1], y: 0, z: take[2] } : null,
    exchangeSeconds: .7, throwSpeedMps: 35, baseSeconds });
/** Runner on first, nobody out (NPB table): runner to second and batter to first. */
const T = LIVE_FIELD_RUN_VALUE_CALIBRATION_V1.table.values;
const runs = (outsAt: readonly number[]) => outsAt.includes(1) && outsAt.includes(2) ? T[2][0] : outsAt.includes(2) ? T[1][1] : outsAt.includes(1) ? T[1][2] : T[0][3];
const bags = [{ base: 2 as const, point: B[2], runnerSeconds: 4.4 }, { base: 1 as const, point: B[1], runnerSeconds: 4.3 }];
const plan = (holder: string | null, candidates: ReturnType<typeof c>[], b: typeof bags = bags) => assignLiveFieldCoverV1({ holder,
  spreadSeconds: LIVE_FIELD_COVER_CALIBRATION_V1.spreadSeconds, chancePool: LIVE_FIELD_COVER_CALIBRATION_V1.chancePool,
  coverChoices: LIVE_FIELD_COVER_CALIBRATION_V1.coverChoices, win: liveRaceWinProbabilityV1, runs, bags: b, candidates });
const coverOf = (p: ReturnType<typeof plan>, base: number) => p.cover.find(x => x.base === base)?.playerId ?? null;

describe('field cover V1', () => {
  it('accepts only the exact policy', () => {
    expect(validateLiveFieldCoverPolicyV1(LIVE_FIELD_COVER_POLICY_V1)).toBe(LIVE_FIELD_COVER_POLICY_V1);
    expect(() => validateLiveFieldCoverPolicyV1({ ...LIVE_FIELD_COVER_POLICY_V1, extra: 1 } as never)).toThrow();
    expect(() => validateLiveFieldCoverPolicyV1({ version: 'x', sourceId: 'y' } as never)).toThrow();
  });

  it('on a ball in the hole both men with a chance go, and the second baseman covers second though the shortstop started nearer', () => {
    const p = plan(null, [c('3B', .45, [1.0, -14, 30], { 2: 3.0, 1: 4.2 }), c('SS', .55, [1.3, -10, 42], { 2: 1.8, 1: 3.6 }),
      c('2B', 0, null, { 2: 1.9, 1: 2.4 }), c('1B', 0, null, { 2: 2.9, 1: 1.2 }), c('P', .05, [.6, -2, 22], { 2: 2.4, 1: 2.3 })]);
    expect(p.chasers).toEqual(expect.arrayContaining(['3B', 'SS']));
    expect(coverOf(p, 2)).toBe('2B');
    expect(coverOf(p, 1)).toBe('1B');
  });

  it('sends the pitcher to first on a ball to the right side: the first baseman is worth more at the ball', () => {
    const p = plan(null, [c('1B', .6, [1.2, 15, 28], { 1: 1.4, 2: 3.5 }), c('2B', .5, [1.3, 12, 33], { 1: 2.6, 2: 2.2 }),
      c('SS', 0, null, { 1: 3.8, 2: 1.6 }), c('P', 0, null, { 1: 2.1, 2: 2.6 }), c('C', 0, null, { 1: 3.4, 2: 4.6 })]);
    expect(p.chasers).toEqual(['1B', '2B']);
    expect(coverOf(p, 1)).toBe('P');
    expect(coverOf(p, 2)).toBe('SS');
  });

  it('keeps the pivot man on second when a slower cover would cost the double play', () => {
    const p = plan(null, [c('SS', .97, [1.0, -6, 40], { 2: 2.0, 1: 3.6 }), c('2B', .2, [1.4, 3, 41], { 2: 1.5, 1: 2.5 }),
      c('3B', 0, null, { 2: 3.7, 1: 4.4 }), c('1B', 0, null, { 2: 3.0, 1: 1.1 })]);
    expect(p.chasers).toEqual(['SS']);
    expect(coverOf(p, 2)).toBe('2B');
    expect(p.runsSaved).toBeGreaterThan(.97 * (runs([]) - runs([1, 2])) - .01);
  });

  it('keeps the pivot on second for the infielder when the outfielder behind him gets every ball that goes through', () => {
    const p = plan(null, [c('3B', .5, [1.0, -14, 30], { 2: 3.2, 1: 4.4 }), c('LF', 1, [3.0, -30, 60], { 2: 7, 1: 9 }),
      c('2B', 0, null, { 2: 1.9, 1: 2.4 }), c('SS', 0, null, { 2: 2.4, 1: 3.6 }), c('1B', 0, null, { 2: 2.9, 1: 1.2 }), c('P', 0, null, { 2: 3.0, 1: 2.3 })]);
    expect(p.chasers).toEqual(['3B', 'LF']);
    expect(coverOf(p, 2)).toBe('2B');
    expect(coverOf(p, 1)).toBe('1B');
  });

  it('follows ability: a third man quick enough to the bag frees the second baseman to stay after the ball', () => {
    const one = [{ base: 2 as const, point: B[2], runnerSeconds: 3.6 }];
    const slow = plan(null, [c('SS', .6, [1.2, -8, 42], { 2: 1.9 }), c('2B', .3, [1.4, 4, 44], { 2: 1.8 }), c('3B', 0, null, { 2: 3.9 })], one),
      quick = plan(null, [c('SS', .6, [1.2, -8, 42], { 2: 1.9 }), c('2B', .3, [1.4, 4, 44], { 2: 1.8 }), c('3B', 0, null, { 2: 2.2 })], one);
    expect(slow.chasers).toEqual(['SS']);
    expect(coverOf(slow, 2)).toBe('2B');
    expect(quick.chasers).toEqual(['2B', 'SS']);
    expect(coverOf(quick, 2)).toBe('3B');
  });

  it('frees an infielder the ball has gone past to cover', () => {
    const p = plan(null, [c('CF', .9, [2.6, 5, 75], { 2: 6 }), c('SS', 0, null, { 2: 1.5 }), c('2B', 0, null, { 2: 1.7 })], [bags[0]]);
    expect(p).toMatchObject({ chasers: ['CF'], cover: [{ base: 2, playerId: 'SS' }] });
  });

  it('with the ball held nobody chases, and the bag goes to the first man there other than the holder', () => {
    const p = plan('SS', [c('SS', 1, [0, -8, 40], { 2: .2 }), c('2B', 0, null, { 2: .9 }), c('3B', 0, null, { 2: 1.4 })], [bags[0]]);
    expect(p.chasers).toEqual([]);
    expect(p.ballChance).toBe(1);
    expect(coverOf(p, 2)).toBe('2B');
  });

  it('gives the same answer whatever order the fielders are listed in', () => {
    const list = [c('P', .1, [.7, 2, 20], { 1: 3, 2: 2.5 }), c('SS', .5, [1.2, -9, 41], { 1: 3.5, 2: 1.5 }),
      c('2B', .4, [1.3, 9, 42], { 1: 2.4, 2: 1.5 }), c('1B', .3, [1.0, 16, 26], { 1: 1, 2: 2.8 })];
    expect(plan(null, list)).toEqual(plan(null, list.slice().reverse()));
  });
});
