import { expect,it } from 'vitest';
import { controlledHeldPitchFixture } from './ControlledHeldPitchFixtures.test-support';
import { sampleControlledHeldPitchV1,validateControlledHeldPitchV1,type ControlledHeldPitchAnchorsV1 } from './ControlledHeldPitchV1';
const a:ControlledHeldPitchAnchorsV1={initialBall:{tick:0,position:{x:-.3,y:1.05,z:18.1},velocity:{x:0,y:0,z:0},spin:{x:0,y:0,z:0}},
  initialHand:{position:{x:-.3,y:1.05,z:18.1},velocity:{x:0,y:0,z:0}},shoulder:{x:0,y:1.4,z:18},armReachM:.8,
  handRadiusM:.06,ballRadiusM:.0366,release:{releaseAtUs:600000,position:{x:.08,y:1.52,z:17.84},velocity:{x:0,y:0,z:-27},spin:{x:0,y:75,z:0}},
  releaseAcceleration:{x:0,y:-9.81,z:3},followThroughEndTick:800000,
  obstacles:[{center:{x:0,y:.95,z:18},radiusM:.25},{center:{x:.4,y:1.15,z:18},radiusM:.09}]};
it('certifies and samples continuous controlled custody, original arm reach, other-body clearance and separating release without moving a point',()=>{
  const p=controlledHeldPitchFixture(a),before=JSON.stringify(p),v=validateControlledHeldPitchV1(p,a);
  expect(v.maximumHandReachControlDistanceM).toBeLessThan(.8);expect(v.releaseContact.normalAccelerationMps2).toBeGreaterThan(0);
  expect(v.measuredMotion).toBe(false);expect(v.muscleTorqueCalibrated).toBe(false);
  expect(sampleControlledHeldPitchV1(p,0).ball).toEqual({position:a.initialBall.position,velocity:a.initialBall.velocity,spin:a.initialBall.spin});
  const near=sampleControlledHeldPitchV1(p,599999).ball!;expect(Math.abs(near.position.z-a.release.position.z)).toBeLessThan(.000028);
  expect(sampleControlledHeldPitchV1(p,600000).hand.position).toEqual(v.releaseHand.position);
  expect(sampleControlledHeldPitchV1(p,600000).ball).toBeNull();expect(JSON.stringify(p)).toBe(before);
});
it.each(['position','velocity','reach','obstacle','surface','continuity','clock','spin-axis'] as const)('refuses %s rather than correcting the controller',fault=>{
  const p=structuredClone(controlledHeldPitchFixture(a)) as any;
  if(fault==='position')p.held.at(-1).handCenter.z+=.01;
  if(fault==='velocity')p.held.at(-1).handVelocity.z+=1;
  if(fault==='reach')p.held[1].handCenter.x=-2;
  if(fault==='obstacle')p.held[1].handCenter={x:0,y:.95,z:18};
  if(fault==='surface')p.held.at(-1).ballOffset.z=-.1;
  if(fault==='continuity')p.followThrough[0].handVelocity.z+=1;
  if(fault==='clock')p.held[1].tick=p.held[0].tick;
  if(fault==='spin-axis'){p.held[1].spin={x:30,y:0,z:0};}
  expect(()=>validateControlledHeldPitchV1(p,a)).toThrow();
});
it('keeps other-body colliders active during hand follow-through after ball release',()=>{
  const p=controlledHeldPitchFixture(a),obstacle={center:p.followThrough.at(-1)!.handCenter,radiusM:.01};
  expect(()=>validateControlledHeldPitchV1(p,{...a,obstacles:[...a.obstacles,obstacle]})).toThrow(/collision or uncertified clearance/);
});
