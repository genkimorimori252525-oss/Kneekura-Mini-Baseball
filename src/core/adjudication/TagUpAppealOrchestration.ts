import type { RuleProfile } from '../rules/RuleProfile';
import { resolveTagUpAppeal, type TagUpAppealResult } from '../rules/TagUpAppealRule';
import { evaluateTagUpCompliance, type TagUpComplianceResult } from '../rules/TagUpCompliance';
import {
  getOfficialStateWindows,
  recordDefensiveAppealAttempt,
  type DefensiveAppealAttemptInput,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';
import { cloneInert, evaluateRuleProfileOfficialWindowTiming } from './OfficialWindowPolicy';

export type TagUpAppealAttemptInput = Omit<DefensiveAppealAttemptInput, 'timing'> & Readonly<{
  profile: RuleProfile;
}>;

export type TagUpAppealAttemptResolution = Readonly<{
  ledger: PlayAdjudicationLedger;
  compliance: TagUpComplianceResult;
  result: TagUpAppealResult;
}>;

export const orchestrateTagUpAppealAttempt = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: TagUpAppealAttemptInput,
): TagUpAppealAttemptResolution => {
  const ledger = cloneInert(ledgerInput);
  const request = cloneInert(input);
  if (ledger.ruleProfileId !== request.profile.id) {
    throw new Error('RuleProfile id must match adjudication ledger');
  }
  const stateWindow = getOfficialStateWindows(ledger).find((candidate) => candidate.windowId === request.windowId);
  if (stateWindow === undefined || stateWindow.windowKind !== 'appeal') {
    throw new Error('appeal window does not exist');
  }
  const timing = evaluateRuleProfileOfficialWindowTiming(
    ledger, request.profile, request.windowId, request.attempt.tick,
  );
  const next = recordDefensiveAppealAttempt(ledger, expectedRevision, {
    eventId: request.eventId,
    windowId: request.windowId,
    timing,
    attempt: request.attempt,
    complianceEvidence: request.complianceEvidence,
  });
  const recorded = next.events.at(-1);
  if (recorded?.kind !== 'DefensiveAppealAttemptRecorded') {
    throw new Error('appeal attempt was not recorded');
  }
  const compliance = evaluateTagUpCompliance(recorded.complianceEvidence);
  const ruleResult = resolveTagUpAppeal({
    compliance,
    appeal: recorded.attempt,
    window: { openedAtTick: stateWindow.openedAtTick, closedAtTick: null, closeReason: null },
  });
  if (ruleResult.kind === 'no_violation') {
    return Object.freeze({ ledger: next, compliance, result: ruleResult });
  }
  if (ruleResult.kind !== 'out') throw new Error('RuleEngine did not resolve open tag-up appeal');
  let result: TagUpAppealResult = ruleResult;
  if (timing === 'expired') {
    if (stateWindow.closedAtTick === null) throw new Error('expired appeal requires a closed appeal window');
    result = Object.freeze({
      kind: 'appeal_expired', runnerId: ruleResult.runnerId,
      appealedBase: ruleResult.appealedBase, appealTick: recorded.attempt.tick,
      windowClosedAtTick: stateWindow.closedAtTick,
    });
  } else if (timing === 'simultaneous_unresolved') {
    result = Object.freeze({
      kind: 'simultaneous_unresolved', runnerId: ruleResult.runnerId,
      appealedBase: ruleResult.appealedBase, tick: recorded.attempt.tick,
    });
  }
  return Object.freeze({ ledger: next, compliance, result });
};
