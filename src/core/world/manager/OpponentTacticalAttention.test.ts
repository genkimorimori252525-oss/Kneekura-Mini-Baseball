import { describe, expect, it } from 'vitest';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge,
  type KnowledgeConfidence } from '../scouting/ScoutingKnowledge';
import { projectOpponentTacticalAttention,
  type OpponentTacticalAttentionInput } from './OpponentTacticalAttention';

const knowledge = (domainId = 'opponent-batting-threat', lower = 8,
  upper = 10, confidence: KnowledgeConfidence = 'HIGH') => {
  let state = createClubScoutingKnowledge('career', 'club-a');
  for (const [index, day] of [10, 12].entries()) {
    state = appendScoutingEvidence(state, state.revision, {
      evidenceId: `e${index + 1}`, careerId: 'career', clubId: 'club-a',
      playerId: 'opponent', observedAtDay: day, availableAtDay: day + 1,
      sourceEventId: `match-${index + 1}`,
    });
  }
  return appendPlayerKnowledgeReport(state, state.revision, {
    reportId: 'report-1', careerId: 'career', clubId: 'club-a',
    playerId: 'opponent', observedAtDay: 12, availableAtDay: 14,
    evidenceSourceIds: ['e1', 'e2'], evaluatorPersonIds: ['scout-1'],
    estimate: [{ domainId, lower, upper }], confidence,
  });
};
const request = (state = knowledge()): OpponentTacticalAttentionInput => ({
  careerId: 'career', clubId: 'club-a', managerId: 'manager-1',
  opponentPlayerId: 'opponent', asOfDay: 20, knowledge: state,
  context: { leverage: 0.8, roleCentrality: 0.9,
    legalActionIds: ['attack', 'avoid', 'change-pitcher'],
    cautiousActionIds: ['avoid', 'change-pitcher'] },
  policy: { policyId: 'opponent-prep', version: 'v1',
    domainId: 'opponent-batting-threat', maxReportAgeDays: 30,
    minimumEvidenceCount: 2, minimumThreatLowerBound: 7,
    minimumLeverage: 0.6, minimumRoleCentrality: 0.7,
    minimumConfidence: 'MEDIUM' },
});

describe('projectOpponentTacticalAttention', () => {
  it('turns source-backed opponent threat into a belief and cautious candidates', () => {
    const result = projectOpponentTacticalAttention(request());
    expect(result.managerBelief).toEqual({ mean: 9, uncertainty: 1,
      evidence: 2, freshnessDays: 8 });
    expect(result.considerCautiousActions).toBe(true);
    expect(result.candidateActionIds).toEqual(['avoid', 'change-pitcher']);
    expect(result.provenance).toEqual({ policyId: 'opponent-prep',
      policyVersion: 'v1', reportId: 'report-1',
      scoutingEvidenceIds: ['e1', 'e2'],
      sourceEventIds: ['match-1', 'match-2'] });
    expect(result).not.toHaveProperty('actionId');
  });

  it('does not use popularity or a broad uncertain estimate as competitive threat', () => {
    const popular = projectOpponentTacticalAttention(request(knowledge('popularity')));
    expect(popular.considerCautiousActions).toBe(false);
    expect(popular.managerBelief).toBeNull();
    const uncertain = projectOpponentTacticalAttention(request(
      knowledge('opponent-batting-threat', 4, 10)));
    expect(uncertain.managerBelief?.uncertainty).toBe(3);
    expect(uncertain.considerCautiousActions).toBe(false);
  });

  it('requires available, fresh evidence and relevant game context', () => {
    expect(projectOpponentTacticalAttention({ ...request(), asOfDay: 13 })
      .managerBelief).toBeNull();
    expect(projectOpponentTacticalAttention({ ...request(), asOfDay: 50 })
      .considerCautiousActions).toBe(false);
    expect(projectOpponentTacticalAttention({ ...request(), context: {
      ...request().context, leverage: 0.1,
    } }).considerCautiousActions).toBe(false);
  });

  it('uses the pinned confidence gate for cautious consideration', () => {
    const base = request(knowledge('opponent-batting-threat', 8, 10, 'MEDIUM'));
    expect(projectOpponentTacticalAttention(base).considerCautiousActions)
      .toBe(true);
    expect(projectOpponentTacticalAttention({ ...base, policy: {
      ...base.policy, minimumConfidence: 'HIGH',
    } }).considerCautiousActions).toBe(false);
  });

  it('admits only host-legal cautious actions without selecting one', () => {
    const result = projectOpponentTacticalAttention({ ...request(), context: {
      ...request().context, legalActionIds: ['attack', 'avoid'],
    } });
    expect(result.candidateActionIds).toEqual(['avoid']);
  });

  it('ignores a supplied Star label because only scouting evidence forms the belief', () => {
    const base = request(knowledge('popularity'));
    const labelled = { ...base, starStatus: 'SUPERSTAR' };
    expect(projectOpponentTacticalAttention(labelled))
      .toEqual(projectOpponentTacticalAttention(base));
  });

  it('rejects forged source references and mismatched club knowledge', () => {
    const base = request();
    expect(() => projectOpponentTacticalAttention({ ...base,
      knowledge: { ...base.knowledge, clubId: 'other' } })).toThrow();
    expect(() => projectOpponentTacticalAttention({ ...base,
      knowledge: { ...base.knowledge, reports: [{ ...base.knowledge.reports[0]!,
        evidenceSourceIds: ['missing'] }] } })).toThrow();
  });
});
