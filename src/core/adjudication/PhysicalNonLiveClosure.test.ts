import { expect, it } from 'vitest';
import { asRuleProfileId } from '../model/RuleProfileRef';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { createCanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordPitchAgainstBatter } from '../sim/pitching/PitchAgainstBatter';
import { derivePhysicalNonLiveClosure } from './PhysicalNonLiveClosure';
import { getOfficialPlayClosure } from './PlayAdjudicationLedger';

const fixture = (walk = false, overrides: Partial<CanonicalMatchState> = {}) => {
  const match: CanonicalMatchState = { ruleProfileId: asRuleProfileId('physical-fixture'), inning: 1, half: 'top', outs: 2,
    balls: 0, strikes: 0, bases: { first: 'r1', second: 'r2', third: 'r3' }, score: { away: 0, home: 0 }, playId: 1, ...overrides };
  let timeline = createCanonicalPlateAppearanceTimeline(match, 0);
  for (let index = 0; index < (walk ? 4 : 3); index++) {
    const tick = timeline.lastEventTick + 1;
    timeline = resolveAndRecordPitchAgainstBatter(timeline, { action: { kind: 'take' }, trajectory: {
      start: { tick, position: { x: walk ? 1 : 0, y: 1.5, z: 18 }, velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
      acceleration: { x: 0, y: 0, z: 0 }, endTick: tick + 700_000, ticksPerSecond: 1_000_000 },
      plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 }).timeline;
  }
  return { match, timeline, batterRunnerId: walk ? 'actual-batter' : null, gameDay: 1,
    effortPolicy: { policyId: 'fixture', version: 'v1', availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 },
    snapshotId: 'rule', ruleTick: timeline.lastEventTick + 1, closureId: 'close', closureTick: timeline.lastEventTick + 2 };
};

it('derives the actual third-out ruling before the canonical half-inning reset', () => {
  const result = derivePhysicalNonLiveClosure(fixture());
  expect(getOfficialPlayClosure(result.adjudication)!.officialDelta.outsAfter).toBe(3);
  expect(result.nextMatch.half).toBe('bottom'); expect(result.nextMatch.outs).toBe(0);
  expect(result.scoring.classification).toBe('strikeout'); expect(result.effort.effortUnits).toBe(6);
});
it('derives loaded-base walk advancement and scoring from actual four physical balls', () => {
  const result = derivePhysicalNonLiveClosure(fixture(true));
  expect(result.context).toEqual({ kind: 'walk', batterRunnerId: 'actual-batter' });
  expect(result.nextMatch.bases).toEqual({ first: 'actual-batter', second: 'r1', third: 'r2' });
  expect(result.nextMatch.score.away).toBe(1); expect(result.scoring.runsScored).toBe(1);
  expect(result.scoring.hitsCredited).toBe(0); expect(result.effort.effortUnits).toBe(8);
});
it('rejects unexplained counts, modified physical terminal results and premature adjudication', () => {
  const input = fixture();
  expect(() => derivePhysicalNonLiveClosure({ ...input, match: { ...input.match, strikes: 1 } })).toThrow('count');
  const changed = structuredClone(input);
  const event = changed.timeline.events.find((e) => e.kind === 'PitchAdjudicated');
  if (event?.kind !== 'PitchAdjudicated') throw new Error('missing physical fixture event');
  (event.payload as { countBefore: { balls: number; strikes: number } }).countBefore.strikes = 1;
  expect(() => derivePhysicalNonLiveClosure(changed)).toThrow('count');
  expect(() => derivePhysicalNonLiveClosure({ ...input, ruleTick: input.timeline.lastEventTick - 1 })).toThrow();
  expect(() => derivePhysicalNonLiveClosure({ ...input, closureTick: input.ruleTick - 1 })).toThrow();
});
it('rejects a caller-provided outcome and a walk without a distinct actual batter', () => {
  const walk = fixture(true);
  expect(() => derivePhysicalNonLiveClosure({ ...walk, batterRunnerId: null })).toThrow();
  expect(() => derivePhysicalNonLiveClosure({ ...walk, batterRunnerId: 'r1' })).toThrow();
  expect(() => derivePhysicalNonLiveClosure({ ...fixture(), desiredResult: 'walk' } as Parameters<typeof derivePhysicalNonLiveClosure>[0])).toThrow();
});
