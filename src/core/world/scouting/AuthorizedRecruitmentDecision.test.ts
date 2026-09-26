import { expect, it } from 'vitest';
import { createClubFromSeed } from '../club';
import { bootstrap } from '../club/ClubFixtures.test-support';
import { createClubWageScheduleLedger } from '../club/ClubWageScheduleLedger';
import { appendAuthorizedRecruitmentDecisionWithWageSchedule,
  createRecruitmentDecisionLedger } from './RecruitmentDecision';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from './ScoutingKnowledge';

const knowledge = appendPlayerKnowledgeReport(appendScoutingEvidence(
  createClubScoutingKnowledge('career-1', 'club-a'), 0, {
    evidenceId: 'e1', careerId: 'career-1', clubId: 'club-a',
    playerId: 'target', observedAtDay: 8, availableAtDay: 10,
    sourceEventId: 'match-1',
  }), 1, {
  reportId: 'r1', careerId: 'career-1', clubId: 'club-a',
  playerId: 'target', observedAtDay: 8, availableAtDay: 10,
  evidenceSourceIds: ['e1'], evaluatorPersonIds: ['scout-1'],
  estimate: [{ domainId: 'contact', lower: 40, upper: 60 }],
  confidence: 'MEDIUM',
});
const club = () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed,
    context: { ...seed.context, careerId: 'career-1' },
    initial: { ...seed.initial, references: {
      ...seed.initial.references, staffRoleLinks: [
        ...seed.initial.references.staffRoleLinks,
        { roleId: 'gm-role', roleKind: 'OTHER' as const,
          personId: 'gm-1', appointmentId: 'gm-appointment' },
      ],
    } },
  });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  return created.value;
};
const profile = { profileId: 'authority-1', version: 'governance-v1',
  careerId: 'career-1', clubId: 'club-a', season: 1,
  governanceRef: 'governance-a', availableAtDay: 10,
  finalAuthorityKind: 'GM' as const, authorityRoleId: 'gm-role' };
const decision = () => ({ decisionId: 'acquisition-1',
  careerId: 'career-1', clubId: 'club-a', playerId: 'target',
  decidedAtDay: 12, decision: 'ACQUIRE' as const,
  authorityPersonId: 'gm-1', governanceProfileVersion: 'governance-v1',
  knowledgeReportIds: ['r1'], rosterNeedSnapshot: {
    snapshotId: 'need-1', availableAtDay: 11,
    positionGroup: 'C', horizon: 'NOW' as const,
    urgency: 1, requiredRole: 'starter',
  }, fitEstimate: { policyVersion: 'fit-1', availableAtDay: 11,
    lower: 0.4, upper: 0.8 },
  marketContext: { snapshotId: 'market-1', availableAtDay: 11,
    expectedCostMinorUnits: null, knownCompetingClubIds: [] },
  offeredTerms: { currency: 'SIM', totalMinorUnits: 100,
    termSeasons: 1 },
});

it('pins the appointed GM, budget and scouting facts for an acquisition', () => {
  const record = appendAuthorizedRecruitmentDecisionWithWageSchedule(
    createRecruitmentDecisionLedger('career-1', 'club-a'), 0,
    knowledge, club(), createClubWageScheduleLedger('career-1', 'club-a'),
    profile, 100, decision()).decisions[0]!;
  expect(record).toMatchObject({ decision: 'ACQUIRE',
    sourceBackedAuthority: { authorityPersonId: 'gm-1',
      appointment: { appointmentId: 'gm-appointment' } },
    payrollPrecheck: { outcome: 'WITHIN_COVERED_RULES' },
    sourceBackedClubFinance: { summary: { revision: 0 } },
  });
  expect(Object.isFrozen(record.sourceBackedAuthority)).toBe(true);
});

it('rejects an unappointed person, stale governance and excess payroll', () => {
  const ledger = createRecruitmentDecisionLedger('career-1', 'club-a');
  const schedules = createClubWageScheduleLedger('career-1', 'club-a');
  expect(() => appendAuthorizedRecruitmentDecisionWithWageSchedule(
    ledger, 0, knowledge, club(), schedules, profile, 100,
    { ...decision(), authorityPersonId: 'manager-a' })).toThrow();
  expect(() => appendAuthorizedRecruitmentDecisionWithWageSchedule(
    ledger, 0, knowledge, club(), schedules,
    { ...profile, governanceRef: 'obsolete' }, 100,
    decision())).toThrow();
  expect(() => appendAuthorizedRecruitmentDecisionWithWageSchedule(
    ledger, 0, knowledge, club(), schedules, profile, 501,
    { ...decision(), offeredTerms: { ...decision().offeredTerms,
      totalMinorUnits: 501 } })).toThrow();
  expect(ledger.decisions).toHaveLength(0);
});
