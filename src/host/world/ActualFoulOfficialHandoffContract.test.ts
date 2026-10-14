import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import * as officialOwners from './SqliteActualPostPlayReviewStore';
import { originalFoulEndFixture, assertOriginalFoulEndPrerequisites, foulEndLogicalBytes,
  type OriginalFoulEndFixture } from './ActualFoulPlayEndFixtures.test-support';
import { openSqliteActualFoulPlayEndStore, actualFoulClosedEvidenceFromSqlite,
  actualFoulEndArchiveEncoding } from './SqliteActualFoulPlayEndStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordOnFieldCall, closeOfficialPlay,
  getOfficialPlayClosure, getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { openRuleProfileOfficialStateWindow, advanceRuleProfileOfficialWindows,
  evaluateRuleProfileOfficialWindowTiming } from '../../core/adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { FoulEndedEvidence } from './ActualFoulPlayEnd';
import { requireFoulOfficialOpener, type AcceptedFoulOfficialSession, type AcceptedFoulOfficialEvent,
  type AcceptedFoulOfficialIntent, type FoulOfficialProjection, type FoulOfficialStore,
  type FoulOfficialModule } from './ActualFoulOfficialHandoffContracts.test-support';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const ownTables = ['actual_foul_official_sessions', 'actual_foul_official_events', 'actual_foul_official_heads', 'actual_foul_official_handoffs'];
type Fixture = { x: OriginalFoulEndFixture; end: FoulEndedEvidence; path: string; fileHash: string };
let directory: string, path: string, db: InstanceType<typeof DatabaseSync>, sequence = 0;
const fixtures: Fixture[] = [], sessions = new Map<string, unknown>(), events = new Map<string, unknown>(), intents = new Map<string, unknown>();
let stores: FoulOfficialStore[] = [];
const fileHash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'foul-official-handoff-'));
  for (const attempt of ['ordinary_swing', 'bunt'] as const) {
    const baseline = join(directory, attempt + '.sqlite'), x = originalFoulEndFixture(baseline, attempt);
    let end: FoulEndedEvidence;
    try {
      assertOriginalFoulEndPrerequisites(x);
      const source = { sourceId: attempt + '-official-handoff-end', sourceVersion: 'contract-v1',
        capability: 'actual_original_settled_foul_play_end_v1' as const, ruleConsumptionSourceId: x.count.source.sourceId,
        baseFieldSourceId: x.foul.last.source.sourceId, executionSourceId: x.endpoint.source.sourceId };
      const owner = x.f.track(openSqliteActualFoulPlayEndStore(baseline, { readAcceptedEnd: id => id === source.sourceId ? source : null }));
      end = owner.accept(source.sourceId);
      expect(actualFoulClosedEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(end);
      expect(actualFoulRuleConsumptionEvidenceFromSqlite(x.f.db).read(x.count.source.sourceId)).toEqual(x.count);
    } finally { x.f.close(); }
    expect(!existsSync(baseline + '-wal') || statSync(baseline + '-wal').size === 0).toBe(true);
    fixtures.push({ x, end: end!, path: baseline, fileHash: fileHash(baseline) });
  }
}, 720_000);
const use = (fixture: Fixture) => {
  if (db?.isOpen) db.close();
  expect(fileHash(fixture.path)).toBe(fixture.fileHash);
  path = join(directory, 'case-' + ++sequence + '.sqlite'); copyFileSync(fixture.path, path); db = new DatabaseSync(path);
};
beforeEach(() => { stores = []; sessions.clear(); events.clear(); intents.clear(); use(fixtures[0]); });
afterEach(() => { for (const store of stores.reverse()) store.close(); if (db?.isOpen) db.close(); });
afterAll(() => { for (const f of fixtures) expect(fileHash(f.path)).toBe(f.fileHash);
  if (directory) rmSync(directory, { recursive: true, force: true }); });
const endReference = (f: Fixture) => ({ owner: 'actual_foul_play_ends' as const, sourceId: f.end.source.sourceId,
  sourceVersion: f.end.source.sourceVersion, sourceHash: hash(f.end.source), snapshotHash: actualFoulEndArchiveEncoding(f.end).hash });
const source = (f = fixtures[0]): AcceptedFoulOfficialSession => ({ sourceId: 'foul-official-session', sourceVersion: 'contract-v1',
  capability: 'actual_post_play_foul_official_session_v1', physicalEndReference: endReference(f),
  assignment: { sourceId: 'foul-official-assignment', sourceVersion: 'explicit-fixture-v1', gameId: f.end.gameId, playId: f.end.playId,
    physicalPitchSourceId: f.end.physicalPitchSourceId, officialIds: ['umpire-1'], schedulerId: 'official-scheduler',
    clock: 'post_play_discrete_tick_v1', openingTrigger: 'sealed_foul_physical_end' },
  officialPolicy: { sourceId: 'foul-window-policy', sourceVersion: 'explicit-fixture-v1', ruleProfileId: 'npb-2026',
    officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } } });
const acceptedIntent = (s: AcceptedFoulOfficialSession, f = fixtures[0]): AcceptedFoulOfficialIntent => ({
  sourceId: 'foul-official-intent', sourceVersion: 'contract-v1', capability: 'actual_post_play_foul_official_intent_v1',
  sessionSourceId: s.sourceId, gameId: f.end.gameId, playId: f.end.playId, physicalPitchSourceId: f.end.physicalPitchSourceId,
  assignmentSourceId: s.assignment.sourceId, officialId: 'umpire-1', judgment: 'foul' });
const event = (p: FoulOfficialProjection, action: AcceptedFoulOfficialEvent['action'], name = action.kind): AcceptedFoulOfficialEvent => ({
  sourceId: `foul-official-event:${name}:${p.revision + 1}`, sourceVersion: 'contract-v1', capability: 'actual_post_play_foul_official_event_v1',
  sessionSourceId: p.source.sourceId, expectedRevision: p.revision, parent: { sourceId: p.headSourceId, snapshotHash: p.headHash }, action });
const open = (readAcceptedEvent = (id: string): unknown => events.get(id) ?? null,
  readAcceptedIntent = (id: string): unknown => intents.get(id) ?? null) => {
  const store = requireFoulOfficialOpener(officialOwners)(path, { readAcceptedSession: id => sessions.get(id) ?? null,
    readAcceptedEvent, readAcceptedIntent }); stores.push(store); return store;
};
const start = (s = source()) => {
  sessions.set(s.sourceId, s); const store = open(), value = store.acceptSession(s.sourceId);
  expect(value.kind).not.toBe('intake_pending');
  if (value.kind === 'intake_pending') throw new Error('contract requires an admitted official session');
  return { store, value };
};
const append = (store: FoulOfficialStore, p: FoulOfficialProjection, action: AcceptedFoulOfficialEvent['action']) => {
  const s = event(p, action); events.set(s.sourceId, s); return { source: s, value: store.acceptEvent(s.sourceId) };
};
const call = (store: FoulOfficialStore, p: FoulOfficialProjection, intent = acceptedIntent(p.source)) => {
  intents.set(intent.sourceId, intent); return append(store, p, { kind: 'record_call', intentSourceId: intent.sourceId });
};
const fence = (store: FoulOfficialStore, p: FoulOfficialProjection) => append(store, p,
  { kind: 'next_pitch_fence', schedulerId: p.source.assignment.schedulerId });
const originals = () => foulEndLogicalBytes(db, ownTables);
const frozen = (v: unknown): void => { if (v && typeof v === 'object') { expect(Object.isFrozen(v)).toBe(true); Object.values(v).forEach(frozen); } };
const opening = (f: Fixture) => {
  const boundary = deriveQuantizerClosedGenerationBoundary({ originTick: f.end.exactEnd.originTick,
    throughTick: f.end.exactEnd.tick, ticksPerSecond: f.x.ticksPerSecond });
  expect(boundary).toEqual(f.end.preCorePhysicalProof.boundary);
  if (boundary.firstExcludedTick === null) throw new Error('genuine fixture has no safe post-play tick');
  return { originTick: boundary.originTick, ticksPerSecond: boundary.ticksPerSecond,
    openingTick: boundary.firstExcludedTick, openingElapsedSeconds: boundary.firstExcludedElapsedSeconds,
    tick: boundary.firstExcludedTick, offsetTicks: 0 };
};
const expectedLedger = (f: Fixture, s: AcceptedFoulOfficialSession, callSourceId?: string, fenceSourceId?: string, extraTicks = 0) => {
  const at = opening(f).openingTick, count = f.x.count, match = f.x.physical.frame.match;
  const ruling = { outsAfter: match.outs + (count.disposition.kind === 'terminal_strikeout' ? 1 : 0), basesAfter: match.bases, scoredRunnerIds: [] };
  const profile = actualLiveAdjudicationProfile(match.ruleProfileId, s.officialPolicy), snapshotId = `actual_foul_count_rule:${count.source.sourceId}`;
  let ledger = createPlayAdjudicationLedger({ playId: count.playId, ruleProfileId: profile.id, playEnd: f.end.playEnd });
  ledger = recordCorrectRuleSnapshot(ledger, ledger.revision, { eventId: s.sourceId + ':rule', tick: at,
    snapshotId, evidenceRevision: count.revision, ruling });
  ledger = openRuleProfileOfficialStateWindow(ledger, ledger.revision, { profile, eventId: s.sourceId + ':appeal-open',
    tick: at, windowId: s.sourceId + ':appeal', windowKind: 'appeal' });
  if (callSourceId) ledger = recordOnFieldCall(ledger, ledger.revision, { eventId: callSourceId + ':call', callId: callSourceId,
    tick: at, basisSnapshotId: snapshotId, basisEvidenceRevision: count.revision, ruling });
  if (fenceSourceId) {
    ledger = advanceRuleProfileOfficialWindows(ledger, ledger.revision, { profile, boundary: 'next_play_fence', tick: at + extraTicks,
      eventIdPrefix: fenceSourceId, inningEnding: false });
    if (count.disposition.kind === 'continue_same_pa') ledger = closeOfficialPlay(ledger, ledger.revision,
      { eventId: fenceSourceId + ':close', closureId: fenceSourceId + ':closure', tick: at + extraTicks });
  }
  return ledger;
};

it('prerequisite authenticates distinct PA and episode identities and reuses the real Core foul call and appeal fence without changing physical history', () => {
  const f = fixtures[0], before = foulEndLogicalBytes(db), s = source();
  expect(f.x.count.firstPhysicalPitchSourceId).not.toBe(f.x.count.physicalPitchSourceId);
  expect(f.x.physical.progressRevision).toBe(3); expect(f.x.count.disposition.kind).toBe('continue_same_pa');
  const start = opening(f);
  expect(quantizeEventTick(start.originTick, start.openingElapsedSeconds, start.ticksPerSecond)).toBe(start.openingTick);
  expect(start.openingTick).toBeGreaterThan(f.end.exactEnd.tick);
  expect(start.openingElapsedSeconds).toBeGreaterThan(f.end.exactEnd.elapsedSeconds);
  const pending = expectedLedger(f, s, 'independent-foul-call');
  expect(getOfficialStateWindows(pending)).toMatchObject([{ windowKind: 'appeal', closedAtTick: null }]);
  const closed = expectedLedger(f, s, 'independent-foul-call', 'independent-fence', 1);
  const closure = getOfficialPlayClosure(closed)!;
  expect(closure.finalRuling).toMatchObject({ source: 'on_field_call', basisCallId: 'independent-foul-call' });
  expect(closure.officialDelta.outsAfter).toBe(f.x.physical.frame.match.outs);
  expect(getOfficialStateWindows(closed)).toMatchObject([{ closeReason: 'next_play_fence' }]);
  const profile = actualLiveAdjudicationProfile(f.x.physical.frame.match.ruleProfileId, s.officialPolicy);
  expect(evaluateRuleProfileOfficialWindowTiming(closed, profile, s.sourceId + ':appeal', start.tick + 1)).toBe('simultaneous_unresolved');
  expect(evaluateRuleProfileOfficialWindowTiming(closed, profile, s.sourceId + ':appeal', start.tick + 2)).toBe('expired');
  expect(actualFoulClosedEvidenceFromSqlite(db).read(f.end.source.sourceId)).toEqual(f.end);
  expect(foulEndLogicalBytes(db)).toBe(before);
}, 180_000);

it('prerequisite keeps the genuine bunt terminal count separate from an ordinary count handoff and preserves the immutable pending child', () => {
  const f = fixtures[1]; use(f); const before = foulEndLogicalBytes(db), s = source(f);
  expect(f.x.count.disposition.kind).toBe('terminal_strikeout');
  expect(f.end.dispositionObligations.official).toMatchObject({ status: 'pending', consumer: null, pendingReason: 'terminal_official_closure_unowned' });
  expect(getOfficialPlayClosure(expectedLedger(f, s, 'independent-bunt-call', 'independent-bunt-fence'))).toBeNull();
  expect(actualFoulRuleConsumptionEvidenceFromSqlite(db).read(f.x.count.source.sourceId)).toEqual(f.x.count);
  expect(foulEndLogicalBytes(db)).toBe(before);
}, 180_000);

it('accepts an assigned official foul call and a real window fence as one ordinary same-PA count handoff while preserving C and E', () => {
  const f = fixtures[0], before = originals(), s = source(), { store, value: initial } = start(s);
  expect(initial.ledger).toEqual(expectedLedger(f, s)); expect(initial.kind).toBe('official_pending');
  expect(initial.cursor).toEqual(opening(f));
  const called = call(store, initial), advanced = append(store, called.value, { kind: 'advance_tick', schedulerId: s.assignment.schedulerId });
  expect(called.value.callIntent).toEqual(acceptedIntent(s)); expect(called.value.officialCount).toEqual(f.x.count.disposition);
  expect(called.value.handoff).toBeNull();
  const completed = fence(store, advanced.value), value = completed.value, child = f.end.dispositionObligations.official;
  expect(value.ledger).toEqual(expectedLedger(f, s, called.source.sourceId, completed.source.sourceId, 1));
  expect(value).toMatchObject({ kind: 'ordinary_foul_handoff_ready', pendingReasons: [], gameId: f.end.gameId, playId: f.end.playId,
    firstPhysicalPitchSourceId: f.end.firstPhysicalPitchSourceId, physicalPitchSourceId: f.end.physicalPitchSourceId });
  expect(value.officialObligation).toEqual(child);
  const c = f.x.count, cRef = { owner: 'actual_foul_rule_consumptions', sourceId: c.source.sourceId, sourceHash: hash(c.source), snapshotHash: hash(c) };
  expect(value.consumptionReference).toEqual(cRef);
  expect(value.handoff).toEqual({ version: 'actual_foul_official_count_handoff_v1',
    acknowledgementId: json(['actual_foul_official_count_handoff_v1', child.obligationKey, completed.source.sourceId]),
    obligationKey: child.obligationKey, originalSuccessorKey: c.successor.successorKey, scope: child.scope, status: 'consumed',
    consumer: { owner: 'actual_foul_official_handoffs', sourceId: completed.source.sourceId, sourceHash: hash(completed.source) },
    physicalEndReference: endReference(f), consumptionReference: cRef, assignmentSourceHash: hash(s.assignment),
    intentSourceHash: hash(acceptedIntent(s)), officialLedgerHash: hash(value.ledger), composedTimelineHash: hash(c.disposition.timeline),
    acceptedAtTick: opening(f).tick + 1 });
  expect(actualFoulClosedEvidenceFromSqlite(db).read(f.end.source.sourceId)).toEqual(f.end);
  expect(actualFoulRuleConsumptionEvidenceFromSqlite(db).read(c.source.sourceId)).toEqual(c);
  expect(originals()).toBe(before);
}, 360_000);

it('derives fractional and large-clock post-play openings from the exact quantizer helper and rejects safe-clock overflow', () => {
  const derive = (officialOwners as unknown as Partial<FoulOfficialModule>).deriveFoulOfficialOpeningClock;
  expect(typeof derive).toBe('function');
  for (const input of [{ originTick: 7, throughTick: 26, ticksPerSecond: 3 },
    { originTick: 2_000_000, throughTick: 2_002_000, ticksPerSecond: 1_000_000 },
    { originTick: 0, throughTick: 2 ** 48, ticksPerSecond: 60 }]) {
    const boundary = deriveQuantizerClosedGenerationBoundary(input);
    expect(boundary.firstExcludedTick).not.toBeNull();
    expect(derive!(input)).toEqual({ originTick: input.originTick, ticksPerSecond: input.ticksPerSecond,
      openingTick: boundary.firstExcludedTick, openingElapsedSeconds: boundary.firstExcludedElapsedSeconds,
      tick: boundary.firstExcludedTick, offsetTicks: 0 });
  }
  const overflow = { originTick: Number.MAX_SAFE_INTEGER - 2, throughTick: Number.MAX_SAFE_INTEGER, ticksPerSecond: 3 };
  expect(deriveQuantizerClosedGenerationBoundary(overflow).firstExcludedTick).toBeNull();
  expect(() => derive!(overflow)).toThrow(/overflow|safe.*clock|post.play.*tick/i);
});

it('rejects a next-pitch fence before a call and from a foreign scheduler without advancing the journal', () => {
  const { store, value } = start(), premature = event(value, { kind: 'next_pitch_fence', schedulerId: value.source.assignment.schedulerId });
  events.set(premature.sourceId, premature); const before = foulEndLogicalBytes(db);
  expect(() => store.acceptEvent(premature.sourceId)).toThrow(/call.*(missing|required)|before.*call/i);
  expect(foulEndLogicalBytes(db)).toBe(before);
  const called = call(store, value).value, invalid = event(called, { kind: 'next_pitch_fence', schedulerId: 'foreign-scheduler' });
  events.set(invalid.sourceId, invalid); const afterCall = foulEndLogicalBytes(db);
  expect(() => store.acceptEvent(invalid.sourceId)).toThrow(/scheduler|authority/); expect(foulEndLogicalBytes(db)).toBe(afterCall);
  expect(fence(store, called).value.handoff).not.toBeNull();
}, 300_000);

it('retains configured active review as an explicit unimplemented foul-window dependency after the fence', () => {
  const s = source(), before = originals();
  const configured = { ...s, officialPolicy: { ...s.officialPolicy!, officialWindows: {
    ...s.officialPolicy!.officialWindows, review: { available: true } } } };
  const { store, value } = start(configured), current = fence(store, call(store, value).value).value;
  expect(current.kind).toBe('official_pending'); expect(current.handoff).toBeNull();
  expect(current.pendingReasons).toContain('foul_window_owner_unimplemented:review');
  expect(getOfficialStateWindows(current.ledger)).toContainEqual(expect.objectContaining({ windowKind: 'review', closedAtTick: null }));
  expect(originals()).toBe(before);
}, 240_000);

it('rejects missing and unassigned official intent with complete rollback then accepts the valid separately owned call', () => {
  const { store, value } = start(), intent = acceptedIntent(value.source), s = event(value, { kind: 'record_call', intentSourceId: intent.sourceId });
  events.set(s.sourceId, s);
  const before = foulEndLogicalBytes(db);
  expect(() => store.acceptEvent(s.sourceId)).toThrow(/accepted.*intent.*missing|intent.*required/i);
  expect(foulEndLogicalBytes(db)).toBe(before); expect(store.readCurrent(value.source.sourceId)).toEqual(value);
  intents.set(intent.sourceId, { ...intent, officialId: 'foreign-official' });
  expect(() => store.acceptEvent(s.sourceId)).toThrow(/official|assignment|authority/);
  expect(foulEndLogicalBytes(db)).toBe(before);
  intents.set(intent.sourceId, intent); expect(store.acceptEvent(s.sourceId).callIntent).toEqual(intent);
}, 240_000);

it('retains an independently accepted FAIR judgment without copying correct foul truth into the call or issuing a handoff', () => {
  const before = originals(), { store, value } = start(), intent = { ...acceptedIntent(value.source), judgment: 'fair' as const };
  const called = call(store, value, intent).value, current = fence(store, called).value;
  expect(current.callIntent).toEqual(intent); expect(current.officialCount).toBeNull(); expect(current.handoff).toBeNull();
  expect(current.kind).toBe('official_pending'); expect(current.pendingReasons).toContain('fair_judgment_consequence_unimplemented');
  expect(current.ledger.events.some(e => e.kind === 'OnFieldCallRecorded')).toBe(false);
  expect(originals()).toBe(before);
}, 240_000);

it('keeps unspecified policy nondurable at intake and accepts a later valid policy under the still-unaccepted session ID', () => {
  const s = source(), store = open(); sessions.set(s.sourceId, { ...s, officialPolicy: null });
  const before = foulEndLogicalBytes(db), pending = store.acceptSession(s.sourceId);
  expect(pending).toEqual({ kind: 'intake_pending', sourceId: s.sourceId,
    pendingReasons: ['official_window_policy_unconfigured:review', 'official_window_policy_unconfigured:challenge'] });
  expect(pending).not.toHaveProperty('revision'); expect(pending).not.toHaveProperty('headHash');
  expect(store.readCurrent(s.sourceId)).toBeNull(); expect(store.readAt(s.sourceId, 0)).toBeNull();
  expect(foulEndLogicalBytes(db)).toBe(before);
  sessions.set(s.sourceId, s); const accepted = store.acceptSession(s.sourceId);
  expect(accepted.kind).not.toBe('intake_pending'); expect(accepted).toMatchObject({ source: s, revision: 0 });
}, 240_000);

it('rejects foreign episode intent and caller clock or result injection with unchanged logical state', () => {
  const { store, value } = start(), intent = acceptedIntent(value.source), valid = event(value, { kind: 'record_call', intentSourceId: intent.sourceId });
  intents.set(intent.sourceId, intent);
  const before = foulEndLogicalBytes(db);
  for (const extra of [{ tick: value.cursor.tick }, { deltaTicks: 8 }, { count: { balls: 0, strikes: 2 } }, { ruling: {} }, { completion: true }]) {
    events.set(valid.sourceId, { ...valid, action: { ...valid.action, ...extra } });
    expect(() => store.acceptEvent(valid.sourceId)).toThrow(/invalid|fields|Source/); expect(foulEndLogicalBytes(db)).toBe(before);
  }
  events.set(valid.sourceId, valid);
  for (const change of [{ playId: intent.playId + 1 }, { physicalPitchSourceId: fixtures[0].x.count.firstPhysicalPitchSourceId },
    { assignmentSourceId: 'foreign-assignment' }, { sessionSourceId: 'foreign-session' }]) {
    intents.set(intent.sourceId, { ...intent, ...change }); expect(() => store.acceptEvent(valid.sourceId)).toThrow(/scope|episode|assignment|session/);
    expect(foulEndLogicalBytes(db)).toBe(before);
  }
  intents.set(intent.sourceId, intent); expect(store.acceptEvent(valid.sourceId).callIntent).toEqual(intent);
}, 300_000);

it('requires the actual end seal before session acceptance and preserves all rows after rejection', () => {
  const s = source(); sessions.set(s.sourceId, s); const store = open();
  db.prepare('DELETE FROM actual_live_play_fences WHERE closure_source_id=?').run(s.physicalEndReference.sourceId);
  const before = foulEndLogicalBytes(db); expect(() => store.acceptSession(s.sourceId)).toThrow(/actual foul.*(archive|fence|seal)/i);
  expect(foulEndLogicalBytes(db)).toBe(before);
}, 180_000);

it('rejects a changed registered policy, foreign assignment scope and wrong end reference before admitting a session', () => {
  const s = source(), store = open(), before = foulEndLogicalBytes(db);
  for (const changed of [{ ...s, officialPolicy: { ...s.officialPolicy!, officialWindows: {
    ...s.officialPolicy!.officialWindows, appeal: { available: false } } } },
    { ...s, assignment: { ...s.assignment, gameId: 'foreign-game' } },
    { ...s, physicalEndReference: { ...s.physicalEndReference, snapshotHash: 'f'.repeat(64) } },
    { ...s, count: { balls: 0, strikes: 2 } }]) {
    sessions.set(s.sourceId, changed); expect(() => store.acceptSession(s.sourceId)).toThrow(/Source|profile|reference|scope|assignment/);
    expect(foulEndLogicalBytes(db)).toBe(before);
  }
  sessions.set(s.sourceId, s); expect(store.acceptSession(s.sourceId)).toMatchObject({ source: s });
}, 300_000);

it('rejects scheduler and predecessor aliases while historical replay and identical accepted event retry preserve their old clock', () => {
  const { store, value } = start(), called = call(store, value), valid = event(called.value,
    { kind: 'advance_tick', schedulerId: value.source.assignment.schedulerId });
  const before = foulEndLogicalBytes(db);
  for (const changed of [{ ...valid, action: { ...valid.action, schedulerId: 'foreign' } },
    { ...valid, parent: { ...valid.parent, snapshotHash: 'f'.repeat(64) } }, { ...valid, expectedRevision: 0 }]) {
    events.set(valid.sourceId, changed); expect(() => store.acceptEvent(valid.sourceId)).toThrow(/scheduler|authority|parent|revision/);
    expect(foulEndLogicalBytes(db)).toBe(before);
  }
  events.set(valid.sourceId, valid); const advanced = store.acceptEvent(valid.sourceId), after = foulEndLogicalBytes(db);
  expect(advanced.cursor.tick).toBe(called.value.cursor.tick + 1);
  expect(store.readAt(value.source.sourceId, called.value.revision)).toEqual(called.value);
  expect(store.acceptEvent(called.source.sourceId)).toEqual(called.value); expect(foulEndLogicalBytes(db)).toBe(after);
}, 300_000);

it('deep-freezes the handoff and reopens exact history without accepted callbacks or any second count application', () => {
  const original = originals(), { store, value } = start(), called = call(store, value), completed = fence(store, called.value);
  frozen(completed.value);
  expect(() => { (completed.value.handoff!.scope as { playId: number }).playId++; }).toThrow();
  const before = foulEndLogicalBytes(db); store.close(); stores = [];
  const reopened = requireFoulOfficialOpener(officialOwners)(path); stores.push(reopened);
  expect(reopened.readCurrent(value.source.sourceId)).toEqual(completed.value);
  expect(reopened.readAt(value.source.sourceId, called.value.revision)).toEqual(called.value);
  expect(reopened.acceptEvent(completed.source.sourceId)).toEqual(completed.value);
  expect(foulEndLogicalBytes(db)).toBe(before); expect(originals()).toBe(original);
}, 300_000);

it('rejects a changed accepted intent under the same ID while unchanged historical C and E remain readable', () => {
  const f = fixtures[0], { store, value } = start(), called = call(store, value), completed = fence(store, called.value).value;
  const before = foulEndLogicalBytes(db), intent = acceptedIntent(value.source);
  intents.set(intent.sourceId, { ...intent, sourceVersion: 'changed-version' });
  expect(() => store.acceptEvent(called.source.sourceId)).toThrow(/frozen|intent|Source/);
  expect(foulEndLogicalBytes(db)).toBe(before);
  intents.set(intent.sourceId, intent); events.set(called.source.sourceId, { ...called.source, sourceVersion: 'changed-event-version' });
  expect(() => store.acceptEvent(called.source.sourceId)).toThrow(/frozen|Source/); expect(foulEndLogicalBytes(db)).toBe(before);
  events.set(called.source.sourceId, called.source); expect(store.readCurrent(value.source.sourceId)).toEqual(completed);
  expect(actualFoulClosedEvidenceFromSqlite(db).read(f.end.source.sourceId)).toEqual(f.end);
  expect(actualFoulRuleConsumptionEvidenceFromSqlite(db).read(f.x.count.source.sourceId)).toEqual(f.x.count);
  expect(foulEndLogicalBytes(db)).toBe(before);
}, 300_000);

it.each(['plain', 'escaped_middle'] as const)('rejects a foreign-indexed rival handoff whose only original claim is its %s official obligation key', encoding => {
  const { store, value } = start(), completed = fence(store, call(store, value).value).value, original = foulEndLogicalBytes(db);
  const row = db.prepare('SELECT * FROM actual_foul_official_handoffs').get()!;
  const foreign = (v: unknown): unknown => typeof v === 'string' ? 'foreign:' + v : Array.isArray(v) ? v.map(foreign)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'playId' && typeof x === 'number' ? x + 1000 : foreign(x)])) : v;
  const rival: Record<string, unknown> = Object.fromEntries(Object.entries(row).map(([k, v]) => [k,
    k.endsWith('_json') ? json(foreign(JSON.parse(String(v)))) : k === 'play_id' ? Number(v) + 1000 : foreign(v)]));
  const saved = JSON.parse(String(rival.snapshot_json));
  const duplicateRaw = (middle: string) => json(saved).slice(0, -1) + ',"obligation\\u004bey":' + JSON.stringify(middle)
    + ',"obligationKey":' + JSON.stringify(saved.obligationKey) + '}';
  if (encoding === 'escaped_middle') rival.snapshot_json = duplicateRaw(saved.obligationKey);
  const rawHash = (text: string) => createHash('sha256').update(text).digest('hex');
  rival.source_hash = hash(JSON.parse(String(rival.source_json))); rival.snapshot_hash = rawHash(String(rival.snapshot_json));
  try {
    const columns = Object.keys(rival);
    db.prepare('INSERT INTO actual_foul_official_handoffs(' + columns.join(',') + ') VALUES(' + columns.map(() => '?').join(',') + ')')
      .run(...(columns.map(k => rival[k]) as (string | number | null)[]));
    expect(store.readCurrent(value.source.sourceId)).toEqual(completed);
    const target = completed.handoff!.obligationKey;
    const raw = encoding === 'plain' ? json({ ...saved, obligationKey: target }) : duplicateRaw(target);
    db.prepare('UPDATE actual_foul_official_handoffs SET snapshot_json=?,snapshot_hash=? WHERE source_id=?')
      .run(raw, rawHash(raw), String(rival.source_id));
    expect(db.prepare('SELECT snapshot_hash FROM actual_foul_official_handoffs WHERE source_id=?').get(String(rival.source_id))!.snapshot_hash).toBe(rawHash(raw));
    const changed = foulEndLogicalBytes(db);
    expect(() => store.readCurrent(value.source.sourceId)).toThrow(/ownership|claim|obligation|handoff/);
    expect(foulEndLogicalBytes(db)).toBe(changed);
  } finally { db.prepare('DELETE FROM actual_foul_official_handoffs WHERE source_id=?').run(String(rival.source_id)); }
  expect(foulEndLogicalBytes(db)).toBe(original); expect(store.readCurrent(value.source.sourceId)).toEqual(completed);
}, 360_000);

it('preserves a peer WAL seal deletion during accepted intent capture and writes no call from a stale physical snapshot', () => {
  const s = source(); sessions.set(s.sourceId, s);
  let mutate = false, peerState: string | null = null;
  const peer = new DatabaseSync(path);
  try {
    const store = open(undefined, id => {
      const intent = intents.get(id) ?? null;
      if (mutate) {
        mutate = false; peer.prepare('DELETE FROM actual_live_play_fences WHERE closure_source_id=?').run(s.physicalEndReference.sourceId);
        peerState = foulEndLogicalBytes(peer);
      }
      return intent;
    });
    const initial = store.acceptSession(s.sourceId);
    if (initial.kind === 'intake_pending') throw new Error('contract requires an admitted official session');
    const intent = acceptedIntent(s), request = event(initial, { kind: 'record_call', intentSourceId: intent.sourceId });
    intents.set(intent.sourceId, intent); events.set(request.sourceId, request); mutate = true;
    expect(() => store.acceptEvent(request.sourceId)).toThrow(/actual foul.*(archive|fence|seal)|physical.*changed/i);
    expect(mutate).toBe(false); expect(peerState).not.toBeNull(); expect(foulEndLogicalBytes(db)).toBe(peerState);
  } finally { peer.close(); }
}, 240_000);

it('rolls back the fence event, head and handoff together when the handoff write fails', () => {
  const { store, value } = start(), called = call(store, value).value, s = event(called,
    { kind: 'next_pitch_fence', schedulerId: value.source.assignment.schedulerId }); events.set(s.sourceId, s);
  db.exec("CREATE TRIGGER reject_foul_handoff BEFORE INSERT ON actual_foul_official_handoffs BEGIN SELECT RAISE(ABORT,'contract handoff rollback'); END");
  const before = foulEndLogicalBytes(db);
  expect(() => store.acceptEvent(s.sourceId)).toThrow('contract handoff rollback'); expect(foulEndLogicalBytes(db)).toBe(before);
  db.exec('DROP TRIGGER reject_foul_handoff'); expect(store.acceptEvent(s.sourceId).handoff).not.toBeNull();
}, 300_000);

it('records the genuine bunt call but leaves its terminal official child pending and grants no ordinary continuation acknowledgement', () => {
  const f = fixtures[1]; use(f); const before = originals(), s = source(f), { store, value } = start(s);
  const called = call(store, value, acceptedIntent(s, f)), completed = fence(store, called.value), current = completed.value;
  expect(current.ledger).toEqual(expectedLedger(f, s, called.source.sourceId, completed.source.sourceId));
  expect(current.callIntent).toEqual(acceptedIntent(s, f)); expect(current.officialCount).toEqual(f.x.count.disposition);
  expect(current.kind).toBe('terminal_foul_application_pending'); expect(current.handoff).toBeNull();
  expect(current.officialObligation).toEqual(f.end.dispositionObligations.official);
  expect(getOfficialPlayClosure(current.ledger)).toBeNull(); expect(originals()).toBe(before);
}, 300_000);
