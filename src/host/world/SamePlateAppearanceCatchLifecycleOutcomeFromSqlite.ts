import type { DatabaseSync } from 'node:sqlite';
import { deriveSamePaFairCatchEndFromSqlite } from './SamePlateAppearanceFairCatchEndFromSqlite';
import { deriveSamePaCatchOfficial } from './SamePlateAppearanceCatchOfficial';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import { samePaOutcomeFieldEvidence, samePaOutcomeRetirement, readSamePaLifecycleResetFromSqlite } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { samePaStartingBaseCenters } from './SamePlateAppearanceLifecycleStartingGeometry';
import { readHistoricalSamePaLifecycleViewFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaLifecycleSchema } from './SamePlateAppearanceLifecycleStorage';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { actorFreeze as freeze, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { AcceptedSamePaLifecycleOutcome, SamePaLifecycleOutcome } from './SamePlateAppearanceLifecycleOutcome';

/** Physical completion is derived before, and independently from, the accepted
 * official scheduler. The existing outcome transaction owns both receipts and
 * fences later work; the ten original TOTALs remain the only workload writer. */
export const deriveSamePaCatchLifecycleOutcome = (db: DatabaseSync, source: Extract<AcceptedSamePaLifecycleOutcome, {kind:'fair_catch'}>,
  basis: SamePaLifecycleViewBasis, current: boolean): SamePaLifecycleOutcome | Readonly<{kind:'pending';reason:string}> => {
  const end = deriveSamePaFairCatchEndFromSqlite(db, source.viewReference, source.catchWorkReference, current ? 'current' : 'historical');
  if(end.kind==='pending')return end;
  const work=readSamePaCatchWorkFromSqlite(db,source.catchWorkReference),action=work.originalInputs.action!;
  const owned={...reference('pa_catch_v1_work',work),sourceVersion:work.source.sourceVersion};
  const actionView=readHistoricalSamePaLifecycleViewFromSqlite(db,action.viewReference).view;
  const ruleEvidence={...reference('pa_lifecycle_v1_execution_views',actionView),sourceVersion:actionView.source.sourceVersion};
  const official=deriveSamePaCatchOfficial({sourceId:source.sourceId,originalMatch:end.originalMatch,physicalEnd:end.playEnd,exactEnd:end.exactEnd,
    operative:end.operative,policy:source.officialPolicy,scheduler:source.official,callProvenance:{version:'owned_live_call_import_v1',
      playId:basis.view.lineage.playId,gameId:basis.view.lineage.gameId,physicalPitchSourceId:end.physicalPitchReference.sourceId,
      clock:{originTick:end.exactEnd.originTick,ticksPerSecond:end.scoringEvidence.field.evidence.ticksPerSecond},
      calledAtElapsedSeconds:action.calledAt.elapsedSeconds,availableAtElapsedSeconds:action.calledAt.elapsedSeconds,
      importedAtElapsedSeconds:end.exactEnd.elapsedSeconds,call:owned,perception:owned,policy:owned,ruleEvidence,reception:owned}});
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
    officialLedger:official.ledger,context:null,controllerRetirementBasis:samePaOutcomeRetirement(basis,physical.commands,end.playEnd.tick),baseCenters,fairCatch:end});
};
