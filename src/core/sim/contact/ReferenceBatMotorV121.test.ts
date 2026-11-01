import {expect,it} from 'vitest';
import {createReferenceBatKinematicsV1,type ReferenceBatKinematicsInputV1} from './ReferenceBatKinematicsV1';
import {withReferenceImpactTrajectoryV1,DEFAULT_IMPACT_TRAJECTORY_V1} from './ReferenceBatImpactTrajectoryV1';
import {quaternionFromAxisAngle} from '../pitching/BaseballOrientation';

const input=():ReferenceBatKinematicsInputV1=>({provenance:{clipId:'motor-test',sourceSha256:'a'.repeat(64)},
 frames:[{tick:100000,grip:{x:0,y:0,z:0},orientation:{w:1,x:0,y:0,z:0}},
 {tick:400000,grip:{x:3,y:0,z:0},orientation:{w:1,x:0,y:0,z:0}}],
 batLengthM:.84,sweetSpotT:.8,sourceTicksPerSecond:1e6,startTick:1000000,ticksPerSecond:1e6,playbackRate:1,
 transform:{rotation:{w:1,x:0,y:0,z:0},translation:{x:0,y:0,z:0},scale:1}});
it('starts from rest with a continuous clock instead of instant reference playback',()=>{
 const m=createReferenceBatKinematicsV1({...input(),motorRampSecondsV121:.1});
 expect(m.sampleContinuous(1000000).state.linearVelocity.x).toBe(0);
 expect(m.sampleContinuous(1050000).state.linearVelocity.x).toBeCloseTo(5,10);
 expect(m.sampleContinuous(1100000).state.linearVelocity.x).toBeCloseTo(10,10);
 expect(m.sampleContinuous(1050000).state.pose.grip.x).toBeCloseTo(.09375,10);
 const contact=m.sampleAtSourceTick(300000);
 expect(contact.tick).toBeCloseTo(1250000,6);
 expect(m.sampleContinuous(contact.tick).sweetSpot).toEqual(contact.sweetSpot);
});
it('uses only delivered corrections and analytic velocities shared with the physical sampler',()=>{
 const m=createReferenceBatKinematicsV1({...input(),aimCorrectionV121:{availableTick:1100000,throughTick:1200000,offset:{x:0,y:.1,z:0}}});
 expect(m.sampleContinuous(1099999).state.pose.grip.y).toBe(0);
 const at=1150000,dt=1,s=m.sampleContinuous(at),before=m.sampleContinuous(at-dt),after=m.sampleContinuous(at+dt);
 expect(s.state.pose.grip.y).toBeCloseTo(.05,10);
 expect(s.state.linearVelocity.y).toBeCloseTo((after.state.pose.grip.y-before.state.pose.grip.y)/(.000002),7);
 expect(s.state.linearVelocity.y).toBeCloseTo(1.5,10);
 expect(m.maximumSweetSpotSpeedMps).toBeGreaterThanOrEqual(Math.hypot(10,1.5));
 expect(m.sampleContinuous(1200000).state.linearVelocity.y).toBe(0);
});
it('retains the exact legacy sampler and rejects invalid motor clocks/corrections',()=>{
 const a=createReferenceBatKinematicsV1(input()),b=createReferenceBatKinematicsV1({...input(),motorRampSecondsV121:0});
 for(const tick of [1000000,1050000,1300000])expect(a.sampleContinuous(tick)).toEqual(b.sampleContinuous(tick));
 for(const motorRampSecondsV121 of [-1,Infinity,NaN])expect(()=>createReferenceBatKinematicsV1({...input(),motorRampSecondsV121})).toThrow();
 expect(()=>createReferenceBatKinematicsV1({...input(),aimCorrectionV121:{availableTick:1200000,throughTick:1100000,offset:{x:0,y:0,z:0}}})).toThrow();
});

it('composes C1 acceleration certificates with clock ramp and delivered aim instead of keeping stale bounds',()=>{
 const raw={...input(),executionInterpolationV122:'cubic-c1' as const},base=createReferenceBatKinematicsV1(raw),
  ramp=.015,duration=.02,offset={x:0,y:.2,z:0},m=createReferenceBatKinematicsV1({...raw,motorRampSecondsV121:ramp,
   aimCorrectionV121:{availableTick:1003000,throughTick:1023000,offset}});
 expect(m.maximumGripAccelerationMps2).toBeGreaterThan(base.maximumGripAccelerationMps2!);
 expect(m.maximumAngularAccelerationRadPerSecond2).toBeGreaterThanOrEqual(base.maximumAngularAccelerationRadPerSecond2!);
 expect(m.maximumGripAccelerationMps2).toBeGreaterThanOrEqual(base.maximumGripAccelerationMps2!+6*.2/duration**2);
 const norm=(v:{x:number;y:number;z:number})=>Math.hypot(v.x,v.y,v.z),
  delta=(a:{x:number;y:number;z:number},b:typeof a)=>({x:(b.x-a.x)*5e6,y:(b.y-a.y)*5e6,z:(b.z-a.z)*5e6});
 for(let t=1000000.25;t<1340000;t+=107.31){const a=m.sampleContinuous(t-.1),b=m.sampleContinuous(t+.1),at=m.sampleContinuous(t);
  expect(norm(delta(a.state.linearVelocity,b.state.linearVelocity))).toBeLessThanOrEqual(m.maximumGripAccelerationMps2!);
  expect(norm(delta(a.state.angularVelocity,b.state.angularVelocity))).toBeLessThanOrEqual(m.maximumAngularAccelerationRadPerSecond2!);
  expect(norm(delta(a.sweetSpotVelocity,b.sweetSpotVelocity))).toBeLessThanOrEqual(m.maximumSweetSpotAccelerationMps2!);
  expect(norm(at.state.linearVelocity)).toBeLessThanOrEqual(m.maximumGripSpeedMps);
  expect(norm(at.sweetSpotVelocity)).toBeLessThanOrEqual(m.maximumSweetSpotSpeedMps);
  expect((b.sweetSpot.y-a.sweetSpot.y)*5e6).toBeCloseTo(at.sweetSpotVelocity.y,5);
 }
 const key=m.sampleAtSourceTick(300000);expect(m.sampleContinuous(key.tick).state.pose).toEqual(key.state.pose);
});

it('shares one analytic sampler for rotating C1, local angle, ramp and delivered aim at multiple execution rates',()=>{
 const norm=(v:{x:number;y:number;z:number})=>Math.hypot(v.x,v.y,v.z),
  derivative=(a:{x:number;y:number;z:number},b:typeof a)=>({x:(b.x-a.x)*5e6,y:(b.y-a.y)*5e6,z:(b.z-a.z)*5e6});
 for(const playbackRate of [.4,1,1.7]){
  const raw={...input(),playbackRate,executionInterpolationV122:'cubic-c1' as const,motorRampSecondsV121:.06,
   aimCorrectionV121:{availableTick:1020000,throughTick:1080000,offset:{x:0,y:.05,z:.02}}};
  const rotating={...raw,frames:raw.frames.map((f,i)=>i===1?{...f,orientation:quaternionFromAxisAngle({x:1,y:0,z:0},.9)}:f)},
   before=JSON.stringify(rotating),m=createReferenceBatKinematicsV1(withReferenceImpactTrajectoryV1(rotating,250000,{...DEFAULT_IMPACT_TRAJECTORY_V1,level:4})),
   end=m.sampleAtSourceTick(400000).tick;
  for(let t=1000000.25;t<end;t+=911.37){const a=m.sampleContinuous(t-.1),b=m.sampleContinuous(t+.1),at=m.sampleContinuous(t);
   expect(norm(derivative(a.state.linearVelocity,b.state.linearVelocity))).toBeLessThanOrEqual(m.maximumGripAccelerationMps2!);
   expect(norm(derivative(a.state.angularVelocity,b.state.angularVelocity))).toBeLessThanOrEqual(m.maximumAngularAccelerationRadPerSecond2!);
   expect(norm(derivative(a.sweetSpotVelocity,b.sweetSpotVelocity))).toBeLessThanOrEqual(m.maximumSweetSpotAccelerationMps2!);
   const geometric=derivative(a.sweetSpot,b.sweetSpot);
   expect(norm({x:geometric.x-at.sweetSpotVelocity.x,y:geometric.y-at.sweetSpotVelocity.y,z:geometric.z-at.sweetSpotVelocity.z})).toBeLessThan(1e-5);
   expect(norm(at.sweetSpotVelocity)).toBeLessThanOrEqual(m.maximumSweetSpotSpeedMps);
  }
  expect(JSON.stringify(rotating)).toBe(before);
 }
});

it('has monotone rate-dependent acceleration bounds for fixed ramp without hiding the fixed aim acceleration floor',()=>{
 let previous=Infinity;
 for(const playbackRate of [1,.5,.1,.01]){
  const raw={...input(),executionInterpolationV122:'cubic-c1' as const,motorRampSecondsV121:.06,playbackRate},
   m=createReferenceBatKinematicsV1(withReferenceImpactTrajectoryV1(raw,250000,{...DEFAULT_IMPACT_TRAJECTORY_V1,level:4}));
  expect(m.maximumSweetSpotAccelerationMps2!).toBeLessThan(previous);previous=m.maximumSweetSpotAccelerationMps2!;
  const corrected=createReferenceBatKinematicsV1({...raw,aimCorrectionV121:{availableTick:1020000,throughTick:1040000,offset:{x:0,y:.1,z:0}}});
  expect(corrected.maximumSweetSpotAccelerationMps2!).toBeGreaterThanOrEqual(6*.1/.02**2);
 }
});
