import { describe, expect, it } from 'vitest';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from '../scouting/ScoutingKnowledge';
import { createRosterState } from './RosterState';
import { rosterFixture } from './RosterTestFixtures';
import { deriveSourceBackedRosterNeed as deriveWithPolicy,
  type RosterNeedRequest } from './SourceBackedRosterNeed';

const knowledgeFixture = (includeFit = true, includeCandidate = true,
  candidateLower = 1, candidateUpper = 1) => {
  let knowledge = createClubScoutingKnowledge('career-1', 'a');
  for (const [index, playerId] of ['p1', 'p2'].entries()) {
    knowledge = appendScoutingEvidence(knowledge, knowledge.revision, {
      evidenceId: `e${index}`, careerId: 'career-1', clubId: 'a',
      playerId, observedAtDay: 2, availableAtDay: 3,
      sourceEventId: `practice-${index}`,
    });
    knowledge = appendPlayerKnowledgeReport(knowledge, knowledge.revision, {
      reportId: `r${index}`, careerId: 'career-1', clubId: 'a',
      playerId, observedAtDay: 2, availableAtDay: 3,
      evidenceSourceIds: [`e${index}`], evaluatorPersonIds: ['scout-1'],
      estimate: [...(includeCandidate
        ? [{ domainId: 'catcher-role', lower: candidateLower, upper: candidateUpper }] : []),
        ...(includeFit ? [{ domainId: 'catcher-fit', lower: 0.4, upper: 0.8 }] : [])],
      confidence: 'MEDIUM',
    });
  }
  return knowledge;
};

const request = {
  careerId: 'career-1', clubId: 'a', asOfDay: 3,
  snapshotId: 'need-1', policyVersion: 'club-plan-1',
  competitionEditionId: 'league-2026', positionGroup: 'C',
  candidateDomainId: 'catcher-role', minimumCandidateEstimate: 1,
  knowledgeDomainId: 'catcher-fit', requiredRole: 'starter-or-backup',
  horizon: 'NOW' as const, targetCount: 2, minimumEstimate: 0.3,
};
const policyFor = (input: RosterNeedRequest) => ({
  version: input.policyVersion,
  roles: [{ positionGroup: input.positionGroup, requiredRole: input.requiredRole,
    candidateDomainId: input.candidateDomainId,
    minimumCandidateEstimate: input.minimumCandidateEstimate,
    knowledgeDomainId: input.knowledgeDomainId,
    minimumEstimate: input.minimumEstimate, targetCount: input.targetCount }],
});
const deriveSourceBackedRosterNeed = (
  roster: Parameters<typeof deriveWithPolicy>[0],
  knowledge: Parameters<typeof deriveWithPolicy>[1],
  input: RosterNeedRequest,
) => deriveWithPolicy(roster, knowledge, input, policyFor(input));

describe('source-backed roster need', () => {
  it('uses actual roster participation and only knowledge available by decision day', () => {
    const result = deriveSourceBackedRosterNeed(
      createRosterState(rosterFixture()), knowledgeFixture(), request,
    );
    expect(result.confirmedPlayerIds).toEqual(['p1']);
    expect(result.unknownPlayerIds).toEqual([]);
    expect(result.guaranteedVacancies).toBe(1);
    expect(result.possibleVacancies).toBe(1);
    expect(result.sourceReportIds).toEqual(['r0']);
    expect(result.urgency).toBe(0.5);
    expect(result.rosterRevision).toBe(0);
  });

  it('includes reserve depth at a future horizon without presenting it as active today', () => {
    const result = deriveSourceBackedRosterNeed(
      createRosterState(rosterFixture()), knowledgeFixture(),
      { ...request, horizon: 'NEXT_SEASON' },
    );
    expect(result.confirmedPlayerIds).toEqual(['p1', 'p2']);
    expect(result.guaranteedVacancies).toBe(0);
  });

  it('counts a loan player assigned and eligible for this club despite different rights holder', () => {
    const fixture = rosterFixture();
    const roster = createRosterState({ ...fixture,
      profiles: fixture.profiles.map((profile) =>
        profile.competitionEditionId === 'league-2026'
          ? { ...profile, activeLimit: 2 } : profile),
      players: [...fixture.players, {
        playerId: 'loan',
        clubRights: { rightsHolderClubId: 'b', contractId: 'loan-contract' },
        assignment: { unitId: 'a-first', clubId: 'a' },
        registrations: [{ competitionEditionId: 'league-2026', clubId: 'a',
          status: 'ACTIVE', eligibility: 'ELIGIBLE', evidenceId: 'loan-registration' }],
        availability: { status: 'AVAILABLE', evidenceId: 'loan-health' },
      }],
    });
    let knowledge = knowledgeFixture();
    knowledge = appendScoutingEvidence(knowledge, knowledge.revision, {
      evidenceId: 'loan-e', careerId: 'career-1', clubId: 'a',
      playerId: 'loan', observedAtDay: 2, availableAtDay: 3,
      sourceEventId: 'loan-practice',
    });
    knowledge = appendPlayerKnowledgeReport(knowledge, knowledge.revision, {
      reportId: 'loan-r', careerId: 'career-1', clubId: 'a',
      playerId: 'loan', observedAtDay: 2, availableAtDay: 3,
      evidenceSourceIds: ['loan-e'], evaluatorPersonIds: ['scout-1'],
      estimate: [{ domainId: 'catcher-role', lower: 1, upper: 1 }],
      confidence: 'LOW',
    });
    const result = deriveSourceBackedRosterNeed(roster, knowledge, request);
    expect(result.unknownPlayerIds).toEqual(['loan']);
    expect(result.sourceReportIds).toEqual(['loan-r', 'r0']);
    expect(result.guaranteedVacancies).toBe(0);
    expect(result.possibleVacancies).toBe(1);
  });

  it('keeps unassessed club players uncertain rather than calling them unsuitable', () => {
    const result = deriveSourceBackedRosterNeed(
      createRosterState(rosterFixture()),
      knowledgeFixture(false), request,
    );
    expect(result.confirmedPlayerIds).toEqual([]);
    expect(result.unknownPlayerIds).toEqual(['p1']);
    expect(result.guaranteedVacancies).toBe(1);
    expect(result.possibleVacancies).toBe(2);
    expect(result.urgency).toBe(0.5);
  });

  it('does not count other-position players without this role candidacy as possible coverage', () => {
    const result = deriveSourceBackedRosterNeed(
      createRosterState(rosterFixture()), knowledgeFixture(true, false), request,
    );
    expect(result.confirmedPlayerIds).toEqual([]);
    expect(result.unknownPlayerIds).toEqual([]);
    expect(result.guaranteedVacancies).toBe(2);
    expect(result.urgency).toBe(1);
  });

  it('retains role candidates whose candidacy interval crosses the policy threshold', () => {
    const result = deriveSourceBackedRosterNeed(
      createRosterState(rosterFixture()),
      knowledgeFixture(true, true, 0.4, 0.8),
      { ...request, minimumCandidateEstimate: 0.6 },
    );
    expect(result.uncertainPlayerIds).toEqual(['p1']);
    expect(result.guaranteedVacancies).toBe(1);
    expect(result.sourceReportIds).toEqual(['r0']);
    const nonFit = deriveSourceBackedRosterNeed(
      createRosterState(rosterFixture()),
      knowledgeFixture(true, true, 0.4, 0.8),
      { ...request, minimumCandidateEstimate: 0.6, minimumEstimate: 0.9 },
    );
    expect(nonFit.unsuitablePlayerIds).toEqual(['p1']);
    expect(nonFit.guaranteedVacancies).toBe(2);
  });

  it('uses the latest available report per domain and preserves both sources', () => {
    let knowledge = knowledgeFixture();
    knowledge = appendScoutingEvidence(knowledge, knowledge.revision, {
      evidenceId: 'later-e', careerId: 'career-1', clubId: 'a',
      playerId: 'p1', observedAtDay: 4, availableAtDay: 4,
      sourceEventId: 'later-practice',
    });
    knowledge = appendPlayerKnowledgeReport(knowledge, knowledge.revision, {
      reportId: 'later-fit', careerId: 'career-1', clubId: 'a',
      playerId: 'p1', observedAtDay: 4, availableAtDay: 4,
      evidenceSourceIds: ['later-e'], evaluatorPersonIds: ['scout-1'],
      estimate: [{ domainId: 'catcher-fit', lower: 0.9, upper: 1 }],
      confidence: 'HIGH',
    });
    const result = deriveSourceBackedRosterNeed(
      createRosterState(rosterFixture()), knowledge,
      { ...request, asOfDay: 4, minimumEstimate: 0.8 },
    );
    expect(result.confirmedPlayerIds).toEqual(['p1']);
    expect(result.sourceReportIds).toEqual(['later-fit', 'r0']);
  });

  it('preserves estimate uncertainty and known non-fit instead of treating report presence as coverage', () => {
    const roster = createRosterState(rosterFixture());
    const knowledge = knowledgeFixture();
    const uncertain = deriveSourceBackedRosterNeed(roster, knowledge,
      { ...request, minimumEstimate: 0.6 });
    expect(uncertain.confirmedPlayerIds).toEqual([]);
    expect(uncertain.uncertainPlayerIds).toEqual(['p1']);
    expect(uncertain.guaranteedVacancies).toBe(1);
    expect(uncertain.possibleVacancies).toBe(2);
    const nonFit = deriveSourceBackedRosterNeed(roster, knowledge,
      { ...request, minimumEstimate: 0.9 });
    expect(nonFit.unsuitablePlayerIds).toEqual(['p1']);
    expect(nonFit.guaranteedVacancies).toBe(2);
    expect(nonFit.sourceReportIds).toEqual(['r0']);
  });

  it('rejects mismatched careers, future roster state and invalid planning inputs', () => {
    const roster = createRosterState(rosterFixture());
    const knowledge = knowledgeFixture();
    expect(() => deriveSourceBackedRosterNeed(roster, knowledge,
      { ...request, careerId: 'other' })).toThrow();
    expect(() => deriveSourceBackedRosterNeed(roster, knowledge,
      { ...request, targetCount: 0 })).toThrow();
    expect(() => deriveSourceBackedRosterNeed(roster, knowledge,
      { ...request, asOfDay: 0 })).not.toThrow();
    expect(() => deriveSourceBackedRosterNeed(
      createRosterState({ ...rosterFixture(), effectiveDay: 4 }),
      knowledge, request)).toThrow();
    expect(() => deriveWithPolicy(roster, knowledge,
      { ...request, candidateDomainId: 'pitcher-role' },
      policyFor(request))).toThrow();
    const incompleteRole = { ...policyFor(request).roles[0] };
    delete (incompleteRole as Partial<typeof incompleteRole>).minimumEstimate;
    expect(() => deriveWithPolicy(roster, knowledge, request,
      { version: request.policyVersion, roles: [incompleteRole] })).toThrow();
  });
});
