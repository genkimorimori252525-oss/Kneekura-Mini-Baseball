import type {
  RunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  compareRunnerPrecedence,
  type RunnerPrecedence,
} from './RunnerPrecedence';
import type { TagUpAppealResult } from './TagUpAppealRule';

export type SustainedTagUpAppealOut = Extract<
  TagUpAppealResult,
  { kind: 'out' }
>;

export type AppealOutScoringInput = Readonly<{
  precedence: RunnerPrecedence;
  appealOut: SustainedTagUpAppealOut;
  homeTouches: readonly RunnerBaseTouchFact[];
}>;

type AppealOutScoringFields = Readonly<{
  effectiveOut: SustainedTagUpAppealOut;
  scored: readonly RunnerBaseTouchFact[];
  suppressed: readonly RunnerBaseTouchFact[];
  simultaneous: readonly RunnerBaseTouchFact[];
}>;

export type AppealOutScoringResult =
  | (Readonly<{ kind: 'resolved' }> & AppealOutScoringFields)
  | (Readonly<{ kind: 'simultaneous_unresolved' }> & AppealOutScoringFields);

export const evaluateSustainedTagUpAppealScoring = (
  input: AppealOutScoringInput,
): AppealOutScoringResult => {
  const scored: RunnerBaseTouchFact[] = [];
  const suppressed: RunnerBaseTouchFact[] = [];
  const simultaneous: RunnerBaseTouchFact[] = [];

  for (const touch of input.homeTouches) {
    if (touch.base !== 4) {
      throw new Error('appeal scoring requires base-4 home touch facts');
    }

    if (touch.runnerId === input.appealOut.runnerId) {
      // Validate that both runners belong to this play before applying
      // the appealed runner's own-run exception.
      compareRunnerPrecedence(
        input.precedence,
        input.appealOut.runnerId,
        touch.runnerId,
      );
      suppressed.push(touch);
      continue;
    }

    const relation = compareRunnerPrecedence(
      input.precedence,
      input.appealOut.runnerId,
      touch.runnerId,
    );

    if (relation === 'preceding') {
      suppressed.push(touch);
      continue;
    }

    if (relation === 'same') {
      throw new Error(
        'distinct runner ids cannot share the same precedence origin',
      );
    }

    if (touch.tick < input.appealOut.outTick) {
      scored.push(touch);
    } else if (touch.tick > input.appealOut.outTick) {
      suppressed.push(touch);
    } else {
      simultaneous.push(touch);
    }
  }

  const fields: AppealOutScoringFields = {
    effectiveOut: input.appealOut,
    scored,
    suppressed,
    simultaneous,
  };

  return simultaneous.length > 0
    ? { kind: 'simultaneous_unresolved', ...fields }
    : { kind: 'resolved', ...fields };
};
