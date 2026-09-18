import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createCanonicalPlateAppearanceTimeline,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
import type {
  PitchTrajectorySegment,
} from './PitchTrajectory';
import {
  resolveAndRecordPitchAgainstBatter,
} from './PitchAgainstBatter';

const match = (): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 0,
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

const takenTrajectory = (
  x: number,
): PitchTrajectorySegment => ({
  start: {
    tick: 1_000_000,
    position: { x, y: 1, z: 10 },
    velocity: { x: 0, y: 0, z: -20 },
    spin: { x: 0, y: 0, z: 0 },
  },
  acceleration: { x: 0, y: 0, z: 0 },
  endTick: 1_600_000,
  ticksPerSecond: 1_000_000,
});

const swingTrajectory = (): PitchTrajectorySegment => ({
  start: {
    tick: 2_000_000,
    position: { x: 0, y: 1, z: 0.2 },
    velocity: { x: 0, y: 0, z: -60 },
    spin: { x: 0, y: 0, z: 0 },
  },
  acceleration: { x: 0, y: 0, z: 0 },
  endTick: 2_005_000,
  ticksPerSecond: 1_000_000,
});

const zone = {
  centerX: 0,
  halfWidth: 0.2159,
  lowerY: 0.5,
  upperY: 1.5,
} as const;

describe('PitchAgainstBatter', () => {
  it('resolves and records a taken called strike from physical plate crossing', () => {
    const result = resolveAndRecordPitchAgainstBatter(
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      ),
      {
        action: { kind: 'take' },
        trajectory: takenTrajectory(0),
        plateZ: 0,
        strikeZone: zone,
        ballRadiusMeters: 0.0366,
      },
    );

    expect(result.kind).toBe('recorded');
    if (result.kind !== 'recorded') {
      throw new Error('fixture must resolve');
    }
    expect(result.physical.kind).toBe('taken');
    expect(result.timeline.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 1 },
    });
    expect(result.timeline.events.map((event) => event.kind))
      .toEqual([
        'TakenPitchPlateCrossed',
        'PitchAdjudicated',
      ]);
  });

  it('resolves and records a taken ball from the same physical path API', () => {
    const result = resolveAndRecordPitchAgainstBatter(
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      ),
      {
        action: { kind: 'take' },
        trajectory: takenTrajectory(0.4),
        plateZ: 0,
        strikeZone: zone,
        ballRadiusMeters: 0.0366,
      },
    );

    expect(result.kind).toBe('recorded');
    if (result.kind !== 'recorded') {
      throw new Error('fixture must resolve');
    }
    expect(result.timeline.status).toEqual({
      kind: 'active',
      count: { balls: 1, strikes: 0 },
    });
  });

  it('resolves a swing into physical contact and batted-ball pending state', () => {
    const result = resolveAndRecordPitchAgainstBatter(
      createCanonicalPlateAppearanceTimeline(
        match(),
        1_900_000,
      ),
      {
        action: {
          kind: 'swing',
          swing: {
            startTick: 2_000_000,
            endTick: 2_005_000,
            ticksPerSecond: 1_000_000,
            stateAtStart: {
              pose: {
                grip: { x: -0.42, y: 1, z: 0 },
                tip: { x: 0.42, y: 1, z: 0 },
              },
              linearVelocity: { x: 0, y: 0, z: 0 },
              angularVelocity: { x: 0, y: 0, z: 0 },
            },
          },
        },
        trajectory: swingTrajectory(),
      },
    );

    expect(result.kind).toBe('recorded');
    if (result.kind !== 'recorded') {
      throw new Error('fixture must resolve');
    }
    expect(result.physical).toMatchObject({
      kind: 'swing',
      result: {
        kind: 'contact',
      },
    });
    expect(result.timeline.status).toMatchObject({
      kind: 'batted_ball_pending',
      contactTick: 2_002_174,
    });
  });

  it('resolves a swing miss into a physical miss event and strike', () => {
    const result = resolveAndRecordPitchAgainstBatter(
      createCanonicalPlateAppearanceTimeline(
        match(),
        1_900_000,
      ),
      {
        action: {
          kind: 'swing',
          swing: {
            startTick: 2_000_000,
            endTick: 2_005_000,
            ticksPerSecond: 1_000_000,
            stateAtStart: {
              pose: {
                grip: { x: 0.58, y: 1, z: 0 },
                tip: { x: 1.42, y: 1, z: 0 },
              },
              linearVelocity: { x: 0, y: 0, z: 0 },
              angularVelocity: { x: 0, y: 0, z: 0 },
            },
          },
        },
        trajectory: swingTrajectory(),
      },
    );

    expect(result.kind).toBe('recorded');
    if (result.kind !== 'recorded') {
      throw new Error('fixture must resolve');
    }
    expect(result.physical).toEqual({
      kind: 'swing',
      result: {
        kind: 'swinging_miss',
        adjudicationTick: 2_005_000,
      },
    });
    expect(result.timeline.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 1 },
    });
  });

  it('preserves an unresolved taken pitch when the trajectory never reaches the plate', () => {
    const trajectory: PitchTrajectorySegment = {
      ...takenTrajectory(0),
      start: {
        ...takenTrajectory(0).start,
        velocity: { x: 0, y: 0, z: 20 },
      },
    };
    const timeline = createCanonicalPlateAppearanceTimeline(
      match(),
      900_000,
    );

    const result = resolveAndRecordPitchAgainstBatter(
      timeline,
      {
        action: { kind: 'take' },
        trajectory,
        plateZ: 0,
        strikeZone: zone,
        ballRadiusMeters: 0.0366,
      },
    );

    expect(result).toEqual({
      kind: 'unresolved',
      reason: 'pitch_did_not_reach_plate',
      timeline,
    });
  });
});
