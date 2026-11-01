import {deriveSourceBattedFieldMotionV145,type SourceBattedFieldMotionTraceV145} from '../../core/sim/ball/SourceBattedFieldMotionV145';
import type {BattedWorldFieldMotionAdoptionInput} from '../../core/sim/ball/BattedWorldFieldMotion';
import type {SamePaPhysicalFieldRoot,SamePaPhysicalFieldStep,SamePaPhysicalFieldStepSource} from './SamePlateAppearancePhysicalEpisode';
import {actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {samePaExecutionReference as reference} from './SamePlateAppearanceExecutionFromSqlite';
import {samePaFields as fields,samePaHash} from './SamePlateAppearanceWorkPrefix';
import {samePaParkEquipmentInputV145} from './SamePlateAppearanceParkEquipmentV145';
import {assertSamePaFieldBallPhysicsStep,SAME_PA_POLE_ESCAPE_FIELD_ROOT_SOURCE_VERSION} from './SamePlateAppearanceBallPhysics';

export const samePaSourceFieldSolverEvidenceV145=(trace:SourceBattedFieldMotionTraceV145)=>({solverVersion:trace.solverVersion,
  impulseCertificates:trace.impulseCertificates,escapedIntervals:trace.escapedIntervals});
type Field=SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw Error('same-PA pole field original history differs');};
/** Rebuild from an owner-authenticated original prefix, including the complete
 * root equipment. Neither saved impulses nor cursors can restore a session. */
export const deriveSamePaSourceFieldStepV145=(source:SamePaPhysicalFieldStepSource,root:SamePaPhysicalFieldRoot,previous:Field,history:readonly Field[])=>{
  if(root.source.sourceVersion!==SAME_PA_POLE_ESCAPE_FIELD_ROOT_SOURCE_VERSION||!history.length)throw Error('same-PA pole field requires original root/history');
  same(history[0],root);same(history.at(-1),previous);
  assertSamePaFieldBallPhysicsStep(source,root.source,previous.source,previous.kind==='same_pa_physical_field_root_v1');
  const equipment=samePaParkEquipmentInputV145(root.source.parkEquipment!),binding=root.parkEquipmentBinding;
  if(!binding||!fields(binding,['equipmentHash','fixtureHash','worldModelHash','responseModelHash','geometryBindingHash'])
    ||!Object.values(binding).every(samePaHash)||binding.equipmentHash!==hash(equipment)||binding.geometryBindingHash!==root.geometryBindingHash
    ||equipment.baseFieldSourceId!==root.source.sourceId||equipment.physicalPitchSourceId!==root.physicalPitchSourceId
    ||equipment.physicalPitchSourceId!==root.source.launchReference.sourceId||equipment.gameId!==root.lineage.gameId||equipment.playId!==root.lineage.playId
    ||equipment.fenceSurfaceIds.some(id=>root.response.world.surfaces.filter(s=>s.surfaceId===id).length!==1))
    throw Error('same-PA pole field original equipment binding differs');
  const curve=root.response.world.sourceCurve;
  if(!curve||curve.initial.elapsedSeconds!==0||curve.initial.originTick!==root.response.world.flight.initialBall.tick)
    throw Error('same-PA pole field original Source basis missing');
  same(curve.profile,root.source.ballPhysics);same(curve.initial.ball,root.response.world.flight.initialBall);same(root.response.world.parameters,root.source.parameters);
  const ref=(value:Field)=>reference(value.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',value);
  const horizons:number[]=[];
  if(root.source.throughTick>curve.initial.ball.tick)horizons.push(root.source.throughTick);
  for(let i=1;i<history.length;i++){
    const current=history[i],prior=history[i-1];
    if(current.kind!=='same_pa_physical_field_step_v1'||current.operationOrdinal!==prior.operationOrdinal+1
      ||current.physicalPitchSourceId!==root.physicalPitchSourceId||current.source.throughTick<=prior.evaluationTick)
      throw Error('same-PA pole field original history is not consecutive');
    assertSamePaFieldBallPhysicsStep(current.source,root.source,prior.source,prior.kind==='same_pa_physical_field_root_v1');
    same(current.source.fieldRootReference,ref(root));same(current.source.previousFieldReference,ref(prior));same(current.source.previousOperationReference,ref(prior));
    same(current.lineage,root.lineage);horizons.push(current.source.throughTick);
  }
  same(source.fieldRootReference,ref(root));same(source.previousFieldReference,ref(previous));same(source.previousOperationReference,ref(previous));
  const initial:BattedWorldFieldMotionAdoptionInput={response:root.response,geometry:root.geometry,actors:root.response.world.actors,carrierPlayerId:null,
    cursor:{moment:curve.initial,sourceCurve:curve,sourceSide:'incoming',previousContacts:[]},availableAtTick:curve.initial.ball.tick,
    coverageThroughTick:Math.min(...root.response.world.actors.map(a=>a.primitive.endTick)),
    commands:root.source.commands.flatMap(c=>c.primitiveMotions.map(p=>({playerId:c.playerId,role:p.role,
      acceleration:{x:c.bodyAcceleration.x+p.offsetAcceleration.x,y:c.bodyAcceleration.y+p.offsetAcceleration.y,z:c.bodyAcceleration.z+p.offsetAcceleration.z}})))};
  const trace=deriveSourceBattedFieldMotionV145({initial,throughTicks:[...horizons,source.throughTick],parkEquipment:equipment.equipment}),
    physical=[trace.initial,...trace.steps.map(s=>s.field)];
  let index=root.source.throughTick>curve.initial.ball.tick?1:0;
  for(const [i,record]of history.entries()){
    if(i>0)index++;
    same(record.field,physical[index]);same(record.evaluationTick,physical[index].motion.world.moment.ball.tick);
    same(record.ballSolverEvidence,{solverVersion:trace.solverVersion,impulseCertificates:trace.impulseCertificates.filter(c=>c.afterStepIndex<=index-1),
      escapedIntervals:trace.escapedIntervals.filter(c=>c.stepIndex<=index-1)});
  }
  if(index!==horizons.length)throw Error('same-PA pole field original history extent differs');
  return{field:trace.field,ballSolverEvidence:samePaSourceFieldSolverEvidenceV145(trace)};
};
