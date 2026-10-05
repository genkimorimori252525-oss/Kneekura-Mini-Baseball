import { expect, it } from 'vitest';
import { getOfficialStateWindows, getOfficialPlayClosure, closeOfficialPlay } from '../../core/adjudication/PlayAdjudicationLedger';
import { advanceTicks, decisionSource, eventSource, intentFixture, outRuling, requestReview,
  reviewApi, reviewFixture, safeRuling } from './ActualPostPlayReviewContract.test-support';

it('opens enabled windows at the owned physical end and keeps the v1 seed and original call unchanged', () => {
  const api = reviewApi(), fixture = reviewFixture({ challenge: true }), before = JSON.stringify(fixture.seed);
  const value = api.initialize(fixture);
  expect(value.cursor).toEqual({ originTick: 10, ticksPerSecond: 1000, tick: 4010, offsetTicks: 0 });
  expect(value.kind).toBe('official_pending');
  expect(getOfficialStateWindows(value.ledger)).toEqual([
    { windowId: 'review', windowKind: 'review', openedAtTick: 4010, closedAtTick: null, closeReason: null },
    { windowId: 'challenge', windowKind: 'challenge', openedAtTick: 4010, closedAtTick: null, closeReason: null },
  ]);
  expect(value.ledger.events.slice(0, fixture.seed.ledger.events.length)).toEqual(fixture.seed.ledger.events);
  expect(value.ledger.events.find(e => e.kind === 'OwnedLiveCallImported'))
    .toEqual(fixture.seed.ledger.events.find(e => e.kind === 'OwnedLiveCallImported'));
  expect(value.pendingReasons).not.toContain('official_window_owner_unavailable:review');
  expect(value.pendingReasons).not.toContain('official_window_owner_unavailable:challenge');
  expect(() => closeOfficialPlay(value.ledger, value.ledger.revision, { eventId: 'close', closureId: 'close', tick: 4010 })).toThrow(/window/);
  expect(JSON.stringify(fixture.seed)).toBe(before);
});

it('preserves unknown policies and never derives availability from an empty window array', () => {
  const api = reviewApi(), value = api.initialize(reviewFixture({ noOfficialPolicy: true }));
  expect(value.kind).toBe('official_pending');
  expect(value.pendingReasons).toEqual(expect.arrayContaining([
    'official_window_policy_unconfigured:review', 'official_window_policy_unconfigured:challenge',
  ]));
  expect(getOfficialStateWindows(value.ledger)).toEqual([]);
});

it('binds initialization to the authenticated seed Source and snapshot identity', () => {
  const api = reviewApi(), fixture = reviewFixture();
  for (const source of [
    { ...fixture.source, adjudicationSourceId: 'other-adjudication' },
    { ...fixture.source, adjudicationSnapshotHash: 'f'.repeat(64) },
  ]) expect(() => api.initialize({ ...fixture, source })).toThrow(/seed|adjudication|snapshot|hash/);
});

it('rejects a physical end whose epoch or quantized moment disagrees with the original import clock', () => {
  const api = reviewApi(), fixture = reviewFixture();
  for (const exactEnd of [
    { ...fixture.seed.exactEnd, originTick: fixture.seed.exactEnd.originTick + 1 },
    { ...fixture.seed.exactEnd, tick: fixture.seed.exactEnd.tick + 1 },
    { ...fixture.seed.exactEnd, elapsedSeconds: fixture.seed.exactEnd.elapsedSeconds + 1 },
  ]) expect(() => api.initialize({ ...fixture, seed: { ...fixture.seed, exactEnd } }))
    .toThrow(/clock|epoch|end|moment|tick/);
});

it('keeps an enabled opportunity pending when the physical-end trigger policy is missing', () => {
  const api = reviewApi(), value = api.initialize(reviewFixture({ noSessionPolicy: true }));
  expect(value.kind).toBe('official_pending');
  expect(value.pendingReasons).toContain('opening_event_unowned');
  expect(getOfficialStateWindows(value.ledger)).toEqual([]);
});

it('cannot omit a configured challenge opportunity from readiness by supplying only review entitlement', () => {
  const api = reviewApi(), fixture = reviewFixture({ challenge: true });
  fixture.source.policy!.opportunities = fixture.source.policy!.opportunities.filter(o => o.windowKind === 'review');
  const previous = api.initialize(fixture), intent = intentFixture('review', 'decline');
  const value = api.advance({ previous, source: eventSource(previous,
    { kind: 'decline', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }), intent });
  expect(value.kind).toBe('official_pending');
  expect(value.pendingReasons).toContain('official_window_entitlement_unowned:challenge');
});

it('cannot contradict an already explicit seed policy or registered appeal capability', () => {
  const api = reviewApi(), fixture = reviewFixture();
  expect(() => api.initialize({ ...fixture, source: { ...fixture.source, officialPolicy: { ...fixture.source.officialPolicy,
    officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } } } })).toThrow(/policy|profile/);
  expect(() => api.initialize({ ...fixture, source: { ...fixture.source, officialPolicy: { ...fixture.source.officialPolicy,
    officialWindows: { appeal: { available: false }, review: { available: true }, challenge: { available: false } } } } })).toThrow(/policy|profile/);
});

it('advances one original-scale tick only for the accepted scheduler and keeps non-clock commands at the current cursor', () => {
  const api = reviewApi(), initial = api.initialize(reviewFixture());
  const invalid = eventSource(initial, { kind: 'advance_tick', schedulerId: 'controller' });
  expect(() => api.advance({ previous: initial, source: invalid })).toThrow(/scheduler|authority/);
  const step = advanceTicks(api, initial, 1), requested = requestReview(api, step);
  expect(step.cursor).toEqual({ originTick: 10, ticksPerSecond: 1000, tick: 4011, offsetTicks: 1 });
  expect(requested.cursor).toEqual(step.cursor);
  expect(requested.events.at(-1)?.tick).toBe(4011);
  expect(requested.revision).toBe(step.revision + 1);
  expect(requested.seed.ledger.playEnd).toEqual(initial.seed.ledger.playEnd);
});

it('refuses forged parent hashes, stale revisions and unsafe clock overflow without changing the predecessor', () => {
  const api = reviewApi(), initial = api.initialize(reviewFixture()), before = JSON.stringify(initial);
  const source = eventSource(initial, { kind: 'advance_tick', schedulerId: 'scheduler' });
  expect(() => api.advance({ previous: initial, source: { ...source, expectedRevision: initial.revision + 1 } })).toThrow(/revision/);
  expect(() => api.advance({ previous: initial, source: { ...source, parent: { ...source.parent, snapshotHash: 'f'.repeat(64) } } })).toThrow(/parent|hash/);
  expect(JSON.stringify(initial)).toBe(before);
  const maximum = api.initialize(reviewFixture({ originTick: Number.MAX_SAFE_INTEGER - 4000, noDeadline: true }));
  expect(() => advanceTicks(api, maximum, 1)).toThrow(/overflow|safe integer/);
});

it('stamps a valid human request with executed provenance without making it manager learning evidence', () => {
  const api = reviewApi(), initial = advanceTicks(api, api.initialize(reviewFixture()), 2), value = requestReview(api, initial);
  const request = value.requests[0];
  expect(request).toMatchObject({ callId: 'call', windowId: 'review', tick: 4012, status: 'review_pending',
    intentSourceId: 'intent:review:request', attribution: { worldEvidence: { origin: 'HUMAN_OVERRIDE' }, managerSelfChosenEvidence: null } });
  expect(request.attribution?.worldEvidence.eventIds.length).toBeGreaterThan(0);
  expect(value.ledger.events.some(e => e.kind === 'ReviewDecisionRecorded')).toBe(false);
});

it('rejects mismatched call scope, entitlement and current control or appointment in request evidence', () => {
  const api = reviewApi(), previous = api.initialize(reviewFixture()), intent = intentFixture();
  const source = eventSource(previous, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId });
  for (const invalid of [
    { ...intent, callId: 'other-call' }, { ...intent, gameId: 'other-game' }, { ...intent, playId: 2 },
    { ...intent, physicalPitchSourceId: 'other-pitch' }, { ...intent, entitlementSourceId: 'other-entitlement' },
    { ...intent, opportunity: { ...intent.opportunity, clubId: 'other-club' } },
    { ...intent, submission: { ...intent.submission, expectedControlRevision: 1 } },
    { ...intent, submission: { ...intent.submission, expectedWorldRevision: 6 } },
    { ...intent, submission: { ...intent.submission, actionId: 'other-action' } },
    { ...intent, submission: { ...intent.submission, actor: { kind: 'MANAGER', managerId: 'manager', appointmentId: 'old-appointment', traceId: 'trace' } } },
  ]) expect(() => api.advance({ previous, source, intent: invalid })).toThrow();
});

it('keeps exact-deadline admission ambiguous even when a later scheduler event crosses the deadline', () => {
  const api = reviewApi(), equal = advanceTicks(api, api.initialize(reviewFixture()), 3);
  expect(equal.cursor.tick).toBe(4013);
  expect(getOfficialStateWindows(equal.ledger)[0].closedAtTick).toBeNull();
  const requested = requestReview(api, equal), later = advanceTicks(api, requested, 1);
  expect(requested.requests[0].status).toBe('timing_unresolved');
  expect(later.requests[0].status).toBe('timing_unresolved');
  expect(later.kind).toBe('official_pending');
  expect(getOfficialStateWindows(later.ledger)[0].closedAtTick).toBeNull();
  expect(later.ledger.events.some(e => e.kind === 'ReviewDecisionRecorded')).toBe(false);
});

it('expires an unrequested opportunity only after its explicit deadline and never resurrects a late request', () => {
  const api = reviewApi(), expired = advanceTicks(api, api.initialize(reviewFixture()), 4);
  expect(getOfficialStateWindows(expired.ledger)[0]).toMatchObject({ closedAtTick: 4014, closeReason: 'expired' });
  const late = requestReview(api, expired);
  expect(late.requests[0].status).toBe('expired');
  expect(late.ledger).toEqual(expired.ledger);
  expect(late.ledger.events.some(e => e.kind === 'ReviewDecisionRecorded')).toBe(false);
});

it('keeps timely requested review active past its deadline and through a next-play fence', () => {
  const api = reviewApi(), request = requestReview(api, advanceTicks(api, api.initialize(reviewFixture()), 2));
  const afterDeadline = advanceTicks(api, request, 3);
  const fenced = api.advance({ previous: afterDeadline,
    source: eventSource(afterDeadline, { kind: 'next_play_fence', schedulerId: 'scheduler' }) });
  expect(fenced.cursor.tick).toBe(4015);
  expect(fenced.kind).toBe('official_pending');
  expect(fenced.requests[0].status).toBe('review_pending');
  expect(getOfficialStateWindows(fenced.ledger)[0].closedAtTick).toBeNull();
  const decided = api.advance({ previous: fenced, source: decisionSource(fenced, 'stands') });
  expect(decided.kind).toBe('official_ready');
  expect(getOfficialStateWindows(decided.ledger)[0]).toMatchObject({ closedAtTick: 4015, closeReason: 'resolved' });
});

it('never invents an expiration or review decision from time progression without an explicit duration', () => {
  const api = reviewApi(), initial = api.initialize(reviewFixture({ truth: 'safe', noDeadline: true }));
  const later = advanceTicks(api, initial, 8);
  expect(later.kind).toBe('official_pending');
  expect(getOfficialStateWindows(later.ledger)[0].closedAtTick).toBeNull();
  expect(later.ledger.events.some(e => e.kind === 'ReviewDecisionRecorded')).toBe(false);
  expect(later.ledger.events.find(e => e.kind === 'OwnedLiveCallImported')).toMatchObject({ call: { ruling: outRuling } });
});

it('requires explicit per-window decline and retains the other enabled opportunity', () => {
  const api = reviewApi(), previous = api.initialize(reviewFixture({ challenge: true }));
  const intent = intentFixture('review', 'decline');
  const value = api.advance({ previous, source: eventSource(previous,
    { kind: 'decline', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }), intent });
  expect(value.kind).toBe('official_pending');
  expect(getOfficialStateWindows(value.ledger)).toMatchObject([
    { windowId: 'review', closedAtTick: 4010, closeReason: 'declined' }, { windowId: 'challenge', closedAtTick: null },
  ]);
});

it('will not decline or duplicate a request already accepted for review', () => {
  const api = reviewApi(), requested = requestReview(api, api.initialize(reviewFixture()));
  expect(() => requestReview(api, requested)).toThrow(/request|consum|duplicate/);
  const intent = intentFixture('review', 'decline');
  expect(() => api.advance({ previous: requested, source: eventSource(requested,
    { kind: 'decline', windowId: 'review', callId: 'call', intentSourceId: intent.sourceId }), intent })).toThrow(/request|declin/);
});

it('records an explicitly accepted stands decision over unresolved truth without changing that truth or the original call', () => {
  const api = reviewApi(), fixture = reviewFixture(), requested = requestReview(api, api.initialize(fixture));
  const decided = api.advance({ previous: requested, source: decisionSource(requested, 'stands') });
  const closed = closeOfficialPlay(decided.ledger, decided.ledger.revision, { eventId: 'close', closureId: 'close', tick: decided.cursor.tick });
  expect(getOfficialPlayClosure(closed)?.finalRuling).toMatchObject({ source: 'review', gameplay: outRuling, basisCallId: 'call' });
  expect(decided.ledger.events.filter(e => e.kind === 'UnresolvedCorrectRuleSnapshotRecorded'))
    .toEqual(fixture.seed.ledger.events.filter(e => e.kind === 'UnresolvedCorrectRuleSnapshotRecorded'));
  expect(decided.ledger.events.find(e => e.kind === 'OwnedLiveCallImported'))
    .toEqual(fixture.seed.ledger.events.find(e => e.kind === 'OwnedLiveCallImported'));
});

it('derives an explicitly requested overturn only from the authenticated resolved snapshot', () => {
  const api = reviewApi(), fixture = reviewFixture({ truth: 'safe' }), requested = requestReview(api, api.initialize(fixture));
  const decided = api.advance({ previous: requested, source: decisionSource(requested, 'overturned') });
  const review = decided.ledger.events.find(e => e.kind === 'ReviewDecisionRecorded');
  expect(review).toMatchObject({ review: { callId: 'call', decision: 'overturned', basisSnapshotId: 'actual_first_base_rule:rule',
    basisEvidenceRevision: 4, replacementRuling: safeRuling } });
  expect(decided.kind).toBe('official_ready');
  expect(decided.ledger.playEnd).toEqual(fixture.seed.ledger.playEnd);
  expect(decided.ledger.events.find(e => e.kind === 'OwnedLiveCallImported')).toMatchObject({ call: { ruling: outRuling } });
});

it('leaves an unresolved overturn pending without fabricating a replacement ruling or closing its window', () => {
  const api = reviewApi(), requested = requestReview(api, api.initialize(reviewFixture()));
  const value = api.advance({ previous: requested, source: decisionSource(requested, 'overturned') });
  expect(value.kind).toBe('official_pending');
  expect(value.pendingReasons).toContain('review_replacement_evidence_unresolved');
  expect(value.ledger).toEqual(requested.ledger);
  expect(value.requests[0].status).toBe('review_pending');
});

it('requires the assigned reviewer, original call and exact latest evidence basis', () => {
  const api = reviewApi(), fixture = reviewFixture({ truth: 'safe', laterSnapshot: true });
  const requested = requestReview(api, api.initialize(fixture)), source = decisionSource(requested, 'overturned', 5);
  expect(() => api.advance({ previous: requested, source: decisionSource(requested, 'overturned', 4) })).toThrow(/basis|snapshot|stale/);
  for (const fields of [{ reviewerId: 'other-official' }, { callId: 'other-call' }, { requestEventSourceId: 'unaccepted-request' }]) {
    expect(() => api.advance({ previous: requested, source: { ...source, action: { ...source.action, ...fields } } })).toThrow();
  }
  const value = api.advance({ previous: requested, source });
  expect(value.kind).toBe('official_ready');
  expect(value.pendingReasons).not.toContain('on_field_call_stale');
  expect(value.ledger.events.find(e => e.kind === 'OwnedLiveCallImported')).toMatchObject({ call: { basisEvidenceRevision: 4 } });
});

it('cannot clear a stale original call by expiration alone', () => {
  const api = reviewApi(), value = advanceTicks(api, api.initialize(reviewFixture({ laterSnapshot: true })), 4);
  expect(getOfficialStateWindows(value.ledger)[0].closeReason).toBe('expired');
  expect(value.kind).toBe('official_pending');
  expect(value.pendingReasons).toContain('on_field_call_stale');
});
