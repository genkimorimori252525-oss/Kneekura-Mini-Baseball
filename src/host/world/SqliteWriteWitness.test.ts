import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const targetSql = 'INSERT INTO witness_values VALUES(?)';
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'sqlite-write-witness-')), 'state.sqlite');
  const db = new DatabaseSync(path); db.exec('PRAGMA journal_mode=wal; CREATE TABLE witness_values(value TEXT);');
  expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  return { path, db };
};
it('does not strongly record unrelated native statements in global mock result history while witnessing the real target', () => {
  const { db } = fixture(), descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare');
  const witness = witnessSqliteWrite(targetSql, connection => connection.prepare('SELECT count(*) AS n FROM witness_values').get()!.n === 1);
  const unrelated = new Set<ReturnType<typeof db.prepare>>();
  try {
    for (let i = 0; i < 256; i++) {
      const statement = db.prepare('SELECT ? AS value'); unrelated.add(statement);
      expect(statement.get(i)!.value).toBe(i);
    }
    db.exec('BEGIN'); db.prepare(targetSql).run('actual write');
    expect(witness.wasReached()).toBe(true); db.exec('ROLLBACK');
    const hooked = DatabaseSync.prototype.prepare as typeof db.prepare & { mock?: { results: readonly { value?: unknown }[] } };
    const retained = hooked.mock?.results.filter(result => unrelated.has(result.value as ReturnType<typeof db.prepare>)).length ?? 0;
    expect(retained).toBe(0);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); witness.close(); db.close(); }
  expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(descriptor);
});
it('observes the completed INSERT trigger before rollback and restores exact native descriptors', () => {
  const { db, path } = fixture(), descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare');
  const originalStatement = db.prepare(targetSql), originalRun = originalStatement.run;
  const runDescriptor = Object.getOwnPropertyDescriptor(originalStatement, 'run');
  db.exec("CREATE TRIGGER observed_write AFTER INSERT ON witness_values BEGIN UPDATE witness_values SET value='trigger ran'; END;");
  const witness = witnessSqliteWrite(targetSql, connection => connection.prepare('SELECT value FROM witness_values').get()?.value === 'trigger ran');
  let target: ReturnType<typeof db.prepare> | null = null;
  try {
    db.exec('BEGIN'); target = db.prepare(targetSql); target.run('before trigger');
    expect(witness.wasReached()).toBe(true); db.exec('ROLLBACK');
    expect(db.prepare('SELECT * FROM witness_values').all()).toEqual([]);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); witness.close(); }
  expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(descriptor);
  expect(Object.getOwnPropertyDescriptor(target!, 'run')).toEqual(runDescriptor);
  expect(target!.run).toBe(originalRun); witness.close(); db.close();
  const reopened = new DatabaseSync(path, { readOnly: true });
  try { expect(reopened.prepare('SELECT * FROM witness_values').all()).toEqual([]); } finally { reopened.close(); }
});
it('does not claim a failed SQL statement and restores descriptors when the caller exits through finally', () => {
  const { db } = fixture(), descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare');
  db.exec("CREATE TRIGGER failed_write BEFORE INSERT ON witness_values BEGIN SELECT RAISE(ABORT,'intentional SQL failure'); END;");
  const witness = witnessSqliteWrite(targetSql, () => true);
  try {
    expect(() => db.prepare(targetSql).run('rejected')).toThrow(/intentional SQL failure/);
    expect(witness.wasReached()).toBe(false);
  } finally { witness.close(); db.close(); }
  expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(descriptor);
});
it('restores the interceptor after an observed callback throws, without inventing a successful witness', () => {
  const { db } = fixture(), descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare');
  const witness = witnessSqliteWrite(targetSql, () => { throw new Error('observation failed'); });
  try {
    db.exec('BEGIN'); expect(() => db.prepare(targetSql).run('actual row')).toThrow(/observation failed/);
    expect(db.prepare('SELECT count(*) AS n FROM witness_values').get()!.n).toBe(1);
    expect(witness.wasReached()).toBe(false); db.exec('ROLLBACK');
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); witness.close(); db.close(); }
  expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(descriptor);
});
it('restores an existing plain prepare descriptor with all of its flags', () => {
  const { db } = fixture(), original = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!;
  const prior = function(this: typeof db, sql: string) { return Reflect.apply(original.value as typeof db.prepare, this, [sql]); };
  const descriptor = { ...original, value: prior, writable: false };
  Object.defineProperty(DatabaseSync.prototype, 'prepare', descriptor);
  let witness: ReturnType<typeof witnessSqliteWrite> | null = null;
  try {
    witness = witnessSqliteWrite(targetSql, () => true); db.prepare(targetSql).run('actual row');
    expect(witness.wasReached()).toBe(true); witness.close();
    expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(descriptor);
  } finally { try { witness?.close(); } finally { Object.defineProperty(DatabaseSync.prototype, 'prepare', original); db.close(); } }
});
it('does not silently overwrite a later prepare interceptor when closing', () => {
  const { db } = fixture(), original = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!;
  const witness = witnessSqliteWrite(targetSql, () => true), intercepted = DatabaseSync.prototype.prepare;
  const later = function(this: typeof db, sql: string) { return Reflect.apply(intercepted, this, [sql]); };
  const descriptor = { ...original, value: later };
  Object.defineProperty(DatabaseSync.prototype, 'prepare', descriptor);
  try {
    expect(() => witness.close()).toThrow(/interceptor.*changed/);
    expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(descriptor);
    db.prepare(targetSql).run('after close'); expect(witness.wasReached()).toBe(false);
    witness.close();
  } finally { Object.defineProperty(DatabaseSync.prototype, 'prepare', original); db.close(); }
});
it('preserves a later target run interceptor while restoring its own prepare descriptor', () => {
  const { db } = fixture(), original = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!;
  const witness = witnessSqliteWrite(targetSql, () => true), target = db.prepare(targetSql), intercepted = target.run;
  const later = (...args: unknown[]) => Reflect.apply(intercepted, target, args);
  Object.defineProperty(target, 'run', { configurable: true, writable: true, value: later });
  try {
    expect(() => witness.close()).toThrow(/interceptor.*changed/);
    expect(target.run).toBe(later);
    expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(original);
    target.run('after close'); expect(witness.wasReached()).toBe(false); witness.close();
  } finally { Object.defineProperty(DatabaseSync.prototype, 'prepare', original); Reflect.deleteProperty(target, 'run'); db.close(); }
});
it('forwards native prepare options for unrelated statements without changing result shape', () => {
  const { db } = fixture(), witness = witnessSqliteWrite(targetSql, () => true);
  try {
    const row = db.prepare('SELECT 1 AS value', { readBigInts: true, returnArrays: true }).get();
    expect(row).toEqual([1n]); expect(witness.wasReached()).toBe(false);
  } finally { witness.close(); db.close(); }
});
it('forwards native prepare options for the target INSERT before observing its completed run', () => {
  const { db } = fixture(), sql = 'INSERT INTO witness_values VALUES($value)';
  const witness = witnessSqliteWrite(sql, connection => connection.prepare('SELECT value FROM witness_values').get()?.value === 'kept');
  try {
    db.prepare(sql, { allowUnknownNamedParameters: true }).run({ value: 'kept', ignored: 1 });
    expect(witness.wasReached()).toBe(true);
  } finally { witness.close(); db.close(); }
});
