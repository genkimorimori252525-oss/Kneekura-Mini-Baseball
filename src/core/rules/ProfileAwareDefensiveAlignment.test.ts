import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../model/CanonicalMatchState';
import { asRuleProfileId } from '../model/RuleProfileRef';
import {
  createDefenderFootPlacementFact,
  createSecondBaseDivisionReference,
} from './DefensiveAlignmentFacts';
import {
  NPB_2026_RULE_PROFILE,
  type RuleProfile,
} from './RuleProfile';
import { createRuleContext } from './RuleContext';
import { establishInningInfieldSideAssignment } from './InningInfieldSideAssignment';
import { evaluatePitchReleaseInfieldSide } from './PitchReleaseInfieldSideRule';
import { createInfieldBoundaryRegion } from './InfieldBoundaryRegion';
import {
  evaluatePitchReleaseInfieldSideForMatch,
  evaluatePitchingMotionInfieldBoundaryForMatch,
  evaluateInningInfieldSideLockForMatch,
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

const tick = 2_000_000;

const fact = (
  id: string,
  position: '1B' | '2B' | '3B' | 'SS' | 'CF',
  x: number,
) => createDefenderFootPlacementFact(
  id,
  position,
  tick,
  { x: x - 0.05, z: 0 },
  { x: x + 0.05, z: 0 },
);

describe('profile-aware defensive alignment', () => {
  it('applies the NPB 2026 stadium infield boundary at pitching-related-motion start', () => {
    const result = evaluatePitchingMotionInfieldBoundaryForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      {
        pitchingRelatedMotionStartTick: tick,
        facts: [
          fact('1b', '1B', 3),
          fact('2b', '2B', 2),
          fact('ss', 'SS', 5),
          fact('3b', '3B', -3),
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

    expect(result).toMatchObject({
      kind: 'violation',
      invalidInfielders: ['ss'],
    });
  });

  it('fails explicitly if the active profile does not use stadium geometry at pitching-related-motion start', () => {
    const unsupported: RuleProfile = {
      ...NPB_2026_RULE_PROFILE,
      id: asRuleProfileId('unsupported-infield-boundary'),
      defensiveAlignment: {
        ...NPB_2026_RULE_PROFILE.defensiveAlignment,
        infieldBoundary: {
          ...NPB_2026_RULE_PROFILE.defensiveAlignment.infieldBoundary,
          geometrySource: 'fixed_reference',
        },
      },
    };

    expect(() => evaluatePitchingMotionInfieldBoundaryForMatch(
      match(unsupported.id),
      createRuleContext(unsupported),
      {
        pitchingRelatedMotionStartTick: tick,
        facts: [
          fact('1b', '1B', 3),
          fact('2b', '2B', 2),
          fact('ss', 'SS', -2),
          fact('3b', '3B', -3),
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
    )).toThrow(
      'unsupported infield-boundary alignment semantics',
    );
  });

  it('applies the NPB 2026 pitch-release both-feet 2+2 rule', () => {
    const result = evaluatePitchReleaseInfieldSideForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      {
        pitchReleaseTick: tick,
        facts: [
          fact('1b', '1B', 3),
          fact('2b', '2B', 2),
          fact('ss', 'SS', -2),
          fact('3b', '3B', -3),
          fact('cf', 'CF', 0.5),
        ],
        reference: createSecondBaseDivisionReference(
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ),
      },
    );

    expect(result).toMatchObject({
      kind: 'legal',
      firstBaseSideCount: 2,
      thirdBaseSideCount: 2,
    });
  });

  it('fails explicitly if the active profile does not use both-feet pitch-release side semantics', () => {
    const unsupported: RuleProfile = {
      ...NPB_2026_RULE_PROFILE,
      id: asRuleProfileId('unsupported-alignment'),
      defensiveAlignment: {
        ...NPB_2026_RULE_PROFILE.defensiveAlignment,
        secondBaseSide: {
          ...NPB_2026_RULE_PROFILE.defensiveAlignment.secondBaseSide,
          sideDeterminedBy: 'body_center',
        },
      },
    };

    expect(() => evaluatePitchReleaseInfieldSideForMatch(
      match(unsupported.id),
      createRuleContext(unsupported),
      {
        pitchReleaseTick: tick,
        facts: [
          fact('1b', '1B', 3),
          fact('2b', '2B', 2),
          fact('ss', 'SS', -2),
          fact('3b', '3B', -3),
        ],
        reference: createSecondBaseDivisionReference(
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ),
      },
    )).toThrow(
      'unsupported second-base side alignment semantics',
    );
  });

  it('fails explicitly when the profile disables the side restriction', () => {
    const disabled: RuleProfile = {
      ...NPB_2026_RULE_PROFILE,
      id: asRuleProfileId('alignment-disabled'),
      defensiveAlignment: {
        ...NPB_2026_RULE_PROFILE.defensiveAlignment,
        secondBaseSide: {
          ...NPB_2026_RULE_PROFILE.defensiveAlignment.secondBaseSide,
          enabled: false,
        },
      },
    };

    expect(() => evaluatePitchReleaseInfieldSideForMatch(
      match(disabled.id),
      createRuleContext(disabled),
      {
        pitchReleaseTick: tick,
        facts: [
          fact('1b', '1B', 3),
          fact('2b', '2B', 2),
          fact('ss', 'SS', -2),
          fact('3b', '3B', -3),
        ],
        reference: createSecondBaseDivisionReference(
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ),
      },
    )).toThrow(
      'active rule profile does not enable the second-base side restriction',
    );
  });

  it('applies the half-inning player-side assignment lock from the active profile', () => {
    const baseInput = {
      pitchReleaseTick: tick,
      facts: [
        fact('1b', '1B', 3),
        fact('2b', '2B', 2),
        fact('ss', 'SS', -2),
        fact('3b', '3B', -3),
      ],
      reference: createSecondBaseDivisionReference(
        { x: 0, z: 0 },
        { x: 1, z: 0 },
      ),
    } as const;

    const initial = evaluatePitchReleaseInfieldSideForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      baseInput,
    );
    const assignment = establishInningInfieldSideAssignment(initial);

    const swapped = evaluatePitchReleaseInfieldSide({
      ...baseInput,
      facts: [
        fact('1b', '1B', 3),
        fact('2b', '2B', -2),
        fact('ss', 'SS', 2),
        fact('3b', '3B', -3),
      ],
      parameters: {
        requiredInfielderCount: 4,
        minimumInfieldersEachSideOfSecondBase: 2,
      },
    });
    expect(swapped.kind).toBe('legal');

    expect(evaluateInningInfieldSideLockForMatch(
      match(),
      createRuleContext(NPB_2026_RULE_PROFILE),
      assignment,
      swapped,
    )).toEqual({
      kind: 'violation',
      movedPlayers: ['2b', 'ss'],
      invalidPlayers: [],
    });
  });

  it('refuses the lock evaluator when the profile disables inning side locking', () => {
    const disabled: RuleProfile = {
      ...NPB_2026_RULE_PROFILE,
      id: asRuleProfileId('lock-disabled'),
      defensiveAlignment: {
        ...NPB_2026_RULE_PROFILE.defensiveAlignment,
        secondBaseSide: {
          ...NPB_2026_RULE_PROFILE.defensiveAlignment.secondBaseSide,
          assignmentLock: {
            ...NPB_2026_RULE_PROFILE.defensiveAlignment.secondBaseSide.assignmentLock,
            enabled: false,
          },
        },
      },
    };

    const current = evaluatePitchReleaseInfieldSide({
      pitchReleaseTick: tick,
      facts: [
        fact('1b', '1B', 3),
        fact('2b', '2B', 2),
        fact('ss', 'SS', -2),
        fact('3b', '3B', -3),
      ],
      reference: createSecondBaseDivisionReference(
        { x: 0, z: 0 },
        { x: 1, z: 0 },
      ),
      parameters: {
        requiredInfielderCount: 4,
        minimumInfieldersEachSideOfSecondBase: 2,
      },
    });
    const assignment = establishInningInfieldSideAssignment(current);

    expect(() => evaluateInningInfieldSideLockForMatch(
      match(disabled.id),
      createRuleContext(disabled),
      assignment,
      current,
    )).toThrow(
      'active rule profile does not enable inning infield side locking',
    );
  });

});
