import { describe, expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from './RuleProfile';
import { deriveBallWorldVenueLegalCoverage, type BallWorldVenueLegalCoverageInput } from './BallWorldVenueLegalCoverage';

const input = (): BallWorldVenueLegalCoverageInput => ({
  policy: { version: 'closed_interior_venue_legal_regions_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id,
    rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision, regions: [
      { regionId: 'accepted-live-interior', classification: 'inside_playable_region', minimum: { x: -10, y: 0, z: -10 }, maximum: { x: 10, y: 10, z: 10 } },
      { regionId: 'accepted-dead-interior', classification: 'out_of_play', minimum: { x: 11, y: 0, z: -10 }, maximum: { x: 20, y: 10, z: 10 } },
    ] }, originTick: 0, ticksPerSecond: 1_000_000, ballRadiusMeters: 0.04,
  segments: [{ startElapsedSeconds: 0, endElapsedSeconds: 1,
    basis: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: { x: 0, y: 2, z: 0 }, velocity: { x: 1, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } },
    endpoint: { originTick: 0, elapsedSeconds: 1, ball: { tick: 1_000_000, position: { x: 1, y: 2, z: 0 }, velocity: { x: 1, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } },
    acceleration: { x: 0, y: 0, z: 0 } }],
});
describe('accepted venue interior coverage', () => {
  it('proves the complete real ball curve within a supplied live interior', () => {
    const value = deriveBallWorldVenueLegalCoverage(input());
    expect(value.kind).toBe('complete');
    expect(value.intervals[0].classification).toBe('inside_playable_region');
    expect(value.uncertainSpans).toEqual([]);
    expect(value.firstCertainOutOfPlay).toBeNull();
  });
  it('keeps a crossing unresolved but proves out-of-play by its actual endpoint', () => {
    const i = input(), s = i.segments[0];
    const value = deriveBallWorldVenueLegalCoverage({ ...i, segments: [{ ...s,
      basis: { ...s.basis, ball: { ...s.basis.ball, velocity: { x: 12, y: 0, z: 0 } } },
      endpoint: { ...s.endpoint, ball: { ...s.endpoint.ball, position: { x: 12, y: 2, z: 0 }, velocity: { x: 12, y: 0, z: 0 } } } }] });
    expect(value.kind).toBe('pending');
    expect(value.uncertainSpans).toEqual([{ segmentIndex: 0, startElapsedSeconds: 0, endElapsedSeconds: 1, reason: 'legal_region_coverage_unresolved' }]);
    expect(value.firstCertainOutOfPlay).toMatchObject({ elapsedSeconds: 1, tick: 1_000_000 });
  });
  it('does not turn identical inside endpoints into continuous in-play proof', () => {
    const i = input(), s = i.segments[0];
    const value = deriveBallWorldVenueLegalCoverage({ ...i, segments: [{ ...s,
      basis: { ...s.basis, ball: { ...s.basis.ball, velocity: { x: 48, y: 0, z: 0 } } },
      endpoint: { ...s.endpoint, ball: { ...s.endpoint.ball, position: { x: 0, y: 2, z: 0 }, velocity: { x: -48, y: 0, z: 0 } } },
      acceleration: { x: -96, y: 0, z: 0 } }] });
    expect(value.intervals[0].start.classification).toBe('inside_playable_region');
    expect(value.intervals[0].end.classification).toBe('inside_playable_region');
    expect(value.kind).toBe('pending');
  });
  it('keeps a full-ball face touch and unknown space pending without choosing a legal edge convention', () => {
    const i = input(), s = i.segments[0];
    const at = { ...s.basis, ball: { ...s.basis.ball, position: { x: 10, y: 2, z: 0 }, velocity: { x: 0, y: 0, z: 0 } } };
    const value = deriveBallWorldVenueLegalCoverage({ ...i, segments: [{ ...s, endElapsedSeconds: 0, basis: at, endpoint: at }] });
    expect(value.kind).toBe('pending');
    expect(value.firstCertainOutOfPlay).toBeNull();
  });
  it('rejects overlapping contradictory ground-rule regions and missing physical coverage', () => {
    const i = input();
    expect(() => deriveBallWorldVenueLegalCoverage({ ...i, policy: { ...i.policy, regions: [i.policy.regions[0],
      { ...i.policy.regions[0], regionId: 'contradiction', classification: 'out_of_play' }] } })).toThrow(/overlap/);
    expect(() => deriveBallWorldVenueLegalCoverage({ ...i, segments: [] })).toThrow(/coverage/);
  });
});
