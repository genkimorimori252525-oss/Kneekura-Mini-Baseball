import { createRequire } from 'node:module';
import type { DatabaseSync as Database } from 'node:sqlite';
import { expect, it } from 'vitest';
import { foulTerminalWorkloadTransaction } from './FoulTerminalWorkloadTransaction';

// SQLite transaction-mechanic proof only, not terminal provenance qualification.
it('terminal workload rejects a same-connection byte-neutral write during real BEGIN acquisition', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE probe(value TEXT); INSERT INTO probe VALUES('original')");
  const owner = foulTerminalWorkloadTransaction(db, () => {});
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')!;
  const exec = descriptor.value as Database['exec'];
  let observed = false;
  const installed = { ...descriptor, value: function(this: Database, sql: string) {
    const result = Reflect.apply(exec, this, [sql]);
    if (this === db && sql === 'BEGIN IMMEDIATE') {
      expect(db.isTransaction).toBe(true);
      expect(db.prepare('UPDATE probe SET value=value').run().changes).toBe(1); observed = true;
    }
    return result;
  } };
  Object.defineProperty(DatabaseSync.prototype, 'exec', installed);
  try {
    expect(() => owner.transaction(true, () => ({ value: 'no-write operation', changes: 0 }))).toThrow(/accounting|acquisition/);
    expect(observed).toBe(true); expect(db.isTransaction).toBe(false);
    expect(db.prepare('SELECT * FROM probe').all()).toEqual([{ value: 'original' }]);
  } finally {
    if (Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')?.value !== installed.value) throw new Error('later transaction interceptor preserved');
    Object.defineProperty(DatabaseSync.prototype, 'exec', descriptor); owner.close();
  }
});

it('terminal workload retires when real BEGIN acquires and then throws', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const owner = foulTerminalWorkloadTransaction(db, () => {});
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')!;
  const exec = descriptor.value as Database['exec'];
  const installed = { ...descriptor, value: function(this: Database, sql: string) {
    const result = Reflect.apply(exec, this, [sql]);
    if (this === db && sql === 'BEGIN IMMEDIATE') throw new Error('injected acquisition failure');
    return result;
  } };
  Object.defineProperty(DatabaseSync.prototype, 'exec', installed);
  try {
    expect(() => owner.transaction(true, () => ({ value: null, changes: 0 }))).toThrow(/retired/);
    expect(() => owner.check()).toThrow(/closed/);
    expect(() => db.prepare('SELECT 1')).toThrow();
  } finally {
    if (Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')?.value !== installed.value) throw new Error('later transaction interceptor preserved');
    Object.defineProperty(DatabaseSync.prototype, 'exec', descriptor); owner.close();
  }
});

const realTransactionOwner = () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE probe(value TEXT); INSERT INTO probe VALUES('original')");
  const owner = foulTerminalWorkloadTransaction(db, () => {});
  return { db, owner, DatabaseSync };
};

it('terminal workload rolls back ordinary failure and restores a reusable handle', () => {
  const { db, owner } = realTransactionOwner();
  try {
    expect(() => owner.transaction(true, () => {
      db.prepare("UPDATE probe SET value='changed'").run(); throw new Error('owned body failure');
    })).toThrow(/owned body failure/);
    expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(db.prepare('SELECT * FROM probe').all()).toEqual([{ value: 'original' }]);
    expect(owner.transaction(false, () => ({ value: owner.proof(() => db.prepare('SELECT * FROM probe').all()), changes: 0 })))
      .toEqual([{ value: 'original' }]);
  } finally { owner.close(); }
});

it('terminal workload rejects writes inside its read-only proof and restores the setting', () => {
  const { db, owner } = realTransactionOwner();
  try {
    expect(() => owner.transaction(true, () => {
      owner.proof(() => db.prepare("UPDATE probe SET value='changed'").run()); return { value: null, changes: 1 };
    })).toThrow(/readonly/);
    expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(db.prepare('SELECT * FROM probe').all()).toEqual([{ value: 'original' }]); owner.check();
  } finally { owner.close(); }
});

it('terminal workload retires after its owned transaction is replaced', () => {
  const { db, owner } = realTransactionOwner();
  try {
    expect(() => owner.transaction(true, () => {
      db.exec('ROLLBACK'); db.exec('BEGIN IMMEDIATE'); return { value: null, changes: 0 };
    })).toThrow(/retired/);
    expect(() => owner.check()).toThrow(/closed/); expect(() => db.prepare('SELECT 1')).toThrow();
  } finally { owner.close(); }
});

it('terminal workload retires after rollback fails', () => {
  const { db, owner, DatabaseSync } = realTransactionOwner();
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')!;
  const exec = descriptor.value as Database['exec'];
  const installed = { ...descriptor, value: function(this: Database, sql: string) {
    if (this === db && sql === 'ROLLBACK') throw new Error('injected rollback failure');
    return Reflect.apply(exec, this, [sql]);
  } };
  Object.defineProperty(DatabaseSync.prototype, 'exec', installed);
  try {
    expect(() => owner.transaction(true, () => { throw new Error('owned body failure'); })).toThrow(/retired/);
    expect(() => owner.check()).toThrow(/closed/); expect(() => db.prepare('SELECT 1')).toThrow();
  } finally {
    if (Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')?.value !== installed.value) throw new Error('later transaction interceptor preserved');
    Object.defineProperty(DatabaseSync.prototype, 'exec', descriptor); owner.close();
  }
});

it('terminal workload retires after query-only restoration fails', () => {
  const { db, owner, DatabaseSync } = realTransactionOwner();
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')!;
  const exec = descriptor.value as Database['exec'];
  const installed = { ...descriptor, value: function(this: Database, sql: string) {
    if (this === db && sql === 'PRAGMA query_only=0') throw new Error('injected query-only restoration failure');
    return Reflect.apply(exec, this, [sql]);
  } };
  Object.defineProperty(DatabaseSync.prototype, 'exec', installed);
  try {
    expect(() => owner.transaction(true, () => ({ value: null, changes: 0 }))).toThrow(/retired/);
    expect(() => owner.check()).toThrow(/closed/); expect(() => db.prepare('SELECT 1')).toThrow();
  } finally {
    if (Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')?.value !== installed.value) throw new Error('later transaction interceptor preserved');
    Object.defineProperty(DatabaseSync.prototype, 'exec', descriptor); owner.close();
  }
});

const commitFault = (fault: 'no_op' | 'replacement' | 'query_only' | 'throw_after_commit') => {
  const { db, owner, DatabaseSync } = realTransactionOwner();
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')!;
  const exec = descriptor.value as Database['exec'];
  let reached = false;
  const installed = { ...descriptor, value: function(this: Database, sql: string) {
    if (this === db && sql === 'COMMIT') {
      reached = true;
      if (fault === 'no_op') return;
      const result = Reflect.apply(exec, this, [sql]);
      if (fault === 'replacement') Reflect.apply(exec, this, ['BEGIN IMMEDIATE']);
      if (fault === 'query_only') Reflect.apply(exec, this, ['PRAGMA query_only=1']);
      if (fault === 'throw_after_commit') throw new Error('injected post-commit failure');
      return result;
    }
    return Reflect.apply(exec, this, [sql]);
  } };
  Object.defineProperty(DatabaseSync.prototype, 'exec', installed);
  try {
    expect(() => owner.transaction(true, () => {
      db.prepare("UPDATE probe SET value='changed'").run(); return { value: null, changes: 1 };
    })).toThrow(/retired/);
    expect(reached).toBe(true); expect(() => owner.check()).toThrow(/closed/);
    expect(() => db.prepare('SELECT 1')).toThrow();
  } finally {
    if (Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')?.value !== installed.value) throw new Error('later transaction interceptor preserved');
    Object.defineProperty(DatabaseSync.prototype, 'exec', descriptor); owner.close();
  }
};
it('terminal workload retires when COMMIT is suppressed', () => commitFault('no_op'));
it('terminal workload retires when real COMMIT is followed by a replacement transaction', () => commitFault('replacement'));
it('terminal workload retires when real COMMIT changes query-only state', () => commitFault('query_only'));
it('terminal workload retires when real COMMIT succeeds and then throws', () => commitFault('throw_after_commit'));
