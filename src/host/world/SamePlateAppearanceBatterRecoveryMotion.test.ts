import { prepareBatterRunPlan } from './BatterRunPlan';
import { deriveSamePaBatterRunMotion } from './SamePlateAppearanceBatterRunMotion';
import { deriveSamePaLiveWorkCensus } from './SamePlateAppearanceLiveWorkCensus';
import { expect,it } from 'vitest';
import { samePaBatterRunFixture } from './SamePlateAppearanceBatterRunFixtures.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { deriveSamePaRunnerControllerMotion } from './SamePlateAppearanceRunnerControllerMotion';
import { samePaExactRunnerControllerCensus } from './SamePlateAppearanceExactRunnerControllerPiece';
import { buildRouteFollowingController, createCanonicalRunnerKinematicsFromRouteMotion } from '../../core/sim/running/RunnerLocomotionController';
import * as api from './SamePlateAppearanceBatterRecoveryMotion';
const invoke=()=>{expect(api.deriveSamePaBatterRecoveryMotion,'owned recovery motor missing').toBeTypeOf('function');return api.deriveSamePaBatterRecoveryMotion as Function;};
const fixture=(velocity={x:0,z:0},foreign=false)=>{
  const h=samePaBatterRunFixture(foreign),exit=h.plan.exitState;
  exit.source={...exit.source,sourceId:'exit',sourceVersion:'test'};exit.lineage=h.root.lineage;exit.physicalPitchReference={sourceId:'pitch'};
  exit.state={...exit.state,planarVelocity:velocity,bodyForwardUnit:{x:0,z:1}};exit.root.velocity={...velocity,y:0};
  h.root.field=structuredClone(h.root.field);h.root.field.motion.actors.filter((a:any)=>a.playerId==='batter').forEach((a:any)=>a.primitive.startVelocity={...velocity,y:0});
  exit.source.fieldReference=reference('pa_physical_v1_field_roots',h.root);
  exit.bodyMaterializationReference=reference('world_player_body_materializations',{source:{sourceId:'body',sourceVersion:'test'}} as any);
  exit.model.source.sourceId='transition';exit.model.source.sourceVersion='test';exit.source.transitionModelReference=reference('world_player_batter_run_transition_models',exit.model);
  const request={kind:'batter_recovery_motion_v1',exitStateReference:reference('world_batter_swing_exit_states',exit),bodyMaterializationReference:exit.bodyMaterializationReference,
    transitionModelReference:exit.source.transitionModelReference,route:h.plan.plan.timeline.route};
  return{...h,exit,source:{sourceId:'recover',sourceVersion:'test',throughTick:500_000,action:request}};
};
const completed=(h:ReturnType<typeof fixture>,value:any,id:string,source=h.source)=>({...h.root,kind:'same_pa_physical_field_step_v1',source:{...source,sourceId:id},...value});
it('BRM01 executes turn-only recovery with all five original fixed world-axis offsets',()=>{
  const h=fixture(),v=invoke()(h.source,h.root,h.root,h.exit,[h.root]);expect(v.actionResult.recoveryComplete).toBe(true);expect(v.evaluationTick).toBe(500_000);
  for(const a of v.field.motion.actors){expect(samplePiecewiseFieldActor(a,v.field.motion.world.moment).center).toEqual(h.root.field.motion.actors.find((b:any)=>b.primitive.role===a.primitive.role).primitive.startCenter);}
  expect(h.plan.plan.motionExecuted).toBe(false);
});
it.each([{x:0,z:1},{x:-1,z:0},{x:-1,z:1}])('BRM02 preserves fractional adverse knots and completes every actual piece for %j',velocity=>{
  const h=fixture(velocity,true),prefix:any[]=[h.root];h.source.throughTick=1_000_000;let previous=h.root,n=0;
  while(true){const value=invoke()(h.source,h.root,previous,h.exit,prefix);previous=completed(h,value,'piece'+n++);prefix.push(previous);
    expect(value.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(prefix.at(-2).field.motion.world.moment.elapsedSeconds);
    if(value.actionResult.recoveryComplete)break;expect(n).toBeLessThan(6);
  }
  expect(n).toBeGreaterThan(1);const body=previous.field.motion.actors.find((a:any)=>a.primitive.role==='body');
  expect(samplePiecewiseFieldActor(body,previous.field.motion.world.moment).velocity.z).toBeCloseTo(0,12);
  expect(samplePiecewiseFieldActor(body,previous.field.motion.world.moment).velocity.x).toBeCloseTo(0,12);
  const proof=api.assertSamePaBatterRecoveryComplete(prefix,h.exit,h.source.action.route,previous.evaluationTick);
  expect(proof.recoveryReference).toEqual(reference('pa_physical_v1_field_steps',previous));
});
it.each(['body','model','exit','pose','late','caught','route'] as const)('BRM03 rejects %s recovery laundering',fault=>{
  const h=fixture(),prefix:any[]=[h.root];
  if(fault==='body')h.source.action.bodyMaterializationReference={...h.source.action.bodyMaterializationReference,sourceId:'wrong'};
  if(fault==='model')h.source.action.transitionModelReference={...h.source.action.transitionModelReference,sourceId:'wrong'};
  if(fault==='exit')h.source.action.exitStateReference={...h.source.action.exitStateReference,sourceId:'wrong'};
  if(fault==='pose')h.root.field.motion.actors[0].primitive.startCenter.z=1;
  if(fault==='route')h.source.action.route={segments:[{kind:'line',start:{x:1,z:0},end:{x:30,z:0}}]};
  if(fault==='late')h.root.field.motion.world.moment.elapsedSeconds=0.1,h.root.field.motion.world.moment.ball.tick=100_000,h.root.evaluationTick=100_000;
  if(fault==='caught')prefix.push({...h.root,kind:'same_pa_physical_field_step_v1',source:{sourceId:'caught',sourceVersion:'test'},actionResult:{kind:'batter_catch_response_v1',playerId:'batter'}});
  const fn=invoke();expect(()=>fn(h.source,h.root,prefix.at(-1),h.exit,prefix)).toThrow();
});
it('BRM04 never treats a partial checkpoint or isolated matching endpoint as completed recovery',()=>{
  const h=fixture(),fn=invoke(),source={...h.source,throughTick:250_000},partial=completed(h,fn(source,h.root,h.root,h.exit,[h.root]),'partial',source);
  expect(partial.actionResult.recoveryComplete).toBe(false);
  expect(()=>api.assertSamePaBatterRecoveryComplete([h.root,partial],h.exit,h.source.action.route,250_000)).toThrow(/complete/);
  expect(()=>api.assertSamePaBatterRecoveryComplete([h.root],h.exit,h.source.action.route,500_000)).toThrow(/complete/);
});

it('BRM05 a real ball contact interrupts recovery and cannot certify its remaining history',()=>{
  const h=fixture({x:0,z:1});const ball=h.root.field.motion.world.moment.ball;ball.position={x:0,y:1,z:0.12};ball.velocity={x:0,y:0,z:0};
  h.exit.source.fieldReference=reference('pa_physical_v1_field_roots',h.root);h.source.action.exitStateReference=reference('world_batter_swing_exit_states',h.exit);
  const value=invoke()(h.source,h.root,h.root,h.exit,[h.root]);expect(value.field.motion.world.kind).toBe('boundary');expect(value.actionResult.recoveryComplete).toBe(false);
  expect(value.field.motion.world.moment.elapsedSeconds).toBeLessThan(0.1);
});
it('BRM06 refuses to resume after a received hold even when the physical endpoint still matches',()=>{
  const h=fixture(),source={...h.source,throughTick:250_000},first=completed(h,invoke()(source,h.root,h.root,h.exit,[h.root]),'first',source);
  const held={...first,source:{sourceId:'held',sourceVersion:'test'},actionResult:{kind:'batter_catch_response_v1',playerId:'batter'}};
  expect(()=>invoke()(h.source,h.root,held,h.exit,[h.root,first,held])).toThrow(/superseded/);
});
it('BRM07 retains exact adverse-piece identity after a nonzero physical time origin offset',()=>{
  const h=fixture({x:0,z:1}),start=123456;
  h.root.evaluationTick=start;h.root.field.motion.world.moment.elapsedSeconds=start/1_000_000;h.root.field.motion.world.moment.ball.tick=start;
  h.root.field.motion.actors.forEach((a:any)=>{a.primitive.startTick=start;});h.exit.state.tick=start;
  h.exit.source.fieldReference=reference('pa_physical_v1_field_roots',h.root);h.source.action.exitStateReference=reference('world_batter_swing_exit_states',h.exit);
  h.source.throughTick=start+1_000_000;let previous=h.root;const prefix:any[]=[h.root];let n=0;
  while(true){const value=invoke()(h.source,h.root,previous,h.exit,prefix);previous=completed(h,value,'offset'+n++);prefix.push(previous);
    if(value.actionResult.recoveryComplete)break;expect(n).toBeLessThan(7);
  }
  expect(api.assertSamePaBatterRecoveryComplete(prefix,h.exit,h.source.action.route,previous.evaluationTick).recoveryLaunchTick).toBe(previous.evaluationTick);
});

it('BRM08 completes forward fractional recovery at actual T with no ceil-gap hold or coast',()=>{
  const h=fixture({x:1,z:0});h.exit.model.source.parameters.maximumBodyTurnRateRadiansPerSecond=1;
  h.exit.source.transitionModelReference=reference('world_player_batter_run_transition_models',h.exit.model);h.source.action.transitionModelReference=h.exit.source.transitionModelReference;
  h.source.action.exitStateReference=reference('world_batter_swing_exit_states',h.exit);h.source.throughTick=2_000_000;
  const value=invoke()(h.source,h.root,h.root,h.exit,[h.root]),last=completed(h,value,'fractional-launch');
  expect(value.actionResult.recoveryComplete).toBe(true);expect(value.field.motion.world.moment.elapsedSeconds).toBe(Math.PI/2);
  expect(value.field.motion.world.moment.elapsedSeconds).toBeLessThan(value.evaluationTick/1_000_000);
  const body=value.field.motion.actors.find((a:any)=>a.primitive.role==='body'),state=samplePiecewiseFieldActor(body,value.field.motion.world.moment);
  expect(state.center.x).toBeCloseTo(Math.PI/2+0.1,12);expect(state.velocity.x).toBe(1);
  const proof=api.assertSamePaBatterRecoveryComplete([h.root,last],h.exit,h.source.action.route,last.evaluationTick);
  expect(proof.at).toEqual({originTick:0,elapsedSeconds:Math.PI/2,tick:last.evaluationTick});
});

it.each([0,100_000])('BRM09 the exact recovery origin preserves absolute issuance and reaction with delay %s',reactionDelayTicks=>{
  const h=fixture({x:1,z:0},true);h.root.operationOrdinal=0;h.root.pitchOrdinal=1;h.root.source.parameters=h.root.response.world.parameters;
  h.exit.model.source.parameters.maximumBodyTurnRateRadiansPerSecond=1;
  h.exit.model.runnerModel.source.motion={...h.exit.model.runnerModel.source.motion,reactionDelayTicks};
  h.exit.source.fieldReference=reference('pa_physical_v1_field_roots',h.root);
  h.exit.source.transitionModelReference=reference('world_player_batter_run_transition_models',h.exit.model);
  h.source.action.transitionModelReference=h.exit.source.transitionModelReference;h.source.action.exitStateReference=reference('world_batter_swing_exit_states',h.exit);
  const prefix:any[]=[h.root];
  const append=(value:any,action:any,id:string,throughTick:number)=>{
    const prev=prefix.at(-1),prior=reference(prev.kind==='same_pa_physical_field_root_v1'?'pa_physical_v1_field_roots':'pa_physical_v1_field_steps',prev);
    const field={...prev,...value,kind:'same_pa_physical_field_step_v1',operationOrdinal:prev.operationOrdinal+1,
      source:{sourceId:id,sourceVersion:'test',throughTick,action,previousFieldReference:prior,previousOperationReference:prior,fieldRootReference:reference('pa_physical_v1_field_roots',h.root)}};
    prefix.push(field);return field;
  };
  const recovered=append(invoke()({...h.source,throughTick:2_000_000},h.root,h.root,h.exit,prefix),h.source.action,'recovered',2_000_000);
  const proof=api.assertSamePaBatterRecoveryComplete(prefix,h.exit,h.source.action.route,recovered.evaluationTick),T=proof.at.elapsedSeconds;
  const plan:any={...h.plan,exitState:h.exit,completedRecovery:proof,source:{...h.plan.source,completedRecoveryReference:proof.recoveryReference},
    plan:prepareBatterRunPlan(h.exit,{playerId:'batter',personId:'person',route:h.source.action.route,intent:{kind:'advance',issuedTick:recovered.evaluationTick},endTick:3_000_000})};
  const request={kind:'batter_run_motion_v1' as const,planReference:reference('world_batter_run_plans',plan)};
  const move=(throughTick:number,id:string)=>append(deriveSamePaBatterRunMotion({throughTick,action:request} as any,h.root,prefix.at(-1),plan,prefix),request,id,throughTick);
  const adopted=move(recovered.evaluationTick,'adopted'),dt=adopted.field.motion.world.moment.elapsedSeconds-T;
  expect(dt).toBeGreaterThan(0);expect(dt).toBeLessThan(0.000001);
  const body=adopted.field.motion.actors.find((a:any)=>a.playerId==='batter'&&a.primitive.role==='body');
  const actual=samplePiecewiseFieldActor(body,adopted.field.motion.world.moment);
  expect(actual.center.x).toBeCloseTo(T+0.1+dt-1.5*dt*dt,12);expect(actual.velocity.x).toBeCloseTo(1-3*dt,12);
  // The existing prior control brakes through issuance even with zero delay.
  // Recovery completion supplies the physical origin, not an earlier intent.
  expect(body.primitive.acceleration.x).toBe(-3);
  const reactionTick=recovered.evaluationTick+reactionDelayTicks;
  const reaction=reactionDelayTicks===0?adopted:move(reactionTick,'reaction');
  expect(reaction.field.motion.world.moment.elapsedSeconds).toBe(reactionTick/1_000_000);
  const atReaction=samplePiecewiseFieldActor(reaction.field.motion.actors.find((a:any)=>a.playerId==='batter'&&a.primitive.role==='body'),reaction.field.motion.world.moment);
  expect(atReaction.velocity.x).toBeCloseTo(1-3*(reactionTick/1_000_000-T),12);
  const resumed=move(reaction.evaluationTick+1,'after-reaction');
  expect(resumed.actionResult.controllerSegmentIndex).toBe(1);
  const after=samplePiecewiseFieldActor(resumed.field.motion.actors.find((a:any)=>a.playerId==='batter'&&a.primitive.role==='body'),resumed.field.motion.world.moment);
  expect(after.velocity.x).toBeGreaterThan(atReaction.velocity.x);
  const census=deriveSamePaLiveWorkCensus({fields:prefix,participantIds:['batter','fielder'],observationPolicies:[],
    possessionEvidence:{policy:'scheduled_capture_confirmation_v1',originTick:0,ticksPerSecond:1_000_000,throughElapsedSeconds:resumed.field.motion.world.moment.elapsedSeconds,pending:[]}});
  expect(census.batterRecovery).toMatchObject({phaseComplete:true,postLaunchConsumer:reference('pa_physical_v1_field_steps',adopted)});
  expect(census.exactRunnerControllerPieces![0].due).toBe('future');
});

it('BRM10 recovery renews at a simultaneous foreign knot without consuming the foreign obligation',()=>{
  const h=fixture({x:0,z:1},true),prefix:any[]=[h.root],initialSource={...h.source,throughTick:0};
  const initial=completed(h,invoke()(initialSource,h.root,h.root,h.exit,prefix),'recovery-adoption',initialSource);prefix.push(initial);
  const knot=initial.actionResult.exactControllerPiece.coverageThroughElapsedSeconds,throughTick=Math.ceil(knot*1_000_000);
  const parameters={...h.plan.plan.timeline.runnerMotionParameters,topSpeedMps:2*knot};
  const startMotion={tick:0,routeDistanceMeters:0,speedMps:0,driveDirection:0 as const,bodyMode:'upright' as const};
  const route={segments:[{kind:'line' as const,start:{x:50,z:0},end:{x:80,z:0}}]};
  const controller=buildRouteFollowingController({canonical:createCanonicalRunnerKinematicsFromRouteMotion('fielder',startMotion,route,0),
    startMotion,route,intent:{kind:'advance',issuedTick:0},parameters,endTick:3_000_000});
  const move=(throughTick:number)=>{
    const previous=prefix.at(-1),v=deriveSamePaRunnerControllerMotion({root:h.root,previous,prefix,throughTick,controller,
      runnerMotionParameters:parameters,body:{...h.exit.body,playerId:'fielder'},rootHeightMeters:1});
    const f={...previous,...v,source:{sourceId:'foreign-'+prefix.length,sourceVersion:'test'},actionResult:{kind:'batter_run_motion_v1',
      playerId:'fielder',coverageThroughTick:v.coverageThroughTick,exactControllerPiece:v.exactControllerPiece}};prefix.push(f);return f;
  };
  move(0);const at=move(throughTick);expect(samePaExactRunnerControllerCensus(prefix).map(w=>w.due)).toEqual(['due','due']);
  const source={...h.source,throughTick},renewed=completed(h,invoke()(source,h.root,at,h.exit,prefix),'recovery-renewal',source);prefix.push(renewed);
  expect(renewed.field.motion.world.moment).toEqual(at.field.motion.world.moment);
  expect(renewed.field.motion.actors.filter((a:any)=>a.playerId==='fielder')).toEqual(at.field.motion.actors.filter((a:any)=>a.playerId==='fielder'));
  expect(renewed.actionResult.recoveryComplete).toBe(false);
  expect(samePaExactRunnerControllerCensus(prefix).map(w=>w.due)).toEqual(['future','due']);
  expect(move(throughTick).field.motion.world.moment.elapsedSeconds).toBeGreaterThan(knot);
});
