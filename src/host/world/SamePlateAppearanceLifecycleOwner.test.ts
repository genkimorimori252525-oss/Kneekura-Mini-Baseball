import {advancePlayerWorkloadRecovery,type PlayerWorkloadActivity} from '../../core/world/development/PlayerWorkloadRecovery';
import {afterEach,expect,it,vi} from 'vitest';
import {executionViewFixture} from './SamePlateAppearanceExecutionView.test-support';
import {samePaExecutionReference as reference} from './SamePlateAppearanceExecutionFromSqlite';
import {actorHash as hash,actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as original from './SamePlateAppearanceContinuationFromSqlite';
import * as second from './SamePlateAppearanceTakeSuccessorFromSqlite';
import * as claims from './SamePlateAppearanceContinuationClaimGuard';
import {readCurrentSamePaLifecycleViewFromSqlite,deriveCurrentSamePaLifecycleFromSqlite,withSamePaLifecycleReadPhase} from './SamePlateAppearanceLifecycleFromSqlite';
import {withSqliteReadTransaction} from './SqliteReadTransaction.test-support';
import {openSqliteSamePlateAppearanceLifecycleStore} from './SqliteSamePlateAppearanceLifecycleStore';
import {samePaLifecycleSchema} from './SamePlateAppearanceLifecycleStorage';
import type {SamePaContinuationView,SamePaNonemptyPrefix} from './SamePlateAppearanceContinuation';
import type {SamePaDispatchMember} from './SamePlateAppearanceDispatchRoles';
import type {AcceptedSamePaLifecyclePrefix,AcceptedSamePaLifecycleTotal,AcceptedSamePaLifecycleView,SamePaLifecyclePrefix} from './SamePlateAppearanceLifecycle';
import type {SamePaTakePitchBundle} from './SamePlateAppearanceTakeSuccessor';
const cleanup:(()=>void)[]=[];
afterEach(()=>{cleanup.splice(0).reverse().forEach(fn=>fn());vi.restoreAllMocks();});
/** Real new Native tables/transactions and workload states. Earlier completed
 * anchor/second-pitch owner proofs and metadata discovery are explicitly mocked.
 * No physical execution or genuine reservation qualification is asserted. */
const fixture=()=>{
  const f=executionViewFixture();cleanup.push(()=>f.close());
  // The ancestor is the mocked boundary for this structural test, so do not
  // reconstruct ten separately accepted old TOTALs merely to create its shape.
  const lineage={enrollmentReference:reference('same_pa_enrollments',f.enrollment),actorReference:f.source.actorReference,careerId:f.enrollment.careerId,gameId:f.enrollment.gameId,playId:f.enrollment.playId,firstPhysicalPitchSourceId:f.source.firstPhysicalPitchSourceId,
    participantReferences:f.enrollment.participants.map(p=>({playerId:p.binding.playerId,bindingHash:hash(p.binding),personHash:p.personHash,baselineSourceId:p.baselineSourceId,revision:p.state.revision,stateHash:hash(p.state)}))};
  const empty={lineage,participants:f.enrollment.participants.map(p=>{const activity:PlayerWorkloadActivity={sourceEventId:'explicit-fixture-event-'+p.binding.playerId,sourceVersion:'fixture-v1',evidenceId:'explicit-mocked-anchor',careerId:p.state.careerId,playerId:p.state.playerId,atDay:2,kind:'MATCH',effortUnits:0};const projectedState=advancePlayerWorkloadRecovery(p.state,p.state.revision,activity);
    return{playerId:p.binding.playerId,reservedState:p.state,activity,projectedState,projectedStateHash:hash(projectedState),totalReference:{owner:'reserved_pa_total_assessments' as const,sourceId:'mock-total-'+p.binding.playerId,sourceHash:hash('mock-total'),snapshotHash:hash('mock-total-result')}};})};
  const old:SamePaContinuationView={kind:'nonempty_basis_prepared',source:{sourceId:'mock-anchor-view',sourceVersion:'explicit-boundary-fixture-v1',capability:'same_pa_nonempty_cumulative_view_v1',enrollmentReference:empty.lineage.enrollmentReference,
    prefixReference:{owner:'pa_continuation_v1_work_prefixes',sourceId:'mock-anchor-prefix',sourceHash:hash('prefix'),snapshotHash:hash('prefix-value')},participantTotalReferences:[]},lineage:empty.lineage,coverageHash:hash('prior-covered-TAKE'),assessmentSetHash:hash('fixture-assessments'),evaluationTick:200,
    physicalCut:{kind:'completed_take_plate_crossing_v1',pitchReference:{owner:'pa_dispatch_v1_pitch_actions',sourceId:'mock-first',sourceHash:hash('first'),snapshotHash:hash('first-value')},originTick:100,ticksPerSecond:1_000_000,crossing:{tick:200,elapsedSeconds:0.0001,position:{x:0,y:1,z:0},velocity:{x:0,y:0,z:-30},spin:{x:0,y:0,z:0}},trajectoryHash:hash('trajectory'),timelineHash:hash('timeline')},
    participants:empty.participants.map(p=>({...p,totalReference:{...p.totalReference,owner:'pa_continuation_v1_total_assessments'}}))};
  const members:SamePaDispatchMember[]=empty.lineage.participantReferences.map(p=>({playerId:p.playerId,bindingHash:p.bindingHash,personHash:p.personHash,baselineSourceId:p.baselineSourceId,reservedRevision:p.revision,reservedStateHash:p.stateHash,projectedStateHash:empty.participants.find(x=>x.playerId===p.playerId)!.projectedStateHash}));
  const anchorRef=reference('pa_continuation_v1_execution_views',old),timeline={playId:f.actor.match.playId,startedAtTick:100,lastEventTick:300,nextSequence:2,status:{kind:'active' as const,count:{balls:0,strikes:2}},events:[]};
  const pitch={source:{sourceId:'mock-second',sourceVersion:'explicit-boundary-fixture-v1'},lineage:empty.lineage,result:{resolution:{timeline},delivery:{timeline:{followThroughEndUs:350}}}};
  const bundle={action:{source:{viewReference:anchorRef}},pitch} as unknown as SamePaTakePitchBundle;
  vi.spyOn(original,'readHistoricalSamePaContinuationViewFromSqlite').mockImplementation((_db,ref)=>{expect(ref).toEqual(anchorRef);return{actor:f.actor,view:old,members};});
  vi.spyOn(original,'readSamePaContinuationRecordFromSqlite').mockImplementation((_db,kind,id)=>{expect([kind,id]).toEqual(['prefix','mock-anchor-prefix']);return{kind:'nonempty_prefix',source:{operationReferences:[]}} as unknown as SamePaNonemptyPrefix;});
  vi.spyOn(second,'readSamePaSuccessorTakePitchFromSqlite').mockReturnValue(bundle);
  vi.spyOn(claims,'readSamePaContinuationClaimRows').mockImplementation(db=>Object.keys(samePaLifecycleSchema).filter(table=>db.prepare('SELECT 1 FROM sqlite_master WHERE name=?').get(table)).flatMap(table=>db.prepare('SELECT * FROM main.'+table).all().map(row=>({table,row}))));
  const sources=new Map<string,unknown>(),owner=openSqliteSamePlateAppearanceLifecycleStore(f.path,{readAcceptedPrefix:id=>sources.get(id)??null,readAcceptedTotal:id=>sources.get(id)??null,readAcceptedView:id=>sources.get(id)??null});cleanup.push(()=>owner.close());
  const prefixSource:AcceptedSamePaLifecyclePrefix={sourceId:'lifecycle-prefix',sourceVersion:'explicit-boundary-fixture-v1',capability:'same_pa_lifecycle_prefix_v1',enrollmentReference:empty.lineage.enrollmentReference,anchorViewReference:anchorRef,eventReferences:[reference('pa_take_successor_v1_pitch_actions',pitch)]};sources.set(prefixSource.sourceId,prefixSource);
  const prefix=()=>{const value=owner.acceptPrefix(prefixSource.sourceId);if(value.kind!=='same_pa_lifecycle_prefix')throw new Error('prefix pending');return value;};
  const totals=(prefix:SamePaLifecyclePrefix)=>empty.lineage.participantReferences.map((participantReference,i):AcceptedSamePaLifecycleTotal=>({sourceId:'lifecycle-total-'+i,sourceVersion:'explicit-zero-fixture-v1',capability:'same_pa_lifecycle_cumulative_total_v1',enrollmentReference:empty.lineage.enrollmentReference,prefixReference:reference('pa_lifecycle_v1_work_prefixes',prefix),participantReference,effortUnits:0,
    provenance:{assessmentSourceId:'explicit-lifecycle-fixture-assessment-'+i,assessmentVersion:'v1',calibrationSourceId:'explicit-zero-fixture',calibrationVersion:'v1'}}));
  const prepare=()=>{const pref=prefix(),ts=totals(pref);ts.forEach(s=>sources.set(s.sourceId,s));const set=owner.acceptTotalSet(ts.map(s=>s.sourceId));if(set.kind!=='same_pa_lifecycle_total_set')throw new Error('totals pending');
    const view:AcceptedSamePaLifecycleView={sourceId:'lifecycle-view',sourceVersion:'explicit-boundary-fixture-v1',capability:'same_pa_lifecycle_cumulative_view_v1',enrollmentReference:empty.lineage.enrollmentReference,prefixReference:reference('pa_lifecycle_v1_work_prefixes',pref),participantTotalReferences:set.participantTotalReferences};sources.set(view.sourceId,view);return{prefix:pref,totals:ts,view};};
  return{f,owner,sources,prefixSource,prefix,totals,prepare,empty};
};
it('LO01 Native lifecycle applies all ten explicit cumulative totals to reserved BEFORE and preserves fatigue at zero',()=>{
  const f=fixture(),p=f.prepare(),view=f.owner.acceptView(p.view.sourceId);if(view.kind!=='same_pa_lifecycle_view')throw new Error('view pending');expect(view.cut.pitchOrdinal).toBe(2);expect(view.cut.evaluationTick).toBe(350);
  expect(view.participants.map(p=>p.projectedState.fatigue)).toEqual(f.empty.participants.map(p=>p.reservedState.fatigue));expect(new Set(view.participants.map(p=>p.projectedState.fatigue)).size).toBeGreaterThan(1);
  expect(view.participants.every(p=>p.projectedState.revision===p.reservedState.revision+1)).toBe(true);
  const before=f.f.db.prepare('SELECT * FROM pa_lifecycle_v1_execution_views').all();expect(f.owner.acceptView(p.view.sourceId)).toEqual(view);f.owner.close();const reopened=openSqliteSamePlateAppearanceLifecycleStore(f.f.path);cleanup.push(()=>reopened.close());expect(reopened.readView(p.view.sourceId)).toEqual(view);expect(f.f.db.prepare('SELECT * FROM pa_lifecycle_v1_execution_views').all()).toEqual(before);
});
it('LO02 canonical prefix/view aliases reject and mixed TOTAL sets cannot be repaired',()=>{
  const f=fixture(),p=f.prepare();f.owner.acceptView(p.view.sourceId);f.sources.set('alias',{...f.prefixSource,sourceId:'alias'});expect(()=>f.owner.acceptPrefix('alias')).toThrow(/canonical|alias/);
  f.sources.set('view-alias',{...p.view,sourceId:'view-alias'});expect(()=>f.owner.acceptView('view-alias')).toThrow(/canonical|alias/);
  f.f.db.prepare('DELETE FROM pa_lifecycle_v1_total_assessments WHERE source_id=?').run(p.totals[0].sourceId);expect(()=>f.owner.acceptTotalSet(p.totals.map(s=>s.sourceId))).toThrow(/missing|partial|claim/);expect(f.f.db.prepare('SELECT count(*) n FROM pa_lifecycle_v1_total_assessments').get()!.n).toBe(9);
});
it('LO03 duplicate accepted assessment authority rejects before the first TOTAL effect',()=>{
  const f=fixture(),prefix=f.prefix(),totals=f.totals(prefix).map(s=>({...s,provenance:{...s.provenance,assessmentSourceId:'one-ambiguous-assessment'}}));totals.forEach(s=>f.sources.set(s.sourceId,s));
  expect(()=>f.owner.acceptTotalSet(totals.map(s=>s.sourceId))).toThrow(/duplicated|provenance/);expect(f.f.db.prepare('SELECT count(*) n FROM pa_lifecycle_v1_total_assessments').get()!.n).toBe(0);
  expect(json(f.owner.readPrefix(prefix.source.sourceId))).toBe(json(prefix));
});
it('LO04 current complete coverage rejects an additional typed-discovered work claim while historical view remains readable',()=>{
  const f=fixture(),p=f.prepare(),view=f.owner.acceptView(p.view.sourceId);if(view.kind!=='same_pa_lifecycle_view')throw new Error('view pending');
  vi.mocked(claims.readSamePaContinuationClaimRows).mockReturnValue([{table:'pa_physical_v1_cuts',row:{source_id:'surviving-typed-cut',source_hash:hash('extra-source'),snapshot_hash:hash('extra-result')}}]);
  const before=f.f.db.prepare('SELECT total_changes() n').get()!.n;
  expect(()=>withSqliteReadTransaction(f.f.db,()=>readCurrentSamePaLifecycleViewFromSqlite(f.f.db,reference('pa_lifecycle_v1_execution_views',view)))).toThrow(/coverage/);
  expect(f.owner.readView(p.view.sourceId)).toEqual(view);expect(f.f.db.prepare('SELECT total_changes() n').get()!.n).toBe(before);
});
it('LO05 completed assessment ownership stays within its original source, assessment and mutation epoch',()=>{
  const f=fixture(),p=f.prepare(),db=f.f.db,source=p.totals[0],prepare=db.prepare.bind(db);let scans=0;
  vi.spyOn(db,'prepare').mockImplementation(sql=>{
    const statement=prepare(sql);
    if(sql.startsWith('SELECT source_id FROM main.pa_lifecycle_v1_total_assessments WHERE source_id=$id')){
      const all=statement.all.bind(statement);statement.all=(...args)=>{scans++;return Reflect.apply(all,statement,args);};
    }
    return statement;
  });
  const read=()=>deriveCurrentSamePaLifecycleFromSqlite(db,source);
  const proof=<T>(body:()=>T)=>withSqliteReadTransaction(db,()=>original.withSamePaContinuationReadPhase(db,body));
  proof(()=>{
    const first=withSamePaLifecycleReadPhase(db,read),count=scans;expect(count).toBeGreaterThan(0);
    expect(withSamePaLifecycleReadPhase(db,read)).toEqual(first);expect(scans).toBe(count);
  });
  const before=scans;proof(read);expect(scans).toBeGreaterThan(before);
  for(const changed of [{...source,sourceId:'alias'}, {...source,provenance:p.totals[1].provenance}]){
    expect(()=>proof(()=>{read();deriveCurrentSamePaLifecycleFromSqlite(db,changed);})).toThrow(/assessment|claimed/);
  }
  const alias={...p.totals[1],provenance:source.provenance};
  const mutate=()=>db.prepare('UPDATE pa_lifecycle_v1_total_assessments SET source_json=? WHERE source_id=?').run(json(alias),alias.sourceId);
  expect(()=>proof(()=>{
    read();db.exec('PRAGMA query_only=0');mutate();db.exec('PRAGMA query_only=1');
    expect(read).toThrow();expect(read).toThrow(/expired/);
  })).toThrow(/expired/);
  expect(()=>proof(read)).not.toThrow();mutate();expect(()=>proof(read)).toThrow(/assessment|claimed/);
});
