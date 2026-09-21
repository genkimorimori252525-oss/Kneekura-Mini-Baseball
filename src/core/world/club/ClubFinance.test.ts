import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { applyClubCommand, createClubFromSeed, getClubFinanceSummary, restoreClubState } from './index';
import { bootstrap, command, state, value } from './ClubFixtures.test-support';
import type { ClubOperation, ClubWorldState } from './ClubTypes';

const obligation = (amount = 300, commitmentId = 'contract-a') => ({ kind: 'RECORD_COMMITMENT' as const,
  commitmentId, contractRef: 'signed-' + commitmentId, category: 'playerWages' as const,
  budgetBucket: 'payroll' as const, amount, currency: 'SIM' });
function apply(operations: readonly ClubOperation[], current = state(), id = 'e1'): ClubWorldState {
  const r = applyClubCommand(current, command(operations, current, id)); assert.ok(r.ok, JSON.stringify(r)); return r.state;
}
const summary = (s = state()) => value(getClubFinanceSummary(s));

describe('club accounting and its authority boundaries', () => {
  it('records an obligation without treating an approved budget as cash', () => {
    const s = apply([obligation()]); const q = summary(s);
    assert.equal(s.live.finance.cash, 1000); assert.equal(q.budgetAllocated.payroll, 300);
    assert.equal(q.budgetHeadroom.payroll, 200); assert.equal(q.outstandingCommitments, 300);
    assert.equal(q.paidOperatingCosts, 0); assert.equal(q.scope, 'ACCOUNTING_ONLY');
  });
  it('retains over-budget legal liabilities rather than silently rejecting a real contract', () => {
    const s = apply([obligation(800)]);
    assert.equal(summary(s).budgetHeadroom.payroll, -300); assert.equal(summary(s).outstandingCommitments, 800);
  });
  it('settles partly while retaining the paid allocation', () => {
    const s = apply([obligation(), { kind: 'SETTLE_COMMITMENT', commitmentId: 'contract-a', receiptId: 'pay-1', amount: 100, currency: 'SIM' }]);
    assert.equal(s.live.finance.cash, 900); assert.equal(summary(s).paidOperatingCosts, 100);
    assert.equal(summary(s).outstandingCommitments, 200); assert.equal(summary(s).budgetAllocated.payroll, 300);
    assert.equal(s.live.finance.commitments[0]!.paidThisSeason, 100);
  });
  it('releases only unpaid amounts, never creating a refund of past payment', () => {
    const s = apply([obligation(), { kind: 'SETTLE_COMMITMENT', commitmentId: 'contract-a', receiptId: 'pay-1', amount: 100, currency: 'SIM' },
      { kind: 'RELEASE_COMMITMENT', commitmentId: 'contract-a', amount: 150, currency: 'SIM' }]);
    assert.equal(s.live.finance.cash, 900); assert.equal(summary(s).outstandingCommitments, 50);
    assert.equal(summary(s).budgetAllocated.payroll, 150); assert.equal(summary(s).budgetHeadroom.payroll, 350);
  });
  it('records all revenue categories as actual receipts, including owner funding', () => {
    const categories = ['matchday', 'broadcasting', 'commercial', 'merchandise', 'prizeMoney', 'transferIncome', 'ownerFunding', 'other'] as const;
    const s = apply(categories.map(category => ({ kind: 'RECORD_REVENUE', receiptId: category, category, amount: 10, currency: 'SIM' })));
    assert.equal(s.live.finance.cash, 1080); assert.equal(summary(s).receivedRevenue, 80);
    assert.equal(s.live.finance.revenue.ownerFunding, 10); assert.equal(s.live.finance.debt, 200);
  });
  it('separates debt draw and principal repayment from revenue and operating costs', () => {
    const s = apply([{ kind: 'DRAW_DEBT', receiptId: 'draw', amount: 500, currency: 'SIM' },
      { kind: 'REPAY_DEBT', receiptId: 'repay', amount: 300, currency: 'SIM' }]);
    assert.equal(s.live.finance.cash, 1200); assert.equal(s.live.finance.debt, 400);
    assert.equal(summary(s).receivedRevenue, 0); assert.equal(summary(s).paidOperatingCosts, 0);
  });
  it('does not silently borrow when cash is insufficient', () => {
    const s = apply([obligation(1200)]);
    const r = applyClubCommand(s, command([{ kind: 'SETTLE_COMMITMENT', commitmentId: 'contract-a', receiptId: 'pay', amount: 1100, currency: 'SIM' }], s));
    assert.ok(!r.ok); assert.equal(r.reason.code, 'INSUFFICIENT_CASH'); assert.equal(r.state, s);
  });
  it('allows paying an existing obligation below reserve and reports negative reserve headroom', () => {
    const s = apply([obligation(1000), { kind: 'SETTLE_COMMITMENT', commitmentId: 'contract-a', receiptId: 'pay', amount: 950, currency: 'SIM' }]);
    assert.equal(summary(s).cashAfterReserve, -50); assert.equal(s.live.finance.cash, 50);
  });
  for (const kind of ['SETTLE_COMMITMENT', 'RELEASE_COMMITMENT'] as const) {
    it('rejects over-' + kind + ' without editing the original state', () => {
      const s = apply([obligation()]); const op = kind === 'SETTLE_COMMITMENT'
        ? { kind, commitmentId: 'contract-a', amount: 301, receiptId: 'pay', currency: 'SIM' }
        : { kind, commitmentId: 'contract-a', amount: 301, currency: 'SIM' };
      const r = applyClubCommand(s, command([op], s));
      assert.ok(!r.ok); assert.equal(r.reason.code, 'AMOUNT_EXCEEDS_OUTSTANDING'); assert.equal(r.state, s);
    });
  }
  it('rejects repayment exceeding debt without converting it to a different expense', () => {
    const r = applyClubCommand(state(), command([{ kind: 'REPAY_DEBT', receiptId: 'repay', amount: 201, currency: 'SIM' }]));
    assert.ok(!r.ok); assert.equal(r.reason.code, 'AMOUNT_EXCEEDS_DEBT');
  });
  it('rejects unknown commitments instead of creating a payment from thin air', () => {
    const r = applyClubCommand(state(), command([{ kind: 'SETTLE_COMMITMENT', commitmentId: 'missing', receiptId: 'pay', amount: 1, currency: 'SIM' }]));
    assert.ok(!r.ok); assert.equal(r.reason.code, 'UNKNOWN_COMMITMENT');
  });
  it('rejects duplicate obligation and receipt identifiers', () => {
    const r = applyClubCommand(state(), command([obligation(), obligation()])); assert.ok(!r.ok); assert.equal(r.reason.code, 'DUPLICATE_ID');
    const s = apply([{ kind: 'DRAW_DEBT', receiptId: 'same', amount: 1, currency: 'SIM' }]);
    const r2 = applyClubCommand(s, command([{ kind: 'RECORD_REVENUE', receiptId: 'same', category: 'other', amount: 1, currency: 'SIM' }], s));
    assert.ok(!r2.ok); assert.equal(r2.reason.code, 'DUPLICATE_ID');
  });
  it('rejects another currency without silently converting it', () => {
    const r = applyClubCommand(state(), command([{ ...obligation(), currency: 'OTHER' }]));
    assert.ok(!r.ok); assert.equal(r.reason.code, 'CURRENCY_MISMATCH');
  });
  for (const amount of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    it('rejects invalid amount ' + String(amount), () => {
      const r = applyClubCommand(state(), command([{ kind: 'DRAW_DEBT', receiptId: 'bad', amount, currency: 'SIM' }]));
      assert.ok(!r.ok); assert.equal(r.reason.code, 'INVALID_INPUT');
    });
  }
  it('rejects balance overflow atomically', () => {
    const r = applyClubCommand(state(), command([{ kind: 'DRAW_DEBT', receiptId: 'big', amount: Number.MAX_SAFE_INTEGER, currency: 'SIM' }]));
    assert.ok(!r.ok); assert.equal(r.reason.code, 'OVERFLOW');
  });
  it('checks exact accumulated amounts near the safe-integer boundary', () => {
    const input = bootstrap(); input.initial.cash = Number.MAX_SAFE_INTEGER;
    const s = apply([obligation(100), { kind: 'SETTLE_COMMITMENT', commitmentId: 'contract-a', receiptId: 'p', amount: 100, currency: 'SIM' },
      { kind: 'RECORD_REVENUE', category: 'other', receiptId: 'r', amount: 100, currency: 'SIM' }], value(createClubFromSeed(input)));
    assert.equal(s.live.finance.cash, Number.MAX_SAFE_INTEGER); assert.ok(restoreClubState(s).ok);
  });
  it('rolls back the entire batch if a later operation fails', () => {
    const s = state(); const before = JSON.stringify(s);
    const r = applyClubCommand(s, command([{ kind: 'RECORD_REVENUE', category: 'other', receiptId: 'r', amount: 50, currency: 'SIM' },
      { kind: 'SETTLE_COMMITMENT', commitmentId: 'missing', receiptId: 'p', amount: 20, currency: 'SIM' }], s));
    assert.ok(!r.ok); assert.equal(r.state, s); assert.equal(JSON.stringify(s), before); assert.ok(!('event' in r));
  });
  it('pins receipt season, day and the command cause without holding caller arrays', () => {
    const c = command([{ kind: 'DRAW_DEBT', receiptId: 'draw', amount: 1, currency: 'SIM' }]);
    const r = applyClubCommand(state(), c); assert.ok(r.ok);
    assert.equal(r.state.live.finance.receipts[0]!.season, 1); assert.equal(r.state.live.finance.receipts[0]!.effectiveDay, 11);
    assert.deepEqual(r.state.live.finance.receipts[0]!.causeEventIds, c.causeEventIds);
    assert.notEqual(r.event.command, c); assert.ok(Object.isFrozen(r.event.command.operations));
  });
  it('rejects forged paid totals and mismatched category totals at restore', () => {
    const s = apply([obligation(), { kind: 'SETTLE_COMMITMENT', commitmentId: 'contract-a', receiptId: 'p', amount: 100, currency: 'SIM' }]);
    const copy = JSON.parse(JSON.stringify(s)); copy.live.finance.commitments[0].paidThisSeason = 101;
    assert.ok(!restoreClubState(copy).ok);
    const copy2 = JSON.parse(JSON.stringify(s)); copy2.live.finance.revenue.other = 1;
    assert.ok(!restoreClubState(copy2).ok);
  });
  it('rejects unrecognized finance actions, categories and extra behavior fields', () => {
    for (const op of [{ ...obligation(), category: 'magic' }, { ...obligation(), grantPlayerAbility: 100 }, { kind: 'GIVE_POWER', amount: 10 }]) {
      const c = { ...command([]), operations: [op] }; assert.ok(!applyClubCommand(state(), c).ok);
    }
  });
  it('reports rather than rounds an unrepresentable aggregate summary', () => {
    const max = Number.MAX_SAFE_INTEGER;
    const s = apply([obligation(max, 'a'), obligation(max, 'b')]);
    const r = getClubFinanceSummary(s); assert.ok(!r.ok); assert.equal(r.reason.code, 'OVERFLOW');
  });
});
