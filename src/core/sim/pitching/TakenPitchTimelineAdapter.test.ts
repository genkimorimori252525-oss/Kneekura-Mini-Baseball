import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createCanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  resolveTakenPitchPhysicalResult,
} from './TakenPitchPhysicalResult';
import type {
  PitchTrajectorySegment,
} from './PitchTrajectory';
import {
  recordTakenPitchPhysicalResult,
} from './TakenPitchTimelineAdapter';

const match = (
  balls = 0,
  strikes = 0,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls,
  strikes,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 1,
});

const resultAt = (
  x: number,
  balls = 0,
) => {
  const trajectory: PitchTrajectorySegment = {
    start: {
      tick: 1_000_000,
      position: { x, y: 1, z: 10 },
      velocity: { x: 0, y: 0, z: -20 },
      spin: { x: 0, y: 0, z: 0 },
    },
    acceleration: { x: 0, y: 0, z: 0 },
    endTick: 1_600_000,
    ticksPerSecond: 1_000_000,
  };
  const physical = resolveTakenPitchPhysicalResult({
    trajectory,
    plateZ: 0,
    strikeZone: {
      centerX: 0,
      halfWidth: 0.2159,
      lowerY: 0.5,
      upperY: 1.5,
    },
    ballRadiusMeters: 0.0366,
  });
  if (physical === null) {
    throw new Error('fixture must cross the plate');
  }
  return {
    physical,
    timeline: createCanonicalPlateAppearanceTimeline(
      match(balls, 0),
      900_000,
    ),
  };
};

describe('TakenPitchTimelineAdapter', () => {
  it('records physical crossing evidence before the count adjudication on the same tick', () => {
    const { physical, timeline } = resultAt(0);
    const next = recordTakenPitchPhysicalResult(
      timeline,
      physical,
    );

    expect(next.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 1 },
    });
    expect(next.events).toHaveLength(2);
    expect(next.events[0]).toEqual({
      tick: physical.crossing.tick,
      sequence: 0,
      kind: 'TakenPitchPlateCrossed',
      payload: {
        result: physical,
      },
    });
    expect(next.events[1]).toMatchObject({
      tick: physical.crossing.tick,
      sequence: 1,
      kind: 'PitchAdjudicated',
      payload: {
        countBefore: { balls: 0, strikes: 0 },
        adjudication: { kind: 'called_strike' },
      },
    });
  });

  it('can physically produce the fourth ball and terminate the plate appearance as a walk', () => {
    const { physical, timeline } = resultAt(0.4, 3);
    expect(physical.kind).toBe('ball');

    const next = recordTakenPitchPhysicalResult(
      timeline,
      physical,
    );

    expect(next.status).toEqual({
      kind: 'walk',
      terminalCount: { balls: 4, strikes: 0 },
    });
  });

  it('rejects physical evidence older than the current plate-appearance ledger', () => {
    const { physical } = resultAt(0);
    const timeline = createCanonicalPlateAppearanceTimeline(
      match(),
      physical.crossing.tick + 1,
    );

    expect(() => recordTakenPitchPhysicalResult(
      timeline,
      physical,
    )).toThrow(
      'plate appearance event tick must not precede the previous event',
    );
  });

  it('is deterministic for identical physical crossing evidence', () => {
    const run = () => {
      const { physical, timeline } = resultAt(0);
      return recordTakenPitchPhysicalResult(
        timeline,
        physical,
      );
    };

    expect(run()).toEqual(run());
  });
});
