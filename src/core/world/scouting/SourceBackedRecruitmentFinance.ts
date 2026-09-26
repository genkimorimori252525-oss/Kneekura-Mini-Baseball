import { financeSummary } from '../club/ClubFinance';
import { BUDGET_BUCKETS, type BudgetBucket,
  type ClubFinanceSummary } from '../club/ClubFinanceTypes';
import { readState } from '../club/ClubSchemas';
import type { ClubWorldState } from '../club/ClubTypes';

export type SourceBackedClubFinance = Readonly<{
  scope: 'CURRENT_SEASON_RECORDED_RESERVATIONS_ONLY';
  budgetBucket: BudgetBucket;
  financialProfileId: string;
  financialProfileVersion: string;
  summary: ClubFinanceSummary;
}>;

/** Recorded reservations do not include unallocated carry-over wages. */
export const deriveRecruitmentFinance = (
  input: ClubWorldState,
  careerId: string,
  clubId: string,
  decidedAtDay: number,
  budgetBucket: BudgetBucket,
) => {
  const club = readState(input);
  if (club.careerId !== careerId || club.identity.clubId !== clubId) {
    throw new Error('recruitment finance scope mismatch');
  }
  if (club.effectiveDay > decidedAtDay) {
    throw new Error('future recruitment finance is unavailable');
  }
  if (club.season.closureRef !== null) {
    throw new Error('closed-season recruitment finance is unavailable');
  }
  if (!BUDGET_BUCKETS.includes(budgetBucket)) {
    throw new Error('invalid recruitment budget bucket');
  }
  const summary = financeSummary(club);
  const financialProfile = club.season.plan.financialProfile;
  const sourceBackedClubFinance: SourceBackedClubFinance = {
    scope: 'CURRENT_SEASON_RECORDED_RESERVATIONS_ONLY', budgetBucket,
    financialProfileId: financialProfile.profileId,
    financialProfileVersion: financialProfile.version, summary,
  };
  const budgetContext = {
    financeSnapshotId: `${careerId}:${clubId}:${summary.season}:${summary.revision}`,
    availableAtDay: club.effectiveDay, currency: summary.currency,
    availableMinorUnits: Math.max(0, summary.budgetHeadroom[budgetBucket]),
  };
  return { budgetContext, sourceBackedClubFinance };
};
