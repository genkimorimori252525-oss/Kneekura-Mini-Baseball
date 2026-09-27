import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerIntakeStore } from './SqlitePlayerIntakeStore';
import { openSqlitePlayerPersonLinkStore,
  type AcceptedPlayerIntakeSource } from
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
      || !basename(target).startsWith('kneekura-player-intake-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

const source = (sourceId = 'intake-1', playerId = 'player-new',
  personId = 'person-new', rosterRevision = 1):
AcceptedPlayerIntakeSource => ({ sourceId, careerId: 'career-a',
  playerId, personId, sourceRecordId: `accepted-${sourceId}`,
  sourceVersion: 'intake-v1', acceptedRevision: rosterRevision,
  acceptedAtDay: 11, rosterRevision });

const setup = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-player-intake-'));
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
  return { path, roster };
};

it('atomically materializes a new global Player and Person from accepted intake', () => {
  const { path, roster } = setup();
  const accepted = source();
  const intake = openSqlitePlayerIntakeStore(path, {
    readAcceptedPlayerIntake: (sourceId) =>
      sourceId === accepted.sourceId ? accepted : null,
  });
  const links = openSqlitePlayerPersonLinkStore(path);
  stores.push(intake, links);
  expect(intake.accept('intake-1')).toMatchObject({
    source: accepted, rosterBeforeRevision: 0,
    rosterAfterRevision: 1,
  });
  expect(roster.readHead('career-a', 'club-a')?.roster)
    .toMatchObject({ revision: 1, effectiveDay: 11,
      players: [{ playerId: 'player-new',
        clubRights: { rightsHolderClubId: null, contractId: null },
        assignment: null, availability: { status: 'UNAVAILABLE' } }] });
  expect(links.readAcceptedPlayerPersonLink('intake-1'))
    .toEqual({ careerId: 'career-a', playerId: 'player-new',
      personId: 'person-new' });
  expect(intake.accept('intake-1')).toEqual(intake.read('intake-1'));
  intake.close(); stores.splice(stores.indexOf(intake), 1);
  const reopened = openSqlitePlayerIntakeStore(path);
  stores.push(reopened);
  expect(reopened.read('intake-1')?.source).toEqual(accepted);
  expect(reopened.accept('intake-1')).toEqual(reopened.read('intake-1'));
  expect(() => reopened.accept('unknown')).toThrow('authority');
});

it('rejects absent, stale, duplicate and hidden intake without partial roster changes', () => {
  const { path, roster } = setup();
  const accepted = new Map<string, AcceptedPlayerIntakeSource>([
    ['one', source('one')],
    ['stale', source('stale', 'player-stale', 'person-stale', 2)],
    ['hidden', { ...source('hidden', 'player-hidden', 'person-hidden'),
      trueAbility: 999 } as AcceptedPlayerIntakeSource],
  ]);
  const intake = openSqlitePlayerIntakeStore(path, {
    readAcceptedPlayerIntake: (sourceId) => accepted.get(sourceId) ?? null,
  });
  stores.push(intake);
  expect(() => intake.accept('unknown')).toThrow('absent');
  expect(() => intake.accept('stale')).toThrow('extend global roster');
  expect(() => intake.accept('hidden')).toThrow('invalid');
  expect(roster.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
  intake.accept('one');
  accepted.set('same-person', source('same-person',
    'player-other', 'person-new', 2));
  expect(() => intake.accept('same-person')).toThrow();
  accepted.set('same-record', { ...source('same-record',
    'player-another', 'person-another', 2),
    sourceRecordId: 'accepted-one' });
  expect(() => intake.accept('same-record')).toThrow();
  expect(roster.readHead('career-a', 'club-a')?.roster.revision).toBe(1);
  expect(intake.read('same-person')).toBeNull();
  accepted.set('one', { ...source('one'), personId: 'forged' });
  expect(intake.accept('one').source.personId).toBe('person-new');
});

it('rolls back Player link and roster when intake journal insertion fails', () => {
  const { path, roster } = setup();
  const accepted = source();
  const intake = openSqlitePlayerIntakeStore(path, {
    readAcceptedPlayerIntake: (sourceId) =>
      sourceId === accepted.sourceId ? accepted : null,
  });
  const links = openSqlitePlayerPersonLinkStore(path);
  stores.push(intake, links);
  const Database = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new Database(path);
  try {
    db.exec(`CREATE TRIGGER fail_intake BEFORE INSERT ON world_player_intakes
      BEGIN SELECT RAISE(ABORT, 'injected intake failure'); END;`);
    expect(() => intake.accept('intake-1'))
      .toThrow('injected intake failure');
    expect(roster.readHead('career-a', 'club-a')?.roster.revision).toBe(0);
    expect(links.readLink('intake-1')).toBeNull();
    db.exec('DROP TRIGGER fail_intake');
    expect(intake.accept('intake-1').rosterAfterRevision).toBe(1);
  } finally { db.close(); }
});
