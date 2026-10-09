import { samePaCatchReviewSeedInput, type SamePaCatchReviewSeedSource } from './SamePlateAppearanceCatchReviewSource';
import type { deriveSamePaBaseAppealExecution, deriveSamePaRunnerBodyAppealExecution } from './SamePlateAppearanceBaseAppealExecution';
import { cloneInert, openRuleProfileOfficialStateWindow } from '../../core/adjudication/OfficialWindowPolicy';
import { getPlayAdjudicationState, getOfficialStateWindows, type PlayAdjudicationLedger,
  getPendingOwnedLiveAppealImports, type recordOwnedLiveAppealImport,
  type OwnedLiveCallSourceReference, type OwnedLiveCallImported } from '../../core/adjudication/PlayAdjudicationLedger';
import type { RuleProfile } from '../../core/rules/RuleProfile';
import type { DecisionEvidenceProjection } from '../../core/world/control/ControlTypes';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { actualLiveAdjudicationInput, actualLiveAdjudicationProfile, type AcceptedActualLiveAdjudication } from './ActualLiveAdjudicationSource';
import type { ActualObservationMoment } from './ActualFieldObservation';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualPostPlayReviewSessionInput, postPlayHash, postPlayRevision,
  type AcceptedActualPostPlayReviewSession, type AcceptedActualPostPlayReviewEvent,
  type AcceptedActualPostPlayReviewIntent } from './ActualPostPlayReviewSource';

export type PostPlayBaseAppealExecution = Extract<ReturnType<typeof deriveSamePaBaseAppealExecution>
  | ReturnType<typeof deriveSamePaRunnerBodyAppealExecution>, { kind: 'ready' }>;
/** Structural replay input. Only Native derives this from the original receipt. */
export type PostPlayLiveAppealImport = Omit<Parameters<typeof recordOwnedLiveAppealImport>[2], 'eventId' | 'tick'>;

/** A narrow projection of Native-authenticated seed and sealed-end evidence. */
export type ActualPostPlayReviewSeed = Readonly<{
  source: AcceptedActualLiveAdjudication | SamePaCatchReviewSeedSource; snapshotHash: string; gameId: string; playId: number;
  physicalPitchSourceId: string; ruleProfile: RuleProfile; exactEnd: ActualObservationMoment;
  endReference: OwnedLiveCallSourceReference; kind: 'official_pending' | 'official_ready';
  ledger: PlayAdjudicationLedger; pendingReasons: readonly string[];
}>;
export type ActualPostPlayReviewRequest = Readonly<{
  sourceId: string; windowId: string; callId: string; tick: number; intentSourceId: string;
  status: 'review_pending' | 'timing_unresolved' | 'expired' | 'resolved';
  attribution: DecisionEvidenceProjection | null; pendingReason: string | null;
}>;
export type ActualPostPlayReviewJournalEvent = Readonly<{
  source: AcceptedActualPostPlayReviewEvent; intent: AcceptedActualPostPlayReviewIntent | null;
  tick: number; coreEventIds: readonly string[];
  baseAppeal?: PostPlayBaseAppealExecution;
  liveAppealImport?: PostPlayLiveAppealImport;
}>;
export type ActualPostPlayReviewProjection = Readonly<{
  source: AcceptedActualPostPlayReviewSession; seed: ActualPostPlayReviewSeed; ruleProfile: RuleProfile;
  revision: number; headSourceId: string; headHash: string;
  cursor: Readonly<{ originTick: number; ticksPerSecond: number; tick: number; offsetTicks: number }>;
  ledger: PlayAdjudicationLedger; requests: readonly ActualPostPlayReviewRequest[];
  events: readonly ActualPostPlayReviewJournalEvent[];
  kind: 'official_pending' | 'official_ready'; pendingReasons: readonly string[];
}>;
export type PostPlayProjectionBody = Omit<ActualPostPlayReviewProjection, 'headHash' | 'kind' | 'pendingReasons'>;
export const postPlayOpenState = (ledger: PlayAdjudicationLedger) => {
  const state = getPlayAdjudicationState(ledger);
  if (state.kind !== 'official_adjudication_open') throw new Error('post-play review requires open adjudication and rule evidence');
  return state;
};
export const originalPostPlayCall = (ledger: PlayAdjudicationLedger): OwnedLiveCallImported => {
  const imports = ledger.events.filter((e): e is OwnedLiveCallImported => e.kind === 'OwnedLiveCallImported');
  if (imports.length !== 1) throw new Error('post-play review requires its single original imported call');
  return imports[0];
};

/** Readiness is derived anew; a closed opportunity does not cure a stale call. */
export const finalizePostPlayReview = (body: PostPlayProjectionBody): ActualPostPlayReviewProjection => {
  const replaced = new Set(['on_field_call_stale', 'official_window_owner_unavailable:review', 'official_window_owner_unavailable:challenge',
    'official_window_policy_unconfigured:review', 'official_window_policy_unconfigured:challenge']);
  const pending = body.seed.pendingReasons.filter(reason => !replaced.has(reason));
  const lastAppeal = body.ledger.events.reduce((last, e, i) => e.kind === 'DefensiveAppealAttemptRecorded' || e.kind === 'OwnedLiveAppealImported' ? i : last, -1);
  const lastRule = body.ledger.events.reduce((last, e, i) => e.kind === 'CorrectRuleSnapshotRecorded' || e.kind === 'UnresolvedCorrectRuleSnapshotRecorded' ? i : last, -1);
  if (lastAppeal > lastRule) pending.push('appeal_requires_updated_correct_rule_snapshot');
  for (const imported of getPendingOwnedLiveAppealImports(body.ledger)) pending.push(imported.rights.reason);
  for (const kind of ['review', 'challenge'] as const) {
    const policy = body.ruleProfile.officialWindows?.[kind];
    if (!policy) pending.push(`official_window_policy_unconfigured:${kind}`);
    else if (policy.available) {
      if (body.source.policy === null) pending.push('opening_event_unowned');
      else if (!body.source.policy.opportunities.some(o => o.windowKind === kind)) pending.push(`official_window_entitlement_unowned:${kind}`);
    }
  }
  for (const window of getOfficialStateWindows(body.ledger)) {
    if (window.closedAtTick === null) pending.push(`official_window_open:${window.windowId}`);
  }
  for (const request of body.requests) {
    if (request.status === 'review_pending') pending.push(`review_pending:${request.sourceId}`);
    if (request.status === 'timing_unresolved') pending.push(`review_timing_unresolved:${request.sourceId}`);
    if (request.pendingReason !== null) pending.push(request.pendingReason);
  }
  const state = postPlayOpenState(body.ledger), call = originalPostPlayCall(body.ledger).call;
  const review = [...state.reviews].reverse().find(r => r.callId === call.callId);
  const ruling = review ?? call;
  if (ruling.basisSnapshotId !== state.latestCorrectRule.snapshotId || ruling.basisEvidenceRevision !== state.latestCorrectRule.evidenceRevision) {
    pending.push(review ? 'review_stale' : 'on_field_call_stale');
  }
  const pendingReasons = [...new Set(pending)];
  const value = { ...body, kind: pendingReasons.length ? 'official_pending' as const : 'official_ready' as const, pendingReasons };
  return freeze({ ...value, headHash: hash(value) });
};

export const initializePostPlayReview = (raw: unknown): ActualPostPlayReviewProjection => {
  const input = cloneInert(raw) as Readonly<{ source: AcceptedActualPostPlayReviewSession; seed: ActualPostPlayReviewSeed }>;
  if (!fields(input, ['source', 'seed'])) throw new Error('invalid post-play review initialization');
  const source = actualPostPlayReviewSessionInput(input.source, input.source?.sourceId), seed = input.seed;
  if (!fields(seed, ['source', 'snapshotHash', 'gameId', 'playId', 'physicalPitchSourceId', 'ruleProfile', 'exactEnd',
    'endReference', 'kind', 'ledger', 'pendingReasons']) || !id(seed.gameId) || !id(seed.physicalPitchSourceId)
    || !postPlayRevision(seed.playId) || !postPlayHash(seed.snapshotHash) || !Array.isArray(seed.pendingReasons)
    || !seed.pendingReasons.every(id) || !['official_pending', 'official_ready'].includes(seed.kind)) throw new Error('invalid post-play adjudication seed');
  const reserved = source.reservedCatchSeed;
  if (reserved) {
    samePaCatchReviewSeedInput(seed.source);
    if (json(seed.source) !== json(reserved)) throw new Error('reserved catch review seed differs');
  } else actualLiveAdjudicationInput(seed.source as AcceptedActualLiveAdjudication, seed.source?.sourceId);
  if (source.adjudicationSourceId !== seed.source.sourceId || source.adjudicationSnapshotHash !== seed.snapshotHash) {
    throw new Error('post-play adjudication seed identity or snapshot hash differs');
  }
  const reference = seed.endReference;
  if (!fields(reference, ['owner', 'sourceId', 'sourceVersion', 'sourceHash', 'snapshotHash'])
    || (reserved ? json({ owner: reference.owner, sourceId: reference.sourceId, sourceHash: reference.sourceHash, snapshotHash: reference.snapshotHash }) !== json(reserved.physicalOperationReference)
      : reference.owner !== 'actual_first_base_play_ends' || reference.sourceId !== (seed.source as AcceptedActualLiveAdjudication).physicalEndSourceId)
    || ![reference.sourceId, reference.sourceVersion].every(id) || !postPlayHash(reference.sourceHash) || !postPlayHash(reference.snapshotHash)) {
    throw new Error('post-play physical end reference differs');
  }
  const state = postPlayOpenState(seed.ledger), imported = originalPostPlayCall(seed.ledger), clock = imported.provenance.clock;
  if (seed.ledger.playId !== seed.playId || seed.ledger.ruleProfileId !== seed.ruleProfile.id
    || seed.ledger.events.some(e => !['CorrectRuleSnapshotRecorded', 'UnresolvedCorrectRuleSnapshotRecorded', 'OwnedLiveCallImported'].includes(e.kind))
    || imported.provenance.gameId !== seed.gameId || imported.provenance.playId !== seed.playId
    || imported.provenance.physicalPitchSourceId !== seed.physicalPitchSourceId) throw new Error('post-play original call or seed scope differs');
  const at = seed.exactEnd;
  if (!fields(at, ['originTick', 'elapsedSeconds', 'tick']) || !state.playEnd
    || at.originTick !== clock.originTick || at.tick !== state.playEnd.tick || imported.tick !== at.tick
    || at.elapsedSeconds !== imported.provenance.importedAtElapsedSeconds
    || quantizeEventTick(clock.originTick, at.elapsedSeconds, clock.ticksPerSecond) !== at.tick) {
    throw new Error('post-play exact end epoch, clock or quantized moment differs');
  }
  if (json(seed.ruleProfile) !== json(actualLiveAdjudicationProfile(seed.ruleProfile.id, seed.source.policy))
    || seed.source.policy !== null && json(source.officialPolicy) !== json(seed.source.policy)) throw new Error('post-play seed policy differs');
  const ruleProfile = actualLiveAdjudicationProfile(seed.ruleProfile.id, source.officialPolicy);
  if (source.policy !== null && source.policy.ruleProfileId !== ruleProfile.id) throw new Error('post-play session policy RuleProfile differs');
  let ledger = seed.ledger;
  if (source.baseAppealMode) {
    if (ruleProfile.id !== 'npb-2026' || ruleProfile.officialWindows?.appeal?.available !== true)
      throw new Error('original base appeal requires registered NPB appeal availability');
    ledger = openRuleProfileOfficialStateWindow(ledger, ledger.revision, { profile: ruleProfile,
      eventId: `${source.sourceId}:open:base-appeal`, tick: at.tick, windowId: `${source.sourceId}:base-appeal`, windowKind: 'appeal' });
  }
  for (const kind of ['review', 'challenge'] as const) {
    const opportunity = source.policy?.opportunities.find(o => o.windowKind === kind);
    const policy = ruleProfile.officialWindows?.[kind];
    if (opportunity && policy?.available === false) throw new Error('post-play entitlement contradicts unavailable policy');
    if (opportunity && policy?.available === true) ledger = openRuleProfileOfficialStateWindow(ledger, ledger.revision,
      { profile: ruleProfile, eventId: `${source.sourceId}:open:${kind}`, tick: at.tick, windowId: opportunity.windowId, windowKind: kind });
  }
  return finalizePostPlayReview({ source, seed, ruleProfile, revision: 0, headSourceId: source.sourceId,
    cursor: { ...clock, tick: at.tick, offsetTicks: 0 }, ledger, requests: [], events: [] });
};
