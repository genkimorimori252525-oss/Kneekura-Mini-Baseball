import type {
  DefenseContext,
} from './DefenseContext';
import type {
  TeamCoveragePlan,
} from './TeamCoveragePlan';
import {
  selectThrowPlan,
  type ThrowPlanCandidate,
  type ThrowPlanSelection,
} from './ThrowPlan';

export type CoverageThrowPlanSelection = Readonly<{
  throwerId: string;
  selection: ThrowPlanSelection;
}>;

export const selectThrowPlanForCoverage = (
  context: DefenseContext,
  coverage: TeamCoveragePlan,
  candidates: readonly ThrowPlanCandidate[],
): CoverageThrowPlanSelection => {
  const ballHandlers = coverage.assignments.filter(
    (assignment) => (
      assignment.intent.kind === 'ball_handler'
    ),
  );

  if (ballHandlers.length !== 1) {
    throw new Error(
      'coverage throw planning requires exactly one ball handler',
    );
  }

  const byPlayerId = new Map(
    coverage.assignments.map(
      (assignment) => [
        assignment.playerId,
        assignment,
      ],
    ),
  );

  for (const candidate of candidates) {
    const receiver = byPlayerId.get(
      candidate.receiverId,
    );

    if (
      receiver === undefined
      || receiver.intent.kind !== 'base_cover'
      || receiver.intent.base !== candidate.targetBase
    ) {
      throw new Error(
        'throw-plan receiver must own the matching base-cover assignment',
      );
    }
  }

  return {
    throwerId: ballHandlers[0].playerId,
    selection: selectThrowPlan(
      context,
      candidates,
    ),
  };
};
