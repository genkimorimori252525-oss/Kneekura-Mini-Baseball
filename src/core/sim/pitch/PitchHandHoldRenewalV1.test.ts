import { expect,it } from 'vitest';
import { controlledHeldPitchFixture } from './ControlledHeldPitchFixtures.test-support';
import { sampleControlledPitchHandV1,type ControlledHeldPitchAnchorsV1 } from './ControlledHeldPitchV1';
import { createPitchHandHoldRenewalV1 } from './PitchHandHoldRenewalV1';
const anchors=():ControlledHeldPitchAnchorsV1=>({initialBall:{tick:0,position:{x:-.3,y:1.05,z:18.1},velocity:{x:0,y:0,z:0},spin:{x:0,y:0,z:0}},
  initialHand:{position:{x:-.3,y:1.05,z:18.1},velocity:{x:0,y:0,z:0}},shoulder:{x:0,y:1.4,z:18},armReachM:.8,
  handRadiusM:.06,ballRadiusM:.0366,release:{releaseAtUs:600000,position:{x:.08,y:1.52,z:17.84},velocity:{x:0,y:0,z:-27},spin:{x:0,y:75,z:0}},
  releaseAcceleration:{x:0,y:-9.81,z:3},followThroughEndTick:800000,
  obstacles:[{center:{x:0,y:.95,z:18},radiusM:.25},{center:{x:.4,y:1.15,z:18},radiusM:.09}]});
const request=()=>({version:'pitch_hand_hold_renewal_v1' as const,fromTick:800000,throughTick:1100000,sceneThroughTick:1500000});
it('issues an explicit finite hold from the original exact endpoint without extending or changing its predecessor',()=>{
  const a=anchors(),p=controlledHeldPitchFixture(a),before=structuredClone(p),m=createPitchHandHoldRenewalV1(p,a,request());
  const end=sampleControlledPitchHandV1(p,a.followThroughEndTick);
  expect(m.sampleContinuous(800000).position).toEqual(end.position);expect(m.sampleContinuous(1100000).velocity).toEqual(end.velocity);
  expect(p).toEqual(before);expect(p.followThrough.at(-1)!.tick).toBe(800000);
  expect(()=>sampleControlledPitchHandV1(p,800001)).toThrow();
  expect(()=>m.sampleContinuous(1100001)).toThrow(/outside successor/);
  expect(m.nativeAdmission).toBe(false);expect(m.predecessorChanged).toBe(false);
  const observed=m.sampleContinuous(900000);Object.assign(observed.position,{x:999});expect(m.sampleContinuous(900000).position).toEqual(end.position);
});
it.each(['gap','overlap','expired-scene','position-injection','nonrest','original-obstacle'] as const)('refuses %s rather than correcting control or dropping colliders',fault=>{
  const a=anchors(),p=structuredClone(controlledHeldPitchFixture(a)),r=request();
  if(fault==='gap')r.fromTick++;
  if(fault==='overlap')r.fromTick--;
  if(fault==='expired-scene')r.throughTick=r.sceneThroughTick+1;
  if(fault==='position-injection')Object.assign(r,{handCenter:{x:0,y:0,z:0}});
  if(fault==='nonrest')Object.assign(p.followThrough.at(-1)!.handVelocity,{x:1});
  if(fault==='original-obstacle')Object.assign(a,{obstacles:[...a.obstacles,{center:p.followThrough.at(-1)!.handCenter,radiusM:.01}]});
  expect(()=>createPitchHandHoldRenewalV1(p,a,r)).toThrow();
});
