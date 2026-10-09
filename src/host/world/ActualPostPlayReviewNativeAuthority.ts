import { createHumanControlState } from '../../core/world/control/HumanControl';
import { selectControlledDecision } from '../../core/world/control/ControlledDecision';
import { readState as readClubState } from '../../core/world/club/ClubSchemas';
import { getCurrentClubManager } from '../../core/world/club/ClubEvents';
import { actualLivePlayFields as fields } from './ActualLivePlayScope';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { postPlayRevision, type AcceptedActualPostPlayReviewEvent, type AcceptedActualPostPlayReviewIntent } from './ActualPostPlayReviewSource';
import type { ActualPostPlayReviewProjection } from './ActualPostPlayReviewState';
import type { PostPlayReviewDb, PostPlayReviewNativeScope } from './ActualPostPlayReviewNativeScope';

type ControlRow = Readonly<{ world_revision: number; control_revision: number; control_json: string }>;
type Extent = Readonly<{ count: number; first_revision: number | null; last_revision: number | null; integer_count: number }>;
type ClubRow = Readonly<{ revision: number; state_json: string }>;
type Inputs = Readonly<{ control: ControlRow; extent: Extent; club: ClubRow }>;
export type PostPlayReviewAdmission = Readonly<{
  version: 'actual_post_play_review_admission_v1'; kind: 'human' | 'official' | 'scheduler';
  careerId: string; gameId: string; playId: number; policyHash: string; actorId: string;
  clubId: string | null; inputs: Inputs | null;
  inputHashes: Readonly<{ control: string; extent: string; club: string }> | null;
}>;
export type PostPlayAdmissionResult = Readonly<{ kind: 'admitted'; evidence: PostPlayReviewAdmission }>
  | Readonly<{ kind: 'intent_pending'; reason: 'manager_review_selection_unavailable' }>;

const capture = (scope: PostPlayReviewNativeScope, previous: ActualPostPlayReviewProjection,
  source: AcceptedActualPostPlayReviewEvent, intent: AcceptedActualPostPlayReviewIntent | null, inputs: Inputs | null): PostPlayAdmissionResult => {
  const policy = previous.source.policy;
  if (!policy) throw new Error('post-play session authority policy is missing');
  const common = { version: 'actual_post_play_review_admission_v1' as const, careerId: scope.careerId,
    gameId: scope.gameId, playId: scope.playId, policyHash: hash(policy) };
  const action = source.action;
  if (action.kind === 'import_live_appeal' || action.kind === 'admit_live_appeal_rights') throw new Error('live appeal import requires its original physical execution owner');
  if (action.kind === 'defender_base_appeal' || action.kind === 'defender_runner_body_appeal')
    throw new Error('defender appeal requires its original physical execution owner');
  if (action.kind === 'advance_tick' || action.kind === 'next_play_fence') {
    if (intent !== null || inputs !== null || action.schedulerId !== policy.schedulerId) throw new Error('post-play scheduler authority differs');
    return freeze({ kind: 'admitted', evidence: { ...common, kind: 'scheduler', actorId: action.schedulerId, clubId: null, inputs: null, inputHashes: null } });
  }
  const opportunity = policy.opportunities.find(o => o.windowId === action.windowId);
  if (!opportunity || !Object.values(scope.clubs).includes(opportunity.clubId)) throw new Error('post-play authority fixture side differs');
  if (action.kind === 'decision') {
    if (intent !== null || inputs !== null || !opportunity.reviewerIds.includes(action.reviewerId)) throw new Error('post-play review official differs');
    return freeze({ kind: 'admitted', evidence: { ...common, kind: 'official', actorId: action.reviewerId, clubId: opportunity.clubId, inputs: null, inputHashes: null } });
  }
  if (!intent || intent.sessionSourceId !== previous.source.sourceId || intent.gameId !== scope.gameId || intent.playId !== scope.playId
    || intent.physicalPitchSourceId !== scope.physicalPitchSourceId || intent.callId !== action.callId
    || intent.windowId !== action.windowId || intent.sourceId !== action.intentSourceId
    || intent.entitlementSourceId !== opportunity.entitlementSourceId) throw new Error('post-play admitted intent scope differs');
  if (action.kind === 'official_request') {
    if (inputs !== null || intent.capability !== 'actual_post_play_review_official_intent_v1'
      || !opportunity.requesterIds.includes(intent.officialId) || !opportunity.reviewerIds.includes(intent.officialId)) {
      throw new Error('post-play official request authority differs');
    }
    return freeze({ kind: 'admitted', evidence: { ...common, kind: 'official', actorId: intent.officialId, clubId: opportunity.clubId, inputs: null, inputHashes: null } });
  }
  if (intent.capability !== 'actual_post_play_review_intent_v1' || !inputs
    || !fields(inputs, ['control', 'extent', 'club']) || !fields(inputs.control, ['world_revision', 'control_revision', 'control_json'])
    || !fields(inputs.extent, ['count', 'first_revision', 'last_revision', 'integer_count']) || !fields(inputs.club, ['revision', 'state_json'])) {
    throw new Error('post-play controlled authority evidence is missing');
  }
  const { control: row, extent, club: clubRow } = inputs;
  const control = createHumanControlState(JSON.parse(row.control_json));
  if (!postPlayRevision(row.world_revision) || !postPlayRevision(row.control_revision) || control.revision !== row.control_revision
    || row.control_json !== JSON.stringify(control) || extent.count !== row.world_revision || extent.integer_count !== extent.count
    || (row.world_revision === 0 ? extent.first_revision !== null || extent.last_revision !== null
      : extent.first_revision !== 1 || extent.last_revision !== row.world_revision)
    || json(control) !== json(intent.control) || row.world_revision !== intent.opportunity.worldRevision) {
    throw new Error('post-play durable control authority or revision differs');
  }
  const club = readClubState(JSON.parse(clubRow.state_json)), manager = getCurrentClubManager(club);
  if (!postPlayRevision(clubRow.revision) || club.revision !== clubRow.revision || json(club) !== clubRow.state_json
    || club.careerId !== scope.careerId || club.identity.clubId !== opportunity.clubId || club.season.closureRef !== null
    || club.effectiveDay > scope.gameDay || club.season.plan.startsOnDay > scope.gameDay
    || intent.opportunity.clubId !== opportunity.clubId || !manager.ok || manager.value === null
    || intent.opportunity.managerId !== manager.value.managerId || intent.opportunity.appointmentId !== manager.value.appointmentId) {
    throw new Error('post-play current Club or manager appointment differs');
  }
  const selected = selectControlledDecision(control, intent.opportunity, intent.submission);
  if (!selected.ok) throw new Error(`post-play current control rejected: ${selected.reason.code}`);
  if (selected.value.actor.kind === 'MANAGER') {
    // ROSTER selections and caller trace IDs are not review-domain evidence.
    return freeze({ kind: 'intent_pending', reason: 'manager_review_selection_unavailable' });
  }
  if (!opportunity.requesterIds.includes(selected.value.actor.controllerId)) throw new Error('post-play Human requester is not entitled');
  return freeze({ kind: 'admitted', evidence: { ...common, kind: 'human', actorId: selected.value.actor.controllerId,
    clubId: opportunity.clubId, inputs, inputHashes: { control: hash(row), extent: hash(extent), club: hash(clubRow) } } });
};

/** Current mutable owners are consulted only for first adoption. */
export const capturePostPlayReviewAdmission = (db: PostPlayReviewDb, scope: PostPlayReviewNativeScope,
  previous: ActualPostPlayReviewProjection, source: AcceptedActualPostPlayReviewEvent,
  intent: AcceptedActualPostPlayReviewIntent | null): PostPlayAdmissionResult => {
  const action = source.action;
  let inputs: Inputs | null = null;
  if ((action.kind === 'request' || action.kind === 'decline') && intent?.capability === 'actual_post_play_review_intent_v1') {
    const control = db.prepare('SELECT world_revision,control_revision,control_json FROM world_control_heads WHERE career_id=?').get(scope.careerId);
    const extent = db.prepare(`SELECT count(*) AS count,min(world_revision) AS first_revision,max(world_revision) AS last_revision,
      coalesce(sum(CASE WHEN typeof(world_revision)='integer' AND world_revision>0 THEN 1 ELSE 0 END),0) AS integer_count
      FROM world_decision_revision_events WHERE career_id=?`).get(scope.careerId);
    const club = db.prepare('SELECT revision,state_json FROM world_club_heads WHERE career_id=? AND club_id=?')
      .get(scope.careerId, intent.opportunity.clubId);
    if (!control || !extent || !club) throw new Error('post-play current control or Club owner is missing');
    inputs = { control: control as ControlRow, extent: extent as Extent, club: club as ClubRow };
  }
  return capture(scope, previous, source, intent, inputs);
};
/** Replay the admitted snapshot, never a newer controller or appointment. */
export const replayPostPlayReviewAdmission = (scope: PostPlayReviewNativeScope, previous: ActualPostPlayReviewProjection,
  source: AcceptedActualPostPlayReviewEvent, intent: AcceptedActualPostPlayReviewIntent | null, evidence: PostPlayReviewAdmission) => {
  if (!fields(evidence, ['version', 'kind', 'careerId', 'gameId', 'playId', 'policyHash', 'actorId', 'clubId', 'inputs', 'inputHashes'])) {
    throw new Error('invalid post-play admitted authority archive');
  }
  const result = capture(scope, previous, source, intent, evidence.inputs);
  if (result.kind !== 'admitted' || json(result.evidence) !== json(evidence)) throw new Error('post-play admitted authority archive differs');
  return result.evidence;
};
