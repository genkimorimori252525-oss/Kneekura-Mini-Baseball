import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { SeedRoot } from '../../rng/SeedRoot';
import type {
  PitchAgainstBatterInput,
} from '../pitching/PitchAgainstBatter';
import {
  recordFoulBattedBall,
} from './CanonicalPlateAppearanceTimeline';
import {
  resolvePlateAppearancePitchSequence,
} from './PlateAppearancePitchSequence';
import {
  advancePlateAppearancePitchSequenceToMatchState,
  resolvePlateAppearancePitchSequenceToMatchState,
} from './PlateAppearanceSequenceCoordinator';

const match = (
  balls: number,
  strikes: number,
  outs = 1,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 4,
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
    away: 2,
    home: 1,
  },
  playId: 10,
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

const swing = (
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

describe('P2 plate-appearance replay acceptance', () => {
  it('replays contact -> foul -> resumed swinging strikeout identically', () => {
    const run = () => {
      const before = match(0, 1, 1);
      const contacted = resolvePlateAppearancePitchSequence({
        match: before,
        startedAtTick: 900_000,
        pitches: [swing(1_000_000, 0)],
      });
      if (contacted.kind !== 'batted_ball_pending') {
        throw new Error('fixture must create physical contact');
      }

      const afterFoul = recordFoulBattedBall(
        contacted.timeline,
        1_010_000,
        false,
        {
          kind: 'not_caught',
          batterRunnerId: 'batter',
          firstFielderTouchTick: 1_005_000,
          firstGroundContactTick: 1_010_000,
          secureCatchTick: 1_020_000,
        },
      );

      return advancePlateAppearancePitchSequenceToMatchState({
        match: before,
        batterRunnerId: 'batter',
        timeline: afterFoul,
        pitches: [swing(2_000_000, 1)],
      });
    };

    const first = run();
    const second = run();

    expect(first).toEqual(second);
    expect(first.kind).toBe('complete');
    if (first.kind !== 'complete') {
      throw new Error('fixture must end in strikeout');
    }
    expect(first.terminalKind).toBe('strikeout');
    expect(first.timeline.events.map((event) => event.kind))
      .toEqual([
        'BatBallContact',
        'FoulBattedBallResolved',
        'SwingCompletedWithoutContact',
        'PitchAdjudicated',
      ]);
    expect(first.nextMatchState).toEqual({
      ...match(0, 1, 1),
      outs: 2,
      balls: 0,
      strikes: 0,
      playId: 11,
    });
  });

  it('replays the same seeded physical pitch sequence into the same canonical ledger and MatchState', () => {
    const run = (matchSeed: number) => {
      const before = match(0, 0, 1);
      const root = new SeedRoot(matchSeed);
      const rng = root.streamRng(
        before.playId,
        'pitch',
        'p2-plate-appearance-acceptance',
      );

      const pitches = Array.from(
        { length: 4 },
        (_, index) => taken(
          4_000_000 + index * 1_000_000,
          0.3 + rng.nextFloat() * 0.1,
        ),
      );

      return resolvePlateAppearancePitchSequenceToMatchState({
        match: before,
        batterRunnerId: 'batter',
        startedAtTick: 3_900_000,
        pitches,
      });
    };

    const first = run(20260918);
    const second = run(20260918);

    expect(first).toEqual(second);
    expect(first.kind).toBe('complete');
    if (first.kind !== 'complete') {
      throw new Error('seeded fixture must end in a walk');
    }
    expect(first.terminalKind).toBe('walk');
    expect(first.pitchesConsumed).toBe(4);
    expect(first.timeline.events.filter(
      (event) => event.kind === 'TakenPitchPlateCrossed',
    )).toHaveLength(4);
  });

  it('replays a physical bases-loaded walk into the same forced-run MatchState', () => {
    const run = () => {
      const before: CanonicalMatchState = {
        ...match(3, 1, 1),
        bases: {
          first: 'r1',
          second: 'r2',
          third: 'r3',
        },
      };

      return resolvePlateAppearancePitchSequenceToMatchState({
        match: before,
        batterRunnerId: 'batter',
        startedAtTick: 2_900_000,
        pitches: [taken(3_000_000, 0.4)],
      });
    };

    const first = run();
    const second = run();

    expect(first).toEqual(second);
    expect(first.kind).toBe('complete');
    if (first.kind !== 'complete') {
      throw new Error('fixture must end in walk');
    }
    expect(first.terminalKind).toBe('walk');
    expect(first.nextMatchState).toMatchObject({
      balls: 0,
      strikes: 0,
      bases: {
        first: 'batter',
        second: 'r1',
        third: 'r2',
      },
      score: {
        away: 3,
        home: 1,
      },
      playId: 11,
    });
  });
});