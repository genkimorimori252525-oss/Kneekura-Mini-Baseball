import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createPlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordLiveBallPlayEnd,
} from './CanonicalPlateAppearanceTimeline';
import {
  applyResolvedLiveBallPlateAppearanceToMatchState,
} from './PlateAppearanceMatchState';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';

const baseMatch = (
  outs = 1,
  half: 'top' | 'bottom' = 'top',
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 6,
  half,
  outs,
  balls: 2,
  strikes: 1,
  bases: {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  score: {
    away: 3,
    home: 2,
  },
  playId: 21,
});

const liveTimeline = (
  match: CanonicalMatchState,
) => {
  const pitch: PitchWorldState = {
    tick: 60_000_000,
    position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 },
    spin: { x: 0, y: 0, z: 0 },
  };
  const swing: BatterSwingState = {
    pose: {
      grip: { x: -0.42, y: 1, z: 0 },
      tip: { x: 0.42, y: 1, z: 0 },
    },
    linearVelocity: { x: 0, y: 0, z: 22 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const contact = resolveBatBallContact(pitch, swing);
  if (contact === null) {
    throw new Error('fixture must produce physical contact');
  }
  return recordBatBallContact(
    createCanonicalPlateAppearanceTimeline(
      match,
      59_900_000,
    ),
    contact,
  );
};

const completedTimeline = (
  match: CanonicalMatchState,
  playEnd = createPlayEndFact(
    61_000_000,
    'live_action_complete',
  ),
) => ({
  timeline: recordLiveBallPlayEnd(
    liveTimeline(match),
    playEnd,
  ),
  playEnd,
});

describe('PlateAppearanceMatchState live-ball application', () => {
  it('applies authoritative outs, final bases, runs, count reset, and next playId', () => {
    const before = baseMatch(1, 'top');
    const { timeline, playEnd } = completedTimeline(before);

    expect(applyResolvedLiveBallPlateAppearanceToMatchState(
      before,
      timeline,
      {
        playEnd,
        outsAfter: 2,
        basesAfter: {
          first: 'batter',
          second: 'r1',
          third: null,
        },
        scoredRunnerIds: ['r3'],
      },
    )).toEqual({
      ...before,
      outs: 2,
      balls: 0,
      strikes: 0,
      bases: {
        first: 'batter',
        second: 'r1',
        third: null,
      },
      score: {
        away: 4,
        home: 2,
      },
      playId: 22,
    });
  });

  it('uses the P1 half-inning transition and clears bases when live play creates the third out', () => {
    const before = baseMatch(2, 'bottom');
    const { timeline, playEnd } = completedTimeline(before);

    expect(applyResolvedLiveBallPlateAppearanceToMatchState(
      before,
      timeline,
      {
        playEnd,
        outsAfter: 3,
        basesAfter: {
          first: 'batter',
          second: 'r1',
          third: null,
        },
        scoredRunnerIds: [],
      },
    )).toEqual({
      ruleProfileId: before.ruleProfileId,
      inning: 7,
      half: 'top',
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: {
        first: null,
        second: null,
        third: null,
      },
      score: before.score,
      playId: 22,
    });
  });

  it('credits live-ball runs to the batting side', () => {
    const before = baseMatch(0, 'bottom');
    const { timeline, playEnd } = completedTimeline(before);

    const after = applyResolvedLiveBallPlateAppearanceToMatchState(
      before,
      timeline,
      {
        playEnd,
        outsAfter: 0,
        basesAfter: {
          first: 'batter',
          second: null,
          third: null,
        },
        scoredRunnerIds: ['r3', 'r1'],
      },
    );

    expect(after.score).toEqual({
      away: 3,
      home: 4,
    });
  });

  it('rejects resolution evidence that does not match the timeline play end', () => {
    const before = baseMatch();
    const { timeline } = completedTimeline(before);

    expect(() => applyResolvedLiveBallPlateAppearanceToMatchState(
      before,
      timeline,
      {
        playEnd: createPlayEndFact(
          61_000_001,
          'live_action_complete',
        ),
        outsAfter: 1,
        basesAfter: before.bases,
        scoredRunnerIds: [],
      },
    )).toThrow(
      'live-ball resolution playEnd must match the timeline play end',
    );
  });

  it('rejects impossible out rollback and duplicate/final-base runner identities', () => {
    const before = baseMatch(1);
    const { timeline, playEnd } = completedTimeline(before);

    expect(() => applyResolvedLiveBallPlateAppearanceToMatchState(
      before,
      timeline,
      {
        playEnd,
        outsAfter: 0,
        basesAfter: before.bases,
        scoredRunnerIds: [],
      },
    )).toThrow(
      'live-ball outsAfter must be between current outs and 3',
    );

    expect(() => applyResolvedLiveBallPlateAppearanceToMatchState(
      before,
      timeline,
      {
        playEnd,
        outsAfter: 1,
        basesAfter: {
          first: 'r1',
          second: 'r1',
          third: null,
        },
        scoredRunnerIds: [],
      },
    )).toThrow(
      'live-ball final bases must contain unique runner ids',
    );

    expect(() => applyResolvedLiveBallPlateAppearanceToMatchState(
      before,
      timeline,
      {
        playEnd,
        outsAfter: 1,
        basesAfter: {
          first: 'r1',
          second: null,
          third: null,
        },
        scoredRunnerIds: ['r1'],
      },
    )).toThrow(
      'a scored runner cannot remain on a final base',
    );
  });

  it('requires a live-ball timeline from the same playId', () => {
    const before = baseMatch();
    const { timeline, playEnd } = completedTimeline(before);

    expect(() => applyResolvedLiveBallPlateAppearanceToMatchState(
      before,
      {
        ...timeline,
        playId: timeline.playId + 1,
      },
      {
        playEnd,
        outsAfter: 1,
        basesAfter: before.bases,
        scoredRunnerIds: [],
      },
    )).toThrow(
      'plate appearance timeline playId must match CanonicalMatchState.playId',
    );
  });
});
