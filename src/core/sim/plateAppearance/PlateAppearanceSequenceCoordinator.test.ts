import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type {
  PitchAgainstBatterInput,
} from '../pitching/PitchAgainstBatter';
import {
  resolvePlateAppearancePitchSequenceToMatchState,
} from './PlateAppearanceSequenceCoordinator';

const match = (
  balls: number,
  strikes: number,
  outs = 1,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 3,
  half: 'top',
  outs,
  balls,
  strikes,
  bases: {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  score: {
    away: 1,
    home: 0,
  },
  playId: 4,
});

const zone = {
  centerX: 0,
  halfWidth: 0.2159,
  lowerY: 0.5,
  upperY: 1.5,
} as const;

const taken = (
  startTick: number,
  x: number,
): PitchAgainstBatterInput => ({
  action: { kind: 'take' },
  trajectory: {
    start: {
      tick: startTick,
      position: { x, y: 1, z: 10 },
      velocity: { x: 0, y: 0, z: -20 },
      spin: { x: 0, y: 0, z: 0 },
    },
    acceleration: { x: 0, y: 0, z: 0 },
    endTick: startTick + 600_000,
    ticksPerSecond: 1_000_000,
  },
  plateZ: 0,
  strikeZone: zone,
  ballRadiusMeters: 0.0366,
});

const swinging = (
  startTick: number,
  xOffset: number,
): PitchAgainstBatterInput => ({
  action: {
    kind: 'swing',
    swing: {
      startTick,
      endTick: startTick + 5_000,
      ticksPerSecond: 1_000_000,
      stateAtStart: {
        pose: {
          grip: { x: -0.42 + xOffset, y: 1, z: 0 },
          tip: { x: 0.42 + xOffset, y: 1, z: 0 },
        },
        linearVelocity: { x: 0, y: 0, z: 0 },
        angularVelocity: { x: 0, y: 0, z: 0 },
      },
    },
  },
  trajectory: {
    start: {
      tick: startTick,
      position: { x: 0, y: 1, z: 0.2 },
      velocity: { x: 0, y: 0, z: -60 },
      spin: { x: 0, y: 0, z: 0 },
    },
    acceleration: { x: 0, y: 0, z: 0 },
    endTick: startTick + 5_000,
    ticksPerSecond: 1_000_000,
  },
});

describe('PlateAppearanceSequenceCoordinator', () => {
  it('takes a physical swinging strikeout through to the next CanonicalMatchState', () => {
    const before = match(0, 2, 1);
    const result = resolvePlateAppearancePitchSequenceToMatchState({
      match: before,
      batterRunnerId: 'batter',
      startedAtTick: 900_000,
      pitches: [swinging(1_000_000, 1)],
    });

    expect(result.kind).toBe('complete');
    if (result.kind !== 'complete') {
      throw new Error('fixture must complete');
    }
    expect(result.terminalKind).toBe('strikeout');
    expect(result.nextMatchState).toEqual({
      ...before,
      outs: 2,
      balls: 0,
      strikes: 0,
      playId: 5,
    });
  });

  it('takes a physical fourth ball through forced walk advancement', () => {
    const before = match(3, 1, 1);
    const result = resolvePlateAppearancePitchSequenceToMatchState({
      match: before,
      batterRunnerId: 'batter',
      startedAtTick: 900_000,
      pitches: [taken(1_000_000, 0.4)],
    });

    expect(result.kind).toBe('complete');
    if (result.kind !== 'complete') {
      throw new Error('fixture must complete');
    }
    expect(result.terminalKind).toBe('walk');
    expect(result.nextMatchState).toEqual({
      ...before,
      balls: 0,
      strikes: 0,
      bases: {
        first: 'batter',
        second: 'r1',
        third: 'r3',
      },
      playId: 5,
    });
  });

  it('returns active without mutating match state when supplied pitches do not end the plate appearance', () => {
    const before = match(0, 0, 1);
    const result = resolvePlateAppearancePitchSequenceToMatchState({
      match: before,
      batterRunnerId: 'batter',
      startedAtTick: 900_000,
      pitches: [taken(1_000_000, 0)],
    });

    expect(result.kind).toBe('active');
    if (result.kind !== 'active') {
      throw new Error('fixture must remain active');
    }
    expect(result.matchState).toBe(before);
    expect(result.timeline.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 1 },
    });
  });

  it('returns batted-ball pending without applying a match result before fair/foul and fielding resolve', () => {
    const before = match(0, 0, 1);
    const result = resolvePlateAppearancePitchSequenceToMatchState({
      match: before,
      batterRunnerId: 'batter',
      startedAtTick: 1_900_000,
      pitches: [swinging(2_000_000, 0)],
    });

    expect(result.kind).toBe('batted_ball_pending');
    if (result.kind !== 'batted_ball_pending') {
      throw new Error('fixture must await batted-ball disposition');
    }
    expect(result.matchState).toBe(before);
    expect(result.timeline.status.kind).toBe('batted_ball_pending');
  });
});
