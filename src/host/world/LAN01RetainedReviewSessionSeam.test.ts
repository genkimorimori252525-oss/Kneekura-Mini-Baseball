import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { LAN01_RETAINED_CHECKPOINT, LAN01_RETAINED_REVIEW_SESSION_CHECKPOINT as pin,
  prepareLAN01RetainedReviewSessionCheckpoint } from './LAN01RetainedCheckpoint.test-support';
import { readRetainedNativeLiveAppealSession } from './SamePlateAppearanceLiveAppealJournalNative.test-support';
import type { AcceptedActualPostPlayReviewSession } from './ActualPostPlayReviewSource';
import type { ActualPostPlayReviewProjection } from './ActualPostPlayReview';

it('pins only returned cp16 with cut24 and revision-zero review session before original import', () => {
  expect([pin.checkpointSequence, pin.returnedOwnerCall, pin.databaseBytes, pin.gzipBytes, pin.tableCount, pin.rowCount])
    .toEqual([16, 16, 22630400, 1401243, 121, 1984]);
  expect(pin.databaseSha256).toBe('4b5f4a7eac0aff693cd34aaf116ac8df35aa5fc76f0e333555217edca161bccd');
  expect(pin.gzipSha256).toBe('71f3622b6f27a262bd744373ee2bb3cdc64ff5bc1439f05bd2b8cdd33388fe01');
  expect(pin.receiptSha256).toBe('42d3ebf86a6b70e1a55911da7c616dd09a4931616b9675ac9d4e4e35b0df1f59');
  expect(pin.priorRunTerminalSha256).toBe('4c2b0790438a5fbfd3a3d2ede0478f66606b4f2f7e48230d2fcd78357b274f14');
  expect(pin.firstRemainingWriter).toEqual({ owner: 'ActualPostPlayReview', method: 'acceptEvent', sourceId: 'lan01:journal:import',
    argumentsHash: '872b5286e1b9fb07b972d95e84c22f4f86287633e48133b51d5fbd3512b9b73b' });
  expect(pin.priorCp24).toBe(LAN01_RETAINED_CHECKPOINT);
  expect(pin.sealedBoundary.cut24ViewReference.sourceId).toBe('lan01:occupied:cut24:view');
  expect(pin.sealedBoundary.sealedReference.sourceId).toBe('lan01:seal');
  expect(pin.sealedBoundary.sealedCatchReference.sourceId).toBe('lan01:caught:work:sealed');
  expect(pin.reviewSession.revision).toBe(0); expect(pin.reviewSession.headSourceId).toBe('lan01:journal:session');
  expect(pin.sessionArchiveSnapshotHash).toBe('755dab73958f28ce8d845cf6b189107be68cffaac4d4d1a2be6e4504b5b95d1d');
});

it('rejects unreleased or substituted cp16 before creating a destination', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lan01-cp16-rejection-'));
  const checkpointGzip = join(directory, 'checkpoint.sqlite.gz'), destinationDirectory = join(directory, 'suffix');
  writeFileSync(checkpointGzip, 'different retained database');
  try {
    expect(() => prepareLAN01RetainedReviewSessionCheckpoint({ nativeReleased: false, checkpointGzip, destinationDirectory }))
      .toThrow('reviewed and released');
    expect(() => prepareLAN01RetainedReviewSessionCheckpoint({ nativeReleased: true, checkpointGzip, destinationDirectory }))
      .toThrow('input hash differs');
    expect(existsSync(destinationDirectory)).toBe(false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

// Synthetic owner-return projections only. These finite cases check resume
// selection and rejection; they neither authenticate a DB nor credit Native.
const retainedSession = () => {
  const source: AcceptedActualPostPlayReviewSession = { sourceId: 'lan01:journal:session', sourceVersion: 'fixture-only-v1',
    capability: 'actual_post_play_review_session_v1', adjudicationSourceId: 'lan01:journal:seed', adjudicationSnapshotHash: hash('seed'),
    officialPolicy: null, policy: null };
  const value = { source, revision: 0, headSourceId: source.sourceId, headHash: hash('head'), events: [],
    seed: { snapshotHash: hash('seed') } } as unknown as ActualPostPlayReviewProjection;
  const retained = { sourceId: source.sourceId, sourceHash: hash(source), revision: 0 as const,
    headSourceId: value.headSourceId, headHash: value.headHash, projectionSnapshotHash: hash(value), seedSnapshotHash: value.seed.snapshotHash };
  const owner = { readCurrent: vi.fn((): ActualPostPlayReviewProjection | null => value), acceptSession: vi.fn(), acceptEvent: vi.fn() };
  return { source, value, retained, owner };
};

it('adopts exactly the independently read initial session without invoking an accepted-owner retry', () => {
  const f = retainedSession(), before = JSON.stringify(f);
  expect(readRetainedNativeLiveAppealSession(f.owner, f.source, f.retained)).toBe(f.value);
  expect(f.owner.readCurrent.mock.calls).toEqual([[f.source.sourceId]]);
  expect(f.owner.acceptSession).not.toHaveBeenCalled(); expect(f.owner.acceptEvent).not.toHaveBeenCalled();
  expect(JSON.stringify(f)).toBe(before);
});

it('rejects substituted Sources, missing sessions, later heads, events, seeds and projection bytes', () => {
  for (const change of [
    (f: ReturnType<typeof retainedSession>) => { f.source = { ...f.source, sourceVersion: 'changed' }; },
    (f: ReturnType<typeof retainedSession>) => { f.owner.readCurrent.mockReturnValue(null); },
    (f: ReturnType<typeof retainedSession>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, revision: 1 }); },
    (f: ReturnType<typeof retainedSession>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, headSourceId: 'other' }); },
    (f: ReturnType<typeof retainedSession>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, headHash: hash('changed') }); },
    (f: ReturnType<typeof retainedSession>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, events: [{} as never] }); },
    (f: ReturnType<typeof retainedSession>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, seed: { ...f.value.seed, snapshotHash: hash('changed') } }); },
    (f: ReturnType<typeof retainedSession>) => { f.owner.readCurrent.mockReturnValue({ ...f.value, pendingReasons: ['changed'] }); },
  ]) {
    const f = retainedSession(); change(f);
    expect(() => readRetainedNativeLiveAppealSession(f.owner, f.source, f.retained)).toThrow();
    expect(f.owner.acceptSession).not.toHaveBeenCalled(); expect(f.owner.acceptEvent).not.toHaveBeenCalled();
  }
});

it('preserves the original journal body including all events, assertions and independent reopen retry', () => {
  const source = readFileSync(new URL('./SamePlateAppearanceLiveAppealJournalNative.test-support.ts', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('  const current = h.current()'))
    .replace('  let value = retainedSession === undefined ? accept(owner.acceptSession(session.sourceId))\n'
      + '    : retainedSession.revision === 1 ? readRetainedNativeLiveAppealImport(owner, session, retainedSession)\n'
      + '    : readRetainedNativeLiveAppealSession(owner, session, retainedSession);',
      '  let value = accept(owner.acceptSession(session.sourceId));')
    .replace("  if (retainedSession?.revision !== 1) append('import', { kind: 'import_live_appeal', executionReference });",
      "  append('import', { kind: 'import_live_appeal', executionReference });");
  expect(createHash('sha256').update(body).digest('hex')).toBe('00e8bebcc177842976a946024bfd836ea3accb4b44bb510491e02d12d87f59fb');
  expect(body).toContain("append('import', { kind: 'import_live_appeal', executionReference })");
  expect(body).toContain('expect(accept(reopened.acceptSession(session.sourceId))).toEqual(reopened.readSession(session.sourceId))');
});

it('loads the cp16 entry and connects it to the shared post-seal body without calling completed writers', async () => {
  const entry = await import('./LAN01RetainedOriginalSuffix.test-support');
  expect(typeof entry.runLAN01RetainedReviewSessionSuffix).toBe('function');
  const source = readFileSync(new URL('./LAN01RetainedOriginalSuffix.test-support.ts', import.meta.url), 'utf8');
  const start = source.indexOf("    if (reviewSession) {\n      assert('sealedCaught'"), end = source.indexOf('    } else {', start);
  const resumed = source.slice(start, end);
  expect(start).toBeGreaterThan(0); expect(resumed).toContain('continueLAN01OriginalLiveAppealSealedAssertions');
  expect(resumed).not.toMatch(/resumeNativeLiveAppealCatch|resumeNativePhysicalThrow|\.advance\(|acceptOperation/);
  expect(source).toContain('historicalOriginalCallbackAssertionCount: 16, remainingOriginalCallbackAssertionCount: 4');
  expect(source).toContain('remainingOwnerCallCount: 22, terminalOwnerCallCount: 17');
}, 30_000);
