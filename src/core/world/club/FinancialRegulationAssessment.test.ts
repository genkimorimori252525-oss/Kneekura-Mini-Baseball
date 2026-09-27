import { expect, it } from 'vitest';
import { applyClubCommand, createClubFromSeed } from './index';
import { bootstrap, command, state } from './ClubFixtures.test-support';
import { assessCurrentSeasonFinancialRegulation } from './FinancialRegulationAssessment';

it('uses the pinned league-season profile and reports a hard-cap breach without applying a sanction', () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed, initial: { ...seed.initial,
    season: { ...seed.initial.season, financialProfile: {
      ...seed.initial.season.financialProfile, hardPayrollCap: 250,
      luxuryTaxThreshold: 200, squadCostRatioLimit: 0.7,
    } },
  } });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  const changed = applyClubCommand(created.value, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1', contractRef: 'signed-1',
    category: 'playerWages', budgetBucket: 'payroll', amount: 300,
    currency: 'SIM',
  }], created.value));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const allocation = { commitmentId: 'wage-1', contractRef: 'signed-1',
    season: 1, annualMinorUnits: 300, availableAtDay: changed.state.effectiveDay,
    sourceEventId: 'schedule-1' };
  const assessment = assessCurrentSeasonFinancialRegulation(changed.state,
    [allocation]);
  expect(assessment).toMatchObject({
    scope: 'CURRENT_SEASON_ASSESSMENT_ONLY', careerId: 'career-a',
    clubId: 'club-a', clubRevision: changed.state.revision,
    leagueId: 'league-a', season: 1, currency: 'SIM',
    financialProfileId: 'profile-a', financialProfileVersion: 'rules-v1',
    annualPlayerWages: 300, wageAllocations: [allocation],
    hardPayrollCap: { status: 'EXCEEDS_LIMIT', limit: 250, excessMinorUnits: 50 },
    luxuryThreshold: { status: 'EXCESS_REPORTED', threshold: 200,
      excessMinorUnits: 100, taxMinorUnits: null },
    squadCostRatio: { status: 'UNASSESSED', reason: 'MISSING_EVIDENCE',
      limit: 0.7, ratio: null },
  });
  expect(changed.state.live.finance.commitments[0]?.amount).toBe(300);
});

it('does not report compliance when a recorded wage lacks season allocation evidence', () => {
  const initial = state();
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1', contractRef: 'signed-1',
    category: 'playerWages', budgetBucket: 'payroll', amount: 300,
    currency: 'SIM',
  }], initial));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const withRules = { ...changed.state, season: { ...changed.state.season,
    plan: { ...changed.state.season.plan, financialProfile: {
      ...changed.state.season.plan.financialProfile,
      hardPayrollCap: 250, luxuryTaxThreshold: 200,
    } },
  } };
  expect(assessCurrentSeasonFinancialRegulation(withRules)).toMatchObject({
    annualPlayerWages: null,
    hardPayrollCap: { status: 'MISSING_EVIDENCE', excessMinorUnits: null },
    luxuryThreshold: { status: 'MISSING_EVIDENCE', excessMinorUnits: null,
      taxMinorUnits: null },
  });
});

it('treats absent optional thresholds as inapplicable and never infers a ratio from received revenue', () => {
  const result = assessCurrentSeasonFinancialRegulation(state());
  expect(result).toMatchObject({
    annualPlayerWages: 0,
    hardPayrollCap: { status: 'NOT_APPLICABLE', limit: null },
    luxuryThreshold: { status: 'NOT_APPLICABLE', threshold: null,
      taxMinorUnits: null },
    squadCostRatio: { status: 'NOT_APPLICABLE', limit: null },
  });
});

it('leaves the ratio unassessed even when current-season receipts exist', () => {
  const initial = state();
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_REVENUE', receiptId: 'broadcast-1',
    category: 'broadcasting', amount: 600, currency: 'SIM',
  }], initial));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const withRatioRule = { ...changed.state, season: { ...changed.state.season,
    plan: { ...changed.state.season.plan, financialProfile: {
      ...changed.state.season.plan.financialProfile,
      squadCostRatioLimit: 0.7,
    } },
  } };
  expect(assessCurrentSeasonFinancialRegulation(withRatioRule)
    .squadCostRatio).toMatchObject({ status: 'UNASSESSED',
    reason: 'MISSING_EVIDENCE', ratio: null,
    missingEvidence: ['ANNUAL_REVENUE_DENOMINATOR',
      'COVERED_SQUAD_COSTS'] });
});

it('rejects unrelated, future, or malformed wage allocation evidence', () => {
  const initial = state();
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1', contractRef: 'signed-1',
    category: 'playerWages', budgetBucket: 'payroll', amount: 300,
    currency: 'SIM',
  }], initial));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const allocation = { commitmentId: 'wage-1', contractRef: 'signed-1',
    season: 1, annualMinorUnits: 300, availableAtDay: changed.state.effectiveDay,
    sourceEventId: 'schedule-1' };
  expect(() => assessCurrentSeasonFinancialRegulation(changed.state,
    [{ ...allocation, availableAtDay: changed.state.effectiveDay + 1 }]))
    .toThrow();
  expect(() => assessCurrentSeasonFinancialRegulation(changed.state,
    [{ ...allocation, commitmentId: 'foreign' }])).toThrow();
  expect(() => assessCurrentSeasonFinancialRegulation(changed.state,
    [allocation, allocation])).toThrow();
  const contaminatedAllocation = { ...allocation, hiddenFutureValue: 1 };
  expect(() => assessCurrentSeasonFinancialRegulation(changed.state,
    [contaminatedAllocation])).toThrow();
});

it('rejects an annual allocation smaller than actual current-season wage payments', () => {
  const initial = state();
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1', contractRef: 'signed-1',
    category: 'playerWages', budgetBucket: 'payroll', amount: 300,
    currency: 'SIM',
  }, { kind: 'SETTLE_COMMITMENT', receiptId: 'wage-paid-1',
    commitmentId: 'wage-1', amount: 200, currency: 'SIM' }], initial));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  expect(() => assessCurrentSeasonFinancialRegulation(changed.state, [{
    commitmentId: 'wage-1', contractRef: 'signed-1', season: 1,
    annualMinorUnits: 100, availableAtDay: changed.state.effectiveDay,
    sourceEventId: 'schedule-1',
  }])).toThrow();
});
