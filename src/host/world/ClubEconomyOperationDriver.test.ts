import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { applyClubCommand } from '../../core/world/club/ClubLifecycle';
import { bootstrap, command, state } from
  '../../core/world/club/ClubFixtures.test-support';
import { createClubFromSeed } from '../../core/world/club/ClubSeed';
import { appendClubWageSchedule,
  createClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import { persistClubEconomyOperation } from
  './ClubEconomyOperationDriver';
import { openSqliteClubEconomyStore,
  type SqliteClubEconomyStore } from './SqliteClubEconomyStore';
import { openSqliteWorldSettlementStore,
  type SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';

const directories: string[] = [];
const economies: SqliteClubEconomyStore[] = [];
const worlds: SqliteWorldSettlementStore[] = [];
const path = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-economy-driver-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const openEconomy = (databasePath: string) => {
  const store = openSqliteClubEconomyStore(databasePath);
  economies.push(store);
  return store;
};
const openWorld = (databasePath: string) => {
  const store = openSqliteWorldSettlementStore(databasePath);
  worlds.push(store);
  return store;
};
afterEach(() => {
  for (const store of economies.splice(0)) store.close();
  for (const store of worlds.splice(0)) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-economy-driver-')) {
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
const initialize = (store: SqliteWorldSettlementStore,
  club: ReturnType<typeof state>) => store.initialize({ careerId: 'career-a',
  schedule, standingsPolicy, clubs: [club] });

const structural = () => {
  const club = state();
  return { kind: 'STRUCTURAL_REVENUE' as const,
    applicationId: 'structural-1', expectedClubRevision: club.revision,
    club, history: { checkpoint: club, acceptedEvents: [] },
    wageSchedules: createClubWageScheduleLedger('career-a', 'club-a'),
    fact: { factId: 'receipt-fact-1', careerId: 'career-a',
      clubId: 'club-a', season: 1, category: 'commercial' as const,
      settlementRef: 'sponsor-settlement-1', sourceEventId: 'sponsor-paid-1',
      receivedAtDay: 10, availableAtDay: 10,
      capacityRevisionAtReceipt: 0, amount: 200, currency: 'SIM' },
    policy: { policyId: 'structural-v1', version: 'v1',
      careerId: 'career-a', clubId: 'club-a', season: 1,
      availableAtDay: 10, currency: 'SIM', maximumSeasonAmount: 700,
      allowedCategories: ['commercial'] as const } };
};

const payroll = () => {
  const created = createClubFromSeed(bootstrap());
  if (!created.ok) throw new Error(JSON.stringify(created.reason));
  const committed = applyClubCommand(created.value, command([{
    kind: 'RECORD_COMMITMENT', commitmentId: 'wage-1',
    contractRef: 'contract-1', category: 'playerWages',
    budgetBucket: 'payroll', amount: 300, currency: 'SIM',
  }], created.value, 'contract-1'));
  if (!committed.ok) throw new Error(JSON.stringify(committed.reason));
  const club = committed.state;
  const wageSchedules = appendClubWageSchedule(
    createClubWageScheduleLedger('career-a', 'club-a'), 0,
    club, committed.event, { commitmentId: 'wage-1',
      contractRef: 'contract-1', annualAmounts: [
        { season: 1, amount: 100 }, { season: 2, amount: 200 }] });
  return { kind: 'PLAYER_WAGE' as const, applicationId: 'payroll-1',
    expectedClubRevision: club.revision, club,
    history: { checkpoint: club, acceptedEvents: [] }, wageSchedules,
    commitmentId: 'wage-1', payrollRunEventId: 'payroll-run-1',
    policy: { policyId: 'annual-wages', version: 'v1',
      careerId: 'career-a', clubId: 'club-a', season: 1,
      availableAtDay: 10, dueAtDay: 13, currency: 'SIM' } };
};

it('saves a source-backed structural receipt and retries exact evidence after restart', () => {
  const databasePath = path();
  const input = structural();
  const world = openWorld(databasePath);
  initialize(world, input.club);
  const economy = openEconomy(databasePath);
  const saved = persistClubEconomyOperation(economy, input);
  expect(saved.batch.applications[0]).toMatchObject({
    kind: 'STRUCTURAL_REVENUE', basis: {
      factId: 'receipt-fact-1', sourceEventId: 'sponsor-paid-1',
      amount: 200, capacityRevision: 0 } });
  economy.close();
  economies.splice(economies.indexOf(economy), 1);
  const reopened = openEconomy(databasePath);
  expect(persistClubEconomyOperation(reopened, input)).toEqual(saved);
  expect(world.readClub('career-a', 'club-a')?.state.live.finance
    .revenue.commercial).toBe(200);
  expect(() => persistClubEconomyOperation(reopened, { ...input,
    fact: { ...input.fact, amount: 201 } })).toThrow('applicationId');
});

it('saves the scheduled annual wage and rejects a changed ledger on retry', () => {
  const databasePath = path();
  const input = payroll();
  const world = openWorld(databasePath);
  initialize(world, input.club);
  const economy = openEconomy(databasePath);
  const saved = persistClubEconomyOperation(economy, input);
  expect(saved.batch.applications[0]).toMatchObject({
    kind: 'PLAYER_WAGE', basis: { commitmentId: 'wage-1',
      annualAllocation: 100, amount: 100,
      payrollRunEventId: 'payroll-run-1' } });
  expect(persistClubEconomyOperation(economy, input)).toEqual(saved);
  expect(world.readClub('career-a', 'club-a')?.state.live.finance
    .commitments[0].paidThisSeason).toBe(100);
  expect(() => persistClubEconomyOperation(economy, { ...input,
    wageSchedules: { ...input.wageSchedules,
      revision: input.wageSchedules.revision + 1 } }))
    .toThrow('applicationId');
});

it('rejects stale CAS and source dates or season mismatches without updating club', () => {
  const databasePath = path();
  const input = structural();
  const world = openWorld(databasePath);
  initialize(world, input.club);
  const economy = openEconomy(databasePath);
  expect(() => persistClubEconomyOperation(economy, { ...input,
    expectedClubRevision: 1 })).toThrow('revision');
  expect(() => persistClubEconomyOperation(economy, { ...input,
    fact: { ...input.fact, receivedAtDay: 9 } })).toThrow();
  expect(() => persistClubEconomyOperation(economy, { ...input,
    policy: { ...input.policy, season: 2 } })).toThrow();
  expect(world.readClub('career-a', 'club-a')?.revision).toBe(0);
  expect(economy.readApplication('structural-1')).toBeNull();
});

it('rejects a wage payment outside the season or before its available date', () => {
  const databasePath = path();
  const input = payroll();
  const world = openWorld(databasePath);
  initialize(world, input.club);
  const economy = openEconomy(databasePath);
  expect(() => persistClubEconomyOperation(economy, { ...input,
    policy: { ...input.policy, season: 2 } })).toThrow();
  expect(() => persistClubEconomyOperation(economy, { ...input,
    policy: { ...input.policy, availableAtDay: 14 } })).toThrow();
  expect(world.readClub('career-a', 'club-a')?.revision).toBe(1);
  expect(economy.readApplication('payroll-1')).toBeNull();
});
