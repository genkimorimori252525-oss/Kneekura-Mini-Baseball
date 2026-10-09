import {createRequire} from 'node:module';
import {describe,it,expect} from 'vitest';
import {samePaLifecycleSourceInput} from './SamePlateAppearanceLifecycle';
import {samePaLifecycleOutcomeInput} from './SamePlateAppearanceLifecycleOutcome';
import {samePaTerminalEndpointInput} from './SamePlateAppearanceTerminalEndpointFromSqlite';
import {samePaLifecycleSchema,assertSamePaLifecycleStorage} from './SamePlateAppearanceLifecycleStorage';
import {samePaTerminalSchema,assertSamePaTerminalEndpointStorage} from './SamePlateAppearanceTerminalStorage';
import {readSamePaLifecycleClaimRows} from './SamePlateAppearanceLifecycleClaimGuard';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
// Shape-only accepted fixture identities. They assert no normal-owner or physical qualification.
const r=(owner:string,sourceId=owner)=>({owner,sourceId,sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)});
const root=r('same_pa_enrollments'),base={sourceId:'fixture-source',sourceVersion:'explicit-shape-fixture-v1',enrollmentReference:root};
describe('same-PA repeated lifecycle Source and namespace boundaries',()=>{
  it('LP01 requires an explicit ordered work prefix and exact ten distinct assessments',()=>{
    const p={...base,capability:'same_pa_lifecycle_prefix_v1',anchorViewReference:r('pa_continuation_v1_execution_views'),eventReferences:[r('pa_take_successor_v1_pitch_actions')]};
    expect(samePaLifecycleSourceInput(p)).toEqual(p);expect(()=>samePaLifecycleSourceInput({...p,eventReferences:[]})).toThrow();expect(()=>samePaLifecycleSourceInput({...p,eventReferences:[...p.eventReferences,...p.eventReferences]})).toThrow();
    const v={...base,capability:'same_pa_lifecycle_cumulative_view_v1',prefixReference:r('pa_lifecycle_v1_work_prefixes'),participantTotalReferences:Array.from({length:10},(_,i)=>({playerId:'fixture-'+i,assessmentReference:r('pa_lifecycle_v1_total_assessments','fixture-total-'+i)}))};
    expect(samePaLifecycleSourceInput(v)).toEqual(v);expect(()=>samePaLifecycleSourceInput({...v,participantTotalReferences:v.participantTotalReferences.slice(1)})).toThrow();
    expect(()=>samePaLifecycleSourceInput({...v,participantTotalReferences:v.participantTotalReferences.map(x=>({...x,assessmentReference:v.participantTotalReferences[0].assessmentReference}))})).toThrow();
  });
  it('LP02 does not invent a missing effort or provenance declaration',()=>{
    const total={...base,capability:'same_pa_lifecycle_cumulative_total_v1',prefixReference:r('pa_lifecycle_v1_work_prefixes'),participantReference:{playerId:'fixture-batter',bindingHash:'a'.repeat(64),personHash:'a'.repeat(64),baselineSourceId:'explicit-fixture-baseline',revision:0,stateHash:'a'.repeat(64)},effortUnits:0,
      provenance:{assessmentSourceId:'explicit-fixture-zero',assessmentVersion:'v1',calibrationSourceId:'explicit-fixture-calibration',calibrationVersion:'v1'}};
    expect(samePaLifecycleSourceInput(total)).toEqual(total);const {effortUnits:_,...absent}=total;expect(()=>samePaLifecycleSourceInput(absent)).toThrow();expect(()=>samePaLifecycleSourceInput({...total,provenance:{}})).toThrow();
  });
  it('LP03 requires original official authority and explicit reset geometry',()=>{
    const out={...base,capability:'same_pa_lifecycle_outcome_v1',viewReference:r('pa_lifecycle_v1_execution_views'),physicalOperationReference:r('pa_physical_v1_resolutions'),kind:'count_terminal',rulePolicy:null,officialPolicy:null,
      official:{assignment:{sourceId:'assignment',sourceVersion:'v1',gameId:'game',playId:8,physicalPitchSourceId:'pitch',officialIds:['umpire'],schedulerId:'scheduler'},call:{sourceId:'call',sourceVersion:'v1',assignmentSourceId:'assignment',officialId:'umpire',judgment:'count_result'},events:[{sourceId:'fence',sourceVersion:'v1',schedulerId:'scheduler',kind:'next_pitch_fence'}]}};
    expect(samePaLifecycleOutcomeInput(out)).toEqual(out);expect(()=>samePaLifecycleOutcomeInput({...out,official:{...out.official,call:null}})).toThrow();expect(()=>samePaLifecycleOutcomeInput({...out,kind:'untouched_foul'})).toThrow();
    expect(()=>samePaLifecycleOutcomeInput({...base,capability:'same_pa_lifecycle_reset_v1',viewReference:out.viewReference,outcomeReference:r('pa_lifecycle_v1_outcomes'),controllerReset:'rule_system_retire_same_pa_episode_v1',nextStartedAtTick:1})).toThrow();
  });
  it('LP04 endpoint accepts original references only',()=>{
    const e={...base,capability:'same_pa_terminal_endpoint_v1',finalViewReference:r('pa_lifecycle_v1_execution_views'),outcomeReference:r('pa_lifecycle_v1_outcomes')};
    expect(samePaTerminalEndpointInput(e)).toEqual(e);expect(()=>samePaTerminalEndpointInput({...e,participants:[]})).toThrow();expect(()=>samePaTerminalEndpointInput({...e,finalViewReference:r('pa_continuation_v1_execution_views')})).toThrow();
  });
  it('LP05 opening pristine reads installs nothing and partial/aliased namespaces reject',()=>{
    const db=new DatabaseSync(':memory:');try{expect(assertSamePaLifecycleStorage(db)).toBe(false);expect(assertSamePaTerminalEndpointStorage(db)).toBe(false);expect(db.prepare('SELECT count(*) n FROM sqlite_master').get()!.n).toBe(0);
      db.exec(samePaLifecycleSchema.pa_lifecycle_v1_work_prefixes);expect(()=>assertSamePaLifecycleStorage(db)).toThrow();}finally{db.close();}
    const alias=new DatabaseSync(':memory:');try{alias.exec('CREATE TABLE PA_LIFECYCLE_V1_FOREIGN(id TEXT)');expect(()=>assertSamePaLifecycleStorage(alias)).toThrow();}finally{alias.close();}
  });
  it('LP06 exact storage rejects views, triggers and temp shadows',()=>{
    for(const extra of ['CREATE TEMP TABLE pa_lifecycle_v1_execution_views(id TEXT)','CREATE TRIGGER pa_lifecycle_v1_fake AFTER INSERT ON pa_lifecycle_v1_work_prefixes BEGIN SELECT 1; END']){
      const db=new DatabaseSync(':memory:');try{Object.values(samePaLifecycleSchema).forEach(ddl=>db.exec(ddl));expect(assertSamePaLifecycleStorage(db)).toBe(true);db.exec(extra);expect(()=>assertSamePaLifecycleStorage(db)).toThrow();}finally{db.close();}}
    const db=new DatabaseSync(':memory:');try{Object.values(samePaTerminalSchema).forEach(ddl=>db.exec(ddl));expect(assertSamePaTerminalEndpointStorage(db)).toBe(true);db.exec('CREATE VIEW pa_terminal_v1_alias AS SELECT * FROM pa_terminal_v1_endpoints');expect(()=>assertSamePaTerminalEndpointStorage(db)).toThrow();}finally{db.close();}
  });
  it('LP07 surviving orphan physical/lifecycle namespaces cannot disappear behind an absent root',()=>{
    const db=new DatabaseSync(':memory:');try{expect(readSamePaLifecycleClaimRows(db)).toEqual([]);db.exec('CREATE TABLE pa_physical_v1_heads(enrollment_source_id TEXT)');expect(()=>readSamePaLifecycleClaimRows(db)).toThrow();}finally{db.close();}
  });
});
