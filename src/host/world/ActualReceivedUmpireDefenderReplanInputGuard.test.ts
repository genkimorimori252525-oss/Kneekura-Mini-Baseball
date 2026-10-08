import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import * as decisions from './SqliteActualDefensiveDecisionStore';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
// A namespace lookup keeps the missing public seam an assertion failure, rather
// than a module-resolution error or an expensive fixture construction.
const entry = () => {
  const value = Reflect.get(decisions, 'actualReceivedUmpireDefenderReplanInputEvidenceFromSqlite');
  expect(value, 'read-only Native received-call input entry').toBeTypeOf('function');
  return value as (db: Db) => { derive(source: unknown): unknown };
};
const source = () => ({ sourceId: 'received-replan', sourceVersion: 'test-v1', capability: 'received_umpire_defender_replan_v1',
  physicalPitchSourceId: 'pitch', playerId: 'defender', observationSourceId: 'received-observation',
  currentExecutionSourceId: 'current-execution', predecessorDecisionSourceId: 'issued-decision',
  predecessorMotorSourceId: 'initial-motor', predecessorAdoptionSourceId: 'adoption', policySourceId: null,
  previousReplanSourceId: null });
const snapshot = (db: Db) => ({ schema: db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all(),
  temp: db.prepare('SELECT * FROM temp.sqlite_master ORDER BY name').all(),
  changes: db.prepare('SELECT total_changes() AS n').get(), queryOnly: db.prepare('PRAGMA query_only').get() });
const emptyObservationOwner = (db: Db) => db.exec(`CREATE TABLE actual_field_observations(source_id TEXT,
  physical_pitch_source_id TEXT,player_id TEXT,base_field_source_id TEXT,execution_source_id TEXT,
  observation_model_source_id TEXT,previous_source_id TEXT,revision INTEGER,source_json TEXT,source_hash TEXT,
  snapshot_json TEXT,snapshot_hash TEXT);
  CREATE TABLE actual_field_observation_heads(physical_pitch_source_id TEXT,player_id TEXT,source_id TEXT,revision INTEGER);`);

it('exports the read-only received-call Native input entry without building a physical fixture', () => { entry(); });

it('rejects a callback-supplied connection before a dependency facade can run', () => {
  let invoked = false;
  expect(() => entry()({ prepare() { invoked = true; throw new Error('facade ran'); } } as unknown as Db)).toThrow(/native.*connection/i);
  expect(invoked).toBe(false);
});

it.each(['policySourceId', 'previousReplanSourceId'])('rejects unsupported non-null %s before any dependency read', key => {
  const db = new DatabaseSync(':memory:');
  try { const before = snapshot(db); expect(() => entry()(db).derive({ ...source(), [key]: 'unowned' })).toThrow(/unsupported.*reference/i);
    expect(snapshot(db)).toEqual(before); expect(db.isTransaction).toBe(false);
  } finally { db.close(); }
});

it.each(['currentCut', 'receiverRole', 'received', 'order', 'target', 'decisionInput', 'selected', 'dependencyHashes'])
('rejects caller-supplied %s instead of treating it as authenticated evidence', key => {
  const db = new DatabaseSync(':memory:');
  try { const before = snapshot(db); expect(() => entry()(db).derive({ ...source(), [key]: 'caller' })).toThrow(/invalid.*Source/i);
    expect(snapshot(db)).toEqual(before); expect(db.isTransaction).toBe(false);
  } finally { db.close(); }
});

it.each(['sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'observationSourceId', 'currentExecutionSourceId',
  'predecessorDecisionSourceId', 'predecessorMotorSourceId', 'predecessorAdoptionSourceId'])('rejects an empty %s reference', key => {
  const db = new DatabaseSync(':memory:');
  try { expect(() => entry()(db).derive({ ...source(), [key]: '' })).toThrow(/invalid.*Source/i); }
  finally { db.close(); }
});

it.each(['table', 'view', 'attached'])('rejects %s authority shadowing without changing the connection', kind => {
  const db = new DatabaseSync(':memory:');
  try {
    if (kind === 'attached') db.exec("ATTACH ':memory:' AS other");
    else db.exec(kind === 'table' ? 'CREATE TEMP TABLE actual_field_observations(value TEXT)'
      : 'CREATE TEMP VIEW actual_field_observations AS SELECT 1 AS value');
    const before = snapshot(db), databases = db.prepare('PRAGMA database_list').all();
    expect(() => entry()(db).derive(source())).toThrow(/main-only/i);
    expect(snapshot(db)).toEqual(before); expect(db.prepare('PRAGMA database_list').all()).toEqual(databases);
    expect(db.isTransaction).toBe(false);
  } finally { db.close(); }
});

it.each([0, 1])('preserves caller transaction, query-only=%s and authorizer on an unavailable observation', queryOnly => {
  const db = new DatabaseSync(':memory:');
  try {
    emptyObservationOwner(db); const reader = entry()(db);
    db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
    db.exec('BEGIN'); db.exec('PRAGMA query_only='+queryOnly);
    const before = snapshot(db);
    expect(() => reader.derive(source())).toThrow(/original observation.*missing/i);
    expect(snapshot(db)).toEqual(before); expect(db.isTransaction).toBe(true);
    expect(() => db.prepare('DELETE FROM actual_field_observations')).toThrow(/authorized/i);
    db.exec('ROLLBACK');
  } finally { db.close(); }
});

it('repeats and reopens a missing-owner read without creating rows, schema or a lingering transaction', () => {
  const directory = mkdtempSync(join(tmpdir(), 'received-input-guard-')), path = join(directory, 'state.sqlite');
  let db = new DatabaseSync(path);
  try {
    emptyObservationOwner(db); const before = snapshot(db);
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(() => entry()(db).derive(source())).toThrow(/original observation.*missing/i);
      expect(snapshot(db)).toEqual(before); expect(db.isTransaction).toBe(false);
    }
    db.close(); db = new DatabaseSync(path, { readOnly: true });
    expect(() => entry()(db).derive(source())).toThrow(/original observation.*missing/i);
    expect(snapshot(db)).toEqual(before); expect(db.isTransaction).toBe(false);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
