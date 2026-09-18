import type {
  DefensiveIntent,
} from './DefensiveDecision';
import {
  createTeamCoveragePlan,
  type TeamCoveragePlan,
  type TeamCoveragePlanInput,
} from './TeamCoveragePlan';

export type TeamCoverageReplanReason =
  | 'ball_state_changed'
  | 'runner_state_changed'
  | 'possession_changed'
  | 'communication_received';

export type TeamCoverageReplanInput = Readonly<{
  previousPlan: TeamCoveragePlan;
  nextPlanInput: TeamCoveragePlanInput;
  revisionTick: number;
  reason: TeamCoverageReplanReason;
}>;

export type TeamCoveragePlanRevision = Readonly<{
  revisionTick: number;
  reason: TeamCoverageReplanReason;
  previousPlan: TeamCoveragePlan;
  plan: TeamCoveragePlan;
  changedPlayerIds: readonly string[];
}>;

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
      return 'ball_handler';
    case 'base_cover':
      return `base_cover:${intent.base}`;
    case 'relay':
      return (
        `relay:${normalizeZero(intent.target.x)}`
        + `:${normalizeZero(intent.target.z)}`
      );
    case 'backup':
      return (
        `backup:${normalizeZero(intent.target.x)}`
        + `:${normalizeZero(intent.target.z)}`
      );
    case 'deep_coverage':
      return (
        `deep_coverage:${normalizeZero(intent.target.x)}`
        + `:${normalizeZero(intent.target.z)}`
      );
    case 'hold':
      return 'hold';
  }
};

const validateRevisionTick = (
  tick: number,
): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      'revisionTick must be a non-negative safe integer tick',
    );
  }
};

export const replanTeamCoveragePlan = (
  input: TeamCoverageReplanInput,
): TeamCoveragePlanRevision => {
  validateRevisionTick(input.revisionTick);

  for (const defender of input.nextPlanInput.defenders) {
    for (const candidate of defender.candidates) {
      if (
        candidate.evidenceAvailableAt
        > input.revisionTick
      ) {
        throw new Error(
          'coverage replanning cannot use candidate evidence from after revisionTick',
        );
      }
    }
  }

  const plan = createTeamCoveragePlan(
    input.nextPlanInput,
  );

  const previousByPlayer = new Map(
    input.previousPlan.assignments.map(
      (assignment) => [
        assignment.playerId,
        assignment,
      ],
    ),
  );

  const changedPlayerIds = plan.assignments
    .filter((assignment) => {
      const previous = previousByPlayer.get(
        assignment.playerId,
      );
      if (previous === undefined) {
        return true;
      }
      return (
        canonicalIntentKey(previous.intent)
        !== canonicalIntentKey(assignment.intent)
      );
    })
    .map((assignment) => assignment.playerId)
    .sort((first, second) => (
      first.localeCompare(second)
    ));

  return {
    revisionTick: input.revisionTick,
    reason: input.reason,
    previousPlan: input.previousPlan,
    plan,
    changedPlayerIds,
  };
};
