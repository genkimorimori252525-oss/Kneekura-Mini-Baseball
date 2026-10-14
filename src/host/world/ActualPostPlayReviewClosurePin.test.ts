import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import type { PlayAdjudicationLedger } from '../../core/adjudication/PlayAdjudicationLedger';
import * as closure from './ActualLivePlayClosureEvidenceFromSqlite';
import * as fieldStore from './SqliteBattedWorldFieldStore';
import { actualLivePlayClosureInput } from './ActualLivePlayClosureSource';
import { accepted, assertReviewFixtureConnectionsClosed, nativeReviewFactory, nativeReviewFixture,
  type NativeReviewStore } from './ActualPostPlayReviewNativeFixtures.test-support';
import { decisionSource, eventSource, type ReviewProjection } from './ActualPostPlayReviewContract.test-support';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// This is the same focused Native boundary as the journal contracts. Physical
// readers are mocked; the journal/control/Club/SQLite/reopen owners are real.
// A selected ledger is not proof of a full physical-to-official application.
vi.mock('./ActualLiveAdjudicationFromSqlite', () => ({ actualLiveAdjudicationEvidenceFromSqlite: (db: DatabaseSync) => ({
  read: (id: string) => { const row = db.prepare("SELECT value_json FROM fixture_review_inputs WHERE kind='adjudication' AND source_id=?").get(id);
    return row ? JSON.parse(String(row.value_json)) : null; },
}) }));
vi.mock('./SqliteActualFirstBasePlayEndStore', () => ({ actualFirstBaseClosedEvidenceFromSqlite: (db: DatabaseSync) => ({
  read: (id: string) => { const row = db.prepare("SELECT value_json FROM fixture_review_inputs WHERE kind='end' AND source_id=?").get(id);
    return row ? JSON.parse(String(row.value_json)) : null; },
  reference: (id: string) => { const row = db.prepare("SELECT reference_json FROM fixture_review_inputs WHERE kind='end' AND source_id=?").get(id);
    return row ? JSON.parse(String(row.reference_json)) : null; },
}) }));
vi.spyOn(fieldStore, 'battedWorldFieldEvidenceFromSqlite').mockImplementation(db => ({
  read: (id: string) => { const row = db.prepare("SELECT value_json FROM fixture_review_inputs WHERE kind='field' AND source_id=?").get(id);
    return row ? JSON.parse(String(row.value_json)) : null; },
}) as ReturnType<typeof fieldStore.battedWorldFieldEvidenceFromSqlite>);
const { DatabaseSync: Database } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const parseClosure = actualLivePlayClosureInput as (raw: unknown, sourceId: string) => unknown;
type Pin = Readonly<{ sessionSourceId: string; revision: number; headSourceId: string; headHash: string }>;
const pin = (value: ReviewProjection): Pin => ({ sessionSourceId: value.source.sourceId, revision: value.revision,
  headSourceId: value.headSourceId, headHash: value.headHash });
const source = (value?: ReviewProjection) => ({ sourceId: 'closure', sourceVersion: 'fixture-v1', adjudicationSourceId: 'adjudication',
  applicationId: 'apply', closureTick: value?.cursor.tick ?? 4010, nextStartedAtTick: (value?.cursor.tick ?? 4010) + 1,
  controllerReset: 'rule_system_retire_original_play' as const,
  worldSetup: { baseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } },
    defenders: [], activePreviousPlayControllerIds: [] }, ...(value ? { postPlayReviewReference: pin(value) } : {}) });
type Selection = Readonly<{ adjudication: unknown; ledger: PlayAdjudicationLedger; postPlayReviewReference?: Pin }>;
const selector = () => {
  const fn = (closure as unknown as Record<string, unknown>).deriveActualLiveClosureAdjudication;
  expect(fn, 'Native pinned post-play closure ledger selector').toBeTypeOf('function');
  return fn as (db: Pick<DatabaseSync, 'prepare'>, input: unknown) => Selection;
};
type Fixture = ReturnType<typeof nativeReviewFixture>;
const request = (x: Fixture, store: NativeReviewStore, previous: ReviewProjection) => {
  const intent = x.official(); x.intents.set(intent.sourceId, intent);
  const command = { ...eventSource(previous, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }),
    action: { kind: 'official_request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId } };
  x.events.set(command.sourceId, command); return accepted(store.acceptEvent(command.sourceId));
};
const resolve = (x: Fixture, store: NativeReviewStore) => {
  const initial = accepted(store.acceptSession(x.session.sourceId)), pending = request(x, store, initial);
  const decision = decisionSource(pending, 'stands'); x.events.set(decision.sourceId, decision);
  const ready = accepted(store.acceptEvent(decision.sourceId)); expect(ready.kind).toBe('official_ready'); return ready;
};

it('preserves the exact legacy closure Source and its hash when the optional pin is omitted', () => {
  const legacy = source(), bytes = json(legacy), digest = hash(legacy);
  expect(json(parseClosure(legacy, legacy.sourceId))).toBe(bytes);
  expect(hash(parseClosure(legacy, legacy.sourceId))).toBe(digest);
});

it('accepts the exact optional session revision, head Source and head hash in a closure Source', () => {
  const selected = { ...source(), postPlayReviewReference: { sessionSourceId: 'session', revision: 2,
    headSourceId: 'decision', headHash: 'a'.repeat(64) } };
  expect(parseClosure(selected, selected.sourceId)).toEqual(selected);
});

it('rejects null, partial, extra-field or malformed pins without accepting ledger or readiness fields', () => {
  const complete = { sessionSourceId: 'session', revision: 2, headSourceId: 'decision', headHash: 'a'.repeat(64) };
  const pins = [null, {}, { ...complete, revision: -1 }, { ...complete, revision: 0.5 },
    { ...complete, headHash: 'unhashed' }, { ...complete, sessionSourceId: ' session' },
    { ...complete, ready: true }, { ...complete, ledger: {} }];
  for (const invalid of pins) expect(() => parseClosure({ ...source(), postPlayReviewReference: invalid }, 'closure')).toThrow();
});

it('requires the named persisted Native session even when a caller supplies plausible pin fields', () => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    const select = selector(), before = x.rows();
    expect(() => select(x.db, { ...source(), postPlayReviewReference: { sessionSourceId: x.session.sourceId,
      revision: 0, headSourceId: x.session.sourceId, headHash: 'a'.repeat(64) } })).toThrow(/review|session|missing/);
    expect(x.rows()).toEqual(before);
  } finally { store.close(); x.db.close(); }
});

it.each(['open', 'review_pending', 'timing_unresolved'])('cannot close a pinned %s review state', state => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    let value = accepted(store.acceptSession(x.session.sourceId));
    if (state === 'timing_unresolved') {
      const intent = x.human('decline'); x.intents.set(intent.sourceId, intent);
      const command = eventSource(value, { kind: 'decline', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId });
      x.events.set(command.sourceId, command); value = accepted(store.acceptEvent(command.sourceId));
    }
    if (state !== 'open') { value = request(x, store, value); expect(value.requests[0].status).toBe(state); }
    expect(value.kind).toBe('official_pending'); const select = selector(), before = x.rows();
    expect(() => select(x.db, source(value))).toThrow(/pending|unresolved|open/);
    expect(x.rows()).toEqual(before);
  } finally { store.close(); x.db.close(); }
});

it('selects the exact resolved ledger and original seed/call across closing every disk connection', () => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    const ready = resolve(x, store), select = selector(), selected = select(x.db, source(ready)), before = x.rows();
    expect(selected).toEqual({ adjudication: x.adjudication, ledger: ready.ledger, postPlayReviewReference: pin(ready) });
    expect(json(selected.ledger.events.filter(e => e.kind === 'OwnedLiveCallImported')))
      .toBe(json(x.adjudication.ledger.events.filter(e => e.kind === 'OwnedLiveCallImported')));
    store.close(); x.db.close(); assertReviewFixtureConnectionsClosed();
    const reopened = new Database(x.path);
    try {
      expect(reopened.prepare('PRAGMA database_list').all().find(row => row.name === 'main')!.file).toBe(x.path);
      expect(select(reopened, source(ready))).toEqual(selected);
      for (const row of before) expect(reopened.prepare(`SELECT * FROM ${row.table} ORDER BY rowid`).all()).toEqual(row.rows);
    } finally { reopened.close(); }
  } finally { store.close(); if (x.db.isOpen) x.db.close(); }
});

it.each(['revision', 'headSourceId', 'headHash'])('rejects a mismatching %s closure pin without changing the journal', component => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    const ready = resolve(x, store), select = selector(), before = x.rows();
    const changed = { ...pin(ready), [component]: component === 'revision' ? ready.revision - 1 : component === 'headHash' ? 'a'.repeat(64) : 'foreign-head' };
    expect(() => select(x.db, { ...source(ready), postPlayReviewReference: changed })).toThrow(/pin|revision|head|reference/);
    expect(x.rows()).toEqual(before);
  } finally { store.close(); x.db.close(); }
});

it.each(['pending', 'resolved'])('cannot omit the optional pin to bypass an enrolled %s owner', state => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    if (state === 'pending') accepted(store.acceptSession(x.session.sourceId)); else resolve(x, store);
    const select = selector(), before = x.rows();
    expect(() => select(x.db, source())).toThrow(/review|pin|reference/);
    expect(x.rows()).toEqual(before);
  } finally { store.close(); x.db.close(); }
});

it('rejects a historically ready pin after a later accepted scheduler revision and accepts only the current pin', () => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    const ready = resolve(x, store), step = eventSource(ready, { kind: 'advance_tick', schedulerId: 'scheduler' });
    x.events.set(step.sourceId, step); const current = accepted(store.acceptEvent(step.sourceId)), select = selector();
    expect(store.readAt(x.session.sourceId, ready.revision)).toEqual(ready);
    expect(() => select(x.db, source(ready))).toThrow(/pin|revision|head|current/);
    expect(select(x.db, source(current)).ledger).toEqual(current.ledger);
  } finally { store.close(); x.db.close(); }
});

it('refuses a closure tick before the authenticated journal cursor', () => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    const ready = resolve(x, store), select = selector();
    expect(() => select(x.db, { ...source(ready), closureTick: ready.cursor.tick - 1 })).toThrow(/tick|cursor|precedes/);
  } finally { store.close(); x.db.close(); }
});

it('does not substitute a different seed for the pinned session', () => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    const ready = resolve(x, store), select = selector();
    x.db.prepare('INSERT INTO fixture_review_inputs VALUES(?,?,?,NULL)').run('adjudication', 'foreign-seed',
      json({ ...x.adjudication, source: { ...x.adjudication.source, sourceId: 'foreign-seed' } }));
    expect(() => select(x.db, { ...source(ready), adjudicationSourceId: 'foreign-seed' })).toThrow(/seed|adjudication|scope/);
  } finally { store.close(); x.db.close(); }
});

it('retains the selected archive while a queued closure reservation prevents further journal adoption', () => {
  const x = nativeReviewFixture(), store = nativeReviewFactory()(x.path, x.authority);
  try {
    const ready = resolve(x, store), select = selector(), selected = select(x.db, source(ready));
    // Synthetic reservation metadata exercises the reverse write fence. This
    // does not claim that an actual closure/application has been enqueued.
    x.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT PRIMARY KEY,game_id TEXT,play_id INTEGER,source_json TEXT,proposal_json TEXT)');
    x.db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?,?,?)').run('closure', 'game', 1, json(source(ready)),
      json({ gameId: 'game', playId: 1, adjudicationReference: { sourceId: 'adjudication' } }));
    const step = eventSource(ready, { kind: 'advance_tick', schedulerId: 'scheduler' }); x.events.set(step.sourceId, step);
    const before = x.rows();
    expect(() => store.acceptEvent(step.sourceId)).toThrow(/closure|reserved/);
    expect(x.rows()).toEqual(before); expect(select(x.db, source(ready))).toEqual(selected);
  } finally { store.close(); x.db.close(); }
});
