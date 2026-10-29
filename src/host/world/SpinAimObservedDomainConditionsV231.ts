import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { deriveSamePaObservedSpinAimTrialV226, type SamePaObservedSpinAimTrialV226 } from './SamePaObservedSpinAimTrialV226';
import { readNativeSpinMotionBindingV225, spinMotionBindingReferenceV225 } from './SqliteSpinMotionBindingV225';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readSamePaLifecycleCalibrationFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { hashSpinAimDomainValueV228, type SpinAimDomainV228, type SpinAimCohortMemberV228 } from './SpinAimQualificationV228';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
type Trial=ReturnType<typeof deriveSamePaObservedSpinAimTrialV226>;
type Binding=NonNullable<ReturnType<typeof readNativeSpinMotionBindingV225>>;
type Perception=ReturnType<typeof readBattingPerceptionFromSqlite>;
type Calibration=ReturnType<typeof readSamePaLifecycleCalibrationFromSqlite>;
const same=(a:unknown,b:unknown)=>isDeepStrictEqual(a,b);
export type ObservedSpinAimDomainConditionsV231=Readonly<{trialContext:Readonly<{selectedProfile:Trial['trialContext']['selectedProfile'];pair:Trial['trialContext']['pair'];transform:Trial['trialContext']['transform'];trace:Readonly<Pick<Trial['trialContext']['trace'],'coordinateSystem'>>}>;evidence:Trial['evidence'];bindingReference:SamePaReference<'world_spin_motion_bindings_v225'>;binding:Binding;capture:Perception;delivery:Perception;prediction:Perception;captureCalibration:Calibration;deliveryCalibration:Calibration}>;
/** Data-only mapping from authenticated conditions; no commitment or resolution is needed. */
export function deriveObservedSpinAimDomainV231(input:ObservedSpinAimDomainConditionsV231):Readonly<{domain:SpinAimDomainV228;provenance:SpinAimCohortMemberV228['observationProvenance']}> {
 const {binding,capture,delivery,prediction,captureCalibration:captureCal,deliveryCalibration:deliveryCal}=input;
 if(capture.kind!=='batting_observation'||capture.source.capability!=='owned_in_flight_batting_observation_v1'
  ||delivery.kind!=='batting_observation_delivery'||delivery.source.capability!=='owned_in_flight_batting_observation_delivery_v1'
  ||prediction.kind!=='batting_observed_prediction'||prediction.source.capability!=='owned_in_flight_batting_observed_prediction_v1')throw Error('spin trial domain v228: observation method differs');
 const {evidence:e,trialContext:context,bindingReference}=input,cc=captureCal.source,dc=deliveryCal.source,model=binding.observations[0]?.model;
 if(!model||cc.route!=='batter_observation'||dc.route!=='batter_observation'||cc.response.kind!=='accepted_execution_values_v1'||dc.response.kind!=='accepted_execution_values_v1')
  throw Error('spin trial domain v228: calibration route differs');
 if(!same(cc.member,capture.source.member)||!same(dc.member,delivery.source.member)||!same(cc.viewReference,capture.source.viewReference)
  ||!same(dc.viewReference,delivery.source.viewReference)||!same(cc.nominalReference,e.modelReference)||!same(dc.nominalReference,e.modelReference)
  ||!same(capture.calculation.nominalValues,model.observationCalibration.values)||!same(capture.calculation.effectiveValues,cc.response.values))
  throw Error('spin trial domain v228: calibration ownership or values differ');
 const observationProvenance={captureReference:e.observationReference,deliveryReference:e.deliveryReference,predictionReference:e.predictionReference,
  captureCalibrationReference:capture.source.calibrationReference,deliveryCalibrationReference:delivery.source.calibrationReference};
 const domain:SpinAimDomainV228={version:'spin_aim_domain_v228',bindingReference:bindingReference,modelReference:e.modelReference,
  profile:context.selectedProfile,coordinateSystem:context.trace.coordinateSystem,transform:context.transform,handedness:'R',
  plateZ:e.currentGeometry.plateZ,ticksPerSecond:e.currentGeometry.ticksPerSecond,geometry:{centerOfMass:e.currentGeometry.centerOfMass,strikeZone:e.currentGeometry.strikeZone},targetPair:context.pair,
  equipmentHash:hashSpinAimDomainValueV228(model.equipment.values),forecastParametersHash:hashSpinAimDomainValueV228(e.forecastParameters),actualFlightParametersHash:hashSpinAimDomainValueV228(e.actualFlightParameters),
  observationMethod:'OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1',nominalObservationValuesHash:hashSpinAimDomainValueV228(capture.calculation.nominalValues),
  captureEffectiveValuesHash:hashSpinAimDomainValueV228(cc.response.values),deliveryEffectiveValuesHash:hashSpinAimDomainValueV228(dc.response.values),
  predictionParameterValuesHash:hashSpinAimDomainValueV228(model.predictionCalibration.values),deliveryLatencyTicks:e.availableTick-e.observedTick};
 if(e.currentGeometry.handedness!=='R'||e.availableTick<e.observedTick)throw Error('spin trial domain v228: coordinate or latency differs');
 return freeze(cloneInert({domain,provenance:observationProvenance}));
}

/** Use the unchanged V226 normal join before commitment; existing Owner DTOs
 * are read in the same Native snapshot, never synthesized from future results. */
export function readObservedSpinAimDomainBeforeCommitmentV231(db:DatabaseSync,trial:SamePaObservedSpinAimTrialV226,basis:Parameters<typeof deriveSamePaObservedSpinAimTrialV226>[2]) {
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  if(db.prepare('PRAGMA query_only').get()!.query_only!==1)throw Error('spin trial domain v231: query_only snapshot required');
  const value=deriveSamePaObservedSpinAimTrialV226(db,trial,basis),e=value.evidence,binding=readNativeSpinMotionBindingV225(db,trial.bindingReference.sourceId);
  if(!binding||!same(spinMotionBindingReferenceV225(binding),trial.bindingReference))throw Error('spin trial domain v231: binding differs');
  const capture=readBattingPerceptionFromSqlite(db,'observation',e.observationReference),delivery=readBattingPerceptionFromSqlite(db,'delivery',e.deliveryReference),prediction=readBattingPerceptionFromSqlite(db,'prediction',e.predictionReference);
  if(capture.kind!=='batting_observation'||capture.source.capability!=='owned_in_flight_batting_observation_v1'||delivery.kind!=='batting_observation_delivery'||delivery.source.capability!=='owned_in_flight_batting_observation_delivery_v1')throw Error('spin trial domain v231: observation owners differ');
  const captureCalibration=readSamePaLifecycleCalibrationFromSqlite(db,capture.source.calibrationReference),deliveryCalibration=readSamePaLifecycleCalibrationFromSqlite(db,delivery.source.calibrationReference);
  return deriveObservedSpinAimDomainV231({trialContext:value.trialContext,evidence:e,bindingReference:trial.bindingReference,binding,capture,delivery,prediction,captureCalibration,deliveryCalibration});
 }));
}
