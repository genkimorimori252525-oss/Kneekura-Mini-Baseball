import { assertNoSamePaCatchReviewSeal } from './SamePlateAppearanceCatchReviewSeal';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { bodyCompositionSourceClaim as claim } from './BodyMaterializationSqliteOwnership';
import { batterRunArchiveFromSqlite,openBatterRunSourceArchive,assertBatterRunArchiveStorage,type BatterRunArchiveOwner } from './BatterRunSourceArchive';
import { batterRunPlanInput as input,prepareBatterRunPlan,type AcceptedBatterRunPlan as Source } from './BatterRunPlan';
import { batterSwingExitStateEvidenceFromSqlite } from './SqliteBatterSwingExitStateStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaReferenceValid,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readHistoricalSamePaLifecycleViewFromSqlite,readCurrentSamePaLifecycleViewFromSqlite,assertSamePaLifecycleReservedStateFromSqlite,assertSamePaLifecycleWorkCoverage,readSamePaLifecycleRecordFromSqlite,withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
const table='world_batter_run_plans' as const;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('batter-run original intent binding differs');};
const derive=(db:DatabaseSync,source:Source)=>withSamePaLifecycleReadPhase(db,()=>{
  const exit=batterSwingExitStateEvidenceFromSqlite(db).read(source.exitStateReference.sourceId);
  if(!exit)throw new Error('batter-run owned swing-exit state missing');same(reference('world_batter_swing_exit_states',exit),source.exitStateReference);
  const basis=readHistoricalSamePaLifecycleViewFromSqlite(db,source.viewReference),{view,actor}=basis;
  same(exit.lineage,view.lineage);same(exit.physicalPitchReference,source.physicalPitchReference);same(view.cut.physicalPitchReference,source.physicalPitchReference);
  if(source.playerId!==actor.binding.playerId||source.personId!==actor.binding.personId||view.cut.stage!=='field_active'
    ||view.cut.timeline.status.kind!=='batted_ball_pending'||view.cut.outcomeReference||view.cut.resetReference
    ||source.intent.issuedTick!==view.cut.evaluationTick||exit.state.tick>source.intent.issuedTick)throw new Error('batter-run actual issuance, Player or active view differs');
  const prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',view.source.prefixReference.sourceId);
  if(!prefix||prefix.kind!=='same_pa_lifecycle_prefix')throw new Error('batter-run original physical prefix missing');
  same(reference('pa_lifecycle_v1_work_prefixes',prefix),view.source.prefixReference);
  if(!prefix.source.eventReferences.some(r=>json(r)===json(exit.source.fieldReference)))throw new Error('batter-run state was unavailable to its original issuance view');
  const plan=prepareBatterRunPlan(exit,source);if(plan.kind!=='prepared')throw new Error('accepted batter-run plan unexpectedly pending');
  return freeze({kind:'owned_batter_run_plan_v1' as const,source,lineage:view.lineage,physicalPitchReference:source.physicalPitchReference,
    viewReference:source.viewReference,playerId:exit.playerId,personId:exit.personId,evaluationTick:source.intent.issuedTick,
    exitStateReference:source.exitStateReference,exitState:exit,plan});
});
export type DurableBatterRunPlan=ReturnType<typeof derive>;
const make=(db:DatabaseSync):BatterRunArchiveOwner<Source,DurableBatterRunPlan>=>({input,derive:s=>derive(db,s),
  key:s=>json([s.physicalPitchReference.owner,s.physicalPitchReference.sourceId]),
  scope:s=>({sql:`${claim('source_json',['physicalPitchReference','sourceId'])} OR ${claim('snapshot_json',['source','physicalPitchReference','sourceId'])}`,
    values:[s.physicalPitchReference.sourceId,s.physicalPitchReference.sourceId]}),
  assertCurrent:(value,inserted)=>{
    assertNoSamePaCatchReviewSeal(db,value.lineage.gameId,value.lineage.playId);
    const basis=(inserted?readHistoricalSamePaLifecycleViewFromSqlite:readCurrentSamePaLifecycleViewFromSqlite)(db,value.source.viewReference);
    same(basis.view.lineage,value.lineage);assertSamePaLifecycleReservedStateFromSqlite(db,basis);
    if(inserted){
      const prefix=readSamePaLifecycleRecordFromSqlite(db,'prefix',basis.view.source.prefixReference.sourceId);
      if(!prefix||prefix.kind!=='same_pa_lifecycle_prefix')throw new Error('batter-run original issuance prefix disappeared');
      assertSamePaLifecycleWorkCoverage(db,value.lineage.enrollmentReference,prefix.source.anchorViewReference,
        [...prefix.source.eventReferences,reference(table,value)]);
    }
  },
});
export const assertBatterRunPlanStorage=(db:Pick<DatabaseSync,'prepare'>)=>assertBatterRunArchiveStorage(db,table);
export const readBatterRunPlanFromSqlite=(db:DatabaseSync,ref:SamePaReference<'world_batter_run_plans'>):DurableBatterRunPlan=>withSamePaLifecycleReadPhase(db,()=>{
  if(!samePaReferenceValid(ref,table))throw new Error('invalid batter-run plan reference');
  const value=batterRunArchiveFromSqlite(db,table,make(db)).read(ref.sourceId);if(!value)throw new Error('original accepted batter-run plan missing');
  same(reference(table,value),ref);return value;
});
export const openSqliteBatterRunPlanStore=(path:string,authority?:Readonly<{readAcceptedPlan(id:string):Source|null}>)=>
  openBatterRunSourceArchive(path,table,make,authority?.readAcceptedPlan.bind(authority));
