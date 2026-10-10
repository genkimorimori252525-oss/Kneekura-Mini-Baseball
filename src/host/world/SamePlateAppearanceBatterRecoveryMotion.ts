import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { buildBatterSwingExitRecoveryTrajectory, batterSwingExitRecoveryMotionPieceAt } from '../../core/sim/running/BatterSwingExitRecoveryTrajectory';
import { getRunnerRouteLength, sampleRunnerRoute, type RunnerRoute } from '../../core/sim/running/RunnerRoute';
import { deriveBattedWorldFieldMotionExactCheckpointV1 } from '../../core/sim/ball/BattedWorldFieldMotion';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { samePaBatterRunForeignCoverage } from './SamePlateAppearanceBatterRunCoverage';
import { samePaExactRunnerControllerPieces, type SamePaExactRunnerControllerPiece } from './SamePlateAppearanceExactRunnerControllerPiece';
import { samePaPhysicalTimelineAtField } from './SamePlateAppearancePhysicalFieldCalculation';
import { samePaPhysicalHasThrowRelease } from './SamePlateAppearancePhysicalFieldThrow';
import { samePaFields as fields,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorJson as json,actorHash as hash,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBatterSwingExitState } from './SqliteBatterSwingExitStateStore';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
type Field=SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep;
export type SamePaBatterRecoveryRequest=Readonly<{
  kind:'batter_recovery_motion_v1';exitStateReference:SamePaReference<'world_batter_swing_exit_states'>;
  bodyMaterializationReference:SamePaReference<'world_player_body_materializations'>;
  transitionModelReference:SamePaReference<'world_player_batter_run_transition_models'>;route:RunnerRoute;
}>;
export type SamePaBatterRecoveryResult=SamePaBatterRecoveryRequest&Readonly<{
  playerId:string;recoveryBindingHash:string;recoveryStartTick:number;recoveryLaunchTick:number;recoveryComplete:boolean;
  coverageThroughTick:number;exactControllerPiece:SamePaExactRunnerControllerPiece;
}>;
const close=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b))*32;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('batter recovery original binding differs');};
const fieldRef=(f:Field)=>reference(f.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',f);
const result=(f:Field):SamePaBatterRecoveryResult|null=>{
  const r=f.kind==='same_pa_physical_field_step_v1'?f.actionResult:undefined;
  return r?.kind==='batter_recovery_motion_v1'?r:null;
};
export const samePaBatterRecoveryInput=(raw:unknown):SamePaBatterRecoveryRequest=>{
  const s=cloneInert(raw) as SamePaBatterRecoveryRequest;
  const vec=(v:unknown)=>fields(v,['x','z'])&&Object.values(v as object).every(Number.isFinite);
  if(!fields(s,['kind','exitStateReference','bodyMaterializationReference','transitionModelReference','route'])||s.kind!=='batter_recovery_motion_v1'
    ||!validRef(s.exitStateReference,'world_batter_swing_exit_states')||!validRef(s.bodyMaterializationReference,'world_player_body_materializations')
    ||!validRef(s.transitionModelReference,'world_player_batter_run_transition_models')||!fields(s.route,['segments'])||!Array.isArray(s.route.segments)||s.route.segments.length!==1
    ||s.route.segments.some(r=>r.kind!=='line'||!fields(r,['kind','start','end'])||!vec(r.start)||!vec(r.end)))throw new Error('invalid accepted batter recovery action');
  getRunnerRouteLength(s.route);return freeze(s);
};
const binding=(exit:DurableBatterSwingExitState,route:RunnerRoute):SamePaBatterRecoveryRequest=>({kind:'batter_recovery_motion_v1',
  exitStateReference:reference('world_batter_swing_exit_states',exit),bodyMaterializationReference:exit.bodyMaterializationReference,
  transitionModelReference:exit.source.transitionModelReference,route});
const trajectory=(exit:DurableBatterSwingExitState,route:RunnerRoute)=>{
  const start=sampleRunnerRoute(route,0).position,length=getRunnerRouteLength(route),distance=Math.hypot(exit.firstBaseCenter.x-start.x,exit.firstBaseCenter.z-start.z);
  const first=sampleRunnerRoute(route,distance).position;
  if(start.x!==exit.root.position.x||start.z!==exit.root.position.z||distance<=0||distance>=length||!close(first.x,exit.firstBaseCenter.x)||!close(first.z,exit.firstBaseCenter.z))
    throw new Error('batter recovery original route origin or first-base crossing differs');
  return buildBatterSwingExitRecoveryTrajectory(exit.state,route,exit.model.source.parameters);
};
const rejectSuperseded=(prefix:readonly Field[],playerId:string)=>{
  if(prefix.some(f=>{const r=f.kind==='same_pa_physical_field_step_v1'?f.actionResult:undefined;
    return r&&(r.kind==='batter_catch_response_v1'||r.kind==='batter_run_motion_v1')&&r.playerId===playerId;}))
    throw new Error('batter recovery is superseded by an accepted batter response or run controller');
};
/** Executes one original recovery root piece. The five relative world-axis
 * offsets stay unchanged; facing is not a collision-pose transform. */
export const deriveSamePaBatterRecoveryMotion=(source:Readonly<{throughTick:number;action:SamePaBatterRecoveryRequest}>,root:SamePaPhysicalFieldRoot,
  previous:Field,exit:DurableBatterSwingExitState,prefix:readonly Field[])=>{
  const request=samePaBatterRecoveryInput(source.action);same(request,binding(exit,request.route));same(exit.lineage,root.lineage);
  if(exit.physicalPitchReference.sourceId!==root.physicalPitchSourceId||root.physicalPitchSourceId!==previous.physicalPitchSourceId
    ||!Number.isSafeInteger(source.throughTick)||source.throughTick<previous.evaluationTick||exit.body.playerId!==exit.playerId||exit.body.personId!==exit.personId)
    throw new Error('batter recovery original identity, clock or physical pitch differs');
  rejectSuperseded(prefix,exit.playerId);
  const recover=trajectory(exit,request.route),motion=previous.field.motion,moment=motion.world.moment,tps=recover.ticksPerSecond;
  if(!motion.cursor||tps!==root.response.world.parameters.ticksPerSecond||quantizeEventTick(moment.originTick,moment.elapsedSeconds,tps)!==previous.evaluationTick)
    throw new Error('batter recovery needs a resolved actual exact cut');
  const bindingHash=hash(request),prior=prefix.flatMap(f=>{const r=result(f);return r&&r.playerId===exit.playerId?[r]:[];});
  if(prior.some(r=>r.recoveryBindingHash!==bindingHash)||prior.at(-1)?.recoveryComplete)throw new Error('batter recovery original continuation is changed or exhausted');
  if(!prior.length)same(fieldRef(previous),exit.source.fieldReference);
  if(!prefix.some(f=>json(fieldRef(f))===json(exit.source.fieldReference)))throw new Error('batter recovery original exit is outside the physical prefix');
  const startOffset=(recover.startTick-moment.originTick)/tps,elapsed=moment.elapsedSeconds-startOffset;
  if(!prior.length&&elapsed!==0)throw new Error('batter recovery cannot backdate an unexecuted root');
  const piece=batterSwingExitRecoveryMotionPieceAt(recover,elapsed),actors=motion.actors.filter(a=>a.playerId===exit.playerId);
  if(actors.length!==5||exit.body.primitives.length!==5||new Set(actors.map(a=>a.primitive.role)).size!==5)throw new Error('batter recovery original five-part body missing');
  const position={x:piece.position.x,y:exit.root.position.y,z:piece.position.z},velocity={x:piece.velocity.x,y:0,z:piece.velocity.z};
  const bodyActor=actors.find(a=>a.primitive.role==='body');if(!bodyActor)throw new Error('batter recovery body primitive missing');
  for(const a of actors){const shape=exit.body.primitives.find(p=>p.role===a.primitive.role),state=samplePiecewiseFieldActor(a,moment);
    if(!shape||shape.radius!==a.primitive.radius||a.primitive.ticksPerSecond!==tps||moment.elapsedSeconds>(a.primitive.endTick-moment.originTick)/tps
      ||(['x','y','z'] as const).some(k=>!close(state.center[k],position[k]+shape.offset[k])||!close(state.velocity[k],velocity[k])
        ||a.primitive.acceleration[k]!==bodyActor.primitive.acceleration[k]))throw new Error('batter recovery executed body or retained fixed pose differs');
  }
  const foreign=samePaBatterRunForeignCoverage(root,previous,prefix,exit.playerId,undefined);
  const exactForeign=samePaExactRunnerControllerPieces(prefix).filter(w=>w.playerId!==exit.playerId).map(w=>w.piece.coverageThroughElapsedSeconds);
  const foreignEnd=Math.min((foreign-moment.originTick)/tps,...exactForeign),ownEnd=startOffset+piece.endElapsedSeconds;
  const requested=(source.throughTick-moment.originTick)/tps,sameCut=requested===moment.elapsedSeconds
    ||foreignEnd===moment.elapsedSeconds&&exactForeign.includes(moment.elapsedSeconds);
  const exactEnd=sameCut?ownEnd:Math.min(ownEnd,foreignEnd),through=sameCut?moment.elapsedSeconds:Math.min(requested,exactEnd);
  if(requested<moment.elapsedSeconds||foreignEnd<moment.elapsedSeconds||exactEnd<=moment.elapsedSeconds)throw new Error('batter recovery original coverage is exhausted');
  const coverageThroughTick=moment.originTick+Math.ceil(exactEnd*tps);
  const acceleration={x:piece.acceleration.x,y:0,z:piece.acceleration.z};
  const derived=deriveBattedWorldFieldMotionExactCheckpointV1({response:root.response,geometry:root.geometry,actors:motion.actors,cursor:motion.cursor,
    carrierPlayerId:motion.carrierPlayerId,availableAtTick:recover.startTick,coverageThroughTick,checkpointThroughElapsedSeconds:through,
    commands:motion.actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:a.playerId===exit.playerId?acceleration:a.primitive.acceleration}))});
  const field=sameCut?{...derived,motion:{...derived.motion,actors:derived.motion.actors.map(a=>a.playerId===exit.playerId?a:
    motion.actors.find(old=>old.playerId===a.playerId&&old.primitive.role===a.primitive.role)!)}}:derived;
  const actual=field.motion.world.moment,complete=actual.elapsedSeconds===startOffset+recover.transition.recoverySeconds;
  const actionResult:SamePaBatterRecoveryResult={...request,playerId:exit.playerId,recoveryBindingHash:bindingHash,recoveryStartTick:recover.startTick,
    recoveryLaunchTick:recover.endTick,recoveryComplete:complete,coverageThroughTick,exactControllerPiece:{kind:'same_pa_exact_runner_controller_piece_v1',
      originTick:moment.originTick,startedAtElapsedSeconds:moment.elapsedSeconds,coverageThroughElapsedSeconds:exactEnd}};
  return freeze({field,evaluationTick:actual.ball.tick,timeline:samePaPhysicalHasThrowRelease(prefix)?previous.timeline:samePaPhysicalTimelineAtField(previous.timeline,field,root.response,root.geometry),actionResult});
};
/** Caller supplies an original-owner replayed prefix. A plan or matching endpoint
 * alone is never recovery execution. Old plan Sources do not call this hook. */
export const assertSamePaBatterRecoveryComplete=(prefix:readonly Field[],exit:DurableBatterSwingExitState,route:RunnerRoute,currentTick:number)=>{
  rejectSuperseded(prefix,exit.playerId);
  const expected=binding(exit,route),bindingHash=hash(expected),recover=trajectory(exit,route);
  const entries=prefix.flatMap((f,index)=>{const r=result(f);return r&&r.playerId===exit.playerId?[{field:f,result:r,index}]:[];}),last=entries.at(-1);
  if(!last||!last.result.recoveryComplete||currentTick!==recover.endTick||last.field.evaluationTick!==currentTick
    ||entries.some(e=>e.result.recoveryBindingHash!==bindingHash)||entries[0].index===0
    ||json(fieldRef(prefix[entries[0].index-1]))!==json(exit.source.fieldReference))throw new Error('batter run requires complete original recovery execution at the current launch cut');
  for(const e of entries){const r=e.result;same({kind:r.kind,exitStateReference:r.exitStateReference,bodyMaterializationReference:r.bodyMaterializationReference,transitionModelReference:r.transitionModelReference,route:r.route},expected);}
  const moment=last.field.field.motion.world.moment;
  if(moment.elapsedSeconds!==(recover.startTick-moment.originTick)/recover.ticksPerSecond+recover.transition.recoverySeconds
    ||prefix.at(-1)!.field.motion.world.moment.elapsedSeconds!==moment.elapsedSeconds)throw new Error('batter recovery completed cut differs from current physical history');
  return freeze({recoveryReference:fieldRef(last.field) as SamePaReference<'pa_physical_v1_field_steps'>,recoveryBindingHash:bindingHash,
    recoveryStartTick:recover.startTick,recoveryLaunchTick:recover.endTick,
    at:{originTick:moment.originTick,elapsedSeconds:moment.elapsedSeconds,tick:moment.ball.tick}});
};
