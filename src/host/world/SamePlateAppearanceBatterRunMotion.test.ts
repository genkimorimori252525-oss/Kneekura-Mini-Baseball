import { expect,it } from 'vitest';
import * as motors from './SamePlateAppearancePhysicalFieldMotor';
import { samePaPhysicalFieldActionInput } from './SamePlateAppearancePhysicalFieldAction';
import { prepareBatterRunPlan } from './BatterRunPlan';
import { deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { buildRouteFollowingController, sampleRouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { sampleRunnerMotionTrajectory } from '../../core/sim/running/RunnerMotion';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { deriveSamePaRunnerControllerMotion } from './SamePlateAppearanceRunnerControllerMotion';
import { samePaBatterRunFixture as fixture } from './SamePlateAppearanceBatterRunFixtures.test-support';
const zero={x:0,y:0,z:0};
const invoke=()=>{const fn=(motors as unknown as {deriveSamePaBatterRunMotion?:Function}).deriveSamePaBatterRunMotion;
  expect(fn,'owned batter runner motor adoption is missing').toBeTypeOf('function');return fn!;};
it('BRF01 accepts the explicit runner plan reference in the physical action Source',()=>{
  expect(()=>samePaPhysicalFieldActionInput(fixture().source.action)).not.toThrow();
});
it('BRF02 executes a bounded runner piece with all five original body parts',()=>{
  const fn=invoke(),h=fixture(),value=fn(h.source,h.root,h.root,h.plan,[h.root]);
  expect(value.evaluationTick).toBe(500_000);expect(value.actionResult.kind).toBe('batter_run_motion_v1');
  expect(value.actionResult.coverageThroughTick).toBe(2_500_000);expect(value.actionResult.planThroughTick).toBe(3_000_000);
  const body=value.field.motion.actors.find((a:any)=>a.primitive.role==='body').primitive;
  expect(body.acceleration.x).toBe(2);expect(body.startCenter.x+body.startVelocity.x*0.5+0.5*body.acceleration.x*0.25).toBeCloseTo(0.35);
  expect(value.field.motion.actors).toHaveLength(5);
});
it.each(['boundary','pose','recovery'] as const)('BRF03 rejects %s without inventing body coverage',fault=>{
  const fn=invoke(),h=fixture();if(fault==='boundary')h.source.throughTick=2_500_001;
  if(fault==='pose')h.root.field=structuredClone(h.root.field),h.root.field.motion.actors[0].primitive.startCenter.z=1;
  if(fault==='recovery')h.plan.plan={...h.plan.plan,physicalBinding:'swing_recovery_pose_binding_required'};
  expect(()=>fn(h.source,h.root,h.root,h.plan,[h.root])).toThrow();
});

const completed=(h:ReturnType<typeof fixture>,value:any,id:string)=>({...h.root,kind:'same_pa_physical_field_step_v1',source:{...h.source,sourceId:id,sourceVersion:'test'},...value});
it('BRF04 repeats the original plan across its analytic boundary without treating future coverage as execution',()=>{
  const fn=invoke(),h=fixture();h.source.throughTick=2_500_000;
  const first=completed(h,fn(h.source,h.root,h.root,h.plan,[h.root]),'piece1');
  expect(first.actionResult.planThroughTick).toBe(3_000_000);expect(first.evaluationTick).toBe(2_500_000);
  const next=fn({...h.source,throughTick:3_000_000},h.root,first,h.plan,[h.root,first]);
  expect(next.evaluationTick).toBe(3_000_000);expect(next.actionResult.controllerSegmentIndex).toBe(1);
  const body=next.field.motion.actors.find((a:any)=>a.primitive.role==='body').primitive;
  expect(body.startVelocity.x).toBe(5);expect(body.acceleration.x).toBe(0);
  expect(body.startCenter.x).toBeCloseTo(6.35);
});
it('BRF05 retains still-owned foreign horizons across a runner-only rebase',()=>{
  const fn=invoke(),h=fixture(true);h.source.throughTick=2_500_000;
  const first=completed(h,fn(h.source,h.root,h.root,h.plan,[h.root]),'piece1');
  const next=fn({...h.source,throughTick:3_000_000},h.root,first,h.plan,[h.root,first]);
  expect(next.evaluationTick).toBe(3_000_000);
  expect(next.field.motion.actors.filter((a:any)=>a.playerId==='fielder')).toHaveLength(5);
});
const hold=(previous:any)=>({...previous,source:{sourceId:'hold',sourceVersion:'test'},actionResult:{kind:'defender_decision_v1',playerId:'fielder',
  target:null,calculation:{selected:{intent:{kind:'hold'}},scheduling:{movementStartTick:previous.evaluationTick}}}});
it('BRF06 accepts a due original stationary hold when foreign actor coverage is exhausted',()=>{
  const fn=invoke(),h=fixture(true,2_500_000);h.source.throughTick=2_500_000;
  const first=completed(h,fn(h.source,h.root,h.root,h.plan,[h.root]),'piece1'),decision=hold(first);
  const source={...h.source,throughTick:3_000_000,action:{...h.source.action,stationaryHoldContinuations:[{playerId:'fielder',throughTick:3_000_000,decisionReference:reference('pa_physical_v1_field_steps',decision)}]}};
  expect(()=>samePaPhysicalFieldActionInput(source.action)).not.toThrow();
  const next=fn(source,h.root,decision,h.plan,[h.root,first,decision]);expect(next.evaluationTick).toBe(3_000_000);
});
it('BRF07 never renews an exhausted foreign command without a separately accepted continuation',()=>{
  const fn=invoke(),h=fixture(true,2_500_000);
  h.source.throughTick=2_500_000;const first=completed(h,fn(h.source,h.root,h.root,h.plan,[h.root]),'piece1');
  expect(()=>fn({...h.source,throughTick:3_000_000},h.root,first,h.plan,[h.root,first])).toThrow(/coverage|continuation/);
});

it.each(['accelerating','moving','not-due','not-hold','missing-decision'] as const)('BRF08 rejects %s foreign renewal despite an accepted horizon',fault=>{
  const fn=invoke(),h=fixture(true,2_500_000);h.source.throughTick=2_500_000;
  const first=completed(h,fn(h.source,h.root,h.root,h.plan,[h.root]),'piece1'),decision=hold(first);
  if(fault==='not-due')decision.actionResult.calculation.scheduling.movementStartTick=3_000_001;
  if(fault==='not-hold')decision.actionResult.calculation.selected.intent.kind='ball_handler';
  if(fault==='moving'||fault==='accelerating'){decision.field=structuredClone(decision.field);decision.field.motion.actors=decision.field.motion.actors.map((a:any)=>a.playerId==='fielder'?{...a,primitive:{...a.primitive,[fault==='moving'?'startVelocity':'acceleration']:{x:1,y:0,z:0}}}:a);}
  const source={...h.source,throughTick:3_000_000,action:{...h.source.action,stationaryHoldContinuations:[{playerId:'fielder',throughTick:3_000_000,decisionReference:reference('pa_physical_v1_field_steps',decision)}]}};
  if(fault==='missing-decision')source.action.stationaryHoldContinuations[0].decisionReference={...source.action.stationaryHoldContinuations[0].decisionReference,sourceId:'foreign'};
  expect(()=>fn(source,h.root,decision,h.plan,[h.root,first,decision])).toThrow(/hold|continuation/);
});

it('BRF09 executes the same issued runner plan past first base through two actual pieces',()=>{
  const fn=invoke(),h=fixture(true);
  h.plan.plan=prepareBatterRunPlan(h.plan.exitState,{playerId:'batter',personId:'person',route:{segments:[{kind:'line',start:{x:0,z:0},end:{x:35,z:0}}]},intent:{kind:'advance',issuedTick:0},endTick:7_000_000});
  h.source.action.planReference=reference('world_batter_run_plans',h.plan);h.source.throughTick=2_500_000;
  const first=completed(h,fn(h.source,h.root,h.root,h.plan,[h.root]),'piece1'),decision=hold(first);
  const next=fn({...h.source,throughTick:7_000_000,action:{...h.source.action,stationaryHoldContinuations:[{playerId:'fielder',throughTick:7_000_000,decisionReference:reference('pa_physical_v1_field_steps',decision)}]}},h.root,decision,h.plan,[h.root,first,decision]);
  expect(next.evaluationTick).toBe(7_000_000);expect(next.field.motion.world.kind).toBe('moving');
  const body=next.field.motion.actors.find((a:any)=>a.playerId==='batter'&&a.primitive.role==='body'),dt=next.field.motion.world.moment.elapsedSeconds-body.startElapsedSeconds;
  expect(body.primitive.startCenter.x+body.primitive.startVelocity.x*dt).toBeCloseTo(28.85);
  expect(h.plan.plan.motionExecuted).toBe(false);expect(next.actionResult.planReference).toEqual(h.source.action.planReference);
});
it('BRF10 never resurrects an older foreign horizon after a later physical command replaces it',()=>{
  const fn=invoke(),h=fixture(true),first=completed(h,fn(h.source,h.root,h.root,h.plan,[h.root]),'piece1'),motion=first.field.motion;
  const field=deriveBattedWorldFieldMotionCheckpoint({response:h.root.response,geometry:h.root.geometry,actors:motion.actors,cursor:motion.cursor,
    carrierPlayerId:null,availableAtTick:500_000,coverageThroughTick:750_000,checkpointThroughTick:600_000,
    commands:motion.actors.map((a:any)=>({playerId:a.playerId,role:a.primitive.role,acceleration:a.primitive.acceleration}))});
  const changed={...first,source:{sourceId:'new-defender-command',sourceVersion:'test',action:{kind:'defender_motion_v1'}},field,evaluationTick:600_000,actionResult:{kind:'defender_motion_v1'}};
  expect(()=>fn({...h.source,throughTick:1_000_000},h.root,changed,h.plan,[h.root,first,changed])).toThrow(/coverage/);
});
it('BRF11 cannot revive a pre-call hold while a newer received caught response owns control',()=>{
  const fn=invoke(),h=fixture(true,2_500_000);h.source.throughTick=2_500_000;
  const first=completed(h,fn(h.source,h.root,h.root,h.plan,[h.root]),'piece1'),decision=hold(first);
  const caught={...decision,source:{sourceId:'received-caught-response',sourceVersion:'test'},
    actionResult:{kind:'defender_catch_response_v1',playerId:'fielder',replan:{phase:'decision_pending'},issuedBySourceId:null}};
  const source={...h.source,throughTick:3_000_000,action:{...h.source.action,stationaryHoldContinuations:[{playerId:'fielder',throughTick:3_000_000,decisionReference:reference('pa_physical_v1_field_steps',decision)}]}};
  expect(()=>fn(source,h.root,caught,h.plan,[h.root,first,decision,caught])).toThrow(/latest due owned decision/);
});

it('BRF12 reuses the original physical binding for a real hold controller without a batter-run plan',()=>{
  const h=fixture(),first=completed(h,invoke()({...h.source,throughTick:1_500_000},h.root,h.root,h.plan,[h.root]),'before-hold');
  const timeline=h.plan.plan.timeline,runnerMotionParameters=timeline.runnerMotionParameters;
  const canonical=sampleRouteFollowingController(timeline.postLaunchController,timeline.launchKinematics,first.evaluationTick);
  const controller=buildRouteFollowingController({canonical,startMotion:sampleRunnerMotionTrajectory(timeline.postLaunchTrajectory,first.evaluationTick),
    route:timeline.route,intent:{kind:'hold',issuedTick:first.evaluationTick},parameters:runnerMotionParameters,endTick:3_000_000});
  const input={root:h.root,previous:first,prefix:[h.root,first],throughTick:2_000_000,controller,runnerMotionParameters,body:h.plan.exitState.body,rootHeightMeters:1};
  const value=deriveSamePaRunnerControllerMotion(input),body=value.field.motion.actors.find(a=>a.primitive.role==='body')!;
  expect(value.evaluationTick).toBe(2_000_000);expect(value.coverageThroughTick).toBe(2_500_000);expect(value.planThroughTick).toBe(3_000_000);
  expect(value.controllerSegmentIndex).toBe(0);expect('actionResult' in value).toBe(false);
  expect(body.primitive.acceleration.x).toBe(-3);
  expect(samplePiecewiseFieldActor(body,value.field.motion.world.moment).velocity.x).toBeCloseTo(1.5);
  expect(samplePiecewiseFieldActor(body,value.field.motion.world.moment).center.x).toBeCloseTo(3.475);
  expect(()=>deriveSamePaRunnerControllerMotion({...input,throughTick:2_500_001})).toThrow(/coverage/);
  const stopped={...first,source:{sourceId:'hold-stop',sourceVersion:'test'},actionResult:null,
    ...deriveSamePaRunnerControllerMotion({...input,throughTick:2_500_000})};
  const held=deriveSamePaRunnerControllerMotion({...input,previous:stopped,prefix:[h.root,first,stopped],throughTick:3_000_000});
  const heldBody=held.field.motion.actors.find(a=>a.primitive.role==='body')!;
  expect(held.evaluationTick).toBe(3_000_000);expect(held.controllerSegmentIndex).toBe(1);
  expect(heldBody.primitive.acceleration.x).toBe(0);
  expect(samplePiecewiseFieldActor(heldBody,held.field.motion.world.moment).velocity.x).toBe(0);
  expect(samplePiecewiseFieldActor(heldBody,held.field.motion.world.moment).center.x).toBeCloseTo(3.85);
});

it.each(['fractional-cut','clock','controller-identity','body-identity','velocity','height','curved-route','finite-route','missing-part'] as const)
('BRF13 the shared binding rejects %s instead of creating new physical evidence',fault=>{
  const h=fixture(),timeline=h.plan.plan.timeline;
  const input:any={root:h.root,previous:h.root,prefix:[h.root],throughTick:500_000,controller:structuredClone(timeline.postLaunchController),
    runnerMotionParameters:timeline.runnerMotionParameters,body:structuredClone(h.plan.exitState.body),rootHeightMeters:1};
  if(fault==='fractional-cut')h.root.field=structuredClone(h.root.field),h.root.field.motion.world.moment.elapsedSeconds=0.0000001;
  if(fault==='clock')input.runnerMotionParameters={...input.runnerMotionParameters,ticksPerSecond:2_000_000};
  if(fault==='controller-identity')input.controller.basis.playerId='foreign';
  if(fault==='body-identity')input.body.playerId='foreign';
  if(fault==='velocity')h.root.field=structuredClone(h.root.field),h.root.field.motion.actors.forEach((a:any)=>a.primitive.startVelocity.x=1);
  if(fault==='height')input.rootHeightMeters=2;
  if(fault==='curved-route')input.controller.route={segments:[{kind:'arc',center:{x:0,z:0},radiusMeters:30,startAngleRadians:0,sweepRadians:1}]};
  if(fault==='finite-route')input.controller.route.segments[0].end.x=1;
  if(fault==='missing-part')input.body.primitives.pop();
  expect(()=>deriveSamePaRunnerControllerMotion(input)).toThrow();
});

it('BRF14 the original batter-run wrapper cannot begin after an unexecuted plan start',()=>{
  const h=fixture(),motion=h.root.field.motion;
  const field=deriveBattedWorldFieldMotionCheckpoint({response:h.root.response,geometry:h.root.geometry,actors:motion.actors,cursor:motion.cursor,
    carrierPlayerId:null,availableAtTick:0,coverageThroughTick:5_000_000,checkpointThroughTick:1,
    commands:motion.actors.map((a:any)=>({playerId:a.playerId,role:a.primitive.role,acceleration:zero}))});
  const late={...h.root,kind:'same_pa_physical_field_step_v1',source:{sourceId:'late',sourceVersion:'test'},field,evaluationTick:1};
  expect(()=>invoke()(h.source,h.root,late,h.plan,[h.root,late])).toThrow(/unexecuted plan/);
});
