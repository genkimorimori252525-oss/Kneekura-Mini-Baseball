import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { nationalBattedFieldFixtureSource } from './NationalBattedFieldFixtures.test-support';
import { assertNationalBattedFoulRetainedBindingFrontier } from './NationalBattedFoulRetainedBindingTail.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const gameId = 'retained-common-national';
const fixture = () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER,progress_revision INTEGER);
    CREATE TABLE physical_pitch_progress_heads(game_id TEXT,play_id INTEGER,revision INTEGER,last_source_id TEXT);
    CREATE TABLE batted_episode_field_bindings(source_id TEXT,binding_version TEXT,game_id TEXT,play_id INTEGER,physical_pitch_source_id TEXT,response_source_id TEXT,field_calibration_source_id TEXT);
    CREATE TABLE batted_world_field_actions(physical_pitch_source_id TEXT);
    CREATE TABLE batted_world_field_heads(physical_pitch_source_id TEXT);
    CREATE TABLE batted_world_field_executions(physical_pitch_source_id TEXT);
    CREATE TABLE actual_live_play_runtimes(source_id TEXT,game_id TEXT,play_id INTEGER);
    CREATE TABLE actual_foul_terminal_applications(source_id TEXT,game_id TEXT,status TEXT,play_id INTEGER);
    CREATE TABLE official_participation_receipts(game_id TEXT,player_id TEXT);
    CREATE TABLE world_national_callups(event_id TEXT);`);
  db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,8,1)').run('national-live:pitch-0', gameId);
  db.prepare('INSERT INTO physical_pitch_progress_heads VALUES(?,8,1,?)').run(gameId, 'national-live:pitch-0');
  db.prepare('INSERT INTO batted_episode_field_bindings VALUES(?,?,?,?,?,?,?)').run('national-live:episode-binding', 'batted_episode_field_binding_v3', gameId, 8,
    'national-live:pitch-0', 'national-live:response', 'national-foul:geometry');
  db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,7)').run('national-foul:terminal', gameId, 'POST_PLAY_COMPLETED_CONTINUING');
  db.prepare('INSERT INTO official_participation_receipts VALUES(?,?)').run(gameId, 'p9');
  db.exec("INSERT INTO batted_world_field_actions VALUES('national-foul:pitch-2'); INSERT INTO actual_live_play_runtimes VALUES('national-foul:end-runtime','retained-common-national',7)");
  return db;
};
const rows = (db: InstanceType<typeof DatabaseSync>) => db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
  .map(row => [row.name, db.prepare(`SELECT * FROM ${row.name}`).all()]);

it('checks the exact pre-runtime binding frontier without treating structural rows as owner proof', () => {
  const db = fixture(); try { const before = rows(db), changes = db.prepare('SELECT total_changes() AS n').get();
    expect(assertNationalBattedFoulRetainedBindingFrontier(db)).toBe(gameId);
    expect(rows(db)).toEqual(before); expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
  } finally { db.close(); }
});
it.each([
  ['missing pitch', 'DELETE FROM physical_pitch_progress_actions'],
  ['wrong binding version', "UPDATE batted_episode_field_bindings SET binding_version='batted_episode_field_binding_v2'"],
  ['wrong original calibration', "UPDATE batted_episode_field_bindings SET field_calibration_source_id='national-live:geometry'"],
  ['already registered runtime', "INSERT INTO actual_live_play_runtimes VALUES('live-play-runtime','retained-common-national',8)"],
  ['already applied field', "INSERT INTO batted_world_field_actions VALUES('national-live:pitch-0')"],
  ['already applied statistics', 'CREATE TABLE official_player_outcome_applications(source_id TEXT); INSERT INTO official_player_outcome_applications VALUES(\'national-foul:terminal\')'],
  ['already participated next batter', "INSERT INTO official_participation_receipts VALUES('retained-common-national','p10')"],
])('rejects an unsupported structural binding cut: %s', (_label, mutation) => {
  const db = fixture(); try { db.exec(mutation); const before = rows(db);
    expect(() => assertNationalBattedFoulRetainedBindingFrontier(db)).toThrow(); expect(rows(db)).toEqual(before);
  } finally { db.close(); }
});
it.each([false, true])('preserves the original unaccepted field Source recipe (episode binding: %s)', retained => {
  const zero = { x: 0, y: 0, z: 0 }, acceleration = { x: 1, y: 2, z: 3 };
  const binding = { version: 'batted_episode_field_binding_v3' as const, sourceId: 'national-live:episode-binding' };
  const commands = [{ playerId: 'p10', bodyAcceleration: zero, primitiveMotions: [{ role: 'left_foot' as const, offsetVelocity: zero, offsetAcceleration: acceleration }] }];
  const before = structuredClone(commands);
  expect(nationalBattedFieldFixtureSource({ label: 'national-live', responseSourceId: 'national-live:response', geometrySourceId: 'national-foul:geometry',
    initialBallTick: 123456, commands, ...(retained ? { episodeFieldBinding: binding } : {}) })).toEqual({
    sourceId: 'national-live:field', sourceVersion: 'fixture-v1', responseSourceId: 'national-live:response', geometrySourceId: 'national-foul:geometry',
    previousFieldSourceId: null, availableAtTick: 123456, throughTick: 2123456,
    commands: [{ playerId: 'p10', bodyAcceleration: zero, primitiveMotions: [{ role: 'left_foot', offsetAcceleration: acceleration }] }],
    ...(retained ? { episodeFieldBinding: binding } : {}),
  });
  expect(commands).toEqual(before);
});
