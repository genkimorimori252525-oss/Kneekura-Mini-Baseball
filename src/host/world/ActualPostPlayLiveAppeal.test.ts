import { expect, it } from 'vitest';
import { actualPostPlayReviewEventInput } from './ActualPostPlayReviewSource';
import { initializeActualPostPlayReview, advanceActualPostPlayReview } from './ActualPostPlayReview';
import { reviewFixture } from './ActualPostPlayReviewContract.test-support';
import { createRequire } from 'node:module';
import { createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../../core/rules/PhysicalRuleFacts';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { getPlayAdjudicationState, getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { capturePostPlayLiveAppeal } from './ActualPostPlayLiveAppealFromSqlite';
import type { PostPlayLiveAppealImport } from './ActualPostPlayReviewState';

const initial = () => initializeActualPostPlayReview(reviewFixture({ truth: 'safe' }));
const executionReference = { owner: 'pa_physical_v1_field_steps', sourceId: 'live-contact',
  sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) } as const;
const action = { kind: 'import_live_appeal', executionReference } as const;
const event = (previous: ReturnType<typeof initial>, a: unknown = action, sourceId = 'live-import') => ({
  sourceId, sourceVersion: 'test', capability: 'actual_post_play_review_event_v1',
  sessionSourceId: previous.source.sourceId, expectedRevision: previous.revision,
  parent: { sourceId: previous.headSourceId, snapshotHash: previous.headHash }, action: a,
});

it('LPI01 accepts only an explicit immutable field receipt reference without changing its bytes', () => {
  const source = event(initial());
  expect(actualPostPlayReviewEventInput(source, source.sourceId)).toEqual(source);
  expect(JSON.stringify(actualPostPlayReviewEventInput(source, source.sourceId))).toBe(JSON.stringify(source));
});
it.each(['tick', 'attempt', 'complianceEvidence', 'contact', 'rights', 'liveBall', 'snapshot'])(
  'LPI02 rejects caller-supplied %s on a live appeal import Source', extra => {
    expect(() => actualPostPlayReviewEventInput(event(initial(), { ...action, [extra]: true }), 'live-import')).toThrow();
  });
it.each(['pa_physical_v1_field_roots', 'actual_first_base_play_ends', 'pa_lifecycle_v1_execution_views'])(
  'LPI03 refuses an execution reference owned by %s', owner => {
    expect(() => actualPostPlayReviewEventInput(event(initial(), { ...action,
      executionReference: { ...executionReference, owner } }), 'live-import')).toThrow();
  });
it('LPI04 a receipt reference alone cannot import an appeal or manufacture a physical attempt', () => {
  const previous = initial();
  expect(() => advanceActualPostPlayReview({ previous, source: event(previous) })).toThrow(/live appeal.*owner|owned live appeal/);
  expect(previous.ledger.events.some(e => e.kind === 'DefensiveAppealAttemptRecorded')).toBe(false);
});

// Structural reducer evidence only. This is deliberately not a Native physical
// execution fixture and must never be cited as proof of Native acceptance.
const imported = (previous: ReturnType<typeof initial>): PostPlayLiveAppealImport => {
  const { originTick, ticksPerSecond } = previous.cursor, elapsedSeconds = 3;
  const tick = originTick + elapsedSeconds * ticksPerSecond;
  const history = deriveBallWorldPlayerBaseContactHistory({ playerId: 'runner',
    base: { center: { x: 0, z: 0 }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, baseSurfaceHeightMeters: 0,
    segments: [{ originTick, startElapsedSeconds: 0, endElapsedSeconds: elapsedSeconds,
      actors: (['left_foot', 'right_foot'] as const).map(role => ({ playerId: 'runner', primitive: {
        role, radius: 0.05, startTick: originTick, endTick: tick, ticksPerSecond,
        startCenter: { x: 0, y: 0, z: 0 }, startVelocity: { x: 1, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } })) }] });
  const ref = (sourceId: string) => ({ ...executionReference, sourceId, sourceVersion: 'test' });
  return { attempt: createDefensiveAppealAttemptFact('fielder', 'runner', 1, 'tag_up_early_departure', tick),
    complianceEvidence: { kind: 'ball_world_tag_up_history_v1', originBase: 'first', history,
      firstTouch: { fact: createFlyBallFirstFielderTouchFact('fielder', originTick + ticksPerSecond), originTick, elapsedSeconds: 1 } },
    provenance: { version: 'owned_live_appeal_import_v1', gameId: previous.seed.gameId, playId: previous.seed.playId,
      physicalPitchSourceId: previous.seed.physicalPitchSourceId, clock: { originTick, ticksPerSecond },
      indicatedAtElapsedSeconds: 2, executedAtElapsedSeconds: elapsedSeconds,
      importedAtElapsedSeconds: previous.seed.exactEnd.elapsedSeconds + previous.cursor.offsetTicks / ticksPerSecond,
      indication: ref('live-indication'), throwPlan: ref('live-throw'), execution: ref(executionReference.sourceId) },
    rights: { kind: 'pending', reason: 'original_live_ball_and_appeal_rights_required' } };
};
it('LPI05 imports the historical attempt without a new contact, legal result or official window', () => {
  const previous = initial(), liveAppealImport = imported(previous), bytes = JSON.stringify(previous);
  const after = advanceActualPostPlayReview({ previous, source: event(previous), liveAppealImport });
  expect(after.ledger.events.at(-1)).toEqual({ kind: 'OwnedLiveAppealImported', eventId: 'live-import:live-appeal',
    tick: previous.cursor.tick, ...liveAppealImport });
  expect(after.ledger.playEnd).toEqual(previous.ledger.playEnd);
  expect(getPlayAdjudicationState(after.ledger)).toEqual(getPlayAdjudicationState(previous.ledger));
  expect(getOfficialStateWindows(after.ledger)).toEqual(getOfficialStateWindows(previous.ledger));
  expect(after.kind).toBe('official_pending');
  expect(after.pendingReasons).toEqual(expect.arrayContaining([
    'original_live_ball_and_appeal_rights_required', 'appeal_requires_updated_correct_rule_snapshot']));
  expect(JSON.stringify(previous)).toBe(bytes);
});
it('LPI06 later recording keeps execution time and exact history at the original contact', () => {
  const first = initial();
  const previous = advanceActualPostPlayReview({ previous: first,
    source: event(first, { kind: 'advance_tick', schedulerId: 'scheduler' }, 'later') });
  const liveAppealImport = imported(previous);
  const after = advanceActualPostPlayReview({ previous, source: event(previous), liveAppealImport });
  expect(after.ledger.events.at(-1)).toMatchObject({ tick: previous.cursor.tick,
    attempt: { tick: first.cursor.originTick + 3000 }, complianceEvidence: { history: { endElapsedSeconds: 3 } } });
  const replayed = advanceActualPostPlayReview({ previous: after,
    source: event(after, { kind: 'advance_tick', schedulerId: 'scheduler' }, 'replay') });
  expect(replayed.pendingReasons).toContain('original_live_ball_and_appeal_rights_required');
});
it('LPI07 cannot import the same immutable execution twice using another event identity', () => {
  const previous = initial(), liveAppealImport = imported(previous);
  const after = advanceActualPostPlayReview({ previous, source: event(previous), liveAppealImport });
  expect(() => advanceActualPostPlayReview({ previous: after, source: event(after, action, 'again'), liveAppealImport }))
    .toThrow(/already imported/);
});
it.each(['game', 'play', 'pitch', 'execution', 'exactEnd', 'recording'] as const)(
  'LPI08 refuses a changed original %s in structural import evidence', fault => {
    const previous = initial(), liveAppealImport = JSON.parse(JSON.stringify(imported(previous)));
    const p = liveAppealImport.provenance;
    if (fault === 'game') p.gameId = 'other';
    if (fault === 'play') p.playId++;
    if (fault === 'pitch') p.physicalPitchSourceId = 'other';
    if (fault === 'execution') p.execution.sourceHash = 'f'.repeat(64);
    if (fault === 'exactEnd') p.executedAtElapsedSeconds = previous.seed.exactEnd.elapsedSeconds + 1e-12;
    if (fault === 'recording') p.importedAtElapsedSeconds += 1e-12;
    expect(() => advanceActualPostPlayReview({ previous, source: event(previous), liveAppealImport }))
      .toThrow(/original scope, receipt or exact end/);
  });
it('LPI09 unrelated actions cannot carry live appeal evidence', () => {
  const previous = initial();
  expect(() => advanceActualPostPlayReview({ previous,
    source: event(previous, { kind: 'advance_tick', schedulerId: 'scheduler' }), liveAppealImport: imported(previous) }))
    .toThrow(/unexpected owned live appeal/);
});
it('LPI10 Native import refuses database substitutes and requires a real read transaction', () => {
  const previous = initial(), source = actualPostPlayReviewEventInput(event(previous), 'live-import');
  expect(() => capturePostPlayLiveAppeal({ prepare: () => null } as any, {} as any, previous, source, true))
    .toThrow(/Native read transaction/);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  try {
    expect(() => capturePostPlayLiveAppeal(db, {} as any, previous, source, true)).toThrow(/Native read transaction/);
    db.exec('BEGIN');
    expect(capturePostPlayLiveAppeal(db, {} as any, previous, source, true)).toEqual({ kind: 'intent_pending',
      reason: 'original_live_appeal_independent_play_end_owner_required' });
    expect(capturePostPlayLiveAppeal(db, {} as any, previous, source, false)).toEqual({ kind: 'intent_pending',
      reason: 'original_live_appeal_independent_play_end_owner_required' });
    db.exec('ROLLBACK');
  } finally { db.close(); }
});
