import type { DatabaseSync } from 'node:sqlite';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { advancePlayerWorkloadRecovery,type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePlateAppearanceEnrollmentBasis } from './SamePlateAppearanceEnrollmentFromSqlite';
import { actualLivePlayOwnerIdentityRow } from './ActualLivePlayOwnerMetadata';
import { originalLiveOwnerDomains } from './ActualLiveRuntimeRegistration';
import { assertReservedPaStorage } from './SamePlateAppearanceExecutionStorage';
import { assertReservedPaClaims } from './SamePlateAppearanceProvisionalClaimGuard';
import { assertSamePaAssessmentOwnership } from './SamePlateAppearanceAssessmentOwnership';
import { samePaPrefixInput,type SamePaReference,type SamePaExecutionLineage,type SamePaEmptyWorkPrefix } from './SamePlateAppearanceWorkPrefix';
import { samePaTotalInput,type SamePaCumulativeTotal } from './SamePlateAppearanceCumulativeTotal';
import { samePaViewInput,samePaAssessmentSetHash,type SamePaExecutionView } from './SamePlateAppearanceExecutionView';
export type SamePaExecutionKind='prefix'|'total'|'view';
export type SamePaExecutionResult=SamePaEmptyWorkPrefix|SamePaCumulativeTotal|SamePaExecutionView;
export const samePaExecutionTables={prefix:'reserved_pa_work_prefixes',total:'reserved_pa_total_assessments',view:'reserved_pa_execution_views'} as const;
export const samePaExecutionInput=(kind:SamePaExecutionKind,source:unknown,id?:string)=>kind==='prefix'?samePaPrefixInput(source,id):kind==='total'?samePaTotalInput(source,id):samePaViewInput(source,id);
export const samePaExecutionReference=<O extends string>(owner:O,value:{source:{sourceId:string}}):SamePaReference<O>=>({owner,sourceId:value.source.sourceId,sourceHash:hash(value.source),snapshotHash:hash(value)});
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('same-PA execution dependency or immutable ownership differs');};
export const samePaExecutionRow=(value:SamePaExecutionResult):Record<string,string|number>=>{
  const l=value.lineage,s=value.source,common={source_id:s.sourceId,enrollment_source_id:l.enrollmentReference.sourceId,career_id:l.careerId,
    game_id:l.gameId,play_id:l.playId,actor_source_id:l.actorReference.sourceId,first_pitch_source_id:l.firstPhysicalPitchSourceId};
  const special:Record<string,string|number>=value.kind==='empty_prefix'?{physical_revision:0}:value.kind==='cumulative_total'
    ?{prefix_source_id:value.source.prefixReference.sourceId,player_id:value.source.participantReference.playerId,baseline_source_id:value.source.participantReference.baselineSourceId}
    :{prefix_source_id:value.source.prefixReference.sourceId,assessment_set_hash:value.assessmentSetHash};
  return {...common,...special,source_json:json(s),source_hash:hash(s),snapshot_json:json(value),snapshot_hash:hash(value)};
};

/** A context is a lexical value of this one read-only proof. It is never
 * exported, returned, accepted from a caller, or retained across owner calls. */
export const proveSamePaExecution=(db:DatabaseSync,request:Readonly<{kind:SamePaExecutionKind;sourceId:string;source?:unknown}>):SamePaExecutionResult|null=>{
  const counters=()=>json({transaction:db.isTransaction,query:db.prepare('PRAGMA query_only').get()!.query_only,
    changes:db.prepare('SELECT total_changes() AS n').get()!.n,main:db.prepare('PRAGMA main.schema_version').get()!.schema_version,temp:db.prepare('PRAGMA temp.schema_version').get()!.schema_version});
  if(!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==1)throw new Error('same-PA execution requires a private read-only proof');
  const before=counters();let active=true;
  const bases=new Map<string,NonNullable<ReturnType<typeof readSamePlateAppearanceEnrollmentBasis>>>();
  const values=new Map<string,SamePaExecutionResult>();
  const check=()=>{if(!active||counters()!==before)throw new Error('same-PA execution proof context expired or changed');};
  const basis=(ref:SamePaReference<'same_pa_enrollments'>)=>{
    check();let b=bases.get(ref.sourceId);
    if(!b){const read=readSamePlateAppearanceEnrollmentBasis(db,ref.sourceId);if(!read)throw new Error('same-PA original enrollment reference missing');b=read;bases.set(ref.sourceId,b);}
    same(samePaExecutionReference('same_pa_enrollments',b.enrollment),ref);check();return b;
  };
  const lineage=(ref:SamePaReference<'same_pa_enrollments'>):SamePaExecutionLineage=>{
    const {enrollment:e}=basis(ref);return {enrollmentReference:ref,actorReference:e.source.actorReference,careerId:e.careerId,gameId:e.gameId,playId:e.playId,
      firstPhysicalPitchSourceId:e.source.firstPhysicalPitchSourceId,participantReferences:e.participants.map(p=>({playerId:p.binding.playerId,bindingHash:hash(p.binding),personHash:p.personHash,
        baselineSourceId:p.baselineSourceId,revision:p.state.revision,stateHash:hash(p.state)}))};
  };
  const referenced=(kind:SamePaExecutionKind,ref:SamePaReference)=>{
    if(ref.owner!==samePaExecutionTables[kind])throw new Error('same-PA execution reference owner differs');
    const value=read(kind,ref.sourceId);if(!value)throw new Error('same-PA execution referenced owner missing');same(samePaExecutionReference(ref.owner,value),ref);return value;
  };
  const derive=(kind:SamePaExecutionKind,raw:unknown):SamePaExecutionResult=>{
    check();
    if(kind==='prefix'){
      const source=samePaPrefixInput(raw),b=basis(source.enrollmentReference),l=lineage(source.enrollmentReference);
      const timeline=createCanonicalPlateAppearanceTimeline(b.actor.match,b.actor.world.tick);
      const domainCensus=[...new Set(['physical_pitch_progress_actions','physical_pitch_progress_heads','actual_live_play_runtimes','actual_live_play_fences',
        'actual_first_base_play_ends','actual_foul_play_ends',...originalLiveOwnerDomains().flatMap(d=>[d.owner,...(d.head?[d.head.owner]:[])])])].sort();
      const coverage={lineage:l,physicalRevision:0 as const,endpoint:null,episodes:[] as const,resumes:[] as const,timeline,worldHash:hash(b.actor.world),timelineHash:hash(timeline),domainCensus,
        participantWork:l.participantReferences.map(p=>({playerId:p.playerId,work:[] as const}))};
      return freeze({kind:'empty_prefix',source,...coverage,coverageHash:hash(coverage)});
    }
    if(kind==='total'){
      const source=samePaTotalInput(raw),prefix=referenced('prefix',source.prefixReference) as SamePaEmptyWorkPrefix;
      assertSamePaAssessmentOwnership(db,source);
      same(prefix.lineage.enrollmentReference,source.enrollmentReference);const l=lineage(source.enrollmentReference),participant=l.participantReferences.find(p=>p.playerId===source.participantReference.playerId);
      if(!participant)throw new Error('same-PA TOTAL participant missing');same(participant,source.participantReference);
      return freeze({kind:'cumulative_total',source,lineage:l,coverageHash:prefix.coverageHash,effortUnits:0});
    }
    const source=samePaViewInput(raw),prefix=referenced('prefix',source.prefixReference) as SamePaEmptyWorkPrefix;
    same(prefix.lineage.enrollmentReference,source.enrollmentReference);const l=lineage(source.enrollmentReference),{enrollment:e}=basis(source.enrollmentReference);
    const participants=e.participants.map(p=>{
      const ref=source.participantTotalReferences.find(r=>r.playerId===p.binding.playerId);if(!ref)throw new Error('same-PA view participant TOTAL missing');
      const total=referenced('total',ref.assessmentReference) as SamePaCumulativeTotal;
      same(total.source.enrollmentReference,source.enrollmentReference);same(total.source.prefixReference,source.prefixReference);
      same(total.source.participantReference,l.participantReferences.find(r=>r.playerId===p.binding.playerId));same(total.coverageHash,prefix.coverageHash);
      const activity:PlayerWorkloadActivity={sourceEventId:'actual-total-play-workload:'+hash([e.careerId,e.gameId,e.playId,p.binding.playerId]),sourceVersion:'reserved-same-pa-total-workload-v1',
        evidenceId:prefix.source.sourceId,careerId:e.careerId,playerId:p.binding.playerId,atDay:p.binding.gameDay,kind:'MATCH',effortUnits:total.effortUnits};
      const projectedState=advancePlayerWorkloadRecovery(p.state,p.state.revision,activity);
      return {playerId:p.binding.playerId,totalReference:ref.assessmentReference,reservedState:p.state,activity,projectedState,projectedStateHash:hash(projectedState)};
    });
    return freeze({kind:'basis_prepared',source,lineage:l,coverageHash:prefix.coverageHash,assessmentSetHash:samePaAssessmentSetHash(source.participantTotalReferences),participants});
  };
  const read=(kind:SamePaExecutionKind,id:string):SamePaExecutionResult|null=>{
    check();const key=kind+':'+id,cached=values.get(key);if(cached)return cached;
    if(!assertReservedPaStorage(db))return null;
    const row=actualLivePlayOwnerIdentityRow(db,samePaExecutionTables[kind],id);if(!row)return null;
    const source=samePaExecutionInput(kind,JSON.parse(String(row.source_json)),id),value=derive(kind,source);
    same(row,samePaExecutionRow(value));values.set(key,value);check();return value;
  };
  try{
    assertReservedPaStorage(db);assertReservedPaClaims(db);
    const value=request.source===undefined?read(request.kind,request.sourceId):derive(request.kind,samePaExecutionInput(request.kind,request.source,request.sourceId));
    check();return value;
  }finally{active=false;bases.clear();values.clear();}
};
