import { expect, it } from 'vitest';
import { createRosterState } from '../roster/RosterState';
import { appendRecruitmentDecisionWithRosterNeed,
  createRecruitmentDecisionLedger } from './RecruitmentDecision';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from './ScoutingKnowledge';

const roster = createRosterState({ careerId: 'career-1',
  profiles: [{ profileId: 'test', version: '1', season: 2026,
    competitionEditionId: 'edition-1', activeLimit: null,
    allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
  units: [], players: [],
});
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
const need = { careerId: 'career-1', clubId: 'club-a', asOfDay: 11,
  snapshotId: 'need-1', policyVersion: 'policy-1',
  competitionEditionId: 'edition-1', positionGroup: 'C',
  requiredRole: 'starter', horizon: 'NOW' as const,
  candidateDomainId: 'catcher-role', minimumCandidateEstimate: 1,
  knowledgeDomainId: 'catcher-fit', minimumEstimate: 0.5, targetCount: 1,
};
const policy = { version: 'policy-1', availableAtDay: 0, roles: [{
  positionGroup: 'C', requiredRole: 'starter',
  candidateDomainId: 'catcher-role', minimumCandidateEstimate: 1,
  knowledgeDomainId: 'catcher-fit', minimumEstimate: 0.5, targetCount: 1,
}] };
const decision = () => ({ decisionId: 'd1', careerId: 'career-1',
  clubId: 'club-a', playerId: 'target', decidedAtDay: 12,
  decision: 'SHORTLIST' as const, authorityPersonId: 'gm-1',
  governanceProfileVersion: 'governance-1', knowledgeReportIds: ['r1'],
  budgetContext: { financeSnapshotId: 'finance-1', availableAtDay: 11,
    currency: 'JPY', availableMinorUnits: 100 },
  fitEstimate: { policyVersion: 'fit-1', availableAtDay: 11,
    lower: 0.4, upper: 0.8 },
  marketContext: { snapshotId: 'market-1', availableAtDay: 11,
    expectedCostMinorUnits: null, knownCompetingClubIds: [] },
});

it('derives and freezes roster need from same-time club state at decision append', () => {
  const result = appendRecruitmentDecisionWithRosterNeed(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0,
    knowledge, roster, policy, need, decision(),
  );
  expect(result.decisions[0].rosterNeedSnapshot).toEqual({
    snapshotId: 'need-1', availableAtDay: 11, positionGroup: 'C',
    requiredRole: 'starter', horizon: 'NOW', urgency: 1,
  });
  expect(result.decisions[0].sourceBackedRosterNeed).toMatchObject({
    coverageScope: 'DOCUMENTED_ROLE_CANDIDATES',
    rosterRevision: 0, knowledgeRevision: 2, guaranteedVacancies: 1,
    policyVersion: 'policy-1',
  });
  expect(Object.isFrozen(result.decisions[0].sourceBackedRosterNeed)).toBe(true);
});

it('rejects mismatched or future roster-need sources', () => {
  const ledger = createRecruitmentDecisionLedger('career-1', 'club-a');
  expect(() => appendRecruitmentDecisionWithRosterNeed(ledger, 0, knowledge,
    roster, policy, { ...need, clubId: 'other' }, decision())).toThrow();
  expect(() => appendRecruitmentDecisionWithRosterNeed(ledger, 0, knowledge,
    roster, policy, { ...need, asOfDay: 13 }, decision())).toThrow();
  const laterKnowledge = appendScoutingEvidence(knowledge, knowledge.revision, {
    evidenceId: 'future-e', careerId: 'career-1', clubId: 'club-a',
    playerId: 'target', observedAtDay: 20, availableAtDay: 20,
    sourceEventId: 'future-game',
  });
  expect(() => appendRecruitmentDecisionWithRosterNeed(ledger, 0,
    laterKnowledge, roster, policy, need, decision())).toThrow();
});
