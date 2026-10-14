import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { state as club } from '../../core/world/club/ClubFixtures.test-support';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterStateInput } from '../../core/world/roster/RosterTypes';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqliteManagerBeliefHistoryStore } from './SqliteManagerBeliefHistoryStore';
import { issueManagerRosterOpportunityFromBelief } from './ManagerRosterOpportunityFromBelief';

// The existing Manager history fixture's explicit seed and policy are reused.
// No practice belief, new calibration or synthetic execution receipt is added.
export const managerBoundaryPolicy = { policyId: 'execution-learning', version: 'v1',
  availableAtDay: 10, successfulExecutionMean: 1,
  evidenceWeight: 1, uncertaintyFloor: 0.1,
  recentHistoryLimit: 8 };
const setupExecution = (databasePath: string, stableEstimate = false) => {
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
          executionFeasibility: stableEstimate ? { mean: 1, uncertainty: 0.1, evidence: 2 ** 54 } : { mean: 0.2,
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


export const managerBoundaryFixture = (cleanup: (() => void)[], stableEstimate = false) => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-manager-boundary-'));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const databasePath = join(directory, 'world.sqlite');
  setupExecution(databasePath, stableEstimate);
  let history = openSqliteManagerBeliefHistoryStore(databasePath);
  let historyOpen = true;
  cleanup.push(() => { if (historyOpen) { history.close(); historyOpen = false; } });
  history.initializeFromOpportunity({ careerId: 'career-a', clubId: 'club-a', decisionId: 'decision-1', policy: managerBoundaryPolicy });
  const initial = history.readHead('career-a', 'manager-a')!;
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  let db = new DatabaseSync(databasePath), dbOpen = true;
  cleanup.push(() => { if (dbOpen) { db.close(); dbOpen = false; } });
  const first = () => history.apply({ careerId: 'career-a', managerId: 'manager-a', expectedRevision: 0, executionId: 'execution-1' });
  const second = () => {
    const roster = openSqliteManagerRosterDecisionStore(databasePath);
    try {
      const original = roster.readOpportunity('career-a', 'club-a', 'decision-1')!;
      const issued = issueManagerRosterOpportunityFromBelief(roster, history, {
        careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: 1, clubAsOfDay: 12,
        control: original.control, decisionId: 'decision-2', contextId: 'roster-context-2', worldRevision: 1,
        managerId: 'manager-a', appointmentId: 'appointment-a', candidates: [{ actionId: 'rest-p1', command: {
          commandId: 'rest-p1', expectedRevision: 1, effectiveDay: 12,
          changes: [{ playerId: 'p1', availability: { status: 'AVAILABLE', evidenceId: 'recovered-1' } }],
        } }, { actionId: 'keep-p1', command: { commandId: 'keep-p1', expectedRevision: 1, effectiveDay: 12,
          changes: [{ playerId: 'p1', availability: { status: 'UNAVAILABLE', evidenceId: 'still-resting-1' } }],
        } }],
      });
      const selected = selectManagerControlledDecision(issued.control, issued.opportunity, issued.selectionAgent, 'trace-2');
      if (!selected.ok) throw new Error('real second Manager selection is missing');
      const binding = issued.bindings.find(value => value.actionId === selected.value.decision.actionId)!;
      roster.apply({ careerId: 'career-a', clubId: 'club-a', expectedClubRevision: 0, expectedRosterRevision: 1,
        expectedMoodRevision: null, control: issued.control, opportunity: issued.opportunity, selection: selected.value,
        selectionAgent: issued.selectionAgent, binding, clubAsOfDay: 12, currentWorldRevision: 1, afterWorldRevision: 2,
        executionId: 'execution-2' });
    } finally { roster.close(); }
    return history.apply({ careerId: 'career-a', managerId: 'manager-a', expectedRevision: 1, executionId: 'execution-2' });
  };
  const snapshot = () => JSON.stringify(Object.fromEntries(['world_manager_person_heads', 'world_manager_belief_observations',
    'world_roster_opportunities', 'world_roster_executions', 'world_roster_heads', 'world_control_heads',
    'world_decision_revision_events'].map(table => [table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()])));
  return { databasePath, initial, first, second, snapshot, get history() { return history; }, get db() { return db; },
    reopen() {
      db.close(); dbOpen = false; history.close(); historyOpen = false;
      history = openSqliteManagerBeliefHistoryStore(databasePath); historyOpen = true;
      db = new DatabaseSync(databasePath); dbOpen = true;
    },
  };
};
