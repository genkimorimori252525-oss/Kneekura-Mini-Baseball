import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setImmediate as yieldForReporter } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getOfficialPlayClosure, getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { deriveClosedNonLiveMatchState } from '../../core/adjudication/NonLiveOfficialApplication';
import { terminalFixtureManifest, genuineTerminalFixture, genuineAbsentIntentCount, requireTerminalDerive, requireTerminalParser,
  type GenuineTerminalFixture, type TerminalProjection, type TerminalResult } from './ActualFoulTerminalApplicationFixtures.test-support';

const projected = (result: TerminalResult): TerminalProjection => {
  expect(result.kind).toBe('terminal_non_live_projected');
  if (result.kind !== 'terminal_non_live_projected') throw new Error('terminal projection stayed pending');
  return result;
};
const pending = (result: TerminalResult, reasons: readonly string[]) => {
  expect(result.kind).toBe('pending');
  if (result.kind !== 'pending') throw new Error('missing authority produced a terminal result');
  expect(result.pendingReasons).toEqual(expect.arrayContaining([...reasons]));
  expect(result).not.toHaveProperty('receipt'); expect(result).not.toHaveProperty('acknowledgement');
};
const unchanged = <T>(f: GenuineTerminalFixture, body: () => T): T => {
  const db = f.x.f.db;
  // Supplied-connection and visible-state evidence only. This does not prove
  // what an arbitrary unobserved peer connection did between these snapshots.
  const state = () => ({
    isTransaction: db.isTransaction,
    queryOnly: db.prepare('PRAGMA query_only').get()!.query_only,
    mainSchemaVersion: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    tempSchemaVersion: db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
    mainSchema: db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM main.sqlite_master ORDER BY type,name,tbl_name,rootpage,sql').all(),
    tempSchema: db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM temp.sqlite_master ORDER BY type,name,tbl_name,rootpage,sql').all(),
    logicalBytes: f.bytes(),
    totalChanges: db.prepare('SELECT total_changes() AS n').get()!.n,
    userVersion: db.prepare('PRAGMA user_version').get()!.user_version,
  });
  const before = state();
  try { return body(); }
  finally { expect(state()).toEqual(before); }
};
// Normal cleanup attempts removal even when close throws. Inherited bootstrap
// failures and runtime timeouts still require coordinator process reaping.
const cleanupFixture = (store: { close(): void } | undefined, directory: string | undefined) => {
  try { store?.close(); }
  finally { if (directory) rmSync(directory, { recursive: true, force: true }); }
};
const rollbackCorruption = async (f: GenuineTerminalFixture, mutate: () => void, body: () => unknown) => {
  const before = f.bytes(), db = f.x.f.db;
  db.exec('SAVEPOINT terminal_contract_corruption');
  let primaryError: unknown, bodyFailed = false;
  try { mutate(); await body(); }
  catch (error) { primaryError = error; bodyFailed = true; throw error; }
  finally {
    try {
      db.exec('ROLLBACK TO terminal_contract_corruption; RELEASE terminal_contract_corruption');
      expect(f.bytes()).toBe(before);
    } catch (cleanupError) {
      if (bodyFailed) throw new AggregateError([primaryError, cleanupError], 'corruption assertion and rollback both failed', { cause: primaryError });
      throw cleanupError;
    }
  }
};

describe('genuine terminal bunt read-only projection', () => {
  let directory: string, f: GenuineTerminalFixture;
  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'terminal-foul-bunt-'));
    f = await genuineTerminalFixture(join(directory, 'original.sqlite'), 'bunt');
  }, 900_000);
  afterAll(() => cleanupFixture(f?.x.f, directory));

  it('projects the genuine assigned bunt strikeout with exact call identity and no durable or physical effect', async () => {
    const derive = await requireTerminalDerive(), source = f.terminalSource();
    const result = unchanged(f, () => projected(derive(f.x.f.db, source, 'current')));
    expect(result.source).toEqual(source); expect(result.officialApplied).toBe(false);
    expect(result).not.toHaveProperty('receipt'); expect(result).not.toHaveProperty('acknowledgement');
    expect(result).not.toHaveProperty('activation'); expect(result).not.toHaveProperty('nextWorld');
    expect(result).not.toHaveProperty('effort');
    expect(result.physicalEndReference).toEqual(f.endReference);
    expect(result.consumptionReference).toEqual(f.end.dispositionObligations.consumptionReference);
    expect(result.officialReference).toEqual(source.officialReference);
    expect(result.officialObligation).toEqual(f.end.dispositionObligations.official);
    expect(result).toMatchObject({ gameId: 'game-1', playId: 7, firstPhysicalPitchSourceId: 'pitch-0', physicalPitchSourceId: 'pitch-2' });
    const body = result.applicationBody, original = f.fenced.value.ledger, closure = getOfficialPlayClosure(body.adjudication)!;
    expect(body).toMatchObject({ matchId: 'game-1', applicationId: source.applicationId, expectedDurableRevision: 0,
      match: terminalFixtureManifest.match, context: { kind: 'strikeout' } });
    expect(body.timeline).toEqual(f.x.count.disposition.timeline); expect(body.adjudication.playEnd).toBeNull();
    expect(original.playEnd).toEqual(f.end.playEnd);
    expect(body.adjudication.events.slice(0, -1)).toEqual(original.events);
    expect(closure).toMatchObject({ closureId: source.sourceId, closedAtTick: f.fenced.value.cursor.tick, playEnd: null,
      finalRuling: { source: 'on_field_call', basisCallId: f.called.source.sourceId } });
    const call = original.events.find(e => e.kind === 'OnFieldCallRecorded');
    expect(call).toMatchObject({ eventId: f.called.source.sourceId + ':call', call: { callId: closure.finalRuling.basisCallId } });
    expect(closure.finalRuling.basisCallId).not.toBe(call!.eventId);
    expect(closure.closedAtTick).toBeGreaterThanOrEqual(f.end.exactEnd.tick);
    expect(f.fenced.value.cursor.openingElapsedSeconds).toBeGreaterThan(f.end.preCorePhysicalProof.boundary.lastIncludedElapsedSeconds);
    expect(result.originalOfficialLedgerHash).toBe(f.hash(original));
    expect(result.applicationLedgerHash).toBe(f.hash(body.adjudication));
    expect(result.applicationLedgerHash).not.toBe(result.originalOfficialLedgerHash);
    expect(result.composedTimelineHash).toBe(f.hash(body.timeline));
    expect(result.assignmentSourceHash).toBe(f.hash(f.session.assignment)); expect(result.intentSourceHash).toBe(f.hash(f.intent));
    expect(result.nextMatch).toEqual({ ...terminalFixtureManifest.match, playId: 8, outs: 1 });
    expect(deriveClosedNonLiveMatchState(body)).toEqual(result.nextMatch);
    expect(result.scoring.classification).toBe('strikeout');
    expect(f.x.physical.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
    expect(body.timeline.events.slice(0, -1)).toEqual(f.x.physical.result.pitch.resolution.timeline.events);
    expect(body.timeline.events.some(e => e.kind === 'LiveBallPlayEnded')).toBe(false);
    expect(f.end.dispositionObligations.official).toMatchObject({ status: 'pending', consumer: null });
    expect(JSON.stringify(f.x.f.official.getMatch('game-1'))).toBe(f.x.originalMatchBytes);
  }, 180_000);

  it('allows an explicit null game policy only for this proved same-half no-run-change projection', async () => {
    const derive = await requireTerminalDerive();
    await yieldForReporter();
    const result = unchanged(f, () => projected(derive(f.x.f.db, { ...f.terminalSource(), legalGamePolicy: null }, 'current')));
    expect(result.nextMatch).toEqual({ ...terminalFixtureManifest.match, playId: 8, outs: 1 });
    await yieldForReporter();
  }, 180_000);

  it('keeps a genuine admitted prefix without an assigned call pending instead of adopting correct-rule truth', async () => {
    const derive = await requireTerminalDerive();
    expect(f.opened.callIntent).toBeNull(); expect(f.opened.officialCount).toBeNull();
    await yieldForReporter();
    unchanged(f, () => pending(derive(f.x.f.db, f.terminalSource(f.opened), 'historical'), ['accepted_official_call_missing']));
    await yieldForReporter();
  }, 180_000);

  it('keeps the genuine called prefix with its open appeal pending until the scheduler fence', async () => {
    const derive = await requireTerminalDerive();
    const window = getOfficialStateWindows(f.called.value.ledger)[0]; expect(window.closedAtTick).toBeNull();
    await yieldForReporter();
    unchanged(f, () => pending(derive(f.x.f.db, f.terminalSource(f.called.value), 'historical'),
      ['official_window_open:' + window.windowId, 'terminal_fence_missing']));
    await yieldForReporter();
  }, 180_000);

  it('rejects a stale genuine prefix in current mode while retaining its authenticated historical pending basis', async () => {
    const derive = await requireTerminalDerive();
    await yieldForReporter();
    unchanged(f, () => expect(() => derive(f.x.f.db, f.terminalSource(f.advanced.value), 'current')).toThrow(/head|stale|current/));
    await yieldForReporter();
    unchanged(f, () => pending(derive(f.x.f.db, f.terminalSource(f.advanced.value), 'historical'), ['terminal_fence_missing']));
    await yieldForReporter();
  }, 180_000);

  it('rejects foreign selected journal hashes and physical end references without writes', async () => {
    const derive = await requireTerminalDerive(), source = f.terminalSource();
    await yieldForReporter();
    for (const changed of [
      { ...source, officialReference: { ...source.officialReference, headHash: '0'.repeat(64) } },
      { ...source, physicalEndReference: { ...source.physicalEndReference, snapshotHash: '0'.repeat(64) } },
      { ...source, physicalEndReference: { ...source.physicalEndReference, sourceId: 'foreign-end' } },
    ]) {
      unchanged(f, () => expect(() => derive(f.x.f.db, changed, 'current')).toThrow());
      await yieldForReporter();
    }
  }, 360_000);

  it('rejects caller timeline count tick setup ruling and completion injection before accepting terminal authority', async () => {
    const parse = await requireTerminalParser(), source = f.terminalSource();
    await yieldForReporter();
    expect(parse(source, source.sourceId)).toEqual(source);
    for (const key of ['timeline', 'count', 'ruleTick', 'closureTick', 'worldSetup', 'ruling', 'completedChild', 'participants', 'workload', 'finalScore']) {
      expect(() => parse({ ...source, [key]: key === 'timeline' ? f.x.count.disposition.timeline : {} }, source.sourceId)).toThrow();
    }
    await yieldForReporter();
  });

  it('rejects malformed terminal identities game policies and accessors without evaluating caller code', async () => {
    const parse = await requireTerminalParser(), source = f.terminalSource();
    await yieldForReporter();
    const uncapped = { ...source, legalGamePolicy: { version: source.legalGamePolicy!.version,
      minimumInnings: source.legalGamePolicy!.minimumInnings, tiesAllowed: false } };
    const acceptedUncapped = parse(uncapped, source.sourceId);
    expect(acceptedUncapped).toEqual(uncapped);
    expect(acceptedUncapped.legalGamePolicy).not.toHaveProperty('maximumInnings');
    for (const bad of [{ ...source, sourceId: ' padded ' }, { ...source, sourceVersion: '' }, { ...source, applicationId: '' },
      { ...source, officialReference: { ...source.officialReference, revision: -1 } },
      { ...source, officialReference: { ...source.officialReference, revision: Number.MAX_SAFE_INTEGER + 1 } },
      { ...source, officialReference: { ...source.officialReference, headHash: 'A'.repeat(64) } },
      { ...source, legalGamePolicy: { ...source.legalGamePolicy!, minimumInnings: 0 } },
      { ...source, legalGamePolicy: { ...source.legalGamePolicy!, tiesAllowed: false } },
      { ...source, legalGamePolicy: { ...source.legalGamePolicy!, inventedLimit: 9 } }]) {
      expect(() => parse(bad, source.sourceId)).toThrow();
    }
    let reads = 0;
    expect(() => parse({ ...source, officialReference: { ...source.officialReference,
      get headHash() { reads++; return source.officialReference.headHash; } } }, source.sourceId)).toThrow();
    expect(reads).toBe(0); expect(() => parse(null, source.sourceId)).toThrow();
    await yieldForReporter();
  });

  it('rejects a missing genuine E seal and preserves the original database after corruption rollback', async () => {
    const derive = await requireTerminalDerive();
    await yieldForReporter();
    await rollbackCorruption(f, () => f.x.f.db.prepare('DELETE FROM actual_live_play_fences WHERE closure_source_id=?').run(f.end.source.sourceId),
      () => unchanged(f, () => expect(() => derive(f.x.f.db, f.terminalSource(), 'current')).toThrow()));
    await yieldForReporter();
  }, 180_000);

  it('rejects changed genuine count hash and original first-pitch identity without repairing the archive', async () => {
    const derive = await requireTerminalDerive();
    await yieldForReporter();
    for (const change of ['hash', 'first-pitch']) {
      await rollbackCorruption(f, () => {
        const db = f.x.f.db;
        if (change === 'hash') db.prepare('UPDATE actual_foul_rule_consumptions SET snapshot_hash=? WHERE source_id=?')
          .run('0'.repeat(64), f.x.count.source.sourceId);
        else {
          const changed = { ...f.x.count, firstPhysicalPitchSourceId: f.x.count.physicalPitchSourceId };
          db.prepare('UPDATE actual_foul_rule_consumptions SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
            .run(f.json(changed), f.hash(changed), f.x.count.source.sourceId);
        }
      }, () => unchanged(f, () => expect(() => derive(f.x.f.db, f.terminalSource(), 'current')).toThrow()));
      await yieldForReporter();
    }
  }, 360_000);

  it('rejects changed archived official intent and scheduler Source without using cached journal authority', async () => {
    const derive = await requireTerminalDerive();
    await yieldForReporter();
    for (const change of ['intent', 'scheduler']) {
      await rollbackCorruption(f, () => {
        const db = f.x.f.db;
        if (change === 'intent') db.prepare('UPDATE actual_foul_official_events SET intent_json=? WHERE source_id=?')
          .run(f.json({ ...f.intent, officialId: 'unassigned' }), f.called.source.sourceId);
        else {
          const source = { ...f.fenced.source, action: { kind: 'next_pitch_fence', schedulerId: 'foreign-scheduler' } };
          db.prepare('UPDATE actual_foul_official_events SET source_json=?,source_hash=? WHERE source_id=?')
            .run(f.json(source), f.hash(source), f.fenced.source.sourceId);
        }
      }, () => unchanged(f, () => expect(() => derive(f.x.f.db, f.terminalSource(), 'current')).toThrow()));
      await yieldForReporter();
    }
  }, 360_000);

  it('rejects a changed original Match in current mode without invalidating the historical basis', async () => {
    const derive = await requireTerminalDerive();
    await yieldForReporter();
    await rollbackCorruption(f, () => f.x.f.db.prepare('UPDATE matches SET durable_revision=durable_revision+1 WHERE match_id=?').run('game-1'), async () => {
      unchanged(f, () => expect(() => derive(f.x.f.db, f.terminalSource(), 'current')).toThrow(/Match|revision|current/));
      await yieldForReporter();
      const result = unchanged(f, () => projected(derive(f.x.f.db, f.terminalSource(), 'historical')));
      expect(result.applicationBody.expectedDurableRevision).toBe(0);
    });
    await yieldForReporter();
  }, 360_000);

  // Last in this serial group: the existing journal accepts a real later event.
  // No old prefix is deleted, patched, copied, or restored after that acceptance.
  it('reads the selected terminal fence historically after a later authentic event while rejecting its stale current reference', async () => {
    const derive = await requireTerminalDerive(), selected = f.terminalSource();
    await yieldForReporter();
    const expected = unchanged(f, () => projected(derive(f.x.f.db, selected, 'current')));
    await yieldForReporter();
    const later = f.append(f.fenced.value, 'terminal-later-advance', { kind: 'advance_tick', schedulerId: f.session.assignment.schedulerId });
    expect(later.value.revision).toBe(f.fenced.value.revision + 1);
    await yieldForReporter();
    unchanged(f, () => expect(() => derive(f.x.f.db, selected, 'current')).toThrow(/head|stale|current/));
    await yieldForReporter();
    expect(unchanged(f, () => derive(f.x.f.db, selected, 'historical'))).toEqual(expected);
    await yieldForReporter();
    unchanged(f, () => pending(derive(f.x.f.db, f.terminalSource(later.value), 'current'), ['terminal_fence_missing']));
    await yieldForReporter();
  }, 540_000);
});

describe('genuine independently accepted FAIR journal', () => {
  let directory: string, f: GenuineTerminalFixture;
  beforeAll(async () => { directory = mkdtempSync(join(tmpdir(), 'terminal-foul-fair-'));
    f = await genuineTerminalFixture(join(directory, 'original.sqlite'), 'fair'); }, 900_000);
  afterAll(() => cleanupFixture(f?.x.f, directory));
  it('keeps genuine FAIR pending despite the physical bunt strikeout and accepted scheduler fence', async () => {
    expect(f.x.count.disposition.kind).toBe('terminal_strikeout'); expect(f.fenced.value.callIntent!.judgment).toBe('fair');
    expect(f.fenced.value.officialCount).toBeNull();
    expect(f.fenced.value.ledger.events.some(e => e.kind === 'OnFieldCallRecorded')).toBe(false);
    const derive = await requireTerminalDerive();
    unchanged(f, () => pending(derive(f.x.f.db, f.terminalSource(), 'current'), ['fair_judgment_consequence_unimplemented']));
  }, 180_000);
});

describe('genuine unowned review and challenge', () => {
  let directory: string, f: GenuineTerminalFixture;
  beforeAll(async () => { directory = mkdtempSync(join(tmpdir(), 'terminal-foul-windows-'));
    f = await genuineTerminalFixture(join(directory, 'original.sqlite'), 'unowned_windows'); }, 900_000);
  afterAll(() => cleanupFixture(f?.x.f, directory));
  it('keeps both genuine unowned window dependencies pending after their deadlines and accepted fence', async () => {
    const derive = await requireTerminalDerive();
    expect(f.fenced.value.cursor.tick).toBeGreaterThanOrEqual(f.opened.cursor.tick + 1);
    unchanged(f, () => pending(derive(f.x.f.db, f.terminalSource(), 'current'),
      ['foul_window_owner_unimplemented:review', 'foul_window_owner_unimplemented:challenge']));
  }, 180_000);
});

describe('genuine ordinary foul exclusion', () => {
  let directory: string, f: GenuineTerminalFixture;
  beforeAll(async () => { directory = mkdtempSync(join(tmpdir(), 'terminal-foul-ordinary-'));
    f = await genuineTerminalFixture(join(directory, 'original.sqlite'), 'ordinary_swing'); }, 900_000);
  afterAll(() => cleanupFixture(f?.x.f, directory));
  it('keeps the genuine ordinary same-PA handoff outside terminal projection', async () => {
    expect(f.x.count.disposition.kind).toBe('continue_same_pa'); expect(f.fenced.value.handoff!.status).toBe('consumed');
    const derive = await requireTerminalDerive();
    unchanged(f, () => pending(derive(f.x.f.db, f.terminalSource(), 'current'), ['not_terminal_bunt']));
  }, 180_000);
});

describe('genuine absent original intent prerequisite only', () => {
  it('prerequisite retains a genuine absent-intent count as pending with no terminal timeline or official reference', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'terminal-foul-no-intent-'));
    let f: Awaited<ReturnType<typeof genuineAbsentIntentCount>> | undefined;
    try {
      f = await genuineAbsentIntentCount(join(directory, 'original.sqlite'));
      const before = f.bytes();
      expect(f.count.disposition).toEqual({ kind: 'pending_original_intent', timeline: null });
      expect(f.count.successor).toMatchObject({ status: 'pending', pendingReason: 'original_batting_intent_missing' });
      expect(f.x.physical.result.pitch.resolution.timeline.status.kind).toBe('batted_ball_pending');
      expect(f.x.inputArchiveBytes()).toBe(f.x.beforePhysicalBytes);
      expect(JSON.stringify(f.x.f.official.getMatch('game-1'))).toBe(f.x.originalMatchBytes);
      expect(f.bytes()).toBe(before);
    } finally { cleanupFixture(f?.x.f, directory); }
  }, 900_000);
});
