import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type {
  PitchAgainstBatterInput,
} from '../pitching/PitchAgainstBatter';
import {
  resolvePlateAppearancePitchSequence,
} from './PlateAppearancePitchSequence';

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
  playId: 9,
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

const swingingMiss = (
  startTick: number,
): PitchAgainstBatterInput => ({
  action: {
    kind: 'swing',
    swing: {
      startTick,
      endTick: startTick + 5_000,
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

const swingingContact = (
  startTick: number,
): PitchAgainstBatterInput => ({
  action: {
    kind: 'swing',
    swing: {
      startTick,
      endTick: startTick + 5_000,
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

describe('PlateAppearancePitchSequence', () => {
  it('resolves several physical pitches into one authoritative plate-appearance ledger', () => {
    const result = resolvePlateAppearancePitchSequence({
      match: match(),
      startedAtTick: 900_000,
      pitches: [
        taken(1_000_000, 0.4),
        taken(2_000_000, 0),
        swingingMiss(3_000_000),
      ],
    });

    expect(result.kind).toBe('active');
    expect(result.timeline.status).toEqual({
      kind: 'active',
      count: { balls: 1, strikes: 2 },
    });
    expect(result.pitchesConsumed).toBe(3);
    expect(result.timeline.events.map((event) => event.kind))
      .toEqual([
        'TakenPitchPlateCrossed',
        'PitchAdjudicated',
        'TakenPitchPlateCrossed',
        'PitchAdjudicated',
        'SwingCompletedWithoutContact',
        'PitchAdjudicated',
      ]);
  });

  it('returns terminal strikeout when the final supplied pitch ends the plate appearance', () => {
    const result = resolvePlateAppearancePitchSequence({
      match: match(0, 2),
      startedAtTick: 900_000,
      pitches: [
        swingingMiss(1_000_000),
      ],
    });

    expect(result).toMatchObject({
      kind: 'terminal',
      terminalKind: 'strikeout',
      pitchesConsumed: 1,
      timeline: {
        status: {
          kind: 'strikeout',
        },
      },
    });
  });

  it('returns batted-ball-pending when physical contact occurs on the final supplied pitch', () => {
    const result = resolvePlateAppearancePitchSequence({
      match: match(),
      startedAtTick: 900_000,
      pitches: [
        taken(1_000_000, 0.4),
        swingingContact(2_000_000),
      ],
    });

    expect(result).toMatchObject({
      kind: 'batted_ball_pending',
      pitchesConsumed: 2,
      timeline: {
        status: {
          kind: 'batted_ball_pending',
          contactTick: 2_002_174,
        },
      },
    });
  });

  it('does not silently ignore pitches supplied after a terminal result', () => {
    expect(() => resolvePlateAppearancePitchSequence({
      match: match(0, 2),
      startedAtTick: 900_000,
      pitches: [
        swingingMiss(1_000_000),
        taken(2_000_000, 0.4),
      ],
    })).toThrow(
      'pitch sequence contains entries after the plate appearance stopped accepting pitches',
    );
  });

  it('does not silently ignore pitches supplied after physical contact', () => {
    expect(() => resolvePlateAppearancePitchSequence({
      match: match(),
      startedAtTick: 900_000,
      pitches: [
        swingingContact(1_000_000),
        taken(2_000_000, 0.4),
      ],
    })).toThrow(
      'pitch sequence contains entries after the plate appearance stopped accepting pitches',
    );
  });

  it('preserves unresolved physical pitch state instead of skipping to a later pitch', () => {
    const noCross: PitchAgainstBatterInput = {
      ...taken(1_000_000, 0),
      trajectory: {
        ...taken(1_000_000, 0).trajectory,
        start: {
          ...taken(1_000_000, 0).trajectory.start,
          velocity: { x: 0, y: 0, z: 20 },
        },
      },
    };

    const result = resolvePlateAppearancePitchSequence({
      match: match(),
      startedAtTick: 900_000,
      pitches: [
        noCross,
      ],
    });

    expect(result).toMatchObject({
      kind: 'unresolved',
      reason: 'pitch_did_not_reach_plate',
      pitchIndex: 0,
      pitchesConsumed: 0,
      timeline: {
        status: {
          kind: 'active',
          count: { balls: 0, strikes: 0 },
        },
      },
    });
  });
});
