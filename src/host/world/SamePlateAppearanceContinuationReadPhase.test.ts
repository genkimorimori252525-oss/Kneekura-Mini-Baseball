import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { memoSamePaContinuationRead as memo, samePaContinuationIdentityRow, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { samePaLifecycleIdentityRow, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaLifecycleSchema } from './SamePlateAppearanceLifecycleStorage';
import { samePaContinuationSchema } from './SamePlateAppearanceContinuationStorage';

/** Native proof-lifetime regression only. BI01 covers complete perception
 * row/head/reference replay; this fixture needs no accepted baseball Sources. */
it('reuses a completed historical proof across child readers only until the enclosing continuation phase ends', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE proof_input(value INTEGER); INSERT INTO proof_input VALUES(7); PRAGMA query_only=1; BEGIN');
  let reads = 0;
  const read = () => memo(db, 'perception-history', () => {
    reads++;
    return Object.freeze({ value: Number(db.prepare('SELECT value FROM proof_input').get()!.value) });
  });
  try {
    const first = withSamePaContinuationReadPhase(db, () => {
      const value = withSamePaLifecycleReadPhase(db, read);
      expect(withSamePaLifecycleReadPhase(db, read)).toBe(value);
      expect(read()).toBe(value);
      expect(reads).toBe(1);
      return value;
    });
    const next = withSamePaContinuationReadPhase(db, read);
    expect(next).toEqual(first); expect(next).not.toBe(first); expect(reads).toBe(2);
    expect(db.isTransaction).toBe(true);
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);

    // A caught nested failure still poisons this parent's completed proofs.
    expect(() => withSamePaContinuationReadPhase(db, () => {
      read();
      expect(() => memo(db, 'failure', () => { throw new Error('read failed'); })).toThrow('read failed');
      expect(read).toThrow(/expired/);
    })).toThrow(/expired/);
    expect(withSamePaContinuationReadPhase(db, read)).toEqual(first);

    expect(() => withSamePaContinuationReadPhase(db, () =>
      memo(db, 'cycle', () => memo(db, 'cycle', () => 0)))).toThrow(/cycle/);
    for (const mutation of [
      'PRAGMA query_only=0; UPDATE proof_input SET value=8; UPDATE proof_input SET value=7; PRAGMA query_only=1',
      'PRAGMA query_only=0; CREATE TEMP TABLE changed(value); DROP TABLE changed; PRAGMA query_only=1',
      'COMMIT; BEGIN',
    ]) {
      expect(() => withSamePaContinuationReadPhase(db, () => {
        read(); db.exec(mutation); return read();
      })).toThrow();
      expect(withSamePaContinuationReadPhase(db, read)).toEqual(first);
    }
    db.exec('COMMIT');
    expect(read).toThrow(/query-only ownership/);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

const identityOwners = [
  { name: 'lifecycle', schema: samePaLifecycleSchema, table: 'pa_lifecycle_v1_work_prefixes', read: samePaLifecycleIdentityRow },
  { name: 'continuation', schema: samePaContinuationSchema, table: 'pa_continuation_v1_work_prefixes', read: samePaContinuationIdentityRow },
] as const;
// These are raw identity metadata probes; no behavioral baseball proof is
// fabricated. Each reader must authenticate the exact native owner schema.
const identityRow = (db: DatabaseSync, table: string, id: string, claimed = id) => {
  const columns = db.prepare('PRAGMA main.table_info(' + table + ')').all();
  const values = columns.map(c => c.name === 'play_id' ? 1 : c.name === 'source_id' ? id
    : c.name === 'source_json' ? JSON.stringify({ sourceId: claimed })
      : c.name === 'snapshot_json' ? JSON.stringify({ source: { sourceId: claimed } }) : id + ':' + c.name);
  db.prepare('INSERT INTO main.' + table + ' VALUES(' + values.map(() => '?').join(',') + ')').run(...values);
};
const identityProof = <T>(db: DatabaseSync, read: () => T): T => {
  db.exec('PRAGMA query_only=1; BEGIN');
  try { return withSamePaContinuationReadPhase(db, read); }
  finally { if (db.isTransaction) db.exec('ROLLBACK'); db.exec('PRAGMA query_only=0'); }
};

it.each(identityOwners)('shares completed $name identities across child phases, isolates kind/id and expires after mutations', owner => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(':memory:'), prepare = db.prepare;
  let scans = 0;
  try {
    for (const sql of Object.values(owner.schema)) db.exec(sql);
    identityRow(db, owner.table, 'first'); identityRow(db, owner.table, 'second');
    db.prepare = function(sql, ...options) {
      const statement = prepare.call(this, sql, ...options);
      if (sql.startsWith('SELECT * FROM main.pa_') && sql.includes('WHERE source_id=$id')) {
        const all = statement.all.bind(statement);
        statement.all = (...args) => { scans++; return Reflect.apply(all, statement, args); };
      }
      return statement;
    };
    const read = () => owner.read(db, 'prefix', 'first');
    identityProof(db, () => {
      const first = withSamePaLifecycleReadPhase(db, read), initialScans = scans;
      expect(withSamePaLifecycleReadPhase(db, read)).toBe(first); expect(scans).toBe(initialScans);
      expect(() => { first!.source_json = '{}'; }).toThrow();
      expect(owner.read(db, 'prefix', 'second')!.source_id).toBe('second'); expect(scans).toBe(2 * initialScans);
    });
    const completed = scans; identityProof(db, read); expect(scans).toBeGreaterThan(completed);
    expect(() => identityProof(db, () => {
      read(); expect(() => owner.read(db, 'total', 'first')).toThrow(/alias/);
      expect(read).toThrow(/expired/);
    })).toThrow(/expired/);
    expect(() => identityProof(db, () => {
      read(); db.exec('PRAGMA query_only=0'); identityRow(db, owner.table, 'alias', 'first'); db.exec('PRAGMA query_only=1');
      expect(read).toThrow(); expect(read).toThrow(/expired/);
    })).toThrow(/expired/);
    expect(identityProof(db, read)!.source_id).toBe('first');
    identityRow(db, owner.table, 'alias', 'first');
    expect(() => identityProof(db, read)).toThrow(/alias/); expect(read).toThrow(/alias/);
  } finally { db.prepare = prepare; if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
});

it.each(identityOwners)('keeps $name identity reuse within the real WAL snapshot and authenticates peer changes after commit', owner => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const directory = mkdtempSync(join(tmpdir(), 'same-pa-identity-wal-')), path = join(directory, 'state.sqlite');
  const db = new Native(path), peer = new Native(path);
  try {
    db.exec('PRAGMA journal_mode=WAL'); for (const sql of Object.values(owner.schema)) db.exec(sql);
    identityRow(db, owner.table, 'first');
    expect(peer.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
    identityProof(db, () => {
      const original = owner.read(db, 'prefix', 'first'); identityRow(peer, owner.table, 'peer-alias', 'first');
      expect(owner.read(db, 'prefix', 'first')).toBe(original);
    });
    expect(() => identityProof(db, () => owner.read(db, 'prefix', 'first'))).toThrow(/alias/);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); peer.close(); rmSync(directory, { recursive: true, force: true }); }
});
