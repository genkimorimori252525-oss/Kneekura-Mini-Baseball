import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createRosterState } from '../../core/world/roster/RosterState';
import { freeAgentFixture as fixture } from './FreeAgentContractFixture.test-support';
import { createTeamMoodState } from '../../core/world/team/TeamMood';
import { openSqliteManagerRosterDecisionStore,
  type SqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import { openSqliteWorldSettlementStore,
  type SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteFreeAgentContractStore,
  type SqliteFreeAgentContractStore } from
  './SqliteFreeAgentContractStore';
import { openSqlitePopularityHistoryStore } from
  './SqlitePopularityHistoryStore';
import { openSqliteClubEventJournal } from './SqliteClubEventJournal';

const directories: string[] = [];
const worldStores: SqliteWorldSettlementStore[] = [];
const rosterStores: SqliteManagerRosterDecisionStore[] = [];
const contracts: SqliteFreeAgentContractStore[] = [];
const path = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-free-agent-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const world = (databasePath: string) => {
  const store = openSqliteWorldSettlementStore(databasePath);
  worldStores.push(store);
  return store;
};
const roster = (databasePath: string) => {
  const store = openSqliteManagerRosterDecisionStore(databasePath);
  rosterStores.push(store);
  return store;
};
const contract = (databasePath: string) => {
  const store = openSqliteFreeAgentContractStore(databasePath, {
    readAcceptedPlayerPersonLink: (sourceId: string) =>
      sourceId === 'person-link-1' ? { careerId: 'career-a',
        playerId: 'target', personId: 'person-target' } : null,
  });
  contracts.push(store);
  return store;
};
afterEach(() => {
  for (const store of contracts.splice(0)) store.close();
  for (const store of rosterStores.splice(0)) store.close();
  for (const store of worldStores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-free-agent-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const initialize = (databasePath: string,
  x: ReturnType<typeof fixture>) => {
  const w = world(databasePath);
  w.initialize({ careerId: 'career-a', clubs: [x.beforeClub],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
      memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game-1', homeClubId: 'club-a',
        awayClubId: 'club-b' }],
      revisionEventIds: ['schedule-revision-1'] },
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 } });
  const r = roster(databasePath);
  r.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: x.rosterState, mood: null });
  const c = contract(databasePath);
  c.initializeWageSchedules(x.beforeSchedules);
  return { w, r, c };
};

it('acquires one accepted free agent in a 11700-Player global roster without changing other Players', () => {
  const databasePath = path(), initial = fixture();
  // Scale fixture only: unassigned global Players are not a production intake or quota policy.
  const expanded = createRosterState({ ...initial.rosterState, players: [initial.rosterState.players[0],
    ...Array.from({ length: 11699 }, (_, index) => ({ playerId: `capacity-player-${index}`,
      clubRights: { rightsHolderClubId: null, contractId: null }, assignment: null, registrations: [],
      availability: { status: 'UNAVAILABLE' as const, evidenceId: `capacity-intake-${index}` } }))] });
  const x = { ...initial, rosterState: expanded, request: { ...initial.request, roster: expanded } };
  const { r, c } = initialize(databasePath, x);
  const saved = c.apply(x.request);
  expect(saved.rosterRevision).toBe(1);
  const after = r.readHead('career-a', 'club-a')!.roster;
  expect(after.players).toHaveLength(11700);
  expect(after.players.slice(1)).toEqual(expanded.players.slice(1));
  expect(after.players[0].clubRights).toEqual({ rightsHolderClubId: 'club-a', contractId: 'contract-1' });
  c.close(); contracts.splice(contracts.indexOf(c), 1);
  const reopened = contract(databasePath);
  expect(reopened.readApplication(x.request.applicationId)).toEqual(saved);
  expect(reopened.apply(x.request)).toEqual(saved);
});

it('atomically saves accepted free-agent rights and exposes durable popularity authority', () => {
  const databasePath = path();
  const x = fixture();
  const { w, r, c } = initialize(databasePath, x);
  const saved = c.apply(x.request);
  expect(saved).toMatchObject({ applicationId: 'fa-application-1',
    clubRevision: 1, rosterRevision: 1, wageRevision: 1,
    rightsEvent: { type: 'FREE_AGENT_RIGHTS_ACQUIRED',
      playerId: 'target', decisionId: 'decision-1' } });
  expect(w.readClub('career-a', 'club-a')?.state.live.finance
    .commitments).toMatchObject([{ commitmentId: 'wage-1' }]);
  expect(r.readHead('career-a', 'club-a')?.roster.players[0]
    .clubRights).toEqual({ rightsHolderClubId: 'club-a',
      contractId: 'contract-1' });
  expect(c.readWageSchedules('career-a', 'club-a')?.schedules[0])
    .toMatchObject({ commitmentId: 'wage-1',
      annualAmounts: [{ season: 1, amount: 100 },
        { season: 2, amount: 200 }] });
  expect(c.readAcceptedFreeAgentRightsEvent(saved.rightsEvent.eventId))
    .toMatchObject({ rightsEvent: saved.rightsEvent,
      personId: 'person-target', playerId: 'target',
      personLinkSourceId: 'person-link-1' });
  const journal = openSqliteClubEventJournal(databasePath);
  expect(journal.readHistory('career-a', 'club-a')?.acceptedEvents)
    .toEqual([x.request.clubEvent]);
  journal.close();
  const popularity = openSqlitePopularityHistoryStore(databasePath, c);
  try {
    popularity.initialize('career-a', 'person-target', null);
    const applied = popularity.apply({
      eventId: saved.rightsEvent.eventId, careerId: 'career-a',
      personId: 'person-target', playerId: 'target',
      expectedRevision: 0, asOfDay: 12,
      policy: { policyId: 'popularity-update', version: 'v1',
        availableAtDay: 0, initialAwareness: 0,
        initialFavorability: 0.5, awarenessRate: 0.3,
        favorabilityRate: 0.2, maximumAwarenessStep: 0.1,
        maximumFavorabilityStep: 0.05 },
      evidence: [{ evidenceId: 'audience-a',
        sourceCareerEventId: saved.rightsEvent.eventId,
        audience: { kind: 'CLUB_FANS', scopeId: 'club-a' },
        observedAtDay: 11, availableAtDay: 12,
        reach: 0.8, response: 0.9 }],
    });
    expect(applied.history.transfers).toMatchObject([{
      toClubId: 'club-a' }]);
  } finally {
    popularity.close();
  }
  c.close();
  contracts.splice(contracts.indexOf(c), 1);
  const reopened = contract(databasePath);
  expect(reopened.readApplication('fa-application-1')).toEqual(saved);
  expect(reopened.readAcceptedFreeAgentRightsEvent(
    saved.rightsEvent.eventId)?.personLinkSourceId)
    .toBe('person-link-1');
  expect(reopened.apply(x.request)).toEqual(saved);
  expect(() => reopened.apply({ ...x.request,
    acceptance: { ...x.request.acceptance,
      totalMinorUnits: 301 } })).toThrow('applicationId');
});

it('preserves the manager roster head Mood while acquiring unassigned rights', () => {
  const databasePath = path();
  const x = fixture();
  const rosterState = createRosterState({ ...x.rosterState,
    units: [{ unitId: 'first', clubId: 'club-a', kind: 'FIRST_TEAM' }],
    players: [...x.rosterState.players, {
      playerId: 'member', clubRights: { rightsHolderClubId: 'club-a',
        contractId: 'member-contract' },
      assignment: { unitId: 'first', clubId: 'club-a' },
      registrations: [], availability: { status: 'AVAILABLE',
        evidenceId: 'member-health' },
    }],
  });
  const mood = createTeamMoodState(rosterState, 'club-a', {
    policyId: 'mood', version: 'v1', season: 1, availableAtDay: 0,
    baseline: { confidence: 50, cohesion: 50, energy: 50,
      tension: 50, roleHarmony: 50 },
    directStrength: 1, diffusionStrength: 0,
    dailyReversion: { confidence: 0, cohesion: 0, energy: 0,
      tension: 0, roleHarmony: 0 },
  }, [{ playerId: 'member', axes: { confidence: 1,
    cohesion: 1, energy: 1, tension: 1, roleHarmony: 1 } }]);
  const w = world(databasePath);
  w.initialize({ careerId: 'career-a', clubs: [x.beforeClub],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
      memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game-1', homeClubId: 'club-a',
        awayClubId: 'club-b' }], revisionEventIds: ['schedule-1'] },
    standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1,
      tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  const r = roster(databasePath);
  r.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: rosterState, mood });
  const c = contract(databasePath);
  c.initializeWageSchedules(x.beforeSchedules);
  c.apply({ ...x.request, roster: rosterState });
  expect(r.readHead('career-a', 'club-a')?.mood).toEqual(mood);
  expect(r.readHead('career-a', 'club-a')?.roster.players.find((player) =>
    player.playerId === 'target')?.clubRights.rightsHolderClubId)
    .toBe('club-a');
});

it('rolls back Club, roster, wage and rights when application insert fails', () => {
  const databasePath = path();
  const x = fixture();
  const { w, r, c } = initialize(databasePath, x);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(databasePath);
  try {
    external.exec(`CREATE TRIGGER fail_free_agent_application
      BEFORE INSERT ON world_free_agent_applications
      BEGIN SELECT RAISE(ABORT, 'injected free-agent failure'); END;`);
    expect(() => c.apply(x.request)).toThrow('injected free-agent failure');
    expect(w.readClub('career-a', 'club-a')?.revision).toBe(0);
    expect(r.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
    expect(c.readWageSchedules('career-a', 'club-a')?.revision).toBe(0);
    expect(c.readApplication('fa-application-1')).toBeNull();
    external.exec('DROP TRIGGER fail_free_agent_application');
  } finally {
    external.close();
  }
  expect(c.apply(x.request).rosterRevision).toBe(1);
});

it('rejects stale CAS and forged acceptance without changing any head', () => {
  const databasePath = path();
  const x = fixture();
  const { w, r, c } = initialize(databasePath, x);
  expect(() => c.apply({ ...x.request,
    expectedRosterRevision: 1 })).toThrow('roster revision');
  expect(() => c.apply({ ...x.request,
    acceptance: { ...x.request.acceptance,
      sourceEventId: 'fabricated' } })).toThrow('acceptance');
  expect(() => c.apply({ ...x.request,
    personLink: { ...x.request.personLink,
      personId: 'invented-person' } })).toThrow('person link');
  expect(w.readClub('career-a', 'club-a')?.revision).toBe(0);
  expect(r.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
  expect(c.readWageSchedules('career-a', 'club-a')?.revision).toBe(0);
});

it('rejects a second Club acquiring the same Player through the global roster CAS', () => {
  const databasePath = path();
  const clubA = fixture('club-a');
  const clubB = fixture('club-b');
  const w = world(databasePath);
  w.initialize({ careerId: 'career-a',
    clubs: [clubA.beforeClub, clubB.beforeClub],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
      memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game-1', homeClubId: 'club-a',
        awayClubId: 'club-b' }], revisionEventIds: ['schedule-1'] },
    standingsPolicy: { version: 'standings-v1', tieCreditNumerator: 1,
      tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  const r = roster(databasePath);
  r.initialize({ careerId: 'career-a', clubId: 'club-a',
    roster: clubA.rosterState, mood: null });
  const c = contract(databasePath);
  c.initializeWageSchedules(clubA.beforeSchedules);
  c.initializeWageSchedules(clubB.beforeSchedules);

  const acquired = c.apply(clubB.request);
  expect(acquired.rightsEvent).toMatchObject({ playerId: 'target',
    clubId: 'club-b' });
  expect(() => c.apply(clubA.request)).toThrow('stale world roster revision');
  expect(w.readClub('career-a', 'club-a')?.revision).toBe(0);
  expect(c.readWageSchedules('career-a', 'club-a')?.revision).toBe(0);
  expect(r.readHead('career-a', 'club-a')?.roster.players[0]
    .clubRights.rightsHolderClubId).toBe('club-b');
  expect(c.readApplication(clubA.request.applicationId)).toBeNull();
  expect(c.apply(clubB.request)).toEqual(acquired);
});
