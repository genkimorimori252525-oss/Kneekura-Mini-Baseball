import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { bootstrap, state as club,
  value as clubValue } from '../../core/world/club/ClubFixtures.test-support';
import { createClubFromSeed } from '../../core/world/club';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { createRosterState } from '../../core/world/roster/RosterState';
import { applyRosterChange } from '../../core/world/roster/RosterCommands';
import type { RosterStateInput } from '../../core/world/roster/RosterTypes';
import { createEmotionState } from '../../core/world/psychology/EmotionState';
import { appraisalInput, change, value } from '../../core/world/psychology/appraisal/AppraisalFixtures.test-support';
import { createPlayerRelationshipNetwork } from '../../core/world/team/PlayerRelationships';
import { createTeamMoodState } from '../../core/world/team/TeamMood';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { openSqliteWorldSettlementStore,
  type SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { openSqliteManagerRosterDecisionStore,
  type SqliteManagerRosterDecisionStore,
  type RosterExecutionRequest } from './SqliteManagerRosterDecisionStore';

const directories: string[] = [];
const worlds: SqliteWorldSettlementStore[] = [];
const rosters: SqliteManagerRosterDecisionStore[] = [];
afterEach(() => {
  for (const store of rosters.splice(0)) store.close();
  for (const store of worlds.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-roster-world-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const path = () => {
  const directory = mkdtempSync(join(tmpdir(),
    'kneekura-roster-world-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const open = (databasePath: string) => {
  const store = openSqliteManagerRosterDecisionStore(databasePath);
  rosters.push(store);
  return store;
};
const world = (databasePath: string,
  includeSecond = false) => {
  const store = openSqliteWorldSettlementStore(databasePath);
  worlds.push(store);
  store.initialize({ careerId: 'career-a',
    clubs: includeSecond ? [club(), secondClub()] : [club()],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
      memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game-1', homeClubId: 'club-a',
        awayClubId: 'club-b' }],
      revisionEventIds: ['schedule-revision-1'] },
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 } });
  const controlStore = openSqliteWorldControlStore(databasePath);
  controlStore.initialize({ careerId: 'career-a',
    control: request().control, worldRevision: 0 });
  controlStore.close();
  return store;
};
const secondClub = () => {
  const fixture = bootstrap();
  return clubValue(createClubFromSeed({ ...fixture,
    context: { ...fixture.context, existingClubIds: ['club-a'] },
    seed: { ...fixture.seed, identity: {
      ...fixture.seed.identity, clubId: 'club-b',
      canonicalOriginId: 'source-b',
      foundingIdentityRef: 'founding-b',
    } },
    initial: { ...fixture.initial,
      brand: { displayName: 'Second Club', shortName: 'SC' },
      references: { ...fixture.initial.references,
        staffRoleLinks: [{ roleId: 'manager-role',
          roleKind: 'MANAGER' as const, personId: 'manager-b',
          appointmentId: 'appointment-b' }],
        rivalryStateRefs: [],
      },
    },
  }));
};
const roster = () => createRosterState({ careerId: 'career-a',
  effectiveDay: 10,
  profiles: [{ profileId: 'league', version: 'v1', season: 1,
    competitionEditionId: 'league-season-1', activeLimit: null,
    allowedAssignmentKinds: ['FIRST_TEAM'],
    rehabParticipationAllowed: false }],
  units: [{ unitId: 'first', clubId: 'club-a', kind: 'FIRST_TEAM' }],
  players: ['p1', 'p2'].map((playerId) => ({ playerId,
    clubRights: { rightsHolderClubId: 'club-a',
      contractId: `contract-${playerId}` },
    assignment: { unitId: 'first', clubId: 'club-a' },
    registrations: [], availability: { status: 'AVAILABLE' as const,
      evidenceId: `health-${playerId}` },
  })),
} as RosterStateInput);
const sharedRoster = () => {
  const initial = roster();
  return createRosterState({ ...initial,
    units: [...initial.units, { unitId: 'second',
      clubId: 'club-b', kind: 'FIRST_TEAM' as const }],
    players: initial.players.map((player) => player.playerId === 'p2'
      ? { ...player,
        clubRights: { rightsHolderClubId: 'club-b',
          contractId: 'contract-p2' },
        assignment: { unitId: 'second', clubId: 'club-b' } }
      : player),
  });
};
const request = () => {
  const control = createHumanControlState({ revision: 0,
    controllerId: 'human', controlledClubId: 'club-a',
    domainIds: ['ROSTER'], manualDomainIds: [] });
  const opportunity = { decisionId: 'decision-1',
    contextId: 'roster-context-1', worldRevision: 0,
    clubId: 'club-a', domainId: 'ROSTER', managerId: 'manager-a',
    appointmentId: 'appointment-a', legalActionIds: ['rest-p1'] };
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
        competitiveOutcome: { mean: 1, uncertainty: 0, evidence: 1 },
        resourceHealth: { mean: 1, uncertainty: 0, evidence: 1 },
        executionFeasibility: { mean: 1, uncertainty: 0, evidence: 1 },
        opponentInformationResponse: { mean: 1, uncertainty: 0,
          evidence: 1 } }] },
      strategyMemory: { activePolicyActionIds: [] as string[] },
    } };
  const selected = selectManagerControlledDecision(control,
    opportunity, selectionAgent, 'trace-1');
  if (!selected.ok) throw new Error('invalid selection fixture');
  return { careerId: 'career-a', clubId: 'club-a',
    expectedClubRevision: 0, expectedRosterRevision: 0,
    expectedMoodRevision: null,
    control, opportunity, selection: selected.value,
    selectionAgent, clubAsOfDay: 11,
    binding: { actionId: 'rest-p1', command: {
      commandId: 'rest-p1', expectedRevision: 0,
      effectiveDay: 11, changes: [{ playerId: 'p1',
        availability: { status: 'UNAVAILABLE' as const,
          evidenceId: 'usage-observed-1' } }],
    } }, currentWorldRevision: 0, afterWorldRevision: 1,
    executionId: 'execution-1' };
};
const issue = (store: SqliteManagerRosterDecisionStore,
  selected: RosterExecutionRequest = request()) => store.issueOpportunity({
    careerId: selected.careerId, clubId: selected.clubId,
    expectedClubRevision: selected.expectedClubRevision,
    expectedRosterRevision: selected.expectedRosterRevision,
    clubAsOfDay: selected.clubAsOfDay,
    control: selected.control, decisionId: selected.opportunity.decisionId,
    contextId: selected.opportunity.contextId,
    worldRevision: selected.opportunity.worldRevision,
    candidates: [selected.binding],
    selectionAgent: selected.selectionAgent,
  });

it('requires a durable host-issued legal binding before execution', () => {
  const databasePath = path();
  world(databasePath);
  const store = open(databasePath);
  store.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: roster(), mood: null });
  expect(() => store.apply(request())).toThrow('issued');
  const issued = issue(store);
  expect(issued.opportunity.legalActionIds).toEqual(['rest-p1']);
  store.close();
  rosters.splice(rosters.indexOf(store), 1);
  const reopened = open(databasePath);
  expect(() => reopened.apply({ ...request(), binding: {
    ...request().binding, command: { ...request().binding.command,
      changes: [{ playerId: 'p1', availability: {
        status: 'UNAVAILABLE', evidenceId: 'forged-evidence' } }] },
  } })).toThrow('issued');
  expect(() => reopened.apply({ ...request(), opportunity: {
    ...request().opportunity, worldRevision: 1,
  } })).toThrow('issued');
  expect(() => reopened.apply({ ...request(), selectionAgent: {
    ...request().selectionAgent, state: {
      ...request().selectionAgent.state,
      strategyMemory: { activePolicyActionIds: ['rest-p1'] },
    },
  } })).toThrow('issued');
  expect(reopened.apply(request()).result.roster.revision).toBe(1);
  const controlStore = openSqliteWorldControlStore(databasePath);
  expect(controlStore.readHead('career-a')?.worldRevision).toBe(1);
  controlStore.close();
});

it('rejects caller-forged control and world revisions against the durable head', () => {
  const databasePath = path();
  world(databasePath);
  const store = open(databasePath);
  store.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: roster(), mood: null });
  const selected = request();
  expect(() => issue(store, { ...selected, control: {
    ...selected.control, controllerId: 'impostor',
  } })).toThrow('durable control');
  expect(() => store.issueOpportunity({
    careerId: 'career-a', clubId: 'club-a',
    expectedClubRevision: 0, expectedRosterRevision: 0,
    clubAsOfDay: 11, control: selected.control,
    decisionId: 'decision-1', contextId: 'roster-context-1',
    worldRevision: 1, candidates: [selected.binding],
    selectionAgent: selected.selectionAgent,
  })).toThrow('durable world revision');
  issue(store);
  const controlStore = openSqliteWorldControlStore(databasePath);
  const changed = controlStore.changeControl({ careerId: 'career-a',
    expectedWorldRevision: 0,
    change: { expectedRevision: 0, controlledClubId: 'club-b',
      manualDomainIds: [] } });
  expect(changed.worldRevision).toBe(1);
  controlStore.close();
  expect(() => store.apply(request())).toThrow('stale durable world');
  expect(store.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
  const reopened = openSqliteWorldControlStore(databasePath);
  expect(reopened.readHead('career-a')?.control.controlledClubId)
    .toBe('club-b');
  reopened.close();
});

it('uses one career roster head across two clubs', () => {
  const databasePath = path();
  world(databasePath, true);
  const store = open(databasePath);
  const initial = sharedRoster();
  store.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: initial, mood: null });
  store.initialize({ careerId: 'career-a', clubId: 'club-b',
    roster: initial, mood: null });
  const divergent = createRosterState({ ...initial,
    players: initial.players.map((player) => player.playerId === 'p1'
      ? { ...player, availability: { status: 'UNAVAILABLE' as const,
        evidenceId: 'other-club-copy' } } : player),
  });
  expect(() => store.initialize({ careerId: 'career-a',
    clubId: 'club-b', roster: divergent, mood: null }))
    .toThrow('initialized differently');
  issue(store);
  store.apply(request());
  expect(store.readHead('career-a', 'club-b')?.roster.revision).toBe(1);
  expect(store.readHead('career-a', 'club-b')?.roster.players[0]
    ?.availability.evidenceId).toBe('usage-observed-1');
});

it('rejects invalid or unauthorised roster candidates at issue time', () => {
  const databasePath = path();
  world(databasePath);
  const store = open(databasePath);
  store.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: roster(), mood: null });
  const selected = request();
  expect(() => issue(store, { ...selected, binding: {
    actionId: 'rest-p1', command: { ...selected.binding.command,
      changes: [{ playerId: 'unknown', availability: {
        status: 'UNAVAILABLE', evidenceId: 'health-unknown' } }] },
  } })).toThrow('candidate');
  expect(() => issue(store, { ...selected, control: {
    ...selected.control, manualDomainIds: ['ROSTER'],
  } })).toThrow('durable control');
  expect(store.readOpportunity('career-a', 'club-a',
    'decision-1')).toBeNull();
});
const moodRequest = () => {
  const base = request();
  const applied = applyRosterChange(roster(), {
    ...base.binding.command, causeEventId: base.executionId });
  if (!applied.ok) throw new Error('invalid roster event fixture');
  const appraisal = change(appraisalInput(), (draft) => {
    const scope = { careerId: 'career-a', matchId: 'match',
      playerId: 'p1' };
    draft.importance.scope = scope;
    draft.importance.clubId = 'club-a';
    draft.importance.competition.careerId = 'career-a';
    draft.importance.competition.clubId = 'club-a';
    draft.importance.personal.scope = scope;
    draft.importance.personal.clubId = 'club-a';
    draft.importance.rivalry.careerId = 'career-a';
    draft.importance.rivalry.fromClubId = 'club-a';
    draft.player.scope = scope;
    draft.event.scope = scope;
    draft.event.eventId = applied.event.eventId;
    draft.evidenceEventIds = [applied.event.eventId];
    draft.bundleId = 'observed-rest-1';
    draft.event.expectedOutcome = 1;
    draft.event.perceivedOutcome = 0;
  });
  const mood = createTeamMoodState(roster(), 'club-a', {
    policyId: 'mood', version: 'v1', season: 1,
    availableAtDay: 0,
    baseline: { confidence: 50, cohesion: 50, energy: 50,
      tension: 50, roleHarmony: 50 },
    directStrength: 1, diffusionStrength: 0,
    dailyReversion: { confidence: 0, cohesion: 0, energy: 0,
      tension: 0, roleHarmony: 0 },
  }, ['p1', 'p2'].map((playerId) => ({ playerId,
    axes: { confidence: 1, cohesion: 1, energy: 1,
      tension: 1, roleHarmony: 1 } })));
  const relationships = createPlayerRelationshipNetwork('career-a', {
    policyId: 'relation', version: 'v1', availableAtDay: 0,
    baseline: { affinity: 50, trust: 50, coordination: 50 },
    deltas: Object.fromEntries(['SHARED_SUCCESS', 'MUTUAL_SUPPORT',
      'JOINT_REPETITION', 'JOINT_EXECUTION', 'JOINT_FAILURE',
      'CONFLICT', 'TRUST_BREACH', 'ROLE_COMPETITION'].map((kind) =>
      [kind, { affinity: 0, trust: 0, coordination: 0 }])) as never,
  });
  return { mood, request: { ...base, expectedMoodRevision: 0,
    moodContext: { relationships,
      emotionState: value(createEmotionState({
        scope: appraisal.importance.scope, policy: appraisal.policy })),
      appraisalInput: appraisal,
      policy: { policyId: 'response', version: 'v1',
        season: 1, availableAtDay: 10,
        responses: { FEAR: { axis: 'tension' as const,
          deltaAtFullPressure: 20 },
        IMPATIENCE: { axis: 'roleHarmony' as const,
          deltaAtFullPressure: -20 },
        ANGER: { axis: 'tension' as const,
          deltaAtFullPressure: 20 },
        MOTIVATION: { axis: 'confidence' as const,
          deltaAtFullPressure: 20 },
        SUPERIORITY: { axis: 'confidence' as const,
          deltaAtFullPressure: 10 } } },
    } } };
};

it('commits roster, event and execution evidence on the existing world DB across restart', () => {
  const databasePath = path();
  const existingWorld = world(databasePath);
  const store = open(databasePath);
  store.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: roster(), mood: null });
  issue(store);
  const saved = store.apply(request());
  expect(saved.result.rosterEvent).toMatchObject({
    causeEventId: 'execution-1', afterRevision: 1 });
  expect(saved.result.projection.worldEvidence.eventIds)
    .toEqual([saved.result.rosterEvent.eventId]);
  expect(store.readHead('career-a', 'club-a')?.roster.revision).toBe(1);
  expect(existingWorld.readClub('career-a', 'club-a')?.revision).toBe(0);
  expect(existingWorld.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(0);
  store.close();
  rosters.splice(rosters.indexOf(store), 1);
  const reopened = open(databasePath);
  expect(reopened.readExecution('execution-1')).toEqual(saved);
  expect(reopened.apply(request())).toEqual(saved);
  expect(reopened.readHead('career-a', 'club-a')?.roster.revision).toBe(1);
});

it('rejects stale CAS and changed execution evidence', () => {
  const databasePath = path();
  world(databasePath);
  const store = open(databasePath);
  store.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: roster(), mood: null });
  issue(store);
  expect(() => store.apply({ ...request(),
    expectedRosterRevision: 1 })).toThrow('issued opportunity');
  const saved = store.apply(request());
  expect(() => store.apply({ ...request(),
    afterWorldRevision: 2 })).toThrow('executionId');
  expect(store.readExecution('execution-1')).toEqual(saved);
  expect(store.readHead('career-a', 'club-a')?.roster.revision).toBe(1);
});

it('rolls back roster and Mood heads when execution insert fails', () => {
  const databasePath = path();
  world(databasePath);
  const store = open(databasePath);
  const fixture = moodRequest();
  store.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: roster(), mood: fixture.mood });
  issue(store, fixture.request);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(databasePath);
  try {
    external.exec(`CREATE TRIGGER fail_roster_execution
      BEFORE INSERT ON world_roster_executions
      BEGIN SELECT RAISE(ABORT, 'injected roster failure'); END;`);
    expect(() => store.apply(fixture.request))
      .toThrow('injected roster failure');
    expect(store.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
    expect(store.readHead('career-a', 'club-a')?.mood?.revision).toBe(0);
    expect(store.readExecution('execution-1')).toBeNull();
    const controlStore = openSqliteWorldControlStore(databasePath);
    expect(controlStore.readHead('career-a')?.worldRevision).toBe(0);
    controlStore.close();
    external.exec('DROP TRIGGER fail_roster_execution');
  } finally {
    external.close();
  }
  store.close();
  rosters.splice(rosters.indexOf(store), 1);
  const reopened = open(databasePath);
  expect(reopened.readExecution('execution-1')).toBeNull();
  expect(reopened.readHead('career-a', 'club-a')?.mood?.revision).toBe(0);
  expect(reopened.apply(fixture.request).result.roster.revision).toBe(1);
});

it('commits receiver-appraised Mood with the roster event and recovers it', () => {
  const databasePath = path();
  world(databasePath);
  const store = open(databasePath);
  const fixture = moodRequest();
  store.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: roster(), mood: fixture.mood });
  issue(store, fixture.request);
  expect(() => store.apply({ ...fixture.request,
    expectedMoodRevision: 1 })).toThrow('mood revision');
  const saved = store.apply(fixture.request);
  expect(saved.moodRevision).toBe(1);
  expect(saved.result.mood?.mood?.event.sourceEventId)
    .toBe(saved.result.rosterEvent.eventId);
  expect(store.readHead('career-a', 'club-a')?.mood?.revision).toBe(1);
  store.close();
  rosters.splice(rosters.indexOf(store), 1);
  const reopened = open(databasePath);
  expect(reopened.readExecution('execution-1')).toEqual(saved);
  expect(reopened.apply(fixture.request)).toEqual(saved);
});
