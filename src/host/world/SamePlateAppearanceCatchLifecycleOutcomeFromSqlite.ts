import { samePaCatchOfficialOpeningInputFromSqlite, deriveSamePaCatchReviewSeedFromSqlite } from './SamePlateAppearanceCatchReviewFromSqlite';
import { actualPostPlayReviewEvidenceFromSqlite } from './ActualPostPlayReviewFromSqlite';
import { assertNoUnpinnedPostPlayReview, postPlayReviewSessionClaims, postPlayReviewEventRows, postPlayReviewHeadRows } from './ActualPostPlayReviewNativeMetadata';
import type { ActualPostPlayReviewProjection } from './ActualPostPlayReviewState';
import type { DatabaseSync } from 'node:sqlite';
import { deriveSamePaFairCatchEndFromSqlite } from './SamePlateAppearanceFairCatchEndFromSqlite';
import { deriveSamePaCatchOfficial } from './SamePlateAppearanceCatchOfficial';
import { samePaOutcomeFieldEvidence, samePaOutcomeRetirement, readSamePaLifecycleResetFromSqlite } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { samePaStartingBaseCenters } from './SamePlateAppearanceLifecycleStartingGeometry';
import { samePaLifecycleSchema } from './SamePlateAppearanceLifecycleStorage';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { AcceptedSamePaLifecycleOutcome, SamePaLifecycleOutcome } from './SamePlateAppearanceLifecycleOutcome';

/** Physical completion is derived before, and independently from, the accepted
 * official scheduler. The existing outcome transaction owns both receipts and
 * fences later work; the ten original TOTALs remain the only workload writer. */
export const deriveSamePaCatchLifecycleOutcome = (db: DatabaseSync, source: Extract<AcceptedSamePaLifecycleOutcome, {kind:'fair_catch'}>,
  basis: SamePaLifecycleViewBasis, current: boolean): SamePaLifecycleOutcome | Readonly<{kind:'pending';reason:string}> => {
  const end = deriveSamePaFairCatchEndFromSqlite(db, source.viewReference, source.catchWorkReference, current ? 'current' : 'historical');
  if(end.kind==='pending')return end;
  const opening=samePaCatchOfficialOpeningInputFromSqlite(db,source.sourceId,end,source.officialPolicy);
  const pin=source.postPlayReviewReference;
  let reviewed:ActualPostPlayReviewProjection|undefined,postPlayReview:SamePaLifecycleOutcome['postPlayReview'];
  const scope={gameId:basis.view.lineage.gameId,playId:basis.view.lineage.playId,physicalPitchSourceId:end.physicalPitchReference.sourceId};
  if(pin===undefined)assertNoUnpinnedPostPlayReview(db,source.sourceId,scope);
  else{
    const owner=actualPostPlayReviewEvidenceFromSqlite(db),session=owner.session(pin.sessionSourceId);
    if(!session)throw new Error('reserved catch pinned review session missing');
    reviewed=owner.readCurrent(pin.sessionSourceId)??undefined;
    const seedSource=session.value.source.reservedCatchSeed;
    if(!reviewed||!seedSource||json(seedSource.viewReference)!==json(source.viewReference)
      ||json(seedSource.catchWorkReference)!==json(source.catchWorkReference)
      ||json(seedSource.physicalOperationReference)!==json(source.physicalOperationReference)
      ||seedSource.policy!==null&&json(seedSource.policy)!==json(source.officialPolicy)||json(reviewed.source.officialPolicy)!==json(source.officialPolicy)
      ||reviewed.source.policy?.schedulerId!==source.official.schedulerId)throw new Error('reserved catch review seed, policy or scheduler differs');
    const authenticated=deriveSamePaCatchReviewSeedFromSqlite(db,seedSource,current?'current':'historical');
    if(json(authenticated.seed)!==json(reviewed.seed)||json(authenticated.scope)!==json(session.scope)
      ||json(pin)!==json({sessionSourceId:reviewed.source.sourceId,revision:reviewed.revision,headSourceId:reviewed.headSourceId,headHash:reviewed.headHash}))
      throw new Error('reserved catch review current seed or head pin differs');
    if(reviewed.kind!=='official_ready')return freeze({kind:'pending',reason:reviewed.pendingReasons.join('|')});
    // The outcome's existing pre/in/post-write full receipt comparisons also
    // pin admission_json and every session/event/head byte, beyond headHash.
    postPlayReview={reference:pin,journalHash:hash({sessions:postPlayReviewSessionClaims(db,reviewed.source.adjudicationSourceId,scope),
      events:postPlayReviewEventRows(db,pin.sessionSourceId),heads:postPlayReviewHeadRows(db,pin.sessionSourceId)})};
  }
  const official=deriveSamePaCatchOfficial({...opening,scheduler:source.official,...(reviewed?{reviewed}:{})});
  if(official.kind!=='closed')return freeze({kind:'pending',reason:official.pendingReasons.join('|')});
  for(const id of [source.official.sourceId,...source.official.events.map(e=>e.sourceId)])for(const table of Object.keys(samePaLifecycleSchema)){
    const conflicts=db.prepare(`SELECT source_id FROM main.${table} WHERE source_id=$id OR ${claim('source_json',['official','sourceId'],'$id')}
      OR ${claim('source_json',['official','assignment','sourceId'],'$id')} OR ${claim('source_json',['official','call','sourceId'],'$id')}
      OR ${claim('source_json',['official','events',{array:'all'},'sourceId'],'$id')}
      OR ${claim('snapshot_json',['source','official','sourceId'],'$id')} OR ${claim('snapshot_json',['source','official','assignment','sourceId'],'$id')}
      OR ${claim('snapshot_json',['source','official','call','sourceId'],'$id')} OR ${claim('snapshot_json',['source','official','events',{array:'all'},'sourceId'],'$id')}`).all({id});
    if(conflicts.some(r=>table!=='pa_lifecycle_v1_outcomes'||r.source_id!==source.sourceId))throw new Error('original catch official scheduler Source has another owner');
  }
  const c=basis.view.cut,baseCenters=c.bodyCut.worldReference.owner==='pa_lifecycle_v1_resets'
    ?readSamePaLifecycleResetFromSqlite(db,{...c.bodyCut.worldReference,owner:'pa_lifecycle_v1_resets'}).source.worldSetup.baseCenters:samePaStartingBaseCenters(db,basis.actor);
  const physical=samePaOutcomeFieldEvidence(db,basis);
  return freeze({kind:'same_pa_lifecycle_outcome',source,lineage:basis.view.lineage,actor:basis.actor,disposition:'terminal',timeline:end.timeline,
    evaluationTick:official.evaluationTick,physicalCompletedAtTick:end.playEnd.tick,physicalEnd:end.playEnd,physicalProofHash:hash(end),
    officialLedger:official.ledger,context:null,controllerRetirementBasis:samePaOutcomeRetirement(basis,physical.commands,end.playEnd.tick),baseCenters,fairCatch:end,...(postPlayReview?{postPlayReview}:{})});
};
