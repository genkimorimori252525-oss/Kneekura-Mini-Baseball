import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { DatabaseSync as Database } from 'node:sqlite';
import type { PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { openSqlitePlayerWorkloadRecoveryStore, playerWorkloadRecoveryStoreFromSqlite,
  type AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import { rawCensus, schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';

// Small synthetic accepted-input parity only; no terminal/physical provenance is
// claimed. Both routes execute the real global Player writer and SQLite rollback.
it('connection-bound Player writer preserves legacy bytes and transaction retry failure ordering', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const directory = mkdtempSync(join(tmpdir(), 'player-workload-parity-'));
  const link = { sourceId: 'intake', sourceVersion: 'fixture-v1', sourceRecordId: 'record',
    careerId: 'career', playerId: 'player', personId: 'person', acceptedRevision: 1, acceptedAtDay: 1, rosterRevision: 0 };
  const links = { readLink: (id: string) => id === link.sourceId ? link : null };
  const baseline: AcceptedPlayerWorkloadBaseline = { sourceId: 'baseline', sourceVersion: 'fixture-v1', personLinkSourceId: link.sourceId,
    careerId: link.careerId, playerId: link.playerId, createdAtDay: 1, fatigue: 0.1, recoveryCapacity: 0.5,
    policy: { policyId: 'policy', version: 'fixture-v1', availableAtDay: 0, workloadFatiguePerUnit: 0.01, travelFatiguePerKm: 0.001, recoveryPerHour: 0.1 } };
  const sources = ['first', 'stale', 'fault'].map((id): PlayerWorkloadActivity => ({ sourceEventId: id, sourceVersion: 'fixture-v1',
    evidenceId: 'accepted:' + id, careerId: link.careerId, playerId: link.playerId, atDay: 1, kind: 'MATCH', effortUnits: 3 }));
  const authority = { readAcceptedBaseline: (id: string) => id === baseline.sourceId ? baseline : null,
    readAcceptedActivity: (id: string) => sources.find(source => source.sourceEventId === id) ?? null };
  const results = ['facade', 'bound'].map(mode => {
    const path = join(directory, mode + '.sqlite');
    // Public legacy setup is independently completed before the connection route.
    const setup = openSqlitePlayerWorkloadRecoveryStore(path, links); setup.close();
    const observer = new DatabaseSync(path), before = rawCensus(observer), schema = schemaCensus(observer);
    const phases: string[] = [], transactions: string[] = [];
    const guard = (db: Pick<Database, 'prepare'>, _activity: PlayerWorkloadActivity, phase: 'write' | 'written' | 'retry') => {
      expect((db as Database).isTransaction).toBe(true); phases.push(phase);
    };
    const store = mode === 'facade' ? openSqlitePlayerWorkloadRecoveryStore(path, links, authority, guard)
      : playerWorkloadRecoveryStoreFromSqlite(new DatabaseSync(path), links, authority, { activity: guard });
    expect(rawCensus(observer)).toEqual(before); expect(schemaCensus(observer)).toEqual(schema);
    const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')!;
    const original = descriptor.value as Database['exec'];
    const wrapped = { ...descriptor, value: function(this: Database, sql: string) {
      if (sql === 'BEGIN IMMEDIATE' || sql === 'COMMIT' || sql === 'ROLLBACK') transactions.push(sql + ':' + String(this.isTransaction));
      return Reflect.apply(original, this, [sql]);
    } };
    Object.defineProperty(DatabaseSync.prototype, 'exec', wrapped);
    try {
      const initial = store.initialize('baseline'), initializedAgain = store.initialize('baseline');
      const after = store.apply('first', 0), retried = store.apply('first', 0);
      expect(() => store.apply('stale', 0)).toThrow(/revision/);
      observer.exec("CREATE TRIGGER fail_workload AFTER INSERT ON world_player_workload_activities WHEN NEW.source_id='fault' BEGIN SELECT RAISE(ABORT,'parity fault'); END");
      const beforeFault = rawCensus(observer), faultSchema = schemaCensus(observer);
      expect(() => store.apply('fault', 1)).toThrow(/parity fault/);
      expect(rawCensus(observer)).toEqual(beforeFault); expect(schemaCensus(observer)).toEqual(faultSchema);
      observer.exec('DROP TRIGGER fail_workload');
      const rowBytes = rawCensus(observer), activity = store.readActivity('first');
      expect(store.readHead('career', 'player')).toEqual(after);
      store.close();
      const reopened = openSqlitePlayerWorkloadRecoveryStore(path, links);
      try {
        expect(reopened.initialize('baseline')).toEqual(after); expect(reopened.apply('first', 0)).toEqual(after);
        expect(rawCensus(observer)).toEqual(rowBytes);
      } finally { reopened.close(); }
      return { initial, initializedAgain, after, retried, activity, rowBytes, phases, transactions };
    } finally {
      if (Object.getOwnPropertyDescriptor(DatabaseSync.prototype, 'exec')?.value !== wrapped.value) throw new Error('later parity interceptor preserved');
      Object.defineProperty(DatabaseSync.prototype, 'exec', descriptor);
      store.close(); observer.close();
    }
  });
  expect(results[0]).toEqual(results[1]);
  expect(results[0].phases).toEqual(['write', 'written', 'retry', 'write', 'write']);
  expect(results[0].transactions).toEqual([
    'BEGIN IMMEDIATE:false', 'COMMIT:true', 'BEGIN IMMEDIATE:false', 'COMMIT:true',
    'BEGIN IMMEDIATE:false', 'COMMIT:true', 'BEGIN IMMEDIATE:false', 'COMMIT:true',
    'BEGIN IMMEDIATE:false', 'ROLLBACK:true', 'BEGIN IMMEDIATE:false', 'ROLLBACK:true',
    'BEGIN IMMEDIATE:false', 'COMMIT:true', 'BEGIN IMMEDIATE:false', 'COMMIT:true',
  ]);
});
