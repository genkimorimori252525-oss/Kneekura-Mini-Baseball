import { createRequire } from 'node:module';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const load = async () => {
  expect(existsSync(new URL('./ActualReceivedUmpireDefenderTransaction.ts', import.meta.url)), 'RECEIVED_LIVE_IMPLEMENTATION_MISSING').toBe(true);
  return import('./ActualReceivedUmpireDefenderTransaction');
};
const fixture = () => {
  const directory = mkdtempSync(join(tmpdir(), 'received-transaction-')), path = join(directory, 'state.sqlite'), db = new DatabaseSync(path);
  db.exec('CREATE TABLE original(value TEXT); INSERT INTO original VALUES(\'keep\');');
  return { db, path, close() { db.close(); rmSync(directory, { recursive: true }); } };
};
const schema = (db: InstanceType<typeof DatabaseSync>) => db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();

it('opens and reads pristine storage without installing schema and rolls bootstrap back with failed work', async () => {
  const m = await load(), f = fixture(), before = schema(f.db), tx = m.openReceivedTransaction(f.path);
  try {
    expect(tx.read(() => tx.db.prepare('SELECT * FROM original').all())).toEqual([{ value: 'keep' }]);
    expect(schema(f.db)).toEqual(before);
    expect(() => tx.write({ bootstrap: true, changes: 0 }, () => { throw new Error('first-enrollment-failed'); }, () => {})).toThrow('first-enrollment-failed');
    expect(schema(f.db)).toEqual(before); expect(tx.db.isTransaction).toBe(false);
  } finally { tx.close(); f.close(); }
});

it('installs exactly the declared bootstrap schema before row accounting and rejects a partial namespace', async () => {
  const m = await load(), f = fixture(), tx = m.openReceivedTransaction(f.path);
  try {
    tx.write({ bootstrap: true, changes: 0 }, () => 'installed', () => {});
    expect(schema(f.db).filter(r => String(r.name).startsWith('actual_received_umpire_defender_') && r.type === 'table')).toHaveLength(5);
    f.db.exec('DROP TABLE actual_received_umpire_defender_replans'); const before = schema(f.db);
    expect(() => tx.write({ bootstrap: true, changes: 0 }, () => null, () => {})).toThrow(/schema/);
    expect(schema(f.db)).toEqual(before);
  } finally { tx.close(); f.close(); }
});

it('rejects unrelated row or schema writes and preserves original data on rollback', async () => {
  const m = await load(), f = fixture(), tx = m.openReceivedTransaction(f.path);
  try {
    for (const sql of ["UPDATE original SET value='changed'", 'CREATE TABLE extra(value TEXT)']) {
      expect(() => tx.write({ bootstrap: true, changes: 0 }, () => { tx.db.exec(sql); return null; }, () => {})).toThrow(/account|schema/);
      expect(f.db.prepare('SELECT * FROM original').all()).toEqual([{ value: 'keep' }]);
      expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'actual_received%' OR name='extra'").all()).toEqual([]);
    }
  } finally { tx.close(); f.close(); }
});

it('protects read proofs with exact query-only restoration and rejects reentrant operations', async () => {
  const m = await load(), f = fixture(), tx = m.openReceivedTransaction(f.path);
  try {
    for (const on of [0, 1]) {
      tx.db.exec('BEGIN'); tx.db.exec('PRAGMA query_only='+on);
      expect(() => m.withReceivedReadProof(tx.db, () => tx.db.exec("UPDATE original SET value='changed'"))).toThrow(/readonly/i);
      expect(tx.db.prepare('PRAGMA query_only').get()!.query_only).toBe(on); expect(tx.db.isTransaction).toBe(true); tx.db.exec('ROLLBACK');
    }
    tx.db.exec('PRAGMA query_only=0');
    expect(() => tx.read(() => tx.read(() => null))).toThrow(/re-entry/);
    expect(tx.db.isTransaction).toBe(false);
  } finally { tx.close(); f.close(); }
});

it('detects COMMIT replaced by rollback and retires the uncertain writer', async () => {
  const m = await load(), f = fixture(), tx = m.openReceivedTransaction(f.path), exec = tx.db.exec.bind(tx.db);
  try {
    tx.db.exec = ((sql: string) => exec(sql === 'COMMIT' ? 'ROLLBACK' : sql)) as typeof tx.db.exec;
    expect(() => tx.write({ bootstrap: true, changes: 0 }, () => true, () => {
      if (!tx.db.prepare("SELECT 1 FROM sqlite_master WHERE name='actual_received_umpire_defender_enrollments'").get()) throw new Error('durable-schema-missing');
    })).toThrow(/durable|commit/i);
    expect(() => tx.read(() => null)).toThrow(/closed|retired/i);
    expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'actual_received%'").all()).toEqual([]);
  } finally { tx.close(); f.close(); }
});

it('does not claim rollback after a genuine commit followed by failed durable verification', async () => {
  const m = await load(), f = fixture(), tx = m.openReceivedTransaction(f.path);
  try {
    expect(() => tx.write({ bootstrap: true, changes: 0 }, () => true, () => { throw new Error('durable-check-failed'); })).toThrow(/uncertain.*commit/i);
    expect(f.db.prepare("SELECT name FROM sqlite_master WHERE name='actual_received_umpire_defender_enrollments'").all()).toHaveLength(1);
    expect(() => tx.read(() => null)).toThrow(/closed|retired/i);
  } finally { tx.close(); f.close(); }
});

it('rejects a proof connection facade before any facade method executes',async()=>{
  const m=await load();let touched=false;
  const facade={isTransaction:true,prepare(){touched=true;return {get(){return {query_only:0,n:0,schema_version:0};},all(){return [];}};},exec(){}};
  expect(()=>m.withReceivedReadProof(facade as never,()=>true),'NATIVE_PROOF_FACADE_ACCEPTED').toThrow(/native.*connection/i);
  expect(touched).toBe(false);
});
