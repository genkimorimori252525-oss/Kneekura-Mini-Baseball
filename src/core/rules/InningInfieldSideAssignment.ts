import type {
  InfieldSidePlacement,
  PitchReleaseInfieldSideResult,
} from './PitchReleaseInfieldSideRule';

export type LockedInfieldSide =
  | 'first_base_side'
  | 'third_base_side';

export type InningInfieldSideAssignmentEntry = Readonly<{
  playerId: string;
  side: LockedInfieldSide;
}>;

export type InningInfieldSideAssignment = Readonly<{
  assignments: readonly InningInfieldSideAssignmentEntry[];
}>;

export type InningInfieldSideLockResult =
  | Readonly<{
    kind: 'compliant';
    movedPlayers: readonly string[];
    invalidPlayers: readonly string[];
  }>
  | Readonly<{
    kind: 'violation';
    movedPlayers: readonly string[];
    invalidPlayers: readonly string[];
  }>
  | Readonly<{
    kind: 'unsupported_participant_change';
    expectedPlayerIds: readonly string[];
    currentPlayerIds: readonly string[];
  }>;

const asLockedSide = (
  placement: InfieldSidePlacement,
): LockedInfieldSide => {
  if (placement.side === 'straddling_or_on_division') {
    throw new Error(
      'inning side assignment requires non-straddling initial placements',
    );
  }
  return placement.side;
};

export const establishInningInfieldSideAssignment = (
  initial: PitchReleaseInfieldSideResult,
): InningInfieldSideAssignment => {
  if (initial.kind !== 'legal') {
    throw new Error(
      'inning side assignment requires a legal initial pitch-release alignment',
    );
  }

  return {
    assignments: initial.placements.map((placement) => ({
      playerId: placement.playerId,
      side: asLockedSide(placement),
    })),
  };
};

const sameParticipantSet = (
  expected: readonly string[],
  current: readonly string[],
): boolean => (
  expected.length === current.length
  && expected.every((playerId) => current.includes(playerId))
);

export const evaluateInningInfieldSideLock = (
  assignment: InningInfieldSideAssignment,
  current: PitchReleaseInfieldSideResult,
): InningInfieldSideLockResult => {
  const expectedPlayerIds = assignment.assignments.map(
    (item) => item.playerId,
  );
  const currentPlayerIds = current.placements.map(
    (item) => item.playerId,
  );

  if (!sameParticipantSet(expectedPlayerIds, currentPlayerIds)) {
    return {
      kind: 'unsupported_participant_change',
      expectedPlayerIds,
      currentPlayerIds,
    };
  }

  const movedPlayers: string[] = [];
  const invalidPlayers: string[] = [];

  for (const expected of assignment.assignments) {
    const placement = current.placements.find(
      (item) => item.playerId === expected.playerId,
    );
    if (placement === undefined) {
      throw new Error(
        'participant-set validation and placement lookup diverged',
      );
    }

    if (placement.side === 'straddling_or_on_division') {
      invalidPlayers.push(expected.playerId);
      continue;
    }
    if (placement.side !== expected.side) {
      movedPlayers.push(expected.playerId);
    }
  }

  if (movedPlayers.length > 0 || invalidPlayers.length > 0) {
    return {
      kind: 'violation',
      movedPlayers,
      invalidPlayers,
    };
  }

  return {
    kind: 'compliant',
    movedPlayers,
    invalidPlayers,
  };
};
