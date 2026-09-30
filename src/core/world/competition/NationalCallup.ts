import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { PlayerAvailability } from '../roster/RosterTypes';
import type { NationalEligibilityDecision } from './NationalEligibility';

export const NATIONAL_DECLINE_REASONS = ['INJURY', 'PERSONAL', 'NATIONAL_RETIREMENT',
  'MOTIVATION_OR_RELATIONSHIP', 'ELIGIBILITY_DISPUTE'] as const;
export type NationalDeclineReason = typeof NATIONAL_DECLINE_REASONS[number];
export type NationalCallupPolicy = Readonly<{
  version: string; rosterLimit: number; initialRegistrationCutoffDay: number; replacementCutoffDay: number;
  allowedDeclineReasons: readonly NationalDeclineReason[];
}>;
export type NationalCallupResponse = Readonly<{
  decision: 'ACCEPT' | 'DECLINE'; reason: NationalDeclineReason | null; evidenceId: string;
}>;
export type NationalCallupInput = Readonly<{
  eligibility: NationalEligibilityDecision; policy: NationalCallupPolicy;
  availability: PlayerAvailability['status']; response: NationalCallupResponse;
  activePlayerCount: number; alreadyRegistered: boolean; isReplacement: boolean; asOfDay: number;
}>;
export type NationalCallupDecision = Readonly<{
  accepted: boolean; registrationStatus: 'ACTIVE' | 'DECLINED' | null; clubMustRelease: boolean;
  reason: 'NATIONAL_INELIGIBLE' | 'MEDICALLY_UNAVAILABLE' | 'PLAYER_UNAVAILABLE' | 'DECLINE_NOT_PERMITTED'
    | 'ROSTER_LIMIT' | 'INITIAL_ROSTER_CUTOFF' | 'REPLACEMENT_CUTOFF' | null;
  policyVersion: string; responseEvidenceId: string;
}>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Roster size/deadlines and permitted refusals are explicit edition rules, with no defaults. */
export const snapshotNationalCallupPolicy = (raw: NationalCallupPolicy): NationalCallupPolicy => {
  const policy = cloneInert(raw);
  if (!policy || Object.keys(policy).sort().join('|') !== 'allowedDeclineReasons|initialRegistrationCutoffDay|replacementCutoffDay|rosterLimit|version'
    || !id(policy.version) || !integer(policy.rosterLimit) || policy.rosterLimit === 0 || !integer(policy.replacementCutoffDay)
    || !integer(policy.initialRegistrationCutoffDay) || policy.initialRegistrationCutoffDay > policy.replacementCutoffDay
    || !Array.isArray(policy.allowedDeclineReasons) || new Set(policy.allowedDeclineReasons).size !== policy.allowedDeclineReasons.length
    || policy.allowedDeclineReasons.some((reason) => !NATIONAL_DECLINE_REASONS.includes(reason))) {
    throw new Error('invalid national callup policy');
  }
  return Object.freeze({ ...policy, allowedDeclineReasons: Object.freeze([...policy.allowedDeclineReasons]) });
};

/** A Club cannot veto this World obligation; the player's accepted response remains separate. */
export const evaluateNationalCallup = (raw: NationalCallupInput): NationalCallupDecision => {
  const input = cloneInert(raw);
  if (!input || Object.keys(input).sort().join('|') !== 'activePlayerCount|alreadyRegistered|asOfDay|availability|eligibility|isReplacement|policy|response'
    || !integer(input.asOfDay) || !integer(input.activePlayerCount)
    || typeof input.alreadyRegistered !== 'boolean' || typeof input.isReplacement !== 'boolean'
    || !['AVAILABLE', 'INJURED', 'REHAB', 'UNAVAILABLE'].includes(input.availability)
    || typeof input.eligibility?.eligible !== 'boolean') throw new Error('invalid national callup input');
  const policy = snapshotNationalCallupPolicy(input.policy);
  const response = input.response;
  if (!response || Object.keys(response).sort().join('|') !== 'decision|evidenceId|reason' || !id(response.evidenceId)
    || !['ACCEPT', 'DECLINE'].includes(response.decision)
    || (response.decision === 'ACCEPT' ? response.reason !== null
      : response.reason === null || !NATIONAL_DECLINE_REASONS.includes(response.reason))) {
    throw new Error('invalid national callup player response');
  }
  let reason: NationalCallupDecision['reason'] = null;
  let registrationStatus: NationalCallupDecision['registrationStatus'] = null;
  if (response.decision === 'DECLINE') {
    if (!policy.allowedDeclineReasons.includes(response.reason!)) reason = 'DECLINE_NOT_PERMITTED';
    else registrationStatus = 'DECLINED';
  } else if (!input.eligibility.eligible) reason = 'NATIONAL_INELIGIBLE';
  else if (input.availability === 'INJURED' || input.availability === 'REHAB') reason = 'MEDICALLY_UNAVAILABLE';
  else if (input.availability !== 'AVAILABLE') reason = 'PLAYER_UNAVAILABLE';
  else if (!input.isReplacement && !input.alreadyRegistered && input.asOfDay > policy.initialRegistrationCutoffDay) reason = 'INITIAL_ROSTER_CUTOFF';
  else if (input.isReplacement && input.asOfDay > policy.replacementCutoffDay) reason = 'REPLACEMENT_CUTOFF';
  else if (!input.alreadyRegistered && input.activePlayerCount >= policy.rosterLimit) reason = 'ROSTER_LIMIT';
  else registrationStatus = 'ACTIVE';
  return Object.freeze({ accepted: reason === null, registrationStatus, clubMustRelease: registrationStatus === 'ACTIVE',
    reason, policyVersion: policy.version, responseEvidenceId: response.evidenceId });
};
