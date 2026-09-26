import { expect, it } from 'vitest';
import { applyClubCommand } from './index';
import { bootstrap, closure, command, nextPlan, state } from './ClubFixtures.test-support';
import { createClubFromSeed } from './ClubSeed';
import { evaluateClubPayrollPrecheck } from './ClubPayrollPrecheck';
import { appendClubWageSchedule, createClubWageScheduleLedger,
  getClubSeasonWageAllocations } from './ClubWageScheduleLedger';

const signed = () => {
  const input = state();
  const changed = applyClubCommand(input, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
    contractRef: 'contract-1', category: 'playerWages',
    budgetBucket: 'payroll', amount: 300, currency: 'SIM',
  }], input, 'contract-event-1'));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  return changed;
};
const schedule = () => ({ commitmentId: 'wage-1',
  contractRef: 'contract-1', annualAmounts: [
    { season: 1, amount: 100 }, { season: 2, amount: 200 },
  ] });

it('binds an annual schedule to the actual signed club commitment event', () => {
  const changed = signed();
  const ledger = appendClubWageSchedule(
    createClubWageScheduleLedger('career-a', 'club-a'), 0,
    changed.state, changed.event, schedule());
  expect(ledger).toMatchObject({ careerId: 'career-a', clubId: 'club-a',
    revision: 1, schedules: [{ commitmentId: 'wage-1',
      sourceClubEventId: 'contract-event-1', sourceClubRevision: 1,
      totalMinorUnits: 300, annualAmounts: schedule().annualAmounts }] });
  expect(Object.isFrozen(ledger.schedules[0]?.annualAmounts[0])).toBe(true);
  expect(getClubSeasonWageAllocations(ledger, changed.state)).toEqual([{
    commitmentId: 'wage-1', contractRef: 'contract-1', season: 1,
    annualMinorUnits: 100, availableAtDay: changed.state.effectiveDay,
    sourceEventId: 'contract-event-1',
  }]);
  expect(evaluateClubPayrollPrecheck(changed.state, 400,
    getClubSeasonWageAllocations(ledger, changed.state)).outcome)
    .toBe('WITHIN_COVERED_RULES');
});

it('carries the same signed schedule into the next season without reseeding wages', () => {
  const changed = signed();
  const ledger = appendClubWageSchedule(
    createClubWageScheduleLedger('career-a', 'club-a'), 0,
    changed.state, changed.event, schedule());
  const closed = applyClubCommand(changed.state,
    command([closure()], changed.state, 'close-season'));
  if (!closed.ok) throw new Error(JSON.stringify(closed.reason));
  const plan = nextPlan(closed.state);
  const opened = applyClubCommand(closed.state, {
    ...command([{ kind: 'OPEN_SEASON', plan }], closed.state, 'open-season'),
    effectiveDay: plan.startsOnDay,
  });
  if (!opened.ok) throw new Error(JSON.stringify(opened.reason));
  const allocations = getClubSeasonWageAllocations(ledger, opened.state);
  expect(allocations).toMatchObject([{ season: 2, annualMinorUnits: 200 }]);
  expect(evaluateClubPayrollPrecheck(opened.state, 301,
    allocations).outcome).toBe('EXCEEDS_APPROVED_BUDGET');
});

it('rejects fabricated, mismatched and duplicate contract schedules', () => {
  const changed = signed();
  const initial = createClubWageScheduleLedger('career-a', 'club-a');
  expect(() => appendClubWageSchedule(initial, 0, changed.state,
    changed.event, { ...schedule(), annualAmounts: [{ season: 1,
      amount: 299 }] })).toThrow();
  expect(() => appendClubWageSchedule(initial, 0, changed.state,
    changed.event, { ...schedule(), contractRef: 'wrong' })).toThrow();
  expect(() => appendClubWageSchedule(initial, 0, state(),
    changed.event, schedule())).toThrow();
  const ledger = appendClubWageSchedule(initial, 0, changed.state,
    changed.event, schedule());
  expect(() => appendClubWageSchedule(ledger, 0, changed.state,
    changed.event, schedule())).toThrow();
  expect(() => appendClubWageSchedule(ledger, 1, changed.state,
    changed.event, schedule())).toThrow();
  const foreign = bootstrap();
  const other = createClubFromSeed({ ...foreign, context: {
    ...foreign.context, careerId: 'other-career' } });
  if (!other.ok) throw new Error(JSON.stringify(other.reason));
  expect(() => getClubSeasonWageAllocations(ledger, other.value)).toThrow();
});

it('fails closed when a wage liability lacks a schedule or is later released', () => {
  const changed = signed();
  const empty = createClubWageScheduleLedger('career-a', 'club-a');
  expect(() => getClubSeasonWageAllocations(empty, changed.state)).toThrow();
  const ledger = appendClubWageSchedule(empty, 0, changed.state,
    changed.event, schedule());
  const released = applyClubCommand(changed.state, command([{
    kind: 'RELEASE_COMMITMENT', commitmentId: 'wage-1',
    amount: 50, currency: 'SIM',
  }], changed.state, 'release-1'));
  if (!released.ok) throw new Error(JSON.stringify(released.reason));
  expect(() => getClubSeasonWageAllocations(ledger,
    released.state)).toThrow();
});

it('rejects corrupted saved schedule totals and duplicate records', () => {
  const changed = signed();
  const ledger = appendClubWageSchedule(
    createClubWageScheduleLedger('career-a', 'club-a'), 0,
    changed.state, changed.event, schedule());
  const corrupted = JSON.parse(JSON.stringify(ledger));
  corrupted.schedules[0]!.annualAmounts[0]!.amount = 101;
  expect(() => getClubSeasonWageAllocations(corrupted,
    changed.state)).toThrow('total');
  const duplicate = JSON.parse(JSON.stringify(ledger));
  duplicate.schedules.push(duplicate.schedules[0]!);
  duplicate.revision = 2;
  expect(() => getClubSeasonWageAllocations(duplicate,
    changed.state)).toThrow();
});
