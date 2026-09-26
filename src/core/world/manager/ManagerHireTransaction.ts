import { applyClubCommand } from '../club/ClubLifecycle';
import type { ClubTransitionEvent, ClubWorldState } from '../club/ClubTypes';
import { appendClubWageSchedule } from '../club/ClubWageScheduleLedger';
import type { ClubWageScheduleLedger } from '../club/ClubWageScheduleLedger';
import type { ManagerEmploymentOffer,
  ManagerOfferAcceptance } from './AcceptedManagerHire';
import { shortlistManagerCandidates } from './ManagerMarketShortlist';
import type { ManagerHiringBrief,
  ManagerMarketTerms } from './ManagerMarketShortlist';
import type { ManagerCandidateEvidenceLedger } from './ManagerCandidateEvidence';
import { applyShortlistedManagerHire } from './ShortlistedManagerHire';
import type { ShortlistedManagerHire } from './ShortlistedManagerHire';

export type ManagerHireTransactionIds = Readonly<{
  clubEventId: string;
  commitmentId: string;
  effectiveDay: number;
}>;
export type ManagerHireTransaction = Readonly<{
  club: ClubWorldState;
  clubEvent: ClubTransitionEvent;
  schedules: ClubWageScheduleLedger;
  hire: ShortlistedManagerHire;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value.trim() === value;

/** Builds and validates the related immutable states together; the host persists the returned bundle. */
export const executeManagerHireTransaction = (
  before: ClubWorldState,
  beforeSchedules: ClubWageScheduleLedger,
  evidence: ManagerCandidateEvidenceLedger,
  brief: ManagerHiringBrief,
  candidates: readonly ManagerMarketTerms[],
  offer: ManagerEmploymentOffer,
  acceptance: ManagerOfferAcceptance,
  ids: ManagerHireTransactionIds,
): ManagerHireTransaction => {
  if (!ids || !id(ids.clubEventId) || !id(ids.commitmentId)
    || !Number.isSafeInteger(ids.effectiveDay)
    || ids.effectiveDay < 0) {
    throw new Error('invalid manager hire transaction identifiers');
  }
  const market = shortlistManagerCandidates(before, evidence,
    brief, candidates);
  const selected = market.shortlist.find((candidate) =>
    candidate.managerId === offer.managerId
      && candidate.estimate.estimateId === offer.estimateId);
  if (!selected) {
    throw new Error('manager hire requires an eligible shortlist entry');
  }
  if (!Number.isSafeInteger(offer.annualSalaryMinorUnits)
    || offer.annualSalaryMinorUnits <= 0
    || !Number.isSafeInteger(offer.termSeasons)
    || offer.termSeasons <= 0 || offer.termSeasons > 10000) {
    throw new Error('invalid manager offer duration or salary');
  }
  const liability = BigInt(offer.annualSalaryMinorUnits)
    * BigInt(offer.termSeasons);
  if (liability <= 0 || liability > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('invalid manager wage liability');
  }
  const annualAmounts = Array.from({ length: offer.termSeasons },
    (_, index) => ({ season: before.season.plan.season + index,
      amount: offer.annualSalaryMinorUnits }));
  if (annualAmounts.some((annual) =>
    !Number.isSafeInteger(annual.season))) {
    throw new Error('manager wage schedule season overflow');
  }
  const appointed = { roleId: offer.roleId,
    roleKind: 'MANAGER' as const, personId: offer.managerId,
    appointmentId: offer.appointmentId };
  const command = {
    eventId: ids.clubEventId, careerId: before.careerId,
    clubId: before.identity.clubId,
    expectedRevision: before.revision,
    effectiveDay: ids.effectiveDay,
    causeEventIds: [selected.estimate.estimateId,
      brief.briefId, selected.interestSourceEventId,
      offer.offerId, acceptance.sourceEventId],
    operations: [{ kind: 'RECORD_COMMITMENT' as const,
      commitmentId: ids.commitmentId,
      contractRef: offer.contractId, category: 'staffWages' as const,
      budgetBucket: 'coaching' as const,
      amount: Number(liability), currency: offer.currency },
    { kind: 'UPDATE_REFERENCES' as const,
      references: { ...before.live.references,
        staffRoleLinks: [...before.live.references.staffRoleLinks,
          appointed] } }],
  };
  const changed = applyClubCommand(before, command);
  if (!changed.ok) {
    throw new Error(`manager club transaction rejected: ${changed.reason.code}`);
  }
  const schedules = appendClubWageSchedule(beforeSchedules,
    beforeSchedules.revision, changed.state, changed.event, {
      commitmentId: ids.commitmentId,
      contractRef: offer.contractId, annualAmounts,
    });
  const hire = applyShortlistedManagerHire(before, changed.state,
    changed.event, offer, acceptance, beforeSchedules,
    schedules, evidence, brief, candidates);
  return Object.freeze({ club: changed.state,
    clubEvent: changed.event, schedules, hire });
};
