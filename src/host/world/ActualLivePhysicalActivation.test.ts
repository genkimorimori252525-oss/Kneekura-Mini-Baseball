import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import * as activation from './ActualLivePhysicalActivation';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('preserves the legacy path only when no actual live owner or retained seal claims the activation', () => {
  const db = new DatabaseSync(':memory:');
  try { expect(activation.readActualLivePhysicalActivation(db, 'game', 'apply')).toBeNull(); } finally { db.close(); }
});
it('cannot use missing scoring as authority when a retained actual end lacks its completed effects', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE applications(application_id TEXT,match_id TEXT,result_json TEXT); CREATE TABLE actual_live_play_fences(game_id TEXT,play_id INTEGER);');
    db.prepare('INSERT INTO applications VALUES(?,?,?)').run('apply', 'game', '{"receipt":{"applicationId":"apply","previousPlayId":1}}');
    db.prepare('INSERT INTO actual_live_play_fences VALUES(?,?)').run('game', 1);
    expect(() => activation.readActualLivePhysicalActivation(db, 'game', 'apply')).toThrow(/missing/);
  } finally { db.close(); }
});
it('rejects an activation Source claimed by a hidden conflicting staged application owner', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT,application_id TEXT,source_json TEXT,proposal_json TEXT);');
    db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?,?)').run('close', 'other', '{"applicationId":"apply"}', '{}');
    expect(() => activation.readActualLivePhysicalActivation(db, 'game', 'apply')).toThrow(/ownership/);
  } finally { db.close(); }
});
