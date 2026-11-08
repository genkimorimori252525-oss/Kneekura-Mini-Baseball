import type { initializeAuthoredNativeMatchV1 } from './AuthoredNativeMatchV1';
import { measuredFixture, measuredRepertoire } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2, MEASURED_BATTING_REPERTOIRE_FIELD_UPRIGHT_V137,
  MEASURED_BATTING_REPERTOIRE_CONTACT_AIM_V138, type MeasuredContactAimV138 } from '../../core/world/psychology/batting/MeasuredBattingTrajectoryV1';
import { openSqlitePlayerBattingModelStore } from '../../host/world/SqlitePlayerBattingModelStore';
import type { AcceptedPlayerBattingModelV1, BattingModelParameters } from '../../host/world/PlayerBattingModel';
const ref=(s:{sourceId:string;sourceVersion:string})=>({sourceId:s.sourceId,sourceVersion:s.sourceVersion});

/** Explicit synthetic SI declarations used by genuine Native owners. This
 * creates no pitch, emotion, workload or lifecycle data and mocks no owner. */
export function acceptAuthoredMeasuredBattingFixture(path:string,genesis:ReturnType<typeof initializeAuthoredNativeMatchV1>,ns:string,gameDay:number,
  options:Readonly<{bodyMaterializationSourceId?:string;predictionParameters?:BattingModelParameters['predictionCalibration']['values']['parameters'];uprightRegistrationV135?:true;fieldRegistrationV137?:true;contactAimV138?:MeasuredContactAimV138;controlledObservationV139?:true}>={}){
  const body=genesis.materializations.find(m=>m.source.role==='batter'
    &&(options.bodyMaterializationSourceId===undefined||m.source.sourceId===options.bodyMaterializationSourceId));
  if(!body)throw new Error('original authored batter materialization is missing');
  const scope={careerId:body.source.careerId,playerId:body.source.playerId,personId:body.source.personId,
    personLinkSourceId:body.source.personLinkSourceId,acceptedAtDay:gameDay};
  const parameter=<T>(name:string,values:T)=>({...scope,sourceId:ns+':measured-batting:'+name,sourceVersion:'authored_measured_batting_v1',values});
  const s=measuredFixture().source,observation=genesis.models.find(m=>m.playerId===scope.playerId)!.observation.source.calibration;
  if(options.controlledObservationV139&&!options.contactAimV138)throw new Error('controlled observer fixture requires its explicit contact aim candidate');
  if([options.uprightRegistrationV135,options.fieldRegistrationV137,options.contactAimV138].filter(Boolean).length>1)throw new Error('authored measured fixture requires one registration mode');
  const registrationSuffix=options.contactAimV138?':contact-aim-v138':options.fieldRegistrationV137?':field-v137':options.uprightRegistrationV135?':upright-v135':'';
  const registrationVersion=options.contactAimV138?'authored_measured_contact_aim_v138':options.fieldRegistrationV137?'authored_measured_field_v137':options.uprightRegistrationV135?'authored_measured_upright_v135':'authored_measured_batting_v1';
  const repertoire=parameter('repertoire',measuredRepertoire());
  const registeredRepertoire=registrationSuffix?{...repertoire,sourceId:repertoire.sourceId+registrationSuffix,sourceVersion:registrationVersion,
    values:{...repertoire.values,repertoireVersion:options.contactAimV138?MEASURED_BATTING_REPERTOIRE_CONTACT_AIM_V138:options.fieldRegistrationV137?MEASURED_BATTING_REPERTOIRE_FIELD_UPRIGHT_V137:MEASURED_BATTING_REPERTOIRE_UPRIGHT_V2,
      ...(options.contactAimV138?{sampledProfiles:repertoire.values.sampledProfiles!.map(p=>({...p,contactAimV138:structuredClone(options.contactAimV138!)}))}:{})}}:repertoire;
  const originalObservation=parameter('observation',{calibration:observation,deliveryLatencyTicks:20_000});
  const observationParameter=options.controlledObservationV139?{...originalObservation,
    sourceId:originalObservation.sourceId+':controlled-observer-v139',sourceVersion:'authored_synthetic_controlled_observer_v139',
    values:{...originalObservation.values,calibration:{...observation,errorParameters:{...observation.errorParameters,
      maximumPositionErrorMeters:.02,maximumVelocityErrorMps:.05}}}}:originalObservation;
  const parameters:BattingModelParameters={
    capability:parameter('capability',{motorLatencyTicks:20_000,technicalTimingOffsetTicks:0,maximumSweetSpotSpeedMps:50}),
    repertoire:registeredRepertoire,
    decisionModel:parameter('decision',s.decisionModel),equipment:parameter('equipment',{batPhysical:s.batPhysical,ball:s.ball}),
    observationCalibration:observationParameter,
    predictionCalibration:parameter('prediction',{algorithm:'observed_motion_with_pinned_aerodynamic_priors_v1',horizonTicks:800_000,
      observerKnownSpinPrior:{x:0,y:0,z:0},parameters:options.predictionParameters??s.predictions[1].trajectory.parameters}),
  };
  const source:AcceptedPlayerBattingModelV1={...scope,sourceId:ns+':measured-batting:model'+registrationSuffix+(options.controlledObservationV139?':controlled-observer-v139':''),
    sourceVersion:options.controlledObservationV139?'authored_synthetic_controlled_observer_v139':registrationVersion,
    bodyMaterializationRef:ref(body.source),bodyRef:ref(body.body),poseRef:ref(body.pose),
    capabilityRef:ref(parameters.capability),repertoireRef:ref(parameters.repertoire),decisionModelRef:ref(parameters.decisionModel),
    equipmentRef:ref(parameters.equipment),observationCalibrationRef:ref(parameters.observationCalibration),predictionCalibrationRef:ref(parameters.predictionCalibration)};
  const store=openSqlitePlayerBattingModelStore(path,{
    readAcceptedModel:id=>id===source.sourceId?source:null,
    readAcceptedCapability:id=>id===parameters.capability.sourceId?parameters.capability:null,
    readAcceptedRepertoire:id=>id===parameters.repertoire.sourceId?parameters.repertoire:null,
    readAcceptedDecisionModel:id=>id===parameters.decisionModel.sourceId?parameters.decisionModel:null,
    readAcceptedEquipment:id=>id===parameters.equipment.sourceId?parameters.equipment:null,
    readAcceptedObservationCalibration:id=>id===parameters.observationCalibration.sourceId?parameters.observationCalibration:null,
    readAcceptedPredictionCalibration:id=>id===parameters.predictionCalibration.sourceId?parameters.predictionCalibration:null,
  });
  try{return {source,parameters,model:store.accept(source.sourceId)};}finally{store.close();}
}
