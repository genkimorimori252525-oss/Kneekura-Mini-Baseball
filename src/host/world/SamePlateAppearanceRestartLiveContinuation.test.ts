import { afterEach,expect,it,vi } from 'vitest';
import { createRequire } from 'node:module';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { restartFixture } from './SamePlateAppearanceRestartPlay.test-support';
import { readSamePaInitialLiveContinuationFromSqlite as read } from './SamePlateAppearanceInitialLiveContinuationFromSqlite';
import * as lifecycle from './SamePlateAppearanceLifecycleFromSqlite';
import * as physical from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import * as original from './SamePlateAppearanceContinuationFromSqlite';
import * as take from './SamePlateAppearanceTakeSuccessorFromSqlite';
import * as restart from './SqliteSamePlateAppearanceRestartPlayStore';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).forEach(f=>f());vi.restoreAllMocks();});
const ref=(owner:string,sourceId=owner)=>({owner,sourceId,sourceHash:hash(sourceId),snapshotHash:hash(sourceId)}) as any;
/** Reader assembly boundary: real restart geometry and release binding, with
 * existing physical/lifecycle readers isolated from their long Native fixtures. */
const fixture=()=>{
  const f=restartFixture(),play=f.derive(),db=new DatabaseSync(':memory:');cleanups.push(()=>db.close());
  const anchor=ref('pa_take_successor_v1_pitch_actions'),oldLaunch=ref('pa_physical_v1_launches','old'),oldField=ref('pa_physical_v1_field_roots','old-field');
  const resetPrefix:any={kind:'same_pa_lifecycle_prefix',source:{sourceId:'reset-prefix',sourceVersion:'test-v1',eventReferences:[anchor,oldLaunch,oldField,f.reset.source.outcomeReference,f.source.resetReference]},coverageHash:hash('reset-coverage')};
  const acceptedPlay={...play,prefixReference:reference('pa_lifecycle_v1_work_prefixes',resetPrefix)};
  const right:any={source:{sourceId:'right',sourceVersion:'test-v1',actionReference:f.source.actionReference,postureReference:f.source.postureReference},lineage:play.lineage};
  const release={releaseAtUs:1000,position:{x:1,y:1.6,z:17},velocity:{x:2,y:0,z:-30},spin:{x:0,y:100,z:0}};
  const launch:any={kind:'same_pa_physical_launch_v1',source:{sourceId:'next-pitch',sourceVersion:'test-v1',actionReference:f.source.actionReference,viewReference:f.source.viewReference,rightReference:reference('pa_physical_v1_rights',right)},lineage:play.lineage,
    delivery:{timeline:{readyAtUs:100,releaseUs:1000},release},trajectory:{start:{tick:1000,position:release.position,velocity:release.velocity,spin:release.spin},parameters:{ticksPerSecond:1_000_000}}};
  const launchRef=reference('pa_physical_v1_launches',launch),fieldRef=ref('pa_physical_v1_field_roots','new-field');
  const prefix:any={kind:'same_pa_lifecycle_prefix',source:{sourceId:'current-prefix',sourceVersion:'test-v1',eventReferences:[...resetPrefix.source.eventReferences,launchRef,fieldRef]},coverageHash:hash('current-coverage')};
  const current:any={...f.b,view:{...f.b.view,source:{...f.b.view.source,sourceId:'current-view',prefixReference:reference('pa_lifecycle_v1_work_prefixes',prefix)},
    cut:{...f.b.view.cut,stage:'field_active',physicalPitchReference:launchRef,physicalOperationReference:fieldRef,evaluationTick:2000}}};
  const first:any={lineage:play.lineage,result:{resolution:{kind:'recorded',physical:{kind:'taken'},timeline:{status:{kind:'active'}}}}};
  const second:any={pitch:{...first,previousPitchReference:ref('pa_dispatch_v1_pitch_actions')},action:{source:{sourceId:'second-action'}},setup:{source:{sourceId:'second-setup'}}};
  vi.spyOn(lifecycle,'readCurrentSamePaLifecycleViewFromSqlite').mockReturnValue(current);
  vi.spyOn(lifecycle,'readHistoricalSamePaLifecycleViewFromSqlite').mockReturnValue(current);
  vi.spyOn(lifecycle,'readSamePaLifecycleRecordFromSqlite').mockImplementation((_db,_kind,id)=>(id==='reset-prefix'?resetPrefix:prefix));
  vi.spyOn(original,'readSamePaContinuationOriginalPitchFromSqlite').mockReturnValue({pitch:first} as any);
  vi.spyOn(take,'readSamePaSuccessorTakePitchFromSqlite').mockReturnValue(second);
  vi.spyOn(physical,'readSamePaPhysicalOperationFromSqlite').mockImplementation((_db,r)=>({lineage:play.lineage,record:r.sourceId==='next-pitch'?launch:
    {kind:r.owner==='pa_physical_v1_launches'?'same_pa_physical_launch_v1':'same_pa_physical_field_root_v1',source:{sourceId:r.sourceId}}}) as any);
  const plays=vi.spyOn(restart,'readSamePaRestartPlaysFromSqlite').mockReturnValue([acceptedPlay]);
  db.exec('CREATE TABLE pa_physical_v1_rights(source_id TEXT,snapshot_json TEXT)');db.prepare('INSERT INTO pa_physical_v1_rights VALUES(?,?)').run('right',JSON.stringify(right));
  return{...f,db,play:acceptedPlay,launch,current,prefix,resetPrefix,first,plays,run:()=>{db.exec('BEGIN');db.exec('PRAGMA query_only=1');try{return read(db,reference('pa_lifecycle_v1_execution_views',current.view),'historical');}finally{db.exec('ROLLBACK');db.exec('PRAGMA query_only=0');}}};
};
it('connects legacy first pitch through original foul/reset Play into later actual launch and complete history',()=>{
  const f=fixture(),value=f.run();expect(value?.kind).toBe('same_pa_restart_live_continuation_v1');
  if(value?.kind!=='same_pa_restart_live_continuation_v1')throw new Error('restart missing');
  expect(value.occurredAt.tick).toBe(100);expect(value.restartBinding.release.releaseAtUs).toBe(1000);expect(value.coveredThroughTick).toBe(2000);
  expect(value.transitionReferences.slice(3)).toEqual(f.prefix.source.eventReferences);expect(value.restartReferences).toEqual([reference('pa_restart_play_v1_actions',f.play)]);
  expect(f.plays).toHaveBeenCalledWith(f.db,f.play.lineage.enrollmentReference,[f.source.resetReference]);
});
it('keeps legacy no-owner archives null through both reset and pre-field cuts',()=>{
  const f=fixture();f.plays.mockReturnValue([]);expect(f.run()).toBeNull();f.current.view.cut.stage='foul_reset_ready';expect(f.run()).toBeNull();
});
it('keeps explicit initial Play pending when the required restart is absent',()=>{
  const f=fixture();f.plays.mockReturnValue([]);f.first.initialLiveBallBinding={kind:'same_pa_initial_pitch_live_binding_v1'};
  expect(f.run()).toEqual({kind:'pending',reason:'initial_live_continuation_after_official_outcome_requires_original_restart'});
});
it('rejects a saved restart pinned to a different completed prefix',()=>{
  const f=fixture();f.resetPrefix.source.eventReferences=f.resetPrefix.source.eventReferences.slice(1);expect(()=>f.run()).toThrow();
});
