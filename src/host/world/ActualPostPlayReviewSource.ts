import { samePaCatchReviewSeedInput, type SamePaCatchReviewSeedSource } from './SamePlateAppearanceCatchReviewSource';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { DecisionOpportunity, DecisionSubmission, HumanControlState } from '../../core/world/control/ControlTypes';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { parseOpportunity, parseSubmission } from '../../core/world/control/ControlValidation';
import { actualLiveAdjudicationInput, type ActualLiveOfficialPolicy } from './ActualLiveAdjudicationSource';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

export type ActualPostPlayReviewOpportunity = Readonly<{
  windowKind: 'review' | 'challenge'; windowId: string; entitlementSourceId: string;
  clubId: string; requesterIds: readonly string[]; reviewerIds: readonly string[];
}>;
export type ActualPostPlayReviewPolicy = Readonly<{
  sourceId: string; sourceVersion: string; ruleProfileId: string;
  openingTrigger: 'physical_play_end'; clock: 'post_play_discrete_tick_v1';
  schedulerId: string; expiryScope: 'request_admission'; opportunities: readonly ActualPostPlayReviewOpportunity[];
}>;
export type AcceptedActualPostPlayReviewSession = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_post_play_review_session_v1';
  adjudicationSourceId: string; adjudicationSnapshotHash: string;
  officialPolicy: ActualLiveOfficialPolicy | null; policy: ActualPostPlayReviewPolicy | null;
  reservedCatchSeed?: SamePaCatchReviewSeedSource;
  baseAppealMode?: 'original_catch_end_v1';
}>;
export type ActualPostPlayReviewEventAction =
  | Readonly<{ kind: 'accept_live_appeal_result'; executionReferences: readonly SamePaReference<'pa_physical_v1_field_steps'>[];
      callId: string; windowId: string; intentSourceId: string; basisSnapshotId: string; basisEvidenceRevision: number }>
  | Readonly<{ kind: 'admit_live_appeal_rights'; executionReference: SamePaReference<'pa_physical_v1_field_steps'> }>
  | Readonly<{ kind: 'import_live_appeal'; executionReference: SamePaReference<'pa_physical_v1_field_steps'> }>
  | Readonly<{ kind: 'defender_base_appeal'; defenderId: string; runnerId: string; base: 'first' | 'second' | 'third' }>
  | Readonly<{ kind: 'defender_runner_body_appeal'; defenderId: string; runnerId: string; base: 'first' | 'second' | 'third' }>
  | Readonly<{ kind: 'advance_tick'; schedulerId: string }>
  | Readonly<{ kind: 'next_play_fence'; schedulerId: string }>
  | Readonly<{ kind: 'request'; windowId: string; callId: string; intentSourceId: string }>
  | Readonly<{ kind: 'decline'; windowId: string; callId: string; intentSourceId: string }>
  | Readonly<{ kind: 'official_request'; windowId: string; callId: string; intentSourceId: string }>
  | Readonly<{ kind: 'decision'; windowId: string; requestEventSourceId: string; reviewId: string;
      callId: string; reviewerId: string; basisSnapshotId: string; basisEvidenceRevision: number;
      decision: 'confirmed' | 'stands' | 'overturned' }>;
export type AcceptedActualPostPlayReviewEvent = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_post_play_review_event_v1';
  sessionSourceId: string; expectedRevision: number; parent: Readonly<{ sourceId: string; snapshotHash: string }>;
  action: ActualPostPlayReviewEventAction;
}>;
export type AcceptedActualPostPlayControlledIntent = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_post_play_review_intent_v1';
  sessionSourceId: string; gameId: string; playId: number; physicalPitchSourceId: string;
  callId: string; windowId: string; entitlementSourceId: string;
  control: HumanControlState; opportunity: DecisionOpportunity; submission: DecisionSubmission;
}>;
export type AcceptedActualPostPlayOfficialIntent = Pick<AcceptedActualPostPlayControlledIntent,
  'sourceId' | 'sourceVersion' | 'sessionSourceId' | 'gameId' | 'playId' | 'physicalPitchSourceId' | 'callId' | 'windowId' | 'entitlementSourceId'>
  & Readonly<{ capability: 'actual_post_play_review_official_intent_v1'; officialId: string }>
  & (Readonly<{ action: 'request' }> | Readonly<{ action: 'accept_live_appeal_result';
      executionReferences: readonly SamePaReference<'pa_physical_v1_field_steps'>[];
      basisSnapshotId: string; basisEvidenceRevision: number }>);
export type AcceptedActualPostPlayReviewIntent = AcceptedActualPostPlayControlledIntent | AcceptedActualPostPlayOfficialIntent;
export const postPlayHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const postPlayRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const ids = (value: readonly string[]) => Array.isArray(value) && value.length > 0
  && value.every(id) && new Set(value).size === value.length;
const executions = (value: readonly SamePaReference<'pa_physical_v1_field_steps'>[]) => Array.isArray(value) && value.length > 0
  && value.every(pin => samePaReferenceValid(pin, 'pa_physical_v1_field_steps'))
  && new Set(value.map(pin => pin.sourceId)).size === value.length;

/** Accepted input only. Native authenticates the seed and all external authority. */
export const actualPostPlayReviewSessionInput = (raw: unknown, sourceId: string): AcceptedActualPostPlayReviewSession => {
  const s = cloneInert(raw) as AcceptedActualPostPlayReviewSession;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'adjudicationSourceId', 'adjudicationSnapshotHash', 'officialPolicy', 'policy',
    ...(s && Object.hasOwn(s, 'reservedCatchSeed') ? ['reservedCatchSeed'] : []),
    ...(s && Object.hasOwn(s, 'baseAppealMode') ? ['baseAppealMode'] : [])])
    || s.sourceId !== sourceId || s.capability !== 'actual_post_play_review_session_v1'
    || ![s.sourceId, s.sourceVersion, s.adjudicationSourceId].every(id) || !postPlayHash(s.adjudicationSnapshotHash)) {
    throw new Error('invalid accepted post-play review session Source');
  }
  if (Object.hasOwn(s, 'baseAppealMode') && s.baseAppealMode !== 'original_catch_end_v1') throw new Error('unsupported original base appeal mode');
  actualLiveAdjudicationInput({ sourceId: s.sourceId, sourceVersion: s.sourceVersion,
    physicalEndSourceId: s.adjudicationSourceId, policy: s.officialPolicy }, sourceId);
  if (Object.hasOwn(s, 'reservedCatchSeed')) {
    const seed = samePaCatchReviewSeedInput(s.reservedCatchSeed);
    if (seed.sourceId !== s.adjudicationSourceId) throw new Error('reserved catch review seed identity differs');
  }
  const p = s.policy;
  if (p !== null) {
    if (!fields(p, ['sourceId', 'sourceVersion', 'ruleProfileId', 'openingTrigger', 'clock', 'schedulerId', 'expiryScope', 'opportunities'])
      || ![p.sourceId, p.sourceVersion, p.ruleProfileId, p.schedulerId].every(id)
      || p.openingTrigger !== 'physical_play_end' || p.clock !== 'post_play_discrete_tick_v1'
      || p.expiryScope !== 'request_admission' || !Array.isArray(p.opportunities)) throw new Error('invalid post-play review policy');
    for (const o of p.opportunities) {
      if (!fields(o, ['windowKind', 'windowId', 'entitlementSourceId', 'clubId', 'requesterIds', 'reviewerIds'])
        || !['review', 'challenge'].includes(o.windowKind) || ![o.windowId, o.entitlementSourceId, o.clubId].every(id)
        || !ids(o.requesterIds) || !ids(o.reviewerIds)) throw new Error('invalid post-play review entitlement');
    }
    if (new Set(p.opportunities.map(o => o.windowId)).size !== p.opportunities.length
      || new Set(p.opportunities.map(o => o.windowKind)).size !== p.opportunities.length
      || new Set(p.opportunities.map(o => o.entitlementSourceId)).size !== p.opportunities.length) {
      throw new Error('duplicate post-play review entitlement');
    }
  }
  return freeze(s);
};

/** No accepted action may provide a timestamp, physical fact, or replacement ruling. */
export const actualPostPlayReviewEventInput = (raw: unknown, sourceId: string): AcceptedActualPostPlayReviewEvent => {
  const s = cloneInert(raw) as AcceptedActualPostPlayReviewEvent;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'sessionSourceId', 'expectedRevision', 'parent', 'action'])
    || s.sourceId !== sourceId || s.capability !== 'actual_post_play_review_event_v1'
    || ![s.sourceId, s.sourceVersion, s.sessionSourceId].every(id) || !postPlayRevision(s.expectedRevision)
    || !fields(s.parent, ['sourceId', 'snapshotHash']) || !id(s.parent.sourceId) || !postPlayHash(s.parent.snapshotHash)) {
    throw new Error('invalid accepted post-play review event Source or parent revision');
  }
  const a = s.action;
  if (a?.kind === 'accept_live_appeal_result') {
    if (!fields(a, ['kind', 'executionReferences', 'callId', 'windowId', 'intentSourceId', 'basisSnapshotId', 'basisEvidenceRevision'])
      || !executions(a.executionReferences) || ![a.callId, a.windowId, a.intentSourceId, a.basisSnapshotId].every(id)
      || !postPlayRevision(a.basisEvidenceRevision)) throw new Error('invalid explicit live appeal result acceptance');
  } else if (a?.kind === 'import_live_appeal' || a?.kind === 'admit_live_appeal_rights') {
    if (!fields(a, ['kind', 'executionReference']) || !samePaReferenceValid(a.executionReference, 'pa_physical_v1_field_steps'))
      throw new Error('invalid original live appeal execution reference');
  } else if (a?.kind === 'defender_base_appeal' || a?.kind === 'defender_runner_body_appeal') {
    if (!fields(a, ['kind', 'defenderId', 'runnerId', 'base']) || ![a.defenderId, a.runnerId].every(id)
      || a.defenderId === a.runnerId || !['first', 'second', 'third'].includes(a.base)) throw new Error('invalid explicit defender base appeal');
  } else if (a?.kind === 'advance_tick' || a?.kind === 'next_play_fence') {
    if (!fields(a, ['kind', 'schedulerId']) || !id(a.schedulerId)) throw new Error('invalid post-play scheduler action');
  } else if (a?.kind === 'request' || a?.kind === 'decline' || a?.kind === 'official_request') {
    if (!fields(a, ['kind', 'windowId', 'callId', 'intentSourceId']) || ![a.windowId, a.callId, a.intentSourceId].every(id)) {
      throw new Error('invalid post-play review intent reference');
    }
  } else if (a?.kind === 'decision') {
    if (!fields(a, ['kind', 'windowId', 'requestEventSourceId', 'reviewId', 'callId', 'reviewerId',
      'basisSnapshotId', 'basisEvidenceRevision', 'decision'])
      || ![a.windowId, a.requestEventSourceId, a.reviewId, a.callId, a.reviewerId, a.basisSnapshotId].every(id)
      || !postPlayRevision(a.basisEvidenceRevision) || !['confirmed', 'stands', 'overturned'].includes(a.decision)) {
      throw new Error('invalid accepted post-play review decision');
    }
  } else throw new Error('unknown post-play review event action');
  return freeze(s);
};

export const actualPostPlayReviewIntentInput = (raw: unknown, sourceId: string): AcceptedActualPostPlayReviewIntent => {
  const s = cloneInert(raw) as AcceptedActualPostPlayReviewIntent;
  if (s?.capability === 'actual_post_play_review_official_intent_v1') {
    if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'sessionSourceId', 'gameId', 'playId', 'physicalPitchSourceId',
      'callId', 'windowId', 'entitlementSourceId', 'officialId', 'action',
      ...(s.action === 'accept_live_appeal_result' ? ['executionReferences', 'basisSnapshotId', 'basisEvidenceRevision'] : [])])
      || s.sourceId !== sourceId || !['request', 'accept_live_appeal_result'].includes(s.action) || !postPlayRevision(s.playId)
      || ![s.sourceId, s.sourceVersion, s.sessionSourceId, s.gameId, s.physicalPitchSourceId,
        s.callId, s.windowId, s.entitlementSourceId, s.officialId].every(id)) {
      throw new Error('invalid accepted post-play official intent Source');
    }
    if (s.action === 'accept_live_appeal_result' && (!executions(s.executionReferences)
      || !id(s.basisSnapshotId) || !postPlayRevision(s.basisEvidenceRevision))) throw new Error('invalid official appeal result basis');
    return freeze(s);
  }
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'sessionSourceId', 'gameId', 'playId', 'physicalPitchSourceId',
    'callId', 'windowId', 'entitlementSourceId', 'control', 'opportunity', 'submission'])
    || s.sourceId !== sourceId || s.capability !== 'actual_post_play_review_intent_v1'
    || ![s.sourceId, s.sourceVersion, s.sessionSourceId, s.gameId, s.physicalPitchSourceId, s.callId, s.windowId, s.entitlementSourceId].every(id)
    || !postPlayRevision(s.playId)
    || !fields(s.control, ['schemaVersion', 'revision', 'controllerId', 'controlledClubId', 'domainIds', 'manualDomainIds'])
    || !fields(s.opportunity, ['decisionId', 'contextId', 'worldRevision', 'clubId', 'domainId', 'managerId', 'appointmentId', 'legalActionIds'])
    || !fields(s.submission, ['decisionId', 'contextId', 'expectedControlRevision', 'expectedWorldRevision', 'actionId', 'actor'])) {
    throw new Error('invalid accepted post-play review intent Source');
  }
  const actor = s.submission.actor;
  if (!actor || !fields(actor, actor.kind === 'HUMAN' ? ['kind', 'controllerId'] : ['kind', 'managerId', 'appointmentId', 'traceId'])) {
    throw new Error('invalid accepted post-play intent actor');
  }
  createHumanControlState(s.control); parseOpportunity(s.opportunity); parseSubmission(s.submission);
  return freeze(s);
};
