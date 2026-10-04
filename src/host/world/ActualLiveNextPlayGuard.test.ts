import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'actual-next-play-')), 'state.sqlite'), db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE applications(application_id TEXT,match_id TEXT,result_json TEXT);
    CREATE TABLE actual_live_play_runtimes(game_id TEXT,play_id INTEGER);
    CREATE TABLE actual_first_base_play_ends(game_id TEXT,play_id INTEGER);`);
  db.prepare('INSERT INTO applications VALUES(?,?,?)').run('apply', 'game', JSON.stringify({ receipt: { applicationId: 'apply', previousPlayId: 1 } }));
  return { path, db };
};
it.each(['actual_live_play_runtimes', 'actual_first_base_play_ends'])('refuses next physical admission when %s exists but downstream owner is absent', table => {
  const x = fixture(); try {
    x.db.prepare(`INSERT INTO ${table} VALUES(?,?)`).run('game', 1);
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/actual live closure.*missing/);
  } finally { x.db.close(); }
});
it('preserves legacy behavior when there is no original live scope for this activation', () => {
  const x = fixture(); try {
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?)').run('other', 1);
    x.db.prepare('INSERT INTO actual_first_base_play_ends VALUES(?,?)').run('game', 2);
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).not.toThrow();
    expect(() => assertPriorPhysicalClosureCompleted(x.db, null)).not.toThrow();
  } finally { x.db.close(); }
});
it('does not certify a missing staged row even if a caller created an empty downstream table', () => {
  const x = fixture(); try {
    x.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT,application_id TEXT);');
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?)').run('game', 1);
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/actual live closure.*missing/);
  } finally { x.db.close(); }
});
it('rejects malformed activation identity rather than using it to bypass the registered live scope', () => {
  const x = fixture(); try {
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?)').run('game', 1);
    x.db.prepare('UPDATE applications SET result_json=?').run(JSON.stringify({ receipt: { applicationId: 'other', previousPlayId: 1 } }));
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/activation/);
  } finally { x.db.close(); }
});
it('refuses a forged later-play activation while an earlier owned live play lacks completion', () => {
  const x = fixture(); try {
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?)').run('game', 1);
    x.db.prepare('UPDATE applications SET result_json=?').run(JSON.stringify({ receipt: { applicationId: 'apply', previousPlayId: 2 } }));
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/actual live closure.*missing/);
  } finally { x.db.close(); }
});
it('keeps a retained physical seal blocking when runtime/end/staged owner rows have disappeared', () => {
  const x = fixture(); try {
    x.db.exec('DROP TABLE actual_live_play_runtimes; DROP TABLE actual_first_base_play_ends; CREATE TABLE actual_live_play_fences(game_id TEXT,play_id INTEGER,closure_source_id TEXT);');
    x.db.prepare('INSERT INTO actual_live_play_fences VALUES(?,?,?)').run('game', 1, 'physical-end');
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/actual live closure.*missing/);
  } finally { x.db.close(); }
});
it('does not exclude a hidden original runtime scope because its relational game identity was corrupted', () => {
  const x = fixture(); try {
    x.db.exec('ALTER TABLE actual_live_play_runtimes ADD COLUMN snapshot_json TEXT;');
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?)').run('other', 1, '{"gameId":"game","playId":1}');
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/scope/);
  } finally { x.db.close(); }
});
it('rejects duplicate raw scope keys instead of reading only their last value', () => {
  const x = fixture(); try {
    x.db.exec('ALTER TABLE actual_live_play_runtimes ADD COLUMN snapshot_json TEXT;');
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?)').run('other', 1, '{"gameId":"game","gameId":"other","playId":1}');
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/scope/);
  } finally { x.db.close(); }
});
it('discovers original physical-pitch Source linkage even when both cached and snapshot game headers are corrupted', () => {
  const x = fixture(); try {
    x.db.exec('CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER); ALTER TABLE actual_live_play_runtimes ADD COLUMN physical_pitch_source_id TEXT; ALTER TABLE actual_live_play_runtimes ADD COLUMN source_json TEXT; ALTER TABLE actual_live_play_runtimes ADD COLUMN snapshot_json TEXT;');
    x.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?)').run('original-pitch', 'game', 1);
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?)').run('other', 1, 'wrong-cache',
      '{"physicalPitchSourceId":"original-pitch"}', '{"gameId":"other","playId":1}');
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/scope/);
  } finally { x.db.close(); }
});
it('discovers the original runtime pitch reference inside snapshot.source when all cached headers are changed', () => {
  const x = fixture(); try {
    x.db.exec('CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER); ALTER TABLE actual_live_play_runtimes ADD COLUMN physical_pitch_source_id TEXT; ALTER TABLE actual_live_play_runtimes ADD COLUMN source_json TEXT; ALTER TABLE actual_live_play_runtimes ADD COLUMN snapshot_json TEXT;');
    x.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?)').run('original-pitch', 'game', 1);
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?)').run('other', 1, 'wrong-cache',
      '{"physicalPitchSourceId":"wrong"}', '{"gameId":"other","playId":1,"source":{"physicalPitchSourceId":"original-pitch"}}');
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/scope/);
  } finally { x.db.close(); }
});
it('does not hide a staged activation when only proposal.source retains its accepted application identity', () => {
  const x = fixture(); try {
    x.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT,application_id TEXT,source_json TEXT,proposal_json TEXT);');
    x.db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?,?)').run('close', 'other', '{"applicationId":"other"}',
      '{"source":{"applicationId":"apply"},"application":{"applicationId":"other"}}');
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/ownership/);
  } finally { x.db.close(); }
});
it('retains original physical pitch identity from Source JSON when the relational source id is corrupted', () => {
  const x = fixture(); try {
    x.db.exec('CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER,source_json TEXT); ALTER TABLE actual_live_play_runtimes ADD COLUMN physical_pitch_source_id TEXT; ALTER TABLE actual_live_play_runtimes ADD COLUMN source_json TEXT; ALTER TABLE actual_live_play_runtimes ADD COLUMN snapshot_json TEXT;');
    x.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?)').run('corrupt-pitch-id', 'game', 1, '{"sourceId":"original-pitch","gameId":"game"}');
    x.db.prepare('INSERT INTO actual_live_play_runtimes VALUES(?,?,?,?,?)').run('other', 1, 'wrong-cache',
      '{"physicalPitchSourceId":"original-pitch"}', '{"gameId":"other","playId":1}');
    expect(() => assertPriorPhysicalClosureCompleted(x.db, 'apply')).toThrow(/scope/);
  } finally { x.db.close(); }
});
