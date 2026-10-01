import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { DEVELOPMENT_DOMAINS } from '../../core/world/development/DevelopmentTrajectory';
import { CATALYST_FAMILIES } from '../../core/world/development/DevelopmentCatalyst';
import { STAR_GENESIS_POTENTIALS } from '../../core/world/development/StarGenesis';
import { generatePlayerPersonPriors } from '../../core/world/development/PlayerPersonPriors';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore, type AcceptedPlayerIntakeSource } from './SqlitePlayerPersonLinkStore';
import { openSqlitePersonGenesisStore } from './SqlitePersonGenesisStore';

const ranges = <T extends string>(keys: readonly T[]) => Object.fromEntries(keys.map((key) =>
  [key, { min: 0.2, max: 0.8 }])) as Record<T, { min: number; max: number }>;
const policies = {
  trajectory: { policyId: 'fixture-trajectory', profileVersion: 'v1', availableAtDay: 10,
    timingWeights: { VERY_EARLY: 1, EARLY: 1, NORMAL: 1, LATE: 1, VERY_LATE: 1 },
    shapeWeights: { SHARP_PEAK: 1, BROAD_PLATEAU: 1, STEPWISE_WAVES: 1 }, domainOffsetRanges: Object.fromEntries(
      DEVELOPMENT_DOMAINS.map((key) => [key, { min: 0, max: 0 }])) as Record<typeof DEVELOPMENT_DOMAINS[number], { min: number; max: number }> },
  catalyst: { policyId: 'fixture-catalyst', profileVersion: 'v1', availableAtDay: 10,
    sensitivityRanges: ranges(CATALYST_FAMILIES), signatureMotifs: [], signatureMotifCount: 0 },
  star: { policyId: 'fixture-star', profileVersion: 'v1', availableAtDay: 10,
    tierWeights: { ORDINARY: 100, STAR_CANDIDATE: 1, SUPERSTAR_CANDIDATE: 0 },
    potentialRanges: { ORDINARY: ranges(STAR_GENESIS_POTENTIALS), STAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS),
      SUPERSTAR_CANDIDATE: ranges(STAR_GENESIS_POTENTIALS) } },
};
const stores: { close(): void }[] = [];
afterEach(() => stores.splice(0).reverse().forEach((store) => store.close()));
const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
const fixture = (reader?: (id: string, read: (id: string) => AcceptedPlayerIntakeSource | null) => AcceptedPlayerIntakeSource | null) => {
  const path = `file:person-batch-${crypto.randomUUID()}?mode=memory&cache=shared`;
  const world = track(openSqliteWorldSettlementStore(path));
  const rosters = track(openSqliteManagerRosterDecisionStore(path));
  world.initialize({ careerId: 'career-a', clubs: [state()], schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
    memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
    games: [{ gameId: 'game-1', homeClubId: 'club-a', awayClubId: 'club-b' }], revisionEventIds: [] },
    standingsPolicy: { version: 'v1', tieCreditNumerator: 1, tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } });
  rosters.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null, roster: createRosterState({ careerId: 'career-a', effectiveDay: 10,
    profiles: [{ profileId: 'league', version: 'v1', season: 1, competitionEditionId: 'league-season-1', activeLimit: null,
      allowedAssignmentKinds: ['FIRST_TEAM'], rehabParticipationAllowed: false }],
    units: [{ unitId: 'first-a', clubId: 'club-a', kind: 'FIRST_TEAM' }], players: [1, 2, 3].map((n) => ({
      playerId: `player-${n}`, clubRights: { rightsHolderClubId: 'club-a', contractId: `contract-${n}` },
      assignment: { unitId: 'first-a', clubId: 'club-a' }, registrations: [],
      availability: { status: 'AVAILABLE' as const, evidenceId: `health-${n}` } })) }) });
  const accepted = new Map<string, AcceptedPlayerIntakeSource>([1, 2, 3].map((n) => [`source-${n}`, {
    sourceId: `source-${n}`, careerId: 'career-a', playerId: `player-${n}`, personId: `person-${n}`,
    sourceRecordId: `intake-${n}`, sourceVersion: 'v1', acceptedRevision: n, acceptedAtDay: 10, rosterRevision: 0 }]));
  const read = (id: string) => accepted.get(id) ?? null;
  const links = track(openSqlitePlayerPersonLinkStore(path, { readAcceptedPlayerIntake: (id) => reader ? reader(id, read) : read(id) }));
  const genesis = track(openSqlitePersonGenesisStore(path));
  genesis.initializeCareer({ careerId: 'career-a', initializedAtDay: 10, careerSeed: 12345, policies });
  const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = track(new DatabaseSync(path));
  return { path, accepted, links, genesis, db, rosters };
};

it('detaches every accepted Source before writes and reopens deterministic ordered population batches', () => {
  let f: ReturnType<typeof fixture>;
  f = fixture((id, read) => {
    expect(f.db.prepare('SELECT count(*) AS n FROM world_player_person_links').get()).toEqual({ n: 0 });
    expect(f.rosters.readHead('career-a', 'club-a')!.roster.players).toHaveLength(3);
    if (id === 'source-2') (read('source-1') as { sourceVersion: string }).sourceVersion = 'later';
    return read(id);
  });
  const ids = ['source-1', 'source-2', 'source-3'];
  expect(f.links.acceptBatch(ids).map((item) => item.sourceVersion)).toEqual(['v1', 'v1', 'v1']);
  const people = f.genesis.materializeBatch(ids);
  for (const [index, person] of people.entries()) {
    expect(person.personId).toBe(`person-${index + 1}`);
    expect(person.priors).toEqual(generatePlayerPersonPriors({ careerId: 'career-a', playerId: person.playerId,
      createdAtDay: 10, careerSeed: 12345, policies }));
    expect(person.priors).not.toHaveProperty('ability');
  }
  f.links.close(); f.genesis.close();
  const links = track(openSqlitePlayerPersonLinkStore(f.path)), genesis = track(openSqlitePersonGenesisStore(f.path));
  expect(links.acceptBatch(ids).map((item) => item.sourceVersion)).toEqual(['v1', 'v1', 'v1']);
  expect(genesis.materializeBatch(ids.slice().reverse())).toEqual(people.slice().reverse());
});

it('rolls back all links on late stale/duplicate Source or write failure and rejects non-inert batches', () => {
  const f = fixture(), ids = ['source-1', 'source-2'];
  const second = f.accepted.get('source-2')!;
  const count = () => f.db.prepare('SELECT count(*) AS n FROM world_player_person_links').get();
  f.accepted.set('source-2', { ...second, rosterRevision: 1 });
  expect(() => f.links.acceptBatch(ids)).toThrow('roster'); expect(count()).toEqual({ n: 0 });
  f.accepted.set('source-2', { ...second, personId: 'person-1' });
  expect(() => f.links.acceptBatch(ids)).toThrow(/unique|UNIQUE/); expect(count()).toEqual({ n: 0 });
  f.accepted.set('source-2', second);
  f.db.exec("CREATE TRIGGER fail_link BEFORE INSERT ON world_player_person_links WHEN NEW.source_id='source-2' BEGIN SELECT RAISE(ABORT,'fixture link failure'); END");
  expect(() => f.links.acceptBatch(ids)).toThrow('fixture link failure'); expect(count()).toEqual({ n: 0 });
  f.db.exec('DROP TRIGGER fail_link');
  for (const invalid of [[], ['source-1', 'source-1'], ['source-1', 'unknown'], Array(2)]) {
    expect(() => f.links.acceptBatch(invalid)).toThrow(); expect(count()).toEqual({ n: 0 });
  }
  let accesses = 0;
  const getter = ['source-1']; Object.defineProperty(getter, '0', { enumerable: true, get() { accesses += 1; return 'source-1'; } });
  expect(() => f.links.acceptBatch(getter)).toThrow(); expect(accesses).toBe(0);
  expect(f.links.acceptBatch(ids)).toHaveLength(2);
});

it('rolls back hidden priors on late failure/corruption without changing accepted links or seeds', () => {
  const f = fixture(), ids = ['source-1', 'source-2', 'source-3'];
  f.links.acceptBatch(ids);
  f.db.exec("CREATE TRIGGER fail_prior BEFORE INSERT ON world_person_priors WHEN NEW.source_id='source-2' BEGIN SELECT RAISE(ABORT,'fixture prior failure'); END");
  expect(() => f.genesis.materializeBatch(ids)).toThrow('fixture prior failure');
  expect(f.db.prepare('SELECT count(*) AS n FROM world_person_priors').get()).toEqual({ n: 0 });
  expect(f.db.prepare('SELECT count(*) AS n FROM world_player_person_links').get()).toEqual({ n: 3 });
  f.db.exec('DROP TRIGGER fail_prior');
  const people = f.genesis.materializeBatch(ids.slice(0, 2));
  const original = f.db.prepare("SELECT priors_json FROM world_person_priors WHERE source_id='source-2'").get() as { priors_json: string };
  f.db.exec("UPDATE world_person_priors SET priors_json='{}' WHERE source_id='source-2'");
  expect(() => f.genesis.materializeBatch(['source-3', 'source-2'])).toThrow('corrupt');
  expect(f.genesis.read('source-3')).toBeNull();
  f.db.prepare("UPDATE world_person_priors SET priors_json=? WHERE source_id='source-2'").run(original.priors_json);
  expect(f.genesis.materializeBatch(ids.slice(0, 2))).toEqual(people);
  expect(f.genesis.readDevelopmentSeed('career-a')).toBe(12345);
  for (const invalid of [[], ['source-1', 'source-1'], ['unknown'], Array(2)]) expect(() => f.genesis.materializeBatch(invalid)).toThrow();
});

it('reloads actual roster/link evidence on every later batch instead of retaining a validation cache', () => {
  const f = fixture(), ids = ['source-1', 'source-2'];
  const links = f.links.acceptBatch(ids), people = f.genesis.materializeBatch(ids);
  const roster = f.db.prepare("SELECT roster_json FROM world_roster_heads WHERE career_id='career-a'").get() as { roster_json: string };
  f.db.exec("UPDATE world_roster_heads SET roster_json='{}' WHERE career_id='career-a'");
  expect(() => f.links.acceptBatch(ids)).toThrow(); expect(() => f.genesis.materializeBatch(ids)).toThrow();
  f.db.prepare("UPDATE world_roster_heads SET roster_json=? WHERE career_id='career-a'").run(roster.roster_json);
  expect(f.links.acceptBatch(ids)).toEqual(links); expect(f.genesis.materializeBatch(ids)).toEqual(people);
  f.db.exec("UPDATE world_player_person_links SET person_id='corrupt' WHERE source_id='source-2'");
  expect(() => f.links.acceptBatch(ids)).toThrow('corrupt'); expect(() => f.genesis.materializeBatch(ids)).toThrow('corrupt');
});

it('rejects evidence changed by a later write inside the same batch and restores the transaction', () => {
  const f = fixture(), ids = ['source-1', 'source-2'];
  f.db.exec("CREATE TRIGGER alter_roster AFTER INSERT ON world_player_person_links WHEN NEW.source_id='source-2' BEGIN UPDATE world_roster_heads SET roster_json='{}' WHERE career_id='career-a'; END");
  expect(() => f.links.acceptBatch(ids)).toThrow();
  expect(f.db.prepare('SELECT count(*) AS n FROM world_player_person_links').get()).toEqual({ n: 0 });
  expect(f.rosters.readHead('career-a', 'club-a')!.roster.players).toHaveLength(3);
  f.db.exec('DROP TRIGGER alter_roster');
  f.db.exec("CREATE TRIGGER alter_link AFTER INSERT ON world_player_person_links WHEN NEW.source_id='source-2' BEGIN UPDATE world_player_person_links SET source_json='{}' WHERE source_id='source-1'; END");
  expect(() => f.links.acceptBatch(ids)).toThrow();
  expect(f.db.prepare('SELECT count(*) AS n FROM world_player_person_links').get()).toEqual({ n: 0 });
  f.db.exec('DROP TRIGGER alter_link');
  f.links.acceptBatch(ids);
  const count = () => f.db.prepare('SELECT count(*) AS n FROM world_person_priors').get();
  for (const change of [
    "UPDATE world_person_priors SET priors_json='{}' WHERE source_id='source-1'",
    "UPDATE world_player_person_links SET source_json='{}' WHERE source_id='source-1'",
    "UPDATE world_person_genesis_careers SET career_seed=12346 WHERE career_id='career-a'",
    "UPDATE world_roster_heads SET roster_json='{}' WHERE career_id='career-a'",
  ]) {
    f.db.exec(`CREATE TRIGGER alter_evidence AFTER INSERT ON world_person_priors WHEN NEW.source_id='source-2' BEGIN ${change}; END`);
    expect(() => f.genesis.materializeBatch(ids)).toThrow(); expect(count()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER alter_evidence');
  }
  expect(f.genesis.materializeBatch(ids)).toHaveLength(2);
  expect(f.genesis.readDevelopmentSeed('career-a')).toBe(12345);
});

it('compares newly inserted and previously accepted links to their detached facts before commit', () => {
  const f = fixture(), ids = ['source-1', 'source-2'];
  f.db.exec("CREATE TRIGGER alter_new_source AFTER INSERT ON world_player_person_links BEGIN UPDATE world_player_person_links SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id=NEW.source_id; END");
  expect(() => f.links.acceptBatch(ids)).toThrow();
  expect(f.db.prepare('SELECT count(*) AS n FROM world_player_person_links').get()).toEqual({ n: 0 });
  f.db.exec('DROP TRIGGER alter_new_source');
  const original = f.links.accept('source-2');
  f.db.exec("CREATE TRIGGER alter_prior_source AFTER INSERT ON world_player_person_links WHEN NEW.source_id='source-1' BEGIN UPDATE world_player_person_links SET source_json=json_set(source_json,'$.sourceVersion','changed') WHERE source_id='source-2'; END");
  expect(() => f.links.acceptBatch(ids)).toThrow();
  expect(f.links.readLink('source-1')).toBeNull(); expect(f.links.readLink('source-2')).toEqual(original);
});
