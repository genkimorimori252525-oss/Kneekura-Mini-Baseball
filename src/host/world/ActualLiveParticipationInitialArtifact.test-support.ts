import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants, copyFileSync, existsSync, lstatSync, readFileSync, readdirSync,
  readlinkSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, normalize } from 'node:path';
import type { OriginalOfficialReplayReceipt } from '../../../tools/verification/actual-live-pipeline/official-read-replay-helper';
import { actualLivePlayClosureEvidenceFromSqlite, assertActualLiveClosureStage,
  type ActualLivePlayClosureProposal } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { SqliteOfficialParticipationStore, type ActualLiveParticipationReceipt } from './SqliteOfficialParticipationStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
export type InitialParticipationArtifactInput = Readonly<{
  artifactPath: string; artifactSha256: string; outputPath: string;
  originalReceipt: OriginalOfficialReplayReceipt;
}>;
const players = ['away-1', 'home-1', 'home-2', 'home-3', 'home-4', 'home-5', 'home-6', 'home-7', 'home-8', 'p2'];
const receiptFields = ['evidenceKind', 'receiptId', 'binding', 'actorKind', 'closureSourceId',
  'closureApplicationId', 'closureProposalHash', 'playedPlayId', 'durableRevision'].sort();
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const receiptId = (gameId: string, playerId: string) =>
  `official-participation:${createHash('sha256').update(JSON.stringify([gameId, playerId])).digest('hex')}`;
const noOwnHandles = (path: string) => {
  const handles = readdirSync('/proc/self/fd').flatMap(fd => {
    try {
      const target = readlinkSync(`/proc/self/fd/${fd}`);
      return [path, `${path}-wal`, `${path}-shm`].includes(target) ? [{ fd, target }] : [];
    } catch { return []; }
  });
  assert.deepEqual(handles, [], 'artifact still has a test-process handle');
};
const closedFile = (path: string, expectedHash?: string) => {
  assert(isAbsolute(path) && normalize(path) === path && realpathSync(path) === path && lstatSync(path).isFile(),
    'artifact requires a canonical real file');
  // Match the existing official replay helper: a closed read-only WAL may leave
  // empty WAL/shared-memory files. No uncheckpointed WAL bytes may survive.
  for (const sidecar of [`${path}-wal`, `${path}-shm`]) {
    if (existsSync(sidecar)) assert(lstatSync(sidecar).isFile() && realpathSync(sidecar) === sidecar, 'artifact sidecar is not a real file');
  }
  assert(!existsSync(`${path}-wal`) || lstatSync(`${path}-wal`).size === 0, 'artifact has uncheckpointed WAL bytes');
  noOwnHandles(path);
  const digest = fileHash(path);
  if (expectedHash !== undefined) assert.equal(digest, expectedHash, 'closed artifact hash differs');
  return digest;
};

/** Coordinator admission, producer/source lineage and exclusive execution are external prerequisites. */
export const readInitialParticipationArtifactInput = (manifestPath: string | undefined): InitialParticipationArtifactInput => {
  assert(manifestPath, 'ACTUAL_LIVE_PARTICIPATION_INITIAL_INPUT is required; no fixture fallback');
  const value = JSON.parse(readFileSync(manifestPath, 'utf8')) as InitialParticipationArtifactInput;
  assert(value && typeof value === 'object' && !Array.isArray(value), 'initial artifact manifest must be an object');
  assert.deepEqual(Object.keys(value).sort(), ['artifactPath', 'artifactSha256', 'originalReceipt', 'outputPath']);
  assert.equal(typeof value.artifactPath, 'string'); assert.equal(typeof value.outputPath, 'string');
  assert.match(value.artifactSha256, /^[a-f0-9]{64}$/);
  assert(value.originalReceipt && typeof value.originalReceipt === 'object', 'genuine original official receipt is required');
  assert(value.originalReceipt.output && value.originalReceipt.adjudicationEvidence, 'official receipt output and adjudication references are required');
  assert.equal(value.originalReceipt.output.path, value.artifactPath);
  assert.equal(value.originalReceipt.output.sha256, value.artifactSha256);
  assert.equal(value.originalReceipt.output.realDisk, true);
  assert.equal(value.originalReceipt.output.mainFilename, value.artifactPath);
  assert.equal(value.originalReceipt.output.journalMode, 'wal');
  assert.equal(value.originalReceipt.output.wrapperReadOnlyOpenClosedVerified, true);
  assert.equal(typeof value.originalReceipt.closureSourceId, 'string'); assert(value.originalReceipt.closureSourceId.length);
  assert.equal(typeof value.originalReceipt.applicationId, 'string'); assert(value.originalReceipt.applicationId.length);
  assert(isAbsolute(value.outputPath) && normalize(value.outputPath) === value.outputPath
    && realpathSync(dirname(value.outputPath)) === dirname(value.outputPath), 'private output parent must be canonical');
  assert.notEqual(value.outputPath, value.artifactPath);
  for (const path of [value.outputPath, `${value.outputPath}-wal`, `${value.outputPath}-shm`]) {
    assert(!existsSync(path), 'private output already exists');
  }
  return value;
};

const snapshot = (db: Db) => {
  const schema = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    .map(row => String(row.name));
  assert(tables.includes('official_participation_receipts') && tables.includes('official_participant_bindings'));
  const rows = tables.map(table => ({ table, rows: db.prepare(`SELECT rowid AS __participation_gate_rowid__, * FROM ${quote(table)} ORDER BY rowid`).all() }));
  return { schema, userVersion: db.prepare('PRAGMA user_version').get()!.user_version,
    participation: rows.filter(row => row.table === 'official_participation_receipts'),
    nonParticipation: rows.filter(row => row.table !== 'official_participation_receipts') };
};
type Snapshot = ReturnType<typeof snapshot>;
const readCopy = <T>(path: string, body: (db: Db) => T): T => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return withSqliteReadTransaction(db, () => {
      assert.equal(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file, path);
      assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
      const value = body(db);
      assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0, 'read-only observation wrote changes');
      return value;
    });
  } finally { db.close(); }
};
const conserved = (before: Snapshot, after: Snapshot) => {
  assert.deepEqual(after.schema, before.schema, 'schema/index definitions changed');
  assert.deepEqual(after.userVersion, before.userVersion, 'user_version changed');
  assert.deepEqual(after.nonParticipation, before.nonParticipation, 'non-participation rows changed');
};
const expectedReceipt = (p: ActualLivePlayClosureProposal, playerId: 'away-1' | 'p2'): ActualLiveParticipationReceipt => {
  const actor = p.actors.find(value => value.binding.playerId === playerId); assert(actor);
  return { evidenceKind: 'ACTUAL_LIVE_V1', receiptId: receiptId(p.gameId, playerId), binding: actor.binding,
    actorKind: playerId === 'away-1' ? 'BATTER_RUNNER' : 'DEFENDER', closureSourceId: p.source.sourceId,
    closureApplicationId: p.application.applicationId, closureProposalHash: actorHash(p), playedPlayId: p.playId,
    durableRevision: p.expectedOfficial.receipt.durableRevision };
};
const expectedCareer = (receipt: ActualLiveParticipationReceipt) => ({
  eventId: receipt.receiptId, careerId: receipt.binding.careerId, personId: receipt.binding.personId,
  kind: 'OFFICIAL_GAME', sourceRecordId: receipt.receiptId, acceptedRevision: receipt.durableRevision,
  occurredAtDay: receipt.binding.gameDay, acceptedAtDay: receipt.binding.gameDay, transfer: null,
});

/** New reconstructed initial gate only. Expected data never becomes an injected authority. */
export const verifyInitialParticipationArtifact = (input: InitialParticipationArtifactInput) => {
  closedFile(input.artifactPath, input.artifactSha256);
  copyFileSync(input.artifactPath, input.outputPath, constants.COPYFILE_EXCL);
  closedFile(input.outputPath, input.artifactSha256);
  const operations: string[] = [];
  try {
    const original = readCopy(input.outputPath, db => {
      const before = snapshot(db);
      assert.equal(before.participation[0].rows.length, 0, 'initial fixture must have no accepted participation rows');
      const counts = Object.fromEntries([...before.participation, ...before.nonParticipation]
        .filter(row => !row.table.startsWith('sqlite_')).map(row => [row.table, row.rows.length]));
      assert.deepEqual(counts, input.originalReceipt.output.rowCounts, 'original artifact table census differs');
      const closure = actualLivePlayClosureEvidenceFromSqlite(db).read(input.originalReceipt.closureSourceId);
      assert(closure); assert.equal(closure.status, 'OFFICIAL_APPLIED'); assert.equal(closure.officialApplied, true); assert(closure.result);
      const p = closure.proposal;
      assertActualLiveClosureStage(db, p, true, true);
      assert.equal(p.gameId, 'game-1'); assert.equal(p.source.sourceId, input.originalReceipt.closureSourceId);
      assert.equal(p.application.applicationId, input.originalReceipt.applicationId);
      assert.equal(p.playId, 7); assert.equal(p.originalActivation, null);
      assert.equal(p.application.expectedDurableRevision, 0); assert.equal(p.expectedOfficial.receipt.durableRevision, 1);
      assert(!('result' in p.expectedOfficial), 'initial gate requires a continuing original play');
      assert.deepEqual(closure.result.official.receipt, input.originalReceipt.officialReceipt);
      assert.deepEqual(closure.result.scoring, input.originalReceipt.scoring);
      assert.deepEqual(closure.result.workload, input.originalReceipt.workload);
      assert.equal(closure.result.controllerReset.retired.length, input.originalReceipt.retiredControllerCount);
      assert.deepEqual(p.physicalEndReference, input.originalReceipt.adjudicationEvidence.physicalEndReference);
      assert.deepEqual(p.wholeHistoryReference, input.originalReceipt.adjudicationEvidence.wholeHistoryReference);
      assert.deepEqual(p.actors.map(actor => actor.binding.playerId).sort(), players);
      assert.equal(new Set(p.actors.map(actor => actor.person.personId)).size, 10);
      assert.equal(p.actors[0].binding.playerId, 'away-1');
      assert.deepEqual(p.workload.participants.filter(actor => actor.role === 'BATTER_RUNNER').map(actor => actor.playerId), ['away-1']);
      assert.deepEqual(p.workload.participants.filter(actor => actor.role === 'DEFENDER').map(actor => actor.playerId).sort(), players.slice(1));
      for (const actor of p.actors) {
        assert(!Object.hasOwn(actor.binding, 'nationalRegistrationEventId') && !Object.hasOwn(actor.binding, 'nationalRosterSnapshotId'));
        assert.equal(actor.binding.personId, actor.person.personId);
      }
      assert.deepEqual(snapshot(db), before, 'original proof changed its input');
      operations.push('P0-ORIGINAL-PROOF');
      return { before, expected: [expectedReceipt(p, 'away-1'), expectedReceipt(p, 'p2')] };
    });
    closedFile(input.outputPath, input.artifactSha256);
    let owner = new SqliteOfficialParticipationStore(input.outputPath);
    try {
      for (const expected of original.expected) {
        const actual = owner.confirmActualLivePlayed('game-1', expected.binding.playerId, input.originalReceipt.closureSourceId);
        assert.deepEqual(actual, expected); assert.deepEqual(Object.keys(actual).sort(), receiptFields);
        operations.push(expected.actorKind === 'BATTER_RUNNER' ? 'G0-B-WRITE' : 'G0-D-WRITE');
      }
    } finally { owner.close(); }
    closedFile(input.outputPath);
    const written = readCopy(input.outputPath, db => {
      const after = snapshot(db); conserved(original.before, after);
      const rows = db.prepare('SELECT receipt_id,game_id,player_id,receipt_json FROM official_participation_receipts ORDER BY player_id').all();
      assert.deepEqual(rows.map(row => ({ ...row })), original.expected.map(receipt => ({ receipt_id: receipt.receiptId,
        game_id: receipt.binding.gameId, player_id: receipt.binding.playerId, receipt_json: actorJson(receipt) })));
      return after;
    });
    owner = new SqliteOfficialParticipationStore(input.outputPath);
    try {
      for (const expected of original.expected) {
        const prefix = expected.actorKind === 'BATTER_RUNNER' ? 'G0-B' : 'G0-D';
        assert.deepEqual(owner.readReceipt(expected.receiptId), expected); operations.push(`${prefix}-READ`);
        assert.deepEqual(owner.readAcceptedPopularityEvent(expected.receiptId), expectedCareer(expected)); operations.push(`${prefix}-CAREER`);
        assert.deepEqual(owner.confirmActualLivePlayed('game-1', expected.binding.playerId, input.originalReceipt.closureSourceId), expected);
        operations.push(`${prefix}-RETRY`);
        assert.deepEqual(readCopy(input.outputPath, snapshot), written, 'reopened read/Career/retry changed rows');
      }
      const reserveId = receiptId('game-1', 'away-2');
      assert.equal(owner.readReceipt(reserveId), null); operations.push('G0-RESERVE-READ');
      assert.equal(owner.readAcceptedPopularityEvent(reserveId), null); operations.push('G0-RESERVE-CAREER');
    } finally { owner.close(); }
    assert.deepEqual(readCopy(input.outputPath, snapshot), written, 'final conservation differs');
    const outputSha256 = closedFile(input.outputPath);
    assert.deepEqual(operations, ['P0-ORIGINAL-PROOF', 'G0-B-WRITE', 'G0-D-WRITE',
      'G0-B-READ', 'G0-B-CAREER', 'G0-B-RETRY', 'G0-D-READ', 'G0-D-CAREER', 'G0-D-RETRY',
      'G0-RESERVE-READ', 'G0-RESERVE-CAREER']);
    return { kind: 'RECONSTRUCTED_INITIAL_PARTICIPATION_GATE', inputSha256: input.artifactSha256,
      outputPath: input.outputPath, outputSha256, operations, expectedFullOriginalDerivationsFromSource: 11,
      receipts: original.expected, careerEvents: original.expected.map(expectedCareer),
      preserved: { schema: true, userVersion: true, allNonParticipationRows: true, retryBytes: true },
      qualification: 'INITIAL_BATTER_DEFENDER_ONLY' };
  } finally {
    closedFile(input.artifactPath, input.artifactSha256);
    noOwnHandles(input.outputPath);
  }
};
