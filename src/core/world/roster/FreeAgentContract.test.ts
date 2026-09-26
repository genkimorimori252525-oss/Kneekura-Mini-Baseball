import { expect, it } from 'vitest';
import { applyClubCommand, createClubFromSeed } from '../club';
import { bootstrap, command } from '../club/ClubFixtures.test-support';
import { appendClubWageSchedule, createClubWageScheduleLedger } from '../club/ClubWageScheduleLedger';
import { appendAuthorizedRecruitmentDecisionWithWageSchedule,
  createRecruitmentDecisionLedger } from '../scouting/RecruitmentDecision';
import { appendPlayerKnowledgeReport, appendScoutingEvidence,
  createClubScoutingKnowledge } from '../scouting/ScoutingKnowledge';
import { createRosterState } from './RosterState';
import { applyFreeAgentContract } from './FreeAgentContract';

const fixture = () => {
  const seed = bootstrap();
  const created = createClubFromSeed({ ...seed,
    initial: { ...seed.initial, references: {
      ...seed.initial.references, staffRoleLinks: [
        ...seed.initial.references.staffRoleLinks,
        { roleId: 'gm-role', roleKind: 'OTHER' as const,
          personId: 'gm-1', appointmentId: 'gm-appointment' },
      ],
    } },
  });
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  const beforeClub = created.value;
  const priorSchedules = createClubWageScheduleLedger('career-a', 'club-a');
  const knowledge = appendPlayerKnowledgeReport(appendScoutingEvidence(
    createClubScoutingKnowledge('career-a', 'club-a'), 0, {
      evidenceId: 'e1', careerId: 'career-a', clubId: 'club-a',
      playerId: 'target', observedAtDay: 9, availableAtDay: 10,
      sourceEventId: 'match-1',
    }), 1, {
    reportId: 'r1', careerId: 'career-a', clubId: 'club-a',
    playerId: 'target', observedAtDay: 9, availableAtDay: 10,
    evidenceSourceIds: ['e1'], evaluatorPersonIds: ['scout-1'],
    estimate: [{ domainId: 'contact', lower: 40, upper: 60 }],
    confidence: 'MEDIUM',
  });
  const decisions = appendAuthorizedRecruitmentDecisionWithWageSchedule(
    createRecruitmentDecisionLedger('career-a', 'club-a'), 0,
    knowledge, beforeClub, priorSchedules, {
      profileId: 'authority-1', version: 'governance-v1',
      careerId: 'career-a', clubId: 'club-a', season: 1,
      governanceRef: 'governance-a', availableAtDay: 10,
      finalAuthorityKind: 'GM', authorityRoleId: 'gm-role',
    }, 100, {
      decisionId: 'decision-1', careerId: 'career-a', clubId: 'club-a',
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
    ...command([{
      kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
      contractRef: 'contract-1', category: 'playerWages',
      budgetBucket: 'payroll', amount: 300, currency: 'SIM',
    }, { kind: 'UPDATE_REFERENCES', references: {
      ...beforeClub.live.references, playerClubStateRefs: [
        ...beforeClub.live.references.playerClubStateRefs,
        { playerId: 'target', stateRef: 'target-roster' },
      ],
    } }], beforeClub, 'contract-event-1'),
    causeEventIds: ['acceptance-event-1', 'decision-1'],
  });
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const schedules = appendClubWageSchedule(priorSchedules, 0,
    changed.state, changed.event, { commitmentId: 'wage-1',
      contractRef: 'contract-1', annualAmounts: [
        { season: 1, amount: 100 }, { season: 2, amount: 200 },
      ] });
  const roster = createRosterState({ careerId: 'career-a',
    profiles: [], units: [], players: [{
      playerId: 'target', clubRights: {
        rightsHolderClubId: null, contractId: null },
      assignment: null, registrations: [], availability: {
        status: 'AVAILABLE', evidenceId: 'health-1' },
    }] });
  const acceptance = { acceptanceId: 'acceptance-1', decisionId: 'decision-1',
    sourceEventId: 'acceptance-event-1', careerId: 'career-a',
    clubId: 'club-a', playerId: 'target', contractId: 'contract-1',
    acceptedAtDay: 11, currency: 'SIM', totalMinorUnits: 300,
    termSeasons: 2 };
  return { beforeClub, changed, priorSchedules, schedules,
    decisions, roster, acceptance };
};

it('acquires free-agent rights only with decision, acceptance, commitment and annual wages', () => {
  const x = fixture();
  const result = applyFreeAgentContract(x.roster, 0, x.beforeClub,
    x.changed.state, x.changed.event, x.priorSchedules, x.schedules,
    x.decisions, 'decision-1', x.acceptance);
  expect(result.state.players[0]).toMatchObject({ clubRights: {
    rightsHolderClubId: 'club-a', contractId: 'contract-1' },
    assignment: null, registrations: [] });
  expect(result.event).toMatchObject({ type: 'FREE_AGENT_RIGHTS_ACQUIRED',
    sourceClubEventId: 'contract-event-1', decisionId: 'decision-1' });
  expect(x.roster.players[0]!.clubRights.rightsHolderClubId).toBeNull();
  expect(Object.isFrozen(result.event)).toBe(true);
});

it('rejects stale, forged, missing, or already held rights without changing the roster', () => {
  const x = fixture();
  const acquire = (roster = x.roster, revision = 0,
    schedules = x.schedules, acceptance = x.acceptance) =>
    applyFreeAgentContract(roster, revision, x.beforeClub,
      x.changed.state, x.changed.event, x.priorSchedules,
      schedules, x.decisions, 'decision-1', acceptance);
  expect(() => acquire()).not.toThrow();
  expect(() => acquire(x.roster, 1)).toThrow('stale');
  expect(() => acquire(x.roster, 0, x.priorSchedules)).toThrow('schedule');
  expect(() => acquire(x.roster, 0, x.schedules,
    { ...x.acceptance, sourceEventId: 'fabricated' })).toThrow('acceptance');
  expect(() => acquire(x.roster, 0, x.schedules,
    { ...x.acceptance, totalMinorUnits: 301 })).toThrow('acceptance');
  expect(() => acquire(createRosterState({ ...x.roster, players: [{
    ...x.roster.players[0]!, clubRights: {
      rightsHolderClubId: 'club-b', contractId: 'other' },
  }] }))).toThrow('free agent');
  expect(x.roster.players[0]!.clubRights.contractId).toBeNull();
});

it('rejects fabricated club history and missing acquisition authority', () => {
  const x = fixture();
  const apply = (event = x.changed.event, decisions = x.decisions) =>
    applyFreeAgentContract(x.roster, 0, x.beforeClub,
      x.changed.state, event, x.priorSchedules, x.schedules,
      decisions, 'decision-1', x.acceptance);
  expect(() => apply({ ...x.changed.event,
    afterRevision: x.changed.event.afterRevision + 1,
  })).toThrow('club event');
  const stripped = JSON.parse(JSON.stringify(x.decisions));
  delete stripped.decisions[0].sourceBackedAuthority;
  expect(() => apply(x.changed.event, stripped)).toThrow('authority');
});
