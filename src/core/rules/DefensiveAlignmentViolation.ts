import type {
  InningInfieldSideLockResult,
} from './InningInfieldSideAssignment';
import type {
  PitchReleaseInfieldSideResult,
} from './PitchReleaseInfieldSideRule';
import type {
  PitchingMotionInfieldBoundaryResult,
} from './PitchingMotionInfieldBoundaryRule';

export type DefensiveAlignmentViolation =
  | Readonly<{
    kind: 'no_violation';
  }>
  | Readonly<{
    kind: 'violation';
    identity: 'concrete_players' | 'team_only';
    violatingPlayerIds: readonly string[];
  }>;

const unique = (
  ids: readonly string[],
): readonly string[] => [...new Set(ids)];

export const normalizePitchReleaseInfieldSideViolation = (
  result: PitchReleaseInfieldSideResult,
): DefensiveAlignmentViolation => {
  if (result.kind === 'legal') {
    return { kind: 'no_violation' };
  }

  const invalidIds = unique(result.invalidInfielders);
  const invalidCount = invalidIds.length;
  const counted = (
    result.firstBaseSideCount + result.thirdBaseSideCount
  );

  // We can attribute this violation to the invalid placements only when
  // neither populated side already exceeds the allowed two-player count
  // and the missing side slots exactly correspond to invalid players.
  const concreteInvalidOnly = (
    invalidCount > 0
    && result.firstBaseSideCount <= 2
    && result.thirdBaseSideCount <= 2
    && counted + invalidCount === result.placements.length
    && result.placements.length === 4
    && (2 - result.firstBaseSideCount)
      + (2 - result.thirdBaseSideCount) === invalidCount
  );

  if (concreteInvalidOnly) {
    return {
      kind: 'violation',
      identity: 'concrete_players',
      violatingPlayerIds: invalidIds,
    };
  }

  return {
    kind: 'violation',
    identity: 'team_only',
    violatingPlayerIds: [],
  };
};

export const normalizeInningInfieldSideLockViolation = (
  result: InningInfieldSideLockResult,
): DefensiveAlignmentViolation => {
  if (result.kind === 'compliant') {
    return { kind: 'no_violation' };
  }
  if (result.kind === 'unsupported_participant_change') {
    throw new Error(
      'cannot normalize unsupported participant change as an alignment violation',
    );
  }

  const ids = unique([
    ...result.movedPlayers,
    ...result.invalidPlayers,
  ]);
  if (ids.length === 0) {
    throw new Error(
      'alignment lock violation must identify at least one player',
    );
  }

  return {
    kind: 'violation',
    identity: 'concrete_players',
    violatingPlayerIds: ids,
  };
};


export const normalizeInfieldBoundaryViolation = (
  result: PitchingMotionInfieldBoundaryResult,
): DefensiveAlignmentViolation => {
  if (result.kind === 'legal') {
    return { kind: 'no_violation' };
  }

  const ids = unique(result.invalidInfielders);
  if (ids.length === 0) {
    throw new Error(
      'infield boundary violation must identify at least one player',
    );
  }

  return {
    kind: 'violation',
    identity: 'concrete_players',
    violatingPlayerIds: ids,
  };
};
