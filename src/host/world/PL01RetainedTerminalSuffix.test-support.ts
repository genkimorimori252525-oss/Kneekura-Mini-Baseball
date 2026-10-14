import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { samePaOccupiedPitchBytes, finishSamePaOccupiedPitchReadback } from './SamePlateAppearanceOccupiedReadback.test-support';
import { preparePL01RetainedCheckpoint, type PL01RetainedSuffixInput } from './PL01RetainedCheckpoint.test-support';
import type { SamePaExecutedPitch } from './SamePlateAppearanceDispatchExecution';

/** Reopens only PL01-R3's exact cp11. The one authentic owner read is also the
 * original remaining readback assertion. No prefix, writer, retry, model or
 * completed fixture context is recreated, and no owner proof is substituted. */
export const runPL01RetainedTerminalSuffix = (input: PL01RetainedSuffixInput, log: (phase: string) => void = () => {}) => {
  const { path, pin, input: capturedInput, witnessRecheck } = preparePL01RetainedCheckpoint(input), stores: { close(): void }[] = [];
  const track = <T extends { close(): void }>(store: T): T => { stores.push(store); return store; };
  const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
  let phase = 'open-private-checkpoint', passed = false, historyUnchanged = false;
  const mark = (name: string) => { phase = name; log(name); };
  try {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const db = track(new DatabaseSync(path, { readOnly: true }));
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    // This is the accepted owner's persisted result, under an independently
    // audited archive AND snapshot pin. It is only the expected value, never a
    // replacement for readPhysicalPitch's production proof. Fresh acceptance
    // verifies the committed snapshot against its returned pitch before return.
    const row = db.prepare('SELECT source_json, source_hash, snapshot_json, snapshot_hash FROM pa_dispatch_v1_pitch_actions WHERE source_id=?').get(pin.pitchSourceId);
    assert(row, 'PL01 accepted occupied pitch snapshot missing');
    assert.equal(sha256(String(row.snapshot_json)), pin.pitchSnapshotSha256);
    assert.equal(row.snapshot_hash, pin.pitchSnapshotSha256);
    assert.equal(sha256(String(row.source_json)), pin.pitchSourceSha256);
    assert.equal(row.source_hash, pin.pitchSourceSha256);
    const pitch = JSON.parse(String(row.snapshot_json)) as SamePaExecutedPitch;
    assert.equal(json(pitch), row.snapshot_json);
    assert.equal(pitch.source.sourceId, pin.pitchSourceId);
    assert.equal(json(pitch.source), row.source_json);
    assert.equal(pitch.kind, 'same_pa_first_pitch_executed_v1');

    // Capture the exact original sixteen-table comparison before reopening.
    // The historical retry reported committedChange=false. Its serialization
    // digest is provenance only; deep equality remains the original assertion.
    const bytes = () => samePaOccupiedPitchBytes(db), saved = bytes();
    // Additional retained-evidence conservation, not credited as original
    // fixture assertions. Include the schema and every table, including all
    // earlier six-TAKE, terminal, activity, Person and official history rows.
    const history = () => json({
      schema: db.prepare('SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name').all(),
      tables: db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(({ name }) => ({
        name, rows: db.prepare('SELECT * FROM main."' + String(name).replaceAll('"', '""') + '" ORDER BY rowid').all(),
      })),
    });
    const originalHistory = history();
    mark('run-original-occupied-readback-and-row-comparison');
    const reopened = track(openSqliteSamePlateAppearanceDispatchStore(path));
    finishSamePaOccupiedPitchReadback(reopened, pitch, bytes, saved);
    mark('verify-retained-history-conservation');
    assert.equal(history(), originalHistory, 'PL01 retained history changed');
    historyUnchanged = true;
    passed = true;
  } finally {
    const closeErrors: unknown[] = [];
    for (const store of stores.reverse()) { try { store.close(); } catch (error) { closeErrors.push(error); } }
    const originalUnchanged = sha256(readFileSync(capturedInput.checkpointGzip)) === pin.gzipSha256;
    const result = { kind: 'pl01_cp11_readback_suffix_result_v1',
      retainedPrefix: { sourceCommit: pin.sourceCommit, sourceTree: pin.sourceTree, databaseSha256: pin.databaseSha256,
        boundary: 'accepted occupied pitch at cp11; original prefix and all occupied writers completed',
        previouslyCompletedAssertions: 'historical evidence only; not rerun or credited as this suffix',
        priorCp173ContractCommit: pin.priorCp173ContractCommit, priorCp173DatabaseSha256: pin.priorCp173DatabaseSha256,
        priorCp8ContractCommit: pin.priorCp8ContractCommit, priorCp8DatabaseSha256: pin.priorCp8DatabaseSha256,
        priorCp1SourceCommit: pin.priorCp1SourceCommit, priorCp1DatabaseSha256: pin.priorCp1DatabaseSha256 },
      historicalProvenance: { originalRunControlSha256: pin.runControlSha256, checkpointReceiptSha256: pin.receiptSha256,
        priorRunTerminalSha256: pin.priorRunTerminalSha256, priorRunJournalSha256: pin.priorRunJournalSha256,
        acceptedPitch: { call: 11, resultHash: pin.acceptedPitchResultHash, snapshotSha256: pin.pitchSnapshotSha256 },
        reopenedRetry: { call: 12, resultHash: pin.reopenedRetryResultHash, committedChange: false,
          attribution: 'historical owner return only; not repeated or credited as this suffix' },
        sourceIdentityBasis: 'previously_audited_checkpoint', privateWitnessFilesRechecked: witnessRecheck },
      continuedSuffix: passed && closeErrors.length === 0 && originalUnchanged ? 'PASS' : 'FAILED',
      originalAssertions: 'occupied readPhysicalPitch deep equality and sixteen-table row comparison only',
      retainedEvidence: { wholeHistoryUnchanged: historyUnchanged, originalCheckpointUnchanged: originalUnchanged },
      lastPhase: phase, allHandlesClosed: closeErrors.length === 0,
      wholeCasePass: false, databasePath: path };
    writeFileSync(join(capturedInput.destinationDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    if (closeErrors.length) throw new AggregateError(closeErrors, 'PL01 suffix owner cleanup failed');
    assert(originalUnchanged, 'PL01 original checkpoint changed');
  }
};
