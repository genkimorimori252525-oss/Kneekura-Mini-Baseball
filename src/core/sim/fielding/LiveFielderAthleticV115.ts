import type {Vec3} from '../../model/geometry';
import type {LiveAthleticProfileV115} from '../LiveAthleticControlsV115';
import type {LiveFielderBodyModelV105,LiveFielderBodyPoseV105} from './LiveFielderBodyGeometryV105';

export type LiveFielderAthleticPhaseV115='takeoff'|'airborne'|'land'|'slide'|'recover'|'ready';
export type LiveAthleticCurveV115=Readonly<{from:number;p:Vec3;velocity:Vec3;acceleration:Vec3}>;
export type LiveFielderAthleticInputV115=Readonly<{kind:'jump'|'dive';fromSeconds:number;position:Vec3;velocity:Vec3;forward:Vec3;
 body:LiveFielderBodyModelV105;profile:LiveAthleticProfileV115;gravityMps2:number;frictionCoefficient:number}>;
export type LiveFielderAthleticPlanV115=Readonly<{
 kind:'jump'|'dive';fromSeconds:number;airborneSeconds:number;apexSeconds:number;landedSeconds:number;stoppedSeconds:number;throughSeconds:number;
 boundaries:readonly number[];maximumPointSpeedMps:number;maximumAnchorSpeedMps:number;
 curveAtElapsedSeconds:(t:number)=>LiveAthleticCurveV115;
 sampleAtElapsedSeconds:(t:number)=>Readonly<{phase:LiveFielderAthleticPhaseV115;position:Vec3;velocity:Vec3;acceleration:Vec3;
  pose:LiveFielderBodyPoseV105;shoulderVelocity:Vec3;shoulderAcceleration:Vec3;shoulderJerk:Vec3;lean:number;airborne:boolean}>;
}>;
const v=(x=0,y=0,z=0):Vec3=>({x,y,z}),add=(a:Vec3,b:Vec3)=>v(a.x+b.x,a.y+b.y,a.z+b.z),mul=(a:Vec3,n:number)=>v(a.x*n,a.y*n,a.z*n),
 length=(a:Vec3)=>Math.hypot(a.x,a.y,a.z),finite=(a:Vec3)=>a&&[a.x,a.y,a.z].every(Number.isFinite),clamp=(x:number)=>Math.max(0,Math.min(1,x));

/** Finite piecewise analytic action. Contact impulses occur only at the ground;
 * no airborne steering, position snap, catch or official fact is manufactured. */
export function createLiveFielderAthleticV115(input:LiveFielderAthleticInputV115):LiveFielderAthleticPlanV115|null{
 const {body:m,profile:p,gravityMps2:g,frictionCoefficient:mu}=input,start=input.fromSeconds,
  horizontal=Math.hypot(input.forward.x,input.forward.z),h=m.heightMeters,floor=input.position.y-m.hipHeightMeters;
 if(!['jump','dive'].includes(input.kind)||![start,g,mu].every(Number.isFinite)||start<0||g<=0||mu<=0
  ||![input.position,input.velocity,input.forward].every(finite)||Math.abs(input.velocity.y)>1e-8||horizontal<=0
  ||p.heightMeters!==m.heightMeters||![p.jumpHeightMeters,p.divePushMps,p.diveRecoverySeconds,p.jumpRecoverySeconds].every(Number.isFinite))
  throw Error('fielder athletic action: finite grounded individual body and surface required');
 if(input.kind==='jump'&&p.jumpHeightMeters<=0)return null;
 const forward=v(input.forward.x/horizontal,0,input.forward.z/horizontal),push=input.kind==='jump'?.08:.12,
  segments:(LiveAthleticCurveV115&{through:number;phase:LiveFielderAthleticPhaseV115})[]=[];
 let at=start,position={...input.position},velocity={...input.velocity};
 const append=(duration:number,acceleration:Vec3,phase:LiveFielderAthleticPhaseV115)=>{
  if(duration<=1e-12)return;
  segments.push({from:at,through:at+duration,p:position,velocity,acceleration,phase});
  position=add(position,add(mul(velocity,duration),mul(acceleration,.5*duration*duration)));
  velocity=add(velocity,mul(acceleration,duration));at+=duration;
 };
 const brake=(duration:number,verticalAcceleration:number,phase:LiveFielderAthleticPhaseV115)=>{
  const speed=Math.hypot(velocity.x,velocity.z),stop=speed/(mu*g),first=Math.min(duration,stop),
   acceleration=speed>0?v(-velocity.x/speed*mu*g,verticalAcceleration,-velocity.z/speed*mu*g):v(0,verticalAcceleration,0);
  append(first,acceleration,phase);
  if(first===stop){velocity=v(0,velocity.y,0);}
  if(duration>first)append(duration-first,v(0,verticalAcceleration,0),phase);
 };
 let apex:number,landed:number,stopped:number,recoverFrom:number;
 if(input.kind==='jump'){
  const launch=(-g*push+Math.sqrt(g*g*push*push+8*g*p.jumpHeightMeters))/2;
  append(push,v(0,launch/push,0),'takeoff');
  apex=at+velocity.y/g;
  const flight=(velocity.y+Math.sqrt(velocity.y*velocity.y+2*g*(position.y-input.position.y)))/g;
  append(flight,v(0,-g,0),'airborne');landed=at;
  const cushion=Math.min(h*.12,m.hipHeightMeters-.24),down=Math.max(0,-velocity.y),absorb=down>0?2*cushion/down:0;
  stopped=landed+Math.hypot(velocity.x,velocity.z)/(mu*g);
  if(absorb>0)brake(absorb,down/absorb,'land');
  velocity=v(velocity.x,0,velocity.z);recoverFrom=at;
  const recovery=Math.max(p.jumpRecoverySeconds,Math.max(0,stopped-at)),rise=input.position.y-position.y;
  brake(recovery/2,4*rise/(recovery*recovery),'recover');brake(recovery/2,-4*rise/(recovery*recovery),'recover');
 }else{
  append(push,mul(forward,p.divePushMps/push),'takeoff');apex=start;
  const landingHeight=floor+.24,flight=Math.sqrt(Math.max(0,2*(position.y-landingHeight)/g));
  append(flight,v(0,-g,0),'airborne');landed=at;
  // The normal ground impulse arrests downward motion, not horizontal motion.
  velocity=v(velocity.x,0,velocity.z);
  brake(Math.hypot(velocity.x,velocity.z)/(mu*g),0,'slide');stopped=at;recoverFrom=at;
  const recovery=p.diveRecoverySeconds,rise=input.position.y-position.y;
  if(recovery<=0)throw Error('fielder athletic action: positive recovery required');
  append(recovery/2,v(0,4*rise/(recovery*recovery),0),'recover');
  append(recovery/2,v(0,-4*rise/(recovery*recovery),0),'recover');
 }
 const through=at,endPosition={...position},airborne=start+push,
  maximumAnchorSpeedMps=Math.max(...segments.flatMap(s=>[length(s.velocity),length(add(s.velocity,mul(s.acceleration,s.through-s.from)))])),
  maximumLeanRate=input.kind==='dive'?Math.max(1/push,1.5/p.diveRecoverySeconds):0;
 const curveAtElapsedSeconds=(t:number):LiveAthleticCurveV115=>{
  if(!Number.isFinite(t))throw Error('fielder athletic action: finite time required');
  if(t>=through)return{from:through,p:endPosition,velocity:v(),acceleration:v()};
  const s=segments.find(s=>t<s.through)??segments.at(-1)!;return s;
 };
 const sampleAtElapsedSeconds=(t:number)=>{
  const c=curveAtElapsedSeconds(t),dt=Math.max(0,Math.min(t,through)-c.from),position=add(c.p,add(mul(c.velocity,dt),mul(c.acceleration,.5*dt*dt))),
   velocity=add(c.velocity,mul(c.acceleration,dt)),phase=t>=through?'ready':segments.find(s=>t<s.through)!.phase,
   recoveryDuration=through-recoverFrom,u=clamp((t-recoverFrom)/recoveryDuration),
   lean=input.kind==='dive'?(t<airborne?clamp((t-start)/push):t<recoverFrom?1:1-u*u*(3-2*u)):0,
   leanRate=input.kind==='dive'?(t>=start&&t<airborne?1/push:t>=recoverFrom&&t<through?-6*u*(1-u)/recoveryDuration:0):0,
   leanAcceleration=input.kind==='dive'&&t>=recoverFrom&&t<through?(-6+12*u)/(recoveryDuration*recoveryDuration):0,
   leanJerk=input.kind==='dive'&&t>=recoverFrom&&t<through?12/(recoveryDuration**3):0,
   part=(along:number,standingAboveHip:number,proneAboveHip:number)=>add(position,add(mul(forward,along*lean),v(0,standingAboveHip*(1-lean)+proneAboveHip*lean,0))),
   partVelocity=(along:number,standingAboveHip:number,proneAboveHip:number)=>add(velocity,add(mul(forward,along*leanRate),v(0,(proneAboveHip-standingAboveHip)*leanRate,0))),
   shoulder=part(h*.30,m.shoulderHeightMeters-m.hipHeightMeters,h*.04),eye=part(h*.46,m.eyeHeightMeters-m.hipHeightMeters,h*.055),
   shoulderVelocity=partVelocity(h*.30,m.shoulderHeightMeters-m.hipHeightMeters,h*.04),
   shoulderLever=add(mul(forward,h*.30),v(0,h*.04-(m.shoulderHeightMeters-m.hipHeightMeters),0)),
   shoulderAcceleration=add(c.acceleration,mul(shoulderLever,leanAcceleration)),shoulderJerk=mul(shoulderLever,leanJerk),
   airborneNow=phase==='airborne',rawFoot=part(-h*.44,-m.hipHeightMeters,0),
   flightSeconds=landed-airborne,flightTime=Math.max(0,Math.min(flightSeconds,t-airborne)),
   // A finite leg proxy keeps the existing COM/torso trajectories intact.
   // Jump feet leave a planted takeoff at zero height and follow gravity to
   // the same landing. Dive feet rise with lean, then extend toward the floor
   // during flight instead of jumping between grounded and hip-height poses.
   footHeight=input.kind==='jump'?(airborneNow ? .5*g*flightTime*(flightSeconds-flightTime):0)
    :phase==='takeoff'?rawFoot.y-floor:airborneNow?position.y-floor-.24*flightTime/flightSeconds:0,
   foot=v(rawFoot.x,floor+Math.max(0,footHeight),rawFoot.z);
  const pose:LiveFielderBodyPoseV105={foot,hip:position,shoulder,head:part(h*.48,h-m.hipHeightMeters,h*.07),eye,
   eyeVelocity:partVelocity(h*.46,m.eyeHeightMeters-m.hipHeightMeters,h*.055),forward,crouchMeters:Math.max(0,input.position.y-position.y),armReachMeters:m.armReachMeters};
  return{phase,position,velocity,acceleration:c.acceleration,pose,shoulderVelocity,shoulderAcceleration,shoulderJerk,lean,airborne:airborneNow};
 };
 return Object.freeze({kind:input.kind,fromSeconds:start,airborneSeconds:airborne,apexSeconds:apex,landedSeconds:landed,stoppedSeconds:stopped,throughSeconds:through,
  boundaries:Object.freeze([...new Set(segments.map(s=>s.through))]),maximumAnchorSpeedMps,maximumPointSpeedMps:maximumAnchorSpeedMps+h*maximumLeanRate,
  curveAtElapsedSeconds,sampleAtElapsedSeconds});
}
