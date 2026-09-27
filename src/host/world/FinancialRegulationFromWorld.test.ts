import { expect, it } from 'vitest';
import { bootstrap, command, state } from
  '../../core/world/club/ClubFixtures.test-support';
import { appendClubWageSchedule,
  createClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import { assessCurrentSeasonFinancialRegulation } from
  '../../core/world/club/FinancialRegulationAssessment';
import { applyClubCommand, createClubFromSeed } from
  '../../core/world/club';
import { readCurrentFinancialRegulationFromWorld } from
  './FinancialRegulationFromWorld';

it('assesses the pinned Club profile against the accepted wage head', () => {
  const club = state();
  const ledger = createClubWageScheduleLedger('career-a', 'club-a');
  const sources = {
    world: { readClub: (careerId: string, clubId: string) =>
      careerId === 'career-a' && clubId === 'club-a'
        ? { careerId, clubId, revision: club.revision,
          state: club } : null },
    wages: { readWageSchedules: (careerId: string,
      clubId: string) => careerId === 'career-a'
        && clubId === 'club-a' ? ledger : null },
  };
  const assessment = readCurrentFinancialRegulationFromWorld(
    sources, 'career-a', 'club-a');
  expect(assessment).toEqual(
    assessCurrentSeasonFinancialRegulation(club, []));
  expect(assessment).toMatchObject({
    scope: 'CURRENT_SEASON_ASSESSMENT_ONLY',
    careerId: 'career-a', clubId: 'club-a',
    clubRevision: club.revision,
  });
  expect(assessment).not.toHaveProperty('penalty');
  expect(() => readCurrentFinancialRegulationFromWorld(
    sources, 'career-a', 'missing')).toThrow('durable');
  expect(() => readCurrentFinancialRegulationFromWorld({
    ...sources,
    wages: { readWageSchedules: () => null },
  }, 'career-a', 'club-a')).toThrow('durable');
});

it('uses the accepted annual wage split for the current League season', () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed,
    initial: { ...seed.initial, season: {
      ...seed.initial.season, financialProfile: {
        ...seed.initial.season.financialProfile,
        hardPayrollCap: 250,
      },
    } },
  });
  if (!created.ok) throw new Error('fixture club creation failed');
  const committed = applyClubCommand(created.value,
    command([{ kind: 'RECORD_COMMITMENT',
      commitmentId: 'wage-1', contractRef: 'contract-1',
      category: 'playerWages', budgetBucket: 'payroll',
      amount: 300, currency: 'SIM' }],
    created.value, 'contract-1'));
  if (!committed.ok) throw new Error('fixture wage commitment failed');
  const ledger = appendClubWageSchedule(
    createClubWageScheduleLedger('career-a', 'club-a'), 0,
    committed.state, committed.event,
    { commitmentId: 'wage-1', contractRef: 'contract-1',
      annualAmounts: [{ season: 1, amount: 100 },
        { season: 2, amount: 200 }] });
  const assessment = readCurrentFinancialRegulationFromWorld({
    world: { readClub: () => ({ careerId: 'career-a',
      clubId: 'club-a', revision: committed.state.revision,
      state: committed.state }) },
    wages: { readWageSchedules: () => ledger },
  }, 'career-a', 'club-a');
  expect(assessment.annualPlayerWages).toBe(100);
  expect(assessment.hardPayrollCap.status).toBe('WITHIN_LIMIT');
  expect(assessment.wageAllocations[0]).toMatchObject({
    sourceEventId: committed.event.command.eventId,
    annualMinorUnits: 100,
  });
});
