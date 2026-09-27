import { afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { state } from '../../core/world/club/ClubFixtures.test-support';
import { createRosterState } from '../../core/world/roster/RosterState';
import { openSqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import { openSqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import { openSqlitePlayerPersonLinkStore,
  type AcceptedPlayerIntakeSource } from './SqlitePlayerPersonLinkStore';

const directories: string[] = [];
const stores: { close(): void }[] = [];
afterEach(() => {
  for (const store of stores.splice(0).reverse()) store.close();
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-person-link-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const path = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-person-link-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const source = (sourceId = 'intake-link-1',
  playerId = 'player-a', personId = 'person-a'):
AcceptedPlayerIntakeSource => ({ sourceId,
  careerId: 'career-a', playerId, personId,
  sourceRecordId: `accepted-intake-${playerId}`,
  sourceVersion: 'intake-v1', acceptedRevision: 1,
  acceptedAtDay: 10, rosterRevision: 0 });
const setup = () => {
  const databasePath = path();
  const world = openSqliteWorldSettlementStore(databasePath);
  const roster = openSqliteManagerRosterDecisionStore(databasePath);
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
        kind: 'FIRST_TEAM' }],
      players: ['player-a', 'player-b'].map((playerId) => ({
        playerId, clubRights: { rightsHolderClubId: 'club-a',
          contractId: `contract-${playerId}` },
        assignment: { unitId: 'first-a', clubId: 'club-a' },
        registrations: [], availability: { status: 'AVAILABLE' as const,
          evidenceId: `health-${playerId}` },
      })),
    }) });
  return databasePath;
};

it('persists one accepted intake link and reads it through the FA authority contract', () => {
  const databasePath = setup();
  const accepted = source();
  const authority = { readAcceptedPlayerIntake: (sourceId: string) =>
    sourceId === accepted.sourceId ? accepted : null };
  const store = openSqlitePlayerPersonLinkStore(databasePath, authority);
  stores.push(store);
  expect(store.accept('intake-link-1')).toMatchObject({
    careerId: 'career-a', playerId: 'player-a', personId: 'person-a',
    sourceRecordId: 'accepted-intake-player-a', rosterRevision: 0 });
  expect(store.accept('intake-link-1')).toEqual(store.readLink('intake-link-1'));
  expect(store.readAcceptedPlayerPersonLink('intake-link-1'))
    .toEqual({ careerId: 'career-a', playerId: 'player-a',
      personId: 'person-a' });
  store.close(); stores.splice(stores.indexOf(store), 1);
  const reopened = openSqlitePlayerPersonLinkStore(databasePath);
  stores.push(reopened);
  expect(reopened.readAcceptedPlayerPersonLink('intake-link-1'))
    .toEqual({ careerId: 'career-a', playerId: 'player-a',
      personId: 'person-a' });
  expect(reopened.accept('intake-link-1'))
    .toEqual(reopened.readLink('intake-link-1'));
  expect(() => reopened.accept('unknown'))
    .toThrow('accepted player intake authority is required');
});

it('rejects unknown intake, stale roster and duplicate player/person while retaining accepted identity', () => {
  const databasePath = setup();
  const accepted = new Map<string, AcceptedPlayerIntakeSource>([
    ['one', source('one')],
    ['same-player', source('same-player', 'player-a', 'person-other')],
    ['same-person', source('same-person', 'player-b', 'person-a')],
    ['stale', { ...source('stale', 'player-b', 'person-b'),
      rosterRevision: 1 }],
    ['hidden', { ...source('hidden', 'player-b', 'person-b'),
      trueAbility: 999 } as AcceptedPlayerIntakeSource],
  ]);
  const store = openSqlitePlayerPersonLinkStore(databasePath, {
    readAcceptedPlayerIntake: (sourceId) =>
      accepted.get(sourceId) ?? null,
  });
  stores.push(store);
  expect(() => store.accept('unknown')).toThrow('accepted intake');
  expect(() => store.accept('stale')).toThrow('roster head');
  expect(() => store.accept('hidden')).toThrow('accepted intake');
  store.accept('one');
  expect(() => store.accept('same-player')).toThrow('unique');
  expect(() => store.accept('same-person')).toThrow('unique');
  accepted.set('one', { ...source('one'), personId: 'forged' });
  expect(store.readAcceptedPlayerPersonLink('one'))
    .toEqual({ careerId: 'career-a', playerId: 'player-a',
      personId: 'person-a' });
  expect(store.accept('one').personId).toBe('person-a');
});

it('rolls back an insertion failure and accepts the same source on retry', () => {
  const databasePath = setup();
  const accepted = source();
  const store = openSqlitePlayerPersonLinkStore(databasePath, {
    readAcceptedPlayerIntake: (sourceId) =>
      sourceId === accepted.sourceId ? accepted : null,
  });
  stores.push(store);
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new DatabaseSync(databasePath);
  try {
    db.exec(`CREATE TRIGGER fail_link BEFORE INSERT ON world_player_person_links
      BEGIN SELECT RAISE(ABORT, 'injected link failure'); END;`);
    expect(() => store.accept(accepted.sourceId))
      .toThrow('injected link failure');
    expect(store.readLink(accepted.sourceId)).toBeNull();
    db.exec('DROP TRIGGER fail_link');
    expect(store.accept(accepted.sourceId).personId).toBe('person-a');
    db.prepare(`UPDATE world_player_person_links SET person_id=?
      WHERE source_id=?`).run('forged-person', accepted.sourceId);
    expect(() => store.readAcceptedPlayerPersonLink(accepted.sourceId))
      .toThrow('stored accepted intake snapshot is corrupt');
  } finally { db.close(); }
});
