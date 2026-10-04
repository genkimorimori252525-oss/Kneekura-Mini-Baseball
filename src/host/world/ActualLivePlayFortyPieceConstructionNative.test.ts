import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { expect, it, vi } from 'vitest';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { ownedScheduledMotionArchiveEncoding } from './OwnedScheduledMotionArchive';
import { actualLivePlayScopeArchiveEncoding, actualLivePlayQueueArchiveEncoding } from './ActualLivePlayArchive';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteActualLivePlayStore } from './SqliteActualLivePlayStore';
import { openSqliteActualLivePlayQueueStore } from './SqliteActualLivePlayQueueStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
// Test receipt for already owner-validated output; never supplied to a production owner.
const logicalJson = (value: unknown) => JSON.stringify(value, (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const nodeCount = (value: unknown): number => value !== null && typeof value === 'object'
  ? 1 + Object.values(value).reduce<number>((sum, item) => sum + nodeCount(item), 0) : 1;
const diskWal = (db: import('node:sqlite').DatabaseSync, path: string) => {
  expect(db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
  expect(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(path);
};

// Reconstructed from the unchanged original32 Integrity fixture contract. The
// lost original forty-piece test/579 artifact is not an input or a claimed receipt.
// Opt-in prevents ordinary light gates from starting expensive physical replay.
it.runIf(process.env.BASEBALL_FORTY_NATIVE === '1')('constructs forty genuine original-participant pieces and durably reopens both live archive owners', () => {
  const output = process.env.BASEBALL_FORTY_ARTIFACT_DIR;
  const sourceQualification = { commit: process.env.BASEBALL_FORTY_SOURCE_COMMIT,
    fullManifestSha256: process.env.BASEBALL_FORTY_FULL_SOURCE_SHA256, srcManifestSha256: process.env.BASEBALL_FORTY_SRC_SOURCE_SHA256 };
  if (!output || readdirSync(output).length !== 0) throw new Error('fresh explicit forty-piece artifact directory required');
  expect(sourceQualification.commit).toMatch(/^[a-f0-9]{40}$/);
  expect(sourceQualification.fullManifestSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(sourceQualification.srcManifestSha256).toMatch(/^[a-f0-9]{64}$/);
  const originalIntegritySha256 = sha256(readFileSync(new URL('./OwnedScheduledMotionIntegrity.test.ts', import.meta.url)));
  expect(originalIntegritySha256).toBe('15ee8f1ec0737691fe72101ae297cd024803312bf9f5c184e831bb0869601547');
  const started = performance.now();
  const phase = (name: string, details: Record<string, unknown> = {}) => {
    const line = JSON.stringify({ at: new Date().toISOString(), phase: name, monotonicElapsedMs: performance.now() - started, ...details });
    console.info(line);
    if (process.env.BASEBALL_FORTY_PHASE_LOG) appendFileSync(process.env.BASEBALL_FORTY_PHASE_LOG, `${line}\n`);
  };
  const timed = <T>(name: string, body: () => T): T => {
    phase(`${name}:begin`); const since = performance.now();
    try { const result = body(); phase(`${name}:end`, { operationMs: performance.now() - since }); return result; }
    catch (error) { phase(`${name}:error`, { operationMs: performance.now() - since, error: String(error) }); throw error; }
  };
  const directory = mkdtempSync(join(tmpdir(), 'actual-live-forty-reconstruction-')), path = join(directory, 'state.sqlite');
  const x = timed('original-fixture', () => ownedScheduledMotionFixture(path, 1000));
  let fixtureClosed = false;
  const connections: { close(): void }[] = [];
  const track = <T extends { close(): void }>(value: T): T => { connections.push(value); return value; };
  const closeAll = () => { for (const connection of connections.splice(0).reverse()) connection.close(); };
  try {
    diskWal(x.f.db, path);
    const planned = timed('capture-plan', () => x.plan('forty-live-plan'));
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('real owned acquisition plan required');
    const plan = planned.execution.plan, count = 40;
    expect(plan.contactMoment.elapsedSeconds).toBeCloseTo(.01, 12);
    const duration = (plan.secureElapsedSeconds - plan.contactMoment.elapsedSeconds) / (count + 3);
    expect(duration).toBeGreaterThan(0);
    let current = timed('capture-initialization', () => x.step('forty-live-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds }));
    const checkpoint = (sourceId: string, throughElapsedSeconds: number) => {
      if (current.execution.kind !== 'owned_motion_v2') throw new Error('actual accepted predecessor required');
      const prior = current, execution = current.execution;
      // These are Source references from the immediately preceding concrete-owner
      // result. Each accept independently reconstructs and authenticates every
      // original self/command. No derived receipt or prefix cache enters the writer.
      const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId, previousExecutionSourceId: prior.source.sourceId,
        action: { kind: 'owned_motion_v2', checkpoint: { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds },
          knownWork: x.knownWork(), contributions: execution.composition.contributors.map(c => ({ kind: 'retained', playerId: c.playerId,
            command: { ...c.retainedCommand, executedThrough: execution.adoption.executedThrough } })) } };
      x.sources.set(sourceId, source);
      current = timed(`accept:${sourceId}`, () => x.executions.accept(sourceId));
      return current;
    };
    let previousElapsed = plan.contactMoment.elapsedSeconds;
    for (let index = 1; index <= count; index++) {
      checkpoint(`forty-live-piece-${index}`, plan.contactMoment.elapsedSeconds + duration * index);
      if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition') throw new Error('actual retained capture piece required');
      const elapsed = current.execution.adoption.executedThrough.elapsedSeconds;
      expect(elapsed).toBeGreaterThan(previousElapsed); previousElapsed = elapsed;
      expect(current.execution.composition.contributors).toHaveLength(10);
      expect(current.execution.composition.contributors.every(c => c.kind === 'retained' && c.retainedRoles.length === 5)).toBe(true);
      phase('retained-piece-committed', { checkpointIndex: index, revision: current.revision, executionSourceId: current.source.sourceId, physicalElapsedSeconds: elapsed });
    }
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition') throw new Error('capture operation required');
    expect(current.execution.operation.previousSteps).toHaveLength(count);
    expect(current.execution.operation.previousSteps.every(ref => Object.keys(ref).sort().join('|') === 'snapshotHash|sourceHash|sourceId')).toBe(true);
    checkpoint('forty-live-secure', plan.fenceElapsedSeconds);
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition') throw new Error('secure operation required');
    expect(current.execution.operation.progress.kind).toBe('fence_pending');
    checkpoint('forty-live-confirmed', plan.fenceElapsedSeconds);
    if (current.execution.kind !== 'owned_motion_v2' || current.execution.operation?.kind !== 'acquisition'
      || current.execution.operation.progress.kind !== 'secured') throw new Error('real confirmed capture required');
    expect(current.execution.liveWork.operation?.receipts.map(r => r.kind)).toContain('acquisition_confirmed');
    expect(current.execution.liveWork.operation?.handoffs.map(h => h.kind)).toEqual(['custody', 'rule_evidence']);
    const confirmedSourceId = current.source.sourceId;
    const historySource: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId: 'forty-live-whole-history',
      previousExecutionSourceId: confirmedSourceId, action: { kind: 'whole_play_history' } };
    x.sources.set(historySource.sourceId, historySource);
    current = timed('whole-history', () => x.executions.accept(historySource.sourceId));
    if (current.execution.kind !== 'whole_play_history') throw new Error('real whole-history owner required');
    const history = current.execution.physicalHistory;
    expect(history.physicalSteps.filter(step => step.kind === 'owned_motion_v2')).toHaveLength(43);
    expect(nodeCount(history)).toBeGreaterThan(100_000);
    expect(history.frames.flatMap(frame => frame.occurrences.map(event => event.phase)))
      .toEqual(expect.arrayContaining(['bat_contact', 'acquisition_constraint_started', 'acquisition_confirmed']));
    const originalPlayers = [history.origin.batterRunnerId, ...history.origin.defenderIds];
    expect(originalPlayers).toHaveLength(10); expect(new Set(originalPlayers).size).toBe(10);
    for (const playerId of originalPlayers) expect(history.origin.actors.filter(actor => actor.playerId === playerId).map(actor => actor.primitive.role).sort())
      .toEqual(['body', 'glove', 'left_foot', 'right_foot', 'tag_hand']);
    const observer = timed('observation-models', () => installSyntheticObservation(x, plan.acquirerPlayerId, current.source.sourceId));
    const observed = timed('actual-observation', () => observer.observations.accept(observer.observationSource.sourceId));
    const physicalPair = ownedScheduledMotionArchiveEncoding(current);
    expect(x.f.db.prepare("SELECT count(*) n FROM batted_world_field_executions WHERE source_id LIKE 'forty-live-piece-%'").get()!.n).toBe(40);
    expect(x.f.db.prepare('SELECT count(*) n FROM batted_world_field_executions').get()!.n).toBe(45);
    expect(x.f.db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all()).toEqual([]);
    const physicalPitchSourceId = x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId;
    const originalTables = x.f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => String(row.name));
    const readRows = (db: import('node:sqlite').DatabaseSync) => originalTables.map(table => ({ table,
      rows: db.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}"`).all() }));
    const originalRows = readRows(x.f.db), originalRowsSha256 = sha256(JSON.stringify(originalRows));
    const constructionDatabase = join(output, 'actual-live-forty-piece-construction.sqlite');
    timed('construction-backup', () => x.f.db.prepare('VACUUM INTO ?').run(constructionDatabase));
    const constructionReceipt = { format: 'actual_live_forty_piece_construction_v1', reconstruction: 'current_original32_fixture_contract',
      sourceQualification, originalIntegritySha256, runtime: process.version, actualJournalMode: 'wal',
      fixtureInputs: { capturePower: 1000, retainedStepCount: count, contactElapsedSeconds: .01 },
      database: 'actual-live-forty-piece-construction.sqlite', databaseSha256: sha256(readFileSync(constructionDatabase)),
      physicalPitchSourceId, baseFieldSourceId: x.baseField.source.sourceId, planSourceId: planned.source.sourceId,
      confirmedSourceId, executionSourceId: current.source.sourceId, observationSourceId: observed.source.sourceId,
      physicalArchiveHash: physicalPair.hash, physicalLogicalHash: sha256(logicalJson(current)), observationLogicalHash: sha256(logicalJson(observed)),
      originalTables, originalRowsSha256, originalRows, physicalRevision: current.revision, physicalWorkRecords: 43 };
    const reportPath = join(output, 'actual-live-forty-piece-construction.json');
    writeFileSync(reportPath, JSON.stringify(constructionReceipt, null, 2), { flag: 'wx' });
    phase('genuine-construction-artifact-saved-before-faults', { databaseSha256: constructionReceipt.databaseSha256, originalRowsSha256,
      revision: current.revision, physicalWorkRecords: 43 });
    x.f.close(); fixtureClosed = true;
    const db = track(new DatabaseSync(path)); diskWal(db, path);
    expect(readRows(db)).toEqual(originalRows);
    // Exactly one fresh physical/observation authentication after all construction
    // connections close. Subsequent live stores perform their own mandatory reads.
    expect(timed('cold-original-physical-read', () => battedWorldFieldExecutionEvidenceFromSqlite(db).read(current.source.sourceId))).toEqual(current);
    expect(timed('cold-original-observation-read', () => actualFieldObservationEvidenceFromSqlite(db).read(observed.source.sourceId))).toEqual(observed);
    const source = { sourceId: 'forty-live-scope', sourceVersion: 'reconstructed-v1', capability: 'actual_live_play_scope_v1' as const,
      physicalPitchSourceId, cut: { kind: 'field_execution' as const, baseFieldSourceId: constructionReceipt.baseFieldSourceId, executionSourceId: current.source.sourceId } };
    let queueSource = { ...source, sourceId: 'forty-live-queue', capability: 'actual_live_play_queue_v1' as const };
    const scopes = track(openSqliteActualLivePlayStore(path, { readAcceptedScope: () => source }));
    const queues = track(openSqliteActualLivePlayQueueStore(path, { readAcceptedCheckpoint: () => queueSource }));
    const unchanged = () => expect(readRows(db)).toEqual(originalRows);
    const heads = db.prepare('SELECT * FROM batted_world_field_execution_heads').all();
    const archiveTables = ['actual_live_play_scopes', 'actual_live_play_queue_checkpoints'] as const;
    const archiveRows = () => archiveTables.map(table => ({ table, rows: db.prepare(`SELECT * FROM ${table}`).all() }));
    const emptyArchives = archiveRows(), faultWitnesses: unknown[] = [];
    for (const [store, id, table, sql] of [[scopes, source.sourceId, archiveTables[0], 'INSERT INTO actual_live_play_scopes VALUES (?,?,?,?,?,?,?,?,?,?,?)'],
      [queues, queueSource.sourceId, archiveTables[1], 'INSERT INTO actual_live_play_queue_checkpoints VALUES (?,?,?,?,?,?)']] as const) {
      db.exec(`CREATE TRIGGER corrupt_forty_archive_dependency AFTER INSERT ON ${table} BEGIN UPDATE batted_world_field_execution_heads SET revision=revision+1; END;`);
      const witness = witnessSqliteWrite(sql, writer => {
        diskWal(writer, path); expect(writer).not.toBe(db); expect(writer.isTransaction).toBe(true);
        const inserted = writer.prepare(`SELECT source_id FROM ${table} WHERE source_id=?`).get(id);
        const changedHeads = writer.prepare('SELECT * FROM batted_world_field_execution_heads').all();
        const reached = inserted?.source_id === id && changedHeads.some(row => row.revision === current.revision + 1);
        if (reached) faultWitnesses.push({ table, sourceId: id, postInsertRowPresent: true, corruptedHeadRevision: current.revision + 1, writerTransaction: true });
        return reached;
      });
      try { timed(`post-insert-fault:${table}`, () => expect(() => store.accept(id)).toThrow(/head|dependencies|prefix|archive/)); expect(witness.wasReached()).toBe(true); }
      finally { witness.close(); db.exec('DROP TRIGGER corrupt_forty_archive_dependency'); }
      expect(archiveRows()).toEqual(emptyArchives); expect(db.prepare('SELECT * FROM batted_world_field_execution_heads').all()).toEqual(heads); unchanged();
    }
    const savedScope = timed('scope-accept', () => scopes.accept(source.sourceId)), savedQueue = timed('queue-accept', () => queues.accept(queueSource.sourceId));
    expect(savedScope.scope.participants).toHaveLength(10); expect(savedScope.scope.producers).toHaveLength(70);
    expect(savedScope.scope.participants.every(participant => participant.bodyModel?.primitiveRoles.length === 5)).toBe(true);
    expect(savedScope.physicalLocalHistory).toHaveLength(43); expect(savedQueue.queue.represented).toHaveLength(43);
    expect(savedQueue.queue.events.map(event => event.kind)).toEqual(['acquisition_confirmed']);
    expect(savedQueue.queue.events[0].owner.sourceId).toBe(confirmedSourceId);
    expect(savedQueue.queue.successors.map(successor => [successor.kind, successor.status])).toEqual([['custody', 'pending'], ['rule_evidence', 'pending']]);
    expect(savedQueue.queue.playEnd).toBeNull(); expect(() => actorJson(savedQueue)).toThrow(/size limits/);
    const scopePair = actualLivePlayScopeArchiveEncoding(savedScope), queuePair = actualLivePlayQueueArchiveEncoding(savedQueue);
    const acceptedRows = archiveRows();
    expect(acceptedRows[0].rows[0].snapshot_json).toBe(scopePair.json); expect(acceptedRows[0].rows[0].snapshot_hash).toBe(scopePair.hash);
    expect(acceptedRows[1].rows[0].snapshot_json).toBe(queuePair.json); expect(acceptedRows[1].rows[0].snapshot_hash).toBe(queuePair.hash);
    expect(timed('scope-frozen-retry', () => scopes.accept(source.sourceId))).toEqual(savedScope);
    expect(timed('queue-frozen-retry', () => queues.accept(queueSource.sourceId))).toEqual(savedQueue); unchanged();
    for (const [store, table, id, jsonPath, pair] of [[scopes, archiveTables[0], source.sourceId, '$.physicalLocalHistory[0].workHash', scopePair],
      [queues, archiveTables[1], queueSource.sourceId, '$.queue.represented[0].localWorkHash', queuePair]] as const) {
      db.prepare(`UPDATE ${table} SET snapshot_json=json_set(snapshot_json,?,'forged') WHERE source_id=?`).run(jsonPath, id);
      const forgedJson = String(db.prepare(`SELECT snapshot_json FROM ${table} WHERE source_id=?`).get(id)!.snapshot_json);
      db.prepare(`UPDATE ${table} SET snapshot_hash=? WHERE source_id=?`).run(sha256(forgedJson), id);
      expect(db.prepare(`SELECT snapshot_hash FROM ${table} WHERE source_id=?`).get(id)!.snapshot_hash).toBe(sha256(forgedJson));
      timed(`manifest-corruption:${table}`, () => expect(() => store.read(id)).toThrow(/archive|corrupt/));
      db.prepare(`UPDATE ${table} SET snapshot_json=?,snapshot_hash=? WHERE source_id=?`).run(pair.json, pair.hash, id);
    }
    queueSource = { ...queueSource, sourceId: 'forty-live-peer-queue' };
    const originalPlanHash = db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(planned.source.sourceId)!.snapshot_hash;
    const exec = DatabaseSync.prototype.exec; let peerChanged = false;
    const peerHook = vi.spyOn(DatabaseSync.prototype, 'exec').mockImplementation(function(this: import('node:sqlite').DatabaseSync, sql: string) {
      if (sql === 'BEGIN IMMEDIATE' && !peerChanged) { expect(this).not.toBe(db); diskWal(this, path); peerChanged = true;
        db.prepare("UPDATE batted_world_field_executions SET snapshot_hash='peer-corruption' WHERE source_id=?").run(planned.source.sourceId); }
      return exec.call(this, sql);
    });
    try { timed('peer-wal-rejection', () => expect(() => queues.accept(queueSource.sourceId)).toThrow()); expect(peerChanged).toBe(true); }
    finally { peerHook.mockRestore(); }
    expect(archiveRows()).toEqual(acceptedRows);
    expect(db.prepare('SELECT snapshot_hash FROM batted_world_field_executions WHERE source_id=?').get(planned.source.sourceId)!.snapshot_hash).toBe('peer-corruption');
    db.prepare('UPDATE batted_world_field_executions SET snapshot_hash=? WHERE source_id=?').run(originalPlanHash, planned.source.sourceId);
    unchanged(); closeAll();
    const disk = track(new DatabaseSync(path, { readOnly: true })); diskWal(disk, path);
    expect(readRows(disk)).toEqual(originalRows);
    const reopenedScopes = track(openSqliteActualLivePlayStore(path)), reopenedQueues = track(openSqliteActualLivePlayQueueStore(path));
    expect(timed('fully-closed-scope-reopen', () => reopenedScopes.read(source.sourceId))).toEqual(savedScope);
    expect(timed('fully-closed-queue-reopen', () => reopenedQueues.read(savedQueue.source.sourceId))).toEqual(savedQueue);
    expect(archiveTables.map(table => ({ table, rows: disk.prepare(`SELECT * FROM ${table}`).all() }))).toEqual(acceptedRows);
    expect(readRows(disk)).toEqual(originalRows);
    const finalDatabase = join(output, 'actual-live-forty-piece-archives.sqlite');
    timed('verified-live-archive-backup', () => disk.prepare('VACUUM INTO ?').run(finalDatabase));
    writeFileSync(join(output, 'actual-live-forty-piece-archives.json'), JSON.stringify({ ...constructionReceipt,
      format: 'actual_live_forty_piece_archives_v1', database: 'actual-live-forty-piece-archives.sqlite', databaseSha256: sha256(readFileSync(finalDatabase)),
      constructionDatabaseSha256: constructionReceipt.databaseSha256, originalRowsFinalSha256: sha256(JSON.stringify(readRows(disk))),
      scopePair, queuePair, scopeLogicalHash: sha256(logicalJson(savedScope)), queueLogicalHash: sha256(logicalJson(savedQueue)),
      scopeLogicalNodes: nodeCount(savedScope), scopeLogicalBytes: Buffer.byteLength(logicalJson(savedScope)), queueLogicalNodes: nodeCount(savedQueue),
      scopeSourceId: savedScope.source.sourceId, queueSourceId: savedQueue.source.sourceId, archiveRows: acceptedRows,
      mutationChecks: { faultWitnesses, scopeManifestCorruptionRejected: true, queueManifestCorruptionRejected: true, peerWalOriginalDependencyRejected: true },
      allConstructionConnectionsClosed: true, allArchiveConnectionsClosedBeforeReopen: true, freshPhysicalAndObservationOwnerReads: true,
      archiveRowsSha256: sha256(JSON.stringify(acceptedRows)) }, null, 2), { flag: 'wx' });
    expect(sha256(readFileSync(constructionDatabase))).toBe(constructionReceipt.databaseSha256);
    phase('forty-piece-archive-gate-complete', { physicalWorkRecords: 43, faultWitnesses: faultWitnesses.length, originalRowsSha256 });
  } finally { closeAll(); if (!fixtureClosed) x.f.close(); rmSync(directory, { recursive: true, force: true }); }
}, 3_600_000);
