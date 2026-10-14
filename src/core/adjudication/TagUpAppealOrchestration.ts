import type { RuleProfile } from '../rules/RuleProfile';
import { createFlyBallFirstFielderTouchFact } from '../rules/PhysicalRuleFacts';
import type { CanonicalPlateAppearanceTimeline } from '../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveTagUpAppeal, type TagUpAppealResult } from '../rules/TagUpAppealRule';
import { evaluateTagUpCompliance, type TagUpComplianceInput, type TagUpComplianceResult } from '../rules/TagUpCompliance';
import { evaluateBallWorldTagUpCompliance } from '../rules/BallWorldTagUpCompliance';
import {
  getOfficialStateWindows,
  recordDefensiveAppealAttempt,
  type DefensiveAppealAttemptInput,
  type BallWorldAppealComplianceEvidence,
  type PlayAdjudicationLedger,
} from './PlayAdjudicationLedger';
import { cloneInert, evaluateRuleProfileOfficialWindowTiming } from './OfficialWindowPolicy';

export type TagUpAppealAttemptInput = Omit<DefensiveAppealAttemptInput, 'timing' | 'complianceEvidence'> & Readonly<{
  profile: RuleProfile; complianceEvidence: TagUpComplianceInput;
}>;

export type TagUpAppealAttemptResolution = Readonly<{
  ledger: PlayAdjudicationLedger;
  compliance: TagUpComplianceResult;
  result: TagUpAppealResult;
}>;

export type ExactTagUpAppealAttemptInput = Omit<TagUpAppealAttemptInput, 'complianceEvidence'>
  & Readonly<{ complianceEvidence: BallWorldAppealComplianceEvidence }>;
type ExactCompliance = Exclude<ReturnType<typeof evaluateBallWorldTagUpCompliance>, { kind: 'pending' }>;
export type ExactTagUpAppealAttemptResolution = Omit<TagUpAppealAttemptResolution, 'compliance'> & Readonly<{ compliance: ExactCompliance }>;
export function orchestrateTagUpAppealAttempt(ledgerInput: PlayAdjudicationLedger, expectedRevision: number,
  input: ExactTagUpAppealAttemptInput): ExactTagUpAppealAttemptResolution;
// Keep the legacy signature last for existing Parameters/ReturnType consumers.
export function orchestrateTagUpAppealAttempt(ledgerInput: PlayAdjudicationLedger, expectedRevision: number,
  input: TagUpAppealAttemptInput): TagUpAppealAttemptResolution;
export function orchestrateTagUpAppealAttempt(
  ledgerInput: PlayAdjudicationLedger, expectedRevision: number,
  input: TagUpAppealAttemptInput | ExactTagUpAppealAttemptInput,
): Readonly<{ ledger: PlayAdjudicationLedger; compliance: TagUpComplianceResult | ExactCompliance; result: TagUpAppealResult }> {
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
  const compliance = 'kind' in recorded.complianceEvidence
    ? evaluateBallWorldTagUpCompliance(recorded.complianceEvidence) : evaluateTagUpCompliance(recorded.complianceEvidence);
  if (compliance.kind === 'pending') throw new Error('recorded exact appeal lost its original contact evidence');
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
}

export type TimelineTagUpAppealAttemptInput = Omit<TagUpAppealAttemptInput, 'complianceEvidence'> & Readonly<{
  physicalTimeline: CanonicalPlateAppearanceTimeline;
  complianceEvidence: Omit<TagUpAppealAttemptInput['complianceEvidence'], 'firstTouch'>;
}>;

export const orchestrateTagUpAppealAttemptFromTimeline = (
  ledgerInput: PlayAdjudicationLedger,
  expectedRevision: number,
  input: TimelineTagUpAppealAttemptInput,
): TagUpAppealAttemptResolution => {
  const ledger = cloneInert(ledgerInput);
  const request = cloneInert(input);
  const timeline = request.physicalTimeline;
  if (timeline.playId !== ledger.playId) {
    throw new Error('physical timeline playId must match adjudication ledger');
  }
  if (ledger.playEnd === null || timeline.status.kind !== 'live_ball_complete') {
    throw new Error('appeal requires a completed live-ball physical timeline');
  }
  const end = timeline.events.at(-1);
  if (
    end?.kind !== 'LiveBallPlayEnded'
    || end.tick !== timeline.status.playEndTick
    || end.tick !== ledger.playEnd.tick
    || end.payload.playEnd.tick !== ledger.playEnd.tick
    || end.payload.playEnd.reason !== ledger.playEnd.reason
  ) {
    throw new Error('physical timeline PlayEnd must match adjudication ledger');
  }
  const touches = timeline.events.filter((event) => event.kind === 'BattedBallFirstFielderTouch');
  if (touches.length !== 1) {
    throw new Error('appeal requires exactly one first-fielder touch in physical timeline');
  }
  const touch = touches[0];
  if (
    touch.tick !== touch.payload.evidence.tick
    || touch.tick < timeline.status.contactTick
    || touch.tick > end.tick
  ) {
    throw new Error('physical timeline first-fielder touch is inconsistent');
  }
  const firstTouch = createFlyBallFirstFielderTouchFact(
    touch.payload.evidence.fielderId,
    touch.tick,
  );
  return orchestrateTagUpAppealAttempt(ledger, expectedRevision, {
    profile: request.profile,
    eventId: request.eventId,
    windowId: request.windowId,
    attempt: request.attempt,
    complianceEvidence: { ...request.complianceEvidence, firstTouch },
  });
};
