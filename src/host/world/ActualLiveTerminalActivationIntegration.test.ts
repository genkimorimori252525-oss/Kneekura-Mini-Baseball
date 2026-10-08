import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { assertPriorActualLiveClosureCompleted } from './ActualLivePlayClosureEvidenceFromSqlite';
import { readActualLivePhysicalActivation } from './ActualLivePhysicalActivation';
import { activeBattedWorldFieldReadFrame } from './SqliteBattedWorldFieldStore';

// Raw-only integration of the real Native read routes. These malformed surviving
// claims grant no physical, official, acknowledgement or activation authority.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const routes = ['public_assertion', 'autocommit_activation', 'bare_transaction_activation'] as const;
type Route = typeof routes[number];
const pendingError = 'terminal official application has pending post-play effects';
let db: Database;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE applications(application_id TEXT,match_id TEXT,closure_id TEXT,request_hash TEXT,result_json TEXT);
    CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);
    CREATE TABLE actual_foul_terminal_applications(
      source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,physical_pitch_source_id TEXT,
      physical_end_source_id TEXT,official_obligation_key TEXT,status TEXT,source_json TEXT,source_hash TEXT,
      proposal_json TEXT,proposal_hash TEXT,result_json TEXT);`);
});
afterEach(() => { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); });
const pending = (applicationId = 'apply', previousPlayId = 7) => ({
  version: 'official_pending_post_play_v1', applicationId, matchId: 'game', previousPlayId,
  closureId: 'foreign', durableRevision: 1, origin: { owner: 'foreign', sourceId: 'foreign' },
});
const snapshot = () => JSON.stringify({
  schema: db.prepare('SELECT type,name,sql FROM main.sqlite_master ORDER BY type,name').all(),
  applications: db.prepare('SELECT * FROM applications ORDER BY rowid').all(),
  matches: db.prepare('SELECT * FROM matches ORDER BY rowid').all(),
  terminal: db.prepare('SELECT * FROM actual_foul_terminal_applications ORDER BY rowid').all(),
  changes: db.prepare('SELECT total_changes() AS n').get(),
});
const read = (route: Route) => route === 'public_assertion'
  ? assertPriorActualLiveClosureCompleted(db, 'apply', true)
  : readActualLivePhysicalActivation(db, 'game', 'apply');
const check = (route: Route, rejected: boolean) => {
  if (route === 'bare_transaction_activation') db.exec('BEGIN');
  const before = snapshot(), transaction = db.isTransaction;
  const queryOnly = db.prepare('PRAGMA query_only').get();
  expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
  try {
    if (rejected) expect(() => read(route)).toThrow(pendingError);
    else expect(read(route)).toBe(route === 'public_assertion' ? undefined : null);
  } finally {
    expect(snapshot()).toBe(before);
    expect(db.isTransaction).toBe(transaction);
    expect(db.prepare('PRAGMA query_only').get()).toEqual(queryOnly);
    expect(activeBattedWorldFieldReadFrame(db)).toBeNull();
  }
};
for (const route of routes) {
  it(`I01 ${route} rejects a sole pending application marker`, () => {
    db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('foreign', 'foreign', 'foreign', 'invalid',
      JSON.stringify({ pendingPostPlay: pending() }));
    check(route, true);
  });
  it(`I02 ${route} rejects escaped duplicate-array acknowledgement ownership`, () => {
    const encoded = '[{"acknowledgement":{},"acknowledg\\u0065ment":[[{"applicationReference":{"applicationId":"apply"}}]],"acknowledgement":{}}]';
    db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      'foreign', 'foreign', 91, 'foreign', 'foreign', 'foreign', 'foreign',
      'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY', '{}', 'invalid', '{}', 'invalid', encoded);
    check(route, true);
  });
  it(`I03 ${route} preserves a clean absent activation without installing owners`, () => check(route, false));
  it(`I04 ${route} preserves an earlier application when a later PA is pending`, () => {
    db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply', 'game', 'old', 'invalid',
      JSON.stringify({ receipt: { applicationId: 'apply', previousPlayId: 6 } }));
    db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game', 1, '{}',
      JSON.stringify({ pendingPostPlay: pending('later', 7) }));
    check(route, false);
  });
  it(`I05 ${route} rejects damaged application identity retaining original Match and PA`, () => {
    db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply', 'game', 'old', 'invalid',
      JSON.stringify({ receipt: { applicationId: 'apply', previousPlayId: 7 } }));
    db.prepare('INSERT INTO matches VALUES(?,?,?,?)').run('game', 1, '{}',
      JSON.stringify({ pendingPostPlay: pending('damaged', 7) }));
    check(route, true);
  });
}
it('I06 preserves the null prior-application assertion', () => {
  const before = snapshot();
  expect(assertPriorActualLiveClosureCompleted(db, null, true)).toBeUndefined();
  expect(snapshot()).toBe(before);
});
