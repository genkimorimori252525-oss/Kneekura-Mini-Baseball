import { expect, it } from 'vitest';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from './ScoutingKnowledge';
import { appendRecruitmentDecision, createRecruitmentDecisionLedger } from './RecruitmentDecision';

const knowledge = appendPlayerKnowledgeReport(appendScoutingEvidence(
  createClubScoutingKnowledge('career-1', 'club-a'), 0, {
    evidenceId: 'match-1', careerId: 'career-1', clubId: 'club-a',
    playerId: 'player-1', observedAtDay: 8, availableAtDay: 10,
    sourceEventId: 'official-match-1',
  }), 1, {
  careerId: 'career-1',
  reportId: 'report-1', clubId: 'club-a', playerId: 'player-1',
  observedAtDay: 8, availableAtDay: 10,
  evidenceSourceIds: ['match-1'], evaluatorPersonIds: ['scout-1'],
  estimate: [{ domainId: 'contact', lower: 60, upper: 80 }], confidence: 'MEDIUM',
});
const decision = () => ({
  decisionId: 'decision-1', careerId: 'career-1',
  clubId: 'club-a', playerId: 'player-1',
  decidedAtDay: 12, decision: 'BID' as const,
  authorityPersonId: 'gm-1', governanceProfileVersion: 'governance-v1',
  knowledgeReportIds: ['report-1'],
  rosterNeedSnapshot: { snapshotId: 'need-1', availableAtDay: 11,
    positionGroup: 'catcher', horizon: 'NEXT_SEASON' as const,
    urgency: 0.8, requiredRole: 'starter' },
  budgetContext: { financeSnapshotId: 'finance-1', availableAtDay: 11,
    currency: 'JPY', availableMinorUnits: 1000 },
  fitEstimate: { policyVersion: 'fit-v1', availableAtDay: 12,
    lower: 0.4, upper: 0.8 },
  marketContext: { snapshotId: 'market-1', availableAtDay: 12,
    expectedCostMinorUnits: 300,
    knownCompetingClubIds: ['club-b'] },
  offeredTerms: { currency: 'JPY', totalMinorUnits: 350, termSeasons: 1 },
});

it('pins the club knowledge and context available when a bid was made', () => {
  const ledger = appendRecruitmentDecision(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0, knowledge, decision());
  expect(ledger.decisions[0]).toMatchObject({
    decisionId: 'decision-1', decision: 'BID',
    knowledgeReports: [{ reportId: 'report-1', estimate: [{ lower: 60, upper: 80 }] }],
    budgetContext: { financeSnapshotId: 'finance-1' },
  });
  expect(Object.isFrozen(ledger.decisions[0].knowledgeReports[0].estimate[0])).toBe(true);
  const laterEvidence = appendScoutingEvidence(knowledge, 2, {
    evidenceId: 'match-2', careerId: 'career-1', clubId: 'club-a',
    playerId: 'player-1', observedAtDay: 20, availableAtDay: 20,
    sourceEventId: 'official-match-2',
  });
  const laterKnowledge = appendPlayerKnowledgeReport(laterEvidence, 3, {
    ...knowledge.reports[0], reportId: 'report-2', observedAtDay: 20,
    availableAtDay: 20, evidenceSourceIds: ['match-2'],
    estimate: [{ domainId: 'contact', lower: 90, upper: 95 }],
  });
  expect(laterKnowledge.reports).toHaveLength(2);
  expect(ledger.decisions[0].knowledgeReports[0].estimate[0].upper).toBe(80);
  expect(appendRecruitmentDecision(createRecruitmentDecisionLedger('career-1', 'club-a'),
    0, laterKnowledge, decision()).decisions[0].knowledgeReports[0].reportId)
    .toBe('report-1');
});

it('rejects future knowledge/context, wrong club, duplicate and stale decisions', () => {
  const initial = createRecruitmentDecisionLedger('career-1', 'club-a');
  expect(() => appendRecruitmentDecision(initial, 0, knowledge,
    { ...decision(), knowledgeReportIds: ['missing'] })).toThrow('knowledge');
  expect(() => appendRecruitmentDecision(initial, 0, knowledge,
    { ...decision(), budgetContext: { ...decision().budgetContext,
      availableAtDay: 13 } })).toThrow('future');
  expect(() => appendRecruitmentDecision(initial, 0, knowledge,
    { ...decision(), clubId: 'club-b' })).toThrow('club');
  expect(() => appendRecruitmentDecision(initial, 0, knowledge,
    { ...decision(), careerId: 'career-2' })).toThrow('career');
  expect(() => appendRecruitmentDecision(initial, 0, knowledge,
    { ...decision(), offeredTerms: undefined })).toThrow('offer');
  const leakedDecision = { ...decision(), futureTrueAbility: 99 };
  expect(() => appendRecruitmentDecision(initial, 0, knowledge,
    leakedDecision)).toThrow('unknown');
  const leakedFit = { ...decision(), fitEstimate: { ...decision().fitEstimate,
    futureTrueAbility: 99 } };
  expect(() => appendRecruitmentDecision(initial, 0, knowledge,
    leakedFit)).toThrow('unknown');
  const once = appendRecruitmentDecision(initial, 0, knowledge, decision());
  expect(() => appendRecruitmentDecision(once, 0, knowledge,
    { ...decision(), decisionId: 'decision-2' })).toThrow('revision');
  expect(() => appendRecruitmentDecision(once, 1, knowledge,
    decision())).toThrow('duplicate');
});

it('pins the evidence behind decision-time reports', () => {
  const record = appendRecruitmentDecision(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0,
    knowledge, decision()).decisions[0];
  expect(record.knowledgeEvidence).toEqual([{ evidenceId: 'match-1',
    careerId: 'career-1', clubId: 'club-a', playerId: 'player-1',
    observedAtDay: 8, availableAtDay: 10,
    sourceEventId: 'official-match-1' }]);
  expect(Object.isFrozen(record.knowledgeEvidence[0])).toBe(true);
});

it('rejects true ability or undocumented fields inside selected knowledge', () => {
  const contaminated = { ...knowledge, reports: [{ ...knowledge.reports[0],
    estimate: [{ ...knowledge.reports[0].estimate[0], trueAbility: 99 }] }] };
  expect(() => appendRecruitmentDecision(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0,
    contaminated, decision())).toThrow('unknown');
  const contaminatedEvidence = { ...knowledge, evidence: [{
    ...knowledge.evidence[0], trueAbility: 99 }] };
  expect(() => appendRecruitmentDecision(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0,
    contaminatedEvidence, decision())).toThrow('unknown');
});

it('rejects cross-club, missing and future evidence behind selected reports', () => {
  const initial = createRecruitmentDecisionLedger('career-1', 'club-a');
  const foreign = { ...knowledge, evidence: [{ ...knowledge.evidence[0],
    clubId: 'club-b' }] };
  expect(() => appendRecruitmentDecision(initial, 0, foreign, decision()))
    .toThrow('knowledge');
  const missing = { ...knowledge, evidence: [] };
  expect(() => appendRecruitmentDecision(initial, 0, missing, decision()))
    .toThrow('knowledge');
  const future = { ...knowledge, evidence: [{ ...knowledge.evidence[0],
    availableAtDay: 13 }] };
  expect(() => appendRecruitmentDecision(initial, 0, future, decision()))
    .toThrow('knowledge');
});
