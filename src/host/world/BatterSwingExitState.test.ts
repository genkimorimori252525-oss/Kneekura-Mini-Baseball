import { expect, it } from 'vitest';
import * as runtime from './BatterRunnerRuntime';
import type { DefenderPhysicalPrimitiveSegment } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import { buildBatterSwingExitRecoveryTrajectory, sampleBatterSwingExitRecoveryTrajectory } from '../../core/sim/running/BatterSwingExitRecoveryTrajectory';
import type { SwingExitBodyState } from '../../core/sim/running/BatterSwingExitRunTransition';
type Input = { at: { originTick: number; elapsedSeconds: number; tick: number }; contactTick: number; ticksPerSecond: number;
  bodyPrimitive: DefenderPhysicalPrimitiveSegment; bodyOffset: { x: number; y: number; z: number }; bodyForwardUnit: { x: number; z: number } };
type Value = { state: SwingExitBodyState; root: { position: { x: number; y: number; z: number }; velocity: { x: number; y: number; z: number } } };
const project = () => {
  const value = (runtime as unknown as { projectBatterSwingExitState?: (input: Input) => Value }).projectBatterSwingExitState;
  expect(value, 'owned primitive to explicit swing-exit state projection is missing').toBeTypeOf('function');return value!;
};
const sample = ():Input => ({ at: { originTick:100,elapsedSeconds:1,tick:1100 },contactTick:100,ticksPerSecond:1000,
  bodyPrimitive:{role:'body',radius:0.3,startTick:100,endTick:2100,ticksPerSecond:1000,startCenter:{x:2,y:1,z:3},startVelocity:{x:1,y:0,z:2},acceleration:{x:2,y:0,z:0}},
  bodyOffset:{x:0.25,y:0.5,z:-0.1},bodyForwardUnit:{x:0,z:1} });
it('BSE01 derives only the executed body kinematics and preserves independently accepted body forward',()=>{
  const result=project()(sample());expect(result.state).toEqual({tick:1100,planarVelocity:{x:3,z:2},bodyForwardUnit:{x:0,z:1}});
  expect(result.root.position).toEqual({x:3.75,y:0.5,z:5.1});expect(result.root.velocity).toEqual({x:3,y:0,z:2});
});
it('BSE02 connects the explicit state to the existing no-snap recovery trajectory without issuing a motion',()=>{
  const original=sample(),input:Input={...original,bodyPrimitive:{...original.bodyPrimitive,startVelocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0}}};
  const result=project()(input),start={x:result.root.position.x,z:result.root.position.z};
  const recovery=buildBatterSwingExitRecoveryTrajectory(result.state,{segments:[{kind:'line',start,end:{x:start.x+30,z:start.z}}]},
    {ticksPerSecond:1000,maximumBodyTurnRateRadiansPerSecond:Math.PI,lateralRealignmentAccelerationMps2:4,backwardRecoveryAccelerationMps2:3});
  expect(recovery.transition.launchTick).toBe(1600);expect(sampleBatterSwingExitRecoveryTrajectory(recovery,1600).position).toEqual(start);
});
it.each(['orientation','bat-role','clock','fractional-cut','before-contact','vertical-motion'] as const)('BSE03 rejects unsupported %s instead of inventing a body state',fault=>{
  const invoke=project(),original=sample(),input:Input={...original,
    bodyForwardUnit:fault==='orientation'?{x:0,z:0}:original.bodyForwardUnit,
    at:fault==='fractional-cut'?{...original.at,elapsedSeconds:1.0001}:original.at,
    contactTick:fault==='before-contact'?1101:original.contactTick,
    bodyPrimitive:{...original.bodyPrimitive,role:fault==='bat-role'?'glove':original.bodyPrimitive.role,
      ticksPerSecond:fault==='clock'?1001:original.bodyPrimitive.ticksPerSecond,
      startVelocity:fault==='vertical-motion'?{...original.bodyPrimitive.startVelocity,y:1}:original.bodyPrimitive.startVelocity}};
  expect(()=>invoke(input)).toThrow();
});
it('BSE04 preserves a retained primitive fractional start offset when deriving velocity',()=>{
  const input={...sample(),startElapsedSeconds:0.25};
  const value=project()(input);expect(value.state.planarVelocity).toEqual({x:2.5,z:2});
  expect(value.root.position).toEqual({x:3.0625,y:0.5,z:4.6});
});
