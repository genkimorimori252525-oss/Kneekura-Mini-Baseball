import { expect } from 'vitest';
import * as entry from './ActualLiveAdjudication';
import * as sourceEntry from './ActualLiveAdjudicationSource';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import type { CorrectRuleEvidenceSnapshot, PlayAdjudicationLedger } from '../../core/adjudication/PlayAdjudicationLedger';
import type { DecisionEvidenceProjection } from '../../core/world/control/ControlTypes';

// Test-only interface contracts. Missing exports fail an assertion; no production
// stub, fallback implementation, module mock, or SQLite fixture is installed here.
export type ReviewProjection = Readonly<{
  source: ReturnType<typeof reviewFixture>['source'];
  seed: ReturnType<typeof reviewFixture>['seed'];
  revision: number; headSourceId: string; headHash: string;
  cursor: Readonly<{ originTick: number; ticksPerSecond: number; tick: number; offsetTicks: number }>;
  kind: 'official_pending' | 'official_ready'; pendingReasons: readonly string[];
  ledger: PlayAdjudicationLedger;
  requests: readonly Readonly<{ sourceId: string; windowId: string; callId: string; tick: number;
    status: 'review_pending' | 'timing_unresolved' | 'expired' | 'resolved';
    intentSourceId: string; attribution: DecisionEvidenceProjection | null }>[];
  events: readonly Readonly<{ source: ReviewEventSource; tick: number; coreEventIds: readonly string[] }>[];
}>;
export type ReviewEventAction =
  | Readonly<{ kind: 'advance_tick' | 'next_play_fence'; schedulerId: string }>
  | Readonly<{ kind: 'request' | 'decline'; windowId: string; callId: string; intentSourceId: string }>
  | Readonly<{ kind: 'decision'; windowId: string; requestEventSourceId: string; reviewId: string;
      callId: string; reviewerId: string; basisSnapshotId: string; basisEvidenceRevision: number;
      decision: 'confirmed' | 'stands' | 'overturned' }>;
export type ReviewEventSource = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_post_play_review_event_v1';
  sessionSourceId: string; expectedRevision: number; parent: Readonly<{ sourceId: string; snapshotHash: string }>;
  action: ReviewEventAction;
}>;
type Initializer = (input: unknown) => ReviewProjection;
type Reducer = (input: unknown) => ReviewProjection;
type Parser = (input: unknown, sourceId: string) => unknown;
const required = <T>(namespace: object, name: string): T => {
  const fn = (namespace as Record<string, unknown>)[name];
  expect(fn, `additive post-play contract export ${name}`).toBeTypeOf('function');
  return fn as T;
};
export const reviewApi = () => ({
  initialize: required<Initializer>(entry, 'initializeActualPostPlayReview'),
  advance: required<Reducer>(entry, 'advanceActualPostPlayReview'),
});
export const reviewSourceApi = () => ({
  session: required<Parser>(sourceEntry, 'actualPostPlayReviewSessionInput'),
  event: required<Parser>(sourceEntry, 'actualPostPlayReviewEventInput'),
  intent: required<Parser>(sourceEntry, 'actualPostPlayReviewIntentInput'),
});
const reference = (owner: string, sourceId: string) => ({ owner, sourceId, sourceVersion: 'fixture-v1',
  sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
export const safeRuling = { outsAfter: 0, basesAfter: { first: 'batter', second: null, third: null }, scoredRunnerIds: [] };
export const outRuling = { outsAfter: 1, basesAfter: { first: null, second: null, third: null }, scoredRunnerIds: [] };
export const reviewFixture = (options: Readonly<{ truth?: 'safe' | 'unresolved'; laterSnapshot?: boolean;
  challenge?: boolean; noDeadline?: boolean; noOfficialPolicy?: boolean; noSessionPolicy?: boolean; originTick?: number }> = {}) => {
  const originTick = options.originTick ?? 10;
  const window = options.noDeadline ? { available: true } : { available: true, expiresAfterTicks: 3 };
  const officialPolicy = options.noOfficialPolicy ? null : { sourceId: 'official-policy', sourceVersion: 'fixture-v1',
    ruleProfileId: 'npb-2026', officialWindows: { appeal: { available: true }, review: window,
      challenge: options.challenge ? window : { available: false } } };
  const profile = actualLiveAdjudicationProfile(NPB_2026_RULE_PROFILE.id, officialPolicy);
  const snapshot: CorrectRuleEvidenceSnapshot = options.truth === 'safe'
    ? { snapshotId: 'actual_first_base_rule:rule', evidenceRevision: 4, ruling: safeRuling }
    : { snapshotId: 'actual_first_base_rule:rule', evidenceRevision: 4, resolution: 'unresolved', reason: 'exact_simultaneity' };
  const snapshots: CorrectRuleEvidenceSnapshot[] = [snapshot];
  if (options.laterSnapshot) snapshots.push({ ...snapshot, snapshotId: 'actual_first_base_rule:later', evidenceRevision: 5 });
  const exactEnd = { originTick, elapsedSeconds: 4, tick: originTick + 4000 };
  const playEnd = { kind: 'play_end' as const, tick: exactEnd.tick, reason: 'live_action_complete' as const };
  const originalImport = { eventId: 'adjudication:call', tick: exactEnd.tick,
    call: { callId: 'call', tick: originTick + 2000, basisSnapshotId: snapshot.snapshotId, basisEvidenceRevision: 4, ruling: outRuling },
    provenance: { version: 'owned_live_call_import_v1' as const, gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch',
      clock: { originTick, ticksPerSecond: 1000 }, calledAtElapsedSeconds: 2, availableAtElapsedSeconds: 2,
      importedAtElapsedSeconds: 4, call: reference('actual_first_base_umpire_calls', 'call'),
      perception: reference('actual_first_base_umpire_observations', 'observation'),
      policy: reference('actual_first_base_umpire_setups', 'setup'),
      ruleEvidence: reference('batted_world_field_executions', 'rule'), reception: null } };
  const projected = entry.projectActualLiveAdjudication({ sourceId: 'adjudication', playId: 1, ruleProfile: profile,
    playEnd, recordedAt: exactEnd, snapshots, call: originalImport, appealApplicability: 'no_supported_tag_up_appeal' });
  const seed = { source: { sourceId: 'adjudication', sourceVersion: 'fixture-v1', physicalEndSourceId: 'end', policy: officialPolicy },
    snapshotHash: 'c'.repeat(64), gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch', ruleProfile: profile,
    exactEnd, endReference: reference('actual_first_base_play_ends', 'end'), ...projected };
  const opportunity = (windowKind: 'review' | 'challenge') => ({ windowKind, windowId: windowKind,
    entitlementSourceId: `entitlement:${windowKind}`, clubId: 'club', requesterIds: ['controller'], reviewerIds: ['review-official'] });
  const source = { sourceId: 'review-session', sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_session_v1' as const,
    adjudicationSourceId: seed.source.sourceId, adjudicationSnapshotHash: seed.snapshotHash, officialPolicy,
    policy: options.noSessionPolicy ? null : { sourceId: 'post-play-policy', sourceVersion: 'fixture-v1', ruleProfileId: 'npb-2026',
      openingTrigger: 'physical_play_end' as const, clock: 'post_play_discrete_tick_v1' as const,
      schedulerId: 'scheduler', expiryScope: 'request_admission' as const,
      opportunities: [opportunity('review'), ...(options.challenge ? [opportunity('challenge')] : [])] } };
  return { source, seed };
};
export const eventSource = (previous: ReviewProjection, action: ReviewEventAction, sourceId = `event:${previous.revision + 1}`): ReviewEventSource => ({
  sourceId, sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_event_v1',
  sessionSourceId: previous.source.sourceId, expectedRevision: previous.revision,
  parent: { sourceId: previous.headSourceId, snapshotHash: previous.headHash }, action,
});
export const intentFixture = (windowId = 'review', action: 'request' | 'decline' = 'request') => ({
  sourceId: `intent:${windowId}:${action}`, sourceVersion: 'fixture-v1', capability: 'actual_post_play_review_intent_v1' as const,
  sessionSourceId: 'review-session', gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch', callId: 'call', windowId,
  entitlementSourceId: `entitlement:${windowId}`,
  control: { schemaVersion: 1 as const, revision: 2, controllerId: 'controller', controlledClubId: 'club',
    domainIds: ['POST_PLAY_REVIEW'], manualDomainIds: ['POST_PLAY_REVIEW'] },
  opportunity: { decisionId: `decision:${windowId}:${action}`, contextId: `review-session:${windowId}`, worldRevision: 7,
    clubId: 'club', domainId: 'POST_PLAY_REVIEW', managerId: 'manager', appointmentId: 'appointment', legalActionIds: [`${windowId}:${action}`] },
  submission: { decisionId: `decision:${windowId}:${action}`, contextId: `review-session:${windowId}`,
    expectedControlRevision: 2, expectedWorldRevision: 7, actionId: `${windowId}:${action}`,
    actor: { kind: 'HUMAN' as const, controllerId: 'controller' } },
});
export const advanceTicks = (api: ReturnType<typeof reviewApi>, initial: ReviewProjection, count: number) => {
  let value = initial;
  for (let i = 0; i < count; i++) value = api.advance({ previous: value,
    source: eventSource(value, { kind: 'advance_tick', schedulerId: 'scheduler' }) });
  return value;
};
export const requestReview = (api: ReturnType<typeof reviewApi>, previous: ReviewProjection, windowId = 'review') => {
  const intent = intentFixture(windowId);
  return api.advance({ previous, source: eventSource(previous, { kind: 'request', windowId, callId: 'call', intentSourceId: intent.sourceId }), intent });
};
export const decisionSource = (previous: ReviewProjection, decision: 'confirmed' | 'stands' | 'overturned' = 'stands',
  basisEvidenceRevision = 4) => eventSource(previous, { kind: 'decision', windowId: 'review',
  requestEventSourceId: previous.requests.find(r => r.windowId === 'review')!.sourceId, reviewId: 'review-decision',
  callId: 'call', reviewerId: 'review-official', basisSnapshotId: `actual_first_base_rule:${basisEvidenceRevision === 4 ? 'rule' : 'later'}`,
  basisEvidenceRevision, decision });
