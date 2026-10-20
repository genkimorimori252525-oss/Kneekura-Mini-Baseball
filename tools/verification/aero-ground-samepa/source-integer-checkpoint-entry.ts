import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore, readSamePaPhysicalOperationFromSqlite } from '../../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION as VERSION } from '../../../src/host/world/SamePlateAppearanceBallPhysics';
import { deriveFieldIntegerBoundaryV1 } from '../../../src/core/sim/ball/SourceFieldIntegerBoundaryV1';
import { createSourceFreeBallKernel } from '../../../src/core/sim/ball/SourceFreeBallKernel';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from '../../../src/host/world/SamePlateAppearancePhysicalEpisode';
import type { SamePaReference } from '../../../src/host/world/SamePlateAppearanceWorkPrefix';

/** One declared closed input, new-only private copy, three separate processes.
 * Never substitutes a lifecycle cut or restarts an interrupted admission. */
const [manifestArgument, directoryArgument, stage = 'prepare'] = process.argv.slice(2);
assert.ok(manifestArgument && directoryArgument); assert.ok(['prepare', 'admit', 'reopen'].includes(stage));
type Manifest = { databasePath: string; sourceMapPath: string; databaseHash: string; sourceMapHash: string;
  rootReference: SamePaReference<'pa_physical_v1_field_roots'>; stepReference: SamePaReference<'pa_physical_v1_field_steps'>;
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'> };
type Pin = { rowid: number; sourceId: string | null; hash: string };
type Rows = { schemaHash: string; tables: Record<string, Pin[]> };
const manifestPath = resolve(manifestArgument), manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
const out = resolve(directoryArgument), inputDb = resolve(manifest.databasePath), inputMap = resolve(manifest.sourceMapPath);
assert.ok(out !== dirname(inputDb) && !out.startsWith(dirname(inputDb) + '\\') && !out.startsWith(dirname(inputDb) + '/'));
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const originalsUnchanged = () => { assert.equal(sha(inputDb), manifest.databaseHash); assert.equal(sha(inputMap), manifest.sourceMapHash); };
const atomic = (path: string, value: unknown) => { const tmp = path + '.pending-' + process.pid; writeFileSync(tmp, JSON.stringify(value, null, 2), { flag: 'wx' }); renameSync(tmp, path); };
originalsUnchanged(); mkdirSync(out, { recursive: true });
const databasePath = join(out, 'integer-checkpoint.sqlite'), sourceMapPath = join(out, 'accepted-sources.json');
const proofPath = join(out, stage + '.json'); assert.ok(!existsSync(proofPath), 'never rerun an attempted stage blindly');
if (stage === 'prepare') {
  assert.ok(!existsSync(databasePath) && !existsSync(sourceMapPath), 'private proof copy must be new');
  copyFileSync(inputDb, databasePath, constants.COPYFILE_EXCL); copyFileSync(inputMap, sourceMapPath, constants.COPYFILE_EXCL);
}
const sources = new Map<string, unknown>(JSON.parse(readFileSync(sourceMapPath, 'utf8')));
const originalSources = new Map<string, unknown>(JSON.parse(readFileSync(inputMap, 'utf8')));
const oldSourcesUnchanged = () => { for (const [id, value] of originalSources) assert.deepEqual(sources.get(id), value); };
oldSourcesUnchanged();
const rows = (db: DatabaseSync): Rows => {
  const schema = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const tables: Record<string, Pin[]> = {};
  for (const row of schema) {
    const table = String(row.name); assert.match(table, /^[A-Za-z_][A-Za-z_0-9]*$/);
    tables[table] = db.prepare('SELECT rowid AS proof_rowid,* FROM main.' + table + ' ORDER BY rowid').all().map(r => ({
      rowid: Number(r.proof_rowid), sourceId: typeof r.source_id === 'string' ? r.source_id : null, hash: hash(r) }));
  }
  return { schemaHash: hash(schema), tables };
};
const readOnly = <T>(fn: (db: DatabaseSync) => T): T => {
  const db = new DatabaseSync(databasePath, { readOnly: true }); try { return fn(db); } finally { db.close(); }
};
const delta = (before: Rows, after: Rows, addedSourceId?: string, expectedHead?: Record<string, unknown>) => {
  assert.equal(after.schemaHash, before.schemaHash); assert.deepEqual(Object.keys(after.tables), Object.keys(before.tables));
  for (const [table, old] of Object.entries(before.tables)) {
    const current = after.tables[table];
    for (const pin of old) assert.deepEqual(current.find(r => r.rowid === pin.rowid),
      table === 'pa_physical_v1_heads' && expectedHead && pin.rowid === expectedHead.proof_rowid
        ? { rowid: pin.rowid, sourceId: null, hash: hash(expectedHead) } : pin, 'archived row changed: ' + table);
    assert.deepEqual(current.filter(pin => !old.some(r => r.rowid === pin.rowid)).map(r => r.sourceId),
      table === 'pa_physical_v1_field_steps' && addedSourceId ? [addedSourceId] : [], 'unexpected row added: ' + table);
  }
};
const original = (db: DatabaseSync, historical = false) => {
  const root = readSamePaPhysicalOperationFromSqlite(db, manifest.rootReference).record;
  const previous = readSamePaPhysicalOperationFromSqlite(db, manifest.stepReference).record;
  assert.ok(root.kind === 'same_pa_physical_field_root_v1' && previous.kind === 'same_pa_physical_field_step_v1');
  assert.deepEqual(reference('pa_physical_v1_field_roots', root), manifest.rootReference);
  assert.deepEqual(reference('pa_physical_v1_field_steps', previous), manifest.stepReference);
  assert.deepEqual(sources.get(root.source.sourceId), root.source); assert.deepEqual(sources.get(previous.source.sourceId), previous.source);
  const basis = (historical ? readHistoricalSamePaLifecycleViewFromSqlite : readCurrentSamePaLifecycleViewFromSqlite)(db, manifest.viewReference);
  assert.deepEqual(basis.view.cut.physicalOperationReference, manifest.stepReference);
  assert.equal(basis.view.cut.evaluationTick, previous.evaluationTick);
  return { root, previous };
};
const inspectCheckpoint = (root: SamePaPhysicalFieldRoot, previous: SamePaPhysicalFieldStep, step: SamePaPhysicalFieldStep) => {
  const before = previous.field.motion.cursor!, after = step.field.motion.cursor!;
  assert.ok(before?.sourceCurve && after?.sourceCurve); assert.equal(step.source.sourceVersion, VERSION);
  assert.equal(step.actionResult?.kind, 'source_integer_boundary_checkpoint_v1');
  if (step.actionResult?.kind !== 'source_integer_boundary_checkpoint_v1') throw new Error('missing original checkpoint result');
  const boundary = deriveFieldIntegerBoundaryV1({ originTick: before.moment.originTick, elapsedSeconds: before.moment.elapsedSeconds,
    ticksPerSecond: root.response.world.parameters.ticksPerSecond });
  assert.deepEqual(step.actionResult.boundary, boundary); assert.equal(step.actionResult.status, 'checkpoint_reached');
  assert.ok(boundary.waitSeconds > 0); assert.equal(step.evaluationTick, previous.evaluationTick);
  assert.equal(after.moment.elapsedSeconds, boundary.boundaryElapsedSeconds); assert.equal(after.moment.ball.tick, before.moment.ball.tick);
  assert.deepEqual(after.sourceCurve.initial, before.sourceCurve.initial); assert.deepEqual(after.sourceCurve.profile, before.sourceCurve.profile);
  assert.deepEqual(after.moment, createSourceFreeBallKernel(after.sourceCurve).evaluateAt(after.moment.elapsedSeconds, after.sourceSide).moment);
  assert.deepEqual(step.field.motion.actors, previous.field.motion.actors); assert.deepEqual(step.timeline, previous.timeline);
  assert.equal(step.field.motion.carrierPlayerId, null); assert.notDeepEqual(after.moment.ball.position, before.moment.ball.position);
  return { boundary, originalCursor: before, cursor: after, incomingWorldMoment: step.field.motion.world.moment,
    actorPrimitiveCount: step.field.motion.actors.length, timelineHash: hash(step.timeline), solverEvidenceHash: hash(step.ballSolverEvidence) };
};
const operationId = 'source-integer-native-v1:checkpoint:0', started = Date.now();
process.stdout.write(JSON.stringify({ stage, status: 'START', pid: process.pid, databasePath, manifestPath }) + '\n');
const before = readOnly(rows); atomic(join(out, 'before-' + stage + '.json'), before);
let proof: Record<string, unknown>;
try {
  if (stage === 'prepare') {
    const result = readOnly(db => withSqliteReadTransaction(db, () => {
      assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
      const { root, previous } = original(db);
      return { rootReference: manifest.rootReference, stepReference: manifest.stepReference, viewReference: manifest.viewReference,
        rootHash: hash(root), previousHash: hash(previous), originalFieldHash: hash(previous.field), originalTimelineHash: hash(previous.timeline),
        originalMoment: previous.field.motion.cursor!.moment, currentViewCoversStep: true };
    }));
    delta(before, readOnly(rows)); proof = { status: 'PASS_ORIGINAL_OWNER_CLOSED_CURRENT_PREFIX_READ', ...result };
  } else if (stage === 'admit') {
    assert.ok(existsSync(join(out, 'prepare.json')), 'authenticate the closed prefix first');
    assert.ok(!sources.has(operationId), 'published or attempted admission must be inspected, never readmitted blindly');
    const source = readOnly(db => withSqliteReadTransaction(db, () => {
      const { previous } = original(db);
      return { sourceId: operationId, sourceVersion: VERSION, capability: 'same_pa_physical_field_step_v1',
        viewReference: manifest.viewReference, launchReference: previous.source.launchReference,
        previousOperationReference: manifest.stepReference, previousFieldReference: manifest.stepReference,
        fieldRootReference: manifest.rootReference, throughTick: previous.evaluationTick, action: { kind: 'source_integer_boundary_checkpoint_v1' } };
    }));
    sources.set(operationId, source); atomic(sourceMapPath, [...sources]);
    atomic(join(out, 'source-published.json'), { source, sourceHash: hash(source), pid: process.pid, originalOwnerAdmissionNotYetProved: true });
    const owner = openSqliteSamePlateAppearancePhysicalEpisodeStore(databasePath, { readAcceptedOperation: id => sources.get(id) });
    let accepted: SamePaPhysicalFieldStep;
    try { const value = owner.acceptOperation(operationId); assert.ok(value.kind === 'same_pa_physical_field_step_v1'); accepted = value; }
    finally { owner.close(); }
    const detail = readOnly(db => {
      const old = JSON.parse(String(db.prepare('SELECT snapshot_json FROM pa_physical_v1_field_steps WHERE source_id=?').get(manifest.stepReference.sourceId)!.snapshot_json)) as SamePaPhysicalFieldStep;
      const root = JSON.parse(String(db.prepare('SELECT snapshot_json FROM pa_physical_v1_field_roots WHERE source_id=?').get(manifest.rootReference.sourceId)!.snapshot_json)) as SamePaPhysicalFieldRoot;
      const head = db.prepare('SELECT rowid AS proof_rowid,* FROM pa_physical_v1_heads WHERE enrollment_source_id=?').get(accepted.lineage.enrollmentReference.sourceId)!;
      const expectedHead = { proof_rowid: head.proof_rowid, enrollment_source_id: accepted.lineage.enrollmentReference.sourceId,
        career_id: accepted.lineage.careerId, game_id: accepted.lineage.gameId, play_id: accepted.lineage.playId, pitch_ordinal: accepted.pitchOrdinal,
        launch_source_id: accepted.physicalPitchSourceId, operation_ordinal: accepted.operationOrdinal, last_owner: 'pa_physical_v1_field_steps',
        last_source_id: operationId, last_snapshot_hash: hash(accepted) };
      assert.deepEqual({ ...head }, expectedHead); delta(before, rows(db), operationId, expectedHead);
      return { ...inspectCheckpoint(root, old, accepted), expectedHeadHash: hash(expectedHead) };
    });
    proof = { status: 'PASS_ONE_SAME_TICK_CHECKPOINT_ORIGINAL_OWNER_ADMISSION_COLD_REOPEN_REQUIRED', ...detail,
      checkpointReference: reference('pa_physical_v1_field_steps', accepted), checkpointHash: hash(accepted), newPhysicalRows: 1, originalOwnerHeadCasCount: 1 };
  } else {
    const admitted = JSON.parse(readFileSync(join(out, 'admit.json'), 'utf8')); assert.notEqual(admitted.pid, process.pid);
    const detail = readOnly(db => withSqliteReadTransaction(db, () => {
      const { root, previous } = original(db, true);
      const value = readSamePaPhysicalOperationFromSqlite(db, admitted.checkpointReference).record;
      assert.ok(value.kind === 'same_pa_physical_field_step_v1'); assert.equal(hash(value), admitted.checkpointHash);
      assert.deepEqual(sources.get(operationId), value.source);
      return { ...inspectCheckpoint(root, previous, value), checkpointReference: admitted.checkpointReference, checkpointHash: hash(value) };
    }));
    delta(before, readOnly(rows)); proof = { status: 'PASS_ONE_NATIVE_CHECKPOINT_ADMISSION_AND_COLD_ORIGINAL_OWNER_REOPEN', ...detail,
      admissionProcessId: admitted.pid, sourceMapAuthorityUsedForReopen: false };
  }
  originalsUnchanged(); oldSourcesUnchanged();
  const closedDir = join(out, 'closed-' + stage + '-' + process.pid); mkdirSync(closedDir, { recursive: false });
  const closedDb = join(closedDir, 'checkpoint.sqlite'), closedMap = join(closedDir, 'accepted-sources.json');
  readOnly(db => db.prepare('VACUUM INTO ?').run(closedDb)); copyFileSync(sourceMapPath, closedMap, constants.COPYFILE_EXCL);
  const closed = new DatabaseSync(closedDb, { readOnly: true }); try { assert.deepEqual(rows(closed), readOnly(rows)); } finally { closed.close(); }
  const closedCheckpoint = { databasePath: closedDb, sourceMapPath: closedMap, databaseHash: sha(closedDb), sourceMapHash: sha(closedMap), allRowsAndSchemaEqual: true };
  atomic(join(closedDir, 'manifest.json'), { ...closedCheckpoint, stage, bodyExecution: false, official: null });
  atomic(proofPath, { ...proof, pid: process.pid, elapsedMilliseconds: Date.now() - started, manifestHash: sha(manifestPath),
    closedCheckpoint, originalDatabaseHash: manifest.databaseHash, originalSourceMapHash: manifest.sourceMapHash,
    oldSourcesAndOriginalFilesUnchanged: true, bodyExecution: false, custodyConnected: false, runnerExecution: false,
    rulesUnsupported: true, official: null, scoring: null });
  process.stdout.write(JSON.stringify({ stage, status: proof.status, pid: process.pid, elapsedMilliseconds: Date.now() - started, proofPath }) + '\n');
} catch (error) {
  atomic(join(out, 'failure-' + stage + '-' + process.pid + '.json'), { status: 'FAIL_OR_UNKNOWN_PRESERVED', pid: process.pid,
    message: String(error), stack: error instanceof Error ? error.stack : null, elapsedMilliseconds: Date.now() - started,
    originalFilesUnchanged: (() => { originalsUnchanged(); return true; })(), rows: readOnly(rows),
    sourcePublished: sources.has(operationId), originalOwnerAdmissionProved: false });
  throw error;
}
