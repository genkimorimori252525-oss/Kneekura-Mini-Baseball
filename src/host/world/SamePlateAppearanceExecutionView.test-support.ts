import { enrollmentFixture } from './SamePlateAppearanceEnrollment.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';

export const reference=(owner:string,value:{source:{sourceId:string}})=>({owner,sourceId:value.source.sourceId,sourceHash:hash(value.source),snapshotHash:hash(value)});
/** Real small Native owners and retained workload histories; only actor/frame
 * authentication is mocked by enrollmentFixture. Never a genuine fixture input. */
export const executionViewFixture=(suffix='')=>{
  const f=enrollmentFixture(suffix);
  Object.assign(f.actor.match,{balls:0,strikes:0});Object.assign(f.actor.world,{tick:100});f.persistActor();
  for(const [i,playerId] of f.players.slice(1).entries()){
    const id='prior-work-'+playerId;f.activities.set(id,{sourceEventId:id,sourceVersion:'fixture-v1',evidenceId:'prior-other-pa',careerId:'career-a',playerId,atDay:2,kind:'MATCH',effortUnits:0.1+i/100});f.workload.apply(id,0);
  }
  const source={...f.source,actorReference:{...f.source.actorReference,sourceHash:hash(f.actor.source),snapshotHash:hash(f.actor)},
    participantBaselineReferences:f.source.participantBaselineReferences.map(p=>{const s=readActualRoleWorkloadState(f.db,'career-a',p.playerId)!;return {...p,revision:s.revision,stateHash:hash(s)};})};
  const enrollmentOwner=openSqliteSamePlateAppearanceEnrollmentStore(f.path,{readAcceptedEnrollment:()=>source});
  const enrollment=enrollmentOwner.accept(source.sourceId);if(enrollment.kind!=='reserved')throw new Error('small fixture enrollment missing');enrollmentOwner.close();
  const prefixes=new Map<string,unknown>(),totals=new Map<string,unknown>(),views=new Map<string,unknown>();
  const authority={readAcceptedPrefix:(id:string)=>prefixes.get(id)??null,readAcceptedTotal:(id:string)=>totals.get(id)??null,readAcceptedView:(id:string)=>views.get(id)??null};
  const owner=openSqliteSamePlateAppearanceExecutionStore(f.path,authority);
  const prefixSource={sourceId:'prefix'+suffix,sourceVersion:'fixture-v1',capability:'reserved_same_pa_empty_prefix_v1',enrollmentReference:reference('same_pa_enrollments',enrollment)};
  prefixes.set(prefixSource.sourceId,prefixSource);
  const acceptPrefix=()=>{const p=owner.acceptPrefix(prefixSource.sourceId);if(p.kind!=='empty_prefix')throw new Error('fixture prefix pending');return p;};
  const totalSources=(prefix:any)=>enrollment.participants.map(p=>({sourceId:'total-'+p.binding.playerId,sourceVersion:'fixture-v1',capability:'reserved_same_pa_cumulative_total_v1',
    enrollmentReference:prefixSource.enrollmentReference,prefixReference:reference('reserved_pa_work_prefixes',prefix),
    participantReference:{playerId:p.binding.playerId,bindingHash:hash(p.binding),personHash:p.personHash,baselineSourceId:p.baselineSourceId,revision:p.state.revision,stateHash:hash(p.state)},
    effortUnits:0,provenance:{assessmentSourceId:'assessment-'+p.binding.playerId,assessmentVersion:'fixture-only-zero-total-v1',calibrationSourceId:'explicit-empty-fixture',calibrationVersion:'fixture-only-zero-total-v1'}}));
  const prepare=()=>{const prefix=acceptPrefix(),sources=totalSources(prefix);const assessments=sources.map(s=>{totals.set(s.sourceId,s);const v=owner.acceptTotal(s.sourceId);if(v.kind!=='cumulative_total')throw new Error('fixture TOTAL pending');return v;});
    const viewSource={sourceId:'view'+suffix,sourceVersion:'fixture-v1',capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference:prefixSource.enrollmentReference,
      prefixReference:reference('reserved_pa_work_prefixes',prefix),participantTotalReferences:assessments.map((v:any)=>({playerId:v.source.participantReference.playerId,assessmentReference:reference('reserved_pa_total_assessments',v)}))};
    views.set(viewSource.sourceId,viewSource);return {prefix,sources,assessments,viewSource};};
  return {...f,enrollment,prefixSource,prefixes,totals,views,authority,owner,acceptPrefix,totalSources,prepare,close(){owner.close();f.close();}};
};
