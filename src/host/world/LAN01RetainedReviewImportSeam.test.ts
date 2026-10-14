import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT as cp16, LAN01_RETAINED_REVIEW_IMPORT_CHECKPOINT as pin,
  prepareLAN01RetainedReviewImportCheckpoint } from './LAN01RetainedCheckpoint.test-support';
import { assertRetainedNativeLiveAppealImportRow, readRetainedNativeLiveAppealImport,
  readRetainedNativeLiveAppealSession } from './SamePlateAppearanceLiveAppealJournalNative.test-support';
import type { AcceptedActualPostPlayReviewSession } from './ActualPostPlayReviewSource';
import type { ActualPostPlayReviewProjection } from './ActualPostPlayReview';

it('pins only returned R15 cp1 with one original import and rights still absent', () => {
  expect([pin.checkpointSequence, pin.returnedOwnerCall, pin.databaseBytes, pin.gzipBytes, pin.tableCount, pin.rowCount])
    .toEqual([1, 1, 22654976, 1402518, 121, 1985]);
  expect(pin.databaseSha256).toBe('60b73b1f5f5289cb9c86f128f129bde0d5ea7d8bda4be9805566589198082ee3');
  expect(pin.gzipSha256).toBe('18605d0643eb51e69c9e290fef93c436a77275c16b172d059ce869dcd83fcd50');
  expect(pin.receiptSha256).toBe('5257c2cb171ee560acb704f82062d7962c9641459d150c204c824ffe150c5a79');
  expect(pin.contentAuditSha256).toBe('0c8cd920ee5ffef85605036d7ffe8ccc6f2ee915a2e20612116be1ea9f0bc666');
  expect(pin.priorRunTerminalSha256).toBeNull();
  expect(pin.priorRunOutcome).toBe('RUNNING_AFTER_RETURNED_IMPORT_AT_CHECKPOINT_AUDIT');
  expect(pin.priorCp16).toBe(cp16); expect(pin.sealedBoundary).toBe(cp16.sealedBoundary);
  expect(pin.firstRemainingWriter).toEqual({ owner: 'ActualPostPlayReview', method: 'acceptEvent', sourceId: 'lan01:journal:rights',
    argumentsHash: '7b560b75d07d5dca48a26e9ae8601f96bab08eed85f983cae811125d876d3538' });
  expect(pin.reviewImport.revision).toBe(1); expect(pin.reviewImport.headSourceId).toBe('lan01:journal:import');
  expect(hash(pin.reviewImport.importSource)).toBe('026ca7c48d4fba278e1bfb4518dd20bbe7e4f4e609c78d12b99101f4d2d47082');
  expect(pin.reviewImport.importSource.parent).toEqual({ sourceId: cp16.reviewSession.headSourceId, snapshotHash: cp16.reviewSession.headHash });
  expect(pin.reviewImport.importSource.action.executionReference).toEqual(cp16.sealedBoundary.appealedReference);
  expect(pin.reviewImport.projectionSnapshotHash).toBe('e9f260dd6d7688dac9483142855a9af0747c452a40d11d470b3d039fa3751d18');
  expect(pin.reviewImport.admissionSnapshotHash).toBe('f3e9c0b84480787854d8c82b2483ea4a3bba0668cc52ef46a16cdb3bb34dd935');
});

it('rejects unreleased or substituted cp1 before creating a destination', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lan01-cp1-rejection-'));
  const checkpointGzip = join(directory, 'checkpoint.sqlite.gz'), destinationDirectory = join(directory, 'suffix');
  writeFileSync(checkpointGzip, 'different retained database');
  try {
    expect(() => prepareLAN01RetainedReviewImportCheckpoint({ nativeReleased: false, checkpointGzip, destinationDirectory }))
      .toThrow('reviewed and released');
    expect(() => prepareLAN01RetainedReviewImportCheckpoint({ nativeReleased: true, checkpointGzip, destinationDirectory }))
      .toThrow('input hash differs');
    expect(existsSync(destinationDirectory)).toBe(false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

// Synthetic owner-return projections and rows check only seam selection and
// rejection. Genuine readCurrent must independently authenticate the archive.
const retainedImport = () => {
  const source: AcceptedActualPostPlayReviewSession = { sourceId: 'lan01:journal:session', sourceVersion: 'fixture-only-v1',
    capability: 'actual_post_play_review_session_v1', adjudicationSourceId: 'lan01:journal:seed', adjudicationSnapshotHash: hash('seed'),
    officialPolicy: null, policy: null };
  const importSource = pin.reviewImport.importSource;
  const value = { source, revision: 1, headSourceId: importSource.sourceId, headHash: hash('head'), kind: 'official_pending',
    events: [{ source: importSource, intent: null, liveAppealImport: { rights: { kind: 'pending' } } }],
    ledger: { revision: 4 }, pendingReasons: ['original_live_ball_and_appeal_rights_required'],
    seed: { snapshotHash: hash('seed') } } as unknown as ActualPostPlayReviewProjection;
  const admission = { kind: 'live_appeal_import', sourceId: importSource.sourceId };
  const retained = { ...pin.reviewImport, sourceHash: hash(source), headHash: value.headHash,
    projectionSnapshotHash: hash(value), seedSnapshotHash: value.seed.snapshotHash, admissionSnapshotHash: hash(admission) };
  const row = { source_id: importSource.sourceId, session_source_id: source.sourceId, revision: 1,
    parent_source_id: importSource.parent.sourceId, parent_snapshot_hash: importSource.parent.snapshotHash,
    source_json: json(importSource), source_hash: hash(importSource), intent_json: null,
    admission_json: json(admission), snapshot_json: json(value), snapshot_hash: hash(value) };
  const owner = { readCurrent: vi.fn((): ActualPostPlayReviewProjection | null => value), acceptSession: vi.fn(), acceptEvent: vi.fn() };
  return { source, value, retained, row, owner };
};

it('adopts exactly one independently read import without replaying either completed writer', () => {
  const f = retainedImport(), before = JSON.stringify(f);
  assertRetainedNativeLiveAppealImportRow(f.row, f.retained);
  expect(readRetainedNativeLiveAppealImport(f.owner, f.source, f.retained)).toBe(f.value);
  expect(f.owner.readCurrent.mock.calls).toEqual([[f.source.sourceId]]);
  expect(f.owner.acceptSession).not.toHaveBeenCalled(); expect(f.owner.acceptEvent).not.toHaveBeenCalled();
  expect(JSON.stringify(f)).toBe(before);
});

it('rejects substituted session or import Sources, absent or later heads, duplicate imports and changed projections', () => {
  for (const change of [
    (f: ReturnType<typeof retainedImport>) => { f.source = { ...f.source, sourceVersion: 'changed' }; },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue(null); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, revision: 0 }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, revision: 2 }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, headSourceId: 'other' }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, headHash: hash('changed') }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, events: [] }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, events: [...f.value.events, f.value.events[0]] }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, events: [{ ...f.value.events[0], source: { ...f.retained.importSource, sourceVersion: 'changed' } }] }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, seed: { ...f.value.seed, snapshotHash: hash('changed') } }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, pendingReasons: [] }); },
    (f: ReturnType<typeof retainedImport>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, ledger: { ...f.value.ledger, revision: 5 } }); },
  ]) {
    const f = retainedImport(); change(f);
    expect(() => readRetainedNativeLiveAppealImport(f.owner, f.source, f.retained)).toThrow();
    expect(f.owner.acceptSession).not.toHaveBeenCalled(); expect(f.owner.acceptEvent).not.toHaveBeenCalled();
  }
  const f = retainedImport();
  expect(() => readRetainedNativeLiveAppealSession(f.owner, f.source, { ...cp16.reviewSession, sourceHash: hash(f.source) }))
    .toThrow('LAN01 retained journal revision differs');
  expect(f.owner.acceptSession).not.toHaveBeenCalled(); expect(f.owner.acceptEvent).not.toHaveBeenCalled();
});

it('pins every import row identity, parent, Source, admission and projection byte field', () => {
  const f = retainedImport();
  for (const [key, value] of Object.entries(f.row)) {
    expect(() => assertRetainedNativeLiveAppealImportRow({ ...f.row, [key]: typeof value === 'number' ? value + 1 : 'changed' }, f.retained)).toThrow();
  }
  expect(() => assertRetainedNativeLiveAppealImportRow({ ...f.row, admission_json: json({ kind: 'different' }) }, f.retained)).toThrow();
  expect(() => assertRetainedNativeLiveAppealImportRow({ ...f.row, snapshot_json: json({ ...f.value, pendingReasons: [] }) }, f.retained)).toThrow();
});

it('loads only the exact cp1 entry and rejoins the original post-import assertions before rights', async () => {
  const entry = await import('./LAN01RetainedOriginalSuffix.test-support');
  expect(typeof entry.runLAN01RetainedReviewImportSuffix).toBe('function');
  const source = readFileSync(new URL('./LAN01RetainedOriginalSuffix.test-support.ts', import.meta.url), 'utf8');
  expect(source).toContain('prepareLAN01RetainedReviewImportCheckpoint(input)');
  expect(source).toContain('assertRetainedNativeLiveAppealImportRow');
  expect(source).toContain('remainingOwnerCallCount: 21, terminalOwnerCallCount: 17');
  expect(source).toContain('priorRunCleanupVerified: !reviewImport');
  const journal = readFileSync(new URL('./SamePlateAppearanceLiveAppealJournalNative.test-support.ts', import.meta.url), 'utf8');
  expect(journal).toContain("if (retainedSession?.revision !== 1) append('import', { kind: 'import_live_appeal', executionReference });");
  const tail = journal.slice(journal.indexOf('  const imported = value;'));
  expect(createHash('sha256').update(tail).digest('hex')).toBe('3c2770cfcf3705c8589e1c1cbaf9891a5423fb8254dfd354977849b6ae3785fb');
}, 30_000);
