import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import { settleRegularSeasonGame } from
  '../../core/world/competition/OfficialSeasonEconomySettlement';
import { openSqliteWorldSettlementStore,
  type SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteClubEventJournal } from './SqliteClubEventJournal';

const directories: string[] = [];
const stores: SqliteWorldSettlementStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-world-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const path = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-world-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const open = (databasePath: string): SqliteWorldSettlementStore => {
  const store = openSqliteWorldSettlementStore(databasePath);
  stores.push(store);
  return store;
};

const fixture = (twoGames = false) => {
  const club = state();
  const priorMatch: CanonicalMatchState = {
    ruleProfileId: asRuleProfileId('fixture-rules'), inning: 9,
    half: 'top', outs: 2, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null },
    score: { away: 0, home: 1 }, playId: 8,
  };
  const schedule = { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: ['club-a', 'club-b'],
    regularSeasonGamesPerClub: twoGames ? 2 : 1,
    games: [{ gameId: 'game-1', homeClubId: 'club-a',
      awayClubId: 'club-b' },
    ...(twoGames ? [{ gameId: 'game-2', homeClubId: 'club-a',
      awayClubId: 'club-b' }] : [])],
    revisionEventIds: ['schedule-revision-1'] };
  const standingsPolicy = { version: 'standings-v1',
    tieCreditNumerator: 1, tieCreditDenominator: 2,
    runDifferentialCapPerGame: 10 };
  const settlement = settleRegularSeasonGame({
    game: { gameId: 'game-1', seasonId: 'league-season-1',
      homeClubId: 'club-a', awayClubId: 'club-b',
      policy: { version: 'completion-v1', minimumInnings: 9,
        tiesAllowed: false }, priorMatch,
      application: { applicationId: 'application-9', closureId: 'closure-9',
        previousPlayId: 8, durableRevision: 9,
        appliedMatchState: { ...priorMatch, half: 'bottom',
          outs: 0, playId: 9 } },
      lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
        inning: index + 1, awayRuns: 0,
        homeRuns: index === 8 ? null : index === 0 ? 1 : 0,
      })), totals: { away: { runs: 0, hits: 0, errors: 0 },
        home: { runs: 1, hits: 1, errors: 0 } } },
    }, schedule, priorResults: [], standingsPolicy,
    homeClub: club, homeClubHistory: { checkpoint: club,
      acceptedEvents: [] },
    wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'),
    attendance: { factId: 'gate-1', careerId: 'career-a',
      sourceEventId: 'turnstile-1', gameId: 'game-1',
      stadiumId: 'stadium-a', observedAtDay: 10,
      availableAtDay: 10, venueRevisionAtObservation: 0, count: 120 },
    revenuePolicy: { version: 'matchday-v1', availableAtDay: 10,
      seasonId: 'league-season-1', currency: 'SIM',
      recognizedMinorUnitsPerAttendee: 5 }, finalizedAtDay: 11,
  });
  return { club, schedule, standingsPolicy, settlement };
};

it('atomically saves official results, standings, and club finance across restart', () => {
  const databasePath = path();
  const x = fixture();
  const first = open(databasePath);
  first.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const saved = first.persist(x.settlement, 0, x.club.revision);
  expect(saved).toMatchObject({ applicationId: 'application-9',
    seasonRevision: 1, clubRevision: 1 });
  expect(first.readSeason('career-a', 'league-season-1')).toMatchObject({
    revision: 1, results: [{ applicationId: 'application-9' }],
    standings: { kind: 'OFFICIAL', snapshot: {
      resultApplicationIds: ['application-9'] } },
  });
  expect(first.readClub('career-a', 'club-a')).toMatchObject({
    revision: 1, state: { live: { finance: { revenue: {
      matchday: 600 } } } },
  });
  const journal = openSqliteClubEventJournal(databasePath);
  expect(journal.readHistory('career-a', 'club-a'))
    .toEqual({ checkpoint: x.club,
      acceptedEvents: x.settlement.economy.events });
  journal.close();
  first.close();
  const reopened = open(databasePath);
  expect(reopened.readApplication('application-9')).toEqual(saved);
  expect(reopened.persist(x.settlement, 0, x.club.revision)).toEqual(saved);
  expect(reopened.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(1);
  expect(reopened.readClub('career-a', 'club-a')?.revision).toBe(1);
  const reopenedJournal = openSqliteClubEventJournal(databasePath);
  expect(reopenedJournal.readHistory('career-a', 'club-a')
    ?.acceptedEvents).toHaveLength(1);
  reopenedJournal.close();
});

it('recovers provisional standings before the last scheduled game', () => {
  const databasePath = path();
  const x = fixture(true);
  const first = open(databasePath);
  first.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  first.persist(x.settlement, 0, x.club.revision);
  first.close();
  const reopened = open(databasePath);
  expect(reopened.readSeason('career-a', 'league-season-1')).toMatchObject({
    revision: 1, results: [{ applicationId: 'application-9' }],
    standings: { kind: 'PROVISIONAL' },
  });
  expect(reopened.readClub('career-a', 'club-a')?.state.live.finance
    .revenue.matchday).toBe(600);
});

it('rejects a matchday venue basis absent from accepted Club history', () => {
  const x = fixture();
  const store = open(path());
  store.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const first = x.settlement.economy.applications[0]!;
  const forged = { ...x.settlement, economy: {
    ...x.settlement.economy,
    applications: [{ ...first,
      basis: { ...first.basis, venueCapacity: 99999 } }],
  } };
  expect(() => store.persist(forged, 0, x.club.revision))
    .toThrow('venue lacks accepted Club history');
  expect(store.readClub('career-a', 'club-a')?.revision).toBe(0);
});

it('rejects stale season or club revisions and changed application evidence', () => {
  const x = fixture();
  const store = open(path());
  store.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  expect(() => store.persist(x.settlement, 1, x.club.revision))
    .toThrow('season revision');
  expect(() => store.persist(x.settlement, 0, x.club.revision + 1))
    .toThrow('club revision');
  expect(store.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(0);
  store.persist(x.settlement, 0, x.club.revision);
  const changed = { ...x.settlement, gameResult: {
    ...x.settlement.gameResult, awayRuns: 2 } };
  expect(() => store.persist(changed, 0, x.club.revision))
    .toThrow('applicationId');
  expect(store.readClub('career-a', 'club-a')?.state.live.finance
    .revenue.matchday).toBe(600);
});

it('rolls back every world head when the application insert fails', () => {
  const databasePath = path();
  const x = fixture();
  const store = open(databasePath);
  store.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(databasePath);
  external.exec(`CREATE TRIGGER fail_world_application
    BEFORE INSERT ON world_settlement_applications
    BEGIN SELECT RAISE(ABORT, 'injected world failure'); END;`);
  expect(() => store.persist(x.settlement, 0, x.club.revision))
    .toThrow('injected world failure');
  expect(store.readApplication('application-9')).toBeNull();
  expect(store.readSeason('career-a', 'league-season-1')?.results)
    .toEqual([]);
  expect(store.readClub('career-a', 'club-a')?.revision).toBe(0);
  external.exec('DROP TRIGGER fail_world_application');
  external.close();
  expect(store.persist(x.settlement, 0, x.club.revision)
    .seasonRevision).toBe(1);
});

it('retains finite fractional values in the pinned financial profile', () => {
  const x = fixture();
  const club = { ...x.club, season: { ...x.club.season,
    plan: { ...x.club.season.plan, financialProfile: {
      ...x.club.season.plan.financialProfile,
      revenueSharingRate: 0.15, squadCostRatioLimit: 0.7,
    } },
  } };
  const store = open(path());
  store.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [club] });
  expect(store.readClub('career-a', 'club-a')?.state.season.plan
    .financialProfile).toMatchObject({ revenueSharingRate: 0.15,
    squadCostRatioLimit: 0.7 });
});

it('rejects a sparse result array even when an extra property hides its hole', () => {
  const x = fixture();
  const store = open(path());
  store.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  const sparse = new Array<typeof x.settlement.gameResult>(1);
  Object.assign(sparse, { extra: 'conceals-hole' });
  expect(() => store.persist({ ...x.settlement, results: sparse },
    0, x.club.revision)).toThrow('dense arrays');
  expect(store.readSeason('career-a', 'league-season-1')?.revision)
    .toBe(0);
});

it('rejects a durable application whose row scope or request was corrupted', () => {
  const databasePath = path();
  const x = fixture();
  const store = open(databasePath);
  store.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  store.persist(x.settlement, 0, x.club.revision);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(databasePath);
  try {
    external.prepare(`UPDATE world_settlement_applications
      SET game_id='other-game' WHERE application_id='application-9'`).run();
    expect(() => store.readApplication('application-9')).toThrow('corrupt');
    expect(() => store.persist(x.settlement, 0, x.club.revision))
      .toThrow('corrupt');
    external.prepare(`UPDATE world_settlement_applications
      SET game_id='game-1', request_json='{}'
      WHERE application_id='application-9'`).run();
    expect(() => store.readApplication('application-9')).toThrow('corrupt');
  } finally {
    external.close();
  }
});

it('rejects an application missing from the durable season result history', () => {
  const databasePath = path();
  const x = fixture();
  const store = open(databasePath);
  store.initialize({ careerId: 'career-a', schedule: x.schedule,
    standingsPolicy: x.standingsPolicy, clubs: [x.club] });
  store.persist(x.settlement, 0, x.club.revision);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(databasePath);
  try {
    external.prepare(`UPDATE world_season_heads SET results_json='[]'
      WHERE career_id='career-a' AND season_id='league-season-1'`).run();
    expect(() => store.readApplication('application-9')).toThrow('corrupt');
  } finally {
    external.close();
  }
});
