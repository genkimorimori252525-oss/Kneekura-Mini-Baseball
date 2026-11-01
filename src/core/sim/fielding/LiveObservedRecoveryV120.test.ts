import {expect,it} from 'vitest';
import {estimateLiveObservedRecoveryV120} from './LiveObservedRecoveryV120';
import {resolveLiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';
import {resolveLiveAthleticProfileV115} from '../LiveAthleticControlsV115';
import {createLiveFielderAthleticV115} from './LiveFielderAthleticV115';
const input=()=>({kind:'dive' as const,phase:'slide' as const,position:{x:0,y:.24,z:10},velocity:{x:0,y:0,z:3},
 body:resolveLiveFielderBodyModelV105(1.8,1.35),profile:resolveLiveAthleticProfileV115({heightMeters:1.8,accelerationMps2:6,reactionSeconds:.2,gloveSpeedMps:8}),gravityMps2:9.81,brakingMps2:6,groundY:0,observationCadenceSeconds:.04});
it('derives a stopping endpoint from current observation without reading an unobserved private endpoint',()=>{
 const a=input(),hidden={...a,get privateFutureEndpoint(){throw Error('future');}},r=estimateLiveObservedRecoveryV120(hidden)!;
 expect(r.position.z).toBeCloseTo(10.75,12);expect(r.position.y).toBe(a.body.hipHeightMeters);
 expect(r.remainingSeconds).toBeCloseTo(.5+a.profile.diveRecoverySeconds,12);expect(r.uncertaintySeconds).toBeGreaterThan(0);
});
it('responds to the observed surface braking and does not treat an ended action as active',()=>{
 const a=input(),slow=estimateLiveObservedRecoveryV120({...a,brakingMps2:3})!,fast=estimateLiveObservedRecoveryV120(a)!;
 expect(slow.remainingSeconds).toBeGreaterThan(fast.remainingSeconds);expect(slow.position.z).toBeGreaterThan(fast.position.z);
 expect(estimateLiveObservedRecoveryV120({...a,phase:'ready'})).toBeNull();
});
it('keeps jump horizontal braking parallel to landing and recovery, rather than adding it twice',()=>{
 const i=input(),profile={...i.profile,jumpRecoverySeconds:.3},action=createLiveFielderAthleticV115({kind:'jump',fromSeconds:0,
  position:{x:0,y:i.body.hipHeightMeters,z:0},velocity:{x:0,y:0,z:6},forward:{x:0,y:0,z:1},body:i.body,profile,
  gravityMps2:i.gravityMps2,frictionCoefficient:i.brakingMps2/i.gravityMps2})!,t=action.airborneSeconds+.03,sample=action.sampleAtElapsedSeconds(t),
  estimate=estimateLiveObservedRecoveryV120({...i,kind:'jump',profile,phase:sample.phase,position:sample.position,velocity:sample.velocity})!;
 expect(t+estimate.remainingSeconds).toBeCloseTo(action.throughSeconds,11);
});
