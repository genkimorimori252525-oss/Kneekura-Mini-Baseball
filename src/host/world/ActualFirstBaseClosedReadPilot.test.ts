import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { appendFileSync, constants, copyFileSync, existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { actualFirstBaseClosedEvidenceFromSqlite, actualFirstBaseEndArchiveEncoding } from './SqliteActualFirstBasePlayEndStore';
import { ownedScheduledWholeHistoryArchiveEncoding } from './OwnedScheduledMotionArchive';
import { installScalarSqliteCounters } from './SqliteScalarCounters.test-support';

const inputHash = '3627a8d4e7cf99404eef8a6eefd22af591317a6dedcf46d82a0f61972dfa9331';
const projectionHash = 'f35a1d6f5b7b2d70bff1a9e38f27c237b23788a5f6c1210b391cbe82dd1dedc3';
const historyHash = 'ee1eaec4f6670a66a372adb0b734483effb9b1cbc5155d1b253921356611731e';
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const walBytes = (path: string) => existsSync(`${path}-wal`) ? statSync(`${path}-wal`).size : 0;
const phase = (name: string) => {
  const record = { time: new Date().toISOString(), phase: name, ...process.memoryUsage() };
  console.info('closed-end-read-pilot', name);
  if (process.env.BASEBALL_CLOSED_READ_PHASE_LOG) appendFileSync(process.env.BASEBALL_CLOSED_READ_PHASE_LOG, `${JSON.stringify(record)}\n`);
};

// One cold authenticated read, never an acceptance/rollback or whole-pipeline gate.
it.runIf(!!process.env.BASEBALL_CLOSED_READ_INPUT)('cold-reads the genuine closed original chain on a readonly transaction with exact projection and history equivalence', () => {
  const input = resolve(process.env.BASEBALL_CLOSED_READ_INPUT!);
  const resultPath = process.env.BASEBALL_CLOSED_READ_RESULT;
  if (!resultPath || existsSync(resultPath)) throw new Error('a new pilot result path is required');
  expect(sha(input)).toBe(inputHash); expect(walBytes(input)).toBe(0);
  const copy = join(mkdtempSync(join(tmpdir(), 'closed-end-read-pilot-')), 'state.sqlite');
  copyFileSync(input, copy, constants.COPYFILE_EXCL); expect(sha(copy)).toBe(inputHash);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(copy, { readOnly: true });
  let counters: ReturnType<typeof installScalarSqliteCounters> | null = null;
  const started = performance.now(); let readElapsedMilliseconds = 0;
  try {
    expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(copy);
    db.exec('PRAGMA query_only=ON; BEGIN');
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    const original = db.prepare('SELECT source_json,snapshot_json,snapshot_hash FROM actual_first_base_play_ends WHERE source_id=?').get('physical-end')!;
    expect(original.snapshot_hash).toBe(projectionHash);
    const originalProjection = JSON.parse(String(original.snapshot_json));
    counters = installScalarSqliteCounters(db);
    phase(`cold readonly owner read begins; copy ${copy}`);
    const readStarted = performance.now();
    const ended = actualFirstBaseClosedEvidenceFromSqlite(db).read('physical-end');
    readElapsedMilliseconds = performance.now() - readStarted;
    phase('authenticated closed owner read returned');
    expect(ended).not.toBeNull();
    const encoded = actualFirstBaseEndArchiveEncoding(ended!);
    expect(encoded.hash).toBe(projectionHash); expect(encoded.json).toBe(original.snapshot_json);
    expect(ended!.source).toEqual(JSON.parse(String(original.source_json)));
    expect(ended!.wholeHistoryHash).toBe(historyHash);
    expect(ownedScheduledWholeHistoryArchiveEncoding(ended!.wholeHistory, ended!.physicalPitchSourceId, ended!.gameId).hash).toBe(historyHash);
    expect(ended!.wholeHistory.end).toEqual({ kind: 'unestablished' });
    expect(ended!.futureWork).toEqual(originalProjection.futureWork);
    expect(ended!.firstBaseEvidenceApplicability).toEqual(originalProjection.firstBaseEvidenceApplicability);
    expect(ended!.generation.producerIds).toHaveLength(70); expect(ended!.generation.bodyBaseHistoryHashes).toHaveLength(40);
    expect(ended!.futureWork.controllers).toHaveLength(10); expect(ended!.futureWork.communication).toHaveLength(10);
    expect(ended!.futureWork.controllerDecisions).toHaveLength(1);
    expect(ended!.futureWork.controllerDecisions![0].decisionSourceId).toBe('scheduled-decision-home-2');
    expect(ended!.futureWork.controllerDecisions![0].work.deadlines.decision.tick).toBeGreaterThan(ended!.playEnd.tick);
    expect(ended!.futureWork.communication.every(value => value.dueTick > ended!.playEnd.tick)).toBe(true);
    expect(db.isTransaction).toBe(true); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
    db.exec('COMMIT');
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    try { db.close(); }
    finally { try { counters?.close(); }
      finally { if (process.env.BASEBALL_CLOSED_READ_SQL_COUNTS) writeFileSync(process.env.BASEBALL_CLOSED_READ_SQL_COUNTS,
        `${JSON.stringify(counters?.report() ?? [], null, 2)}\n`); } }
  }
  expect(db.isOpen).toBe(false);
  expect(sha(input)).toBe(inputHash); expect(sha(copy)).toBe(inputHash);
  expect(walBytes(input)).toBe(0); expect(walBytes(copy)).toBe(0);
  writeFileSync(resultPath, `${JSON.stringify({ kind: 'cold_read_equivalence', inputHash, copyHash: sha(copy), copy,
    projectionHash, wholeHistoryHash: historyHash, handlesClosed: true, inputWalBytes: walBytes(input), copyWalBytes: walBytes(copy),
    elapsedMilliseconds: performance.now() - started, readElapsedMilliseconds, actualAuthenticatedReads: 1 }, null, 2)}\n`);
  phase('readonly transaction and handle closed; exact input/copy bytes preserved');
}, 210_000);
