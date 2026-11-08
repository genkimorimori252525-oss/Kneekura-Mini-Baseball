import type {Vec3} from '../../model/geometry';
import {validateLiveFielderBodyModelV105,type LiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';
import type {LiveFielderAthleticPhaseV115} from './LiveFielderAthleticV115';
import {validateLiveAthleticProfileV115,type LiveAthleticProfileV115} from '../LiveAthleticControlsV115';

export type LiveObservedRecoveryInputV120=Readonly<{kind:'jump'|'dive';phase:LiveFielderAthleticPhaseV115;
 position:Vec3;velocity:Vec3;body:LiveFielderBodyModelV105;profile:LiveAthleticProfileV115;
 gravityMps2:number;brakingMps2:number;groundY:number;observationCadenceSeconds:number}>;
/** A visible-phase estimate, never another player's private action endpoint.
 * A conservative takeoff/landing estimate is intentionally uncertain. The
 * source owner's exact endpoint belongs only to self or a delivered callout. */
export function estimateLiveObservedRecoveryV120(input:LiveObservedRecoveryInputV120){
 const {body:m,profile:p,position,velocity,phase,kind}=input,g=input.gravityMps2,brake=input.brakingMps2,
  cadence=input.observationCadenceSeconds;
 if(!validateLiveFielderBodyModelV105(m)||!validateLiveAthleticProfileV115(p)||p.heightMeters!==m.heightMeters||![g,brake,cadence].every(n=>Number.isFinite(n)&&n>0)
  ||![position.x,position.y,position.z,velocity.x,velocity.y,velocity.z,input.groundY].every(Number.isFinite)
  ||!['jump','dive'].includes(kind)||!['takeoff','airborne','land','slide','recover','ready'].includes(phase))throw Error('invalid observed athletic recovery');
 if(phase==='ready')return null;
 const speed=Math.hypot(velocity.x,velocity.z),stop=speed/brake,standingY=input.groundY+m.hipHeightMeters,
  recovery=kind==='dive'?p.diveRecoverySeconds:Math.max(p.jumpRecoverySeconds,stop);
 let flight=0,remaining=0,uncertainty=cadence*2;
 if(phase==='recover'){
  if(kind==='dive'){
   const rise=Math.max(1e-9,m.hipHeightMeters-.24),acceleration=4*rise/(recovery*recovery),firstHalf=position.y<standingY-rise/2;
   remaining=firstHalf?recovery-Math.max(0,velocity.y)/acceleration:Math.max(0,velocity.y)/acceleration;
   remaining=Math.max(0,Math.min(recovery,remaining));
  }else remaining=Math.max(stop,Math.max(0,standingY-position.y)/m.postureSpeedMps,p.jumpRecoverySeconds);
 }else if(phase==='slide')remaining=stop+recovery;
 else if(phase==='airborne'){
  const targetY=kind==='dive'?input.groundY+.24:standingY,
   discriminant=velocity.y*velocity.y+2*g*Math.max(0,position.y-targetY);
  flight=Math.max(0,(velocity.y+Math.sqrt(discriminant))/g);
  const landing=kind==='jump'?2*Math.min(m.heightMeters*.12,m.hipHeightMeters-.24)/Math.max(.5,Math.abs(velocity.y-g*flight)):0;
  remaining=kind==='jump'?flight+Math.max(stop,landing+p.jumpRecoverySeconds):flight+stop+recovery;
 }else if(phase==='takeoff'){
  flight=kind==='dive'?Math.sqrt(2*Math.max(0,position.y-input.groundY-.24)/g):2*Math.sqrt(2*Math.max(0,p.jumpHeightMeters)/g);
  remaining=(kind==='dive'?.12:.08)+flight+(kind==='jump'?Math.max(stop,p.jumpRecoverySeconds):stop+recovery);uncertainty=cadence*3;
 }else remaining=Math.max(stop,p.jumpRecoverySeconds+2*Math.min(m.heightMeters*.12,m.hipHeightMeters-.24)/Math.max(.5,Math.abs(velocity.y)));
 const travelSeconds=phase==='recover'||phase==='slide'?stop/2:flight+stop/2;
 return Object.freeze({remainingSeconds:remaining,position:Object.freeze({x:position.x+velocity.x*travelSeconds,y:standingY,z:position.z+velocity.z*travelSeconds}),
  velocity:Object.freeze({x:0,y:0,z:0}),uncertaintySeconds:uncertainty});
}
