import { applyClubCommand } from './ClubLifecycle';
import { readState } from './ClubSchemas';
import type { ClubTransitionEvent, ClubWorldState } from './ClubTypes';
import { getClubSeasonWageAllocations,
  type ClubWageScheduleLedger } from './ClubWageScheduleLedger';

export type AnnualWagePaymentPolicy = Readonly<{
  policyId: string;
  version: string;
  careerId: string;
  clubId: string;
  season: number;
  availableAtDay: number;
  dueAtDay: number;
  currency: string;
}>;
export type ScheduledPlayerWagePaymentBasis = Readonly<{
  commitmentId: string;
  contractRef: string;
  season: number;
  amount: number;
  annualAllocation: number;
  paidBeforeApplication: number;
  sourceClubEventId: string;
  payrollRunEventId: string;
  policyId: string;
  policyVersion: string;
  dueAtDay: number;
  currency: string;
}>;
export type ScheduledPlayerWagePayment = Readonly<{
  state: ClubWorldState;
  event: ClubTransitionEvent;
  basis: ScheduledPlayerWagePaymentBasis;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));

/** Pays this season's remaining scheduled wage after a payroll-run trigger. */
export const applyScheduledPlayerWagePayment = (
  input: ClubWorldState,
  schedules: ClubWageScheduleLedger,
  commitmentId: string,
  policy: AnnualWagePaymentPolicy,
  payrollRunEventId: string,
): ScheduledPlayerWagePayment => {
  const club = readState(input);
  if (!fields(policy, ['policyId', 'version', 'careerId',
    'clubId', 'season', 'availableAtDay', 'dueAtDay', 'currency'])
    || !id(policy.policyId) || !id(policy.version)
    || !id(commitmentId) || !id(payrollRunEventId)
    || policy.careerId !== club.careerId
    || policy.clubId !== club.identity.clubId
    || policy.season !== club.season.plan.season
    || policy.currency !== club.season.plan.financialProfile.currency
    || !day(policy.availableAtDay) || !day(policy.dueAtDay)
    || policy.availableAtDay > club.effectiveDay
    || policy.dueAtDay < club.season.plan.startsOnDay
    || policy.availableAtDay > policy.dueAtDay
    || club.season.closureRef !== null) {
    throw new Error('invalid annual wage payment policy or scope');
  }
  const allocations = getClubSeasonWageAllocations(schedules, club);
  const allocation = allocations.find((item) =>
    item.commitmentId === commitmentId);
  const commitment = club.live.finance.commitments.find((item) =>
    item.commitmentId === commitmentId);
  if (!allocation || !commitment
    || commitment.category !== 'playerWages'
    || commitment.budgetBucket !== 'payroll'
    || commitment.contractRef !== allocation.contractRef
    || payrollRunEventId === allocation.sourceEventId) {
    throw new Error('missing or mismatched player wage schedule');
  }
  const amount = allocation.annualMinorUnits - commitment.paidThisSeason;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('scheduled player wage is already paid');
  }
  const receiptId = `wage/${club.season.plan.season}/${encodeURIComponent(commitmentId)}`;
  if (club.live.finance.receipts.some((receipt) =>
    receipt.receiptId === receiptId)) {
    throw new Error('DUPLICATE_ID: scheduled player wage payment');
  }
  const basis: ScheduledPlayerWagePaymentBasis = Object.freeze({
    commitmentId, contractRef: allocation.contractRef,
    season: club.season.plan.season, amount,
    annualAllocation: allocation.annualMinorUnits,
    paidBeforeApplication: commitment.paidThisSeason,
    sourceClubEventId: allocation.sourceEventId,
    payrollRunEventId, policyId: policy.policyId,
    policyVersion: policy.version, dueAtDay: policy.dueAtDay,
    currency: policy.currency,
  });
  const applied = applyClubCommand(club, {
    eventId: receiptId, careerId: club.careerId,
    clubId: club.identity.clubId, expectedRevision: club.revision,
    effectiveDay: Math.max(club.effectiveDay, policy.dueAtDay),
    causeEventIds: [payrollRunEventId, allocation.sourceEventId],
    operations: [{ kind: 'SETTLE_COMMITMENT',
      receiptId, commitmentId, amount, currency: policy.currency }],
  });
  if (!applied.ok) {
    throw new Error(`${applied.reason.code}: scheduled player wage payment`);
  }
  return Object.freeze({ state: applied.state,
    event: applied.event, basis });
};
