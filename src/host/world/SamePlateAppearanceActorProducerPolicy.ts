import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { RunnerMotionTrajectory, ExactRunnerMotionTrajectory } from '../../core/sim/running/RunnerMotion';

export const SAME_PA_ACTOR_PRODUCER_POLICY = 'consume_issued_work_reconsider_information_v1' as const;
export type SamePaActorProducerPolicy = typeof SAME_PA_ACTOR_PRODUCER_POLICY;
export const samePaActorProducerPolicyValid = (value: unknown): value is SamePaActorProducerPolicy => value === SAME_PA_ACTOR_PRODUCER_POLICY;
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const ref = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const at = (f: Field) => { const m=f.field.motion.world.moment;return {originTick:m.originTick,elapsedSeconds:m.elapsedSeconds,tick:m.ball.tick}; };

/** Only accepted existing actor Sources may select this policy. It is a request
 * to drain work, never an assertion that any producer or action is complete. */
export const samePaActorProducerPolicyDeclarations = (f: Field) => {
  if(f.kind==='same_pa_physical_field_root_v1')return (f.source.actorProducerPolicies??[]).map(p=>{
    if(!samePaActorProducerPolicyValid(p.policy)||!f.source.commands.some(c=>c.playerId===p.playerId))throw new Error('invalid original actor producer policy command');
    return{playerId:p.playerId,policy:p.policy,policyReference:ref(f),declaredAt:at(f)};});
  const a=f.kind==='same_pa_physical_field_step_v1'?f.source.action:undefined;
  if(a?.kind!=='defender_observation_v1'&&a?.kind!=='batter_catch_response_v1'&&a?.kind!=='occupied_runner_catch_response_v1')return [];
  if(!Object.hasOwn(a,'actorProducerPolicy'))return [];
  if(!samePaActorProducerPolicyValid(a.actorProducerPolicy))throw new Error('invalid accepted actor producer policy');
  return [{playerId:a.member.playerId,policy:a.actorProducerPolicy,policyReference:ref(f),declaredAt:at(f)}];
};

/** Factual current hold evidence only. This does not complete body/contact,
 * custody, ingress, another actor, or the play. The caller retains all pending
 * issued work and decides whether this evidence satisfies its own producer. */
export const samePaCurrentStoppedHold = (fields: readonly Field[], playerId: string) => {
  const root=fields[0],last=fields.at(-1);if(!root||root.kind!=='same_pa_physical_field_root_v1'||!last)return null;
  const initialPolicy=root.source.actorProducerPolicies?.find(p=>p.playerId===playerId);
  const initialActors=root.field.motion.actors.filter(a=>a.playerId===playerId);
  const originalCommand=root.source.commands?.find(c=>c.playerId===playerId);
  const originalUnchanged=initialPolicy&&originalCommand&&Object.values(originalCommand.bodyAcceleration).every(n=>n===0)
    &&originalCommand.primitiveMotions.length===5&&new Set(originalCommand.primitiveMotions.map(p=>p.role)).size===5
    &&originalCommand.primitiveMotions.every(p=>Object.values(p.offsetVelocity).every(n=>n===0)&&Object.values(p.offsetAcceleration).every(n=>n===0))
    &&fields.every(f=>{const actors=f.field.motion.actors.filter(a=>a.playerId===playerId);return actors.length===5&&actors.every(a=>{
      const original=initialActors.find(v=>v.primitive.role===a.primitive.role);if(!original||a.primitive.radius!==original.primitive.radius)return false;
      const state=samplePiecewiseFieldActor(a,f.field.motion.world.moment),initial=samplePiecewiseFieldActor(original,root.field.motion.world.moment);
      return json(state.center)===json(initial.center)&&Object.values(state.velocity).every(n=>n===0)&&Object.values(a.primitive.acceleration).every(n=>n===0);
    });});
  let adopted: {index:number;commandReference:SamePaReference;consumerReference:SamePaReference;startedAtElapsedSeconds:number;trajectory?:RunnerMotionTrajectory|ExactRunnerMotionTrajectory;originalStationary?:true}|null=originalUnchanged?{index:0,commandReference:ref(root),consumerReference:ref(root),startedAtElapsedSeconds:at(root).elapsedSeconds,originalStationary:true}:null;
  for(const [index,f] of fields.entries()){
    if(f.kind!=='same_pa_physical_field_step_v1')continue;
    const a=f.source.action,r=f.actionResult;
    if(a?.kind==='defender_motion_v1'&&r?.kind===a.kind){
      const selected=a.selections.find(s=>s.member.playerId===playerId),motor=r.motors.find(m=>m.self.playerId===playerId);
      if(!selected)continue;
      if(motor?.intent?.kind!=='hold'||!motor.startAt)adopted=null;
      else if(!adopted||json(adopted.commandReference)!==json(selected.decisionReference))
        adopted={index,commandReference:selected.decisionReference,consumerReference:ref(f),startedAtElapsedSeconds:motor.startAt.elapsedSeconds};
    }else if((a?.kind==='batter_catch_motion_v1'||a?.kind==='occupied_runner_catch_motion_v1')&&r?.kind===a.kind&&r.playerId===playerId){
      const command=fields.find(v=>json(ref(v))===json(a.responseReference)),response=command?.kind==='same_pa_physical_field_step_v1'?command.actionResult:undefined;
      if((response?.kind!=='batter_catch_response_v1'&&response?.kind!=='occupied_runner_catch_response_v1')||response.playerId!==playerId||response.intent.kind!=='hold')
        throw new Error('actor producer original held response missing');
      // The original response, not a later continuation, owns reaction time.
      const prior=adopted?.commandReference;
      if(!prior||json(prior)!==json(a.responseReference))adopted={index,commandReference:a.responseReference,consumerReference:ref(f),
        startedAtElapsedSeconds:(response.reactionTick-at(f).originTick)/f.field.motion.actors[0].primitive.ticksPerSecond,
        ...(response.kind==='batter_catch_response_v1'?{trajectory:response.controller.trajectory}:response.controller?{trajectory:response.exactTrajectory??response.controller.trajectory}:{})};
    }else if((r?.kind==='batter_run_motion_v1'||r?.kind==='occupied_runner_motion_v1'||r?.kind==='batter_recovery_motion_v1')&&r.playerId===playerId)adopted=null;
  }
  if(!adopted)return null;
  if(adopted.trajectory){
    const trajectory=adopted.trajectory,elapsed=at(last).elapsedSeconds-('origin' in trajectory?trajectory.origin.elapsedSeconds:(trajectory.startTick-at(last).originTick)/trajectory.ticksPerSecond);
    if(trajectory.segments.some(s=>s.endElapsedSeconds>elapsed&&(s.accelerationMps2!==0||s.startSpeedMps!==0||s.driveDirection!==0||s.bodyMode!=='upright')))return null;
  }
  const stopped=(f:Field)=>{
    const m=f.field.motion.world.moment,actors=f.field.motion.actors.filter(a=>a.playerId===playerId);
    return actors.length===5&&new Set(actors.map(a=>a.primitive.role)).size===5&&actors.every(a=>{
      const state=samplePiecewiseFieldActor(a,m);
      return m.elapsedSeconds<=(a.primitive.endTick-m.originTick)/a.primitive.ticksPerSecond
        &&Object.values(state.velocity).every(n=>n===0)&&Object.values(a.primitive.acceleration).every(n=>n===0);
    });
  };
  if(!stopped(last))return null;
  const completed=adopted.originalStationary&&stopped(root)?root:fields.slice(adopted.index).find(f=>at(f).elapsedSeconds>adopted!.startedAtElapsedSeconds&&stopped(f));
  return completed?freeze({kind:'same_pa_executed_stopped_hold_v1' as const,basis:adopted.originalStationary?'original_stationary_command' as const:'executed_stopped_hold' as const,playerId,commandReference:adopted.commandReference,
    consumerReference:adopted.consumerReference,completionReference:ref(completed),completedAt:at(completed)}):null;
};
