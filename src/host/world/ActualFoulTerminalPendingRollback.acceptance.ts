import { constants, copyFileSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { assertClosedTerminalSidecars, retainedTerminalProducer } from './ActualFoulTerminalCutover.test-support';
import { SqliteOfficialStateStore as FrozenV2Store } from '../SqliteOfficialStateV2.test-support';
import { foulEndLogicalBytes } from './ActualFoulPlayEndFixtures.test-support';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

it.each(['matches', 'applications', 'actual_foul_terminal_applications'] as const)
('P17 genuine pending application rolls back an original-evidence mutation from the real %s write', async table => {
  const producer = retainedTerminalProducer();
  expect(producer, 'P17_REQUIRES_EXPLICIT_RETAINED_GENUINE_PRODUCER_CONTROL').not.toBeNull();
  if (!producer) throw new Error('retained producer is required');
  assertClosedTerminalSidecars(producer.sourcePath);
  const directory = mkdtempSync(join(tmpdir(), 'terminal-pending-rollback-')), path = join(directory, 'private-v3.sqlite');
  console.info('TERMINAL_PENDING_ROLLBACK_ARTIFACT=' + directory);
  copyFileSync(producer.sourcePath, path, constants.COPYFILE_EXCL);
  let db = new DatabaseSync(path);
  expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(2);
  db.exec('BEGIN IMMEDIATE; PRAGMA user_version=3; COMMIT'); db.close();
  expect(() => new FrozenV2Store(path)).toThrow('unsupported official state store schema version');
  db = new DatabaseSync(path);
  let runner: { apply(sourceId: string): unknown; close(): void } | undefined;
  try {
    const queue = db.prepare('SELECT status,result_json FROM main.actual_foul_terminal_applications WHERE source_id=?').get('terminal-application');
    expect(queue).toEqual({ status: 'QUEUED', result_json: null });
    const moduleId = './SqliteActualFoulTerminalApplicationRunner';
    const module: { openSqliteActualFoulTerminalApplicationRunner?: (path: string) => NonNullable<typeof runner> } =
      existsSync(new URL(moduleId + '.ts', import.meta.url)) ? await import(/* @vite-ignore */ moduleId) : {};
    expect(typeof module.openSqliteActualFoulTerminalApplicationRunner, 'GENUINE_PENDING_ROLLBACK_RUNNER_API_MISSING').toBe('function');
    runner = module.openSqliteActualFoulTerminalApplicationRunner!(path);
    const before = foulEndLogicalBytes(db);
    db.exec(`CREATE TRIGGER terminal_pending_rollback AFTER ${table === 'applications' ? 'INSERT' : 'UPDATE'} ON ${table}
      BEGIN UPDATE actual_foul_play_ends SET snapshot_hash='corrupt-original'; END`);
    const schema = db.prepare('SELECT type,name,sql FROM main.sqlite_master ORDER BY type,name').all();
    let writer: import('node:sqlite').DatabaseSync | undefined;
    const witness = witnessSqliteWrite(new RegExp('(?:INSERT INTO|UPDATE) (?:main\\.)?' + table + '\\b'), connection => {
      writer = connection;
      return connection.isTransaction && connection.prepare('SELECT snapshot_hash FROM main.actual_foul_play_ends').get()!.snapshot_hash === 'corrupt-original';
    });
    try { expect(() => runner!.apply('terminal-application')).toThrow(); expect(witness.wasReached()).toBe(true); }
    finally { witness.close(); }
    expect(writer!.isTransaction).toBe(false); expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(db.prepare('SELECT type,name,sql FROM main.sqlite_master ORDER BY type,name').all()).toEqual(schema);
    expect(foulEndLogicalBytes(db)).toBe(before);
    expect(db.prepare('PRAGMA user_version').get()!.user_version).toBe(3);
    expect(fileHash(producer.sourcePath)).toBe(producer.sourceSha256);
  } finally { runner?.close(); db.close(); }
}, 600_000);
