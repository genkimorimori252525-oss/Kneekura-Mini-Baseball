import { deriveSourceBattedFieldMotionV3, type SourceBattedFieldMotionTraceV3 } from '../../core/sim/ball/SourceBattedFieldMotionV3';
import { createSourceFreeBallKernel } from '../../core/sim/ball/SourceFreeBallKernel';
import type { BattedWorldFieldMotionAdoptionInput } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { assertSamePaFieldBallPhysicsStep, samePaSourceFieldMetadataActionV3, SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION,
  SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION, SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION } from './SamePlateAppearanceBallPhysics';
import { deriveSamePaSourceIntegerMetadataV1, deriveSamePaSourceIntegerFieldStepV1 } from './SamePlateAppearanceSourceIntegerCheckpointV1';
import { deriveSamePaSourceMotorMetadataV1, deriveSamePaSourceMotorFieldStepV1 } from './SamePlateAppearanceSourceMotorFieldV1';
import { deriveSamePaSourceControlV1 } from './SamePlateAppearanceSourceControlV1';

export const samePaSourceFieldSolverEvidenceV3 = (trace: SourceBattedFieldMotionTraceV3) => ({ solverVersion: trace.solverVersion,
  impulseCertificates: trace.impulseCertificates, escapedIntervals: trace.escapedIntervals });
const same = (a: unknown,b: unknown) => { if(json(a)!==json(b))throw new Error('same-PA v3 field original history differs'); };

/** Native's reader passes only its independently reconstructed original prefix.
 * The Core session is rebuilt here; no saved diagnostic restores authority. */
type Field = SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep;
const assertFreeSource = (root: SamePaPhysicalFieldRoot, field: Field) => {
  const motion=field.field.motion,cursor=motion.cursor,curve=cursor?.sourceCurve,original=root.response.world.sourceCurve;
  if(motion.carrierPlayerId!==null||!cursor||!curve||!original||!['incoming','outgoing'].includes(cursor.sourceSide??'')
    ||!['moving','resting','ground','rolling_stop','rebound'].includes(motion.response.kind)
    ||curve.initial.originTick!==original.initial.originTick||cursor.moment.originTick!==original.initial.originTick
    ||cursor.moment.originTick!==motion.world.moment.originTick||cursor.moment.elapsedSeconds!==motion.world.moment.elapsedSeconds
    ||field.evaluationTick!==cursor.moment.ball.tick||field.evaluationTick!==motion.world.moment.ball.tick)
    throw new Error('same-PA v3 metadata requires an exact free Source cursor');
  same(curve.profile,original.profile);
  same(createSourceFreeBallKernel(curve).evaluateAt(cursor.moment.elapsedSeconds,cursor.sourceSide).moment,cursor.moment);
};

/** Metadata is a repeated physical cut, not an integration/checkpoint request.
 * Solver diagnostics inherit the rederived physical prefix; they grant no authority. */
const replay = (root: SamePaPhysicalFieldRoot, previous: Field, history: readonly Field[], nextThroughTick?: number) => {
  if(root.source.sourceVersion!==SAME_PA_AERO_GROUND_ESCAPE_FIELD_ROOT_SOURCE_VERSION||!history.length)throw new Error('same-PA v3 field requires original root/history');
  same(history[0],root);same(history.at(-1),previous);
  const curve=root.response.world.sourceCurve;
  if(!curve||curve.initial.elapsedSeconds!==0||curve.initial.originTick!==root.response.world.flight.initialBall.tick)throw new Error('same-PA v3 field original Source basis missing');
  same(curve.profile,root.source.ballPhysics);same(curve.initial.ball,root.response.world.flight.initialBall);same(root.response.world.parameters,root.source.parameters);
  const fields=[...history], horizons:number[]=[];
  if(root.source.throughTick>curve.initial.ball.tick)horizons.push(root.source.throughTick);
  for(let i=1;i<fields.length;i++){
    const current=fields[i],prior=fields[i-1];
    if(current.kind!=='same_pa_physical_field_step_v1'||current.operationOrdinal!==prior.operationOrdinal+1
      ||current.physicalPitchSourceId!==root.physicalPitchSourceId)throw new Error('same-PA v3 field original prefix is not consecutive');
    assertSamePaFieldBallPhysicsStep(current.source,root.source,prior.source,prior.kind==='same_pa_physical_field_root_v1');
    same(current.source.fieldRootReference,reference('pa_physical_v1_field_roots',root));
    same(current.source.previousFieldReference,reference(prior.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',prior));
    same(current.source.previousOperationReference,current.source.previousFieldReference);
    same(current.lineage,root.lineage);
    if(samePaSourceFieldMetadataActionV3(current.source.action)){
      if(current.source.throughTick!==prior.evaluationTick||current.evaluationTick!==prior.evaluationTick
        ||current.actionResult?.kind!==current.source.action?.kind)throw new Error('same-PA v3 metadata changed its cut or action');
      same(current.field,prior.field);same(current.timeline,prior.timeline);same(current.ballSolverEvidence,prior.ballSolverEvidence);
      assertFreeSource(root,current);
    }else horizons.push(current.source.throughTick);
  }
  const initial:BattedWorldFieldMotionAdoptionInput={response:root.response,geometry:root.geometry,actors:root.response.world.actors,carrierPlayerId:null,
    cursor:{moment:curve.initial,sourceCurve:curve,sourceSide:'incoming',previousContacts:[]},availableAtTick:curve.initial.ball.tick,
    coverageThroughTick:Math.min(...root.response.world.actors.map(a=>a.primitive.endTick)),
    commands:root.source.commands.flatMap(c=>c.primitiveMotions.map(p=>({playerId:c.playerId,role:p.role,
      acceleration:{x:c.bodyAcceleration.x+p.offsetAcceleration.x,y:c.bodyAcceleration.y+p.offsetAcceleration.y,z:c.bodyAcceleration.z+p.offsetAcceleration.z}})))};
  const trace=deriveSourceBattedFieldMotionV3({initial,throughTicks:nextThroughTick===undefined?horizons:[...horizons,nextThroughTick]});
  const physicalFields=[trace.initial,...trace.steps.map(s=>s.field)];
  let index=root.source.throughTick>curve.initial.ball.tick?1:0;
  const evidenceAt=(stepIndex:number)=>({solverVersion:trace.solverVersion,
    impulseCertificates:trace.impulseCertificates.filter(c=>c.afterStepIndex<=stepIndex),escapedIntervals:trace.escapedIntervals.filter(c=>c.stepIndex<=stepIndex)});
  for(const [i,field]of fields.entries()){
    if(i>0&&!samePaSourceFieldMetadataActionV3((field as SamePaPhysicalFieldStep).source.action))index++;
    same(physicalFields[index],field.field);same(evidenceAt(index-1),field.ballSolverEvidence);
  }
  if(index!==horizons.length)throw new Error('same-PA v3 field history extent differs');
  return trace;
};

export const deriveSamePaSourceFieldMetadataV3 = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, history: readonly Field[]) => {
  if(source.sourceVersion===SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION)
    return deriveSamePaSourceControlV1({source,root,previous,history});
  if(source.sourceVersion===SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION)
    return deriveSamePaSourceMotorMetadataV1({source,root,previous,history});
  if(source.sourceVersion===SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION)
    return deriveSamePaSourceIntegerMetadataV1({source,root,previous,history});
  assertSamePaFieldBallPhysicsStep(source,root.source,previous.source,previous.kind==='same_pa_physical_field_root_v1');
  if(!samePaSourceFieldMetadataActionV3(source.action)||source.throughTick!==previous.evaluationTick)
    throw new Error('same-PA v3 metadata cannot advance physical time');
  same(source.fieldRootReference,reference('pa_physical_v1_field_roots',root));
  same(source.previousFieldReference,reference(previous.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',previous));
  same(source.previousOperationReference,source.previousFieldReference);
  const trace=replay(root,previous,history);
  assertFreeSource(root,previous);
  return {ballSolverEvidence:samePaSourceFieldSolverEvidenceV3(trace)};
};

export const deriveSamePaSourceFieldStepV3 = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, history: readonly Field[]) => {
  if(source.sourceVersion===SAME_PA_AERO_GROUND_CONTROL_FIELD_STEP_SOURCE_VERSION)
    return deriveSamePaSourceControlV1({source,root,previous,history});
  if(source.sourceVersion===SAME_PA_AERO_GROUND_MOTOR_FIELD_STEP_SOURCE_VERSION)
    return deriveSamePaSourceMotorFieldStepV1({source,root,previous,history});
  if(source.sourceVersion===SAME_PA_AERO_GROUND_INTEGER_BOUNDARY_FIELD_STEP_SOURCE_VERSION)
    return deriveSamePaSourceIntegerFieldStepV1({source,root,previous,history});
  if(Object.hasOwn(source,'action'))throw new Error('same-PA v3 physical replay requires a free checkpoint');
  const trace=replay(root,previous,history,source.throughTick);
  return{field:trace.field,ballSolverEvidence:samePaSourceFieldSolverEvidenceV3(trace)};
};
