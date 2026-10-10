import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { projectActualFairFieldTimeline } from '../../core/sim/plateAppearance/ActualFairFieldTimeline';
import { classifyClosedPlayForOfficialScoring } from '../../core/adjudication/OfficialScoring';
import { fixture as physicalFixture } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition, advanceBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import type { ActualFairCatchOccupiedRunnerEvidence } from '../../core/rules/FairCatchRunnerOutcome';
import { initializeActualPostPlayReview, advanceActualPostPlayReview } from './ActualPostPlayReview';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { ActualPostPlayReviewEventAction, AcceptedActualPostPlayOfficialIntent } from './ActualPostPlayReviewSource';
import { describe, expect, it } from 'vitest';
import { deriveSamePaCatchOfficial, deriveSamePaCatchOfficialOpening } from './SamePlateAppearanceCatchOfficial';
import { deriveSamePaCatchOperativeRuling } from './SamePlateAppearanceCatchOperativeRuling';
import { getOfficialPlayClosure, getPlayAdjudicationState, createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot, recordOnFieldCall, recordUnresolvedCorrectRuleSnapshot, deriveClosedLiveBallMatchState } from '../../core/adjudication/PlayAdjudicationLedger';
import { createDefensiveAppealAttemptFact, createFlyBallFirstFielderTouchFact } from '../../core/rules/PhysicalRuleFacts';
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

it('keeps a caught action operative while an authenticated original runner is still between bases', () => {
  const input = occupiedFixture(), end = 0.01;
  const runnerEvidence = { kind: 'same_pa_occupied_fair_catch_runner_evidence_v1', runners: input.occupiedRunners.runners.map(r => ({
    playerId: r.playerId, startingBase: r.startingBase, holdReference: r.holdReference,
    bases: (['home', 'first', 'second', 'third'] as const).map(base => {
      const occupied = base === r.startingBase, departed = occupied && r.playerId === 'runner-1';
      const episodes = occupied ? [{ startElapsedSeconds: 0, endElapsedSeconds: departed ? 0.005 : end }] : [];
      return { base, history: { playerId: r.playerId, originTick: 100, ticksPerSecond: 1000,
        startElapsedSeconds: 0, endElapsedSeconds: end, contactAtStart: occupied, contactAtHorizon: occupied && !departed,
        episodes, events: occupied ? [{ kind: 'touch', originTick: 100, elapsedSeconds: 0, tick: 100 },
          ...(departed ? [{ kind: 'departure', originTick: 100, elapsedSeconds: 0.005, tick: 105 }] : [])] : [] } };
    }) })) };
  const result = deriveSamePaCatchOperativeRuling({ originalMatch: input.originalMatch, batterRunnerId: 'batter',
    basisTick: 110, basisEvidenceRevision: 3, fairCatch: { kind: 'pending', reason: 'runner_final_base_claim_required' },
    occupiedRunnerEvidence: runnerEvidence,
    action: { sourceId: 'moving-caught-action', sourceVersion: 'test', capability: 'same_pa_explicit_catch_action_v1',
      assignmentReference: { sourceId: 'assignment', sourceVersion: 'test', sourceHash: 'a'.repeat(64) },
      officialId: 'umpire', personId: 'umpire-person',
      viewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'moving-call-view', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) },
      judgment: 'caught', calledAt: { originTick: 100, elapsedSeconds: end, tick: 110 } },
  } as Parameters<typeof deriveSamePaCatchOperativeRuling>[0]);
  expect(result.kind).toBe('retired');
  if (result.kind !== 'retired') throw new Error('caught action did not retire its batter');
  expect(result.ledger.events[0].kind).toBe('UnresolvedCorrectRuleSnapshotRecorded');
  expect(result.onFieldCall.ruling).toEqual({ outsAfter: 1, basesAfter: input.originalMatch.bases, scoredRunnerIds: [] });
});

const movingOfficialFixture = (scored = false) => {
  const physical = physicalFixture(100, 1, 5, 5), initial = deriveInitialBattedWorldFieldMotion(physical);
  const plan = prepareBattedWorldScheduledFieldAcquisition({ response: physical.response, geometry: physical.geometry, field: initial });
  const secured = advanceBattedWorldScheduledFieldAcquisition({ plan, previous: null, throughElapsedSeconds: plan.fenceElapsedSeconds });
  if (secured.kind !== 'secured') throw new Error('moving official catch fixture missing');
  const end = secured.world.moment.elapsedSeconds, originTick = 100, ticksPerSecond = physical.response.world.parameters.ticksPerSecond;
  const moment = { originTick, elapsedSeconds: end, tick: secured.world.moment.ball.tick };
  const input = fixture(), startingBase = scored ? 'third' as const : 'first' as const;
  const originalMatch = { ...input.originalMatch, bases: { first: scored ? null : 'runner', second: null, third: scored ? 'runner' : null } };
  const runnerEvidence: ActualFairCatchOccupiedRunnerEvidence = { kind: 'same_pa_occupied_fair_catch_runner_evidence_v1', runners: [{
    playerId: 'runner', startingBase, holdReference: { owner: 'world_same_pa_occupied_runner_holds', sourceId: 'runner-hold', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) },
    bases: (['home', 'first', 'second', 'third'] as const).map(base => {
      const origin = base === startingBase, destination = base === (scored ? 'home' : 'second');
      const episodes = origin ? [{ startElapsedSeconds: 0, endElapsedSeconds: end / 3 }]
        : destination ? [{ startElapsedSeconds: 2 * end / 3, endElapsedSeconds: end }] : [];
      return { base, history: { playerId: 'runner', originTick, ticksPerSecond, startElapsedSeconds: 0, endElapsedSeconds: end,
        contactAtStart: origin, contactAtHorizon: destination, episodes, events: episodes.flatMap(e => [
          { kind: 'touch' as const, originTick, elapsedSeconds: e.startElapsedSeconds, tick: quantizeEventTick(originTick, e.startElapsedSeconds, ticksPerSecond) },
          ...(e.endElapsedSeconds < end ? [{ kind: 'departure' as const, originTick, elapsedSeconds: e.endElapsedSeconds, tick: quantizeEventTick(originTick, e.endElapsedSeconds, ticksPerSecond) }] : [])]) } };
    }),
  }] };
  const field = { baseContacts: [], evidence: { batterRunnerId: 'batter', defenderIds: ['carrier', 'receiver'],
    field: physical.geometry.baseGeometry.field, bases: physical.geometry.baseGeometry.gates,
    ballRadiusMeters: physical.response.world.parameters.ballRadius, originTick, ticksPerSecond, horizon: secured.world.moment,
    contacts: [{ moment: plan.contactMoment, contacts: [{ kind: 'actor' as const, playerId: plan.acquirerPlayerId, role: 'glove' as const }] }], acquisitions: [secured.acquisition] } };
  const operative = deriveSamePaCatchOperativeRuling({ originalMatch, batterRunnerId: 'batter', basisTick: moment.tick, basisEvidenceRevision: 3,
    occupiedRunnerEvidence: runnerEvidence, fairCatch: { kind: 'pending', reason: 'runner_claim_pending_at_call' },
    action: { sourceId: 'actual-moving-call', sourceVersion: 'test', capability: 'same_pa_explicit_catch_action_v1',
      assignmentReference: { sourceId: 'assignment', sourceVersion: 'test', sourceHash: 'a'.repeat(64) }, officialId: 'umpire', personId: 'umpire-person',
      viewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'moving-call-view', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) }, judgment: 'caught', calledAt: moment } });
  if (operative.kind !== 'retired') throw new Error('moving original call missing');
  return { ...input, originalMatch, operative, exactEnd: moment, physicalEnd: createPlayEndFact(moment.tick, 'live_action_complete'),
    runnerOutcomeEvidence: { field, runnerEvidence }, callProvenance: { ...input.callProvenance, clock: { originTick, ticksPerSecond },
      calledAtElapsedSeconds: end, availableAtElapsedSeconds: end, importedAtElapsedSeconds: end } };
};

it.each([false, true])('requires and consumes the actual review journal for a legally %s scored moving runner', scored => {
  const input = movingOfficialFixture(scored), policy = { ...input.policy, officialWindows: { ...input.policy.officialWindows, review: { available: true } } };
  const opening = deriveSamePaCatchOfficialOpening({ ...input, policy });
  expect(opening.pendingReasons).toContain('on_field_call_stale');
  expect(opening.originalOperativeLedger).toEqual(input.operative.ledger);
  expect(input.operative.onFieldCall.ruling.basesAfter).toEqual(input.originalMatch.bases);
  const { sourceVersion: _version, ...pin } = ref('pa_physical_v1_field_steps', 'moving-end');
  const source = { sourceId: 'moving-seed', sourceVersion: 'test', capability: 'same_pa_catch_review_seed_v1' as const,
    viewReference: { ...pin, owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'end-view' },
    catchWorkReference: { ...pin, owner: 'pa_catch_v1_work' as const, sourceId: 'call-work' },
    physicalOperationReference: { ...pin, owner: 'pa_physical_v1_field_steps' as const }, policy };
  const seed = { source, snapshotHash: hash(opening), gameId: 'game', playId: 7, physicalPitchSourceId: 'reserved-pitch',
    ruleProfile: actualLiveAdjudicationProfile(input.originalMatch.ruleProfileId, policy), exactEnd: input.exactEnd,
    endReference: ref('pa_physical_v1_field_steps', 'moving-end'), kind: 'official_pending' as const, ledger: opening.ledger,
    pendingReasons: opening.pendingReasons, fairCatchRunnerOutcome: opening.fairCatchRunnerOutcome };
  const session = { sourceId: 'moving-review', sourceVersion: 'test', capability: 'actual_post_play_review_session_v1' as const,
    adjudicationSourceId: source.sourceId, adjudicationSnapshotHash: seed.snapshotHash, officialPolicy: policy, reservedCatchSeed: source,
    policy: { sourceId: 'review-policy', sourceVersion: 'test', ruleProfileId: policy.ruleProfileId, openingTrigger: 'physical_play_end' as const,
      clock: 'post_play_discrete_tick_v1' as const, schedulerId: 'scheduler', expiryScope: 'request_admission' as const,
      opportunities: [{ windowKind: 'review' as const, windowId: 'review', entitlementSourceId: 'entitlement', clubId: 'club', requesterIds: ['reviewer'], reviewerIds: ['reviewer'] }] } };
  let reviewed = initializeActualPostPlayReview({ source: session, seed });
  const step = (action: ActualPostPlayReviewEventAction, intent?: AcceptedActualPostPlayOfficialIntent) => {
    reviewed = advanceActualPostPlayReview({ previous: reviewed, source: { sourceId: 'moving-event:' + reviewed.revision, sourceVersion: 'test',
      capability: 'actual_post_play_review_event_v1', sessionSourceId: session.sourceId, expectedRevision: reviewed.revision,
      parent: { sourceId: reviewed.headSourceId, snapshotHash: reviewed.headHash }, action }, ...(intent ? { intent } : {}) });
  };
  const callId = input.operative.onFieldCall.callId;
  step({ kind: 'official_request', windowId: 'review', callId, intentSourceId: 'moving-intent' }, {
    sourceId: 'moving-intent', sourceVersion: 'test', capability: 'actual_post_play_review_official_intent_v1', sessionSourceId: session.sourceId,
    gameId: 'game', playId: 7, physicalPitchSourceId: 'reserved-pitch', callId, windowId: 'review', entitlementSourceId: 'entitlement', officialId: 'reviewer', action: 'request' });
  step({ kind: 'advance_tick', schedulerId: 'scheduler' });
  step({ kind: 'decision', windowId: 'review', requestEventSourceId: 'moving-event:0', reviewId: 'moving-review-decision', callId,
    reviewerId: 'reviewer', basisSnapshotId: opening.fairCatchRunnerOutcome!.snapshotId,
    basisEvidenceRevision: opening.fairCatchRunnerOutcome!.evidenceRevision, decision: 'overturned' });
  const result = deriveSamePaCatchOfficial({ ...input, sourceId: 'different-recording-source', policy, reviewed });
  expect(result.kind).toBe('closed');
  const delta = getOfficialPlayClosure(result.ledger)!.officialDelta;
  expect(delta).toMatchObject({ outsAfter: 1, basesAfter: { first: null, second: scored ? null : 'runner', third: null }, scoredRunnerIds: scored ? ['runner'] : [] });
  const altered = structuredClone(seed);
  (altered.fairCatchRunnerOutcome!.runnerEvidence.runners[0].bases.find(b => b.base === startingBaseFor(scored))!.history as { contactAtHorizon: boolean }).contactAtHorizon = true;
  expect(() => initializeActualPostPlayReview({ source: session, seed: altered })).toThrow();
});
const startingBaseFor = (scored: boolean) => scored ? 'third' : 'first';

// Exact-history author fixture only. Native receipt and rights admission are
// independently tested by their existing owners; no durable physical chain is claimed.
const appealOfficialFixture = (sustained: boolean) => {
  const input = movingOfficialFixture(), clock = input.runnerOutcomeEvidence.field.evidence, originTick = clock.originTick;
  const tick = (elapsedSeconds: number) => quantizeEventTick(originTick, elapsedSeconds, clock.ticksPerSecond);
  const shifted = (m: typeof clock.horizon) => ({ ...m, elapsedSeconds: m.elapsedSeconds + 1, ball: { ...m.ball, tick: tick(m.elapsedSeconds + 1) } });
  const field = { ...input.runnerOutcomeEvidence.field, evidence: { ...clock,
    contacts: clock.contacts.map(f => ({ ...f, moment: shifted(f.moment) })),
    acquisitions: clock.acquisitions.map(a => ({ ...a, contactMoment: shifted(a.contactMoment), moment: shifted(a.moment), secureTick: tick(a.moment.elapsedSeconds + 1) })),
    horizon: { ...clock.horizon, elapsedSeconds: 5, ball: { ...clock.horizon.ball, tick: tick(5) } } } };
  const history = (base: string, through = 5) => {
    const end = sustained ? 0.5 : through, occupied = base === 'first';
    return { playerId: 'runner', originTick, ticksPerSecond: clock.ticksPerSecond, startElapsedSeconds: 0, endElapsedSeconds: through,
      contactAtStart: occupied, contactAtHorizon: occupied && !sustained,
      episodes: occupied ? [{ startElapsedSeconds: 0, endElapsedSeconds: end }] : [],
      events: occupied ? [{ kind: 'touch' as const, originTick, elapsedSeconds: 0, tick: originTick },
        ...(sustained ? [{ kind: 'departure' as const, originTick, elapsedSeconds: end, tick: tick(end) }] : [])] : [] };
  };
  const executionReference = { owner: 'pa_physical_v1_field_steps' as const, sourceId: 'appeal-execution', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
  const cause = ref('pa_live_ball_v1_actions', 'actual-play');
  const appeal = { executionReference, attempt: createDefensiveAppealAttemptFact('carrier', 'runner', 1, 'tag_up_early_departure', tick(3)),
    complianceEvidence: { kind: 'ball_world_tag_up_history_v1' as const, history: history('first', 3), originBase: 'first' as const,
      firstTouch: { fact: createFlyBallFirstFielderTouchFact('carrier', tick(1)), originTick, elapsedSeconds: 1 } },
    clock: { originTick, ticksPerSecond: clock.ticksPerSecond }, indicatedAtElapsedSeconds: 2, executedAtElapsedSeconds: 3, evaluatedThroughElapsedSeconds: 5,
    evidence: { version: 'owned_live_appeal_rights_evidence_v1' as const, liveAtExecution: { kind: 'live' as const, playDeclaration: cause,
      at: { originTick, elapsedSeconds: 0, tick: originTick }, coveredThroughElapsedSeconds: 3 },
      window: { openedAtElapsedSeconds: field.evidence.acquisitions[0].moment.elapsedSeconds, closedAtElapsedSeconds: null, closeReason: null }, appealThrowForfeitures: [] } };
  const runnerEvidence: ActualFairCatchOccupiedRunnerEvidence = { ...input.runnerOutcomeEvidence.runnerEvidence, appeals: [appeal],
    runners: input.runnerOutcomeEvidence.runnerEvidence.runners.map(r => ({ ...r, bases: r.bases.map(b => ({ base: b.base, history: history(b.base) })) })) };
  const at = { ...input.operative.at, elapsedSeconds: input.operative.at.elapsedSeconds + 1, tick: input.operative.at.tick + clock.ticksPerSecond };
  const onFieldCall = { ...input.operative.onFieldCall, tick: at.tick };
  let ledger = createPlayAdjudicationLedger({ playId: 7, ruleProfileId: input.originalMatch.ruleProfileId, playEnd: null });
  ledger = recordUnresolvedCorrectRuleSnapshot(ledger, 0, { eventId: 'original-unresolved', tick: at.tick,
    snapshotId: onFieldCall.basisSnapshotId, evidenceRevision: onFieldCall.basisEvidenceRevision, reason: 'insufficient_evidence' });
  ledger = recordOnFieldCall(ledger, ledger.revision, { eventId: 'original-caught', ...onFieldCall });
  return { ...input, operative: { ...input.operative, at, onFieldCall, ledger }, runnerOutcomeEvidence: { field, runnerEvidence },
    exactEnd: { originTick, elapsedSeconds: 5, tick: tick(5) }, physicalEnd: createPlayEndFact(tick(5), 'live_action_complete'),
    callProvenance: { ...input.callProvenance, calledAtElapsedSeconds: at.elapsedSeconds, availableAtElapsedSeconds: at.elapsedSeconds, importedAtElapsedSeconds: 5 }, appeal };
};

it.each([true, false])('explicitly accepts the authenticated %s appeal result through the actual on-field-call path', sustained => {
  const input = appealOfficialFixture(sustained), policy = { ...input.policy, officialWindows: { ...input.policy.officialWindows, review: { available: true } } };
  const opening = deriveSamePaCatchOfficialOpening({ ...input, policy });
  expect(opening.pendingReasons).toContain('original_live_appeal_official_judgment_required');
  const { sourceVersion: _version, ...pin } = ref('pa_physical_v1_field_steps', 'appeal-end');
  const source = { sourceId: 'appeal-seed', sourceVersion: 'test', capability: 'same_pa_catch_review_seed_v1' as const,
    viewReference: { ...pin, owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'appeal-end-view' },
    catchWorkReference: { ...pin, owner: 'pa_catch_v1_work' as const, sourceId: 'call-work' },
    physicalOperationReference: { ...pin, owner: 'pa_physical_v1_field_steps' as const }, policy };
  const seed = { source, snapshotHash: hash(opening), gameId: 'game', playId: 7, physicalPitchSourceId: 'reserved-pitch',
    ruleProfile: actualLiveAdjudicationProfile(input.originalMatch.ruleProfileId, policy), exactEnd: input.exactEnd,
    endReference: ref('pa_physical_v1_field_steps', 'appeal-end'), kind: 'official_pending' as const, ledger: opening.ledger,
    pendingReasons: opening.pendingReasons, fairCatchRunnerOutcome: opening.fairCatchRunnerOutcome };
  const session = { sourceId: 'appeal-session', sourceVersion: 'test', capability: 'actual_post_play_review_session_v1' as const,
    adjudicationSourceId: source.sourceId, adjudicationSnapshotHash: seed.snapshotHash, officialPolicy: policy, reservedCatchSeed: source,
    policy: { sourceId: 'appeal-policy', sourceVersion: 'test', ruleProfileId: policy.ruleProfileId, openingTrigger: 'physical_play_end' as const,
      clock: 'post_play_discrete_tick_v1' as const, schedulerId: 'scheduler', expiryScope: 'request_admission' as const,
      opportunities: [{ windowKind: 'review' as const, windowId: 'review', entitlementSourceId: 'appeal-entitlement', clubId: 'club', requesterIds: ['official'], reviewerIds: ['official'] }] } };
  let reviewed = initializeActualPostPlayReview({ source: session, seed });
  const event = (action: ActualPostPlayReviewEventAction) => ({ sourceId: 'appeal-event:' + reviewed.revision, sourceVersion: 'test',
    capability: 'actual_post_play_review_event_v1', sessionSourceId: session.sourceId, expectedRevision: reviewed.revision,
    parent: { sourceId: reviewed.headSourceId, snapshotHash: reviewed.headHash }, action });
  const { appeal } = input, acceptance = { kind: 'accept_live_appeal_result' as const, executionReferences: [appeal.executionReference],
    callId: input.operative.onFieldCall.callId, windowId: 'review', intentSourceId: 'appeal-acceptance',
    basisSnapshotId: opening.fairCatchRunnerOutcome!.snapshotId, basisEvidenceRevision: opening.fairCatchRunnerOutcome!.evidenceRevision };
  const intent = { sourceId: 'appeal-acceptance', sourceVersion: 'test', capability: 'actual_post_play_review_official_intent_v1',
    sessionSourceId: session.sourceId, gameId: 'game', playId: 7, physicalPitchSourceId: 'reserved-pitch', callId: acceptance.callId,
    windowId: 'review', entitlementSourceId: 'appeal-entitlement', officialId: 'official', action: 'accept_live_appeal_result',
    executionReferences: acceptance.executionReferences, basisSnapshotId: acceptance.basisSnapshotId, basisEvidenceRevision: acceptance.basisEvidenceRevision };
  expect(() => advanceActualPostPlayReview({ previous: reviewed, source: event(acceptance), intent })).toThrow(/import|admitted/);
  const liveAppealImport = { attempt: appeal.attempt, complianceEvidence: appeal.complianceEvidence,
    provenance: { version: 'owned_live_appeal_import_v1' as const, playId: 7, gameId: 'game', physicalPitchSourceId: 'reserved-pitch', clock: appeal.clock,
      indicatedAtElapsedSeconds: 2, executedAtElapsedSeconds: 3, importedAtElapsedSeconds: 5,
      indication: ref('pa_physical_v1_field_steps', 'actual-indication'), throwPlan: ref('pa_physical_v1_field_steps', 'actual-throw'),
      execution: { ...appeal.executionReference, sourceVersion: 'test' } }, rights: { kind: 'pending' as const, reason: 'original_live_ball_and_appeal_rights_required' as const } };
  reviewed = advanceActualPostPlayReview({ previous: reviewed, source: event({ kind: 'import_live_appeal', executionReference: appeal.executionReference }), liveAppealImport });
  expect(() => advanceActualPostPlayReview({ previous: reviewed, source: event(acceptance), intent })).toThrow(/import|admitted/);
  const liveAppealRights = { provenance: { version: 'owned_live_appeal_rights_admission_v1', originalImport: liveAppealImport.provenance,
    admittedAtElapsedSeconds: 5, legalState: ref('same_pa_live_ball_history_v1', 'legal-history'), venue: ref('same_pa_venue_legal_coverage_v1', 'venue') }, evidence: appeal.evidence };
  reviewed = advanceActualPostPlayReview({ previous: reviewed, source: event({ kind: 'admit_live_appeal_rights', executionReference: appeal.executionReference }), liveAppealRights });
  expect(reviewed.pendingReasons).toContain('appeal_requires_updated_correct_rule_snapshot');
  const before = reviewed, originalImports = reviewed.ledger.events.filter(e => e.kind === 'OwnedLiveAppealImported' || e.kind === 'OwnedLiveAppealRightsAdmitted');
  expect(() => advanceActualPostPlayReview({ previous: reviewed, source: event(acceptance) })).toThrow(/intent/);
  expect(() => advanceActualPostPlayReview({ previous: reviewed, source: event({ ...acceptance, basisEvidenceRevision: 99 }), intent })).toThrow(/basis/);
  reviewed = advanceActualPostPlayReview({ previous: reviewed, source: event(acceptance), intent });
  expect(reviewed.kind).toBe('official_ready');
  expect(reviewed.ledger.events.filter(e => e.kind === 'OwnedLiveAppealImported' || e.kind === 'OwnedLiveAppealRightsAdmitted')).toEqual(originalImports);
  expect(reviewed.ledger.events.slice(before.ledger.events.length).map(e => e.kind)).toEqual(['CorrectRuleSnapshotRecorded', 'OnFieldCallRecorded', 'OfficialStateWindowClosed']);
  expect(reviewed.ledger.events.find(e => e.kind === 'OwnedLiveCallImported')).toMatchObject({ call: input.operative.onFieldCall });
  const result = deriveSamePaCatchOfficial({ ...input, policy, reviewed });
  expect(result.kind).toBe('closed');
  expect(getOfficialPlayClosure(result.ledger)).toMatchObject({ finalRuling: { source: 'on_field_call', rulingId: 'appeal-event:2:appeal-call' },
    officialDelta: { outsAfter: sustained ? 2 : 1, basesAfter: { first: sustained ? null : 'runner', second: null, third: null }, scoredRunnerIds: [] } });
  const originalTimeline = recordBatBallContact(createCanonicalPlateAppearanceTimeline(input.originalMatch, 0),
    physicalFixture(input.exactEnd.originTick, 1, 5, 5).response.world.flight.contact);
  const fairCatchEvidence = { originalTimeline, field: input.runnerOutcomeEvidence.field, playEnd: input.physicalEnd,
    occupiedRunnerEvidence: input.runnerOutcomeEvidence.runnerEvidence };
  const projected = projectActualFairFieldTimeline({ originalTimeline, field: fairCatchEvidence.field, playEnd: fairCatchEvidence.playEnd });
  if (projected.kind !== 'projected') throw new Error('appeal official timeline missing');
  expect(deriveClosedLiveBallMatchState(input.originalMatch, projected.timeline, result.ledger))
    .toMatchObject({ outs: sustained ? 2 : 1, bases: { first: sustained ? null : 'runner', second: null, third: null } });
  expect(classifyClosedPlayForOfficialScoring({ kind: 'live_ball', match: input.originalMatch, timeline: projected.timeline,
    adjudication: result.ledger, fairCatchEvidence })).toMatchObject({ kind: 'supported', record: { classification: 'fly_out', runsScored: 0 } });
  expect(() => advanceActualPostPlayReview({ previous: reviewed, source: event(acceptance), intent: { ...intent, sourceId: 'again' } })).toThrow();
});
