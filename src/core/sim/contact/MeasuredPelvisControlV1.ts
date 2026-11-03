import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { normalizeQuaternion,rotateVectorByQuaternion,type Quaternion } from '../pitching/BaseballOrientation';

export type MeasuredPelvisReferenceV1=Readonly<{
  provenance:Readonly<{clipId:string;sourceSha256:string;batSourceSha256:string}>;
  frames:readonly Readonly<{tick:number;leftHip:Vec3;rightHip:Vec3}>[];
  sourceTicksPerSecond:number;ticksPerSecond:1000000;startTick:number;playbackRate:number;
  transform:Readonly<{rotation:Quaternion;translation:Vec3;scale:1}>;
}>;
export type MeasuredPelvisControlV1=Readonly<{
  version:'measured_pelvis_control_v1';startTick:number;bridgeStartTick:number;throughTick:number;
  initialCenter:Vec3;reference:MeasuredPelvisReferenceV1;maximumSpeedMps:number;
}>;
const fields=(v:unknown,k:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...k].sort().join('|');
const vector=(v:Vec3)=>fields(v,['x','y','z'])&&Object.values(v).every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6);
const tick=(n:number)=>Number.isSafeInteger(n)&&n>=0;
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(v:Vec3,s:number):Vec3=>({x:v.x*s,y:v.y*s,z:v.z*s});
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
const mix=(a:Vec3,b:Vec3,u:number)=>add(scale(a,1-u),scale(b,u));
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('measured pelvis control: '+message);}

/** Data validation only; no clock advancement, control or ability is issued. */
export function validateMeasuredPelvisReferenceV1(raw:MeasuredPelvisReferenceV1){
  const r=cloneInert(raw);
  assert(fields(r,['provenance','frames','sourceTicksPerSecond','ticksPerSecond','startTick','playbackRate','transform'])
    &&fields(r.provenance,['clipId','sourceSha256','batSourceSha256'])&&typeof r.provenance.clipId==='string'&&r.provenance.clipId.length>0
    &&[r.provenance.sourceSha256,r.provenance.batSourceSha256].every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s))
    &&Number.isSafeInteger(r.sourceTicksPerSecond)&&r.sourceTicksPerSecond>0&&r.ticksPerSecond===1e6&&tick(r.startTick)
    &&Number.isFinite(r.playbackRate)&&r.playbackRate>0&&r.playbackRate<=20,'invalid original reference');
  assert(fields(r.transform,['rotation','translation','scale'])&&r.transform.scale===1&&vector(r.transform.translation)
    &&fields(r.transform.rotation,['x','y','z','w'])&&Object.values(r.transform.rotation).every(Number.isFinite)
    &&r.transform.rotation.x===0&&r.transform.rotation.z===0&&Math.abs(Math.hypot(...Object.values(r.transform.rotation))-1)<1e-6,'upright rigid registration required');
  assert(Array.isArray(r.frames)&&r.frames.length>=2&&r.frames.length<=4096&&r.frames.every((f,i)=>fields(f,['tick','leftHip','rightHip'])
    &&tick(f.tick)&&vector(f.leftHip)&&vector(f.rightHip)&&(i===0||f.tick>r.frames[i-1].tick)),'invalid original joint keys');
  return freeze(r);
}

/** Hip midpoint is an explicitly declared collider proxy, NOT a measured COM,
 * force/torque solution or an authority to move a person's body. Every original
 * key and its vertical axis is retained. Inter-key velocity jumps are explicit. */
export function createMeasuredPelvisControlV1(raw:MeasuredPelvisControlV1){
  const p=cloneInert(raw);
  assert(fields(p,['version','startTick','bridgeStartTick','throughTick','initialCenter','reference','maximumSpeedMps'])
    &&p.version==='measured_pelvis_control_v1'&&[p.startTick,p.bridgeStartTick,p.throughTick].every(tick)
    &&p.startTick<=p.bridgeStartTick&&vector(p.initialCenter)&&Number.isFinite(p.maximumSpeedMps)&&p.maximumSpeedMps>0,'invalid control');
  const r=validateMeasuredPelvisReferenceV1(p.reference);
  const first=r.frames[0],last=r.frames.at(-1)!,end=r.startTick+(last.tick-first.tick)/r.sourceTicksPerSecond/r.playbackRate*1e6;
  assert(p.bridgeStartTick<r.startTick&&p.throughTick>r.startTick&&p.throughTick<end,'finite measured interval required');
  const rotation=normalizeQuaternion(r.transform.rotation);
  const centers=r.frames.map(f=>add(rotateVectorByQuaternion(mix(f.leftHip,f.rightHip,.5),rotation),r.transform.translation));
  const velocities=centers.slice(1).map((v,i)=>scale(sub(v,centers[i]),r.sourceTicksPerSecond*r.playbackRate/(r.frames[i+1].tick-r.frames[i].tick)));
  const seconds=(r.startTick-p.bridgeStartTick)/1e6;
  const controls=[p.initialCenter,p.initialCenter,sub(centers[0],scale(velocities[0],seconds/3)),centers[0]];
  const derivativeControls=controls.slice(1).map((v,i)=>scale(sub(v,controls[i]),3/seconds));
  // Convex-hull speed proof, tightened by exact subdivision. No sample-speed
  // test, body-position correction or extrapolation can authorize the path.
  const bound=(a:Vec3,b:Vec3,c:Vec3,depth:number):number=>{
    if(!depth)return Math.max(norm(a),norm(b),norm(c));
    const ab=mix(a,b,.5),bc=mix(b,c,.5),m=mix(ab,bc,.5);
    return Math.max(bound(a,ab,m,depth-1),bound(m,bc,c,depth-1));
  };
  const maximumSpeedMps=Math.max(bound(derivativeControls[0],derivativeControls[1],derivativeControls[2],6),...velocities.map(norm));
  assert(Number.isFinite(maximumSpeedMps)&&maximumSpeedMps<=p.maximumSpeedMps,'body speed exceeds declared envelope');
  const sampleContinuous=(atTick:number)=>{
    assert(Number.isFinite(atTick)&&atTick>=p.startTick&&atTick<=p.throughTick,'sample outside finite body control');
    if(atTick<=p.bridgeStartTick)return {tick:atTick,position:p.initialCenter,velocity:{x:0,y:0,z:0},phase:'held' as const};
    if(atTick<r.startTick){
      const u=(atTick-p.bridgeStartTick)/(r.startTick-p.bridgeStartTick),[a,b,c,d]=controls;
      const ab=mix(a,b,u),bc=mix(b,c,u),cd=mix(c,d,u);
      return {tick:atTick,position:mix(mix(ab,bc,u),mix(bc,cd,u),u),
        velocity:mix(mix(derivativeControls[0],derivativeControls[1],u),mix(derivativeControls[1],derivativeControls[2],u),u),phase:'bridge' as const};
    }
    const source=first.tick+(atTick-r.startTick)/1e6*r.sourceTicksPerSecond*r.playbackRate;
    let lo=0,hi=r.frames.length-2;
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(r.frames[mid].tick<=source)lo=mid;else hi=mid-1;}
    const u=(source-r.frames[lo].tick)/(r.frames[lo+1].tick-r.frames[lo].tick);
    return {tick:atTick,position:mix(centers[lo],centers[lo+1],u),velocity:{...velocities[lo]},phase:'measured' as const};
  };
  return Object.freeze({input:freeze(p),maximumSpeedMps,sampleContinuous,
    authority:'KINEMATIC_HIP_MIDPOINT_COLLIDER_REFERENCE' as const,nativeAdmission:false as const,
    measuredCOM:false as const,muscleTorqueCalibrated:false as const,originalInterKeyVelocityJumpsRetained:true as const});
}
