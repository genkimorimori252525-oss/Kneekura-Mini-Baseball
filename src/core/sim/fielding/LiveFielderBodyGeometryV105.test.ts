import { expect, it } from 'vitest';
import { createLiveBodyHandPreparationV105, liveFielderBodyPoseV105, liveFielderDesiredCrouchV105,
  liveFielderHorizontalReachV105, liveFielderReachMarginV105, liveFielderReachTargetV105,
  liveFielderRecoverySecondsV105, liveFielderPreparationPostureSecondsV105, liveFielderThrowOffsetV105, liveFielderTurnSpeedV110, resolveLiveFielderBodyModelV105 } from './LiveFielderBodyGeometryV105';
const v=(x=0,y=0,z=0)=>({x,y,z});
it('doubles the live turn cap while preserving authored individual base speeds',()=>{
 const a=resolveLiveFielderBodyModelV105(1.8,1.35,{fieldTurnSpeedRadiansPerSecondV105:3}),
  b=resolveLiveFielderBodyModelV105(1.8,1.35,{fieldTurnSpeedRadiansPerSecondV105:6});
 expect(a.turnSpeedRadiansPerSecond).toBe(3);expect(b.turnSpeedRadiansPerSecond).toBe(6);
 expect(liveFielderTurnSpeedV110(a)).toBe(6);expect(liveFielderTurnSpeedV110(b)).toBe(12);
 expect(liveFielderPreparationPostureSecondsV105(a,{crouchMeters:0,forward:v(0,0,1)},v(),v(0,0,-1))).toBeCloseTo(Math.PI/6);
});
it('resolves omitted anatomical dimensions from height and legacy reach once, without rewriting controls',()=>{
  const controls={fieldArmReachMetersV105:.8}, before=JSON.stringify(controls), short=resolveLiveFielderBodyModelV105(1.5,1.35),tall=resolveLiveFielderBodyModelV105(2.2,1.35);
  expect(tall.armReachMeters).toBeGreaterThan(short.armReachMeters);
  expect(resolveLiveFielderBodyModelV105(1.8,2.7).armReachMeters).toBeCloseTo(1.8*.491*2);
  expect(resolveLiveFielderBodyModelV105(1.8,2.7,controls).armReachMeters).toBe(.8);
  expect(JSON.stringify(controls)).toBe(before);
  expect(()=>resolveLiveFielderBodyModelV105(1.8,1.35,{fieldCrouchFractionV105:.9})).toThrow();
});
it('uses one posture for eye, shoulder, hip and ground reach while feet stay on the same surface',()=>{
  const m=resolveLiveFielderBodyModelV105(1.8,1.35),anchor=v(3,m.hipHeightMeters+.2,5),p={from:0,through:.2,crouchFrom:0,crouchTo:.5,yawFrom:0,yawTo:.5},
    a=liveFielderBodyPoseV105(m,anchor,v(2,0,1),p,.1),b=liveFielderBodyPoseV105(m,anchor,v(2,0,1),p,.2);
  expect(a.foot.y).toBeCloseTo(.2);expect(a.eye.y-a.shoulder.y).toBeCloseTo(m.eyeHeightMeters-m.shoulderHeightMeters);
  expect(a.eyeVelocity.y).toBe(-2.5);expect(b.eyeVelocity.y).toBe(0);expect(b.head.y).toBeCloseTo(1.5);
  const ground=v(0,.1,0),crouch=liveFielderDesiredCrouchV105(m,v(0,m.hipHeightMeters,0),ground);
  expect(crouch).toBeGreaterThan(.4);expect(liveFielderHorizontalReachV105(m,v(0,m.hipHeightMeters,0),.1,0)).toBe(-1);
  expect(liveFielderHorizontalReachV105(m,v(0,m.hipHeightMeters,0),.1,crouch)).toBeGreaterThan(0);
  expect(liveFielderRecoverySecondsV105(m,{crouchMeters:.5})).toBe(.2);
});
it('rejects rear and above-head unreachable points and only limits a proposed target',()=>{
  const m=resolveLiveFielderBodyModelV105(1.8,1.35),shoulder=v(0,m.shoulderHeightMeters,0),forward=v(0,0,1),target=v(0,3,-2),before=JSON.stringify(target),
    limited=liveFielderReachTargetV105(m,shoulder,forward,target);
  expect(liveFielderReachMarginV105(m,shoulder,forward,target)).toBeLessThan(0);
  expect(liveFielderReachMarginV105(m,shoulder,forward,limited)).toBeGreaterThanOrEqual(-1e-12);
  expect(JSON.stringify(target)).toBe(before);
});
it('keeps measured hand position and velocity when translating the C1 solver to a standing shoulder',()=>{
  const m=resolveLiveFielderBodyModelV105(1.8,1.35),shoulder=m.shoulderHeightMeters-m.hipHeightMeters,initial=v(0,shoulder-.2,.15),velocity=v(.05,0,.02),target=liveFielderThrowOffsetV105(m,v(),v(0,0,30)),
    plan=createLiveBodyHandPreparationV105({fromElapsedSeconds:2,initialOffset:initial,initialRelativeVelocity:velocity,targetOffset:target,maximumRelativeSpeedMps:6,maximumReachMeters:1.35},m,v(0,0,1));
  expect(plan.kind).toBe('planned');if(plan.kind!=='planned')return;
  expect(plan.sampleAtElapsedSeconds(2).offset).toEqual(initial);expect(plan.sampleAtElapsedSeconds(2).relativeVelocity).toEqual(velocity);
  for(const point of plan.cubicBezierControls(2,plan.throughElapsedSeconds))expect(liveFielderReachMarginV105(m,v(0,shoulder,0),v(0,0,1),point)).toBeGreaterThanOrEqual(-1e-12);
});

it('overlaps bounded facing and crouch recovery instead of omitting turns or adding both waits',()=>{
 const m=resolveLiveFielderBodyModelV105(1.8,1.35),pose={crouchMeters:.5,forward:v(0,0,1)};
 expect(liveFielderPreparationPostureSecondsV105(m,pose,v(),v(0,0,-10))).toBeCloseTo(Math.PI/9);
 expect(liveFielderPreparationPostureSecondsV105(m,pose,v(),v(0,0,10))).toBe(.2);
});

it('uses actual tag height for a short arm instead of the legacy whole-body radius',()=>{
 const short=resolveLiveFielderBodyModelV105(1.8,1.35,{fieldArmReachMetersV105:.2}),normal=resolveLiveFielderBodyModelV105(1.8,1.35),anchor=v(0,short.hipHeightMeters,0);
 expect(liveFielderHorizontalReachV105(short,anchor,.9)).toBeLessThan(normal.armReachMeters);
 expect(liveFielderHorizontalReachV105(short,anchor,3)).toBe(-1);
 expect(liveFielderHorizontalReachV105(normal,anchor,.9)).toBeLessThan(1.35);
});
