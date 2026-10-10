import { expect } from 'vitest';
import { closeOfficialPlay, closeOfficialStateWindow, getOfficialPlayClosure, getOfficialStateWindows,
  getOwnedLiveAppealRightsAdmissions, getPendingOwnedLiveAppealImports, getPlayAdjudicationState,
  recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import type { ActualLiveOfficialPolicy } from './ActualLiveAdjudicationSource';
import type { AcceptedActualPostPlayOfficialIntent, AcceptedActualPostPlayReviewEvent,
  AcceptedActualPostPlayReviewSession, ActualPostPlayReviewEventAction } from './ActualPostPlayReviewSource';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { deriveSamePaCatchReviewSeedFromSqlite } from './SamePlateAppearanceCatchReviewFromSqlite';
import type { SamePaCatchReviewSeedSource } from './SamePlateAppearanceCatchReviewSource';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { openSqliteActualPostPlayReviewStore } from './SqliteActualPostPlayReviewStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** Import the original live appeal only after the physical end is independently
 * sealed. Native replays the field receipt, original rights and caught call;
 * accepted Sources contain references and an explicit official instruction. */
export const appendNativeLiveAppealJournal = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>,
  catchWorkReference: SamePaReference<'pa_catch_v1_work'>,
  executionReference: SamePaReference<'pa_physical_v1_field_steps'>,
  policy: ActualLiveOfficialPolicy, label: string, schedulerId: string) => {
  const current = h.current(), physicalOperationReference = current.view.cut.physicalOperationReference;
  if (physicalOperationReference.owner !== 'pa_physical_v1_field_roots' && physicalOperationReference.owner !== 'pa_physical_v1_field_steps')
    throw new Error('Native live appeal journal requires its original sealed physical field');
  const seedSource: SamePaCatchReviewSeedSource = { sourceId: label + ':seed', sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_catch_review_seed_v1', viewReference: current.viewReference, catchWorkReference,
    physicalOperationReference: { ...physicalOperationReference, owner: physicalOperationReference.owner }, policy };
  const { seed, scope } = withSqliteReadTransaction(h.f.db, () => deriveSamePaCatchReviewSeedFromSqlite(h.f.db, seedSource, 'current'));
  const originalState = getPlayAdjudicationState(seed.ledger);
  if (originalState.kind !== 'official_adjudication_open' || originalState.calls.length !== 1
    || !('ruling' in originalState.latestCorrectRule)) throw new Error('Native live appeal original caught call or resolved rule evidence missing');
  const originalCall = seed.ledger.events.find(e => e.kind === 'OwnedLiveCallImported');
  if (!originalCall) throw new Error('Native live appeal original caught call import missing');
  expect(seed.pendingReasons).toContain('original_live_appeal_official_judgment_required');
  expect(seed.fairCatchRunnerOutcome?.runnerEvidence.appeals?.map(a => a.executionReference)).toEqual([executionReference]);
  expect(scope.originalMatch.bases.first).not.toBeNull();
  expect(scope.originalMatch.bases.second).toBeNull(); expect(scope.originalMatch.bases.third).toBeNull();
  const expectedRuling = { outsAfter: scope.originalMatch.outs + 1, basesAfter: scope.originalMatch.bases, scoredRunnerIds: [] };
  expect(originalState.latestCorrectRule.ruling).toEqual(expectedRuling);
  expect(originalCall.call.tick).toBeLessThanOrEqual(seed.exactEnd.tick);
  expect(originalCall.provenance.calledAtElapsedSeconds).toBeLessThanOrEqual(seed.exactEnd.elapsedSeconds);

  const callId = originalCall.call.callId, windowId = label + ':window', entitlementSourceId = label + ':entitlement',
    officialId = label + ':appeal-official';
  const session: AcceptedActualPostPlayReviewSession = h.save({ sourceId: label + ':session', sourceVersion: 'fixture-only-v1',
    capability: 'actual_post_play_review_session_v1', adjudicationSourceId: seedSource.sourceId,
    adjudicationSnapshotHash: seed.snapshotHash, reservedCatchSeed: seedSource, officialPolicy: policy,
    policy: { sourceId: label + ':policy', sourceVersion: 'explicit-fixture-v1', ruleProfileId: scope.originalMatch.ruleProfileId,
      openingTrigger: 'physical_play_end', clock: 'post_play_discrete_tick_v1', schedulerId, expiryScope: 'request_admission',
      opportunities: [{ windowKind: 'review', windowId, entitlementSourceId, clubId: scope.clubs.AWAY,
        requesterIds: [officialId], reviewerIds: [officialId] }] } });
  const get = (id: string) => h.accepted.get(id) ?? null;
  const owner = h.f.x.f.track(openSqliteActualPostPlayReviewStore(h.f.path,
    { readAcceptedSession: get, readAcceptedEvent: get, readAcceptedIntent: get }));
  const accept = (result: ReturnType<typeof owner.acceptSession> | ReturnType<typeof owner.acceptEvent>) => {
    if (result.kind !== 'accepted') throw new Error('Native live appeal journal intake pending: ' + json(result));
    return result.value;
  };
  let value = accept(owner.acceptSession(session.sourceId));
  expect(value.kind).toBe('official_pending');
  const append = (name: string, action: ActualPostPlayReviewEventAction) => {
    const source: AcceptedActualPostPlayReviewEvent = h.save({ sourceId: label + ':' + name, sourceVersion: 'explicit-fixture-v1',
      capability: 'actual_post_play_review_event_v1', sessionSourceId: session.sourceId, expectedRevision: value.revision,
      parent: { sourceId: value.headSourceId, snapshotHash: value.headHash }, action });
    value = accept(owner.acceptEvent(source.sourceId));
    return source;
  };

  append('import', { kind: 'import_live_appeal', executionReference });
  const imported = value;
  expect(getPendingOwnedLiveAppealImports(imported.ledger)).toHaveLength(1);
  expect(imported.pendingReasons).toContain('original_live_ball_and_appeal_rights_required');
  const originalAppeal = getPendingOwnedLiveAppealImports(imported.ledger)[0];
  expect(originalCall.provenance.calledAtElapsedSeconds).toBeLessThanOrEqual(originalAppeal.provenance.executedAtElapsedSeconds);
  expect(originalAppeal.provenance.executedAtElapsedSeconds).toBeLessThanOrEqual(seed.exactEnd.elapsedSeconds);

  append('rights', { kind: 'admit_live_appeal_rights', executionReference });
  const admitted = value;
  expect(getPendingOwnedLiveAppealImports(admitted.ledger)).toEqual([]);
  const rights = getOwnedLiveAppealRightsAdmissions(admitted.ledger);
  expect(rights).toHaveLength(1);
  expect(rights[0].provenance.originalImport).toEqual(originalAppeal.provenance);
  expect(rights[0].disposition).toEqual({ kind: 'eligible', result: {
    kind: 'no_violation', runnerId: scope.originalMatch.bases.first, appealedBase: 1 } });
  expect(admitted.kind).toBe('official_pending');
  expect(admitted.pendingReasons).toContain('appeal_requires_updated_correct_rule_snapshot');
  expect(admitted.pendingReasons).toContain('original_live_appeal_official_judgment_required');
  const beforeAcceptance = getPlayAdjudicationState(admitted.ledger);
  if (beforeAcceptance.kind !== 'official_adjudication_open' || !('ruling' in beforeAcceptance.latestCorrectRule))
    throw new Error('Native live appeal rights must retain original rule evidence');
  expect(beforeAcceptance.calls).toEqual(originalState.calls);
  expect(beforeAcceptance.latestCorrectRule).toEqual(originalState.latestCorrectRule);

  // Core's private liveAppealCallPending obligation is observable through its
  // closure guard. Refresh authentic rule data and close windows on a pure
  // probe; this probe is never passed to a Native writer or used as the result.
  const latest = beforeAcceptance.latestCorrectRule;
  let probe = recordCorrectRuleSnapshot(admitted.ledger, admitted.ledger.revision, { eventId: label + ':probe-rule',
    tick: admitted.cursor.tick, snapshotId: label + ':probe-snapshot', evidenceRevision: latest.evidenceRevision + 1,
    ruling: latest.ruling });
  for (const window of getOfficialStateWindows(probe).filter(w => w.closedAtTick === null)) {
    probe = closeOfficialStateWindow(probe, probe.revision, { eventId: label + ':probe-close:' + window.windowId,
      tick: admitted.cursor.tick, windowId: window.windowId, reason: 'resolved' });
  }
  expect(() => closeOfficialPlay(probe, probe.revision, { eventId: label + ':probe-closure',
    tick: admitted.cursor.tick, closureId: label + ':probe-closure' }))
    .toThrow('live appeal rights admission requires an explicit on-field call');

  const intent: AcceptedActualPostPlayOfficialIntent = h.save({ sourceId: label + ':official-intent', sourceVersion: 'explicit-fixture-v1',
    capability: 'actual_post_play_review_official_intent_v1', sessionSourceId: session.sourceId, gameId: scope.gameId,
    playId: scope.playId, physicalPitchSourceId: scope.physicalPitchSourceId, callId, windowId, entitlementSourceId, officialId,
    action: 'accept_live_appeal_result', executionReferences: [executionReference],
    basisSnapshotId: latest.snapshotId, basisEvidenceRevision: latest.evidenceRevision });
  const acceptance = append('accept-result', { kind: 'accept_live_appeal_result', executionReferences: [executionReference],
    callId, windowId, intentSourceId: intent.sourceId, basisSnapshotId: latest.snapshotId, basisEvidenceRevision: latest.evidenceRevision });
  const acceptedResult = value, added = acceptedResult.ledger.events.slice(admitted.ledger.events.length);
  expect(added.map(e => e.kind)).toEqual(['CorrectRuleSnapshotRecorded', 'OnFieldCallRecorded', 'OfficialStateWindowClosed']);
  expect(acceptedResult.events.at(-1)?.intent).toEqual(intent);
  expect(acceptedResult.ledger.events.slice(0, admitted.ledger.events.length)).toEqual(admitted.ledger.events);
  expect(acceptedResult.ledger.events.find(e => e.kind === 'OwnedLiveCallImported')).toEqual(originalCall);
  const acceptedState = getPlayAdjudicationState(acceptedResult.ledger);
  if (acceptedState.kind !== 'official_adjudication_open') throw new Error('Native live appeal result must precede final closure');
  expect(acceptedState.calls).toHaveLength(2);
  expect(acceptedState.calls[1]).toMatchObject({ callId: acceptance.sourceId + ':appeal-call',
    basisSnapshotId: acceptance.sourceId + ':appeal-rule-snapshot', basisEvidenceRevision: latest.evidenceRevision + 1,
    tick: acceptedResult.cursor.tick, ruling: expectedRuling });

  append('next-play-fence', { kind: 'next_play_fence', schedulerId });
  expect(value.kind).toBe('official_ready'); expect(value.pendingReasons).toEqual([]);
  expect(value.seed).toEqual(seed); expect(value.ledger.playEnd).toEqual(seed.ledger.playEnd);
  expect(getOfficialPlayClosure(value.ledger)).toBeNull();
  const closedProbe = closeOfficialPlay(value.ledger, value.ledger.revision, { eventId: label + ':accepted-closure-probe',
    tick: value.cursor.tick, closureId: label + ':accepted-closure-probe' });
  expect(getOfficialPlayClosure(closedProbe)?.finalRuling).toMatchObject({ source: 'on_field_call',
    rulingId: acceptance.sourceId + ':appeal-call', gameplay: expectedRuling });

  const pin = { sessionSourceId: session.sourceId, revision: value.revision, headSourceId: value.headSourceId, headHash: value.headHash };
  const rows = () => json(['actual_post_play_review_sessions', 'actual_post_play_review_events', 'actual_post_play_review_heads']
    .map(table => h.f.db.prepare('SELECT * FROM main.' + table + ' ORDER BY rowid').all()));
  const saved = rows(); owner.close();
  const reopened = h.f.x.f.track(openSqliteActualPostPlayReviewStore(h.f.path));
  expect(reopened.readCurrent(session.sourceId)).toEqual(value);
  expect(accept(reopened.acceptSession(session.sourceId))).toEqual(reopened.readSession(session.sourceId));
  expect(rows()).toBe(saved);
  return { pin, value, seed, imported, admitted, acceptedResult, assertHistoricalReplay: () => {
    expect(reopened.readCurrent(session.sourceId)).toEqual(value); expect(rows()).toBe(saved);
  } };
};
