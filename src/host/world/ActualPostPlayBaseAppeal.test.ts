import { expect, it } from 'vitest';
import { actualPostPlayReviewSessionInput, actualPostPlayReviewEventInput } from './ActualPostPlayReviewSource';
import { initializeActualPostPlayReview, advanceActualPostPlayReview } from './ActualPostPlayReview';
import { reviewFixture } from './ActualPostPlayReviewContract.test-support';
import { getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { createRequire } from 'node:module';
import { createControlledRunnerTagFact, createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../../core/rules/PhysicalRuleFacts';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { capturePostPlayBaseAppeal } from './ActualPostPlayBaseAppealFromSqlite';

const initial = () => {
  const f = reviewFixture({ truth: 'safe' });
  return initializeActualPostPlayReview({ ...f, source: { ...f.source, baseAppealMode: 'original_catch_end_v1' } });
};
const action = { kind: 'defender_base_appeal', defenderId: 'fielder', runnerId: 'runner', base: 'first' } as const;
const bodyAction = { ...action, kind: 'defender_runner_body_appeal' } as const;
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

// Like qualification above, this is structural reducer evidence only. The
// Native path must derive the full physical contact object from original owners.
const bodyQualification = (previous: ReturnType<typeof initial>): any => ({ ...qualification(previous),
  runnerBodyContact: { kind: 'controlled_runner_body_tag_v1',
    fact: createControlledRunnerTagFact('fielder', 'runner', previous.seed.exactEnd.tick) } });
it('BPA08 accepts the explicit runner-body route without changing legacy appeal Source bytes', () => {
  const previous = initial();
  expect(actualPostPlayReviewEventInput(event(previous, bodyAction), 'appeal-event').action).toEqual(bodyAction);
  expect(JSON.stringify(actualPostPlayReviewEventInput(event(previous), 'appeal-event'))).toBe(JSON.stringify(event(previous)));
});
it.each(['tick', 'attempt', 'runnerBodyContact', 'hasBall', 'bodyTouch'] as const)(
  'BPA09 rejects caller-supplied %s in an accepted runner-body appeal Source', extra => {
    const previous = initial();
    expect(() => actualPostPlayReviewEventInput(event(previous, { ...bodyAction, [extra]: true }), 'appeal-event'))
      .toThrow(/explicit defender/);
  });
it('BPA10 runner-body request alone cannot execute an appeal or mutate the ledger', () => {
  const previous = initial();
  expect(() => advanceActualPostPlayReview({ previous, source: event(previous, bodyAction) })).toThrow(/physical.*appeal|appeal.*physical/);
  expect(previous.ledger.events.some(e => e.kind === 'DefensiveAppealAttemptRecorded')).toBe(false);
});
it('BPA11 consumes qualified runner-body evidence through the appeal ledger and awaits the correct snapshot', () => {
  const previous = initial(), baseAppeal = bodyQualification(previous);
  const after = advanceActualPostPlayReview({ previous, source: event(previous, bodyAction), baseAppeal });
  expect(after.events[0]).toMatchObject({ source: { action: bodyAction }, baseAppeal });
  expect(after.ledger.events.at(-1)).toMatchObject({ kind: 'DefensiveAppealAttemptRecorded', attempt: baseAppeal.attempt,
    complianceEvidence: baseAppeal.complianceEvidence });
  expect(after.pendingReasons).toContain('appeal_requires_updated_correct_rule_snapshot');
  expect(after.ledger.playEnd).toEqual(previous.ledger.playEnd);
  expect(after.kind).toBe('official_pending');
});
it.each(['base', 'body'] as const)('BPA12 rejects execution from the other route for the %s appeal', route => {
  const previous = initial();
  const source = event(previous, route === 'base' ? action : bodyAction);
  const baseAppeal = route === 'base' ? bodyQualification(previous) : qualification(previous);
  expect(() => advanceActualPostPlayReview({ previous, source, baseAppeal })).toThrow(/appeal.*route|route.*appeal/);
});
it.each(['base', 'body'] as const)('BPA13 rejects the same target across routes after a %s appeal', route => {
  const previous = initial();
  const after = advanceActualPostPlayReview({ previous, source: event(previous, route === 'base' ? action : bodyAction),
    baseAppeal: route === 'base' ? qualification(previous) : bodyQualification(previous) });
  const source = { ...event(after, route === 'base' ? bodyAction : action), sourceId: 'second-appeal' };
  const baseAppeal = route === 'base' ? bodyQualification(previous) : qualification(previous);
  expect(() => advanceActualPostPlayReview({ previous: after, source, baseAppeal })).toThrow(/same original base/);
});
it('BPA14 runner-body evidence cannot reuse contact after advancing the post-play clock', () => {
  const previous = initial(), baseAppeal = bodyQualification(previous);
  const advanced = advanceActualPostPlayReview({ previous, source: event(previous, { kind: 'advance_tick', schedulerId: 'scheduler' }) });
  expect(() => advanceActualPostPlayReview({ previous: advanced,
    source: { ...event(advanced, bodyAction), sourceId: 'late-body-appeal' }, baseAppeal })).toThrow(/original physical end cut/);
});
it('BPA15 runner-body Native admission requires the original catch-end owner and actual transaction', () => {
  const previous = initial(), source = actualPostPlayReviewEventInput(event(previous, bodyAction), 'appeal-event');
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
it.each(['kind', 'defenderId', 'runnerId', 'tick'] as const)(
  'BPA16 rejects a runner-body contact fact with changed %s', fault => {
    const previous = initial(), baseAppeal = bodyQualification(previous);
    baseAppeal.runnerBodyContact.fact[fault] = fault === 'tick' ? previous.seed.exactEnd.tick + 1 : 'different';
    expect(() => advanceActualPostPlayReview({ previous, source: event(previous, bodyAction), baseAppeal }))
      .toThrow(/runner.body.*contact|contact.*runner.body/);
  });
