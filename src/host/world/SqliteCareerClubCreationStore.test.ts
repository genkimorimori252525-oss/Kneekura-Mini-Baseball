import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { createCareerClubs } from '../../core/world/catalog';
import { setup } from '../../core/world/catalog/CatalogFixtures.test-support';
import { openSqliteClubCatalogSnapshotStore } from './SqliteClubCatalogSnapshotStore';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteClubEconomyStore } from './SqliteClubEconomyStore';
import { createClubWageScheduleLedger } from '../../core/world/club/ClubWageScheduleLedger';
import * as creationModule from './SqliteCareerClubCreationStore';

it('atomically creates all 234 Native Club heads and initial relations, then supports the 21 domestic League owners', () => {
  expect(creationModule).toHaveProperty('openSqliteCareerClubCreationStore');
  const path = `file:career-clubs-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const catalogs = openSqliteClubCatalogSnapshotStore(path);
  const savedCatalog = catalogs.initializeCurrent();
  const request = { catalogSnapshotId: savedCatalog.snapshotId, creation: setup(savedCatalog.catalog) };
  const expected = createCareerClubs(savedCatalog.catalog, request.creation);
  if (!expected.ok) throw new Error(expected.reason.code);
  const world = openSqliteWorldSettlementStore(path);
  let creation = creationModule.openSqliteCareerClubCreationStore(path, { catalogs });
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(path);
  try {
    const snapshot = creation.initialize(request);
    expect(snapshot.clubIds).toHaveLength(234);
    expect(snapshot.provenance).toEqual(expected.value.provenance);
    expect(snapshot.rivalryGraph).toEqual(expected.value.rivalryGraph);
    expect(snapshot.competitiveThreats).toEqual(expected.value.competitiveThreats);
    expect(snapshot.rivalryReferences).toEqual(expected.value.rivalryReferences);
    expect(db.prepare('SELECT count(*) AS n FROM world_club_checkpoints').get()).toEqual({ n: 234 });
    for (const club of expected.value.clubs) expect(world.readClub('fixture-career', club.identity.clubId)?.state).toEqual(club);
    expect(creation.initialize(request)).toEqual(snapshot);
    expect(() => creation.initialize({ ...request, creation: { ...request.creation, clubs: request.creation.clubs.map((club, i) => i === 0
      ? { ...club, initial: { ...club.initial, cash: club.initial.cash + 1 } } : club) } })).toThrow('frozen differently');
    creation.close(); creation = creationModule.openSqliteCareerClubCreationStore(path, { catalogs });
    expect(creation.readSnapshot('fixture-career')).toEqual(snapshot);
    for (const league of savedCatalog.catalog.leagues) {
      const clubs = expected.value.clubs.filter((club) => club.season.plan.financialProfile.leagueId === league.leagueId);
      const memberClubIds = clubs.map((club) => club.identity.clubId);
      world.initialize({ careerId: 'fixture-career', clubs,
        schedule: { leagueId: league.leagueId, seasonId: `fixture-edition-${league.leagueId}`, memberClubIds, regularSeasonGamesPerClub: 1,
          revisionEventIds: [`fixture-schedule-${league.leagueId}`],
          games: memberClubIds.filter((_, i) => i % 2 === 0).map((homeClubId, i) => ({ gameId: `${league.leagueId}-game-${i}`, homeClubId, awayClubId: memberClubIds[i * 2 + 1] })) },
        standingsPolicy: { version: 'fixture-standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 5 } });
    }
    expect(db.prepare('SELECT count(*) AS n FROM world_season_heads').get()).toEqual({ n: 21 });
    expect(creation.readSnapshot('fixture-career')).toEqual(snapshot);
    const club = expected.value.clubs[0], clubId = club.identity.clubId;
    const economy = openSqliteClubEconomyStore(path);
    try {
      economy.apply({ applicationId: 'fixture-structural-revenue', expectedClubRevision: club.revision, club,
        history: { checkpoint: club, acceptedEvents: [] }, wageSchedules: createClubWageScheduleLedger('fixture-career', clubId),
        sources: [{ kind: 'STRUCTURAL_REVENUE', fact: { factId: 'fixture-receipt', careerId: 'fixture-career', clubId,
          season: 1, category: 'commercial', settlementRef: 'fixture-settlement', sourceEventId: 'fixture-sponsor-paid',
          receivedAtDay: 10, availableAtDay: 10, capacityRevisionAtReceipt: 0, amount: 200, currency: 'SIM' },
        policy: { policyId: 'fixture-structural', version: 'v1', careerId: 'fixture-career', clubId, season: 1,
          availableAtDay: 10, currency: 'SIM', maximumSeasonAmount: 700, allowedCategories: ['commercial'] } }] });
      expect(world.readClub('fixture-career', clubId)?.revision).toBe(1);
      expect(world.readClub('fixture-career', clubId)?.state.live.finance.revenue.commercial).toBe(200);
      expect(creation.readSnapshot('fixture-career')).toEqual(snapshot);
      expect(creation.initialize(request)).toEqual(snapshot);
      expect(world.readClub('fixture-career', clubId)?.revision).toBe(1);
    } finally { economy.close(); }
    const firstId = snapshot.clubIds[0];
    db.prepare("UPDATE world_club_checkpoints SET state_json='{}' WHERE club_id=?").run(firstId);
    expect(() => creation.readSnapshot('fixture-career')).toThrow('corrupt');
  } finally { db.close(); creation.close(); world.close(); catalogs.close(); }
});

it('rejects absent catalog and invalid profiles before writes, and detects corrupt accepted creation evidence', () => {
  const path = `file:career-clubs-corruption-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const catalogs = openSqliteClubCatalogSnapshotStore(path), saved = catalogs.initializeCurrent();
  const request = { catalogSnapshotId: saved.snapshotId, creation: setup(saved.catalog) };
  const creation = creationModule.openSqliteCareerClubCreationStore(path, { catalogs });
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(path);
  try {
    expect(() => creation.initialize({ ...request, catalogSnapshotId: 'missing' })).toThrow('catalog snapshot is missing');
    const invalid = structuredClone(request);
    invalid.creation.clubs[0].initial.season.financialProfile.leagueId = 'wrong-league';
    expect(() => creation.initialize(invalid)).toThrow('STATE_INCONSISTENT');
    expect(db.prepare('SELECT count(*) AS n FROM world_club_heads').get()).toEqual({ n: 0 });
    expect(creation.readSnapshot('fixture-career')).toBeNull();
    const snapshot = creation.initialize(request);
    expect(Object.isFrozen(snapshot.rivalryReferences)).toBe(true);
    expect(snapshot.snapshotId).toMatch(/^career-club-creation:[a-f0-9]{64}$/);
    const row = db.prepare('SELECT request_json, manifest_json FROM world_career_club_creations').get() as { request_json: string; manifest_json: string };
    db.prepare("UPDATE world_career_club_creations SET manifest_json='{}'").run();
    expect(() => creation.readSnapshot('fixture-career')).toThrow('corrupt');
    db.prepare('UPDATE world_career_club_creations SET manifest_json=?, request_json=?').run(row.manifest_json, '{}');
    expect(() => creation.readSnapshot('fixture-career')).toThrow('corrupt');
    db.prepare('UPDATE world_career_club_creations SET request_json=?').run(row.request_json);
    db.prepare("UPDATE world_club_catalog_snapshots SET catalog_json='{}'").run();
    expect(() => creation.readSnapshot('fixture-career')).toThrow('corrupt');
    expect(() => creation.initialize(request)).toThrow('corrupt');
  } finally { db.close(); creation.close(); catalogs.close(); }
});

it('rolls back every Club and checkpoint on a mid-creation failure and rejects a partial preexisting Career', () => {
  const path = `file:career-clubs-rollback-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const catalogs = openSqliteClubCatalogSnapshotStore(path), saved = catalogs.initializeCurrent();
  const request = { catalogSnapshotId: saved.snapshotId, creation: setup(saved.catalog) };
  const creation = creationModule.openSqliteCareerClubCreationStore(path, { catalogs });
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(path);
  try {
    db.exec(`CREATE TRIGGER abort_test_creation BEFORE INSERT ON world_club_heads
      WHEN new.club_id='${saved.catalog.clubs[100].clubId}' BEGIN SELECT RAISE(ABORT, 'synthetic creation failure'); END`);
    expect(() => creation.initialize(request)).toThrow('synthetic creation failure');
    expect(creation.readSnapshot('fixture-career')).toBeNull();
    expect(db.prepare('SELECT count(*) AS n FROM world_club_heads').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM world_club_checkpoints').get()).toEqual({ n: 0 });
    db.exec('DROP TRIGGER abort_test_creation');
    const world = openSqliteWorldSettlementStore(path);
    try {
      const expected = createCareerClubs(saved.catalog, request.creation);
      if (!expected.ok) throw new Error(expected.reason.code);
      const club = expected.value.clubs[0];
      world.initialize({ careerId: 'fixture-career', clubs: [club],
        schedule: { leagueId: club.season.plan.financialProfile.leagueId, seasonId: club.season.plan.competitionEditionIds[0],
          memberClubIds: [club.identity.clubId, 'partial-other-club'], regularSeasonGamesPerClub: 1, revisionEventIds: ['partial-schedule'],
          games: [{ gameId: 'partial-game', homeClubId: club.identity.clubId, awayClubId: 'partial-other-club' }] },
        standingsPolicy: { version: 'fixture-standings-v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 5 } });
      expect(() => creation.initialize(request)).toThrow('already has Club state');
      expect(creation.readSnapshot('fixture-career')).toBeNull();
      expect(db.prepare('SELECT count(*) AS n FROM world_club_heads').get()).toEqual({ n: 1 });
    } finally { world.close(); }
  } finally { db.close(); creation.close(); catalogs.close(); }
});
