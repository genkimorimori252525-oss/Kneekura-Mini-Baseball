import {expect,it} from 'vitest';
import {createLiveFielderAthleticV115} from './LiveFielderAthleticV115';
import {resolveLiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';
import {resolveLiveAthleticProfileV115} from '../LiveAthleticControlsV115';
const v=(x=0,y=0,z=0)=>({x,y,z});
const body=resolveLiveFielderBodyModelV105(1.8,1.35),profile=resolveLiveAthleticProfileV115({heightMeters:1.8,accelerationMps2:5.2,reactionSeconds:.18,gloveSpeedMps:11});
const base={fromSeconds:2,position:v(1,body.hipHeightMeters,5),velocity:v(3,0,0),forward:v(1,0,0),
 body,profile,gravityMps2:9.81,frictionCoefficient:.65};
it('follows gravity in a jump and keeps the real eye and shoulder above the same body',()=>{
 const p=createLiveFielderAthleticV115({...base,kind:'jump'}),before=JSON.stringify(base);
 expect(p).not.toBeNull();const a=p!,mid=a.sampleAtElapsedSeconds(a.apexSeconds);
 expect(mid.position.y-base.position.y).toBeCloseTo(profile.jumpHeightMeters,10);
 expect(mid.velocity.y).toBeCloseTo(0,10);expect(mid.phase).toBe('airborne');
 expect(mid.pose.eye.y-mid.pose.shoulder.y).toBeCloseTo(body.eyeHeightMeters-body.shoulderHeightMeters,10);
 expect(a.sampleAtElapsedSeconds(a.landedSeconds).pose.foot.y).toBeCloseTo(0,10);
 expect(a.sampleAtElapsedSeconds(a.throughSeconds).phase).toBe('ready');expect(JSON.stringify(base)).toBe(before);
});
it('makes a dive finite, slides with friction, then really waits for recovery',()=>{
 const p=createLiveFielderAthleticV115({...base,kind:'dive'})!,land=p.sampleAtElapsedSeconds(p.landedSeconds),stop=p.sampleAtElapsedSeconds(p.stoppedSeconds);
 expect(land.pose.shoulder.y).toBeLessThan(.6);expect(land.pose.head.x).toBeGreaterThan(land.position.x);
 expect(Math.hypot(stop.velocity.x,stop.velocity.z)).toBeCloseTo(0,10);
 expect(p.throughSeconds-p.stoppedSeconds).toBeCloseTo(profile.diveRecoverySeconds,10);
 expect(p.sampleAtElapsedSeconds(p.throughSeconds-.01).phase).toBe('recover');
 for(let t=p.landedSeconds;t<p.stoppedSeconds;t+=.02){const s=p.sampleAtElapsedSeconds(t),next=p.sampleAtElapsedSeconds(t+.001);
  expect(Math.hypot(next.velocity.x,next.velocity.z)).toBeLessThanOrEqual(Math.hypot(s.velocity.x,s.velocity.z)+1e-9);}
});
it('keeps all segment joins position-continuous and returns exact analytic body segments',()=>{
 for(const kind of ['jump','dive'] as const){const p=createLiveFielderAthleticV115({...base,kind})!;
  for(const t of p.boundaries){const left=p.sampleAtElapsedSeconds(t-1e-8),right=p.sampleAtElapsedSeconds(t+1e-8);
   expect(Math.hypot(left.position.x-right.position.x,left.position.y-right.position.y,left.position.z-right.position.z)).toBeLessThan(1e-5);}
  for(let t=p.fromSeconds;t<p.throughSeconds;t+=.037){const c=p.curveAtElapsedSeconds(t),s=p.sampleAtElapsedSeconds(t),dt=t-c.from;
   expect(s.position.x).toBeCloseTo(c.p.x+c.velocity.x*dt+.5*c.acceleration.x*dt*dt,10);}
 }
});
it('preserves individual height, jump setting and ground friction instead of a fixed reach bonus',()=>{
 const a=createLiveFielderAthleticV115({...base,kind:'jump'})!,b=createLiveFielderAthleticV115({...base,kind:'jump',profile:{...profile,jumpHeightMeters:.1}})!;
 expect(a.sampleAtElapsedSeconds(a.apexSeconds).position.y).toBeGreaterThan(b.sampleAtElapsedSeconds(b.apexSeconds).position.y);
 const high=createLiveFielderAthleticV115({...base,kind:'dive',frictionCoefficient:1})!,low=createLiveFielderAthleticV115({...base,kind:'dive',frictionCoefficient:.3})!;
 expect(low.sampleAtElapsedSeconds(low.stoppedSeconds).position.x).toBeGreaterThan(high.sampleAtElapsedSeconds(high.stoppedSeconds).position.x);
 expect(()=>createLiveFielderAthleticV115({...base,kind:'dive',frictionCoefficient:0})).toThrow();
});

it('keeps the Source foot continuous and finitely moving at every action boundary',()=>{
 for(const kind of ['jump','dive'] as const)for(const speed of [0,3])for(const height of [1.1,1.8,2.5])for(const high of [false,true]){
  const dimensions=resolveLiveFielderBodyModelV105(height,1.35),settings={...profile,heightMeters:height,jumpHeightMeters:high?1.5:.01,
    diveRecoverySeconds:high?5:.1,jumpRecoverySeconds:high?3:.05},
   input={...base,kind,body:dimensions,profile:settings,position:v(1,dimensions.hipHeightMeters+.3,5),velocity:v(speed,0,0)},
   p=createLiveFielderAthleticV115(input)!,floor=input.position.y-dimensions.hipHeightMeters,
   cuts=[p.fromSeconds,p.airborneSeconds,p.apexSeconds,p.landedSeconds,p.stoppedSeconds,p.throughSeconds,...p.boundaries];
  for(const t of cuts){
   const epsilon=1e-8,left=p.sampleAtElapsedSeconds(t-epsilon).pose.foot,right=p.sampleAtElapsedSeconds(t+epsilon).pose.foot,
    distance=Math.hypot(left.x-right.x,left.y-right.y,left.z-right.z);
   expect(distance).toBeLessThanOrEqual(2*epsilon*p.maximumPointSpeedMps+1e-10);
   expect(left.y).toBeGreaterThanOrEqual(floor-1e-12);expect(right.y).toBeGreaterThanOrEqual(floor-1e-12);
  }
  for(let t=p.fromSeconds;t<p.throughSeconds;t+=.007){
   const dt=1e-6,a=p.sampleAtElapsedSeconds(t).pose.foot,b=p.sampleAtElapsedSeconds(t+dt).pose.foot;
   expect(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/dt).toBeLessThanOrEqual(p.maximumPointSpeedMps+1e-7);
   expect(a.y).toBeGreaterThanOrEqual(floor-1e-12);
  }
 }
});
it('plants jumping feet through takeoff and landing while a dive lifts and lowers its feet continuously',()=>{
 const jump=createLiveFielderAthleticV115({...base,kind:'jump'})!,dive=createLiveFielderAthleticV115({...base,kind:'dive'})!,floor=0;
 for(const t of [jump.fromSeconds,(jump.fromSeconds+jump.airborneSeconds)/2,jump.airborneSeconds,jump.landedSeconds,jump.throughSeconds])
  expect(jump.sampleAtElapsedSeconds(t).pose.foot.y).toBeCloseTo(floor,12);
 const mid=(jump.airborneSeconds+jump.landedSeconds)/2,dt=1e-4,
  a=jump.sampleAtElapsedSeconds(mid-dt).pose.foot.y,b=jump.sampleAtElapsedSeconds(mid).pose.foot.y,c=jump.sampleAtElapsedSeconds(mid+dt).pose.foot.y;
 expect(b).toBeGreaterThan(floor);expect((c-2*b+a)/(dt*dt)).toBeCloseTo(-base.gravityMps2,5);
 expect(dive.sampleAtElapsedSeconds(dive.fromSeconds).pose.foot.y).toBeCloseTo(floor,12);
 expect(dive.sampleAtElapsedSeconds((dive.fromSeconds+dive.airborneSeconds)/2).pose.foot.y).toBeGreaterThan(floor);
 expect(dive.sampleAtElapsedSeconds(dive.airborneSeconds).pose.foot.y).toBeGreaterThan(floor);
 for(const t of [dive.landedSeconds,dive.stoppedSeconds,(dive.stoppedSeconds+dive.throughSeconds)/2,dive.throughSeconds])
  expect(dive.sampleAtElapsedSeconds(t).pose.foot.y).toBeCloseTo(floor,12);
});
