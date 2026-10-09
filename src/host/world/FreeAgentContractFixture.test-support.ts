import { applyClubCommand, createClubFromSeed } from
  '../../core/world/club';
import { bootstrap, command } from
  '../../core/world/club/ClubFixtures.test-support';
import { appendClubWageSchedule,
  createClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import { appendAuthorizedRecruitmentDecisionWithWageSchedule,
  createRecruitmentDecisionLedger } from
  '../../core/world/scouting/RecruitmentDecision';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from
  '../../core/world/scouting/ScoutingKnowledge';
import { createRosterState } from '../../core/world/roster/RosterState';

export const freeAgentFixture = (clubId: 'club-a' | 'club-b' = 'club-a') => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed,
    seed: { ...seed.seed, identity: { ...seed.seed.identity, clubId } },
    initial: { ...seed.initial, references: {
      ...seed.initial.references,
      rivalryStateRefs: clubId === 'club-a'
        ? seed.initial.references.rivalryStateRefs
        : [{ fromClubId: 'club-b', toClubId: 'club-a',
          stateRef: 'rivalry-b-a' }],
      staffRoleLinks: [
        ...seed.initial.references.staffRoleLinks,
        { roleId: 'gm-role', roleKind: 'OTHER' as const,
          personId: 'gm-1', appointmentId: 'gm-appointment' },
      ],
    } },
  });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  const beforeClub = created.value;
  const beforeSchedules = createClubWageScheduleLedger('career-a', clubId);
  const knowledge = appendPlayerKnowledgeReport(appendScoutingEvidence(
    createClubScoutingKnowledge('career-a', clubId), 0, {
      evidenceId: 'e1', careerId: 'career-a', clubId,
      playerId: 'target', observedAtDay: 9, availableAtDay: 10,
      sourceEventId: 'match-1',
    }), 1, {
    reportId: 'r1', careerId: 'career-a', clubId,
    playerId: 'target', observedAtDay: 9, availableAtDay: 10,
    evidenceSourceIds: ['e1'], evaluatorPersonIds: ['scout-1'],
    estimate: [{ domainId: 'contact', lower: 40, upper: 60 }],
    confidence: 'MEDIUM',
  });
  const decisions = appendAuthorizedRecruitmentDecisionWithWageSchedule(
    createRecruitmentDecisionLedger('career-a', clubId), 0,
    knowledge, beforeClub, beforeSchedules, {
      profileId: 'authority-1', version: 'governance-v1',
      careerId: 'career-a', clubId, season: 1,
      governanceRef: 'governance-a', availableAtDay: 10,
      finalAuthorityKind: 'GM', authorityRoleId: 'gm-role',
    }, 100, {
      decisionId: 'decision-1', careerId: 'career-a', clubId,
      playerId: 'target', decidedAtDay: 10, decision: 'ACQUIRE',
      authorityPersonId: 'gm-1', governanceProfileVersion: 'governance-v1',
      knowledgeReportIds: ['r1'],
      rosterNeedSnapshot: { snapshotId: 'need-1', availableAtDay: 10,
        positionGroup: 'C', horizon: 'NOW', urgency: 1,
        requiredRole: 'starter' },
      fitEstimate: { policyVersion: 'fit-1', availableAtDay: 10,
        lower: 0.4, upper: 0.8 },
      marketContext: { snapshotId: 'market-1', availableAtDay: 10,
        expectedCostMinorUnits: null, knownCompetingClubIds: [] },
      offeredTerms: { currency: 'SIM', totalMinorUnits: 300,
        termSeasons: 2 },
    });
  const changed = applyClubCommand(beforeClub, {
    ...command([{ kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
      contractRef: 'contract-1', category: 'playerWages',
      budgetBucket: 'payroll', amount: 300, currency: 'SIM' },
    { kind: 'UPDATE_REFERENCES', references: {
      ...beforeClub.live.references, playerClubStateRefs: [
        ...beforeClub.live.references.playerClubStateRefs,
        { playerId: 'target', stateRef: 'target-roster' },
      ],
    } }], beforeClub, 'contract-event-1'),
    causeEventIds: ['acceptance-event-1', 'decision-1'],
  });
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const afterSchedules = appendClubWageSchedule(beforeSchedules, 0,
    changed.state, changed.event, { commitmentId: 'wage-1',
      contractRef: 'contract-1', annualAmounts: [
        { season: 1, amount: 100 }, { season: 2, amount: 200 },
      ] });
  const rosterState = createRosterState({ careerId: 'career-a',
    effectiveDay: 10,
    profiles: [{ profileId: 'league', version: 'v1', season: 1,
      competitionEditionId: 'league-season-1', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'],
      rehabParticipationAllowed: false }],
    units: [], players: [{ playerId: 'target',
      clubRights: { rightsHolderClubId: null, contractId: null },
      assignment: null, registrations: [], availability: {
        status: 'AVAILABLE', evidenceId: 'health-1' },
    }],
  });
  const acceptance = { acceptanceId: 'acceptance-1',
    decisionId: 'decision-1', sourceEventId: 'acceptance-event-1',
    careerId: 'career-a', clubId, playerId: 'target',
    contractId: 'contract-1', acceptedAtDay: 11,
    currency: 'SIM', totalMinorUnits: 300, termSeasons: 2 };
  const request = { applicationId: clubId === 'club-a'
    ? 'fa-application-1' : 'fa-application-2',
    expectedClubRevision: beforeClub.revision,
    expectedRosterRevision: rosterState.revision,
    expectedWageRevision: beforeSchedules.revision,
    roster: rosterState, beforeClub, afterClub: changed.state,
    clubEvent: changed.event, beforeSchedules, afterSchedules,
    decisions, decisionId: 'decision-1', acceptance,
    personLink: { personId: 'person-target', playerId: 'target',
      personLinkSourceId: 'person-link-1' },
  };
  return { beforeClub, rosterState, beforeSchedules, request };
};
