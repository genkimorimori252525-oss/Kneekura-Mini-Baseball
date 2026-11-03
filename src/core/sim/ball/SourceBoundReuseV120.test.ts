import {expect,it} from 'vitest';
import {createAeroGroundBallPhysicsProfile} from './VersionedBattedBallPhysics';
import {sourceRk4PositionBounds,prepareOwnedSourceBoundsV120} from './SourceFreeBallSpeedBound';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from './BaseballAerodynamics';
const physics=()=>createAeroGroundBallPhysicsProfile({kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:4000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
 ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
  material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}});
it('reuses only parameter constants while preserving dynamic speed/spin/time bounds exactly',()=>{
 const p=physics().air,raw=structuredClone(p);
 for(const speed of [0,.1,5,30,100])for(const spin of [0,100,1000])for(const seconds of [0,.0000002,.004,.1,.3]){
  const ball={tick:0,position:{x:2,y:1,z:9},velocity:{x:speed,y:-speed*.3,z:speed*.4},spin:{x:spin,y:spin*.2,z:-spin*.7}},
   a=sourceRk4PositionBounds(ball,seconds,p),b=sourceRk4PositionBounds(ball,seconds,raw);
  expect(a).toEqual(b);
 }
 const ball={tick:0,position:{x:2,y:1,z:9},velocity:{x:30,y:1,z:2},spin:{x:100,y:20,z:70}},before=sourceRk4PositionBounds(ball,.01,raw);
 Object.assign(raw.aerodynamics.windVelocityMps,{x:12});expect(sourceRk4PositionBounds(ball,.01,raw)).not.toEqual(before);
 expect(()=>sourceRk4PositionBounds(ball,NaN,p)).toThrow();
 expect(()=>prepareOwnedSourceBoundsV120(Object.freeze({...raw.aerodynamics}))).toThrow();
});
it('keeps a discontinuous lift profile rejected at the Source-bound query rather than earlier construction',()=>{
 const raw=structuredClone(physics());Object.assign(raw.air.aerodynamics.coefficientProfile!.spinKnots[0],{liftCoefficient:.1});
 const p=createAeroGroundBallPhysicsProfile(raw);
 expect(()=>sourceRk4PositionBounds({tick:0,position:{x:0,y:1,z:0},velocity:{x:0,y:1,z:20},spin:{x:20,y:0,z:0}},.004,p.air)).toThrow('continuous');
});
