import { financeSummary } from './ClubFinance';
import { readState } from './ClubSchemas';
import type { ClubWorldState } from './ClubTypes';
import { exact } from './ClubValidation';

export type PlayerWageSeasonAllocation = Readonly<{
  commitmentId: string;
  contractRef: string;
  season: number;
  annualMinorUnits: number;
  availableAtDay: number;
  sourceEventId: string;
}>;

export type ClubPayrollPrecheck = Readonly<{
  scope: 'CURRENT_SEASON_BUDGET_AND_HARD_CAP_ONLY';
  outcome: 'WITHIN_COVERED_RULES' | 'EXCEEDS_APPROVED_BUDGET'
    | 'EXCEEDS_HARD_PAYROLL_CAP' | 'MISSING_WAGE_ALLOCATION_EVIDENCE';
  failedChecks: readonly ('APPROVED_BUDGET' | 'HARD_PAYROLL_CAP'
    | 'WAGE_ALLOCATION_EVIDENCE')[];
  careerId: string;
  clubId: string;
  clubRevision: number;
  availableAtDay: number;
  season: number;
  currency: string;
  financialProfileId: string;
  financialProfileVersion: string;
  proposedMinorUnits: number;
  approvedPayrollBudget: number;
  allocatedPayrollBudget: number | null;
  annualPlayerWages: number | null;
  wageAllocations: readonly PlayerWageSeasonAllocation[];
  hardPayrollCap: number | null;
}>;

/** Prechecks only the covered rules. It does not sign or record a contract. */
export const evaluateClubPayrollPrecheck = (
  input: ClubWorldState,
  proposedMinorUnits: number,
  allocations: readonly PlayerWageSeasonAllocation[] = [],
): ClubPayrollPrecheck => {
  const club = readState(input);
  if (club.season.closureRef !== null) {
    throw new Error('closed-season payroll precheck is unavailable');
  }
  if (!Number.isSafeInteger(proposedMinorUnits) || proposedMinorUnits <= 0) {
    throw new Error('invalid proposed current-season payroll amount');
  }
  const summary = financeSummary(club);
  const profile = club.season.plan.financialProfile;
  const wageCommitments = club.live.finance.commitments
    .filter((commitment) => commitment.category === 'playerWages');
  if (wageCommitments.some((commitment) =>
    commitment.budgetBucket !== 'payroll')) {
    throw new Error('player wage commitment outside payroll budget');
  }
  if (!Array.isArray(allocations)) {
    throw new Error('invalid wage allocation evidence');
  }
  for (const allocation of allocations) {
    if (allocation === null || typeof allocation !== 'object'
      || Object.keys(allocation).some((field) => ![
        'commitmentId', 'contractRef', 'season', 'annualMinorUnits',
        'availableAtDay', 'sourceEventId',
      ].includes(field))) {
      throw new Error('invalid wage allocation evidence');
    }
    const commitment = wageCommitments.find((item) =>
      item.commitmentId === allocation.commitmentId);
    if (!commitment || allocation.contractRef !== commitment.contractRef
      || allocation.season !== summary.season
      || !Number.isSafeInteger(allocation.annualMinorUnits)
      || allocation.annualMinorUnits < 0
      || allocation.annualMinorUnits > commitment.amount
        - commitment.cancelledAmount - commitment.paidBeforeSeason
      || !Number.isSafeInteger(allocation.availableAtDay)
      || allocation.availableAtDay > club.effectiveDay
      || allocation.availableAtDay < 0
      || typeof allocation.sourceEventId !== 'string'
      || allocation.sourceEventId.length === 0) {
      throw new Error('invalid wage allocation evidence');
    }
  }
  if (new Set(allocations.map((allocation) => allocation.commitmentId)).size
    !== allocations.length) {
    throw new Error('duplicate wage allocation evidence');
  }
  const completeAllocations = allocations.length === wageCommitments.length;
  const annualPlayerWages = completeAllocations
    ? exact(allocations.map((allocation) => allocation.annualMinorUnits),
      'annualPlayerWages') : null;
  const recordedWageReservations = exact(wageCommitments
    .filter((commitment) => commitment.reservationSeason === summary.season)
    .map((commitment) => commitment.amount - commitment.cancelledAmount),
  'recordedWageReservations');
  const nonWagePayroll = exact([
    summary.budgetAllocated.payroll, -recordedWageReservations,
  ], 'nonWagePayroll');
  const allocatedPayrollBudget = annualPlayerWages === null ? null
    : exact([nonWagePayroll, annualPlayerWages],
      'allocatedPayrollBudget');
  const proposedPayroll = allocatedPayrollBudget === null ? null
    : exact([allocatedPayrollBudget, proposedMinorUnits],
      'proposedPayroll');
  const proposedPlayerWages = annualPlayerWages === null ? null
    : exact([annualPlayerWages, proposedMinorUnits],
      'proposedPlayerWages');
  const failedChecks: ('APPROVED_BUDGET' | 'HARD_PAYROLL_CAP'
    | 'WAGE_ALLOCATION_EVIDENCE')[] = [];
  if (proposedPayroll === null) {
    failedChecks.push('WAGE_ALLOCATION_EVIDENCE');
  } else if (proposedPayroll > club.season.plan.approvedBudgets.payroll) {
    failedChecks.push('APPROVED_BUDGET');
  }
  if (profile.hardPayrollCap !== null) {
    if (proposedPlayerWages !== null
      && proposedPlayerWages > profile.hardPayrollCap) {
      failedChecks.push('HARD_PAYROLL_CAP');
    }
  }
  return {
    scope: 'CURRENT_SEASON_BUDGET_AND_HARD_CAP_ONLY',
    outcome: failedChecks.includes('APPROVED_BUDGET')
      ? 'EXCEEDS_APPROVED_BUDGET'
      : failedChecks.includes('WAGE_ALLOCATION_EVIDENCE')
        ? 'MISSING_WAGE_ALLOCATION_EVIDENCE'
      : failedChecks.includes('HARD_PAYROLL_CAP')
        ? 'EXCEEDS_HARD_PAYROLL_CAP' : 'WITHIN_COVERED_RULES',
    failedChecks, careerId: summary.careerId, clubId: summary.clubId,
    clubRevision: summary.revision, availableAtDay: club.effectiveDay,
    season: summary.season, currency: summary.currency,
    financialProfileId: profile.profileId,
    financialProfileVersion: profile.version, proposedMinorUnits,
    approvedPayrollBudget: club.season.plan.approvedBudgets.payroll,
    allocatedPayrollBudget,
    annualPlayerWages, wageAllocations: [...allocations],
    hardPayrollCap: profile.hardPayrollCap,
  };
};
