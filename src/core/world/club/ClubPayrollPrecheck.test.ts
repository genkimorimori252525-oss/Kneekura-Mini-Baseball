import { expect, it } from 'vitest';
import { applyClubCommand, createClubFromSeed } from './index';
import { bootstrap, closure, command, nextPlan, state } from './ClubFixtures.test-support';
import { evaluateClubPayrollPrecheck } from './ClubPayrollPrecheck';

it('checks the current season approved payroll budget before a new offer', () => {
  const initial = state();
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'existing-wage',
    contractRef: 'signed-wage', category: 'playerWages',
    budgetBucket: 'payroll', amount: 300, currency: 'SIM',
  }], initial));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  expect(evaluateClubPayrollPrecheck(changed.state, 200).outcome)
    .toBe('MISSING_WAGE_ALLOCATION_EVIDENCE');
  const allocation = { commitmentId: 'existing-wage',
    contractRef: 'signed-wage', season: 1, annualMinorUnits: 300,
    availableAtDay: changed.state.effectiveDay,
    sourceEventId: 'signed-wage-schedule' };
  expect(evaluateClubPayrollPrecheck(changed.state, 200,
    [allocation])).toMatchObject({
    scope: 'CURRENT_SEASON_BUDGET_AND_HARD_CAP_ONLY',
    outcome: 'WITHIN_COVERED_RULES', proposedMinorUnits: 200,
    approvedPayrollBudget: 500, allocatedPayrollBudget: 300,
    annualPlayerWages: 300, hardPayrollCap: null,
    clubRevision: 1, financialProfileVersion: 'rules-v1',
  });
  expect(evaluateClubPayrollPrecheck(changed.state, 201,
    [allocation]).outcome)
    .toBe('EXCEEDS_APPROVED_BUDGET');
});

it('checks a pinned hard cap separately from the club approved budget', () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed, initial: { ...seed.initial,
    season: { ...seed.initial.season,
      financialProfile: { ...seed.initial.season.financialProfile,
        hardPayrollCap: 250 } } } });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  expect(evaluateClubPayrollPrecheck(created.value, 251).outcome)
    .toBe('EXCEEDS_HARD_PAYROLL_CAP');
  expect(evaluateClubPayrollPrecheck(created.value, 250).outcome)
    .toBe('WITHIN_COVERED_RULES');
});

it('requires contract season allocations before checking a carried wage against a hard cap', () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed, initial: { ...seed.initial,
    season: { ...seed.initial.season,
      financialProfile: { ...seed.initial.season.financialProfile,
        hardPayrollCap: 500 } } } });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  const signed = applyClubCommand(created.value, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
    contractRef: 'signed-1', category: 'playerWages',
    budgetBucket: 'payroll', amount: 300, currency: 'SIM',
  }], created.value));
  if (!signed.ok) throw new Error(JSON.stringify(signed.reason));
  const closed = applyClubCommand(signed.state,
    command([closure()], signed.state, 'close-season'));
  if (!closed.ok) throw new Error(JSON.stringify(closed.reason));
  const priorPlan = nextPlan(closed.state);
  const plan = { ...priorPlan, approvedBudgets: {
    ...priorPlan.approvedBudgets, payroll: 800 } };
  const opened = applyClubCommand(closed.state, {
    ...command([{ kind: 'OPEN_SEASON', plan }], closed.state, 'open-season'),
    effectiveDay: plan.startsOnDay,
  });
  if (!opened.ok) throw new Error(JSON.stringify(opened.reason));
  expect(evaluateClubPayrollPrecheck(opened.state, 200).outcome)
    .toBe('MISSING_WAGE_ALLOCATION_EVIDENCE');
  const allocation = { commitmentId: 'wage-1',
    contractRef: 'signed-1', season: 2, annualMinorUnits: 200,
    availableAtDay: opened.state.effectiveDay,
    sourceEventId: 'contract-schedule-1' };
  expect(evaluateClubPayrollPrecheck(opened.state, 300,
    [allocation])).toMatchObject({
    outcome: 'WITHIN_COVERED_RULES', annualPlayerWages: 200,
    wageAllocations: [allocation],
  });
  expect(evaluateClubPayrollPrecheck(opened.state, 301,
    [allocation]).outcome).toBe('EXCEEDS_HARD_PAYROLL_CAP');
  expect(() => evaluateClubPayrollPrecheck(opened.state, 100,
    [{ ...allocation, contractRef: 'foreign' }])).toThrow();
  const contaminatedAllocation = { ...allocation, hiddenFutureValue: 99 };
  expect(() => evaluateClubPayrollPrecheck(opened.state, 100,
    [contaminatedAllocation])).toThrow();
});

it('counts released wage obligations but leaves actual signed liability unchanged', () => {
  const initial = state();
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'existing-wage',
    contractRef: 'signed-wage', category: 'playerWages',
    budgetBucket: 'payroll', amount: 400, currency: 'SIM',
  }, { kind: 'RELEASE_COMMITMENT', commitmentId: 'existing-wage',
    amount: 100, currency: 'SIM' }], initial));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const precheck = evaluateClubPayrollPrecheck(changed.state, 200, [{
    commitmentId: 'existing-wage', contractRef: 'signed-wage',
    season: 1, annualMinorUnits: 300,
    availableAtDay: changed.state.effectiveDay,
    sourceEventId: 'signed-wage-schedule',
  }]);
  expect(precheck.outcome).toBe('WITHIN_COVERED_RULES');
  expect(precheck.allocatedPayrollBudget).toBe(300);
  expect(changed.state.live.finance.commitments[0]).toMatchObject({
    amount: 400, cancelledAmount: 100,
  });
});

it('rejects invalid, closed, and inconsistent payroll sources', () => {
  expect(() => evaluateClubPayrollPrecheck(state(), -1)).toThrow();
  expect(() => evaluateClubPayrollPrecheck(state(), Number.MAX_SAFE_INTEGER + 1))
    .toThrow();
  const initial = state();
  expect(() => evaluateClubPayrollPrecheck({ ...initial,
    season: { ...initial.season, closureRef: 'closed' } }, 10)).toThrow();
  expect(() => evaluateClubPayrollPrecheck({ ...initial,
    live: { ...initial.live, finance: { ...initial.live.finance,
      cash: 5000 } } }, 10)).toThrow();
});
