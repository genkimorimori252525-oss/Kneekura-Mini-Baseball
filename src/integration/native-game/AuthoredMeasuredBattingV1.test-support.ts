import type { initializeAuthoredNativeMatchV1 } from './AuthoredNativeMatchV1';
import { measuredFixture, measuredRepertoire } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { openSqlitePlayerBattingModelStore } from '../../host/world/SqlitePlayerBattingModelStore';
import type { AcceptedPlayerBattingModelV1, BattingModelParameters } from '../../host/world/PlayerBattingModel';
const ref=(s:{sourceId:string;sourceVersion:string})=>({sourceId:s.sourceId,sourceVersion:s.sourceVersion});

/** Explicit synthetic SI declarations used by genuine Native owners. This
 * creates no pitch, emotion, workload or lifecycle data and mocks no owner. */
export function acceptAuthoredMeasuredBattingFixture(path:string,genesis:ReturnType<typeof initializeAuthoredNativeMatchV1>,ns:string,gameDay:number){
  const body=genesis.materializations.find(m=>m.source.role==='batter')!;
  const scope={careerId:body.source.careerId,playerId:body.source.playerId,personId:body.source.personId,
    personLinkSourceId:body.source.personLinkSourceId,acceptedAtDay:gameDay};
  const parameter=<T>(name:string,values:T)=>({...scope,sourceId:ns+':measured-batting:'+name,sourceVersion:'authored_measured_batting_v1',values});
  const s=measuredFixture().source,observation=genesis.models.find(m=>m.playerId===scope.playerId)!.observation.source.calibration;
  const parameters:BattingModelParameters={
    capability:parameter('capability',{motorLatencyTicks:20_000,technicalTimingOffsetTicks:0,maximumSweetSpotSpeedMps:50}),
    repertoire:parameter('repertoire',measuredRepertoire()),
    decisionModel:parameter('decision',s.decisionModel),equipment:parameter('equipment',{batPhysical:s.batPhysical,ball:s.ball}),
    observationCalibration:parameter('observation',{calibration:observation,deliveryLatencyTicks:20_000}),
    predictionCalibration:parameter('prediction',{algorithm:'observed_motion_with_pinned_aerodynamic_priors_v1',horizonTicks:800_000,
      observerKnownSpinPrior:{x:0,y:0,z:0},parameters:s.predictions[1].trajectory.parameters}),
  };
  const source:AcceptedPlayerBattingModelV1={...scope,sourceId:ns+':measured-batting:model',sourceVersion:'authored_measured_batting_v1',
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
