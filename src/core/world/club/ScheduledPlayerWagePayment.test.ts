import { expect, it } from 'vitest';
import { applyClubCommand } from './ClubLifecycle';
import { bootstrap, closure, command, nextPlan } from './ClubFixtures.test-support';
import { createClubFromSeed } from './ClubSeed';
import { appendClubWageSchedule, createClubWageScheduleLedger } from './ClubWageScheduleLedger';
import { applyScheduledPlayerWagePayment } from './ScheduledPlayerWagePayment';

const signed = () => {
  const created = createClubFromSeed(bootstrap());
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  const changed = applyClubCommand(created.value, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
    contractRef: 'contract-1', category: 'playerWages',
    budgetBucket: 'payroll', amount: 300, currency: 'SIM',
  }], created.value, 'contract-1'));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const schedules = appendClubWageSchedule(
    createClubWageScheduleLedger('career-a', 'club-a'), 0,
    changed.state, changed.event, { commitmentId: 'wage-1',
      contractRef: 'contract-1', annualAmounts: [
        { season: 1, amount: 100 }, { season: 2, amount: 200 },
      ] });
  return { state: changed.state, schedules };
};
const policy = (season: number, dueAtDay: number) => ({
  policyId: 'annual-wages', version: 'v1', careerId: 'career-a',
  clubId: 'club-a', season, availableAtDay: 10, dueAtDay,
  currency: 'SIM',
});

it('settles only this season’s wage allocation and carries the rest forward', () => {
  const x = signed();
  const first = applyScheduledPlayerWagePayment(x.state, x.schedules,
    'wage-1', policy(1, 12), 'payroll-run-1');
  expect(first.basis).toMatchObject({ season: 1, amount: 100,
    contractRef: 'contract-1', sourceClubEventId: 'contract-1' });
  expect(first.state.live.finance.cash).toBe(x.state.live.finance.cash - 100);
  expect(first.state.live.finance.commitments[0]).toMatchObject({
    paidThisSeason: 100, paidBeforeSeason: 0 });
  expect(() => applyScheduledPlayerWagePayment(first.state, x.schedules,
    'wage-1', policy(1, 12), 'payroll-run-1')).toThrow();
  const closed = applyClubCommand(first.state,
    command([closure()], first.state, 'close-season'));
  if (!closed.ok) throw new Error(JSON.stringify(closed.reason));
  const plan = nextPlan(closed.state);
  const opened = applyClubCommand(closed.state, {
    ...command([{ kind: 'OPEN_SEASON', plan }],
      closed.state, 'open-season'), effectiveDay: plan.startsOnDay,
  });
  if (!opened.ok) throw new Error(JSON.stringify(opened.reason));
  const second = applyScheduledPlayerWagePayment(opened.state, x.schedules,
    'wage-1', policy(2, plan.startsOnDay + 1), 'payroll-run-2');
  expect(second.basis.amount).toBe(200);
  expect(second.state.live.finance.commitments[0]).toMatchObject({
    paidThisSeason: 200, paidBeforeSeason: 100 });
});

it('rejects stale, mismatched, future and unscheduled wages', () => {
  const x = signed();
  expect(() => applyScheduledPlayerWagePayment(x.state,
    createClubWageScheduleLedger('career-a', 'club-a'),
    'wage-1', policy(1, 12), 'payroll-run-1')).toThrow('schedule');
  expect(() => applyScheduledPlayerWagePayment(x.state, x.schedules,
    'wage-1', { ...policy(1, 12), currency: 'USD' },
    'payroll-run-1')).toThrow('policy');
  expect(() => applyScheduledPlayerWagePayment(x.state, x.schedules,
    'wage-1', { ...policy(1, 12), availableAtDay: 13 },
    'payroll-run-1')).toThrow('policy');
  expect(() => applyScheduledPlayerWagePayment(x.state, x.schedules,
    'wage-1', policy(2, 12), 'payroll-run-1')).toThrow('policy');
});
