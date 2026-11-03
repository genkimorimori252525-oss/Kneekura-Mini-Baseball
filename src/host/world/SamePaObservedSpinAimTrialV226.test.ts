import { expect, it } from 'vitest';
import { samePaObservedSpinAimTrialInputV226 } from './SamePaObservedSpinAimTrialV226';
const hash='a'.repeat(64),ref=(owner:string)=>({owner,sourceId:'fixture',sourceHash:hash,snapshotHash:hash});
const trial={authority:'EXPLICIT_UNCALIBRATED_CONTROL',domain:'UNCALIBRATED_CURRENT_OBSERVED_DOMAIN',bindingReference:ref('world_spin_motion_bindings_v225'),
 originalEvidenceEventId:'event',assessmentReference:ref('batting_score_v1_assessments'),transform:'PLATE_XY_TRANSLATION_V1',coordinateSystem:'NATIVE_RBOX_METERS_V1'};
it('V226-H01 validates only explicit original binding and assessment references',()=>{expect(samePaObservedSpinAimTrialInputV226(trial)).toEqual(trial)});
it('V226-H02 rejects unknown transform, authority, reference hash, extras and wrong owner',()=>{
 for(const bad of [{...trial,transform:'unknown'},{...trial,authority:'qualify'},{...trial,extra:true},
  {...trial,bindingReference:{...trial.bindingReference,sourceHash:'bad'}},{...trial,assessmentReference:ref('other')}])expect(()=>samePaObservedSpinAimTrialInputV226(bad)).toThrow();
});
import { afterEach, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import * as bindingStore from './SqliteSpinMotionBindingV225';
import * as perception from './SqliteBattingPerceptionStore';
import { samePaExecutionReference } from './SamePlateAppearanceExecutionFromSqlite';
import { selectPredictionAt } from '../../core/world/psychology/batting/BattingTiming';
import { deriveSamePaObservedSpinAimTrialV226 } from './SamePaObservedSpinAimTrialV226';
import { fixture } from '../../core/world/psychology/batting/BattingFixtures.test-support';
afterEach(()=>vi.restoreAllMocks());
it('V226-H03 joins selected Owner records, separates old and current geometry, and rejects foreign inputs',()=>{
 const request=fixture(),s=request.source,assessmentReference={owner:'batting_score_v1_assessments' as const,sourceId:'assessment',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)},
  repertoire={repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles},
  model={source:{sourceId:'model'},repertoire:{values:repertoire},equipment:{values:{batPhysical:s.batPhysical,ball:s.ball}}},
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
 const db={} as DatabaseSync,basis={actor,modelReference,input,decisionTick,actualFlightParameters:selected.trajectory.parameters} as unknown as Parameters<typeof deriveSamePaObservedSpinAimTrialV226>[2];
 const detached=structuredClone(basis),result=deriveSamePaObservedSpinAimTrialV226(db,trial,detached);
 expect(Object.isFrozen(detached.actualFlightParameters)).toBe(false);expect(Object.isFrozen(result.evidence.actualFlightParameters)).toBe(true);
 expect(result.evidence.actualFlightParameters).not.toBe(detached.actualFlightParameters);expect(result.evidence.domainChanged).toBe(true);expect(result.evidence.qualifiedTransferProven).toBe(false);
 expect(result.trialContext.pair.anchor).toEqual(binding.observations[0].neutralAnchor);expect(result.trialContext.pair.target).toEqual(binding.observations[0].absoluteTarget);
 const foreign=structuredClone(actor);foreign.binding.playerId='foreign';expect(()=>deriveSamePaObservedSpinAimTrialV226(db,trial,{...basis,actor:foreign as never})).toThrow(/person/);
 items.assessment.physicalPitchSourceId='foreign';expect(()=>deriveSamePaObservedSpinAimTrialV226(db,trial,basis)).toThrow(/ball/);
 items.assessment.physicalPitchSourceId=input.physicalPitchSourceId;
 expect(()=>deriveSamePaObservedSpinAimTrialV226(db,{...trial,bindingReference:{...trial.bindingReference,sourceHash:'0'.repeat(64)}},basis)).toThrow(/fullref/);
 const altered=structuredClone(input);Object.assign(altered.effectiveValues.repertoire.profiles[0].profile,{basePreContactSeconds:altered.effectiveValues.repertoire.profiles[0].profile.basePreContactSeconds+.01});
 expect(()=>deriveSamePaObservedSpinAimTrialV226(db,trial,{...basis,input:altered as never})).toThrow(/profile/);
 const expired=structuredClone(input);for(const prediction of expired.nominalRequest.source.predictions)Object.assign(prediction,{validUntilTick:decisionTick-1});
 expect(()=>deriveSamePaObservedSpinAimTrialV226(db,trial,{...basis,input:expired as never})).toThrow(/expired/);
 expect(()=>deriveSamePaObservedSpinAimTrialV226(db,{...trial,assessmentReference:{...trial.assessmentReference,sourceId:'foreign'}},basis)).toThrow(/assessment/);
 items.delivery.source.observationReference={...captureRef,sourceId:'foreign'};expect(()=>deriveSamePaObservedSpinAimTrialV226(db,trial,basis)).toThrow(/delivery capture/);

});

import { samePaPhysicalEpisodeSourceInput } from './SamePlateAppearancePhysicalEpisode';
it('V226-H04 physical Source parser accepts only the explicit new arm and exact references',()=>{
 const r=(owner:string,id:string)=>({owner,sourceId:id,sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)}),source={sourceId:'commit',sourceVersion:'v1',capability:'same_pa_physical_observed_spin_aim_trial_v226',
  viewReference:r('pa_lifecycle_v1_execution_views','view'),launchReference:r('pa_physical_v1_launches','launch'),previousOperationReference:r('pa_physical_v1_cuts','cut'),
  inputReference:r('batting_execution_v1_inputs','input'),intentReference:r('batting_execution_v1_intents','intent'),trial};
 expect(samePaPhysicalEpisodeSourceInput(source,'commit')).toEqual(source);
 for(const bad of [{...source,extra:true},{...source,trial:{...trial,domain:'OTHER'}},{...source,trial:{...trial,originalEvidenceEventId:''}},
  {...source,trial:{...trial,bindingReference:{...trial.bindingReference,snapshotHash:'bad'}}}])expect(()=>samePaPhysicalEpisodeSourceInput(bad,'commit')).toThrow();
});
