import {expect,it} from 'vitest';
import * as api from '../../../integration/browser/index';
import {createRigidBatStateFromBatterSwingState,REALISTIC_BASEBALL_RIGID_BODY} from './RigidBatBallContact';
import {resolveWoodBatSpeedProfileBallContact} from './WoodBatSpeedResponseProfile';
import {NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1} from './WoodBatProductionProfileV1';
import {calculateBaseballAerodynamics,REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from '../ball/BaseballAerodynamics';
import type {Vec3} from '../../model/geometry';
const observe=(input:unknown)=>{const f=(api as unknown as {observeBattedBallSpinV123?: (input:unknown)=>any}).observeBattedBallSpinV123;
 expect(f,'read-only batted spin observation API').toBeTypeOf('function');return f!(input);};
function contact(lateral:number,vertical:number,mirror=false){
 const side=mirror?-1:1,bat=createRigidBatStateFromBatterSwingState({pose:{grip:{x:-.65*side,y:1,z:0},tip:{x:.19*side,y:1,z:0}},
  linearVelocity:{x:lateral*side,y:0,z:0},angularVelocity:{x:0,y:-45*side,z:vertical*side}},
 {massKg:.88,centerOfMassT:.65,transverseMomentOfInertiaKgM2:.046,axialMomentOfInertiaKgM2:.0003,
  radiusProfile:{knots:[{t:0,radiusM:.033},{t:1,radiusM:.033}]}}),ball={tick:1e6,position:{x:0,y:1,z:.069},velocity:{x:0,y:0,z:-40},spin:{x:0,y:0,z:0}},
  result=resolveWoodBatSpeedProfileBallContact(ball,bat,REALISTIC_BASEBALL_RIGID_BODY,NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1);
 expect(result).not.toBeNull();return result!;
}
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
it('SPIN Gate A: existing rigid contact and air produce opposite lateral and lift components from distinct finite bat motions',()=>{
 const left=contact(-5,0),right=contact(5,0),up=contact(0,-5),down=contact(0,5),
  lift=(r:typeof left)=>calculateBaseballAerodynamics(r.exitVelocity,r.exitSpin,REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS).liftAcceleration;
 expect(left.exitSpin.y*right.exitSpin.y).toBeLessThan(0);expect(lift(left).x*lift(right).x).toBeLessThan(0);
 expect(up.exitSpin.x*down.exitSpin.x).toBeLessThan(0);expect(lift(up).y*lift(down).y).toBeLessThan(0);
 expect(left.exitVelocity).not.toEqual(right.exitVelocity);expect(up.exitVelocity).not.toEqual(down.exitVelocity);
});
it('observes the actual spin in its flight basis without a skill, result buff or simultaneous opposite signs',()=>{
 for(const [lateral,vertical]of [[-5,0],[5,0],[0,-5],[0,5],[4,3]]){
  const r=contact(lateral,vertical),input={velocityMps:r.exitVelocity,spinRadPerSecond:r.exitSpin,bats:'R'},before=JSON.stringify(input),s=observe(input);
  expect(JSON.stringify(input)).toBe(before);expect(s.basisStatus).toBe('DEFINED');
  expect(s.backspinRadPerSecond*s.topspinRadPerSecond).toBe(0);expect(s.sliceRadPerSecond*s.hookRadPerSecond).toBe(0);
  const lift=calculateBaseballAerodynamics(r.exitVelocity,r.exitSpin,REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS).liftAcceleration;
  expect(dot(lift,s.basis.right)*s.rightCurvingSpinRadPerSecond).toBeGreaterThanOrEqual(0);
  expect(dot(lift,s.basis.up)*s.backspinSignedRadPerSecond).toBeGreaterThanOrEqual(0);
  expect(s.spinRadPerSecond).toEqual(r.exitSpin);
 }
});
it('SPIN-12/32/34 mirrors the handed side, keeps mixed vectors, and refuses a fabricated vertical classification',()=>{
 const a=contact(-5,3),b=contact(-5,3,true),r=observe({velocityMps:a.exitVelocity,spinRadPerSecond:a.exitSpin,bats:'R'}),
  l=observe({velocityMps:b.exitVelocity,spinRadPerSecond:b.exitSpin,bats:'L'});
 expect(l.sliceRadPerSecond).toBeCloseTo(r.sliceRadPerSecond,10);expect(l.hookRadPerSecond).toBeCloseTo(r.hookRadPerSecond,10);
 expect(l.backspinRadPerSecond).toBeCloseTo(r.backspinRadPerSecond,10);expect(l.topspinRadPerSecond).toBeCloseTo(r.topspinRadPerSecond,10);
 const vertical=observe({velocityMps:{x:0,y:30,z:0},spinRadPerSecond:{x:10,y:20,z:30},bats:'R'});
 expect(vertical.basisStatus).toBe('UNCLASSIFIED');expect(vertical.basis).toBeNull();expect(vertical.sliceRadPerSecond).toBeNull();
});
it('separates gyro from Magnus and rejects nonfinite external vectors',()=>{
 const r=observe({velocityMps:{x:0,y:0,z:30},spinRadPerSecond:{x:0,y:0,z:200},bats:'R'});
 expect(r.gyroRadPerSecond).toBe(200);expect(r.sliceRadPerSecond+r.hookRadPerSecond+r.backspinRadPerSecond+r.topspinRadPerSecond).toBe(0);
 expect(()=>observe({velocityMps:{x:NaN,y:0,z:30},spinRadPerSecond:{x:0,y:0,z:0},bats:'R'})).toThrow();
});
