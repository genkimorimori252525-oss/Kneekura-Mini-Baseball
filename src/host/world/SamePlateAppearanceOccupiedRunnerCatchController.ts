import { buildRouteFollowingController, createCanonicalRunnerKinematicsFromRouteMotion } from '../../core/sim/running/RunnerLocomotionController';
import { buildRunnerMotionTrajectoryAtExactOrigin, sampleRunnerMotionTrajectoryExact } from '../../core/sim/running/RunnerMotion';
import { getRunnerRouteLength } from '../../core/sim/running/RunnerRoute';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { DurableSamePaOccupiedRunnerHold } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import type { SamePaOccupiedRunnerCatchResponseRequest } from './SamePlateAppearanceOccupiedRunnerCatchResponse';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field=SamePaPhysicalFieldRoot|SamePaPhysicalFieldStep;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('occupied received controller original binding differs');};
const close=(a:number,b:number)=>Math.abs(a-b)<=Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b))*32;

/** Bind the explicit hold to the actually retained advance. Its accepted route,
 * body and calibrated prior/reaction/braking laws remain the sole motion model. */
export const deriveSamePaOccupiedRunnerCatchController=(a:SamePaOccupiedRunnerCatchResponseRequest,root:SamePaPhysicalFieldRoot,
  previous:Field,hold:DurableSamePaOccupiedRunnerHold,basis:SamePaLifecycleViewBasis,prefix:readonly Field[])=>{
  if(!a.motionBasis)throw new Error('occupied received moving basis missing');
  const incumbent=[...prefix].reverse().find(f=>f.kind==='same_pa_physical_field_step_v1'
    &&f.actionResult?.kind==='occupied_runner_motion_v1'&&f.actionResult.playerId===a.member.playerId);
  if(incumbent?.kind!=='same_pa_physical_field_step_v1'||incumbent.actionResult?.kind!=='occupied_runner_motion_v1'
    ||incumbent.source.action?.kind!=='occupied_runner_motion_v1')throw new Error('occupied received incumbent controller missing');
  same(a.motionBasis.motionReference,reference('pa_physical_v1_field_steps',incumbent));
  const old=incumbent.actionResult,playerId=a.member.playerId,parameters=hold.model.source.motion,moment=previous.field.motion.world.moment;
  same(a.holdReference,old.holdReference);same(old.controller.route,incumbent.source.action.route);
  const runner=basis.actor.world.runners.find(r=>r.playerId===playerId);
  if(!runner||playerId===basis.actor.binding.playerId||hold.source.playerId!==playerId||old.personId!==hold.source.personId
    ||hold.body.actor.playerId!==playerId||hold.body.actor.personId!==hold.source.personId
    ||parameters.ticksPerSecond!==root.response.world.parameters.ticksPerSecond)
    throw new Error('occupied received controller original identity or finite authority differs');
  same(runner.position,hold.setup.position);
  const startMotion={tick:a.intent.issuedTick,...sampleRunnerMotionTrajectoryExact(old.controller.trajectory,
    moment.elapsedSeconds-(old.controller.trajectory.startTick-moment.originTick)/parameters.ticksPerSecond)};
  const controller=buildRouteFollowingController({canonical:createCanonicalRunnerKinematicsFromRouteMotion(playerId,startMotion,
    old.controller.route,old.controller.basis.motionRevision+1),startMotion,route:old.controller.route,intent:a.intent,parameters,endTick:a.endTick});
  const fractional=moment.elapsedSeconds!==(a.intent.issuedTick-moment.originTick)/parameters.ticksPerSecond;
  const exactTrajectory=fractional?buildRunnerMotionTrajectoryAtExactOrigin(startMotion,a.intent,a.endTick,parameters,
    {originTick:moment.originTick,elapsedSeconds:moment.elapsedSeconds,tick:moment.ball.tick}):undefined;
  const trajectory=exactTrajectory??controller.trajectory,length=getRunnerRouteLength(controller.route);
  for(const s of trajectory.segments){const dt=s.endElapsedSeconds-s.startElapsedSeconds,end=s.startRouteDistanceMeters+s.startSpeedMps*dt+0.5*s.accelerationMps2*dt*dt;
    if(s.bodyMode!=='upright'||s.startRouteDistanceMeters<0||end<0||end>length)throw new Error('occupied received hold exceeds original finite upright route');}
  const actors=previous.field.motion.actors.filter(actor=>actor.playerId===playerId);
  if(actors.length!==5||new Set(actors.map(actor=>actor.primitive.role)).size!==5)throw new Error('occupied received controller five-part body missing');
  for(const actor of actors){
    const shape=hold.body.actor.primitives.find(p=>p.role===actor.primitive.role),state=samplePiecewiseFieldActor(actor,moment);
    if(!shape||shape.radius!==actor.primitive.radius||!close(state.center.x-shape.offset.x,controller.basis.position.x)
      ||!close(state.center.z-shape.offset.z,controller.basis.position.z)||!close(state.center.y-shape.offset.y,hold.body.actor.bodyOriginHeightMeters)
      ||!close(state.velocity.x,controller.basis.velocity.x)||!close(state.velocity.z,controller.basis.velocity.z)
      ||state.velocity.y!==0||actor.primitive.acceleration.y!==0)
      throw new Error('occupied received controller does not match actual body kinematics');
  }
  return{motionBasis:a.motionBasis,controller,...(exactTrajectory?{exactTrajectory}:{})};
};
