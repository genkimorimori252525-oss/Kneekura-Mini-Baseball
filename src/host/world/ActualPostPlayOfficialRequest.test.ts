import { expect, it } from 'vitest';
import { getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { advanceTicks, decisionSource, eventSource, intentFixture, reviewApi, reviewFixture,
  reviewSourceApi, type ReviewProjection } from './ActualPostPlayReviewContract.test-support';

const fixture = () => {
  const value = reviewFixture({ noDeadline: true });
  value.source.policy!.opportunities[0].requesterIds = ['review-official'];
  return value;
};
const officialIntent = () => ({
  sourceId: 'official-intent:request', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_official_intent_v1',
  sessionSourceId: 'review-session', gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch',
  callId: 'call', windowId: 'review', entitlementSourceId: 'entitlement:review', officialId: 'review-official', action: 'request',
});
const officialSource = (previous: ReviewProjection, intentSourceId = 'official-intent:request') => ({
  ...eventSource(previous, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId }),
  action: { kind: 'official_request', windowId: 'review', callId: 'call', intentSourceId },
});
const acceptOfficial = (previous: ReviewProjection) => {
  const api = reviewApi(); let result: ReviewProjection | undefined;
  expect(() => { result = api.advance({ previous, source: officialSource(previous), intent: officialIntent() }); })
    .not.toThrow();
  expect(result).toBeDefined();
  return result!;
};

it('accepts a distinct assigned-official intent without human control or manager attribution fields', () => {
  const parse = reviewSourceApi().intent, source = officialIntent();
  expect(() => parse(source, source.sourceId)).not.toThrow();
  expect(parse(source, source.sourceId)).toEqual(source);
  for (const key of ['control', 'submission', 'opportunity', 'managerId', 'controllerId', 'origin', 'tick', 'receivedAt']) {
    expect(() => parse({ ...source, [key]: {} }, source.sourceId)).toThrow();
  }
});

it('accepts the explicit official request action while rejecting scheduler or time injection', () => {
  const api = reviewApi(), previous = api.initialize(fixture()), parse = reviewSourceApi().event;
  const source = officialSource(previous);
  expect(() => parse(source, source.sourceId)).not.toThrow();
  expect(parse(source, source.sourceId)).toEqual(source);
  for (const key of ['schedulerId', 'tick', 'deltaTicks', 'replacementRuling']) {
    expect(() => parse({ ...source, action: { ...source.action, [key]: 1 } }, source.sourceId)).toThrow();
  }
});

it('stamps an assigned-official request at the journal cursor with null decision attribution', () => {
  const api = reviewApi(), initial = advanceTicks(api, api.initialize(fixture()), 2), value = acceptOfficial(initial);
  expect(value.requests[0]).toMatchObject({ windowId: 'review', callId: 'call', tick: 4012,
    status: 'review_pending', intentSourceId: 'official-intent:request', attribution: null });
  expect(value.events.at(-1)?.tick).toBe(4012);
  expect(value.ledger.events.some(e => e.kind === 'ReviewDecisionRecorded')).toBe(false);
});

it('requires both explicit request entitlement and assigned-review-official membership', () => {
  const api = reviewApi(), accepted = api.initialize(fixture());
  acceptOfficial(accepted);
  for (const field of ['requesterIds', 'reviewerIds'] as const) {
    const input = fixture(); input.source.policy!.opportunities[0][field] = ['someone-else'];
    const previous = api.initialize(input);
    expect(() => api.advance({ previous, source: officialSource(previous), intent: officialIntent() })).toThrow(/official|entitle|assign/);
  }
});

it('binds official intent scope, exact entitlement and selected action without a manager fallback', () => {
  const api = reviewApi(), previous = api.initialize(fixture());
  acceptOfficial(previous);
  const original = officialIntent();
  for (const invalid of [
    { ...original, gameId: 'foreign' }, { ...original, playId: 2 }, { ...original, physicalPitchSourceId: 'foreign' },
    { ...original, callId: 'foreign' }, { ...original, windowId: 'foreign' }, { ...original, sessionSourceId: 'foreign' },
    { ...original, entitlementSourceId: 'foreign' }, { ...original, action: 'decline' },
  ]) expect(() => api.advance({ previous, source: officialSource(previous), intent: invalid })).toThrow();
});

it('rejects controlled intent in an official action and official intent in a controlled action', () => {
  const api = reviewApi(), previous = api.initialize(fixture());
  acceptOfficial(previous);
  const controlled = intentFixture();
  expect(() => api.advance({ previous, source: officialSource(previous, controlled.sourceId), intent: controlled })).toThrow(/official|intent|capability/);
  const source = eventSource(previous, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: officialIntent().sourceId });
  expect(() => api.advance({ previous, source, intent: officialIntent() })).toThrow(/controlled|intent|capability/);
});

it('requires an explicit review decision after the official request and retains null attribution', () => {
  const api = reviewApi(), previous = acceptOfficial(api.initialize(fixture()));
  const value = api.advance({ previous, source: decisionSource(previous, 'stands') });
  expect(value.kind).toBe('official_ready');
  expect(value.requests[0]).toMatchObject({ status: 'resolved', attribution: null });
  expect(getOfficialStateWindows(value.ledger)[0].closeReason).toBe('resolved');
});

it('keeps an official request at the decline tick unresolved after later scheduler progression', () => {
  const api = reviewApi(), input = fixture();
  input.source.policy!.opportunities[0].requesterIds.push('controller');
  const initial = api.initialize(input), decline = intentFixture('review', 'decline');
  const declined = api.advance({ previous: initial,
    source: eventSource(initial, { kind: 'decline', windowId: 'review', callId: 'call', intentSourceId: decline.sourceId }), intent: decline });
  const requested = acceptOfficial(declined), later = advanceTicks(api, requested, 1);
  expect(requested.kind).toBe('official_pending');
  expect(requested.requests[0]).toMatchObject({ status: 'timing_unresolved', attribution: null });
  expect(later.kind).toBe('official_pending');
  expect(later.requests[0].status).toBe('timing_unresolved');
});

it('keeps the existing controlled request at the decline tick unresolved after later scheduler progression', () => {
  const api = reviewApi(), initial = api.initialize(reviewFixture({ noDeadline: true })), decline = intentFixture('review', 'decline');
  const declined = api.advance({ previous: initial,
    source: eventSource(initial, { kind: 'decline', windowId: 'review', callId: 'call', intentSourceId: decline.sourceId }), intent: decline });
  const request = intentFixture(), requested = api.advance({ previous: declined,
    source: eventSource(declined, { kind: 'request', windowId: 'review', callId: 'call', intentSourceId: request.sourceId }), intent: request });
  expect(requested.kind).toBe('official_pending');
  expect(requested.requests[0].status).toBe('timing_unresolved');
  const later = advanceTicks(api, requested, 1);
  expect(later.kind).toBe('official_pending');
  expect(later.requests[0].status).toBe('timing_unresolved');
});
