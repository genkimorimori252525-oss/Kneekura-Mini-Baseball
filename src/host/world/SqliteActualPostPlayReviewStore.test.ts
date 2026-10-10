import * as appealRuling from './ActualPostPlayLiveAppealRuling';
import { getPlayAdjudicationState, recordCorrectRuleSnapshot, recordOnFieldCall } from '../../core/adjudication/PlayAdjudicationLedger';
import { expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import * as fieldStore from './SqliteBattedWorldFieldStore';
import { accepted, assertReviewFixtureConnectionsClosed, nativeReviewFactory, nativeReviewFixture } from './ActualPostPlayReviewNativeFixtures.test-support';
import { eventSource, decisionSource, reviewFixture } from './ActualPostPlayReviewContract.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteWorldControlStore } from './SqliteWorldControlStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { applyClubCommand } from '../../core/world/club';

// Physical-domain readers are mocked. SQLite, journal transactions, current
// control/Club owners, trigger rollback and close-all/reopen are real.
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

it.each(['adjudication', 'end'])('requires the actual %s owner before reserving the play', kind => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    x.db.prepare('DELETE FROM fixture_review_inputs WHERE kind=?').run(kind);
    expect(() => store.acceptSession(x.session.sourceId)).toThrow(/seed|adjudication|end|missing/);
    expect(x.rows().every(r => r.rows.length === 0)).toBe(true);
  } finally { store.close(); x.db.close(); }
});

it.each(['official_policy', 'opening_policy', 'entitlement'])('does not reserve incomplete %s intake and can later enroll the same seed/play', missing => {
  const x = nativeReviewFixture(missing === 'official_policy'), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const source = missing === 'opening_policy' ? { ...x.session, policy: null }
      : missing === 'entitlement' ? { ...x.session, policy: { ...x.session.policy!, opportunities: [] } } : x.session;
    x.sessions.set(source.sourceId, source);
    expect(store.acceptSession(source.sourceId).kind).toBe('intake_pending');
    expect(x.rows().every(r => r.rows.length === 0)).toBe(true);
    expect(store.readSession(source.sourceId)).toBeNull();
    const complete = { ...x.session, officialPolicy: reviewFixture({ noDeadline: true }).source.officialPolicy };
    x.sessions.set(source.sourceId, complete);
    const result = accepted(store.acceptSession(source.sourceId));
    expect(result.kind).toBe('official_pending');
    expect(x.rows().map(r => r.rows.length)).toEqual([1, 0, 1]);
    expect(store.acceptSession(source.sourceId)).toEqual({ kind: 'accepted', value: result });
  } finally { store.close(); x.db.close(); }
});

it('persists an original-call session and explicit official review across complete disk close/reopen', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(); let store = open(x.path, x.authority);
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId)), intent = x.official(); x.intents.set(intent.sourceId, intent);
    const request = { ...eventSource(initial, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }),
      action: { kind: 'official_request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId } };
    x.events.set(request.sourceId, request);
    const requested = accepted(store.acceptEvent(request.sourceId));
    expect(store.acceptEvent(request.sourceId)).toEqual({ kind: 'accepted', value: requested });
    const decision = decisionSource(requested, 'stands'); x.events.set(decision.sourceId, decision);
    const ready = accepted(store.acceptEvent(decision.sourceId));
    expect(ready.kind).toBe('official_ready'); expect(ready.requests[0].attribution).toBeNull();
    const before = x.rows(); store.close(); x.db.close();
    assertReviewFixtureConnectionsClosed();
    store = open(x.path); const check = new Database(x.path);
    try {
      expect(check.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
      expect(check.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(x.path);
      expect(store.readCurrent(x.session.sourceId)).toEqual(ready);
      expect(store.readAt(x.session.sourceId, 0)).toEqual(initial);
      expect(store.readAt(x.session.sourceId, requested.revision)).toEqual(requested);
      expect(store.acceptEvent(decision.sourceId)).toEqual({ kind: 'accepted', value: ready });
      for (const row of before) expect(check.prepare(`SELECT * FROM ${row.table} ORDER BY rowid`).all()).toEqual(row.rows);
    } finally { check.close(); }
  } finally { store.close(); if (x.db.isOpen) x.db.close(); }
});

it('requires actual current control and Club appointment for first Human adoption and preserves admitted history after control changes', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId)), intent = x.human(); x.intents.set(intent.sourceId, intent);
    const request = eventSource(initial, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId });
    x.events.set(request.sourceId, request);
    const adopted = accepted(store.acceptEvent(request.sourceId));
    expect(adopted.requests[0].attribution).toMatchObject({ worldEvidence: { origin: 'HUMAN_OVERRIDE' }, managerSelfChosenEvidence: null });
    const controls = openSqliteWorldControlStore(x.path);
    controls.changeControl({ careerId: 'career-a', expectedWorldRevision: 0,
      change: { expectedRevision: 0, controlledClubId: 'club-b', manualDomainIds: ['POST_PLAY_REVIEW'] } }); controls.close();
    expect(store.readAt(x.session.sourceId, adopted.revision)).toEqual(adopted);
    expect(store.acceptEvent(request.sourceId)).toEqual({ kind: 'accepted', value: adopted });
  } finally { store.close(); x.db.close(); }
});

it('rejects an already-stale Human control snapshot without consuming its intent or changing the head', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId)), intent = x.human(); x.intents.set(intent.sourceId, intent);
    const request = eventSource(initial, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }); x.events.set(request.sourceId, request);
    const controls = openSqliteWorldControlStore(x.path);
    controls.changeControl({ careerId: 'career-a', expectedWorldRevision: 0,
      change: { expectedRevision: 0, controlledClubId: 'club-b', manualDomainIds: ['POST_PLAY_REVIEW'] } }); controls.close();
    const before = x.rows();
    expect(() => store.acceptEvent(request.sourceId)).toThrow(/control|revision|authority/);
    expect(x.rows()).toEqual(before);
  } finally { store.close(); x.db.close(); }
});

it('does not adopt caller-only Manager traceId or manufacture review-domain selection from a ROSTER label', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId)), human = x.human();
    const controls = openSqliteWorldControlStore(x.path);
    const current = controls.changeControl({ careerId: 'career-a', expectedWorldRevision: 0,
      change: { expectedRevision: 0, controlledClubId: 'club-a', manualDomainIds: [] } }); controls.close();
    const intent = { ...human, control: current.control, opportunity: { ...human.opportunity, worldRevision: current.worldRevision },
      submission: { ...human.submission, expectedControlRevision: current.control.revision, expectedWorldRevision: current.worldRevision,
        actor: { kind: 'MANAGER', managerId: 'manager-a', appointmentId: 'appointment-a', traceId: 'caller-or-roster-trace' } } };
    x.intents.set(intent.sourceId, intent);
    const request = eventSource(initial, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }); x.events.set(request.sourceId, request);
    const before = x.rows();
    expect(store.acceptEvent(request.sourceId)).toEqual({ kind: 'intent_pending', sourceId: request.sourceId, reason: 'manager_review_selection_unavailable' });
    expect(x.rows()).toEqual(before); expect(store.readEvent(request.sourceId)).toBeNull();
  } finally { store.close(); x.db.close(); }
});

it('rejects a stale manager appointment even when the Human controller and control revision remain current', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId)), intent = x.human(); x.intents.set(intent.sourceId, intent);
    const request = eventSource(initial, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }); x.events.set(request.sourceId, request);
    const changed = applyClubCommand(x.home, { eventId: 'new-appointment', careerId: 'career-a', clubId: 'club-a',
      expectedRevision: x.home.revision, effectiveDay: x.home.effectiveDay, causeEventIds: ['accepted-appointment'],
      operations: [{ kind: 'UPDATE_REFERENCES', references: { ...x.home.live.references,
        staffRoleLinks: [{ roleId: 'manager', roleKind: 'MANAGER', personId: 'manager-a', appointmentId: 'new-appointment' }] } }] });
    expect(changed.ok).toBe(true); if (!changed.ok) throw new Error('fixture appointment failed');
    x.db.prepare("UPDATE world_club_heads SET revision=?,state_json=? WHERE career_id='career-a' AND club_id='club-a'")
      .run(changed.state.revision, json(changed.state));
    const before = x.rows();
    expect(() => store.acceptEvent(request.sourceId)).toThrow(/appointment|manager|Club|club/);
    expect(x.rows()).toEqual(before);
  } finally { store.close(); x.db.close(); }
});

it('rejects an entitlement for a same-career Club that is not the original fixture side', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const foreign = x.makeClub('foreign-club', 'foreign-manager', 'foreign-appointment');
    x.db.prepare('INSERT INTO world_club_heads VALUES(?,?,?,?)').run('career-a', 'foreign-club', foreign.revision, json(foreign));
    x.sessions.set(x.session.sourceId, { ...x.session, policy: { ...x.session.policy!,
      opportunities: x.session.policy!.opportunities.map(o => ({ ...o, clubId: 'foreign-club' })) } });
    expect(() => store.acceptSession(x.session.sourceId)).toThrow(/fixture|side/);
    expect(x.rows().every(r => r.rows.length === 0)).toBe(true);
  } finally { store.close(); x.db.close(); }
});

it('retains bounded history but rejects using its old revision as a new write parent', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId));
    const first = eventSource(initial, { kind: 'advance_tick', schedulerId: 'scheduler' }); x.events.set(first.sourceId, first);
    const current = accepted(store.acceptEvent(first.sourceId));
    const stale = eventSource(initial, { kind: 'advance_tick', schedulerId: 'scheduler' }, 'stale-parent'); x.events.set(stale.sourceId, stale);
    const before = x.rows();
    expect(store.readAt(x.session.sourceId, 0)).toEqual(initial);
    expect(() => store.acceptEvent(stale.sourceId)).toThrow(/revision|parent|head|stale/);
    expect(x.rows()).toEqual(before); expect(store.readCurrent(x.session.sourceId)).toEqual(current);
  } finally { store.close(); x.db.close(); }
});

it('rejects an event hidden under a different column identity while its raw Source still claims the accepted ID', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId));
    const step = eventSource(initial, { kind: 'advance_tick', schedulerId: 'scheduler' }); x.events.set(step.sourceId, step);
    accepted(store.acceptEvent(step.sourceId));
    x.db.prepare('UPDATE actual_post_play_review_events SET source_id=? WHERE source_id=?').run('hidden-alias', step.sourceId);
    expect(() => store.readEvent(step.sourceId)).toThrow(/identity|Source|owner|mirror/);
    expect(() => store.readCurrent(x.session.sourceId)).toThrow();
  } finally { store.close(); x.db.close(); }
});

it('rolls back a real post-INSERT control mutation after witnessing the journal write', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), store = open(x.path, x.authority);
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId)), intent = x.human(); x.intents.set(intent.sourceId, intent);
    const request = eventSource(initial, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }); x.events.set(request.sourceId, request);
    const before = x.rows(), controlBefore = x.db.prepare('SELECT * FROM world_control_heads').all();
    x.db.exec("CREATE TRIGGER corrupt_review_control AFTER INSERT ON actual_post_play_review_events BEGIN UPDATE world_control_heads SET control_revision=control_revision+1 WHERE career_id='career-a'; END;");
    const witness = witnessSqliteWrite('INSERT INTO actual_post_play_review_events VALUES(?,?,?,?,?,?,?,?,?,?,?)', db =>
      db.prepare('SELECT count(*) AS n FROM actual_post_play_review_events WHERE source_id=?').get(request.sourceId)?.n === 1
      && db.prepare("SELECT control_revision FROM world_control_heads WHERE career_id='career-a'").get()?.control_revision === 1);
    try { expect(() => store.acceptEvent(request.sourceId)).toThrow(/control|authority|changed/); expect(witness.wasReached()).toBe(true); }
    finally { witness.close(); }
    expect(x.rows()).toEqual(before); expect(x.db.prepare('SELECT * FROM world_control_heads').all()).toEqual(controlBefore);
    x.db.exec('DROP TRIGGER corrupt_review_control');
    expect(accepted(store.acceptEvent(request.sourceId)).requests[0].status).toBe('review_pending');
  } finally { store.close(); x.db.close(); }
});

it('rejects a changed accepted Source callback without leaving a partial event/head', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(); let reads = 0;
  const store = open(x.path, { ...x.authority, readAcceptedEvent: id => {
    const source = x.events.get(id); reads++;
    return reads > 1 && source ? { ...(source as object), sourceVersion: 'changed-after-preflight' } : source ?? null;
  } });
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId));
    const step = eventSource(initial, { kind: 'advance_tick', schedulerId: 'scheduler' }); x.events.set(step.sourceId, step);
    const before = x.rows();
    expect(() => store.acceptEvent(step.sourceId)).toThrow(/Source|changed|frozen/); expect(x.rows()).toEqual(before);
    expect(json(store.readCurrent(x.session.sourceId))).toBe(json(initial));
  } finally { store.close(); x.db.close(); }
});


it('public appeal acceptance loads, freezes and persists its exact official intent', () => {
  const x = nativeReviewFixture(), open = nativeReviewFactory(), readIntent = vi.fn(x.authority.readAcceptedIntent);
  let store = open(x.path, { ...x.authority, readAcceptedIntent: readIntent });
  // This test isolates the public journal/authority boundary. Physical appeal
  // composition is a controlled seam; SQLite, official authority, reducer,
  // accepted callbacks, transaction pins and stored intent replay remain real.
  const consume = vi.spyOn(appealRuling, 'acceptPostPlayLiveAppealResult').mockImplementation((previous, source) => {
    const state = getPlayAdjudicationState(previous.ledger);
    if (state.kind !== 'official_adjudication_open') throw new Error('fixture ledger closed');
    const snapshotId = source.sourceId + ':fixture-snapshot', evidenceRevision = state.latestCorrectRule.evidenceRevision + 1;
    const ruling = state.calls[0].ruling;
    const ruled = recordCorrectRuleSnapshot(previous.ledger, previous.ledger.revision, { eventId: source.sourceId + ':fixture-rule',
      tick: previous.cursor.tick, snapshotId, evidenceRevision, ruling });
    return recordOnFieldCall(ruled, ruled.revision, { eventId: source.sourceId + ':fixture-call-event', callId: source.sourceId + ':fixture-call',
      tick: previous.cursor.tick, basisSnapshotId: snapshotId, basisEvidenceRevision: evidenceRevision, ruling });
  });
  try {
    const initial = accepted(store.acceptSession(x.session.sourceId)), state = getPlayAdjudicationState(initial.ledger);
    if (state.kind !== 'official_adjudication_open') throw new Error('fixture initial ledger closed');
    const executionReferences = [{ owner: 'pa_physical_v1_field_steps', sourceId: 'original-execution', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) }];
    const intent = { ...x.official(), sourceId: 'accepted-appeal-intent', action: 'accept_live_appeal_result', executionReferences,
      basisSnapshotId: state.latestCorrectRule.snapshotId, basisEvidenceRevision: state.latestCorrectRule.evidenceRevision };
    const source = { sourceId: 'accepted-appeal-event', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_event_v1',
      sessionSourceId: initial.source.sourceId, expectedRevision: initial.revision,
      parent: { sourceId: initial.headSourceId, snapshotHash: initial.headHash }, action: { kind: 'accept_live_appeal_result',
        executionReferences, callId: intent.callId, windowId: intent.windowId, intentSourceId: intent.sourceId,
        basisSnapshotId: intent.basisSnapshotId, basisEvidenceRevision: intent.basisEvidenceRevision } };
    x.events.set(source.sourceId, source);
    const before = x.rows();
    expect(() => store.acceptEvent(source.sourceId)).toThrow(/intent/);
    expect(x.rows()).toEqual(before); expect(consume).not.toHaveBeenCalled();
    x.intents.set(intent.sourceId, intent);
    const result = accepted(store.acceptEvent(source.sourceId));
    expect(result.kind).toBe('official_ready');
    expect(readIntent.mock.calls.every(([id]) => id === intent.sourceId)).toBe(true);
    const saved = x.db.prepare('SELECT intent_json,admission_json FROM actual_post_play_review_events WHERE source_id=?').get(source.sourceId)!;
    expect(saved.intent_json).toBe(json(intent));
    expect(JSON.parse(String(saved.admission_json))).toMatchObject({ kind: 'official', actorId: intent.officialId });
    x.intents.set(intent.sourceId, { ...intent, sourceVersion: 'changed' });
    const adopted = x.rows();
    expect(() => store.acceptEvent(source.sourceId)).toThrow(/intent.*frozen differently/);
    expect(x.rows()).toEqual(adopted);
    store.close(); x.db.close(); assertReviewFixtureConnectionsClosed();
    store = open(x.path);
    expect(store.readCurrent(initial.source.sourceId)).toEqual(result);
    expect(store.acceptEvent(source.sourceId)).toEqual({ kind: 'accepted', value: result });
  } finally { store.close(); if (x.db.isOpen) x.db.close(); consume.mockRestore(); }
});
