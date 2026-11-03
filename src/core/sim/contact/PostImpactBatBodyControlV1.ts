import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { multiplyQuaternions,rotateVectorByQuaternion,type Quaternion } from '../pitching/BaseballOrientation';
import { createCoupledHeldMeasuredBatBodyControlV1 } from './HeldToMeasuredBatControlV1';
import { queryControlledBatBodyPitchWorldV1,type ControlledBatBodyPitchWorldInputV1 } from '../pitch/ControlledBatBodyPitchWorldV1';

export type PostImpactBatBodyControlInputV1=Readonly<{
  version:'post_impact_bat_body_control_v1';world:ControlledBatBodyPitchWorldInputV1;recoveryEndTick:number;
  maximumSweetSpotSpeedMps:number;maximumBodySpeedMps:number;
}>;
const fields=(v:unknown,k:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...k].sort().join('|');
const v=(a:readonly number[]):Vec3=>({x:a[0],y:a[1],z:a[2]}),a=(p:Vec3)=>[p.x,p.y,p.z];
const q=(a:readonly number[]):Quaternion=>({x:a[0],y:a[1],z:a[2],w:a[3]}),qa=(p:Quaternion)=>[p.x,p.y,p.z,p.w];
const add=(a:readonly number[],b:readonly number[])=>a.map((x,i)=>x+b[i]),sub=(a:readonly number[],b:readonly number[])=>a.map((x,i)=>x-b[i]);
const mul=(a:readonly number[],s:number)=>a.map(x=>x*s),norm=(a:readonly number[])=>Math.hypot(...a);
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const mix=(a:readonly number[],b:readonly number[],u:number)=>add(mul(a,1-u),mul(b,u));
type Cubic=readonly (readonly number[])[];
const curve=(c:Cubic,u:number)=>mix(mix(mix(c[0],c[1],u),mix(c[1],c[2],u),u),mix(mix(c[1],c[2],u),mix(c[2],c[3],u),u),u);
const dc=(c:Cubic,s:number)=>c.slice(1).map((p,i)=>mul(sub(p,c[i]),3/s));
const derivative=(c:Cubic,u:number,s:number)=>{const d=dc(c,s);return mix(mix(d[0],d[1],u),mix(d[1],d[2],u),u);};
const bound=(c:Cubic,s:number)=>Math.max(...dc(c,s).map(norm));
const accelerationBound=(c:Cubic,s:number)=>Math.max(...dc(c,s).slice(1).map((p,i)=>norm(mul(sub(p,dc(c,s)[i]),2/s))));
const split=(c:Cubic)=>{const ab=mix(c[0],c[1],.5),bc=mix(c[1],c[2],.5),cd=mix(c[2],c[3],.5),abc=mix(ab,bc,.5),bcd=mix(bc,cd,.5),mid=mix(abc,bcd,.5);return [[c[0],ab,abc,mid],[mid,bcd,cd,c[3]]];};
const minimumNorm=(c:Cubic):number=>{
  let budget=8192;
  const visit=(p:Cubic,depth:number):number=>{assert(--budget>=0,'quaternion proof budget exhausted');
    const low=Math.hypot(...p[0].map((_,i)=>Math.max(Math.min(...p.map(a=>a[i])),0,-Math.max(...p.map(a=>a[i])))));
    if(low>0)return low;assert(depth<20,'quaternion norm cannot be certified');const [one,two]=split(p);return Math.min(visit(one,depth+1),visit(two,depth+1));};
  return visit(c,0);
};
const freeze=<T>(x:T):T=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function assert(x:unknown,message:string):asserts x {if(!x)throw new Error('post-impact bat/body control: '+message);}

/** Explicit finite kinematic recovery from the ACTUAL rigid impulse. It does
 * not infer muscle torque, a neural reaction policy, a Source command right or
 * a future workload calibration. Original measured endpoint is a motor goal,
 * never the curve silently resumed after its velocity changed at impact. */
export function createPostImpactBatBodyControlV1(raw:PostImpactBatBodyControlInputV1){
  const p=cloneInert(raw);
  assert(fields(p,['version','world','recoveryEndTick','maximumSweetSpotSpeedMps','maximumBodySpeedMps'])&&p.version==='post_impact_bat_body_control_v1','invalid input');
  const w=p.world,old=createCoupledHeldMeasuredBatBodyControlV1(w.batterControl),impact=queryControlledBatBodyPitchWorldV1(w);
  assert(impact.kind==='bat_contact','an actual earliest bat impulse is required');
  const start=impact.moment.elapsedSeconds,origin=impact.moment.originTick,end=(p.recoveryEndTick-origin)/1e6,seconds=end-start;
  assert(Number.isSafeInteger(p.recoveryEndTick)&&end>start&&p.recoveryEndTick<=w.batterControl.bat.throughTick&&p.recoveryEndTick<=w.pitcherRenewal.throughTick
    &&w.pitch.otherActors.every(a=>a.primitive.endTick>=p.recoveryEndTick)
    &&Number.isFinite(p.maximumSweetSpotSpeedMps)&&p.maximumSweetSpotSpeedMps>0&&p.maximumSweetSpotSpeedMps<=w.batterControl.bat.maximumSweetSpotSpeedMps
    &&Number.isFinite(p.maximumBodySpeedMps)&&p.maximumBodySpeedMps>0&&p.maximumBodySpeedMps<=w.batterControl.body.maximumSpeedMps,'finite lease or original speed ceiling differs');
  const initial=impact.actorsAtContact,target=old.sampleContinuous(p.recoveryEndTick),targetBody=old.sampleBodyContinuous(p.recoveryEndTick),b=w.batterControl.bat;
  const length=b.initial.batLengthM,arm=v(mul(sub(a(initial.bat.state.pose.tip),a(initial.bat.state.pose.grip)),w.batPhysical.centerOfMassT));
  const omega=impact.contact.batExitAngularVelocity,gripVelocity=v(sub(a(impact.contact.batExitCenterOfMassVelocity),a(cross(omega,arm))));
  const grip0=a(initial.bat.state.pose.grip),grip1=a(target.state.pose.grip),body0=a(initial.body.position),body1=a(targetBody.position);
  const grips=[grip0,add(grip0,mul(a(gripVelocity),seconds/3)),grip1,grip1];
  const bodies=[body0,add(body0,mul(a(initial.body.velocity),seconds/3)),body1,body1];
  const q0=qa(initial.bat.orientation);let q1=qa(target.orientation);if(q0.reduce((s,n,i)=>s+n*q1[i],0)<0)q1=mul(q1,-1);
  const rotations=[q0,add(q0,mul(qa(multiplyQuaternions({...omega,w:0},q(q0))),seconds/6)),q1,q1];
  const localPalm=rotateVectorByQuaternion(v(sub(a(initial.hand.position),grip0)),{x:-q0[0],y:-q0[1],z:-q0[2],w:q0[3]});
  const rotatedPalm0=rotateVectorByQuaternion(localPalm,initial.bat.orientation);
  const bounds=(g:Cubic,r:Cubic,duration:number,depth:number):{point:number;sweet:number;angular:number;angularAcceleration:number;gripAcceleration:number}=>{
    if(depth){const [ga,gb]=split(g),[ra,rb]=split(r),x=bounds(ga,ra,duration/2,depth-1),y=bounds(gb,rb,duration/2,depth-1);
      return {point:Math.max(x.point,y.point),sweet:Math.max(x.sweet,y.sweet),angular:Math.max(x.angular,y.angular),angularAcceleration:Math.max(x.angularAcceleration,y.angularAcceleration),gripAcceleration:Math.max(x.gripAcceleration,y.gripAcceleration)};}
    const n=minimumNorm(r),d=bound(r,duration),dd=accelerationBound(r,duration),angular=2*d/n,linear=bound(g,duration);
    return {point:linear+angular*(length+b.initial.maximumBatRadiusM),sweet:linear+angular*length*b.measured.sweetSpotT,
      angular,angularAcceleration:2*dd/n+6*d*d/(n*n),gripAcceleration:accelerationBound(g,duration)};
  };
  const speeds=bounds(grips,rotations,seconds,6),bodySpeed=bound(bodies,seconds),palmSpeed=bound(grips,seconds)+speeds.angular*norm(a(localPalm));
  assert(speeds.sweet<=p.maximumSweetSpotSpeedMps&&bodySpeed<=p.maximumBodySpeedMps,'recovery speed exceeds explicit ceiling: sweet '+speeds.sweet+', body '+bodySpeed);
  const sample=(elapsedSeconds:number)=>{
    assert(Number.isFinite(elapsedSeconds)&&elapsedSeconds>=start&&elapsedSeconds<=end,'sample outside finite recovery');
    if(elapsedSeconds===start)return {bat:{orientation:{...initial.bat.orientation},state:{pose:{grip:{...initial.bat.state.pose.grip},tip:{...initial.bat.state.pose.tip}},linearVelocity:{...gripVelocity},angularVelocity:{...omega}}},
      body:{position:{...initial.body.position},velocity:{...initial.body.velocity}},hand:{position:{...initial.hand.position},velocity:v(add(a(gripVelocity),a(cross(omega,rotatedPalm0))))}};
    const u=(elapsedSeconds-start)/seconds,r=curve(rotations,u),rd=derivative(rotations,u,seconds),n=norm(r),projection=r.reduce((s,x,i)=>s+x*rd[i],0)/(n*n);
    const orientation=q(mul(r,1/n)),dq=q(mul(sub(rd,mul(r,projection)),1/n)),angular=multiplyQuaternions(dq,{x:-orientation.x,y:-orientation.y,z:-orientation.z,w:orientation.w});
    const grip=v(curve(grips,u)),linearVelocity=v(derivative(grips,u,seconds)),angularVelocity={x:2*angular.x,y:2*angular.y,z:2*angular.z};
    const axis=rotateVectorByQuaternion({x:0,y:1,z:0},orientation),tip=v(add(a(grip),mul(a(axis),length))),offset=rotateVectorByQuaternion(localPalm,orientation);
    return {bat:{orientation,state:{pose:{grip,tip},linearVelocity,angularVelocity}},body:{position:v(curve(bodies,u)),velocity:v(derivative(bodies,u,seconds))},
      hand:{position:v(add(a(initial.hand.position),add(sub(a(grip),grip0),sub(a(offset),a(rotatedPalm0))))),velocity:v(add(a(linearVelocity),a(cross(angularVelocity,offset))))}};
  };
  const bodyRadius=b.body.obstacles[w.batterControl.bodyObstacleIndex].radiusM,handRadius=b.body.handRadiusM;
  let budget=200000;
  const prove=(gap:(t:number)=>number,speed:number,lo=start,hi=end,depth=0):void=>{assert(--budget>=0,'continuous clearance proof work exhausted');
    const mid=(lo+hi)/2,g=gap(mid);if(g>speed*(hi-lo)/2)return;
    assert(g>0&&depth<40&&mid!==lo&&mid!==hi,'uncertified recovery clearance/reach at '+mid+', gap '+g);prove(gap,speed,lo,mid,depth+1);prove(gap,speed,mid,hi,depth+1);};
  const distance=(a:Vec3,b:Vec3)=>norm(sub([a.x,a.y,a.z],[b.x,b.y,b.z]));
  const palmBody=(t:number)=>{const s=sample(t);return distance(s.hand.position,s.body.position);};
  prove(t=>b.body.maximumHandReachM-palmBody(t),palmSpeed+bodySpeed);prove(t=>palmBody(t)-bodyRadius-handRadius,palmSpeed+bodySpeed);
  prove(t=>sample(t).body.position.y-bodyRadius,bodySpeed);prove(t=>sample(t).hand.position.y-handRadius,palmSpeed);
  prove(t=>{const s=sample(t).bat.state.pose;return Math.min(s.grip.y,s.tip.y)-b.initial.maximumBatRadiusM;},speeds.point);
  for(const [i,o]of b.body.obstacles.entries()){
    if(i!==w.batterControl.bodyObstacleIndex){
      prove(t=>distance(sample(t).body.position,o.center)-bodyRadius-o.radiusM,bodySpeed);
      prove(t=>distance(sample(t).hand.position,o.center)-handRadius-o.radiusM,palmSpeed);
    }
    prove(t=>{const s=sample(t),pose=s.bat.state.pose,c=i===w.batterControl.bodyObstacleIndex?s.body.position:o.center,axis=mul(sub(a(pose.tip),a(pose.grip)),1/length),d=sub(a(c),a(pose.grip)),along=Math.max(0,Math.min(length,d.reduce((x,y,j)=>x+y*axis[j],0)));
      return norm(sub(d,mul(axis,along)))-o.radiusM-b.initial.maximumBatRadiusM;},speeds.point+(i===w.batterControl.bodyObstacleIndex?bodySpeed:0));
  }
  for(const i of w.batterControl.footObstacleIndices)prove(t=>w.batterControl.maximumLegReachM-distance(sample(t).body.position,b.body.obstacles[i].center),bodySpeed);
  const glove=w.pitch.otherActors.find(a=>a.playerId===w.batterPlayerId&&a.primitive.role==='glove')!;
  prove(t=>w.maximumGloveReachM-distance(sample(t).body.position,glove.primitive.startCenter),bodySpeed);
  return Object.freeze({input:freeze(p),impact,fromElapsedSeconds:start,throughElapsedSeconds:end,sample,
    certificate:freeze({kind:'post_impact_bat_body_certificate_v1' as const,originalSourceMomentPreserved:true as const,recoilUsed:true as const,
      terminalMotion:'REST_AT_ORIGINAL_REFERENCE_POSE' as const,maximumPointSpeedMps:speeds.point,maximumSweetSpotSpeedMps:speeds.sweet,
      maximumAngularSpeedRadPerSecond:speeds.angular,maximumAngularAccelerationRadPerSecond2:speeds.angularAcceleration,
      maximumGripAccelerationMps2:speeds.gripAcceleration,maximumBodySpeedMps:bodySpeed,maximumPalmSpeedMps:palmSpeed,
      incomingMaximumPointSpeedMps:old.certificate.maximumPointSpeedMps,
      muscleTorqueCalibrated:false as const,neuralReactionPolicySpecified:false as const,nativeAdmission:false as const})});
}
