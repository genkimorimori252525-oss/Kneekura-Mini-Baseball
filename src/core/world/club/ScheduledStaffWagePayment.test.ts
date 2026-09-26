import { expect, it } from 'vitest';
import { applyClubCommand } from './ClubLifecycle';
import { bootstrap, closure, command, nextPlan } from './ClubFixtures.test-support';
import { createClubFromSeed } from './ClubSeed';
import { appendClubWageSchedule,
  createClubWageScheduleLedger } from './ClubWageScheduleLedger';
import { applyScheduledStaffWagePayment } from './ScheduledStaffWagePayment';

const signed = () => {
  const created = createClubFromSeed(bootstrap());
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  const changed = applyClubCommand(created.value, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'staff-wage-1',
    contractRef: 'manager-contract-1', category: 'staffWages',
    budgetBucket: 'coaching', amount: 60, currency: 'SIM',
  }], created.value, 'manager-contract-1'));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const schedules = appendClubWageSchedule(
    createClubWageScheduleLedger('career-a', 'club-a'), 0,
    changed.state, changed.event, {
      commitmentId: 'staff-wage-1',
      contractRef: 'manager-contract-1', annualAmounts: [
        { season: 1, amount: 20 },
        { season: 2, amount: 20 },
        { season: 3, amount: 20 },
      ],
    });
  return { state: changed.state, schedules };
};
const policy = (season: number, dueAtDay: number) => ({
  policyId: 'annual-staff-wages', version: 'v1',
  careerId: 'career-a', clubId: 'club-a', season,
  availableAtDay: 10, dueAtDay, currency: 'SIM',
});

it('settles only the due staff salary and carries the rest into the next season', () => {
  const initial = signed();
  const first = applyScheduledStaffWagePayment(initial.state,
    initial.schedules, 'staff-wage-1', policy(1, 12),
    'staff-payroll-run-1');
  expect(first.basis).toMatchObject({ season: 1, amount: 20,
    annualAllocation: 20,
    contractRef: 'manager-contract-1',
    sourceClubEventId: 'manager-contract-1' });
  expect(first.state.live.finance.cash)
    .toBe(initial.state.live.finance.cash - 20);
  expect(first.state.live.finance.commitments[0]).toMatchObject({
    paidThisSeason: 20, paidBeforeSeason: 0 });
  expect(() => applyScheduledStaffWagePayment(first.state,
    initial.schedules, 'staff-wage-1', policy(1, 12),
    'staff-payroll-run-1')).toThrow('already paid');
  const closed = applyClubCommand(first.state,
    command([closure()], first.state, 'close-season'));
  if (!closed.ok) throw new Error(JSON.stringify(closed.reason));
  const plan = nextPlan(closed.state);
  const opened = applyClubCommand(closed.state, {
    ...command([{ kind: 'OPEN_SEASON', plan }],
      closed.state, 'open-season'),
    effectiveDay: plan.startsOnDay,
  });
  if (!opened.ok) throw new Error(JSON.stringify(opened.reason));
  const second = applyScheduledStaffWagePayment(opened.state,
    initial.schedules, 'staff-wage-1',
    policy(2, plan.startsOnDay + 1),
    'staff-payroll-run-2');
  expect(second.basis.amount).toBe(20);
  expect(second.state.live.finance.commitments[0]).toMatchObject({
    paidThisSeason: 20, paidBeforeSeason: 20 });
});

it('rejects wrong-category, missing and unavailable staff schedules', () => {
  const initial = signed();
  expect(() => applyScheduledStaffWagePayment(initial.state,
    createClubWageScheduleLedger('career-a', 'club-a'),
    'staff-wage-1', policy(1, 12),
    'staff-payroll-run-1')).toThrow('schedule');
  expect(() => applyScheduledStaffWagePayment(initial.state,
    initial.schedules, 'staff-wage-1',
    { ...policy(1, 12), availableAtDay: 13 },
    'staff-payroll-run-1')).toThrow('policy');
  expect(() => applyScheduledStaffWagePayment(initial.state,
    initial.schedules, 'staff-wage-1', policy(2, 12),
    'staff-payroll-run-1')).toThrow('policy');
  const wrong = { ...initial.schedules,
    schedules: [{ ...initial.schedules.schedules[0]!,
      category: 'playerWages' as const,
      budgetBucket: 'payroll' as const }] };
  expect(() => applyScheduledStaffWagePayment(initial.state,
    wrong, 'staff-wage-1', policy(1, 12),
    'staff-payroll-run-1')).toThrow('schedule');
});
