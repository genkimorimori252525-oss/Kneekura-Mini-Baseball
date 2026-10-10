import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { advancePlayerWorkloadRecovery,type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorHash as hash,actorJson as json,actorFreeze as freeze,readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaEnrollmentRow,authenticateSamePaRow } from './SamePlateAppearanceReservationGuard';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { assertHistoricalSamePaWorkloadCut } from './SamePlateAppearanceHistoricalWorkloadCut';
import { actualLivePlayOwnerIdentityRow } from './ActualLivePlayOwnerMetadata';
import { originalLiveOwnerDomains } from './ActualLiveRuntimeRegistration';
import { assertReservedPaStorage } from './SamePlateAppearanceExecutionStorage';
import { assertReservedPaClaims } from './SamePlateAppearanceProvisionalClaimGuard';
import { samePaPrefixInput,samePaReferenceValid,type SamePaReference,type SamePaExecutionLineage,type SamePaEmptyWorkPrefix } from './SamePlateAppearanceWorkPrefix';
import { samePaTotalInput,type SamePaCumulativeTotal } from './SamePlateAppearanceCumulativeTotal';
import { samePaViewInput,samePaAssessmentSetHash,type SamePaExecutionView } from './SamePlateAppearanceExecutionView';
import { samePaExecutionInput,samePaExecutionReference,samePaExecutionRow,samePaExecutionTables,type SamePaExecutionKind,type SamePaExecutionResult } from './SamePlateAppearanceExecutionFromSqlite';
import { assertSamePaAssessmentOwnership } from './SamePlateAppearanceAssessmentOwnership';
export type HistoricalSamePaExecutionView=Readonly<{kind:'historical_same_pa_execution_view_v1';reference:SamePaReference<'reserved_pa_execution_views'>;view:SamePaExecutionView}>;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('historical same-PA original dependency or immutable state differs');};

/** Historical evidence only. The cut is the original reserved revision and
 * accepted empty-prefix record, never a caller cutoff or a current-head test.
 * This reader grants no fresh admission and never follows the future pitch. */
export const readHistoricalSamePaExecutionView=(db:DatabaseSync,rawReference:unknown):HistoricalSamePaExecutionView=>{
  const {DatabaseSync:Native}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if(!(db instanceof Native)||!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==1)throw new Error('historical same-PA requires a Native query-only owned snapshot');
  const signature=()=>json({transaction:db.isTransaction,query:db.prepare('PRAGMA query_only').get()!.query_only,
    changes:db.prepare('SELECT total_changes() AS n').get()!.n,main:db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp:db.prepare('PRAGMA temp.schema_version').get()!.schema_version,user:db.prepare('PRAGMA main.user_version').get()!.user_version});
  const expected=signature(),identity='historical_pa_'+randomUUID().replaceAll('-','');let identityReady=false;
  const check=()=>{if(signature()!==expected)throw new Error('historical same-PA proof changed or expired');
    if(identityReady){db.exec('RELEASE '+identity);identityReady=false;db.exec('SAVEPOINT '+identity);identityReady=true;}};
  const requested=cloneInert(rawReference) as SamePaReference<'reserved_pa_execution_views'>;
  if(!samePaReferenceValid(requested,'reserved_pa_execution_views'))throw new Error('invalid historical same-PA view reference');
  const original=(ref:SamePaReference<'same_pa_enrollments'>)=>{
    check();
    const row=samePaEnrollmentRow(db,ref.sourceId);if(!row)throw new Error('historical same-PA original enrollment missing');
    const enrollment=authenticateSamePaRow(db,row);same(samePaExecutionReference('same_pa_enrollments',enrollment),ref);
    // The actor owner reconstructs its immutable initial/activation ancestry.
    // Its separate assertPhysicalActorOpenFrame is intentionally not invoked.
    const actor=readPhysicalPlateAppearanceActorFromSqlite(db,enrollment.source.actorReference.sourceId);
    if(!actor)throw new Error('historical same-PA actor missing');same(samePaExecutionReference('physical_plate_appearance_actors',actor),enrollment.source.actorReference);
    same({actorHash:hash(actor),officialRevision:actor.officialRevision,worldHash:hash(actor.world),fixtureHash:actor.fixtureHash},
      {actorHash:enrollment.actorHash,officialRevision:enrollment.officialRevision,worldHash:enrollment.worldHash,fixtureHash:enrollment.fixtureHash});
    const originals=readSamePaOriginalParticipants(db,actor),bindings=originals.map(p=>p.binding).sort((a,b)=>a.playerId<b.playerId?-1:a.playerId>b.playerId?1:0);
    same(bindings,enrollment.participants.map(p=>p.binding));
    for(const p of enrollment.participants){
      assertHistoricalSamePaWorkloadCut(db,p.binding.careerId,p.binding.playerId,p.state.revision);
      const state=readActualRoleWorkloadState(db,p.binding.careerId,p.binding.playerId,p.state.revision,p.binding.personLinkSourceId);same(state,p.state);
      const person=originals.find(x=>x.binding.playerId===p.binding.playerId)?.person;
      if(!person)throw new Error('historical same-PA original Person missing');same(hash(person),p.personHash);
    }
    return {enrollment,actor};
  };
  const bases=new Map<string,ReturnType<typeof original>>(),values=new Map<string,SamePaExecutionResult>();
  const basis=(ref:SamePaReference<'same_pa_enrollments'>)=>{check();let value=bases.get(ref.sourceId);if(!value){value=original(ref);bases.set(ref.sourceId,value);}
    same(samePaExecutionReference('same_pa_enrollments',value.enrollment),ref);return value;};
  const lineage=(ref:SamePaReference<'same_pa_enrollments'>):SamePaExecutionLineage=>{const {enrollment:e}=basis(ref);return {enrollmentReference:ref,actorReference:e.source.actorReference,
    careerId:e.careerId,gameId:e.gameId,playId:e.playId,firstPhysicalPitchSourceId:e.source.firstPhysicalPitchSourceId,participantReferences:e.participants.map(p=>({playerId:p.binding.playerId,
      bindingHash:hash(p.binding),personHash:p.personHash,baselineSourceId:p.baselineSourceId,revision:p.state.revision,stateHash:hash(p.state)}))};};
  const read=(kind:SamePaExecutionKind,ref:SamePaReference):SamePaExecutionResult=>{
    check();
    if(!samePaReferenceValid(ref,samePaExecutionTables[kind]))throw new Error('historical same-PA reference owner differs');
    const key=kind+':'+ref.sourceId,cached=values.get(key);if(cached){same(samePaExecutionReference(ref.owner,cached),ref);return cached;}
    const row=actualLivePlayOwnerIdentityRow(db,samePaExecutionTables[kind],ref.sourceId);if(!row)throw new Error('historical same-PA required owner missing');
    const raw=samePaExecutionInput(kind,JSON.parse(String(row.source_json)),ref.sourceId);let value:SamePaExecutionResult;
    if(kind==='prefix'){
      const source=samePaPrefixInput(raw),b=basis(source.enrollmentReference),l=lineage(source.enrollmentReference),timeline=createCanonicalPlateAppearanceTimeline(b.actor.match,b.actor.world.tick);
      // This is the frozen v1 census, not a scan of work existing now. Future
      // dispatch uses a separate versioned registry and cannot enlarge this cut.
      const domainCensus=[...new Set(['physical_pitch_progress_actions','physical_pitch_progress_heads','actual_live_play_runtimes','actual_live_play_fences',
        'actual_first_base_play_ends','actual_foul_play_ends',...originalLiveOwnerDomains().flatMap(d=>[d.owner,...(d.head?[d.head.owner]:[])])])].sort();
      const coverage={lineage:l,physicalRevision:0 as const,endpoint:null,episodes:[] as const,resumes:[] as const,timeline,worldHash:hash(b.actor.world),timelineHash:hash(timeline),domainCensus,
        participantWork:l.participantReferences.map(p=>({playerId:p.playerId,work:[] as const}))};
      value=freeze({kind:'empty_prefix',source,...coverage,coverageHash:hash(coverage)});
    }else if(kind==='total'){
      const source=samePaTotalInput(raw),prefix=read('prefix',source.prefixReference) as SamePaEmptyWorkPrefix,l=lineage(source.enrollmentReference);
      assertSamePaAssessmentOwnership(db,source);same(prefix.lineage.enrollmentReference,source.enrollmentReference);
      const p=l.participantReferences.find(p=>p.playerId===source.participantReference.playerId);if(!p)throw new Error('historical same-PA participant missing');same(p,source.participantReference);
      value=freeze({kind:'cumulative_total',source,lineage:l,coverageHash:prefix.coverageHash,effortUnits:0});
    }else{
      const source=samePaViewInput(raw),prefix=read('prefix',source.prefixReference) as SamePaEmptyWorkPrefix,l=lineage(source.enrollmentReference),{enrollment:e}=basis(source.enrollmentReference);
      same(prefix.lineage.enrollmentReference,source.enrollmentReference);
      same(source.participantTotalReferences.map(p=>p.playerId).sort(),e.participants.map(p=>p.binding.playerId).sort());
      const participants=e.participants.map(p=>{const ref=source.participantTotalReferences.find(r=>r.playerId===p.binding.playerId);if(!ref)throw new Error('historical same-PA TOTAL missing');
        const total=read('total',ref.assessmentReference) as SamePaCumulativeTotal;same(total.source.enrollmentReference,source.enrollmentReference);same(total.source.prefixReference,source.prefixReference);
        same(total.source.participantReference,l.participantReferences.find(r=>r.playerId===p.binding.playerId));same(total.coverageHash,prefix.coverageHash);
        const activity:PlayerWorkloadActivity={sourceEventId:'actual-total-play-workload:'+hash([e.careerId,e.gameId,e.playId,p.binding.playerId]),sourceVersion:'reserved-same-pa-total-workload-v1',
          evidenceId:prefix.source.sourceId,careerId:e.careerId,playerId:p.binding.playerId,atDay:p.binding.gameDay,kind:'MATCH',effortUnits:total.effortUnits};
        const projectedState=advancePlayerWorkloadRecovery(p.state,p.state.revision,activity);return {playerId:p.binding.playerId,totalReference:ref.assessmentReference,reservedState:p.state,activity,projectedState,projectedStateHash:hash(projectedState)};});
      value=freeze({kind:'basis_prepared',source,lineage:l,coverageHash:prefix.coverageHash,assessmentSetHash:samePaAssessmentSetHash(source.participantTotalReferences),participants});
    }
    same(row,samePaExecutionRow(value));same(samePaExecutionReference(ref.owner,value),ref);values.set(key,value);return value;
  };
  try{check();db.exec('SAVEPOINT '+identity);identityReady=true;
    if(!assertReservedPaStorage(db))throw new Error('historical same-PA owner storage missing');assertReservedPaClaims(db);
    const value=freeze({kind:'historical_same_pa_execution_view_v1' as const,reference:requested,view:read('view',requested) as SamePaExecutionView});
    check();db.exec('RELEASE '+identity);identityReady=false;return value;
  }finally{bases.clear();values.clear();if(identityReady&&db.isTransaction)db.exec('RELEASE '+identity);}
};
