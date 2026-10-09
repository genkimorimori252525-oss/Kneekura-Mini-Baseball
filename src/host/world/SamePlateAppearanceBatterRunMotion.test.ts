import { expect,it } from 'vitest';
import * as motors from './SamePlateAppearancePhysicalFieldMotor';
import { samePaPhysicalFieldActionInput } from './SamePlateAppearancePhysicalFieldAction';
import { prepareBatterRunPlan } from './BatterRunPlan';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../../core/sim/ball/BallFlight';
import { deriveBattedWorldFieldMotionAdoption, deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { geometry,material } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const zero={x:0,y:0,z:0},parameters={...DEFAULT_BALL_FLIGHT_PARAMETERS,gravityY:0};
const invoke=()=>{const fn=(motors as unknown as {deriveSamePaBatterRunMotion?:Function}).deriveSamePaBatterRunMotion;
  expect(fn,'owned batter runner motor adoption is missing').toBeTypeOf('function');return fn!;};
/** Existing Core physics with structural Source contracts only; no Native admission claim. */
const fixture=(defender=false,defenderEndTick=5_000_000)=>{
  const body={playerId:'batter',personId:'person',primitives:(['glove','body','tag_hand','left_foot','right_foot'] as const).map((role,i)=>({role,radius:0.05,offset:{x:i*0.1,y:role.endsWith('foot')?-1:0,z:0}}))};
  const actors=body.primitives.map(p=>({playerId:'batter',primitive:{role:p.role,radius:p.radius,startTick:0,endTick:5_000_000,ticksPerSecond:1_000_000,
    startCenter:{x:p.offset.x,y:1+p.offset.y,z:0},startVelocity:zero,acceleration:zero}}));
  if(defender)actors.push(...actors.map(a=>({...a,playerId:'fielder',primitive:{...a.primitive,endTick:defenderEndTick,startCenter:{...a.primitive.startCenter,x:a.primitive.startCenter.x+50}}})));
  const contact={tick:0,ballCenter:{x:100,y:10,z:100},point:{x:100,y:10,z:100},batPoint:{x:100,y:10,z:100},normal:{x:1,y:0,z:0},segmentT:0.5,exitVelocity:{x:1,y:0,z:0},exitSpin:zero};
  const flight=createBattedBallFlightEvidence({contact,parameters,searchDurationTicks:0});
  const response:any={world:{flight,parameters,throughTick:0,actors,surfaces:[]},actors:actors.map(a=>({playerId:a.playerId,profile:a.primitive.role==='glove'
    ?{role:'glove',pocketCenterOffset:zero,bodyStability:1,parameters:{ticksPerSecond:1_000_000,ballMassKg:0.145,ballRadiusMeters:parameters.ballRadius,pocketRadiusMeters:0.1,centerRetentionCapacityJ:10,captureDissipationPowerW:100,failedContactRestitution:0.5,failedTangentialDamping:0,failedSpinDamping:0}}
    :{role:a.primitive.role,material}})),surfaces:[]};
  const shape=geometry(27),field=deriveBattedWorldFieldMotionAdoption({response,geometry:shape,actors,carrierPlayerId:null,cursor:{moment:{originTick:0,elapsedSeconds:0,ball:flight.initialBall},previousContacts:[]},availableAtTick:0,coverageThroughTick:Math.min(5_000_000,defenderEndTick),commands:actors.map(a=>({playerId:a.playerId,role:a.primitive.role,acceleration:zero}))});
  const root:any={kind:'same_pa_physical_field_root_v1',source:{sourceId:'root',sourceVersion:'test'},physicalPitchSourceId:'pitch',lineage:{playId:1},response,geometry:shape,field,evaluationTick:0,timeline:{events:[],status:{kind:'batted_ball_pending'}}};
  const exit:any={playerId:'batter',personId:'person',body,source:{fieldReference:reference('pa_physical_v1_field_roots',root)},state:{tick:0,planarVelocity:{x:0,z:0},bodyForwardUnit:{x:1,z:0}},root:{position:{x:0,y:1,z:0},velocity:zero},firstBaseCenter:{x:27,z:0},model:{source:{parameters:{ticksPerSecond:1_000_000,maximumBodyTurnRateRadiansPerSecond:Math.PI,lateralRealignmentAccelerationMps2:4,backwardRecoveryAccelerationMps2:3}},runnerModel:{source:{motion:{ticksPerSecond:1_000_000,reactionDelayTicks:0,accelerationMps2:2,brakingMps2:3,slideDecelerationMps2:4,topSpeedMps:5}}}}};
  const intention={playerId:'batter',personId:'person',route:{segments:[{kind:'line' as const,start:{x:0,z:0},end:{x:30,z:0}}]},intent:{kind:'advance' as const,issuedTick:0},endTick:3_000_000};
  const plan:any={kind:'owned_batter_run_plan_v1',source:{sourceId:'run',sourceVersion:'test',physicalPitchReference:{sourceId:'pitch'}},lineage:root.lineage,playerId:'batter',personId:'person',exitState:exit,plan:prepareBatterRunPlan(exit,intention)};
  const source:any={throughTick:500_000,action:{kind:'batter_run_motion_v1',planReference:reference('world_batter_run_plans',plan)}};
  return{root,plan,source};
};
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
