import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import type { ClubEconomySource } from
  '../../core/world/club/ClubEconomyBatch';
import { applyClubCommand } from '../../core/world/club/ClubLifecycle';
import { bootstrap, command, state } from
  '../../core/world/club/ClubFixtures.test-support';
import { createClubFromSeed } from '../../core/world/club/ClubSeed';
import { appendClubWageSchedule,
  createClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import { openSqliteClubEconomyStore,
  type SqliteClubEconomyStore } from './SqliteClubEconomyStore';
import { openSqliteWorldSettlementStore,
  type SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteClubEventJournal } from './SqliteClubEventJournal';

const directories: string[] = [];
const economyStores: SqliteClubEconomyStore[] = [];
const worldStores: SqliteWorldSettlementStore[] = [];
const path = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-club-economy-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const openEconomy = (databasePath: string) => {
  const store = openSqliteClubEconomyStore(databasePath);
  economyStores.push(store);
  return store;
};
const openWorld = (databasePath: string) => {
  const store = openSqliteWorldSettlementStore(databasePath);
  worldStores.push(store);
  return store;
};
afterEach(() => {
  for (const store of economyStores.splice(0)) store.close();
  for (const store of worldStores.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-club-economy-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const schedule = { seasonId: 'league-season-1', leagueId: 'league-a',
  memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
  games: [{ gameId: 'game-1', homeClubId: 'club-a',
    awayClubId: 'club-b' }], revisionEventIds: ['schedule-revision-1'] };
const standingsPolicy = { version: 'standings-v1',
  tieCreditNumerator: 1, tieCreditDenominator: 2,
  runDifferentialCapPerGame: 10 };
const structuralSource = { kind: 'STRUCTURAL_REVENUE' as const,
  fact: { factId: 'receipt-fact-1', careerId: 'career-a',
    clubId: 'club-a', season: 1, category: 'commercial' as const,
    settlementRef: 'sponsor-settlement-1', sourceEventId: 'sponsor-paid-1',
    receivedAtDay: 10, availableAtDay: 10,
    capacityRevisionAtReceipt: 0, amount: 200, currency: 'SIM' },
  policy: { policyId: 'structural-v1', version: 'v1',
    careerId: 'career-a', clubId: 'club-a', season: 1,
    availableAtDay: 10, currency: 'SIM', maximumSeasonAmount: 700,
    allowedCategories: ['commercial'] as const } };
const structuralFixture = () => {
  const club = state();
  return { club, request: { applicationId: 'structural-apply-1',
    expectedClubRevision: club.revision, club,
    history: { checkpoint: club, acceptedEvents: [] },
    wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'),
    sources: [structuralSource] } };
};
const initialize = (store: SqliteWorldSettlementStore,
  club: ReturnType<typeof state>) => store.initialize({ careerId: 'career-a',
  schedule, standingsPolicy, clubs: [club] });

it('commits structural revenue to the shared club head and replays exactly after restart', () => {
  const databasePath = path();
  const x = structuralFixture();
  const world = openWorld(databasePath);
  initialize(world, x.club);
  const economy = openEconomy(databasePath);
  const saved = economy.apply(x.request);
  expect(saved).toMatchObject({ applicationId: 'structural-apply-1',
    clubRevision: 1, batch: { applications: [{
      kind: 'STRUCTURAL_REVENUE', basis: {
        sourceEventId: 'sponsor-paid-1', amount: 200 } }] } });
  expect(world.readClub('career-a', 'club-a')?.state.live.finance
    .revenue.commercial).toBe(200);
  expect(world.readSeason('career-a', 'league-season-1')?.revision).toBe(0);
  const journal = openSqliteClubEventJournal(databasePath);
  expect(journal.readHistory('career-a', 'club-a'))
    .toEqual({ checkpoint: x.club, acceptedEvents: saved.batch.events });
  journal.close();
  economy.close();
  world.close();
  economyStores.splice(economyStores.indexOf(economy), 1);
  worldStores.splice(worldStores.indexOf(world), 1);
  const reopenedWorld = openWorld(databasePath);
  const reopenedEconomy = openEconomy(databasePath);
  expect(reopenedEconomy.readApplication('structural-apply-1'))
    .toEqual(saved);
  expect(reopenedEconomy.apply(x.request)).toEqual(saved);
  expect(reopenedWorld.readClub('career-a', 'club-a')?.revision).toBe(1);
  const current = reopenedWorld.readClub('career-a', 'club-a')!.state;
  expect(() => reopenedEconomy.apply({
    ...x.request, applicationId: 'second-structural',
    expectedClubRevision: current.revision, club: current,
    history: { checkpoint: current, acceptedEvents: [] },
    sources: [{ ...structuralSource, fact: {
      ...structuralSource.fact, factId: 'receipt-fact-2',
      settlementRef: 'sponsor-settlement-2',
      sourceEventId: 'sponsor-paid-2', amount: 100,
      capacityRevisionAtReceipt: current.revision } }],
  })).toThrow('history does not match accepted journal');
  expect(() => reopenedEconomy.apply({ ...x.request,
    sources: [{ ...structuralSource,
      fact: { ...structuralSource.fact, amount: 201 } }] }))
    .toThrow('applicationId');
});

it('rolls back the club head when recording the economy application fails', () => {
  const databasePath = path();
  const x = structuralFixture();
  const world = openWorld(databasePath);
  initialize(world, x.club);
  const economy = openEconomy(databasePath);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const external = new DatabaseSync(databasePath);
  try {
    external.exec(`CREATE TRIGGER fail_economy_application
      BEFORE INSERT ON world_club_economy_applications
      BEGIN SELECT RAISE(ABORT, 'injected economy failure'); END;`);
    expect(() => economy.apply(x.request)).toThrow('injected economy failure');
    expect(world.readClub('career-a', 'club-a')?.revision).toBe(0);
    expect(economy.readApplication('structural-apply-1')).toBeNull();
    external.exec('DROP TRIGGER fail_economy_application');
  } finally {
    external.close();
  }
  expect(economy.apply(x.request).clubRevision).toBe(1);
});

it('applies a scheduled player wage through the same club head CAS', () => {
  const seed = bootstrap();
  const created = createClubFromSeed(seed);
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  const committed = applyClubCommand(created.value, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
    contractRef: 'contract-1', category: 'playerWages',
    budgetBucket: 'payroll', amount: 300, currency: 'SIM',
  }], created.value, 'contract-1'));
  if (!committed.ok) throw new Error(JSON.stringify(committed.reason));
  const ledger = appendClubWageSchedule(
    createClubWageScheduleLedger('career-a', 'club-a'), 0,
    committed.state, committed.event, { commitmentId: 'wage-1',
      contractRef: 'contract-1', annualAmounts: [
        { season: 1, amount: 100 }, { season: 2, amount: 200 }] });
  const databasePath = path();
  const world = openWorld(databasePath);
  initialize(world, committed.state);
  const economy = openEconomy(databasePath);
  const saved = economy.apply({ applicationId: 'payroll-apply-1',
    expectedClubRevision: committed.state.revision,
    club: committed.state, history: { checkpoint: committed.state,
      acceptedEvents: [] }, wageSchedules: ledger,
    sources: [{ kind: 'PLAYER_WAGE', commitmentId: 'wage-1',
      payrollRunEventId: 'payroll-run-1', policy: {
        policyId: 'annual-wages', version: 'v1', careerId: 'career-a',
        clubId: 'club-a', season: 1, availableAtDay: 10,
        dueAtDay: 13, currency: 'SIM' } }] });
  expect(saved.batch.applications[0]).toMatchObject({
    kind: 'PLAYER_WAGE', basis: { amount: 100,
      payrollRunEventId: 'payroll-run-1' } });
  expect(world.readClub('career-a', 'club-a')?.state.live.finance
    .commitments[0].paidThisSeason).toBe(100);
});

it('rejects stale revision and the Matchday source reserved for game settlement', () => {
  const x = structuralFixture();
  const databasePath = path();
  const world = openWorld(databasePath);
  initialize(world, x.club);
  const economy = openEconomy(databasePath);
  expect(() => economy.apply({ ...x.request,
    expectedClubRevision: 1 })).toThrow('revision');
  expect(() => economy.apply({ ...x.request,
    sources: [{ kind: 'MATCHDAY' } as ClubEconomySource] }))
    .toThrow('non-Matchday');
  expect(() => economy.apply({ ...x.request,
    sources: [{ kind: 'UNKNOWN' } as unknown as ClubEconomySource] }))
    .toThrow('non-Matchday');
  expect(world.readClub('career-a', 'club-a')?.revision).toBe(0);
});
