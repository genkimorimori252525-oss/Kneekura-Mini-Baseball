import { expect,it } from 'vitest';
import { validateInitialHeldBatV1,sampleInitialHeldBatV1,type InitialHeldBatV1,type InitialHeldBatBodyV1 } from './InitialHeldBatV1';
const pose:InitialHeldBatV1={version:'initial_held_bat_v1',startTick:0,throughTick:1_000_000,grip:{x:.4,y:1.08,z:.1},orientation:{x:0,y:0,z:0,w:1},
  batLengthM:.84,maximumBatRadiusM:.034,handReferenceFromKnobM:.12};
const body:InitialHeldBatBodyV1={bodyOrigin:{x:0,y:.95,z:0},maximumHandReachM:1.1,handCenter:{x:.4,y:1.2,z:.1},handRadiusM:.06,
  obstacles:[{center:{x:0,y:.95,z:0},radiusM:.25},{center:{x:-.4,y:1.2,z:.1},radiusM:.09}]};
it('certifies declared initial grasp and finite stationary bat without inventing measured stance or possession',()=>{
  const before=structuredClone({pose,body}),b=validateInitialHeldBatV1(pose,body);
  expect(b.handResidualM).toBeLessThan(1e-14);expect(b.handReachM).toBeLessThan(body.maximumHandReachM);
  expect(b.custodyInferred).toBe(false);expect(b.measuredStance).toBe(false);expect(b.obstacleClearancesM.every(n=>n>0)).toBe(true);
  expect({pose,body}).toEqual(before);expect(Object.isFrozen(b)).toBe(true);
  expect(sampleInitialHeldBatV1(pose,123.5).state.pose).toEqual({grip:pose.grip,tip:{x:.4,y:1.92,z:.1}});
});
it.each(['grasp','reach','collision','clock','quaternion'] as const)('rejects invalid %s without moving or deleting anything',fault=>{
  const p=structuredClone(pose),b=structuredClone(body);
  if(fault==='grasp')Object.assign(p.grip,{x:3});
  if(fault==='reach')Object.assign(b,{maximumHandReachM:.1});
  if(fault==='collision')Object.assign(b,{obstacles:[...b.obstacles,{center:p.grip,radiusM:.1}]});
  if(fault==='clock')Object.assign(p,{throughTick:0});
  if(fault==='quaternion')Object.assign(p.orientation,{w:2});
  expect(()=>validateInitialHeldBatV1(p,b)).toThrow();
});
it('does not extrapolate a held bat after the explicit lease',()=>{
  expect(()=>sampleInitialHeldBatV1(pose,pose.throughTick+1)).toThrow(/outside owned/);
  expect(()=>sampleInitialHeldBatV1(pose,-1)).toThrow(/outside owned/);
});
