import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

export type SamePaObservedSpinAimTrialV226 = Readonly<{authority:'EXPLICIT_UNCALIBRATED_CONTROL';domain:'UNCALIBRATED_CURRENT_OBSERVED_DOMAIN';
 bindingReference:SamePaReference<'world_spin_motion_bindings_v225'>;originalEvidenceEventId:string;
 assessmentReference:SamePaReference<'batting_score_v1_assessments'>;transform:'PLATE_XY_TRANSLATION_V1';coordinateSystem:'NATIVE_RBOX_METERS_V1'}>;
export function samePaObservedSpinAimTrialInputV226(raw:unknown):SamePaObservedSpinAimTrialV226 {
 const s=cloneInert(raw) as SamePaObservedSpinAimTrialV226;
 if(!fields(s,['authority','domain','bindingReference','originalEvidenceEventId','assessmentReference','transform','coordinateSystem'])
  ||s.authority!=='EXPLICIT_UNCALIBRATED_CONTROL'||s.domain!=='UNCALIBRATED_CURRENT_OBSERVED_DOMAIN'
  ||!ref(s.bindingReference,'world_spin_motion_bindings_v225')||!text(s.originalEvidenceEventId)
  ||!ref(s.assessmentReference,'batting_score_v1_assessments')||s.transform!=='PLATE_XY_TRANSLATION_V1'||s.coordinateSystem!=='NATIVE_RBOX_METERS_V1')
  throw Error('invalid same-PA observed spin aim trial Source');
 return freeze(s);
}

import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { readNativeSpinMotionBindingV225, spinMotionBindingReferenceV225 } from './SqliteSpinMotionBindingV225';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { samePaExecutionReference } from './SamePlateAppearanceExecutionFromSqlite';
import { selectPredictionAt } from '../../core/world/psychology/batting/BattingTiming';
import type { DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableSamePaBattingExecutionInput } from './NativeBattingExecutionInput';
import type { AerodynamicPitchTrajectoryParameters } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
const same=(a:unknown,b:unknown,label:string)=>{if(!isDeepStrictEqual(a,b))throw Error('observed spin aim trial original '+label+' differs')};
/** Derive the trial only from the normal snapshot's original Owner records.
 * The binding describes old practice; the new domain is an explicit trial and
 * does not upgrade that description into proven future transfer. */
export function deriveSamePaObservedSpinAimTrialV226(db:DatabaseSync,raw:SamePaObservedSpinAimTrialV226,basis:Readonly<{
 actor:DurablePhysicalPlateAppearanceActor;modelReference:SamePaReference<'world_player_batting_models'>;
 input:DurableSamePaBattingExecutionInput;decisionTick:number;actualFlightParameters:AerodynamicPitchTrajectoryParameters;
}>) {
 const trial=samePaObservedSpinAimTrialInputV226(raw),{input,actor}=basis;
 if(input.source.capability!=='owned_in_flight_same_pa_batting_execution_input_v1')throw Error('observed spin aim trial requires in-flight input');
 const binding=readNativeSpinMotionBindingV225(db,trial.bindingReference.sourceId);if(!binding)throw Error('observed spin aim trial binding missing');
 same(spinMotionBindingReferenceV225(binding),trial.bindingReference,'binding fullref');
 if(binding.source.careerId!==actor.binding.careerId||binding.source.playerId!==actor.binding.playerId||binding.source.personLinkSourceId!==actor.person.sourceId
  ||binding.source.acceptedAtDay>actor.binding.gameDay)throw Error('observed spin aim trial binding person or day differs');
 const originals=binding.observations.filter(o=>o.sourceEventId===trial.originalEvidenceEventId);
 if(originals.length!==1)throw Error('observed spin aim trial original event missing');const original=originals[0];
 same(samePaExecutionReference('world_player_batting_models',original.model),basis.modelReference,'model fullref');
 const request=input.nominalRequest,s=request.source,plan=original.originalSource.command.plan;
 if(s.handedness!=='R'||plan.handedness!=='R'||s.plateZ!==plan.targetBallCenterAtPlate.z||s.ticksPerSecond!==original.originalSource.ticksPerSecond
  ||request.currentFrame.time.tick!==basis.decisionTick)throw Error('observed spin aim trial handedness, plate or clock differs');
 same(s.batPhysical,original.model.equipment.values.batPhysical,'bat equipment');same(s.ball,original.model.equipment.values.ball,'ball equipment');
 const originalRepertoire=original.model.repertoire.values,current=input.effectiveValues.repertoire;
 if(current.repertoireId!==originalRepertoire.repertoireId||current.repertoireVersion!==originalRepertoire.repertoireVersion)throw Error('observed spin aim trial repertoire differs');
 const originalProfile=originalRepertoire.profiles.filter(p=>p.profile.profileId===original.originalSource.command.profileId&&p.profile.version===original.originalSource.command.profileVersion),
  currentProfile=current.profiles.filter(p=>p.profile.profileId===original.originalSource.command.profileId&&p.profile.version===original.originalSource.command.profileVersion);
 if(originalProfile.length!==1||currentProfile.length!==1)throw Error('observed spin aim trial profile missing');same(currentProfile[0],originalProfile[0],'profile');
 if(current.sampledProfiles?.some(p=>p.profileId===currentProfile[0].profile.profileId))throw Error('observed spin aim trial measured profile unsupported');
 const selected=selectPredictionAt(s.predictions,basis.decisionTick);if(!selected||selected.validUntilTick<basis.decisionTick)throw Error('observed spin aim trial prediction unavailable or expired');
 const pins=input.source.assessmentReferences.filter(p=>isDeepStrictEqual(p,trial.assessmentReference));if(pins.length!==1)throw Error('observed spin aim trial assessment absent or duplicated');
 const assessment=readBattingPerceptionFromSqlite(db,'assessment',trial.assessmentReference);
 if(assessment.kind!=='batting_score_assessment'||assessment.source.capability!=='owned_in_flight_batting_score_assessment_v1')throw Error('observed spin aim trial assessment owner differs');
 same(assessment.prediction,selected,'selected forecast');same(assessment.lineage,input.lineage,'assessment lineage');
 if(assessment.physicalPitchSourceId!==input.physicalPitchSourceId)throw Error('observed spin aim trial assessment ball differs');
 const prediction=readBattingPerceptionFromSqlite(db,'prediction',assessment.source.predictionReference);
 if(prediction.kind!=='batting_observed_prediction'||prediction.source.capability!=='owned_in_flight_batting_observed_prediction_v1')throw Error('observed spin aim trial prediction owner differs');
 same(prediction.source.modelReference,basis.modelReference,'prediction model');same(prediction.lineage,input.lineage,'prediction lineage');
 if(prediction.physicalPitchSourceId!==input.physicalPitchSourceId||prediction.source.sourceId!==selected.predictionId)throw Error('observed spin aim trial prediction ball differs');
 const delivery=readBattingPerceptionFromSqlite(db,'delivery',prediction.source.deliveryReference),capture=readBattingPerceptionFromSqlite(db,'observation',prediction.source.observationReference);
 if(delivery.kind!=='batting_observation_delivery'||delivery.source.capability!=='owned_in_flight_batting_observation_delivery_v1'
  ||capture.kind!=='batting_observation'||capture.source.capability!=='owned_in_flight_batting_observation_v1')throw Error('observed spin aim trial delivery or capture owner differs');
 same(delivery.source.observationReference,prediction.source.observationReference,'delivery capture');same(assessment.source.observationCutReference,prediction.source.observationReference,'assessment capture');
 same(delivery.lineage,input.lineage,'delivery lineage');same(capture.lineage,input.lineage,'capture lineage');
 if(delivery.physicalPitchSourceId!==input.physicalPitchSourceId||capture.physicalPitchSourceId!==input.physicalPitchSourceId)throw Error('observed spin aim trial observed ball differs');
 const trialContext={selectedProfile:{profileId:currentProfile[0].profile.profileId,version:currentProfile[0].profile.version},
  pair:{anchor:original.neutralAnchor,target:original.absoluteTarget},transform:trial.transform,
  trace:{sourceId:trial.bindingReference.sourceId,observationIds:[capture.source.sourceId],cutoffTick:basis.decisionTick,coordinateSystem:trial.coordinateSystem}};
 return freeze(cloneInert({trialContext,evidence:{authority:trial.authority,domain:trial.domain,bindingReference:trial.bindingReference,masteryReference:binding.source.masteryReference,
  originalEvidenceEventId:trial.originalEvidenceEventId,assessmentReference:trial.assessmentReference,predictionReference:assessment.source.predictionReference,
  deliveryReference:prediction.source.deliveryReference,observationReference:prediction.source.observationReference,modelReference:basis.modelReference,
  observedTick:selected.observedTick,availableTick:selected.availableTick,validUntilTick:selected.validUntilTick,cutoffTick:basis.decisionTick,
  originalPlan:plan,currentGeometry:{handedness:s.handedness,centerOfMass:s.centerOfMass,strikeZone:s.strikeZone,plateZ:s.plateZ,ticksPerSecond:s.ticksPerSecond},
  domainChanged:!isDeepStrictEqual(plan.batterCenterOfMass,s.centerOfMass)||!isDeepStrictEqual(plan.strikeZone,s.strikeZone),qualifiedTransferProven:false as const,
  forecastParameters:selected.trajectory.parameters,actualFlightParameters:basis.actualFlightParameters,relativeTransferProven:false as const}}));
}
