import { expect, it } from 'vitest';
import { samePaBatterRunFixture } from './SamePlateAppearanceBatterRunFixtures.test-support';
import { prepareBatterRunPlan } from './BatterRunPlan';
import { deriveSamePaBatterRunMotion } from './SamePlateAppearanceBatterRunMotion';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaExactRunnerControllerCensus, assertSamePaExactRunnerControllerOwnership } from './SamePlateAppearanceExactRunnerControllerPiece';
import { deriveBattedWorldFieldMotionAdoption, deriveBattedWorldFieldMotionExactCheckpointV1 } from '../../core/sim/ball/BattedWorldFieldMotion';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { deriveSamePaRunnerControllerMotion } from './SamePlateAppearanceRunnerControllerMotion';
import { buildRouteFollowingController, createCanonicalRunnerKinematicsFromRouteMotion } from '../../core/sim/running/RunnerLocomotionController';
const setup=()=>{
  const h=structuredClone(samePaBatterRunFixture());h.plan.exitState.model.runnerModel.source.motion.accelerationMps2=3;
  h.plan.plan=prepareBatterRunPlan(h.plan.exitState,{playerId:'batter',personId:'person',route:{segments:[{kind:'line',start:{x:0,z:0},end:{x:30,z:0}}]},intent:{kind:'advance',issuedTick:0},endTick:3_000_000});
  h.source.action.planReference=reference('world_batter_run_plans',h.plan);h.source.throughTick=1_666_667;
  return h;
};
it('exact runner coverage stops at the analytic knot, preserves every part and fences generic later progress',()=>{
  const h=setup(),value=deriveSamePaBatterRunMotion(h.source,h.root,h.root,h.plan,[h.root]);
  expect(value.field.motion.world.moment.elapsedSeconds).toBe(5/3);expect(value.evaluationTick).toBe(1_666_667);
  const step={...h.root,...value,kind:'same_pa_physical_field_step_v1',source:{...h.source,sourceId:'exact-piece',sourceVersion:'test'}};
  for(const actor of value.field.motion.actors)expect(samplePiecewiseFieldActor(actor,value.field.motion.world.moment).velocity.x).toBeCloseTo(5,12);
  expect(samePaExactRunnerControllerCensus([h.root,step])[0]).toMatchObject({dueElapsedSeconds:5/3,due:'due'});
  expect(()=>assertSamePaExactRunnerControllerOwnership({throughTick:1_666_667} as any,[h.root,step])).toThrow(/next owned motor/);
  const next=deriveSamePaBatterRunMotion(h.source,h.root,step,h.plan,[h.root,step]);
  expect(next.evaluationTick).toBe(1_666_667);expect(next.field.motion.world.moment.elapsedSeconds).toBe(1.666667);
  expect(next.actionResult).toMatchObject({controllerSegmentIndex:1,planThroughTick:3_000_000});
});
it('exact runner execution returns the first genuine contact before its knot',()=>{
  const h=setup(),ball={...h.root.response.world.flight.initialBall,position:{x:1,y:1,z:0},velocity:{x:-1,y:0,z:0}};
  h.root.response.world.flight.initialBall=ball;
  const original=h.root.field.motion;
  h.root.field=deriveBattedWorldFieldMotionAdoption({response:h.root.response,geometry:h.root.geometry,actors:original.actors,
    carrierPlayerId:null,cursor:{moment:{originTick:0,elapsedSeconds:0,ball},previousContacts:[]},availableAtTick:0,coverageThroughTick:5_000_000,
    commands:original.actors.map((a:any)=>({playerId:a.playerId,role:a.primitive.role,acceleration:a.primitive.acceleration}))});
  h.plan.exitState.source.fieldReference=reference('pa_physical_v1_field_roots',h.root);
  h.source.action.planReference=reference('world_batter_run_plans',h.plan);
  const value=deriveSamePaBatterRunMotion(h.source,h.root,h.root,h.plan,[h.root]);
  expect(value.field.motion.world.kind).toBe('boundary');
  expect(value.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(0);
  expect(value.field.motion.world.moment.elapsedSeconds).toBeLessThan(5/3);
  if(value.field.motion.world.kind!=='boundary')throw new Error('contact missing');
  expect(value.field.motion.world.contacts.some(c=>c.kind==='actor'&&c.playerId==='batter')).toBe(true);
  expect(value.actionResult.exactControllerPiece!.coverageThroughElapsedSeconds).toBe(5/3);
  const first={...h.root,...value,kind:'same_pa_physical_field_step_v1',source:{...h.source,sourceId:'contact-piece',sourceVersion:'test'}};
  expect(value.field.motion.cursor).not.toBeNull();
  const next=deriveSamePaBatterRunMotion(h.source,h.root,first,h.plan,[h.root,first]);
  expect(next.field.motion.world.moment.elapsedSeconds).toBeGreaterThanOrEqual(value.field.motion.world.moment.elapsedSeconds);
  expect(value.field.motion.world.kind).toBe('boundary');
});
it('exact command adoption permits zero elapsed progress without moving the ball or completing its future piece',()=>{
  const h=setup(),first=deriveSamePaBatterRunMotion(h.source,h.root,h.root,h.plan,[h.root]),m=first.field.motion;
  const field=deriveBattedWorldFieldMotionExactCheckpointV1({response:h.root.response,geometry:h.root.geometry,actors:m.actors,
    cursor:m.cursor!,carrierPlayerId:null,availableAtTick:0,coverageThroughTick:3_000_000,
    checkpointThroughElapsedSeconds:m.world.moment.elapsedSeconds,
    commands:m.actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:{x:0,y:0,z:0}}))});
  expect(field.motion.world.moment).toEqual(m.world.moment);
  for(const actor of field.motion.actors)expect(samplePiecewiseFieldActor(actor,field.motion.world.moment).velocity.x).toBeCloseTo(5,12);
  expect(field.motion.actors.every(a=>a.primitive.acceleration.x===0)).toBe(true);
});
it('legacy whole-tick accepted results retain their prior shape',()=>{
  const h=samePaBatterRunFixture(),value=deriveSamePaBatterRunMotion(h.source,h.root,h.root,h.plan,[h.root]);
  expect(value.actionResult).not.toHaveProperty('exactControllerPiece');
  expect(samePaExactRunnerControllerCensus([h.root])).toEqual([]);
});

it('an explicit fractional adoption retains its occurrence tick and rejects later availability in the same tick',()=>{
  const h=setup(),first=deriveSamePaBatterRunMotion(h.source,h.root,h.root,h.plan,[h.root]),m=first.field.motion;
  const request={response:h.root.response,geometry:h.root.geometry,actors:m.actors,cursor:m.cursor!,carrierPlayerId:null,
    availableAtTick:m.world.moment.ball.tick,availableAtElapsedSeconds:m.world.moment.elapsedSeconds,coverageThroughTick:3_000_000,
    checkpointThroughElapsedSeconds:m.world.moment.elapsedSeconds,
    commands:m.actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:{x:0,y:0,z:0}}))};
  expect(deriveBattedWorldFieldMotionExactCheckpointV1(request).motion.world.moment).toEqual(m.world.moment);
  expect(()=>deriveBattedWorldFieldMotionExactCheckpointV1({...request,availableAtElapsedSeconds:1.666666})).toThrow(/occurrence tick/);
  expect(()=>deriveBattedWorldFieldMotionExactCheckpointV1({...request,availableAtElapsedSeconds:request.availableAtElapsedSeconds+1e-8})).toThrow(/interval/);
});

it.each(['future-command','backdated-query','past-coverage','missing-part'] as const)('exact command checkpoint rejects %s',fault=>{
  const h=setup(),first=deriveSamePaBatterRunMotion(h.source,h.root,h.root,h.plan,[h.root]),m=first.field.motion;
  const request:any={response:h.root.response,geometry:h.root.geometry,actors:m.actors,cursor:m.cursor,
    carrierPlayerId:null,availableAtTick:0,coverageThroughTick:3_000_000,checkpointThroughElapsedSeconds:2,
    commands:m.actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:{x:0,y:0,z:0}}))};
  if(fault==='future-command')request.availableAtTick=2_000_000;
  if(fault==='backdated-query')request.checkpointThroughElapsedSeconds=1;
  if(fault==='past-coverage')request.checkpointThroughElapsedSeconds=4;
  if(fault==='missing-part')request.actors=request.actors.slice(1);
  expect(()=>deriveBattedWorldFieldMotionExactCheckpointV1(request)).toThrow();
});

it('two independently owned exact knots renew one owner at the same cut without advancing or renewing the other',()=>{
  const h=samePaBatterRunFixture(true),prefix:any[]=[h.root];
  const parameters={...h.plan.plan.timeline.runnerMotionParameters,accelerationMps2:3};
  const controllers=['batter','fielder'].map(playerId=>{
    const x=playerId==='batter'?0:50,route={segments:[{kind:'line' as const,start:{x,z:0},end:{x:x+30,z:0}}]};
    const startMotion={tick:0,routeDistanceMeters:0,speedMps:0,driveDirection:0 as const,bodyMode:'upright' as const};
    return buildRouteFollowingController({canonical:createCanonicalRunnerKinematicsFromRouteMotion(playerId,startMotion,route,0),
      startMotion,route,intent:{kind:'advance',issuedTick:0},parameters,endTick:3_000_000});
  });
  const move=(index:number,throughTick:number)=>{
    const controller=controllers[index],previous=prefix.at(-1),value=deriveSamePaRunnerControllerMotion({root:h.root,previous,prefix,throughTick,
      controller,runnerMotionParameters:parameters,body:{...h.plan.exitState.body,playerId:controller.basis.playerId},rootHeightMeters:1});
    const step={...previous,...value,kind:'same_pa_physical_field_step_v1',source:{sourceId:'dual-'+prefix.length,sourceVersion:'test'},
      actionResult:{kind:'batter_run_motion_v1',playerId:controller.basis.playerId,coverageThroughTick:value.coverageThroughTick,exactControllerPiece:value.exactControllerPiece}};
    prefix.push(step);return step;
  };
  move(0,0);move(1,0);const knot=move(0,1_666_667);
  expect(samePaExactRunnerControllerCensus(prefix).map(w=>w.due)).toEqual(['due','due']);
  const foreign=knot.field.motion.actors.filter((a:any)=>a.playerId==='fielder'),renewed=move(0,1_666_667);
  expect(renewed.field.motion.world.moment).toEqual(knot.field.motion.world.moment);
  expect(renewed.field.motion.cursor.previousContacts).toEqual(knot.field.motion.cursor.previousContacts);
  expect(renewed.field.motion.actors.filter((a:any)=>a.playerId==='fielder')).toEqual(foreign);
  expect(renewed.field.motion.actors.filter((a:any)=>a.playerId==='batter').every((a:any)=>a.primitive.acceleration.x===0)).toBe(true);
  expect(samePaExactRunnerControllerCensus(prefix).map(w=>[w.playerId,w.due,w.dueElapsedSeconds])).toEqual([
    ['batter','future',3],['fielder','due',5/3]]);
  expect(()=>assertSamePaExactRunnerControllerOwnership({throughTick:1_666_667} as any,prefix)).toThrow(/next owned motor/);
  const resumed=move(1,1_666_667);
  expect(resumed.field.motion.world.moment.elapsedSeconds).toBe(1.666667);
  expect(samePaExactRunnerControllerCensus(prefix).map(w=>w.due)).toEqual(['future','future']);
  for(const a of resumed.field.motion.actors)expect(samplePiecewiseFieldActor(a,resumed.field.motion.world.moment).velocity.x).toBe(5);
});
