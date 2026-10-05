import { expect, it } from 'vitest';
import { intentFixture, reviewFixture, reviewSourceApi } from './ActualPostPlayReviewContract.test-support';

const schedulerEvent = () => ({ sourceId: 'step', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_event_v1',
  sessionSourceId: 'review-session', expectedRevision: 0,
  parent: { sourceId: 'review-session', snapshotHash: 'd'.repeat(64) },
  action: { kind: 'advance_tick', schedulerId: 'scheduler' } });

it('accepts an explicit physical-end trigger and scheduler identity without an opening timestamp', () => {
  const parse = reviewSourceApi().session, { source } = reviewFixture();
  expect(parse(source, source.sourceId)).toEqual(source);
  for (const key of ['openedAtTick', 'openedAt', 'exactEnd', 'playEnd', 'call', 'ledger', 'watermark']) {
    expect(() => parse({ ...source, [key]: 4010 }, source.sourceId)).toThrow();
  }
});

it('keeps absent session policy and absent official policy explicit', () => {
  const parse = reviewSourceApi().session;
  const { source } = reviewFixture({ noSessionPolicy: true, noOfficialPolicy: true });
  expect(parse(source, source.sourceId)).toMatchObject({ policy: null, officialPolicy: null });
});

it('rejects source identity mismatch and malformed seed snapshot references', () => {
  const parse = reviewSourceApi().session, { source } = reviewFixture();
  expect(() => parse(source, 'other-session')).toThrow();
  expect(() => parse({ ...source, adjudicationSnapshotHash: 'not-a-hash' }, source.sourceId)).toThrow();
  expect(() => parse({ ...source, adjudicationSourceId: ' adjudication' }, source.sourceId)).toThrow();
});

it('accepts exactly one scheduler tick action and rejects caller clock or watermark fields', () => {
  const parse = reviewSourceApi().event, source = schedulerEvent();
  expect(parse(source, source.sourceId)).toEqual(source);
  for (const key of ['tick', 'recordedAt', 'elapsedSeconds', 'deltaTicks', 'targetTick', 'settledThroughTick', 'watermark']) {
    expect(() => parse({ ...source, [key]: 999999 }, source.sourceId)).toThrow();
    expect(() => parse({ ...source, action: { ...source.action, [key]: 999999 } }, source.sourceId)).toThrow();
  }
});

it('rejects unsafe revisions, incomplete parents and cross-session source aliases', () => {
  const parse = reviewSourceApi().event, source = schedulerEvent();
  for (const expectedRevision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => parse({ ...source, expectedRevision }, source.sourceId)).toThrow();
  }
  expect(() => parse({ ...source, parent: { sourceId: 'review-session' } }, source.sourceId)).toThrow();
  expect(() => parse({ ...source, parent: { ...source.parent, snapshotHash: 'A'.repeat(64) } }, source.sourceId)).toThrow();
  expect(() => parse({ ...source, sessionSourceId: ' review-session' }, source.sourceId)).toThrow();
});

it('accepts only a selected intent and its explicit control opportunity, without decision time or outcome', () => {
  const parse = reviewSourceApi().intent, source = intentFixture();
  expect(parse(source, source.sourceId)).toEqual(source);
  for (const key of ['tick', 'requestedAt', 'origin', 'replacementRuling', 'outsAfter', 'basesAfter', 'receivedCall']) {
    expect(() => parse({ ...source, [key]: 1 }, source.sourceId)).toThrow();
  }
});

it('rejects arbitrary overturn placement or original-call replacement in an accepted decision', () => {
  const parse = reviewSourceApi().event, source = { ...schedulerEvent(), action: { kind: 'decision', windowId: 'review',
    requestEventSourceId: 'request', reviewId: 'decision', callId: 'call', reviewerId: 'review-official',
    basisSnapshotId: 'actual_first_base_rule:rule', basisEvidenceRevision: 4, decision: 'overturned' } };
  expect(parse(source, source.sourceId)).toEqual(source);
  for (const key of ['replacementRuling', 'basesAfter', 'outsAfter', 'scoredRunnerIds', 'originalCall', 'physicalEvents']) {
    expect(() => parse({ ...source, action: { ...source.action, [key]: {} } }, source.sourceId)).toThrow();
  }
});

it('snapshots inert accepted data and rejects getters without executing them', () => {
  const parse = reviewSourceApi().session, { source } = reviewFixture();
  const before = JSON.stringify(source), parsed = parse(source, source.sourceId);
  source.policy!.opportunities[0].requesterIds.push('later-mutation');
  expect(JSON.stringify(parsed)).toBe(before);
  let reads = 0;
  const hostile = Object.defineProperty({ ...source }, 'policy', { enumerable: true,
    get() { reads++; throw new Error('must not execute'); } });
  expect(() => parse(hostile, source.sourceId)).toThrow();
  expect(reads).toBe(0);
});
