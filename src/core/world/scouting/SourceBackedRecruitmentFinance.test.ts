import { expect, it } from 'vitest';
import { applyClubCommand, createClubFromSeed } from '../club';
import { bootstrap, command } from '../club/ClubFixtures.test-support';
import { createRosterState } from '../roster/RosterState';
import { appendRecruitmentDecisionWithClubFinance,
  appendRecruitmentDecisionWithRosterNeedAndClubFinance,
  createRecruitmentDecisionLedger } from './RecruitmentDecision';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from './ScoutingKnowledge';

const knowledge = appendPlayerKnowledgeReport(appendScoutingEvidence(
  createClubScoutingKnowledge('career-1', 'club-a'), 0, {
    evidenceId: 'e1', careerId: 'career-1', clubId: 'club-a',
    playerId: 'target', observedAtDay: 8, availableAtDay: 10,
    sourceEventId: 'game-1',
  }), 1, {
  reportId: 'r1', careerId: 'career-1', clubId: 'club-a', playerId: 'target',
  observedAtDay: 8, availableAtDay: 10, evidenceSourceIds: ['e1'],
  evaluatorPersonIds: ['scout-1'],
  estimate: [{ domainId: 'contact', lower: 40, upper: 60 }],
  confidence: 'MEDIUM',
});
const decision = () => ({ decisionId: 'd1', careerId: 'career-1',
  clubId: 'club-a', playerId: 'target', decidedAtDay: 12,
  decision: 'BID' as const, authorityPersonId: 'gm-1',
  governanceProfileVersion: 'governance-1', knowledgeReportIds: ['r1'],
  rosterNeedSnapshot: { snapshotId: 'need-1', availableAtDay: 11,
    positionGroup: 'C', horizon: 'NOW' as const, urgency: 1,
    requiredRole: 'starter' },
  fitEstimate: { policyVersion: 'fit-1', availableAtDay: 11,
    lower: 0.4, upper: 0.8 },
  marketContext: { snapshotId: 'market-1', availableAtDay: 11,
    expectedCostMinorUnits: null, knownCompetingClubIds: [] },
  offeredTerms: { currency: 'SIM', totalMinorUnits: 100,
    termSeasons: 1 },
});
const club = () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed,
    context: { ...seed.context, careerId: 'career-1' } });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  return created.value;
};

it('pins current club finance and approved payroll headroom at decision time', () => {
  const initial = club();
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
    contractRef: 'signed-1', category: 'playerWages',
    budgetBucket: 'payroll', amount: 300, currency: 'SIM',
  }], initial));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const ledger = appendRecruitmentDecisionWithClubFinance(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0,
    knowledge, changed.state, 'payroll', decision());
  const record = ledger.decisions[0]!;
  expect(record.budgetContext).toEqual({
    financeSnapshotId: 'career-1:club-a:1:1', availableAtDay: 11,
    currency: 'SIM', availableMinorUnits: 200,
  });
  expect(record.sourceBackedClubFinance).toMatchObject({
    scope: 'CURRENT_SEASON_APPROVED_BUDGET', budgetBucket: 'payroll',
    financialProfileId: 'profile-a', financialProfileVersion: 'rules-v1',
    summary: { revision: 1, cash: 1000, cashAfterReserve: 900,
      budgetAllocated: { payroll: 300 }, budgetHeadroom: { payroll: 200 } },
  });
  expect(Object.isFrozen(record.sourceBackedClubFinance?.summary)).toBe(true);
  expect(initial.live.finance.commitments).toHaveLength(0);
});

it('never presents overdrawn approved budget as spendable', () => {
  const initial = club();
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
    contractRef: 'signed-1', category: 'playerWages',
    budgetBucket: 'payroll', amount: 800, currency: 'SIM',
  }], initial));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const record = appendRecruitmentDecisionWithClubFinance(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0,
    knowledge, changed.state, 'payroll', decision()).decisions[0]!;
  expect(record.budgetContext.availableMinorUnits).toBe(0);
  expect(record.sourceBackedClubFinance?.summary.budgetHeadroom.payroll).toBe(-300);
});

it('rejects future, foreign, closed and invalid club finance sources', () => {
  const ledger = createRecruitmentDecisionLedger('career-1', 'club-a');
  expect(() => appendRecruitmentDecisionWithClubFinance(ledger, 0,
    knowledge, club(), 'payroll', { ...decision(), decidedAtDay: 9 }))
    .toThrow('future');
  expect(() => appendRecruitmentDecisionWithClubFinance(ledger, 0,
    knowledge, club(), 'payroll', { ...decision(), clubId: 'club-b' }))
    .toThrow('scope');
  expect(() => appendRecruitmentDecisionWithClubFinance(ledger, 0,
    knowledge, { ...club(), season: { ...club().season,
      closureRef: 'closed' } }, 'payroll', decision())).toThrow();
  expect(() => appendRecruitmentDecisionWithClubFinance(ledger, 0,
    knowledge, { ...club(), live: { ...club().live,
      finance: { ...club().live.finance, cash: 9999 } } },
    'payroll', decision())).toThrow();
});

it('pins both roster need and finance evidence in one recruitment record', () => {
  const roster = createRosterState({ careerId: 'career-1',
    profiles: [{ profileId: 'test', version: '1', season: 1,
      competitionEditionId: 'edition-1', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'],
      rehabParticipationAllowed: false }],
    units: [], players: [],
  });
  const policy = { version: 'policy-1', availableAtDay: 0, roles: [{
    positionGroup: 'C', requiredRole: 'starter',
    candidateDomainId: 'catcher-role', minimumCandidateEstimate: 1,
    knowledgeDomainId: 'catcher-fit', minimumEstimate: 0.5,
    targetCount: 1,
  }] };
  const need = { careerId: 'career-1', clubId: 'club-a', asOfDay: 11,
    snapshotId: 'need-1', policyVersion: 'policy-1',
    competitionEditionId: 'edition-1', positionGroup: 'C',
    requiredRole: 'starter', horizon: 'NOW' as const,
    candidateDomainId: 'catcher-role', minimumCandidateEstimate: 1,
    knowledgeDomainId: 'catcher-fit', minimumEstimate: 0.5,
    targetCount: 1,
  };
  const { rosterNeedSnapshot: _unused, ...source } = decision();
  const record = appendRecruitmentDecisionWithRosterNeedAndClubFinance(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0,
    knowledge, roster, policy, need, club(), 'payroll', source)
    .decisions[0]!;
  expect(record.sourceBackedRosterNeed).toMatchObject({
    rosterRevision: 0, knowledgeRevision: 2,
  });
  expect(record.sourceBackedClubFinance).toMatchObject({
    budgetBucket: 'payroll', summary: { revision: 0 },
  });
  expect(record.budgetContext.availableMinorUnits).toBe(500);
  expect(record.rosterNeedSnapshot.snapshotId).toBe('need-1');
});
