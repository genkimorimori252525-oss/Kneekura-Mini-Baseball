import { expect,it } from 'vitest';
import * as runtime from './BatterRunnerRuntime';
import { sampleBatterRunnerWorldTimeline } from '../../core/sim/running/BatterRunnerWorldTimeline';
const prepare=()=>{
  const fn=(runtime as unknown as {prepareBatterRunPlan?:(state:unknown,intent:unknown)=>any}).prepareBatterRunPlan;
  expect(fn,'explicit original batter-run intent composition is missing').toBeTypeOf('function');return fn!;
};
const exit=()=>({playerId:'batter',personId:'person',state:{tick:1000,planarVelocity:{x:0,z:0},bodyForwardUnit:{x:1,z:0}},
  root:{position:{x:0,y:1,z:0},velocity:{x:0,y:0,z:0}},firstBaseCenter:{x:27,z:0},model:{source:{parameters:{ticksPerSecond:1000,
    maximumBodyTurnRateRadiansPerSecond:Math.PI,lateralRealignmentAccelerationMps2:4,backwardRecoveryAccelerationMps2:3}},
    runnerModel:{source:{motion:{ticksPerSecond:1000,reactionDelayTicks:100,accelerationMps2:2,brakingMps2:3,slideDecelerationMps2:4,topSpeedMps:6}}}}});
const intent=()=>({playerId:'batter',personId:'person',route:{segments:[{kind:'line',start:{x:0,z:0},end:{x:30,z:0}}]},
  intent:{kind:'advance',issuedTick:1000},endTick:3000});
it('BRP01 leaves no accepted original intent pending instead of treating contact as advance',()=>{
  expect(prepare()(exit(),null)).toEqual({kind:'pending',reason:'accepted_batter_run_intent_missing',motionExecuted:false});
});
it('BRP02 composes the accepted route and issued intent through existing recovery and motion laws',()=>{
  const value=prepare()(exit(),intent());expect(value.kind).toBe('prepared');expect(value.motionExecuted).toBe(false);
  expect(value.physicalBinding).toBe('owned_static_pose_straight_motion');
  const sample=sampleBatterRunnerWorldTimeline(value.timeline,1500);expect(sample.world.velocity.x).toBeCloseTo(0.8);
  expect(sample.world.position.x).toBeCloseTo(0.16);expect(value.timeline.postLaunchIntent).toEqual(intent().intent);
});
it.each(['identity','route-origin','first-base','issuance'] as const)('BRP03 rejects %s laundering',fault=>{
  const fn=prepare(),request=intent();if(fault==='identity')request.personId='foreign';
  if(fault==='route-origin')request.route.segments[0].start.x=1;
  if(fault==='first-base')request.route.segments[0].end.z=1;
  if(fault==='issuance')request.intent.issuedTick=999;
  expect(()=>fn(exit(),request)).toThrow();
});
it('BRP04 retains nonzero recovery as a plan that still needs physical pose binding',()=>{
  const state=exit();state.state.bodyForwardUnit={x:0,z:1};const request=intent();request.intent.issuedTick=1500;
  const plan=prepare()(state,request);expect(plan.timeline.recovery.transition.recoverySeconds).toBe(0.5);
  expect(plan.physicalBinding).toBe('swing_recovery_pose_binding_required');expect(plan.motionExecuted).toBe(false);
});

it('BRP05 accepts an explicit completed recovery pin without changing legacy plan Source bytes',async()=>{
  const {batterRunPlanInput}=await import('./BatterRunPlan');const {samePaExecutionReference:ref}=await import('./SamePlateAppearanceExecutionFromSqlite');
  const pin=(owner:any,name:string)=>ref(owner,{source:{sourceId:name,sourceVersion:'test'}} as any);
  const legacy={...intent(),sourceId:'plan',sourceVersion:'test',capability:'same_pa_batter_run_plan_v1' as const,
    viewReference:pin('pa_lifecycle_v1_execution_views','view'),physicalPitchReference:pin('pa_physical_v1_launches','pitch'),exitStateReference:pin('world_batter_swing_exit_states','exit'),
    provenance:{sourceRecordId:'accepted',sourceVersion:'test'}};
  expect(batterRunPlanInput(legacy)).toEqual(legacy);
  const source={...legacy,completedRecoveryReference:pin('pa_physical_v1_field_steps','recovered')};expect(batterRunPlanInput(source)).toEqual(source);
  expect(()=>batterRunPlanInput({...source,completedRecoveryReference:pin('pa_physical_v1_field_roots','wrong')} as any)).toThrow();
  expect(()=>batterRunPlanInput({...source,completedRecoveryReference:null} as any)).toThrow();
});
