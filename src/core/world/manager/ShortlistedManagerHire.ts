import type { ClubTransitionEvent, ClubWorldState } from '../club/ClubTypes';
import type { ClubWageScheduleLedger } from '../club/ClubWageScheduleLedger';
import { applyAcceptedManagerHire } from './AcceptedManagerHire';
import type { ManagerEmploymentOffer,
  ManagerHireEvent, ManagerOfferAcceptance } from './AcceptedManagerHire';
import type { ManagerCandidateEvidenceLedger } from './ManagerCandidateEvidence';
import { shortlistManagerCandidates } from './ManagerMarketShortlist';
import type { ManagerHiringBrief,
  ManagerMarketTerms } from './ManagerMarketShortlist';

export type ShortlistedManagerHire = Readonly<{
  state: ClubWorldState;
  event: ManagerHireEvent;
  selection: Readonly<{
    briefId: string;
    estimateId: string;
    interestSourceEventId: string;
  }>;
}>;

/** Replays a market shortlist before verifying the accepted offer and club transaction. */
export const applyShortlistedManagerHire = (
  before: ClubWorldState,
  after: ClubWorldState,
  clubEvent: ClubTransitionEvent,
  offer: ManagerEmploymentOffer,
  acceptance: ManagerOfferAcceptance,
  beforeSchedules: ClubWageScheduleLedger,
  afterSchedules: ClubWageScheduleLedger,
  evidence: ManagerCandidateEvidenceLedger,
  brief: ManagerHiringBrief,
  candidates: readonly ManagerMarketTerms[],
): ShortlistedManagerHire => {
  if (brief.effectiveDay > offer.offeredAtDay) {
    throw new Error('manager shortlist day follows offer');
  }
  const market = shortlistManagerCandidates(before, evidence,
    brief, candidates);
  const selected = market.shortlist.find((candidate) =>
    candidate.managerId === offer.managerId
      && candidate.estimate.estimateId === offer.estimateId);
  if (!selected) {
    throw new Error('manager offer has no eligible shortlist entry');
  }
  if (selected.interestObservedAtDay > offer.offeredAtDay
    || offer.annualSalaryMinorUnits
      > brief.maximumAnnualSalaryMinorUnits) {
    throw new Error('manager offer violates shortlist terms');
  }
  if (!clubEvent.command.causeEventIds.includes(brief.briefId)
    || !clubEvent.command.causeEventIds.includes(
      selected.interestSourceEventId)) {
    throw new Error('manager hire omits shortlist provenance');
  }
  const hire = applyAcceptedManagerHire(before, after, clubEvent,
    selected.estimate, offer, acceptance, beforeSchedules,
    afterSchedules, evidence);
  return Object.freeze({ ...hire, selection: Object.freeze({
    briefId: brief.briefId,
    estimateId: selected.estimate.estimateId,
    interestSourceEventId: selected.interestSourceEventId,
  }) });
};
