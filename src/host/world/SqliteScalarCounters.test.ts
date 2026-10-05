import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { installScalarSqliteCounters } from './SqliteScalarCounters.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'sqlite-scalar-counters-')), 'state.sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=wal; CREATE TABLE counters_values(value TEXT);');
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
  return { db, path };
};
it('records exact repeated prepare/get/all counts as hash/count scalars and never stores row or parameter contents', () => {
  const { db } = fixture(), counters = installScalarSqliteCounters(db), sql = 'SELECT $value AS value';
  try {
    const first = db.prepare(sql); expect(first.get({ value: 'private-row-one' })!.value).toBe('private-row-one');
    expect(first.get({ value: 'private-row-two' })!.value).toBe('private-row-two');
    expect(first.all({ value: 'private-row-three' })).toHaveLength(1);
    expect(db.prepare(sql).get({ value: 'private-row-four' })!.value).toBe('private-row-four');
    expect(counters.report()).toEqual([{ sqlHash: createHash('sha256').update(sql).digest('hex'), sqlLength: sql.length, prepare: 2, get: 3, all: 1 }]);
    expect(JSON.stringify(counters.report())).not.toContain('private-row');
  } finally { try { counters.close(); } finally { db.close(); } }
});
it('preserves native options and complete descriptors through nested real INSERT witnessing and closed disk reopen', () => {
  const { db, path } = fixture(), statementPrototype = Object.getPrototypeOf(db.prepare('SELECT 1'));
  const original = [Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare'), Object.getOwnPropertyDescriptor(statementPrototype, 'get'), Object.getOwnPropertyDescriptor(statementPrototype, 'all')];
  const counters = installScalarSqliteCounters(db), counted = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare');
  const sql = 'INSERT INTO counters_values VALUES($value)';
  const witness = witnessSqliteWrite(sql, connection => connection.prepare('SELECT count(*) AS n FROM counters_values').get()!.n === 1);
  try {
    try {
      expect(db.prepare('SELECT 1 AS value', { readBigInts: true, returnArrays: true }).get()).toEqual([1n]);
      db.prepare(sql, { allowUnknownNamedParameters: true }).run({ value: 'kept', ignored: 1 }); expect(witness.wasReached()).toBe(true);
    } finally { witness.close(); }
    expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(counted);
    counters.close(); counters.close();
    expect([Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare'), Object.getOwnPropertyDescriptor(statementPrototype, 'get'), Object.getOwnPropertyDescriptor(statementPrototype, 'all')]).toEqual(original);
  } finally { try { witness.close(); } finally { try { counters.close(); } finally { db.close(); } } }
  const reopened = new DatabaseSync(path, { readOnly: true });
  try { expect(reopened.prepare('SELECT value FROM counters_values').get()!.value).toBe('kept'); } finally { reopened.close(); }
});
it('keeps native SQL errors and restores instrumentation through finally', () => {
  const { db } = fixture(), original = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare'), counters = installScalarSqliteCounters(db);
  try { expect(() => db.prepare('SELECT $value AS value').get({ wrong: 1 })).toThrow(/Unknown named parameter/); }
  finally { try { counters.close(); } finally { db.close(); } }
  expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(original);
});

it('does not overwrite later descriptor changes and still restores the other intercepted methods', () => {
  const { db } = fixture(), prototype = Object.getPrototypeOf(db.prepare('SELECT 1'));
  const original = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!;
  const get = Object.getOwnPropertyDescriptor(prototype, 'get'), all = Object.getOwnPropertyDescriptor(prototype, 'all');
  const counters = installScalarSqliteCounters(db), counted = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')!;
  const later = { ...counted, enumerable: !counted.enumerable };
  Object.defineProperty(DatabaseSync.prototype, 'prepare', later);
  try {
    expect(() => counters.close()).toThrow(/later interceptor preserved/);
    expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(later);
    expect(Object.getOwnPropertyDescriptor(prototype, 'get')).toEqual(get);
    expect(Object.getOwnPropertyDescriptor(prototype, 'all')).toEqual(all);
    counters.close();
  } finally { Object.defineProperty(DatabaseSync.prototype, 'prepare', original); db.close(); }
});
it('restores a preexisting write witness when counters are nested inside it', () => {
  const { db } = fixture(), sql = 'INSERT INTO counters_values VALUES(?)';
  const witness = witnessSqliteWrite(sql, connection => connection.prepare('SELECT count(*) AS n FROM counters_values').get()!.n === 1);
  const witnessed = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare'), counters = installScalarSqliteCounters(db);
  try {
    try { db.prepare(sql).run('kept'); expect(witness.wasReached()).toBe(true); } finally { counters.close(); }
    expect(Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'prepare')).toEqual(witnessed);
  } finally { try { counters.close(); } finally { try { witness.close(); } finally { db.close(); } } }
});
