import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { hashScopedSpinAimMembersV228 } from './SpinAimQualificationV228';
import * as inventoryOwner from './NativeSpinTrialCohortInventoryV228';
import { openSqliteSpinAimQualificationV230, readNativeSpinAimQualificationV230 } from './SqliteSpinAimQualificationV230';
const h='a'.repeat(64),ref=<T extends string>(owner:T,id:string)=>({owner,sourceId:id,sourceHash:h,snapshotHash:h});
const domain={version:'spin_aim_domain_v228',bindingReference:ref('world_spin_motion_bindings_v225','binding'),modelReference:ref('world_player_batting_models','model'),
 profile:{profileId:'course',version:'v1'},coordinateSystem:'NATIVE_RBOX_METERS_V1',transform:'PLATE_XY_TRANSLATION_V1',handedness:'R',plateZ:0,ticksPerSecond:1000000,
 geometry:{centerOfMass:{x:0,y:1,z:0},strikeZone:{centerX:0,halfWidth:.2,lowerY:.5,upperY:1.8}},targetPair:{anchor:{x:0,y:1,z:0},target:{x:0,y:1.02,z:0}},
 equipmentHash:h,forecastParametersHash:h,actualFlightParametersHash:h,observationMethod:'OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1',nominalObservationValuesHash:h,captureEffectiveValuesHash:h,deliveryEffectiveValuesHash:h,predictionParameterValuesHash:h,deliveryLatencyTicks:10000};
const criterion={version:'spin_aim_project_criterion_v228',authority:'PROJECT_DECLARED_NOT_HUMAN_CALIBRATED',minimumIndependentTrials:2,minimumDirectionalSpinRadPerSecond:10,minimumSuccessFraction:.5,miss:'COUNT_FAILURE',unresolved:'HOLD',unclassified:'HOLD'};
const key=(id:string)=>({policy:'ONE_PER_PHYSICAL_PITCH' as const,careerId:'c',playerId:'p',personId:'person',physicalPitchOwner:'pa_physical_v1_launches' as const,physicalPitchSourceId:id});
const member=(id:string,rev:number,outcome:'CONTACT'|'MISS'|'UNRESOLVED')=>({commitmentReference:ref('pa_physical_v1_commitments','c'+id),resolutionReference:outcome==='UNRESOLVED'?null:ref('pa_physical_v1_resolutions','r'+id),worldRevision:rev,
 identity:key(id),physicalPitchReference:ref('pa_physical_v1_launches',id),inputReference:ref('batting_execution_v1_inputs','i'+id),observationProvenance:{captureReference:ref('batting_observation_v1_observations','o'+id),deliveryReference:ref('batting_observation_v1_deliveries','d'+id),predictionReference:ref('batting_prediction_v1_predictions','p'+id),captureCalibrationReference:ref('pa_lifecycle_v1_execution_calibrations','cc'+id),deliveryCalibrationReference:ref('pa_lifecycle_v1_execution_calibrations','dc'+id)},outcome,directionalSpin:outcome==='CONTACT'?20:null});
const a=member('one',5,'CONTACT'),b=member('two',7,'MISS');
const sourceMember=(m:typeof a)=>{const {outcome:_outcome,directionalSpin:_spin,...r}=m;return r};
const source={version:'spin_aim_qualification_source_v228',sourceId:'qual',sourceVersion:'v1',subject:{careerId:'c',playerId:'p',personId:'person',technique:'TOPSPIN'},
 masteryReference:ref('world_spin_mastery_v123','mastery'),bindingReference:domain.bindingReference,domain,criterion,
 cohort:{version:'closed_spin_trial_cohort_v228',start:{kind:'EARLIEST_AUTHENTIC_ELIGIBLE_AFTER_BINDING',worldRevision:5,commitmentReference:a.commitmentReference},
  end:{kind:'WORLD_REVISION_AT_CLOSURE',worldRevision:7,worldEventHash:h,worldPrefixHash:h},members:[sourceMember(a),sourceMember(b)],scopedMemberHash:hashScopedSpinAimMembersV228([sourceMember(a),sourceMember(b)])}};

const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
afterEach(()=>vi.restoreAllMocks());
it('V230 accepts fixed evaluated Source, retries and permits future revisions (stub census)',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v230-')),path=join(dir,'test.sqlite');let current=7;
 const get=()=>({firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:current,members:[a,b],scopeComplete:true});
 vi.spyOn(inventoryOwner,'readNativeSpinTrialCohortInventoryV228').mockImplementation(()=>get());
 const owner=openSqliteSpinAimQualificationV230(path,{readAcceptedQualification:id=>id==='qual'?source as never:null});
 try{const initial=owner.accept('qual');expect(initial.applicable).toBe(true);expect(initial.snapshot!.evaluation.status).toBe('CRITERION_MET_ONLY');
  expect(owner.accept('qual')).toEqual(initial);current=8;expect(owner.read('qual')).toEqual(initial);
  const db=new DatabaseSync(path);try{db.exec('PRAGMA query_only=1; BEGIN');expect(readNativeSpinAimQualificationV230(db,'qual')).toEqual(initial);db.exec('ROLLBACK')}finally{db.close()}
 }finally{owner.close();rmSync(dir,{recursive:true,force:true})}
});
it('V230 prevents qualified status when current scoped members differ (stub census)',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v230-')),path=join(dir,'test.sqlite');let changed=false;
 vi.spyOn(inventoryOwner,'readNativeSpinTrialCohortInventoryV228').mockImplementation(()=>({firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,members:changed?[a]:[a,b],scopeComplete:true}));
 const owner=openSqliteSpinAimQualificationV230(path,{readAcceptedQualification:()=>source as never});try{owner.accept('qual');changed=true;const held=owner.read('qual');expect(held?.applicable).toBe(false);expect(held?.snapshot).toBeNull();expect(held?.snapshotReauthenticated).toBe(false);expect(held?.currentEvaluation.status).toBe('HOLD')}
 finally{owner.close();rmSync(dir,{recursive:true,force:true})}
});
it('V230 rolls back insert-time poison, preserves caller, rejects aliases and allows distinct domains (stub census)',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v230-')),path=join(dir,'test.sqlite');let poisoned=false;
 vi.spyOn(inventoryOwner,'readNativeSpinTrialCohortInventoryV228').mockImplementation(()=>({firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,members:poisoned?[a]:[a,b],scopeComplete:true}));
 const alt={...source,sourceId:'qual2',domain:{...source.domain,deliveryLatencyTicks:10001}},sources=new Map([['qual',source],['qual2',alt]]);
 const owner=openSqliteSpinAimQualificationV230(path,{readAcceptedQualification:id=>sources.get(id) as never??null});const db=new DatabaseSync(path);
 try{
  db.exec("CREATE TRIGGER fail_v230 BEFORE INSERT ON world_spin_aim_qualifications_v230 BEGIN SELECT RAISE(ABORT,'reject'); END");expect(()=>owner.accept('qual')).toThrow(/reject/);expect(owner.read('qual')).toBeNull();db.exec('DROP TRIGGER fail_v230');
  const first=owner.accept('qual'),second=owner.accept('qual2');expect(first.snapshot!.groupHash).not.toBe(second.snapshot!.groupHash);
  const refHash=first.snapshot!.groupHash;db.prepare('UPDATE world_spin_aim_qualifications_v230 SET group_hash=? WHERE source_id=?').run('bad','qual');expect(()=>owner.read('qual')).toThrow(/Source differs/);db.prepare('UPDATE world_spin_aim_qualifications_v230 SET group_hash=? WHERE source_id=?').run(refHash,'qual');
  db.prepare('UPDATE world_spin_aim_qualifications_v230 SET snapshot_hash=? WHERE source_id=?').run('bad','qual');expect(()=>owner.read('qual')).toThrow(/snapshot differs/);
  db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v230');const before=db.prepare('SELECT total_changes() n').get()!.n;expect(readNativeSpinAimQualificationV230(db,'missing')).toBeNull();expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(before);db.exec('ROLLBACK TO caller_v230; RELEASE caller_v230; ROLLBACK');
 }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close();owner.close();rmSync(dir,{recursive:true,force:true})}
});
it('V230 rederives after insert and rolls back when census changes (stub census)',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v230-')),path=join(dir,'test.sqlite');
 vi.spyOn(inventoryOwner,'readNativeSpinTrialCohortInventoryV228').mockImplementation(db=>{const count=Number(db.prepare('SELECT count(*) n FROM world_spin_aim_qualifications_v230').get()!.n);return {firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,members:count?[a]:[a,b],scopeComplete:true}});
 const owner=openSqliteSpinAimQualificationV230(path,{readAcceptedQualification:()=>source as never});try{expect(()=>owner.accept('qual')).toThrow(/owners changed/);expect(owner.read('qual')).toBeNull()}
 finally{owner.close();rmSync(dir,{recursive:true,force:true})}
});
it('V230 providerless reopen, source freeze and hidden identity alias (stub census)',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v230-')),path=join(dir,'test.sqlite');let offered=source;
 vi.spyOn(inventoryOwner,'readNativeSpinTrialCohortInventoryV228').mockReturnValue({firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,members:[a,b],scopeComplete:true});
 const owner=openSqliteSpinAimQualificationV230(path,{readAcceptedQualification:()=>offered as never});const initial=owner.accept('qual');offered={...source,sourceVersion:'other'};expect(()=>owner.accept('qual')).toThrow(/frozen/);owner.close();
 const offline=openSqliteSpinAimQualificationV230(path);const db=new DatabaseSync(path);try{expect(offline.read('qual')).toEqual(initial);db.prepare("UPDATE world_spin_aim_qualifications_v230 SET source_json=json_set(source_json,'$.sourceId','hidden') WHERE source_id='qual'").run();expect(()=>offline.read('hidden')).toThrow(/identity alias/)}
 finally{db.close();offline.close();rmSync(dir,{recursive:true,force:true})}
});
it('V230 preserves signed zero through stored Source and rederivation (stub census)',()=>{
 const dir=mkdtempSync(join(tmpdir(),'v230-')),path=join(dir,'test.sqlite'),zeroSource={...source,domain:{...source.domain,geometry:{...source.domain.geometry,centerOfMass:{...source.domain.geometry.centerOfMass,x:-0}}}};
 vi.spyOn(inventoryOwner,'readNativeSpinTrialCohortInventoryV228').mockReturnValue({firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,members:[a,b],scopeComplete:true});
 const owner=openSqliteSpinAimQualificationV230(path,{readAcceptedQualification:()=>zeroSource as never});try{const saved=owner.accept('qual');expect(Object.is(saved.snapshot!.source.domain.geometry.centerOfMass.x,-0)).toBe(true);expect(Object.is(owner.read('qual')!.snapshot!.source.domain.geometry.centerOfMass.x,-0)).toBe(true)}
 finally{owner.close();rmSync(dir,{recursive:true,force:true})}
});
it('V230 Native empty read leaves borrowed query-only transaction and authorizer intact',()=>{
 const db=new DatabaseSync(':memory:'),{constants}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
 try{db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller');db.setAuthorizer(code=>code===constants.SQLITE_ATTACH?constants.SQLITE_DENY:constants.SQLITE_OK);expect(readNativeSpinAimQualificationV230(db,'none')).toBeNull();expect(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied")).toThrow(/not authorized/);db.exec('ROLLBACK TO caller; RELEASE caller');expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1)}finally{db.setAuthorizer(null);if(db.isTransaction)db.exec('ROLLBACK');db.close()}
});
