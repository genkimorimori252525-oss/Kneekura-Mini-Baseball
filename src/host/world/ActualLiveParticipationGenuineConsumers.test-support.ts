import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { constants, copyFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync,
  readlinkSync, realpathSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import type { verifyInitialParticipationArtifact } from './ActualLiveParticipationInitialArtifact.test-support';
import { SqliteOfficialParticipationStore } from './SqliteOfficialParticipationStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { healthRehabDiagnosis, healthRehabStoreFixture } from './HealthRehabFixtures.test-support';
import { captureClinicalGameRows } from './HealthRehabEvidenceFromSqlite';
import { openSqlitePlayerHealthRehabStore } from './SqlitePlayerHealthRehabStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
type Db = InstanceType<typeof DatabaseSync>;
type InitialResult = ReturnType<typeof verifyInitialParticipationArtifact>;
type Pin = Readonly<{ path: string; sha256: string }>;
type ConsumerInput = Readonly<{
  schema: 'genuine_participation_consumers_v1'; artifact: Pin; initialResult: Pin;
  initialTerminal: Pin; initialVitest: Pin; initialOutputLog: Pin;
}>;
type InitialTerminal = Readonly<{
  schema: string; stage: string; status: string; failures: unknown[]; cancelSignals: unknown[];
  originalChildExit: number; remainingOwnedProcesses: unknown[];
  before: Record<string, unknown>; after: Record<string, unknown>;
  tests: { passedCases: number; expectedFailedCases: number; skipped: unknown[]; credit: number; reportSha256: string };
}>;
const initialCase = 'accepts genuine initial batter and defender participation with reopened Career reads and exact retries';
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const pinBytes = (pin: Pin) => {
  assert(pin && typeof pin === 'object');
  assert.deepEqual(Object.keys(pin).sort(), ['path', 'sha256']);
  assert(isAbsolute(pin.path) && normalize(pin.path) === pin.path && realpathSync(pin.path) === pin.path);
  assert(lstatSync(pin.path).isFile()); assert.match(pin.sha256, /^[a-f0-9]{64}$/);
  const bytes = readFileSync(pin.path); assert.equal(sha(bytes), pin.sha256, 'input pin differs'); return bytes;
};
const noOwnHandles = (path: string) => {
  const handles = readdirSync('/proc/self/fd').flatMap(fd => {
    try {
      const target = readlinkSync(`/proc/self/fd/${fd}`);
      return [path, `${path}-wal`, `${path}-shm`].includes(target) ? [{ fd, target }] : [];
    } catch { return []; }
  });
  assert.deepEqual(handles, [], 'consumer gate retains an artifact handle');
};
const closedFile = (pin: Pin) => {
  for (const sidecar of [`${pin.path}-wal`, `${pin.path}-shm`]) {
    if (existsSync(sidecar)) assert(lstatSync(sidecar).isFile() && realpathSync(sidecar) === sidecar);
  }
  assert(!existsSync(`${pin.path}-wal`) || lstatSync(`${pin.path}-wal`).size === 0, 'uncheckpointed artifact WAL');
  noOwnHandles(pin.path); pinBytes(pin);
};
const snapshot = (db: Db) => {
  const schema = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row => String(row.name));
  return { schema, userVersion: db.prepare('PRAGMA user_version').get()!.user_version,
    rows: tables.map(table => ({ table, rows: db.prepare(`SELECT rowid AS __consumer_gate_rowid__, * FROM ${quote(table)} ORDER BY rowid`).all() })) };
};
const readCopy = <T>(path: string, body: (db: Db) => T): T => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return withSqliteReadTransaction(db, () => {
      assert.equal(db.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file, path);
      assert.equal(db.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
      const value = body(db);
      assert.equal(db.prepare('SELECT total_changes() AS n').get()!.n, 0);
      return value;
    });
  } finally { db.close(); }
};

/** The existing supervisor supplies this single pinned manifest channel. No producer or authority fallback. */
const qualifiedInput = () => {
  const path = process.env.ACTUAL_LIVE_PARTICIPATION_INITIAL_INPUT;
  assert(path, 'explicit genuine consumer manifest is required');
  const input = JSON.parse(readFileSync(path, 'utf8')) as ConsumerInput;
  assert(input && typeof input === 'object' && !Array.isArray(input));
  assert.deepEqual(Object.keys(input).sort(), ['artifact', 'initialOutputLog', 'initialResult', 'initialTerminal', 'initialVitest', 'schema']);
  assert.equal(input.schema, 'genuine_participation_consumers_v1');
  const initial = JSON.parse(pinBytes(input.initialResult).toString('utf8')) as InitialResult;
  const terminal = JSON.parse(pinBytes(input.initialTerminal).toString('utf8')) as InitialTerminal;
  assert.equal(terminal.schema, 'baseball_fresh_terminal_v1');
  assert.equal(terminal.stage, 'participation-initial-two-role-acceptance');
  assert.equal(terminal.status, 'passed'); assert.equal(terminal.originalChildExit, 0);
  assert.deepEqual(terminal.failures, []); assert.deepEqual(terminal.cancelSignals, []);
  assert.deepEqual(terminal.remainingOwnedProcesses, []); assert.deepEqual(terminal.after, terminal.before);
  assert.equal(terminal.tests.passedCases, 1); assert.equal(terminal.tests.expectedFailedCases, 0);
  assert.equal(terminal.tests.credit, 1); assert.deepEqual(terminal.tests.skipped, []);
  assert.equal(terminal.tests.reportSha256, input.initialVitest.sha256);
  const vitest = JSON.parse(pinBytes(input.initialVitest).toString('utf8'));
  assert.equal(vitest.success, true); assert.equal(vitest.numTotalTests, 1); assert.equal(vitest.numPassedTests, 1);
  assert.equal(vitest.numFailedTests, 0); assert.equal(vitest.numPendingTests, 0); assert.equal(vitest.numTodoTests, 0);
  assert.equal(vitest.testResults.length, 1);
  assert.equal(vitest.testResults[0].assertionResults.length, 1);
  assert.equal(vitest.testResults[0].assertionResults[0].fullName, initialCase);
  assert.equal(vitest.testResults[0].assertionResults[0].status, 'passed');
  const logged = pinBytes(input.initialOutputLog).toString('utf8').split('\n').flatMap(line => {
    try { const value = JSON.parse(line); return value?.kind === 'RECONSTRUCTED_INITIAL_PARTICIPATION_GATE' ? [value] : []; }
    catch { return []; }
  });
  assert.deepEqual(logged, [initial], 'initial report does not match its successful runtime output');
  assert.equal(initial.kind, 'RECONSTRUCTED_INITIAL_PARTICIPATION_GATE');
  assert.equal(initial.qualification, 'INITIAL_BATTER_DEFENDER_ONLY');
  assert.equal(initial.outputPath, input.artifact.path); assert.equal(initial.outputSha256, input.artifact.sha256);
  assert.deepEqual(initial.operations, ['P0-ORIGINAL-PROOF', 'G0-B-WRITE', 'G0-D-WRITE',
    'G0-B-READ', 'G0-B-CAREER', 'G0-B-RETRY', 'G0-D-READ', 'G0-D-CAREER', 'G0-D-RETRY',
    'G0-RESERVE-READ', 'G0-RESERVE-CAREER']);
  assert.deepEqual(initial.preserved, { schema: true, userVersion: true, allNonParticipationRows: true, retryBytes: true });
  assert.equal(initial.receipts.length, 2);
  assert.deepEqual(initial.receipts.map(receipt => [receipt.binding.playerId, receipt.actorKind]), [['away-1', 'BATTER_RUNNER'], ['p2', 'DEFENDER']]);
  const receipt = initial.receipts[1];
  assert.equal(receipt.evidenceKind, 'ACTUAL_LIVE_V1'); assert.equal(receipt.binding.gameId, 'game-1');
  closedFile(input.artifact);
  return { input, initial, receipt };
};

/** IDs and expectations come from the qualified report, never a replacement participation reader. */
const withGenuineCopy = <T extends object>(body: (context: ReturnType<typeof qualifiedInput> & { path: string }) => T) => {
  const qualified = qualifiedInput();
  const path = join(mkdtempSync(join(tmpdir(), 'genuine-consumer-')), 'participation.sqlite');
  const copy = { path, sha256: qualified.input.artifact.sha256 };
  copyFileSync(qualified.input.artifact.path, path, constants.COPYFILE_EXCL); closedFile(copy);
  try {
    const before = readCopy(path, db => {
      const rows = db.prepare('SELECT receipt_id,game_id,player_id,receipt_json FROM official_participation_receipts ORDER BY player_id').all();
      assert.deepEqual(rows.map(row => [row.receipt_id, row.game_id, row.player_id, JSON.parse(String(row.receipt_json))]),
        qualified.initial.receipts.map(receipt => [receipt.receiptId, receipt.binding.gameId, receipt.binding.playerId, receipt]));
      return snapshot(db);
    });
    const result = body({ ...qualified, path });
    assert.deepEqual(readCopy(path, snapshot), before, 'genuine participation schema, rows, receipt bytes or user_version changed');
    closedFile(copy);
    return { ...result, artifactSha256: copy.sha256,
      preserved: { completeV2RowsAndReceiptBytes: true, schemaAndIndexes: true, userVersion: true, closedFileHash: true },
      artifactHandlesClosed: true };
  } finally { noOwnHandles(path); closedFile(qualified.input.artifact); }
};

/** Removing National's public discriminator guard must change the exact error and fail this leaf. */
export const verifyGenuineNationalRejection = () => withGenuineCopy(({ path, receipt }) => {
  const f = nationalCallupFixture();
  const participation = new SqliteOfficialParticipationStore(path);
  const callups = openSqliteNationalCallupStore(f.path, { ...f.sources, participation });
  const observer = new DatabaseSync(f.path);
  try {
    const before = withSqliteReadTransaction(observer, () => snapshot(observer));
    assert.throws(() => callups.adoptAppearance({ careerId: receipt.binding.careerId, eventId: 'genuine-v1-national-rejection',
      receiptId: receipt.receiptId, acceptedAtDay: receipt.binding.gameDay }),
    { message: 'national appearance does not support tagged participation receipts' });
    assert.deepEqual(withSqliteReadTransaction(observer, () => snapshot(observer)), before, 'National rejection changed consumer state');
    assert.deepEqual(observer.prepare('SELECT * FROM world_national_callups').all(), []);
    return { kind: 'GENUINE_PARTICIPATION_CONSUMER_GATE', caseId: 'C06-N', qualification: 'NATIONAL_TAG_REJECTION_ONLY',
      fullOriginalDerivationsFromSource: 1, consumerUnchanged: true };
  } finally { observer.close(); callups.close(); participation.close(); f.close(); }
});

/** Authentic tagged participation still cannot replace the consumer's original pregame roster evidence. */
export const verifyGenuineRawRehabRejection = () => withGenuineCopy(({ path, receipt }) => {
  const { f, health, prepareGame } = healthRehabStoreFixture();
  try {
    const prepared = prepareGame();
    assert.equal(health.readHead('career-a', 'p2')!.revision, 2);
    const before = withSqliteReadTransaction(f.db, () => snapshot(f.db));
    readCopy(path, db => {
      assert.throws(() => captureClinicalGameRows(db, healthRehabDiagnosis.diagnosis, receipt.receiptId, prepared.snapshot.snapshotId),
        { message: 'clinical played original evidence is missing' });
    });
    assert.deepEqual(withSqliteReadTransaction(f.db, () => snapshot(f.db)), before, 'raw guard changed the isolated clinical consumer');
    assert.equal(health.readEffect('game'), null);
    return { kind: 'GENUINE_PARTICIPATION_CONSUMER_GATE', caseId: 'C08-R', qualification: 'RAW_REHAB_ORIGINAL_ROSTER_REQUIRED',
      fullOriginalDerivationsFromSource: 1, consumerUnchanged: true };
  } finally { f.close(); }
});

/** Same receipt ID in another database does not replace the local consumer's original receipt proof. */
export const verifyGenuinePublicRehabRejection = () => withGenuineCopy(({ path, receipt }) => {
  const { f, health, sources, authority, prepareGame } = healthRehabStoreFixture(true, { gameId: receipt.binding.gameId });
  const participation = new SqliteOfficialParticipationStore(path);
  try {
    const prepared = prepareGame();
    assert.equal(prepared.receipt.receiptId, receipt.receiptId, 'consumer and V2 must request the same real receipt ID');
    assert.equal(prepared.receipt.binding.gameId, 'game-1'); assert(!('evidenceKind' in prepared.receipt));
    assert.equal(health.readHead('career-a', 'p2')!.revision, 2);
    const rawRows = withSqliteReadTransaction(f.db, () => captureClinicalGameRows(f.db, healthRehabDiagnosis.diagnosis,
      prepared.receipt.receiptId, prepared.snapshot.snapshotId));
    assert.equal(rawRows.length, 6, 'the isolated clinical fixture must have real raw legacy proof');
    const guarded = openSqlitePlayerHealthRehabStore(f.path, { ...sources, participation }, authority);
    try {
      const before = withSqliteReadTransaction(f.db, () => snapshot(f.db));
      assert.throws(() => guarded.apply('game', 2), { message: 'clinical peer participation differs from local original proof' });
      assert.deepEqual(withSqliteReadTransaction(f.db, () => snapshot(f.db)), before, 'public rejection changed clinical effects or heads');
      assert.equal(health.readEffect('game'), null); assert.equal(health.readHead('career-a', 'p2')!.revision, 2);
    } finally { guarded.close(); }
    // Keep actual legacy owners and their original source objects. No receipt/authority wrapper or ID rewrite.
    const legacy = openSqlitePlayerHealthRehabStore(f.path, sources, authority);
    const ready = (() => {
      try {
        const result = legacy.apply('game', 2);
        assert.equal(result.phase, 'READY'); assert.equal(result.revision, 3); assert.deepEqual(result.rehabGameIds, ['game-1']);
        assert.deepEqual(legacy.apply('game', 2), result); return result;
      } finally { legacy.close(); }
    })();
    const accepted = withSqliteReadTransaction(f.db, () => snapshot(f.db));
    const reopened = openSqlitePlayerHealthRehabStore(f.path, sources);
    try {
      assert.deepEqual(reopened.readHead('career-a', 'p2'), ready);
      assert.deepEqual(reopened.readEffect('game')!.after, ready);
      assert.deepEqual(reopened.apply('game', 2), ready);
    } finally { reopened.close(); }
    assert.deepEqual(withSqliteReadTransaction(f.db, () => snapshot(f.db)), accepted, 'legacy reopen/retry changed accepted bytes');
    return { kind: 'GENUINE_PARTICIPATION_CONSUMER_GATE', caseId: 'C07-P', qualification: 'PUBLIC_REHAB_LOCAL_PROOF_REQUIRED_AND_SEPARATE_LEGACY_CONTROL',
      fullOriginalDerivationsFromSource: 1, consumerUnchangedAtRejection: true,
      sameRequestedReceiptId: true, rawLegacyProofRows: rawRows.length, legacyApplyReopenRetry: true };
  } finally { participation.close(); f.close(); }
});
