import { initializeActualPostPlayReview, advanceActualPostPlayReview } from './ActualPostPlayReview';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { ActualPostPlayReviewEventAction, AcceptedActualPostPlayOfficialIntent } from './ActualPostPlayReviewSource';
import { describe, expect, it } from 'vitest';
import { deriveSamePaCatchOfficial, deriveSamePaCatchOfficialOpening } from './SamePlateAppearanceCatchOfficial';
import { deriveSamePaCatchOperativeRuling } from './SamePlateAppearanceCatchOperativeRuling';
import { getOfficialPlayClosure, getPlayAdjudicationState, createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot, recordOnFieldCall } from '../../core/adjudication/PlayAdjudicationLedger';
import { createPlayEndFact } from '../../core/rules/PhysicalRuleFacts';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { OwnedLiveCallImportProvenance } from '../../core/adjudication/PlayAdjudicationLedger';

const ref = (owner: string, sourceId: string) => ({ owner, sourceId, sourceVersion: 'fixture-v1', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const fixture = (outs = 0) => {
  const originalMatch: CanonicalMatchState = { ruleProfileId: NPB_2026_RULE_PROFILE.id, inning: 1, half: 'top', outs,
    balls: 0, strikes: 0, bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 7 };
  const operative = deriveSamePaCatchOperativeRuling({ originalMatch, batterRunnerId: 'batter', basisTick: 110, basisEvidenceRevision: 3,
    fairCatch: { kind: 'pending', reason: 'actual_fair_catch_required' }, action: { sourceId: 'actual-caught-action', sourceVersion: 'fixture-v1',
      capability: 'same_pa_explicit_catch_action_v1', assignmentReference: { sourceId: 'assignment', sourceVersion: 'fixture-v1', sourceHash: 'a'.repeat(64) },
      officialId: 'umpire', personId: 'umpire-person', viewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'call-view', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) },
      judgment: 'caught', calledAt: { originTick: 100, tick: 120, elapsedSeconds: 0.02 } } });
  if (operative.kind !== 'retired') throw new Error('fixture caught action is missing');
  const callProvenance: OwnedLiveCallImportProvenance = { version: 'owned_live_call_import_v1', gameId: 'game', playId: 7,
    physicalPitchSourceId: 'reserved-pitch', clock: { originTick: 100, ticksPerSecond: 1000 },
    calledAtElapsedSeconds: 0.02, availableAtElapsedSeconds: 0.02, importedAtElapsedSeconds: 0.04,
    call: ref('pa_catch_v1_work', 'call-work'), perception: ref('pa_lifecycle_v1_execution_views', 'call-view'),
    policy: ref('pa_catch_v1_work', 'call-work'), ruleEvidence: ref('pa_lifecycle_v1_execution_views', 'call-view'), reception: null };
  return { sourceId: 'catch-official', originalMatch, physicalEnd: createPlayEndFact(140, 'live_action_complete'),
    exactEnd: { originTick: 100, tick: 140, elapsedSeconds: 0.04 }, operative, callProvenance,
    policy: { sourceId: 'window-policy', sourceVersion: 'fixture-v1', ruleProfileId: originalMatch.ruleProfileId,
      officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } },
    scheduler: { sourceId: 'scheduler-source', sourceVersion: 'fixture-v1', schedulerId: 'scheduler', events: [
      { sourceId: 'scheduler-fence', sourceVersion: 'fixture-v1', schedulerId: 'scheduler', kind: 'next_play_fence' as const }] } };
};

const occupiedFixture = (outs = 0) => {
  const input = fixture(outs), originalMatch = { ...input.originalMatch,
    bases: { first: 'runner-1', second: null, third: 'runner-3' } };
  const onFieldCall = { ...input.operative.onFieldCall, ruling: { outsAfter: outs + 1,
    basesAfter: originalMatch.bases, scoredRunnerIds: [] as const } };
  let ledger = createPlayAdjudicationLedger({ playId: originalMatch.playId, ruleProfileId: originalMatch.ruleProfileId, playEnd: null });
  ledger = recordCorrectRuleSnapshot(ledger, 0, { eventId: 'occupied-rule', tick: 110,
    snapshotId: onFieldCall.basisSnapshotId, evidenceRevision: onFieldCall.basisEvidenceRevision, ruling: onFieldCall.ruling });
  ledger = recordOnFieldCall(ledger, ledger.revision, { eventId: 'occupied-call', ...onFieldCall });
  const runners = (['first', 'third'] as const).map(startingBase => {
    const playerId = originalMatch.bases[startingBase];
    return { playerId, startingBase, holdReference: { owner: 'world_same_pa_occupied_runner_holds' as const,
      sourceId: 'hold:' + playerId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) }, history: {
      playerId, originTick: 100, ticksPerSecond: 1000, startElapsedSeconds: 0, endElapsedSeconds: 0.04,
      contactAtStart: true, contactAtHorizon: true, episodes: [{ startElapsedSeconds: 0, endElapsedSeconds: 0.04 }],
      events: [{ kind: 'touch' as const, originTick: 100, elapsedSeconds: 0, tick: 100 }],
    } };
  });
  return { ...input, originalMatch, operative: { ...input.operative, onFieldCall, ledger },
    occupiedRunners: { kind: 'same_pa_stationary_occupied_runners_v1' as const, runners } };
};

describe('reserved caught-action official closure', () => {
  it.each([0, 1, 2])('preserves stationary original runners and records appeal applicability with %i previous outs', outs => {
    const input = occupiedFixture(outs), result = deriveSamePaCatchOfficial(input);
    expect(result).toMatchObject({ kind: 'closed', appealApplicability: 'original_runners_never_left_original_bases' });
    expect(getOfficialPlayClosure(result.ledger)?.officialDelta).toMatchObject({
      outsAfter: outs + 1, basesAfter: input.originalMatch.bases, scoredRunnerIds: [],
    });
  });

  it.each(['missing', 'departure', 'short_history', 'foreign_hold'] as const)('rejects occupied original proof fault %s', fault => {
    const input = occupiedFixture(), proof = structuredClone(input.occupiedRunners);
    if (fault === 'departure') proof.runners[0].history.contactAtHorizon = false;
    if (fault === 'short_history') proof.runners[0].history.endElapsedSeconds = 0.03;
    if (fault === 'foreign_hold') proof.runners[0].holdReference.owner = 'foreign' as typeof proof.runners[0]['holdReference']['owner'];
    expect(() => deriveSamePaCatchOfficial({ ...input, occupiedRunners: fault === 'missing' ? undefined : proof })).toThrow();
  });

  it.each([0, 1, 2])('imports original call timing and unresolved truth with %i previous outs', outs => {
    const input = fixture(outs), before = JSON.stringify(input), result = deriveSamePaCatchOfficial(input);
    expect(result).toMatchObject({ kind: 'closed', evaluationTick: 140, appealApplicability: 'no_original_tag_up_participant' });
    if (result.kind !== 'closed') throw new Error('expected closed ledger');
    const originalSnapshot = input.operative.ledger.events[0];
    expect(result.ledger.events[0]).toMatchObject({ tick: 140, kind: originalSnapshot.kind });
    expect(result.ledger.events[0]).toHaveProperty('snapshot', 'snapshot' in originalSnapshot ? originalSnapshot.snapshot : null);
    expect(result.ledger.events.find(e => e.kind === 'OwnedLiveCallImported')).toMatchObject({ tick: 140,
      call: input.operative.onFieldCall, provenance: input.callProvenance });
    expect(getOfficialPlayClosure(result.ledger)).toMatchObject({ playEnd: input.physicalEnd,
      finalRuling: { source: 'on_field_call', gameplay: { outsAfter: outs + 1 } } });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('uses original scheduler steps rather than the physical horizon to advance official time', () => {
    const input = fixture();
    const result = deriveSamePaCatchOfficial({ ...input, scheduler: { ...input.scheduler, events: [
      { sourceId: 'scheduler-step', sourceVersion: 'fixture-v1', schedulerId: 'scheduler', kind: 'advance_tick' }, ...input.scheduler.events] } });
    expect(result).toMatchObject({ kind: 'closed', evaluationTick: 141 });
    if (result.kind === 'closed') expect(result.ledger.playEnd).toEqual(input.physicalEnd);
  });

  it('preserves contradictory correct truth without changing the independently accepted caught call', () => {
    const input = fixture(), call = input.operative.onFieldCall;
    let original = createPlayAdjudicationLedger({ playId: input.originalMatch.playId, ruleProfileId: input.originalMatch.ruleProfileId, playEnd: null });
    const correctRuling = { outsAfter: 0, basesAfter: { first: null, second: null, third: null }, scoredRunnerIds: [] };
    original = recordCorrectRuleSnapshot(original, original.revision, { eventId: 'true-rule', tick: 110,
      snapshotId: call.basisSnapshotId, evidenceRevision: call.basisEvidenceRevision, ruling: correctRuling });
    original = recordOnFieldCall(original, original.revision, { eventId: 'original-call', ...call });
    const result = deriveSamePaCatchOfficial({ ...input, operative: { ...input.operative, ledger: original } });
    expect(result.kind).toBe('closed');
    expect(result.originalOperativeLedger).toEqual(original);
    expect(result.ledger.events[0]).toMatchObject({ snapshot: { ruling: correctRuling } });
    expect(getOfficialPlayClosure(result.ledger)?.finalRuling.gameplay.outsAfter).toBe(1);
  });

  it('rejects a rule snapshot that has not happened at the independent end', () => {
    const input = fixture(), call = input.operative.onFieldCall;
    const later = recordCorrectRuleSnapshot(input.operative.ledger, input.operative.ledger.revision, { eventId: 'future-rule', tick: 141,
      snapshotId: 'future-snapshot', evidenceRevision: call.basisEvidenceRevision + 1, ruling: call.ruling });
    expect(() => deriveSamePaCatchOfficial({ ...input, operative: { ...input.operative, ledger: later } })).toThrow(/operative ledger/);
  });

  it('keeps unspecified official-window policy pending', () => {
    const result = deriveSamePaCatchOfficial({ ...fixture(), policy: null });
    expect(result).toMatchObject({ kind: 'pending', pendingReasons: ['official_window_policy_unconfigured:review', 'official_window_policy_unconfigured:challenge'] });
    expect(getOfficialPlayClosure(result.ledger)).toBeNull();
  });

  it.each(['review', 'challenge'] as const)('does not expire enabled %s without its original decision owner', kind => {
    const input = fixture();
    const result = deriveSamePaCatchOfficial({ ...input, policy: { ...input.policy, officialWindows: {
      ...input.policy.officialWindows, [kind]: { available: true, expiresAfterTicks: 1 } } }, scheduler: { ...input.scheduler, events: [
      { sourceId: 'step-1', sourceVersion: 'fixture-v1', schedulerId: 'scheduler', kind: 'advance_tick' },
      { sourceId: 'step-2', sourceVersion: 'fixture-v1', schedulerId: 'scheduler', kind: 'advance_tick' }, ...input.scheduler.events] } });
    expect(result).toMatchObject({ kind: 'pending', pendingReasons: ['official_window_owner_unavailable:' + kind] });
    expect(getOfficialPlayClosure(result.ledger)).toBeNull();
  });

  it('requires the explicit next-play fence even with no tag-up participant', () => {
    const input = fixture(), result = deriveSamePaCatchOfficial({ ...input, scheduler: { ...input.scheduler, events: [] } });
    expect(result).toMatchObject({ kind: 'pending', pendingReasons: ['official_next_play_fence_required'] });
    expect(getPlayAdjudicationState(result.ledger).kind).toBe('official_adjudication_open');
  });

  it.each(['foreign_scheduler', 'duplicate_event', 'after_fence'] as const)('rejects %s journal authority', fault => {
    const input = fixture(), fence = input.scheduler.events[0];
    const events = fault === 'foreign_scheduler' ? [{ ...fence, schedulerId: 'foreign' }]
      : fault === 'duplicate_event' ? [fence, fence] : [fence, { ...fence, sourceId: 'later', kind: 'advance_tick' as const }];
    expect(() => deriveSamePaCatchOfficial({ ...input, scheduler: { ...input.scheduler, events } })).toThrow(/scheduler|journal|Source/);
  });

  it.each(['occupied_bases', 'clock', 'call', 'end', 'scope'] as const)('rejects mismatched %s input', fault => {
    const input = fixture();
    const changed = fault === 'occupied_bases' ? { ...input, originalMatch: { ...input.originalMatch, bases: { ...input.originalMatch.bases, first: 'runner' } } }
      : fault === 'clock' ? { ...input, exactEnd: { ...input.exactEnd, elapsedSeconds: 0.03 } }
      : fault === 'call' ? { ...input, operative: { ...input.operative, onFieldCall: { ...input.operative.onFieldCall, tick: 121 } } }
      : fault === 'end' ? { ...input, physicalEnd: createPlayEndFact(139, 'live_action_complete') }
      : { ...input, originalMatch: { ...input.originalMatch, playId: 8 } };
    expect(() => deriveSamePaCatchOfficial(changed)).toThrow();
  });
});


it('reserved review preserves unresolved truth and the original call through an explicit accepted stands decision', () => {
  const input = fixture(), policy = { ...input.policy, officialWindows: { ...input.policy.officialWindows, review: { available: true } } };
  const opening = deriveSamePaCatchOfficialOpening({ ...input, policy });
  const { sourceVersion: _version, ...physicalOperationReference } = ref('pa_physical_v1_field_steps', 'end-cut');
  const source = { sourceId: 'review-seed', sourceVersion: 'fixture-v1', capability: 'same_pa_catch_review_seed_v1' as const,
    viewReference: { ...physicalOperationReference, owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'end-view' },
    catchWorkReference: { ...physicalOperationReference, owner: 'pa_catch_v1_work' as const, sourceId: 'call-work' },
    physicalOperationReference: { ...physicalOperationReference, owner: 'pa_physical_v1_field_steps' as const }, policy };
  const seed = { source, snapshotHash: hash(opening), gameId: 'game', playId: 7, physicalPitchSourceId: 'reserved-pitch',
    ruleProfile: actualLiveAdjudicationProfile(input.originalMatch.ruleProfileId, policy), exactEnd: input.exactEnd,
    endReference: ref('pa_physical_v1_field_steps', 'end-cut'), kind: 'official_pending' as const, ledger: opening.ledger,
    pendingReasons: opening.pendingReasons };
  const session = { sourceId: 'review-session', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_session_v1' as const,
    adjudicationSourceId: source.sourceId, adjudicationSnapshotHash: seed.snapshotHash, officialPolicy: policy, reservedCatchSeed: source,
    policy: { sourceId: 'review-policy', sourceVersion: 'fixture-v1', ruleProfileId: policy.ruleProfileId,
      openingTrigger: 'physical_play_end' as const, clock: 'post_play_discrete_tick_v1' as const, schedulerId: 'scheduler', expiryScope: 'request_admission' as const,
      opportunities: [{ windowKind: 'review' as const, windowId: 'review', entitlementSourceId: 'entitlement', clubId: 'club',
        requesterIds: ['reviewer'], reviewerIds: ['reviewer'] }] } };
  let reviewed = initializeActualPostPlayReview({ source: session, seed });
  expect(reviewed.kind).toBe('official_pending');
  expect(() => deriveSamePaCatchOfficial({ ...input, policy, reviewed })).toThrow(/reviewed ledger/);
  const step = (action: ActualPostPlayReviewEventAction, intent?: AcceptedActualPostPlayOfficialIntent) => {
    reviewed = advanceActualPostPlayReview({ previous: reviewed, source: { sourceId: 'event:' + reviewed.revision,
      sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_event_v1', sessionSourceId: session.sourceId,
      expectedRevision: reviewed.revision, parent: { sourceId: reviewed.headSourceId, snapshotHash: reviewed.headHash }, action }, ...(intent ? { intent } : {}) });
  };
  const call = input.operative.onFieldCall;
  step({ kind: 'official_request', windowId: 'review', callId: call.callId, intentSourceId: 'request-intent' }, {
    sourceId: 'request-intent', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_official_intent_v1',
    sessionSourceId: session.sourceId, gameId: 'game', playId: 7, physicalPitchSourceId: 'reserved-pitch',
    callId: call.callId, windowId: 'review', entitlementSourceId: 'entitlement', officialId: 'reviewer', action: 'request' });
  expect(reviewed.requests[0].status).toBe('review_pending');
  step({ kind: 'advance_tick', schedulerId: 'scheduler' });
  step({ kind: 'decision', windowId: 'review', requestEventSourceId: 'event:0', reviewId: 'review-decision', callId: call.callId,
    reviewerId: 'reviewer', basisSnapshotId: call.basisSnapshotId, basisEvidenceRevision: call.basisEvidenceRevision, decision: 'stands' });
  const closed = deriveSamePaCatchOfficial({ ...input, policy, reviewed });
  expect(closed.kind).toBe('closed'); expect(closed.evaluationTick).toBe(141);
  expect(closed.originalOperativeLedger).toEqual(input.operative.ledger);
  expect(closed.ledger.events.filter(e => e.kind === 'UnresolvedCorrectRuleSnapshotRecorded')).toEqual(
    reviewed.ledger.events.filter(e => e.kind === 'UnresolvedCorrectRuleSnapshotRecorded'));
  expect(closed.ledger.events.filter(e => e.kind === 'OwnedLiveCallImported')).toEqual(reviewed.ledger.events.filter(e => e.kind === 'OwnedLiveCallImported'));
  expect(getOfficialPlayClosure(closed.ledger)?.finalRuling.source).toBe('review');
  expect(() => initializeActualPostPlayReview({ source: session, seed: { ...seed, endReference: ref('actual_first_base_play_ends', 'end-cut') } })).toThrow(/physical end/);
  expect(() => initializeActualPostPlayReview({ source: { ...session, reservedCatchSeed: undefined }, seed })).toThrow();
});
