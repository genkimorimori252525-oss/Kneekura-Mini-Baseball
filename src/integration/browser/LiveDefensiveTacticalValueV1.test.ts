import { expect, it } from 'vitest';
import { deriveLiveDefensiveTacticalValueV1 as derive, type LiveDefensiveTacticalContextV1,
  type LiveDefensiveTacticalPolicyV1 } from './LiveDefensiveTacticalValueV1';
// Explicit synthetic policy for contract tests; no production/MLB calibration.
const policy: LiveDefensiveTacticalPolicyV1 = { schemaVersion: 1, modelId: 'synthetic-proxy', version: 'test-1',
  maxSnapshotAgeTicks: 50, scoreScaleRuns: 2, progressScaleHalfInnings: 8, horizonScaleOuts: 6,
  runnerWeights: [1, 2, 3], valueScale: 2,
  weights: { scoreCloseness: 1, elapsedProgress: 1, runnerPressure: 1, horizonUrgency: 1 } };
const context = (overrides: Partial<LiveDefensiveTacticalContextV1> = {}): LiveDefensiveTacticalContextV1 => ({
  schemaVersion: 1, phase: 'pre_play', scope: { matchId: 'match', playId: 'play-1' },
  snapshot: { sourceId: 'before-play', revision: 3, tick: 100 }, atTick: 110,
  score: { away: 2, home: 2 }, inning: 8, half: 'bottom', outs: 2,
  occupiedBases: { first: true, second: false, third: true }, horizon: { kind: 'unknown' }, ...overrides,
});
it('leaves an absent legacy context NOT_CONNECTED without manufacturing local leverage', () => {
  expect(derive()).toMatchObject({ status: 'NOT_CONNECTED', source: null, model: null, localLeverage: null, tacticalValue: null });
});
it('requires an explicit versioned policy and labels the result a proxy', () => {
  expect(() => derive(context())).toThrow();
  const result = derive(context(), policy);
  expect(result.status).toBe('CONNECTED_PROXY'); expect(result.basis).toBe('UNCALIBRATED_PUBLIC_STATE_PROXY_V1');
  expect(result.model).toEqual({ modelId: policy.modelId, version: policy.version });
  expect(result.localLeverage).toBeGreaterThan(0); expect(result.localLeverage).toBeLessThanOrEqual(1);
  expect(result.tacticalValue).toBe(policy.valueScale * result.localLeverage!);
});
it('uses public score, elapsed inning/half, outs and occupied bases with one-variable contrasts', () => {
  const base = context(), ordinary = derive(base, policy).localLeverage!;
  expect(derive({ ...base, score: { away: 12, home: 2 } }, policy).localLeverage!).toBeLessThan(ordinary);
  expect(derive({ ...base, inning: 1 }, policy).localLeverage!).toBeLessThan(ordinary);
  expect(derive({ ...base, half: 'top' }, policy).localLeverage!).toBeLessThan(ordinary);
  expect(derive({ ...base, outs: 0 }, policy).localLeverage!).toBeLessThan(ordinary);
  expect(derive({ ...base, occupiedBases: { first: false, second: false, third: false } }, policy).localLeverage!).toBeLessThan(ordinary);
});
it('does not fabricate an extra-inning horizon or replace unknown with a final-inning assumption', () => {
  const base = context({ inning: 12 }), unknown = derive(base, policy),
    known = derive({ ...base, horizon: { kind: 'known', remainingOuts: 1 } }, policy);
  expect(unknown.components!.horizonUrgency).toBeNull();
  expect(known.components!.horizonUrgency).toBe(1);
  expect(unknown.source!.horizon).toEqual({ kind: 'unknown' });
  const distant = derive({ ...base, horizon: { kind: 'known', remainingOuts: 19 } }, policy);
  expect(distant.localLeverage!).toBeLessThan(known.localLeverage!);
});
it('does not read a post-play score before its fact or accept stale observations', () => {
  const base = context();
  expect(() => derive({ ...base, phase: 'post_play' } as never, policy)).toThrow();
  expect(() => derive({ ...base, snapshot: { ...base.snapshot, tick: 111 } }, policy)).toThrow();
  expect(() => derive({ ...base, atTick: 151 }, policy)).toThrow();
});
it('rejects competition importance, public-rating cohorts and unsupported state/model fields', () => {
  expect(() => derive({ ...context(), importance: 1 } as never, policy)).toThrow();
  expect(() => derive({ ...context(), publicRatingCohort: 'MLB' } as never, policy)).toThrow();
  expect(() => derive(context(), { ...policy, championshipMultiplier: 2 } as never)).toThrow();
  expect(() => derive({ ...context(), horizon: { kind: 'unknown', remainingOuts: 1 } } as never, policy)).toThrow();
});
it('rejects invalid scores, innings, outs, remaining horizon and unversioned calibration', () => {
  for (const bad of [{ inning: 0 }, { outs: 3 }, { score: { away: -1, home: 0 } }, { atTick: NaN },
    { horizon: { kind: 'known' as const, remainingOuts: 0 } }]) expect(() => derive(context(bad), policy)).toThrow();
  for (const bad of [{ version: '' }, { scoreScaleRuns: 0 }, { valueScale: Infinity }, { runnerWeights: [0, 0, 0] as const },
    { weights: { scoreCloseness: 0, elapsedProgress: 0, runnerPressure: 0, horizonUrgency: 1 } }])
    expect(() => derive(context(), { ...policy, ...bad })).toThrow();
});
it('preserves source input and returns a detached immutable read model', () => {
  const raw = context(), before = JSON.stringify(raw), result = derive(raw, policy);
  expect(JSON.stringify(raw)).toBe(before); expect(Object.isFrozen(raw.snapshot)).toBe(false);
  expect(Object.isFrozen(result.source!.snapshot)).toBe(true); expect(result.source).not.toBe(raw);
});
