import {
  evaluateAppealTiming,
  type AppealWindowState,
} from './AppealWindow';
import type {
  DefensiveAppealAttemptFact,
} from './PhysicalRuleFacts';
import type {
  TagUpComplianceResult,
} from './TagUpCompliance';

export type TagUpAppealInput = Readonly<{
  // Only the rule interpretation and original identity are needed here. Exact
  // history may prove continuous contact without a synthetic departure fact.
  compliance: Pick<TagUpComplianceResult, 'kind' | 'runnerId' | 'originBase'>;
  appeal: DefensiveAppealAttemptFact;
  window: AppealWindowState;
}>;

export type TagUpAppealResult =
  | Readonly<{
    kind: 'out';
    runnerId: string;
    classification: 'tag_up_appeal';
    appealedBase: DefensiveAppealAttemptFact['base'];
    outTick: number;
    appealTick: number;
  }>
  | Readonly<{
    kind: 'appeal_expired';
    runnerId: string;
    appealedBase: DefensiveAppealAttemptFact['base'];
    appealTick: number;
    windowClosedAtTick: number;
  }>
  | Readonly<{
    kind: 'simultaneous_unresolved';
    runnerId: string;
    appealedBase: DefensiveAppealAttemptFact['base'];
    tick: number;
  }>
  | Readonly<{
    kind: 'no_violation';
    runnerId: string;
    appealedBase: DefensiveAppealAttemptFact['base'];
  }>;

export const resolveTagUpAppeal = (
  input: TagUpAppealInput,
): TagUpAppealResult => {
  const appealWindow = input.window;

  if (input.appeal.reason !== 'tag_up_early_departure') {
    throw new Error('tag-up appeal requires tag_up_early_departure reason');
  }
  if (input.appeal.runnerId !== input.compliance.runnerId) {
    throw new Error('appeal must target the evaluated runner');
  }
  if (input.appeal.base !== input.compliance.originBase) {
    throw new Error('appeal must target the tag-up origin base');
  }

  if (input.compliance.kind === 'compliant') {
    return {
      kind: 'no_violation',
      runnerId: input.compliance.runnerId,
      appealedBase: input.appeal.base,
    };
  }

  const timing = evaluateAppealTiming(
    appealWindow,
    input.appeal.tick,
  );

  if (timing === 'timely') {
    return {
      kind: 'out',
      runnerId: input.compliance.runnerId,
      classification: 'tag_up_appeal',
      appealedBase: input.appeal.base,
      outTick: input.appeal.tick,
      appealTick: input.appeal.tick,
    };
  }

  if (timing === 'expired') {
    if (appealWindow.closedAtTick === null) {
      throw new Error('expired appeal requires a closed appeal window');
    }
    return {
      kind: 'appeal_expired',
      runnerId: input.compliance.runnerId,
      appealedBase: input.appeal.base,
      appealTick: input.appeal.tick,
      windowClosedAtTick: appealWindow.closedAtTick,
    };
  }

  return {
    kind: 'simultaneous_unresolved',
    runnerId: input.compliance.runnerId,
    appealedBase: input.appeal.base,
    tick: input.appeal.tick,
  };
};