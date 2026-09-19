import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createPlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordFairBattedBall,
  recordLiveBallPlayEnd,
} from './CanonicalPlateAppearanceTimeline';
import {
  applyResolvedLiveBallPlateAppearanceToMatchState,
} from './PlateAppearanceMatchState';

const fixture = () => {
  const match: CanonicalMatchState = {
    ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 5,
    half: 'top',
    outs: 1,
    balls: 0,
    strikes: 0,
    bases: {
      first: null,
      second: null,
      third: null,
    },
    score: {
      away: 1,
      home: 1,
    },
    playId: 55,
  };
  const pitch: PitchWorldState = {
    tick: 30_000_000,
    position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 },
    spin: { x: 0, y: 0, z: 0 },
  };
  const swing: BatterSwingState = {
    pose: {
      grip: { x: -0.42, y: 1, z: 0 },
      tip: { x: 0.42, y: 1, z: 0 },
    },
    linearVelocity: { x: 0, y: -7, z: 17 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const contact = resolveBatBallContact(pitch, swing);
  if (contact === null) {
    throw new Error('fixture must create contact');
  }
  const playEnd = createPlayEndFact(
    contact.tick + 1_000_000,
    'live_action_complete',
  );
  const timeline = recordLiveBallPlayEnd(
    recordFairBattedBall(
      recordBatBallContact(
        createCanonicalPlateAppearanceTimeline(
          match,
          contact.tick - 100_000,
        ),
        contact,
      ),
      contact.tick + 1,
    ),
    playEnd,
  );

  return { match, timeline, playEnd };
};

describe('PlateAppearanceMatchState hostile live-ball occupancy', () => {
  it('rejects the same runner occupying two final bases', () => {
    const { match, timeline, playEnd } = fixture();

    expect(() =>
      applyResolvedLiveBallPlateAppearanceToMatchState(
        match,
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
      )
    ).toThrow(
      'live-ball final bases must contain unique runner ids',
    );
  });

  it('rejects a scored runner remaining on a final base', () => {
    const { match, timeline, playEnd } = fixture();

    expect(() =>
      applyResolvedLiveBallPlateAppearanceToMatchState(
        match,
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
      )
    ).toThrow(
      'a scored runner cannot remain on a final base',
    );
  });
});