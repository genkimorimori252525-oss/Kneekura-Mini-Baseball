import type { ClubCommand, ClubWorldState, ClubResult } from './ClubTypes';
import type { ClubFinanceState, ClubFinanceOperation, ClubFinanceSummary, ClubReceipt, ClubCommitment } from './ClubFinanceTypes';
import { BUDGET_BUCKETS } from './ClubFinanceTypes';
import { readState } from './ClubSchemas';
import { attempt, exact, fail } from './ClubValidation';

export function outstanding(c: ClubCommitment): number {
  return exact([c.amount, -c.paidBeforeSeason, -c.paidThisSeason, -c.cancelledAmount], 'commitment.outstanding');
}
/** Records authoritative transactions/obligations; it does not authorize a signing or financial policy. */
export function reduceFinance(state: ClubWorldState, op: ClubFinanceOperation, command: ClubCommand): ClubFinanceState {
  if (state.season.closureRef !== null) fail('SEASON_CLOSED');
  if (op.currency !== state.season.plan.financialProfile.currency) fail('CURRENCY_MISMATCH');
  const f = state.live.finance;
  if ('receiptId' in op && f.receipts.some(r => r.receiptId === op.receiptId)) fail('DUPLICATE_ID', 'receiptId');
  const receipt = (kind: ClubReceipt['kind'], category: ClubReceipt['category'] = null, commitmentId: string | null = null): ClubReceipt => ({
    receiptId: 'receiptId' in op ? op.receiptId : '', season: state.season.plan.season, effectiveDay: command.effectiveDay,
    kind, amount: op.amount, category, commitmentId, causeEventIds: command.causeEventIds,
  });
  if (op.kind === 'RECORD_REVENUE') {
    return { ...f, cash: exact([f.cash, op.amount], 'cash'), revenue: { ...f.revenue, [op.category]: exact([f.revenue[op.category], op.amount], 'revenue') },
      receipts: [...f.receipts, receipt('REVENUE', op.category)] };
  }
  if (op.kind === 'DRAW_DEBT' || op.kind === 'REPAY_DEBT') {
    const repayment = op.kind === 'REPAY_DEBT';
    if (repayment && op.amount > f.debt) fail('AMOUNT_EXCEEDS_DEBT');
    if (repayment && op.amount > f.cash) fail('INSUFFICIENT_CASH');
    const delta = repayment ? -op.amount : op.amount;
    return { ...f, cash: exact([f.cash, delta], 'cash'), debt: exact([f.debt, delta], 'debt'),
      receipts: [...f.receipts, receipt(repayment ? 'DEBT_REPAYMENT' : 'DEBT_DRAW')] };
  }
  if (op.kind === 'RECORD_COMMITMENT') {
    if (f.commitments.some(c => c.commitmentId === op.commitmentId)) fail('DUPLICATE_ID', 'commitmentId');
    return { ...f, commitments: [...f.commitments, { commitmentId: op.commitmentId, contractRef: op.contractRef,
      category: op.category, budgetBucket: op.budgetBucket, reservationSeason: state.season.plan.season,
      amount: op.amount, paidBeforeSeason: 0, paidThisSeason: 0, cancelledAmount: 0 }] };
  }
  if (op.kind !== 'SETTLE_COMMITMENT' && op.kind !== 'RELEASE_COMMITMENT') fail('INVALID_INPUT', 'operation.kind');
  const c = f.commitments.find(x => x.commitmentId === op.commitmentId);
  if (!c) fail('UNKNOWN_COMMITMENT');
  if (op.amount > outstanding(c)) fail('AMOUNT_EXCEEDS_OUTSTANDING');
  if (op.kind === 'SETTLE_COMMITMENT' && op.amount > f.cash) fail('INSUFFICIENT_CASH');
  const next = op.kind === 'RELEASE_COMMITMENT'
    ? { ...c, cancelledAmount: exact([c.cancelledAmount, op.amount], 'cancelledAmount') }
    : { ...c, paidThisSeason: exact([c.paidThisSeason, op.amount], 'paidThisSeason') };
  return { ...f, cash: op.kind === 'SETTLE_COMMITMENT' ? exact([f.cash, -op.amount], 'cash') : f.cash,
    commitments: f.commitments.map(x => x === c ? next : x),
    receipts: op.kind === 'SETTLE_COMMITMENT' ? [...f.receipts, receipt('COMMITMENT_PAYMENT', null, c.commitmentId)] : f.receipts };
}
export function financeSummary(state: ClubWorldState): ClubFinanceSummary {
  const f = state.live.finance, plan = state.season.plan;
  const budgetAllocated = { payroll: 0, transfers: 0, academy: 0, scouting: 0, coaching: 0, medical: 0, facilities: 0 };
  const budgetHeadroom = { ...budgetAllocated };
  for (const bucket of BUDGET_BUCKETS) {
    budgetAllocated[bucket] = exact(f.commitments.filter(c => c.reservationSeason === plan.season && c.budgetBucket === bucket)
      .map(c => c.amount - c.cancelledAmount), 'budgetAllocated');
    budgetHeadroom[bucket] = exact([plan.approvedBudgets[bucket], -budgetAllocated[bucket]], 'budgetHeadroom', true);
  }
  return { scope: 'ACCOUNTING_ONLY', careerId: state.careerId, clubId: state.identity.clubId, season: plan.season,
    revision: state.revision, currency: plan.financialProfile.currency, cash: f.cash, debt: f.debt,
    receivedRevenue: exact(Object.values(f.revenue), 'receivedRevenue'),
    paidOperatingCosts: exact(f.commitments.map(c => c.paidThisSeason), 'paidOperatingCosts'),
    outstandingCommitments: exact(f.commitments.map(outstanding), 'outstandingCommitments'),
    cashAfterReserve: exact([f.cash, -plan.minimumCashReserve], 'cashAfterReserve', true), budgetAllocated, budgetHeadroom };
}
export const getClubFinanceSummary = (input: ClubWorldState): ClubResult<ClubFinanceSummary> => attempt(() => financeSummary(readState(input)));
