import type {
  DefenderWorldState,
} from '../../model/CanonicalWorldSnapshot';
import type {
  TeamCoveragePlan,
} from './TeamCoveragePlan';

export const applyTeamCoveragePlanToWorld = (
  defenders: readonly DefenderWorldState[],
  plan: TeamCoveragePlan,
): readonly DefenderWorldState[] => {
  if (defenders.length !== 9) {
    throw new Error(
      'canonical defensive world must contain exactly nine defenders',
    );
  }
  if (plan.assignments.length !== 9) {
    throw new Error(
      'team coverage plan must contain exactly nine assignments',
    );
  }

  const assignments = new Map(
    plan.assignments.map((assignment) => [
      assignment.playerId,
      assignment,
    ]),
  );
  if (assignments.size !== 9) {
    throw new Error(
      'team coverage assignment playerIds must be unique',
    );
  }

  const seenWorldIds = new Set<string>();
  return defenders.map((defender) => {
    if (seenWorldIds.has(defender.playerId)) {
      throw new Error(
        'canonical defensive world playerIds must be unique',
      );
    }
    seenWorldIds.add(defender.playerId);

    const assignment = assignments.get(
      defender.playerId,
    );
    if (assignment === undefined) {
      throw new Error(
        'team coverage plan must assign every world defender',
      );
    }
    if (
      assignment.registeredPosition
      !== defender.registeredPosition
    ) {
      throw new Error(
        'team coverage assignment registeredPosition must match world state',
      );
    }

    return {
      ...defender,
      assignment: assignment.intent,
    };
  });
};
