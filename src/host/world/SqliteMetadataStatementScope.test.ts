import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { sqliteMetadataGet as get, sqliteMetadataAll as all, sqliteMetadataClaimRows as claims, withSqliteMetadataStatementScope as scope } from './SqliteMetadataStatementScope';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const counted = (db: import('node:sqlite').DatabaseSync) => {
  const prepare = db.prepare, counts = new Map<string, number>();
  db.prepare = function(sql, ...options) {
    counts.set(sql, (counts.get(sql) ?? 0) + 1);
    return prepare.call(this, sql, ...options);
  };
  return { count: (sql: string) => counts.get(sql) ?? 0, close() { db.prepare = prepare; } };
};

it('reuses exact SQL only, executes every get/all, and binds the current document', () => {
  const db = new DatabaseSync(':memory:'), observed = counted(db);
  let executions = 0;
  db.function('observed_document', value => { executions++; return value; });
  const single = 'SELECT observed_document(?) AS value', many = 'SELECT observed_document($document) AS value';
  try {
    scope(db, () => {
      expect(get(db, single, 'first')!.value).toBe('first');
      expect(get(db, single, 'second')!.value).toBe('second');
      expect(all(db, many, 'third').map(row => row.value)).toEqual(['third']);
      expect(all(db, many, 'fourth').map(row => row.value)).toEqual(['fourth']);
    });
    expect([observed.count(single), observed.count(many), executions]).toEqual([1, 1, 4]);
    get(db, single, 'outside'); get(db, single, 'outside again');
    scope(db, () => get(db, single, 'independent'));
    expect([observed.count(single), executions]).toEqual([4, 7]);
  } finally { observed.close(); db.close(); }
});

it('isolates nested scopes and connections then restores the outer scope', () => {
  const db = new DatabaseSync(':memory:'), peer = new DatabaseSync(':memory:');
  const observed = counted(db), other = counted(peer), sql = 'SELECT ? AS value';
  try {
    scope(db, () => {
      expect(get(db, sql, 'outer')!.value).toBe('outer');
      scope(db, () => expect(get(db, sql, 'nested')!.value).toBe('nested'));
      expect(get(db, sql, 'outer again')!.value).toBe('outer again');
      get(peer, sql, 'peer'); get(peer, sql, 'peer again');
    });
    expect([observed.count(sql), other.count(sql)]).toEqual([2, 2]);
  } finally { observed.close(); other.close(); db.close(); peer.close(); }
});

it('rebinds ownership identities and reexecutes typed duplicate/escaped claims after mutations', () => {
  const db = new DatabaseSync(':memory:'), observed = counted(db);
  const sql = `SELECT source_id FROM metadata WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}
    OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')} ORDER BY source_id`;
  try {
    db.exec('CREATE TABLE metadata(source_id TEXT,source_json TEXT,snapshot_json TEXT)');
    const insert = db.prepare('INSERT INTO metadata VALUES(?,?,?)');
    insert.run('first', '{"sourceId":"first"}', '{"source":{"sourceId":"first"}}');
    insert.run('second', '{"sourceId":"second"}', '{"source":{"sourceId":"second"}}');
    scope(db, () => {
      expect(claims(db, sql, 'first').map(r => r.source_id)).toEqual(['first']);
      expect(claims(db, sql, 'second').map(r => r.source_id)).toEqual(['second']);
      insert.run('alias', '{"sourceId":"other","sourceId":"first"}', '{"so\\u0075rce":{"sourceId":"second"}}');
      expect(claims(db, sql, 'first').map(r => r.source_id)).toEqual(['alias', 'first']);
      expect(claims(db, sql, 'second').map(r => r.source_id)).toEqual(['alias', 'second']);
      db.exec("UPDATE metadata SET source_json='[\"first\"]',snapshot_json='null' WHERE source_id='alias'");
      expect(claims(db, sql, 'first').map(r => r.source_id)).toEqual(['first']);
      expect(observed.count(sql)).toBe(1);
    });
    scope(db, () => expect(claims(db, sql, 'second').map(r => r.source_id)).toEqual(['second']));
    expect(observed.count(sql)).toBe(2);
  } finally { observed.close(); db.close(); }
});

it('preserves SQL errors and disposes the scope on exceptional exit', () => {
  const db = new DatabaseSync(':memory:'), observed = counted(db), sql = "SELECT json_extract(?, '$.value') AS value";
  try {
    expect(() => scope(db, () => {
      expect(get(db, sql, '{"value":"before"}')!.value).toBe('before');
      expect(() => get(db, sql, '{')).toThrow(/malformed JSON/);
      expect(get(db, sql, '{"value":"after"}')!.value).toBe('after');
      throw new Error('derive aborted');
    })).toThrow('derive aborted');
    expect(observed.count(sql)).toBe(1);
    expect(get(db, sql, '{"value":"outside"}')!.value).toBe('outside');
    scope(db, () => expect(get(db, sql, '{"value":"new scope"}')!.value).toBe('new scope'));
    expect(observed.count(sql)).toBe(3);
  } finally { observed.close(); db.close(); }
});

it('never lends an executing statement to a reentrant metadata read', () => {
  const db = new DatabaseSync(':memory:'), observed = counted(db), sql = 'SELECT reenter(?) AS value';
  let nested = false, executions = 0;
  db.function('reenter', value => {
    executions++;
    if (nested) return value;
    nested = true;
    try { return `${value}:${get(db, sql, 'nested')!.value}`; }
    finally { nested = false; }
  });
  try {
    scope(db, () => {
      expect(get(db, sql, 'first')!.value).toBe('first:nested');
      expect(get(db, sql, 'second')!.value).toBe('second:nested');
    });
    expect(executions).toBe(4);
    expect(observed.count(sql)).toBe(3);
  } finally { observed.close(); db.close(); }
});

it('rechecks current rows after writes and recompiles the reused statement after schema changes', () => {
  const db = new DatabaseSync(':memory:'), observed = counted(db), sql = 'SELECT value FROM metadata WHERE id=?';
  try {
    db.exec("CREATE TABLE metadata(id TEXT, value TEXT); INSERT INTO metadata VALUES('id','initial')");
    scope(db, () => {
      expect(get(db, sql, 'id')!.value).toBe('initial');
      db.exec("UPDATE metadata SET value='changed'");
      expect(get(db, sql, 'id')!.value).toBe('changed');
      db.exec('DROP TABLE metadata');
      expect(() => get(db, sql, 'id')).toThrow(/no such table/);
      db.exec("CREATE TABLE metadata(extra INTEGER, id TEXT, value TEXT); INSERT INTO metadata VALUES(1,'id','new schema')");
      expect(get(db, sql, 'id')!.value).toBe('new schema');
    });
    expect(observed.count(sql)).toBe(1);
  } finally { observed.close(); db.close(); }
});

it('follows real WAL snapshot visibility across commit without retaining prior row results', () => {
  const directory = mkdtempSync(join(tmpdir(), 'metadata-statement-wal-')), path = join(directory, 'state.sqlite');
  const db = new DatabaseSync(path), peer = new DatabaseSync(path), observed = counted(db);
  const sql = 'SELECT value FROM metadata WHERE id=?';
  try {
    db.exec("PRAGMA journal_mode=WAL; CREATE TABLE metadata(id TEXT, value TEXT); INSERT INTO metadata VALUES('id','initial')");
    expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    expect(peer.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    scope(db, () => {
      db.exec('BEGIN');
      expect(get(db, sql, 'id')!.value).toBe('initial');
      peer.exec("UPDATE metadata SET value='peer changed'");
      expect(get(db, sql, 'id')!.value).toBe('initial');
      db.exec('COMMIT');
      expect(get(db, sql, 'id')!.value).toBe('peer changed');
    });
    expect(observed.count(sql)).toBe(1);
  } finally { observed.close(); db.close(); peer.close(); rmSync(directory, { recursive: true, force: true }); }
});
