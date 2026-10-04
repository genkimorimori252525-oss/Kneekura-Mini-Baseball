import { createRequire } from 'node:module';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
/** Reopen the exact previously verified original-pitch chain. No accepted Source,
 * physical row, command, snapshot or ownership metadata is synthesized here. */
export const resumeActualFirstBasePlayEndFixture = (path: string) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=wal; PRAGMA busy_timeout=5000;');
  const closables: { close(): void }[] = [];
  const f = { db, path, track<T extends { close(): void }>(store: T): T { closables.push(store); return store; },
    close() { for (const store of closables.reverse()) store.close(); db.close(); } };
  try {
    const runtime = actualLiveRuntimeEvidenceFromSqlite(db).read('live-play-runtime');
    const reader = battedWorldFieldExecutionEvidenceFromSqlite(db), race = reader.read('field-first-base-race');
    if (!runtime || !race || race.execution.kind !== 'first_base_race') throw new Error('verified original first-base fixture is missing');
    const baseField = race.baseField;
    const prefix = () => ({ baseField, fields: battedWorldFieldEvidenceFromSqlite(db).scope(baseField, baseField.source.sourceId),
      executions: reader.scope(baseField, race.source.sourceId) });
    return { f, runtime, race, baseField, prefix, pitchId: runtime.source.physicalPitchSourceId };
  } catch (error) { f.close(); throw error; }
};
