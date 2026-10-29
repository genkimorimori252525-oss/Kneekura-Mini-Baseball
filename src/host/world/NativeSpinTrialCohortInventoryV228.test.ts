import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { readNativeSpinTrialCohortInventoryV228, readNativeSpinTrialCohortSnapshotV228 } from './NativeSpinTrialCohortInventoryV228';
import { hashScopedSpinAimMembersV228 } from './SpinAimQualificationV228';
const {DatabaseSync,constants}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const h='a'.repeat(64),ref=<T extends string>(owner:T,id:string)=>({owner,sourceId:id,sourceHash:h,snapshotHash:h});
const domain={version:'spin_aim_domain_v228',bindingReference:ref('world_spin_motion_bindings_v225','binding'),modelReference:ref('world_player_batting_models','model'),profile:{profileId:'course',version:'v1'},
 coordinateSystem:'NATIVE_RBOX_METERS_V1',transform:'PLATE_XY_TRANSLATION_V1',handedness:'R',plateZ:0,ticksPerSecond:1000000,geometry:{centerOfMass:{x:0,y:1,z:0},strikeZone:{centerX:0,halfWidth:.2,lowerY:.5,upperY:1.8}},
 targetPair:{anchor:{x:0,y:1,z:0},target:{x:0,y:1.02,z:0}},equipmentHash:h,forecastParametersHash:h,actualFlightParametersHash:h,observationMethod:'OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1',nominalObservationValuesHash:h,captureEffectiveValuesHash:h,deliveryEffectiveValuesHash:h,predictionParameterValuesHash:h,deliveryLatencyTicks:10000};
const source={version:'spin_aim_qualification_source_v228',sourceId:'qual',sourceVersion:'v1',subject:{careerId:'c',playerId:'p',personId:'person',technique:'TOPSPIN'},masteryReference:ref('world_spin_mastery_v123','mastery'),bindingReference:domain.bindingReference,domain,
 criterion:{version:'spin_aim_project_criterion_v228',authority:'PROJECT_DECLARED_NOT_HUMAN_CALIBRATED',minimumIndependentTrials:2,minimumDirectionalSpinRadPerSecond:10,minimumSuccessFraction:.5,miss:'COUNT_FAILURE',unresolved:'HOLD',unclassified:'HOLD'},
 cohort:{version:'closed_spin_trial_cohort_v228',start:{kind:'EARLIEST_AUTHENTIC_ELIGIBLE_AFTER_BINDING',worldRevision:1,commitmentReference:ref('pa_physical_v1_commitments','commit')},
  end:{kind:'WORLD_REVISION_AT_CLOSURE',worldRevision:1,worldEventHash:h,worldPrefixHash:h},members:[],scopedMemberHash:hashScopedSpinAimMembersV228([])}};
it('V228-I00 absent Native producer is unavailable, preserves caller q1 snapshot and does not create schema',()=>{
 const db=new DatabaseSync(':memory:');try{db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v228');const before=db.prepare('SELECT total_changes() n').get()!.n;db.setAuthorizer(code=>code===constants.SQLITE_ATTACH?constants.SQLITE_DENY:constants.SQLITE_OK);
  const inventory=readNativeSpinTrialCohortInventoryV228(db,source);expect(inventory.scopeComplete).toBe(false);expect(inventory.members).toEqual([]);
  expect(db.prepare('SELECT total_changes() n').get()!.n).toBe(before);expect(db.isTransaction).toBe(true);expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(1);
  expect(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied")).toThrow(/not authorized/);db.exec('ROLLBACK TO caller_v228; RELEASE caller_v228');expect(db.isTransaction).toBe(true);db.setAuthorizer(null);db.exec('ROLLBACK')}
 finally{db.setAuthorizer(null);if(db.isTransaction)db.exec('ROLLBACK');db.close()}
});

import { afterEach, vi } from 'vitest';
import * as storage from './SamePlateAppearancePhysicalEpisodeStorage';
import * as claimsOwner from './SamePlateAppearanceLifecycleClaimGuard';
import * as physical from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import * as trialOwner from './NativeSpinTrialMotorEvidenceV227';
import * as bindingOwner from './SqliteSpinMotionBindingV225';
import * as masteryOwner from './SqliteSpinControlMasteryV123';
import * as perception from './SqliteBattingPerceptionStore';
import * as worldOwner from './EmotionWorldRevisionFromSqlite';
import * as lifecycle from './SamePlateAppearanceLifecycleFromSqlite';
import { hashSpinAimDomainValueV228 } from './SpinAimQualificationV228';
afterEach(()=>vi.restoreAllMocks());
it('V228-I01 enumerates unresolved and miss before filtering future revision (stub Owner boundary)',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE world_decision_revision_events(career_id TEXT,world_revision INTEGER,source_kind TEXT,source_event_id TEXT,event_json TEXT)');
  const insert=db.prepare('INSERT INTO world_decision_revision_events VALUES(?,?,?,?,?)');for(let i=1;i<=9;i++)insert.run('c',i,'test','event-'+i,'{}');
  const nominal={calibration:{sensitivity:1}},captureValues={calibration:{sensitivity:1}},deliveryValues={calibration:{decay:.5}},predictionValues={algorithm:'observed'},member={playerId:'p'};
  const binding:any={source:{sourceId:'binding',careerId:'c',playerId:'p',technique:'TOPSPIN',masteryReference:source.masteryReference},observations:[{model:{equipment:{values:{mass:1}},observationCalibration:{values:nominal},predictionCalibration:{values:predictionValues}}}]},
   bindingRef=bindingOwner.spinMotionBindingReferenceV225(binding),forecast={gravityY:-9.81},actual={gravityY:-9.81},equipment=binding.observations[0].model.equipment.values,
   d={...domain,bindingReference:bindingRef,equipmentHash:hashSpinAimDomainValueV228(equipment),forecastParametersHash:hashSpinAimDomainValueV228(forecast),actualFlightParametersHash:hashSpinAimDomainValueV228(actual),
    nominalObservationValuesHash:hashSpinAimDomainValueV228(nominal),captureEffectiveValuesHash:hashSpinAimDomainValueV228(captureValues),deliveryEffectiveValuesHash:hashSpinAimDomainValueV228(deliveryValues),predictionParameterValuesHash:hashSpinAimDomainValueV228(predictionValues)},
   s={...source,bindingReference:bindingRef,domain:d,cohort:{...source.cohort,start:{...source.cohort.start,worldRevision:5},end:{...source.cohort.end,worldRevision:7}}},
   actor={binding:{careerId:'c',playerId:'p',personId:'person'}};
  const mkCommit=(id:string,revision:number)=>({kind:'same_pa_physical_commitment_v1',afterWorldRevision:revision,source:{capability:'same_pa_physical_observed_spin_aim_trial_v226',inputReference:ref('batting_execution_v1_inputs','input-'+id),trial:{bindingReference:bindingRef}},
   calculation:{algorithm:'batting-observed-spin-aim-trial-v226',trialContext:{selectedProfile:d.profile,trace:{coordinateSystem:d.coordinateSystem},transform:d.transform,pair:d.targetPair}},
   trialEvidenceV226:{masteryReference:source.masteryReference,modelReference:d.modelReference,currentGeometry:{handedness:'R',plateZ:0,ticksPerSecond:1000000,...d.geometry},forecastParameters:forecast,actualFlightParameters:actual,
    observationReference:ref('batting_observation_v1_observations','capture-'+id),deliveryReference:ref('batting_observation_v1_deliveries','delivery-'+id),predictionReference:ref('batting_prediction_v1_predictions','prediction-'+id),observedTick:100,availableTick:10100}});
  const records:any={c1:mkCommit('1',5),c2:mkCommit('2',7),c3:mkCommit('3',9),foreign:mkCommit('4',6),differentDomain:mkCommit('5',6)},rows:any[]=['c1','c2','c3','foreign','differentDomain'].map(id=>({table:'pa_physical_v1_commitments',row:{source_id:id,source_hash:h,snapshot_hash:h,source_json:JSON.stringify({capability:'same_pa_physical_observed_spin_aim_trial_v226'})}}));
  records.differentDomain.trialEvidenceV226.actualFlightParameters={gravityY:-1};
  rows.push({table:'pa_physical_v1_resolutions',row:{source_id:'r2',source_hash:h,snapshot_hash:h,source_json:JSON.stringify({commitmentReference:ref('pa_physical_v1_commitments','c2')})}});
  vi.spyOn(storage,'assertSamePaPhysicalEpisodeStorage').mockReturnValue(true);vi.spyOn(worldOwner,'readEmotionWorldRevisionFromSqlite').mockReturnValue({head:{worldRevision:9}} as never);
  vi.spyOn(worldOwner,'readHistoricalEmotionWorldRevisionFromSqlite').mockReturnValue({head:{worldRevision:7}} as never);
  vi.spyOn(bindingOwner,'readNativeSpinMotionBindingV225').mockReturnValue(binding);vi.spyOn(masteryOwner,'readNativeSpinControlMasteryV123').mockReturnValue({person:{personId:'person'}} as never);
  vi.spyOn(claimsOwner,'readSamePaLifecycleClaimRows').mockReturnValue(rows);
  const reader=vi.spyOn(physical,'readSamePaPhysicalOperationFromSqlite').mockImplementation((_db,r)=>({actor:r.sourceId==='foreign'?{binding:{careerId:'c',playerId:'other',personId:'other'}}:actor,record:r.owner==='pa_physical_v1_resolutions'?{kind:'same_pa_physical_resolution_v1',source:{commitmentReference:ref('pa_physical_v1_commitments','c2')}}:records[r.sourceId],physicalPitchReference:ref('pa_physical_v1_launches','pitch-'+r.sourceId)} as never));
  vi.spyOn(perception,'readBattingPerceptionFromSqlite').mockImplementation((_db,kind,r)=>{const id=r.sourceId.split('-').at(-1)!,view=ref('pa_lifecycle_v1_execution_views','view-'+id);
   if(kind==='observation')return {kind:'batting_observation',source:{capability:'owned_in_flight_batting_observation_v1',calibrationReference:ref('pa_lifecycle_v1_execution_calibrations','capture-cal-'+id),viewReference:view,member},calculation:{nominalValues:nominal,effectiveValues:captureValues}} as never;
   if(kind==='delivery')return {kind:'batting_observation_delivery',source:{capability:'owned_in_flight_batting_observation_delivery_v1',calibrationReference:ref('pa_lifecycle_v1_execution_calibrations','delivery-cal-'+id),viewReference:view,member}} as never;
   return {kind:'batting_observed_prediction',source:{capability:'owned_in_flight_batting_observed_prediction_v1'}} as never;});
  vi.spyOn(lifecycle,'readSamePaLifecycleCalibrationFromSqlite').mockImplementation((_db,r)=>{const id=r.sourceId.split('-').at(-1)!;return {source:{route:'batter_observation',response:{kind:'accepted_execution_values_v1',values:r.sourceId.startsWith('capture-')?captureValues:deliveryValues},member,viewReference:ref('pa_lifecycle_v1_execution_views','view-'+id),nominalReference:d.modelReference}} as never});
  vi.spyOn(trialOwner,'readNativeSpinTrialMotorEvidenceV227').mockImplementation((_db,_r)=>{const pitch=ref('pa_physical_v1_launches','pitch-c2');return {commitmentReference:ref('pa_physical_v1_commitments','c2'),
   independenceKey:{policy:'ONE_PER_PHYSICAL_PITCH',careerId:'c',playerId:'p',personId:'person',physicalPitchOwner:pitch.owner,physicalPitchSourceId:pitch.sourceId},
   provenance:{physicalPitchReference:pitch,inputReference:records.c2.source.inputReference},hasActualContact:false,spinObservation:null} as never});
  db.exec('PRAGMA query_only=1; BEGIN');const result=readNativeSpinTrialCohortInventoryV228(db,s);expect(result.scopeComplete).toBe(true);expect(result.firstEligibleWorldRevision).toBe(5);
  expect(result.members.map(m=>m.outcome)).toEqual(['UNRESOLVED','MISS']);expect(reader).toHaveBeenCalledTimes(6);
  const scope={subject:s.subject,masteryReference:s.masteryReference,bindingReference:s.bindingReference,domain:s.domain,endWorldRevision:7};
  expect(readNativeSpinTrialCohortSnapshotV228(db,scope)).toEqual(result);
  const {criterion:_criterion,...withoutCriterion}=s;expect(()=>readNativeSpinTrialCohortInventoryV228(db,withoutCriterion)).toThrow();
  expect(()=>readNativeSpinTrialCohortSnapshotV228(db,{...scope,endWorldRevision:-1})).toThrow();expect(result.currentWorldRevision).toBe(9);
  expect(result.members.map(m=>m.observationProvenance.captureCalibrationReference.sourceId)).toEqual(['capture-cal-1','capture-cal-2']);
  expect(result.members.map(m=>m.observationProvenance.deliveryCalibrationReference.sourceId)).toEqual(['delivery-cal-1','delivery-cal-2']);
  rows.push({table:'pa_physical_v1_resolutions',row:{source_id:'r2-duplicate',source_hash:h,snapshot_hash:h,source_json:JSON.stringify({commitmentReference:ref('pa_physical_v1_commitments','c2')})}});
  expect(readNativeSpinTrialCohortInventoryV228(db,s).scopeComplete).toBe(false);rows.pop();
  rows.push({table:'pa_physical_v1_commitments',row:{source_id:'concealed',source_hash:h,snapshot_hash:h,source_json:JSON.stringify({capability:'same_pa_physical_commitment_v1'})}});
  reader.mockImplementation((_db,r)=>{if(r.sourceId==='concealed')throw Error('normal Owner detects mismatched snapshot');return {actor:r.sourceId==='foreign'?{binding:{careerId:'c',playerId:'other',personId:'other'}}:actor,record:r.owner==='pa_physical_v1_resolutions'?{kind:'same_pa_physical_resolution_v1',source:{commitmentReference:ref('pa_physical_v1_commitments','c2')}}:records[r.sourceId],physicalPitchReference:ref('pa_physical_v1_launches','pitch-'+r.sourceId)} as never});
  expect(()=>readNativeSpinTrialCohortInventoryV228(db,s)).toThrow(/normal Owner detects/);db.exec('ROLLBACK');
 }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close()}
});

it('V228-I02 different per-pitch calibration refs with identical values share a domain; changed values do not (stub)',async()=>{
 const {deriveSpinTrialDomainFromRecordsV228}=await import('./NativeSpinTrialCohortInventoryV228');
 const mk=(suffix:string,change=false)=>{
  const modelRef=ref('world_player_batting_models','model'),bindingRef=ref('world_spin_motion_bindings_v225','binding'),captureRef=ref('batting_observation_v1_observations','capture-'+suffix),deliveryRef=ref('batting_observation_v1_deliveries','delivery-'+suffix),predictionRef=ref('batting_prediction_v1_predictions','prediction-'+suffix),
   captureCal=ref('pa_lifecycle_v1_execution_calibrations','capture-cal-'+suffix),deliveryCal=ref('pa_lifecycle_v1_execution_calibrations','delivery-cal-'+suffix),
   view=ref('pa_lifecycle_v1_execution_views','view-'+suffix),member={playerId:'p'},nominal={calibration:{sensitivity:1}},captureValues={calibration:{sensitivity:change?2:1}},deliveryValues={calibration:{decay:.5}},predictionValues={algorithm:'observed'},equipment={mass:1};
  const binding:any={observations:[{model:{equipment:{values:equipment},observationCalibration:{values:nominal},predictionCalibration:{values:predictionValues}}}]};
  const record:any={kind:'same_pa_physical_commitment_v1',source:{capability:'same_pa_physical_observed_spin_aim_trial_v226',trial:{bindingReference:bindingRef}},
   calculation:{algorithm:'batting-observed-spin-aim-trial-v226',trialContext:{selectedProfile:domain.profile,trace:{coordinateSystem:domain.coordinateSystem},transform:domain.transform,pair:domain.targetPair}},
   trialEvidenceV226:{modelReference:modelRef,currentGeometry:{handedness:'R',plateZ:0,ticksPerSecond:1000000,...domain.geometry},forecastParameters:{gravityY:-9.81},actualFlightParameters:{gravityY:-9.81},
    observationReference:captureRef,deliveryReference:deliveryRef,predictionReference:predictionRef,observedTick:100,availableTick:10100}};
  const capture:any={kind:'batting_observation',source:{capability:'owned_in_flight_batting_observation_v1',calibrationReference:captureCal,viewReference:view,member},calculation:{nominalValues:nominal,effectiveValues:captureValues}},
   delivery:any={kind:'batting_observation_delivery',source:{capability:'owned_in_flight_batting_observation_delivery_v1',calibrationReference:deliveryCal,viewReference:view,member}},
   prediction:any={kind:'batting_observed_prediction',source:{capability:'owned_in_flight_batting_observed_prediction_v1'}},
   cal=(values:unknown)=>({source:{route:'batter_observation',response:{kind:'accepted_execution_values_v1',values},member,viewReference:view,nominalReference:modelRef}});
  return deriveSpinTrialDomainFromRecordsV228(record,binding,capture,delivery,prediction,cal(captureValues) as never,cal(deliveryValues) as never);
 };
 const a=mk('a'),b=mk('b'),c=mk('c',true);expect(a.domain).toEqual(b.domain);expect(a.provenance.captureCalibrationReference).not.toEqual(b.provenance.captureCalibrationReference);
 expect(JSON.stringify(a.domain)).not.toContain('capture-cal-');expect(JSON.stringify(a.domain)).not.toContain('delivery-cal-');
 expect(a.domain.captureEffectiveValuesHash).not.toBe(c.domain.captureEffectiveValuesHash);
});
