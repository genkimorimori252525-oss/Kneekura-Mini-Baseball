import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { CATALYST_FAMILIES } from
  '../../core/world/development/DevelopmentCatalyst';
import { DEVELOPMENT_DOMAINS } from
  '../../core/world/development/DevelopmentTrajectory';
import { STAR_GENESIS_POTENTIALS } from
  '../../core/world/development/StarGenesis';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import { openSqlitePersonGenesisStore } from
  './SqlitePersonGenesisStore';
import { openSqlitePlayerIntakeStore } from
  './SqlitePlayerIntakeStore';
import type { AcceptedPlayerIntakeSource } from
  './SqlitePlayerPersonLinkStore';
import { openSqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0).reverse()) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-person-genesis-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const offsets = Object.fromEntries(DEVELOPMENT_DOMAINS.map((domain) =>
  [domain, { min: 0, max: 0 }])) as Record<
    typeof DEVELOPMENT_DOMAINS[number], { min: number; max: number }>;
const sensitivity = Object.fromEntries(CATALYST_FAMILIES.map((family) =>
  [family, { min: 0.2, max: 0.8 }])) as Record<
    typeof CATALYST_FAMILIES[number], { min: number; max: number }>;
const potentials = Object.fromEntries(STAR_GENESIS_POTENTIALS.map((axis) =>
  [axis, { min: 0.2, max: 0.8 }])) as Record<
    typeof STAR_GENESIS_POTENTIALS[number], { min: number; max: number }>;
const policies = {
  trajectory: { policyId: 'trajectory-v1', profileVersion: 'v1',
    availableAtDay: 10, timingWeights: { VERY_EARLY: 1,
      EARLY: 1, NORMAL: 1, LATE: 1, VERY_LATE: 1 },
    shapeWeights: { SHARP_PEAK: 1, BROAD_PLATEAU: 1,
      STEPWISE_WAVES: 1 }, domainOffsetRanges: offsets },
  catalyst: { policyId: 'catalyst-v1', profileVersion: 'v1',
    availableAtDay: 10, sensitivityRanges: sensitivity,
    signatureMotifs: [], signatureMotifCount: 0 },
  star: { policyId: 'star-v1', profileVersion: 'v1',
    availableAtDay: 10, tierWeights: { ORDINARY: 100,
      STAR_CANDIDATE: 1, SUPERSTAR_CANDIDATE: 0 },
    potentialRanges: { ORDINARY: potentials,
      STAR_CANDIDATE: potentials,
      SUPERSTAR_CANDIDATE: potentials } },
};
const genesisInput = { careerId: 'career-a',
  initializedAtDay: 10, careerSeed: 12345, policies };
const source = (n: number): AcceptedPlayerIntakeSource => ({
  sourceId: `intake-${n}`, careerId: 'career-a',
  playerId: `player-${n}`, personId: `person-${n}`,
  sourceRecordId: `accepted-intake-${n}`,
  sourceVersion: 'intake-v1', acceptedRevision: n,
  acceptedAtDay: 10 + n, rosterRevision: n,
});
const setup = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-person-genesis-'));
  directories.push(directory);
  const path = join(directory, 'world.sqlite');
  const world = openSqliteWorldSettlementStore(path);
  const roster = openSqliteManagerRosterDecisionStore(path);
  stores.push(world, roster);
  world.initialize({ careerId: 'career-a', clubs: [state()],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
      memberClubIds: ['club-a', 'club-b'],
      regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game-1', homeClubId: 'club-a',
        awayClubId: 'club-b' }], revisionEventIds: [] },
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 } });
  roster.initialize({ careerId: 'career-a', clubId: 'club-a', mood: null,
    roster: createRosterState({ careerId: 'career-a',
      effectiveDay: 10, profiles: [{ profileId: 'league',
        version: 'v1', season: 1,
        competitionEditionId: 'league-season-1',
        activeLimit: null, allowedAssignmentKinds: ['FIRST_TEAM'],
        rehabParticipationAllowed: false }],
      units: [{ unitId: 'first-a', clubId: 'club-a',
        kind: 'FIRST_TEAM' }], players: [],
    }) });
  const intake = openSqlitePlayerIntakeStore(path, {
    readAcceptedPlayerIntake: (sourceId) =>
      [source(1), source(2)].find((item) =>
        item.sourceId === sourceId) ?? null,
  });
  stores.push(intake);
  return { path, intake };
};

it('pins one Career seed and generates distinct hidden priors for accepted Persons', () => {
  const { path, intake } = setup();
  const genesis = openSqlitePersonGenesisStore(path);
  stores.push(genesis);
  expect(() => genesis.initializeCareer({ ...genesisInput,
    careerId: 'unknown-career' })).toThrow('initialized World Career');
  genesis.initializeCareer(genesisInput);
  genesis.initializeCareer(genesisInput);
  expect(() => genesis.initializeCareer({ ...genesisInput,
    careerSeed: 67890 })).toThrow('pinned differently');
  expect(() => genesis.materialize('intake-1'))
    .toThrow('accepted Player Person link is missing');
  intake.accept('intake-1');
  intake.accept('intake-2');
  const first = genesis.materialize('intake-1');
  const second = genesis.materialize('intake-2');
  expect(first).toMatchObject({ careerId: 'career-a',
    personId: 'person-1', playerId: 'player-1' });
  expect(first.priors.trajectory.generation.seed)
    .not.toBe(second.priors.trajectory.generation.seed);
  expect(first.priors).not.toHaveProperty('ability');
  expect(first.priors).not.toHaveProperty('starStatus');
  expect(genesis.materialize('intake-1')).toEqual(first);
  genesis.close(); stores.splice(stores.indexOf(genesis), 1);
  const reopened = openSqlitePersonGenesisStore(path);
  stores.push(reopened);
  expect(reopened.read('intake-1')).toEqual(first);
  expect(reopened.materialize('intake-2')).toEqual(second);
});

it('rejects future policies and detects altered hidden priors on read', () => {
  const { path, intake } = setup();
  const genesis = openSqlitePersonGenesisStore(path);
  stores.push(genesis);
  expect(() => genesis.initializeCareer({ ...genesisInput,
    initializedAtDay: 9 })).toThrow('policy');
  genesis.initializeCareer(genesisInput);
  intake.accept('intake-1');
  genesis.materialize('intake-1');
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(path);
  try {
    db.prepare(`UPDATE world_person_priors SET priors_json=?
      WHERE source_id=?`).run('{}', 'intake-1');
    expect(() => genesis.read('intake-1'))
      .toThrow('corrupt durable Person priors');
  } finally { db.close(); }
});
