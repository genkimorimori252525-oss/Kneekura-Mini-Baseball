import { expect } from 'vitest';
import { getPlayAdjudicationState } from '../../core/adjudication/PlayAdjudicationLedger';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { ActualLiveOfficialPolicy } from './ActualLiveAdjudicationSource';
import type { SamePaCatchReviewSeedSource } from './SamePlateAppearanceCatchReviewSource';
import { deriveSamePaCatchReviewSeedFromSqlite } from './SamePlateAppearanceCatchReviewFromSqlite';
import { openSqliteActualPostPlayReviewStore } from './SqliteActualPostPlayReviewStore';
import type { AcceptedActualPostPlayReviewSession, AcceptedActualPostPlayReviewEvent, AcceptedActualPostPlayOfficialIntent,
  ActualPostPlayReviewEventAction } from './ActualPostPlayReviewSource';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Append the existing original review journal only after physical generation
 * and every received controller have reached the terminal cut. The seed is
 * rederived by its Native reader; no ledger or end enters accepted input. */
export const appendNativeReservedCatchReview = (h: ReturnType<typeof samePaPhysicalLifecycleFixture>,
  catchWorkReference: SamePaReference<'pa_catch_v1_work'>, policy: ActualLiveOfficialPolicy, label: string, schedulerId: string) => {
  const current=h.current(),physicalOperationReference=current.view.cut.physicalOperationReference;
  if(physicalOperationReference.owner!=='pa_physical_v1_field_roots'&&physicalOperationReference.owner!=='pa_physical_v1_field_steps')
    throw new Error('IFN01 review seed requires its original terminal field');
  const seedSource:SamePaCatchReviewSeedSource={sourceId:label+':seed',sourceVersion:'fixture-v1',capability:'same_pa_catch_review_seed_v1',
    viewReference:current.viewReference,catchWorkReference,physicalOperationReference:{...physicalOperationReference,owner:physicalOperationReference.owner},policy};
  const {seed,scope}=withSqliteReadTransaction(h.f.db,()=>deriveSamePaCatchReviewSeedFromSqlite(h.f.db,seedSource,'current'));
  const state=getPlayAdjudicationState(seed.ledger);
  if(state.kind!=='official_adjudication_open'||state.calls.length!==1)throw new Error('IFN01 review original imported call missing');
  const callId=state.calls[0].callId,windowId=label+':window',entitlementSourceId=label+':entitlement',officialId=label+':original-review-official';
  const session:AcceptedActualPostPlayReviewSession=h.save({sourceId:label+':session',sourceVersion:'fixture-v1',capability:'actual_post_play_review_session_v1',
    adjudicationSourceId:seedSource.sourceId,adjudicationSnapshotHash:seed.snapshotHash,reservedCatchSeed:seedSource,officialPolicy:policy,
    policy:{sourceId:label+':policy',sourceVersion:'explicit-fixture-v1',ruleProfileId:scope.originalMatch.ruleProfileId,
      openingTrigger:'physical_play_end',clock:'post_play_discrete_tick_v1',schedulerId,expiryScope:'request_admission',
      opportunities:[{windowKind:'review',windowId,entitlementSourceId,clubId:scope.clubs.AWAY,requesterIds:[officialId],reviewerIds:[officialId]}]}});
  const get=(id:string)=>h.accepted.get(id)??null;
  const owner=h.f.x.f.track(openSqliteActualPostPlayReviewStore(h.f.path,{readAcceptedSession:get,readAcceptedEvent:get,readAcceptedIntent:get}));
  const accept=(r:ReturnType<typeof owner.acceptSession>|ReturnType<typeof owner.acceptEvent>)=>{
    if(r.kind!=='accepted')throw new Error('IFN01 original review journal intake is pending: '+r.kind);return r.value;
  };
  let value=accept(owner.acceptSession(session.sourceId));expect(value.kind).toBe('official_pending');
  const intent:AcceptedActualPostPlayOfficialIntent=h.save({sourceId:label+':official-request-intent',sourceVersion:'explicit-fixture-v1',
    capability:'actual_post_play_review_official_intent_v1',sessionSourceId:session.sourceId,gameId:scope.gameId,playId:scope.playId,
    physicalPitchSourceId:scope.physicalPitchSourceId,callId,windowId,entitlementSourceId,officialId,action:'request'});
  const append=(name:string,action:ActualPostPlayReviewEventAction)=>{
    const source:AcceptedActualPostPlayReviewEvent=h.save({sourceId:label+':'+name,sourceVersion:'explicit-fixture-v1',capability:'actual_post_play_review_event_v1',
      sessionSourceId:session.sourceId,expectedRevision:value.revision,parent:{sourceId:value.headSourceId,snapshotHash:value.headHash},action});
    value=accept(owner.acceptEvent(source.sourceId));return source;
  };
  const requested=append('request',{kind:'official_request',windowId,callId,intentSourceId:intent.sourceId});
  expect(value.requests).toMatchObject([{sourceId:requested.sourceId,status:'review_pending'}]);
  append('decision',{kind:'decision',windowId,requestEventSourceId:requested.sourceId,reviewId:label+':decision-record',callId,reviewerId:officialId,
    basisSnapshotId:state.latestCorrectRule.snapshotId,basisEvidenceRevision:state.latestCorrectRule.evidenceRevision,decision:'stands'});
  append('next-play-fence',{kind:'next_play_fence',schedulerId});
  expect(value.kind).toBe('official_ready');expect(value.pendingReasons).toEqual([]);
  expect(value.seed.exactEnd).toEqual(seed.exactEnd);expect(value.ledger.playEnd).toEqual(seed.ledger.playEnd);
  const finalState=getPlayAdjudicationState(value.ledger);
  if(finalState.kind!=='official_adjudication_open')throw new Error('IFN01 review must precede the separate final closure');
  expect(finalState.reviews).toHaveLength(1);
  const pin={sessionSourceId:session.sourceId,revision:value.revision,headSourceId:value.headSourceId,headHash:value.headHash};
  const rows=()=>json(['actual_post_play_review_sessions','actual_post_play_review_events','actual_post_play_review_heads']
    .map(table=>h.f.db.prepare('SELECT * FROM main.'+table+' ORDER BY rowid').all()));
  const saved=rows();owner.close();
  const reopened=h.f.x.f.track(openSqliteActualPostPlayReviewStore(h.f.path));
  expect(reopened.readCurrent(session.sourceId)).toEqual(value);expect(accept(reopened.acceptSession(session.sourceId))).toEqual(reopened.readSession(session.sourceId));
  expect(rows()).toBe(saved);
  return{pin,value,assertHistoricalReplay:()=>{expect(reopened.readCurrent(session.sourceId)).toEqual(value);expect(rows()).toBe(saved);}};
};
