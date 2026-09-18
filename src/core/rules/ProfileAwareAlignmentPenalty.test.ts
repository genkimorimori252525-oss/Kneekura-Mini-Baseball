import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import {
  createFirstPostPitchInfielderTouchFact,
} from './AlignmentPenaltyFacts';
import { createDefenderFootPlacementFact } from './DefensiveAlignmentFacts';
import {
  normalizeInfieldBoundaryViolation,
  normalizeInningInfieldSideLockViolation,
} from './DefensiveAlignmentViolation';
import { createInfieldBoundaryRegion } from './InfieldBoundaryRegion';
import {
  createNaturalPlayAdvancementResult,
} from './OffenseAdvancementResult';
import {
  NPB_2026_RULE_PROFILE,
  type RuleProfile,
} from './RuleProfile';
import { createRuleContext } from './RuleContext';
import {
  evaluatePitchingMotionInfieldBoundaryForMatch,
  resolveDefensiveAlignmentViolationPenaltyForMatch,
} from './ProfileAwareRuleEngine';

const match = (
  profileId = asRuleProfileId('npb-2026'),
): CanonicalMatchState => ({
  ruleProfileId: profileId,
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: {
    first: 'r1',
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 1,
});

describe('profile-aware NPB 2026 alignment penalty', () => {
  it('turns a concrete half-inning side-lock violation into an offense choice when the violating first toucher makes an insufficient natural play', () => {
    const violation = normalizeInningInfieldSideLockViolation({
      kind: 'violation',
      movedPlayers: ['2b', 'ss'],
      invalidPlayers: [],
    });
    const naturalPlay = createNaturalPlayAdvancementResult(
      match().bases,
      'batter',
      false,
      [{ runnerId: 'r1', outcome: 'retired' }],
    );

    expect(resolveDefensiveAlignmentViolationPenaltyForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      {
        violation,
        firstInfielderTouch: createFirstPostPitchInfielderTouchFact(
          'ss',
          'SS',
          2_100_000,
        ),
        prePitchBases: match().bases,
        naturalPlay,
      },
    )).toMatchObject({
      kind: 'offense_choice_required',
      violatingFirstToucherId: 'ss',
      penaltyAward: {
        batterRunner: {
          runnerId: 'batter',
          targetBase: 1,
        },
        runners: [{
          runnerId: 'r1',
          fromBase: 1,
          targetBase: 2,
        }],
      },
    });
  });

  it('feeds a concrete stadium-boundary violator into the existing NPB 2026 penalty resolver', () => {
    const boundaryTick = 1_900_000;
    const footFact = (
      playerId: string,
      position: '1B' | '2B' | '3B' | 'SS',
      x: number,
    ) => createDefenderFootPlacementFact(
      playerId,
      position,
      boundaryTick,
      { x: x - 0.05, z: 0 },
      { x: x + 0.05, z: 0 },
    );
    const boundaryResult = evaluatePitchingMotionInfieldBoundaryForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      {
        pitchingRelatedMotionStartTick: boundaryTick,
        facts: [
          footFact('1b', '1B', 3),
          footFact('2b', '2B', 2),
          footFact('ss', 'SS', 5),
          footFact('3b', '3B', -3),
        ],
        boundary: createInfieldBoundaryRegion([
          { x: -5, z: -5 },
          { x: 5, z: -5 },
          { x: 5, z: 5 },
          { x: -5, z: 5 },
        ]),
        parameters: {
          footContactRadiusMeters: 0.1,
        },
      },
    );
    const violation = normalizeInfieldBoundaryViolation(boundaryResult);
    const naturalPlay = createNaturalPlayAdvancementResult(
      match().bases,
      'batter',
      false,
      [{ runnerId: 'r1', outcome: 'retired' }],
    );

    expect(resolveDefensiveAlignmentViolationPenaltyForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      {
        violation,
        firstInfielderTouch: createFirstPostPitchInfielderTouchFact(
          'ss',
          'SS',
          2_100_000,
        ),
        prePitchBases: match().bases,
        naturalPlay,
      },
    )).toMatchObject({
      kind: 'offense_choice_required',
      violatingFirstToucherId: 'ss',
    });
  });

  it('fails explicitly under a profile with a different violation policy', () => {
    const unsupported: RuleProfile = {
      ...NPB_2026_RULE_PROFILE,
      id: asRuleProfileId('other-alignment-penalty'),
      defensiveAlignment: {
        ...NPB_2026_RULE_PROFILE.defensiveAlignment,
        violationPolicyId: 'other_policy',
      },
    };
    const naturalPlay = createNaturalPlayAdvancementResult(
      {
        first: null,
        second: null,
        third: null,
      },
      'batter',
      false,
      [],
    );

    expect(() => resolveDefensiveAlignmentViolationPenaltyForMatch(
      match(unsupported.id),
      createRuleContext(unsupported),
      {
        violation: {
          kind: 'violation',
          identity: 'concrete_players',
          violatingPlayerIds: ['ss'],
        },
        firstInfielderTouch: createFirstPostPitchInfielderTouchFact(
          'ss',
          'SS',
          2_100_000,
        ),
        prePitchBases: {
          first: null,
          second: null,
          third: null,
        },
        naturalPlay,
      },
    )).toThrow(
      'unsupported defensive alignment violation policy: other_policy',
    );
  });
});
