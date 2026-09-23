import { expect, it } from 'vitest';
import { appendPlayerKnowledgeReport, createClubScoutingKnowledge,
  readPlayerKnowledgeAt, appendScoutingEvidence } from './ScoutingKnowledge';

const report = (reportId: string, playerId: string, observedAtDay: number,
  availableAtDay = observedAtDay) => ({
  reportId, clubId: 'club-a', playerId, observedAtDay, availableAtDay,
  careerId: 'career-1',
  evidenceSourceIds: [`evidence-${reportId}`],
  evaluatorPersonIds: ['scout-1'],
  estimate: [{ domainId: 'contact', lower: 65, upper: 85 }],
  confidence: 'LOW' as const,
});
const evidence = (evidenceId: string, playerId: string, observedAtDay: number,
  availableAtDay = observedAtDay) => ({ evidenceId, careerId: 'career-1',
  clubId: 'club-a', playerId, observedAtDay, availableAtDay,
  sourceEventId: `source-${evidenceId}` });

it('cannot backdate a report or attach evidence for another player', () => {
  const initial = createClubScoutingKnowledge('career-1', 'club-a');
  expect(() => appendPlayerKnowledgeReport(initial, 0,
    report('report-1', 'player-1', 10))).toThrow('evidence');
  const withEvidence = appendScoutingEvidence(initial, 0,
    evidence('evidence-report-1', 'player-1', 20));
  expect(() => appendPlayerKnowledgeReport(withEvidence, 1,
    report('report-1', 'player-1', 10, 20))).toThrow('evidence');
  expect(() => appendPlayerKnowledgeReport(withEvidence, 1,
    report('report-1', 'player-2', 20))).toThrow('evidence');
  const leakedReport = { ...report('report-1', 'player-1', 20, 20),
    futureTrueAbility: 99 };
  expect(() => appendPlayerKnowledgeReport(withEvidence, 1,
    leakedReport)).toThrow('unknown');
  const leakedEstimate = { ...report('report-1', 'player-1', 20, 20),
    estimate: [{ domainId: 'contact', lower: 60, upper: 80,
      futureTrueAbility: 99 }] };
  expect(() => appendPlayerKnowledgeReport(withEvidence, 1,
    leakedEstimate)).toThrow('unknown');
});

it('keeps club knowledge tied to observation and delivery time', () => {
  const initial = createClubScoutingKnowledge('career-1', 'club-a');
  const firstEvidence = appendScoutingEvidence(initial, 0,
    evidence('evidence-report-1', 'player-1', 10));
  const first = appendPlayerKnowledgeReport(firstEvidence, 1,
    report('report-1', 'player-1', 10));
  const secondEvidence = appendScoutingEvidence(first, 2,
    evidence('evidence-report-2', 'player-1', 18, 20));
  const second = appendPlayerKnowledgeReport(secondEvidence, 3,
    { ...report('report-2', 'player-1', 18, 20),
      estimate: [{ domainId: 'contact', lower: 70, upper: 80 }] });
  expect(readPlayerKnowledgeAt(second, 'player-1', 19)).toMatchObject({
    report: { reportId: 'report-1', estimate: [{ lower: 65, upper: 85 }] },
    freshnessDays: 9,
  });
  expect(readPlayerKnowledgeAt(second, 'player-1', 20)).toMatchObject({
    report: { reportId: 'report-2', estimate: [{ lower: 70, upper: 80 }] },
    freshnessDays: 2,
  });
  expect(readPlayerKnowledgeAt(first, 'player-1', 30)).toMatchObject({
    report: { reportId: 'report-1', estimate: [{ lower: 65, upper: 85 }] },
    freshnessDays: 20,
  });
  expect(readPlayerKnowledgeAt(second, 'player-2', 30)).toBeNull();
  const delayedEvidence = appendScoutingEvidence(second, 4,
    evidence('evidence-report-delayed', 'player-1', 12, 25));
  const delayed = appendPlayerKnowledgeReport(delayedEvidence, 5,
    report('report-delayed', 'player-1', 12, 25));
  expect(readPlayerKnowledgeAt(delayed, 'player-1', 25)?.report.reportId)
    .toBe('report-2');
});

it('pins report evidence, rejects future/backdated updates and leaves old reports intact', () => {
  const source = report('report-1', 'player-1', 10);
  const initial = createClubScoutingKnowledge('career-1', 'club-a');
  const withEvidence = appendScoutingEvidence(initial, 0,
    evidence('evidence-report-1', 'player-1', 10));
  const state = appendPlayerKnowledgeReport(withEvidence, 1, source);
  source.estimate[0].lower = 0;
  expect(state.reports[0].estimate[0].lower).toBe(65);
  expect(Object.isFrozen(state.reports[0].estimate[0])).toBe(true);
  expect(() => appendPlayerKnowledgeReport(state, 1,
    report('report-2', 'player-1', 11))).toThrow('revision');
  expect(() => appendPlayerKnowledgeReport(state, 2,
    report('report-1', 'player-1', 11))).toThrow('duplicate');
  expect(() => appendPlayerKnowledgeReport(state, 2,
    { ...report('report-2', 'player-1', 9), availableAtDay: 9 }))
    .toThrow('backdated');
  expect(() => appendPlayerKnowledgeReport(state, 2,
    { ...report('report-2', 'player-1', 15), availableAtDay: 11 }))
    .toThrow('future');
  expect(() => appendPlayerKnowledgeReport(state, 2,
    { ...report('report-2', 'player-1', 11), clubId: 'club-b' }))
    .toThrow('club');
  expect(() => appendPlayerKnowledgeReport(state, 2,
    { ...report('report-2', 'player-1', 11), careerId: 'career-2' }))
    .toThrow('career');
});
