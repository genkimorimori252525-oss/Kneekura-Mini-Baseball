import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { state as club } from '../../core/world/club/ClubFixtures.test-support';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterStateInput } from '../../core/world/roster/RosterTypes';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { openSqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import { openSqliteManagerBeliefHistoryStore } from
  './SqliteManagerBeliefHistoryStore';
import { issueManagerRosterOpportunityFromBelief } from
  './ManagerRosterOpportunityFromBelief';

const directories: string[] = [];
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-belief-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const path = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-belief-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const policy = { policyId: 'execution-learning', version: 'v1',
  availableAtDay: 10, successfulExecutionMean: 1,
  evidenceWeight: 1, uncertaintyFloor: 0.1,
  recentHistoryLimit: 8 };
const setupExecution = (databasePath: string) => {
  const world = openSqliteWorldSettlementStore(databasePath);
  try {
    world.initialize({ careerId: 'career-a', clubs: [club()],
      schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
        memberClubIds: ['club-a', 'club-b'],
        regularSeasonGamesPerClub: 1,
        games: [{ gameId: 'game-1', homeClubId: 'club-a',
          awayClubId: 'club-b' }],
        revisionEventIds: ['schedule-revision-1'] },
      standingsPolicy: { version: 'standings-v1',
        tieCreditNumerator: 1, tieCreditDenominator: 2,
        runDifferentialCapPerGame: 10 } });
  } finally { world.close(); }
  const control = createHumanControlState({ revision: 0,
    controllerId: 'human', controlledClubId: 'club-a',
    domainIds: ['ROSTER'], manualDomainIds: [] });
  const controlStore = openSqliteWorldControlStore(databasePath);
  try { controlStore.initialize({ careerId: 'career-a',
    control, worldRevision: 0 }); }
  finally { controlStore.close(); }
  const roster = createRosterState({ careerId: 'career-a',
    effectiveDay: 10,
    profiles: [{ profileId: 'league', version: 'v1', season: 1,
      competitionEditionId: 'league-season-1', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'],
      rehabParticipationAllowed: false }],
    units: [{ unitId: 'first', clubId: 'club-a',
      kind: 'FIRST_TEAM' }],
    players: [{ playerId: 'p1',
      clubRights: { rightsHolderClubId: 'club-a',
        contractId: 'contract-p1' },
      assignment: { unitId: 'first', clubId: 'club-a' },
      registrations: [],
      availability: { status: 'AVAILABLE',
        evidenceId: 'health-p1' } }],
  } as RosterStateInput);
  const rosterStore = openSqliteManagerRosterDecisionStore(databasePath);
  try {
    rosterStore.initialize({ careerId: 'career-a',
      clubId: 'club-a', roster, mood: null });
    const opportunity = { decisionId: 'decision-1',
      contextId: 'roster-context-1', worldRevision: 0,
      clubId: 'club-a', domainId: 'ROSTER',
      managerId: 'manager-a', appointmentId: 'appointment-a',
      legalActionIds: ['rest-p1'] };
    const selectionAgent = { managerId: 'manager-a',
      appointmentId: 'appointment-a', state: {
        skills: { tacticalJudgment: 50, analysis: 50,
          adaptation: 50, playerEvaluation: 50,
          operations: 50, leadership: 50 },
        philosophy: { preferredStyleTags: [] as string[] },
        temperament: { riskAppetite: 50, decisionPace: 50,
          policyPersistence: 50, noveltyAppetite: 50,
          consultationStyle: 50 },
        beliefs: { candidates: [{ actionId: 'rest-p1',
          styleTags: [] as string[],
          competitiveOutcome: { mean: 1, uncertainty: 0,
            evidence: 1 },
          resourceHealth: { mean: 1, uncertainty: 0,
            evidence: 1 },
          executionFeasibility: { mean: 0.2,
            uncertainty: 0.4, evidence: 1 },
          opponentInformationResponse: { mean: 1,
            uncertainty: 0, evidence: 1 } },
        { actionId: 'keep-p1', styleTags: [] as string[],
          competitiveOutcome: { mean: 1, uncertainty: 0,
            evidence: 1 },
          resourceHealth: { mean: 1, uncertainty: 0,
            evidence: 1 },
          executionFeasibility: { mean: 0.3,
            uncertainty: 0.05, evidence: 1 },
          opponentInformationResponse: { mean: 1,
            uncertainty: 0, evidence: 1 } }] },
        strategyMemory: { activePolicyActionIds: ['keep-p1'] },
      } };
    const selected = selectManagerControlledDecision(control,
      opportunity, selectionAgent, 'trace-1');
    if (!selected.ok) throw new Error('invalid manager fixture');
    const binding = { actionId: 'rest-p1', command: {
      commandId: 'rest-p1', expectedRevision: 0,
      effectiveDay: 11, changes: [{ playerId: 'p1',
        availability: { status: 'UNAVAILABLE' as const,
          evidenceId: 'usage-observed-1' } }],
    } };
    rosterStore.issueOpportunity({ careerId: 'career-a',
      clubId: 'club-a', expectedClubRevision: 0,
      expectedRosterRevision: 0, clubAsOfDay: 11,
      control, decisionId: 'decision-1',
      contextId: 'roster-context-1', worldRevision: 0,
      candidates: [binding], selectionAgent });
    rosterStore.apply({ careerId: 'career-a', clubId: 'club-a',
      expectedClubRevision: 0, expectedRosterRevision: 0,
      expectedMoodRevision: null, control, opportunity,
      selection: selected.value, selectionAgent, binding,
      clubAsOfDay: 11, currentWorldRevision: 0,
      afterWorldRevision: 1, executionId: 'execution-1' });
  } finally { rosterStore.close(); }
};

it('persists observed manager learning and replays an identical retry after restart', () => {
  const databasePath = path();
  setupExecution(databasePath);
  const store = openSqliteManagerBeliefHistoryStore(databasePath);
  store.initializeFromOpportunity({ careerId: 'career-a',
    clubId: 'club-a', decisionId: 'decision-1', policy });
  const saved = store.apply({ careerId: 'career-a',
    managerId: 'manager-a', expectedRevision: 0,
    executionId: 'execution-1' });
  expect(saved.event).toMatchObject({
    sourceEventId: 'roster:["career-a",1]',
    actionId: 'rest-p1', observedAtDay: 11 });
  expect(saved.state.agent.beliefs.candidates[0]
    ?.executionFeasibility).toEqual({ mean: 0.6,
      uncertainty: 0.2, evidence: 2 });
  store.close();
  const reopened = openSqliteManagerBeliefHistoryStore(databasePath);
  expect(reopened.readHead('career-a', 'manager-a')).toEqual(saved.state);
  expect(reopened.readObservation('execution-1')).toEqual(saved);
  expect(reopened.apply({ careerId: 'career-a',
    managerId: 'manager-a', expectedRevision: 0,
    executionId: 'execution-1' })).toEqual(saved);
  reopened.close();
});

it('uses the learned Person belief for the next manager choice', () => {
  const databasePath = path();
  setupExecution(databasePath);
  const history = openSqliteManagerBeliefHistoryStore(databasePath);
  const unbootstrappedRoster = openSqliteManagerRosterDecisionStore(
    databasePath);
  try {
    expect(() => issueManagerRosterOpportunityFromBelief(
      unbootstrappedRoster, history, {
        careerId: 'career-a', clubId: 'club-a',
        expectedClubRevision: 0, expectedRosterRevision: 1,
        clubAsOfDay: 12, control: createHumanControlState({
          revision: 0, controllerId: 'human',
          controlledClubId: 'club-a', domainIds: ['ROSTER'],
          manualDomainIds: [] }),
        decisionId: 'decision-2', contextId: 'roster-context-2',
        worldRevision: 1, managerId: 'manager-a',
        appointmentId: 'appointment-a', candidates: [],
      })).toThrow('bootstrap');
  } finally { unbootstrappedRoster.close(); }
  history.initializeFromOpportunity({ careerId: 'career-a',
    clubId: 'club-a', decisionId: 'decision-1', policy });
  history.apply({ careerId: 'career-a', managerId: 'manager-a',
    expectedRevision: 0, executionId: 'execution-1' });
  const roster = openSqliteManagerRosterDecisionStore(databasePath);
  try {
    const first = roster.readOpportunity('career-a',
      'club-a', 'decision-1')!;
    const next = issueManagerRosterOpportunityFromBelief(roster,
      history, { careerId: 'career-a', clubId: 'club-a',
        expectedClubRevision: 0, expectedRosterRevision: 1,
        clubAsOfDay: 12, control: first.control,
        decisionId: 'decision-2', contextId: 'roster-context-2',
        worldRevision: 1, managerId: 'manager-a',
        appointmentId: 'appointment-a',
        candidates: [{ actionId: 'rest-p1', command: {
          commandId: 'rest-p1', expectedRevision: 1,
          effectiveDay: 12, changes: [{ playerId: 'p1',
            availability: { status: 'AVAILABLE',
              evidenceId: 'recovered-1' } }],
        } }, { actionId: 'keep-p1', command: {
          commandId: 'keep-p1', expectedRevision: 1,
          effectiveDay: 12, changes: [{ playerId: 'p1',
            availability: { status: 'UNAVAILABLE',
              evidenceId: 'still-resting-1' } }],
        } }],
      });
    expect(next.selectionAgent.state.beliefs.candidates[0]
      ?.executionFeasibility.mean).toBe(0.6);
    const learned = selectManagerControlledDecision(next.control,
      next.opportunity, next.selectionAgent, 'trace-2');
    const stale = selectManagerControlledDecision(next.control,
      next.opportunity, first.selectionAgent, 'trace-2');
    expect(learned.ok && learned.value.decision.actionId)
      .toBe('rest-p1');
    expect(stale.ok && stale.value.decision.actionId)
      .toBe('keep-p1');
    expect(() => roster.issueOpportunity({
      careerId: next.careerId, clubId: next.clubId,
      expectedClubRevision: next.clubRevision,
      expectedRosterRevision: next.rosterRevision,
      clubAsOfDay: next.clubAsOfDay,
      control: next.control, decisionId: 'decision-3',
      contextId: 'roster-context-3', worldRevision: 1,
      candidates: next.bindings,
      selectionAgent: first.selectionAgent,
    })).toThrow('Manager Person belief');
  } finally { roster.close(); history.close(); }
});

it('requires reconciliation of divergent pre-history belief snapshots', () => {
  const databasePath = path();
  setupExecution(databasePath);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(databasePath);
  try {
    const row = external.prepare(`SELECT issued_json
      FROM world_roster_opportunities WHERE decision_id=?`)
      .get('decision-1') as { issued_json: string };
    const changed = JSON.parse(row.issued_json) as Record<string, any>;
    changed.opportunity.decisionId = 'legacy-decision-2';
    changed.selectionAgent.state.beliefs.candidates[0]
      .executionFeasibility.mean = 0.9;
    external.prepare(`INSERT INTO world_roster_opportunities
      (career_id, club_id, decision_id, issued_json)
      VALUES (?, ?, ?, ?)`).run('career-a', 'club-a',
        'legacy-decision-2', JSON.stringify(changed));
  } finally { external.close(); }
  const history = openSqliteManagerBeliefHistoryStore(databasePath);
  try {
    expect(() => history.initializeFromOpportunity({
      careerId: 'career-a', clubId: 'club-a',
      decisionId: 'decision-1', policy,
    })).toThrow('reconciliation');
  } finally { history.close(); }
});

it('rejects stale revisions and a different manager for the same execution', () => {
  const databasePath = path();
  setupExecution(databasePath);
  const store = openSqliteManagerBeliefHistoryStore(databasePath);
  try {
    store.initializeFromOpportunity({ careerId: 'career-a',
      clubId: 'club-a', decisionId: 'decision-1', policy });
    expect(() => store.initializeFromOpportunity({
      careerId: 'career-a', clubId: 'club-a',
      decisionId: 'decision-1', policy: {
        ...policy, successfulExecutionMean: 100,
      } })).toThrow('initialized differently');
    expect(() => store.apply({ careerId: 'career-a',
      managerId: 'manager-a', expectedRevision: 1,
      executionId: 'execution-1' })).toThrow('revision');
    expect(() => store.apply({ careerId: 'career-a',
      managerId: 'manager-b', expectedRevision: 0,
      executionId: 'execution-1' })).toThrow('manager');
    expect(store.readHead('career-a', 'manager-a')?.revision).toBe(0);
  } finally { store.close(); }
});

it('rolls back the Manager Person head if observation insertion fails', () => {
  const databasePath = path();
  setupExecution(databasePath);
  const store = openSqliteManagerBeliefHistoryStore(databasePath);
  store.initializeFromOpportunity({ careerId: 'career-a',
    clubId: 'club-a', decisionId: 'decision-1', policy });
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(databasePath);
  try {
    external.exec(`CREATE TRIGGER fail_manager_learning
      BEFORE INSERT ON world_manager_belief_observations
      BEGIN SELECT RAISE(ABORT, 'injected learning failure'); END;`);
    expect(() => store.apply({ careerId: 'career-a',
      managerId: 'manager-a', expectedRevision: 0,
      executionId: 'execution-1' }))
      .toThrow('injected learning failure');
    expect(store.readHead('career-a', 'manager-a')?.revision).toBe(0);
    expect(store.readObservation('execution-1')).toBeNull();
    external.exec('DROP TRIGGER fail_manager_learning');
  } finally { external.close(); }
  store.close();
  const reopened = openSqliteManagerBeliefHistoryStore(databasePath);
  expect(reopened.readHead('career-a', 'manager-a')?.revision).toBe(0);
  expect(reopened.apply({ careerId: 'career-a',
    managerId: 'manager-a', expectedRevision: 0,
    executionId: 'execution-1' }).revision).toBe(1);
  reopened.close();
});
