import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';
import * as terminalEvidence from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareRetainedTerminalAcknowledgementCopy } from './ActualFoulTerminalAcknowledgementRetained.test-support';
import { prepareTerminalWorkloadReadyCopy } from './ActualFoulTerminalRoleWorkloadCheckpoint.test-support';
import { cleanupTerminalWorkload } from './ActualFoulTerminalRoleWorkloadFixture.test-support';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

it('AN-G01 genuine retained applied owner reports its actual stage without inventing acknowledgement', () => {
  const f = prepareRetainedTerminalAcknowledgementCopy('applied');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(f.path);
  try {
    const before = rawCensus(db), schema = schemaCensus(db), changes = db.prepare('SELECT total_changes() AS n').get();
    const saved = withSqliteReadTransaction(db, () => terminalEvidence.foulTerminalApplicationEvidenceFromSqlite(db).read(f.sourceId));
    expect(saved?.status).toBe('OFFICIAL_APPLIED_PENDING_POST_PLAY');
    const ancestry = withSqliteReadTransaction(db, () => terminalEvidence.foulTerminalAcknowledgementAncestryFromSqlite(db).read(f.sourceId));
    expect(ancestry).toEqual({ archiveStage: 'OFFICIAL_APPLIED_PENDING_POST_PLAY', evidence: null });
    expect(Object.isFrozen(ancestry)).toBe(true);
    expect(rawCensus(db)).toEqual(before); expect(schemaCensus(db)).toEqual(schema);
    expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } finally { db.close(); }
}, 600_000);

it('AN-G02 genuine acknowledged ancestry and ready workload retries preserve original bytes without public-reader recursion', async () => {
  // This reviewed helper copies and authenticates a qualified pre-charge private
  // checkpoint, reads settlement and retries all ten archived assessments with
  // zero writes. It never regenerates a physical root or charges an activity.
  const f = await prepareTerminalWorkloadReadyCopy();
  try {
    const before = rawCensus(f.db), schema = schemaCensus(f.db), changes = f.db.prepare('SELECT total_changes() AS n').get();
    const publicReader = vi.spyOn(terminalEvidence, 'foulTerminalApplicationEvidenceFromSqlite').mockImplementation(() => {
      throw new Error('PUBLIC_TERMINAL_READER_REENTRY');
    });
    try {
      const ancestry = withSqliteReadTransaction(f.db, () => terminalEvidence.foulTerminalAcknowledgementAncestryFromSqlite(f.db).read(f.sourceId));
      expect(ancestry?.archiveStage).toBe('OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY');
      expect(ancestry?.evidence).not.toBeNull();
      const { status, ...originalEvidence } = f.saved;
      expect(ancestry).toEqual({ archiveStage: status, evidence: originalEvidence });
      expect(Object.isFrozen(ancestry)).toBe(true); expect(Object.isFrozen(ancestry!.evidence)).toBe(true);
      expect(Object.isFrozen(ancestry!.evidence!.result.acknowledgement)).toBe(true);
      expect(Object.hasOwn(ancestry!.evidence!, 'status')).toBe(false);
      expect(json(ancestry!.evidence!.result)).toBe(json(f.saved.result));
      expect(publicReader).not.toHaveBeenCalled();
    } finally { publicReader.mockRestore(); }
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
    expect(f.db.prepare('SELECT total_changes() AS n').get()).toEqual(changes);
    // A damaged original acknowledgement remains a rejection. The corruption
    // exists only in this owned rollback transaction, never in the checkpoint.
    f.db.exec('BEGIN IMMEDIATE');
    try {
      const corrupted = JSON.parse(json(f.saved.result)); corrupted.acknowledgement.applicationReference.receiptHash = '0'.repeat(64);
      f.db.prepare('UPDATE actual_foul_terminal_applications SET result_json=? WHERE source_id=?').run(json(corrupted), f.sourceId);
      expect(() => terminalEvidence.foulTerminalAcknowledgementAncestryFromSqlite(f.db).read(f.sourceId))
        .toThrow('foul terminal acknowledged archive encoding, hashes or cached scope differ');
    } finally { f.db.exec('ROLLBACK'); }
    expect(rawCensus(f.db)).toEqual(before); expect(schemaCensus(f.db)).toEqual(schema);
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } finally { cleanupTerminalWorkload(f); }
}, 600_000);
