export type DefensiveReplanTriggerKind =
  | 'batted_ball_recognized'
  | 'teammate_commitment_recognized'
  | 'catch_outcome_recognized'
  | 'ball_direction_change_recognized'
  | 'throw_start_recognized'
  | 'runner_motion_recognized'
  | 'communication_received'
  | 'coverage_need_changed';

export type DefensiveReplanTrigger = Readonly<{
  kind: DefensiveReplanTriggerKind;
  perceivedAt: number;
}>;

const validateTick = (name: string, tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

export const findNextDefensiveReplanTick = (
  lastDecisionTick: number | null,
  triggers: readonly DefensiveReplanTrigger[],
): number | null => {
  if (lastDecisionTick !== null) {
    validateTick('lastDecisionTick', lastDecisionTick);
  }

  let next: number | null = null;

  for (const trigger of triggers) {
    validateTick('trigger.perceivedAt', trigger.perceivedAt);

    if (
      lastDecisionTick !== null
      && trigger.perceivedAt <= lastDecisionTick
    ) {
      continue;
    }

    if (next === null || trigger.perceivedAt < next) {
      next = trigger.perceivedAt;
    }
  }

  return next;
};
