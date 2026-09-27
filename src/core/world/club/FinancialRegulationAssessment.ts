import type { PlayerWageSeasonAllocation } from './ClubPayrollPrecheck';
import type { ClubWorldState } from './ClubTypes';
import { readState } from './ClubSchemas';
import { exact } from './ClubValidation';

type LimitStatus = 'NOT_APPLICABLE' | 'MISSING_EVIDENCE' | 'WITHIN_LIMIT' | 'EXCEEDS_LIMIT';
type ThresholdStatus = 'NOT_APPLICABLE' | 'MISSING_EVIDENCE'
  | 'BELOW_OR_AT_THRESHOLD' | 'EXCESS_REPORTED';

export type FinancialRegulationAssessment = Readonly<{
  scope: 'CURRENT_SEASON_ASSESSMENT_ONLY';
  careerId: string;
  clubId: string;
  clubRevision: number;
  availableAtDay: number;
  leagueId: string;
  season: number;
  currency: string;
  financialProfileId: string;
  financialProfileVersion: string;
  annualPlayerWages: number | null;
  wageAllocations: readonly PlayerWageSeasonAllocation[];
  missingWageCommitmentIds: readonly string[];
  hardPayrollCap: Readonly<{
    status: LimitStatus;
    limit: number | null;
    excessMinorUnits: number | null;
  }>;
  luxuryThreshold: Readonly<{
    status: ThresholdStatus;
    threshold: number | null;
    excessMinorUnits: number | null;
    /** Tax rate and collection policy are not defined by this profile. */
    taxMinorUnits: null;
  }>;
  squadCostRatio: Readonly<{
    status: 'NOT_APPLICABLE' | 'UNASSESSED';
    reason: 'MISSING_EVIDENCE' | null;
    limit: number | null;
    ratio: null;
    /** No annual denominator or covered-cost definition is pinned here. */
    missingEvidence: readonly ('ANNUAL_REVENUE_DENOMINATOR' | 'COVERED_SQUAD_COSTS')[];
  }>;
}>;

/** Advisory current-season assessment; it neither authorizes transactions nor applies penalties. */
export const assessCurrentSeasonFinancialRegulation = (
  input: ClubWorldState,
  allocations: readonly PlayerWageSeasonAllocation[] = [],
): FinancialRegulationAssessment => {
  const club = readState(input);
  if (club.season.closureRef !== null) {
    throw new Error('closed-season financial regulation assessment is unavailable');
  }
  if (!Array.isArray(allocations)) {
    throw new Error('invalid wage allocation evidence');
  }
  const profile = club.season.plan.financialProfile;
  const wageCommitments = club.live.finance.commitments.filter((item) =>
    item.category === 'playerWages');
  if (wageCommitments.some((item) => item.budgetBucket !== 'payroll')) {
    throw new Error('player wage commitment outside payroll budget');
  }
  const byCommitment = new Map(wageCommitments.map((item) =>
    [item.commitmentId, item]));
  const seen = new Set<string>();
  for (const allocation of allocations) {
    if (allocation === null || typeof allocation !== 'object'
      || Object.keys(allocation).some((field) => ![
        'commitmentId', 'contractRef', 'season', 'annualMinorUnits',
        'availableAtDay', 'sourceEventId',
      ].includes(field))) {
      throw new Error('invalid wage allocation evidence');
    }
    const commitment = byCommitment.get(allocation.commitmentId);
    if (!commitment || seen.has(allocation.commitmentId)
      || allocation.contractRef !== commitment.contractRef
      || allocation.season !== profile.season
      || !Number.isSafeInteger(allocation.annualMinorUnits)
      || allocation.annualMinorUnits < 0
      || allocation.annualMinorUnits > commitment.amount
        - commitment.cancelledAmount - commitment.paidBeforeSeason
      || allocation.annualMinorUnits < commitment.paidThisSeason
      || !Number.isSafeInteger(allocation.availableAtDay)
      || allocation.availableAtDay < 0
      || allocation.availableAtDay > club.effectiveDay
      || typeof allocation.sourceEventId !== 'string'
      || allocation.sourceEventId.length === 0) {
      throw new Error('invalid wage allocation evidence');
    }
    seen.add(allocation.commitmentId);
  }
  const missingWageCommitmentIds = wageCommitments
    .filter((item) => !seen.has(item.commitmentId))
    .map((item) => item.commitmentId);
  const annualPlayerWages = missingWageCommitmentIds.length === 0
    ? exact(allocations.map((item) => item.annualMinorUnits),
      'annualPlayerWages') : null;
  const hardPayrollCap = profile.hardPayrollCap === null
    ? { status: 'NOT_APPLICABLE' as const, limit: null, excessMinorUnits: null }
    : annualPlayerWages === null
      ? { status: 'MISSING_EVIDENCE' as const, limit: profile.hardPayrollCap,
        excessMinorUnits: null }
      : { status: annualPlayerWages > profile.hardPayrollCap
        ? 'EXCEEDS_LIMIT' as const : 'WITHIN_LIMIT' as const,
      limit: profile.hardPayrollCap,
      excessMinorUnits: annualPlayerWages > profile.hardPayrollCap
        ? exact([annualPlayerWages, -profile.hardPayrollCap],
          'hardPayrollCap.excess') : 0 };
  const luxuryThreshold = profile.luxuryTaxThreshold === null
    ? { status: 'NOT_APPLICABLE' as const, threshold: null,
      excessMinorUnits: null, taxMinorUnits: null }
    : annualPlayerWages === null
      ? { status: 'MISSING_EVIDENCE' as const,
        threshold: profile.luxuryTaxThreshold, excessMinorUnits: null,
        taxMinorUnits: null }
      : { status: annualPlayerWages > profile.luxuryTaxThreshold
        ? 'EXCESS_REPORTED' as const : 'BELOW_OR_AT_THRESHOLD' as const,
      threshold: profile.luxuryTaxThreshold,
      excessMinorUnits: annualPlayerWages > profile.luxuryTaxThreshold
        ? exact([annualPlayerWages, -profile.luxuryTaxThreshold],
          'luxuryThreshold.excess') : 0,
      taxMinorUnits: null };
  return {
    scope: 'CURRENT_SEASON_ASSESSMENT_ONLY', careerId: club.careerId,
    clubId: club.identity.clubId, clubRevision: club.revision,
    availableAtDay: club.effectiveDay, leagueId: profile.leagueId,
    season: profile.season, currency: profile.currency,
    financialProfileId: profile.profileId,
    financialProfileVersion: profile.version, annualPlayerWages,
    wageAllocations: [...allocations], missingWageCommitmentIds,
    hardPayrollCap, luxuryThreshold,
    squadCostRatio: profile.squadCostRatioLimit === null
      ? { status: 'NOT_APPLICABLE', reason: null, limit: null,
        ratio: null, missingEvidence: [] }
      : { status: 'UNASSESSED', reason: 'MISSING_EVIDENCE',
        limit: profile.squadCostRatioLimit, ratio: null,
        missingEvidence: ['ANNUAL_REVENUE_DENOMINATOR',
          'COVERED_SQUAD_COSTS'] },
  };
};
