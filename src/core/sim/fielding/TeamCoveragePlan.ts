import type {
  DefensivePosition,
} from '../../model/CanonicalWorldSnapshot';
import type {
  DefensiveIntent,
  DefensiveIntentCandidate,
} from './DefensiveDecision';

export type DefenderCoverageCandidateSet = Readonly<{
  playerId: string;
  registeredPosition: DefensivePosition;
  candidates: readonly DefensiveIntentCandidate[];
}>;

export type TeamCoverageAssignment = Readonly<{
  playerId: string;
  registeredPosition: DefensivePosition;
  intent: DefensiveIntent;
  selectedPriority: number;
  evidenceAvailableAt: number;
  evidenceKinds: readonly string[];
}>;

export type TeamCoveragePlan = Readonly<{
  assignments: readonly TeamCoverageAssignment[];
  totalPriority: number;
}>;

export type TeamCoveragePlanInput = Readonly<{
  defenders: readonly DefenderCoverageCandidateSet[];
  requireBallHandler: boolean;
}>;

type CoverageState = Readonly<{
  ballHandlerUsed: boolean;
  coveredBasesMask: number;
}>;

type PartialPlan = Readonly<{
  state: CoverageState;
  assignments: readonly TeamCoverageAssignment[];
  totalPriority: number;
}>;

const validatePriority = (
  value: number,
): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      'candidate localPriority must be finite and non-negative',
    );
  }
};

const validateTick = (
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      'candidate evidenceAvailableAt must be a non-negative safe integer tick',
    );
  }
};

const canonicalIntentKey = (
  intent: DefensiveIntent,
): string => {
  const normalizeZero = (
    value: number,
  ): number => (
    Object.is(value, -0) ? 0 : value
  );

  switch (intent.kind) {
    case 'ball_handler':
      return '0:ball_handler';
    case 'base_cover':
      return `1:base_cover:${intent.base}`;
    case 'relay':
      return (
        `2:relay:${normalizeZero(intent.target.x)}`
        + `:${normalizeZero(intent.target.z)}`
      );
    case 'backup':
      return (
        `3:backup:${normalizeZero(intent.target.x)}`
        + `:${normalizeZero(intent.target.z)}`
      );
    case 'deep_coverage':
      return (
        `4:deep_coverage:${normalizeZero(intent.target.x)}`
        + `:${normalizeZero(intent.target.z)}`
      );
    case 'hold':
      return '5:hold';
  }
};

const assignmentKey = (
  assignment: TeamCoverageAssignment,
): string => (
  `${assignment.playerId}:${canonicalIntentKey(
    assignment.intent,
  )}`
);

const planKey = (
  assignments: readonly TeamCoverageAssignment[],
): string => (
  assignments.map(assignmentKey).join('|')
);

const stateKey = (
  state: CoverageState,
): string => (
  `${state.ballHandlerUsed ? 1 : 0}:${state.coveredBasesMask}`
);

const normalizedPriority = (
  value: number,
): number => (
  Math.round(value * 1_000_000_000_000)
  / 1_000_000_000_000
);

const comparePartialPlans = (
  first: PartialPlan,
  second: PartialPlan,
): number => {
  const priorityOrder = (
    normalizedPriority(second.totalPriority)
    - normalizedPriority(first.totalPriority)
  );
  if (priorityOrder !== 0) {
    return priorityOrder;
  }

  return planKey(first.assignments).localeCompare(
    planKey(second.assignments),
  );
};

const applyIntentToState = (
  state: CoverageState,
  intent: DefensiveIntent,
): CoverageState | null => {
  if (intent.kind === 'ball_handler') {
    if (state.ballHandlerUsed) {
      return null;
    }
    return {
      ballHandlerUsed: true,
      coveredBasesMask: state.coveredBasesMask,
    };
  }

  if (intent.kind === 'base_cover') {
    const bit = 1 << (intent.base - 1);
    if ((state.coveredBasesMask & bit) !== 0) {
      return null;
    }
    return {
      ballHandlerUsed: state.ballHandlerUsed,
      coveredBasesMask:
        state.coveredBasesMask | bit,
    };
  }

  return state;
};

const validateInput = (
  input: TeamCoveragePlanInput,
): readonly DefenderCoverageCandidateSet[] => {
  if (input.defenders.length !== 9) {
    throw new Error(
      'team coverage plan requires exactly nine defenders',
    );
  }

  const seenPlayerIds = new Set<string>();
  for (const defender of input.defenders) {
    if (defender.playerId.length === 0) {
      throw new Error(
        'team coverage defender playerId must not be empty',
      );
    }
    if (seenPlayerIds.has(defender.playerId)) {
      throw new Error(
        'team coverage defender playerIds must be unique',
      );
    }
    seenPlayerIds.add(defender.playerId);

    if (defender.candidates.length === 0) {
      throw new Error(
        'every team coverage defender requires at least one intent candidate',
      );
    }

    for (const candidate of defender.candidates) {
      validatePriority(candidate.localPriority);
      validateTick(candidate.evidenceAvailableAt);
    }
  }

  return [...input.defenders].sort(
    (first, second) => (
      first.playerId.localeCompare(second.playerId)
    ),
  );
};

export const createTeamCoveragePlan = (
  input: TeamCoveragePlanInput,
): TeamCoveragePlan => {
  const defenders = validateInput(input);

  let frontier = new Map<string, PartialPlan>();
  const initial: PartialPlan = {
    state: {
      ballHandlerUsed: false,
      coveredBasesMask: 0,
    },
    assignments: [],
    totalPriority: 0,
  };
  frontier.set(stateKey(initial.state), initial);

  for (const defender of defenders) {
    const next = new Map<string, PartialPlan>();

    const candidates = [...defender.candidates].sort(
      (first, second) => {
        const priorityOrder = (
          normalizedPriority(second.localPriority)
          - normalizedPriority(first.localPriority)
        );
        if (priorityOrder !== 0) {
          return priorityOrder;
        }

        const intentOrder = canonicalIntentKey(
          first.intent,
        ).localeCompare(
          canonicalIntentKey(second.intent),
        );
        if (intentOrder !== 0) {
          return intentOrder;
        }

        const evidenceOrder = (
          first.evidenceAvailableAt
          - second.evidenceAvailableAt
        );
        if (evidenceOrder !== 0) {
          return evidenceOrder;
        }

        return first.evidenceKinds.join('|')
          .localeCompare(
            second.evidenceKinds.join('|'),
          );
      },
    );

    for (const partial of frontier.values()) {
      for (const candidate of candidates) {
        const nextState = applyIntentToState(
          partial.state,
          candidate.intent,
        );
        if (nextState === null) {
          continue;
        }

        const assignment:
          TeamCoverageAssignment = {
            playerId: defender.playerId,
            registeredPosition:
              defender.registeredPosition,
            intent: candidate.intent,
            selectedPriority:
              normalizedPriority(
                candidate.localPriority,
              ),
            evidenceAvailableAt:
              candidate.evidenceAvailableAt,
            evidenceKinds: [
              ...candidate.evidenceKinds,
            ],
          };

        const proposal: PartialPlan = {
          state: nextState,
          assignments: [
            ...partial.assignments,
            assignment,
          ],
          totalPriority:
            partial.totalPriority
            + candidate.localPriority,
        };

        const key = stateKey(nextState);
        const current = next.get(key);
        if (
          current === undefined
          || comparePartialPlans(
            proposal,
            current,
          ) < 0
        ) {
          next.set(key, proposal);
        }
      }
    }

    frontier = next;
  }

  const valid = [...frontier.values()].filter(
    (partial) => (
      !input.requireBallHandler
      || partial.state.ballHandlerUsed
    ),
  );

  if (valid.length === 0) {
    throw new Error(
      'no valid team coverage plan satisfies the role constraints',
    );
  }

  valid.sort(comparePartialPlans);
  const winner = valid[0];

  return {
    assignments: winner.assignments,
    totalPriority:
      normalizedPriority(winner.totalPriority),
  };
};
