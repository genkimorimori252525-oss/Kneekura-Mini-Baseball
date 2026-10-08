import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as policy from './SqliteReceivedUmpireDefenderPolicyDataStore';
import { policyFixture } from './ReceivedUmpireDefenderPolicyDataFixtures.test-support';

const { DatabaseSync, constants } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
const entry = () => {
  const value = Reflect.get(policy, 'receivedUmpireDefenderPolicyDataEvidenceFromSqlite');
  expect(value, 'RECEIVED_LIVE_IMPLEMENTATION_MISSING').toBeTypeOf('function');
  return value as (db: Db) => { read(sourceId: string): policy.DurableReceivedUmpireDefenderPolicyData | null };
};
const census = (db: Db) => ({ schema: db.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all(),
  temp: db.prepare('SELECT * FROM temp.sqlite_master ORDER BY name').all(),
  changes: db.prepare('SELECT total_changes() AS n').get(), queryOnly: db.prepare('PRAGMA query_only').get(), transaction: db.isTransaction });

it('authenticates committed policy through the same Native transaction and preserves OFF and ON query-only', async () => {
  const read = entry(), f = await policyFixture();
  try {
    const expected = f.store.accept(f.source.sourceId); f.store.close();
    for (const queryOnly of [0, 1]) {
      f.db.exec('BEGIN'); f.db.exec('PRAGMA query_only='+queryOnly);
      const before = census(f.db);
      expect(read(f.db).read(f.source.sourceId)).toEqual(expected);
      expect(read(f.db).read('absent-policy')).toBeNull();
      expect(census(f.db)).toEqual(before);
      f.db.exec('ROLLBACK');
    }
  } finally { f.close(); }
});

it('rejects missing caller transaction and a connection facade before authority reads', () => {
  const read = entry(), db = new DatabaseSync(':memory:'); let called = false;
  try {
    expect(() => read({ prepare() { called = true; } } as unknown as Db)).toThrow(/native.*connection/i);
    expect(called).toBe(false);
    const before = census(db);
    expect(() => read(db).read('policy-a')).toThrow(/caller.*transaction/i);
    expect(census(db)).toEqual(before);
  } finally { db.close(); }
});

it('rejects absent owner schema without installing any table in the caller transaction', () => {
  const read = entry(), db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN'); const before = census(db);
    expect(() => read(db).read('policy-a')).toThrow(/schema/i);
    expect(census(db)).toEqual(before); db.exec('ROLLBACK');
  } finally { db.close(); }
});

it('preserves caller authorizer and transaction after original dependency corruption', async () => {
  const read = entry(), f = await policyFixture();
  try {
    f.store.accept(f.source.sourceId);
    f.db.exec('BEGIN');
    f.db.prepare('UPDATE world_player_fielding_models SET source_hash=? WHERE source_id=?').run('corrupt', f.source.fieldingModelSourceId);
    f.db.setAuthorizer(code => code === constants.SQLITE_DELETE ? constants.SQLITE_DENY : constants.SQLITE_OK);
    f.db.exec('PRAGMA query_only=1'); const before = census(f.db);
    expect(() => read(f.db).read(f.source.sourceId)).toThrow();
    expect(census(f.db)).toEqual(before);
    expect(() => f.db.prepare('DELETE FROM world_player_fielding_models')).toThrow(/authorized/i);
    f.db.exec('ROLLBACK');
  } finally { f.close(); }
});

it('rejects attached and temporary shadow authorities without changing connection state', async () => {
  const read = entry(), f = await policyFixture();
  try {
    f.store.accept(f.source.sourceId);
    f.db.exec("ATTACH ':memory:' AS peer"); f.db.exec('BEGIN'); let before = census(f.db);
    expect(() => read(f.db).read(f.source.sourceId)).toThrow(/main-only/i);
    expect(census(f.db)).toEqual(before); f.db.exec('ROLLBACK'); f.db.exec('DETACH peer');
    f.db.exec('CREATE TEMP VIEW world_player_person_links AS SELECT 1 AS value');
    f.db.exec('BEGIN'); f.db.exec('PRAGMA query_only=1'); before = census(f.db);
    expect(() => read(f.db).read(f.source.sourceId)).toThrow(/main-only/i);
    expect(census(f.db)).toEqual(before); f.db.exec('ROLLBACK');
  } finally { f.close(); }
});

it('rejects changed owner schema and read-time writes while restoring the entry query-only setting', async () => {
  const read = entry(), f = await policyFixture();
  try {
    f.store.accept(f.source.sourceId); f.db.exec('BEGIN');
    f.db.exec('ALTER TABLE world_received_umpire_defender_policy_data ADD COLUMN extra TEXT');
    let before = census(f.db);
    expect(() => read(f.db).read(f.source.sourceId)).toThrow(/schema/i);
    expect(census(f.db)).toEqual(before); f.db.exec('ROLLBACK');
    f.db.exec('BEGIN'); before = census(f.db);
    const prepare = f.db.prepare.bind(f.db); let attempted = false;
    f.db.prepare = ((sql: string) => {
      if (!attempted && sql.includes('SELECT * FROM main.world_received_umpire_defender_policy_data')) {
        attempted = true; prepare('UPDATE world_received_umpire_defender_policy_data SET source_hash=?').run('read-side-effect');
      }
      return prepare(sql);
    }) as Db['prepare'];
    expect(() => read(f.db).read(f.source.sourceId)).toThrow(/readonly/i);
    f.db.prepare = prepare; expect(attempted).toBe(true); expect(census(f.db)).toEqual(before); f.db.exec('ROLLBACK');
  } finally { f.close(); }
});

it('preserves thrown undefined as a failed evidence read instead of reporting a missing policy',async()=>{
  const read=entry(),f=await policyFixture();
  try{
    f.store.accept(f.source.sourceId);f.db.exec('BEGIN');const prepare=f.db.prepare.bind(f.db);let thrown=false;
    f.db.prepare=((sql:string)=>{if(sql.includes('SELECT * FROM main.world_received_umpire_defender_policy_data'))throw undefined;return prepare(sql);}) as Db['prepare'];
    try{read(f.db).read(f.source.sourceId);}catch{thrown=true;}
    f.db.prepare=prepare;expect(thrown,'THROWN_UNDEFINED_IGNORED').toBe(true);expect(f.db.isTransaction).toBe(true);f.db.exec('ROLLBACK');
  }finally{f.close();}
});
