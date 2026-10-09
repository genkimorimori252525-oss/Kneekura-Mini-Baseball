import { cloneInert, advanceRuleProfileOfficialWindows, evaluateRuleProfileOfficialWindowTiming } from '../../core/adjudication/OfficialWindowPolicy';
import { orchestrateTagUpAppealAttempt } from '../../core/adjudication/TagUpAppealOrchestration';
import { closeOfficialStateWindow, getOfficialStateWindows, recordReviewDecision } from '../../core/adjudication/PlayAdjudicationLedger';
import { selectControlledDecision } from '../../core/world/control/ControlledDecision';
import { attributeExecutedDecision } from '../../core/world/control/DecisionEvidence';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayFields as fields } from './ActualLivePlayScope';
import { actualPostPlayReviewEventInput, actualPostPlayReviewIntentInput,
  type AcceptedActualPostPlayReviewEvent, type AcceptedActualPostPlayReviewIntent,
  type ActualPostPlayReviewEventAction } from './ActualPostPlayReviewSource';
import { initializePostPlayReview, finalizePostPlayReview, postPlayOpenState, originalPostPlayCall,
  type ActualPostPlayReviewProjection, type ActualPostPlayReviewRequest, type PostPlayBaseAppealExecution } from './ActualPostPlayReviewState';

export type { ActualPostPlayReviewProjection, ActualPostPlayReviewSeed } from './ActualPostPlayReviewState';
export const initializeActualPostPlayReview = (raw: unknown): ActualPostPlayReviewProjection => initializePostPlayReview(raw);
type IntentAction = Extract<ActualPostPlayReviewEventAction, { kind: 'request' | 'decline' }>;

const validateIntent = (previous: ActualPostPlayReviewProjection, source: AcceptedActualPostPlayReviewEvent,
  action: IntentAction, raw: AcceptedActualPostPlayReviewIntent | null) => {
  if (raw === null) throw new Error('accepted post-play review intent is missing');
  const intent = actualPostPlayReviewIntentInput(raw, action.intentSourceId);
  if (intent.capability !== 'actual_post_play_review_intent_v1') throw new Error('controlled post-play intent capability differs');
  const entitlement = previous.source.policy?.opportunities.find(o => o.windowId === action.windowId);
  const { seed } = previous;
  if (!entitlement || intent.sessionSourceId !== previous.source.sourceId || intent.gameId !== seed.gameId
    || intent.playId !== seed.playId || intent.physicalPitchSourceId !== seed.physicalPitchSourceId
    || intent.callId !== action.callId || intent.windowId !== action.windowId
    || intent.entitlementSourceId !== entitlement.entitlementSourceId || intent.opportunity.clubId !== entitlement.clubId
    || intent.opportunity.domainId !== 'POST_PLAY_REVIEW'
    || intent.opportunity.contextId !== `${previous.source.sourceId}:${action.windowId}`
    || intent.submission.actionId !== `${action.windowId}:${action.kind}`) throw new Error('post-play review intent scope or entitlement differs');
  if (previous.events.some(e => e.intent?.sourceId === intent.sourceId)) throw new Error('post-play review intent is already consumed');
  const selected = selectControlledDecision(intent.control, intent.opportunity, intent.submission);
  if (!selected.ok) throw new Error(`post-play intent authority rejected: ${selected.reason.code}`);
  const actor = selected.value.actor, actorId = actor.kind === 'HUMAN' ? actor.controllerId : actor.managerId;
  if (!entitlement.requesterIds.includes(actorId)) throw new Error('post-play requester is not entitled');
  const attributed = attributeExecutedDecision(selected.value, { executionId: source.sourceId,
    decisionId: selected.value.decisionId, contextId: selected.value.contextId, actionId: selected.value.actionId,
    worldRevision: selected.value.worldRevision, eventIds: [source.sourceId] });
  if (!attributed.ok) throw new Error(`post-play intent execution attribution rejected: ${attributed.reason.code}`);
  return { intent, attribution: attributed.value };
};

const validateOfficialIntent = (previous: ActualPostPlayReviewProjection,
  action: Extract<ActualPostPlayReviewEventAction, { kind: 'official_request' }>, raw: AcceptedActualPostPlayReviewIntent | null) => {
  if (raw === null) throw new Error('accepted post-play official intent is missing');
  const intent = actualPostPlayReviewIntentInput(raw, action.intentSourceId);
  if (intent.capability !== 'actual_post_play_review_official_intent_v1') throw new Error('official post-play intent capability differs');
  const entitlement = previous.source.policy?.opportunities.find(o => o.windowId === action.windowId), { seed } = previous;
  if (!entitlement || intent.sessionSourceId !== previous.source.sourceId || intent.gameId !== seed.gameId
    || intent.playId !== seed.playId || intent.physicalPitchSourceId !== seed.physicalPitchSourceId
    || intent.callId !== action.callId || intent.windowId !== action.windowId || intent.entitlementSourceId !== entitlement.entitlementSourceId
    || !entitlement.requesterIds.includes(intent.officialId) || !entitlement.reviewerIds.includes(intent.officialId)) {
    throw new Error('post-play official assignment, scope or request entitlement differs');
  }
  if (previous.events.some(e => e.intent?.sourceId === intent.sourceId)) throw new Error('post-play official intent is already consumed');
  // An assigned official's request is not a human override or a manager choice.
  return { intent, attribution: null };
};

/** Internal reduction always receives either initialization or a freshly replayed predecessor. */
const reduce = (previous: ActualPostPlayReviewProjection, raw: AcceptedActualPostPlayReviewEvent,
  intentInput: AcceptedActualPostPlayReviewIntent | null, baseAppeal?: PostPlayBaseAppealExecution): ActualPostPlayReviewProjection => {
  const source = actualPostPlayReviewEventInput(raw, raw?.sourceId), action = source.action;
  if (source.sessionSourceId !== previous.source.sourceId || source.expectedRevision !== previous.revision) {
    throw new Error('post-play session or Native revision differs');
  }
  if (source.parent.sourceId !== previous.headSourceId || source.parent.snapshotHash !== previous.headHash) throw new Error('post-play parent hash differs');
  if (source.sourceId === previous.source.sourceId || previous.events.some(e => e.source.sourceId === source.sourceId)) throw new Error('duplicate post-play event Source');
  if (previous.revision === Number.MAX_SAFE_INTEGER) throw new Error('post-play Native revision overflow');
  if (action.kind !== 'request' && action.kind !== 'decline' && action.kind !== 'official_request'
    && intentInput !== null) throw new Error('unexpected post-play intent evidence');
  const policy = previous.source.policy;
  let ledger = previous.ledger, cursor = previous.cursor;
  let requests = [...previous.requests], intent: AcceptedActualPostPlayReviewIntent | null = null;
  if (action.kind !== 'defender_base_appeal' && action.kind !== 'defender_runner_body_appeal'
    && baseAppeal !== undefined) throw new Error('unexpected physical base appeal evidence');
  if (action.kind === 'defender_base_appeal' || action.kind === 'defender_runner_body_appeal') {
    if (previous.source.baseAppealMode !== 'original_catch_end_v1' || !baseAppeal || baseAppeal.kind !== 'ready')
      throw new Error('original physical base appeal execution is required');
    const bodyRoute = 'runnerBodyContact' in baseAppeal;
    if ((action.kind === 'defender_runner_body_appeal') !== bodyRoute
      || bodyRoute && baseAppeal.runnerBodyContact?.kind !== 'controlled_runner_body_tag_v1')
      throw new Error('physical appeal execution route differs from explicit action');
    if (bodyRoute) {
      const tag = baseAppeal.runnerBodyContact.fact;
      if (tag?.kind !== 'controlled_runner_tag' || tag.defenderId !== action.defenderId
        || tag.runnerId !== action.runnerId || tag.tick !== baseAppeal.attempt.tick)
        throw new Error('runner-body appeal contact fact differs from execution');
    }
    if (cursor.offsetTicks !== 0 || cursor.tick !== previous.seed.exactEnd.tick || json(baseAppeal.moment) !== json(previous.seed.exactEnd)
      || baseAppeal.attempt.tick !== cursor.tick || baseAppeal.attempt.defenderId !== action.defenderId
      || baseAppeal.attempt.runnerId !== action.runnerId || baseAppeal.attempt.base !== ({ first: 1, second: 2, third: 3 } as const)[action.base])
      throw new Error('base appeal must execute at its original physical end cut');
    if (previous.events.some(e => (e.source.action.kind === 'defender_base_appeal' || e.source.action.kind === 'defender_runner_body_appeal')
      && e.source.action.runnerId === action.runnerId
      && e.source.action.base === action.base)) throw new Error('successive appeal at the same original base is not supported');
    ledger = orchestrateTagUpAppealAttempt(ledger, ledger.revision, { profile: previous.ruleProfile,
      eventId: `${source.sourceId}:appeal`, windowId: `${previous.source.sourceId}:base-appeal`,
      attempt: baseAppeal.attempt, complianceEvidence: baseAppeal.complianceEvidence }).ledger;
  } else if (action.kind === 'advance_tick' || action.kind === 'next_play_fence') {
    if (policy === null || action.schedulerId !== policy.schedulerId) throw new Error('post-play scheduler authority differs');
    if (action.kind === 'advance_tick') {
      if (cursor.tick === Number.MAX_SAFE_INTEGER || cursor.offsetTicks === Number.MAX_SAFE_INTEGER) throw new Error('post-play cursor overflow');
      cursor = { ...cursor, tick: cursor.tick + 1, offsetTicks: cursor.offsetTicks + 1 };
    }
    // The existing helper closes every eligible window. Keep active review and
    // ambiguous admission intact; it is not a review-completion deadline.
    if (!requests.some(r => r.status === 'review_pending' || r.status === 'timing_unresolved')) {
      try {
        ledger = advanceRuleProfileOfficialWindows(ledger, ledger.revision, { profile: previous.ruleProfile,
          boundary: action.kind === 'advance_tick' ? 'expiration' : 'next_play_fence', tick: cursor.tick,
          eventIdPrefix: source.sourceId, inningEnding: false });
      } catch (error) {
        if (action.kind !== 'next_play_fence' || !(error instanceof Error)
          || error.message !== 'official-state window remains open under RuleProfile') throw error;
      }
    }
  } else {
    const call = originalPostPlayCall(ledger).call;
    const entitlement = policy?.opportunities.find(o => o.windowId === action.windowId);
    const window = getOfficialStateWindows(ledger).find(w => w.windowId === action.windowId);
    if (action.callId !== call.callId || !entitlement || !window) throw new Error('post-play original call or window entitlement differs');
    if (action.kind === 'request' || action.kind === 'decline' || action.kind === 'official_request') {
      if (requests.some(r => r.windowId === action.windowId)) throw new Error('post-play window request is already accepted');
      const accepted = action.kind === 'official_request' ? validateOfficialIntent(previous, action, intentInput)
        : validateIntent(previous, source, action, intentInput);
      intent = accepted.intent;
      const timing = evaluateRuleProfileOfficialWindowTiming(ledger, previous.ruleProfile, action.windowId, cursor.tick);
      if (action.kind === 'decline') {
        if (window.closedAtTick !== null || timing === 'expired') throw new Error('cannot decline a closed or expired post-play opportunity');
        ledger = closeOfficialStateWindow(ledger, ledger.revision, { eventId: `${source.sourceId}:declined`,
          tick: cursor.tick, windowId: action.windowId, reason: 'declined' });
      } else {
        requests.push({ sourceId: source.sourceId, windowId: action.windowId, callId: action.callId, tick: cursor.tick,
          intentSourceId: intent.sourceId, status: timing === 'timely' ? 'review_pending' : timing === 'expired' ? 'expired' : 'timing_unresolved',
          attribution: accepted.attribution, pendingReason: null });
      }
    } else {
      const request = requests.find(r => r.sourceId === action.requestEventSourceId);
      const latest = postPlayOpenState(ledger).latestCorrectRule;
      if (!entitlement.reviewerIds.includes(action.reviewerId) || !request || request.windowId !== action.windowId
        || request.callId !== action.callId || request.status !== 'review_pending' || window.closedAtTick !== null) {
        throw new Error('post-play review official or accepted request differs');
      }
      if (action.basisSnapshotId !== latest.snapshotId || action.basisEvidenceRevision !== latest.evidenceRevision) {
        throw new Error('post-play review basis is stale or differs from latest snapshot');
      }
      let pendingReason: string | null = null;
      if (action.decision === 'overturned') {
        if (!('ruling' in latest)) pendingReason = 'review_replacement_evidence_unresolved';
        else if (latest.ruling.basesAfter.second !== null || latest.ruling.basesAfter.third !== null || latest.ruling.scoredRunnerIds.length) {
          pendingReason = 'review_replacement_placement_unsupported';
        }
      }
      if (pendingReason === null) {
        // Only an explicit accepted decision reaches this API. The bounded
        // overturn takes the authenticated correct snapshot, never an input delta.
        ledger = recordReviewDecision(ledger, ledger.revision, { eventId: `${source.sourceId}:review`, tick: cursor.tick,
          reviewId: action.reviewId, callId: action.callId, basisSnapshotId: action.basisSnapshotId,
          basisEvidenceRevision: action.basisEvidenceRevision, decision: action.decision,
          replacementRuling: action.decision === 'overturned' && 'ruling' in latest ? latest.ruling : null });
        ledger = closeOfficialStateWindow(ledger, ledger.revision, { eventId: `${source.sourceId}:resolved`, tick: cursor.tick,
          windowId: action.windowId, reason: 'resolved' });
      }
      requests = requests.map((r): ActualPostPlayReviewRequest => r.sourceId !== request.sourceId ? r
        : { ...r, status: pendingReason === null ? 'resolved' : 'review_pending', pendingReason });
    }
  }
  return finalizePostPlayReview({ source: previous.source, seed: previous.seed, ruleProfile: previous.ruleProfile,
    revision: previous.revision + 1, headSourceId: source.sourceId, cursor, ledger, requests,
    events: [...previous.events, { source, intent, tick: cursor.tick,
      ...(baseAppeal === undefined ? {} : { baseAppeal }),
      coreEventIds: ledger.events.slice(previous.ledger.events.length).map(e => e.eventId) }] });
};

/** Pure replay is structural validation, not authentication of the Native owners. */
export const advanceActualPostPlayReview = (raw: unknown): ActualPostPlayReviewProjection => {
  const input = cloneInert(raw) as Readonly<{ previous: ActualPostPlayReviewProjection;
    source: AcceptedActualPostPlayReviewEvent; intent?: AcceptedActualPostPlayReviewIntent; baseAppeal?: PostPlayBaseAppealExecution }>;
  if (!fields(input, ['previous', 'source', ...(Object.hasOwn(input, 'intent') ? ['intent'] : []),
    ...(Object.hasOwn(input, 'baseAppeal') ? ['baseAppeal'] : [])])) throw new Error('invalid post-play continuation input');
  const previous = input.previous;
  if (!previous || !Array.isArray(previous.events)) throw new Error('invalid post-play predecessor');
  let replayed = initializePostPlayReview({ source: previous.source, seed: previous.seed });
  for (const event of previous.events) replayed = reduce(replayed, event.source, event.intent, event.baseAppeal);
  if (json(replayed) !== json(previous)) throw new Error('post-play predecessor archive or head differs');
  return reduce(replayed, input.source, input.intent ?? null, input.baseAppeal);
};
