import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createCanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import {
  resolveSwingingPitchPhysicalResult,
  type BatterSwingWindow,
} from './SwingingPitchPhysicalResult';
import type { PitchTrajectorySegment } from './PitchTrajectory';
import {
  recordSwingingPitchPhysicalResult,
} from './SwingingPitchTimelineAdapter';

const match = (
  strikes = 0,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
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

const trajectory = (
  x = 0,
): PitchTrajectorySegment => ({
  start: {
    tick: 1_000_000,
    position: { x, y: 1, z: 0.2 },
    velocity: { x: 0, y: 0, z: -60 },
    spin: { x: 0, y: 0, z: 0 },
  },
  acceleration: { x: 0, y: 0, z: 0 },
  endTick: 1_005_000,
  ticksPerSecond: 1_000_000,
});

const swing = (
  xOffset = 0,
): BatterSwingWindow => ({
  startTick: 1_000_000,
  endTick: 1_005_000,
  ticksPerSecond: 1_000_000,
  stateAtStart: {
    pose: {
      grip: { x: -0.42 + xOffset, y: 1, z: 0 },
      tip: { x: 0.42 + xOffset, y: 1, z: 0 },
    },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  },
});

describe('SwingingPitchTimelineAdapter', () => {
  it('records physical bat-ball contact without inventing a strike result', () => {
    const physical = resolveSwingingPitchPhysicalResult({
      trajectory: trajectory(),
      swing: swing(),
    });
    expect(physical.kind).toBe('contact');

    const timeline = recordSwingingPitchPhysicalResult(
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      ),
      physical,
    );

    expect(timeline.status).toMatchObject({
      kind: 'batted_ball_pending',
      contactTick: 1_002_174,
    });
    expect(timeline.events).toHaveLength(1);
    expect(timeline.events[0].kind).toBe('BatBallContact');
  });

  it('records physical swinging-miss evidence before adding the strike on the same adjudication tick', () => {
    const physical = resolveSwingingPitchPhysicalResult({
      trajectory: trajectory(),
      swing: swing(1),
    });
    expect(physical).toEqual({
      kind: 'swinging_miss',
      adjudicationTick: 1_005_000,
    });

    const timeline = recordSwingingPitchPhysicalResult(
      createCanonicalPlateAppearanceTimeline(
        match(1),
        900_000,
      ),
      physical,
    );

    expect(timeline.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 2 },
    });
    expect(timeline.events).toEqual([
      {
        tick: 1_005_000,
        sequence: 0,
        kind: 'SwingCompletedWithoutContact',
        payload: {
          result: physical,
        },
      },
      {
        tick: 1_005_000,
        sequence: 1,
        kind: 'PitchAdjudicated',
        payload: {
          countBefore: { balls: 0, strikes: 1 },
          adjudication: {
            kind: 'swinging_strike',
          },
          result: {
            kind: 'continue',
            count: { balls: 0, strikes: 2 },
            cause: 'swinging_strike',
          },
        },
      },
    ]);
  });

  it('can physically produce strike three from a swinging miss', () => {
    const physical = resolveSwingingPitchPhysicalResult({
      trajectory: trajectory(),
      swing: swing(1),
    });

    const timeline = recordSwingingPitchPhysicalResult(
      createCanonicalPlateAppearanceTimeline(
        match(2),
        900_000,
      ),
      physical,
    );

    expect(timeline.status).toEqual({
      kind: 'strikeout',
      terminalCount: {
        balls: 0,
        strikes: 3,
      },
    });
  });

  it('rejects stale swinging evidence rather than reordering the ledger', () => {
    const physical = resolveSwingingPitchPhysicalResult({
      trajectory: trajectory(),
      swing: swing(1),
    });

    expect(() => recordSwingingPitchPhysicalResult(
      createCanonicalPlateAppearanceTimeline(
        match(),
        1_005_001,
      ),
      physical,
    )).toThrow(
      'plate appearance event tick must not precede the previous event',
    );
  });
});
