import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const queryOnly = (db: InstanceType<typeof DatabaseSync>) => db.prepare('PRAGMA query_only').get()!.query_only;
const fixture = () => {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE evidence(value TEXT); INSERT INTO evidence VALUES('original');");
  return db;
};

it.each([0, 1])('owns a real read transaction and restores query_only=%s after success', before => {
  const db = fixture();
  db.exec(`PRAGMA query_only=${before}`);
  try {
    const value = withSqliteReadTransaction(db, () => {
      expect(db.isTransaction).toBe(true);
      expect(queryOnly(db)).toBe(1);
      return db.prepare('SELECT value FROM evidence').get()!.value;
    });
    expect(value).toBe('original');
    expect(db.isTransaction).toBe(false);
    expect(queryOnly(db)).toBe(before);
  } finally { db.close(); }
});

it.each([0, 1])('rolls back a thrown read and restores query_only=%s without replacing its error', before => {
  const db = fixture(), failure = new Error('pending readiness');
  db.exec(`PRAGMA query_only=${before}`);
  try {
    let thrown: unknown;
    try {
      withSqliteReadTransaction(db, () => {
        expect(db.isTransaction).toBe(true);
        expect(queryOnly(db)).toBe(1);
        expect(db.prepare('SELECT value FROM evidence').get()!.value).toBe('original');
        throw failure;
      });
    } catch (error) { thrown = error; }
    expect(thrown).toBe(failure);
    expect(db.isTransaction).toBe(false);
    expect(queryOnly(db)).toBe(before);
  } finally { db.close(); }
});

it.each([
  "INSERT INTO evidence VALUES('unexpected')",
  'CREATE TABLE unexpected(value TEXT)',
  'CREATE TEMP TABLE unexpected(value TEXT)',
])('rejects an attempted write during a read group: %s', sql => {
  const db = fixture();
  try {
    expect(() => withSqliteReadTransaction(db, () => db.exec(sql))).toThrow(/readonly/i);
    expect(db.prepare('SELECT value FROM evidence').all()).toEqual([{ value: 'original' }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name='unexpected'").all()).toEqual([]);
    expect(db.prepare("SELECT name FROM sqlite_temp_master WHERE name='unexpected'").all()).toEqual([]);
    expect(db.isTransaction).toBe(false);
    expect(queryOnly(db)).toBe(0);
    db.exec("INSERT INTO evidence VALUES('later writer')");
    expect(db.prepare('SELECT count(*) AS n FROM evidence').get()!.n).toBe(2);
  } finally { db.close(); }
});

it.each([0, 1])('rejects a caller-owned transaction without ending it or changing query_only=%s', before => {
  const db = fixture();
  db.exec("BEGIN; INSERT INTO evidence VALUES('caller write');");
  db.exec(`PRAGMA query_only=${before}`);
  let called = false;
  try {
    expect(() => withSqliteReadTransaction(db, () => { called = true; })).toThrow(/transaction/i);
    expect(called).toBe(false);
    expect(db.isTransaction).toBe(true);
    expect(queryOnly(db)).toBe(before);
    expect(db.prepare('SELECT count(*) AS n FROM evidence').get()!.n).toBe(2);
    db.exec('ROLLBACK');
    expect(db.prepare('SELECT count(*) AS n FROM evidence').get()!.n).toBe(1);
  } finally { db.close(); }
});

it.each(['COMMIT', 'ROLLBACK'])('rejects a read that ends its owned transaction with %s', sql => {
  const db = fixture();
  try {
    expect(() => withSqliteReadTransaction(db, () => { db.exec(sql); return 'untrusted'; })).toThrow(/transaction/i);
    expect(db.isTransaction).toBe(false);
    expect(queryOnly(db)).toBe(0);
  } finally { db.close(); }
});

it('rejects rollback/rebegin replacement even when a transaction remains active', () => {
  const db = fixture();
  try {
    expect(() => withSqliteReadTransaction(db, () => {
      db.exec('ROLLBACK; BEGIN');
      return db.prepare('SELECT value FROM evidence').get();
    })).toThrow(/savepoint|transaction/i);
    expect(db.isTransaction).toBe(false);
    expect(queryOnly(db)).toBe(0);
  } finally { db.close(); }
});

it('rejects loss of the query-only guard before returning a read result', () => {
  const db = fixture();
  try {
    expect(() => withSqliteReadTransaction(db, () => {
      db.exec('PRAGMA query_only=OFF');
      return 'untrusted';
    })).toThrow(/query.only/i);
    expect(db.isTransaction).toBe(false);
    expect(queryOnly(db)).toBe(0);
  } finally { db.close(); }
});

it('authenticates separate groups afresh and permits writes only between groups', () => {
  const db = fixture();
  const read = () => withSqliteReadTransaction(db, () => db.prepare('SELECT value FROM evidence').get()!.value);
  try {
    expect(read()).toBe('original');
    db.exec("UPDATE evidence SET value='changed between groups'");
    expect(read()).toBe('changed between groups');
    expect(db.isTransaction).toBe(false);
    expect(queryOnly(db)).toBe(0);
  } finally { db.close(); }
});
