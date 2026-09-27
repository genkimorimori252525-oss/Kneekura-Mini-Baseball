import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { resolveOfficialGameBoundary } from '../competition/OfficialGameCompletion';
import { applyClubCommand } from './ClubLifecycle';
import { bootstrap, command } from './ClubFixtures.test-support';
import { createClubFromSeed } from './ClubSeed';
import { appendClubWageSchedule, createClubWageScheduleLedger } from './ClubWageScheduleLedger';
import { applyClubEconomyBatch } from './ClubEconomyBatch';

const officialResult = () => {
  const prior: CanonicalMatchState = {
    ruleProfileId: asRuleProfileId('fixture-rules'), inning: 9,
    half: 'top', outs: 2, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null },
    score: { away: 0, home: 1 }, playId: 8,
  };
  const boundary = resolveOfficialGameBoundary({
    gameId: 'game-1', seasonId: 'league-season-1',
    homeClubId: 'club-a', awayClubId: 'club-b',
    policy: { version: 'test-1', minimumInnings: 9, tiesAllowed: false },
    priorMatch: prior,
    application: { applicationId: 'application-9', closureId: 'closure-9',
      previousPlayId: 8, durableRevision: 9,
      appliedMatchState: { ...prior, half: 'bottom', outs: 0, playId: 9 } },
    lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
      inning: index + 1, awayRuns: 0,
      homeRuns: index === 8 ? null : index === 0 ? 1 : 0,
    })), totals: {
      away: { runs: 0, hits: 0, errors: 0 },
      home: { runs: 1, hits: 1, errors: 0 },
    } },
  });
  if (boundary.kind !== 'GAME_FINAL') throw new Error('fixture not final');
  return boundary.result;
};
const signed = (hardPayrollCap: number | null = null,
  luxuryTaxThreshold: number | null = null,
  squadCostRatioLimit: number | null = null) => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed, initial: { ...seed.initial,
    season: { ...seed.initial.season, financialProfile: {
      ...seed.initial.season.financialProfile, hardPayrollCap,
      luxuryTaxThreshold, squadCostRatioLimit,
    } },
  } });
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
  return { club: changed.state, schedules };
};
const matchday = { kind: 'MATCHDAY' as const,
  result: officialResult(), attendance: {
    factId: 'attendance-1', careerId: 'career-a',
    sourceEventId: 'turnstile-1', gameId: 'game-1',
    stadiumId: 'stadium-a', observedAtDay: 12,
    availableAtDay: 12, venueRevisionAtObservation: 1, count: 120,
  }, policy: { version: 'matchday-1', availableAtDay: 10,
    seasonId: 'league-season-1', currency: 'SIM',
    recognizedMinorUnitsPerAttendee: 5 }, finalizedAtDay: 12 };
const wages = { kind: 'PLAYER_WAGE' as const,
  commitmentId: 'wage-1', policy: {
    policyId: 'annual-wages', version: 'v1',
    careerId: 'career-a', clubId: 'club-a', season: 1,
    availableAtDay: 10, dueAtDay: 13, currency: 'SIM',
  }, payrollRunEventId: 'payroll-run-1' };
const structural = { kind: 'STRUCTURAL_REVENUE' as const,
  fact: { factId: 'recurring-fact-1', careerId: 'career-a',
    clubId: 'club-a', season: 1, category: 'commercial' as const,
    settlementRef: 'sponsor-settlement-1',
    sourceEventId: 'sponsor-paid-1', receivedAtDay: 13,
    availableAtDay: 13, capacityRevisionAtReceipt: 2,
    amount: 200, currency: 'SIM' },
  policy: { policyId: 'recurring-policy', version: 'v1',
    careerId: 'career-a', clubId: 'club-a', season: 1,
    availableAtDay: 10, currency: 'SIM', maximumSeasonAmount: 700,
    allowedCategories: ['commercial'] as const } };

it('applies official income then the current-year wage as one ordered result', () => {
  const x = signed();
  const result = applyClubEconomyBatch(x.club, {
    checkpoint: x.club, acceptedEvents: [],
  }, x.schedules, [matchday, wages]);
  expect(result.state.revision).toBe(x.club.revision + 2);
  expect(result.state.live.finance.revenue.matchday).toBe(600);
  expect(result.state.live.finance.cash).toBe(x.club.live.finance.cash + 500);
  expect(result.state.live.finance.commitments[0]?.paidThisSeason).toBe(100);
  expect(result.events.map((event) => event.command.eventId)).toEqual([
    'matchday/league-season-1/game-1', 'wage/1/wage-1',
  ]);
  expect(Object.isFrozen(result.events)).toBe(true);
  expect(x.club.live.finance.revenue.matchday).toBe(0);
});

it('reports pinned financial regulation from the same official economy batch and wage ledger', () => {
  const x = signed(80, 90, 0.5);
  const result = applyClubEconomyBatch(x.club, {
    checkpoint: x.club, acceptedEvents: [],
  }, x.schedules, [matchday, wages]);
  expect(result.financialRegulationAssessment).toMatchObject({
    scope: 'CURRENT_SEASON_ASSESSMENT_ONLY',
    clubRevision: result.state.revision,
    availableAtDay: result.state.effectiveDay,
    leagueId: 'league-a', season: 1, currency: 'SIM',
    financialProfileId: 'profile-a', financialProfileVersion: 'rules-v1',
    annualPlayerWages: 100,
    wageAllocations: [{ commitmentId: 'wage-1',
      sourceEventId: 'contract-1', annualMinorUnits: 100 }],
    hardPayrollCap: { status: 'EXCEEDS_LIMIT', excessMinorUnits: 20 },
    luxuryThreshold: { status: 'EXCESS_REPORTED',
      excessMinorUnits: 10, taxMinorUnits: null },
    squadCostRatio: { status: 'UNASSESSED',
      reason: 'MISSING_EVIDENCE', ratio: null },
  });
  expect(result.state.live.finance.revenue.matchday).toBe(600);
  expect(result.state.live.finance.commitments[0]?.paidThisSeason).toBe(100);
});

it('rejects the whole batch when the second source is invalid', () => {
  const x = signed();
  const before = structuredClone(x.club);
  expect(() => applyClubEconomyBatch(x.club, {
    checkpoint: x.club, acceptedEvents: [],
  }, x.schedules, [matchday, { ...wages,
    policy: { ...wages.policy, currency: 'USD' } }])).toThrow();
  expect(x.club).toEqual(before);
  expect(() => applyClubEconomyBatch(x.club, {
    checkpoint: x.club, acceptedEvents: [],
  }, x.schedules, [matchday, matchday])).toThrow('DUPLICATE_ID');
});

it('adopts a received structural settlement after matchday with the accumulated Club history', () => {
  const x = signed();
  const result = applyClubEconomyBatch(x.club, {
    checkpoint: x.club, acceptedEvents: [],
  }, x.schedules, [matchday, structural, wages]);
  expect(result.events.map((event) => event.command.eventId)).toEqual([
    'matchday/league-season-1/game-1',
    'structural/1/sponsor-settlement-1', 'wage/1/wage-1',
  ]);
  expect(result.state.live.finance.cash).toBe(x.club.live.finance.cash + 700);
  expect(result.state.live.finance.revenue.commercial).toBe(200);
  expect(result.applications[1]).toMatchObject({
    kind: 'STRUCTURAL_REVENUE', basis: { factId: 'recurring-fact-1',
      capacityRevision: 2, sourceEventId: 'sponsor-paid-1',
      amount: 200 },
  });
  expect(result.state.live.finance.receipts.find((receipt) =>
    receipt.category === 'commercial')?.causeEventIds)
    .toEqual(['sponsor-paid-1']);
});

it('rejects stale or duplicate structural settlement within one atomic batch', () => {
  const x = signed();
  const before = structuredClone(x.club);
  expect(() => applyClubEconomyBatch(x.club, {
    checkpoint: x.club, acceptedEvents: [],
  }, x.schedules, [matchday, { ...structural,
    fact: { ...structural.fact,
      capacityRevisionAtReceipt: 1 } }]))
    .toThrow('capacity revision');
  expect(() => applyClubEconomyBatch(x.club, {
    checkpoint: x.club, acceptedEvents: [],
  }, x.schedules, [matchday, structural, { ...structural,
    fact: { ...structural.fact, factId: 'recurring-fact-2',
      receivedAtDay: 14, availableAtDay: 14,
      capacityRevisionAtReceipt: 3 } }]))
    .toThrow('DUPLICATE_ID');
  expect(x.club).toEqual(before);
});
