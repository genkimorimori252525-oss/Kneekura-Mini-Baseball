import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect, it } from 'vitest';
import { assertNoActualRoleWorkloadCharge } from './ActualRoleWorkloadChargeGuard';

// Rejection-only metadata fixtures. These deliberately corrupt rows are never a
// genuine terminal origin, accepted effort, Person chain, or workload effect.
const scope = { careerId: 'career', gameId: 'game', playId: 4, playerId: 'player' };
const other = { careerId: 'other-career', gameId: 'other-game', playId: 99, playerId: 'other-player' };
const withDb = (body: (db: Database) => void) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try { body(db); } finally { db.close(); }
};
const tables = (db: Database) => db.exec(`
  CREATE TABLE actual_role_workload_assessments(source_id,closure_source_id,career_id,game_id,play_id,player_id,source_json,source_hash,snapshot_json,snapshot_hash);
  CREATE TABLE actual_role_workload_settlements(closure_source_id,career_id,game_id,play_id,plan_json,plan_hash);
  CREATE TABLE actual_foul_terminal_applications(source_id,game_id,play_id,application_id,physical_pitch_source_id,physical_end_source_id,official_obligation_key,status,source_json,source_hash,proposal_json,proposal_hash,result_json);
  CREATE TABLE actual_foul_play_ends(source_id,game_id,play_id,physical_pitch_source_id,source_json,source_hash,snapshot_json,snapshot_hash);
  CREATE TABLE world_player_workload_activities(source_id,career_id,player_id,before_revision,after_revision,source_json,before_json,after_json);
`);
const originalTerminal = (db: Database) => db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .run('terminal', scope.gameId, scope.playId, 'official-app', 'pitch', 'foul-end', 'obligation', 'corrupt',
    JSON.stringify({ sourceId: 'terminal', physicalEndReference: { owner: 'actual_foul_play_ends', sourceId: 'foul-end' } }), 'invalid',
    JSON.stringify({ source: { sourceId: 'terminal' }, gameId: scope.gameId, playId: scope.playId,
      seasonFixture: { careerId: scope.careerId }, participants: [{ binding: scope }], physicalEndReference: { sourceId: 'foul-end' } }), 'invalid', '{invalid');

// Regression target: the old guard discovers only actual_live_play_closures.
for (const kind of ['terminal', 'foul_end', 'escaped_duplicate_terminal'] as const)
it(`M01 terminal workload assessment remains visible through ${kind} after copied scope moves`, () => withDb(db => {
  tables(db); originalTerminal(db);
  const terminalReference = kind === 'escaped_duplicate_terminal'
    ? '{"sourceId":"terminal","source\\u0049d":"other-terminal"}'
    : JSON.stringify({ sourceId: kind === 'terminal' ? 'terminal' : 'other-terminal' });
  const source = '{"sourceId":"assessment","capability":"actual_foul_terminal_total_workload_v1","terminalReference":'
    + terminalReference + ',"physicalEndReference":' + JSON.stringify({ owner: 'actual_foul_play_ends', sourceId: kind === 'foul_end' ? 'foul-end' : 'other-end' })
    + ',"participantReference":' + JSON.stringify({ playerId: scope.playerId }) + '}';
  db.prepare('INSERT INTO actual_role_workload_assessments VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('assessment', 'other-terminal', other.careerId, other.gameId, other.playId, other.playerId, source, 'invalid', JSON.stringify(other), 'invalid');
  const before = db.prepare('SELECT total_changes() AS n').get()!.n;
  expect(() => assertNoActualRoleWorkloadCharge(db, scope)).toThrow(/workload.*charge/);
  expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(before);
}));

// Regression target: only checking the canonical Source ID or first-base E;
// relabelled activities must still resolve actual foul end evidence.
for (const kind of ['end_index', 'end_raw', 'end_duplicate'] as const)
it(`M02 an archived TOTAL charge survives missing assessment/settlement and renamed activity via ${kind}`, () => withDb(db => {
  tables(db);
  const source = kind === 'end_duplicate'
    ? '{"sourceId":"foul-end","source\\u0049d":"renamed-end"}' : JSON.stringify({ sourceId: 'foul-end' });
  db.prepare('INSERT INTO actual_foul_play_ends VALUES(?,?,?,?,?,?,?,?)').run(kind === 'end_index' ? 'foul-end' : 'renamed-end',
    scope.gameId, scope.playId, 'pitch', source, 'invalid', JSON.stringify({ gameId: scope.gameId, playId: scope.playId }), 'invalid');
  db.prepare('INSERT INTO world_player_workload_activities VALUES(?,?,?,?,?,?,?,?)').run('renamed-activity', other.careerId, other.playerId, 0, 1,
    JSON.stringify({ sourceEventId: 'also-renamed', sourceVersion: 'actual-total-play-workload-v1', evidenceId: 'foul-end',
      careerId: scope.careerId, playerId: scope.playerId, kind: 'MATCH' }), '{invalid', '{invalid');
  expect(() => assertNoActualRoleWorkloadCharge(db, scope)).toThrow(/workload.*charge/);
}));

// Regression target: surviving settlement mirrors currently have no standalone
// legacy-exclusion path when assessment/global activity rows are lost.
for (const kind of ['scope', 'terminal_reference', 'participant_array'] as const)
it(`M03 the frozen terminal settlement preserves exclusion through ${kind} without its assessment row`, () => withDb(db => {
  tables(db); originalTerminal(db);
  const participant = { playerId: scope.playerId, activity: { careerId: scope.careerId, playerId: scope.playerId } };
  const plan = kind === 'scope'
    ? { ...scope, participants: [participant] }
    : kind === 'terminal_reference' ? { terminalReference: { sourceId: 'terminal' }, participants: [participant] }
      : { terminalReference: { sourceId: 'terminal' }, participants: [{ playerId: 'other' }, participant] };
  db.prepare('INSERT INTO actual_role_workload_settlements VALUES(?,?,?,?,?,?)')
    .run('other-terminal', other.careerId, other.gameId, other.playId, JSON.stringify(plan), 'invalid');
  expect(() => assertNoActualRoleWorkloadCharge(db, scope)).toThrow(/workload.*charge/);
}));

it('M03 removing an original participant only from a surviving settlement cannot erase exclusion', () => withDb(db => {
  tables(db); originalTerminal(db);
  db.prepare('INSERT INTO actual_role_workload_settlements VALUES(?,?,?,?,?,?)').run('terminal', scope.careerId, scope.gameId, scope.playId,
    JSON.stringify({ careerId: scope.careerId, gameId: scope.gameId, playId: scope.playId,
      terminalReference: { sourceId: 'terminal' }, participants: [{ playerId: 'other-player' }] }), 'invalid');
  expect(() => assertNoActualRoleWorkloadCharge(db, scope)).toThrow(/workload.*charge/);
}));

it('M03 a genuinely unrelated original terminal and settlement do not block this player', () => withDb(db => {
  tables(db); originalTerminal(db);
  db.prepare('UPDATE actual_foul_terminal_applications SET proposal_json=?').run(JSON.stringify({
    source: { sourceId: 'terminal' }, gameId: scope.gameId, playId: scope.playId, seasonFixture: { careerId: scope.careerId },
    participants: [{ binding: { ...scope, playerId: 'other-player' } }], physicalEndReference: { sourceId: 'foul-end' } }));
  db.prepare('INSERT INTO actual_role_workload_settlements VALUES(?,?,?,?,?,?)').run('terminal', scope.careerId, scope.gameId, scope.playId,
    JSON.stringify({ careerId: scope.careerId, gameId: scope.gameId, playId: scope.playId,
      terminalReference: { sourceId: 'terminal' }, participants: [{ playerId: 'other-player' }] }), 'invalid');
  expect(() => assertNoActualRoleWorkloadCharge(db, scope)).not.toThrow();
}));
