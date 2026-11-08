import { expect, it } from 'vitest';
const h='a'.repeat(64),ref=<T extends string>(owner:T,id:string)=>({owner,sourceId:id,sourceHash:h,snapshotHash:h});
const domain={version:'spin_aim_domain_v228',bindingReference:ref('world_spin_motion_bindings_v225','binding'),modelReference:ref('world_player_batting_models','model'),profile:{profileId:'course',version:'v1'},
 coordinateSystem:'NATIVE_RBOX_METERS_V1',transform:'PLATE_XY_TRANSLATION_V1',handedness:'R',plateZ:0,ticksPerSecond:1000000,geometry:{centerOfMass:{x:0,y:1,z:0},strikeZone:{centerX:0,halfWidth:.2,lowerY:.5,upperY:1.8}},
 targetPair:{anchor:{x:0,y:1,z:0},target:{x:0,y:1.02,z:0}},equipmentHash:h,forecastParametersHash:h,actualFlightParametersHash:h,observationMethod:'OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1',nominalObservationValuesHash:h,captureEffectiveValuesHash:h,deliveryEffectiveValuesHash:h,predictionParameterValuesHash:h,deliveryLatencyTicks:10000};
it('V231-P01 different per-pitch calibration refs with identical values share a domain; changed values do not (stub)',async()=>{
 const {deriveObservedSpinAimDomainV231}=await import('./SpinAimObservedDomainConditionsV231');
 const mk=(suffix:string,change=false,negativeZero=false)=>{
  const modelRef=ref('world_player_batting_models','model'),bindingRef=ref('world_spin_motion_bindings_v225','binding'),captureRef=ref('batting_observation_v1_observations','capture-'+suffix),deliveryRef=ref('batting_observation_v1_deliveries','delivery-'+suffix),predictionRef=ref('batting_prediction_v1_predictions','prediction-'+suffix),
   captureCal=ref('pa_lifecycle_v1_execution_calibrations','capture-cal-'+suffix),deliveryCal=ref('pa_lifecycle_v1_execution_calibrations','delivery-cal-'+suffix),
   view=ref('pa_lifecycle_v1_execution_views','view-'+suffix),member={playerId:'p'},nominal={calibration:{sensitivity:1}},captureValues={calibration:{sensitivity:change?2:1}},deliveryValues={calibration:{decay:.5}},predictionValues={algorithm:'observed'},equipment={mass:1};
  const binding:any={observations:[{model:{equipment:{values:equipment},observationCalibration:{values:nominal},predictionCalibration:{values:predictionValues}}}]};
  const record:any={kind:'same_pa_physical_commitment_v1',source:{capability:'same_pa_physical_observed_spin_aim_trial_v226',trial:{bindingReference:bindingRef}},
   calculation:{algorithm:'batting-observed-spin-aim-trial-v226',trialContext:{selectedProfile:domain.profile,trace:{coordinateSystem:domain.coordinateSystem},transform:domain.transform,pair:domain.targetPair}},
   trialEvidenceV226:{modelReference:modelRef,currentGeometry:{handedness:'R',plateZ:0,ticksPerSecond:1000000,...domain.geometry,centerOfMass:{...domain.geometry.centerOfMass,x:negativeZero?-0:0}},forecastParameters:{gravityY:-9.81},actualFlightParameters:{gravityY:-9.81},
    observationReference:captureRef,deliveryReference:deliveryRef,predictionReference:predictionRef,observedTick:100,availableTick:10100}};
  const capture:any={kind:'batting_observation',source:{capability:'owned_in_flight_batting_observation_v1',calibrationReference:captureCal,viewReference:view,member},calculation:{nominalValues:nominal,effectiveValues:captureValues}},
   delivery:any={kind:'batting_observation_delivery',source:{capability:'owned_in_flight_batting_observation_delivery_v1',calibrationReference:deliveryCal,viewReference:view,member}},
   prediction:any={kind:'batting_observed_prediction',source:{capability:'owned_in_flight_batting_observed_prediction_v1'}},
   cal=(values:unknown)=>({source:{route:'batter_observation',response:{kind:'accepted_execution_values_v1',values},member,viewReference:view,nominalReference:modelRef}});
  return deriveObservedSpinAimDomainV231({trialContext:record.calculation.trialContext,evidence:record.trialEvidenceV226,bindingReference:record.source.trial.bindingReference,binding,capture,delivery,prediction,captureCalibration:cal(captureValues),deliveryCalibration:cal(deliveryValues)} as never);
 };
 const a=mk('a'),b=mk('b'),c=mk('c',true),signed=mk('d',false,true);expect(a.domain).toEqual(b.domain);expect(a.provenance.captureCalibrationReference).not.toEqual(b.provenance.captureCalibrationReference);
 expect(JSON.stringify(a.domain)).not.toContain('capture-cal-');expect(JSON.stringify(a.domain)).not.toContain('delivery-cal-');
 expect(a.domain.captureEffectiveValuesHash).not.toBe(c.domain.captureEffectiveValuesHash);expect(Object.is(signed.domain.geometry.centerOfMass.x,-0)).toBe(true);
});

import { createRequire } from 'node:module';
import { afterEach, vi } from 'vitest';
import * as bindingStore from './SqliteSpinMotionBindingV225';
import * as perception from './SqliteBattingPerceptionStore';
import * as lifecycle from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference } from './SamePlateAppearanceExecutionFromSqlite';
import { selectPredictionAt } from '../../core/world/psychology/batting/BattingTiming';
import { deriveSamePaObservedSpinAimTrialV226 } from './SamePaObservedSpinAimTrialV226';
import { deriveSpinTrialDomainFromRecordsV228 } from './NativeSpinTrialCohortInventoryV228';
import { readObservedSpinAimDomainBeforeCommitmentV231 } from './SpinAimObservedDomainConditionsV231';
import { fixture } from '../../core/world/psychology/batting/BattingFixtures.test-support';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
afterEach(()=>vi.restoreAllMocks());
it('V231 precommit and authenticated-record adapters share exact conditions (stub Owners)',()=>{
 const request=fixture(),s=request.source,assessmentReference={owner:'batting_score_v1_assessments' as const,sourceId:'assessment',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)},
  repertoire={repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles},
  model={source:{sourceId:'model'},repertoire:{values:repertoire},equipment:{values:{batPhysical:s.batPhysical,ball:s.ball}},observationCalibration:{values:{sensor:1}},predictionCalibration:{values:{prediction:2}}},
  oldPlan={handedness:'R',batterCenterOfMass:{x:-.72,y:.95,z:0},strikeZone:{centerX:.08,halfWidth:.22,lowerY:.5,upperY:1.8},targetBallCenterAtPlate:{x:.08,y:1.54,z:0}},
  binding={source:{sourceId:'binding',careerId:'career',playerId:'player',personLinkSourceId:'person-link',acceptedAtDay:1,masteryReference:{owner:'world_spin_mastery_v123'}},
   observations:[{sourceEventId:'event',model,originalSource:{ticksPerSecond:s.ticksPerSecond,command:{plan:oldPlan,profileId:s.profiles[0].profile.profileId,profileVersion:s.profiles[0].profile.version}},
    neutralAnchor:{x:.08,y:1.52,z:0},absoluteTarget:oldPlan.targetBallCenterAtPlate}]},
  record={value:binding,ref:bindingStore.spinMotionBindingReferenceV225(binding as never)},actor={binding:{careerId:'career',playerId:'player',gameDay:2},person:{sourceId:'person-link'}},
  input={source:{capability:'owned_in_flight_same_pa_batting_execution_input_v1',assessmentReferences:[assessmentReference]},lineage:{id:'lineage'},physicalPitchSourceId:'pitch',
   nominalRequest:request,effectiveValues:{repertoire}},decisionTick=request.currentFrame.time.tick,selected=selectPredictionAt(s.predictions,decisionTick)!,
  modelReference=samePaExecutionReference('world_player_batting_models',model),
  makeRef=(owner:string,id:string)=>({owner,sourceId:id,sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)}),
  predictionRef=makeRef('batting_prediction_v1_predictions',selected.predictionId),captureRef=makeRef('batting_observation_v1_observations','capture'),deliveryRef=makeRef('batting_observation_v1_deliveries','delivery');
 const trial={authority:'EXPLICIT_UNCALIBRATED_CONTROL',domain:'UNCALIBRATED_CURRENT_OBSERVED_DOMAIN',bindingReference:record.ref,
  originalEvidenceEventId:binding.observations[0].sourceEventId,assessmentReference,transform:'PLATE_XY_TRANSLATION_V1',coordinateSystem:'NATIVE_RBOX_METERS_V1'} as const;
 const items:any={assessment:{kind:'batting_score_assessment',source:{capability:'owned_in_flight_batting_score_assessment_v1',predictionReference:predictionRef,observationCutReference:captureRef},lineage:input.lineage,physicalPitchSourceId:input.physicalPitchSourceId,prediction:selected},
  prediction:{kind:'batting_observed_prediction',source:{capability:'owned_in_flight_batting_observed_prediction_v1',sourceId:selected.predictionId,modelReference,observationReference:captureRef,deliveryReference:deliveryRef},lineage:input.lineage,physicalPitchSourceId:input.physicalPitchSourceId},
  delivery:{kind:'batting_observation_delivery',source:{capability:'owned_in_flight_batting_observation_delivery_v1',observationReference:captureRef},lineage:input.lineage,physicalPitchSourceId:input.physicalPitchSourceId},
  observation:{kind:'batting_observation',source:{capability:'owned_in_flight_batting_observation_v1',sourceId:'capture'},lineage:input.lineage,physicalPitchSourceId:input.physicalPitchSourceId}};
 vi.spyOn(bindingStore,'readNativeSpinMotionBindingV225').mockReturnValue(binding as never);
 vi.spyOn(perception,'readBattingPerceptionFromSqlite').mockImplementation((_db,kind)=>items[kind]);
 const db=new DatabaseSync(':memory:'),basis={actor,modelReference,input,decisionTick,actualFlightParameters:selected.trajectory.parameters} as unknown as Parameters<typeof deriveSamePaObservedSpinAimTrialV226>[2];

 const member={playerId:'player'},view=makeRef('pa_lifecycle_v1_execution_views','view'),ccRef=makeRef('pa_lifecycle_v1_execution_calibrations','cc'),dcRef=makeRef('pa_lifecycle_v1_execution_calibrations','dc');
 Object.assign(items.observation.source,{member,viewReference:view,calibrationReference:ccRef});items.observation.calculation={nominalValues:{sensor:1},effectiveValues:{sensor:1}};
 Object.assign(items.delivery.source,{member,viewReference:view,calibrationReference:dcRef});
 const cal=(values:unknown)=>({source:{route:'batter_observation',response:{kind:'accepted_execution_values_v1',values},member,viewReference:view,nominalReference:modelReference}});
 vi.spyOn(lifecycle,'readSamePaLifecycleCalibrationFromSqlite').mockImplementation((_db,r)=>cal(r.sourceId==='cc'?{sensor:1}:{sensor:2}) as never);
 try{db.exec('PRAGMA query_only=1; BEGIN');const raw=deriveSamePaObservedSpinAimTrialV226(db,trial,basis);const before=readObservedSpinAimDomainBeforeCommitmentV231(db,trial,basis);
  const record={kind:'same_pa_physical_commitment_v1',source:{capability:'same_pa_physical_observed_spin_aim_trial_v226',trial:{bindingReference:trial.bindingReference}},calculation:{algorithm:'batting-observed-spin-aim-trial-v226',trialContext:raw.trialContext},trialEvidenceV226:raw.evidence};
  const after=deriveSpinTrialDomainFromRecordsV228(record as never,binding as never,items.observation,items.delivery,items.prediction,cal({sensor:1}) as never,cal({sensor:2}) as never);
  expect(before).toEqual(after);expect(deriveSamePaObservedSpinAimTrialV226(db,trial,basis)).toEqual(raw);
  const foreign=structuredClone(basis);Object.assign(foreign.actor.binding,{playerId:'other'});expect(()=>readObservedSpinAimDomainBeforeCommitmentV231(db,trial,foreign)).toThrow(/person/);
  const expired=structuredClone(basis);for(const f of expired.input.nominalRequest.source.predictions)Object.assign(f,{validUntilTick:decisionTick-1});expect(()=>readObservedSpinAimDomainBeforeCommitmentV231(db,trial,expired)).toThrow(/expired/);
  const undelivered=structuredClone(basis);for(const f of undelivered.input.nominalRequest.source.predictions)Object.assign(f,{availableTick:decisionTick+1});expect(()=>readObservedSpinAimDomainBeforeCommitmentV231(db,trial,undelivered)).toThrow(/unavailable|expired/);
  items.delivery.physicalPitchSourceId='foreign';expect(()=>readObservedSpinAimDomainBeforeCommitmentV231(db,trial,basis)).toThrow(/ball/);
 }finally{if(db.isTransaction)db.exec('ROLLBACK');db.close()}
});
