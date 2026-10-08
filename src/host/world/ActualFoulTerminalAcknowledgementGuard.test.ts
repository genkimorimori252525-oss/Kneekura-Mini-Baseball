import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { afterEach,beforeEach,expect,it } from 'vitest';
import { assertPriorPhysicalClosureCompleted } from './PhysicalPlayClosureEvidenceFromSqlite';
import { readActualLivePhysicalActivation } from './ActualLivePhysicalActivation';

// Synthetic raw-only wrapper integration. No successful acknowledgement,
// original physical Source or durable official application is fabricated.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let db:Database;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE actual_foul_terminal_applications(
    source_id TEXT,game_id TEXT,play_id INTEGER,application_id TEXT,physical_pitch_source_id TEXT,
    physical_end_source_id TEXT,official_obligation_key TEXT,status TEXT,source_json TEXT,source_hash TEXT,
    proposal_json TEXT,proposal_hash TEXT,result_json TEXT);
    CREATE TABLE applications(application_id TEXT,match_id TEXT,closure_id TEXT,request_hash TEXT,result_json TEXT);
    CREATE TABLE matches(match_id TEXT,durable_revision INTEGER,state_json TEXT,activation_json TEXT);`);
});
afterEach(() => db.close());
const encode = (value:unknown,encoding:string) => encoding === 'plain' ? JSON.stringify({ acknowledgement:value })
  : '[{"acknowledgement":{},"acknowledg\\u0065ment":[[' + JSON.stringify(value) + ']],"acknowledgement":{}}]';
const insert = (value:unknown,encoding:string) => db.prepare('INSERT INTO actual_foul_terminal_applications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .run('foreign-source','foreign-game',91,'foreign-application','foreign-pitch','foreign-end','foreign-child',
    'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY','{}','bad','{}','bad',encode(value,encoding));
const routes = ['physical_admission','historical_actor'] as const;
const read = (route:typeof routes[number]) => route === 'physical_admission'
  ? assertPriorPhysicalClosureCompleted(db,'apply') : readActualLivePhysicalActivation(db,'game','apply');
const cases = routes.flatMap(route => ['plain','escaped_duplicate_arrays'].flatMap(encoding =>
  ['application_id','original_scope'].map(claim => [route,encoding,claim] as const)));
it.each(cases)('A-G01 %s rejects sole %s acknowledgement %s before any live-owner fallback',(route,encoding,claim) => {
  if (claim === 'application_id') insert({ applicationReference:{ applicationId:'apply' } },encoding);
  else {
    db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply','game','closure','bad',
      JSON.stringify({ receipt:{ applicationId:'apply',previousPlayId:7 } }));
    insert({ applicationReference:{ owner:'applications',applicationId:'damaged',matchId:'game',previousPlayId:7 } },encoding);
  }
  const before = db.prepare('SELECT total_changes() AS n').get()!.n;
  expect(() => read(route)).toThrow(/terminal|pending/);
  expect(db.prepare('SELECT total_changes() AS n').get()!.n).toBe(before);
});
it.each(routes)('A-G02 %s preserves an earlier PA when a later raw acknowledgement survives',route => {
  db.prepare('INSERT INTO applications VALUES(?,?,?,?,?)').run('apply','game','earlier','bad',
    JSON.stringify({ receipt:{ applicationId:'apply',previousPlayId:6 } }));
  insert({ applicationReference:{ owner:'applications',applicationId:'damaged',matchId:'game',previousPlayId:7 } },'escaped_duplicate_arrays');
  expect(() => read(route)).not.toThrow();
});
