import { afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { applyClubCommand } from '../../core/world/club/ClubLifecycle';
import { command, state } from
  '../../core/world/club/ClubFixtures.test-support';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { openSqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';
import { appendAcceptedClubEvents, openSqliteClubEventJournal } from
  './SqliteClubEventJournal';

const directories: string[] = [];
afterEach(() => {
  const root = realpathSync(tmpdir());
  for (const directory of directories.splice(0)) {
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-club-journal-')) {
      throw new Error('test cleanup escaped temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
const path = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-club-journal-'));
  directories.push(directory);
  return join(directory, 'world.sqlite');
};
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);

it('joins an outer Club transaction and replays only committed events', () => {
  const databasePath = path();
  const initial = state();
  const world = openSqliteWorldSettlementStore(databasePath);
  world.initialize({ careerId: 'career-a', clubs: [initial],
    schedule: { seasonId: 'league-season-1', leagueId: 'league-a',
      memberClubIds: ['club-a', 'club-b'], regularSeasonGamesPerClub: 1,
      games: [{ gameId: 'game-1', homeClubId: 'club-a',
        awayClubId: 'club-b' }], revisionEventIds: [] },
    standingsPolicy: { version: 'standings-v1',
      tieCreditNumerator: 1, tieCreditDenominator: 2,
      runDifferentialCapPerGame: 10 } });
  const DatabaseSync = (createRequire(import.meta.url)('node:sqlite') as
    typeof import('node:sqlite')).DatabaseSync;
  const db = new DatabaseSync(databasePath);
  const changed = applyClubCommand(initial, command([{
    kind: 'RECORD_REVENUE', category: 'other',
    receiptId: 'receipt-1', amount: 1, currency: 'SIM',
  }], initial, 'event-1'));
  if (!changed.ok) throw new Error(JSON.stringify(changed.reason));
  const journal = openSqliteClubEventJournal(databasePath);
  try {
    expect(journal.readHistory('career-a', 'club-a'))
      .toEqual({ checkpoint: initial, acceptedEvents: [] });
    db.exec('BEGIN IMMEDIATE');
    appendAcceptedClubEvents(db, initial, [changed.event],
      changed.state);
    db.exec('ROLLBACK');
    expect(journal.readHistory('career-a', 'club-a')
      ?.acceptedEvents).toEqual([]);
    db.exec('BEGIN IMMEDIATE');
    appendAcceptedClubEvents(db, initial, [changed.event],
      changed.state);
    db.prepare(`UPDATE world_club_heads SET revision=?, state_json=?
      WHERE career_id=? AND club_id=? AND revision=?`).run(
        changed.state.revision, canonicalJson(changed.state),
        'career-a', 'club-a', initial.revision);
    db.exec('COMMIT');
    expect(journal.readHistory('career-a', 'club-a'))
      .toEqual({ checkpoint: initial, acceptedEvents: [changed.event] });
    db.prepare(`DELETE FROM world_club_event_journal
      WHERE career_id=? AND club_id=? AND after_revision=?`)
      .run('career-a', 'club-a', changed.state.revision);
    expect(() => journal.readHistory('career-a', 'club-a'))
      .toThrow('diverges from World head');
  } finally {
    journal.close(); db.close(); world.close();
  }
});
