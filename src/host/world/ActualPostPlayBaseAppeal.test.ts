import { expect, it } from 'vitest';
import { actualPostPlayReviewSessionInput, actualPostPlayReviewEventInput } from './ActualPostPlayReviewSource';
import { initializeActualPostPlayReview, advanceActualPostPlayReview } from './ActualPostPlayReview';
import { reviewFixture } from './ActualPostPlayReviewContract.test-support';
import { getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { createRequire } from 'node:module';
import { createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../../core/rules/PhysicalRuleFacts';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { capturePostPlayBaseAppeal } from './ActualPostPlayBaseAppealFromSqlite';

const initial = () => {
  const f = reviewFixture({ truth: 'safe' });
  return initializeActualPostPlayReview({ ...f, source: { ...f.source, baseAppealMode: 'original_catch_end_v1' } });
};
const action = { kind: 'defender_base_appeal', defenderId: 'fielder', runnerId: 'runner', base: 'first' } as const;
const event = (previous: ReturnType<typeof initial>, a: unknown = action) => ({ sourceId: 'appeal-event', sourceVersion: 'test',
  capability: 'actual_post_play_review_event_v1', sessionSourceId: previous.source.sourceId, expectedRevision: previous.revision,
  parent: { sourceId: previous.headSourceId, snapshotHash: previous.headHash }, action: a });
it('BPA01 accepts a targeted appeal indication and opens only its registered original appeal window', () => {
  const f = reviewFixture(), source = { ...f.source, baseAppealMode: 'original_catch_end_v1' };
  expect(actualPostPlayReviewSessionInput(source, source.sourceId)).toEqual(source);
  const previous = initial(); expect(actualPostPlayReviewEventInput(event(previous), 'appeal-event').action).toEqual(action);
  expect(getOfficialStateWindows(previous.ledger).find(w => w.windowKind === 'appeal')).toMatchObject({
    windowId: previous.source.sourceId + ':base-appeal', openedAtTick: previous.seed.exactEnd.tick, closedAtTick: null });
});
it('BPA02 an accepted indication alone cannot produce an executed appeal or mutate the ledger', () => {
  const previous = initial();
  expect(() => advanceActualPostPlayReview({ previous, source: event(previous) })).toThrow(/physical.*appeal|appeal.*physical/);
  expect(previous.ledger.events.some(e => e.kind === 'DefensiveAppealAttemptRecorded')).toBe(false);
});
it.each(['tick', 'attempt', 'complianceEvidence'] as const)('BPA03 rejects caller-supplied %s in an accepted appeal Source', extra => {
  const previous = initial();
  expect(() => actualPostPlayReviewEventInput(event(previous, { ...action, [extra]: 123 }), 'appeal-event')).toThrow();
});
// Structural reducer input only. Native must rederive this qualification from
// original owners; this fixture never claims authenticated Native acceptance.
const qualification = (previous: ReturnType<typeof initial>): any => {
  const at = previous.seed.exactEnd, ticksPerSecond = previous.cursor.ticksPerSecond;
  const history = deriveBallWorldPlayerBaseContactHistory({ playerId: 'runner',
    base: { center: { x: 0, z: 0 }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
    segments: [{ originTick: at.originTick, startElapsedSeconds: 0, endElapsedSeconds: at.elapsedSeconds,
      actors: (['left_foot', 'right_foot'] as const).map(role => ({ playerId: 'runner', primitive: {
        role, radius: 0.05, startTick: at.originTick, endTick: at.tick, ticksPerSecond,
        startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: 1, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } })) }] });
  return { kind: 'ready', moment: at, attempt: createDefensiveAppealAttemptFact('fielder', 'runner', 1, 'tag_up_early_departure', at.tick),
    complianceEvidence: { kind: 'ball_world_tag_up_history_v1', originBase: 'first', history,
      firstTouch: { fact: createFlyBallFirstFielderTouchFact('fielder', at.originTick + ticksPerSecond), originTick: at.originTick, elapsedSeconds: 1 } } };
};
it('BPA04 passes qualified exact evidence through the existing ledger while requiring a new official snapshot', () => {
  const previous = initial(), baseAppeal = qualification(previous);
  const after = advanceActualPostPlayReview({ previous, source: event(previous), baseAppeal });
  expect(after.ledger.events.at(-1)).toMatchObject({ kind: 'DefensiveAppealAttemptRecorded', attempt: baseAppeal.attempt,
    complianceEvidence: baseAppeal.complianceEvidence });
  expect(after.pendingReasons).toContain('appeal_requires_updated_correct_rule_snapshot');
  expect(after.ledger.playEnd).toEqual(previous.ledger.playEnd); expect(after.kind).toBe('official_pending');
  expect(previous.ledger.events.some(e => e.kind === 'DefensiveAppealAttemptRecorded')).toBe(false);
});
it('BPA05 a later post-play clock cannot reuse contact at the original end', () => {
  const previous = initial(), baseAppeal = qualification(previous);
  const advanced = advanceActualPostPlayReview({ previous, source: event(previous, { kind: 'advance_tick', schedulerId: 'scheduler' }) });
  expect(() => advanceActualPostPlayReview({ previous: advanced, source: { ...event(advanced), sourceId: 'late-appeal' }, baseAppeal }))
    .toThrow(/original physical end cut/);
});
it.each(['defender', 'runner', 'base', 'moment'] as const)('BPA06 rejects qualified evidence with changed %s', fault => {
  const previous = initial(), baseAppeal = qualification(previous);
  if (fault === 'defender') baseAppeal.attempt.defenderId = 'other';
  if (fault === 'runner') baseAppeal.attempt.runnerId = 'other';
  if (fault === 'base') baseAppeal.attempt.base = 2;
  if (fault === 'moment') baseAppeal.moment = { ...baseAppeal.moment, elapsedSeconds: 4.0000001 };
  expect(() => advanceActualPostPlayReview({ previous, source: event(previous), baseAppeal })).toThrow(/original physical end cut/);
});
it('BPA07 Native admission stays pending without its original catch-end owner and refuses a caller database substitute', () => {
  const previous = initial(), source = actualPostPlayReviewEventInput(event(previous), 'appeal-event');
  expect(() => capturePostPlayBaseAppeal({ prepare: () => null } as any, {} as any, previous, source, true)).toThrow(/Native read transaction/);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('BEGIN');
    expect(capturePostPlayBaseAppeal(db, {} as any, previous, source, true)).toEqual({
      kind: 'intent_pending', reason: 'original_base_appeal_reserved_catch_end_required' });
    db.exec('ROLLBACK');
  } finally { db.close(); }
});
