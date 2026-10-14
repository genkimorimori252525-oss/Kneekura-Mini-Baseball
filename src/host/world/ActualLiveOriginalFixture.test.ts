import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { readActualLiveOriginalFixture } from './ActualLiveOriginalFixtureFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const binding: OfficialParticipantBinding = { gameId: 'game', careerId: 'career', competitionEditionId: 'season',
  gameDay: 10, clubId: 'home', side: 'HOME', playerId: 'player', personId: 'person', personLinkSourceId: 'link',
  rosterRevision: 0, fixtureEventId: 'fixture' };

it('preserves the complete original domestic scheduled game without adding National fields', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const game = { gameId: 'game', homeClubId: 'home', awayClubId: 'away', round: 2, scheduledDay: 10 };
    db.exec('CREATE TABLE world_season_heads(career_id TEXT,season_id TEXT,schedule_json TEXT)');
    db.prepare('INSERT INTO world_season_heads VALUES(?,?,?)').run('career', 'season', JSON.stringify({ seasonId: 'season', games: [game] }));
    expect(JSON.stringify(readActualLiveOriginalFixture(db, 'game', [binding]))).toBe(JSON.stringify({ careerId: 'career', seasonId: 'season', game }));
    expect(() => readActualLiveOriginalFixture(db, 'game', [{ ...binding, nationalRegistrationEventId: 'call', nationalRosterSnapshotId: 'roster' }]))
      .toThrow('original National Match evidence');
  } finally { db.close(); }
});

it('rejects a duplicate domestic fixture without selecting one schedule candidate', () => {
  const db = new DatabaseSync(':memory:');
  try {
    const game = { gameId: 'game', homeClubId: 'home', awayClubId: 'away' };
    db.exec('CREATE TABLE world_season_heads(career_id TEXT,season_id TEXT,schedule_json TEXT)');
    db.prepare('INSERT INTO world_season_heads VALUES(?,?,?)').run('career', 'season', JSON.stringify({ seasonId: 'season', games: [game, game] }));
    expect(() => readActualLiveOriginalFixture(db, 'game', [binding])).toThrow('original season fixture missing');
  } finally { db.close(); }
});
